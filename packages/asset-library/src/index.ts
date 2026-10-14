import type { YahariProjectFile, ResourceRef } from '../../core/src/index.js';
import type { CourtroomContentPack } from '../../adapters/courtroom/src/index.js';
import { encodeArchiveEntries, decodeArchiveEntries, imageBytes, imageDataUrl, MAX_PROJECT_FILE_BYTES } from '../../project-io/src/index.js';

export type AssetKind = 'characters' | 'scenes';
export interface AssetRights { author: string; source: string; license: string; notes: string }
export interface AssetAction { id: string; label: string; kind: 'pose'|'reaction'; image: string }
export interface AssetCharacter { id: string; name: string; description: string; tags: string[]; portrait: string; actions: AssetAction[]; stage?: {background:string;foreground?:string} }
export interface AssetScene { id: string; name: string; description: string; tags: string[]; image: string; foreground?:string }
export interface BuiltinAssetOrigin { packId:string; version:string; kind:AssetKind; entityId:string }
export interface AssetPack {
  fileFormat: 'yahari-asset-pack'; fileVersion: '1.0'; id: string; version: string; name: string; kind: AssetKind;
  rights: AssetRights; characters: AssetCharacter[]; scenes: AssetScene[]; images: Record<string,string>;
  origin?: BuiltinAssetOrigin;
}
export const UNKNOWN_RIGHTS: AssetRights = { author: '', source: '', license: '未声明', notes: '' };
const imagePattern = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const object = (value: unknown): value is Record<string,unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number, required = false): value is string => typeof value === 'string' && value.length <= max && (!required || !!value.trim());
const id = (value: unknown): value is string => text(value,200,true) && !['__proto__','prototype','constructor'].includes(value);
const tags = (value: unknown): value is string[] => Array.isArray(value) && value.length<=20 && value.every(item=>text(item,40));

export function validateAssetPack(input: unknown): AssetPack {
  const fail = (): never => { throw new Error('素材包格式、图片引用或大小无效，素材库未更改。'); };
  if (!object(input) || input.fileFormat!=='yahari-asset-pack' || input.fileVersion!=='1.0'
    || !id(input.id) || !input.id.startsWith('local.') || !text(input.version,40,true) || !text(input.name,120,true)
    || !['characters','scenes'].includes(String(input.kind)) || !object(input.rights) || !object(input.images)
    || !Array.isArray(input.characters) || !Array.isArray(input.scenes)) return fail();
  for (const field of ['author','source','license','notes']) if (!text(input.rights[field],field==='notes'?4000:1000)) return fail();
  const images = Object.entries(input.images);
  if (!images.length || images.length>99 || images.reduce((size,[,url])=>size+(typeof url==='string'?url.length:0),0)>20_000_000) return fail();
  for (const [key,url] of images) if (!id(key) || !text(url,8_000_000,true) || !imagePattern.test(url)) return fail();
  const imageRecord=input.images;
  const validImage = (value: unknown) => id(value) && typeof imageRecord[value]==='string';
  if(input.origin!==undefined && (!object(input.origin)||!id(input.origin.packId)||!text(input.origin.version,40,true)
    ||input.origin.kind!==input.kind||!id(input.origin.entityId)))return fail();
  const identities = new Set<string>();
  if (input.characters.length>50 || input.scenes.length>50 || (input.kind==='characters' && (!input.characters.length || input.scenes.length))
    || (input.kind==='scenes' && (!input.scenes.length || input.characters.length))) return fail();
  for (const actor of input.characters) {
    if (!object(actor) || !id(actor.id) || identities.has(actor.id) || !text(actor.name,80,true)
      || !text(actor.description,4000) || !tags(actor.tags) || !validImage(actor.portrait)
      || !Array.isArray(actor.actions) || !actor.actions.length || actor.actions.length>50) return fail();
    if(actor.stage!==undefined && (!object(actor.stage)||!validImage(actor.stage.background)
      ||(actor.stage.foreground!==undefined&&!validImage(actor.stage.foreground))))return fail();
    identities.add(actor.id);
    const actions = new Set<string>();
    for (const action of actor.actions) {
      if (!object(action) || !id(action.id) || actions.has(action.id) || !text(action.label,40,true)
        || !['pose','reaction'].includes(String(action.kind)) || !validImage(action.image)) return fail();
      actions.add(action.id);
    }
    if (!actor.actions.some(action=>action.kind==='pose')) return fail();
  }
  for (const scene of input.scenes) {
    if (!object(scene) || !id(scene.id) || identities.has(scene.id) || !text(scene.name,80,true)
      || !text(scene.description,4000) || !tags(scene.tags) || !validImage(scene.image)) return fail();
    if(scene.foreground!==undefined&&!validImage(scene.foreground))return fail();
    identities.add(scene.id);
  }
  // Strip unrelated fields: portable assets cannot carry app credentials or scripts.
  const pickRights = input.rights as unknown as AssetRights;
  const pack: AssetPack = { fileFormat:'yahari-asset-pack',fileVersion:'1.0',id:input.id,version:input.version,name:input.name,
    kind:input.kind as AssetKind, rights:{author:pickRights.author,source:pickRights.source,license:pickRights.license,notes:pickRights.notes},
    images:Object.fromEntries(images) as Record<string,string>,
    characters:input.characters.map(actor=>({id:actor.id,name:actor.name,description:actor.description,tags:[...actor.tags],portrait:actor.portrait,
      actions:actor.actions.map((action: AssetAction)=>({id:action.id,label:action.label,kind:action.kind,image:action.image})),
      ...(actor.stage?{stage:{background:actor.stage.background,...(actor.stage.foreground?{foreground:actor.stage.foreground}:{})}}:{})})),
    scenes:input.scenes.map(scene=>({id:scene.id,name:scene.name,description:scene.description,tags:[...scene.tags],image:scene.image,...(scene.foreground?{foreground:scene.foreground}:{})})),
    ...(input.origin?{origin:{packId:input.origin.packId,version:input.origin.version,kind:input.origin.kind,entityId:input.origin.entityId} as BuiltinAssetOrigin}:{}) };
  return pruneAssetImages(pack);
}

