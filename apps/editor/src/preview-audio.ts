import type {
  CourtroomContentPack,
  CourtroomInstruction,
  CourtroomPreviewAudioCue,
  CourtroomVoiceResource,
} from '../../../packages/adapters/courtroom/src/index.js';
import type { ResourceRef } from '../../../packages/core/src/index.js';
import { sameResource } from '../../../packages/presentation/src/index.js';
import { defaultTypingSound } from '../../../packages/adapters/courtroom/src/typing-sound.js';
import { playChipCue,playChipBuffer,renderChipCue,CHIP_SAMPLE_RATE } from './chip-audio.js';

export interface ResolvedPreviewAudio {
  label: string;
  cue?: CourtroomPreviewAudioCue;
  clip?: CourtroomVoiceResource['clip'];
}

export function previewBgmAt(
  instructions: readonly CourtroomInstruction[],
  position: number,
): ResourceRef | undefined {
  let bgm:ResourceRef|undefined;
  for(const command of instructions.slice(0,Math.max(0,position))){
    if(command.op==='bgm') bgm=command.resource;
  }
  return bgm;
}

export function previewSfxBetween(
  instructions: readonly CourtroomInstruction[],
  fromPosition: number,
  toPosition: number,
  skipBoundActions=false,
): ResourceRef[] {
  if(toPosition<=fromPosition)return [];
  return instructions
    .slice(Math.max(0,fromPosition),Math.max(0,toPosition))
    .flatMap(command=>command.op==='sfx'&&!(skipBoundActions&&command.boundAction)?[command.resource]:[]);
}

export function resolvePreviewAudio(
  packs: readonly CourtroomContentPack[],
  resource: ResourceRef,
  kind: 'sfx'|'bgm',
): ResolvedPreviewAudio | undefined {
  const pack=packs.find(item=>item.id===resource.packId);
  const voice=kind==='sfx'?pack?.audio.voices?.find(candidate=>sameResource(candidate.resource,resource)):undefined;
  if(voice)return {label:voice.label,clip:voice.clip};
  const item=pack?.audio[kind].find(candidate=>sameResource(candidate.resource,resource));
  return item?.previewAudio ? {label:item.label,cue:item.previewAudio} : undefined;
}

const resourceKey=(resource:ResourceRef|undefined):string =>
  resource ? `${resource.packId}::${resource.id}` : '';

export function previewTypingSoundAt(instructions:readonly CourtroomInstruction[],position:number):ResourceRef|null|undefined {
  for(let i=Math.min(position,instructions.length-1);i>=0;i--){const command=instructions[i];if(command.op==='speaker')return command.typingSound;}
  return undefined;
}

export class PreviewSynthAudio {
  private context:AudioContext|undefined;
  private master:GainNode|undefined;
  private bgmTimer:number|undefined;
  private desiredBgm:ResourceRef|undefined;
  private playingBgmKey='';
  private enabled=false;
  private activation=0;
  private bgmVoice:(()=>void)|undefined;
  private sfxVoices=new Set<()=>void>();
  private typingVoice:(()=>void)|undefined;
  private typingBuffers=new Map<string,AudioBuffer>();
  private lastTypingAt=-Infinity;
  private clipBuffers=new Map<string,Promise<AudioBuffer|undefined>>();
  private callouts=new Set<()=>void>();
  private calloutEpoch=0;

  constructor(private packs:readonly CourtroomContentPack[]){}

  get isEnabled():boolean{return this.enabled;}

  async unlock():Promise<boolean> {
    try{
      if(!this.context){
        this.context=new AudioContext();
        this.master=this.context.createGain();
        this.master.gain.value=.72;
        this.master.connect(this.context.destination);
      }
      if(this.context.state==='suspended')await this.context.resume();
      return this.context.state==='running';
    }catch{return false;}
  }

  async setEnabled(enabled:boolean):Promise<boolean> {
    const request=++this.activation;
    this.enabled=enabled;
    if(!enabled){
      this.stopBgm();
      this.stopTyping();
      this.stopCallouts();
      for(const stop of this.sfxVoices)stop();this.sfxVoices.clear();
      return true;
    }
    const unlocked=await this.unlock();
    if(request!==this.activation)return this.enabled;
    this.enabled=unlocked;
    if(unlocked)this.syncBgm(this.desiredBgm,true);
    return unlocked;
  }

  syncBgm(resource:ResourceRef|undefined, force=false):void {
    this.desiredBgm=resource;
    if(!this.enabled)return;
    const key=resourceKey(resource);
    if(!force&&key===this.playingBgmKey)return;
    this.stopBgm();
    if(!resource)return;
    const resolved=resolvePreviewAudio(this.packs,resource,'bgm');
    if(!resolved?.cue)return;
    const cue=resolved.cue;
    this.playingBgmKey=key;
    this.bgmVoice=this.playCue(cue);
    if(cue.loopMs){
      this.bgmTimer=window.setInterval(()=>{
        if(this.enabled&&this.playingBgmKey===key){this.bgmVoice?.();this.bgmVoice=this.playCue(cue);}
      },cue.loopMs);
    }
  }

