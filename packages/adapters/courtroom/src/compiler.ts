import {
  normalizeDocument,
  type ProjectContext,
  type ResourceRef,
  type ScriptDocument,
  type TypedToken,
} from "../../../core/src/index.js";
import type {
  CourtroomContentPack,
  CourtroomInstruction,
  CourtroomPerformancePlan,
} from "./types.js";
import { validateCourtroomDocument } from "./validator.js";
import { dialogueTypingSound } from "./typing-sound.js";
import {actionKey,actionSoundInstructions,recordedSoundWait} from './action-sound.js';

function requireCastSubject(token: TypedToken, speakerId: string | null): string {
  const binding = token.subject ?? { kind: "speaker" as const };
  if (binding.kind === "speaker") {
    if (!speakerId) throw new Error(`Token ${token.id} requires a dialogue speaker.`);
    return speakerId;
  }
  if (binding.kind !== "cast") {
    throw new Error(`Token ${token.id} requires a cast subject.`);
  }
  return binding.id;
}

function resourceParam(token: TypedToken): ResourceRef {
  return token.params.resource as ResourceRef;
}

function lowerToken(token: TypedToken, speakerId: string | null): CourtroomInstruction {
  switch (token.type) {
    case "courtroom.pose":
      return { op: "pose", castId: requireCastSubject(token, speakerId), pose: String(token.params.pose) };
    case "courtroom.reaction":
      return {
        op: "reaction",
        castId: requireCastSubject(token, speakerId),
        reaction: String(token.params.reaction),
      };
    case "courtroom.focus":
      return { op: "focus", castId: requireCastSubject(token, speakerId) };
    case "courtroom.wait":
      return token.params.mode === "time"
        ? { op: "wait", mode: "time", durationMs: Number(token.params.durationMs) }
        : { op: "wait", mode: "input" };
    case "courtroom.emphasis":
      return { op: "emphasis", mode: String(token.params.mode) };
    case "courtroom.flash":
      return {
        op: "flash",
        ...(token.params.intensity === undefined ? {} : { intensity: Number(token.params.intensity) }),
      };
    case "courtroom.shake":
      return {
        op: "shake",
        ...(token.params.intensity === undefined ? {} : { intensity: Number(token.params.intensity) }),
        ...(token.params.durationMs === undefined ? {} : { durationMs: Number(token.params.durationMs) }),
      };
    case "courtroom.sfx":
      return { op: "sfx", resource: resourceParam(token) };
    case "courtroom.bgm":
      return { op: "bgm", resource: resourceParam(token) };
    case "courtroom.background":
      return { op: "background", resource: resourceParam(token) };
    default:
      throw new Error(`Cannot lower unknown token type ${token.type}.`);
  }
}

export function compileCourtroomDocument(
  document: ScriptDocument,
  project: ProjectContext<CourtroomContentPack>,
): CourtroomPerformancePlan {
  const normalized = normalizeDocument(document);
  const diagnostics = validateCourtroomDocument(normalized, project);
  const errors = diagnostics.filter((item) => item.severity === "error");

  if (errors.length > 0) {
    const summary = errors.map((item) => `${item.code}: ${item.message}`).join("\n");
    throw new Error(`Courtroom compilation failed:\n${summary}`);
  }

  const instructions: CourtroomInstruction[] = [];

  for (const block of normalized.blocks) {
    if (block.type === "cue") {
      instructions.push(lowerToken(block.cue, null));
      if(block.cue.type==='courtroom.sfx')instructions.push(...recordedSoundWait(resourceParam(block.cue),project));
      continue;
    }

    const speakerId = block.speaker?.castId ?? null;
    instructions.push({ op: "speaker", castId: speakerId, typingSound: dialogueTypingSound(block,project) });

    for (const node of block.content) {
      if (node.type === "text") {
        if (node.text.length > 0) instructions.push({ op: "showText", text: node.text });
      } else {
        instructions.push(lowerToken(node.token, speakerId));
        if(actionKey(node.token))instructions.push(...actionSoundInstructions(node.token,speakerId,project));
        else if(node.token.type==='courtroom.sfx')instructions.push(...recordedSoundWait(resourceParam(node.token),project));
      }
    }
  }

  return {
    type: "courtroom.performance-plan.v1",
    sourceDocumentId: normalized.documentId,
    instructions,
  };
}
