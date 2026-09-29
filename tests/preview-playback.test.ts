import test from 'node:test';
import assert from 'node:assert/strict';
import { PreviewPlayback, paragraphRanges } from '../apps/editor/src/preview-playback.js';
import type { CourtroomInstruction } from '../packages/adapters/courtroom/src/index.js';
function setup(commands:CourtroomInstruction[]){
 const jobs:Array<{fn:()=>void;delay:number;cancelled:boolean}>=[];
 const player=new PreviewPlayback(commands,{schedule(fn,delay){const job={fn,delay,cancelled:false};jobs.push(job);return()=>{job.cancelled=true;};}},()=>{});
 const tick=()=>{const job=jobs.shift();if(job&&!job.cancelled)job.fn();};
 const drain=()=>{let limit=1000;while(jobs.length&&limit-->0)tick();assert.ok(limit>0);};
 return {player,jobs,tick,drain};
}
test('paragraph boundaries preserve repeated speakers and leading scene cues',()=>{
 assert.deepEqual(paragraphRanges([{op:'flash'},{op:'speaker',castId:'a'},{op:'showText',text:'一'},{op:'speaker',castId:'a'},{op:'showText',text:'二'}]),[{start:0,end:3},{start:3,end:5}]);
 assert.deepEqual(paragraphRanges([]),[]);
});
test('text and inline actions play continuously without changing paragraphs',()=>{
 const {player,jobs,tick,drain}=setup([{op:'speaker',castId:'a'},{op:'showText',text:'你好'},{op:'pose',castId:'a',pose:'point'},{op:'showText',text:'世界'},{op:'speaker',castId:'b'},{op:'showText',text:'回答'}]);
 player.start();assert.equal(player.snapshot.partialText,'你');assert.equal(jobs[0].delay,35);
 tick();assert.equal(player.snapshot.partialText,'你好');tick();assert.equal(player.snapshot.position,3);assert.equal(player.snapshot.partialText,'世');
 drain();assert.equal(player.snapshot.position,4);assert.equal(player.snapshot.complete,true);assert.equal(player.snapshot.page,0);
 player.next();assert.equal(player.snapshot.page,1);assert.equal(player.snapshot.partialText,'回');
 player.dispose();
});
test('reveal, rewind, restart and close cancel pending updates',()=>{
 const {player,jobs,drain}=setup([{op:'speaker',castId:'a'},{op:'showText',text:'一二三'},{op:'speaker',castId:'b'},{op:'showText',text:'四五六'}]);
 player.start();const stale=jobs[0].fn;player.next();assert.equal(player.snapshot.position,2);stale();assert.equal(player.snapshot.position,2);
 player.next();assert.equal(player.snapshot.page,1);player.back();assert.equal(player.snapshot.page,0);assert.equal(player.snapshot.partialText,'一');
 player.start();assert.equal(player.snapshot.partialText,'一');player.dispose();const before=player.snapshot;drain();assert.deepEqual(player.snapshot,before);
});
test('graphemes stay whole and explicit waits retain their timing',()=>{
 const {player,jobs,tick,drain}=setup([{op:'speaker',castId:'a'},{op:'showText',text:'👨‍👩‍👧‍👦'},{op:'wait',mode:'time',durationMs:500},{op:'showText',text:'后'},{op:'wait',mode:'input'},{op:'showText',text:'续'}]);
 player.start();assert.equal(player.snapshot.partialText,'👨‍👩‍👧‍👦');tick();assert.equal(jobs[0].delay,500);tick();assert.equal(player.snapshot.partialText,'后');drain();assert.equal(player.snapshot.waiting,true);
 player.next();assert.equal(player.snapshot.partialText,'续');drain();assert.equal(player.snapshot.complete,true);
});

