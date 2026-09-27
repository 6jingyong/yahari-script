import type { ResourceRef, ScriptDocument, TypedToken } from '../../../packages/core/src/index.js';

export function sceneBackgroundRef(document: ScriptDocument): ResourceRef | undefined {
  for (const block of document.blocks) {
    if (block.type !== 'cue' || block.cue.type !== 'courtroom.background') continue;
    const resource=block.cue.params.resource;
    if(resource && typeof resource==='object' && 'packId' in resource && 'id' in resource){
      return structuredClone(resource as ResourceRef);
    }
  }
  return undefined;
}

/**
 * Background is authored as a Scene property but remains a leading CueBlock in
 * the portable 0.7 document format. All legacy background cues are normalized
 * to exactly one managed leading cue.
 */
export function withSceneBackground(
  document: ScriptDocument,
  resource: ResourceRef,
): ScriptDocument {
  const next=structuredClone(document);
  const existing=next.blocks.find(block=>block.type==='cue'&&block.cue.type==='courtroom.background');
  const cue:TypedToken={
    id:existing?.type==='cue'?existing.cue.id:`scene-background-${next.documentId}`,
    type:'courtroom.background',
    params:{resource:structuredClone(resource)},
  };
  next.blocks=next.blocks.filter(block=>!(block.type==='cue'&&block.cue.type==='courtroom.background'));
  next.blocks.unshift({id:existing?.id??`scene-background-block-${next.documentId}`,type:'cue',cue});
  return next;
}
