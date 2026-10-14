import test from 'node:test';
import assert from 'node:assert/strict';
import {courtroomAdapter,dialogueTypingSound,typingSoundValid,type CourtroomInstruction} from '../packages/adapters/courtroom/src/index.js';
import {createProjectFile,decodeProjectFile,type DialogueBlock} from '../packages/core/src/index.js';
import {EditorStore} from '../packages/editor-core/src/index.js';
import {encodeProjectBundle,decodeProjectBundle} from '../packages/project-io/src/index.js';
import {demoDocument,demoManifest,demoProject} from '../examples/courtroom-demo-project/fixture.js';
import {courtroomDemoPack} from '../content-packs/courtroom-demo/pack.js';
import {playerCatalog} from '../apps/player/src/project.js';
import {defaultAudioAssets,applyAudioAssets,resolveAudioAssets} from '../apps/editor/src/builtin-audio-assets.js';
import {PreviewPlayback} from '../apps/editor/src/preview-playback.js';
import {PreviewSynthAudio,previewTypingSoundAt} from '../apps/editor/src/preview-audio.js';

const low={packId:courtroomDemoPack.id,id:'audio/sfx/text-low'},high={packId:courtroomDemoPack.id,id:'audio/sfx/text-high'};
const line=(speaker:string|null='phoenix'):DialogueBlock=>({id:'line',type:'dialogue',speaker:speaker?{castId:speaker}:null,content:[{type:'text',text:'测试台词'}]});

test('old dialogues and narration inherit the default while line settings override character and work settings',()=>{
  const project=structuredClone(demoProject),block=line();
  assert.deepEqual(dialogueTypingSound(block,project),low);assert.deepEqual(dialogueTypingSound(line(null),project),low);
  project.manifest.projectSettings={typingSound:null};assert.equal(dialogueTypingSound(block,project),null);
  project.manifest.cast.find(c=>c.castId==='phoenix')!.overrides={typingSound:high};assert.deepEqual(dialogueTypingSound(block,project),high);
  block.metadata={typingSound:low};assert.deepEqual(dialogueTypingSound(block,project),low);
  block.metadata.typingSound=null;assert.equal(dialogueTypingSound(block,project),null);
  delete block.metadata.typingSound;assert.deepEqual(dialogueTypingSound(block,project),high);
  block.speaker={castId:'judge'};assert.equal(dialogueTypingSound(block,project),null);
});

test('compiled paragraphs keep their own voice, including repeated speakers and muted narration',()=>{
  const project=structuredClone(demoProject);project.manifest.cast[0].overrides={typingSound:high};
  const first=line(),second={...line(),id:'second',metadata:{typingSound:null}},third={...line(null),id:'narrator'};
  const plan=courtroomAdapter.compile({...demoDocument,blocks:[first,second,third]},project);
  assert.deepEqual(previewTypingSoundAt(plan.instructions,1),high);
  assert.equal(previewTypingSoundAt(plan.instructions,3),null);
  assert.deepEqual(previewTypingSoundAt(plan.instructions,5),low);
});

test('voice bindings survive project bundles, document edits and undo without modifying cast names',()=>{
  const source=createProjectFile(demoManifest,[{...demoDocument,blocks:[line()]}]);
  source.manifest.projectSettings={typingSound:low};source.manifest.cast[0].overrides={typingSound:high};
  const store=new EditorStore(source.documents[0]),changed=store.document;(changed.blocks[0] as DialogueBlock).metadata={typingSound:null};store.replaceDocument(changed);
  source.documents[0]=store.document;
  const decoded=decodeProjectFile(decodeProjectBundle(encodeProjectBundle(source)),playerCatalog);
  assert.ok(decoded.ok&&decoded.kind==='project');
  if(decoded.ok&&decoded.kind==='project'){
    assert.deepEqual(decoded.project.manifest.cast[0],source.manifest.cast[0]);
    assert.equal((decoded.project.documents[0].blocks[0] as DialogueBlock).metadata!.typingSound,null);
  }
  store.undo();assert.equal(store.document.blocks[0].metadata?.typingSound,undefined);store.redo();assert.equal(store.document.blocks[0].metadata?.typingSound,null);
});

test('legacy saved audio gains default blips while deliberately hidden blips remain hidden',()=>{
  const legacy=defaultAudioAssets();legacy.presets=legacy.presets.filter(p=>!p.id.startsWith('text-'));
  const upgraded=resolveAudioAssets(courtroomDemoPack,{audioAssets:legacy});
  assert.ok(upgraded.audio.sfx.some(s=>s.id==='text-low'));assert.ok(upgraded.audio.sfx.some(s=>s.id==='text-high'));
  const hidden=defaultAudioAssets();hidden.hidden=['sfx/text-low'];const project=structuredClone(demoProject);project.contentPacks=[resolveAudioAssets(courtroomDemoPack,{audioAssets:hidden})];
  assert.deepEqual(dialogueTypingSound(line(),project),high);
});