test('opening assets gate first text and cannot be bypassed by clicking next',async()=>{
 let release!:()=>void;const pending=new Promise<void>(resolve=>release=resolve);
 const positions:number[]=[];
 const player=new PreviewPlayback([{op:'speaker',castId:'a'},{op:'pose',castId:'a',pose:'point'},{op:'showText',text:'同步'}],{schedule(){return()=>{};}},()=>{},35,position=>{positions.push(position);return pending;});
 player.start();assert.equal(player.snapshot.loading,true);assert.equal(player.snapshot.partialText,'');assert.deepEqual(positions,[2]);
 player.next();assert.equal(player.snapshot.position,2);assert.equal(player.snapshot.partialText,'');
 release();await pending;await Promise.resolve();
 assert.equal(player.snapshot.loading,false);assert.equal(player.snapshot.partialText,'同');player.dispose();
});

test('late image completion cannot revive an old paragraph or a closed preview',async()=>{
 const releases:Array<()=>void>=[];
 const player=new PreviewPlayback([{op:'speaker',castId:'a'},{op:'showText',text:'甲'},{op:'speaker',castId:'b'},{op:'showText',text:'乙'}],{schedule(){return()=>{};}},()=>{},35,()=>new Promise<void>(resolve=>releases.push(resolve)));
 player.start();player.start(1);releases[0]();await Promise.resolve();
 assert.equal(player.snapshot.page,1);assert.equal(player.snapshot.loading,true);assert.equal(player.snapshot.partialText,'');
 releases[1]();await Promise.resolve();assert.equal(player.snapshot.partialText,'乙');
 player.start();player.dispose();const before=player.snapshot;releases[2]();await Promise.resolve();assert.deepEqual(player.snapshot,before);
});

test('inline pose waits for its own image and reveal-all also prepares the final scene',async()=>{
 let release!:()=>void;const pending=new Promise<void>(resolve=>release=resolve);
 const jobs:Array<()=>void>=[];const prepared:number[]=[];
 const player=new PreviewPlayback([{op:'speaker',castId:'a'},{op:'showText',text:'前'},{op:'reaction',castId:'a',reaction:'shocked'},{op:'showText',text:'后'}],{schedule(fn){jobs.push(fn);return()=>{};}},()=>{},35,position=>{prepared.push(position);if(position>=3)return pending;});
 player.start();assert.equal(player.snapshot.partialText,'前');jobs.shift()!();
 assert.equal(player.snapshot.position,3);assert.equal(player.snapshot.loading,true);assert.equal(player.snapshot.partialText,'');
 release();await pending;await Promise.resolve();assert.equal(player.snapshot.partialText,'后');player.dispose();
 let finish!:()=>void;const finalReady=new Promise<void>(resolve=>finish=resolve);
 const reveal=new PreviewPlayback([{op:'speaker',castId:'a'},{op:'showText',text:'台词'},{op:'pose',castId:'a',pose:'point'}],{schedule(){return()=>{};}},()=>{},35,position=>position===3?finalReady:undefined);
 reveal.start();reveal.next();assert.equal(reveal.snapshot.complete,false);assert.equal(reveal.snapshot.loading,true);
 finish();await finalReady;await Promise.resolve();assert.equal(reveal.snapshot.complete,true);reveal.dispose();
});

test('selected-page rehearsal starts at the chosen repeated-speaker line and clamps invalid indices',()=>{
 const {player,drain}=setup([{op:'background',resource:{packId:'p',id:'room'}},{op:'speaker',castId:'a'},{op:'showText',text:'第一句'},{op:'speaker',castId:'a'},{op:'showText',text:'第二句'}]);
 player.start(1);assert.equal(player.snapshot.page,1);assert.equal(player.snapshot.partialText,'第');drain();assert.equal(player.snapshot.position,5);
 player.start(1);assert.equal(player.snapshot.complete,false);assert.equal(player.snapshot.position,4);
 player.start(999);assert.equal(player.snapshot.page,1);
 player.start(-1);assert.equal(player.snapshot.page,0);
 player.start(Number.NaN);assert.equal(player.snapshot.page,0);player.dispose();
});
