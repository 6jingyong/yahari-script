import test from 'node:test';
import assert from 'node:assert/strict';
import { createBranchSample } from '../examples/branching-story/fixture.js';
import { layoutStoryMap } from '../apps/editor/src/story-map.js';
import { decodeProjectFile,createProjectFile } from '../packages/core/src/index.js';
import { playerCatalog } from '../apps/player/src/project.js';

test('branch maps unfold choices before convergence and preserve every real edge',()=>{
  const project=createBranchSample('map'),layout=layoutStoryMap(project),rows=new Map(layout.nodes.map(n=>[n.id,n.row]));
  assert.equal(rows.get('map-opening'),0);assert.equal(rows.get('map-monitor'),1);assert.equal(rows.get('map-witness'),1);assert.equal(rows.get('map-confront'),2);assert.equal(rows.get('map-public'),3);assert.equal(rows.get('map-private'),3);
  assert.equal(layout.edges.length,6);assert.equal(new Set(layout.nodes.map(n=>`${n.row}:${n.column}`)).size,6);
  assert.ok(layout.nodes.every(n=>n.reachable));assert.ok(layout.edges.every(e=>!e.loop));
  assert.deepEqual(layout.edges.filter(e=>e.from==='map-opening').map(e=>e.label),['查看监控记录','询问当年的登记人员']);
});
test('loops, self-loops and unreachable chapters have finite deterministic layout',()=>{
  const project=createBranchSample('map');project.manifest.flow!.routes.find(r=>r.documentId==='map-confront')!.exit={type:'next',targetDocumentId:'map-opening'};
  const layout=layoutStoryMap(project);assert.ok(layout.edges.some(e=>e.loop));assert.equal(layout.nodes.find(n=>n.id==='map-public')!.reachable,false);assert.deepEqual(layoutStoryMap(project),layout);
  project.manifest.flow!.routes[0].exit={type:'next',targetDocumentId:'map-opening'};assert.ok(layoutStoryMap(project).edges.some(e=>e.from==='map-opening'&&e.to==='map-opening'&&e.loop));
});
test('multiple options to one continuation do not create separate map columns',()=>{
  const project=createBranchSample('map');
  project.manifest.flow={version:1,routes:[{documentId:'map-opening',exit:{type:'choice',prompt:'回答？',options:['a','b'].map(id=>({id,label:id,targetDocumentId:'map-monitor'}))}}]};
  const layout=layoutStoryMap(project);assert.equal(layout.columns,1);assert.equal(layout.rows,6);
  assert.equal(layout.edges.filter(e=>e.from==='map-opening').length,2);
  assert.equal(new Set(layout.edges.filter(e=>e.from==='map-opening').map(e=>e.to)).size,1);
});

test('story layout depends only on connections, ignoring speakers and legacy viewpoint metadata',()=>{
  const project=createBranchSample('map'),document=project.documents[0];
  const before=layoutStoryMap(project);
  document.metadata={storyMap:{castId:'chen',time:'21:10'}};
  const decoded=decodeProjectFile(createProjectFile(project.manifest,project.documents),playerCatalog);assert.ok(decoded.ok&&decoded.kind==='project');
  if(!decoded.ok||decoded.kind!=='project')return;
  assert.deepEqual(layoutStoryMap(decoded.project),before);assert.deepEqual(decoded.project.manifest.flow,project.manifest.flow);
  assert.deepEqual(decoded.project.documents[0].metadata,document.metadata);
  for(const doc of project.documents)for(const block of doc.blocks)if(block.type==='dialogue')block.speaker={castId:'zhou'};
  project.manifest.cast.reverse();assert.deepEqual(layoutStoryMap(project),before);
});
