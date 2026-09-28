import test from 'node:test';
import assert from 'node:assert/strict';
import { createSampleStory, normalizeSampleCast, sampleStories } from '../examples/courtroom-demo-project/story-cases.js';
import { courtroomAdapter } from '../packages/adapters/courtroom/src/index.js';
import { courtroomDemoPack } from '../content-packs/courtroom-demo/pack.js';
import { decodeProjectFile } from '../packages/core/src/index.js';

test('only one long built-in case remains and it round-trips as a playable project',()=>{
  assert.equal(sampleStories.length,1);
  const sample=sampleStories[0];
  assert.equal(sample.id,'farewell-final-objection');
  assert.ok(sample.scenes>=8);
  const file=createSampleStory(sample.id,'verify-farewell');
  const decoded=decodeProjectFile(JSON.parse(JSON.stringify(file)),{
    adapters:[{id:'official.courtroom',version:'0.1.0'}],
    contentPacks:[{id:courtroomDemoPack.id,version:courtroomDemoPack.version}],
  });
  assert.equal(decoded.ok&&decoded.kind==='project',true);
  assert.equal(file.manifest.narrative?.chapters.length,sample.chapters);
  assert.equal(file.documents.length,sample.scenes);
  assert.deepEqual(file.manifest.narrative?.chapters.flatMap(chapter=>chapter.documentIds),file.documents.map(doc=>doc.documentId));
  assert.deepEqual(file.manifest.cast.map(person=>person.castId),[
    'phoenix','edgeworth','maya','mia','judge','von-karma','gumshoe','lotta','yogi','witness'
  ]);
  for(const doc of file.documents){
    assert.ok(doc.summary);
    assert.ok(doc.blocks.some(block=>block.type==='dialogue'));
    const context={manifest:file.manifest,contentPacks:[courtroomDemoPack]};
    assert.deepEqual(courtroomAdapter.validate(doc,context).filter(issue=>issue.severity==='error'),[],doc.title);
    assert.ok(courtroomAdapter.compile(doc,context).instructions.length>5);
  }
});

test('long case covers all new locations, characters and presentation stress tokens',()=>{
  const file=createSampleStory(sampleStories[0].id,'sample-materials');
  const backgrounds=new Set(file.documents.flatMap(doc=>doc.blocks)
    .filter(block=>block.type==='cue'&&block.cue.type==='courtroom.background')
    .map(block=>(block.type==='cue'?(block.cue.params.resource as {id?:string})?.id:undefined))
    .filter((id):id is string=>Boolean(id)));
  for(const id of ['background/lake-dock','background/evidence-room','background/prosecutor-office','background/elevator-hall','background/courtroom','background/witness-stand']){
    assert.ok(backgrounds.has(id),id);
  }
  const tokenTypes=new Set(file.documents.flatMap(doc=>doc.blocks).flatMap(block=>{
    if(block.type==='cue')return [block.cue.type];
    return block.content.filter(node=>node.type==='token').map(node=>node.type==='token'?node.token.type:'');
  }));
  for(const type of ['courtroom.pose','courtroom.reaction','courtroom.focus','courtroom.emphasis','courtroom.flash','courtroom.shake','courtroom.wait','courtroom.sfx','courtroom.bgm']){
    assert.ok(tokenTypes.has(type),type);
  }
  const serialized=JSON.stringify(file.documents);
  for(const id of ['audio/bgm/investigation','audio/bgm/resolution','audio/sfx/camera','audio/sfx/evidence-presented','audio/sfx/truth-reveal']){
    assert.ok(serialized.includes(`"id":"${id}"`),id);
  }
  for(const id of ['von-karma','gumshoe','lotta','yogi','mia']){
    assert.ok(file.manifest.cast.some(person=>person.characterRef.id===id),id);
  }
  const lineCount=file.documents.reduce((sum,doc)=>sum+doc.blocks.filter(block=>block.type==='dialogue').length,0);
  assert.ok(lineCount>=100,`expected long stress case, got ${lineCount} dialogue blocks`);
});

test('sample aliases normalize to current material labels without touching authored documents',()=>{
  const file=createSampleStory(sampleStories[0].id,'sample-default');
  file.manifest.cast[0].displayName='林律师';
  const before=JSON.stringify(file.documents);
  const fixed=normalizeSampleCast(file.manifest);
  assert.equal(fixed.cast[0].displayName,'成步堂');
  assert.equal(fixed.cast[0].castId,file.manifest.cast[0].castId);
  assert.equal(file.manifest.cast[0].displayName,'林律师');
  assert.equal(JSON.stringify(file.documents),before);
});
