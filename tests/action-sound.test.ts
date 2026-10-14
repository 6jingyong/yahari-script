import test from 'node:test';
import assert from 'node:assert/strict';
import {courtroomAdapter,actionSound,defaultActionSound,type CourtroomInstruction} from '../packages/adapters/courtroom/src/index.js';
import {demoProject,demoDocument,demoManifest} from '../examples/courtroom-demo-project/fixture.js';
import {courtroomDemoPack} from '../content-packs/courtroom-demo/pack.js';
import {PreviewPlayback} from '../apps/editor/src/preview-playback.js';
import {PreviewSynthAudio,previewSfxBetween} from '../apps/editor/src/preview-audio.js';
import {createProjectFile,decodeProjectFile,type TypedToken,type DialogueBlock} from '../packages/core/src/index.js';
import {encodeProjectBundle,decodeProjectBundle} from '../packages/project-io/src/index.js';
import {playerCatalog} from '../apps/player/src/project.js';
import {applyAudioAssets,defaultAudioAssets} from '../apps/editor/src/builtin-audio-assets.js';

const objection:TypedToken={id:'call',type:'courtroom.pose',params:{pose:'objection'},subject:{kind:'speaker'}};
const voice=(id:string,call='objection')=>courtroomDemoPack.audio.voices!.find(v=>v.characterId===id&&v.call===call)!;
const doc=(token:TypedToken=objection)=>({...demoDocument,blocks:[{id:'line',type:'dialogue' as const,speaker:{castId:'phoenix'},content:[{type:'token' as const,token},{type:'text' as const,text:'我有异议！'}]}]});

test('automatic action callouts follow visual character bindings and explicit cast subjects rather than story names',()=>{
  const project=structuredClone(demoProject);project.manifest.cast[0].displayName='陈默';
  assert.deepEqual(actionSound(objection,'phoenix',project),voice('phoenix').resource);
  assert.deepEqual(actionSound(objection,'edgeworth',project),voice('edgeworth').resource);
  assert.deepEqual(actionSound({...objection,subject:{kind:'cast',id:'phoenix'}},'edgeworth',project),voice('phoenix').resource);
  assert.deepEqual(actionSound(objection,'judge',project),{packId:courtroomDemoPack.id,id:'audio/sfx/objection'});
});

test('per-action silence and overrides take precedence over character defaults; missing references are diagnosed',()=>{
  const project=structuredClone(demoProject),token=structuredClone(objection);project.manifest.cast[0].overrides={actionSounds:{'pose:objection':voice('mia').resource}};
  assert.deepEqual(actionSound(token,'phoenix',project),voice('mia').resource);
  token.metadata={sound:null};assert.equal(actionSound(token,'phoenix',project),null);
  token.metadata.sound=voice('phoenix','hold-it').resource;assert.deepEqual(actionSound(token,'phoenix',project),voice('phoenix','hold-it').resource);
  token.metadata.sound={packId:courtroomDemoPack.id,id:'missing'};assert.ok(courtroomAdapter.validate(doc(token),project).some(d=>d.code==='courtroom.action-sound.invalid'));
  project.manifest.cast[0].overrides.actionSounds={'pose:objection':{packId:'bad',id:'bad'}};assert.ok(courtroomAdapter.validate(doc(),project).some(d=>d.code==='courtroom.action-sound.invalid'));
});

test('compilation performs the gesture and callout before text and waits for the recorded clip',()=>{
  const instructions=courtroomAdapter.compile(doc(),demoProject).instructions;
  assert.equal(instructions[1].op,'pose');assert.deepEqual(instructions[2],{op:'sfx',resource:voice('phoenix').resource,boundAction:true});
  assert.deepEqual(instructions[3],{op:'wait',mode:'time',durationMs:voice('phoenix').clip.durationMs,reason:'voice'});assert.equal(instructions[4].op,'showText');
  const jobs:Array<{fn:()=>void;delay:number}>=[];const player=new PreviewPlayback(instructions,{schedule(fn,delay){jobs.push({fn,delay});return()=>{};}},()=>{});
  player.start();assert.equal(player.snapshot.partialText,'');assert.equal(jobs[0].delay,voice('phoenix').clip.durationMs);jobs.shift()!.fn();assert.equal(player.snapshot.partialText,'我');player.dispose();
});

