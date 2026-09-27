import type { CourtroomInstruction } from '../../../packages/adapters/courtroom/src/index.js';
import type { ProjectManifest, ResourceRef } from '../../../packages/core/src/index.js';
import { resolveCourtroomVisual, type CourtroomPresentationContext } from './preview-visuals.js';

/** A dialogue starts from its bound actor's default; leading actions override it.
 * Explicit scene cues persist, while transient poses do not leak into the next line. */
export function sceneAt(
  instructions: readonly CourtroomInstruction[],
  position: number,
  manifest: ProjectManifest,
  presentation: CourtroomPresentationContext,
) {
  let speaker: string|null=null, camera: string|null=null;
  let background: ResourceRef|undefined;
  const characters = new Map<string,string>();
  for (const command of instructions.slice(0,position)) {
    if (command.op==='speaker') {speaker=command.castId;camera=speaker;characters.clear();}
    else if (command.op==='pose') characters.set(command.castId,command.pose);
    else if (command.op==='reaction') characters.set(command.castId,command.reaction);
    else if (command.op==='focus') camera=command.castId;
    else if (command.op==='background') background=command.resource;
  }
  const characterRef=manifest.cast.find(c=>c.castId===camera)?.characterRef;
  const pose=camera?characters.get(camera)??'normal':'normal';
  const visual=resolveCourtroomVisual(presentation,characterRef,pose,background);
  const urls=[visual.backdrop,visual.sprite,visual.foreground].filter((url):url is string=>!!url);
  return {speaker,camera,characters,pose,visual,urls};
}

/** All local resources that this plan can display, including defaults used on rewind. */
export function collectSceneAssets(
  instructions:readonly CourtroomInstruction[],
  manifest:ProjectManifest,
  presentation:CourtroomPresentationContext,
):string[] {
  const urls=new Set<string>();
  const add=(castId:string|null,pose='normal',background?:ResourceRef)=>{
    const characterRef=manifest.cast.find(c=>c.castId===castId)?.characterRef;
    const visual=resolveCourtroomVisual(presentation,characterRef,pose,background);
    for(const url of [visual.backdrop,visual.sprite,visual.foreground])if(url)urls.add(url);
  };
  add(null);
  for(const command of instructions){
    if(command.op==='speaker'||command.op==='focus')add(command.castId);
    else if(command.op==='pose')add(command.castId,command.pose);
    else if(command.op==='reaction')add(command.castId,command.reaction);
    else if(command.op==='background')add(null,'normal',command.resource);
  }
  return [...urls];
}
