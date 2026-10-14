import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_CONNECTION_KEY, readOpenRouterConnection, writeOpenRouterConnection } from '../apps/editor/src/ai-connection.js';
import { isFreeModel, listOpenRouterModels, modelsForPurpose } from '../packages/ai-providers/src/openrouter-models.js';

test('saved connection is separate from project storage and recovers safely', () => {
  const entries = new Map<string, string>();
  const storage = { getItem: (key: string) => entries.get(key) ?? null } as Storage;
  assert.equal(readOpenRouterConnection(storage).apiKey, '');
  entries.set(AI_CONNECTION_KEY, JSON.stringify({ apiKey: 'test-key', textModel: 'openrouter/free', imageModel: 'image/model' }));
  assert.deepEqual(readOpenRouterConnection(storage), {
    apiKey: 'test-key', textModel: 'openrouter/free', imageModel: 'image/model', remember: true,
  });
  entries.set(AI_CONNECTION_KEY, '{broken');
  assert.equal(readOpenRouterConnection(storage).apiKey, '');
});

test('model catalog keeps the key in the authorization header and filters by output', async () => {
  let url = '', authorization = '';
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    url = String(input);
    authorization = new Headers(init?.headers).get('Authorization') ?? '';
    return new Response(JSON.stringify({ data: [
      { id: 'text/free:free', name: 'Text Free', architecture: { output_modalities: ['text'] },
        pricing: { prompt: '0', completion: '0', request: '0' }, supported_parameters: ['response_format'] },
      { id: 'image/paid', name: 'Image Paid', architecture: { output_modalities: ['image'] },
        pricing: { image: '0.01', request: '0' } },
    ] }));
  }) as typeof fetch;
  const models = await listOpenRouterModels('test-key', new AbortController().signal, fetcher);
  assert.equal(url, 'https://openrouter.ai/api/v1/models?output_modalities=text');
  assert.equal(authorization, 'Bearer test-key');
  assert.equal(url.includes('test-key'), false);
  assert.deepEqual(modelsForPurpose(models, 'image').map(model => model.id), ['image/paid']);
  assert.equal(modelsForPurpose(models, 'text')[0].id, 'openrouter/free');
  assert.equal(isFreeModel(models[0]), true);
  assert.equal(isFreeModel(models[1]), false);
});

test('session-only connection removes a previously remembered credential', () => {
  const entries = new Map<string, string>();
  const storage = { getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value), removeItem: (key: string) => entries.delete(key) } as unknown as Storage;
  const connection = { apiKey: 'test-key', textModel: 'openrouter/free', imageModel: '', remember: true };
  writeOpenRouterConnection(storage, connection);
  assert.equal(readOpenRouterConnection(storage).apiKey, 'test-key');
  writeOpenRouterConnection(storage, { ...connection, remember: false });
  assert.equal(entries.has(AI_CONNECTION_KEY), false);
});

test('image models come from the image API catalog with capability maps', async () => {
  let url = '';
  const models = await listOpenRouterModels('test-key', new AbortController().signal, async input => {
    url = String(input);
    return new Response(JSON.stringify({ data: [{ id: 'image/model', architecture: { output_modalities: ['image'] },
      supported_parameters: { background: { type: 'enum', values: ['transparent'] } } }] }));
  }, 'image');
  assert.equal(url, 'https://openrouter.ai/api/v1/images/models');
  assert.deepEqual(models[0].supportedParameters, ['background']);
  assert.equal(isFreeModel(models[0]), false);
});

test('catalog errors do not disclose provider response or key', async () => {
  await assert.rejects(
    listOpenRouterModels('test-key', new AbortController().signal, async () => new Response('private-token', { status: 401 })),
    error => error instanceof Error && /401/.test(error.message) && !error.message.includes('private-token') && !error.message.includes('test-key'),
  );
});
