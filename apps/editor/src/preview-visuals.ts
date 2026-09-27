import type { ResourceRef } from '../../../packages/core/src/index.js';
import type { CourtroomContentPack } from '../../../packages/adapters/courtroom/src/index.js';
import type { ResourceResolver } from '../../../packages/presentation/src/index.js';
import { sameResource } from '../../../packages/presentation/src/index.js';

export interface CourtroomPresentationContext {
  packs: readonly CourtroomContentPack[];
  resolver: ResourceResolver;
}

function packFor(context: CourtroomPresentationContext, packId: string | undefined): CourtroomContentPack | undefined {
  return packId ? context.packs.find(pack => pack.id === packId) : undefined;
}

export function courtroomBackgroundLabel(context: CourtroomPresentationContext, resource: ResourceRef): string | undefined {
  return packFor(context, resource.packId)?.backgrounds.find(item => sameResource(item.resource, resource))?.label;
}

export function courtroomActionLabel(
  context: CourtroomPresentationContext,
  characterRef: ResourceRef | undefined,
  actionId: string,
): string | undefined {
  const character=characterRef ? packFor(context,characterRef.packId)?.characters.find(item=>item.id===characterRef.id) : undefined;
  return character
    ? [...character.poses,...character.reactions].find(item=>item.id===actionId)?.label
    : undefined;
}

/** Resolve Courtroom presentation through pack declarations and ResourceRef, never pack-specific file tables. */
export function resolveCourtroomVisual(
  context: CourtroomPresentationContext,
  characterRef: ResourceRef | undefined,
  pose: string,
  background?: ResourceRef,
) {
  const characterPack = packFor(context, characterRef?.packId);
  const character = characterRef ? characterPack?.characters.find(item => item.id === characterRef.id) : undefined;
  const scenePack = packFor(context, background?.packId) ?? characterPack ?? context.packs[0];
  const activeBackground = background ?? scenePack?.stageScene;
  const backgroundDefinition = activeBackground
    ? packFor(context, activeBackground.packId)?.backgrounds.find(item => sameResource(item.resource, activeBackground))
    : undefined;
  const automaticStage = !!scenePack && sameResource(activeBackground, scenePack.stageScene);

  const backdropRef = automaticStage && character?.stage.background
    ? character.stage.background
    : activeBackground;
  const foregroundRef = automaticStage
    ? character?.stage.foreground
    : backgroundDefinition?.foreground;

  const action = character
    ? [...character.poses, ...character.reactions].find(item => item.id === pose)
    : undefined;
  const spriteRef = action?.asset ?? (pose === 'normal' ? character?.portraits.base : undefined);

  const backdrop = backdropRef ? context.resolver.resolve(backdropRef) : undefined;
  const foreground = foregroundRef ? context.resolver.resolve(foregroundRef) : undefined;
  const sprite = spriteRef ? context.resolver.resolve(spriteRef) : undefined;
  const supported = !background || Boolean(backgroundDefinition && backdrop);

  return {
    supported,
    backdrop: backdrop?.url,
    foreground: foreground?.url,
    sprite: sprite?.url,
    frame: sprite?.frame,
  };
}
