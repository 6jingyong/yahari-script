import { preloadAssets } from './preview-preload.js';
import { collectSceneAssets, sceneAt } from './preview-scene.js';
import { PreviewPlayback, type PlaybackSnapshot } from './preview-playback.js';
import type { CourtroomPerformancePlan } from '../../../packages/adapters/courtroom/src/index.js';
import type { ProjectContext } from '../../../packages/core/src/index.js';
import type { CourtroomContentPack } from '../../../packages/adapters/courtroom/src/index.js';
import type { ResourceResolver } from '../../../packages/presentation/src/index.js';
import { courtroomActionLabel, courtroomBackgroundLabel, type CourtroomPresentationContext } from './preview-visuals.js';
import { presentationStateAt, transientEffectsBetween } from './preview-effects.js';
import { playPreviewEffects } from './preview-effect-player.js';
import { PreviewSynthAudio, previewBgmAt, previewSfxBetween, previewTypingSoundAt, resolvePreviewAudio } from './preview-audio.js';

const STAGE_WIDTH=768, STAGE_HEIGHT=576;
// Keep decoded images for later rehearsals without copying every large image
// into a second canvas. Only legacy magenta-key art needs pixel conversion.
const decodedAssets=new Map<string,HTMLImageElement|HTMLCanvasElement>();