export function pruneAssetImages(pack: AssetPack): AssetPack {
  const used = new Set(pack.characters.flatMap(actor=>[actor.portrait,...actor.actions.map(action=>action.image),...(actor.stage?[actor.stage.background,...(actor.stage.foreground?[actor.stage.foreground]:[])]:[])])
    .concat(pack.scenes.flatMap(scene=>[scene.image,...(scene.foreground?[scene.foreground]:[])])));
  pack.images = Object.fromEntries(Object.entries(pack.images).filter(([key])=>used.has(key)));
  return pack;
}
export function newAssetPack(kind: AssetKind, name: string): AssetPack {
  return { fileFormat:'yahari-asset-pack',fileVersion:'1.0',id:`local.asset.${crypto.randomUUID()}`,version:'1.0.0',name,kind,
    rights:{...UNKNOWN_RIGHTS},characters:[],scenes:[],images:{} };
}
export function encodeAssetPack(input: AssetPack): Uint8Array {
  const pack=validateAssetPack(input), entries=new Map<string,Uint8Array>(), paths=new Map<string,string>();
  for (const [key,url] of Object.entries(pack.images)) {
    let path=paths.get(url);
    if (!path) { const {mime,bytes}=imageBytes(url);path=`assets/${String(paths.size+1).padStart(4,'0')}.${mime.slice(6)}`;paths.set(url,path);entries.set(path,bytes); }
    pack.images[key]=`archive:${path}`;
  }
  entries.set('asset-pack.json',new TextEncoder().encode(JSON.stringify(pack)));
  return encodeArchiveEntries(entries);
}
export async function readAssetPack(file: Blob): Promise<AssetPack> {
  if (file.size>MAX_PROJECT_FILE_BYTES) throw new Error('素材包超过 32 MB。');
  const bytes=new Uint8Array(await file.arrayBuffer()), decoder=new TextDecoder('utf-8',{fatal:true});
  let input: unknown;
  try {
    if (bytes[0]===0x50 && bytes[1]===0x4b) {
      const entries=decodeArchiveEntries(bytes,'asset-pack.json');
      const raw=JSON.parse(decoder.decode(entries.get('asset-pack.json')!));
      if (!object(raw.images) || Object.keys(raw.images).length>99) throw new Error();
      const used=new Set(['asset-pack.json']); let expanded=0;
      for (const [key,ref] of Object.entries(raw.images)) {
        if (typeof ref!=='string' || !/^archive:assets\/[0-9]{4}\.(?:png|jpeg|webp)$/.test(ref)) throw new Error();
        const path=ref.slice(8), image=entries.get(path);
        if (!image) throw new Error();
        expanded+=Math.ceil(image.length/3)*4+32;
        if (expanded>20_000_000) throw new Error();
        raw.images[key]=imageDataUrl(image,`image/${path.split('.').pop()}`);used.add(path);
      }
      if (entries.size!==used.size) throw new Error();
      input=raw;
    } else input=JSON.parse(decoder.decode(bytes).replace(/^\uFEFF/,''));
  } catch { throw new Error('无法读取素材包，请选择有效的 .yahari-characters、.yahari-scenes 或素材包 JSON。'); }
  return validateAssetPack(input);
}
export function assetPackFilename(pack: AssetPack, json=false): string {
  const name=pack.name.trim().replace(/[^\p{L}\p{N}._-]+/gu,'-').slice(0,100)||'yahari-assets';
  return `${name}.${pack.kind==='characters'?'yahari-characters':'yahari-scenes'}${json?'.json':''}`;
}
export function assetPackBlob(pack: AssetPack, json=false): Blob {
  return json ? new Blob([JSON.stringify(validateAssetPack(pack),null,2)],{type:'application/json'})
    : new Blob([encodeAssetPack(pack).buffer as ArrayBuffer],{type:'application/zip'});
}

