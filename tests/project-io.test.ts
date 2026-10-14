import assert from 'node:assert/strict';
import test from 'node:test';
import { createProjectFile, decodeProjectFile } from '../packages/core/src/index.js';
import { encodeProjectBundle, decodeProjectBundle, readProjectInput, projectBlob, projectFileName } from '../packages/project-io/src/index.js';
import { prepareStoredProject, hydrateStoredProject } from '../apps/editor/src/project-library.js';
import { addOriginalCharacter, addOriginalBackground } from '../apps/editor/src/project-assets.js';
import { withSceneBackground } from '../apps/editor/src/scene-settings.js';
import { demoManifest, demoDocument } from '../examples/courtroom-demo-project/fixture.js';
import { courtroomAdapter } from '../packages/adapters/courtroom/src/index.js';
import { courtroomDemoPack } from '../content-packs/courtroom-demo/pack.js';

const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const catalog={adapters:[courtroomAdapter.manifest],contentPacks:[courtroomDemoPack]};
function originalProject() {
  const first=createProjectFile(demoManifest,[demoDocument],{generator:'test preserving metadata'});
  const added=addOriginalCharacter(first,'新角色',image);
  const result=addOriginalBackground(added.project,'我的背景',image);
  result.project.documents[0]=withSceneBackground(result.project.documents[0],result.resource);
  return result.project;
}
test('binary bundle preserves multi-scene projects, metadata and deduplicated character/background images',()=>{
  const source=originalProject(), second=structuredClone(source.documents[0]); second.documentId='second';
  source.documents.push(second);source.manifest.documents.push({id:'second',path:'second.json'});
  const bytes=encodeProjectBundle(source),decoded=decodeProjectBundle(bytes);
  assert.deepEqual(decoded,source);
  assert.equal(decodeProjectFile(decoded,catalog).ok,true);
  assert.ok(bytes.length<JSON.stringify(source,null,2).length);
});
test('bundle rejects damaged asset/JSON bytes before import',()=>{
  const bytes=encodeProjectBundle(originalProject()); bytes[50]^=1;
  assert.throws(()=>decodeProjectBundle(bytes));
  assert.throws(()=>decodeProjectBundle(bytes.subarray(0,bytes.length-1)));
});
test('bundle rejects traversal names and unsupported compression before reading entries',()=>{
  const bytes=encodeProjectBundle(createProjectFile(demoManifest,[demoDocument]));
  const forbidden=new TextEncoder().encode('../evil.json');
  bytes.set(forbidden,30);
  assert.throws(()=>decodeProjectBundle(bytes));
  const compressed=encodeProjectBundle(originalProject()); new DataView(compressed.buffer).setUint16(8,8,true);
  assert.throws(()=>decodeProjectBundle(compressed));
});
test('structural errors in a valid container still fail core import validation',()=>{
  const source=originalProject();source.manifest.entryDocumentId='missing';
  const input=decodeProjectBundle(encodeProjectBundle(source));
  assert.equal(decodeProjectFile(input,catalog).ok,false);
});
test('file reader accepts portable bundle, legacy JSON and UTF-8 BOM without changing source',async()=>{
  const source=originalProject();
  assert.deepEqual(await readProjectInput(projectBlob(source)),source);
  assert.deepEqual(await readProjectInput(new Blob(['\uFEFF'+JSON.stringify(source)])),source);
  assert.deepEqual(await readProjectInput(new Blob([JSON.stringify(demoDocument)])),demoDocument);
  await assert.rejects(readProjectInput(new Blob(['invalid JSON'])));
});
test('IndexedDB representation stores deduplicated Blobs and restores portable image data',async()=>{
  const source=originalProject(), before=JSON.stringify(source),stored=await prepareStoredProject(source);
  assert.equal(stored.assets.length,1);
  assert.equal(stored.assets[0].blob.type,'image/png');
  assert.ok(Object.values(stored.project.embeddedPacks![0].resources)[0].startsWith('asset:'));
  assert.equal(JSON.stringify(source),before);
  assert.deepEqual(await hydrateStoredProject(stored.project,new Map(stored.assets.map(asset=>[asset.id,asset.blob]))),source);
  await assert.rejects(hydrateStoredProject(stored.project,new Map()),/缺少图片/);
});
test('export filenames are portable and retain readable Chinese titles',()=>{
  assert.equal(projectFileName(' 雨夜 / 来信:* '),'雨夜-来信.yahari');
  assert.equal(projectFileName('雨夜','json'),'雨夜.yahari-project.json');
  assert.equal(projectFileName(''),'yahari-project.yahari');
});
test('an imported project copy can extend its existing own packs without multiplying pack identities',()=>{
  const source=originalProject();source.manifest.projectId='imported-copy';
  const copy=addOriginalCharacter(source,'复制后增加的角色',image).project;
  const result=addOriginalBackground(copy,'复制后增加的背景',image).project;
  assert.equal(result.embeddedPacks?.length,2);
  assert.equal(decodeProjectFile(result,catalog).ok,true);
  assert.deepEqual(decodeProjectBundle(encodeProjectBundle(result)),result);
});
