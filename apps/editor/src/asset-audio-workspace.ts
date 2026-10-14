import {defaultAudioAssets,validateAudioAssets,audioCategories,audioCategory,audioDescription,type AudioAsset,type AudioAssetSettings,type AudioCategory} from './builtin-audio-assets.js';
import {playChipCue,chipWav} from './chip-audio.js';
import type {AssetLibraryStore} from './asset-library-store.js';
import {courtroomDemoPack} from '../../../content-packs/courtroom-demo/pack.js';
import type {CourtroomVoiceResource} from '../../../packages/adapters/courtroom/src/index.js';
import {PreviewSynthAudio} from './preview-audio.js';
const element=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
const key=(item:AudioAsset)=>item.kind+'/'+item.id;
const duration=(item:AudioAsset)=>Math.max(item.cue.loopMs??0,...item.cue.notes.map(n=>(n.offsetMs??0)+n.durationMs));
const error=(cause:unknown)=>cause instanceof Error?cause.message:'声音操作失败。';
export function installAudioWorkspace(list:HTMLElement,editor:HTMLElement,hooks:{notice(text:string):void;prepare():boolean;apply(settings:AudioAssetSettings):Promise<void>}) {
  let library:AssetLibraryStore|null=null,settings=defaultAudioAssets(),draft:AudioAsset|null=null,original:AudioAsset|null=null,selected='',dirty=false,saving=false,context:AudioContext|null=null,stopVoice:(()=>void)|undefined;
  let query='',kind='all',category='all',previewEpoch=0;
  let selectedVoice='',clipPreview:PreviewSynthAudio|null=null;
  const button=(text:string,click:()=>void,style='small-button')=>{const node=element('button',text);node.type='button';node.className=style;node.onclick=click;return node;};
  async function load(store:AssetLibraryStore){
    library=store;const value=await store.readSetting<unknown>('audio-assets');settings=value?validateAudioAssets(value):defaultAudioAssets();
    // Old built-in libraries retain user edits/removals and gain the newly added presets.
    const legacy=['objection','hold-it','desk-slam','gavel','impact','evidence-presented','truth-reveal','whip','camera','magic'];
    if(value&&legacy.every(id=>settings.presets.some(p=>p.kind==='sfx'&&p.id===id))){const ids=new Set(settings.presets.map(key)),missing=defaultAudioAssets().presets.filter(p=>!ids.has(key(p))).slice(0,80-settings.presets.length);if(missing.length)await persist({...settings,presets:[...settings.presets,...missing]});}
  }
  async function persist(next:AudioAssetSettings){if(!library)throw new Error('素材库未打开。');const valid=validateAudioAssets(next);await library.writeSetting('audio-assets',valid);settings=valid;}
  function stopPreview(){++previewEpoch;clipPreview?.dispose();clipPreview=null;stopVoice?.();stopVoice=undefined;if(context){void context.close().catch(()=>{});context=null;}editor.querySelector<HTMLButtonElement>('#asset-audio-stop')?.setAttribute('hidden','');}
  function leave():boolean {if(saving){hooks.notice('声音正在保存，请稍候。');return false;}if(dirty&&!confirm('声音有未保存修改，确定放弃吗？'))return false;dirty=false;draft=null;original=null;selectedVoice='';stopPreview();return true;}
  async function preview(item:AudioAsset):Promise<void>{
    stopPreview();const epoch=previewEpoch,current=new AudioContext();context=current;await current.resume();if(epoch!==previewEpoch)return;
    const master=current.createGain();master.gain.value=.72;master.connect(current.destination);stopVoice=playChipCue(current,master,item.cue,0,()=>{if(context===current){void current.close();context=null;stopVoice=undefined;editor.querySelector<HTMLButtonElement>('#asset-audio-stop')?.setAttribute('hidden','');hooks.notice('试听结束。');}});editor.querySelector<HTMLButtonElement>('#asset-audio-stop')?.removeAttribute('hidden');hooks.notice('正在试听「'+item.label+'」');
  }
  function field(parent:HTMLElement,label:string,name:string,value:string,multiline=false):HTMLInputElement|HTMLTextAreaElement {
    const wrapper=element('label',label),input=multiline?element('textarea'):element('input');input.name=name;input.value=value;wrapper.append(input);parent.append(wrapper);return input;
  }
  function select(parent:HTMLElement,label:string,name:string,options:Array<[string,string]>,value:string):HTMLSelectElement {const wrapper=element('label',label),input=element('select');input.name=name;input.setAttribute('aria-label',label);options.forEach(([id,label])=>input.add(new Option(label,id)));input.value=value;wrapper.append(input);parent.append(wrapper);return input;}
  function categories(type:string){const voices={id:'voice',label:'人物喊话',kind:'voice'};if(type==='voice')return [voices];return [...audioCategories.filter(c=>type==='all'||c.kind==='both'||c.kind===type),...(type==='all'?[voices]:[])];}
  async function previewVoice(item:CourtroomVoiceResource):Promise<void>{
    stopPreview();const epoch=previewEpoch,audio=new PreviewSynthAudio([courtroomDemoPack]);clipPreview=audio;
    if(!await audio.setEnabled(true))throw Error('声音尚未开启，请重新试听。');await audio.prepareClips([item.resource]);if(epoch!==previewEpoch)return;
    audio.playSfx([item.resource]);editor.querySelector<HTMLButtonElement>('#asset-audio-stop')?.removeAttribute('hidden');hooks.notice('正在试听「'+item.label+'」');
    window.setTimeout(()=>{if(epoch===previewEpoch){stopPreview();hooks.notice('试听结束。');}},item.clip.durationMs+200);
  }
  function showVoice(item:CourtroomVoiceResource){
    original=null;draft=null;dirty=false;selectedVoice=item.id;editor.hidden=false;editor.replaceChildren();
    editor.append(element('h2',item.label),element('p','日语人物喊话 · '+(item.clip.durationMs/1000).toFixed(2)+' 秒'),element('p','在对话中点击动作，即可绑定这段声音。异议动作默认跟随所绑定的内置人物。'));
    const actions=element('div');actions.className='dialog-actions';const stop=button('停止',stopPreview);stop.id='asset-audio-stop';stop.hidden=!clipPreview;
    actions.append(button('试听',()=>void previewVoice(item).catch(c=>hooks.notice(error(c)))),stop,button('下载音频',()=>{const link=element('a');link.href=item.clip.dataUrl;link.download=item.label.replace(/[<>:"/\\|?*]/g,'_')+(item.clip.dataUrl.startsWith('data:audio/wav')?'.wav':'.mp3');link.click();}));editor.append(actions);
    const source=element('p');source.className='project-note';source.append(document.createTextNode('录音权利归 CAPCOM；来源：'));const link=element('a','Court Records');link.href='https://www.court-records.net/audio.htm';link.target='_blank';link.rel='noopener noreferrer';source.append(link);editor.append(source);
  }
  function render(search:string):void {
    query=search;list.replaceChildren();list.classList.add('asset-audio-list');
    const visible=settings.presets.filter(item=>!settings.hidden.includes(key(item))&&(kind==='all'||kind===item.kind)&&(category==='all'||category===audioCategory(item))&&(!search||`${item.label} ${audioDescription(item)} ${audioCategories.find(c=>c.id===audioCategory(item))?.label??''} ${item.kind==='sfx'?'音效':'音乐'} 8bit`.toLowerCase().includes(search.toLowerCase())));
    const voices=(courtroomDemoPack.audio.voices??[]).filter(item=>(kind==='all'||kind==='voice')&&(category==='all'||category==='voice')&&(!search||`${item.label} 日语 人物喊话`.toLowerCase().includes(search.toLowerCase())));
    if(selectedVoice&&!voices.some(v=>v.id===selectedVoice))selectedVoice='';
    const voiceView=kind==='voice'||category==='voice'||!!selectedVoice||!visible.length&&voices.length>0;
    list.closest('.asset-workspace')?.classList.toggle('is-voice-audio',voiceView);
    const tools=element('div');tools.className='asset-audio-tools';
    tools.hidden=voiceView;
    tools.append(button('应用到当前作品',()=>void(async()=>{if(!await flush())return;await hooks.apply(settings);hooks.notice('声音已应用到当前作品。');})().catch(c=>hooks.notice(error(c))),'create-button'),button('导出声音包',()=>void(async()=>{if(await flush())download();})()),button('导入声音包',()=>file.click()));
    if(settings.hidden.length)tools.append(button('恢复移除（'+settings.hidden.length+'）',()=>{if(!hooks.prepare())return;void persist({...settings,hidden:[]}).then(()=>render(query)).catch(c=>hooks.notice(error(c)));}));list.append(tools);
    const filters=element('div');filters.className='asset-audio-filters';const type=select(filters,'声音类型','audio-kind',[['all','全部声音'],['sfx','8Bit 音效'],['bgm','循环音乐'],['voice','人物喊话']],kind);
    const group=select(filters,'用途分类','audio-category',[['all','全部用途'],...categories(kind).map(c=>[c.id,c.label]as[string,string])],category);
    if(kind==='voice'){group.parentElement!.hidden=true;filters.classList.add('voice-filters');}
    type.onchange=()=>{kind=type.value;if(!categories(kind).some(c=>c.id===category))category='all';render(query);};group.onchange=()=>{category=group.value;render(query);};list.append(filters);
    for(const type of ['sfx','bgm']as const){const items=visible.filter(item=>item.kind===type);if(!items.length)continue;
      const section=element('section');section.className='asset-audio-section';const heading=element('h2',type==='sfx'?'音效':'循环音乐');heading.append(element('small',String(items.length)));section.append(heading);
      for(const group of categories(type)){const entries=items.filter(item=>audioCategory(item)===group.id);if(!entries.length)continue;section.append(element('h3',group.label));
        for(const item of entries){const row=element('div');row.className='asset-audio-row';row.dataset.audioId=key(item);row.classList.toggle('is-selected',selected===key(item));
          const choose=button('',()=>edit(item),'asset-audio-select');choose.setAttribute('aria-pressed',String(selected===key(item)));choose.append(element('strong',item.label),element('span',audioDescription(item)));row.append(choose,element('small',(duration(item)/1000).toFixed(2)+'s'),button('试听',()=>void preview(item).catch(c=>hooks.notice(error(c)))));section.append(row);
        }
      }list.append(section);
    }
    if(voices.length){const section=element('section');section.className='asset-audio-section';const heading=element('h2','人物喊话');heading.append(element('small',String(voices.length)));section.append(heading);
      for(const item of voices){const row=element('div');row.className='asset-audio-row asset-voice-row';row.dataset.voiceId=item.id;row.classList.toggle('is-selected',selectedVoice===item.id);
        const choose=button('',()=>{if(!hooks.prepare())return;showVoice(item);render(query);},'asset-audio-select');choose.append(element('strong',item.label),element('span','日语 · '+(item.clip.durationMs/1000).toFixed(2)+' 秒'));row.append(choose,button('试听',()=>void previewVoice(item).catch(c=>hooks.notice(error(c)))));section.append(row);}list.append(section);}
    if(selectedVoice&&!voices.some(v=>v.id===selectedVoice))selectedVoice='';
    if(!visible.length&&!voices.length)list.append(element('p','没有符合条件的声音。'));
    if(visible.length&&!selectedVoice&&(!draft||!dirty&&!visible.some(item=>key(item)===key(draft!))))showEditor(visible.find(item=>key(item)===selected)??visible[0]);
    else if(voices.length&&!visible.length&&!selectedVoice)showVoice(voices[0]);
  }
  function edit(item?:AudioAsset):void {if(!hooks.prepare())return;showEditor(item);render(query);}
  function showEditor(item?:AudioAsset):void {
    selectedVoice='';
    original=item?structuredClone(item):null;draft=structuredClone(item??{id:'user-'+crypto.randomUUID(),kind:'sfx',label:'新声音',category:'custom',description:'',cue:{waveform:'square',notes:[{frequency:440,durationMs:120,gain:.04}]}});selected=key(draft);dirty=!item;editor.hidden=false;
    editor.replaceChildren();const heading=element('div');heading.className='asset-audio-editor-heading';heading.append(element('h2','声音设置'),element('span','8BIT'));editor.append(heading);
    const form=element('form');form.id='asset-audio-form';const grid=element('div');grid.className='asset-form-grid';
    const label=field(grid,'名称','label',draft.label);label.required=true;label.maxLength=80;
    const type=select(grid,'类型','kind',[['sfx','音效'],['bgm','循环音乐']],draft.kind);type.disabled=!!item;
    const category=select(grid,'用途','category',categories(draft.kind).map(c=>[c.id,c.label]),audioCategory(draft));
    type.onchange=()=>{category.replaceChildren();categories(type.value).forEach(c=>category.add(new Option(c.label,c.id)));category.value='custom';};
    const description=field(grid,'使用场景','description',audioDescription(draft),true);description.maxLength=500;
    const waves:Array<[string,string]>=[['square','方波 · 主旋律'],['triangle','三角波 · 柔和低音'],['noise','噪声 · 打击与摩擦']];if(draft.cue.waveform==='sine'||draft.cue.waveform==='sawtooth')waves.push([draft.cue.waveform,'旧版波形（保留）']);
    select(grid,'音色','waveform',waves,draft.cue.waveform??'square');
    for(const [name,label,min,max]of [['volume','音量 %',0,200],['speed','速度 %',25,200]]as const){const input=field(grid,label,name,'100')as HTMLInputElement;input.type='number';input.min=String(min);input.max=String(max);input.required=true;}
    form.append(grid);const actions=element('div');actions.className='dialog-actions';const save=element('button','保存声音');save.type='submit';save.className='create-button';const stop=button('停止',stopPreview);stop.id='asset-audio-stop';stop.hidden=!context;actions.append(save,button('试听当前设置',()=>{try{void preview(candidate(form)).catch(c=>hooks.notice(error(c)));}catch(c){hooks.notice(error(c));}}),stop,button('下载 WAV',()=>{try{downloadWav(candidate(form));}catch(c){hooks.notice(error(c));}}));form.append(actions);
    if(item){const management=element('div');management.className='asset-audio-management';management.append(button('移除声音',()=>void remove().catch(c=>hooks.notice(error(c)))));const builtin=defaultAudioAssets().presets.find(p=>key(p)===key(item));
      if(builtin&&JSON.stringify(item)!==JSON.stringify(builtin))management.append(button('恢复默认',()=>{if(!hooks.prepare())return;void persist({...settings,presets:settings.presets.map(p=>key(p)===key(builtin)?builtin:p)}).then(()=>{showEditor(builtin);render(query);}).catch(c=>hooks.notice(error(c)));}));form.append(management);}
    const status=element('p');status.id='asset-audio-status';status.setAttribute('role','status');form.append(status);form.oninput=()=>{dirty=true;status.textContent='有未保存的修改';};form.onsubmit=event=>{event.preventDefault();void saveForm(form);};editor.append(form);
    list.querySelectorAll<HTMLElement>('.asset-audio-row').forEach(row=>{row.classList.toggle('is-selected',row.dataset.audioId===selected);row.querySelector('button')?.setAttribute('aria-pressed',String(row.dataset.audioId===selected));});
  }
  function candidate(form:HTMLFormElement):AudioAsset {
    if(!draft)throw new Error('请选择声音。');const data=new FormData(form),next=structuredClone(draft),volume=Number(data.get('volume'))/100,speed=Number(data.get('speed'))/100;
    if(!Number.isFinite(volume)||volume<0||volume>2||!Number.isFinite(speed)||speed<.25||speed>2)throw new Error('请填写有效的音量与速度。');
    next.label=String(data.get('label')).trim();next.kind=original?original.kind:String(data.get('kind'))as AudioAsset['kind'];next.category=String(data.get('category'))as AudioCategory;next.description=String(data.get('description')).trim();
    const loop=next.cue.loopMs??duration(next)+150,waveform=String(data.get('waveform'))as AudioAsset['cue']['waveform'],changed=next.cue.waveform!==waveform;next.cue.waveform=waveform;
    next.cue.notes=next.cue.notes.map(n=>{const note={...n,durationMs:n.durationMs/speed,offsetMs:(n.offsetMs??0)/speed,gain:(n.gain??.04)*volume};if(changed&&note.waveform!=='noise')delete note.waveform;return note;});
    if(next.kind==='bgm')next.cue.loopMs=loop/speed;else delete next.cue.loopMs;
    return validateAudioAssets({version:1,presets:[next],hidden:[]}).presets[0];
  }
  async function saveForm(form:HTMLFormElement):Promise<boolean> {
    if(!draft||saving)return false;saving=true;const inputs=[...form.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement|HTMLTextAreaElement>('input,select,button,textarea')],disabled=inputs.map(input=>input.disabled);
    try{const next=candidate(form);inputs.forEach(input=>{input.disabled=true;});await persist({...settings,presets:settings.presets.filter(p=>key(p)!==key(next)).concat(next)});dirty=false;showEditor(next);render(query);hooks.notice('声音已保存，可应用到当前作品。');return true;}
    catch(cause){form.querySelector('#asset-audio-status')!.textContent=error(cause);return false;}
    finally{saving=false;inputs.forEach((input,i)=>{input.disabled=disabled[i];});}
  }
  async function flush():Promise<boolean>{const form=editor.querySelector<HTMLFormElement>('#asset-audio-form');return !dirty||!!form&&await saveForm(form);}
  async function remove(){const item=original;if(!item||!hooks.prepare())return;const builtin=defaultAudioAssets().presets.some(p=>key(p)===key(item));await persist(builtin?{...settings,hidden:[...new Set([...settings.hidden,key(item)])]}:{...settings,presets:settings.presets.filter(p=>key(p)!==key(item)),hidden:settings.hidden.filter(id=>id!==key(item))});draft=null;original=null;selected='';render(query);hooks.notice('已移除声音；已应用到作品的版本保留。');}
  function downloadBytes(bytes:Uint8Array,name:string,type:string){const blob=new Blob([new Uint8Array(bytes)],{type}),url=URL.createObjectURL(blob),link=element('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),10_000);}
  function downloadWav(item:AudioAsset){downloadBytes(chipWav(item.cue),item.label.replace(/[<>:"/\\|?*]/g,'_')+'.wav','audio/wav');}
  function download(){downloadBytes(new TextEncoder().encode(JSON.stringify({fileFormat:'yahari-sounds',fileVersion:'1.0',source:'Yahari Script 原创 8Bit 声音',settings},null,2)),'我的声音.yahari-sounds.json','application/json');}
  const file=element('input');file.type='file';file.accept='.yahari-sounds.json,.json,application/json';file.hidden=true;file.id='asset-audio-import-file';document.body.append(file);
  file.onchange=()=>void(async()=>{const input=file.files?.[0];file.value='';if(!input||!hooks.prepare())return;try{if(input.size>500_000)throw new Error('声音包最大 500 KB。');const raw=JSON.parse(await input.text());if(raw.fileFormat!=='yahari-sounds'||raw.fileVersion!=='1.0')throw new Error('请选择有效的声音包。');const next=validateAudioAssets(raw.settings);if(!confirm('导入 '+next.presets.length+' 个声音并替换本机声音列表？当前作品保留原设置。'))return;await persist(next);draft=null;original=null;editor.hidden=true;render(query);hooks.notice('声音包已导入。');}catch(c){hooks.notice(error(c));}})();
  window.addEventListener('beforeunload',event=>{if(dirty||saving){event.preventDefault();event.returnValue='';}});
  return{load,render,begin:()=>edit(),leave};
}
