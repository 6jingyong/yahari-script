import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultAudioAssets,validateAudioAssets,audioCategories,applyAudioAssets,resolveAudioAssets} from '../apps/editor/src/builtin-audio-assets.js';
import {renderChipCue,chipWav,CHIP_SAMPLE_RATE} from '../apps/editor/src/chip-audio.js';
import {PreviewSynthAudio} from '../apps/editor/src/preview-audio.js';
import {courtroomDemoPack} from '../content-packs/courtroom-demo/pack.js';
import {createProjectFile,decodeProjectFile} from '../packages/core/src/index.js';
import {encodeProjectBundle,decodeProjectBundle} from '../packages/project-io/src/index.js';
import {demoManifest,demoDocument} from '../examples/courtroom-demo-project/fixture.js';
import {playerCatalog} from '../apps/player/src/project.js';

test('all legacy sound references remain valid and the 8Bit library covers every narrative use',()=>{
 const settings=validateAudioAssets(defaultAudioAssets());
 for(const id of ['objection','hold-it','desk-slam','gavel','impact','evidence-presented','truth-reveal','whip','camera','magic'])assert.ok(settings.presets.find(p=>p.kind==='sfx'&&p.id===id));
 for(const category of audioCategories.filter(c=>c.id!=='custom'))assert.ok(settings.presets.some(p=>p.category===category.id));
 for(const item of settings.presets){assert.ok(item.description);assert.ok(['square','triangle'].includes(item.cue.waveform!));if(item.kind==='bgm'){assert.equal(item.cue.notes.length,32);assert.ok(item.cue.notes.every(n=>(n.offsetMs??0)+n.durationMs<=item.cue.loopMs!));}}
});
test('every preset produces distinct deterministic, bounded 8-bit samples including noise',()=>{
 const signatures=new Set<string>();
 for(const item of defaultAudioAssets().presets){const pcm=renderChipCue(item.cue);assert.deepEqual(renderChipCue(item.cue),pcm);assert.ok(pcm.some(n=>n!==0));
  for(const sample of pcm){assert.ok(Math.abs(sample)<=1);assert.ok(Math.abs(sample*127-Math.round(sample*127))<.00001);}
  let hash=2166136261;for(const sample of pcm)hash=Math.imul(hash^Math.round(sample*127),16777619);signatures.add(pcm.length+':'+(hash>>>0));
 }
 assert.equal(signatures.size,51);
 const silent=renderChipCue({waveform:'noise',notes:[{frequency:440,durationMs:100,gain:0}]});assert.ok(silent.every(n=>n===0));
});
test('WAV output carries mono unsigned 8-bit PCM with valid length and sample rate',()=>{
 const cue=defaultAudioAssets().presets.find(p=>p.id==='pursuit')!.cue,bytes=chipWav(cue),view=new DataView(bytes.buffer);
 assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'RIFF');assert.equal(view.getUint32(4,true),bytes.length-8);assert.equal(view.getUint16(22,true),1);assert.equal(view.getUint16(34,true),8);assert.equal(view.getUint32(24,true),CHIP_SAMPLE_RATE);
 assert.equal(view.getUint32(40,true),CHIP_SAMPLE_RATE*1.6);assert.equal(bytes[44],128);assert.ok(bytes.slice(44).some(n=>n!==128));
});
test('audio categories, usage and mixed voices round-trip while old settings infer their categories',()=>{
 const settings=defaultAudioAssets(),source=createProjectFile(demoManifest,[demoDocument]);settings.presets[0].description='新的使用说明';
 const decoded=decodeProjectFile(decodeProjectBundle(encodeProjectBundle(applyAudioAssets(source,settings))),playerCatalog);assert.ok(decoded.ok&&decoded.kind==='project');
 if(decoded.ok&&decoded.kind==='project'){const effective=resolveAudioAssets(courtroomDemoPack,decoded.project.manifest.projectSettings);assert.equal(effective.audio.sfx[0].description,'新的使用说明');assert.deepEqual(effective.audio.bgm,resolveAudioAssets(courtroomDemoPack,applyAudioAssets(source,settings).manifest.projectSettings).audio.bgm);}
 delete settings.presets[0].category;delete settings.presets[0].description;assert.equal(validateAudioAssets(settings).presets[0].category,'courtroom');
 const invalid=structuredClone(settings);invalid.presets[0].category='investigation';assert.throws(()=>validateAudioAssets(invalid));
 const overlapping=structuredClone(settings),bgm=overlapping.presets.find(p=>p.kind==='bgm')!;bgm.cue.notes[0].offsetMs=bgm.cue.loopMs;assert.throws(()=>validateAudioAssets(overlapping));
});
test('changing music, muting and disposing stop already scheduled chip voices',async()=>{
 const oldContext=globalThis.AudioContext,oldWindow=globalThis.window;const voices:Array<{stops:number;onended?:(()=>void)|null}>=[];let cleared=0;
 class MockAudioContext {state='running';currentTime=0;destination={};resume(){return Promise.resolve();}close(){return Promise.resolve();}createGain(){return{gain:{value:0},connect(){},disconnect(){}};}createBuffer(_channels:number,length:number){return{copyToChannel(data:Float32Array){assert.equal(data.length,length);}};}createBufferSource(){const voice={stops:0,onended:null as null|(()=>void),buffer:null,connect(){},disconnect(){},start(){},stop(){this.stops++;this.onended?.();}};voices.push(voice);return voice;}}
 Object.assign(globalThis,{AudioContext:MockAudioContext,window:{setInterval(){return 1;},clearInterval(){cleared++;}}});
 try{const audio=new PreviewSynthAudio([courtroomDemoPack]);assert.equal(await audio.setEnabled(true),true);audio.syncBgm({packId:courtroomDemoPack.id,id:'audio/bgm/trial'});audio.syncBgm({packId:courtroomDemoPack.id,id:'audio/bgm/pursuit'});assert.equal(voices[0].stops,1);
  audio.playSfx([{packId:courtroomDemoPack.id,id:'audio/sfx/gavel'}]);await audio.setEnabled(false);assert.equal(voices[1].stops,1);assert.equal(voices[2].stops,1);assert.ok(cleared>=2);audio.dispose();
 }finally{Object.assign(globalThis,{AudioContext:oldContext,window:oldWindow});}
});

test('muting during a pending browser audio unlock prevents the old request from re-enabling sound',async()=>{
 const previous=globalThis.AudioContext;let resume!:()=>void;
 class DelayedContext {state='suspended';destination={};currentTime=0;createGain(){return{gain:{value:0},connect(){}};}resume(){return new Promise<void>(resolve=>{resume=()=>{this.state='running';resolve();};});}close(){return Promise.resolve();}}
 Object.assign(globalThis,{AudioContext:DelayedContext});
 try{const audio=new PreviewSynthAudio([courtroomDemoPack]);const pending=audio.setEnabled(true);await audio.setEnabled(false);resume();await pending;assert.equal(audio.isEnabled,false);audio.dispose();}
 finally{Object.assign(globalThis,{AudioContext:previous});}
});
