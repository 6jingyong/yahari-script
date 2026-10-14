import { validateAssetPack, type AssetPack } from '../../../packages/asset-library/src/index.js';
import { imageBytes, imageDataUrl } from '../../../packages/project-io/src/index.js';

export const ASSET_LIBRARY_DB='yahari:asset-library:v1';
interface AssetRow { id:string; blob:Blob }
interface PackRow { id:string; pack:AssetPack; imageIds:string[]; savedAt:string }
const result=<T>(request:IDBRequest<T>):Promise<T>=>new Promise((resolve,reject)=>{
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});
const done=(transaction:IDBTransaction):Promise<void>=>new Promise((resolve,reject)=>{
  transaction.oncomplete=()=>resolve();transaction.onabort=()=>reject(transaction.error??new Error('素材保存中断。'));transaction.onerror=()=>{};
});

export async function prepareStoredAssetPack(input: AssetPack):Promise<{pack:AssetPack;images:AssetRow[]}> {
  const pack=validateAssetPack(input), images=new Map<string,Blob>(), hashes=new Map<string,string>();
  for (const [key,url] of Object.entries(pack.images)) {
    let hash=hashes.get(url);
    if (!hash) {
      const {mime,bytes}=imageBytes(url), digest=await crypto.subtle.digest('SHA-256',bytes.buffer as ArrayBuffer);
      hash=`${mime}:${Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')}`;
      hashes.set(url,hash);images.set(hash,new Blob([bytes.buffer as ArrayBuffer],{type:mime}));
    }
    pack.images[key]=`asset:${hash}`;
  }
  return {pack,images:Array.from(images,([id,blob])=>({id,blob}))};
}
export async function hydrateStoredAssetPack(stored:AssetPack, images:Map<string,Blob>):Promise<AssetPack> {
  const pack=structuredClone(stored), decoded=new Map<string,string>();
  for (const [key,ref] of Object.entries(pack.images)) {
    if (!ref.startsWith('asset:')) throw new Error('本机素材图片引用无效。');
    const id=ref.slice(6), blob=images.get(id);
    if (!blob) throw new Error('本机素材缺少图片，请从导出的素材包恢复。');
    let url=decoded.get(id);
    if (!url) {url=imageDataUrl(new Uint8Array(await blob.arrayBuffer()),blob.type);decoded.set(id,url);}
    pack.images[key]=url;
  }
  return validateAssetPack(pack);
}

export class AssetLibraryStore {
  private queue:Promise<void>=Promise.resolve();
  constructor(private db:IDBDatabase) {}
  async readSetting<T>(key:string):Promise<T|undefined> {
    await this.queue;return result(this.db.transaction('settings').objectStore('settings').get(key));
  }
  writeSetting(key:string,value:unknown):Promise<void> {
    return this.serial(async()=>{const transaction=this.db.transaction('settings','readwrite'),completed=done(transaction);
      transaction.objectStore('settings').put(structuredClone(value),key);await completed;});
  }
  private serial<T>(work:()=>Promise<T>):Promise<T> {
    const pending=this.queue.then(work);this.queue=pending.then(()=>{},()=>{});return pending;
  }
  async list():Promise<Array<{pack:AssetPack;savedAt:string}>> {
    await this.queue;
    const transaction=this.db.transaction(['packs','images']);
    const [rows,all]=await Promise.all([result<PackRow[]>(transaction.objectStore('packs').getAll()),result<AssetRow[]>(transaction.objectStore('images').getAll())]);
    const images=new Map(all.map(row=>[row.id,row.blob]));
    return Promise.all(rows.sort((a,b)=>b.savedAt.localeCompare(a.savedAt)).map(async row=>({pack:await hydrateStoredAssetPack(row.pack,images),savedAt:row.savedAt})));
  }
  save(input:AssetPack):Promise<void> {
    const snapshot=validateAssetPack(input);
    return this.serial(async()=>{
      const {pack,images}=await prepareStoredAssetPack(snapshot), transaction=this.db.transaction(['packs','images'],'readwrite'),completed=done(transaction);
      void completed.catch(()=>{});
      try {
        transaction.objectStore('packs').put({id:pack.id,pack,imageIds:images.map(row=>row.id),savedAt:new Date().toISOString()} satisfies PackRow);
        for (const image of images) transaction.objectStore('images').put(image);
        await this.prune(transaction);await completed;
      } catch (error) {try{transaction.abort();}catch{}await completed.catch(()=>{});throw error;}
    });
  }
  remove(id:string):Promise<void> {
    return this.serial(async()=>{
      const transaction=this.db.transaction(['packs','images'],'readwrite'),completed=done(transaction);void completed.catch(()=>{});
      try{transaction.objectStore('packs').delete(id);await this.prune(transaction);await completed;}
      catch(error){try{transaction.abort();}catch{}await completed.catch(()=>{});throw error;}
    });
  }
  private async prune(transaction:IDBTransaction):Promise<void> {
    const rows=await result<PackRow[]>(transaction.objectStore('packs').getAll());
    const used=new Set(rows.flatMap(row=>row.imageIds)), images=transaction.objectStore('images');
    const keys=await result(images.getAllKeys());
    for (const key of keys) if (!used.has(String(key))) images.delete(key);
  }
}
export function openAssetLibrary():Promise<AssetLibraryStore> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(ASSET_LIBRARY_DB,2);
    let expired=false;
    const timer=window.setTimeout(()=>{expired=true;reject(new Error('素材库打开超时，请关闭其他旧页面后重试。'));},4000);
    request.onupgradeneeded=()=>{const db=request.result;
      if(!db.objectStoreNames.contains('packs'))db.createObjectStore('packs',{keyPath:'id'});
      if(!db.objectStoreNames.contains('images'))db.createObjectStore('images',{keyPath:'id'});
      if(!db.objectStoreNames.contains('settings'))db.createObjectStore('settings');};
    request.onerror=()=>{window.clearTimeout(timer);reject(new Error('浏览器未能打开独立素材库，请检查网站存储设置。'));};
    request.onsuccess=()=>{
      window.clearTimeout(timer);
      if(expired){request.result.close();return;}
      request.result.onversionchange=()=>request.result.close();resolve(new AssetLibraryStore(request.result));
    };
  });
}
