import type {
  EditorContext,
  ProjectContext,
  TokenCandidate,
  TokenPickerQuery,
} from "../../../core/src/index.js";
import type { CourtroomContentPack } from "./types.js";
import { buildCourtroomCapabilityRegistry } from "./registry.js";
import { courtroomTokenTypes } from "./token-types.js";

const tokenDefinitionMap = new Map(courtroomTokenTypes.map((definition) => [definition.type, definition]));

function matchesInsertionScope(candidate: TokenCandidate, context: EditorContext): boolean {
  if (!context.insertionScope) return true;
  const definition = tokenDefinitionMap.get(candidate.tokenType);
  if (!definition) return false;
  return definition.scope === "both" || definition.scope === context.insertionScope;
}

function matchQuery(candidate: TokenCandidate, query?: TokenPickerQuery): boolean {
  if (!query) return true;
  if (query.type && candidate.tokenType !== query.type) return false;
  if (query.category && candidate.category !== query.category) return false;
  if (query.search) {
    const needle = query.search.toLowerCase();
    const haystack = `${candidate.label} ${candidate.tokenType} ${JSON.stringify(candidate.params)}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

export function getCourtroomTokenCandidates(
  context: EditorContext,
  project: ProjectContext<CourtroomContentPack>,
  query?: TokenPickerQuery,
): TokenCandidate[] {
  const registry = buildCourtroomCapabilityRegistry(project);
  const speakerId = context.speaker?.castId;
  const candidates: TokenCandidate[] = [];

  for (const capability of registry.capabilities) {
    const isSpeaker = capability.subject.kind === "cast" && capability.subject.id === speakerId;
    const value = capability.kind === "courtroom.pose"
      ? capability.params?.pose
      : capability.params?.reaction;

    candidates.push({
      id: capability.id,
      tokenType: capability.kind,
      label: String(value),
      // Current-speaker actions are explicitly speaker-bound. Other-character
      // actions remain fixed cast references. This makes speaker changes
      // deterministic instead of relying on editor-side retargeting magic.
      subject: isSpeaker ? { kind: "speaker" } : capability.subject,
      params: { ...(capability.params ?? {}) },
      category: "Character",
      enabled: true,
      availability: isSpeaker ? "recommended" : "available",
      score: isSpeaker ? 100 : 50,
      preview: capability.source,
    });
  }

  for (const cast of project.manifest.cast) {
    const isSpeaker = cast.castId === speakerId;
    candidates.push({
      id: `focus:${cast.castId}`,
      tokenType: "courtroom.focus",
      label: `镜头：${cast.displayName ?? cast.castId}`,
      subject: isSpeaker ? { kind: "speaker" } : { kind: "cast", id: cast.castId },
      params: {},
      category: "Scene",
      enabled: true,
      availability: isSpeaker ? "recommended" : "available",
      score: isSpeaker ? 90 : 35,
    });
  }

  candidates.push(
    {
      id: "wait:input",
      tokenType: "courtroom.wait",
      label: "等待点击",
      params: { mode: "input" },
      category: "Presentation",
      enabled: true,
      availability: "available",
      score: 30,
    },
    {
      id: "wait:500",
      tokenType: "courtroom.wait",
      label: "停顿 0.5 秒",
      params: { mode: "time", durationMs: 500 },
      category: "Presentation",
      enabled: true,
      availability: "available",
      score: 25,
    },
    {
      id: "wait:1000",
      tokenType: "courtroom.wait",
      label: "停顿 1 秒",
      params: { mode: "time", durationMs: 1000 },
      category: "Presentation",
      enabled: true,
      availability: "available",
      score: 24,
    },
    {
      id: "emphasis:strong",
      tokenType: "courtroom.emphasis",
      label: "强调文字",
      params: { mode: "strong" },
      category: "Presentation",
      enabled: true,
      availability: "available",
      score: 28,
    },
    {
      id: "flash:soft",
      tokenType: "courtroom.flash",
      label: "轻闪",
      params: { intensity: 0.45 },
      category: "Presentation",
      enabled: true,
      availability: "available",
      score: 22,
    },
    {
      id: "flash:strong",
      tokenType: "courtroom.flash",
      label: "强闪",
      params: { intensity: 1 },
      category: "Presentation",
      enabled: true,
      availability: "available",
      score: 21,
    },
    {
      id: "shake:soft",
      tokenType: "courtroom.shake",
      label: "轻微震动",
      params: { intensity: 0.45, durationMs: 220 },
      category: "Presentation",
      enabled: true,
      availability: "available",
      score: 20,
    },
    {
      id: "shake:strong",
      tokenType: "courtroom.shake",
      label: "强烈震动",
      params: { intensity: 1, durationMs: 420 },
      category: "Presentation",
      enabled: true,
      availability: "available",
      score: 19,
    },
  );

  for (const pack of project.contentPacks) {
    for (const item of pack.audio.sfx) {
      candidates.push({
        id: `sfx:${pack.id}:${item.id}`,
        tokenType: "courtroom.sfx",
        label: item.label,
        params: { resource: item.resource },
        category: "Audio",
        enabled: true,
        availability: "available",
        score: 20,
        preview: item.resource,
      });
    }
    for (const item of pack.audio.bgm) {
      candidates.push({
        id: `bgm:${pack.id}:${item.id}`,
        tokenType: "courtroom.bgm",
        label: item.label,
        params: { resource: item.resource },
        category: "Audio",
        enabled: true,
        availability: "available",
        score: 15,
        preview: item.resource,
      });
    }
    for (const item of pack.backgrounds) {
      candidates.push({
        id: `background:${pack.id}:${item.id}`,
        tokenType: "courtroom.background",
        label: item.label,
        params: { resource: item.resource },
        category: "Scene",
        enabled: true,
        availability: "available",
        score: 10,
        preview: item.resource,
      });
    }
  }

  return candidates
    .filter((candidate) => matchesInsertionScope(candidate, context))
    .filter((candidate) => matchQuery(candidate, query))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.label.localeCompare(b.label));
}
