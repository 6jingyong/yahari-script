import type { YahariProjectFile } from '../../../packages/core/src/index.js';
import { preparePlayerProject } from '../../player/src/project.js';
import { collectSceneAssets } from './preview-scene.js';

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
async function readText(url: string): Promise<string> { const response = await fetch(url); if (!response.ok) throw new Error('播放器文件读取失败，请重新构建本地版后重试。'); return response.text(); }
function base64(text: string): string {
  const bytes = new TextEncoder().encode(text); let result = '';
  for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(result);
}
async function imageData(url: string): Promise<string> {
  if (url.startsWith('data:image/')) return url;
  const response = await fetch(url); if (!response.ok) throw new Error('作品所需图像读取失败，尚未导出。');
  const blob = await response.blob();
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('图像打包失败。')); reader.readAsDataURL(blob); });
}

/** Self-contained HTML with local module imports and all used raster images. */
export async function standalonePlayerHtml(project: YahariProjectFile): Promise<string> {
  const prepared = preparePlayerProject(project);
  const urls = [...new Set([...prepared.plans.values()].flatMap(plan => collectSceneAssets(plan.instructions, project.manifest, { packs: prepared.context.contentPacks, resolver: prepared.resolver })))];
  const packedImages: Record<string, string> = {};
  for (let i = 0; i < urls.length; i += 6) await Promise.all(urls.slice(i, i + 6).map(async url => { packedImages[url] = await imageData(url); }));
  const modules = new Map<string, { id: string; source: string }>();
  const pattern = /(?:\bfrom\s*|\bimport\s*)(['"])([^'"]+)\1/g;
  async function visit(url: string): Promise<string> {
    const found = modules.get(url); if (found) return found.id;
    const entry = { id: `yahari-player/module-${modules.size}`, source: '' }; modules.set(url, entry);
    const source = await readText(url), dependencies = [...source.matchAll(pattern)].filter(match => match[2].startsWith('.'));
    const ids = new Map<string, string>();
    for (const match of dependencies) ids.set(match[2], await visit(new URL(match[2], url).href));
    entry.source = source.replace(pattern, (whole, quote: string, specifier: string) => ids.has(specifier) ? whole.replace(`${quote}${specifier}${quote}`, `${quote}${ids.get(specifier)}${quote}`) : whole);
    return entry.id;
  }
  const entryId = await visit(new URL('../../dist/apps/player/src/runtime.js', location.href).href);
  const styles = await Promise.all(['./styles.css', '../player/styles.css'].map(path => readText(new URL(path, location.href).href)));
  const imports = Object.fromEntries([...modules.values()].map(entry => [entry.id, `data:text/javascript;base64,${base64(entry.source)}`]));
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${escapeHtml(project.manifest.title)}</title><style>${styles.join('\n').replace(/<\/style/gi, '<\\/style')}</style><script type="importmap">${safeJson({ imports })}</script></head><body class="player-page"><main id="player-root" class="player-root"></main><script type="application/json" id="yahari-work">${safeJson({ project, packedImages })}</script><script type="module">import { mountPlayer } from ${safeJson(entryId)};const data=JSON.parse(document.getElementById('yahari-work').textContent);try{mountPlayer(document.getElementById('player-root'),data.project,data.packedImages);}catch(error){document.getElementById('player-root').textContent=error.message;}</script></body></html>`;
}
export async function downloadStandalonePlayer(project: YahariProjectFile): Promise<void> {
  const html = await standalonePlayerHtml(project), url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${project.manifest.title.replace(/[\\/:*?"<>|]/g, '_')}.html`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