/** Adapter conversion adds a neutral owned stage; the portable library format has no IP dependencies. */
export function assetPackToEmbedded(input: AssetPack, neutralStage: string): NonNullable<YahariProjectFile['embeddedPacks']>[number] {
  const pack=validateAssetPack(input), resources={...pack.images};
  const ref=(image: string): ResourceRef=>({packId:pack.id,id:image});
  const stageImage='yahari-neutral-stage';
  if (resources[stageImage]) throw new Error('保留图片 ID 冲突。');
  if (!imagePattern.test(neutralStage)) throw new Error('中性舞台图片无效。');
  resources[stageImage]=neutralStage;
  const stageScene=ref(stageImage);
  const definition: CourtroomContentPack = { id:pack.id,version:pack.version,name:pack.name,stageScene,
    characters:pack.characters.map(actor=>({id:actor.id,name:actor.name,portraits:{base:ref(actor.portrait)},stage:{background:actor.stage?ref(actor.stage.background):stageScene,...(actor.stage?.foreground?{foreground:ref(actor.stage.foreground)}:{})},
      poses:actor.actions.filter(action=>action.kind==='pose').map(action=>({id:action.id,label:action.label,asset:ref(action.image)})),
      reactions:actor.actions.filter(action=>action.kind==='reaction').map(action=>({id:action.id,label:action.label,asset:ref(action.image)})),
      metadata:{description:actor.description,tags:actor.tags}})),
    backgrounds:pack.scenes.map(scene=>({id:scene.id,label:scene.name,resource:ref(scene.image),...(scene.foreground?{foreground:ref(scene.foreground)}:{})})),audio:{sfx:[],bgm:[]},
    metadata:{ assetLibrary:{ kind:pack.kind, rights:pack.rights, ...(pack.origin?{origin:pack.origin}:{}), scenes:pack.scenes.map(({id,name,description,tags})=>({id,name,description,tags})) } },
  };
  return { id:pack.id,version:pack.version,adapterId:'official.courtroom',definition:definition as unknown as Record<string,unknown>,resources };
}

