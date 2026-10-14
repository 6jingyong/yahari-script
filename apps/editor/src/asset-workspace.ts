import { newAssetPack, validateAssetPack, pruneAssetImages, assetPackBlob, assetPackFilename, readAssetPack, ownedAssetPacks,
  type AssetPack, type AssetKind, type AssetCharacter, type AssetScene, type AssetAction } from '../../../packages/asset-library/src/index.js';
import type { YahariProjectFile } from '../../../packages/core/src/index.js';
import { openAssetLibrary, type AssetLibraryStore } from './asset-library-store.js';
import { normalizeCharacterImage, requestCharacterImage } from './original-character.js';
import { builtinAssetEntries, materializeBuiltin, rasterizedBuiltin, type BuiltinAssetEntry } from './builtin-assets.js';
import { installAudioWorkspace } from './asset-audio-workspace.js';
import type { AudioAssetSettings } from './builtin-audio-assets.js';
import { IMAGE_HELP_HTML, IMAGE_POLICY } from './asset-image-policy.js';
import type { AiConnectionSettings } from './ai-connection.js';

interface WorkspaceHooks {
  snapshot():YahariProjectFile;
  prepare():void|boolean;
  use(pack:AssetPack, characterId?:string, sceneImage?:string):Promise<boolean>;
  connection:AiConnectionSettings;
  visibility?(hiddenIds:Set<string>):void;
  audio(settings:AudioAssetSettings):Promise<void>;
}
interface Draft { pack:AssetPack; entity:AssetCharacter|AssetScene; existing:boolean }
const node=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string)=>{const element=document.createElement(tag);if(text)element.textContent=text;return element;};
const button=(text:string,click:()=>void,className='small-button')=>{const element=node('button',text);element.type='button';element.className=className;element.onclick=click;return element;};
export async function imageFileData(file:File|undefined):Promise<string> {
  if (!file || !['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>IMAGE_POLICY.inputBytes) throw new Error('请选择小于 10 MB 的 PNG、JPEG 或 WebP 图片。');
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('无法读取图片。'));
    reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(new Error('无法读取图片。'));reader.readAsDataURL(file);});
}
let neutral:string|undefined;
export function neutralStageImage():string {
  if (neutral) return neutral;
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=576;
  const context=canvas.getContext('2d')!,gradient=context.createLinearGradient(0,0,0,576);
  gradient.addColorStop(0,'#ede9df');gradient.addColorStop(0.72,'#d8ddd5');gradient.addColorStop(1,'#bbc5b9');
  context.fillStyle=gradient;context.fillRect(0,0,768,576);context.fillStyle='#cad1c4';context.fillRect(0,414,768,162);
  context.strokeStyle='#b5bfaf';context.beginPath();context.moveTo(0,414);context.lineTo(768,414);context.stroke();
  return neutral=canvas.toDataURL('image/webp',IMAGE_POLICY.quality);
}

