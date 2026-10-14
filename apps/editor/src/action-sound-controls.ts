import {actionSounds,readTypingSound,type CourtroomContentPack,type TypingSoundSetting} from '../../../packages/adapters/courtroom/src/index.js';
export function actionSoundControl(value:unknown,packs:readonly CourtroomContentPack[],defaultLabel:string,change:(value:TypingSoundSetting)=>void):HTMLLabelElement {
  const label=document.createElement('label');label.className='action-sound-control';label.textContent='动作声音';
  const select=document.createElement('select');select.setAttribute('aria-label','动作声音');
  select.add(new Option(`自动 · ${defaultLabel}`,'inherit'));select.add(new Option('无音效 / 静音','mute'));
  for(const [title,recorded] of [['人物喊话',true],['8Bit 音效',false]] as const){const group=document.createElement('optgroup');group.label=title;
    for(const sound of actionSounds(packs).filter(s=>recorded===('clip' in s))){const option=new Option(sound.label,JSON.stringify(sound.resource));group.append(option);}select.append(group);
  }
  const setting=readTypingSound(value),key=setting===undefined?'inherit':setting===null?'mute':JSON.stringify(setting);
  if(!Array.from(select.options).some(o=>o.value===key))select.add(new Option('声音已移除 · 请重新选择',key));
  select.value=key;select.onchange=()=>change(select.value==='inherit'?undefined:select.value==='mute'?null:JSON.parse(select.value));label.append(select);return label;
}
