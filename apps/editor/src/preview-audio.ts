import type {
  CourtroomContentPack,
  CourtroomInstruction,
  CourtroomPreviewAudioCue,
} from '../../../packages/adapters/courtroom/src/index.js';
import type { ResourceRef } from '../../../packages/core/src/index.js';
import { sameResource } from '../../../packages/presentation/src/index.js';

export interface ResolvedPreviewAudio {
  label: string;
  cue: CourtroomPreviewAudioCue;
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
): ResourceRef[] {
  if(toPosition<=fromPosition)return [];
  return instructions
    .slice(Math.max(0,fromPosition),Math.max(0,toPosition))
    .flatMap(command=>command.op==='sfx'?[command.resource]:[]);
}

export function resolvePreviewAudio(
  packs: readonly CourtroomContentPack[],
  resource: ResourceRef,
  kind: 'sfx'|'bgm',
): ResolvedPreviewAudio | undefined {
  const pack=packs.find(item=>item.id===resource.packId);
  const item=pack?.audio[kind].find(candidate=>sameResource(candidate.resource,resource));
  return item?.previewAudio ? {label:item.label,cue:item.previewAudio} : undefined;
}

const resourceKey=(resource:ResourceRef|undefined):string =>
  resource ? `${resource.packId}::${resource.id}` : '';

export class PreviewSynthAudio {
  private context:AudioContext|undefined;
  private master:GainNode|undefined;
  private bgmTimer:number|undefined;
  private desiredBgm:ResourceRef|undefined;
  private playingBgmKey='';
  private enabled=false;

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
    this.enabled=enabled;
    if(!enabled){
      this.stopBgm();
      return true;
    }
    const unlocked=await this.unlock();
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
    if(!resolved)return;
    this.playingBgmKey=key;
    this.playCue(resolved.cue);
    if(resolved.cue.loopMs){
      this.bgmTimer=window.setInterval(()=>{
        if(this.enabled&&this.playingBgmKey===key)this.playCue(resolved.cue);
      },resolved.cue.loopMs);
    }
  }

  playSfx(resources:readonly ResourceRef[]):void {
    if(!this.enabled)return;
    resources.forEach((resource,index)=>{
      const resolved=resolvePreviewAudio(this.packs,resource,'sfx');
      if(resolved)this.playCue(resolved.cue,index*.11);
    });
  }

  dispose():void {
    this.stopBgm();
    if(this.context){
      void this.context.close();
      this.context=undefined;
      this.master=undefined;
    }
  }

  private stopBgm():void {
    if(this.bgmTimer!==undefined){
      window.clearInterval(this.bgmTimer);
      this.bgmTimer=undefined;
    }
    this.playingBgmKey='';
  }

  private playCue(cue:CourtroomPreviewAudioCue,offsetSeconds=0):void {
    const context=this.context,master=this.master;
    if(!context||!master||context.state!=='running')return;
    const base=context.currentTime+Math.max(0,offsetSeconds);
    for(const note of cue.notes){
      const start=base+(note.offsetMs??0)/1000;
      const end=start+note.durationMs/1000;
      const oscillator=context.createOscillator();
      const gain=context.createGain();
      oscillator.type=cue.waveform??'triangle';
      oscillator.frequency.setValueAtTime(note.frequency,start);
      gain.gain.setValueAtTime(.0001,start);
      gain.gain.exponentialRampToValueAtTime(Math.max(.001,note.gain??.035),start+.012);
      gain.gain.exponentialRampToValueAtTime(.0001,end);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(end+.02);
    }
  }
}
