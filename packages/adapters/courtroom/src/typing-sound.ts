import type { DialogueBlock, ProjectContext, ResourceRef } from '../../../core/src/index.js';
import type { CourtroomContentPack, CourtroomNamedResource } from './types.js';

/** undefined inherits; null deliberately silences the typewriter. */
export type TypingSoundSetting = ResourceRef | null | undefined;
export function readTypingSound(value:unknown):TypingSoundSetting {
  if(value===null)return null;
  if(value&&typeof value==='object'&&typeof (value as ResourceRef).packId==='string'&&typeof (value as ResourceRef).id==='string')return {packId:(value as ResourceRef).packId,id:(value as ResourceRef).id};
  return undefined;
}
export function typingSounds(packs:readonly CourtroomContentPack[]):CourtroomNamedResource[] {
  return packs.flatMap(pack=>pack.audio.sfx).filter(item=>{
    const cue=item.previewAudio;
    return cue&&!cue.loopMs&&cue.notes.length>0&&cue.notes.every(n=>(n.offsetMs??0)+n.durationMs<=80);
  });
}
export function defaultTypingSound(packs:readonly CourtroomContentPack[]):ResourceRef|null {
  const sounds=typingSounds(packs);
  return (sounds.find(s=>s.id==='text-low')??sounds.find(s=>s.id.startsWith('text-'))??sounds[0])?.resource??null;
}
export function dialogueTypingSound(block:DialogueBlock,project:ProjectContext<CourtroomContentPack>):ResourceRef|null {
  const member=project.manifest.cast.find(c=>c.castId===block.speaker?.castId);
  for(const value of [block.metadata?.typingSound,member?.overrides?.typingSound,project.manifest.projectSettings?.typingSound]){
    const setting=readTypingSound(value);if(setting!==undefined)return setting;
  }
  return defaultTypingSound(project.contentPacks);
}
export function typingSoundValid(value:unknown,packs:readonly CourtroomContentPack[]):boolean {
  if(value===undefined||value===null)return true;
  const ref=readTypingSound(value);
  return !!ref&&typingSounds(packs).some(s=>s.resource.packId===ref.packId&&s.resource.id===ref.id);
}
