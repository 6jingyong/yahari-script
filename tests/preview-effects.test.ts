import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationStateAt, transientEffectsBetween } from '../apps/editor/src/preview-effects.js';
import type { CourtroomInstruction } from '../packages/adapters/courtroom/src/index.js';

const commands:CourtroomInstruction[]=[
  {op:'speaker',castId:'phoenix'},
  {op:'emphasis',mode:'strong'},
  {op:'showText',text:'异议'},
  {op:'flash',intensity:2},
  {op:'shake',intensity:-1,durationMs:9999},
  {op:'focus',castId:'edgeworth'},
  {op:'showText',text:'看这里'},
  {op:'speaker',castId:'maya'},
  {op:'showText',text:'重置强调'},
];

test('emphasis is paragraph-local and survives text rendering within the paragraph',()=>{
  assert.equal(presentationStateAt(commands,1).emphasis,null);
  assert.equal(presentationStateAt(commands,3).emphasis,'strong');
  assert.equal(presentationStateAt(commands,7).emphasis,'strong');
  assert.equal(presentationStateAt(commands,9).emphasis,null);
});

test('transient effects only fire when playback crosses their instruction positions',()=>{
  assert.deepEqual(transientEffectsBetween(commands,0,3),[]);
  assert.deepEqual(transientEffectsBetween(commands,3,6),[
    {kind:'flash',intensity:1},
    {kind:'shake',intensity:0,durationMs:2000},
    {kind:'focus',castId:'edgeworth'},
  ]);
  assert.deepEqual(transientEffectsBetween(commands,6,6),[]);
  assert.deepEqual(transientEffectsBetween(commands,7,2),[]);
});

test('effect defaults are deterministic when optional values are omitted',()=>{
  const effects=transientEffectsBetween([{op:'flash'},{op:'shake'}],0,2);
  assert.deepEqual(effects,[
    {kind:'flash',intensity:0.65},
    {kind:'shake',intensity:0.55,durationMs:360},
  ]);
});
