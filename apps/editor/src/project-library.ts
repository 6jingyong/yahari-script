import type { YahariProjectFile } from '../../../packages/core/src/index.js';
import { imageBytes, imageDataUrl } from '../../../packages/project-io/src/index.js';

export const PROJECT_LIBRARY_DB = 'yahari:project-library:v1';
export const MAX_RESTORE_POINTS = 8;
export interface SavedProject {
  id: string; title: string; savedAt: string; activeDocumentId: string;
  project: YahariProjectFile; assetIds: string[];
}
export interface RestorePoint extends SavedProject { revisionId: string; label: string }
export interface LibraryProject { project: YahariProjectFile; activeDocumentId: string; savedAt: string }
export interface ProjectAsset { id: string; blob: Blob }

export async function prepareStoredProject(project: YahariProjectFile): Promise<{project:YahariProjectFile;assets:ProjectAsset[]}> {
  const stored=structuredClone(project), assets=new Map<string,Blob>(), encoded=new Map<string,string>();
  for (const pack of stored.embeddedPacks ?? []) for (const [id,url] of Object.entries(pack.resources)) {
    let assetId=encoded.get(url);
    if (!assetId) {
      const {mime,bytes}=imageBytes(url);
      const digest=await crypto.subtle.digest('SHA-256',bytes.buffer as ArrayBuffer);
      assetId=`${mime}:${Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')}`;
      encoded.set(url,assetId); assets.set(assetId,new Blob([bytes.buffer as ArrayBuffer],{type:mime}));
    }
    pack.resources[id]=`asset:${assetId}`;
  }
  return {project:stored,assets:Array.from(assets,([id,blob])=>({id,blob}))};
}

export async function hydrateStoredProject(stored: YahariProjectFile, assets: Map<string,Blob>): Promise<YahariProjectFile> {
  const project=structuredClone(stored), urls=new Map<string,string>();
  for (const pack of project.embeddedPacks ?? []) for (const [id,ref] of Object.entries(pack.resources)) {
    if (!ref.startsWith('asset:')) throw new Error('本机作品的图片引用无效。');
    const assetId=ref.slice(6), blob=assets.get(assetId);
    if (!blob) throw new Error('本机作品缺少图片，请从导出的作品文件恢复。');
    let url=urls.get(assetId);
    if (!url) { url=imageDataUrl(new Uint8Array(await blob.arrayBuffer()),blob.type); urls.set(assetId,url); }
    pack.resources[id]=url;
  }
  return project;
}
const request = <T>(value: IDBRequest<T>): Promise<T> => new Promise((resolve,reject)=>{
  value.onsuccess=()=>resolve(value.result); value.onerror=()=>reject(value.error);
});
function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve,reject)=>{
    transaction.oncomplete=()=>resolve(); transaction.onabort=()=>reject(transaction.error ?? new Error('本机保存事务中断。'));
    transaction.onerror=()=>{}; // Abort reports the failure once.
  });
}

