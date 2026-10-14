import { orderedSceneIds, sceneExit, validateFlow, type SceneExit, type ScriptDocument, type YahariProjectFile } from '../../../packages/core/src/index.js';
import { installStoryMap } from './story-map.js';

interface StoryWorkspaceHooks {
  snapshot(): YahariProjectFile;
  activeDocumentId(): string;
  editable(): boolean;
  prepare(): boolean;
  apply(project: YahariProjectFile, checkpoint?: boolean): boolean;
  save(): Promise<void>;
  edit(documentId: string, blockId?: string): void;
  thumbnail(id:string):string|undefined;
  backgrounds(): Array<{id:string;label:string}>;
  background(documentId: string): string | undefined;
  withBackground(document: ScriptDocument, backgroundId: string): ScriptDocument;
  play(): void;
  exportPlayer(): Promise<void>;
  notice(message: string, error?: boolean): void;
}
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const result = document.createElement(tag); if (text !== undefined) result.textContent = text; return result;
};
const button = (text: string, action: () => void, style = 'small-button') => {
  const result = node('button', text); result.type = 'button'; result.className = style; result.onclick = action; return result;
};

export function installStoryWorkspace(hooks: StoryWorkspaceHooks): { open(): void; close(): boolean; refresh(): void } {
  const page = document.getElementById('story-workspace')!;
  const tree = page.querySelector<HTMLElement>('#story-tree')!, detail = page.querySelector<HTMLElement>('#story-detail')!;
  const problems = page.querySelector<HTMLElement>('#story-flow-issues')!;
  const nav = document.getElementById('story-workspace-button')!;
  let selected = '', projectId = '', dirty = false;
  let chapterFocus:string|null=null;
  const map=installStoryMap(page.querySelector<HTMLElement>('#story-map')!,{select:choose,thumbnail:hooks.thumbnail});
  const pendingEdits = new Map<string, (project:YahariProjectFile)=>void>();
  const status = page.querySelector<HTMLElement>('#story-workspace-status')!;
  function hasChanges():boolean {
    if(!dirty)return false;
    // A late change event from a replaced form must not make a saved scene look dirty.
    const saved=hooks.snapshot(),candidate={...saved,manifest:structuredClone(saved.manifest),documents:structuredClone(saved.documents)};
    for(const apply of pendingEdits.values())apply(candidate);
    if(JSON.stringify([saved.manifest,saved.documents])===JSON.stringify([candidate.manifest,candidate.documents])){dirty=false;pendingEdits.clear();return false;}
    return true;
  }
  function leave(): boolean {
    if(!hasChanges())return true;
    if(!confirm('场景资料或分支还有未保存的修改，确定离开吗？'))return false;
    dirty=false;pendingEdits.clear();refresh();return true;
  }
  function mark(key:string,apply:(project:YahariProjectFile)=>void):void {pendingEdits.set(key,apply);dirty=true;status.textContent='有未保存的修改 · Ctrl+S 保存';}
  function commit(next: YahariProjectFile, checkpoint=true): boolean {
    if (!hooks.editable()) return false;
    for(const apply of pendingEdits.values())apply(next);
    if(!next.manifest.title.trim()||next.documents.some(d=>!d.title.trim())||next.manifest.narrative?.chapters.some(c=>!c.title.trim())){status.textContent='作品、章节和场景名称不能为空。';return false;}
    const errors=validateFlow(next.manifest).filter(i=>i.severity==='error');if(errors.length){status.textContent=errors[0].message;return false;}
    // createProjectFile in the editor assigns the final format; mark branching candidates before validation.
    if (next.manifest.flow) next.fileVersion = '0.9';
    if (!hooks.apply(next,checkpoint)) return false;
    dirty = false;pendingEdits.clear(); refresh(); status.textContent = ''; return true;
  }
  function choose(id: string): void { if (!leave()) return; dirty = false; selected = id;refresh();requestAnimationFrame(()=>map.focus(id)); }
  function reorder(id: string, offset: number, chapter = false): void {
    if (!leave()) return;
    const next = hooks.snapshot();
    const list = chapter ? next.manifest.narrative!.chapters : next.manifest.narrative?.chapters.find(c => c.documentIds.includes(id))?.documentIds;
    if (!list) return;
    const from = chapter ? (list as Array<{id:string}>).findIndex(c => c.id === id) : (list as string[]).indexOf(id);
    const to = from + offset; if (to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]]; commit(next);
  }
  function addChapter(): void {
    if (!leave()) return; const next = hooks.snapshot();
    next.manifest.narrative ??= { summary: '', chapters: [] };
    const chapter={id:crypto.randomUUID(),title:`新章节 ${next.manifest.narrative.chapters.length+1}`,summary:'',documentIds:[]};next.manifest.narrative.chapters.push(chapter);chapterFocus=chapter.id;
    commit(next);
  }
  function addScene(chapterId?: string): void {
    if (!leave()) return; const next = hooks.snapshot(), id = `scene-${crypto.randomUUID()}`;
    const current = next.documents.find(d => d.documentId === selected);
    // A copied scene cue retains the author's background without copying dialogue identities.
    const background = current?.blocks.find(b => b.type === 'cue' && b.cue.type === 'courtroom.background');
    const cue = background ? structuredClone(background) : undefined;
    if (cue?.type === 'cue') { cue.id = `cue-${crypto.randomUUID()}`; cue.cue.id = `token-${crypto.randomUUID()}`; }
    next.documents.push({ schemaVersion: '0.7', documentId: id, title: `新场景 ${next.documents.length + 1}`, summary: '', blocks: cue ? [cue] : [] });
    next.manifest.documents.push({ id, path: `${id}.yahari.json` });
    next.manifest.narrative ??= { summary: '', chapters: [] };
    let chapter = next.manifest.narrative.chapters.find(c => c.id === chapterId || (!chapterId && c.documentIds.includes(selected)));
    if (!chapter) { chapter = { id: crypto.randomUUID(), title: '第一章', summary: '', documentIds: [] }; next.manifest.narrative.chapters.push(chapter); }
    chapter.documentIds.push(id);if(chapterFocus!==null||chapterId)chapterFocus=chapter.id; selected = id;commit(next);requestAnimationFrame(()=>map.focus(id));
  }
  function removeScene(): void {
    if (!leave()) return; const next = hooks.snapshot();
    if (selected === next.manifest.entryDocumentId) { status.textContent = '请先把其他场景设为作品开头，再删除这个场景。'; return; }
    const incoming = next.manifest.flow?.routes.filter(r => r.documentId !== selected && (r.exit.type === 'next' ? r.exit.targetDocumentId === selected : r.exit.type === 'choice' && r.exit.options.some(o => o.targetDocumentId === selected)));
    if (incoming?.length) { status.textContent = '其他场景的分支仍指向这里，请先修改它们的目标。'; return; }
    if (!confirm('删除这个场景及其全部对话？已保存的恢复点仍可恢复。')) return;
    next.documents = next.documents.filter(d => d.documentId !== selected);
    next.manifest.documents = next.manifest.documents.filter(d => d.id !== selected);
    next.manifest.narrative?.chapters.forEach(c => { c.documentIds = c.documentIds.filter(id => id !== selected); });
    if (next.manifest.flow) next.manifest.flow.routes = next.manifest.flow.routes.filter(r => r.documentId !== selected);
    selected = next.manifest.entryDocumentId; commit(next);
  }
  function targetSelect(next: YahariProjectFile, value: string, label: string, continuation?:string): HTMLSelectElement {
    const select = node('select'); select.setAttribute('aria-label', label);
    select.add(new Option('请选择目标场景', ''));
    for (const id of orderedSceneIds(next.manifest)) select.add(new Option((id===continuation?'继续下一场（不分支） · ':'')+next.documents.find(d => d.documentId === id)!.title, id));
    select.value = value; return select;
  }
  function field(parent: HTMLElement, label: string, value: string, multiline = false, max = 6000): HTMLInputElement | HTMLTextAreaElement {
    const wrapper = node('label', label), input = multiline ? node('textarea') : node('input'); input.value = value; input.maxLength = max;
    if (input instanceof HTMLTextAreaElement) input.rows = 3;
    wrapper.append(input); parent.append(wrapper); return input;
  }
  function renderDetail(next: YahariProjectFile): void {
    detail.replaceChildren(); const doc = next.documents.find(d => d.documentId === selected)!;
    const heading = node('div'); heading.className = 'story-detail-heading';
    heading.append(node('h2','场景设置'),button('编辑对话',()=>{if(leave())hooks.edit(selected);},'create-button'));
    detail.append(heading);
    const form = node('form'); form.className = 'story-management-form';form.id='story-scene-form';form.noValidate=true;
    const grid = node('div'); grid.className = 'story-management-grid';
    const title = field(grid, '场景名称', doc.title, false, 150), summary = field(grid, '场景摘要', doc.summary ?? '', true);
    title.required = true;
    const chapterLabel = node('label', '所属章节'), chapterSelect = node('select');
    for (const c of next.manifest.narrative?.chapters ?? []) chapterSelect.add(new Option(c.title, c.id));
    chapterSelect.add(new Option('未分章', ''));
    const currentChapter = next.manifest.narrative?.chapters.find(c => c.documentIds.includes(selected)); chapterSelect.value = currentChapter?.id ?? '';
    chapterLabel.append(chapterSelect); grid.append(chapterLabel);
    const backgroundLabel=node('label','场景背景'),background=node('select');background.add(new Option('沿用当前场景设置',''));
    for(const item of hooks.backgrounds())background.add(new Option(item.label,item.id));background.value=hooks.background(selected)??'';backgroundLabel.append(background);grid.append(backgroundLabel);form.append(grid);
    const exitHeader = node('div'); exitHeader.className = 'story-section-heading'; exitHeader.append(node('h2', '本场结束后'));
    const route=node('section');route.className='story-route-form';route.append(exitHeader);form.append(route);
    const modeLabel = node('label', '继续方式'), mode = node('select');
    [['auto', '按章节顺序继续（默认）'], ['next', '跳转到指定场景'], ['choice', '显示互动选项'], ['ending', '在这里结束故事']].forEach(([value, label]) => mode.add(new Option(label, value)));
    const explicit = next.manifest.flow?.routes.find(r => r.documentId === selected)?.exit;
    mode.value = explicit?.type ?? 'auto'; modeLabel.append(mode); route.append(modeLabel);
    const exitPanel = node('div'); exitPanel.className = 'story-exit-panel'; route.append(exitPanel);
    let draft: SceneExit = explicit ? structuredClone(explicit) : sceneExit(next.manifest, selected);
    const linearExit=sceneExit({...next.manifest,flow:undefined},selected),continuation=linearExit.type==='next'?linearExit.targetDocumentId:'';
    let promptInput: HTMLInputElement | HTMLTextAreaElement | undefined;
    function renderExit(): void {
      exitPanel.replaceChildren(); promptInput = undefined;
      if (mode.value === 'auto') { const exit = sceneExit({ ...next.manifest, flow: undefined }, selected); exitPanel.append(node('p', exit.type === 'next' ? `下一场：${next.documents.find(d => d.documentId === exit.targetDocumentId)?.title}` : '这是章节顺序中的最后一场，读完后结束。')); return; }
      if (mode.value === 'next') {
        if (draft.type !== 'next') draft = { type: 'next', targetDocumentId: '' };
        const select = targetSelect(next, draft.targetDocumentId, '下一场景');
        select.onchange = () => { if (draft.type === 'next') draft.targetDocumentId = select.value; }; exitPanel.append(select);
      } else if (mode.value === 'ending') {
        if (draft.type !== 'ending') draft = { type: 'ending', title: '', description: '' };
        const endTitle = field(exitPanel, '结局名称', draft.title, false, 200), description = field(exitPanel, '结局说明', draft.description ?? '', true);
        endTitle.required = true;
        endTitle.oninput = () => { if (draft.type === 'ending') draft.title = endTitle.value; };
        description.oninput = () => { if (draft.type === 'ending') draft.description = description.value; };
      } else {
        if (draft.type !== 'choice') draft = { type: 'choice', prompt: '接下来怎么做？', options: [1, 2].map(i => ({ id: crypto.randomUUID(), label: `选项 ${i}`, targetDocumentId: continuation })) };
        promptInput = field(exitPanel, '给读者的问题', draft.prompt, false, 1000); promptInput.required = true;
        promptInput.oninput = () => { if (draft.type === 'choice') draft.prompt = promptInput!.value; };
        const choices = node('div'); choices.className = 'story-choice-list';
        draft.options.forEach((option, index) => {
          const row = node('div'); row.className = 'story-choice-row';
          const label = field(row, `选项 ${index + 1}`, option.label, false, 200); label.required = true; label.oninput = () => { option.label = label.value; };
          const target = node('label', '选择后继续'), select = targetSelect(next, option.targetDocumentId, `选项 ${index + 1} 的目标场景`,continuation); select.required = true;
          select.onchange = () => { option.targetDocumentId = select.value; }; target.append(select); row.append(target);
          const remove = button('移除', () => { if (draft.type === 'choice') { draft.options.splice(index, 1); dirty = true; renderExit(); } });
          remove.disabled = draft.type !== 'choice' || draft.options.length <= 2; row.append(remove); choices.append(row);
        });
        exitPanel.append(choices);
        const add = button('＋ 添加选项', () => { if (draft.type === 'choice') { draft.options.push({ id: crypto.randomUUID(), label: '', targetDocumentId: continuation }); dirty = true; renderExit(); } });
        add.disabled = draft.options.length >= 8; exitPanel.append(add);
      }
    }
    mode.onchange = () => { dirty = true; renderExit(); }; renderExit();
    const actions = node('div'); actions.className = 'dialog-actions';
    if(selected!==next.manifest.entryDocumentId)actions.append(button('设为作品开头', () => { if (!leave()) return; const update = hooks.snapshot(); update.manifest.entryDocumentId = selected; commit(update); }));
    if(selected!==next.manifest.entryDocumentId)actions.append(button('删除场景', removeScene)); form.append(actions);
    const order=node('div');order.className='story-order-actions';const sceneIndex=currentChapter?.documentIds.indexOf(doc.documentId)??-1;
    if(sceneIndex>0)order.append(button('场景前移',()=>reorder(doc.documentId,-1)));if(currentChapter&&sceneIndex>=0&&sceneIndex<currentChapter.documentIds.length-1)order.append(button('场景后移',()=>reorder(doc.documentId,1)));form.append(order);
    const applyScene=(update:YahariProjectFile)=>{
      const sceneId=doc.documentId,target=update.documents.find(d=>d.documentId===sceneId);if(!target)return;
      target.title = title.value.trim(); target.summary = summary.value.trim();
      if(background.value)target.blocks=hooks.withBackground(target,background.value).blocks;
      update.manifest.narrative?.chapters.forEach(c => { c.documentIds = c.documentIds.filter(id => id !== sceneId); });
      const chapter = update.manifest.narrative?.chapters.find(c => c.id === chapterSelect.value);
      if (chapter) {
        // Preserve position when editing metadata in the same chapter.
        const position = currentChapter?.id === chapter.id ? currentChapter.documentIds.indexOf(sceneId) : chapter.documentIds.length;
        chapter.documentIds.splice(Math.max(0, position), 0, sceneId);
      }
      if (mode.value !== 'auto') {
        update.manifest.flow ??= { version: 1, routes: [] };
        update.manifest.flow.routes = update.manifest.flow.routes.filter(r => r.documentId !== sceneId);
        update.manifest.flow.routes.push({ documentId: sceneId, exit: structuredClone(draft) });
      } else if (update.manifest.flow) update.manifest.flow.routes = update.manifest.flow.routes.filter(r => r.documentId !== sceneId);
    };
    form.oninput=()=>mark('scene',applyScene);form.onchange=()=>mark('scene',applyScene);
    // Adding/removing an option also changes data without a native input event.
    exitPanel.addEventListener('click',event=>{if((event.target as HTMLElement).closest('button'))mark('scene',applyScene);});
    form.onsubmit=event=>{event.preventDefault();mark('scene',applyScene);commit(hooks.snapshot());};
    if (!hooks.editable()) form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement | HTMLTextAreaElement>('input,select,button,textarea').forEach(input => input.disabled = true);
    detail.append(form);
  }
  function refresh(): void {
    if (page.hidden) return;
    const next = hooks.snapshot();
    const newProject=projectId!==next.manifest.projectId;
    if(newProject){dirty=false;pendingEdits.clear();selected='';projectId=next.manifest.projectId;chapterFocus=null;}
    if (dirty) return;
    if (!next.documents.some(d => d.documentId === selected)) selected = hooks.activeDocumentId();
    tree.replaceChildren();
    const settings=node('section');settings.className='story-work-settings';settings.append(node('h2','作品资料'));
    const work = node('form'); work.className = 'story-work-form';
    const title = field(work, '作品名称', next.manifest.title, false, 150), summary = field(work, '作品摘要', next.manifest.narrative?.summary ?? '', true);
    title.required = true;
    const applyWork=(update:YahariProjectFile)=>{update.manifest.title=title.value.trim();update.manifest.narrative??={summary:'',chapters:[]};update.manifest.narrative.summary=summary.value.trim();};
    work.oninput = () => mark('work',applyWork);
    work.onsubmit = event => { event.preventDefault(); const update = hooks.snapshot(); update.manifest.title = title.value.trim(); update.manifest.narrative ??= { summary: '', chapters: [] }; update.manifest.narrative.summary = summary.value.trim(); commit(update); };
    settings.append(work);tree.append(settings);
    const chapterHeading=node('div');chapterHeading.className='story-sidebar-section';chapterHeading.append(node('h2','章节'));tree.append(chapterHeading);
    const chapters = [...(next.manifest.narrative?.chapters ?? [])], assigned = new Set(chapters.flatMap(c => c.documentIds));
    const loose = next.documents.filter(d => !assigned.has(d.documentId));
    if (loose.length) chapters.push({ id: '', title: '未分章', summary: '', documentIds: loose.map(d => d.documentId) });
    const filterLabel=node('label','查看章节'),filter=node('select');filter.id='story-chapter-filter';filter.add(new Option('全部章节','__all'));
    for(const chapter of chapters)filter.add(new Option(chapter.title,chapter.id));filter.value=chapterFocus??'__all';filterLabel.append(filter);tree.append(filterLabel);
    filter.onchange=()=>{const value=filter.value;if(!leave()){filter.value=chapterFocus??'__all';return;}chapterFocus=value==='__all'?null:value;refresh();const first=next.manifest.narrative?.chapters.find(c=>c.id===chapterFocus)?.documentIds[0];if(first)map.focus(first);};
    const chapter=chapters.find(c=>c.id===chapterFocus)??chapters.find(c=>c.documentIds.includes(selected));
    if(chapter?.id){
      const form=node('form'),name=field(form,'章节名称',chapter.title,false,150),note=field(form,'章节摘要',chapter.summary,true);name.required=true;
      const order=node('div');order.className='story-order-actions';const index=chapters.indexOf(chapter);if(index>0)order.append(button('前移',()=>reorder(chapter.id,-1,true)));if(index<chapters.length-1)order.append(button('后移',()=>reorder(chapter.id,1,true)));form.append(order);
      const applyChapter=(update:YahariProjectFile)=>{const target=update.manifest.narrative!.chapters.find(c=>c.id===chapter.id);if(target){target.title=name.value.trim();target.summary=note.value.trim();}};
      form.oninput=()=>mark('chapter:'+chapter.id,applyChapter);form.onsubmit=event=>{event.preventDefault();mark('chapter:'+chapter.id,applyChapter);commit(hooks.snapshot());};tree.append(form);
    }
    const issues = validateFlow(next.manifest); problems.replaceChildren();
    problems.hidden=!issues.length;
    issues.forEach(issue => { const doc = next.documents.find(d => d.documentId === issue.documentId); const link = button(`${doc?.title ?? '作品'}：${issue.message}`, () => { if (issue.documentId) choose(issue.documentId); }, 'story-flow-warning'); problems.append(link); });
    if (!hooks.editable()) tree.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement>('input,textarea,button').forEach(el => el.disabled = true);
    renderDetail(next);
    (document.getElementById('story-add-chapter') as HTMLButtonElement).disabled=!hooks.editable();(document.getElementById('new-scene-button') as HTMLButtonElement).disabled=!hooks.editable();
    map.render(next,selected);map.chapter(chapterFocus,false);if(newProject){(document.getElementById('story-map-search') as HTMLInputElement).value='';requestAnimationFrame(()=>map.fit());}updateSearchStatus();
  }
  function updateSearchStatus():void {
    const query=(document.getElementById('story-map-search') as HTMLInputElement).value,count=map.filter(query);
    document.getElementById('story-map-search-status')!.textContent=query?(count?`${count} 个匹配`:'没有匹配场景'):'';
  }
  function close(): boolean { if (!leave()) return false; dirty = false; page.hidden = true; document.body.classList.remove('story-mode'); nav.setAttribute('aria-pressed', 'false'); return true; }
  function open(): void {
    if (!hooks.prepare()) return;
    document.getElementById('writing-workspace')!.hidden = true; page.hidden = false;
    document.body.classList.add('story-mode'); nav.setAttribute('aria-pressed', 'true');
    document.getElementById('writing-workspace-button')!.setAttribute('aria-pressed', 'false');
    history.replaceState(null, '', location.pathname + location.search + '#story'); refresh(); page.querySelector<HTMLElement>('h1')!.focus();
  }
  nav.onclick = open;
  document.getElementById('navigator-button')!.onclick = open;
  document.getElementById('story-add-chapter')!.onclick = addChapter;
  document.getElementById('new-scene-button')!.onclick = () => addScene(chapterFocus||undefined);
  document.getElementById('story-map-fit')!.onclick=()=>map.fit();document.getElementById('story-map-out')!.onclick=()=>map.zoom(-.1);document.getElementById('story-map-in')!.onclick=()=>map.zoom(.1);
  document.getElementById('story-map-search')!.oninput=updateSearchStatus;
  document.getElementById('story-map-search')!.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();const id=map.firstMatch();if(id)choose(id);}};
  document.getElementById('story-play')!.onclick = () => { if(!dirty||commit(hooks.snapshot()))hooks.play(); };
  const exportButton = document.getElementById('story-export-player') as HTMLButtonElement;
  exportButton.onclick = async () => { if(dirty&&!commit(hooks.snapshot()))return; exportButton.disabled = true; status.textContent = '正在打包播放器和所需素材…'; try { await hooks.exportPlayer(); status.textContent = '已导出独立 HTML，打开文件即可游玩。'; } catch (error) { status.textContent = error instanceof Error ? error.message : '导出失败。'; } finally { exportButton.disabled = false; } };
  document.addEventListener('click',event=>{
    const id=(event.target as HTMLElement).closest('button')?.id;
    if(!page.hidden&&id&&['new-project-button','samples-button','branch-sample-button','restore-story-button','import-button','export-button','files-button','story-button'].includes(id)&&dirty&&!commit(hooks.snapshot())){event.preventDefault();event.stopImmediatePropagation();return;}
    if(id&&['samples-button','branch-sample-button','restore-story-button'].includes(id))document.querySelector<HTMLDialogElement>('#files-dialog')?.close();
  },true);
  window.addEventListener('beforeunload', event => { if (hasChanges()) { event.preventDefault(); event.returnValue = ''; } });
  document.getElementById('save-button')!.addEventListener('click',event=>{if(!page.hidden&&dirty){event.stopImmediatePropagation();if(commit(hooks.snapshot(),false))void hooks.save();}},true);
  document.addEventListener('keydown',event=>{if(!page.hidden&&!document.querySelector('dialog[open]')&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'&&dirty){event.preventDefault();event.stopImmediatePropagation();if(commit(hooks.snapshot(),false))void hooks.save();}},true);
  return { open, close, refresh };
}