export function installAssetPack(project: YahariProjectFile, pack: AssetPack, neutralStage: string, characterId?: string): {project:YahariProjectFile;castId?:string} {
  const next=structuredClone(project), embedded=assetPackToEmbedded(pack,neutralStage);
  if (project.manifest.adapter.id!=='official.courtroom') throw new Error('当前作品的演出适配器不兼容。');
  const old=next.embeddedPacks?.find(item=>item.id===pack.id);
  if (old) {
    // Do not remove actions/entities still referenced by the authored work.
    for (const cast of next.manifest.cast.filter(c=>c.characterRef.packId===pack.id)) {
      const actor=pack.characters.find(c=>c.id===cast.characterRef.id);
      if (!actor) throw new Error('当前作品仍使用此包中的角色，更新不能移除它。');
      for (const doc of next.documents) for (const block of doc.blocks) {
        if (block.type!=='dialogue') continue;
        for (const node of block.content) {
          if (node.type!=='token') continue;
          const token=node.token, owner=token.subject?.kind==='cast'?token.subject.id:block.speaker?.castId;
          if (owner===cast.castId && ['courtroom.pose','courtroom.reaction'].includes(token.type)) {
            const value=token.type==='courtroom.pose'?token.params.pose:token.params.reaction;
            const kind=token.type==='courtroom.pose'?'pose':'reaction';
            if (!actor.actions.some(action=>action.id===value && action.kind===kind)) throw new Error('当前剧本仍使用已删除或改类的动作，请保留该动作再更新。');
          }
        }
      }
    }
    for (const doc of next.documents) for (const block of doc.blocks) {
      const tokens=block.type==='cue'?[block.cue]:block.content.flatMap(node=>node.type==='token'?[node.token]:[]);
      for (const token of tokens) {
        const ref=token.params.resource as ResourceRef|undefined;
        if (ref?.packId===pack.id && !embedded.resources[ref.id]) throw new Error('当前作品仍引用已删除的场景图片，不能更新。');
      }
    }
  }
  if (!old && (next.embeddedPacks?.length??0)>=4) throw new Error('当前作品最多使用 4 个自有素材包，请合并素材后再加入。');
  next.fileVersion=next.manifest.flow?'0.9':'0.8';
  next.embeddedPacks=(next.embeddedPacks??[]).filter(item=>item.id!==pack.id).concat(embedded);
  next.manifest.contentPacks=next.manifest.contentPacks.filter(item=>item.id!==pack.id).concat({id:pack.id,version:pack.version});
  let castId;
  if (characterId) {
    const actor=pack.characters.find(item=>item.id===characterId);
    if (!actor) throw new Error('素材包中找不到此角色。');
    const existing=next.manifest.cast.find(cast=>cast.characterRef.packId===pack.id && cast.characterRef.id===characterId);
    castId=existing?.castId??`asset-${crypto.randomUUID()}`;
    if (!existing) next.manifest.cast.push({castId,displayName:actor.name,characterRef:{packId:pack.id,id:characterId}});
    else existing.displayName=actor.name;
  }
  return {project:next,castId};
}

/** Collect only owned data URLs, preserving old role/action/image identities. */
export function ownedAssetPacks(project: YahariProjectFile): AssetPack[] {
  const packs: AssetPack[]=[];
  for (const item of project.embeddedPacks??[]) {
    const definition=item.definition as unknown as CourtroomContentPack;
    if (item.adapterId!=='official.courtroom' || !Array.isArray(definition.characters) || !Array.isArray(definition.backgrounds)) continue;
    const owned=(ref: ResourceRef|undefined)=>ref?.packId===item.id && imagePattern.test(item.resources[ref.id]??'');
    if(definition.metadata?.builtinOverrides)continue;
    const metadata=definition.metadata?.assetLibrary as {kind?:AssetKind;rights?:AssetRights;scenes?:AssetScene[];origin?:BuiltinAssetOrigin}|undefined;
    for (const kind of ['characters','scenes'] as const) {
      const pack: AssetPack={...newAssetPack(kind,definition.name),id:metadata?.kind===kind?item.id:`${item.id}.${kind}`,version:item.version,
        rights:metadata?.rights??{...UNKNOWN_RIGHTS,source:'从当前作品收录'},images:{...item.resources},...(metadata?.origin?{origin:metadata.origin}:{})};
      if (kind==='characters') pack.characters=definition.characters.filter(actor=>owned(actor.portraits?.base)
        && [...actor.poses,...actor.reactions].every(action=>owned(action.asset))).map(actor=>({id:actor.id,name:actor.name,
          description:typeof actor.metadata?.description==='string'?actor.metadata.description:'',tags:Array.isArray(actor.metadata?.tags)?actor.metadata.tags as string[]:[],
          portrait:actor.portraits.base.id,actions:[...actor.poses.map(action=>({id:action.id,label:action.label,kind:'pose' as const,image:action.asset.id})),
            ...actor.reactions.map(action=>({id:action.id,label:action.label,kind:'reaction' as const,image:action.asset.id}))],
          ...(owned(actor.stage.background)&&actor.stage.background.id!=='yahari-neutral-stage'?{stage:{background:actor.stage.background.id,...(owned(actor.stage.foreground)?{foreground:actor.stage.foreground!.id}:{})}}:{})}));
      else pack.scenes=definition.backgrounds.filter(scene=>owned(scene.resource)).map(scene=>({id:scene.id,name:scene.label,
        description:metadata?.scenes?.find(saved=>saved.id===scene.id)?.description??'',tags:metadata?.scenes?.find(saved=>saved.id===scene.id)?.tags??[],image:scene.resource.id,...(owned(scene.foreground)?{foreground:scene.foreground!.id}:{})}));
      if (pack.characters.length||pack.scenes.length) packs.push(validateAssetPack(pruneAssetImages(pack)));
    }
  }
  return packs;
}
