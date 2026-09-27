import { installStoryDialog } from "./story-dialog.js";
import { addDemoCharacter, completeDemoCast } from '../../../content-packs/courtroom-demo/cast.js';
import { courtroomDemoPack } from '../../../content-packs/courtroom-demo/pack.js';
import { actionArt, actionLabel } from "./action-art.js";
import { openPreview } from "./preview.js";
import {
  courtroomAdapter,
  courtroomTokenTypes,
  type CourtroomPerformancePlan,
} from "../../../packages/adapters/courtroom/src/index.js";
import {
  createTokenFromCandidate,
  EditorStore,
  isImeCompositionKey,
  CompositionGuard,
} from "../../../packages/editor-core/src/index.js";
import {
  createProjectFile,
  decodeProjectFile,
} from "../../../packages/core/src/index.js";
import type {
  Diagnostic,
  DialogueBlock,
  EditorContext,
  ProjectContext,
  ProjectAvailability,
  RichNode,
  ScriptDocument,
  TokenCandidate,
  TypedToken,
  YahariProjectFile,
} from "../../../packages/core/src/index.js";
import type { CourtroomContentPack } from "../../../packages/adapters/courtroom/src/index.js";
import {
  demoDocument,
  demoManifest,
  demoProject,
} from "../../../examples/courtroom-demo-project/fixture.js";
import { createSampleStory, normalizeSampleCast, sampleStories } from "../../../examples/courtroom-demo-project/story-cases.js";

const STORAGE_KEY = "yahari-script:p1b:project";
const LEGACY_STORAGE_KEY = "yahari-script:p1a:demo-document";
const PROJECT_FILE_CATALOG = {
  adapters: [{ id: courtroomAdapter.manifest.id, version: courtroomAdapter.manifest.version }],
  contentPacks: demoProject.contentPacks.map((pack) => ({ id: pack.id, version: pack.version })),
};

type InspectorTab = "diagnostics" | "plan" | "token";

