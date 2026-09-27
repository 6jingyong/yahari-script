import test from 'node:test';
import assert from 'node:assert/strict';
import { createSampleStory, normalizeSampleCast, sampleStories } from '../examples/courtroom-demo-project/story-cases.js';
import { courtroomAdapter } from '../packages/adapters/courtroom/src/index.js';
import { courtroomDemoPack } from '../content-packs/courtroom-demo/pack.js';
import { decodeProjectFile } from '../packages/core/src/index.js';

test('built-in cases retain ordered scenes and playable dialogue after export/import', () => {
  for (const sample of sampleStories) {
    const file = createSampleStory(sample.id, `verify-${sample.id}`);
    const decoded = decodeProjectFile(JSON.parse(JSON.stringify(file)), {
      adapters: [{id:'official.courtroom',version:'0.1.0'}],
      contentPacks: [{id:courtroomDemoPack.id,version:courtroomDemoPack.version}],
    });
    assert.equal(decoded.ok && decoded.kind === 'project', true, sample.title);
    assert.equal(file.manifest.narrative?.chapters.length, sample.chapters);
    assert.equal(file.documents.length, sample.scenes);
    assert.deepEqual(file.manifest.cast.map(person=>person.displayName),courtroomDemoPack.characters.map(person=>person.name));
    assert.deepEqual(file.manifest.cast.map(person=>person.castId),courtroomDemoPack.characters.map(person=>person.id));
    assert.deepEqual(file.manifest.narrative?.chapters.flatMap(chapter => chapter.documentIds), file.documents.map(doc => doc.documentId));
    for (const doc of file.documents) {
      assert.ok(doc.summary);
      assert.ok(doc.blocks.some(block => block.type === 'dialogue'));
      const context = {manifest:file.manifest,contentPacks:[courtroomDemoPack]};
      assert.deepEqual(courtroomAdapter.validate(doc,context).filter(issue => issue.severity === 'error'), [], `${sample.title} / ${doc.title}`);
      assert.ok(courtroomAdapter.compile(doc,context));
    }
  }
});

test('old sample aliases display preset identities while preserving authored lines',()=>{
  const file=createSampleStory(sampleStories[0].id,'sample-default');
  file.manifest.cast[0].displayName='林律师';
  const before=JSON.stringify(file.documents);
  const fixed=normalizeSampleCast(file.manifest);
  assert.equal(fixed.cast[0].displayName,'成步堂');
  assert.equal(fixed.cast[0].castId,file.manifest.cast[0].castId);
  assert.equal(file.manifest.cast[0].displayName,'林律师');
  assert.equal(JSON.stringify(file.documents),before);
});


test('new scene pack is exercised by a built-in case',()=>{
  const file=createSampleStory('midnight-pass','sample-materials');
  const backgrounds=new Set(file.documents.flatMap(doc=>doc.blocks)
    .filter(block=>block.type==='cue' && block.cue.type==='courtroom.background')
    .map(block=>(block.type==='cue' ? (block.cue.params.resource as {id?:string})?.id : undefined))
    .filter((id): id is string=>Boolean(id)));
  for(const id of ['background/office','background/detention-room','background/police-records','background/night-corridor']){
    assert.ok(backgrounds.has(id),id);
  }
});
