import { courtroomDemoPack as generatedPack, courtroomDemoResources } from '../../../content-packs/courtroom-demo/generated.js';
import { createStaticResourceResolver, type StaticResourcePack } from '../../../packages/presentation/src/index.js';
import { validateAssetPack, pruneAssetImages, type AssetPack, type AssetKind, type BuiltinAssetOrigin, type AssetCharacter, type AssetScene } from '../../../packages/asset-library/src/index.js';
import type { YahariProjectFile, ResourceRef } from '../../../packages/core/src/index.js';
import type { CourtroomContentPack, CourtroomCharacterDefinition } from '../../../packages/adapters/courtroom/src/index.js';
import { normalizeCharacterImage } from './original-character.js';
import { embeddedCourtroomPack, type EmbeddedPack } from './project-assets.js';

const courtroomDemoPack:CourtroomContentPack=generatedPack;
export interface BuiltinAssetEntry {id:string;kind:AssetKind;entityId:string;name:string;aliases?:string[];preview:ResourceRef;actions:number;origin:BuiltinAssetOrigin}
export const builtinAssetEntries:BuiltinAssetEntry[]=[
  ...courtroomDemoPack.characters.map(actor=>({id:`local.builtin.${courtroomDemoPack.id}.characters.${actor.id}`,kind:'characters' as const,
    entityId:actor.id,name:actor.name,aliases:Array.isArray(actor.metadata?.aliases)?actor.metadata.aliases.filter((alias):alias is string=>typeof alias==='string'):[],preview:actor.portraits.base,actions:actor.poses.length+actor.reactions.length,
    origin:{packId:courtroomDemoPack.id,version:courtroomDemoPack.version,kind:'characters' as const,entityId:actor.id}})),
  ...courtroomDemoPack.backgrounds.map(scene=>({id:`local.builtin.${courtroomDemoPack.id}.scenes.${scene.id}`,kind:'scenes' as const,
    entityId:scene.id,name:scene.label,preview:scene.resource,actions:0,
    origin:{packId:courtroomDemoPack.id,version:courtroomDemoPack.version,kind:'scenes' as const,entityId:scene.id}})),
];
const resolver=createStaticResourceResolver([courtroomDemoResources]);
const images=new Map<string,Promise<HTMLImageElement>>(),rasters=new Map<string,Promise<string>>(),packs=new Map<string,Promise<AssetPack>>();
export function rasterizedBuiltin(ref:ResourceRef):Promise<string> {
  const key=`${ref.packId}/${ref.id}`;let cached=rasters.get(key);if(cached)return cached;
  cached=(async()=>{
    const resource=resolver.resolve(ref);if(!resource)throw new Error('找不到内置图片。');
    let decoded=images.get(resource.url);
    if(!decoded){decoded=(async()=>{const image=new Image();image.src=resource.url;await image.decode();return image;})();images.set(resource.url,decoded);decoded.catch(()=>images.delete(resource.url));}
    const image=await decoded,frame=resource.frame??[0,0,image.naturalWidth,image.naturalHeight];
    const [x,y,w,h]=frame;if(w<1||h<1||x<0||y<0||x+w>image.naturalWidth||y+h>image.naturalHeight)throw new Error('内置图集的裁切框无效。');
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const context=canvas.getContext('2d')!;
    context.drawImage(image,x,y,w,h,0,0,w,h);
    if(resource.colorKey==='magenta'){const pixels=context.getImageData(0,0,w,h);for(let i=0;i<pixels.data.length;i+=4)
      if(pixels.data[i]===255&&pixels.data[i+1]===0&&pixels.data[i+2]===255)pixels.data[i+3]=0;context.putImageData(pixels,0,0);}
    return normalizeCharacterImage(canvas.toDataURL('image/png'));
  })();rasters.set(key,cached);cached.catch(()=>rasters.delete(key));return cached;
}
export async function materializeBuiltin(entry:BuiltinAssetEntry):Promise<AssetPack> {
  let cached=packs.get(entry.id);if(!cached){cached=(async()=>{
    const pack:AssetPack={fileFormat:'yahari-asset-pack',fileVersion:'1.0',id:entry.id,version:courtroomDemoPack.version,
      name:`内置法庭 · ${entry.name}`,kind:entry.kind,origin:entry.origin,
      rights:{author:'Yahari Script 生成同人插画；角色权利归 CAPCOM',source:`内置 ${courtroomDemoPack.id}@${courtroomDemoPack.version}；详见 THIRD_PARTY_ASSETS.md`,license:'第三方角色使用许可未声明',notes:'基于内置素材调整；保留来源，不等同于原创角色授权。'},characters:[],scenes:[],images:{}};
    const refs=new Map<string,ResourceRef>();const own=(ref:ResourceRef)=>{refs.set(ref.id,ref);return ref.id;};
    if(entry.kind==='characters'){
      const actor=courtroomDemoPack.characters.find(a=>a.id===entry.entityId)!;
      pack.characters=[{id:actor.id,name:actor.name,description:typeof actor.metadata?.description==='string'?actor.metadata.description:'',tags:['内置','法庭',...(entry.aliases??[])],portrait:own(actor.portraits.base),
        actions:[...actor.poses.map(a=>({id:a.id,label:a.label,kind:'pose' as const,image:own(a.asset)})),...actor.reactions.map(a=>({id:a.id,label:a.label,kind:'reaction' as const,image:own(a.asset)}))],
        stage:{background:own(actor.stage.background),...(actor.stage.foreground?{foreground:own(actor.stage.foreground)}:{})}}];
    }else{
      const scene=courtroomDemoPack.backgrounds.find(a=>a.id===entry.entityId)!;
      pack.scenes=[{id:scene.id,name:scene.label,description:'',tags:['内置','法庭'],image:own(scene.resource),...(scene.foreground?{foreground:own(scene.foreground)}:{})}];
    }
    await Promise.all([...refs].map(async([id,ref])=>pack.images[id]=await rasterizedBuiltin(ref)));return validateAssetPack(pack);
  })();packs.set(entry.id,cached);cached.catch(()=>packs.delete(entry.id));}
  return structuredClone(await cached);
}
interface OverrideMetadata {packId:string;version:string;resourceOverrides:Record<string,string>;rights:Record<string,unknown>}
function overrideMetadata(item:EmbeddedPack):OverrideMetadata|undefined {
  const value=item.definition.metadata as Record<string,unknown>|undefined;const raw=value?.builtinOverrides as OverrideMetadata|undefined;
  if(!raw||raw.packId!==courtroomDemoPack.id||raw.version!==courtroomDemoPack.version||!raw.resourceOverrides||typeof raw.resourceOverrides!=='object'||Array.isArray(raw.resourceOverrides)
    ||!raw.rights||typeof raw.rights!=='object'||Array.isArray(raw.rights))return;
  if(Object.entries(raw.resourceOverrides).some(([original,owned])=>!resolver.resolve({packId:raw.packId,id:original})||typeof owned!=='string'||!item.resources[owned]))return;
  return raw;
}
/** Project-scoped changes preserve all historical builtin references and cast IDs. */
export function resolveBuiltinOverrides(items:readonly EmbeddedPack[]):{pack:CourtroomContentPack;resources:StaticResourcePack;overlayIds:Set<string>} {
  const pack=structuredClone(courtroomDemoPack),resources:StaticResourcePack={packId:pack.id,resources:{}},overlayIds=new Set<string>();
  for(const item of items){if(!embeddedCourtroomPack(item))continue;const metadata=overrideMetadata(item);if(!metadata)continue;overlayIds.add(item.id);
    const definition=item.definition as unknown as CourtroomContentPack;
    for(const actor of definition.characters){const index=pack.characters.findIndex(a=>a.id===actor.id);if(index>=0)pack.characters[index]=structuredClone(actor);}
    for(const scene of definition.backgrounds){const index=pack.backgrounds.findIndex(a=>a.id===scene.id);if(index>=0)pack.backgrounds[index]=structuredClone(scene);}
    for(const [original,owned]of Object.entries(metadata.resourceOverrides))resources.resources[original]={url:item.resources[owned]};
  }
  return{pack,resources,overlayIds};
}
export function installBuiltinAsset(project:YahariProjectFile,input:AssetPack,baseline:AssetPack):{project:YahariProjectFile;castId?:string} {
  const pack=validateAssetPack(input),origin=pack.origin;
  if(!origin||origin.packId!==courtroomDemoPack.id||origin.version!==courtroomDemoPack.version||origin.entityId!==baseline.origin?.entityId||origin.kind!==baseline.kind
    ||project.manifest.adapter.id!=='official.courtroom')throw new Error('内置素材来源或当前作品不兼容。');
  if((pack.kind==='characters'?pack.characters:pack.scenes).length!==1)throw new Error('内置素材调整须对应一个角色或场景。');
  const next=structuredClone(project);
  let item=next.embeddedPacks?.find(p=>embeddedCourtroomPack(p)&&overrideMetadata(p));
  const id=item?.id??`local.${project.manifest.projectId}.builtin-overrides`;
  if(!item){if((next.embeddedPacks?.length??0)>=4)throw new Error('当前作品自有包已达 4 个，请合并后再应用内置素材调整。');
    const definition:CourtroomContentPack={id,version:'1.0.0',name:'本作品内置素材调整',stageScene:courtroomDemoPack.stageScene,characters:[],backgrounds:[],audio:{sfx:[],bgm:[]},
      metadata:{builtinOverrides:{packId:origin.packId,version:origin.version,resourceOverrides:{},rights:{}}}};
    item={id,version:definition.version,adapterId:'official.courtroom',definition:definition as unknown as Record<string,unknown>,resources:{}};(next.embeddedPacks??=[]).push(item);next.manifest.contentPacks.push({id,version:item.version});}
  const metadata=overrideMetadata(item);if(!metadata)throw new Error('作品内置素材调整记录无效。');
  const definition=item.definition as unknown as CourtroomContentPack;
  function ref(imageId:string,original?:ResourceRef):ResourceRef {
    const data=pack.images[imageId];if(!data)throw new Error('素材图片缺失。');
    if(original && data===baseline.images[original.id]){delete metadata!.resourceOverrides[original.id];return structuredClone(original);}
    const owned=`${origin!.kind}/${origin!.entityId}/${imageId}`;item!.resources[owned]=data;
    if(original){metadata!.resourceOverrides[original.id]=owned;return structuredClone(original);}
    return{packId:id,id:owned};
  }
  let castId;
  if(pack.kind==='characters'){
    const actor=pack.characters[0],original=courtroomDemoPack.characters.find(a=>a.id===origin.entityId);
    if(!original||actor.id!==original.id)throw new Error('内置角色 ID 不可改变。');
    const casts=next.manifest.cast.filter(c=>c.characterRef.packId===origin.packId&&c.characterRef.id===actor.id);
    for(const doc of next.documents)for(const block of doc.blocks){if(block.type!=='dialogue')continue;for(const node of block.content){if(node.type!=='token')continue;
      const token=node.token,owner=token.subject?.kind==='cast'?token.subject.id:block.speaker?.castId;
      if(casts.some(c=>c.castId===owner)&&['courtroom.pose','courtroom.reaction'].includes(token.type)){
        const kind=token.type==='courtroom.pose'?'pose':'reaction',actionId=kind==='pose'?token.params.pose:token.params.reaction;
        if(!actor.actions.some(a=>a.id===actionId&&a.kind===kind))throw new Error('当前剧本仍使用已删除或改类的动作，请保留该动作后再应用。');}}}
    for(const resource of [original.portraits.base,...original.poses.map(a=>a.asset),...original.reactions.map(a=>a.asset)])delete metadata.resourceOverrides[resource.id];
    const converted:CourtroomCharacterDefinition={id:actor.id,name:actor.name,portraits:{base:ref(actor.portrait,original.portraits.base)},
      stage:{background:actor.stage?ref(actor.stage.background,original.stage.background):original.stage.background,
        ...(actor.stage?.foreground?{foreground:ref(actor.stage.foreground,original.stage.foreground)}:{})},
      poses:actor.actions.filter(a=>a.kind==='pose').map(a=>({id:a.id,label:a.label,asset:ref(a.image,original.poses.find(o=>o.id===a.id)?.asset)})),
      reactions:actor.actions.filter(a=>a.kind==='reaction').map(a=>({id:a.id,label:a.label,asset:ref(a.image,original.reactions.find(o=>o.id===a.id)?.asset)})),
      metadata:{description:actor.description,tags:actor.tags}};
    definition.characters=definition.characters.filter(a=>a.id!==actor.id).concat(converted);
    for(const cast of casts)if(!cast.displayName||cast.displayName===original.name)cast.displayName=actor.name;
    if(!casts.length){castId=`asset-${crypto.randomUUID()}`;next.manifest.cast.push({castId,displayName:actor.name,characterRef:{packId:origin.packId,id:actor.id}});}else castId=casts[0].castId;
  }else{
    const scene=pack.scenes[0],original=courtroomDemoPack.backgrounds.find(a=>a.id===origin.entityId);if(!original||scene.id!==original.id)throw new Error('内置场景 ID 不可改变。');
    definition.backgrounds=definition.backgrounds.filter(a=>a.id!==scene.id).concat({id:scene.id,label:scene.name,resource:ref(scene.image,original.resource),
      ...(scene.foreground?{foreground:ref(scene.foreground,original.foreground)}:{})});
  }
  metadata.rights[`${pack.kind}/${origin.entityId}`]=pack.rights;
  const used=new Set(Object.values(metadata.resourceOverrides));for(const actor of definition.characters)
    for(const resource of [actor.portraits.base,actor.stage.background,actor.stage.foreground,...actor.poses.map(a=>a.asset),...actor.reactions.map(a=>a.asset)])if(resource?.packId===id)used.add(resource.id);
  for(const scene of definition.backgrounds)for(const resource of [scene.resource,scene.foreground])if(resource?.packId===id)used.add(resource.id);
  item.resources=Object.fromEntries(Object.entries(item.resources).filter(([key])=>used.has(key)));
  next.fileVersion=next.manifest.flow?'0.9':'0.8';return{project:next,castId};
}
