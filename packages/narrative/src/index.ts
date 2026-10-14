import { sceneExit, type ProjectManifest, type SceneExit } from '../../core/src/index.js';

export interface StoryVisit { documentId: string; optionId?: string }
export class NarrativeSession {
  private visits: StoryVisit[];
  constructor(private readonly manifest: ProjectManifest) { this.visits = [{ documentId: manifest.entryDocumentId }]; }
  get path(): StoryVisit[] { return structuredClone(this.visits); }
  get documentId(): string { return this.visits.at(-1)!.documentId; }
  get exit(): SceneExit { return sceneExit(this.manifest, this.documentId); }
  advance(optionId?: string): boolean {
    const exit = this.exit;
    if (exit.type === 'ending') return false;
    const target = exit.type === 'next' ? exit.targetDocumentId : exit.options.find(o => o.id === optionId)?.targetDocumentId;
    if (!target || !this.manifest.documents.some(d => d.id === target)) throw new Error('请选择当前场景中的有效选项。');
    this.visits[this.visits.length - 1] = { documentId: this.documentId, ...(exit.type === 'choice' ? { optionId } : {}) };
    this.visits.push({ documentId: target }); return true;
  }
  back(): boolean {
    if (this.visits.length < 2) return false;
    this.visits.pop(); delete this.visits[this.visits.length - 1].optionId; return true;
  }
  restart(): void { this.visits = [{ documentId: this.manifest.entryDocumentId }]; }
  /** Reconstruct rather than trusting a saved arbitrary list of scene IDs. */
  restore(value: unknown): boolean {
    if (!Array.isArray(value) || !value.length || value.length > 10000) return false;
    const candidate = new NarrativeSession(this.manifest);
    try {
      for (let i = 0; i < value.length; i++) {
        const visit = value[i];
        if (!visit || typeof visit !== 'object' || visit.documentId !== candidate.documentId) return false;
        if (i + 1 < value.length && !candidate.advance(visit.optionId)) return false;
        if (i + 1 === value.length && visit.optionId !== undefined) return false;
      }
    } catch { return false; }
    this.visits = candidate.path; return true;
  }
}