type PickerState =
  | { mode: "draft"; range: Range }
  | { mode: "inline"; blockId: string; range: Range }
  | { mode: "cue"; afterBlockId?: string; replaceBlockId?: string };

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element ${selector}`);
  return element;
}

function defaultProjectFile(): YahariProjectFile {
  return createSampleStory(sampleStories[0].id, 'sample-default');
}

function loadInitialProject(): YahariProjectFile {
  for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const decoded = decodeProjectFile(JSON.parse(raw), PROJECT_FILE_CATALOG, demoManifest);
      if (decoded.ok && decoded.kind === "project") {
        if (decoded.availability === 'ready') decoded.project.manifest = normalizeSampleCast(completeDemoCast(decoded.project.manifest));
        return decoded.project;
      }
    } catch {
      // Try the next source, then fall through to the fixture.
    }
  }
  return defaultProjectFile();
}

let projectFile = loadInitialProject();
const initialAvailability = decodeProjectFile(projectFile, PROJECT_FILE_CATALOG);
let projectAvailability: ProjectAvailability = initialAvailability.ok
  && initialAvailability.kind === "project"
  ? initialAvailability.availability
  : "ready";
let currentProject: ProjectContext<CourtroomContentPack> = {
  manifest: structuredClone(projectFile.manifest),
  contentPacks: projectAvailability === "ready" ? demoProject.contentPacks : [],
};
const initialDocument = projectFile.documents.find(
  (document) => document.documentId === projectFile.manifest.entryDocumentId,
) ?? projectFile.documents[0] ?? structuredClone(demoDocument);
const store = new EditorStore(initialDocument);
const canvas = requireElement<HTMLElement>("#editor-canvas");
const outline = requireElement<HTMLElement>("#outline");
const inspectorContent = requireElement<HTMLElement>("#inspector-content");
const picker = requireElement<HTMLElement>("#picker");

requireElement('#picker-close').addEventListener('click',()=>closePicker());
const pickerSearch = requireElement<HTMLInputElement>("#picker-search");
const pickerList = requireElement<HTMLElement>("#picker-list");
const pickerContext = requireElement<HTMLElement>("#picker-context");
const saveStatus = requireElement<HTMLElement>("#save-status");
const undoButton = requireElement<HTMLButtonElement>("#undo-button");
const redoButton = requireElement<HTMLButtonElement>("#redo-button");
const documentTitle = requireElement<HTMLElement>("#document-title");
const editorTitle = requireElement<HTMLElement>("#editor-title");
const projectTitle = requireElement<HTMLElement>("#project-title");
const adapterBadge = requireElement<HTMLElement>("#adapter-badge");
const importInput = requireElement<HTMLInputElement>("#import-input");
const projectDialog = requireElement<HTMLDialogElement>("#project-dialog");
const projectNameInput = requireElement<HTMLInputElement>("#project-name-input");
const toast = requireElement<HTMLElement>("#toast");
const addCueButton = requireElement<HTMLButtonElement>("#add-cue-button");
const addDialogueButton = requireElement<HTMLButtonElement>("#add-dialogue-button");

let selectedBlockId: string | null = store.document.blocks[0]?.id ?? null;
let selectedTokenId: string | null = null;
let inspectorTab: InspectorTab = "diagnostics";
let pickerState: PickerState | null = null;
let tokenSerial = Date.now();
let blockSerial = Date.now();
let pendingLegacyDocument: ScriptDocument | null = null;
let persistTimer: number | null = null;
const tokenRegistry = new Map<string, TypedToken>();
const composeInput = requireElement<HTMLElement>('#compose-input');
const composeSend = requireElement<HTMLButtonElement>('#compose-send');
let composingAs: string | null = currentProject.manifest.cast[0]?.castId ?? null;
let draftRange: Range | null = null;
let draftNodes: RichNode[] = [];
let composingIme = false;
const compositionGuards = new WeakMap<HTMLElement, CompositionGuard>();
function guardComposition(element: HTMLElement): void {
  const guard = new CompositionGuard();
  compositionGuards.set(element, guard);
  element.addEventListener("compositionstart", () => guard.start());
  element.addEventListener("compositionend", () => guard.end(performance.now()));
}
function blocksCommand(event: KeyboardEvent): boolean {
  const element = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[contenteditable], input') : null;
  return isImeCompositionKey(event) || !!(element && compositionGuards.get(element)?.blocks(event, performance.now()));
}
let pickerReturnFocus: HTMLElement | null = null;
let panelReturnFocus: HTMLElement | null = null;
const isMobile = (): boolean => window.matchMedia("(max-width: 820px)").matches;
function focusBlock(blockId: string | null): void {
  const row = blockId ? canvas.querySelector<HTMLElement>(`article[data-block-id="${CSS.escape(blockId)}"]`) : null;
  if (!row) { composeInput.focus({preventScroll:true}); return; }
  row.tabIndex = -1;
  row.focus({preventScroll:true});
  row.scrollIntoView({behavior:'smooth', block:'center'});
}
function setPanel(panel: "outline" | "inspector", open: boolean, restoreFocus = true): void {
  if (open) {
    closePicker(false);
    panelReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.classList.remove('outline-open', 'inspector-open');
  }
  document.body.classList.toggle(`${panel}-open`, open);
  for (const name of ['outline', 'inspector'] as const) {
    const surface = requireElement<HTMLElement>(`.${name}-panel`);
    if (document.body.classList.contains(`${name}-open`) && (name === 'outline' || isMobile())) {
      surface.setAttribute('role','dialog'); surface.setAttribute('aria-modal','true');
    } else { surface.removeAttribute('role'); surface.removeAttribute('aria-modal'); }
  }
  requireElement('#diagnostics-button').setAttribute('aria-expanded', String(document.body.classList.contains('inspector-open')));
  requireElement('#navigator-button').setAttribute('aria-expanded', String(document.body.classList.contains('outline-open')));
  if (open) requireElement<HTMLElement>(`.${panel}-panel`).focus({preventScroll:true});
  else if (restoreFocus && panelReturnFocus?.isConnected) panelReturnFocus.focus({preventScroll:true});
}
function syncViewport(): void {
  const viewport = window.visualViewport;
  // Preserve browser pinch zoom; only compensate the unzoomed keyboard viewport.
  if (viewport && viewport.scale !== 1) return;
  document.documentElement.style.setProperty('--visible-height', `${viewport?.height ?? window.innerHeight}px`);
  document.documentElement.style.setProperty('--visible-top', `${viewport?.offsetTop ?? 0}px`);
  document.body.classList.toggle('compact-viewport', (viewport?.height ?? window.innerHeight) < 500);
}
window.visualViewport?.addEventListener('resize', syncViewport);
window.visualViewport?.addEventListener('scroll', syncViewport);
window.addEventListener('resize', syncViewport);
syncViewport();
function draftKey(): string { return `${STORAGE_KEY}:draft:${currentProject.manifest.projectId}:${store.document.documentId}`; }
function decorateDraft(): void {
  for(const chip of composeInput.querySelectorAll<HTMLElement>('.token-chip')) {
    if(chip.querySelector('.draft-remove'))continue;
    const remove=document.createElement('button');remove.type='button';remove.className='draft-remove';remove.textContent='×';remove.setAttribute('aria-label','移除这个动作');
    remove.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();chip.remove();saveDraft();composeInput.focus();});chip.append(remove);
  }
}
function saveDraft(): void {
  draftNodes = parseRichContent(composeInput);
  try { localStorage.setItem(draftKey(), JSON.stringify({speaker:composingAs,content:draftNodes})); } catch { /* Main project save reports storage failures. */ }
  composeSend.disabled = projectAvailability !== 'ready' || !draftNodes.some(n=>n.type==='token'||n.text.trim());
}
function loadDraft(): void {
  draftNodes=[];
  try {
    const legacyDraftKey = `${STORAGE_KEY}:draft:${currentProject.manifest.projectId}`;
    const draft=JSON.parse(localStorage.getItem(draftKey()) ?? (store.document.documentId===currentProject.manifest.entryDocumentId ? localStorage.getItem(legacyDraftKey) : null) ?? 'null');
    if(draft && Array.isArray(draft.content)) {
      // Use the existing decoder before accepting structured content from storage.
      const probe=structuredClone(store.document);
      probe.blocks=[{id:'draft',type:'dialogue',speaker:null,content:draft.content}];
      const decoded=decodeProjectFile(createProjectFile(currentProject.manifest,projectFile.documents.map(d=>d.documentId===probe.documentId?probe:d)),PROJECT_FILE_CATALOG);
      if(decoded.ok) draftNodes=draft.content;
      if(currentProject.manifest.cast.some(c=>c.castId===draft.speaker)) composingAs=draft.speaker;
    }
  } catch { draftNodes=[]; }
  renderRichContent(composeInput,{id:'draft',type:'dialogue',speaker:composingAs?{castId:composingAs}:null,content:draftNodes},new Set());
  decorateDraft();
}
function renderIdentities(): void {
  if(composingAs && !currentProject.manifest.cast.some(c=>c.castId===composingAs)) composingAs=currentProject.manifest.cast[0]?.castId??null;
  const list=requireElement<HTMLElement>('#identity-list');list.replaceChildren();
  for(const id of [...currentProject.manifest.cast.map(c=>c.castId),null]) {
    const button=document.createElement('button');button.type='button';
    button.className='identity-button';button.setAttribute('aria-pressed',String(id===composingAs));
    button.textContent=castName(id);button.disabled=projectAvailability!=='ready';
    button.addEventListener('click',()=>{closePicker(false);composingAs=id;saveDraft();renderRichContent(composeInput,{id:'draft',type:'dialogue',speaker:id?{castId:id}:null,content:draftNodes},new Set());decorateDraft();draftRange=null;renderIdentities();composeInput.focus();});list.append(button);
  }
  const missing = courtroomDemoPack.characters.filter(character => !currentProject.manifest.cast.some(cast => cast.characterRef.packId === courtroomDemoPack.id && cast.characterRef.id === character.id));
  if (missing.length && projectAvailability === 'ready') {
    const add = document.createElement('button'); add.type = 'button'; add.className = 'identity-button'; add.textContent = '＋ 角色';
    add.addEventListener('click', () => {
      const choices = requireElement<HTMLElement>('#cast-options'); choices.replaceChildren();
      for (const character of missing) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'identity-button'; button.textContent = character.name;
        button.addEventListener('click', () => {
          saveDraft();
          currentProject.manifest = addDemoCharacter(currentProject.manifest, character.id);
          persist(); renderAll(); requireElement<HTMLDialogElement>('#cast-dialog').close();
          showToast(`已加入${character.name}，可在身份栏切换。`);
        });
        choices.append(button);
      }
      requireElement<HTMLDialogElement>('#cast-dialog').showModal();
    });
    list.append(add);
  }
  requireElement('#compose-name').textContent=castName(composingAs);
  composeInput.contentEditable=String(projectAvailability==='ready');
  requireElement<HTMLButtonElement>('#compose-action').disabled=projectAvailability!=='ready';
  requireElement<HTMLButtonElement>('#compose-cue').disabled=projectAvailability!=='ready';
  composeSend.disabled=projectAvailability!=='ready'||!draftNodes.some(n=>n.type==='token'||n.text.trim());
}
function openDraftPicker(): void {
  if(projectAvailability!=='ready')return;
  composeInput.focus();
  const range=draftRange&&composeInput.contains(draftRange.commonAncestorContainer)?draftRange.cloneRange():document.createRange();
  if(!composeInput.contains(range.commonAncestorContainer)){range.selectNodeContents(composeInput);range.collapse(false);}
  pickerState={mode:'draft',range};showPicker();
}
function sendDialogue(): void {
  if(composingIme||projectAvailability!=='ready')return;
  saveDraft();if(composeSend.disabled)return;
  const block:DialogueBlock={id:`blk-${++blockSerial}`,type:'dialogue',speaker:composingAs?{castId:composingAs}:null,content:structuredClone(draftNodes)};
  const trial=store.document;trial.blocks.push(block);
  const errors=courtroomAdapter.validate(trial,currentProject).filter(d=>d.severity==='error'&&d.location?.blockId===block.id);
  if(errors.length){showToast('这条台词包含当前身份无法执行的动作，请调整动作或切换身份。','error');return;}
  store.commitEditSession();store.addDialogueBlock(block);selectedBlockId=block.id;
  composeInput.replaceChildren();draftRange=null;saveDraft();persist();renderAll();
  canvas.scrollTop=canvas.scrollHeight;composeInput.focus();
}


function persist(): void {
  if (persistTimer !== null) {
    window.clearTimeout(persistTimer);
    persistTimer = null;
  }
  projectFile = createProjectFile(currentProject.manifest, documentsWithActiveEdit());
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projectFile));
  } catch {
    saveStatus.textContent = "保存失败";
    showToast("未能保存，请导出剧本以免丢失。", "error");
    return;
  }
  saveStatus.textContent = "已保存到本机";
  window.setTimeout(() => {
    saveStatus.textContent = "本机草稿";
  }, 900);
}

function schedulePersist(): void {
  if (persistTimer !== null) window.clearTimeout(persistTimer);
  saveStatus.textContent = "正在保存…";
  persistTimer = window.setTimeout(persist, 300);
}

function documentsWithActiveEdit(): ScriptDocument[] {
  const active = store.document;
  const existing = projectFile.documents.map(document => document.documentId === active.documentId ? active : document);
  return existing.some(document => document.documentId === active.documentId) ? existing : [...existing, active];
}

function showToast(message: string, tone: "normal" | "error" = "normal"): void {
  toast.textContent = message;
  toast.classList.toggle("is-error", tone === "error");
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

function updateProjectChrome(): void {
  projectTitle.textContent = currentProject.manifest.title === "Yahari Courtroom P0 Demo" ? "法庭示例" : currentProject.manifest.title;
  documentTitle.textContent = store.document.title;
  editorTitle.textContent = store.document.title === "Opening" ? "开庭" : store.document.title;
  adapterBadge.textContent = `${currentProject.manifest.adapter.id} · ${currentProject.manifest.adapter.version}${projectAvailability === "ready" ? "" : " · READ ONLY"}`;
  requireElement<HTMLButtonElement>("#structure-button").disabled = projectAvailability !== "ready";
  requireElement<HTMLButtonElement>("#new-scene-button").disabled = projectAvailability !== "ready";
  addCueButton.disabled = projectAvailability !== "ready";
  addDialogueButton.disabled = projectAvailability !== "ready";
}

function findDialogueBlock(blockId: string): DialogueBlock | null {
  const block = store.document.blocks.find((item) => item.id === blockId);
  return block?.type === "dialogue" ? block : null;
}

function castName(castId: string | null | undefined): string {
  if (!castId) return "旁白";
  const cast = currentProject.manifest.cast.find((item) => item.castId === castId);
  if (!cast) return castId;
  if (cast.displayName) return cast.displayName;
  for (const pack of currentProject.contentPacks) {
    const character = pack.characters.find(
      (item) => item.id === cast.characterRef.id && pack.id === cast.characterRef.packId,
    );
    if (character) return ({phoenix:"成步堂",judge:"裁判长"} as Record<string,string>)[character.id] ?? character.name;
  }
  return castId;
}

function castInitial(castId: string | null | undefined): string {
  const name = castName(castId);
  return name === "No speaker" ? "—" : name.slice(0, 1).toUpperCase();
}

function editorContextFor(block: DialogueBlock): EditorContext {
  return {
    projectId: currentProject.manifest.projectId,
    documentId: store.document.documentId,
    blockId: block.id,
    adapterId: currentProject.manifest.adapter.id,
    adapterVersion: currentProject.manifest.adapter.version,
    insertionScope: "inline",
    speaker: block.speaker,
  };
}

function tokenDefinition(tokenType: string) {
  return courtroomTokenTypes.find((definition) => definition.type === tokenType);
}

function tokenValue(token: TypedToken): string {
  if (typeof token.params.pose === "string") return token.params.pose;
  if (typeof token.params.reaction === "string") return token.params.reaction;
  if (typeof token.params.mode === "string") return token.params.mode;
  const resource = token.params.resource;
  if (resource && typeof resource === "object" && "id" in resource) {
    return String((resource as { id: unknown }).id).split("/").at(-1) ?? "resource";
  }
  return "";
}

function artCharacter(token: TypedToken, speaker?: string | null): string | undefined {
  const id=token.subject?.kind==='cast'?token.subject.id:speaker;
  const ref=currentProject.manifest.cast.find(c=>c.castId===id)?.characterRef;
  return ref?.packId==='official.courtroom-demo'?ref.id:undefined;
}
function createTokenChip(token: TypedToken, invalidTokenIds: Set<string>, speaker?:string|null): HTMLElement {
  tokenRegistry.set(token.id, structuredClone(token));
  const definition = tokenDefinition(token.type);
  const chip = document.createElement("span");
  chip.className = `token-chip${invalidTokenIds.has(token.id) ? " is-invalid" : ""}`;
  chip.contentEditable = "false";
  chip.dataset.tokenId = token.id;
  chip.dataset.category = definition?.category ?? "Other";
  chip.title = token.type;
  chip.tabIndex = 0;
  chip.setAttribute("role", "button");
  chip.setAttribute("aria-label", `Inspect ${definition?.label ?? token.type} token`);

  if (token.subject?.kind === "cast") {
    const subject = document.createElement("span");
    subject.className = "token-subject";
    subject.textContent = castName(token.subject.id);
    chip.append(subject);
  }

  chip.classList.add('visual-token');
  chip.title=`${token.subject?.kind==='cast'?castName(token.subject.id)+' · ':''}${actionLabel(token)}`;
  chip.setAttribute('aria-label',chip.title);
  chip.append(actionArt(token,artCharacter(token,speaker)));
  const caption=document.createElement('span');caption.className='action-caption';caption.textContent=actionLabel(token);chip.append(caption);

  chip.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if(composeInput.contains(chip))return;
    setPanel('inspector', true);
    selectedTokenId = token.id;
    inspectorTab = "token";
    activateInspectorTab();
    renderInspector();
  });
  chip.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    chip.click();
  });
  return chip;
}

function invalidTokenIds(diagnostics: Diagnostic[]): Set<string> {
  return new Set(
    diagnostics
      .filter((item) => item.severity === "error" && item.location?.tokenId)
      .map((item) => item.location?.tokenId as string),
  );
}

function renderRichContent(
  editor: HTMLElement,
  block: DialogueBlock,
  invalidIds: Set<string>,
): void {
  editor.replaceChildren();
  for (const node of block.content) {
    if (node.type === "text") {
      editor.append(document.createTextNode(node.text));
    } else {
      editor.append(createTokenChip(node.token, invalidIds, block.speaker?.castId));
    }
  }
}

function appendText(nodes: RichNode[], text: string): void {
  if (!text) return;
  const last = nodes.at(-1);
  if (last?.type === "text") last.text += text;
  else nodes.push({ type: "text", text });
}

function parseRichContent(editor: HTMLElement): RichNode[] {
  const nodes: RichNode[] = [];

  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      appendText(nodes, node.textContent ?? "");
      return;
    }
    if (!(node instanceof HTMLElement)) return;

    const tokenId = node.dataset.tokenId;
    if (tokenId) {
      const token = tokenRegistry.get(tokenId);
      if (token) nodes.push({ type: "token", token: structuredClone(token) });
      return;
    }
    if (node.tagName === "BR") {
      appendText(nodes, "\n");
      return;
    }

    const blockish = node !== editor && ["DIV", "P"].includes(node.tagName);
    if (blockish && nodes.length > 0) appendText(nodes, "\n");
    for (const child of Array.from(node.childNodes)) walk(child);
  };

  for (const child of Array.from(editor.childNodes)) walk(child);
  return nodes.filter((node) => node.type !== "text" || node.text.length > 0);
}

function syncEditor(editor: HTMLElement, blockId: string, recordHistory = false): void {
  store.replaceDialogueContent(blockId, parseRichContent(editor), recordHistory);
  schedulePersist();
  refreshDerivedPanels();
}

function insertTextAtSelection(editor: HTMLElement, text: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;
  range.deleteContents();
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

const foldedOutline = new Map<string, boolean>();
function switchScene(id: string): void {
  if (id === store.document.documentId) return;
  store.commitEditSession(); saveDraft(); persist();
  const next = projectFile.documents.find(d => d.documentId === id);
  if (!next) return;
  closePicker(false); store.loadDocument(next);
  currentProject.manifest.entryDocumentId = id;
  selectedBlockId = next.blocks[0]?.id ?? null; selectedTokenId = null;
  loadDraft(); persist(); renderAll();
}
function renderOutline(): void {
  const active = store.document;
  const docs = documentsWithActiveEdit();
  outline.replaceChildren();
  const work = document.createElement('details'); work.className='work-tree';
  const workKey=`work:${currentProject.manifest.projectId}`;
  work.open=foldedOutline.get(workKey)??true;
  work.addEventListener('toggle',()=>foldedOutline.set(workKey,work.open));
  const workHeading=document.createElement('summary');
  const workLabel=document.createElement('span');workLabel.className='tree-label';workLabel.textContent='作品';
  const workTitle=document.createElement('strong');workTitle.textContent=currentProject.manifest.title;
  const workCount=document.createElement('span');workCount.className='tree-count';workCount.textContent=`${docs.length} 场`;
  workHeading.append(workLabel,workTitle,workCount);
  const summary = document.createElement('small');summary.textContent=currentProject.manifest.narrative?.summary || '暂无作品摘要';workHeading.append(summary);
  work.append(workHeading);
  const chapters = [...(currentProject.manifest.narrative?.chapters ?? [])];
  const assigned = new Set(chapters.flatMap(c=>c.documentIds));
  const loose = docs.filter(d=>!assigned.has(d.documentId));
  if(loose.length)chapters.push({id:'unassigned',title:'未分章',summary:'',documentIds:loose.map(d=>d.documentId)});
  for(const chapter of chapters){
    const section=document.createElement('details');section.className='chapter-tree';section.open=foldedOutline.get(chapter.id)??true;
    section.addEventListener('toggle',()=>foldedOutline.set(chapter.id,section.open));
    const heading=document.createElement('summary');heading.textContent=`${chapter.title} · ${chapter.documentIds.length} 场`;
    const note=document.createElement('small');note.textContent=chapter.summary;heading.append(note);section.append(heading);
    for(const id of chapter.documentIds){
      const scene=docs.find(d=>d.documentId===id);if(!scene)continue;
      const item=document.createElement('button');item.type='button';item.className=`scene-leaf${id===active.documentId?' is-selected':''}`;
      if(id===active.documentId)item.setAttribute('aria-current','location');
      const title=document.createElement('strong');title.textContent=scene.title;
      const desc=document.createElement('small');desc.textContent=scene.summary||'暂无场景摘要';
      item.append(title,desc);item.onclick=()=>{switchScene(id);setPanel('outline',false,false)};
      section.append(item);
    }work.append(section);
  }
  outline.append(work);
}

function speakerSelect(block: DialogueBlock): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "speaker-select";
  select.title = "选择人物会绑定开场形象与默认站位；句首动作可覆盖初始姿态。";
  const none = document.createElement("option");
  none.value = "";
  none.textContent = "旁白";
  select.append(none);
  for (const cast of currentProject.manifest.cast) {
    const option = document.createElement("option");
    option.value = cast.castId;
    option.textContent = castName(cast.castId);
    select.append(option);
  }
  select.value = block.speaker?.castId ?? "";
  select.disabled = projectAvailability !== "ready";
  select.addEventListener("change", () => {
    store.commitEditSession();
    store.updateSpeaker(block.id, select.value ? { castId: select.value } : null);
    persist();
    renderAll();
  });
  return select;
}

function renderEditor(): void {
  const doc = store.document;
  const documentDiagnostics = diagnostics();
  const invalidIds = invalidTokenIds(documentDiagnostics);
  canvas.replaceChildren();
  tokenRegistry.clear();
  for(const node of draftNodes) if(node.type==='token') tokenRegistry.set(node.token.id,node.token);

  if (doc.blocks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-document";
    empty.textContent = "选一个身份，发出第一句台词。";
    canvas.append(empty);
    return;
  }

  for (const block of doc.blocks) {
    if (block.type === "cue") {
      const row = document.createElement("article");
      row.className = `dialogue-row cue-row${selectedBlockId === block.id ? " is-selected" : ""}`;
      row.dataset.blockId = block.id;

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.textContent = "◆";

      const card = document.createElement("div");
      card.className = "dialogue-card cue-card";
      const meta = document.createElement("div");
      meta.className = "dialogue-meta";
      const label = document.createElement("span");
      label.className = "cue-label";
      label.textContent = "场景";
      const blockId = document.createElement("span");
      blockId.className = "block-id";
      blockId.textContent = block.id;
      meta.append(label, blockId);

      const body = document.createElement("div");
      body.className = "cue-body";
      body.append(createTokenChip(block.cue, invalidIds));
      const actions = document.createElement("div");
      actions.className = "cue-actions";
      const change = document.createElement("button");
      change.className = "small-button";
      change.textContent = "更换";
      change.disabled = projectAvailability !== "ready";
      change.addEventListener("click", () => openCuePicker(block.id, block.id));
      const remove = document.createElement("button");
      remove.className = "small-button danger-quiet";
      remove.textContent = "删除";
      remove.disabled = projectAvailability !== "ready";
      remove.addEventListener("click", () => {
        store.removeBlock(block.id);
        if (selectedBlockId === block.id) selectedBlockId = store.document.blocks[0]?.id ?? null;
        if (selectedTokenId === block.cue.id) selectedTokenId = null;
        persist();
        renderAll();
      });
      actions.append(change, remove);
      body.append(actions);
      card.append(meta, body);
      row.append(avatar, card);
      row.addEventListener("click", () => {
        selectedBlockId = block.id;
        renderOutline();
        renderEditorSelection();
      });
      canvas.append(row);
      continue;
    }

    const row = document.createElement("article");
    row.className = `dialogue-row${selectedBlockId === block.id ? " is-selected" : ""}`;
    row.dataset.blockId = block.id;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = castInitial(block.speaker?.castId);
    const castIndex=currentProject.manifest.cast.findIndex(c=>c.castId===block.speaker?.castId);
    row.classList.toggle('chat-right',castIndex===0);
    avatar.style.background=castIndex===0?'#326452':castIndex===1?'#6a506f':'#677887';

    const card = document.createElement("div");
    card.className = "dialogue-card";
    const meta = document.createElement("div");
    meta.className = "dialogue-meta";
    meta.append(speakerSelect(block));
    const blockId = document.createElement("span");
    blockId.className = "block-id";
    blockId.textContent = block.id;
    const removeMessage=document.createElement('button');removeMessage.className='message-remove';removeMessage.textContent='删除';removeMessage.setAttribute('aria-label','删除这条台词');removeMessage.disabled=projectAvailability!=='ready';
    removeMessage.addEventListener('click',()=>{store.commitEditSession();store.removeBlock(block.id);selectedBlockId=store.document.blocks.at(-1)?.id??null;persist();renderAll();});
    meta.append(removeMessage);

    const editor = document.createElement("div");
    editor.className = "rich-editor";
    editor.contentEditable = projectAvailability === "ready" ? "true" : "false";
    editor.spellcheck = false;
    guardComposition(editor);
    editor.dataset.blockId = block.id;
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-multiline", "true");
    renderRichContent(editor, block, invalidIds);

    editor.addEventListener("focus", () => {
      selectedBlockId = block.id;
      store.beginEditSession();
      renderOutline();
      renderEditorSelection();
    });
    editor.addEventListener("blur", () => {
      store.commitEditSession();
      persist();
      updateToolbar();
    });
    editor.addEventListener("input", () => syncEditor(editor, block.id, false));
    editor.addEventListener("paste", (event) => {
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") ?? "";
      insertTextAtSelection(editor, text);
      syncEditor(editor, block.id, false);
    });
    editor.addEventListener("keydown", (event) => {
      if (blocksCommand(event)) return;
      if (event.key === "/" || (event.key === " " && event.ctrlKey)) {
        event.preventDefault();
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0).cloneRange();
        if (!editor.contains(range.commonAncestorContainer)) return;
        openInlinePicker(block.id, range);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        insertTextAtSelection(editor, "\n");
        syncEditor(editor, block.id, false);
      }
    });

    card.append(meta, editor);
    row.append(avatar, card);
    canvas.append(row);
  }
}

function renderEditorSelection(): void {
  for (const row of canvas.querySelectorAll<HTMLElement>(".dialogue-row")) {
    row.classList.toggle("is-selected", row.dataset.blockId === selectedBlockId);
  }
}

function diagnostics(): Diagnostic[] {
  if (projectAvailability !== "ready") {
    return [{
      id: `project.${projectAvailability}`,
      severity: "error",
      code: `project.${projectAvailability}`,
      message: projectAvailability === "missing-adapter"
        ? `Required Adapter ${currentProject.manifest.adapter.id}@${currentProject.manifest.adapter.version} is not installed. Project opened read-only.`
        : "A required Content Pack is not installed. Project opened read-only.",
      location: { documentId: store.document.documentId },
    }];
  }
  return courtroomAdapter.validate(store.document, currentProject);
}

function friendlyDiagnostic(item:Diagnostic):string {
  const messages:Record<string,string>={
    'courtroom.capability.missing':'这个角色不能执行此动作，请更换动作或执行者。',
    'courtroom.subject.required':'请为这条动作选择一个角色。',
    'courtroom.subject.invalid-kind':'这个动作的执行者不合适，请重新选择。',
    'courtroom.token.unknown':'暂不支持这个动作，请删除或替换。',
    'courtroom.token.invalid-scope':'这个动作需要换一个插入位置。',
    'courtroom.token.invalid-params':'动作设置不完整，请删除后重新插入。',
    'project.missing-adapter':'此剧本类型暂不支持，当前只能查看和导出。',
    'project.missing-content-pack':'此剧本需要的素材尚未安装，当前只能查看和导出。',
  };
  const index=store.document.blocks.findIndex(b=>b.id===item.location?.blockId);
  return `${index>=0?`第 ${index+1} 条：`:''}${messages[item.code]??'这条内容暂时无法排练，请检查角色和动作，或重新插入动作。'}`;
}
function renderDiagnostics(): void {
  const items = diagnostics();
  inspectorContent.replaceChildren();
  const title = document.createElement("div");
  title.className = "inspector-section-title";
  title.textContent = items.length ? `${items.length} 处需要调整` : "剧本检查";
  inspectorContent.append(title);

  if (items.length === 0) {
    const ok = document.createElement("div");
    ok.className = "ok-state";
    ok.innerHTML = `<div class="ok-icon">✓</div><div>可以开始排练了。</div>`;
    inspectorContent.append(ok);
    return;
  }

  for (const item of items) {
    const card = document.createElement("div");
    card.className = `diagnostic-card ${item.severity}`;
    const head = document.createElement("div");
    head.className = "diagnostic-head";
    head.textContent = item.severity === "error" ? "需要调整" : "提示";
    const message = document.createElement("div");
    message.className = "diagnostic-message";
    message.textContent = friendlyDiagnostic(item);
    card.append(head, message);

    if (item.location?.blockId) {
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.addEventListener("click", () => {
        if (isMobile()) setPanel("inspector", false, false);
        selectedBlockId = item.location?.blockId ?? selectedBlockId;
        if (item.location?.tokenId) selectedTokenId = item.location.tokenId;
        renderOutline();
        renderEditorSelection();
        focusBlock(item.location?.blockId ?? null);
      });
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          card.click();
        }
      });
    }

    for (const fix of item.fixes ?? []) {
      const button = document.createElement("button");
      button.className = "fix-button";
      button.textContent = fix.kind === "remove-token" ? "移除动作" : fix.kind === "replace-token" ? `换成${actionLabel(fix.token)}` : `改由${fix.subject.kind === "cast" ? castName(fix.subject.id) : "当前角色"}执行`;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const tokenId = item.location?.tokenId;
        if (!tokenId) return;
        store.applyQuickFix(tokenId, fix);
        if (selectedTokenId === tokenId && fix.kind === "remove-token") selectedTokenId = null;
        persist();
        renderAll();
        (inspectorContent.querySelector<HTMLElement>('.fix-button') ?? requireElement<HTMLElement>('#inspector-close')).focus({preventScroll:true});
      });
      card.append(button);
    }
    inspectorContent.append(card);
  }
}

function renderPlan(): void {
  inspectorContent.replaceChildren();
  const items = diagnostics();
  const errors = items.filter((item) => item.severity === "error");
  const title = document.createElement("div");
  title.className = "inspector-section-title";
  title.textContent = "Performance Plan";
  inspectorContent.append(title);

  if (errors.length > 0) {
    const blocked = document.createElement("div");
    blocked.className = "ok-state";
    blocked.innerHTML = `<div class="ok-icon" style="background:#fff0f1;color:#b43847">!</div><div>Compilation blocked by ${errors.length} error${errors.length === 1 ? "" : "s"}.<br/>Fix diagnostics first; compiler will not guess.</div>`;
    inspectorContent.append(blocked);
    return;
  }

  let plan: CourtroomPerformancePlan;
  try {
    plan = courtroomAdapter.compile(store.document, currentProject);
  } catch (error) {
    const failure = document.createElement("div");
    failure.className = "diagnostic-card error";
    failure.textContent = error instanceof Error ? error.message : String(error);
    inspectorContent.append(failure);
    return;
  }

  const list = document.createElement("div");
  list.className = "plan-list";
  plan.instructions.forEach((instruction, index) => {
    const row = document.createElement("div");
    row.className = "plan-row";
    const op = document.createElement("div");
    op.className = "plan-op";
    op.textContent = `${String(index + 1).padStart(2, "0")} ${instruction.op}`;
    const detail = document.createElement("div");
    detail.className = "plan-detail";
    const { op: _ignored, ...rest } = instruction;
    detail.textContent = Object.keys(rest).length === 0 ? "—" : JSON.stringify(rest, null, 2);
    row.append(op, detail);
    list.append(row);
  });
  inspectorContent.append(list);
}

function locateToken(tokenId: string): TypedToken | null {
  for (const block of store.document.blocks) {
    if (block.type === "cue") {
      if (block.cue.id === tokenId) return block.cue;
      continue;
    }
    for (const node of block.content) {
      if (node.type === "token" && node.token.id === tokenId) return node.token;
    }
  }
  return null;
}

function renderTokenInspector(): void {
  inspectorContent.replaceChildren();
  const title = document.createElement("div");
  title.className = "inspector-section-title";
  title.textContent = "动作";
  inspectorContent.append(title);

  if (!selectedTokenId) {
    const empty = document.createElement("div");
    empty.className = "ok-state";
    empty.textContent = "点击对话中的动作可查看或移除。";
    inspectorContent.append(empty);
    return;
  }

  const token = locateToken(selectedTokenId);
  if (!token) {
    selectedTokenId = null;
    renderTokenInspector();
    return;
  }

  const box = document.createElement("div");
  box.className = "token-inspector";
  const actionTitle=document.createElement('div');actionTitle.className='action-detail';actionTitle.append(actionArt(token));
  const description=document.createElement('span');description.textContent=actionLabel(token);actionTitle.append(description);box.append(actionTitle);
  const target=document.createElement('p');target.textContent=token.subject?.kind==='cast'?`由${castName(token.subject.id)}执行`:token.subject?.kind==='speaker'?'由这条台词的说话人执行':'';box.append(target);
  const errors = diagnostics().filter((item) => item.location?.tokenId === token.id);
  for (const item of errors) {
    const error = document.createElement("div");
    error.className = "diagnostic-card error";
    error.textContent = friendlyDiagnostic(item);
    box.append(error);
  }
  const cueOwner = store.document.blocks.find(
    (block) => block.type === "cue" && block.cue.id === token.id,
  );
  const remove = document.createElement("button");
  remove.className = "primary-danger-button";
  remove.textContent = cueOwner ? "删除场景动作" : "移除动作";
  remove.disabled = projectAvailability !== "ready";
  remove.addEventListener("click", () => {
    if (cueOwner) store.removeBlock(cueOwner.id);
    else store.removeToken(token.id);
    selectedTokenId = null;
    persist();
    renderAll();
  });
  box.append(remove);
  inspectorContent.append(box);
}

function renderInspector(): void {
  if (inspectorTab === "plan") renderDiagnostics();
  else if (inspectorTab === "token") renderTokenInspector();
  else renderDiagnostics();
}

function activateInspectorTab(): void {
  for (const tab of document.querySelectorAll<HTMLButtonElement>(".inspector-tab")) {
    tab.classList.toggle("is-active", tab.dataset.tab === inspectorTab);
  }
}

function refreshTokenStates(): void {
  const invalidIds = invalidTokenIds(diagnostics());
  for (const chip of document.querySelectorAll<HTMLElement>(".token-chip[data-token-id]")) {
    chip.classList.toggle("is-invalid", invalidIds.has(chip.dataset.tokenId ?? ""));
  }
}

function refreshDerivedPanels(): void {
  renderOutline();
  refreshTokenStates();
  renderInspector();
  updateToolbar();
}

function updateToolbar(): void {
  undoButton.disabled = !store.canUndo;
  redoButton.disabled = !store.canRedo;
}

function renderAll(): void {
  updateProjectChrome();
  renderOutline();
  renderEditor();
  activateInspectorTab();
  renderInspector();
  updateToolbar();
  renderIdentities();
}

function showPicker(): void {
  pickerReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.body.classList.add('picker-open');
  const select=requireElement<HTMLSelectElement>('#action-target');
  select.replaceChildren(new Option('当前身份',''));
  for(const cast of currentProject.manifest.cast)select.append(new Option(castName(cast.castId),cast.castId));
  select.value='';
  select.parentElement!.hidden=pickerState?.mode==='cue';
  picker.classList.remove("is-hidden");
  picker.setAttribute("aria-hidden", "false");
  pickerSearch.value = "";
  renderPickerCandidates();
  // Touch users can choose an action without first opening the keyboard.
  if (isMobile()) requireElement<HTMLElement>('#picker-close').focus({preventScroll:true});
  else pickerSearch.focus({preventScroll:true});
}

function openInlinePicker(blockId: string, range: Range): void {
  store.commitEditSession();
  pickerState = { mode: "inline", blockId, range };
  showPicker();
}

function openCuePicker(afterBlockId?: string, replacingBlockId?: string): void {
  store.commitEditSession();
  pickerState = { mode: "cue", afterBlockId, ...(replacingBlockId ? { replaceBlockId: replacingBlockId } : {}) };
  showPicker();
}

function closePicker(restoreInlineCaret = true): void {
  const previous = pickerState;
  pickerState = null;
  picker.classList.add("is-hidden");
  picker.setAttribute("aria-hidden", "true");
  document.body.classList.remove('picker-open');
  if (restoreInlineCaret && previous?.mode === 'cue' && pickerReturnFocus?.isConnected) {
    pickerReturnFocus.focus({preventScroll:true});
  }
  if (restoreInlineCaret && previous?.mode === 'draft') {
    composeInput.focus();const sel=window.getSelection();sel?.removeAllRanges();sel?.addRange(previous.range);
  }
  if (restoreInlineCaret && previous?.mode === "inline") {
    const editor = canvas.querySelector<HTMLElement>(
      `.rich-editor[data-block-id="${CSS.escape(previous.blockId)}"]`,
    );
    if (editor && editor.contains(previous.range.commonAncestorContainer)) {
      editor.focus();
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(previous.range);
    }
  }
}

function restoreCaretAfterToken(blockId: string, tokenId: string): void {
  window.setTimeout(() => {
    const editor = canvas.querySelector<HTMLElement>(
      `.rich-editor[data-block-id="${CSS.escape(blockId)}"]`,
    );
    const chip = editor?.querySelector<HTMLElement>(
      `.token-chip[data-token-id="${CSS.escape(tokenId)}"]`,
    );
    if (!editor || !chip) return;
    editor.focus();
    const range = document.createRange();
    range.setStartAfter(chip);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    store.beginEditSession();
  }, 0);
}

function categoryIcon(category: string): string {
  if (category === "Character") return "CH";
  if (category === "Audio") return "AU";
  if (category === "Scene") return "SC";
  return "FX";
}

function renderPickerCandidates(): void {
  if (!pickerState) return;
  const query = pickerSearch.value.trim();
  let context: EditorContext;
  let contextLabel: string;
  if(pickerState.mode==='draft') {
    context=editorContextFor({id:'draft',type:'dialogue',speaker:composingAs?{castId:composingAs}:null,content:draftNodes});
    contextLabel=`${castName(composingAs)} · 插入动作`;
  } else if (pickerState.mode === "inline") {
    const block = findDialogueBlock(pickerState.blockId);
    if (!block) return;
    context = editorContextFor(block);
    contextLabel = `${castName(block.speaker?.castId)} · inline actions`;
  } else {
    context = {
      projectId: currentProject.manifest.projectId,
      documentId: store.document.documentId,
      adapterId: currentProject.manifest.adapter.id,
      adapterVersion: currentProject.manifest.adapter.version,
      insertionScope: "block",
      speaker: null,
    };
    contextLabel = "Document · block cues";
  }
  const allCandidates = courtroomAdapter.getTokenCandidates(
    context,
    currentProject,
    undefined,
  );

  const chosenTarget=requireElement<HTMLSelectElement>('#action-target').value;
  const currentSpeaker=pickerState.mode==='draft'?composingAs:pickerState.mode==='inline'?findDialogueBlock(pickerState.blockId)?.speaker?.castId:null;
  const targeted=allCandidates.filter(candidate=>{
    if(candidate.subject?.kind==='cast')return chosenTarget!==''&&candidate.subject.id===chosenTarget;
    if(candidate.subject?.kind==='speaker')return chosenTarget===''||chosenTarget===currentSpeaker;
    return true;
  });
  const bound=targeted.map(candidate=>chosenTarget&&candidate.subject?.kind==='speaker'?{...candidate,subject:{kind:'cast' as const,id:chosenTarget}}:candidate);
  const candidates=bound.filter(candidate=>!query||`${actionLabel(createTokenFromCandidate('preview',candidate))} ${candidate.label} ${candidate.tokenType}`.toLowerCase().includes(query.toLowerCase()));
  pickerContext.textContent = '';
  pickerList.replaceChildren();
  if (candidates.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-picker";
    empty.textContent = "当前身份下没有匹配的动作。";
    pickerList.append(empty);
    return;
  }

  const groups = new Map<string, TokenCandidate[]>();
  for (const candidate of candidates) {
    const group = groups.get(candidate.category) ?? [];
    group.push(candidate);
    groups.set(candidate.category, group);
  }

  for (const [category, group] of groups) {
    const label = document.createElement("div");
    label.className = "picker-group-label";
    label.textContent = ({Character:'角色表情',Presentation:'节奏与特效',Audio:'声音',Scene:'场景与镜头'} as Record<string,string>)[category]??category;
    pickerList.append(label);
    for (const candidate of group) {
      const button = document.createElement("button");
      button.className = "picker-item";
      button.disabled = !candidate.enabled;
      const token=createTokenFromCandidate('preview',candidate);
      const speaker=pickerState.mode==='draft'?composingAs:pickerState.mode==='inline'?findDialogueBlock(pickerState.blockId)?.speaker?.castId:null;
      const target=candidate.subject?.kind==='cast'?castName(candidate.subject.id):'';
      const label=actionLabel(token);
      button.setAttribute('aria-label',`${target} ${label}`.trim());
      button.title=`${target} ${label}`.trim();
      button.append(actionArt(token,artCharacter(token,speaker)));
      const caption=document.createElement('span');caption.className='picker-label';caption.textContent=label;button.append(caption);
      if(target){const subject=document.createElement('span');subject.className='picker-target';subject.textContent=target;button.append(subject);}
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => insertCandidate(candidate));
      pickerList.append(button);
    }
  }
}

function insertCandidate(candidate: TokenCandidate): void {
  if (!pickerState) return;

  if(pickerState.mode==='draft') {
    const range=pickerState.range;
    if(!composeInput.contains(range.commonAncestorContainer)){closePicker();return;}
    const token=createTokenFromCandidate(`tok-${++tokenSerial}`,candidate);
    tokenRegistry.set(token.id,structuredClone(token));
    const chip=createTokenChip(token,new Set(),composingAs);
    chip.addEventListener('dblclick',()=>{chip.remove();saveDraft();});
    range.deleteContents();range.insertNode(chip);range.setStartAfter(chip);range.collapse(true);
    draftRange=range.cloneRange();closePicker(false);composeInput.focus();
    const sel=window.getSelection();sel?.removeAllRanges();sel?.addRange(range);decorateDraft();saveDraft();return;
  }
  if (pickerState.mode === "cue") {
    const token = createTokenFromCandidate(`tok-${++tokenSerial}`, candidate);
    if (pickerState.replaceBlockId) {
      store.replaceCueToken(pickerState.replaceBlockId, token);
      selectedBlockId = pickerState.replaceBlockId;
    } else {
      const blockId = `cue-${++blockSerial}`;
      store.addCueBlock({ id: blockId, type: "cue", cue: token }, pickerState.afterBlockId);
      selectedBlockId = blockId;
    }
    selectedTokenId = token.id;
    persist();
    closePicker(false);
    renderAll();
    if (pickerReturnFocus?.isConnected) pickerReturnFocus.focus({preventScroll:true});
    else focusBlock(selectedBlockId);
    return;
  }

  const { blockId, range } = pickerState;
  const editor = canvas.querySelector<HTMLElement>(`.rich-editor[data-block-id="${CSS.escape(blockId)}"]`);
  if (!editor || !editor.contains(range.commonAncestorContainer)) {
    closePicker();
    return;
  }

  const token = createTokenFromCandidate(`tok-${++tokenSerial}`, candidate);
  tokenRegistry.set(token.id, structuredClone(token));
  const chip = createTokenChip(token, new Set(),findDialogueBlock(blockId)?.speaker?.castId);
  range.deleteContents();
  range.insertNode(chip);

  const selection = window.getSelection();
  range.setStartAfter(chip);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);

  store.replaceDialogueContent(blockId, parseRichContent(editor), true);
  selectedTokenId = token.id;
  persist();
  closePicker(false);
  renderAll();
  restoreCaretAfterToken(blockId, token.id);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeFileName(value: string): string {
  return value.trim().replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "") || "yahari-project";
}

function exportProject(): void {
  store.commitEditSession();
  const exported = createProjectFile(currentProject.manifest, documentsWithActiveEdit(), {
    exportedAt: new Date().toISOString(),
    generator: "Yahari Script P1-d Cast Recovery",
  });
  const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFileName(currentProject.manifest.title)}.yahari-project.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function activateProject(next: YahariProjectFile): boolean {
  // All entry paths, including legacy binding, must pass before state or storage changes.
  const checked = decodeProjectFile(next, PROJECT_FILE_CATALOG);
  if (!checked.ok || checked.kind !== "project") {
    showToast("文件内容不完整或格式不受支持，当前剧本未更改。", "error");
    return false;
  }
  next = checked.project;
  const availability = checked.availability;
  const entry = next.documents.find(
    (document) => document.documentId === next.manifest.entryDocumentId,
  );
  if (!entry) throw new Error(`Entry document ${next.manifest.entryDocumentId} is missing.`);
  projectFile = structuredClone(next);
  projectAvailability = availability;
  currentProject = {
    manifest: structuredClone(next.manifest),
    contentPacks: availability === "ready" ? demoProject.contentPacks : [],
  };
  store.loadDocument(entry);
  composingAs=currentProject.manifest.cast[0]?.castId??null;
  loadDraft();
  selectedBlockId = entry.blocks[0]?.id ?? null;
  selectedTokenId = null;
  persist();
  renderAll();
  return true;
}

async function importProjectFile(file: File): Promise<void> {
  let input: unknown;
  try {
    input = JSON.parse(await file.text());
  } catch {
    showToast("无法读取文件，请选择此前导出的剧本文件。", "error");
    return;
  }
  const decoded = decodeProjectFile(input, PROJECT_FILE_CATALOG);
  if (!decoded.ok) {
    showToast("文件内容不完整或格式不受支持，请检查所选文件。", "error");
    return;
  }
  if (decoded.kind === "unbound-document") {
    pendingLegacyDocument = decoded.document;
    projectNameInput.value = decoded.document.title || "导入的剧本";
    projectDialog.showModal();
    projectNameInput.focus();
    projectNameInput.select();
    showToast("这是旧版剧本，请确认名称后导入。");
    return;
  }
  if (!activateProject(decoded.project)) return;
  const suffix = decoded.migratedFrom ? ` Migrated from ${decoded.migratedFrom}.` : "";
  const mode = decoded.availability === "ready" ? "" : " Opened read-only because a dependency is missing.";
  showToast(`已导入${decoded.availability === "ready" ? "" : "，当前仅可查看和导出"}。`);
}

function createNewProject(title: string): void {
  const serial = Date.now().toString(36);
  const manifest = structuredClone(demoManifest);
  manifest.schemaVersion = "0.7";
  manifest.projectId = `project-${serial}`;
  manifest.title = title.trim() || "未命名剧本";
  manifest.entryDocumentId = pendingLegacyDocument?.documentId ?? `doc-${serial}`;
  manifest.documents = [{ id: manifest.entryDocumentId, path: "main.yahari.json" }];
  manifest.narrative = { summary: '', chapters: [{ id: `chapter-${serial}`, title: '第一章', summary: '', documentIds: [manifest.entryDocumentId] }] };
  const document: ScriptDocument = pendingLegacyDocument
    ? structuredClone(pendingLegacyDocument)
    : {
        schemaVersion: "0.7",
        documentId: manifest.entryDocumentId,
        title: "场景 1",
        blocks: [],
      };
  pendingLegacyDocument = null;
  if (!activateProject(createProjectFile(manifest, [document]))) return;
  showToast(`已创建「${manifest.title}」。`);
}

requireElement<HTMLButtonElement>("#add-cue-button").addEventListener("click", () => {
  openCuePicker(selectedBlockId ?? undefined);
});

requireElement<HTMLButtonElement>("#add-dialogue-button").addEventListener("click", () => {
  store.commitEditSession();
  const id = `blk-${++blockSerial}`;
  const firstCast = currentProject.manifest.cast[0]?.castId;
  store.addDialogueBlock(
    {
      id,
      type: "dialogue",
      speaker: firstCast ? { castId: firstCast } : null,
      content: [],
    },
    selectedBlockId ?? undefined,
  );
  selectedBlockId = id;
  persist();
  renderAll();
  window.setTimeout(() => {
    const editor = canvas.querySelector<HTMLElement>(`.rich-editor[data-block-id="${CSS.escape(id)}"]`);
    editor?.focus();
  }, 0);
});

undoButton.addEventListener("click", () => {
  store.undo();
  persist();
  renderAll();
});
redoButton.addEventListener("click", () => {
  store.redo();
  persist();
  renderAll();
});
requireElement<HTMLButtonElement>("#export-button").addEventListener("click", exportProject);
requireElement<HTMLButtonElement>("#import-button").addEventListener("click", () => importInput.click());
importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  if (file) await importProjectFile(file);
  importInput.value = "";
});
requireElement<HTMLButtonElement>("#new-project-button").addEventListener("click", () => {
  pendingLegacyDocument = null;
  projectNameInput.value = "未命名剧本";
  projectDialog.showModal();
  projectNameInput.focus();
  projectNameInput.select();
});
requireElement<HTMLButtonElement>("#project-cancel-button").addEventListener("click", () => {
  pendingLegacyDocument = null;
  projectDialog.close();
});
requireElement<HTMLFormElement>("#project-form").addEventListener("submit", (event) => {
  event.preventDefault();
  createNewProject(projectNameInput.value);
  projectDialog.close();
});
requireElement<HTMLButtonElement>("#reset-button").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  window.location.reload();
});
const samplesDialog=requireElement<HTMLDialogElement>('#samples-dialog');
const sampleList=requireElement<HTMLElement>('#samples-list');
for(const sample of sampleStories){
  const card=document.createElement('button');card.type='button';card.className='sample-card';
  const name=document.createElement('strong');name.textContent=sample.title;
  const count=document.createElement('span');count.textContent=`${sample.chapters} 章 · ${sample.scenes} 场`;
  const description=document.createElement('small');description.textContent=sample.summary;
  card.append(name,count,description);
  card.addEventListener('click',()=>{
    store.commitEditSession();persist();
    try {localStorage.setItem('yahari:before-story-import',JSON.stringify(createProjectFile(currentProject.manifest,documentsWithActiveEdit())));}
    catch {showToast('无法备份当前作品，请先导出后重试。','error');return;}
    if(!activateProject(createSampleStory(sample.id,`sample-${crypto.randomUUID()}`)))return;
    samplesDialog.close();setPanel('outline',false,false);
    showToast(`已打开「${sample.title}」。可在目录侧边栏恢复之前的作品。`);
  });
  sampleList.append(card);
}
const openSamples=()=>samplesDialog.showModal();
requireElement('#samples-close').addEventListener('click',()=>samplesDialog.close());
requireElement('#samples-button').addEventListener('click',openSamples);

for (const tab of document.querySelectorAll<HTMLButtonElement>(".inspector-tab")) {
  tab.addEventListener("click", () => {
    inspectorTab = (tab.dataset.tab as InspectorTab | undefined) ?? "diagnostics";
    activateInspectorTab();
    renderInspector();
  });
}

pickerSearch.addEventListener("input", renderPickerCandidates);
pickerSearch.addEventListener("keydown", (event) => {
  if (blocksCommand(event)) return;
  if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closePicker(); }
  if (event.key === "Enter") {
    event.preventDefault();
    pickerList.querySelector<HTMLButtonElement>(".picker-item:not(:disabled)")?.click();
  }
});
picker.addEventListener("mousedown", (event) => {
  if (event.target === picker) closePicker();
});

document.addEventListener("keydown", (event) => {
  if (blocksCommand(event)) return;
  if (event.key === "Escape" && pickerState) {
    event.preventDefault();
    closePicker();
    return;
  }
  if (document.querySelector("dialog[open]")) return;
  if (event.target instanceof HTMLInputElement
    || event.target instanceof HTMLTextAreaElement
    || event.target instanceof HTMLSelectElement) return;
  if(event.target instanceof Node && composeInput.contains(event.target))return;
  const mod = event.ctrlKey || event.metaKey;
  if (!mod || event.key.toLowerCase() !== "z") return;
  event.preventDefault();
  if (event.shiftKey) store.redo();
  else store.undo();
  persist();
  renderAll();
});

window.addEventListener("pagehide", () => {
  if (persistTimer !== null) persist();
});

guardComposition(composeInput);
guardComposition(pickerSearch);
loadDraft();
renderIdentities();
composeInput.addEventListener('input',saveDraft);
composeInput.addEventListener('compositionstart',()=>{composingIme=true;});
composeInput.addEventListener('compositionend',()=>{composingIme=false;saveDraft();});
composeInput.addEventListener('paste',event=>{event.preventDefault();insertTextAtSelection(composeInput,event.clipboardData?.getData('text/plain')??'');saveDraft();});
composeInput.addEventListener('keydown',event=>{
  if(blocksCommand(event)||composingIme)return;
  if(event.key==='Enter'){event.preventDefault();if(event.shiftKey){insertTextAtSelection(composeInput,'\n');saveDraft();}else sendDialogue();}
  if(event.key==='/'||(event.ctrlKey&&event.key===' ')){event.preventDefault();openDraftPicker();}
});
document.addEventListener('selectionchange',()=>{const sel=window.getSelection();if(sel?.rangeCount&&composeInput.contains(sel.getRangeAt(0).commonAncestorContainer))draftRange=sel.getRangeAt(0).cloneRange();});
composeSend.addEventListener('click',sendDialogue);
requireElement('#compose-action').addEventListener('click',openDraftPicker);
requireElement('#compose-cue').addEventListener('click',()=>openCuePicker());
requireElement('#action-target').addEventListener('change',renderPickerCandidates);
requireElement('#inspector-close').addEventListener('click',()=>setPanel('inspector',false));
const openStory = installStoryDialog(demoManifest, next => {
  store.commitEditSession(); persist();
  try { localStorage.setItem('yahari:before-story-import',JSON.stringify(createProjectFile(currentProject.manifest,documentsWithActiveEdit()))); }
  catch { showToast('无法备份当前作品，请先导出后重试。','error'); return false; }
  const ok=activateProject(next);
  if(ok)showToast('已导入分层剧本。可在目录切换场景或恢复导入前作品。');
  return ok;
});
requireElement('#story-button').addEventListener('click',openStory);
requireElement('#restore-story-button').addEventListener('click',()=>{
  try {
    const raw=localStorage.getItem('yahari:before-story-import');
    if(!raw){showToast('没有可恢复的导入前作品。');return;}
    const decoded=decodeProjectFile(JSON.parse(raw),PROJECT_FILE_CATALOG);
    if(!decoded.ok||decoded.kind!=='project')throw new Error();
    store.commitEditSession();persist();
    const current=JSON.stringify(createProjectFile(currentProject.manifest,documentsWithActiveEdit()));
    if(activateProject(decoded.project)){localStorage.setItem('yahari:before-story-import',current);showToast('已恢复；再次点击可切回。');}
  }catch{showToast('备份恢复失败，请使用已导出的项目文件。','error');}
});
const structureDialog=requireElement<HTMLDialogElement>('#structure-dialog');
requireElement('#structure-button').addEventListener('click',()=>{
  const doc=store.document;const chapter=currentProject.manifest.narrative?.chapters.find(c=>c.documentIds.includes(doc.documentId));
  requireElement<HTMLInputElement>('#structure-project-title').value=currentProject.manifest.title;
  requireElement<HTMLTextAreaElement>('#structure-project-summary').value=currentProject.manifest.narrative?.summary??'';
  requireElement<HTMLInputElement>('#structure-scene-title').value=doc.title;
  requireElement<HTMLTextAreaElement>('#structure-scene-summary').value=doc.summary??'';
  requireElement<HTMLInputElement>('#structure-chapter-title').value=chapter?.title??'第一章';
  requireElement<HTMLTextAreaElement>('#structure-chapter-summary').value=chapter?.summary??'';
  structureDialog.showModal();
});
requireElement('#structure-close').addEventListener('click',()=>structureDialog.close());
requireElement('#structure-form').addEventListener('submit',event=>{
  event.preventDefault();if(projectAvailability!=='ready')return;
  store.commitEditSession();persist();
  const doc=store.document;
  doc.title=requireElement<HTMLInputElement>('#structure-scene-title').value.trim()||doc.title;
  doc.summary=requireElement<HTMLTextAreaElement>('#structure-scene-summary').value.trim();
  const m=currentProject.manifest;m.title=requireElement<HTMLInputElement>('#structure-project-title').value.trim()||m.title;
  m.narrative??={summary:'',chapters:[]};m.narrative.summary=requireElement<HTMLTextAreaElement>('#structure-project-summary').value.trim();
  const title=requireElement<HTMLInputElement>('#structure-chapter-title').value.trim()||'第一章';
  let chapter=m.narrative.chapters.find(c=>c.title===title);
  if(!chapter){chapter={id:crypto.randomUUID(),title,summary:'',documentIds:[]};m.narrative.chapters.push(chapter);}
  for(const c of m.narrative.chapters)if(c!==chapter)c.documentIds=c.documentIds.filter(id=>id!==doc.documentId);
  if(!chapter.documentIds.includes(doc.documentId))chapter.documentIds.push(doc.documentId);chapter.summary=requireElement<HTMLTextAreaElement>('#structure-chapter-summary').value.trim();
  m.narrative.chapters=m.narrative.chapters.filter(c=>c.documentIds.length);
  store.loadDocument(doc);persist();renderAll();structureDialog.close();
});
requireElement('#new-scene-button').addEventListener('click',()=>{
  if(projectAvailability!=='ready')return;
  store.commitEditSession();saveDraft();persist();
  const previousId=store.document.documentId;const id=`scene-${crypto.randomUUID()}`;
  const doc:ScriptDocument={schemaVersion:'0.7',documentId:id,title:`新场景 ${projectFile.documents.length+1}`,summary:'',blocks:[]};
  projectFile.documents.push(doc);currentProject.manifest.documents.push({id,path:`${id}.yahari.json`});
  const chapter=currentProject.manifest.narrative?.chapters.find(c=>c.documentIds.includes(previousId));chapter?.documentIds.push(id);
  switchScene(id);requireElement<HTMLButtonElement>('#structure-button').click();
});
updateProjectChrome();
renderAll();

requireElement<HTMLButtonElement>("#preview-button").addEventListener("click", () => {
  if (diagnostics().some(item => item.severity === "error")) { setPanel('inspector', true); inspectorTab="diagnostics";activateInspectorTab();renderInspector();showToast("请先修复检查中的错误，再开始排练。", "error"); return; }
  store.commitEditSession();
  openPreview(courtroomAdapter.compile(store.document,currentProject),castName,currentProject.manifest);
});

requireElement('#navigator-button').addEventListener('click', () => { renderOutline(); setPanel('outline', true); });
requireElement('#outline-close').addEventListener('click', () => setPanel('outline', false));
requireElement('#diagnostics-button').addEventListener('click', () => {
  inspectorTab = 'diagnostics'; activateInspectorTab(); renderInspector(); setPanel('inspector', true);
});
// Keep keyboard traversal in transient surfaces; touch users always have a close button.
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || blocksCommand(event) || document.querySelector('dialog[open]')) return;
  const surface = pickerState ? picker : document.body.classList.contains('outline-open')
    ? requireElement<HTMLElement>('.outline-panel') : document.body.classList.contains('inspector-open') && isMobile()
    ? requireElement<HTMLElement>('.inspector-panel') : null;
  if (!surface) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    if (pickerState) closePicker();
    else setPanel(surface.classList.contains('outline-panel') ? 'outline' : 'inspector', false);
  }
  if (event.key === 'Tab') {
    const nodes = [...surface.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]')].filter(e=>e.getClientRects().length);
    const first = nodes[0], last = nodes.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && (document.activeElement === first || !nodes.includes(document.activeElement as HTMLElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !nodes.includes(document.activeElement as HTMLElement))) { event.preventDefault(); first.focus(); }
  }
});
const firstHint = requireElement<HTMLElement>('#first-run-hint');
try { firstHint.hidden = localStorage.getItem('yahari:p1d:hint') === 'seen'; } catch { firstHint.hidden = false; }
requireElement('#dismiss-hint').addEventListener('click', () => {
  firstHint.hidden = true;
  try { localStorage.setItem('yahari:p1d:hint','seen'); } catch { /* Hint is optional. */ }
});

requireElement("#cast-close").addEventListener("click", () => requireElement<HTMLDialogElement>("#cast-dialog").close());
