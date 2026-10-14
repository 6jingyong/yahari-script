import test from 'node:test';
import assert from 'node:assert/strict';
import { builtinAssetEntries,installBuiltinAsset,resolveBuiltinOverrides } from '../apps/editor/src/builtin-assets.js';
import { fittedImageSize,IMAGE_POLICY } from '../apps/editor/src/asset-image-policy.js';
import { defaultAudioAssets,validateAudioAssets,applyAudioAssets,resolveAudioAssets } from '../apps/editor/src/builtin-audio-assets.js';
import { assetPackToEmbedded,readAssetPack,assetPackBlob,type AssetPack } from '../packages/asset-library/src/index.js';
import { courtroomDemoPack } from '../content-packs/courtroom-demo/pack.js';
import { courtroomAdapter } from '../packages/adapters/courtroom/src/index.js';
import { createProjectFile,decodeProjectFile } from '../packages/core/src/index.js';
import { decodeProjectBundle,encodeProjectBundle } from '../packages/project-io/src/index.js';
import { demoManifest,demoDocument } from '../examples/courtroom-demo-project/fixture.js';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',changed='data:image/png;base64,AAAA';
const catalog={adapters:[courtroomAdapter.manifest],contentPacks:[courtroomDemoPack]};
function baseline(kind:'characters'|'scenes'='characters'):AssetPack {
  const entry=builtinAssetEntries.find(e=>e.kind===kind&&e.entityId===(kind==='characters'?'phoenix':'witness-stand'))!;
  const pack:AssetPack={fileFormat:'yahari-asset-pack',fileVersion:'1.0',id:entry.id,version:'0.4.0',name:entry.name,kind,origin:entry.origin,rights:{author:'来源作者',source:'内置',license:'未声明',notes:''},characters:[],scenes:[],images:{}};
  const own=(id:string)=>{pack.images[id]=image;return id;};
  if(kind==='characters'){const actor=courtroomDemoPack.characters.find(a=>a.id==='phoenix')!;pack.characters=[{id:actor.id,name:actor.name,description:'',tags:[],portrait:own(actor.portraits.base.id),actions:[...actor.poses.map(a=>({id:a.id,label:a.label,kind:'pose' as const,image:own(a.asset.id)})),...actor.reactions.map(a=>({id:a.id,label:a.label,kind:'reaction' as const,image:own(a.asset.id)}))],stage:{background:own(actor.stage.background.id),foreground:own(actor.stage.foreground!.id)}}];}
  else{const scene=courtroomDemoPack.backgrounds.find(a=>a.id==='witness-stand')!;pack.scenes=[{id:scene.id,name:scene.label,description:'',tags:[],image:own(scene.resource.id),foreground:own(scene.foreground!.id)}];}
  return pack;
}
test('builtin inventory exposes all current characters, actions and backgrounds',()=>{
  assert.equal(builtinAssetEntries.filter(e=>e.kind==='characters').length,24);assert.equal(builtinAssetEntries.filter(e=>e.kind==='scenes').length,23);
  assert.equal(builtinAssetEntries.reduce((n,e)=>n+e.actions,0),192);assert.equal(new Set(builtinAssetEntries.map(e=>e.id)).size,47);
});
test('builtin adjustments keep cast/resource/action identities and carry only changed images into works',()=>{
  const original=baseline(),pack=structuredClone(original),actor=pack.characters[0];actor.name='成步堂（调整）';actor.actions[0].label='平常新名称';pack.images[actor.actions[0].image]=changed;
  const project=createProjectFile(demoManifest,[demoDocument]),castIds=project.manifest.cast.map(c=>c.castId),added=installBuiltinAsset(project,pack,original);
  assert.deepEqual(added.project.manifest.cast.map(c=>c.castId),castIds);assert.equal(added.project.embeddedPacks!.length,1);assert.equal(Object.keys(added.project.embeddedPacks![0].resources).length,1);
  const resolved=resolveBuiltinOverrides(added.project.embeddedPacks!);const updated=resolved.pack.characters.find(a=>a.id==='phoenix')!;
  assert.equal(updated.name,actor.name);assert.equal(updated.poses[0].asset.packId,courtroomDemoPack.id);assert.equal(updated.poses[0].id,'normal');
  assert.equal(resolved.resources.resources[updated.poses[0].asset.id].url,changed);assert.equal(courtroomDemoPack.characters.find(a=>a.id==='phoenix')!.name,'成步堂龙一');
  assert.equal(decodeProjectFile(added.project,catalog).ok,true);
});
test('new builtin actions compile under existing cast IDs and survive whole-project export',()=>{
  const source=baseline(),edited=structuredClone(source);edited.images.newAction=changed;edited.characters[0].actions.push({id:'custom-wave',label:'挥手',kind:'pose',image:'newAction'});
  const added=installBuiltinAsset(createProjectFile(demoManifest,[demoDocument]),edited,source),cast=added.project.manifest.cast.find(c=>c.characterRef.id==='phoenix')!;
  const document={...demoDocument,blocks:[{type:'dialogue' as const,id:'line',speaker:{castId:cast.castId},content:[{type:'token' as const,token:{id:'action',type:'courtroom.pose',params:{pose:'custom-wave'}}},{type:'text' as const,text:'新的动作。'}]}]};
  added.project.documents=[document];const effective={manifest:added.project.manifest,contentPacks:[resolveBuiltinOverrides(added.project.embeddedPacks!).pack]};
  assert.equal(courtroomAdapter.validate(document,effective).filter(d=>d.severity==='error').length,0);assert.ok(courtroomAdapter.compile(document,effective).instructions.some(i=>i.op==='pose'&&i.pose==='custom-wave'));
  const decoded=decodeProjectFile(decodeProjectBundle(encodeProjectBundle(added.project)),catalog);assert.ok(decoded.ok&&decoded.kind==='project');
  const after=resolveBuiltinOverrides(decoded.project.embeddedPacks!);assert.ok(after.pack.characters.find(a=>a.id==='phoenix')!.poses.some(a=>a.id==='custom-wave'));
});
test('removing a builtin action used by any scene is refused; applying defaults releases changed images',()=>{
  const source=baseline(),pack=structuredClone(source);pack.characters[0].actions=pack.characters[0].actions.filter(a=>a.id!=='normal');
  const project=createProjectFile(demoManifest,[demoDocument]),cast=project.manifest.cast.find(c=>c.characterRef.id==='phoenix')!;
  project.documents[0].blocks=[{type:'dialogue',id:'line',speaker:{castId:cast.castId},content:[{type:'token',token:{id:'t',type:'courtroom.pose',params:{pose:'normal'}}}]}];
  assert.throws(()=>installBuiltinAsset(project,pack,source),/剧本仍使用/);
  const changedPack=structuredClone(source);changedPack.images[changedPack.characters[0].portrait]=changed;const applied=installBuiltinAsset(project,changedPack,source);
  const reset=installBuiltinAsset(applied.project,source,source);assert.equal(Object.keys(reset.project.embeddedPacks![0].resources).length,0);
});
test('scene foreground and provenance round-trip independently and generic installation preserves layers',async()=>{
  const source=baseline('scenes'),read=await readAssetPack(assetPackBlob(source));assert.deepEqual(read,source);
  const embedded=assetPackToEmbedded(read,image);assert.equal((embedded.definition as unknown as typeof courtroomDemoPack).backgrounds[0].foreground!.id,source.scenes[0].foreground);
  const edited=structuredClone(source);edited.images[edited.scenes[0].foreground!]=changed;const installed=installBuiltinAsset(createProjectFile(demoManifest,[demoDocument]),edited,source);
  const resolved=resolveBuiltinOverrides(installed.project.embeddedPacks!);assert.equal(resolved.resources.resources[source.scenes[0].foreground!].url,changed);
});

