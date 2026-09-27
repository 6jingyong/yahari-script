import type { Diagnostic, ProjectManifest, ScriptDocument, TypedToken } from "./types.js";

function tokenShapeValid(token: TypedToken): boolean {
  return Boolean(
    token &&
      typeof token.id === "string" &&
      token.id.length > 0 &&
      typeof token.type === "string" &&
      token.type.length > 0 &&
      token.params &&
      typeof token.params === "object" &&
      !Array.isArray(token.params),
  );
}

export function validateCoreDocument(
  document: ScriptDocument,
  manifest: ProjectManifest,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const blockIds = new Set<string>();
  const tokenIds = new Set<string>();
  const castIds = new Set(manifest.cast.map((member) => member.castId));

  const add = (diagnostic: Diagnostic) => diagnostics.push(diagnostic);

  for (const block of document.blocks) {
    if (blockIds.has(block.id)) {
      add({
        id: `core.duplicate-block.${block.id}`,
        severity: "error",
        code: "core.block.duplicate-id",
        message: `Duplicate block id: ${block.id}`,
        location: { documentId: document.documentId, blockId: block.id },
      });
    }
    blockIds.add(block.id);

    if (block.type === "dialogue" && block.speaker && !castIds.has(block.speaker.castId)) {
      add({
        id: `core.missing-cast.${block.id}.${block.speaker.castId}`,
        severity: "error",
        code: "core.cast.missing",
        message: `Unknown cast member: ${block.speaker.castId}`,
        location: { documentId: document.documentId, blockId: block.id },
      });
    }

    const tokens = block.type === "cue"
      ? [block.cue]
      : block.content.filter((node) => node.type === "token").map((node) => node.token);

    for (const token of tokens) {
      if (!tokenShapeValid(token)) {
        add({
          id: `core.invalid-token.${block.id}.${token?.id ?? "unknown"}`,
          severity: "error",
          code: "core.token.invalid-shape",
          message: "Token has an invalid core shape.",
          location: { documentId: document.documentId, blockId: block.id, tokenId: token?.id },
        });
        continue;
      }

      if (tokenIds.has(token.id)) {
        add({
          id: `core.duplicate-token.${token.id}`,
          severity: "error",
          code: "core.token.duplicate-id",
          message: `Duplicate token id: ${token.id}`,
          location: { documentId: document.documentId, blockId: block.id, tokenId: token.id },
        });
      }
      tokenIds.add(token.id);

      if (token.subject?.kind === "cast" && !castIds.has(token.subject.id)) {
        add({
          id: `core.missing-token-subject.${token.id}`,
          severity: "error",
          code: "core.cast.missing",
          message: `Token references unknown cast member: ${token.subject.id}`,
          location: { documentId: document.documentId, blockId: block.id, tokenId: token.id },
        });
      }
    }
  }

  return diagnostics;
}
