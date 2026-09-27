import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaticResourceResolver } from '../packages/presentation/src/index.js';
import { resolveCourtroomVisual } from '../apps/editor/src/preview-visuals.js';
import type { CourtroomContentPack } from '../packages/adapters/courtroom/src/index.js';
import { validateOutline } from '../packages/story-ai/src/outline.js';

test('Courtroom preview resolves a second content pack without demo-pack special cases',()=>{
  const id='community.boundary-test';
  const ref=(resourceId:string)=>({packId:id,id:resourceId});
  const pack:CourtroomContentPack={
    id,version:'1.0.0',name:'Boundary Test Pack',
    stageScene:ref('scene/stage'),
    characters:[{
      id:'hero',name:'Hero',
      portraits:{base:ref('hero/normal')},
      stage:{background:ref('stage/hero'),foreground:ref('stage/bench')},
      poses:[{id:'normal',label:'Normal',asset:ref('hero/normal')},{id:'point',label:'Point',asset:ref('hero/point')}],
      reactions:[],
    }],
    backgrounds:[
      {id:'stage',label:'Stage',resource:ref('scene/stage')},
      {id:'street',label:'Street',resource:ref('scene/street')},
    ],
    audio:{sfx:[],bgm:[]},
  };
  const resolver=createStaticResourceResolver([{packId:id,resources:{
    'scene/stage':{url:'stage.png'},
    'scene/street':{url:'street.png'},
    'stage/hero':{url:'hero-stage.png'},
    'stage/bench':{url:'bench.png'},
    'hero/normal':{url:'hero-normal.png'},
    'hero/point':{url:'hero-point.png'},
  }}]);
  const presentation={packs:[pack],resolver};
  const staged=resolveCourtroomVisual(presentation,{packId:id,id:'hero'},'point');
  assert.deepEqual(
    {backdrop:staged.backdrop,foreground:staged.foreground,sprite:staged.sprite,supported:staged.supported},
    {backdrop:'hero-stage.png',foreground:'bench.png',sprite:'hero-point.png',supported:true},
  );
  const street=resolveCourtroomVisual(presentation,{packId:id,id:'hero'},'normal',ref('scene/street'));
  assert.equal(street.backdrop,'street.png');
  assert.equal(street.foreground,undefined);
  assert.equal(street.sprite,'hero-normal.png');
});

test('story outline planning depends on material shape, not a Courtroom content-pack type',()=>{
  const materials={
    characters:[{id:'avatar-a',name:'Avatar A'}],
    backgrounds:[{id:'room-a',label:'Room A'}],
  };
  const outline=validateOutline({
    title:'Boundary Story',summary:'A generic structure.',
    cast:[{id:'person',name:'Person',characterId:'avatar-a'}],
    chapters:[{title:'Chapter',summary:'Summary',scenes:[{title:'Scene',summary:'Scene summary',background:'room-a'}]}],
  },materials);
  assert.equal(outline.cast[0].characterId,'avatar-a');
  assert.equal(outline.chapters[0].scenes[0].background,'room-a');
});
