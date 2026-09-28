import assert from 'node:assert/strict';
import test from 'node:test';
import { courtroomDemoPack } from '../content-packs/courtroom-demo/pack.js';
import { addDemoCharacter, completeDemoCast, defaultDemoCharacterIds } from '../content-packs/courtroom-demo/cast.js';
import { demoManifest, demoProject, demoShowcaseDocument } from '../examples/courtroom-demo-project/fixture.js';
import { courtroomAdapter } from '../packages/adapters/courtroom/src/index.js';
import { createTokenFromCandidate } from '../packages/editor-core/src/index.js';
import { createProjectFile, decodeProjectFile } from '../packages/core/src/index.js';
import type { ScriptDocument } from '../packages/core/src/index.js';

test('recovered showcase covers all five actors and compiles', () => {
  assert.ok(courtroomDemoPack.characters.some(c => c.id === 'apollo'));
  for (const id of ['von-karma','gumshoe','lotta','yogi','mia']) assert.ok(courtroomDemoPack.characters.some(c => c.id === id), id);
  assert.deepEqual([...defaultDemoCharacterIds], ['phoenix','edgeworth','maya','judge','witness']);
  const speakers = new Set(demoShowcaseDocument.blocks.filter(b => b.type === 'dialogue').map(b => b.speaker?.castId));
  assert.equal(speakers.size, 5);
  assert.equal(courtroomAdapter.validate(demoShowcaseDocument, demoProject).filter(d => d.severity === 'error').length, 0);
  assert.ok(courtroomAdapter.compile(demoShowcaseDocument, demoProject).instructions.length > 10);
});

test('all recovered character actions can be selected, validated and compiled', () => {
  for (const character of courtroomDemoPack.characters) {
    for (const [type, actions] of [['pose',character.poses],['reaction',character.reactions]] as const) {
      const manifest = addDemoCharacter(demoManifest, character.id);
      const project = {manifest, contentPacks:[courtroomDemoPack]};
      const castId = manifest.cast.find(c => c.characterRef.id === character.id)?.castId;
      assert.ok(castId, `missing opt-in cast for ${character.id}`);
      const context = {projectId:manifest.projectId, documentId:'coverage', adapterId:manifest.adapter.id, adapterVersion:manifest.adapter.version, insertionScope:'inline' as const, speaker:{castId}};
      const candidates = courtroomAdapter.getTokenCandidates(context, project, {type:`courtroom.${type}`});
      for (const action of actions) {
        const candidate = candidates.find(c => c.subject?.kind === 'speaker' && c.params[type] === action.id);
        assert.ok(candidate?.enabled, `${character.id}/${type}/${action.id}`);
        const document: ScriptDocument = {schemaVersion:'0.7',documentId:'coverage',title:'coverage',blocks:[{id:'line',type:'dialogue',speaker:context.speaker,content:[{type:'token',token:createTokenFromCandidate('action',candidate)}]}]};
        const plan = courtroomAdapter.compile(document, project);
        assert.ok(plan.instructions.some(i => i.op === type));
      }
    }
  }
});

test('old built-in sample gains missing cast without replacing identities or authored data', () => {
  const old = structuredClone(demoManifest);
  old.cast = old.cast.filter(c => ['phoenix','judge'].includes(c.castId));
  old.cast[0].displayName = '我的律师';
  const before = structuredClone(old);
  const merged = completeDemoCast(old);
  assert.deepEqual(old, before);
  assert.deepEqual(merged.cast.slice(0,2), before.cast);
  assert.equal(merged.cast.length,5);
  assert.deepEqual(completeDemoCast(merged),merged);
  const decoded = decodeProjectFile(createProjectFile(merged,[demoShowcaseDocument]), {adapters:[demoManifest.adapter],contentPacks:demoManifest.contentPacks});
  assert.equal(decoded.ok,true);
});

test('custom casts opt in and occupied cast IDs are never overwritten', () => {
  const custom = structuredClone(demoManifest); custom.projectId='custom';
  custom.cast=[{castId:'maya',characterRef:{packId:courtroomDemoPack.id,id:'phoenix'},displayName:'原角色'}];
  assert.deepEqual(completeDemoCast(custom),custom);
  const added=addDemoCharacter(custom,'maya');
  assert.deepEqual(added.cast[0],custom.cast[0]);
  assert.equal(added.cast[1].castId,'maya-2');
  assert.deepEqual(addDemoCharacter(added,'maya'),added);
  const unavailable=structuredClone(custom);unavailable.contentPacks[0].version='missing';
  assert.deepEqual(addDemoCharacter(unavailable,'maya'),unavailable);
});

import { resolveCourtroomVisual } from '../apps/editor/src/preview-visuals.js';
import { courtroomDemoResolver } from '../content-packs/courtroom-demo/presentation.js';
const presentation={packs:[courtroomDemoPack],resolver:courtroomDemoResolver};

