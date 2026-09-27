import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { courtroomDemoPack as pack } from '../dist/content-packs/courtroom-demo/pack.js';
import { courtroomDemoResources } from '../dist/content-packs/courtroom-demo/generated.js';
import { courtroomDemoResolver } from '../dist/content-packs/courtroom-demo/presentation.js';
import { resolveCourtroomVisual } from '../dist/apps/editor/src/preview-visuals.js';

const provenance = JSON.parse(readFileSync('content-packs/courtroom-demo/assets/sources.json','utf8'));
const sources = new Map(provenance.assets.map(asset=>[asset.file,asset]));
const presentation={packs:[pack],resolver:courtroomDemoResolver};
let actions = 0;

for (const character of pack.characters) {
  const characterRef={packId:pack.id,id:character.id};
  for (const action of [...character.poses,...character.reactions]) {
    const visual = resolveCourtroomVisual(presentation,characterRef,action.id);
    assert.ok(visual.sprite,`Unmapped art: ${character.id}/${action.id}`);
    assert.ok(visual.backdrop,`Missing stage: ${character.id}`);
    actions++;
  }
}

for (const scene of pack.backgrounds) {
  const visual = resolveCourtroomVisual(presentation,{packId:pack.id,id:'witness'},'normal',scene.resource);
  assert.ok(visual.supported && visual.backdrop,`Unmapped scene: ${scene.id}`);
}

const uniqueFiles=new Map();
for(const descriptor of Object.values(courtroomDemoResources.resources)) uniqueFiles.set(descriptor.url,descriptor);

for(const [url,descriptor] of uniqueFiles) {
  const assetPrefix='../../content-packs/courtroom-demo/assets/';
  assert.ok(url.startsWith(assetPrefix),`Non-local asset: ${url}`);
  const file=url.slice(assetPrefix.length);
  const localPath='content-packs/courtroom-demo/assets/'+file;
  assert.ok(existsSync(localPath),`Missing file: ${url}`);
  const bytes=readFileSync(localPath), source=sources.get(file);
  assert.ok(source,`Missing provenance: ${url}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256,`Asset hash mismatch: ${url}`);
  const png=bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a';
  const gif=bytes.subarray(0,3).toString()==='GIF';
  const svg=bytes.subarray(0,256).toString('utf8').includes('<svg');
  assert.ok(png||gif||svg,`Not a supported image: ${url}`);
  let width,height;
  if(png){width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);}
  else if(gif){width=bytes.readUInt16LE(6);height=bytes.readUInt16LE(8);}
  else {
    const text=bytes.toString('utf8');
    width=Number(text.match(/<svg[^>]*\bwidth="([0-9.]+)"/)?.[1]);
    height=Number(text.match(/<svg[^>]*\bheight="([0-9.]+)"/)?.[1]);
    assert.ok(width>0&&height>0,`SVG dimensions missing: ${url}`);
  }
  const [x,y,w,h]=descriptor.frame??[0,0,256,192];
  assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=width&&y+h<=height,`Invalid frame crop: ${url}`);
}
console.log(`Content assets passed: ${pack.characters.length} characters, ${actions} actions, ${pack.backgrounds.length} scenes, ${uniqueFiles.size} local images with valid crops and hashes.`);
