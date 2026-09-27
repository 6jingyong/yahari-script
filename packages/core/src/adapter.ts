import type { CapabilityRegistry } from "./capability.js";
import type {
  Diagnostic,
  EditorContext,
  EntityRef,
  TokenSubjectRef,
  JsonSchema,
  ProjectManifest,
  ResourceRef,
  ScriptDocument,
} from "./types.js";

export interface AdapterManifest {
  id: string;
  version: string;
  name: string;
  description?: string;
  coreCompatibility: string;
  tokenNamespaces: string[];
  projectProfileSchema?: JsonSchema;
  performancePlanType: string;
}

export interface SubjectPolicy {
  allowedKinds: Array<EntityRef["kind"] | "speaker">;
  defaultFromSpeaker?: boolean;
  required?: boolean;
}

export interface CapabilityQueryTemplate {
  kind: string;
  subjectFrom?: "token" | "speaker";
  paramKeys?: string[];
}

export interface TokenTypeDefinition {
  type: string;
  label: string;
  description?: string;
  category: string;
  scope: "inline" | "block" | "both";
  paramsSchema: JsonSchema;
  subjectPolicy?: SubjectPolicy;
  capabilityQuery?: CapabilityQueryTemplate;
  editor?: {
    icon?: string;
    displayMode?: "chip" | "badge" | "compact";
    priority?: number;
  };
}

export interface TokenPickerQuery {
  search?: string;
  type?: string;
  category?: string;
}

export interface TokenCandidate {
  id: string;
  tokenType: string;
  label: string;
  description?: string;
  subject?: TokenSubjectRef;
  params: Record<string, unknown>;
  category: string;
  enabled: boolean;
  availability: "recommended" | "available" | "unavailable";
  disabledReason?: string;
  score?: number;
  preview?: ResourceRef;
}

export interface ContentPackBase {
  id: string;
  version: string;
  name: string;
}

export interface ProjectContext<TPack extends ContentPackBase = ContentPackBase> {
  manifest: ProjectManifest;
  contentPacks: TPack[];
}

export interface AdapterProjectInitInput {
  projectId: string;
  title: string;
}

export type AdapterProjectProfile = Record<string, unknown>;

export interface YahariAdapter<
  TPlan = unknown,
  TPack extends ContentPackBase = ContentPackBase,
> {
  manifest: AdapterManifest;
  tokenTypes: TokenTypeDefinition[];
  createProjectProfile(input: AdapterProjectInitInput): AdapterProjectProfile;
  buildCapabilityRegistry(project: ProjectContext<TPack>): CapabilityRegistry;
  getTokenCandidates(
    context: EditorContext,
    project: ProjectContext<TPack>,
    query?: TokenPickerQuery,
  ): TokenCandidate[];
  validate(document: ScriptDocument, context: ProjectContext<TPack>): Diagnostic[];
  compile(document: ScriptDocument, context: ProjectContext<TPack>): TPlan;
}
