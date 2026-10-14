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

export type CourtroomAudioWaveform = "sine" | "square" | "triangle" | "sawtooth" | "noise";
export interface CourtroomPreviewAudioNote {
  frequency: number;
  durationMs: number;
  offsetMs?: number;
  gain?: number;
  waveform?: CourtroomAudioWaveform;
}

export interface CourtroomPreviewAudioCue {
  waveform?: CourtroomAudioWaveform;
  notes: CourtroomPreviewAudioNote[];
  loopMs?: number;
}

export interface CourtroomNamedResource {
  id: string;
  label: string;
  resource: ResourceRef;
  foreground?: ResourceRef;
  previewAudio?: CourtroomPreviewAudioCue;
  category?: string;
  description?: string;
}

export interface CourtroomVoiceResource extends CourtroomNamedResource {
  characterId:string;
  call:'objection'|'hold-it'|'take-that';
  language:string;
  clip:{dataUrl:string;durationMs:number};
  sourceUrl:string;
}

export interface CourtroomContentPack extends ContentPackBase {
  /** Optional library provenance and authoring information, outside performance logic. */
  metadata?: Record<string, unknown>;
  /** Scene resource that activates character-specific courtroom stations. */
  stageScene: ResourceRef;
  characters: CourtroomCharacterDefinition[];
  backgrounds: CourtroomNamedResource[];
  audio: {
    sfx: CourtroomNamedResource[];
    bgm: CourtroomNamedResource[];
    voices?: CourtroomVoiceResource[];
  };
}

export type CourtroomInstruction =
  | { op: "speaker"; castId: string | null; typingSound?: ResourceRef | null }
  | { op: "showText"; text: string }
  | { op: "pose"; castId: string; pose: string }
  | { op: "reaction"; castId: string; reaction: string }
  | { op: "focus"; castId: string }
  | { op: "wait"; mode: "time" | "input"; durationMs?: number; reason?:'voice' }
  | { op: "emphasis"; mode: string }
  | { op: "flash"; intensity?: number }
  | { op: "shake"; intensity?: number; durationMs?: number }
  | { op: "sfx"; resource: ResourceRef; boundAction?:boolean }
  | { op: "bgm"; resource: ResourceRef }
  | { op: "background"; resource: ResourceRef };

export interface CourtroomPerformancePlan {
  type: "courtroom.performance-plan.v1";
  sourceDocumentId: string;
  instructions: CourtroomInstruction[];
}
