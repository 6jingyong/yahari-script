import type { ProjectContext, ProjectManifest, ScriptDocument } from "../../packages/core/src/index.js";
import type { CourtroomContentPack } from "../../packages/adapters/courtroom/src/index.js";
import { courtroomDemoPack } from "../../content-packs/courtroom-demo/pack.js";

export const demoManifest: ProjectManifest = {
  schemaVersion: "0.6",
  projectId: "demo-courtroom",
  title: "矢张剧本 · 法庭示例",
  adapter: { id: "official.courtroom", version: "0.1.0" },
  contentPacks: [{ id: courtroomDemoPack.id, version: courtroomDemoPack.version }],
  entryDocumentId: "doc-main",
  documents: [{ id: "doc-main", path: "main.yahari.json" }],
  cast: [
    { castId: "phoenix", characterRef: { packId: courtroomDemoPack.id, id: "phoenix" } },
    { castId: "edgeworth", characterRef: { packId: courtroomDemoPack.id, id: "edgeworth" } },
    { castId: "maya", characterRef: { packId: courtroomDemoPack.id, id: "maya" } },
    { castId: "judge", characterRef: { packId: courtroomDemoPack.id, id: "judge" } },
    { castId: "witness", characterRef: { packId: courtroomDemoPack.id, id: "witness" } },
  ],
};

export const demoProject: ProjectContext<CourtroomContentPack> = {
  manifest: demoManifest,
  contentPacks: [courtroomDemoPack],
};

// Compact deterministic fixture used by low-level compiler/editor tests.
export const demoDocument: ScriptDocument = {
  schemaVersion: "0.6",
  documentId: "doc-main",
  title: "Opening",
  blocks: [
    {
      id: "blk-1",
      type: "dialogue",
      speaker: { castId: "phoenix" },
      content: [
        {
          type: "token",
          token: {
            id: "tok-1",
            type: "courtroom.pose",
            subject: { kind: "speaker" },
            params: { pose: "normal" },
          },
        },
        { type: "text", text: "我认为——" },
        {
          type: "token",
          token: {
            id: "tok-2",
            type: "courtroom.pose",
            subject: { kind: "speaker" },
            params: { pose: "point" },
          },
        },
        { type: "text", text: "真正的犯人就是你！" },
      ],
    },
  ],
};

// Richer author-facing fixture used by the browser editor. It exercises cues,
// fixed targets, several cast members, audio and pacing without introducing a Renderer.
export const demoShowcaseDocument: ScriptDocument = {
  schemaVersion: "0.7",
  documentId: "doc-main",
  title: "第一次询问",
  blocks: [
    {
      id: "cue-bg",
      type: "cue",
      cue: {
        id: "tok-bg",
        type: "courtroom.background",
        params: { resource: { packId: courtroomDemoPack.id, id: "background/courtroom" } },
      },
    },
    {
      id: "cue-bgm",
      type: "cue",
      cue: {
        id: "tok-bgm",
        type: "courtroom.bgm",
        params: { resource: { packId: courtroomDemoPack.id, id: "audio/bgm/cross-examination" } },
      },
    },
    {
      id: "blk-judge",
      type: "dialogue",
      speaker: { castId: "judge" },
      content: [
        { type: "token", token: { id: "tok-judge-normal", type: "courtroom.pose", subject: { kind: "speaker" }, params: { pose: "normal" } } },
        { type: "text", text: "那么，请证人开始作证。" },
      ],
    },
    {
      id: "blk-witness",
      type: "dialogue",
      speaker: { castId: "witness" },
      content: [
        { type: "token", token: { id: "tok-witness-confident", type: "courtroom.pose", subject: { kind: "speaker" }, params: { pose: "confident" } } },
        { type: "text", text: "我看到被告在晚上九点离开现场。绝对不会看错。" },
      ],
    },
    {
      id: "blk-phoenix",
      type: "dialogue",
      speaker: { castId: "phoenix" },
      content: [
        { type: "token", token: { id: "tok-phoenix-think", type: "courtroom.pose", subject: { kind: "speaker" }, params: { pose: "think" } } },
        { type: "text", text: "晚上九点……可是停电记录显示，八点五十分之后整层楼都没有照明。" },
        { type: "token", token: { id: "tok-phoenix-point", type: "courtroom.pose", subject: { kind: "speaker" }, params: { pose: "point" } } },
        { type: "text", text: "你究竟是怎么看清他的？" },
      ],
    },
    {
      id: "cue-impact",
      type: "cue",
      cue: {
        id: "tok-impact",
        type: "courtroom.sfx",
        params: { resource: { packId: courtroomDemoPack.id, id: "audio/sfx/impact" } },
      },
    },
    {
      id: "blk-edgeworth",
      type: "dialogue",
      speaker: { castId: "edgeworth" },
      content: [
        { type: "token", token: { id: "tok-edgeworth-surprised", type: "courtroom.reaction", subject: { kind: "speaker" }, params: { reaction: "surprised" } } },
        { type: "text", text: "……原来如此。辩护方确实抓住了证词中的矛盾。" },
      ],
    },
    {
      id: "blk-maya",
      type: "dialogue",
      speaker: { castId: "maya" },
      content: [
        { type: "token", token: { id: "tok-maya-cheer", type: "courtroom.pose", subject: { kind: "speaker" }, params: { pose: "cheer" } } },
        { type: "text", text: "成步堂！就是这里，继续追问！" },
      ],
    },
  ],
};
