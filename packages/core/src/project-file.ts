import type { ProjectManifest, ScriptDocument, YahariProjectFile } from "./types.js";

export interface ProjectFileCatalog {
  adapters: Array<{ id: string; version: string }>;
  contentPacks: Array<{ id: string; version: string }>;
}

export interface ProjectFileIssue {
  code: string;
  message: string;
  severity: "warning" | "error";
}

export type ProjectAvailability = "ready" | "missing-adapter" | "missing-content-pack";

export type ProjectFileDecodeResult =
  | {
      ok: true;
      kind: "project";
      project: YahariProjectFile;
      issues: ProjectFileIssue[];
      availability: ProjectAvailability;
      migratedFrom?: string;
    }
  | {
      ok: true;
      kind: "unbound-document";
      document: ScriptDocument;
      issues: ProjectFileIssue[];
      migratedFrom: string;
      requiresBinding: true;
    }
  | { ok: false; issues: ProjectFileIssue[] };

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function optionalRecord(value: Record<string, unknown>, key: string): boolean {
  return value[key] === undefined || record(value[key]);
}

function looksLikeToken(value: unknown): boolean {
  if (!record(value) || !nonEmptyString(value.id) || !nonEmptyString(value.type) || !record(value.params) || !optionalRecord(value, "metadata")) {
    return false;
  }
  if (value.subject === undefined) return true;
  if (!record(value.subject) || !nonEmptyString(value.subject.kind)) return false;
  if (value.subject.kind === "speaker") return true;
  return ["cast", "resource", "project", "scene"].includes(value.subject.kind) && nonEmptyString(value.subject.id);
}

function looksLikeBlock(value: unknown): boolean {
  if (!record(value) || !nonEmptyString(value.id) || !optionalRecord(value, "metadata")) return false;
  if (value.type === "cue") return looksLikeToken(value.cue);
  if (value.type !== "dialogue" || !Array.isArray(value.content)) return false;
  if (value.speaker !== null && (
    !record(value.speaker) || !nonEmptyString(value.speaker.castId)
  )) return false;
  return value.content.every((node) => {
    if (!record(node)) return false;
    if (node.type === "text") return typeof node.text === "string" && (node.marks === undefined
      || (Array.isArray(node.marks) && node.marks.every(mark => record(mark)
        && typeof mark.type === "string" && ["bold", "italic", "underline", "strike"].includes(mark.type))));
    return node.type === "token" && looksLikeToken(node.token);
  });
}

function looksLikeDocument(value: unknown): value is ScriptDocument {
  if (!record(value)) return false;
  return nonEmptyString(value.schemaVersion) && nonEmptyString(value.documentId)
    && nonEmptyString(value.title) && (value.summary === undefined || typeof value.summary === "string") && optionalRecord(value, "metadata") && Array.isArray(value.blocks) && value.blocks.every(looksLikeBlock);
}

function looksLikeManifest(value: unknown): value is ProjectManifest {
  if (!record(value) || !record(value.adapter)) return false;
  return nonEmptyString(value.schemaVersion)
    && nonEmptyString(value.projectId)
    && nonEmptyString(value.title)
    && nonEmptyString(value.adapter.id)
    && nonEmptyString(value.adapter.version)
    && Array.isArray(value.contentPacks)
    && nonEmptyString(value.entryDocumentId)
    && Array.isArray(value.documents)
    && Array.isArray(value.cast)
    && value.cast.every(member => record(member) && nonEmptyString(member.castId)
      && record(member.characterRef) && nonEmptyString(member.characterRef.packId)
      && nonEmptyString(member.characterRef.id)
      && (member.displayName === undefined || typeof member.displayName === "string")
      && optionalRecord(member, "overrides"))
    && optionalRecord(value, "projectSettings");
}

export function createProjectFile(
  manifest: ProjectManifest,
  documents: ScriptDocument[],
  metadata?: YahariProjectFile["metadata"],
): YahariProjectFile {
  return {
    fileFormat: "yahari-project",
    fileVersion: "0.7",
    manifest: structuredClone(manifest),
    documents: structuredClone(documents),
    ...(metadata ? { metadata: structuredClone(metadata) } : {}),
  };
}

