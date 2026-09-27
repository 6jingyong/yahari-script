import type { PreviewTransientEffect } from './preview-effects.js';

export interface PreviewEffectTargets {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  flash: HTMLElement;
}

export function playPreviewEffects(
  targets: PreviewEffectTargets,
  effects: readonly PreviewTransientEffect[],
  reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
): void {
  const latest=new Map<PreviewTransientEffect['kind'],PreviewTransientEffect>();
  for(const effect of effects) latest.set(effect.kind,effect);

  const flash=latest.get('flash');
  if(flash?.kind==='flash'){
    const peak=reducedMotion?Math.min(0.18,flash.intensity):Math.min(0.92,0.25+flash.intensity*0.67);
    targets.flash.animate(
      [{opacity:0},{opacity:peak,offset:.28},{opacity:0}],
      {duration:reducedMotion?100:190,easing:'ease-out'},
    );
  }

  const shake=latest.get('shake');
  if(shake?.kind==='shake'&&!reducedMotion&&shake.intensity>0){
    const px=2+Math.round(shake.intensity*9);
    targets.stage.animate([
      {transform:'translate3d(0,0,0)'},
      {transform:`translate3d(-${px}px,${Math.round(px*.35)}px,0)`},
      {transform:`translate3d(${Math.round(px*.8)}px,-${Math.round(px*.5)}px,0)`},
      {transform:`translate3d(-${Math.round(px*.55)}px,${Math.round(px*.25)}px,0)`},
      {transform:`translate3d(${Math.round(px*.3)}px,0,0)`},
      {transform:'translate3d(0,0,0)'},
    ],{duration:shake.durationMs,easing:'linear'});
  }

  const focus=latest.get('focus');
  if(focus?.kind==='focus'){
    targets.canvas.animate(
      reducedMotion
        ? [{opacity:.72},{opacity:1}]
        : [{opacity:.35,transform:'scale(1.018)'},{opacity:1,transform:'scale(1)'}],
      {duration:reducedMotion?80:145,easing:'ease-out'},
    );
  }
}
