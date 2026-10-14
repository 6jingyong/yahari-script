import { createHash, createPublicKey, randomBytes, randomUUID, verify } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const ISSUER = 'https://auth.openai.com';
const RESOURCE = 'https://api.openai.com/v1';
const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const REQUIRED = ['resource.invoke', 'chatgpt.tokens.use.direct'];
const b64 = bytes => bytes.toString('base64url');
const random = () => b64(randomBytes(32));

export class AccountError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function authorizationAttempt(hostId, origin, profile, now = Date.now()) {
  const attempt = { state: random(), nonce: random(), verifier: random(), created: now,
    redirectUri: `${origin}/auth/callback`, profileId: profile?.id ?? null,
    clientId: profile?.client_id ?? null, subject: profile?.subject ?? null };
  const url = new URL(`${ISSUER}/api/accounts/authorize`);
  url.search = new URLSearchParams({ client_id: attempt.clientId ?? 'dynamic_agent_client',
    ...(!profile ? { agent_name_hint: 'Yahari Script' } : {}), ext_agent_host_id: hostId,
    response_type: 'code', redirect_uri: attempt.redirectUri, scope: SCOPES, resource: RESOURCE,
    state: attempt.state, nonce: attempt.nonce, code_challenge_method: 'S256',
    code_challenge: b64(createHash('sha256').update(attempt.verifier).digest()),
  }).toString();
  // Retained ID tokens are never put into URLs returned to the browser or logs.
  return { ...attempt, url: url.href };
}

export function validateCallback(url, attempt, now = Date.now()) {
  if (!attempt || now - attempt.created > 10 * 60_000 || url.searchParams.get('state') !== attempt.state)
    throw new AccountError('登录请求已过期或 state 不匹配，请重新登录。');
  if (url.searchParams.has('error')) throw new AccountError('OpenAI 登录或授权未完成，请重新登录。');
  const code = url.searchParams.get('code');
  const returnedClient = url.searchParams.get('client_id');
  const clientId = returnedClient ?? attempt.clientId;
  if (!code || code.length > 4096 || !clientId || clientId === 'dynamic_agent_client'
    || !/^oaiapp_[A-Za-z0-9_-]{1,200}$/.test(clientId))
    throw new AccountError('OpenAI 回调缺少有效的授权码或已注册 client ID。');
  if (attempt.clientId && returnedClient && returnedClient !== attempt.clientId)
    throw new AccountError('返回的 client ID 与所选连接不一致。');
  return { code, clientId };
}

