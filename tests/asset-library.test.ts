import assert from 'node:assert/strict';
import test from 'node:test';
import { newAssetPack, validateAssetPack, encodeAssetPack, readAssetPack, assetPackBlob, assetPackToEmbedded,
  installAssetPack, ownedAssetPacks, type AssetPack } from '../packages/asset-library/src/index.js';
import { decodeArchiveEntries, encodeArchiveEntries, decodeProjectBundle, encodeProjectBundle } from '../packages/project-io/src/index.js';
import { prepareStoredAssetPack, hydrateStoredAssetPack } from '../apps/editor/src/asset-library-store.js';
import { addOriginalCharacter, addOriginalBackground, embeddedCourtroomPack } from '../apps/editor/src/project-assets.js';
import { withSceneBackground } from '../apps/editor/src/scene-settings.js';
import { demoManifest, demoDocument } from '../examples/courtroom-demo-project/fixture.js';
import { courtroomAdapter } from '../packages/adapters/courtroom/src/index.js';
import { courtroomDemoPack } from '../content-packs/courtroom-demo/pack.js';
import { createProjectFile, decodeProjectFile } from '../packages/core/src/index.js';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const catalog={adapters:[courtroomAdapter.manifest],contentPacks:[courtroomDemoPack]};
function pack(kind:'characters'|'scenes'='characters'):AssetPack {
  const value=newAssetPack(kind,kind==='characters'?'原创角色':'原创场景');
  value.images={portrait:image,action:image};value.rights={author:'测试作者',source:'独立测试图',license:'仅供个人使用',notes:'保留来源'};
  if(kind==='characters')value.characters=[{id:'actor',name:'林羽',description:'邮差',tags:['原创'],portrait:'portrait',actions:[
    {id:'normal',label:'平常',kind:'pose',image:'portrait'},{id:'surprise',label:'惊讶',kind:'reaction',image:'action'}]}];
  else value.scenes=[{id:'shop',name:'书店',description:'安静的书店',tags:['室内'],image:'portrait'}];
  return validateAssetPack(value);
}
test('standalone character and scene bundles preserve identities, rights and deduplicated images',async()=>{
  for(const kind of ['characters','scenes'] as const){const source=pack(kind),bytes=encodeAssetPack(source);
    assert.deepEqual(await readAssetPack(new Blob([bytes.buffer as ArrayBuffer])),source);
    assert.deepEqual(await readAssetPack(assetPackBlob(source,true)),source);
    const entries=decodeArchiveEntries(bytes,'asset-pack.json');assert.equal(entries.size,2);
    const manifest=new TextDecoder().decode(entries.get('asset-pack.json'));
    assert.equal(manifest.includes('official.courtroom'),false);assert.equal(manifest.includes('documents'),false);
  }
});
test('portable packs strip unrelated scripts, secrets and unused images',()=>{
  const source={...pack(),apiKey:'do-not-export',documents:[demoDocument]};source.images.unused=image;
  const checked=validateAssetPack(source);assert.equal(JSON.stringify(checked).includes('do-not-export'),false);
  assert.equal('unused'in checked.images,false);assert.equal('documents'in checked,false);
});
test('invalid kinds, image references, action identities and non-raster data fail before storage',()=>{
  const missing=pack();missing.characters[0].actions[0].image='missing';assert.throws(()=>validateAssetPack(missing));
  const duplicate=pack();duplicate.characters[0].actions.push({...duplicate.characters[0].actions[0]});assert.throws(()=>validateAssetPack(duplicate));
  const kind=pack();kind.kind='scenes';assert.throws(()=>validateAssetPack(kind));
  const unsafe=pack();unsafe.images.portrait='data:image/svg+xml;base64,AAAA';assert.throws(()=>validateAssetPack(unsafe));
  const pose=pack();pose.characters[0].actions=pose.characters[0].actions.filter(action=>action.kind==='reaction');assert.throws(()=>validateAssetPack(pose));
});
test('damaged archives and undeclared extra images are rejected',async()=>{
  const bytes=encodeAssetPack(pack()), damaged=bytes.slice();damaged[45]^=1;
  await assert.rejects(readAssetPack(new Blob([damaged.buffer])));
  await assert.rejects(readAssetPack(new Blob([bytes.slice(0,-1).buffer])));
  const entries=decodeArchiveEntries(bytes,'asset-pack.json');entries.set('assets/0099.png',new Uint8Array([1,2]));
  await assert.rejects(readAssetPack(new Blob([encodeArchiveEntries(entries).buffer as ArrayBuffer])));
});
test('independent storage deduplicates image blobs and detects missing data',async()=>{
  const source=pack(),stored=await prepareStoredAssetPack(source);assert.equal(stored.images.length,1);
  assert.equal(stored.pack.images.portrait,stored.pack.images.action);
  assert.deepEqual(await hydrateStoredAssetPack(stored.pack,new Map(stored.images.map(row=>[row.id,row.blob]))),source);
  await assert.rejects(hydrateStoredAssetPack(stored.pack,new Map()),/缺少图片/);
});
test('installed role actions and neutral stage compile and survive a complete project bundle',()=>{
  const source=pack(),added=installAssetPack(createProjectFile(demoManifest,[demoDocument]),source,image,'actor');
  const embedded=assetPackToEmbedded(source,image),definition=embeddedCourtroomPack(embedded)!;
  assert.ok(definition);assert.equal(definition.stageScene.packId,source.id);
  assert.ok(Object.values(embedded.resources).every(url=>url.startsWith('data:image/')));
  const document={...demoDocument,blocks:[{type:'dialogue' as const,id:'line',speaker:{castId:added.castId!},content:[
    {type:'token' as const,token:{id:'motion',type:'courtroom.reaction',params:{reaction:'surprise'}}},
    {type:'text' as const,text:'你好。'}]}]};
  const context={manifest:added.project.manifest,contentPacks:[courtroomDemoPack,definition]};
  assert.equal(courtroomAdapter.validate(document,context).filter(d=>d.severity==='error').length,0);
  assert.ok(courtroomAdapter.compile(document,context).instructions.some(item=>item.op==='reaction'));
  added.project.documents=[document];const roundtrip=decodeProjectBundle(encodeProjectBundle(added.project));
  const decoded=decodeProjectFile(roundtrip,catalog);assert.ok(decoded.ok&&decoded.kind==='project');assert.deepEqual(ownedAssetPacks(decoded.project),[source]);
});
test('updates keep cast IDs and refuse removal of a role or action still used by the script',()=>{
  const source=pack(),added=installAssetPack(createProjectFile(demoManifest,[demoDocument]),source,image,'actor');
  const next=installAssetPack(added.project,source,image,'actor');assert.equal(next.castId,added.castId);
  assert.equal(next.project.manifest.cast.length,added.project.manifest.cast.length);assert.equal(next.project.embeddedPacks!.length,1);
  next.project.documents[0].blocks=[{type:'dialogue',id:'line',speaker:{castId:added.castId!},content:[
    {type:'token',token:{id:'t',type:'courtroom.reaction',params:{reaction:'surprise'}}}]}];
  const changed=structuredClone(source);changed.characters[0].actions=changed.characters[0].actions.filter(action=>action.id!=='surprise');
  assert.throws(()=>installAssetPack(next.project,changed,image,'actor'),/剧本仍使用/);
  const removed=structuredClone(source);removed.characters[0].id='replacement';assert.throws(()=>installAssetPack(next.project,removed,image),/仍使用此包中的角色/);
});
test('scene updates protect live background cues and own pack copies stay independent',()=>{
  const source=pack('scenes'),added=installAssetPack(createProjectFile(demoManifest,[demoDocument]),source,image);
  added.project.documents[0]=withSceneBackground(added.project.documents[0],{packId:source.id,id:'portrait'});
  source.images.portrait='data:image/png;base64,AAAA';assert.ok(added.project.embeddedPacks![0].resources.portrait!==source.images.portrait);
  const changed=pack('scenes');changed.id=source.id;changed.images={other:image};changed.scenes[0].image='other';
  assert.throws(()=>installAssetPack(added.project,changed,image),/仍引用已删除的场景/);
});
test('legacy owned characters and backgrounds can be collected without bundling built-in content',()=>{
  const base=createProjectFile(demoManifest,[demoDocument]);assert.deepEqual(ownedAssetPacks(base),[]);
  const role=addOriginalCharacter(base,'旧角色',image,{label:'惊讶',image});const scene=addOriginalBackground(role.project,'旧背景',image);
  const packs=ownedAssetPacks(scene.project);assert.equal(packs.length,2);assert.ok(packs.some(p=>p.characters[0]?.name==='旧角色'));
  assert.ok(packs.some(p=>p.scenes[0]?.name==='旧背景'));assert.ok(packs.every(p=>Object.values(p.images).every(url=>url===image)));
});
