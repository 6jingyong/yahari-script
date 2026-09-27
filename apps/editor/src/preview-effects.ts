import type { CourtroomInstruction } from '../../../packages/adapters/courtroom/src/index.js';

export interface PreviewPresentationState {
  emphasis: string | null;
}

export type PreviewTransientEffect =
  | { kind: 'flash'; intensity: number }
  | { kind: 'shake'; intensity: number; durationMs: number }
  | { kind: 'focus'; castId: string };

const finite = (value:number|undefined, fallback:number):number =>
  Number.isFinite(value) ? Number(value) : fallback;

export function presentationStateAt(
  instructions: readonly CourtroomInstruction[],
  position: number,
): PreviewPresentationState {
  let emphasis:string|null=null;
  for(const command of instructions.slice(0,Math.max(0,position))){
    if(command.op==='speaker') emphasis=null;
    else if(command.op==='emphasis') emphasis=command.mode || 'strong';
  }
  return {emphasis};
}

/**
 * Presentation effects are edge-triggered. Re-rendering the same playback
 * position must not replay them, while reveal-all may cross several at once.
 */
export function transientEffectsBetween(
  instructions: readonly CourtroomInstruction[],
  fromPosition: number,
  toPosition: number,
): PreviewTransientEffect[] {
  if(toPosition<=fromPosition)return [];
  const effects:PreviewTransientEffect[]=[];
  for(const command of instructions.slice(Math.max(0,fromPosition),Math.max(0,toPosition))){
    if(command.op==='flash'){
      effects.push({kind:'flash',intensity:Math.min(1,Math.max(0,finite(command.intensity,0.65)))});
    }else if(command.op==='shake'){
      effects.push({
        kind:'shake',
        intensity:Math.min(1,Math.max(0,finite(command.intensity,0.55))),
        durationMs:Math.min(2000,Math.max(80,finite(command.durationMs,360))),
      });
    }else if(command.op==='focus'){
      effects.push({kind:'focus',castId:command.castId});
    }
  }
  return effects;
}