export function validateIdentity(token, keys, clientId, nonce, now = Date.now()) {
  try {
    if (typeof token !== 'string' || token.length > 32_000) throw new Error();
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error();
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (header.alg !== 'RS256' || header.crit || typeof header.kid !== 'string') throw new Error();
    const key = keys.find(k => k.kid === header.kid && k.kty === 'RSA'
      && (!k.use || k.use === 'sig') && (!k.alg || k.alg === 'RS256'));
    if (!key || !verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`),
      createPublicKey({ key, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))) throw new Error();
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== ISSUER || !aud.includes(clientId) || (aud.length > 1 && claims.azp !== clientId)
      || typeof claims.exp !== 'number' || claims.exp <= now / 1000
      || (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || claims.nbf > now / 1000 + 30))
      || claims.nonce !== nonce || typeof claims.sub !== 'string' || !claims.sub) throw new Error();
    return { issuer: claims.iss, subject: claims.sub,
      email: typeof claims.email === 'string' ? claims.email.slice(0, 320) : '',
      name: typeof claims.name === 'string' ? claims.name.slice(0, 100) : '' };
  } catch { throw new AccountError('OpenAI 身份签名或身份字段校验失败，连接未保存。'); }
}

function tokenFields(data, previous = {}, now = Date.now()) {
  if (typeof data.access_token !== 'string' || data.token_type?.toLowerCase() !== 'bearer'
    || !Number.isFinite(data.expires_in) || data.expires_in <= 0)
    throw new AccountError('OpenAI 未返回有效的访问凭据。');
  if (data.scope !== undefined && typeof data.scope !== 'string') throw new AccountError('OpenAI 授权范围格式不正确。');
  return { access_token: data.access_token, refresh_token: data.refresh_token ?? previous.refresh_token ?? null,
    id_token: data.id_token ?? previous.id_token ?? null,
    scopes: typeof data.scope === 'string' ? data.scope.split(/\s+/).filter(Boolean) : previous.scopes ?? [],
    expiresAt: now + data.expires_in * 1000 };
}

// DPAPI protects credentials for the current Windows user. Unix files use 0600.
async function protectedValue(value, encrypt) {
  if (process.platform !== 'win32') return value;
  const action = encrypt ? 'Protect' : 'Unprotect';
  const command = `Add-Type -AssemblyName System.Security; $data=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $result=[Security.Cryptography.ProtectedData]::${action}($data,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($result))`;
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, stdio: 'pipe' });
    let output = '';
    const timer = setTimeout(() => child.kill(), 15_000);
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.resume();
    child.on('error', () => { clearTimeout(timer); reject(new AccountError('Windows 无法保护本地登录凭据。', 503)); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) reject(new AccountError('Windows 登录凭据加密或解密失败。', 503));
      else resolve(Buffer.from(output.trim(), 'base64'));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(value.toString('base64'));
  });
}

export async function openAccountStore(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const hostPath = join(directory, 'host.json');
  let hostId;
  try {
    hostId = JSON.parse(await readFile(hostPath, 'utf8')).hostId;
    if (!/^urn:uuid:[0-9a-f-]{36}$/.test(hostId)) throw new AccountError('本地 ChatGPT host ID 无效。', 503);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    hostId = `urn:uuid:${randomUUID()}`;
    await writeFile(hostPath, JSON.stringify({ hostId }), { mode: 0o600, flag: 'wx' });
  }
  const path = join(directory, process.platform === 'win32' ? 'accounts.dpapi' : 'accounts.json');
  let state = { profiles: [], activeId: null };
  try { state = JSON.parse((await protectedValue(await readFile(path), false)).toString()); }
  catch (error) { if (error.code !== 'ENOENT') throw new AccountError('本地 ChatGPT 连接无法读取，请恢复或移除损坏的凭据文件。', 503); }
  if (!Array.isArray(state.profiles) || state.profiles.some(p => typeof p.id !== 'string' || typeof p.client_id !== 'string'))
    throw new AccountError('本地 ChatGPT 连接记录无效。', 503);
  return { hostId, read: () => structuredClone(state), async write(next) {
    const data = await protectedValue(Buffer.from(JSON.stringify(next)), true);
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, data, { mode: 0o600, flag: 'wx' });
    await rename(temporary, path);
    state = structuredClone(next);
  } };
}

function publicProfile(profile, index) {
  return { id: profile.id, label: `连接 ${index + 1}`, email: profile.email, name: profile.name,
    connected: !!profile.access_token, planEnabled: !!profile.access_token && REQUIRED.every(s => profile.scopes.includes(s)),
    model: profile.model ?? '', expiresAt: profile.expiresAt ?? null };
}

export function requireLocalRequest(request, origin) {
  if (request.headers.host !== new URL(origin).host
    || (request.headers.origin && request.headers.origin !== origin)
    || request.headers['sec-fetch-site'] === 'cross-site'
    || (request.method === 'POST' && (request.headers.origin !== origin || request.headers['x-yahari-account'] !== '1')))
    throw new AccountError('此操作只允许来自当前本地编辑器。', 403);
}

async function readBody(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new AccountError('需要 JSON 请求。', 415);
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 160_000) throw new AccountError('请求过大。', 413);
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new AccountError('请求 JSON 无效。'); }
}

export async function completedResponse(response, signal) {
  if (!response.body) throw new AccountError('OpenAI 未返回事件流。', 502);
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', text = '', completed = false, total = 0;
  try {
    while (true) {
      if (signal?.aborted) throw new AccountError('请求已取消。', 499);
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > 8_000_000) throw new AccountError('模型响应过大，请缩短故事。', 502);
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
      let end;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!data || data === '[DONE]') continue;
        let event;
        try { event = JSON.parse(data); } catch { throw new AccountError('OpenAI 事件格式无效。', 502); }
        if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') text += event.delta;
        if (event.type === 'response.completed') {
          if (event.response?.status !== 'completed') throw new AccountError('OpenAI 未确认生成完成。', 502);
          completed = true;
          text = event.response.output?.filter(item => item.type === 'message')
            .flatMap(item => item.content ?? []).filter(item => item.type === 'output_text')
            .map(item => item.text).join('') || text;
        }
        if (['response.failed', 'response.incomplete', 'error'].includes(event.type)) {
          const code = event.response?.error?.code ?? event.code;
          throw new AccountError(code === 'subscription_sharing_usage_limit_exceeded' ? 'ChatGPT 订阅额度已达上限，请稍后重试。'
            : code === 'subscription_sharing_usage_unavailable' ? '此账号或工作区暂不能共享 ChatGPT 订阅额度。'
              : 'OpenAI 生成失败或输出不完整，请重试。', 502);
        }
      }
    }
    if (!completed || !text) throw new AccountError('事件流未完成，当前剧本未更改。', 502);
    return text;
  } finally { await reader.cancel().catch(() => {}); }
}

export function createChatGptBridge({ origin, store, fetcher = fetch }) {
  let attempt = null, lastLogin = null, catalog = new Map(), queue = Promise.resolve(), generation = null, loginEpoch = 0;
  const serial = work => { const result = queue.then(work); queue = result.catch(() => {}); return result; };
  const send = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); res.end(JSON.stringify(data)); };
  async function api(url, options = {}) {
    let response;
    try { response = await fetcher(url, { ...options, redirect: 'error', signal: options.signal ?? AbortSignal.timeout(20_000) }); }
    catch { throw new AccountError('无法连接 OpenAI，请检查网络或稍后重试。', 503); }
    if (!response.ok) {
      let code;
      try { const data = await response.json(); code = data.error?.code ?? data.error; } catch { /* No remote payload is exposed. */ }
      if (code === 'invalid_grant') throw new AccountError('登录凭据已过期或被撤销，请重新登录。', 401);
      if (response.status === 401) throw new AccountError('OpenAI 拒绝此登录凭据，请重新登录。', 401);
      if (response.status === 429) throw new AccountError('OpenAI 额度不足或请求过快，请稍后重试。', 429);
      throw new AccountError(`OpenAI 返回 HTTP ${response.status}；请检查账号授权与模型权限。`, 502);
    }
    return response;
  }
  async function discovery() {
    const data = await (await api(`${ISSUER}/.well-known/openid-configuration`)).json();
    if (data.issuer !== ISSUER || data.authorization_endpoint !== `${ISSUER}/api/accounts/authorize`
      || data.token_endpoint !== `${ISSUER}/api/accounts/oauth/token` || data.jwks_uri !== `${ISSUER}/.well-known/jwks.json`)
      throw new AccountError('OpenAI OIDC 配置与支持的官方端点不符。', 502);
    return data;
  }
  const postToken = async fields => (await api(`${ISSUER}/api/accounts/oauth/token`, { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields) })).json();
  function selected() {
    const state = store.read(), profile = state.profiles.find(p => p.id === state.activeId);
    if (!profile?.access_token) throw new AccountError('请先在 AI 连接设置中登录 ChatGPT。', 401);
    if (!REQUIRED.every(scope => profile.scopes.includes(scope))) throw new AccountError('已登录，但尚未授权使用 ChatGPT 订阅额度。请重新登录并允许此权限。', 403);
    return profile;
  }
  async function credential() {
    return serial(async () => {
      let profile = selected();
      if (profile.expiresAt <= Date.now() + 60_000) {
        if (!profile.refresh_token) throw new AccountError('登录已过期，请重新登录。', 401);
        const data = await postToken({ grant_type: 'refresh_token', client_id: profile.client_id,
          refresh_token: profile.refresh_token, resource: RESOURCE });
        profile = { ...profile, ...tokenFields(data, profile) };
        const state = store.read();
        state.profiles = state.profiles.map(p => p.id === profile.id ? profile : p);
        await store.write(state);
      }
      if (!REQUIRED.every(scope => profile.scopes.includes(scope))) throw new AccountError('ChatGPT 订阅额度授权已失效，请重新登录。', 403);
      return profile;
    });
  }
  async function models(profile, force = false) {
    const saved = catalog.get(profile.id);
    if (!force && saved && Date.now() - saved.at < 5 * 60_000) return saved.models;
    const data = await (await api(`${RESOURCE}/models`, { headers: { Authorization: `Bearer ${profile.access_token}` } })).json();
    if (!Array.isArray(data.models)) throw new AccountError('OpenAI 未返回当前账号的模型目录。', 502);
    const list = data.models.filter(m => m.visibility === 'list' && typeof m.slug === 'string')
      .map(m => ({ id: m.slug, name: typeof m.display_name === 'string' ? m.display_name : m.slug }));
    catalog.set(profile.id, { at: Date.now(), models: list });
    return list;
  }
  async function generate(input, signal) {
    if (typeof input.user !== 'string' || typeof input.system !== 'string'
      || input.user.length + input.system.length > 100_000 || (input.model !== null && typeof input.model !== 'string'))
      throw new AccountError('生成请求格式不正确。');
    const profile = await credential(), list = await models(profile);
    const model = input.model?.trim() || profile.model || list[0]?.id;
    if (!model || !list.some(m => m.id === model)) throw new AccountError('请从当前 ChatGPT 账号的模型列表中选择模型。');
    const response = await api(`${RESOURCE}/responses`, { method: 'POST', signal,
      headers: { Authorization: `Bearer ${profile.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, instructions: input.system,
        // Responses JSON mode checks input messages, not the separate instructions field.
        input: [{ role: 'user', content: input.jsonMode ? `Return a complete JSON object only.\n\n${input.user}` : input.user }], store: false, stream: true,
        ...(input.jsonMode ? { text: { format: { type: 'json_object' } } } : {}) }) });
    const content = await completedResponse(response, signal);
    return { content, model };
  }
  async function callback(url, res) {
    // A matching callback consumes the attempt once, including declined consent.
    const pending = attempt;
    if (url.searchParams.get('state') === pending?.state) attempt = null;
    try {
      const { code, clientId } = validateCallback(url, pending);
      await serial(async () => {
        const config = await discovery();
        if (pending.epoch !== loginEpoch) throw new AccountError('本次登录已取消，请重新登录。');
        const data = await postToken({ grant_type: 'authorization_code', client_id: clientId, code,
          code_verifier: pending.verifier, redirect_uri: pending.redirectUri, resource: RESOURCE });
        const jwks = await (await api(config.jwks_uri)).json();
        const identity = validateIdentity(data.id_token, jwks.keys, clientId, pending.nonce);
        if (pending.epoch !== loginEpoch) throw new AccountError('本次登录已取消，连接未保存。');
        if (pending.subject && identity.subject !== pending.subject) throw new AccountError('登录账号与所选连接不一致，请添加新连接。');
        const state = store.read();
        const existing = state.profiles.find(p => p.client_id === clientId && p.subject === identity.subject);
        const profile = { ...existing, ...identity, ...tokenFields(data), id: existing?.id ?? randomUUID(),
          client_id: clientId, model: existing?.model ?? '' };
        state.profiles = state.profiles.filter(p => p.id !== profile.id).concat(profile);
        state.activeId = profile.id;
        await store.write(state); catalog.clear();
        lastLogin = { ok: true, message: REQUIRED.every(s => profile.scopes.includes(s))
          ? '登录成功，已授权使用 ChatGPT 订阅额度。请选择模型并测试。' : '登录成功，但尚未授权使用 ChatGPT 订阅额度。' };
      });
    } catch (error) { lastLogin = { ok: false, message: error instanceof AccountError ? error.message : '登录验证失败，连接未保存。' }; }
    // Never render or redirect the authorization code. The safe page has no external resources.
    res.writeHead(lastLogin.ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'" });
    res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Yahari Script · ChatGPT 登录</title><style>body{font:18px system-ui;max-width:680px;margin:80px auto;padding:24px;line-height:1.8}</style><h1>${lastLogin.ok ? 'ChatGPT 已连接' : '登录未完成'}</h1><p>${lastLogin.message}</p><a href="/apps/editor/">返回矢张剧本</a><p>也可以关闭此页，回到原来的编辑器。</p></html>`);
  }
  return { async handle(req, res, url) {
    if (url.pathname === '/auth/callback' && req.method === 'GET') {
      if (req.headers.host !== new URL(origin).host) { send(res, 403, { error: '回调地址不符。' }); return true; }
      await callback(url, res); return true;
    }
    if (!url.pathname.startsWith('/api/chatgpt/')) return false;
    try {
      requireLocalRequest(req, origin);
      const route = url.pathname.slice('/api/chatgpt/'.length);
      if (route === 'status' && req.method === 'GET') {
        const state = store.read();
        send(res, 200, { available: true, profiles: state.profiles.map(publicProfile), activeId: state.activeId,
          pending: !!attempt && Date.now() - attempt.created < 10 * 60_000, lastLogin, generating: !!generation });
        return true;
      }
      if (route === 'models' && req.method === 'GET') { send(res, 200, { models: await models(await credential(), true) }); return true; }
      if (req.method !== 'POST') throw new AccountError('接口或方法不支持。', 405);
      const input = await readBody(req);
      if (route === 'login') {
        if (generation) throw new AccountError('请等待当前生成完成再切换连接。', 409);
        await serial(async () => {
          const state = store.read();
          const profile = input.profileId ? state.profiles.find(p => p.id === input.profileId) : null;
          if (input.profileId && !profile) throw new AccountError('找不到所选连接。');
          await discovery();
          attempt = { ...authorizationAttempt(store.hostId, origin, profile), epoch: ++loginEpoch }; lastLogin = null;
          send(res, 200, { url: attempt.url });
        });
      } else if (route === 'cancel-login') { ++loginEpoch; attempt = null; lastLogin = null; send(res, 200, { ok: true }); }
      else if (route === 'select' || route === 'model') {
        if (generation) throw new AccountError('请等待当前生成完成再更改连接。', 409);
        const modelProfile = route === 'model' ? await credential() : null;
        const modelList = modelProfile ? await models(modelProfile) : null;
        await serial(async () => {
          const state = store.read(), id = route === 'select' ? input.profileId : state.activeId;
          const profile = state.profiles.find(p => p.id === id);
          if (!profile) throw new AccountError('找不到所选连接。');
          if (route === 'select') { state.activeId = id; attempt = null; catalog.clear(); }
          else {
            if (id !== modelProfile.id || typeof input.model !== 'string' || !modelList.some(m => m.id === input.model)) throw new AccountError('模型不在当前账号目录中。');
            profile.model = input.model;
          }
          await store.write(state); send(res, 200, { ok: true });
        });
      } else if (route === 'logout') {
        generation?.abort(); ++loginEpoch; attempt = null;
        await serial(async () => {
          const state = store.read(), profile = state.profiles.find(p => p.id === state.activeId);
          let revoked = !profile?.refresh_token;
          if (profile?.refresh_token) {
            try {
              const config = await discovery();
              if (config.revocation_endpoint !== `${ISSUER}/api/accounts/oauth/revoke`) throw new Error();
              await api(config.revocation_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ token: profile.refresh_token, token_type_hint: 'refresh_token', client_id: profile.client_id }) });
              revoked = true;
            } catch { /* Clear local credentials even if remote revocation is unavailable. */ }
          }
          if (profile) Object.assign(profile, { access_token: null, refresh_token: null, id_token: null, scopes: [], expiresAt: null });
          await store.write(state); catalog.clear(); lastLogin = null;
          send(res, 200, { ok: true, revoked, message: revoked ? '已退出并清除本地凭据。'
            : '已清除本地凭据；未能确认远程撤销，请在 ChatGPT 设置中断开此应用。' });
        });
      } else if (route === 'responses' || route === 'test') {
        if (generation) throw new AccountError('当前已有 ChatGPT 请求，请稍后重试。', 409);
        const controller = new AbortController(); generation = controller;
        const timer = setTimeout(() => controller.abort(), 180_000);
        res.on('close', () => { if (!res.writableEnded) controller.abort(); });
        try {
          const result = await generate(route === 'test' ? { model: input.model ?? null, system: 'Return only a JSON object with ok set to true.', user: 'Test this account connection.', jsonMode: true } : input, controller.signal);
          if (route === 'test') {
            let parsed; try { parsed = JSON.parse(result.content); } catch { throw new AccountError('模型已完成请求，但测试结果不是 JSON。', 502); }
            if (parsed?.ok !== true) throw new AccountError('模型已完成请求，但测试内容未通过。', 502);
            send(res, 200, { ok: true, model: result.model, message: '身份、订阅授权和文本生成均已验证。' });
          } else send(res, 200, result);
        } finally { clearTimeout(timer); if (generation === controller) generation = null; }
      } else if (route === 'images') throw new AccountError('官方 ChatGPT 订阅通道暂不支持图片生成，请使用 OpenRouter 或上传图片。', 501);
      else throw new AccountError('接口不存在。', 404);
    } catch (error) { if (!res.headersSent) send(res, error instanceof AccountError ? error.status : 500,
      { error: error instanceof AccountError ? error.message : '本地账户服务失败，请重试。' }); }
    return true;
  } };
}