  playSfx(resources:readonly ResourceRef[]):void {
    if(!this.enabled)return;
    resources.forEach((resource,index)=>{
      const resolved=resolvePreviewAudio(this.packs,resource,'sfx');
      if(resolved?.cue){const stop=this.playCue(resolved.cue,index*.11,()=>this.sfxVoices.delete(stop!));if(stop)this.sfxVoices.add(stop);}
      else if(resolved?.clip){
        const epoch=this.calloutEpoch,activation=this.activation;
        void this.loadClip(resource,resolved.clip).then(buffer=>{
          const context=this.context,master=this.master;
          if(!buffer||!context||!master||!this.enabled||epoch!==this.calloutEpoch||activation!==this.activation)return;
          const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=.8;source.connect(gain);gain.connect(master);
          let done=false;const cleanup=()=>{if(done)return;done=true;source.disconnect();gain.disconnect();this.callouts.delete(stop);};
          const stop=()=>{try{source.stop();}catch{/* A completed source can already be stopped. */}cleanup();};
          source.onended=cleanup;this.callouts.add(stop);source.start(context.currentTime);
        });
      }
    });
  }

  async prepareClips(resources:readonly ResourceRef[]):Promise<void> {
    if(!this.context)return;
    await Promise.all(resources.map(ref=>{const resolved=resolvePreviewAudio(this.packs,ref,'sfx');return resolved?.clip?this.loadClip(ref,resolved.clip):undefined;}));
  }
  stopCallouts():void {++this.calloutEpoch;for(const stop of [...this.callouts])stop();this.callouts.clear();}
  private loadClip(resource:ResourceRef,clip:CourtroomVoiceResource['clip']):Promise<AudioBuffer|undefined> {
    const context=this.context;if(!context)return Promise.resolve(undefined);
    const key=resourceKey(resource),found=this.clipBuffers.get(key);if(found)return found;
    const task=(async()=>{try{
      const encoded=clip.dataUrl.split(',')[1],bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
      return await context.decodeAudioData(bytes.buffer);
    }catch{return undefined;}})();this.clipBuffers.set(key,task);return task;
  }

  playTypingSound(resource:ResourceRef|null|undefined,grapheme:string):void {
    const context=this.context,master=this.master;
    if(!this.enabled||!context||!master||context.state!=='running'||!/[\p{L}\p{N}\p{S}]/u.test(grapheme)||resource===null)return;
    if(context.currentTime-this.lastTypingAt<.03)return;
    resource??=defaultTypingSound(this.packs);if(!resource)return;
    const resolved=resolvePreviewAudio(this.packs,resource,'sfx');
    if(!resolved?.cue||resolved.cue.loopMs||resolved.cue.notes.some(n=>(n.offsetMs??0)+n.durationMs>80))return;
    const key=resourceKey(resource);let buffer=this.typingBuffers.get(key);
    if(!buffer){const pcm=renderChipCue(resolved.cue);buffer=context.createBuffer(1,pcm.length,CHIP_SAMPLE_RATE);buffer.copyToChannel(pcm,0);this.typingBuffers.set(key,buffer);}
    this.typingVoice?.();this.lastTypingAt=context.currentTime;
    this.typingVoice=playChipBuffer(context,master,buffer);
  }

  stopTyping():void {this.typingVoice?.();this.typingVoice=undefined;this.lastTypingAt=-Infinity;}

  dispose():void {
    ++this.activation;this.enabled=false;
    this.stopBgm();
    this.stopTyping();this.typingBuffers.clear();
    this.stopCallouts();this.clipBuffers.clear();
    for(const stop of this.sfxVoices)stop();this.sfxVoices.clear();
    if(this.context){
      void this.context.close();
      this.context=undefined;
      this.master=undefined;
    }
  }

  private stopBgm():void {
    this.bgmVoice?.();this.bgmVoice=undefined;
    if(this.bgmTimer!==undefined){
      window.clearInterval(this.bgmTimer);
      this.bgmTimer=undefined;
    }
    this.playingBgmKey='';
  }

  private playCue(cue:CourtroomPreviewAudioCue,offsetSeconds=0,onEnded?:()=>void):(()=>void)|undefined {
    const context=this.context,master=this.master;
    if(!context||!master||context.state!=='running')return;
    return playChipCue(context,master,cue,offsetSeconds,onEnded);
  }
}