function validateProjectFile(
  project: YahariProjectFile,
  catalog: ProjectFileCatalog,
): ProjectFileIssue[] {
  const issues: ProjectFileIssue[] = [];
  const error = (code: string, message: string) => issues.push({ code, message, severity: "error" });
  const warning = (code: string, message: string) => issues.push({ code, message, severity: "warning" });

  if (project.fileFormat !== "yahari-project") error("project.file.format", "Not a Yahari project file.");
  if (project.fileVersion !== "0.7") error("project.file.version", "Unsupported project file version; expected 0.7.");
  if (!looksLikeManifest(project.manifest)) error("project.manifest.shape", "Project manifest is missing required fields.");
  if (!Array.isArray(project.documents) || !project.documents.every(looksLikeDocument)) {
    error("project.documents.shape", "Project documents have an invalid shape.");
  }
  if (issues.some((item) => item.severity === "error")) return issues;

  const manifest = project.manifest;
  if (!["0.6", "0.7"].includes(manifest.schemaVersion)) {
    error("project.manifest.version", `Unsupported manifest schema version: ${manifest.schemaVersion}`);
  }
  const adapterSupported = catalog.adapters.some(
    (item) => item.id === manifest.adapter.id && item.version === manifest.adapter.version,
  );
  if (!adapterSupported) {
    error(
      "project.adapter.unavailable",
      `Adapter ${manifest.adapter.id}@${manifest.adapter.version} is not installed.`,
    );
  }

  const packIds = new Set<string>();
  for (const required of manifest.contentPacks) {
    if (!record(required) || !nonEmptyString(required.id) || !nonEmptyString(required.version)) {
      error("project.pack.shape", "A content-pack reference is invalid.");
      continue;
    }
    if (packIds.has(required.id)) error("project.pack.duplicate", `Duplicate content pack: ${required.id}`);
    packIds.add(required.id);
    const available = catalog.contentPacks.some(
      (item) => item.id === required.id && item.version === required.version,
    );
    if (!available) error("project.pack.unavailable", `Content pack ${required.id}@${required.version} is not installed.`);
  }

  const castIds = new Set<string>();
  for (const member of manifest.cast) {
    if (castIds.has(member.castId)) error("project.cast.duplicate", `Duplicate cast id: ${member.castId}`);
    castIds.add(member.castId);
  }

  const documentIds = new Set<string>();
  for (const document of project.documents) {
    if (!["0.6", "0.7"].includes(document.schemaVersion)) {
      error("project.document.version", `Unsupported document schema version: ${document.schemaVersion}`);
    }
    if (documentIds.has(document.documentId)) error("project.document.duplicate", `Duplicate document id: ${document.documentId}`);
    documentIds.add(document.documentId);
    issues.push(...validateDocumentIdentity(document));
  }
  if (!documentIds.has(manifest.entryDocumentId)) {
    error("project.entry.missing", `Entry document ${manifest.entryDocumentId} is missing.`);
  }
  const listedIds = new Set<string>();
  for (const listed of manifest.documents) {
    if (!record(listed) || !nonEmptyString(listed.id) || !nonEmptyString(listed.path)) {
      error("project.document-ref.shape", "A manifest document reference is invalid.");
    } else {
      if (listedIds.has(listed.id)) error("project.document-ref.duplicate", `Duplicate document reference: ${listed.id}`);
      listedIds.add(listed.id);
      if (!documentIds.has(listed.id)) {
      error("project.document-ref.missing", `Manifest references missing document ${listed.id}.`);
      }
    }
  }
  for (const document of project.documents) {
    if (!listedIds.has(document.documentId)) {
      warning("project.document.unlisted", `Document ${document.documentId} is not listed in the manifest.`);
    }
  }
  if (manifest.narrative !== undefined) {
    const n = manifest.narrative;
    if (!record(n) || typeof n.summary !== "string" || !Array.isArray(n.chapters)) {
      error("project.narrative.shape", "Invalid narrative structure.");
    } else {
      const chapterIds = new Set<string>();
      const assigned = new Set<string>();
      for (const c of n.chapters) {
        if (!record(c) || !nonEmptyString(c.id) || !nonEmptyString(c.title) || typeof c.summary !== "string" || !Array.isArray(c.documentIds)) {
          error("project.chapter.shape", "Invalid chapter."); continue;
        }
        if (chapterIds.has(c.id)) error("project.chapter.duplicate", "Duplicate chapter id.");
        chapterIds.add(c.id);
        for (const id of c.documentIds) {
          if (typeof id !== "string" || !documentIds.has(id) || assigned.has(id)) error("project.chapter.reference", "Scene reference missing or repeated.");
          assigned.add(id);
        }
      }
    }
  }
  return issues;
}

