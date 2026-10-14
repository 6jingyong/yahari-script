import type { YahariProjectFile } from '../../core/src/index.js';

export const MAX_PROJECT_FILE_BYTES = 32_000_000;
const MAX_ENTRIES = 401;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const imagePattern = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const crcTable = Array.from({length:256}, (_,n) => {
  for (let i=0;i<8;i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
export function imageBytes(url: string): {mime:string; bytes:Uint8Array} {
  const match = imagePattern.exec(url);
  if (!match) throw new Error('作品图片格式无效。');
  const raw = atob(match[2]);
  return {mime:`image/${match[1]}`,bytes:Uint8Array.from(raw,c=>c.charCodeAt(0))};
}
export function imageDataUrl(bytes: Uint8Array, mime: string): string {
  if (!['image/png','image/jpeg','image/webp'].includes(mime)) throw new Error('图片类型不受支持。');
  let raw = '';
  for (let offset=0;offset<bytes.length;offset+=8192) raw += String.fromCharCode(...bytes.subarray(offset,offset+8192));
  return `data:${mime};base64,${btoa(raw)}`;
}
export function projectFileName(title: string, format: 'bundle'|'json' = 'bundle'): string {
  const name = title.trim().replace(/[^\p{L}\p{N}._-]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,100) || 'yahari-project';
  return name + (format==='bundle'?'.yahari':'.yahari-project.json');
}

/** A bounded ZIP STORE container; WebP/JPEG assets are already compressed. */
export function encodeProjectBundle(project: YahariProjectFile): Uint8Array {
  const portable = structuredClone(project);
  const entries = new Map<string,Uint8Array>();
  const images = new Map<string,string>();
  for (const pack of portable.embeddedPacks ?? []) for (const [id,url] of Object.entries(pack.resources)) {
    let path = images.get(url);
    if (!path) {
      const {mime,bytes} = imageBytes(url);
      path = `assets/${String(images.size+1).padStart(4,'0')}.${mime.slice(6)}`;
      images.set(url,path); entries.set(path,bytes);
    }
    pack.resources[id] = `archive:${path}`;
  }
  entries.set('project.json',encoder.encode(JSON.stringify({format:'yahari-bundle',version:1,project:portable})));
  return encodeArchiveEntries(entries);
}

/** Shared bounded archive codec for project and independent asset files. */
export function encodeArchiveEntries(entries: Map<string,Uint8Array>): Uint8Array {
  if (entries.size>MAX_ENTRIES) throw new Error('作品中的图片数量超出文件限制。');
  let localSize=0, centralSize=0;
  for (const [name,bytes] of entries) { localSize+=30+encoder.encode(name).length+bytes.length; centralSize+=46+encoder.encode(name).length; }
  const size=localSize+centralSize+22;
  if (size>MAX_PROJECT_FILE_BYTES) throw new Error('作品文件超过 32 MB，请减少图片或拆分作品。');
  const output = new Uint8Array(size), view = new DataView(output.buffer);
  let local=0, central=localSize;
  for (const [name,bytes] of entries) {
    const filename=encoder.encode(name), checksum=crc(bytes);
    view.setUint32(local,0x04034b50,true); view.setUint16(local+4,20,true); view.setUint16(local+6,0x800,true);
    view.setUint32(local+14,checksum,true); view.setUint32(local+18,bytes.length,true); view.setUint32(local+22,bytes.length,true);
    view.setUint16(local+26,filename.length,true); output.set(filename,local+30); output.set(bytes,local+30+filename.length);
    view.setUint32(central,0x02014b50,true); view.setUint16(central+4,20,true); view.setUint16(central+6,20,true); view.setUint16(central+8,0x800,true);
    view.setUint32(central+16,checksum,true); view.setUint32(central+20,bytes.length,true); view.setUint32(central+24,bytes.length,true);
    view.setUint16(central+28,filename.length,true); view.setUint32(central+42,local,true); output.set(filename,central+46);
    local+=30+filename.length+bytes.length; central+=46+filename.length;
  }
  view.setUint32(central,0x06054b50,true); view.setUint16(central+8,entries.size,true); view.setUint16(central+10,entries.size,true);
  view.setUint32(central+12,centralSize,true); view.setUint32(central+16,localSize,true);
  return output;
}

export function decodeArchiveEntries(bytes: Uint8Array, manifest: 'project.json'|'asset-pack.json' = 'project.json'): Map<string,Uint8Array> {
  const invalid = (): never => { throw new Error('作品包损坏或格式不受支持，请重新导出 .yahari 文件。'); };
  if (bytes.length<22 || bytes.length>MAX_PROJECT_FILE_BYTES) return invalid();
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), end=bytes.length-22;
  if (view.getUint32(end,true)!==0x06054b50 || view.getUint16(end+4,true) || view.getUint16(end+6,true) || view.getUint16(end+20,true)) return invalid();
  const count=view.getUint16(end+10,true), centralSize=view.getUint32(end+12,true), centralStart=view.getUint32(end+16,true);
  if (!count || count>MAX_ENTRIES || view.getUint16(end+8,true)!==count || centralStart+centralSize!==end) return invalid();
  const entries = new Map<string,Uint8Array>();
  let central=centralStart, expectedLocal=0;
  for (let i=0;i<count;i++) {
    if (central+46>end || view.getUint32(central,true)!==0x02014b50) return invalid();
    const flags=view.getUint16(central+8,true), method=view.getUint16(central+10,true), size=view.getUint32(central+24,true);
    const nameLength=view.getUint16(central+28,true), extra=view.getUint16(central+30,true), comment=view.getUint16(central+32,true), local=view.getUint32(central+42,true);
    if (flags!==0x800 || method!==0 || extra || comment || view.getUint16(central+34,true) || size!==view.getUint32(central+20,true)
      || central+46+nameLength>end || local!==expectedLocal || local+30>centralStart) return invalid();
    let name: string;
    try { name=decoder.decode(bytes.subarray(central+46,central+46+nameLength)); } catch { return invalid(); }
    if (!(name===manifest || /^assets\/[0-9]{4}\.(?:png|jpeg|webp)$/.test(name)) || entries.has(name)) return invalid();
    if (view.getUint32(local,true)!==0x04034b50 || view.getUint16(local+6,true)!==flags || view.getUint16(local+8,true)!==method
      || view.getUint16(local+26,true)!==nameLength || view.getUint16(local+28,true)!==0
      || view.getUint32(local+18,true)!==size || view.getUint32(local+22,true)!==size) return invalid();
    const start=local+30+nameLength;
    if (start+size>centralStart || decoder.decode(bytes.subarray(local+30,start))!==name) return invalid();
    const data=bytes.subarray(start,start+size), checksum=crc(data);
    if (checksum!==view.getUint32(central+16,true) || checksum!==view.getUint32(local+14,true)) return invalid();
    entries.set(name,data); expectedLocal=start+size; central+=46+nameLength;
  }
  if (central!==end || expectedLocal!==centralStart || !entries.has(manifest)) return invalid();
  return entries;
}

export function decodeProjectBundle(bytes: Uint8Array): unknown {
  const invalid = (): never => { throw new Error('作品包损坏或格式不受支持，请重新导出 .yahari 文件。'); };
  const entries = decodeArchiveEntries(bytes);
  let wrapper: {format?:unknown;version?:unknown;project?:YahariProjectFile};
  try { wrapper=JSON.parse(decoder.decode(entries.get('project.json')!)); } catch { return invalid(); }
  if (wrapper?.format!=='yahari-bundle' || wrapper.version!==1 || !wrapper.project || !Array.isArray(wrapper.project.documents)) return invalid();
  const project=wrapper.project;
  if (project.embeddedPacks!==undefined && (!Array.isArray(project.embeddedPacks) || project.embeddedPacks.length>4)) return invalid();
  const used=new Set(['project.json']);
  const assetUrls=new Map<string,string>();
  let expandedCharacters=0;
  for (const pack of project.embeddedPacks ?? []) {
    if (!pack || !pack.resources || typeof pack.resources!=='object' || Array.isArray(pack.resources)) return invalid();
    if(Object.keys(pack.resources).length>100)return invalid();
    for (const [id,ref] of Object.entries(pack.resources)) {
      if (typeof ref!=='string' || !/^archive:assets\/[0-9]{4}\.(png|jpeg|webp)$/.test(ref)) return invalid();
      const path=ref.slice(8), asset=entries.get(path);
      if (!asset) return invalid();
      const mime=`image/${path.split('.').pop()}`;
      expandedCharacters+=Math.ceil(asset.length/3)*4+`data:${mime};base64,`.length;
      if(expandedCharacters>20_000_000)return invalid();
      let url=assetUrls.get(path);
      if(!url){url=imageDataUrl(asset,mime);assetUrls.set(path,url);}
      used.add(path); pack.resources[id]=url;
    }
  }
  if (used.size!==entries.size) return invalid();
  return project; // Core decoding remains the activation gate.
}

export async function readProjectInput(file: Blob): Promise<unknown> {
  if (file.size>MAX_PROJECT_FILE_BYTES) throw new Error('文件超过 32 MB，请选择较小的作品文件。');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if (bytes[0]===0x50 && bytes[1]===0x4b) return decodeProjectBundle(bytes);
  try { return JSON.parse(decoder.decode(bytes).replace(/^\uFEFF/,'')); }
  catch { throw new Error('无法读取文件，请选择 .yahari 或 .yahari-project.json。'); }
}

export function projectBlob(project: YahariProjectFile, format: 'bundle'|'json'='bundle'): Blob {
  return format==='bundle' ? new Blob([encodeProjectBundle(project).buffer as ArrayBuffer],{type:'application/zip'})
    : new Blob([JSON.stringify(project,null,2)],{type:'application/json'});
}
