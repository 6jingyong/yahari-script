import { readFileSync, writeFileSync } from "node:fs";

const path = "content-packs/courtroom-demo/catalog.json";
const outputPath = "content-packs/courtroom-demo/generated.ts";
const catalog = JSON.parse(readFileSync(path, "utf8"));

const requiredString = (value, label) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value;
};
const resourceIds = new Set(Object.keys(catalog.resources ?? {}));
const requireResource = (id, label) => {
  requiredString(id, label);
  if (!resourceIds.has(id) && !id.startsWith("audio/")) throw new Error(`${label} references missing resource ${id}`);
  return { packId: catalog.id, id };
};
const action = (item, label) => ({
  id: requiredString(item.id, `${label}.id`),
  label: requiredString(item.label, `${label}.label`),
  asset: requireResource(item.asset, `${label}.asset`),
});

const previewAudio = (value, label) => {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || !Array.isArray(value.notes) || !value.notes.length) {
    throw new Error(`${label}.previewAudio must contain notes`);
  }
  const waveform=value.waveform ?? "triangle";
  if (!["sine","square","triangle","sawtooth"].includes(waveform)) throw new Error(`${label}.previewAudio.waveform is unsupported`);
  const notes=value.notes.map((note,index)=>{
    if(!note||typeof note!=="object")throw new Error(`${label}.previewAudio.notes[${index}] is invalid`);
    const frequency=Number(note.frequency),durationMs=Number(note.durationMs);
    const offsetMs=note.offsetMs===undefined?undefined:Number(note.offsetMs);
    const gain=note.gain===undefined?undefined:Number(note.gain);
    if(!Number.isFinite(frequency)||frequency<=0||!Number.isFinite(durationMs)||durationMs<=0)throw new Error(`${label}.previewAudio note values are invalid`);
    if(offsetMs!==undefined&&(!Number.isFinite(offsetMs)||offsetMs<0))throw new Error(`${label}.previewAudio offset is invalid`);
    if(gain!==undefined&&(!Number.isFinite(gain)||gain<=0||gain>1))throw new Error(`${label}.previewAudio gain is invalid`);
    return {frequency,durationMs,...(offsetMs===undefined?{}:{offsetMs}),...(gain===undefined?{}:{gain})};
  });
  const loopMs=value.loopMs===undefined?undefined:Number(value.loopMs);
  if(loopMs!==undefined&&(!Number.isFinite(loopMs)||loopMs<250))throw new Error(`${label}.previewAudio.loopMs is invalid`);
  return {waveform,notes,...(loopMs===undefined?{}:{loopMs})};
};

const pack = {
  id: requiredString(catalog.id, "id"),
  version: requiredString(catalog.version, "version"),
  name: requiredString(catalog.name, "name"),
  stageScene: requireResource(catalog.stageScene, "stageScene"),
  characters: (catalog.characters ?? []).map((character) => ({
    id: requiredString(character.id, "character.id"),
    name: requiredString(character.name, `character ${character.id}.name`),
    portraits: { base: requireResource(character.portrait, `character ${character.id}.portrait`) },
    stage: {
      background: requireResource(character.stage?.background, `character ${character.id}.stage.background`),
      ...(character.stage?.foreground ? { foreground: requireResource(character.stage.foreground, `character ${character.id}.stage.foreground`) } : {}),
    },
    poses: (character.poses ?? []).map((item) => action(item, `character ${character.id}.pose`)),
    reactions: (character.reactions ?? []).map((item) => action(item, `character ${character.id}.reaction`)),
  })),
  backgrounds: (catalog.backgrounds ?? []).map((item) => ({
    id: requiredString(item.id, "background.id"),
    label: requiredString(item.label, `background ${item.id}.label`),
    resource: requireResource(item.resource, `background ${item.id}.resource`),
    ...(item.foreground ? { foreground: requireResource(item.foreground, `background ${item.id}.foreground`) } : {}),
  })),
  audio: {
    sfx: (catalog.audio?.sfx ?? []).map((item) => ({
      id: requiredString(item.id, "sfx.id"),
      label: requiredString(item.label, `sfx ${item.id}.label`),
      resource: requireResource(item.resource, `sfx ${item.id}.resource`),
      ...(previewAudio(item.previewAudio,`sfx ${item.id}`)?{previewAudio:previewAudio(item.previewAudio,`sfx ${item.id}`)}:{}),
    })),
    bgm: (catalog.audio?.bgm ?? []).map((item) => ({
      id: requiredString(item.id, "bgm.id"),
      label: requiredString(item.label, `bgm ${item.id}.label`),
      resource: requireResource(item.resource, `bgm ${item.id}.resource`),
      ...(previewAudio(item.previewAudio,`bgm ${item.id}`)?{previewAudio:previewAudio(item.previewAudio,`bgm ${item.id}`)}:{}),
    })),
  },
};

const resources = Object.fromEntries(Object.entries(catalog.resources ?? {}).map(([id, descriptor]) => {
  const file = requiredString(descriptor.file, `resource ${id}.file`);
  if (descriptor.frame !== undefined && (!Array.isArray(descriptor.frame) || descriptor.frame.length !== 4 || descriptor.frame.some((n) => typeof n !== "number"))) {
    throw new Error(`resource ${id}.frame must be [x,y,w,h]`);
  }
  if (descriptor.colorKey !== undefined && descriptor.colorKey !== "magenta") throw new Error(`resource ${id}.colorKey is unsupported`);
  return [id, {
    url: `../../content-packs/courtroom-demo/assets/${file}`,
    ...(descriptor.frame ? { frame: descriptor.frame } : {}),
    ...(descriptor.colorKey ? { colorKey: descriptor.colorKey } : {}),
  }];
}));

const source = `// Generated by scripts/generate-content-packs.mjs from catalog.json. Do not edit.
import type { CourtroomContentPack } from "../../packages/adapters/courtroom/src/index.js";
import type { StaticResourcePack } from "../../packages/presentation/src/index.js";

export const courtroomDemoPack = ${JSON.stringify(pack, null, 2)} satisfies CourtroomContentPack;

export const courtroomDemoResources = ${JSON.stringify({ packId: catalog.id, resources }, null, 2)} satisfies StaticResourcePack;
`;
writeFileSync(outputPath, source);
console.log(`Generated ${outputPath}: ${pack.characters.length} characters, ${Object.keys(resources).length} resources.`);
