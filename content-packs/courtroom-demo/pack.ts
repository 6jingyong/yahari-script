import type { CourtroomContentPack } from "../../packages/adapters/courtroom/src/index.js";

const ref = (id: string) => ({ packId: "official.courtroom-demo", id });

export const courtroomDemoPack: CourtroomContentPack = {
  id: "official.courtroom-demo",
  version: "0.1.0",
  name: "Courtroom Demo Pack",
  characters: [
    {
      id: "phoenix",
      name: "成步堂",
      portraits: { base: ref("character/phoenix/portrait") },
      poses: [
        { id: "normal", label: "平常", asset: ref("character/phoenix/pose/normal") },
        { id: "think", label: "思考", asset: ref("character/phoenix/pose/think") },
        { id: "point", label: "指证", asset: ref("character/phoenix/pose/point") },
        { id: "desk", label: "拍桌", asset: ref("character/phoenix/pose/desk") },
      ],
      reactions: [
        { id: "sweat", label: "冒汗", asset: ref("character/phoenix/reaction/sweat") },
        { id: "shocked", label: "震惊", asset: ref("character/phoenix/reaction/shocked") },
      ],
    },
    {
      id: "edgeworth",
      name: "御剑",
      portraits: { base: ref("character/edgeworth/portrait") },
      poses: [
        { id: "normal", label: "平常", asset: ref("character/edgeworth/pose/normal") },
        { id: "bow", label: "致意", asset: ref("character/edgeworth/pose/bow") },
        { id: "point", label: "指证", asset: ref("character/edgeworth/pose/point") },
        { id: "smug", label: "从容", asset: ref("character/edgeworth/pose/smug") },
      ],
      reactions: [
        { id: "surprised", label: "惊讶", asset: ref("character/edgeworth/reaction/surprised") },
        { id: "damaged", label: "受创", asset: ref("character/edgeworth/reaction/damaged") },
      ],
    },
    {
      id: "maya",
      name: "真宵",
      portraits: { base: ref("character/maya/portrait") },
      poses: [
        { id: "normal", label: "平常", asset: ref("character/maya/pose/normal") },
        { id: "cheer", label: "加油", asset: ref("character/maya/pose/cheer") },
        { id: "think", label: "思考", asset: ref("character/maya/pose/think") },
      ],
      reactions: [
        { id: "surprised", label: "惊讶", asset: ref("character/maya/reaction/surprised") },
        { id: "sad", label: "沮丧", asset: ref("character/maya/reaction/sad") },
      ],
    },
    {
      id: "judge",
      name: "裁判长",
      portraits: { base: ref("character/judge/portrait") },
      poses: [
        { id: "normal", label: "平常", asset: ref("character/judge/pose/normal") },
        { id: "stern", label: "严肃", asset: ref("character/judge/pose/stern") },
      ],
      reactions: [
        { id: "surprised", label: "惊讶", asset: ref("character/judge/reaction/surprised") },
        { id: "confused", label: "困惑", asset: ref("character/judge/reaction/confused") },
      ],
    },
    {
      id: "witness",
      name: "矢张（证人）",
      portraits: { base: ref("character/witness/portrait") },
      poses: [
        { id: "normal", label: "平常", asset: ref("character/witness/pose/normal") },
        { id: "nervous", label: "紧张", asset: ref("character/witness/pose/nervous") },
        { id: "confident", label: "自信", asset: ref("character/witness/pose/confident") },
      ],
      reactions: [
        { id: "shocked", label: "震惊", asset: ref("character/witness/reaction/shocked") },
        { id: "sweat", label: "冒汗", asset: ref("character/witness/reaction/sweat") },
      ],
    },
  ],
  backgrounds: [
    { id: "courtroom", label: "法庭 · 审理中", resource: ref("background/courtroom") },
    { id: "witness-stand", label: "证人席", resource: ref("background/witness-stand") },
    { id: "lobby", label: "被告人候审室", resource: ref("background/lobby") },
  ],
  audio: {
    sfx: [
      { id: "objection", label: "异议！", resource: ref("audio/sfx/objection") },
      { id: "hold-it", label: "等一下！", resource: ref("audio/sfx/hold-it") },
      { id: "desk-slam", label: "拍桌", resource: ref("audio/sfx/desk-slam") },
      { id: "gavel", label: "法槌", resource: ref("audio/sfx/gavel") },
      { id: "impact", label: "冲击", resource: ref("audio/sfx/impact") },
    ],
    bgm: [
      { id: "trial", label: "开庭", resource: ref("audio/bgm/trial") },
      { id: "cross-examination", label: "询问", resource: ref("audio/bgm/cross-examination") },
      { id: "suspense", label: "疑点", resource: ref("audio/bgm/suspense") },
      { id: "pursuit", label: "追击", resource: ref("audio/bgm/pursuit") },
    ],
  },
};