/** Identity collisions cannot be safely repaired through ID-addressed editor commands. */
function validateDocumentIdentity(document: ScriptDocument): ProjectFileIssue[] {
  const issues: ProjectFileIssue[] = [];
  const blocks = new Set<string>();
  const tokens = new Set<string>();
  for (const block of document.blocks) {
    if (blocks.has(block.id)) issues.push({code: "project.block.duplicate", severity: "error", message: `Duplicate block id in ${document.documentId}: ${block.id}`});
    blocks.add(block.id);
    const items = block.type === "cue" ? [block.cue] : block.content.flatMap(node => node.type === "token" ? [node.token] : []);
    for (const token of items) {
      if (tokens.has(token.id)) issues.push({code: "project.token.duplicate", severity: "error", message: `Duplicate token id in ${document.documentId}: ${token.id}`});
      tokens.add(token.id);
    }
  }
  return issues;
}

export function decodeProjectFile(
  input: unknown,
  catalog: ProjectFileCatalog,
  legacyManifest?: ProjectManifest,
): ProjectFileDecodeResult {
  let project: YahariProjectFile;
  let migratedFrom: string | undefined;

  if (looksLikeDocument(input)) {
    const issues = validateDocumentIdentity(input);
    if (!["0.6", "0.7"].includes(input.schemaVersion)) issues.push({code: "project.document.version", severity: "error", message: `Unsupported document schema version: ${input.schemaVersion}`});
    if (issues.length) return {ok: false, issues};
    if (!legacyManifest) {
      return {
        ok: true,
        kind: "unbound-document",
        document: structuredClone(input),
        migratedFrom: `document@${input.schemaVersion}`,
        requiresBinding: true,
        issues: [{
          code: "project.legacy.requires-binding",
          message: "This legacy document has no Adapter binding. Choose an Adapter and Content Pack before importing.",
          severity: "warning",
        }],
      };
    }
    const manifest = structuredClone(legacyManifest);
    manifest.entryDocumentId = input.documentId;
    manifest.documents = [{ id: input.documentId, path: `${input.documentId}.yahari.json` }];
    project = createProjectFile(manifest, [input]);
    migratedFrom = `document@${input.schemaVersion}`;
  } else if (record(input) && input.fileFormat === "yahari-project") {
    project = structuredClone(input) as unknown as YahariProjectFile;
  } else {
    return {
      ok: false,
      issues: [{ code: "project.file.format", message: "The selected JSON is not a Yahari project or document.", severity: "error" }],
    };
  }

  const issues = validateProjectFile(project, catalog);
  const dependencyCodes = new Set(["project.adapter.unavailable", "project.pack.unavailable"]);
  const blockingIssues = issues.filter(
    (item) => item.severity === "error" && !dependencyCodes.has(item.code),
  );
  if (blockingIssues.length > 0) return { ok: false, issues };
  const availability: ProjectAvailability = issues.some((item) => item.code === "project.adapter.unavailable")
    ? "missing-adapter"
    : issues.some((item) => item.code === "project.pack.unavailable")
      ? "missing-content-pack"
      : "ready";
  return {
    ok: true,
    kind: "project",
    project,
    issues,
    availability,
    ...(migratedFrom ? { migratedFrom } : {}),
  };
}
