import test from 'node:test';
import assert from 'node:assert/strict';
import { preloadAssets, type PreloadProgress } from '../apps/editor/src/preview-preload.js';
import { collectSceneAssets, sceneAt } from '../apps/editor/src/preview-scene.js';
import { demoManifest, demoProject, demoShowcaseDocument } from '../examples/courtroom-demo-project/fixture.js';
import { courtroomAdapter } from '../packages/adapters/courtroom/src/index.js';
import { courtroomDemoPack } from '../content-packs/courtroom-demo/pack.js';
import { courtroomDemoResolver } from '../content-packs/courtroom-demo/presentation.js';
const presentation={packs:[courtroomDemoPack],resolver:courtroomDemoResolver};

test('preload deduplicates and reports settled assets with bounded concurrency',async()=>{
 let active=0,peak=0;const calls:string[]=[];const progress:PreloadProgress[]=[];
 const result=await preloadAssets(['a','b','a','c','d','e','f'],async url=>{
   calls.push(url);peak=Math.max(peak,++active);await Promise.resolve();active--;
   if(url==='e')throw new Error('network');return url!=='b';
 },p=>progress.push(p));
 assert.equal(calls.length,6);assert.ok(peak<=4);assert.deepEqual(result,{completed:6,total:6,failed:2});
 assert.deepEqual(progress.map(p=>p.completed),[0,1,2,3,4,5,6]);
});

test('closing preload stops queued work and suppresses late progress',async()=>{
 let closed=false;const releases:Array<()=>void>=[];const updates:PreloadProgress[]=[];
 const task=preloadAssets(['a','b','c','d','e'],()=>new Promise<boolean>(resolve=>releases.push(()=>resolve(true))),p=>updates.push(p),()=>closed);
 assert.equal(releases.length,4);closed=true;releases.forEach(fn=>fn());await task;
 assert.equal(releases.length,4);assert.equal(updates.length,1);
});

test('empty preload completes and collected showcase resources cover every render position',async()=>{
 assert.deepEqual(await preloadAssets([],async()=>{throw new Error('unexpected');},()=>{}),{completed:0,total:0,failed:0});
 const plan=courtroomAdapter.compile(demoShowcaseDocument,demoProject);
 const urls=collectSceneAssets(plan.instructions,demoManifest,presentation);assert.equal(urls.length,new Set(urls).size);
 for(let position=0;position<=plan.instructions.length;position++){
   for(const url of sceneAt(plan.instructions,position,demoManifest,presentation).urls)assert.ok(urls.includes(url),`unprepared ${url}`);
 }
});
