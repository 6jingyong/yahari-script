import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { AccountError, authorizationAttempt, validateCallback, validateIdentity, completedResponse,
  createChatGptBridge, requireLocalRequest, openAccountStore } from '../scripts/chatgpt-account.mjs';

const issuer = 'https://auth.openai.com', clientId = 'oaiapp_testclient';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', use: 'sig', alg: 'RS256' };
const encode = data => Buffer.from(JSON.stringify(data)).toString('base64url');
function jwt(nonce, overrides = {}, header = {}) {
  const unsigned = `${encode({ alg: 'RS256', kid: 'test-key', ...header })}.${encode({ iss: issuer,
    aud: clientId, exp: Math.floor(Date.now() / 1000) + 3600, nonce, sub: 'test-subject', email: 'test@example.invalid', ...overrides })}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
}
const scopes = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
function eventStream(events) {
  return new Response(events.map(event => `data: ${JSON.stringify(event)}\r\n\r\n`).join(''), { headers: { 'Content-Type': 'text/event-stream' } });
}

test('OAuth uses stable installation ID, fresh PKCE/state/nonce and issued client on return', () => {
  const first = authorizationAttempt('urn:uuid:test', 'http://127.0.0.1:4173');
  const second = authorizationAttempt('urn:uuid:test', 'http://127.0.0.1:4184', { id: 'p', client_id: clientId, subject: 's' });
  const url = new URL(first.url), returning = new URL(second.url);
  assert.equal(url.searchParams.get('client_id'), 'dynamic_agent_client');
  assert.equal(url.searchParams.get('agent_name_hint'), 'Yahari Script');
  assert.equal(url.searchParams.get('ext_agent_host_id'), returning.searchParams.get('ext_agent_host_id'));
  assert.notEqual(first.state, second.state); assert.notEqual(first.nonce, second.nonce);
  assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(first.verifier).digest('base64url'));
  assert.equal(returning.searchParams.get('client_id'), clientId);
  assert.equal(returning.searchParams.has('agent_name_hint'), false);
  assert.equal(returning.searchParams.has('id_token_hint'), false);
  assert.ok(url.searchParams.get('scope').includes('chatgpt.tokens.use.direct'));
});

test('callback rejects stale, declined, mismatched state/client and missing registration', () => {
  const attempt = authorizationAttempt('urn:uuid:test', 'http://127.0.0.1:4173');
  const callback = new URL(`${attempt.redirectUri}?state=${attempt.state}&code=test&client_id=${clientId}`);
  assert.deepEqual(validateCallback(callback, attempt), { code: 'test', clientId });
  assert.throws(() => validateCallback(callback, attempt, attempt.created + 600_001), AccountError);
  callback.searchParams.set('state', 'wrong'); assert.throws(() => validateCallback(callback, attempt));
  callback.searchParams.set('state', attempt.state); callback.searchParams.set('error', 'access_denied');
  assert.throws(() => validateCallback(callback, attempt)); callback.searchParams.delete('error');
  assert.throws(() => validateCallback(callback, { ...attempt, clientId: 'oaiapp_other' }));
  callback.searchParams.delete('client_id'); assert.throws(() => validateCallback(callback, attempt));
});

test('identity verifies RSA signature, issuer, audience, nonce and expiry', () => {
  assert.equal(validateIdentity(jwt('nonce'), [jwk], clientId, 'nonce').subject, 'test-subject');
  for (const overrides of [{ iss: 'https://fake.invalid' }, { aud: 'other' }, { exp: 1 }, { nonce: 'bad' },
    { sub: '' }, { nbf: Date.now() / 1000 + 3600 }, { aud: [clientId, 'other'] }])
    assert.throws(() => validateIdentity(jwt('nonce', overrides), [jwk], clientId, 'nonce'));
  assert.throws(() => validateIdentity(jwt('nonce', {}, { alg: 'none' }), [jwk], clientId, 'nonce'));
  const token = jwt('nonce'), parts = token.split('.'); parts[1] = encode({ sub: 'forged' });
  assert.throws(() => validateIdentity(parts.join('.'), [jwk], clientId, 'nonce'));
});

test('stream success requires completed event; rejects late quota failure and incomplete streams', async () => {
  const delta = { type: 'response.output_text.delta', delta: '{"ok":true}' };
  const end = { type: 'response.completed', response: { status: 'completed' } };
  const bytes = new TextEncoder().encode(`data: ${JSON.stringify(delta)}\r\n\r\ndata: ${JSON.stringify(end)}\r\n\r\n`);
  // Every byte is a separate chunk, including CRLF and JSON boundaries.
  const fragmented = new Response(new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } }));
  assert.equal(await completedResponse(fragmented), '{"ok":true}');
  await assert.rejects(completedResponse(eventStream([delta])), /未完成/);
  await assert.rejects(completedResponse(eventStream([delta, { type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded' } } }])), /额度已达/);
  await assert.rejects(completedResponse(eventStream([delta, { type: 'response.incomplete' }])), /不完整/);
});

test('local service rejects cross-origin writes and DNS rebinding hosts', () => {
  const request = { method: 'POST', headers: { host: '127.0.0.1:4173', origin: 'http://127.0.0.1:4173', 'x-yahari-account': '1' } };
  assert.doesNotThrow(() => requireLocalRequest(request, 'http://127.0.0.1:4173'));
  for (const headers of [{ origin: 'https://external.invalid' }, { host: 'external.invalid:4173' }, { 'x-yahari-account': undefined }, { 'sec-fetch-site': 'cross-site' }])
    assert.throws(() => requireLocalRequest({ ...request, headers: { ...request.headers, ...headers } }, 'http://127.0.0.1:4173'));
});

async function fixture(t, withPlan = true) {
  let state = { profiles: [], activeId: null }, nonce, grantCount = 0, revokeCount = 0;
  const calls = [];
  const store = { hostId: 'urn:uuid:test', read: () => structuredClone(state), write: async next => { state = structuredClone(next); } };
  const fetcher = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('openid-configuration')) return json({ issuer, authorization_endpoint: `${issuer}/api/accounts/authorize`, token_endpoint: `${issuer}/api/accounts/oauth/token`, jwks_uri: `${issuer}/.well-known/jwks.json`, revocation_endpoint: `${issuer}/api/accounts/oauth/revoke` });
    if (String(url).endsWith('jwks.json')) return json({ keys: [jwk] });
    if (String(url).endsWith('/oauth/token')) {
      grantCount++;
      const body = options.body;
      assert.equal(body.get('client_id'), clientId); assert.equal(body.get('resource'), 'https://api.openai.com/v1');
      if (body.get('grant_type') === 'authorization_code') {
        assert.ok(body.get('code_verifier')); assert.ok(body.get('redirect_uri').startsWith(origin));
      }
      return json({ access_token: 'fake-access', refresh_token: 'fake-refresh', id_token: jwt(nonce), token_type: 'Bearer', expires_in: 3600,
        scope: withPlan ? scopes : 'openid profile email' });
    }
    if (String(url).endsWith('/models')) return json({ models: [{ slug: 'test-model', display_name: 'Test Model', visibility: 'list' }, { slug: 'hidden', visibility: 'hide' }] });
    if (String(url).endsWith('/responses')) {
      assert.equal(options.headers.Authorization, 'Bearer fake-access');
      const data = JSON.parse(options.body);
      assert.equal(data.store, false); assert.equal(data.stream, true); assert.ok(Array.isArray(data.input));
      for (const prohibited of ['max_output_tokens', 'previous_response_id', 'temperature', 'tools']) assert.equal(data[prohibited], undefined);
      assert.ok(data.instructions); assert.equal(data.input[0].role, 'user');
      if (data.text?.format?.type === 'json_object') assert.match(data.input[0].content, /json/i);
      return eventStream([{ type: 'response.output_text.delta', delta: '{"ok":true}' }, { type: 'response.completed', response: { status: 'completed' } }]);
    }
    if (String(url).endsWith('/oauth/revoke')) { revokeCount++; return new Response(null, { status: 200 }); }
    throw new Error('Unexpected endpoint');
  };
  let bridge;
  const server = createServer((req, res) => { void bridge.handle(req, res, new URL(req.url, origin)); });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const origin = `http://127.0.0.1:${server.address().port}`;
  bridge = createChatGptBridge({ origin, store, fetcher });
  t.after(async () => { server.closeAllConnections(); await new Promise(done => server.close(done)); });
  const get = route => fetch(`${origin}/api/chatgpt/${route}`);
  const post = (route, body = {}) => fetch(`${origin}/api/chatgpt/${route}`, { method: 'POST', headers: { Origin: origin, 'X-Yahari-Account': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  async function login(profileId) {
    const start = await (await post('login', { profileId })).json();
    const authorize = new URL(start.url); nonce = authorize.searchParams.get('nonce');
    const callback = new URL(authorize.searchParams.get('redirect_uri'));
    callback.search = new URLSearchParams({ state: authorize.searchParams.get('state'), code: 'test-code', client_id: clientId });
    const response = await fetch(callback); assert.equal(response.status, 200);
    return callback;
  }
  return { get, post, login, store, calls, origin, counts: () => ({ grantCount, revokeCount }) };
}

test('complete account flow, model preference, renewed token, replay prevention and logout', async t => {
  const app = await fixture(t);
  assert.equal((await app.post('test')).status, 401);
  const callback = await app.login();
  const status = await (await app.get('status')).json();
  assert.equal(status.profiles[0].planEnabled, true);
  assert.equal(JSON.stringify(status).includes('fake-access'), false);
  assert.equal(JSON.stringify(status).includes('fake-refresh'), false);
  assert.equal((await fetch(callback)).status, 400); assert.equal(app.counts().grantCount, 1);
  assert.deepEqual((await (await app.get('models')).json()).models, [{ id: 'test-model', name: 'Test Model' }]);
  assert.equal((await app.post('model', { model: 'hidden' })).status, 400);
  assert.equal((await app.post('model', { model: 'test-model' })).status, 200);
  const state = app.store.read(); state.profiles[0].expiresAt = 1; await app.store.write(state);
  assert.equal((await (await app.post('test')).json()).ok, true); assert.equal(app.counts().grantCount, 2);
  assert.equal((await app.post('responses', { model: 'hidden', user: 'test', system: 'test' })).status, 400);
  const result = await (await app.post('responses', { model: 'test-model', user: 'test', system: 'test', jsonMode: true })).json();
  assert.equal(result.content, '{"ok":true}');
  assert.equal((await app.post('images')).status, 501);
  const logout = await (await app.post('logout')).json(); assert.equal(logout.revoked, true);
  assert.equal(app.counts().revokeCount, 1); assert.equal((await app.post('test')).status, 401);
  assert.equal(app.store.read().profiles[0].refresh_token, null);
  await app.login(status.activeId); // Reuses this connection instead of making a duplicate.
  assert.equal(app.store.read().profiles.length, 1);
});

test('verified identity without plan scope stays signed in and cannot generate', async t => {
  const app = await fixture(t, false); await app.login();
  const data = await (await app.get('status')).json();
  assert.equal(data.profiles[0].connected, true); assert.equal(data.profiles[0].planEnabled, false);
  assert.equal((await app.post('test')).status, 403);
  assert.equal(app.calls.some(c => c.url.endsWith('/responses')), false);
});

test('local credential store persists stable host and encrypted Windows credentials', async () => {
  const directory = resolve('work/account-store-test-' + Date.now());
  assert.ok(directory.startsWith(resolve('work') + '\\') || directory.startsWith(resolve('work') + '/'));
  await mkdir(directory, { recursive: true });
  try {
    const store = await openAccountStore(directory);
    const state = { profiles: [{ id: 'test', client_id: clientId, access_token: 'fake-test-secret' }], activeId: 'test' };
    await store.write(state);
    const restored = await openAccountStore(directory);
    assert.equal(restored.hostId, store.hostId); assert.deepEqual(restored.read(), state);
    if (process.platform === 'win32') assert.equal((await readFile(join(directory, 'accounts.dpapi'))).includes(Buffer.from('fake-test-secret')), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
