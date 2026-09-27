import assert from 'node:assert/strict';
import test from 'node:test';
import { courtroomDemoPack } from '../content-packs/courtroom-demo/pack.js';
import { addDemoCharacter, completeDemoCast } from '../content-packs/courtroom-demo/cast.js';
import { demoManifest, demoProject, demoShowcaseDocument } from '../examples/courtroom-demo-project/fixture.js';
import { courtroomAdapter } from '../packages/adapters/courtroom/src/index.js';
import { createTokenFromCandidate } from '../packages/editor-core/src/index.js';
import { createProjectFile, decodeProjectFile } from '../packages/core/src/index.js';
import type { ScriptDocument } from '../packages/core/src/index.js';

test('recovered showcase covers all five actors and compiles', () => {
  assert.deepEqual(courtroomDemoPack.characters.map(c => c.id), ['phoenix','edgeworth','maya','judge','witness']);
  const speakers = new Set(demoShowcaseDocument.blocks.filter(b => b.type === 'dialogue').map(b => b.speaker?.castId));
  assert.equal(speakers.size, 5);
  assert.equal(courtroomAdapter.validate(demoShowcaseDocument, demoProject).filter(d => d.severity === 'error').length, 0);
  assert.ok(courtroomAdapter.compile(demoShowcaseDocument, demoProject).instructions.length > 10);
});

test('all recovered character actions can be selected, validated and compiled', () => {
  for (const character of courtroomDemoPack.characters) {
    for (const [type, actions] of [['pose',character.poses],['reaction',character.reactions]] as const) {
      const context = {projectId:demoManifest.projectId, documentId:'coverage', adapterId:demoManifest.adapter.id, adapterVersion:demoManifest.adapter.version, insertionScope:'inline' as const, speaker:{castId:character.id}};
      const candidates = courtroomAdapter.getTokenCandidates(context, demoProject, {type:`courtroom.${type}`});
      for (const action of actions) {
        const candidate = candidates.find(c => c.subject?.kind === 'speaker' && c.params[type] === action.id);
        assert.ok(candidate?.enabled, `${character.id}/${type}/${action.id}`);
        const document: ScriptDocument = {schemaVersion:'0.7',documentId:'coverage',title:'coverage',blocks:[{id:'line',type:'dialogue',speaker:context.speaker,content:[{type:'token',token:createTokenFromCandidate('action',candidate)}]}]};
        const plan = courtroomAdapter.compile(document, demoProject);
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

test('presentation resolves character stations and explicit backgrounds without hiding unknown resources', () => {
  const defence = resolveCourtroomVisual('phoenix','normal');
  const prosecution = resolveCourtroomVisual('edgeworth','normal');
  assert.ok(defence.backdrop && prosecution.backdrop && defence.backdrop !== prosecution.backdrop);
  assert.ok(prosecution.sprite && prosecution.foreground);
  const lobby = resolveCourtroomVisual('maya','cheer',{packId:courtroomDemoPack.id,id:'background/lobby'});
  assert.ok(lobby.supported && lobby.backdrop && lobby.sprite);
  assert.equal(lobby.foreground,undefined);
  const missing = resolveCourtroomVisual('maya','cheer',{packId:'other',id:'background/courtroom'});
  assert.equal(missing.supported,false);
  assert.equal(missing.backdrop,undefined);
  assert.equal(resolveCourtroomVisual('maya','unavailable').sprite,undefined);
});
