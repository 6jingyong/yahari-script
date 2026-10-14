import { installStoryDialog } from "./story-dialog.js";
import { installAiConnectionSettings } from "./ai-connection.js";
import { openProjectLibrary, type ProjectLibrary, type LibraryProject } from './project-library.js';
import { installProjectFilesDialog } from './project-files-dialog.js';
import { installStoryWorkspace } from './story-workspace.js';
import { downloadStandalonePlayer } from './export-player.js';
import { createBranchSample } from '../../../examples/branching-story/fixture.js';
import { sceneBackgroundRef, withSceneBackground } from "./scene-settings.js";
import {
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  documentsWithActiveEdit as mergeActiveDocument,
  downloadProject,
  loadStoredProject,
  saveProject,
  ProjectFileWriter,
} from "./project-storage.js";
import { addDemoCharacter, completeDemoCast, demoCastDisplayName } from '../../../content-packs/courtroom-demo/cast.js';
import { courtroomDemoPack } from '../../../content-packs/courtroom-demo/pack.js';
import { courtroomDemoResources } from '../../../content-packs/courtroom-demo/generated.js';
import { createStaticResourceResolver } from '../../../packages/presentation/src/index.js';
import { applyAudioAssets,resolveAudioAssets } from './builtin-audio-assets.js';
import { installBuiltinAsset, resolveBuiltinOverrides, builtinAssetEntries, materializeBuiltin } from './builtin-assets.js';
import { installAssetWorkspace, neutralStageImage } from './asset-workspace.js';
import { installAssetPack } from '../../../packages/asset-library/src/index.js';
import { embeddedCourtroomPack, embeddedResources } from './project-assets.js';
import { actionArt, actionLabel as fallbackActionLabel } from "./action-art.js";
import { openPreview } from "./preview.js";
import { typingSoundControl } from './typing-sound-controls.js';
import {actionSoundControl} from './action-sound-controls.js';
import {PreviewSynthAudio,resolvePreviewAudio} from './preview-audio.js';
import {
  courtroomAdapter,
  courtroomTokenTypes,
  defaultTypingSound,
  actionKey,actionCastId,actionSound,defaultActionSound,
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

const aiConnection = installAiConnectionSettings(localStorage);

function defaultProjectFile(): YahariProjectFile {
  return createSampleStory(sampleStories[0].id, 'sample-default');
}

function loadInitialProject(): YahariProjectFile {
  return loadStoredProject(
    localStorage,
    PROJECT_FILE_CATALOG,
    demoManifest,
    defaultProjectFile,
    manifest => normalizeSampleCast(completeDemoCast(manifest)),
  );
}

let projectLibrary: ProjectLibrary | null = null;
let libraryInitial: LibraryProject | null = null;
let startupStorageMessage = '';
try {
  projectLibrary = await openProjectLibrary();
  libraryInitial = await projectLibrary.active();
  if (libraryInitial) {
    const checked=decodeProjectFile(libraryInitial.project,PROJECT_FILE_CATALOG);
    if (!checked.ok || checked.kind!=='project') throw new Error('本机作品损坏');
    libraryInitial.project=checked.project;
  }
} catch {
  libraryInitial=null;
  startupStorageMessage='本机作品库未能读取，已打开浏览器旧草稿或示例。可在“作品与文件”查看恢复点；请及时导出备份。';
}
let projectFile = libraryInitial?.project ?? loadInitialProject();
projectFile = {...projectFile, manifest: normalizeSampleCast(projectFile.manifest)};
if (projectLibrary && !libraryInitial && !startupStorageMessage && localStorage.getItem(STORAGE_KEY)) {
  try { await projectLibrary.save(projectFile,projectFile.manifest.entryDocumentId,'旧草稿迁移'); }
  catch { startupStorageMessage='旧草稿尚未迁移成功，原数据仍保留，请先导出作品文件。'; }
}
function projectPacks(file: YahariProjectFile): CourtroomContentPack[] {
  const overlay=resolveBuiltinOverrides(file.embeddedPacks??[]);
  return [resolveAudioAssets(overlay.pack,file.manifest.projectSettings), ...(file.embeddedPacks ?? []).flatMap(item => {
    if(overlay.overlayIds.has(item.id))return [];
    const pack = embeddedCourtroomPack(item);
    return pack ? [pack] : [];
  })];
}
function resourceResolver(file: YahariProjectFile) {
  return createStaticResourceResolver([courtroomDemoResources, ...embeddedResources(file.embeddedPacks ?? []),resolveBuiltinOverrides(file.embeddedPacks??[]).resources]);
}
const initialAvailability = decodeProjectFile(projectFile, PROJECT_FILE_CATALOG);
let projectAvailability: ProjectAvailability = initialAvailability.ok
  && initialAvailability.kind === "project"
  ? initialAvailability.availability
  : "ready";
if (projectFile.embeddedPacks?.some(item => !embeddedCourtroomPack(item))) projectAvailability = 'missing-content-pack';
let currentProject: ProjectContext<CourtroomContentPack> = {
  manifest: structuredClone(projectFile.manifest),
  contentPacks: projectAvailability === "ready" ? projectPacks(projectFile) : [],
};
let activeResolver = resourceResolver(projectFile);
const initialDocument = projectFile.documents.find(
  (document) => document.documentId === (libraryInitial?.activeDocumentId ?? projectFile.manifest.entryDocumentId),
) ?? projectFile.documents[0] ?? structuredClone(demoDocument);
const store = new EditorStore(initialDocument);
const canvas = requireElement<HTMLElement>("#editor-canvas");
let storyWorkspace: ReturnType<typeof installStoryWorkspace> | undefined;
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

let selectedBlockId: string | null = store.document.blocks[0]?.id ?? null;
let selectedTokenId: string | null = null;
let inspectorTab: InspectorTab = "diagnostics";
let pickerState: PickerState | null = null;
let tokenSerial = Date.now();
let blockSerial = Date.now();
let pendingLegacyDocument: ScriptDocument | null = null;
let persistTimer: number | null = null;
let persistVersion=0, pendingSaves=0, unsavedChanges=false;
const fileWriter=new ProjectFileWriter();
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
  if(panel==='outline'){document.body.classList.remove('outline-open');if(open)storyWorkspace?.open();return;}
  if (open) {
    closePicker(false);
    panelReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.classList.remove('outline-open', 'inspector-open');
  }
  document.body.classList.toggle(`${panel}-open`, open);
  for (const name of ['inspector'] as const) {
    const surface = requireElement<HTMLElement>(`.${name}-panel`);
    if (document.body.classList.contains(`${name}-open`) && isMobile()) {
      surface.setAttribute('role','dialog'); surface.setAttribute('aria-modal','true');
    } else { surface.removeAttribute('role'); surface.removeAttribute('aria-modal'); }
  }
  requireElement('#diagnostics-button').setAttribute('aria-expanded', String(document.body.classList.contains('inspector-open')));
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
      const decoded=decodeProjectFile(createProjectFile(currentProject.manifest,projectFile.documents.map(d=>d.documentId===probe.documentId?probe:d),undefined,projectFile.embeddedPacks),PROJECT_FILE_CATALOG);
      if(decoded.ok) draftNodes=draft.content;
      if(currentProject.manifest.cast.some(c=>c.castId===draft.speaker)) composingAs=draft.speaker;
    }
  } catch { draftNodes=[]; }
  renderRichContent(composeInput,{id:'draft',type:'dialogue',speaker:composingAs?{castId:composingAs}:null,content:draftNodes},new Set());
  decorateDraft();
}
function castPortraitUrl(castId:string|null|undefined):string|undefined {
  if(!castId)return undefined;
  const cast=currentProject.manifest.cast.find(item=>item.castId===castId);
  if(!cast)return undefined;
  const pack=currentProject.contentPacks.find(item=>item.id===cast.characterRef.packId);
  const character=pack?.characters.find(item=>item.id===cast.characterRef.id);
  return character ? activeResolver.resolve(character.portraits.base)?.url : undefined;
}
function castCharacterId(castId:string|null|undefined):string|undefined {
  const ref=currentProject.manifest.cast.find(item=>item.castId===castId)?.characterRef;
  return ref?.packId===courtroomDemoPack.id?ref.id:undefined;
}
function portraitThumbnail(characterId:string,label:string):HTMLElement|undefined {
  const index=courtroomDemoPack.characters.findIndex(item=>item.id===characterId);
  if(index<0)return undefined;
  if(activeResolver.resolve(courtroomDemoPack.characters[index].portraits.base)?.url.startsWith('data:'))return undefined;
  const thumb=document.createElement('span');thumb.className='portrait-thumbnail';thumb.textContent=label.slice(0,1);
  thumb.style.backgroundSize=`${courtroomDemoPack.characters.length*100}% 800%`;
  thumb.style.backgroundPosition=`${index*100/(courtroomDemoPack.characters.length-1)}% 0%`;
  void loadActionThumbnails().then(()=>thumb.classList.add('is-ready'),()=>{});
  return thumb;
}

