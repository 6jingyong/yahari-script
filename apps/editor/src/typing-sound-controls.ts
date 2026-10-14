import {readTypingSound,typingSounds,type TypingSoundSetting,type CourtroomContentPack} from '../../../packages/adapters/courtroom/src/index.js';

export function typingSoundControl(labelText:string,value:unknown,packs:readonly CourtroomContentPack[],inheritLabel:string,onChange:(value:TypingSoundSetting)=>void):HTMLLabelElement {
  const label=document.createElement('label');label.className='typing-sound-control';
  const caption=document.createElement('span');caption.textContent=labelText==='本句文字音'?'文字音':labelText;
  const select=document.createElement('select');select.setAttribute('aria-label',labelText);
  const add=(value:string,text:string)=>{const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);};
  add('inherit',inheritLabel);add('mute','静音');
  for(const sound of typingSounds(packs))add(JSON.stringify(sound.resource),sound.label);
  const setting=readTypingSound(value),selected=setting===undefined?'inherit':setting===null?'mute':JSON.stringify(setting);
  if(!Array.from(select.options).some(o=>o.value===selected))add(selected,'声音已移除 · 请重新选择');
  select.value=selected;
  select.onchange=()=>onChange(select.value==='inherit'?undefined:select.value==='mute'?null:JSON.parse(select.value));
  label.append(caption,select);return label;
}
