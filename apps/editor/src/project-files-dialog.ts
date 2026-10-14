import { decodeProjectFile, type ProjectFileCatalog, type YahariProjectFile } from '../../../packages/core/src/index.js';
import { readProjectInput } from '../../../packages/project-io/src/index.js';
import type { ProjectLibrary } from './project-library.js';
import { embeddedCourtroomPack } from './project-assets.js';

interface FileDialogHooks {
  library: ProjectLibrary | null;
  catalog: ProjectFileCatalog;
  snapshot(): YahariProjectFile;
  save(label?:string): Promise<boolean>;
  activate(project:YahariProjectFile, documentId?:string): boolean;
  legacy(document: import('../../../packages/core/src/index.js').ScriptDocument): void;
  notice(message:string,error?:boolean): void;
}
export function installProjectFilesDialog(hooks:FileDialogHooks): {open():void;import(file:File):Promise<void>} {
  const get=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
  const libraryDialog=get<HTMLDialogElement>('files-dialog'), importDialog=get<HTMLDialogElement>('import-preview-dialog');
  const status=get('files-status'), rows=get('files-list'), history=get('files-history');
  let pending: YahariProjectFile | null = null;
  let importEpoch=0, listEpoch=0;
  const date=(value:string)=>new Date(value).toLocaleString('zh-CN',{hour12:false});
  const button=(text:string,run:()=>Promise<void>)=>{
    const node=document.createElement('button'); node.type='button'; node.className='small-button'; node.textContent=text;
    node.addEventListener('click',async()=>{node.disabled=true;try{await run();}catch(error){status.textContent=error instanceof Error?error.message:'操作失败。';}finally{node.disabled=false;}});
    return node;
  };
  async function refresh():Promise<void> {
    const epoch=++listEpoch;
    rows.replaceChildren(); history.replaceChildren();
    if (!hooks.library) { status.textContent='本机作品库不可用，当前使用浏览器草稿；请导出作品文件备份。'; return; }
    const id=hooks.snapshot().manifest.projectId;
    const [projects,revisions]=await Promise.all([hooks.library.list(),hooks.library.revisions(id)]);
    if (epoch!==listEpoch) return;
    status.textContent=projects.length?`本机保存了 ${projects.length} 个作品。`:'还没有保存的作品。';
    for (const item of projects) {
      const row=document.createElement('article'); row.className='saved-project-row';
      const description=document.createElement('div'), title=document.createElement('strong'), detail=document.createElement('small');
      title.textContent=item.title+(item.id===id?' · 当前':''); detail.textContent=`${item.project.documents.length} 场 · ${date(item.savedAt)}`;
      description.append(title,detail); row.append(description);
      row.append(button('打开',async()=>{
        if (!await hooks.save('切换作品前')) { status.textContent='当前作品保存失败，请先导出。'; return; }
        const loaded=await hooks.library!.load(item.id);
        if (loaded && hooks.activate(loaded.project,loaded.activeDocumentId)) { libraryDialog.close(); hooks.notice(`已打开「${item.title}」。`); }
      }));
      if (item.id!==id) row.append(button('删除本机副本',async()=>{
        if (!confirm(`删除本机的「${item.title}」及其恢复点？已导出的文件不受影响。`)) return;
        await hooks.library!.remove(item.id); await refresh();
      }));
      rows.append(row);
    }
    for (const item of revisions) {
      const row=document.createElement('article'); row.className='saved-project-row';
      const text=document.createElement('span'); text.textContent=`${item.label} · ${date(item.savedAt)}`; row.append(text);
      row.append(button('恢复此版本',async()=>{
        const loaded=await hooks.library!.load(id,item.revisionId);
        if (!loaded || !await hooks.save('恢复版本前')) { status.textContent='未能保留当前版本，请先导出。'; return; }
        if (hooks.activate(loaded.project,loaded.activeDocumentId)) { libraryDialog.close(); hooks.notice('已恢复；恢复前版本仍保留在恢复点中。'); }
      })); history.append(row);
    }
    if (!revisions.length) history.textContent='点击“保存”或切换作品时建立恢复点，保留最近 8 个。';
  }
  function open():void {
    libraryDialog.showModal(); status.textContent='正在读取本机作品…';
    void hooks.save().then(saved=>{if(!saved)status.textContent='当前保存失败，请先导出。';return refresh();}).catch(()=>{status.textContent='本机作品库无法读取，请导出备份。';});
  }
  get('files-close').addEventListener('click',()=>libraryDialog.close());
  for (const id of ['import-preview-close','import-preview-cancel']) get(id).addEventListener('click',()=>{importEpoch++;pending=null;importDialog.close();});
  importDialog.addEventListener('cancel',()=>{importEpoch++;pending=null;});
  get('import-preview-confirm').addEventListener('click',async()=>{
    if (!pending) return;
    const button=get<HTMLButtonElement>('import-preview-confirm'); button.disabled=true;
    const project=structuredClone(pending);
    const epoch=importEpoch;
    try {
      if (!await hooks.save('导入作品前')) throw new Error('当前作品未能保存，请先导出后再导入。');
      const existing=await hooks.library?.list();
      if(epoch!==importEpoch)return;
      if (project.manifest.projectId===hooks.snapshot().manifest.projectId || existing?.some(item=>item.id===project.manifest.projectId)) {
        project.manifest.projectId=`import-${crypto.randomUUID()}`;
      }
      if (hooks.activate(project)) {
        pending=null; importDialog.close(); if(libraryDialog.open)libraryDialog.close();
        hooks.notice(`已导入「${project.manifest.title}」；原作品保留在本机作品库。`);
      }
    } catch (error) { get('import-preview-status').textContent=error instanceof Error?error.message:'导入失败。'; }
    finally { button.disabled=false; }
  });
  async function importFile(file:File):Promise<void> {
    const epoch=++importEpoch; pending=null;
    get<HTMLButtonElement>('import-preview-confirm').disabled=true;
    get('import-preview-title').textContent='读取作品文件'; get('import-preview-summary').textContent=file.name;
    get('import-preview-status').textContent='正在检查文件与素材…';
    if (!importDialog.open) importDialog.showModal();
    try {
      const input=await readProjectInput(file);
      if (epoch!==importEpoch) return;
      const decoded=decodeProjectFile(input,hooks.catalog);
      if (!decoded.ok) throw new Error('文件结构不完整或版本不受支持，当前作品未更改。');
      if (decoded.kind==='unbound-document') { importDialog.close(); hooks.legacy(decoded.document); return; }
      if (decoded.project.embeddedPacks?.some(item=>!embeddedCourtroomPack(item))) throw new Error('作品中的素材包格式不完整，当前作品未更改。');
      pending=decoded.project;
      const project=pending, images=project.embeddedPacks?.reduce((n,pack)=>n+Object.keys(pack.resources).length,0) ?? 0;
      get('import-preview-title').textContent=project.manifest.title;
      get('import-preview-summary').textContent=`${project.manifest.narrative?.chapters.length ?? 0} 章 · ${project.documents.length} 场 · ${project.manifest.cast.length} 人 · ${images} 张自有图片 · ${(file.size/1024).toFixed(1)} KB\n${project.manifest.narrative?.summary ?? ''}`;
      get('import-preview-status').textContent=decoded.availability==='ready'
        ? '检查通过。导入后会保留当前作品；已有同一作品时建立副本。'
        : '缺少适配器或主题包。可以只读打开，数据和素材仍可完整导出。';
      get<HTMLButtonElement>('import-preview-confirm').disabled=false;
    } catch (error) {
      if(epoch===importEpoch)get('import-preview-status').textContent=error instanceof Error?error.message:'文件读取失败。';
    }
  }
  return {open,import:importFile};
}
