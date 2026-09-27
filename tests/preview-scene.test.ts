import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneAt } from '../apps/editor/src/preview-scene.js';
import { demoManifest } from '../examples/courtroom-demo-project/fixture.js';
import type { CourtroomInstruction } from '../packages/adapters/courtroom/src/index.js';
import { courtroomDemoPack } from '../content-packs/courtroom-demo/pack.js';
import { courtroomDemoResolver } from '../content-packs/courtroom-demo/presentation.js';
const presentation={packs:[courtroomDemoPack],resolver:courtroomDemoResolver};

test('each dialogue binds its actor and default pose, with leading action override',()=>{
 const commands:CourtroomInstruction[]=[{op:'speaker',castId:'phoenix'},{op:'reaction',castId:'phoenix',reaction:'shocked'},{op:'showText',text:'啊'},{op:'speaker',castId:'phoenix'},{op:'showText',text:'重新开口'},{op:'speaker',castId:'edgeworth'},{op:'pose',castId:'edgeworth',pose:'point'},{op:'showText',text:'异议'}];
 assert.equal(sceneAt(commands,2,demoManifest,presentation).pose,'shocked');
 assert.equal(sceneAt(commands,4,demoManifest,presentation).pose,'normal');
 const opening=sceneAt(commands,7,demoManifest,presentation);assert.equal(opening.camera,'edgeworth');assert.equal(opening.pose,'point');assert.ok(opening.visual.backdrop?.endsWith('prosecution.png'));assert.equal(opening.urls.length,3);
 assert.equal(sceneAt(commands,4,demoManifest,presentation).pose,'normal'); // Rewind is deterministic.
});

test('explicit location and camera override defaults; later actions stay in sequence',()=>{
 const commands:CourtroomInstruction[]=[{op:'background',resource:{packId:'official.courtroom-demo',id:'background/lobby'}},{op:'speaker',castId:'maya'},{op:'focus',castId:'witness'},{op:'showText',text:'你看'},{op:'reaction',castId:'witness',reaction:'shocked'},{op:'showText',text:'啊'},{op:'speaker',castId:'maya'}];
 const opening=sceneAt(commands,3,demoManifest,presentation);assert.equal(opening.speaker,'maya');assert.equal(opening.camera,'witness');assert.equal(opening.pose,'normal');assert.ok(opening.visual.backdrop?.endsWith('lobby.png'));assert.equal(opening.visual.foreground,undefined);
 assert.equal(sceneAt(commands,5,demoManifest,presentation).pose,'shocked');
 const next=sceneAt(commands,7,demoManifest,presentation);assert.equal(next.camera,'maya');assert.equal(next.pose,'normal');assert.ok(next.visual.backdrop?.endsWith('lobby.png'));
});
