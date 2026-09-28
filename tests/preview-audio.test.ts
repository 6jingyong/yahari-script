import test from 'node:test';
import assert from 'node:assert/strict';
import { previewBgmAt, previewSfxBetween, resolvePreviewAudio } from '../apps/editor/src/preview-audio.js';
import { courtroomDemoPack } from '../content-packs/courtroom-demo/pack.js';
import type { CourtroomInstruction } from '../packages/adapters/courtroom/src/index.js';

const ref=(id:string)=>({packId:courtroomDemoPack.id,id});
const commands:CourtroomInstruction[]=[
  {op:'bgm',resource:ref('audio/bgm/trial')},
  {op:'speaker',castId:'phoenix'},
  {op:'sfx',resource:ref('audio/sfx/objection')},
  {op:'showText',text:'异议'},
  {op:'bgm',resource:ref('audio/bgm/pursuit')},
  {op:'sfx',resource:ref('audio/sfx/impact')},
];

test('BGM is persistent state while SFX stays edge-triggered',()=>{
  assert.equal(previewBgmAt(commands,0),undefined);
  assert.deepEqual(previewBgmAt(commands,4),ref('audio/bgm/trial'));
  assert.deepEqual(previewBgmAt(commands,6),ref('audio/bgm/pursuit'));
  assert.deepEqual(previewSfxBetween(commands,0,4),[ref('audio/sfx/objection')]);
  assert.deepEqual(previewSfxBetween(commands,4,6),[ref('audio/sfx/impact')]);
  assert.deepEqual(previewSfxBetween(commands,6,3),[]);
});

test('audio synthesis metadata resolves through the active content pack',()=>{
  const objection=resolvePreviewAudio([courtroomDemoPack],ref('audio/sfx/objection'),'sfx');
  const evidence=resolvePreviewAudio([courtroomDemoPack],ref('audio/sfx/evidence-presented'),'sfx');
  const pursuit=resolvePreviewAudio([courtroomDemoPack],ref('audio/bgm/pursuit'),'bgm');
  const investigation=resolvePreviewAudio([courtroomDemoPack],ref('audio/bgm/investigation'),'bgm');
  assert.equal(courtroomDemoPack.audio.sfx.length,10);
  assert.equal(courtroomDemoPack.audio.bgm.length,6);
  assert.equal(objection?.label,'异议！');
  assert.ok((objection?.cue.notes.length??0)>=2);
  assert.equal(evidence?.label,'出示证物');
  assert.ok((evidence?.cue.notes.length??0)>=3);
  assert.equal(pursuit?.cue.loopMs,1600);
  assert.equal(investigation?.label,'调查');
  assert.equal(investigation?.cue.loopMs,2400);
  assert.equal(resolvePreviewAudio([courtroomDemoPack],{packId:'other',id:'audio/sfx/objection'},'sfx'),undefined);
});