export class ProjectLibrary {
  private writes: Promise<void> = Promise.resolve();
  constructor(private db: IDBDatabase) {}
  idle(): Promise<void> { return this.writes; }
  async getSetting(key:string):Promise<unknown> {
    await this.idle(); return request(this.db.transaction('settings').objectStore('settings').get(key));
  }
  setSetting(key:string,value:unknown):Promise<void> {
    return this.enqueue(async()=>{
      const transaction=this.db.transaction('settings','readwrite'),done=transactionDone(transaction);
      transaction.objectStore('settings').put(value,key);await done;
    });
  }
  private enqueue<T>(operation:()=>Promise<T>): Promise<T> {
    const next=this.writes.then(operation); this.writes=next.then(()=>{},()=>{}); return next;
  }
  async list(): Promise<SavedProject[]> {
    await this.idle();
    const rows=await request<SavedProject[]>(this.db.transaction('projects').objectStore('projects').getAll());
    return rows.sort((a,b)=>b.savedAt.localeCompare(a.savedAt));
  }
  async active(): Promise<LibraryProject | null> {
    const id=await request<string|undefined>(this.db.transaction('settings').objectStore('settings').get('active'));
    return id ? this.load(id) : null;
  }
  async load(id: string, revisionId?: string): Promise<LibraryProject | null> {
    await this.idle();
    const transaction=this.db.transaction(['projects','revisions','assets']);
    const record=await request<SavedProject|undefined>(transaction.objectStore(revisionId?'revisions':'projects').get(revisionId ?? id));
    if (!record || record.id!==id) return null;
    const pending=record.assetIds.map(assetId=>request<ProjectAsset|undefined>(transaction.objectStore('assets').get(assetId)));
    const assets=await Promise.all(pending);
    const project=await hydrateStoredProject(record.project,new Map(assets.filter((asset):asset is ProjectAsset=>!!asset).map(asset=>[asset.id,asset.blob])));
    return {project,activeDocumentId:record.activeDocumentId,savedAt:record.savedAt};
  }
  async revisions(id: string): Promise<RestorePoint[]> {
    await this.idle();
    const rows=await request<RestorePoint[]>(this.db.transaction('revisions').objectStore('revisions').index('projectId').getAll(id));
    return rows.sort((a,b)=>b.savedAt.localeCompare(a.savedAt));
  }
  save(project: YahariProjectFile, activeDocumentId: string, checkpoint?: string): Promise<string> {
    const snapshot=structuredClone(project);
    return this.enqueue(async()=>{
      const prepared=await prepareStoredProject(snapshot), savedAt=new Date().toISOString();
      const record: SavedProject = {id:snapshot.manifest.projectId,title:snapshot.manifest.title,savedAt,activeDocumentId,
        project:prepared.project,assetIds:prepared.assets.map(asset=>asset.id)};
      const transaction=this.db.transaction(['projects','revisions','assets','settings'],'readwrite'), done=transactionDone(transaction);
      // Attach a rejection handler immediately, including if a request below aborts.
      void done.catch(()=>{});
      try {
        transaction.objectStore('projects').put(record);
        transaction.objectStore('settings').put(record.id,'active');
        for (const asset of prepared.assets) transaction.objectStore('assets').put(asset);
        if (checkpoint) {
          const history=transaction.objectStore('revisions');
          history.put({...record,revisionId:crypto.randomUUID(),label:checkpoint} satisfies RestorePoint);
          const rows=await request<RestorePoint[]>(history.index('projectId').getAll(record.id));
          rows.sort((a,b)=>b.savedAt.localeCompare(a.savedAt));
          for (const old of rows.slice(MAX_RESTORE_POINTS)) history.delete(old.revisionId);
          await this.pruneAssets(transaction);
        }
        await done; return savedAt;
      } catch(error) {
        try { transaction.abort(); } catch { /* Already completed or aborted. */ }
        await done.catch(()=>{}); throw error;
      }
    });
  }
  private async pruneAssets(transaction: IDBTransaction): Promise<void> {
    const [projects,revisions,keys]=await Promise.all([
      request<SavedProject[]>(transaction.objectStore('projects').getAll()),
      request<RestorePoint[]>(transaction.objectStore('revisions').getAll()),
      request(transaction.objectStore('assets').getAllKeys()),
    ]);
    const used=new Set([...projects,...revisions].flatMap(row=>row.assetIds));
    for (const key of keys) if (!used.has(String(key))) transaction.objectStore('assets').delete(key);
  }
  remove(id: string): Promise<void> {
    return this.enqueue(async()=>{
      const transaction=this.db.transaction(['projects','revisions','assets','settings'],'readwrite'), done=transactionDone(transaction);
      void done.catch(()=>{});
      try {
        transaction.objectStore('projects').delete(id);
        const history=transaction.objectStore('revisions');
        const rows=await request<RestorePoint[]>(history.index('projectId').getAll(id));
        for (const row of rows) history.delete(row.revisionId);
        const active=await request(transaction.objectStore('settings').get('active'));
        if (active===id) transaction.objectStore('settings').delete('active');
        await this.pruneAssets(transaction); await done;
      }catch(error){
        try{transaction.abort();}catch{}
        await done.catch(()=>{});throw error;
      }
    });
  }
}

export function openProjectLibrary(factory: IDBFactory = indexedDB): Promise<ProjectLibrary> {
  return new Promise((resolve,reject)=>{
    let settled=false;
    const opening=factory.open(PROJECT_LIBRARY_DB,1);
    const timeout=setTimeout(()=>{settled=true;reject(new Error('本机作品库未能打开。'));},4000);
    opening.onupgradeneeded=()=>{
      const db=opening.result;
      db.createObjectStore('projects',{keyPath:'id'});
      db.createObjectStore('assets',{keyPath:'id'});
      db.createObjectStore('revisions',{keyPath:'revisionId'}).createIndex('projectId','id');
      db.createObjectStore('settings');
    };
    opening.onsuccess=()=>{
      clearTimeout(timeout);
      if (settled) { opening.result.close(); return; }
      settled=true;
      opening.result.onversionchange=()=>opening.result.close();
      resolve(new ProjectLibrary(opening.result));
    };
    opening.onerror=()=>{clearTimeout(timeout);settled=true;reject(opening.error);};
  });
}
