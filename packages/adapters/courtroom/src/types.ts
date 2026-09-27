import type { ContentPackBase, ResourceRef } from "../../../core/src/index.js";

export interface CourtroomPoseDefinition {
  id: string;
  label: string;
  asset: ResourceRef;
}

export interface CourtroomReactionDefinition {
  id: string;
  label: string;
  asset: ResourceRef;
}

export interface CourtroomCharacterDefinition {
  id: string;
  name: string;
  portraits: {
    base: ResourceRef;
  };
  stage: {
    background: ResourceRef;
    foreground?: ResourceRef;
  };
  poses: CourtroomPoseDefinition[];
  reactions: CourtroomReactionDefinition[];
  metadata?: Record<string, unknown>;
}

export interface CourtroomPreviewAudioNote {
  frequency: number;
  durationMs: number;
  offsetMs?: number;
  gain?: number;
}

export interface CourtroomPreviewAudioCue {
  waveform?: "sine" | "square" | "triangle" | "sawtooth";
  notes: CourtroomPreviewAudioNote[];
  loopMs?: number;
}

export interface CourtroomNamedResource {
  id: string;
  label: string;
  resource: ResourceRef;
  foreground?: ResourceRef;
  previewAudio?: CourtroomPreviewAudioCue;
}

export interface CourtroomContentPack extends ContentPackBase {
  /** Scene resource that activates character-specific courtroom stations. */
  stageScene: ResourceRef;
  characters: CourtroomCharacterDefinition[];
  backgrounds: CourtroomNamedResource[];
  audio: {
    sfx: CourtroomNamedResource[];
    bgm: CourtroomNamedResource[];
  };
}

export type CourtroomInstruction =
  | { op: "speaker"; castId: string | null }
  | { op: "showText"; text: string }
  | { op: "pose"; castId: string; pose: string }
  | { op: "reaction"; castId: string; reaction: string }
  | { op: "focus"; castId: string }
  | { op: "wait"; mode: "time" | "input"; durationMs?: number }
  | { op: "emphasis"; mode: string }
  | { op: "flash"; intensity?: number }
  | { op: "shake"; intensity?: number; durationMs?: number }
  | { op: "sfx"; resource: ResourceRef }
  | { op: "bgm"; resource: ResourceRef }
  | { op: "background"; resource: ResourceRef };

export interface CourtroomPerformancePlan {
  type: "courtroom.performance-plan.v1";
  sourceDocumentId: string;
  instructions: CourtroomInstruction[];
}
