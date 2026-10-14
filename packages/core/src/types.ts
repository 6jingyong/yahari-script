export type JsonSchema = Record<string, unknown>;

export interface ResourceRef {
  packId: string;
  id: string;
}

export type EntityRef =
  | { kind: "cast"; id: string }
  | { kind: "resource"; id: string }
  | { kind: "project"; id: string }
  | { kind: "scene"; id: string };

export interface CastRef {
  castId: string;
}

/** Explicit token binding to the dialogue block's current speaker. */
export interface SpeakerSubjectRef {
  kind: "speaker";
}

export type TokenSubjectRef = EntityRef | SpeakerSubjectRef;

export interface CastMemberRef {
  castId: string;
  characterRef: ResourceRef;
  displayName?: string;
  overrides?: Record<string, unknown>;
}

export type SceneExit =
  | { type: "next"; targetDocumentId: string }
  | { type: "choice"; prompt: string; options: Array<{ id: string; label: string; targetDocumentId: string }> }
  | { type: "ending"; title: string; description?: string };

export interface NarrativeFlow {
  version: 1;
  routes: Array<{ documentId: string; exit: SceneExit }>;
}

export interface ProjectManifest {
  schemaVersion: string;
  projectId: string;
  title: string;
  adapter: {
    id: string;
    version: string;
  };
  contentPacks: Array<{
    id: string;
    version: string;
  }>;
  entryDocumentId: string;
  documents: Array<{
    id: string;
    path: string;
  }>;
  cast: CastMemberRef[];
  projectSettings?: Record<string, unknown>;
  narrative?: { summary: string; chapters: Array<{ id: string; title: string; summary: string; documentIds: string[] }> };
  /** Scene exits are independent of an adapter's dialogue/performance instructions. */
  flow?: NarrativeFlow;
}

export type TextMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "strike" };

export interface TypedToken {
  id: string;
  type: string;
  params: Record<string, unknown>;
  subject?: TokenSubjectRef;
  metadata?: Record<string, unknown>;
}

export interface TextNode {
  type: "text";
  text: string;
  marks?: TextMark[];
}

export interface TokenNode {
  type: "token";
  token: TypedToken;
}

export type RichNode = TextNode | TokenNode;

export interface DialogueBlock {
  id: string;
  type: "dialogue";
  speaker: CastRef | null;
  content: RichNode[];
  metadata?: Record<string, unknown>;
}

export interface CueBlock {
  id: string;
  type: "cue";
  cue: TypedToken;
  metadata?: Record<string, unknown>;
}

export type ScriptBlock = DialogueBlock | CueBlock;

export interface ScriptDocument {
  summary?: string;
  schemaVersion: string;
  documentId: string;
  title: string;
  blocks: ScriptBlock[];
  metadata?: Record<string, unknown>;
}

/** Portable, self-describing Yahari project archive for the browser prototype. */
export interface YahariProjectFile {
  fileFormat: "yahari-project";
  fileVersion: "0.7" | "0.8" | "0.9";
  manifest: ProjectManifest;
  documents: ScriptDocument[];
  /** Optional project-owned content. Resource URLs are embedded image data URLs. */
  embeddedPacks?: Array<{
    id: string;
    version: string;
    adapterId: string;
    definition: Record<string, unknown>;
    resources: Record<string, string>;
  }>;
  metadata?: {
    exportedAt?: string;
    generator?: string;
  };
}

export interface EditorContext {
  projectId: string;
  documentId: string;
  blockId?: string;
  adapterId: string;
  adapterVersion: string;
  /** Where a newly inserted token would live. Lets adapters hide invalid-scope candidates. */
  insertionScope?: "inline" | "block";
  speaker?: CastRef | null;
  selection?: {
    from: number;
    to: number;
  };
  previousBlockId?: string;
  nextBlockId?: string;
  adapterState?: Record<string, unknown>;
}

export type QuickFix =
  | {
      kind: "replace-token";
      label: string;
      token: TypedToken;
    }
  | {
      kind: "retarget-token";
      label: string;
      subject: EntityRef;
    }
  | {
      kind: "remove-token";
      label: string;
    };

export interface Diagnostic {
  id: string;
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  location?: {
    documentId: string;
    blockId?: string;
    tokenId?: string;
  };
  fixes?: QuickFix[];
}
