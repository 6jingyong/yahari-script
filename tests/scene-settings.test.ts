import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneBackgroundRef, withSceneBackground } from '../apps/editor/src/scene-settings.js';
import type { ScriptDocument } from '../packages/core/src/index.js';

const base:ScriptDocument={
  schemaVersion:'0.7',documentId:'scene-a',title:'Scene A',
  blocks:[
    {id:'line',type:'dialogue',speaker:null,content:[{type:'text',text:'hello'}]},
    {id:'old-bg',type:'cue',cue:{id:'old-bg-token',type:'courtroom.background',params:{resource:{packId:'pack',id:'background/old'}}}},
    {id:'duplicate-bg',type:'cue',cue:{id:'duplicate-bg-token',type:'courtroom.background',params:{resource:{packId:'pack',id:'background/duplicate'}}}},
  ],
};

test('scene background is read from legacy cue data',()=>{
  assert.deepEqual(sceneBackgroundRef(base),{packId:'pack',id:'background/old'});
});

test('setting a scene background normalizes legacy cues to one leading managed cue',()=>{
  const next=withSceneBackground(base,{packId:'pack',id:'background/new'});
  assert.deepEqual(sceneBackgroundRef(next),{packId:'pack',id:'background/new'});
  assert.equal(next.blocks.filter(block=>block.type==='cue'&&block.cue.type==='courtroom.background').length,1);
  assert.equal(next.blocks[0].type,'cue');
  assert.equal(next.blocks[1].id,'line');
  assert.equal(base.blocks.length,3);
});
