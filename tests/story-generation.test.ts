import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDetectedOutline, validateOutline, buildScene, generatedManifest, requestJson } from '../packages/story-ai/src/generation.js';
import { courtroomDemoPack as pack } from '../content-packs/courtroom-demo/pack.js';
import { demoManifest } from '../examples/courtroom-demo-project/fixture.js';
import { courtroomAdapter } from '../packages/adapters/courtroom/src/index.js';
import { createProjectFile, decodeProjectFile } from '../packages/core/src/index.js';
const fixture={title:'消失的信',summary:'一封信让朋友重逢。',cast:[{id:'lin',name:'小林',characterId:'phoenix'}],chapters:[{title:'失物',summary:'发现信件。',scenes:[{title:'候审室',summary:'小林发现一封旧信。',background:'lobby'},{title:'重逢',summary:'小林说出信的真相。',background:'courtroom'}]}]};
const catalog={adapters:[{id:'official.courtroom',version:'0.1.0'}],contentPacks:[{id:pack.id,version:pack.version}]};
const lines={lines:[{speaker:'lin',text:'这封信一直都在。',pose:'think',reaction:null},{speaker:null,text:'他把信放在桌上。',pose:null,reaction:null}]};
test('two generated scenes preserve chapter order, aliases, summaries and playable actions through export/import',()=>{
 const outline=validateOutline(fixture,pack);const docs=[0,1].map(i=>buildScene(lines,outline,0,i,pack,'test'));
 const manifest=generatedManifest(demoManifest,outline,docs,'test');
 for(const doc of docs){assert.equal(courtroomAdapter.validate(doc,{manifest,contentPacks:[pack]}).filter(d=>d.severity==='error').length,0);assert.ok(courtroomAdapter.compile(doc,{manifest,contentPacks:[pack]}));}
 const file=createProjectFile(manifest,docs);const decoded=decodeProjectFile(JSON.parse(JSON.stringify(file)),catalog);
 assert.equal(decoded.ok,true);assert.deepEqual(decoded.ok&&decoded.kind==='project'&&decoded.project,file);
 assert.deepEqual(manifest.narrative?.chapters[0].documentIds,docs.map(d=>d.documentId));assert.equal(manifest.cast[0].displayName,'小林');
});
test('unknown actors and unavailable motions are rejected before document creation',()=>{
 const o=validateOutline(fixture,pack);
 assert.throws(()=>buildScene({lines:[{speaker:'unknown',text:'x'}]},o,0,0,pack,'t'),/人物不存在/);
 assert.throws(()=>buildScene({lines:[{speaker:'lin',text:'x',pose:'flying'}]},o,0,0,pack,'t'),/动作不可用/);
 assert.throws(()=>buildScene({lines:[{speaker:null,text:'x',pose:'normal'}]},o,0,0,pack,'t'),/动作不可用/);
 const bad=structuredClone(fixture);bad.cast.push({...bad.cast[0]});assert.throws(()=>validateOutline(bad,pack),/重复/);
});
test('detected story characters stay unbound even when a model proposes a preset',()=>{
 const detected=validateDetectedOutline(fixture,pack);
 assert.deepEqual(detected.cast,[{id:'lin',name:'小林',characterId:''}]);
 assert.throws(()=>validateOutline(detected,pack),/角色素材|绑定/);
 detected.cast[0].characterId='maya';
 assert.equal(validateOutline(detected,pack).cast[0].characterId,'maya');
});
test('invalid chapter references do not enter existing projects',()=>{
 const o=validateOutline(fixture,pack);const docs=[0,1].map(i=>buildScene(lines,o,0,i,pack,'t'));const m=generatedManifest(demoManifest,o,docs,'t');
 m.narrative!.chapters[0].documentIds.push('missing');assert.equal(decodeProjectFile(createProjectFile(m,docs),catalog).ok,false);
 m.narrative!.chapters[0].documentIds=['t-c1-s1','t-c1-s1'];assert.equal(decodeProjectFile(createProjectFile(m,docs),catalog).ok,false);
});
test('compatible request uses intended endpoint and keeps credential out of body',async()=>{
 let seenUrl='';let body='';let auth='';
 const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{seenUrl=String(input);body=String(init?.body);auth=new Headers(init?.headers).get('Authorization')??'';return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(fixture)}}]}));}) as typeof fetch;
 const output=await requestJson({baseUrl:'https://openrouter.ai/api/v1/',model:'test/model',apiKey:'secret-test',jsonMode:true},'system','story',new AbortController().signal,fetcher);
 assert.equal(seenUrl,'https://openrouter.ai/api/v1/chat/completions');assert.equal(auth,'Bearer secret-test');assert.equal(body.includes('secret-test'),false);assert.deepEqual(output,fixture);
});
test('truncated and failed responses produce actionable errors without disclosing provider content',async()=>{
 for(const response of [new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{}'}}]})),new Response('secret-test',{status:401})]){
  let message='';try{await requestJson({baseUrl:'https://api.openai.com/v1',model:'test',apiKey:'secret-test',jsonMode:false},'s','u',new AbortController().signal,async()=>response);}catch(e){message=String(e)}
  assert.ok(message.includes('截断')||message.includes('401'));assert.equal(message.includes('secret-test'),false);
 }
});
