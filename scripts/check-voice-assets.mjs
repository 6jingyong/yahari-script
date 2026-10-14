import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {courtroomDemoPack} from '../dist/content-packs/courtroom-demo/pack.js';
const source=JSON.parse(readFileSync('content-packs/courtroom-demo/voice-clips.json','utf8'));
assert.equal(courtroomDemoPack.audio.voices.length,source.clips.length);const signatures=new Set();
for(const clip of source.clips){
  const bytes=readFileSync('content-packs/courtroom-demo/assets/'+clip.file),hash=createHash('sha256').update(bytes).digest('hex');assert.equal(hash,clip.sha256);assert.equal(bytes.length,clip.bytes);signatures.add(hash);
  const entry=courtroomDemoPack.audio.voices.find(v=>v.id===clip.id);assert.ok(entry);assert.equal(entry.clip.durationMs,clip.durationMs);assert.ok(clip.durationMs>100&&clip.durationMs<3000);assert.ok(courtroomDemoPack.characters.some(c=>c.id===clip.characterId));
  assert.deepEqual(Buffer.from(entry.clip.dataUrl.split(',')[1],'base64'),bytes);assert.ok(clip.sourceUrl.startsWith('https://www.court-records.net/sounds/'));
}
assert.equal(signatures.size,source.clips.length);console.log(`Voice assets passed: ${source.clips.length} distinct local Japanese callouts, hashes, provenance and portable bytes match.`);
