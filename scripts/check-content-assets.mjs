import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { courtroomDemoPack as pack } from '../dist/content-packs/courtroom-demo/pack.js';
import { courtroomVisuals as visuals } from '../dist/content-packs/courtroom-demo/visuals.js';
import { resolveCourtroomVisual } from '../dist/apps/editor/src/preview-visuals.js';
const provenance = JSON.parse(readFileSync('content-packs/courtroom-demo/assets/sources.json','utf8'));
const sources = new Map(provenance.assets.map(asset=>[asset.file,asset]));
let actions = 0;
const urls = new Set();
for (const character of pack.characters) {
  for (const action of [...character.poses,...character.reactions]) {
    const visual = resolveCourtroomVisual(character.id,action.id);
    assert.ok(visual.sprite,`Unmapped art: ${character.id}/${action.id}`);
    assert.ok(visual.backdrop,`Missing stage: ${character.id}`);
    for (const url of [visual.sprite,visual.backdrop,visual.foreground]) if(url) urls.add(url);
    actions++;
  }
}
for (const scene of pack.backgrounds) {
  const visual = resolveCourtroomVisual('witness','normal',scene.resource);
  assert.ok(visual.supported && visual.backdrop,`Unmapped scene: ${scene.id}`);
  urls.add(visual.backdrop);
}
for(const url of urls) {
  assert.ok(url.startsWith('/content-packs/courtroom-demo/assets/'),`Non-local asset: ${url}`);
  assert.ok(existsSync('.'+url),`Missing file: ${url}`);
  const bytes=readFileSync('.'+url), source=sources.get(url.split('/').at(-1));
  assert.ok(source,`Missing provenance: ${url}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256,`Asset hash mismatch: ${url}`);
  const png=bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a';
  const gif=bytes.subarray(0,3).toString()==='GIF';
  assert.ok(png||gif,`Not a supported image: ${url}`);
  const width=png?bytes.readUInt32BE(16):bytes.readUInt16LE(6),height=png?bytes.readUInt32BE(20):bytes.readUInt16LE(8);
  const [x,y,w,h]=visuals.frames[url]??[0,0,256,192];
  assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=width&&y+h<=height,`Invalid frame crop: ${url}`);
}
console.log(`Content assets passed: ${pack.characters.length} characters, ${actions} actions, ${pack.backgrounds.length} scenes, ${urls.size} local images with valid crops and hashes.`);
