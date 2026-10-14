import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeProjectBundle } from '../dist/packages/project-io/src/index.js';
import { decodeProjectFile } from '../dist/packages/core/src/index.js';
import { courtroomAdapter } from '../dist/packages/adapters/courtroom/src/index.js';
import { courtroomDemoPack as pack } from '../dist/content-packs/courtroom-demo/pack.js';
const catalog={adapters:[courtroomAdapter.manifest],contentPacks:[pack]};
let scenes=0,dialogues=0;
for(const id of ['bookshop','last-train','rehearsal']) {
  const root=`examples/openrouter-scripts/${id}`;
  const original=decodeProjectFile(JSON.parse(readFileSync(`${root}.yahari-project.json`,'utf8')),catalog);
  const imported=decodeProjectFile(decodeProjectBundle(readFileSync(`${root}.yahari`)),catalog);
  assert.ok(original.ok&&original.kind==='project'&&original.availability==='ready');
  assert.ok(imported.ok&&imported.kind==='project'&&imported.availability==='ready');
  assert.deepEqual(imported.project.manifest,original.project.manifest);
  assert.deepEqual(imported.project.documents,original.project.documents);
  const context={manifest:imported.project.manifest,contentPacks:[pack]};
  for(const document of imported.project.documents) {
    assert.equal(courtroomAdapter.validate(document,context).filter(issue=>issue.severity==='error').length,0);
    const sourceDocument=original.project.documents.find(item=>item.documentId===document.documentId);
    assert.deepEqual(courtroomAdapter.compile(document,context),courtroomAdapter.compile(sourceDocument,context));
    scenes++;dialogues+=document.blocks.filter(block=>block.type==='dialogue').length;
  }
}
console.log(`OpenRouter exported examples passed: 3 works, ${scenes} scenes, ${dialogues} dialogues; identical structure and compilation.`);