test('fast-forward excludes skipped action sounds while manual effects stay edge-triggered',()=>{
  const plan=courtroomAdapter.compile({...demoDocument,blocks:[{...doc().blocks[0],content:[{type:'token',token:{...objection,id:'desk',params:{pose:'desk'}}},{type:'token',token:objection},{type:'text',text:'测试'}]}]},demoProject);
  assert.equal(previewSfxBetween(plan.instructions,0,plan.instructions.length).length,2);assert.deepEqual(previewSfxBetween(plan.instructions,0,plan.instructions.length,true),[]);
  const manual:CourtroomInstruction[]=[{op:'sfx',resource:{packId:'p',id:'manual'}}];assert.equal(previewSfxBetween(manual,0,1,true).length,1);
});

test('a directly inserted recorded callout also waits before subsequent dialogue',()=>{
  const token:TypedToken={id:'manual-voice',type:'courtroom.sfx',params:{resource:voice('phoenix','hold-it').resource}};
  const instructions=courtroomAdapter.compile(doc(token),demoProject).instructions;assert.equal(instructions[1].op,'sfx');
  assert.deepEqual(instructions[2],{op:'wait',mode:'time',durationMs:voice('phoenix','hold-it').clip.durationMs,reason:'voice'});assert.equal(instructions[3].op,'showText');
});

test('action sound metadata and character defaults round-trip in work bundles and survive sound-library application',()=>{
  const token={...objection,metadata:{sound:voice('phoenix','take-that').resource}},source=createProjectFile(demoManifest,[doc(token)]);source.manifest.cast[0].overrides={actionSounds:{'pose:objection':null}};
  const next=applyAudioAssets(source,defaultAudioAssets()),decoded=decodeProjectFile(decodeProjectBundle(encodeProjectBundle(next)),playerCatalog);assert.ok(decoded.ok&&decoded.kind==='project');
  if(decoded.ok&&decoded.kind==='project'){const block=decoded.project.documents[0].blocks[0] as DialogueBlock;assert.deepEqual(block.content[0],{type:'token',token});assert.deepEqual(decoded.project.manifest.cast[0].overrides,source.manifest.cast[0].overrides);}
  const explicit={...objection,metadata:{sound:{packId:courtroomDemoPack.id,id:'audio/sfx/desk-slam'}}},referenced=createProjectFile(demoManifest,[doc(explicit)]),settings=defaultAudioAssets();settings.hidden=['sfx/desk-slam'];assert.throws(()=>applyAudioAssets(referenced,settings),/动作/);
});

test('decoded callouts are cached, muting cancels a pending decode and explicit skipping stops active voice sources',async()=>{
  const previous=globalThis.AudioContext;let decode!:()=>void,decodes=0;const sources:Array<{stops:number}>=[];
  class MockContext{state='running';currentTime=0;destination={};createGain(){return{gain:{value:0},connect(){},disconnect(){}};}resume(){return Promise.resolve();}close(){return Promise.resolve();}
    decodeAudioData(bytes:ArrayBuffer){assert.ok(bytes.byteLength>1000);decodes++;return new Promise(resolve=>{decode=()=>resolve({duration:1});});}
    createBufferSource(){const source={stops:0,buffer:null,onended:null as null|(()=>void),connect(){},disconnect(){},start(){},stop(){this.stops++;this.onended?.();}};sources.push(source);return source;}}
  Object.assign(globalThis,{AudioContext:MockContext});
  try{const audio=new PreviewSynthAudio([courtroomDemoPack]);await audio.setEnabled(true);audio.playSfx([voice('phoenix').resource]);await audio.setEnabled(false);decode();await Promise.resolve();await Promise.resolve();assert.equal(sources.length,0);
    await audio.setEnabled(true);await audio.prepareClips([voice('phoenix').resource]);audio.playSfx([voice('phoenix').resource]);await Promise.resolve();assert.equal(sources.length,1);assert.equal(decodes,1);
    audio.stopCallouts();assert.equal(sources[0].stops,1);audio.playSfx([voice('phoenix').resource]);await Promise.resolve();audio.dispose();assert.equal(sources[1].stops,1);
  }finally{Object.assign(globalThis,{AudioContext:previous});}
});