function renderSpeakerAvatar(button:HTMLButtonElement,castId:string|null|undefined):void {
  button.replaceChildren();
  const thumbnail=castCharacterId(castId)?portraitThumbnail(castCharacterId(castId)!,castName(castId)):undefined;
  const url=thumbnail?undefined:castPortraitUrl(castId);
  if(thumbnail){button.append(thumbnail);}
  else if(url){
    const image=document.createElement('img');image.src=url;image.alt='';image.loading='lazy';button.append(image);
  }else{
    const fallback=document.createElement('span');fallback.textContent=castInitial(castId);button.append(fallback);
  }
  button.title=castName(castId);
  button.setAttribute('aria-label',`切换人物，当前：${castName(castId)}`);
  button.disabled=projectAvailability!=='ready';
}

let hiddenBuiltinIds=new Set<string>();
let speakerSelectionHandler:((castId:string|null)=>void)|null=null;
function openSpeakerDialog(current:string|null,select:(castId:string|null)=>void):void {
  speakerSelectionHandler=select;
  const soundSettings=requireElement<HTMLElement>('#speaker-sound-settings');soundSettings.replaceChildren();
  const saveSetting=(target:Record<string,unknown>,value:unknown)=>{
    if(value===undefined)delete target.typingSound;else target.typingSound=value;
    store.commitEditSession();void persist('调整文字音');renderAll();
  };
  const defaults=currentProject.manifest.projectSettings??{};
  const defaultRef=defaultTypingSound(currentProject.contentPacks);
  const defaultLabel=currentProject.contentPacks.flatMap(p=>p.audio.sfx).find(s=>s.resource.packId===defaultRef?.packId&&s.resource.id===defaultRef?.id)?.label??'静音';
  soundSettings.append(typingSoundControl('作品默认文字音',defaults.typingSound,currentProject.contentPacks,`自动 · ${defaultLabel}`,value=>{currentProject.manifest.projectSettings=defaults;saveSetting(defaults,value);}));
  const member=currentProject.manifest.cast.find(c=>c.castId===current);
  if(member){const overrides=member.overrides??{};soundSettings.append(typingSoundControl(`${castName(current)}的默认文字音`,overrides.typingSound,currentProject.contentPacks,'跟随作品默认',value=>{member.overrides=overrides;saveSetting(overrides,value);}));}
  soundSettings.querySelectorAll('select').forEach(s=>{s.disabled=projectAvailability!=='ready';});
  const options=requireElement<HTMLElement>('#speaker-options');options.replaceChildren();
  const representedBuiltIns=new Set(
    currentProject.manifest.cast
      .filter(cast=>cast.characterRef.packId===courtroomDemoPack.id)
      .map(cast=>cast.characterRef.id),
  );
  const choices:Array<{castId:string|null;characterId?:string;label:string;portraitUrl?:string}> = [];
  for(const cast of currentProject.manifest.cast){
    choices.push({castId:cast.castId,label:castName(cast.castId),portraitUrl:castPortraitUrl(cast.castId)});
  }
  for(const character of courtroomDemoPack.characters){
    if(representedBuiltIns.has(character.id)||hiddenBuiltinIds.has('local.builtin.'+courtroomDemoPack.id+'.characters.'+character.id))continue;
    choices.push({
      castId:null,
      characterId:character.id,
      label:character.name,
      portraitUrl:activeResolver.resolve(character.portraits.base)?.url,
    });
  }
  choices.push({castId:null,label:castName(null)});
  for(const choice of choices){
    const button=document.createElement('button');button.type='button';button.className='speaker-option';
    button.setAttribute('aria-pressed',String(choice.characterId===undefined&&choice.castId===current));
    const portrait=document.createElement('span');portrait.className='speaker-option-avatar';portrait.setAttribute('aria-hidden','true');
    const thumbnail=portraitThumbnail(choice.characterId??castCharacterId(choice.castId)??'',choice.label);
    if(thumbnail)portrait.append(thumbnail);
    else if(choice.portraitUrl){const image=document.createElement('img');image.src=choice.portraitUrl;image.alt='';image.loading='lazy';portrait.append(image);}
    else portrait.textContent=choice.label.slice(0,1);
    const label=document.createElement('span');label.textContent=choice.label;
    button.append(portrait,label);
    button.addEventListener('click',()=>{
      if(choice.characterId){
        saveDraft();
        currentProject.manifest=addDemoCharacter(currentProject.manifest,choice.characterId);
        const added=currentProject.manifest.cast.find(cast=>cast.characterRef.packId===courtroomDemoPack.id&&cast.characterRef.id===choice.characterId);
        if(!added){showToast(`无法使用${choice.label}。`,'error');return;}
        persist();speakerSelectionHandler?.(added.castId);renderAll();
      }else{
        speakerSelectionHandler?.(choice.castId);
      }
      requireElement<HTMLDialogElement>('#speaker-dialog').close();
    });
    options.append(button);
  }
  if(projectAvailability==='ready'){
    const add=document.createElement('button');add.type='button';add.className='speaker-option';add.textContent='＋ 打开角色素材库';
    add.addEventListener('click',()=>{requireElement<HTMLDialogElement>('#speaker-dialog').close();void assetWorkspace.open('characters');});
    options.append(add);
  }
  requireElement<HTMLDialogElement>('#speaker-dialog').showModal();
}

