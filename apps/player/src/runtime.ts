import { NarrativeSession } from '../../../packages/narrative/src/index.js';
import { openPreview } from '../../editor/src/preview.js';
import { paragraphRanges } from '../../editor/src/preview-playback.js';
import { preparePlayerProject } from './project.js';

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
export function mountPlayer(root: HTMLElement, input: unknown, packedImages: Record<string, string> = {}): void {
  const { project, context, resolver, plans } = preparePlayerProject(input, packedImages);
  const session = new NarrativeSession(project.manifest);
  let page = 0, completed = false, audioEnabled=true;
  // Content-keyed saves prevent loading a path into another revision of a work with the same ID.
  let hash = 2166136261;
  const serialized = JSON.stringify(project);
  for (let i = 0; i < serialized.length; i++) hash = Math.imul(hash ^ serialized.charCodeAt(i), 16777619);
  const saveKey = `yahari:player:${project.manifest.projectId}:${hash >>> 0}`;
  try {
    const saved = JSON.parse(localStorage.getItem(saveKey) ?? 'null');
    if (saved && session.restore(saved.path)) { page = Number.isInteger(saved.page) ? Math.max(0, saved.page) : 0; completed = saved.completed === true;audioEnabled=saved.audioEnabled!==false; }
  } catch { /* File URLs and restricted browsers may not provide storage. */ }
  const name = (id: string | null): string => {
    if (!id) return '旁白'; const member = project.manifest.cast.find(c => c.castId === id);
    return member?.displayName ?? context.contentPacks.find(p => p.id === member?.characterRef.packId)?.characters.find(c => c.id === member?.characterRef.id)?.name ?? id;
  };
  const save = () => { try { localStorage.setItem(saveKey, JSON.stringify({ path: session.path, page, completed,audioEnabled })); } catch { /* Reading remains available without persistence. */ } };
  function button(label: string, action: () => void, secondary = false): HTMLButtonElement {
    const node = element('button', label); node.type = 'button'; node.className = secondary ? 'secondary-button' : 'create-button'; node.onclick = action; return node;
  }
  function read(): void {
    const plan = plans.get(session.documentId)!,exit=session.exit;
    const pendingChoice=completed&&exit.type==='choice';
    openPreview(plan, name, context, resolver, { title: project.documents.find(d => d.documentId === session.documentId)!.title, playing: true,
      startPage: pendingChoice?Math.max(0,paragraphRanges(plan.instructions).length-1):page, startCompleted:pendingChoice,
      onPage(value) { page = value; save(); }, onClose: render,
      audioEnabled,onAudioChange(value){audioEnabled=value;save();},
      ...(exit.type==='choice'?{choices:{prompt:exit.prompt,options:exit.options,onSelect(id:string){session.advance(id);page=0;completed=false;save();render();read();}},onChoiceState(visible:boolean){completed=visible;save();}}:{}),
      onComplete() { completed = true; save(); if (session.exit.type === 'next') { session.advance(); page = 0; completed = false; save(); render(); read(); } else render(); },
    });
  }
  function render(): void {
    root.replaceChildren();
    const doc = project.documents.find(d => d.documentId === session.documentId)!;
    const header = element('header'); header.className = 'player-heading';
    header.append(element('p', '矢张剧本 · 故事作品'), element('h1', project.manifest.title), element('p', project.manifest.narrative?.summary ?? '')); root.append(header);
    const card = element('section'); card.className = 'player-card'; card.append(element('p', `第 ${session.path.length} 场 · ${doc.title}`));
    const exit = session.exit;
    if (!completed) {
      card.append(element('h2', page ? '继续你的故事' : doc.title), element('p', doc.summary ?? ''), button(page ? '继续阅读' : '开始阅读', read));
    } else if (exit.type === 'choice') {
      card.append(element('h2', doc.title),element('p','这一场还有待确认的选择。'),button('回到画面继续选择',read));
    } else if (exit.type === 'ending') {
      card.classList.add('player-ending'); card.append(element('p', '你到达了一个结局'), element('h2', exit.title), element('p', exit.description ?? '感谢你读完这条故事路线。'));
    } else card.append(button('继续剧情', () => { session.advance(); page = 0; completed = false; save(); render(); read(); }));
    const controls = element('div'); controls.className = 'player-controls';
    const back = button('返回上一场，重新选择', () => { if (session.back()) { page = 0; completed = true; save(); render(); } }, true); back.disabled = session.path.length < 2;
    controls.append(back, button('从头开始', () => { session.restart(); page = 0; completed = false; save(); render(); }, true)); card.append(controls); root.append(card);
    const path = element('details'), title = element('summary', `已走过的路线 · ${session.path.length} 场`), list = element('ol');
    for (const visit of session.path) {
      const scene = project.documents.find(d => d.documentId === visit.documentId)!;
      const route = project.manifest.flow?.routes.find(r => r.documentId === visit.documentId)?.exit;
      const chosen = route?.type === 'choice' ? route.options.find(o => o.id === visit.optionId)?.label : undefined;
      list.append(element('li', scene.title + (chosen ? ` → ${chosen}` : '')));
    }
    path.append(title, list); root.append(path);
    const note = element('p', '阅读进度保存在当前浏览器。'); note.className = 'player-note'; root.append(note);
  }
  render();
}
