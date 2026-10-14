import type {ProjectContext,ResourceRef,TypedToken} from '../../../core/src/index.js';
import type {CourtroomContentPack} from './types.js';
import {readTypingSound} from './typing-sound.js';

export function actionKey(token:TypedToken):string|undefined {
  return token.type==='courtroom.pose'?`pose:${token.params.pose}`:token.type==='courtroom.reaction'?`reaction:${token.params.reaction}`:undefined;
}
export function actionCastId(token:TypedToken,speakerId:string|null):string|null {
  return token.subject?.kind==='cast'?token.subject.id:!token.subject||token.subject.kind==='speaker'?speakerId:null;
}
export function actionSounds(packs:readonly CourtroomContentPack[]) {
  return packs.flatMap(pack=>[...(pack.audio.voices??[]),...pack.audio.sfx]);
}
export function validActionSound(value:unknown,packs:readonly CourtroomContentPack[]):boolean {
  if(value===undefined||value===null)return true;const ref=readTypingSound(value);
  return !!ref&&actionSounds(packs).some(item=>item.resource.packId===ref.packId&&item.resource.id===ref.id);
}
export function defaultActionSound(token:TypedToken,speakerId:string|null,project:ProjectContext<CourtroomContentPack>):ResourceRef|null {
  const key=actionKey(token);if(!key)return null;
  const member=project.manifest.cast.find(c=>c.castId===actionCastId(token,speakerId));
  const settings=member?.overrides?.actionSounds as Record<string,unknown>|undefined;
  const setting=readTypingSound(settings?.[key]);if(setting!==undefined)return setting;
  const pack=project.contentPacks.find(p=>p.id===member?.characterRef.packId);
  if(key==='pose:objection'){
    const voice=pack?.audio.voices?.find(v=>v.characterId===member?.characterRef.id&&v.call==='objection'&&v.language==='ja');
    if(voice)return voice.resource;
    return pack?.audio.sfx.find(s=>s.id==='objection')?.resource??null;
  }
  if(key==='pose:desk')return pack?.audio.sfx.find(s=>s.id==='desk-slam')?.resource??null;
  return null;
}
export function actionSound(token:TypedToken,speakerId:string|null,project:ProjectContext<CourtroomContentPack>):ResourceRef|null {
  return readTypingSound(token.metadata?.sound)??(token.metadata?.sound===null?null:defaultActionSound(token,speakerId,project));
}
export function actionSoundInstructions(token:TypedToken,speakerId:string|null,project:ProjectContext<CourtroomContentPack>) {
  const ref=actionSound(token,speakerId,project);if(!ref)return [];
  return [{op:'sfx' as const,resource:ref,boundAction:true},...recordedSoundWait(ref,project)];
}
export function recordedSoundWait(ref:ResourceRef,project:ProjectContext<CourtroomContentPack>) {
  const clip=project.contentPacks.flatMap(p=>p.audio.voices??[]).find(v=>v.resource.packId===ref.packId&&v.resource.id===ref.id);
  return clip?[{op:'wait' as const,mode:'time' as const,durationMs:clip.clip.durationMs,reason:'voice' as const}]:[];
}
