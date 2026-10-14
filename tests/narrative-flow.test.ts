import test from 'node:test';
import assert from 'node:assert/strict';
import { createBranchSample } from '../examples/branching-story/fixture.js';
import { sceneExit, validateFlow, createProjectFile, decodeProjectFile } from '../packages/core/src/index.js';
import { NarrativeSession } from '../packages/narrative/src/index.js';
import { preparePlayerProject, playerCatalog } from '../apps/player/src/project.js';
import { encodeProjectBundle, decodeProjectBundle } from '../packages/project-io/src/index.js';
import { demoManifest, demoDocument } from '../examples/courtroom-demo-project/fixture.js';
import { addOriginalCharacter } from '../apps/editor/src/project-assets.js';

test('both routes converge without traversing the unchosen investigation and reach distinct endings', () => {
  const sample = createBranchSample('test'); assert.deepEqual(validateFlow(sample.manifest), []);
  for (const [first, last] of [['monitor', 'public'], ['witness', 'private']]) {
    const session = new NarrativeSession(sample.manifest);
    assert.throws(() => session.advance('unknown'), /有效选项/);
    session.advance(first); session.advance(); session.advance(last);
    assert.deepEqual(session.path.map(p => p.documentId), ['opening', first, 'confront', last].map(s => `test-${s}`));
    assert.equal(session.exit.type, 'ending'); assert.equal(session.advance(), false);
    assert.ok(preparePlayerProject(sample).plans.get(session.documentId));
  }
});

test('different options may continue the same story without a fork and retain their own selection history',()=>{
  const sample=createBranchSample('test');
  sample.manifest.flow={version:1,routes:[{documentId:'test-opening',exit:{type:'choice',prompt:'你的回答？',options:[{id:'yes',label:'答应',targetDocumentId:'test-monitor'},{id:'no',label:'婉拒',targetDocumentId:'test-monitor'}]}}]};
  assert.deepEqual(validateFlow(sample.manifest),[]);
  const paths=[];
  for(const optionId of ['yes','no']){
    const session=new NarrativeSession(sample.manifest);session.advance(optionId);
    assert.equal(session.documentId,'test-monitor');assert.equal(session.path[0].optionId,optionId);
    const restored=new NarrativeSession(sample.manifest);assert.equal(restored.restore(session.path),true);assert.deepEqual(restored.path,session.path);
    const decoded=decodeProjectFile(createProjectFile(sample.manifest,sample.documents),playerCatalog);assert.ok(decoded.ok);
    while(session.advance()){}paths.push(session.path.map(p=>p.documentId));
  }
  assert.deepEqual(paths[0],paths[1]);
});
test('backtracking removes the prior choice and content-validated restoration rejects invented paths atomically', () => {
  const sample = createBranchSample('test'), session = new NarrativeSession(sample.manifest);
  session.advance('monitor'); session.advance(); session.advance('public');
  const restored = new NarrativeSession(sample.manifest); assert.equal(restored.restore(session.path), true);
  restored.back(); assert.equal(restored.documentId, 'test-confront'); assert.equal(restored.path.at(-1)?.optionId, undefined);
  restored.advance('private'); assert.equal(restored.documentId, 'test-private');
  const previous = restored.path;
  assert.equal(restored.restore([{ documentId: 'test-opening' }, { documentId: 'test-private' }]), false);
  assert.deepEqual(restored.path, previous);
  assert.equal(restored.restore([{ documentId: 'test-opening', optionId: 'monitor' }]), false);
  restored.restart(); assert.equal(restored.back(), false); assert.equal(restored.documentId, 'test-opening');
});
test('legacy linear works follow chapter order and portable 0.9 bundles preserve every choice and ending', () => {
  const sample = createBranchSample('test');
  assert.equal(sample.fileVersion, '0.9');
  const bundled = decodeProjectBundle(encodeProjectBundle(sample));
  const decoded = decodeProjectFile(bundled, playerCatalog);
  assert.ok(decoded.ok && decoded.kind === 'project');
  if (decoded.ok && decoded.kind === 'project') assert.deepEqual(decoded.project.manifest.flow, sample.manifest.flow);
  delete sample.manifest.flow;
  assert.deepEqual(sceneExit(sample.manifest, 'test-opening'), { type: 'next', targetDocumentId: 'test-monitor' });
  assert.equal(sceneExit(sample.manifest, 'test-private').type, 'ending');
});
for (const [name, mutate] of [
  ['missing target', (p:any) => { p.manifest.flow.routes[0].exit.options[0].targetDocumentId = 'missing'; }],
  ['duplicate option identity', (p:any) => { p.manifest.flow.routes[0].exit.options[1].id = p.manifest.flow.routes[0].exit.options[0].id; }],
  ['duplicate route', (p:any) => { p.manifest.flow.routes.push(p.manifest.flow.routes[0]); }],
  ['malformed option', (p:any) => { p.manifest.flow.routes[0].exit.options[0] = null; }],
  ['unsupported flow version', (p:any) => { p.manifest.flow.version = 2; }],
  ['branching in older file version', (p:any) => { p.fileVersion = '0.7'; }],
] as Array<[string,(p:unknown)=>void]>) test(`import rejects ${name} without changing the active data`, () => {
  const source = createBranchSample('test'); mutate(source); const before = JSON.stringify(source);
  assert.equal(decodeProjectFile(source, playerCatalog).ok, false); assert.equal(JSON.stringify(source), before);
});
test('unreachable and endless routes produce actionable warnings while allowing author repair', () => {
  const sample = createBranchSample('test'); sample.manifest.flow!.routes[0].exit = { type: 'next', targetDocumentId: 'test-opening' };
  const issues = validateFlow(sample.manifest);
  assert.ok(issues.some(i => i.code === 'project.flow.unreachable' && i.documentId === 'test-monitor'));
  assert.ok(issues.some(i => i.code === 'project.flow.no-ending' && i.documentId === 'test-opening'));
  assert.equal(decodeProjectFile(sample, playerCatalog).ok, true);
});
test('a changed entry scene also diagnoses unreachable scenes in a linear work',()=>{
  const sample=createBranchSample('test');delete sample.manifest.flow;sample.manifest.entryDocumentId='test-confront';
  assert.ok(validateFlow(sample.manifest).some(issue=>issue.code==='project.flow.unreachable'&&issue.documentId==='test-opening'));
});
test('ordinary files retain their old format while embedded original characters keep branching format', () => {
  assert.equal(createProjectFile(demoManifest, [demoDocument]).fileVersion, '0.7');
  const sample = createBranchSample('test');
  const next = addOriginalCharacter(sample, '原创角色', 'data:image/png;base64,aGVsbG8=');
  assert.equal(next.project.fileVersion, '0.9'); assert.deepEqual(next.project.manifest.flow, sample.manifest.flow);
});