test('presentation resolves character stations and explicit backgrounds without hiding unknown resources', () => {
  const defence = resolveCourtroomVisual(presentation,{packId:courtroomDemoPack.id,id:'phoenix'},'normal');
  const prosecution = resolveCourtroomVisual(presentation,{packId:courtroomDemoPack.id,id:'edgeworth'},'normal');
  const apollo = resolveCourtroomVisual(presentation,{packId:courtroomDemoPack.id,id:'apollo'},'point');
  assert.ok(defence.backdrop && prosecution.backdrop && defence.backdrop !== prosecution.backdrop);
  assert.ok(apollo.sprite && apollo.backdrop === defence.backdrop);
  assert.ok(prosecution.sprite && prosecution.foreground);
  const lobby = resolveCourtroomVisual(presentation,{packId:courtroomDemoPack.id,id:'maya'},'cheer',{packId:courtroomDemoPack.id,id:'background/lobby'});
  assert.ok(lobby.supported && lobby.backdrop && lobby.sprite);
  assert.equal(lobby.foreground,undefined);
  const missing = resolveCourtroomVisual(presentation,{packId:courtroomDemoPack.id,id:'maya'},'cheer',{packId:'other',id:'background/courtroom'});
  assert.equal(missing.supported,false);
  assert.equal(missing.backdrop,undefined);
  assert.equal(resolveCourtroomVisual(presentation,{packId:courtroomDemoPack.id,id:'maya'},'unavailable').sprite,undefined);
});


test('scene and presentation material catalogs expose the new usable presets', () => {
  assert.equal(courtroomDemoPack.backgrounds.length, 15);
  for (const id of ['office','detention-room','police-records','night-corridor','lake-dock','evidence-room','prosecutor-office','elevator-hall','boathouse','records-basement','parking-garage','hospital-room']) {
    const scene = courtroomDemoPack.backgrounds.find(item => item.id === id);
    assert.ok(scene, id);
    const visual = resolveCourtroomVisual(presentation,{packId:courtroomDemoPack.id,id:'phoenix'},'normal',scene.resource);
    assert.ok(visual.supported && visual.backdrop, id);
  }

  const context = {
    projectId: demoManifest.projectId,
    documentId: 'material-coverage',
    adapterId: demoManifest.adapter.id,
    adapterVersion: demoManifest.adapter.version,
    insertionScope: 'inline' as const,
    speaker: {castId:'phoenix'},
  };
  const candidates = courtroomAdapter.getTokenCandidates(context, demoProject);
  for (const id of ['wait:1000','emphasis:strong','flash:soft','flash:strong','shake:soft','shake:strong']) {
    const candidate = candidates.find(item => item.id === id);
    assert.ok(candidate?.enabled, id);
    const document: ScriptDocument = {
      schemaVersion:'0.7',
      documentId:`material-${id}`,
      title:id,
      blocks:[{id:'line',type:'dialogue',speaker:context.speaker,content:[{type:'token',token:createTokenFromCandidate(`token-${id}`,candidate)}]}],
    };
    assert.ok(courtroomAdapter.compile(document,demoProject).instructions.length > 1, id);
  }
  const focus = candidates.filter(item => item.tokenType === 'courtroom.focus');
  assert.equal(focus.length,1);
  assert.equal(focus[0]?.id,'focus:phoenix');
  assert.equal(focus[0]?.subject?.kind,'speaker');
});


test('expanded original stand-ins expose the richer action vocabulary',()=>{
  const action=(characterId:string,actionId:string)=> {
    const character=courtroomDemoPack.characters.find(c=>c.id===characterId);
    return [...(character?.poses??[]),...(character?.reactions??[])].find(item=>item.id===actionId)?.label;
  };
  assert.equal(action('von-karma','smug'),'轻蔑');
  assert.equal(action('gumshoe','point'),'指出');
  assert.equal(action('lotta','grin'),'得意');
  assert.equal(action('yogi','shocked'),'震惊');
  assert.equal(action('mia','smile'),'微笑');
});


test('core trio exposes eight distinct generated action states',()=>{
  const expected={
    phoenix:['normal','think','point','objection','desk','smile','sweat','shocked'],
    maya:['normal','wave','cheer','point','think','thumbs-up','surprised','sad'],
    edgeworth:['normal','bow','point','objection','desk','smug','surprised','damaged'],
  } as const;
  for(const [characterId,ids] of Object.entries(expected)){
    const character=courtroomDemoPack.characters.find(item=>item.id===characterId);
    assert.ok(character,characterId);
    const actions=[...character.poses,...character.reactions];
    assert.equal(actions.length,8,characterId);
    assert.deepEqual(actions.map(item=>item.id),[...ids],characterId);
    for(const id of ids){
      const visual=resolveCourtroomVisual(presentation,{packId:courtroomDemoPack.id,id:characterId},id);
      assert.ok(visual.sprite && visual.frame, `${characterId}/${id}`);
      assert.match(visual.sprite,/chibi-(phoenix|maya|edgeworth)-actions\.png$/);
    }
  }
});
