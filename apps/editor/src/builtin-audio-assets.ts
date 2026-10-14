import { courtroomDemoPack } from '../../../content-packs/courtroom-demo/pack.js';
import type { CourtroomContentPack, CourtroomPreviewAudioCue } from '../../../packages/adapters/courtroom/src/index.js';
import type { YahariProjectFile } from '../../../packages/core/src/index.js';
import { typingSoundValid } from '../../../packages/adapters/courtroom/src/typing-sound.js';
import {validActionSound} from '../../../packages/adapters/courtroom/src/action-sound.js';

export const audioCategories=[
  {id:'ui',label:'界面与操作',kind:'sfx'}, {id:'dialogue',label:'对白与反应',kind:'sfx'},
  {id:'courtroom',label:'法庭与质证',kind:'both'}, {id:'evidence',label:'线索与证物',kind:'sfx'},
  {id:'transition',label:'转场与结果',kind:'sfx'}, {id:'investigation',label:'调查与会面',kind:'bgm'},
  {id:'testimony',label:'证言与询问',kind:'bgm'}, {id:'pursuit',label:'推理与追击',kind:'bgm'},
  {id:'emotion',label:'紧张与回忆',kind:'bgm'}, {id:'ending',label:'胜诉与收束',kind:'bgm'},
  {id:'custom',label:'其他',kind:'both'},
] as const;
export type AudioCategory=typeof audioCategories[number]['id'];
export interface AudioAsset {id:string;kind:'sfx'|'bgm';label:string;category?:AudioCategory;description?:string;cue:CourtroomPreviewAudioCue}
export interface AudioAssetSettings {version:1;presets:AudioAsset[];hidden:string[]}
export function audioCategory(item:AudioAsset):AudioCategory {return item.category??courtroomDemoPack.audio[item.kind].find(p=>p.id===item.id)?.category as AudioCategory??'custom';}
export function audioDescription(item:AudioAsset):string {return item.description??courtroomDemoPack.audio[item.kind].find(p=>p.id===item.id)?.description??'';}
export function defaultAudioAssets():AudioAssetSettings {
  return {version:1,hidden:[],presets:(['sfx','bgm'] as const).flatMap(kind=>courtroomDemoPack.audio[kind].map(item=>({id:item.id,kind,label:item.label,category:item.category as AudioCategory,description:item.description,cue:structuredClone(item.previewAudio!)})))};
}
export function validateAudioAssets(input:unknown):AudioAssetSettings {
  const fail=():never=>{throw new Error('声音素材格式无效：请检查名称、波形、音符范围与唯一 ID。');};
  if(!input||typeof input!=='object')return fail();const raw=input as AudioAssetSettings;
  if(raw.version!==1||!Array.isArray(raw.presets)||raw.presets.length>80||!Array.isArray(raw.hidden)||raw.hidden.length>80)return fail();
  const ids=new Set<string>(),number=(value:unknown,min:number,max:number)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
  for(const item of raw.presets){if(!item||!['sfx','bgm'].includes(item.kind)||typeof item.id!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(item.id)
    ||typeof item.label!=='string'||!item.label.trim()||item.label.length>80||ids.has(item.kind+'/'+item.id)||!item.cue||!['sine','square','triangle','sawtooth','noise'].includes(item.cue.waveform??'square')
    ||!Array.isArray(item.cue.notes)||!item.cue.notes.length||item.cue.notes.length>32)return fail();
    if(item.category!==undefined&&!audioCategories.some(c=>c.id===item.category&&(c.kind==='both'||c.kind===item.kind)))return fail();
    if(item.description!==undefined&&(typeof item.description!=='string'||item.description.length>500))return fail();
    ids.add(item.kind+'/'+item.id);if(item.cue.loopMs!==undefined&&!number(item.cue.loopMs,100,60_000))return fail();
    for(const note of item.cue.notes)if(!note||!number(note.frequency,20,4000)||!number(note.durationMs,1,5000)||!number(note.gain,0,0.2)
      ||(note.offsetMs!==undefined&&!number(note.offsetMs,0,60_000))||(note.waveform!==undefined&&!['sine','square','triangle','sawtooth','noise'].includes(note.waveform)))return fail();
    if(item.kind==='bgm'&&item.cue.loopMs!==undefined&&item.cue.notes.some(n=>(n.offsetMs??0)+n.durationMs>item.cue.loopMs!))return fail();}
  if(raw.hidden.some(id=>typeof id!=='string'||!ids.has(id)))return fail();
  return{version:1,hidden:[...new Set(raw.hidden)],presets:raw.presets.map(item=>({id:item.id,kind:item.kind,label:item.label,
    category:audioCategory(item),description:audioDescription(item),
    cue:{waveform:item.cue.waveform??'square',...(item.cue.loopMs!==undefined?{loopMs:item.cue.loopMs}:{}),notes:item.cue.notes.map(note=>({frequency:note.frequency,durationMs:note.durationMs,gain:note.gain,...(note.offsetMs!==undefined?{offsetMs:note.offsetMs}:{}),...(note.waveform?{waveform:note.waveform}:{})}))}}))};
}
export function applyAudioAssets(project:YahariProjectFile,input:AudioAssetSettings):YahariProjectFile {
  const settings=validateAudioAssets(input),hidden=new Set(settings.hidden);
  const packs=[resolveAudioAssets(courtroomDemoPack,{audioAssets:settings})];
  const voiceSettings=[project.manifest.projectSettings?.typingSound,...project.manifest.cast.map(c=>c.overrides?.typingSound),
    ...project.documents.flatMap(d=>d.blocks.flatMap(b=>b.type==='dialogue'?[b.metadata?.typingSound]:[]))];
  for(const value of voiceSettings){const ref=value as {packId?:string}|undefined;
    if(ref?.packId===courtroomDemoPack.id&&!typingSoundValid(value,packs))throw new Error('作品仍绑定了已移除或过长的文字音，请先修改人物或台词的文字音设置。');}
  const actionSettings=[...project.manifest.cast.flatMap(c=>Object.values(c.overrides?.actionSounds as Record<string,unknown>??{})),
    ...project.documents.flatMap(d=>d.blocks.flatMap(b=>b.type==='cue'?[b.cue.metadata?.sound]:b.content.flatMap(n=>n.type==='token'?[n.token.metadata?.sound]:[])))];
  for(const value of actionSettings){const ref=value as {packId?:string}|undefined;
    if(ref?.packId===courtroomDemoPack.id&&!validActionSound(value,packs))throw new Error('作品的动作仍使用已移除的声音，请先调整绑定或恢复声音。');}
  for(const document of project.documents)for(const block of document.blocks){const tokens=block.type==='cue'?[block.cue]:block.content.flatMap(n=>n.type==='token'?[n.token]:[]);
    for(const token of tokens){if(!['courtroom.sfx','courtroom.bgm'].includes(token.type))continue;const ref=token.params.resource as {packId?:string;id?:string}|undefined;
      if(ref?.packId===courtroomDemoPack.id&&typeof ref.id==='string'){const key=ref.id.replace(/^audio\//,'');
        if(ref.id.startsWith('audio/voice/'))continue;
        if(hidden.has(key)||!settings.presets.some(p=>p.kind+'/'+p.id===key))throw new Error('当前剧本仍使用已移除的声音，请恢复该声音再应用。');}}}
  const next=structuredClone(project);next.manifest.projectSettings={...next.manifest.projectSettings,audioAssets:settings};return next;
}
export function resolveAudioAssets(pack:CourtroomContentPack,metadata:YahariProjectFile['manifest']['projectSettings']):CourtroomContentPack {
  if(!metadata?.audioAssets)return pack;let settings:AudioAssetSettings;try{settings=validateAudioAssets(metadata.audioAssets);}catch{return pack;}
  const next=structuredClone(pack);for(const kind of ['sfx','bgm']as const)next.audio[kind]=settings.presets.filter(p=>p.kind===kind&&!settings.hidden.includes(kind+'/'+p.id))
    .map(p=>({id:p.id,label:p.label,category:p.category,description:p.description,resource:{packId:pack.id,id:'audio/'+kind+'/'+p.id},previewAudio:p.cue}));
  // Projects saved before automatic text audio did not carry these two presets.
  for(const item of pack.audio.sfx.filter(s=>s.id==='text-low'||s.id==='text-high')){
    if(!settings.presets.some(p=>p.kind==='sfx'&&p.id===item.id))next.audio.sfx.push(structuredClone(item));
  }
  return next;
}
