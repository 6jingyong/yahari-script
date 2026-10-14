import {
  createProjectFile,
  decodeProjectFile,
  type ProjectFileCatalog,
  type ProjectManifest,
  type ScriptDocument,
  type YahariProjectFile,
} from '../../../packages/core/src/index.js';
import { projectBlob, projectFileName } from '../../../packages/project-io/src/index.js';

export const STORAGE_KEY = 'yahari-script:p1b:project';
export const LEGACY_STORAGE_KEY = 'yahari-script:p1a:demo-document';

export function loadStoredProject(
  storage: Storage,
  catalog: ProjectFileCatalog,
  legacyManifest: ProjectManifest,
  fallback: () => YahariProjectFile,
  upgradeReady: (manifest: ProjectManifest) => ProjectManifest,
): YahariProjectFile {
  for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const decoded = decodeProjectFile(JSON.parse(raw), catalog, legacyManifest);
      if (decoded.ok && decoded.kind === 'project') {
        if (decoded.availability === 'ready') decoded.project.manifest = upgradeReady(decoded.project.manifest);
        return decoded.project;
      }
    } catch {
      // Try the next source, then fall through to the fixture.
    }
  }
  return fallback();
}

export function documentsWithActiveEdit(projectFile: YahariProjectFile, active: ScriptDocument): ScriptDocument[] {
  const existing = projectFile.documents.map(document => document.documentId === active.documentId ? active : document);
  return existing.some(document => document.documentId === active.documentId) ? existing : [...existing, active];
}

export function saveProject(
  storage: Storage,
  manifest: ProjectManifest,
  documents: ScriptDocument[],
  embeddedPacks?: YahariProjectFile['embeddedPacks'],
  metadata?: YahariProjectFile['metadata'],
): YahariProjectFile {
  const project = createProjectFile(manifest, documents, metadata, embeddedPacks);
  storage.setItem(STORAGE_KEY, JSON.stringify(project));
  return project;
}

export function downloadProject(project: YahariProjectFile, format: 'bundle'|'json' = 'bundle'): void {
  const blob = projectBlob(project,format);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = projectFileName(project.manifest.title,format);
  anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),10_000);
}

interface LocalFileHandle {
  name: string;
  createWritable(): Promise<{write(data:Blob):Promise<void>;close():Promise<void>;abort():Promise<void>}>;
}
type FilePickerWindow = Window & {showSaveFilePicker?: (options:unknown)=>Promise<LocalFileHandle>};
export class ProjectFileWriter {
  private handles = new Map<string,LocalFileHandle>();
  name(id:string): string | null { return this.handles.get(id)?.name ?? null; }
  async save(project:YahariProjectFile, chooseFile=false): Promise<'written'|'downloaded'|'cancelled'> {
    const picker=(window as FilePickerWindow).showSaveFilePicker;
    let handle=this.handles.get(project.manifest.projectId);
    try {
      // Request the picker before awaiting any save or encoding work (user activation).
      if ((!handle || chooseFile) && picker) handle=await picker.call(window,{
        suggestedName:projectFileName(project.manifest.title),
        types:[{description:'矢张剧本作品（含素材）',accept:{'application/zip':['.yahari']}}],
      });
      if (!handle) { downloadProject(project); return 'downloaded'; }
      const blob=projectBlob(project), writable=await handle.createWritable();
      try { await writable.write(blob); await writable.close(); }
      catch (error) { await writable.abort().catch(()=>{}); throw error; }
      this.handles.set(project.manifest.projectId,handle); return 'written';
    } catch (error) {
      if (error instanceof DOMException && error.name==='AbortError') return 'cancelled';
      throw new Error('未能写入文件，作品仍可通过导出下载。');
    }
  }
}
