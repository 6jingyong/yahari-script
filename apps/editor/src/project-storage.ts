import {
  createProjectFile,
  decodeProjectFile,
  type ProjectFileCatalog,
  type ProjectManifest,
  type ScriptDocument,
  type YahariProjectFile,
} from '../../../packages/core/src/index.js';

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
): YahariProjectFile {
  const project = createProjectFile(manifest, documents);
  storage.setItem(STORAGE_KEY, JSON.stringify(project));
  return project;
}

function safeFileName(value: string): string {
  return value.trim().replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'yahari-project';
}

export function downloadProject(project: YahariProjectFile): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFileName(project.manifest.title)}.yahari-project.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
