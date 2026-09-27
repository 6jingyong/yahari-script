import type {
  CastRef,
  CueBlock,
  DialogueBlock,
  QuickFix,
  RichNode,
  ScriptDocument,
  TypedToken,
} from "../../core/src/index.js";

export type EditorStoreListener = (document: ScriptDocument) => void;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sameDocument(a: ScriptDocument, b: ScriptDocument): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export class EditorStore {
  #document: ScriptDocument;
  #past: ScriptDocument[] = [];
  #future: ScriptDocument[] = [];
  #listeners = new Set<EditorStoreListener>();
  #editSessionStart: ScriptDocument | null = null;

  constructor(document: ScriptDocument) {
    this.#document = clone(document);
  }

  get document(): ScriptDocument {
    return clone(this.#document);
  }

  get canUndo(): boolean {
    return this.#past.length > 0;
  }

  get canRedo(): boolean {
    return this.#future.length > 0;
  }

  /** Replaces the full active document while preserving undo/redo semantics. */
  replaceDocument(document: ScriptDocument, recordHistory = true): void {
    const next=clone(document);
    if(sameDocument(this.#document,next))return;
    const before=clone(this.#document);
    this.#document=next;
    this.#editSessionStart=null;
    if(recordHistory){
      this.#past.push(before);
      this.#future=[];
    }
    this.#emit();
  }

  /** Replaces the active document and starts a fresh editing history. */
  loadDocument(document: ScriptDocument): void {
    this.#document = clone(document);
    this.#past = [];
    this.#future = [];
    this.#editSessionStart = null;
    this.#emit();
  }

  subscribe(listener: EditorStoreListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  beginEditSession(): void {
    if (!this.#editSessionStart) this.#editSessionStart = clone(this.#document);
  }

  commitEditSession(): void {
    const start = this.#editSessionStart;
    this.#editSessionStart = null;
    if (!start || sameDocument(start, this.#document)) return;
    this.#past.push(start);
    this.#future = [];
    this.#emit();
  }

  cancelEditSession(): void {
    if (!this.#editSessionStart) return;
    this.#document = this.#editSessionStart;
    this.#editSessionStart = null;
    this.#emit();
  }

  updateSpeaker(blockId: string, speaker: CastRef | null): void {
    this.#mutate((document) => {
      const block = this.#dialogueBlock(document, blockId);
      block.speaker = speaker ? clone(speaker) : null;
    });
  }

  replaceDialogueContent(blockId: string, content: RichNode[], recordHistory = true): void {
    this.#mutate(
      (document) => {
        this.#dialogueBlock(document, blockId).content = clone(content);
      },
      recordHistory,
    );
  }

  addDialogueBlock(block: DialogueBlock, afterBlockId?: string): void {
    this.#mutate((document) => {
      const index = afterBlockId
        ? document.blocks.findIndex((item) => item.id === afterBlockId) + 1
        : document.blocks.length;
      document.blocks.splice(index < 0 ? document.blocks.length : index, 0, clone(block));
    });
  }


  addCueBlock(block: CueBlock, afterBlockId?: string): void {
    this.#mutate((document) => {
      const index = afterBlockId
        ? document.blocks.findIndex((item) => item.id === afterBlockId) + 1
        : document.blocks.length;
      document.blocks.splice(index < 0 ? document.blocks.length : index, 0, clone(block));
    });
  }

  replaceCueToken(blockId: string, token: TypedToken): void {
    this.#mutate((document) => {
      const block = document.blocks.find((item) => item.id === blockId);
      if (!block || block.type !== "cue") throw new Error(`Cue block ${blockId} was not found.`);
      block.cue = clone(token);
    });
  }

  removeBlock(blockId: string): void {
    this.#mutate((document) => {
      const index = document.blocks.findIndex((item) => item.id === blockId);
      if (index < 0) throw new Error(`Block ${blockId} was not found.`);
      document.blocks.splice(index, 1);
    });
  }

  removeToken(tokenId: string): void {
    this.#mutate((document) => {
      for (const block of document.blocks) {
        if (block.type === "cue") {
          if (block.cue.id === tokenId) {
            throw new Error("Removing a CueBlock token requires removing or replacing the block.");
          }
          continue;
        }
        block.content = block.content.filter(
          (node) => !(node.type === "token" && node.token.id === tokenId),
        );
      }
    });
  }

  applyQuickFix(tokenId: string, fix: QuickFix): void {
    this.#mutate((document) => {
      for (const block of document.blocks) {
        if (block.type === "cue") {
          if (block.cue.id !== tokenId) continue;
          if (fix.kind === "replace-token") block.cue = clone(fix.token);
          else if (fix.kind === "retarget-token") block.cue.subject = clone(fix.subject);
          else throw new Error("A CueBlock cannot be left without a cue token.");
          return;
        }

        const index = block.content.findIndex(
          (node) => node.type === "token" && node.token.id === tokenId,
        );
        if (index < 0) continue;

        if (fix.kind === "remove-token") {
          block.content.splice(index, 1);
        } else if (fix.kind === "replace-token") {
          block.content[index] = { type: "token", token: clone(fix.token) };
        } else {
          const node = block.content[index];
          if (node?.type === "token") node.token.subject = clone(fix.subject);
        }
        return;
      }
      throw new Error(`Token ${tokenId} was not found.`);
    });
  }

  undo(): void {
    this.commitEditSession();
    const previous = this.#past.pop();
    if (!previous) return;
    this.#future.push(clone(this.#document));
    this.#document = previous;
    this.#emit();
  }

  redo(): void {
    this.commitEditSession();
    const next = this.#future.pop();
    if (!next) return;
    this.#past.push(clone(this.#document));
    this.#document = next;
    this.#emit();
  }

  #mutate(mutation: (document: ScriptDocument) => void, recordHistory = true): void {
    const before = clone(this.#document);
    mutation(this.#document);
    if (sameDocument(before, this.#document)) return;

    if (recordHistory && !this.#editSessionStart) {
      this.#past.push(before);
      this.#future = [];
    }
    this.#emit();
  }

  #dialogueBlock(document: ScriptDocument, blockId: string): DialogueBlock {
    const block = document.blocks.find((item) => item.id === blockId);
    if (!block || block.type !== "dialogue") {
      throw new Error(`Dialogue block ${blockId} was not found.`);
    }
    return block;
  }

  #emit(): void {
    const snapshot = this.document;
    for (const listener of this.#listeners) listener(snapshot);
  }
}

export function createTokenFromCandidate(
  tokenId: string,
  candidate: {
    tokenType: string;
    subject?: TypedToken["subject"];
    params: Record<string, unknown>;
  },
): TypedToken {
  return {
    id: tokenId,
    type: candidate.tokenType,
    ...(candidate.subject ? { subject: clone(candidate.subject) } : {}),
    params: clone(candidate.params),
  };
}
