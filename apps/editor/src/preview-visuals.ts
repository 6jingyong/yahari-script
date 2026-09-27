import type { ResourceRef } from '../../../packages/core/src/index.js';
import { courtroomVisuals as visuals } from '../../../content-packs/courtroom-demo/visuals.js';

/** Resolve only presentation resources; no authoring semantics live here. */
export function resolveCourtroomVisual(character: string | undefined, pose: string, background?: ResourceRef) {
  const supported = !background || (background.packId === 'official.courtroom-demo' && background.id in visuals.scenes);
  const scene = supported ? (background?.id ?? 'background/courtroom') : undefined;
  const stage = character ? visuals.stages[character] : undefined;
  const automaticStage = scene === 'background/courtroom';
  const backdrop = !scene ? undefined : automaticStage ? stage?.background ?? visuals.scenes[scene] : visuals.scenes[scene];
  const foreground = automaticStage ? stage?.foreground : scene === 'background/witness-stand' ? visuals.stages.witness?.foreground : undefined;
  const sprite = character ? visuals.characters[character]?.[pose] : undefined;
  return {supported, backdrop, foreground, sprite, frame: sprite ? visuals.frames[sprite] : undefined};
}