export function installAssetWorkspace(hooks:WorkspaceHooks):{open(kind?:AssetKind):Promise<void>;close():boolean} {
  const writing=document.querySelector<HTMLElement>('#writing-workspace')!;
  const page=node('section');page.id='asset-workspace';page.className='asset-workspace';page.hidden=true;page.setAttribute('aria-label','素材库');
  page.innerHTML=`<header class="asset-header"><div><div class="eyebrow">ASSET LIBRARY</div><h1 tabindex="-1">素材管理</h1><p>先建立你的素材，再选择它们进入作品。素材包可以独立保存和分享。</p></div><div class="asset-header-actions"><button id="asset-format-help" class="small-button" type="button">格式、尺寸与压缩说明</button><button id="asset-restore-hidden" class="small-button" type="button" hidden>恢复已移除内置素材</button><button id="asset-adopt" class="small-button" type="button">收录当前作品素材</button><button id="asset-import" class="small-button" type="button">导入素材包</button><input id="asset-import-file" type="file" accept=".yahari-characters,.yahari-scenes,.yahari-characters.json,.yahari-scenes.json,.json,application/zip,application/json" hidden></div></header>
    <div class="asset-layout"><aside class="asset-sidebar"><nav aria-label="素材分类"><button id="asset-tab-characters" type="button">角色</button><button id="asset-tab-scenes" type="button">场景</button><button id="asset-tab-audio" type="button">声音</button><button id="asset-tab-packs" type="button">素材包</button></nav><label>素材来源<select id="asset-source"><option value="all">全部素材</option><option value="builtin">内置及其调整</option><option value="mine">原创 / 导入</option></select></label><label>搜索<input id="asset-search" type="search" placeholder="名称、设定或标签"></label><button id="asset-create" type="button" class="create-button">＋ 新建角色</button><p id="asset-library-status" role="status" aria-live="polite">素材保存于此浏览器的独立素材库。</p><p class="project-note">内置与原创素材在这里统一管理。内置调整保存于本机；导出时保留素材的来源与许可。</p></aside>
    <div class="asset-content"><div id="asset-list" class="asset-grid"></div><section id="asset-editor" class="asset-editor" hidden aria-label="素材编辑"></section></div></div>`;
  document.querySelector('.app-shell')!.append(page);
  const get=<T extends HTMLElement>(id:string)=>page.querySelector<T>('#'+id)!;
  const status=get('asset-library-status'), list=get('asset-list'), editor=get('asset-editor');
  const navWriting=document.querySelector<HTMLButtonElement>('#writing-workspace-button')!,navAssets=document.querySelector<HTMLButtonElement>('#asset-workspace-button')!;
  let library:AssetLibraryStore|null=null, rows:Array<{pack:AssetPack;savedAt:string}>=[], tab:AssetKind|'packs'|'audio'='characters';
  let hiddenBuiltins=new Set<string>();
  let draft:Draft|null=null, dirty=false, generation:AbortController|null=null, epoch=0, saving=false, loaded=false, importEpoch=0;
  const error=(cause:unknown)=>cause instanceof Error?cause.message:'素材操作失败，请重试。';
  const message=(value:string)=>{status.textContent=value;};
  function stopGeneration():void {generation?.abort();generation=null;++epoch;}
  function leaveDraft():boolean {
    if(!audio.leave())return false;
    if(saving){message('素材正在保存，请稍候。');return false;}
    if(dirty&&!confirm('有未保存的素材修改，确定放弃这些修改吗？'))return false;
    stopGeneration();dirty=false;draft=null;editor.hidden=true;return true;
  }
  function showWriting():void {
    stopGeneration(); page.hidden=true;writing.hidden=false;document.body.classList.remove('asset-mode');
    navWriting.setAttribute('aria-pressed','true');navAssets.setAttribute('aria-pressed','false');navWriting.focus();
    if(location.hash==='#assets')history.replaceState(null,'',location.pathname+location.search);
  }
  async function refresh():Promise<void> {if(!library)return;rows=await library.list();
    const hidden=await library.readSetting<unknown>('hidden-builtins');hiddenBuiltins=new Set(Array.isArray(hidden)?hidden.filter((id):id is string=>typeof id==='string'&&builtinAssetEntries.some(entry=>entry.id===id)):[]);
    const restore=get('asset-restore-hidden');restore.hidden=!hiddenBuiltins.size;restore.textContent='恢复已移除内置素材（'+hiddenBuiltins.size+'）';hooks.visibility?.(new Set(hiddenBuiltins));await audio.load(library);renderList();}
  async function hideBuiltin(entry:BuiltinAssetEntry):Promise<void> {
    if(!library||!leaveDraft())return;
    try{const hidden=new Set(hiddenBuiltins);hidden.add(entry.id);await library.writeSetting('hidden-builtins',[...hidden]);await refresh();message('已从本机素材列表移除「'+entry.name+'」。可恢复；已有作品中的素材继续保留。');}catch(cause){message(error(cause));}
  }
  async function resetBuiltin(entry:BuiltinAssetEntry):Promise<void> {
    if(!library||!leaveDraft()||!confirm('清除「'+entry.name+'」的本机调整并恢复内置默认？已用于作品的版本会保留。'))return;
    try{await library.remove(entry.id);await refresh();message('已恢复内置默认，可选择用于当前作品。');}catch(cause){message(error(cause));}
  }
  async function editBuiltin(entry:BuiltinAssetEntry):Promise<void> {
    if(!leaveDraft())return;const current=++epoch;message('正在准备内置素材与单张动作…');
    try{const pack=rows.find(row=>row.pack.id===entry.id)?.pack??await materializeBuiltin(entry);if(current!==epoch)return;
      draft={pack:structuredClone(pack),entity:structuredClone(pack.kind==='characters'?pack.characters[0]:pack.scenes[0]),existing:true};renderEditor();message('已打开内置素材，可调整后保存或恢复默认。');}catch(cause){if(current===epoch)message(error(cause));}
  }
  async function useBuiltin(entry:BuiltinAssetEntry):Promise<void> {
    try{const pack=rows.find(row=>row.pack.id===entry.id)?.pack??await materializeBuiltin(entry);await use(pack,pack.kind==='characters'?pack.characters[0]:pack.scenes[0]);}catch(cause){message(error(cause));}
  }
  async function exportBuiltin(entry:BuiltinAssetEntry):Promise<void> {
    try{message('正在裁切并打包「'+entry.name+'」…');download(rows.find(row=>row.pack.id===entry.id)?.pack??await materializeBuiltin(entry));}catch(cause){message(error(cause));}
  }
  async function open(kind?:AssetKind):Promise<void> {
    if(hooks.prepare()===false)return;page.hidden=false;writing.hidden=true;document.body.classList.remove('outline-open','inspector-open');document.body.classList.add('asset-mode');
    navWriting.setAttribute('aria-pressed','false');navAssets.setAttribute('aria-pressed','true');
    history.replaceState(null,'',location.pathname+location.search+'#assets');
    if(kind && tab!==kind && !leaveDraft())return;
    if(kind)tab=kind;renderList();page.querySelector<HTMLElement>('h1')!.focus();
    try{if(!library)library=await openAssetLibrary();if(!loaded){await refresh();loaded=true;get<HTMLButtonElement>('asset-create').disabled=false;message('素材库已打开：24 个内置角色、192 个动作、23 个场景，以及你的素材。');}}
    catch(cause){message(error(cause));get<HTMLButtonElement>('asset-create').disabled=true;}
  }
  function chooseTab(next:AssetKind|'packs'|'audio'):void {if(!leaveDraft())return;tab=next;get<HTMLInputElement>('asset-search').value='';if(next==='audio')message('');renderList();}
  function download(pack:AssetPack,json=false):void {
    try {
      const blob=assetPackBlob(pack,json),url=URL.createObjectURL(blob),anchor=node('a');anchor.href=url;anchor.download=assetPackFilename(pack,json);anchor.click();setTimeout(()=>URL.revokeObjectURL(url),10_000);
      message(`已导出「${pack.name}」${json?'JSON':'素材包'}，包含来源和许可记录。`);
    } catch(cause){message(error(cause));}
  }
  function renderList():void {
    page.classList.toggle('is-audio-tab',tab==='audio');list.classList.toggle('asset-audio-list',tab==='audio');
    get('asset-adopt').hidden=tab==='audio';get('asset-import').hidden=tab==='audio';get('asset-format-help').hidden=tab==='audio';get('asset-restore-hidden').hidden=tab==='audio'||!hiddenBuiltins.size;
    page.querySelector('.asset-header>div>p')!.textContent=tab==='audio'?'按用途选择人物喊话、8Bit 音效和配乐。':'先建立你的素材，再选择它们进入作品。素材包可以独立保存和分享。';
    for(const kind of ['characters','scenes','audio','packs'])get('asset-tab-'+kind).setAttribute('aria-current',String(tab===kind));
    get<HTMLButtonElement>('asset-create').textContent=tab==='audio'?'＋ 新建声音':tab==='scenes'?'＋ 新建场景':tab==='packs'?'＋ 新建角色包':'＋ 新建角色';
    const search=get<HTMLInputElement>('asset-search').value.trim().toLowerCase(),source=get<HTMLSelectElement>('asset-source').value;list.replaceChildren();
    get('asset-source').parentElement!.hidden=tab==='audio';
    if(tab==='audio'){audio.render(search);return;}renderBuiltinList(search,source);
    for(const {pack} of rows) {
      if(builtinAssetEntries.some(entry=>entry.id===pack.id)|| (source==='builtin'&&!pack.origin)||(source==='mine'&&pack.origin))continue;
      if(tab==='packs') {
        if(search&&!`${pack.name} ${pack.rights.author} ${pack.rights.source}`.toLowerCase().includes(search))continue;
        const card=node('article');card.className='asset-pack-card';card.dataset.packId=pack.id;
        card.append(node('h2',pack.name),node('p',`${pack.kind==='characters'?'角色包':'场景包'} · ${pack.characters.length||pack.scenes.length} 项 · ${pack.version}`),
          node('p',`作者：${pack.rights.author||'未填写'} · 许可：${pack.rights.license||'未声明'}`));
        const controls=node('div');controls.className='asset-card-actions';controls.append(button('编辑包资料',()=>editPack(pack)),button('导出素材包',()=>download(pack)),button('导出 JSON',()=>download(pack,true)),button('删除本机包',()=>void removePack(pack)));
        card.append(controls);list.append(card);continue;
      }
      if(pack.kind!==tab)continue;
      for(const entity of tab==='characters'?pack.characters:pack.scenes) {
        if(search&&!`${entity.name} ${entity.description} ${entity.tags.join(' ')}`.toLowerCase().includes(search))continue;
        const card=node('article');card.className='asset-card';card.dataset.assetId=entity.id;card.dataset.packId=pack.id;
        const image=node('img');image.src=pack.images['portrait' in entity?entity.portrait:entity.image];image.alt=entity.name;image.loading='lazy';
        const caption=node('div');caption.className='asset-card-caption';caption.append(node('h2',entity.name),node('p',entity.description||'尚未填写设定'),node('small',`${pack.name} · ${pack.rights.license||'未声明'}${'actions'in entity?` · ${entity.actions.length} 个动作`:''}`));
        const controls=node('div');controls.className='asset-card-actions';controls.append(button('编辑',()=>editEntity(pack,entity)),button(tab==='characters'?'加入当前作品':'应用到当前场景',()=>void use(pack,entity)),button('导出所属包',()=>download(pack)));
        card.append(image,caption,controls);list.append(card);
      }
    }
    if(!list.childElementCount){const empty=node('div');empty.className='asset-empty';empty.append(node('h2',search?'没有匹配的素材':'建立你的第一份素材'),node('p',search?'可以换一个名称或标签搜索。':'上传角色立绘或场景图片，也可以使用 OpenRouter 绘图。保存后可独立导出、在其他作品中使用。'));list.append(empty);}
  }
  function renderBuiltinList(search:string,source:string):void {
    if(source==='mine'||tab==='audio')return;
    if(tab==='packs'){
      const card=node('article');card.className='asset-pack-card';card.dataset.source='builtin';
      if(search&&!('内置法庭 courtroom demo').includes(search))return;
      card.append(node('h2','内置法庭素材'),node('p','24 个角色 · 192 个动作 · 23 个场景'),node('p','可编辑立绘、动作、场景与舞台图层；调整保存在本机。'));
      const controls=node('div');controls.className='asset-card-actions';controls.append(button('管理角色',()=>chooseTab('characters')),button('管理场景',()=>chooseTab('scenes')));card.append(controls);list.append(card);return;
    }
    for(const entry of builtinAssetEntries){
      if(entry.kind!==tab||hiddenBuiltins.has(entry.id))continue;
      const saved=rows.find(row=>row.pack.id===entry.id)?.pack,entity=saved?(entry.kind==='characters'?saved.characters[0]:saved.scenes[0]):undefined;
      if(search&&!`${entry.name} ${(entry.aliases??[]).join(' ')} ${entity?entity.name+' '+entity.description+' '+entity.tags.join(' '):'内置 法庭'}`.toLowerCase().includes(search))continue;
      const card=node('article');card.className='asset-card';card.dataset.assetId=entry.entityId;card.dataset.packId=entry.id;card.dataset.source='builtin';
      const image=node('img');image.alt=entity?.name??entry.name;image.loading='lazy';
      if(saved&&entity)image.src=saved.images['portrait'in entity?entity.portrait:entity.image];else void rasterizedBuiltin(entry.preview).then(url=>{if(image.isConnected)image.src=url;}).catch(()=>{image.alt=entry.name+'（图片未加载，可重试编辑）';});
      const caption=node('div');caption.className='asset-card-caption';caption.append(node('h2',entity?.name??entry.name),node('p',entity?.description||'内置法庭素材，可自由调整本机版本'),node('small','内置'+(saved?' · 已调整':' · 默认')+(entry.kind==='characters'?' · '+(entity&&'actions'in entity?entity.actions.length:entry.actions)+' 个动作':'')));
      const controls=node('div');controls.className='asset-card-actions';controls.append(button('编辑',()=>void editBuiltin(entry)),button(entry.kind==='characters'?'用于当前作品':'应用到当前场景',()=>void useBuiltin(entry)),button('导出素材包',()=>void exportBuiltin(entry)),button('移除',()=>void hideBuiltin(entry)));
      if(saved)controls.append(button('恢复默认',()=>void resetBuiltin(entry)));card.append(image,caption,controls);list.append(card);
    }
  }
  async function use(pack:AssetPack,entity:AssetCharacter|AssetScene):Promise<void> {
    if(saving||generation)return;
    try{if(await hooks.use(pack,'portrait'in entity?entity.id:undefined,'image'in entity?entity.image:undefined))message('portrait'in entity?`已将「${entity.name}」加入当前作品。素材库原件保留，可继续编辑。`:`已将「${entity.name}」应用到当前场景。素材库原件保留，可继续编辑。`);}
    catch(cause){message(error(cause));}
  }
  async function removePack(pack:AssetPack):Promise<void> {
    const builtin=builtinAssetEntries.find(entry=>entry.id===pack.id);if(builtin){await hideBuiltin(builtin);return;}
    if(!library||!leaveDraft()||!confirm(`删除素材库中的「${pack.name}」？已经加入作品的副本会保留。`))return;
    try{await library.remove(pack.id);await refresh();message('已删除本机素材包，作品中的副本保留。');}catch(cause){message(error(cause));}
  }
  function begin(kind:AssetKind,target?:AssetPack):void {
    if(!leaveDraft())return;
    const pack=structuredClone(target??rows.find(row=>row.pack.kind===kind&&row.pack.name===(kind==='characters'?'我的原创角色':'我的原创场景'))?.pack??newAssetPack(kind,kind==='characters'?'我的原创角色':'我的原创场景'));
    const id=`${kind==='characters'?'character':'scene'}-${crypto.randomUUID()}`;
    const entity:AssetCharacter|AssetScene=kind==='characters'?{id,name:'',description:'',tags:[],portrait:`image-${crypto.randomUUID()}`,actions:[]}:{id,name:'',description:'',tags:[],image:`image-${crypto.randomUUID()}`};
    draft={pack,entity,existing:false};renderEditor();
  }
  function editEntity(pack:AssetPack,entity:AssetCharacter|AssetScene):void {
    if(!leaveDraft())return;draft={pack:structuredClone(pack),entity:structuredClone(entity),existing:true};renderEditor();
  }
  function editPack(pack:AssetPack):void {
    if(!leaveDraft())return;
    editor.hidden=false;editor.replaceChildren(node('h2','素材包资料'));
    const form=node('form');form.id='asset-pack-form';editor.append(form);
    const fields=[['name','包名称',pack.name],['version','版本',pack.version],['author','作者',pack.rights.author],['source','来源',pack.rights.source],['license','许可 / 使用范围',pack.rights.license],['notes','说明',pack.rights.notes]];
    for(const [key,label,value] of fields){const wrapper=node('label',label),input=key==='notes'?node('textarea'):node('input');input.name=key;input.value=value;input.maxLength=key==='notes'?4000:key==='name'?120:key==='version'?40:1000;wrapper.append(input);form.append(wrapper);}
    form.append(node('p','来源与许可由作者填写。未声明的素材可以本机编辑；分享前请核实使用范围。'));
    const save=node('button','保存包资料');save.type='submit';save.className='create-button';form.append(save,button('取消',()=>leaveDraft()));
    form.oninput=()=>{dirty=true;};
    form.onsubmit=event=>{event.preventDefault();void savePackMetadata(pack,form);};
  }
  async function savePackMetadata(pack:AssetPack,form:HTMLFormElement):Promise<void> {
    if(!library||saving)return;saving=true;
    try{
      const data=new FormData(form),next=structuredClone(pack);next.name=String(data.get('name')).trim();next.version=String(data.get('version')).trim();
      for(const key of ['author','source','license','notes'] as const)next.rights[key]=String(data.get(key)).trim();
      await library.save(next);dirty=false;editor.hidden=true;await refresh();message('素材包资料已保存。');
    }catch(cause){message(error(cause));}finally{saving=false;}
  }
  function renderEditor():void {
    if(!draft)return;const {pack,entity}=draft,isCharacter='portrait'in entity;
    editor.hidden=false;
    editor.innerHTML=`<div class="story-heading"><h2>${draft.existing?'编辑':'新建'}${isCharacter?'角色':'场景'}</h2><button id="asset-edit-close" type="button" class="small-button">收起编辑</button></div>
      <form id="asset-form"><div class="asset-form-grid"><label>名称<input name="name" required maxlength="80"></label><label>所属素材包<select id="asset-target-pack"></select></label><label class="wide">${isCharacter?'人物设定':'场景说明'}<textarea name="description" maxlength="4000" rows="3"></textarea></label><label class="wide">标签（逗号分隔）<input name="tags" maxlength="820" placeholder="例如：侦探、原创、现代"></label></div>
      <p class="project-note">PNG / JPEG / WebP，最多 10 MB；等比缩至最长边 768 px，默认 WebP 质量参数 0.76。完整规则见上方说明。</p><div class="asset-image-editor"><div id="asset-image-preview" class="asset-image-preview"><img alt="${isCharacter?'角色立绘':'场景背景'}预览"><span>上传图片或生成预览</span></div><div><label>图片方式<select id="asset-image-mode"><option value="manual">手动上传</option><option value="ai">OpenRouter AI 生成</option></select></label><div id="asset-upload-fields"><label>PNG、JPEG 或 WebP<input id="asset-image-file" type="file" accept="image/png,image/jpeg,image/webp"></label></div><div id="asset-ai-fields" hidden><label>图片模型<input id="asset-image-model" list="asset-image-model-options" placeholder="选择或填写图片模型 ID"><datalist id="asset-image-model-options"></datalist></label><div class="story-actions"><button id="asset-ai-connect" type="button" class="small-button">AI 连接设置</button><button id="asset-ai-refresh" type="button" class="small-button">刷新绘图模型</button></div><p id="asset-image-model-status" class="project-note" role="status"></p><label>图像描述<textarea id="asset-image-prompt" rows="3" maxlength="3500" placeholder="外观、服装、姿态、画风或场景氛围"></textarea></label><button id="asset-ai-generate" type="button" class="secondary-button">生成图片（一次请求）</button><button id="asset-ai-cancel" type="button" class="small-button" hidden>取消生成</button><p class="project-note">绘图模型需要余额，按所选模型计费。生成后先预览，保存前不会写入素材库。</p></div></div></div>
      <p id="asset-image-info" class="project-note"></p><section id="asset-stage-layers"></section>
      <section id="asset-actions-section"${isCharacter?'':' hidden'}><h3>动作与表情</h3><p class="project-note">可以替换动作图片或增加任意动作。原有动作 ID 在编辑中保留。</p><div id="asset-action-list"></div><div class="asset-form-grid"><label>新动作名称<input id="asset-action-label" maxlength="40" placeholder="例如：思考"></label><label>动作类别<select id="asset-action-kind"><option value="pose">姿态</option><option value="reaction">表情 / 反应</option></select></label><label>动作图片<input id="asset-action-file" type="file" accept="image/png,image/jpeg,image/webp"></label><div class="story-actions"><button id="asset-action-add" type="button" class="small-button">添加上传的动作</button><button id="asset-action-ai" type="button" class="small-button">参考立绘生成此动作</button></div></div><p class="project-note">参考生成会发送当前立绘，模型须支持参考图片；动作效果和人物一致性需要预览确认。</p></section>
      <details class="asset-rights"><summary>素材包名称、来源与许可</summary><label>素材包名称<input name="packName" required maxlength="120"></label><div class="asset-form-grid"><label>作者<input name="author" maxlength="1000"></label><label>来源<input name="source" maxlength="1000" placeholder="例如：自己绘制 / AI 生成"></label><label>许可 / 使用范围<input name="license" maxlength="1000" list="asset-license-options"><datalist id="asset-license-options"><option value="未声明"><option value="仅供个人使用"><option value="CC0-1.0"><option value="CC-BY-4.0"><option value="保留所有权利"></datalist></label><label>说明<textarea name="notes" rows="2" maxlength="4000"></textarea></label></div><p class="project-note">许可按素材真实来源填写；AI 生成或独立导出不自动赋予任何第三方素材的使用权。</p></details>
      <p id="asset-edit-status" role="status" aria-live="polite"></p><div class="dialog-actions"><button id="asset-edit-save" type="submit" class="create-button">保存到素材库</button><button id="asset-use-saved" type="button" class="secondary-button"${draft.existing?'':' hidden'}>将保存版本用于当前作品</button><button id="asset-item-delete" type="button" class="small-button danger-quiet"${draft.existing?'':' hidden'}>删除此素材</button></div></form>`;
    const form=get<HTMLFormElement>('asset-form');
    const set=(key:string,value:string)=>(form.elements.namedItem(key) as HTMLInputElement).value=value;
    set('name',entity.name);set('description',entity.description);set('tags',entity.tags.join('，'));set('packName',pack.name);
    for(const field of ['author','source','license','notes'] as const)set(field,pack.rights[field]);
    const target=get<HTMLSelectElement>('asset-target-pack');target.add(new Option(pack.name,pack.id));
    if(!draft.existing){for(const row of rows.filter(row=>row.pack.kind===pack.kind&&!row.pack.origin&&row.pack.id!==pack.id))target.add(new Option(row.pack.name,row.pack.id));target.add(new Option('建立新的素材包','new'));}
    target.disabled=draft.existing;
    target.onchange=()=>{
      if(!draft)return;const currentEntity=draft.entity,currentImages=draft.pack.images;readFields();
      const next=target.value==='new'?newAssetPack(pack.kind,pack.kind==='characters'?'新角色包':'新场景包'):structuredClone(rows.find(row=>row.pack.id===target.value)!.pack);
      const used='portrait'in currentEntity?[currentEntity.portrait,...currentEntity.actions.map(action=>action.image),...(currentEntity.stage?[currentEntity.stage.background,...(currentEntity.stage.foreground?[currentEntity.stage.foreground]:[])]:[])]:[currentEntity.image,...(currentEntity.foreground?[currentEntity.foreground]:[])];
      for(const key of used)if(currentImages[key])next.images[key]=currentImages[key];draft.pack=next;renderEditor();dirty=true;
    };
    get('asset-edit-close').onclick=()=>leaveDraft();
    get<HTMLSelectElement>('asset-image-mode').onchange=()=>{
      stopGeneration();const ai=get<HTMLSelectElement>('asset-image-mode').value==='ai';get('asset-ai-fields').hidden=!ai;get('asset-upload-fields').hidden=ai;
      if(ai)void refreshModels();
    };
    get<HTMLInputElement>('asset-image-model').value=hooks.connection.model('image');
    get('asset-ai-connect').onclick=()=>hooks.connection.open();get('asset-ai-refresh').onclick=()=>void refreshModels(true);
    get<HTMLInputElement>('asset-image-model').onchange=()=>hooks.connection.setModel('image',get<HTMLInputElement>('asset-image-model').value);
    get<HTMLInputElement>('asset-image-file').onchange=()=>void uploadPortrait();
    get('asset-ai-generate').onclick=()=>void generateImage(false);get('asset-ai-cancel').onclick=()=>stopGeneration();
    get('asset-action-add').onclick=()=>void addAction(false);get('asset-action-ai').onclick=()=>void generateImage(true);
    get('asset-use-saved').onclick=()=>{const saved=rows.find(row=>row.pack.id===draft?.pack.id)?.pack;if(!saved){editMessage('请先保存调整，再用于当前作品。');return;}if(saved)void use(saved,('portrait'in entity?saved.characters:saved.scenes).find(item=>item.id===entity.id)!);};
    get('asset-item-delete').onclick=()=>void deleteEntity();
    form.oninput=event=>{if((event.target as HTMLInputElement).name)dirty=true;};form.onsubmit=event=>{event.preventDefault();void saveEntity();};
    renderImage();renderActions();renderStageLayers();editor.scrollIntoView({block:'start',behavior:'smooth'});
  }
  function renderImage():void {
    if(!draft)return;const image=draft.pack.images['portrait'in draft.entity?draft.entity.portrait:draft.entity.image];
    const preview=get('asset-image-preview');preview.classList.toggle('has-image',!!image);const target=preview.querySelector('img')!,info=get('asset-image-info');target.onload=()=>{info.textContent=target.naturalWidth+'×'+target.naturalHeight+' px · '+(image?.slice(5,image.indexOf(';'))??'')+' · 约 '+Math.round((image?.split(',')[1].length??0)*0.75/1024)+' KB';};if(image){target.src=image;if(target.complete)target.onload?.(new Event('load'));}else{target.removeAttribute('src');info.textContent='';}
  }
  function renderActions():void {
    const target=get('asset-action-list');target.replaceChildren();if(!draft||!('actions'in draft.entity))return;
    for(const action of draft.entity.actions){
      const row=node('div');row.className='asset-action-row';row.dataset.actionId=action.id;
      const image=node('img');image.src=draft.pack.images[action.image];image.alt=action.label;image.onload=()=>{image.title=image.naturalWidth+'×'+image.naturalHeight+' px';};
      const label=node('input');label.value=action.label;label.maxLength=40;label.setAttribute('aria-label','动作名称');label.oninput=()=>{action.label=label.value;dirty=true;};
      const kind=node('select');kind.add(new Option('姿态','pose'));kind.add(new Option('表情 / 反应','reaction'));kind.value=action.kind;kind.setAttribute('aria-label','动作类别');kind.onchange=()=>{action.kind=kind.value as AssetAction['kind'];dirty=true;};
      const upload=node('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp';upload.setAttribute('aria-label',`替换 ${action.label} 图片`);
      upload.onchange=()=>{const captured=draft;const current=++epoch;void normalizeCharacterImageFromFile(upload.files?.[0]).then(image=>{if(draft!==captured||current!==epoch)return;action.image=`image-${crypto.randomUUID()}`;draft!.pack.images[action.image]=image;dirty=true;renderActions();}).catch(cause=>editMessage(error(cause)));};
      const remove=button('移除',()=>{if(!draft||!('actions'in draft.entity))return;draft.entity.actions=draft.entity.actions.filter(item=>item.id!==action.id);dirty=true;renderActions();});
      row.append(image,label,kind,upload,remove);target.append(row);
    }
  }
  function renderStageLayers():void {
    const target=get('asset-stage-layers');target.replaceChildren();if(!draft)return;
    target.append(node('h3','舞台图层'),node('p','背景建议 768×576；前景使用透明 PNG / WebP。角色动作与舞台图层分别保存。'));
    for(const layer of ('portrait'in draft.entity?['background','foreground']:['foreground']) as Array<'background'|'foreground'>){
      const entity=draft.entity,key='portrait'in entity?entity.stage?.[layer]:entity.foreground;
      const row=node('div');row.className='asset-layer-row';const preview=node('img');preview.alt=layer==='background'?'角色舞台背景':'舞台前景';if(key)preview.src=draft.pack.images[key];
      const label=node('label',layer==='background'?'角色舞台背景（可选）':'透明舞台前景（可选）'),upload=node('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp';upload.dataset.layer=layer;label.append(upload);
      upload.onchange=()=>{const captured=draft,current=++epoch;void normalizeCharacterImageFromFile(upload.files?.[0]).then(image=>{if(!draft||draft!==captured||current!==epoch)return;
        const imageId='image-'+crypto.randomUUID();draft.pack.images[imageId]=image;
        if('portrait'in draft.entity){if(!draft.entity.stage){const background='image-'+crypto.randomUUID();draft.pack.images[background]=neutralStageImage();draft.entity.stage={background};}draft.entity.stage[layer]=imageId;}else draft.entity.foreground=imageId;
        dirty=true;renderStageLayers();editMessage('舞台图层已准备，请保存。');}).catch(cause=>{if(current===epoch)editMessage(error(cause));});};
      row.append(preview,label);if(key)row.append(button(layer==='background'?'改为中性舞台':'移除前景',()=>{if(!draft)return;if('portrait'in draft.entity){if(layer==='background'){const background='image-'+crypto.randomUUID();draft.pack.images[background]=neutralStageImage();draft.entity.stage={background};}else if(draft.entity.stage)delete draft.entity.stage.foreground;}else delete draft.entity.foreground;dirty=true;renderStageLayers();}));target.append(row);
    }
  }
  const editMessage=(value:string)=>{const target=page.querySelector('#asset-edit-status');if(target)target.textContent=value;else message(value);};
  async function normalizeCharacterImageFromFile(file:File|undefined):Promise<string>{return normalizeCharacterImage(await imageFileData(file));}
  async function uploadPortrait():Promise<void> {
    const captured=draft,current=++epoch;
    try{const image=await normalizeCharacterImageFromFile(get<HTMLInputElement>('asset-image-file').files?.[0]);if(!draft||draft!==captured||current!==epoch)return;
      draft.pack.images['portrait'in draft.entity?draft.entity.portrait:draft.entity.image]=image;dirty=true;renderImage();editMessage('图片已准备，请检查并保存到素材库。');}
    catch(cause){if(current===epoch)editMessage(error(cause));}
  }
  function readFields():void {
    if(!draft)return;const data=new FormData(get<HTMLFormElement>('asset-form'));
    draft.entity.name=String(data.get('name')).trim();draft.entity.description=String(data.get('description')).trim();
    draft.entity.tags=String(data.get('tags')).split(/[,，、]/).map(value=>value.trim()).filter(Boolean);
    draft.pack.name=String(data.get('packName')).trim();for(const key of ['author','source','license','notes'] as const)draft.pack.rights[key]=String(data.get(key)).trim();
  }
  async function refreshModels(force=false):Promise<void> {
    await hooks.connection.refreshOptions('image',get<HTMLDataListElement>('asset-image-model-options'),get('asset-image-model-status'),force);
  }
  async function addAction(generated:boolean,image?:string):Promise<void> {
    if(!draft||!('actions'in draft.entity))return;
    const captured=draft,current=generated?epoch:++epoch;
    try {
      const label=get<HTMLInputElement>('asset-action-label').value.trim();if(!label)throw new Error('请填写新动作名称。');
      const data=image??await normalizeCharacterImageFromFile(get<HTMLInputElement>('asset-action-file').files?.[0]);
      if(draft!==captured||current!==epoch)return;
      const imageId=`image-${crypto.randomUUID()}`;draft.pack.images[imageId]=data;draft.entity.actions.push({id:`action-${crypto.randomUUID()}`,label,kind:get<HTMLSelectElement>('asset-action-kind').value as AssetAction['kind'],image:imageId});
      dirty=true;renderActions();get<HTMLInputElement>('asset-action-label').value='';get<HTMLInputElement>('asset-action-file').value='';editMessage('动作已加入预览，保存后进入素材库。');
    }catch(cause){if(current===epoch)editMessage(error(cause));}
  }
  async function generateImage(action:boolean):Promise<void> {
    if(!draft||generation||saving)return;readFields();const captured=draft,current=++epoch;
    const actor='portrait'in draft.entity, name=draft.entity.name,description=get<HTMLTextAreaElement>('asset-image-prompt').value.trim()||draft.entity.description;
    const actionName=get<HTMLInputElement>('asset-action-label').value.trim();
    if(!name||(!action&&!description)|| (action&&!actionName)){editMessage('请填写素材名称、图像描述；生成动作时还需动作名称。');return;}
    const reference='portrait'in draft.entity?draft.pack.images[draft.entity.portrait]:undefined;
    if(action&&!reference){editMessage('请先上传或生成角色立绘，再生成动作。');return;}
    const controller=new AbortController();generation=controller;const timer=window.setTimeout(()=>controller.abort(),240_000);
    const form=get<HTMLFormElement>('asset-form');form.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement|HTMLTextAreaElement>('input,button,select,textarea').forEach(element=>element.disabled=true);
    get<HTMLButtonElement>('asset-ai-cancel').disabled=false;get('asset-ai-cancel').hidden=false;
    editMessage(action?'正在参考立绘生成动作…':'正在调用 OpenRouter 生成图片…');
    try {
      const model=get<HTMLInputElement>('asset-image-model').value.trim();let capabilities;
      try{capabilities=await hooks.connection.imageCapabilities(model);}catch{/* Manual model IDs can still use the default parameter set. */}
      if(controller.signal.aborted)throw new Error('图片生成已取消。');
      const prompt=action?`Original theatre character: ${name}. Preserve the same identity, clothing and art style as the reference image. Action/expression: ${actionName}. ${description}. One character, clean silhouette, plain or transparent background, no letters, logo or watermark.`
        :actor?`Original character for a small theatre. Name: ${name}. Appearance: ${description}. One character, waist-up or full-body, centered, clean silhouette, plain or transparent background. No lettering, logo or watermark.`
          :`Original small-theatre background: ${name}. ${description}. Wide composition, no people, no lettering, logo or watermark.`;
      const result=await requestCharacterImage({provider:'openrouter',model,apiKey:hooks.connection.key(),prompt,transparent:actor,capabilities,referenceImage:action?reference:undefined},controller.signal);
      const image=await normalizeCharacterImage(result);
      if(controller.signal.aborted||draft!==captured||current!==epoch)return;
      if(action)await addAction(true,image);else{draft.pack.images[actor?(draft.entity as AssetCharacter).portrait:(draft.entity as AssetScene).image]=image;renderImage();dirty=true;}
      editMessage('生成完成。请检查图片和动作，满意后保存到素材库。');
    }catch(cause){if(draft===captured)editMessage(error(cause));}
    finally {
      window.clearTimeout(timer);if(generation===controller)generation=null;
      if(draft===captured){form.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement|HTMLTextAreaElement>('input,button,select,textarea').forEach(element=>element.disabled=false);get<HTMLSelectElement>('asset-target-pack').disabled=draft.existing;get('asset-ai-cancel').hidden=true;}
    }
  }
  async function saveEntity():Promise<void> {
    if(!draft||!library||saving||generation)return;readFields();const captured=draft;
    saving=true;get<HTMLButtonElement>('asset-edit-save').disabled=true;
    try {
      const pack=structuredClone(draft.pack),entity=structuredClone(draft.entity);
      const image='portrait'in entity?entity.portrait:entity.image;if(!pack.images[image])throw new Error('请先上传或生成图片，再保存素材。');
      if('actions'in entity){if(!entity.actions.some(action=>action.kind==='pose') && !draft.existing)entity.actions.push({id:'normal',label:'平常',kind:'pose',image:entity.portrait});if(!entity.actions.some(action=>action.kind==='pose'))throw new Error('角色至少需要一个姿态动作；可以替换平常动作的图片。');pack.characters=pack.characters.filter(actor=>actor.id!==entity.id).concat(entity);}
      else pack.scenes=pack.scenes.filter(scene=>scene.id!==entity.id).concat(entity);
      await library.save(validateAssetPack(pruneAssetImages(pack)));dirty=false;await refresh();
      draft={pack,entity,existing:true};renderEditor();editMessage('已保存到独立素材库。可加入当前作品或导出所属素材包。');message(`「${entity.name}」已保存。`);
    }catch(cause){if(draft===captured)editMessage(error(cause));}
    finally{saving=false;if(draft)get<HTMLButtonElement>('asset-edit-save').disabled=false;}
  }
  async function deleteEntity():Promise<void> {
    const builtin=builtinAssetEntries.find(entry=>entry.id===draft?.pack.id);if(builtin){await hideBuiltin(builtin);return;}
    if(!draft||!library||saving||!confirm(`从素材库删除「${draft.entity.name}」？已加入作品的副本会保留。`))return;
    const pack=structuredClone(draft.pack),id=draft.entity.id;
    pack.characters=pack.characters.filter(actor=>actor.id!==id);pack.scenes=pack.scenes.filter(scene=>scene.id!==id);
    try{if(pack.characters.length||pack.scenes.length)await library.save(pruneAssetImages(pack));else await library.remove(pack.id);dirty=false;stopGeneration();draft=null;editor.hidden=true;await refresh();message('已删除素材，作品中的副本保留。');}catch(cause){editMessage(error(cause));}
  }
  async function adopt():Promise<void> {
    if(!library||saving||!leaveDraft())return;
    try {const packs=ownedAssetPacks(hooks.snapshot());let count=0;for(const pack of packs){if(rows.some(row=>row.pack.id===pack.id))continue;await library.save(pack);count++;}await refresh();message(count?`已收录 ${count} 个作品自有素材包，原作品未改变。`:'没有新的自有素材可收录；内置主题包不会复制进导出包。');}
    catch(cause){message(error(cause));}
  }
  const importDialog=node('dialog');importDialog.className='project-dialog story-dialog';importDialog.setAttribute('aria-label','导入素材包预览');
  importDialog.innerHTML='<div class="story-body"><h2>导入素材包</h2><p id="asset-import-summary"></p><p id="asset-import-rights"></p><label>同 ID 素材包处理<select id="asset-import-collision"><option value="copy">作为新副本保留（推荐）</option><option value="replace">替换素材库中相同 ID 的包</option></select></label><p class="project-note">导入只更新独立素材库。当前作品不会被替换；来源和许可信息需要自行核实。</p><div class="dialog-actions"><button id="asset-import-cancel" type="button" class="secondary-button">取消</button><button id="asset-import-confirm" type="button" class="create-button">确认导入素材库</button></div></div>';
  document.body.append(importDialog);let pendingImport:AssetPack|null=null;
  importDialog.querySelector<HTMLButtonElement>('#asset-import-cancel')!.onclick=()=>{++importEpoch;pendingImport=null;importDialog.close();};
  importDialog.addEventListener('cancel',()=>{++importEpoch;pendingImport=null;});
  importDialog.querySelector<HTMLButtonElement>('#asset-import-confirm')!.onclick=()=>void (async()=>{
    if(!pendingImport||!library)return;const confirmButton=importDialog.querySelector<HTMLButtonElement>('#asset-import-confirm')!;confirmButton.disabled=true;
    try{const pack=structuredClone(pendingImport);if(rows.some(row=>row.pack.id===pack.id)&&importDialog.querySelector<HTMLSelectElement>('#asset-import-collision')!.value==='copy')pack.id=`local.asset.${crypto.randomUUID()}`;
      await library.save(pack);pendingImport=null;importDialog.close();tab=pack.kind;await refresh();message(`已导入「${pack.name}」；可编辑或选择素材进入作品。`);
    }catch(cause){message(error(cause));}finally{confirmButton.disabled=false;}
  })();
  get<HTMLInputElement>('asset-import-file').onchange=()=>void (async()=>{
    const file=get<HTMLInputElement>('asset-import-file').files?.[0];get<HTMLInputElement>('asset-import-file').value='';if(!file||!leaveDraft())return;const current=++importEpoch;
    try{const pack=await readAssetPack(file);if(current!==importEpoch)return;pendingImport=pack;
      importDialog.querySelector('#asset-import-summary')!.textContent=`${pack.name} · ${pack.kind==='characters'?'角色包':'场景包'} · ${pack.characters.length||pack.scenes.length} 项 · ${Object.keys(pack.images).length} 张图片 · 版本 ${pack.version}`;
      importDialog.querySelector('#asset-import-rights')!.textContent=`作者：${pack.rights.author||'未填写'}；来源：${pack.rights.source||'未填写'}；许可：${pack.rights.license||'未声明'}`;
      const collision=importDialog.querySelector<HTMLSelectElement>('#asset-import-collision')!;collision.value='copy';collision.parentElement!.hidden=!rows.some(row=>row.pack.id===pack.id);importDialog.showModal();
    }catch(cause){if(current===importEpoch)message(error(cause));}
  })();
  get('asset-create').onclick=()=>tab==='audio'?audio.begin():begin(tab==='scenes'?'scenes':'characters',tab==='packs'?newAssetPack('characters','新角色包'):undefined);get('asset-adopt').onclick=()=>void adopt();get('asset-import').onclick=()=>get<HTMLInputElement>('asset-import-file').click();
  get<HTMLInputElement>('asset-search').oninput=renderList;get<HTMLSelectElement>('asset-source').onchange=renderList;
  get('asset-restore-hidden').onclick=()=>void (async()=>{if(!library)return;try{await library.writeSetting('hidden-builtins',[]);await refresh();message('已恢复所有移除的内置素材；已保存的调整保留。');}catch(cause){message(error(cause));}})();
  const help=node('dialog');help.className='project-dialog story-dialog asset-help-dialog';help.setAttribute('aria-label','素材格式、尺寸与压缩');const helpBody=node('div');helpBody.className='story-body';helpBody.innerHTML=IMAGE_HELP_HTML;helpBody.append(button('关闭说明',()=>help.close()));help.append(helpBody);document.body.append(help);get('asset-format-help').onclick=()=>help.showModal();
  const audio=installAudioWorkspace(list,editor,{notice:message,prepare:leaveDraft,apply:hooks.audio});
  void (async()=>{try{library=await openAssetLibrary();await refresh();loaded=true;message('素材库已打开：24 个内置角色、192 个动作、23 个场景，以及你的素材。');}catch{/* Opening the workspace reports database failures. */}})();
  for(const kind of ['characters','scenes','audio','packs'] as const)get('asset-tab-'+kind).onclick=()=>chooseTab(kind);
  navAssets.onclick=()=>void open();
  const close=()=>{if(!page.hidden&&!leaveDraft())return false;showWriting();return true;};
  navWriting.onclick=()=>close();
  window.addEventListener('beforeunload',event=>{if(dirty||saving){event.preventDefault();event.returnValue='';}});
  window.addEventListener('yahari:ai-connection-updated',()=>{
    if(!draft||editor.hidden||generation)return;get<HTMLInputElement>('asset-image-model').value=hooks.connection.model('image');
    if(get<HTMLSelectElement>('asset-image-mode').value==='ai')void refreshModels();
  });
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'&&!page.hidden){event.preventDefault();event.stopImmediatePropagation();if(draft)void saveEntity();else if(page.querySelector<HTMLFormElement>('#asset-audio-form')&&!editor.hidden)page.querySelector<HTMLFormElement>('#asset-audio-form')!.requestSubmit();else if(page.querySelector<HTMLFormElement>('#asset-pack-form')&&!editor.hidden)page.querySelector<HTMLFormElement>('#asset-pack-form')!.requestSubmit();else message('素材已独立保存；选择素材后可编辑或导出。');}},true);
  if(location.hash==='#assets')queueMicrotask(()=>void open());
  return {open,close};
}
