import type { ProjectManifest } from '../../packages/core/src/index.js';
import { courtroomDemoPack } from './pack.js';

/** Add a pack character without replacing aliases, existing cast or authored text. */
export function addDemoCharacter(manifest: ProjectManifest, characterId: string): ProjectManifest {
  const next = structuredClone(manifest);
  if (!next.contentPacks.some(pack => pack.id === courtroomDemoPack.id && pack.version === courtroomDemoPack.version)) return next;
  if (!courtroomDemoPack.characters.some(character => character.id === characterId)) return next;
  if (next.cast.some(cast => cast.characterRef.packId === courtroomDemoPack.id && cast.characterRef.id === characterId)) return next;
  let castId = characterId;
  for (let suffix = 2; next.cast.some(cast => cast.castId === castId); suffix++) castId = `${characterId}-${suffix}`;
  next.cast.push({castId, characterRef: {packId: courtroomDemoPack.id, id: characterId}});
  return next;
}

/** Keep the historical five-person demo stable even as the bindable material pack grows. */
export const defaultDemoCharacterIds = ['phoenix','edgeworth','maya','judge','witness'] as const;

/** Only the built-in sample is upgraded automatically; other projects opt in. */
export function completeDemoCast(manifest: ProjectManifest): ProjectManifest {
  if (manifest.projectId !== 'demo-courtroom') return structuredClone(manifest);
  return defaultDemoCharacterIds.reduce((next, characterId) => addDemoCharacter(next, characterId), manifest);
}
