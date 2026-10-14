import assert from 'node:assert/strict';
import test from 'node:test';
import { addOriginalBackground, addOriginalCharacter, embeddedCourtroomPack, embeddedResources } from '../apps/editor/src/project-assets.js';
import { sceneAt } from '../apps/editor/src/preview-scene.js';
import { withSceneBackground } from '../apps/editor/src/scene-settings.js';
import { createProjectFile, decodeProjectFile } from '../packages/core/src/index.js';
import { courtroomAdapter } from '../packages/adapters/courtroom/src/index.js';
import { createStaticResourceResolver } from '../packages/presentation/src/index.js';
import { courtroomDemoPack } from '../content-packs/courtroom-demo/pack.js';
import { demoDocument, demoManifest } from '../examples/courtroom-demo-project/fixture.js';

const image = 'data:image/png;base64,AAAA';
const catalog = { adapters: [{ id: 'official.courtroom', version: '0.1.0' }],
  contentPacks: [{ id: courtroomDemoPack.id, version: courtroomDemoPack.version }] };

test('two original characters and an owned background compile after portable export/import', () => {
  const first = addOriginalCharacter(createProjectFile(demoManifest, [demoDocument]), '小林', image);
  const second = addOriginalCharacter(first.project, '小周', image);
  const added = addOriginalBackground(second.project, '自己的书店', image);
  added.project.documents = [withSceneBackground({ ...demoDocument, blocks: [
    { id: 'a', type: 'dialogue', speaker: { castId: first.castId }, content: [{ type: 'text', text: '早上好。' }] },
    { id: 'b', type: 'dialogue', speaker: { castId: second.castId }, content: [{ type: 'text', text: '欢迎来到书店。' }] },
  ] }, added.resource)];
  const decoded = decodeProjectFile(JSON.parse(JSON.stringify(added.project)), catalog);
  assert.ok(decoded.ok && decoded.kind === 'project' && decoded.availability === 'ready');
  if (!decoded.ok || decoded.kind !== 'project') return;
  const packs = decoded.project.embeddedPacks!.map(item => embeddedCourtroomPack(item)!);
  assert.ok(packs.every(Boolean));
  const context = { manifest: decoded.project.manifest, contentPacks: [courtroomDemoPack, ...packs] };
  assert.equal(courtroomAdapter.validate(decoded.project.documents[0], context).filter(item => item.severity === 'error').length, 0);
  const plan = courtroomAdapter.compile(decoded.project.documents[0], context);
  const presentation = { packs: context.contentPacks, resolver: createStaticResourceResolver(embeddedResources(decoded.project.embeddedPacks!)) };
  const scene = sceneAt(plan.instructions, plan.instructions.length, context.manifest, presentation);
  assert.equal(scene.visual.backdrop, image);
  assert.equal(scene.visual.sprite, image);
  assert.equal(scene.visual.foreground, undefined);
  assert.equal(scene.visual.supported, true);
  assert.equal(scene.speaker, second.castId);
});

test('malformed background packs are rejected before installation', () => {
  const added = addOriginalBackground(createProjectFile(demoManifest, [demoDocument]), '书店', image);
  const embedded = added.project.embeddedPacks![0];
  const missing = structuredClone(embedded);
  missing.resources = {};
  assert.equal(embeddedCourtroomPack(missing), null);
  const duplicate = structuredClone(embedded);
  const pack = embeddedCourtroomPack(duplicate)!;
  pack.backgrounds.push(structuredClone(pack.backgrounds[0]));
  assert.equal(embeddedCourtroomPack(duplicate), null);
});