function setComposerSpeaker(castId:string|null):void {
  closePicker(false);composingAs=castId;saveDraft();
  renderRichContent(composeInput,{id:'draft',type:'dialogue',speaker:castId?{castId}:null,content:draftNodes},new Set());
  decorateDraft();draftRange=null;renderIdentities();composeInput.focus();
}

function renderIdentities(): void {
  if(composingAs&&!currentProject.manifest.cast.some(c=>c.castId===composingAs))composingAs=currentProject.manifest.cast[0]?.castId??null;
  renderSpeakerAvatar(requireElement<HTMLButtonElement>('#compose-avatar'),composingAs);
  composeInput.contentEditable=String(projectAvailability==='ready');
  requireElement<HTMLButtonElement>('#compose-action').disabled=projectAvailability!=='ready';
  composeSend.disabled=projectAvailability!=='ready'||!draftNodes.some(n=>n.type==='token'||n.text.trim());
}
function openDraftPicker(): void {
  if(projectAvailability!=='ready')return;
  const selection=window.getSelection(),selected=selection?.rangeCount?selection.getRangeAt(0):undefined;
  const range=selected&&composeInput.contains(selected.commonAncestorContainer)?selected.cloneRange():draftRange&&composeInput.contains(draftRange.commonAncestorContainer)?draftRange.cloneRange():document.createRange();
  if(!composeInput.contains(range.commonAncestorContainer)){range.selectNodeContents(composeInput);range.collapse(false);}
  composeInput.focus();
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


function snapshotProject(): YahariProjectFile {
  return createProjectFile(currentProject.manifest,documentsWithActiveEdit(),projectFile.metadata,projectFile.embeddedPacks);
}

async function persist(checkpoint?: string): Promise<boolean> {
  if (persistTimer !== null) {
    window.clearTimeout(persistTimer);
    persistTimer = null;
  }
  projectFile=snapshotProject();
  const snapshot=projectFile, version=++persistVersion;
  pendingSaves++; unsavedChanges=true;
  saveStatus.textContent='正在保存…';
  try {
    if (projectLibrary) await projectLibrary.save(snapshot,store.document.documentId,checkpoint);
    else saveProject(localStorage,snapshot.manifest,snapshot.documents,snapshot.embeddedPacks,snapshot.metadata);
    if (version===persistVersion && persistTimer===null) {
      unsavedChanges=false;
      saveStatus.textContent=`本机已保存 · ${new Date().toLocaleTimeString('zh-CN',{hour12:false})}`;
    }
    return true;
  } catch {
    if (version===persistVersion) {
      saveStatus.textContent = "保存失败，请导出";
      showToast("本机保存失败，当前编辑仍在页面中，请导出作品文件。", "error");
    }
    return false;
  } finally {
    pendingSaves--;
  }
}

function schedulePersist(): void {
  if (persistTimer !== null) window.clearTimeout(persistTimer);
  unsavedChanges=true;
  saveStatus.textContent = "正在保存…";
  persistTimer = window.setTimeout(()=>void persist(), 300);
}

function documentsWithActiveEdit(): ScriptDocument[] {
  return mergeActiveDocument(projectFile,store.document);
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
  requireElement<HTMLButtonElement>("#new-scene-button").disabled = projectAvailability !== "ready";
  requireElement<HTMLButtonElement>('#story-add-chapter').disabled=projectAvailability!=='ready';
}

function findDialogueBlock(blockId: string): DialogueBlock | null {
  const block = store.document.blocks.find((item) => item.id === blockId);
  return block?.type === "dialogue" ? block : null;
}

function castName(castId: string | null | undefined): string {
  if (!castId) return "旁白";
  const cast = currentProject.manifest.cast.find((item) => item.castId === castId);
  if (!cast) return castId;
  for (const pack of currentProject.contentPacks) {
    const character = pack.characters.find(
      (item) => item.id === cast.characterRef.id && pack.id === cast.characterRef.packId,
    );
    if (character) return demoCastDisplayName(cast, character.name);
  }
  return cast.displayName ?? castId;
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

function actionLabel(token:TypedToken, speaker?:string|null):string {
  const owner=store.document.blocks.find(block=>block.type==='dialogue'&&block.content.some(node=>node.type==='token'&&node.token.id===token.id));
  const castId=token.subject?.kind==='cast'?token.subject.id:speaker??(owner?.type==='dialogue'?owner.speaker?.castId:undefined)??composingAs;
  const ref=currentProject.manifest.cast.find(cast=>cast.castId===castId)?.characterRef;
  const character=ref?currentProject.contentPacks.find(pack=>pack.id===ref.packId)?.characters.find(actor=>actor.id===ref.id):undefined;
  return fallbackActionLabel(token,character);
}

const thumbnailUrl='../../content-packs/courtroom-demo/assets/action-thumbnails.webp';
let thumbnailReady:Promise<void>|undefined;
function loadActionThumbnails():Promise<void> {
  if(!thumbnailReady){
    const image=new Image();
    image.decoding='async';
    image.src=thumbnailUrl;
    thumbnailReady=image.decode().catch(error=>{
      // Keep the fallback visible, but let a later interaction retry a transient failure.
      thumbnailReady=undefined;
      throw error;
    });
  }
  return thumbnailReady;
}

function renderedActionArt(token:TypedToken,speaker?:string|null):HTMLElement {
  const fallback=actionArt(token,artCharacter(token,speaker));
  const owner=token.subject?.kind==='cast'?token.subject.id:speaker,cast=currentProject.manifest.cast.find(c=>c.castId===owner);
  const actor=cast?currentProject.contentPacks.find(p=>p.id===cast.characterRef.packId)?.characters.find(a=>a.id===cast.characterRef.id):undefined;
  const exactAction=actor?(token.type==='courtroom.pose'?actor.poses:actor.reactions).find(a=>a.id===tokenValue(token)):undefined;
  const resolved=exactAction?activeResolver.resolve(exactAction.asset):undefined;
  if(resolved?.url.startsWith('data:')){const clip=document.createElement('span');clip.className='action-sprite';const image=document.createElement('img');image.src=resolved.url;image.alt='';clip.append(image);fallback.append(clip);fallback.classList.add('art-loaded');return fallback;}
  const characterId=artCharacter(token,speaker);
  if(!characterId)return fallback;
  const pack=currentProject.contentPacks.find(item=>item.id==='official.courtroom-demo');
  const character=pack?.characters.find(item=>item.id===characterId);
  const actionId=tokenValue(token);
  const action=character?[...character.poses,...character.reactions].find(item=>item.id===actionId):undefined;
  if(!action||!character)return fallback;
  const characterIndex=courtroomDemoPack.characters.findIndex(item=>item.id===characterId);
  const original=courtroomDemoPack.characters[characterIndex];
  const actionIndex=original?[...original.poses,...original.reactions].findIndex(item=>item.id===actionId):-1;
  if(characterIndex<0||actionIndex<0)return fallback;
  const clip=document.createElement('span');
  clip.className='action-sprite action-thumbnail';
  clip.style.backgroundSize=`${courtroomDemoPack.characters.length*100}% 800%`;
  clip.style.backgroundPosition=`${characterIndex*100/(courtroomDemoPack.characters.length-1)}% ${actionIndex*100/7}%`;
  fallback.append(clip);
  void loadActionThumbnails().then(()=>fallback.classList.add('art-loaded'),()=>{});
  return fallback;
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
  chip.title=`${token.subject?.kind==='cast'?castName(token.subject.id)+' · ':''}${actionLabel(token,speaker)}`;
  chip.setAttribute('aria-label',chip.title);
  chip.append(renderedActionArt(token,speaker));
  const caption=document.createElement('span');caption.className='action-caption';caption.textContent=actionLabel(token,speaker);chip.append(caption);

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

function switchScene(id: string): void {
  if (id === store.document.documentId) return;
  store.commitEditSession(); saveDraft(); persist();
  const next = projectFile.documents.find(d => d.documentId === id);
  if (!next) return;
  closePicker(false); store.loadDocument(next);
  selectedBlockId = next.blocks[0]?.id ?? null; selectedTokenId = null;
  loadDraft(); persist(); renderAll();
}
function sceneBackgroundId(documentId:string):string|undefined {
  const document=documentsWithActiveEdit().find(item=>item.documentId===documentId);
  const resource=document?sceneBackgroundRef(document):undefined;
  return resource
    ? currentProject.contentPacks.flatMap(pack=>pack.backgrounds).find(item=>item.resource.packId===resource.packId&&item.resource.id===resource.id)?.id
    : undefined;
}

function setSceneBackground(documentId:string,backgroundId:string):void {
  if(projectAvailability!=='ready')return;
  const background=currentProject.contentPacks.flatMap(pack=>pack.backgrounds).find(item=>item.id===backgroundId);
  if(!background)return;
  store.commitEditSession();saveDraft();
  if(documentId===store.document.documentId){
    store.replaceDocument(withSceneBackground(store.document,background.resource));
  }else{
    projectFile.documents=projectFile.documents.map(document=>document.documentId===documentId?withSceneBackground(document,background.resource):document);
  }
  persist();renderOutline();
}

function renderOutline(): void {
  storyWorkspace?.refresh();
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
      if(block.cue.type==='courtroom.background')continue;
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

    const avatar = document.createElement("button");
    avatar.type='button';avatar.className = "speaker-avatar dialogue-avatar";
    renderSpeakerAvatar(avatar,block.speaker?.castId);
    avatar.addEventListener('click',event=>{
      event.stopPropagation();
      openSpeakerDialog(block.speaker?.castId??null,castId=>{
        store.commitEditSession();store.updateSpeaker(block.id,castId?{castId}:null);persist();renderAll();
      });
    });

    const card = document.createElement("div");
    card.className = "dialogue-card";
    const removeMessage=document.createElement('button');removeMessage.className='message-remove';removeMessage.textContent='删除';removeMessage.setAttribute('aria-label','删除这条台词');removeMessage.disabled=projectAvailability!=='ready';
    removeMessage.addEventListener('click',()=>{store.commitEditSession();store.removeBlock(block.id);selectedBlockId=store.document.blocks.at(-1)?.id??null;persist();renderAll();});
    const playMessage=document.createElement('button');playMessage.type='button';playMessage.className='message-play';playMessage.textContent='从这里排练';
    playMessage.addEventListener('click',()=>startRehearsal(block.id));
    const voice=typingSoundControl('本句文字音',block.metadata?.typingSound,currentProject.contentPacks,block.speaker?'跟随人物默认':'跟随作品默认',value=>{
      store.commitEditSession();const doc=store.document,line=doc.blocks.find(b=>b.id===block.id);
      if(!line||line.type!=='dialogue')return;
      const metadata=line.metadata??={};if(value===undefined)delete metadata.typingSound;else metadata.typingSound=value;
      store.replaceDocument(doc);void persist();renderAll();
    });
    voice.querySelector('select')!.disabled=projectAvailability!=='ready';
    const messageActions=document.createElement('div');messageActions.className='message-actions';messageActions.append(voice,playMessage,removeMessage);card.append(messageActions);

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

    card.append(editor);
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

let actionAudition:PreviewSynthAudio|null=null;
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
  const soundKey=actionKey(token);
  if(soundKey){
    const owner=store.document.blocks.find(b=>b.type==='dialogue'&&b.content.some(n=>n.type==='token'&&n.token.id===token.id));
    const speakerId=owner?.type==='dialogue'?owner.speaker?.castId??null:null;
    const defaultRef=defaultActionSound(token,speakerId,currentProject),defaultSound=defaultRef?resolvePreviewAudio(currentProject.contentPacks,defaultRef,'sfx'):undefined;
    const field=actionSoundControl(token.metadata?.sound,currentProject.contentPacks,defaultSound?.label??'无音效',value=>{
      const changed=structuredClone(token);changed.metadata??={};if(value===undefined)delete changed.metadata.sound;else changed.metadata.sound=value;
      store.commitEditSession();store.applyQuickFix(token.id,{kind:'replace-token',label:'设置动作声音',token:changed});void persist();renderAll();
    });field.querySelector('select')!.disabled=projectAvailability!=='ready';box.append(field);
    const note=document.createElement('p');note.className='project-note';note.textContent='声音跟随这个动作播放；人物喊话结束后继续显示台词。';box.append(note);
    const soundRef=actionSound(token,speakerId,currentProject);
    if(soundRef){const audition=document.createElement('button');audition.type='button';audition.className='small-button';audition.textContent='试听动作声音';
      audition.onclick=()=>void(async()=>{actionAudition?.dispose();const audio=new PreviewSynthAudio(currentProject.contentPacks);actionAudition=audio;
        if(!await audio.setEnabled(true)||actionAudition!==audio)return;await audio.prepareClips([soundRef]);if(actionAudition!==audio)return;audio.playSfx([soundRef]);
        const resolved=resolvePreviewAudio(currentProject.contentPacks,soundRef,'sfx'),duration=resolved?.clip?.durationMs??Math.max(0,...resolved?.cue?.notes.map(n=>(n.offsetMs??0)+n.durationMs)??[]);
        window.setTimeout(()=>{if(actionAudition===audio){audio.dispose();actionAudition=null;}},duration+200);
      })();box.append(audition);}
    const castId=actionCastId(token,speakerId),member=currentProject.manifest.cast.find(c=>c.castId===castId);
    if(member){const apply=document.createElement('button');apply.type='button';apply.className='small-button';apply.textContent='设为这个人物的同类动作默认';apply.disabled=projectAvailability!=='ready';
      apply.onclick=()=>{const sounds={...member.overrides?.actionSounds as Record<string,unknown>??{}};if(token.metadata?.sound===undefined)delete sounds[soundKey];else sounds[soundKey]=token.metadata.sound;
        member.overrides={...member.overrides,actionSounds:sounds};store.commitEditSession();void persist('调整人物动作声音');renderAll();showToast('已应用到该人物的同类动作；单独设置过声音的动作保留自己的设置。');};box.append(apply);}
  }
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
  pickerReturnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  document.body.classList.add('picker-open');
  picker.classList.remove("is-hidden");
  picker.setAttribute("aria-hidden","false");
  pickerSearch.value="";
  renderPickerCandidates();
  if(isMobile())requireElement<HTMLElement>('#picker-close').focus({preventScroll:true});
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

  const currentSpeaker=pickerState.mode==='draft'?composingAs:pickerState.mode==='inline'?findDialogueBlock(pickerState.blockId)?.speaker?.castId:null;
  const currentOnly=allCandidates.filter(candidate=>{
    if(candidate.tokenType==='courtroom.background')return false;
    if(candidate.subject?.kind==='cast')return candidate.subject.id===currentSpeaker;
    if(candidate.subject?.kind==='speaker')return Boolean(currentSpeaker);
    return true;
  });
  const candidates=currentOnly.filter(candidate=>!query||`${actionLabel(createTokenFromCandidate('preview',candidate),currentSpeaker)} ${candidate.label} ${candidate.tokenType}`.toLowerCase().includes(query.toLowerCase()));
  pickerContext.textContent = currentSpeaker?`${castName(currentSpeaker)} · 当前人物动作`:'旁白 · 节奏与声音';
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
    label.textContent = ({Character:'当前人物',Presentation:'节奏与特效',Audio:'声音',Scene:'镜头'} as Record<string,string>)[category]??category;
    pickerList.append(label);
    for (const candidate of group) {
      const button = document.createElement("button");
      button.className = "picker-item";
      button.disabled = !candidate.enabled;
      const token=createTokenFromCandidate('preview',candidate);
      const speaker=pickerState.mode==='draft'?composingAs:pickerState.mode==='inline'?findDialogueBlock(pickerState.blockId)?.speaker?.castId:null;
      const target=candidate.subject?.kind==='cast'?castName(candidate.subject.id):'';
      const label=actionLabel(token,speaker);
      button.setAttribute('aria-label',`${target} ${label}`.trim());
      button.title=`${target} ${label}`.trim();
      button.append(renderedActionArt(token,speaker));
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

function exportProject(format: 'bundle'|'json' = 'bundle'): void {
  store.commitEditSession();
  const exported = createProjectFile(currentProject.manifest, documentsWithActiveEdit(), {
    ...projectFile.metadata,
    exportedAt: new Date().toISOString(),
    generator: "Yahari Script project files",
  }, projectFile.embeddedPacks);
  try {
    if(!decodeProjectFile(exported,PROJECT_FILE_CATALOG).ok)throw new Error('作品数据超出当前格式限制，请减少素材或修复后再导出。');
    downloadProject(exported,format); showToast('已导出作品，包含全部场景及自有素材。');
  }
  catch (error) { showToast(error instanceof Error?error.message:'导出失败。','error'); }
}

function activateProject(next: YahariProjectFile, documentId?: string, preserveOutgoing=true, checkpoint?:string): boolean {
  // All entry paths, including legacy binding, must pass before state or storage changes.
  const checked = decodeProjectFile(next, PROJECT_FILE_CATALOG);
  if (!checked.ok || checked.kind !== "project") {
    showToast("文件内容不完整或格式不受支持，当前剧本未更改。", "error");
    return false;
  }
  next = checked.project;
  next = {...next, manifest: normalizeSampleCast(next.manifest)};
  if (next.embeddedPacks?.some(item => !embeddedCourtroomPack(item))) {
    showToast('作品中的原创素材包格式不完整，当前作品未更改。','error');
    return false;
  }
  const availability = checked.availability;
  if(preserveOutgoing)void persist('切换作品前');
  const entry = next.documents.find(
    (document) => document.documentId === (documentId ?? next.manifest.entryDocumentId),
  ) ?? next.documents.find(document=>document.documentId===next.manifest.entryDocumentId);
  if (!entry) throw new Error(`Entry document ${next.manifest.entryDocumentId} is missing.`);
  projectFile = structuredClone(next);
  projectAvailability = availability;
  currentProject = {
    manifest: structuredClone(next.manifest),
    contentPacks: availability === "ready" ? projectPacks(next) : [],
  };
  activeResolver=resourceResolver(next);
  store.loadDocument(entry);
  composingAs=currentProject.manifest.cast[0]?.castId??null;
  loadDraft();
  selectedBlockId = entry.blocks[0]?.id ?? null;
  selectedTokenId = null;
  persist(checkpoint);
  renderAll();
  return true;
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
    : withSceneBackground({
        schemaVersion: "0.7",
        documentId: manifest.entryDocumentId,
        title: "场景 1",
        blocks: [],
      }, courtroomDemoPack.backgrounds[0].resource);
  pendingLegacyDocument = null;
  if (!activateProject(createProjectFile(manifest, [document]))) return;
  showToast(`已创建「${manifest.title}」。`);
}

const assetWorkspace = installAssetWorkspace({
  connection: aiConnection,
  snapshot: snapshotProject,
  visibility(hiddenIds) {hiddenBuiltinIds=hiddenIds;renderOutline();},
  async audio(settings) {
    if(projectAvailability!=='ready')throw new Error('当前作品只读。');store.commitEditSession();saveDraft();
    projectFile=applyAudioAssets(snapshotProject(),settings);currentProject={manifest:structuredClone(projectFile.manifest),contentPacks:projectPacks(projectFile)};
    if(!await persist('调整声音素材'))throw new Error('声音已用于页面中的作品，本机保存失败，请导出作品。');renderAll();
  },
  prepare() {
    if(storyWorkspace&&!storyWorkspace.close())return false;
    store.commitEditSession(); saveDraft(); closePicker(false);
    setPanel('outline', false, false); setPanel('inspector', false, false);
  },
  async use(pack, characterId, sceneImage) {
    if (projectAvailability !== 'ready') throw new Error('当前作品只读，请先打开可编辑的作品。');
    const source=pack.origin?builtinAssetEntries.find(entry=>entry.origin.packId===pack.origin?.packId&&entry.kind===pack.origin.kind&&entry.entityId===pack.origin.entityId):undefined;
    if(pack.origin&&!source)throw new Error('素材所需的内置主题包未安装。');
    const baseline=source?await materializeBuiltin(source):undefined;
    store.commitEditSession(); saveDraft();
    const added = baseline ? installBuiltinAsset(snapshotProject(),pack,baseline) : installAssetPack(snapshotProject(), pack, neutralStageImage(), characterId);
    if (sceneImage) added.project.documents = added.project.documents.map(document =>
      document.documentId === store.document.documentId ? withSceneBackground(document, source ? courtroomDemoPack.backgrounds.find(scene=>scene.id===source.entityId)!.resource : {packId: pack.id, id: sceneImage}) : document);
    const checked = decodeProjectFile(added.project, PROJECT_FILE_CATALOG);
    if (!checked.ok || checked.kind !== 'project' || checked.project.embeddedPacks?.some(item => !embeddedCourtroomPack(item)))
      throw new Error('素材数量或大小超出当前作品限制，请减少图片或合并素材包后重试。');
    projectFile = checked.project;
    currentProject = {manifest: structuredClone(projectFile.manifest), contentPacks: projectPacks(projectFile)};
    activeResolver = resourceResolver(projectFile);
    if (sceneImage) store.replaceDocument(projectFile.documents.find(document => document.documentId === store.document.documentId)!);
    if (added.castId) composingAs = added.castId;
    saveDraft(); renderAll();
    const saved = await persist('更新角色与场景素材');
    showToast(saved ? '素材已用于当前作品。返回对话编辑可写作或排练。' : '素材已用于页面中的作品，请导出作品文件。', saved ? 'normal' : 'error');
    return true;
  },
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
const projectFiles = installProjectFilesDialog({
  library:projectLibrary,catalog:PROJECT_FILE_CATALOG,snapshot:snapshotProject,save:persist,activate:(project,documentId)=>activateProject(project,documentId,false),
  notice:(message,error)=>showToast(message,error?'error':'normal'),
  legacy:document=>{
    pendingLegacyDocument=document; projectNameInput.value=document.title || '导入的剧本';
    projectDialog.showModal(); projectNameInput.focus(); projectNameInput.select();
    showToast('这是旧版剧本，请确认名称后导入。');
  },
});
requireElement('#files-button').addEventListener('click',projectFiles.open);
requireElement<HTMLButtonElement>("#export-button").addEventListener("click", ()=>exportProject());
requireElement('#export-json-button').addEventListener('click',()=>exportProject('json'));
async function manualSave(): Promise<void> {
  store.commitEditSession(); saveDraft();
  const snapshot=snapshotProject();
  const saved=await persist('手动保存');
  if (fileWriter.name(snapshot.manifest.projectId)) {
    try {
      await fileWriter.save(snapshot);
      requireElement('#file-save-status').textContent=`文件已保存：${fileWriter.name(snapshot.manifest.projectId)}`;
      showToast(saved?'作品与文件均已保存。':'文件已保存，本机保存未成功。',saved?'normal':'error');
    } catch(error) { showToast((error as Error).message,'error'); }
  } else if (saved) showToast('已保存到本机，并建立恢复点。');
}
requireElement('#save-button').addEventListener('click',()=>void manualSave());
requireElement('#save-file-button').addEventListener('click',async()=>{
  const button=requireElement<HTMLButtonElement>('#save-file-button'); button.disabled=true;
  store.commitEditSession(); saveDraft();
  const snapshot=snapshotProject(), status=requireElement('#file-save-status');
  try {
    const result=await fileWriter.save(snapshot,true);
    if(result==='cancelled') { status.textContent='已取消，未写入文件。'; return; }
    const saved=await persist('保存文件');
    status.textContent=(result==='written'?`文件已保存：${fileWriter.name(snapshot.manifest.projectId)}。本次打开期间可用 Ctrl+S 更新此文件。`:'已下载 .yahari 作品文件。')+(saved?'':' 本机保存失败，下载文件仍可用。');
  }catch(error){status.textContent=(error as Error).message;}
  finally{button.disabled=false;}
});
document.addEventListener('keydown',event=>{
  if ((event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='s') {
    event.preventDefault(); if(!blocksCommand(event))void manualSave();
  }
});
requireElement<HTMLButtonElement>("#import-button").addEventListener("click", () => importInput.click());
importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  if (file) await projectFiles.import(file);
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
const samplesDialog=requireElement<HTMLDialogElement>('#samples-dialog');
const sampleList=requireElement<HTMLElement>('#samples-list');
for(const sample of sampleStories){
  const card=document.createElement('button');card.type='button';card.className='sample-card';
  const name=document.createElement('strong');name.textContent=sample.title;
  const count=document.createElement('span');count.textContent=`${sample.chapters} 章 · ${sample.scenes} 场`;
  const description=document.createElement('small');description.textContent=sample.summary;
  card.append(name,count,description);
  card.addEventListener('click',async()=>{
    if(!await rememberBeforeStory())return;
    if(!activateProject(createSampleStory(sample.id,`sample-${crypto.randomUUID()}`),undefined,false))return;
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
window.addEventListener('beforeunload',event=>{
  if (unsavedChanges || pendingSaves || persistTimer!==null) { event.preventDefault(); event.returnValue=''; }
});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden' && persistTimer!==null) { store.commitEditSession(); void persist(); }
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
requireElement('#compose-avatar').addEventListener('click',()=>openSpeakerDialog(composingAs,setComposerSpeaker));
requireElement('#speaker-close').addEventListener('click',()=>requireElement<HTMLDialogElement>('#speaker-dialog').close());
requireElement('#inspector-close').addEventListener('click',()=>setPanel('inspector',false));
async function rememberBeforeStory(): Promise<boolean> {
  store.commitEditSession();
  if(!await persist('打开故事前'))return false;
  try {
    if(projectLibrary)await projectLibrary.setSetting('beforeStory',currentProject.manifest.projectId);
    else localStorage.setItem('yahari:before-story-import',JSON.stringify(snapshotProject()));
    return true;
  }catch{showToast('无法备份当前作品，请先导出后重试。','error');return false;}
}
const openStory = installStoryDialog(demoManifest, async next => {
  if(!await rememberBeforeStory())return false;
  const ok=activateProject(next,undefined,false);
  if(ok)showToast('已导入分层剧本。可在目录切换场景或恢复导入前作品。');
  return ok;
}, aiConnection);
requireElement('#story-button').addEventListener('click',openStory);
requireElement('#restore-story-button').addEventListener('click',async()=>{
  try {
    if(projectLibrary) {
      const id=await projectLibrary.getSetting('beforeStory');
      if(typeof id==='string') {
        const loaded=await projectLibrary.load(id);
        if(!loaded)throw new Error();
        const currentId=currentProject.manifest.projectId;
        if(!await persist('恢复故事前'))return;
        if(activateProject(loaded.project,loaded.activeDocumentId,false)) {
          await projectLibrary.setSetting('beforeStory',currentId);
          showToast('已恢复；再次点击可切回。');
        }
        return;
      }
    }
    const raw=localStorage.getItem('yahari:before-story-import');
    if(!raw){showToast('没有可恢复的导入前作品。');return;}
    const decoded=decodeProjectFile(JSON.parse(raw),PROJECT_FILE_CATALOG);
    if(!decoded.ok||decoded.kind!=='project')throw new Error();
    store.commitEditSession();await persist();
    const current=JSON.stringify(snapshotProject());
    if(activateProject(decoded.project)){localStorage.setItem('yahari:before-story-import',current);showToast('已恢复；再次点击可切回。');}
  }catch{showToast('备份恢复失败，请使用已导出的项目文件。','error');}
});
storyWorkspace=installStoryWorkspace({
  snapshot:snapshotProject,activeDocumentId:()=>store.document.documentId,editable:()=>projectAvailability==='ready',
  thumbnail(id){const doc=documentsWithActiveEdit().find(d=>d.documentId===id),ref=doc?sceneBackgroundRef(doc):undefined;return ref?activeResolver.resolve(ref)?.url:undefined;},
  backgrounds:()=>currentProject.contentPacks.flatMap(pack=>pack.backgrounds).map(item=>({id:item.id,label:item.label})),background:sceneBackgroundId,
  withBackground(document,id){const background=currentProject.contentPacks.flatMap(pack=>pack.backgrounds).find(item=>item.id===id);return background?withSceneBackground(document,background.resource):document;},
  prepare(){if(!assetWorkspace.close())return false;store.commitEditSession();saveDraft();closePicker(false);setPanel('inspector',false,false);return true;},
  apply(next,checkpoint=true){store.commitEditSession();saveDraft();return activateProject(next,store.document.documentId,false,checkpoint?'编辑作品结构与分支':undefined);},save:manualSave,
  edit(documentId,blockId){if(!storyWorkspace!.close())return;assetWorkspace.close();switchScene(documentId);if(blockId){selectedBlockId=blockId;focusBlock(blockId);}history.replaceState(null,'',location.pathname+location.search);},
  play(){
    const reader=window.open('about:blank','_blank');
    void persist().then(saved=>{if(!saved){reader?.close();return;}const url=`../player/#work=${encodeURIComponent(currentProject.manifest.projectId)}`;if(reader)reader.location.href=url;else showToast('浏览器阻止了新窗口，请允许打开游玩页面。','error');});
  },
  exportPlayer:()=>downloadStandalonePlayer(snapshotProject()),notice:(message,error)=>showToast(message,error?'error':'normal'),
});
requireElement('#writing-workspace-button').addEventListener('click',event=>{if(!storyWorkspace!.close()){event.preventDefault();event.stopImmediatePropagation();return;}history.replaceState(null,'',location.pathname+location.search);},true);
requireElement('#branch-sample-button').addEventListener('click',async()=>{if(!await rememberBeforeStory())return;if(activateProject(createBranchSample(`branch-${crypto.randomUUID()}`),undefined,false))storyWorkspace!.open();});
if(location.hash==='#story')queueMicrotask(()=>storyWorkspace!.open());
updateProjectChrome();
renderAll();
if(startupStorageMessage) { saveStatus.textContent='作品库读取异常'; showToast(startupStorageMessage,'error'); }

let rehearsalAudioEnabled=true;
try{rehearsalAudioEnabled=localStorage.getItem('yahari:rehearsal-audio')!=='false';}catch{/* Rehearsal works without local storage. */}
function startRehearsal(blockId?:string):void {
  actionAudition?.dispose();actionAudition=null;
  if (diagnostics().some(item => item.severity === "error")) { setPanel('inspector', true); inspectorTab="diagnostics";activateInspectorTab();renderInspector();showToast("请先修复检查中的错误，再开始排练。", "error"); return; }
  store.commitEditSession();persist();
  const lines=store.document.blocks.filter(block=>block.type==='dialogue');
  const startPage=Math.max(0,lines.findIndex(block=>block.id===blockId));
  openPreview(courtroomAdapter.compile(store.document,currentProject),castName,currentProject,activeResolver,{
    startPage,audioEnabled:rehearsalAudioEnabled,
    onAudioChange(enabled){rehearsalAudioEnabled=enabled;try{localStorage.setItem('yahari:rehearsal-audio',String(enabled));}catch{/* Session preference still applies. */}},
    onPage(page){const line=lines[page];if(line){selectedBlockId=line.id;renderEditorSelection();}},
    onEdit(page){const line=lines[page];if(line){selectedBlockId=line.id;focusBlock(line.id);}},
  });
}
requireElement<HTMLButtonElement>("#preview-button").addEventListener("click",()=>startRehearsal());

requireElement('#navigator-button').addEventListener('click', () => { renderOutline(); setPanel('outline', true); });
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