test('a copied work reuses its existing builtin adjustments and can reset images',()=>{
  const source=baseline(),edited=structuredClone(source);edited.images[edited.characters[0].portrait]=changed;
  const installed=installBuiltinAsset(createProjectFile(demoManifest,[demoDocument]),edited,source).project;
  const originalOverlayId=installed.embeddedPacks![0].id;installed.manifest.projectId='imported-copy';
  const reset=installBuiltinAsset(installed,source,source).project;
  assert.equal(reset.embeddedPacks!.length,1);assert.equal(reset.embeddedPacks![0].id,originalOverlayId);
  assert.equal(Object.keys(reset.embeddedPacks![0].resources).length,0);
  assert.equal(Object.keys(resolveBuiltinOverrides(reset.embeddedPacks!).resources.resources).length,0);
});
test('malformed project override metadata cannot replace builtin catalog entries',()=>{
  const installed=installBuiltinAsset(createProjectFile(demoManifest,[demoDocument]),baseline(),baseline());
  const item=structuredClone(installed.project.embeddedPacks![0]);item.definition.characters=null;
  const result=resolveBuiltinOverrides([item]);assert.equal(result.overlayIds.size,0);assert.equal(result.pack.characters.length,24);
});
test('image resizing keeps aspect ratio, never enlarges and rejects dimensions before allocation',()=>{
  assert.deepEqual(fittedImageSize(2400,1800),{width:768,height:576});assert.deepEqual(fittedImageSize(400,800),{width:384,height:768});
  assert.deepEqual(fittedImageSize(100,200),{width:100,height:200});assert.throws(()=>fittedImageSize(0,1));assert.throws(()=>fittedImageSize(8193,1));
  assert.equal(IMAGE_POLICY.quality,0.76);assert.equal(IMAGE_POLICY.fallbackQuality,0.65);
});
test('audio defaults, added presets and hidden state validate without unsafe synthesis parameters',()=>{
  const settings=defaultAudioAssets();assert.equal(settings.presets.filter(p=>p.kind==='sfx').length,35);assert.equal(settings.presets.filter(p=>p.kind==='bgm').length,16);
  assert.equal(validateAudioAssets(settings).presets.length,51);settings.presets[0].cue.notes[0].frequency=Infinity;assert.throws(()=>validateAudioAssets(settings));
});
test('audio adjustments and additions are portable while referenced sound removal is prevented',()=>{
  const settings=defaultAudioAssets();settings.presets[0].label='自定义异议声';settings.presets.push({id:'new-cue',kind:'sfx',label:'新音效',cue:{waveform:'sine',notes:[{frequency:440,durationMs:100,gain:0.02}]}});
  const source=createProjectFile(demoManifest,[demoDocument]),applied=applyAudioAssets(source,settings),roundtrip=decodeProjectFile(decodeProjectBundle(encodeProjectBundle(applied)),catalog);assert.ok(roundtrip.ok&&roundtrip.kind==='project');
  const effective=resolveAudioAssets(courtroomDemoPack,roundtrip.project.manifest.projectSettings);assert.ok(effective.audio.sfx.some(s=>s.id==='new-cue'));assert.equal(courtroomDemoPack.audio.sfx[0].label,'异议！');
  source.documents[0].blocks=[{type:'cue',id:'sound',cue:{id:'token',type:'courtroom.sfx',params:{resource:{packId:courtroomDemoPack.id,id:'audio/sfx/objection'}}}}];
  settings.hidden=['sfx/objection'];assert.throws(()=>applyAudioAssets(source,settings),/仍使用已移除的声音/);
});