test('missing or long voice bindings are diagnosed and referenced blips cannot be removed from a work',()=>{
  const project=structuredClone(demoProject),document={...demoDocument,blocks:[line()]};document.blocks[0].metadata={typingSound:{packId:low.packId,id:'audio/sfx/gavel'}};
  assert.ok(courtroomAdapter.validate(document,project).some(d=>d.code==='courtroom.typing-sound.invalid'));
  assert.equal(typingSoundValid({packId:low.packId,id:'missing'},project.contentPacks),false);assert.equal(typingSoundValid('text-low',project.contentPacks),false);
  const source=createProjectFile(demoManifest,[demoDocument]);source.manifest.cast[0].overrides={typingSound:high};
  const settings=defaultAudioAssets();settings.hidden=['sfx/text-high'];assert.throws(()=>applyAudioAssets(source,settings),/文字音/);
  settings.hidden=[];settings.presets.find(p=>p.id==='text-high')!.cue.notes[0].durationMs=200;assert.throws(()=>applyAudioAssets(source,settings),/文字音/);
});

test('character events follow whole graphemes and pauses, with no burst when revealing or restoring a page',()=>{
  const commands:CourtroomInstruction[]=[{op:'speaker',castId:'phoenix',typingSound:low},{op:'showText',text:'你👨‍👩‍👧‍👦'},{op:'wait',mode:'input'},{op:'showText',text:'好啊'},{op:'speaker',castId:'judge',typingSound:high},{op:'showText',text:'第二句'}];
  const jobs:Array<{fn:()=>void;cancelled:boolean}>=[],events:string[]=[];
  const player=new PreviewPlayback(commands,{schedule(fn){const job={fn,cancelled:false};jobs.push(job);return()=>{job.cancelled=true;};}},()=>{},35,undefined,event=>events.push(event.text));
  const tick=()=>{const job=jobs.shift();if(job&&!job.cancelled)job.fn();};
  player.start();tick();tick();assert.equal(player.snapshot.waiting,true);assert.deepEqual(events,['你','👨‍👩‍👧‍👦']);
  player.next();assert.deepEqual(events,['你','👨‍👩‍👧‍👦','好']);player.next();assert.equal(player.snapshot.complete,true);
  while(jobs.length)tick();assert.equal(events.length,3);
  player.start(1,true);assert.equal(player.snapshot.complete,true);assert.equal(events.length,3);
  player.start(1);assert.equal(events.at(-1),'第');const stale=jobs.at(-1)!.fn;player.dispose();stale();assert.equal(events.length,4);
});

test('typing audio ignores punctuation, throttles ticks, caches buffers and stops immediately on mute',async()=>{
  const previous=globalThis.AudioContext;let context!:MockContext;const sources:Array<{stops:number;buffer:unknown}>=[];
  class MockContext {state='running';currentTime=0;destination={};buffers=0;constructor(){context=this;}resume(){return Promise.resolve();}close(){return Promise.resolve();}
    createGain(){return{gain:{value:0},connect(){},disconnect(){}};}
    createBuffer(_channels:number,length:number,rate:number){this.buffers++;assert.equal(rate,12000);return{copyToChannel(pcm:Float32Array){assert.equal(pcm.length,length);}};}
    createBufferSource(){const source={stops:0,buffer:null as unknown,onended:null as null|(()=>void),connect(){},disconnect(){},start(){},stop(){this.stops++;this.onended?.();}};sources.push(source);return source;}
  }
  Object.assign(globalThis,{AudioContext:MockContext});
  try{
    const audio=new PreviewSynthAudio([courtroomDemoPack]);audio.playTypingSound(low,'你');assert.equal(sources.length,0);await audio.setEnabled(true);
    for(const text of [' ','。','…','\n','！'])audio.playTypingSound(low,text);assert.equal(sources.length,0);
    audio.playTypingSound(low,'你');audio.playTypingSound(low,'好');assert.equal(sources.length,1);
    context.currentTime+=.035;audio.playTypingSound(low,'好');assert.equal(sources.length,2);assert.equal(context.buffers,1);assert.equal(sources[0].stops,1);
    context.currentTime+=.035;audio.playTypingSound(high,'呀');assert.equal(context.buffers,2);assert.equal(sources[1].stops,1);
    context.currentTime+=.035;audio.playTypingSound(null,'静');assert.equal(sources.length,3);
    await audio.setEnabled(false);assert.equal(sources[2].stops,1);audio.playTypingSound(high,'音');assert.equal(sources.length,3);audio.dispose();
  }finally{Object.assign(globalThis,{AudioContext:previous});}
});