export function openPreview(
  plan: CourtroomPerformancePlan,
  name: (id: string|null)=>string,
  project: ProjectContext<CourtroomContentPack>,
  resolver: ResourceResolver,
  options: {startPage?:number; startCompleted?:boolean; onPage?:(page:number)=>void; onEdit?:(page:number)=>void; title?:string; playing?:boolean; onComplete?:()=>void; onClose?:()=>void;
    choices?:{prompt:string;options:Array<{id:string;label:string}>;onSelect:(id:string)=>void};onChoiceState?:(visible:boolean)=>void;
    audioEnabled?:boolean;onAudioChange?:(enabled:boolean)=>void} = {},
): void {
  const manifest=project.manifest;
  const presentation:CourtroomPresentationContext={packs:project.contentPacks,resolver};
  const rehearsalAudio=new PreviewSynthAudio(project.contentPacks);
  const dialog = document.createElement('dialog');
  dialog.className = 'performance-preview';
  dialog.setAttribute('aria-labelledby','preview-title');
  dialog.innerHTML = `<header><strong id="preview-title">演出排练</strong><span class="preview-header-actions"><button data-audio aria-pressed="false">声音：关</button><button data-close>关闭</button></span></header>

    <section class="preview-preload" aria-labelledby="preload-title">
      <h2 id="preload-title">正在准备整段排练</h2>
      <progress max="1" value="0" aria-label="排练图像预加载进度"></progress>
      <p data-load-status role="status" aria-live="polite">正在整理所需图像…</p>
      <div data-load-actions hidden><button data-retry>重试失败图像</button><button data-continue>继续查看（缺失图像）</button></div>
    </section>
    <section class="preview-stage" hidden><canvas width="768" height="576" role="img" aria-label="小剧场排练画面"></canvas><div class="preview-dialogue"><h2></h2><div class="preview-text"></div></div><div class="preview-flash" aria-hidden="true"></div></section>
    <p class="preview-state"></p><p class="preview-assets" role="status"></p><p class="preview-progress"></p>
    <footer hidden><button data-restart>重新开始</button><button data-replay>重播本句</button><button data-edit>编辑本句</button><button data-back>上一句</button><button data-next>下一句</button></footer>
    <details class="preview-credits"><summary>素材来源与排练说明</summary><p>内置法庭示例使用同人插画，相关角色与商标权利归 CAPCOM；原创角色图片由作品作者提供。当前展示动作的代表帧；文字逐字显示，点击可补全或进入下一句；闪光、震屏、强调和镜头切换会直接演出。一般音效和配乐使用本项目原创 8Bit 合成；人物喊话使用 Court Records 收录的原作短语音，录音权利归 CAPCOM，来源可在声音素材页查看。声音开关同时控制文字音、动作音效、喊话与配乐。</p></details>`;
  document.body.append(dialog);
  let position=0, closed=false, preloading=true, effectCursor=0, choiceShown=false, choiceVisible=false, transitioning=false,audioRequest=0;
  let playbackState:PlaybackSnapshot={position:0,partialText:'',page:0,count:0,complete:true,waiting:false,loading:false};
  const stage=dialog.querySelector<HTMLElement>('.preview-stage')!;
  const choices=document.createElement('section');choices.className='preview-choices';choices.hidden=true;choices.setAttribute('aria-labelledby','preview-choice-prompt');
  const choicePanel=document.createElement('div');choicePanel.className='preview-choice-panel';
  const choicePrompt=document.createElement('h2');choicePrompt.id='preview-choice-prompt';choicePrompt.textContent=options.choices?.prompt??'';choicePanel.append(choicePrompt);
  for(const [index,option] of (options.choices?.options??[]).entries()){
    const button=document.createElement('button');button.type='button';button.dataset.option=option.id;
    const number=document.createElement('span');number.className='preview-choice-number';number.textContent=String(index+1).padStart(2,'0');
    const label=document.createElement('span');label.textContent=option.label;button.append(number,label);
    button.onclick=event=>{event.stopPropagation();if(!choiceVisible||closed||transitioning)return;transitioning=true;choicePanel.querySelectorAll('button').forEach(b=>{b.disabled=true;});dialog.close();options.choices?.onSelect(option.id);};choicePanel.append(button);
  }
  choices.append(choicePanel);choices.addEventListener('click',event=>event.stopPropagation());stage.append(choices);
  const canvas=dialog.querySelector('canvas')!;
  const flashLayer=dialog.querySelector<HTMLElement>('.preview-flash')!;
  const context=canvas.getContext('2d')!;
  const cache=decodedAssets;
  const failed=new Set<string>();
  const loads=new Map<string,Promise<void>>();
  const cancellations=new Set<()=>void>();
  const loadAsset=(url:string):Promise<void>=>{
    if(cache.has(url))return Promise.resolve();
    const prior=loads.get(url);if(prior)return prior;
    const task=new Promise<void>(resolve=>{
      const img=new Image();let done=false;
      const settle=(ok:boolean)=>{
        if(done)return;done=true;window.clearTimeout(timeout);cancellations.delete(cancel);
        img.onload=null;img.onerror=null;
        if(ok){
          try {
            if(!img.naturalWidth||!img.naturalHeight)throw new Error('Empty image');
            if(resolver.findByUrl(url)?.colorKey==='magenta'){
              const layer=document.createElement('canvas');layer.width=img.naturalWidth;layer.height=img.naturalHeight;
              const ctx=layer.getContext('2d')!;ctx.drawImage(img,0,0);
              const pixels=ctx.getImageData(0,0,layer.width,layer.height);
              for(let i=0;i<pixels.data.length;i+=4){
                if(pixels.data[i]===255&&pixels.data[i+1]===0&&pixels.data[i+2]===255)pixels.data[i+3]=0;
              }
              ctx.putImageData(pixels,0,0);
              cache.set(url,layer);
            }else{
              cache.set(url,img);
            }
          } catch {failed.add(url);}
        }else failed.add(url);
        resolve();
      };
      const cancel=()=>{settle(false);img.src='';};
      const timeout=window.setTimeout(cancel,30000);cancellations.add(cancel);
      img.onload=()=>settle(true);img.onerror=()=>settle(false);img.src=url;
    });
    loads.set(url,task);return task;
  };
  const prepare=(position:number):Promise<void>|void=>{
    const missing=sceneAt(plan.instructions,position,manifest,presentation).urls.filter(url=>!cache.has(url)&&!failed.has(url));
    if(missing.length)return Promise.all(missing.map(loadAsset)).then(()=>{});
  };
  const asset=(url:string)=>cache.get(url);
  const render=()=>{
    let speaker:string|null=null, camera:string|null=null, text='', state='';
    const characters=new Map<string,string>();
    for(const command of plan.instructions.slice(0,position)){
      if(command.op==='speaker'){speaker=command.castId;camera=speaker;text='';characters.clear();}
      else if(command.op==='showText') text+=command.text;
      else if(command.op==='pose') characters.set(command.castId,command.pose);
      else if(command.op==='reaction') characters.set(command.castId,command.reaction);
      else if(command.op==='focus'){camera=command.castId;state=`镜头：${name(camera)}`;}
      else if(command.op==='background'){
        const label=courtroomBackgroundLabel(presentation,command.resource);
        state=label?`场景：${label}`:'这个背景暂时无法显示';
      }
      else if(command.op==='wait') state=command.reason==='voice'?'人物喊话':command.mode==='input'?'等待继续':`等待 ${command.durationMs??0} ms`;
      else if(command.op==='sfx'||command.op==='bgm'){
        const resolved=resolvePreviewAudio(project.contentPacks,command.resource,command.op);
        state=`${command.op==='sfx'?'音效':'音乐'}：${resolved?.label??command.resource.id}${rehearsalAudio.isEnabled?'':'（声音关闭）'}`;
      }
    }
    const {pose,visual}=sceneAt(plan.instructions,position,manifest,presentation);
    const layers:string[]=[];
    context.fillStyle='#192133';context.fillRect(0,0,STAGE_WIDTH,STAGE_HEIGHT);
    context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
    if(!playbackState.loading && visual.backdrop){
      layers.push(visual.backdrop);const bg=asset(visual.backdrop);if(bg)context.drawImage(bg,0,0,STAGE_WIDTH,STAGE_HEIGHT);
    }
    if(!playbackState.loading && visual.sprite){
      layers.push(visual.sprite);const sprite=asset(visual.sprite);
      if(sprite){
        const [x,y,w,h]=visual.frame ?? [0,0,sprite.width,sprite.height];
        const scale=Math.min(STAGE_WIDTH/w,STAGE_HEIGHT/h);
        const dw=Math.max(1,Math.round(w*scale));
        const dh=Math.max(1,Math.round(h*scale));
        const dx=Math.round((STAGE_WIDTH-dw)/2);
        const dy=STAGE_HEIGHT-dh;
        context.drawImage(sprite,x,y,w,h,dx,dy,dw,dh);
      }
    }
    if(!playbackState.loading && visual.foreground){
      layers.push(visual.foreground);const bench=asset(visual.foreground);if(bench)context.drawImage(bench,0,0,STAGE_WIDTH,STAGE_HEIGHT);
    }
    canvas.setAttribute('aria-label',`${visual.supported?'小剧场场景':'未收录场景'} · ${name(camera)} · ${pose}`);
    dialog.querySelector('.preview-dialogue h2')!.textContent=name(speaker);
    const textBox=dialog.querySelector<HTMLElement>('.preview-text')!;
    textBox.textContent=playbackState.loading?'':text+playbackState.partialText||(playbackState.count?'…':'还没有台词，先写一段对话吧。');
    const dialogue=dialog.querySelector<HTMLElement>('.preview-dialogue')!;
    const presentationState=presentationStateAt(plan.instructions,position);
    dialogue.classList.toggle('is-emphasis',Boolean(presentationState.emphasis));
    dialogue.dataset.emphasis=presentationState.emphasis??'';
    dialogue.scrollTop=dialogue.scrollHeight;
    dialog.querySelector('.preview-state')!.textContent=[...characters].map(([id,actionId])=>{
      const characterRef=manifest.cast.find(c=>c.castId===id)?.characterRef;
      return `${name(id)} · ${courtroomActionLabel(presentation,characterRef,actionId)??actionId}`;
    }).concat(state?[state]:[]).join(' / ');
    const failedLayers=layers.filter(url=>failed.has(url));
    dialog.querySelector('.preview-assets')!.textContent=playbackState.loading?'正在准备本句画面…':failedLayers.length?`图像加载失败：${failedLayers.map(url=>url.split('/').pop()).join('、')}。`:camera&&!visual.sprite?'当前角色或动作暂无对应图像。':'';
    dialog.querySelector('.preview-progress')!.textContent=playbackState.count?`${playbackState.page+1} / ${playbackState.count}`:'';
    (dialog.querySelector('[data-back]') as HTMLButtonElement).disabled=playbackState.page===0;
    const next=dialog.querySelector<HTMLButtonElement>('[data-next]')!;
    const ended=playbackState.complete&&playbackState.page+1>=playbackState.count;
    if(!ended)choiceShown=false;
    const showChoices=!!options.choices&&choiceShown&&ended&&!playbackState.loading;
    choices.hidden=!showChoices;dialogue.hidden=showChoices;stage.classList.toggle('is-choosing',showChoices);
    if(choiceVisible!==showChoices){choiceVisible=showChoices;options.onChoiceState?.(showChoices);if(showChoices)choicePanel.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});}
    next.disabled=showChoices||(ended&&!options.onComplete&&!options.choices)||playbackState.loading;
    next.hidden=showChoices;
    if(options.playing){(dialog.querySelector('[data-back]') as HTMLButtonElement).hidden=playbackState.page===0;(dialog.querySelector('[data-restart]') as HTMLButtonElement).hidden=playbackState.count<2;}
    next.textContent=playbackState.loading?'准备画面中…':showChoices?'等待选择':ended?(options.choices?'显示选项':options.onComplete?'继续剧情':'已结束'):playbackState.waiting?'继续':playbackState.complete?'下一句':'显示全文';
  };
  const player=new PreviewPlayback(plan.instructions,{
    schedule(callback,delay){const timer=window.setTimeout(callback,delay);return ()=>window.clearTimeout(timer);},
  },snapshot=>{
    const fromPosition=effectCursor;
    const effects=transientEffectsBetween(plan.instructions,fromPosition,snapshot.position);
    const sfx=previewSfxBetween(plan.instructions,fromPosition,snapshot.position,snapshot.skipped).filter(ref=>!snapshot.skipped||!resolvePreviewAudio(project.contentPacks,ref,'sfx')?.clip);
    const bgm=previewBgmAt(plan.instructions,snapshot.position);
    effectCursor=snapshot.position;
    playbackState=snapshot;position=snapshot.position;render();options.onPage?.(snapshot.page);
    if(effects.length)playPreviewEffects({stage,canvas,flash:flashLayer},effects);
    rehearsalAudio.syncBgm(bgm);
    if(snapshot.skipped)rehearsalAudio.stopCallouts();
    if(sfx.length)rehearsalAudio.playSfx(sfx);
    if(snapshot.complete||snapshot.waiting||snapshot.loading)rehearsalAudio.stopTyping();
  },undefined,prepare,event=>rehearsalAudio.playTypingSound(previewTypingSoundAt(plan.instructions,event.position),event.text));
  const advance=()=>{
    if(preloading||closed||transitioning||choiceVisible||playbackState.loading)return;
    if(playbackState.complete&&playbackState.page+1>=playbackState.count&&options.choices){choiceShown=true;render();}
    else if(playbackState.complete&&playbackState.page+1>=playbackState.count&&options.onComplete){transitioning=true;const complete=options.onComplete;dialog.close();complete();}
    else player.next();
  };
  dialog.querySelector('[data-next]')!.addEventListener('click',advance);
  dialog.querySelector('[data-back]')!.addEventListener('click',()=>{
    if(preloading)return;
    choiceShown=false;
    rehearsalAudio.stopCallouts();
    effectCursor=player.pages[Math.max(0,playbackState.page-1)]?.start??0;
    player.back();
  });
  dialog.querySelector('[data-restart]')!.addEventListener('click',()=>{
    if(preloading)return;
    choiceShown=false;
    rehearsalAudio.stopCallouts();
    effectCursor=player.pages[0]?.start??0;
    player.start();
  });
  dialog.querySelector('[data-replay]')!.addEventListener('click',()=>{
    if(preloading)return;
    choiceShown=false;
    rehearsalAudio.stopCallouts();
    effectCursor=player.pages[playbackState.page]?.start??0;player.start(playbackState.page);
  });
  dialog.querySelector('[data-edit]')!.addEventListener('click',()=>{
    const page=playbackState.page;dialog.close();options.onEdit?.(page);
  });
  const audioButton=dialog.querySelector<HTMLButtonElement>('[data-audio]')!;
  audioButton.addEventListener('click',async()=>{
    const request=++audioRequest;
    const requested=!rehearsalAudio.isEnabled;
    await rehearsalAudio.setEnabled(requested);if(closed||request!==audioRequest)return;
    const enabled=rehearsalAudio.isEnabled;options.onAudioChange?.(enabled);
    audioButton.setAttribute('aria-pressed',String(enabled));
    audioButton.textContent=enabled?'声音：开':requested?'声音：重试':'声音：关';
    if(enabled)rehearsalAudio.syncBgm(previewBgmAt(plan.instructions,position),true);
    render();
  });
  dialog.querySelector('[data-close]')!.addEventListener('click',()=>dialog.close());
  dialog.querySelector('.preview-stage')!.addEventListener('click',advance);
  dialog.addEventListener('keydown',event=>{
    if(preloading||event.isComposing||event.repeat)return;
    if((event.key===' '||event.key==='Enter')&&!(event.target instanceof HTMLButtonElement)&&!(event.target instanceof HTMLAnchorElement)&&!(event.target instanceof HTMLElement&&event.target.closest('summary'))){event.preventDefault();advance();}
  });
  dialog.addEventListener('close',()=>{closed=true;player.dispose();rehearsalAudio.dispose();for(const cancel of [...cancellations])cancel();dialog.remove();options.onClose?.();});
  const panel=dialog.querySelector<HTMLElement>('.preview-preload')!;
  const progress=panel.querySelector('progress')!;
  const status=panel.querySelector<HTMLElement>('[data-load-status]')!;
  const actions=panel.querySelector<HTMLElement>('[data-load-actions]')!;
  const begin=()=>{
    if(closed)return;
    preloading=false;panel.hidden=true;
    stage.hidden=false;
    dialog.querySelector<HTMLElement>('footer')!.hidden=false;
    const page=Math.max(0,Math.min(player.pages.length-1,Math.trunc(options.startPage??0)));
    effectCursor=player.pages[page]?.start??0;player.start(page,options.startCompleted);
    if(options.startCompleted&&options.choices){choiceShown=true;render();}
  };
  const preload=async()=>{
    actions.hidden=true;
    const result=await preloadAssets(collectSceneAssets(plan.instructions,manifest,presentation),async url=>{
      await loadAsset(url);return cache.has(url);
    },p=>{
      if(closed)return;
      progress.max=Math.max(1,p.total);progress.value=p.completed;
      const percent=p.total?Math.round(p.completed/p.total*100):100;
      status.textContent=`已准备 ${p.completed} / ${p.total} 张图像 · ${percent}%${p.failed?` · ${p.failed} 张失败`:''}`;
    },()=>closed);
    if(closed)return;
    if(result.failed){status.textContent=`${result.failed} 张图像未能加载（${[...failed].map(url=>url.split('/').pop()).join('、')}）。可以重试，或继续查看已有画面。`;actions.hidden=false;}
    else {await rehearsalAudio.prepareClips(plan.instructions.flatMap(c=>c.op==='sfx'?[c.resource]:[]));if(!closed)begin();}
  };
  panel.querySelector('[data-retry]')!.addEventListener('click',()=>{
    for(const url of failed)loads.delete(url);failed.clear();void preload();
  });
  panel.querySelector('[data-continue]')!.addEventListener('click',begin);
  if(options.title)dialog.querySelector('#preview-title')!.textContent=options.title;
  if(options.playing){dialog.querySelector<HTMLElement>('[data-edit]')!.hidden=true;dialog.querySelector('[data-restart]')!.textContent='重播本场';dialog.classList.add('story-playing');}
  dialog.showModal();if(options.audioEnabled!==false)audioButton.click();void preload();
}
