import assert from 'node:assert/strict';
import test from 'node:test';
import { addOriginalCharacter, embeddedCourtroomPack, embeddedResources, requestCharacterImage } from '../apps/editor/src/original-character.js';
import { courtroomDemoPack } from '../content-packs/courtroom-demo/pack.js';
import { demoDocument, demoManifest } from '../examples/courtroom-demo-project/fixture.js';
import { courtroomAdapter } from '../packages/adapters/courtroom/src/index.js';
import { createProjectFile, decodeProjectFile } from '../packages/core/src/index.js';
import { createStaticResourceResolver } from '../packages/presentation/src/index.js';

const image = 'data:image/png;base64,AAAA';
const catalog = { adapters: [{ id: 'official.courtroom', version: '0.1.0' }],
  contentPacks: [{ id: courtroomDemoPack.id, version: courtroomDemoPack.version }] };

test('original character survives export and import with image and usable actions', () => {
  const added = addOriginalCharacter(createProjectFile(demoManifest, [demoDocument]), '小林', image,
    { label: '惊讶', image });
  assert.equal(added.project.fileVersion, '0.8');
  const decoded = decodeProjectFile(JSON.parse(JSON.stringify(added.project)), catalog);
  assert.equal(decoded.ok && decoded.kind === 'project' && decoded.availability === 'ready', true);
  if (!decoded.ok || decoded.kind !== 'project') return;
  const embedded = decoded.project.embeddedPacks?.[0];
  assert.ok(embedded);
  const pack = embeddedCourtroomPack(embedded);
  assert.ok(pack);
  const resolver = createStaticResourceResolver(embeddedResources([embedded]));
  assert.equal(resolver.resolve(pack.characters[0].portraits.base)?.url, image);
  const project = { manifest: decoded.project.manifest, contentPacks: [courtroomDemoPack, pack] };
  const context = { projectId: project.manifest.projectId, documentId: demoDocument.documentId,
    adapterId: 'official.courtroom', adapterVersion: '0.1.0', insertionScope: 'inline' as const,
    speaker: { castId: added.castId } };
  const candidates = courtroomAdapter.getTokenCandidates(context, project);
  assert.ok(candidates.some(item => item.tokenType === 'courtroom.pose' && item.params.pose === 'normal'));
  assert.ok(candidates.some(item => item.tokenType === 'courtroom.reaction' && item.params.reaction === 'expression'));
  const scene = { ...demoDocument, blocks: [{ id: 'new-line', type: 'dialogue' as const,
    speaker: { castId: added.castId }, content: [{ type: 'text' as const, text: '你好。' }] }] };
  assert.equal(courtroomAdapter.validate(scene, project).filter(item => item.severity === 'error').length, 0);
  assert.ok(courtroomAdapter.compile(scene, project).instructions.some(item => item.op === 'speaker'));
});

test('embedded image contract rejects unsafe data and malformed character packs', () => {
  const added = addOriginalCharacter(createProjectFile(demoManifest, [demoDocument]), '小林', image);
  const unsafe = structuredClone(added.project);
  unsafe.embeddedPacks![0].resources[Object.keys(unsafe.embeddedPacks![0].resources)[0]] = 'data:image/svg+xml;base64,AAAA';
  assert.equal(decodeProjectFile(unsafe, catalog).ok, false);
  const malformed = structuredClone(added.project.embeddedPacks![0]);
  (malformed.definition as {characters: unknown[]}).characters = [null];
  assert.equal(embeddedCourtroomPack(malformed), null);
});

test('OpenRouter character image request keeps key out of body and checks image output', async () => {
  let url = '', body = '', authorization = '';
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    url = String(input); body = String(init?.body); authorization = new Headers(init?.headers).get('Authorization') ?? '';
    return new Response(JSON.stringify({ data: [{ b64_json: 'AAAA', media_type: 'image/png' }] }));
  }) as typeof fetch;
  const result = await requestCharacterImage({ provider: 'openrouter', model: 'openai/gpt-image-2',
    prompt: 'a character', apiKey: 'secret-test' }, new AbortController().signal, fetcher);
  assert.equal(url, 'https://openrouter.ai/api/v1/images');
  assert.equal(authorization, 'Bearer secret-test');
  assert.equal(body.includes('secret-test'), false);
  assert.equal(result, image);
});

test('missing account image bridge fails explicitly', async () => {
  const fetcher = (async () => new Response('', { status: 404 })) as typeof fetch;
  await assert.rejects(requestCharacterImage({ provider: 'chatgpt-account', model: '', prompt: 'a character' },
    new AbortController().signal, fetcher), /未提供 ChatGPT 账户图片生成桥/);
});

test('image request uses declared capabilities and official reference image shape', async () => {
  const bodies: Record<string,unknown>[]=[];
  const fetcher=(async (_input:RequestInfo|URL,init?:RequestInit)=>{
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({data:[{b64_json:'AAAA',media_type:'image/png'}]}));
  }) as typeof fetch;
  const request={provider:'openrouter' as const,model:'test/image',apiKey:'test-only',prompt:'original character',transparent:true};
  await requestCharacterImage(request,new AbortController().signal,fetcher);
  assert.equal('output_format'in bodies[0],false);assert.equal('background'in bodies[0],false);
  await requestCharacterImage({...request,referenceImage:image,capabilities:{output_format:{type:'enum',values:['png']},background:{values:['transparent']}}},new AbortController().signal,fetcher);
  assert.equal(bodies[1].output_format,'png');assert.equal(bodies[1].background,'transparent');
  assert.deepEqual(bodies[1].input_references,[{type:'image_url',image_url:{url:image}}]);
  await requestCharacterImage({...request,capabilities:{output_format:{values:['jpeg']},background:{values:['transparent']}}},new AbortController().signal,fetcher);
  assert.equal('background'in bodies[2],false);
});
test('insufficient balance and cancelled late images cannot become saved results',async()=>{
  const request={provider:'openrouter' as const,model:'test/image',apiKey:'test-only',prompt:'original character'};
  await assert.rejects(requestCharacterImage(request,new AbortController().signal,(async()=>new Response('',{status:402})) as typeof fetch),/可用余额/);
  const controller=new AbortController();
  await assert.rejects(requestCharacterImage(request,controller.signal,(async()=>{controller.abort();return new Response(JSON.stringify({data:[{b64_json:'AAAA',media_type:'image/png'}]}));}) as typeof fetch),/已取消/);
});
test('image MIME type is inferred from bytes when the provider omits media_type',async()=>{
  const result=await requestCharacterImage({provider:'openrouter',model:'test/image',apiKey:'test-only',prompt:'original character'},new AbortController().signal,
    (async()=>new Response(JSON.stringify({data:[{b64_json:'iVBORw0KGgo='}]}))) as typeof fetch);
  assert.equal(result,'data:image/png;base64,iVBORw0KGgo=');
});
