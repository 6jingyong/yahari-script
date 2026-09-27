import {
  validateCoreDocument,
  type Diagnostic,
  type ProjectContext,
  type ScriptDocument,
  type TypedToken,
} from "../../../core/src/index.js";
import { courtroomTokenTypes } from "./token-types.js";
import { buildCourtroomCapabilityRegistry } from "./registry.js";
import type { CourtroomContentPack } from "./types.js";

const tokenDefinitions = new Map(courtroomTokenTypes.map((definition) => [definition.type, definition]));

function isResourceRef(value: unknown): value is { packId: string; id: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { packId?: unknown }).packId === "string" &&
      typeof (value as { id?: unknown }).id === "string",
  );
}

function validateTokenParams(token: TypedToken): string | null {
  switch (token.type) {
    case "courtroom.pose":
      return typeof token.params.pose === "string" ? null : "pose must be a string";
    case "courtroom.reaction":
      return typeof token.params.reaction === "string" ? null : "reaction must be a string";
    case "courtroom.wait": {
      const mode = token.params.mode;
      if (mode !== "time" && mode !== "input") return "mode must be time or input";
      if (mode === "time" && (typeof token.params.durationMs !== "number" || token.params.durationMs < 0)) {
        return "time wait requires a non-negative durationMs";
      }
      return null;
    }
    case "courtroom.emphasis":
      return typeof token.params.mode === "string" ? null : "mode must be a string";
    case "courtroom.flash":
      return token.params.intensity === undefined || typeof token.params.intensity === "number"
        ? null
        : "intensity must be a number";
    case "courtroom.shake":
      return (token.params.intensity === undefined || typeof token.params.intensity === "number") &&
          (token.params.durationMs === undefined || typeof token.params.durationMs === "number")
        ? null
        : "shake parameters must be numeric";
    case "courtroom.sfx":
    case "courtroom.bgm":
    case "courtroom.background":
      return isResourceRef(token.params.resource) ? null : "resource must be a ResourceRef";
    case "courtroom.focus":
      return null;
    default:
      return "unknown token type";
  }
}

function resolveSubject(token: TypedToken, speakerId: string | null) {
  const binding = token.subject ?? { kind: "speaker" as const };
  if (binding.kind === "speaker") {
    return speakerId ? { kind: "cast" as const, id: speakerId } : undefined;
  }
  return binding;
}

export function validateCourtroomDocument(
  document: ScriptDocument,
  project: ProjectContext<CourtroomContentPack>,
): Diagnostic[] {
  const diagnostics = validateCoreDocument(document, project.manifest);
  const registry = buildCourtroomCapabilityRegistry(project);

  for (const block of document.blocks) {
    const scope = block.type === "cue" ? "block" : "inline";
    const speakerId = block.type === "dialogue" ? block.speaker?.castId ?? null : null;
    const tokens = block.type === "cue"
      ? [block.cue]
      : block.content.filter((node) => node.type === "token").map((node) => node.token);

    for (const token of tokens) {
      const definition = tokenDefinitions.get(token.type);
      if (!definition) {
        diagnostics.push({
          id: `courtroom.unknown-token.${token.id}`,
          severity: "error",
          code: "courtroom.token.unknown",
          message: `Unknown Courtroom token type: ${token.type}`,
          location: { documentId: document.documentId, blockId: block.id, tokenId: token.id },
        });
        continue;
      }

      if (!(definition.scope === "both" || definition.scope === scope)) {
        diagnostics.push({
          id: `courtroom.scope.${token.id}`,
          severity: "error",
          code: "courtroom.token.invalid-scope",
          message: `${token.type} is not allowed in ${scope} scope.`,
          location: { documentId: document.documentId, blockId: block.id, tokenId: token.id },
        });
      }

      const paramError = validateTokenParams(token);
      if (paramError) {
        diagnostics.push({
          id: `courtroom.params.${token.id}`,
          severity: "error",
          code: "courtroom.token.invalid-params",
          message: `${token.type}: ${paramError}`,
          location: { documentId: document.documentId, blockId: block.id, tokenId: token.id },
        });
        continue;
      }

      if (definition.subjectPolicy) {
        const subject = resolveSubject(token, speakerId);
        if (definition.subjectPolicy.required && !subject) {
          diagnostics.push({
            id: `courtroom.subject.required.${token.id}`,
            severity: "error",
            code: "courtroom.subject.required",
            message: `${token.type} requires a subject.`,
            location: { documentId: document.documentId, blockId: block.id, tokenId: token.id },
          });
          continue;
        }
        if (subject && !definition.subjectPolicy.allowedKinds.includes(subject.kind)) {
          diagnostics.push({
            id: `courtroom.subject.kind.${token.id}`,
            severity: "error",
            code: "courtroom.subject.invalid-kind",
            message: `${token.type} does not support subject kind ${subject.kind}.`,
            location: { documentId: document.documentId, blockId: block.id, tokenId: token.id },
          });
          continue;
        }
      }

      if (definition.capabilityQuery) {
        const subject = resolveSubject(token, speakerId);
        if (!subject) continue;
        const params = Object.fromEntries(
          (definition.capabilityQuery.paramKeys ?? []).map((key) => [key, token.params[key]]),
        );
        if (!registry.supports({ kind: definition.capabilityQuery.kind, subject, params })) {
          const fixes: NonNullable<Diagnostic["fixes"]> = [];

          // Replacement keeps the token binding but swaps only the capability-backed
          // params to something the currently resolved subject can actually perform.
          for (const alternative of registry
            .query({ kind: definition.capabilityQuery.kind, subject })
            .slice(0, 3)) {
            const replacementParams = { ...token.params };
            for (const key of definition.capabilityQuery.paramKeys ?? []) {
              replacementParams[key] = alternative.params?.[key];
            }
            const labelValue = (definition.capabilityQuery.paramKeys ?? [])
              .map((key) => String(alternative.params?.[key] ?? ""))
              .filter(Boolean)
              .join(" · ");
            fixes.push({
              kind: "replace-token",
              label: `Replace with ${labelValue || alternative.id}`,
              token: { ...token, params: replacementParams },
            });
          }

          // Retarget keeps the requested action and binds it to a cast member who
          // really owns that capability. This is particularly useful after the
          // dialogue speaker has changed.
          const retargeted = new Set<string>();
          for (const alternative of registry.query({ kind: definition.capabilityQuery.kind, params })) {
            if (alternative.subject.kind !== "cast" || alternative.subject.id === subject.id) continue;
            if (retargeted.has(alternative.subject.id)) continue;
            retargeted.add(alternative.subject.id);
            fixes.push({
              kind: "retarget-token",
              label: `Retarget to ${alternative.subject.id}`,
              subject: alternative.subject,
            });
          }

          fixes.push({ kind: "remove-token", label: "Remove token" });
          diagnostics.push({
            id: `courtroom.capability.missing.${token.id}`,
            severity: "error",
            code: "courtroom.capability.missing",
            message: `Subject ${subject.id} does not support ${token.type} ${JSON.stringify(params)}.`,
            location: { documentId: document.documentId, blockId: block.id, tokenId: token.id },
            fixes,
          });
        }
      }
    }
  }

  return diagnostics;
}
