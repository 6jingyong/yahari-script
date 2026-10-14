import { decodeProjectFile, type YahariProjectFile } from '../../../packages/core/src/index.js';
import { courtroomAdapter, type CourtroomContentPack } from '../../../packages/adapters/courtroom/src/index.js';
import { courtroomDemoPack, courtroomDemoResources } from '../../../content-packs/courtroom-demo/generated.js';
import { createStaticResourceResolver, type StaticResourcePack } from '../../../packages/presentation/src/index.js';
import { resolveBuiltinOverrides } from '../../editor/src/builtin-assets.js';
import { resolveAudioAssets } from '../../editor/src/builtin-audio-assets.js';
import { embeddedCourtroomPack, embeddedResources } from '../../editor/src/project-assets.js';

export const playerCatalog = { adapters: [courtroomAdapter.manifest], contentPacks: [{ id: courtroomDemoPack.id, version: courtroomDemoPack.version }] };
export function preparePlayerProject(input: unknown, packedImages: Record<string, string> = {}) {
  const checked = decodeProjectFile(input, playerCatalog);
  if (!checked.ok || checked.kind !== 'project') throw new Error('作品文件结构不完整或版本不受支持。');
  if (checked.availability !== 'ready') throw new Error('这部作品需要未安装的演出适配器或素材包。');
  const project: YahariProjectFile = checked.project;
  const overlay = resolveBuiltinOverrides(project.embeddedPacks ?? []);
  const packs: CourtroomContentPack[] = [resolveAudioAssets(overlay.pack, project.manifest.projectSettings)];
  for (const item of project.embeddedPacks ?? []) {
    const pack = embeddedCourtroomPack(item); if (!pack) throw new Error('作品中的素材包不完整。');
    if (!overlay.overlayIds.has(item.id)) packs.push(pack);
  }
  const resources: StaticResourcePack[] = [courtroomDemoResources, ...embeddedResources(project.embeddedPacks ?? []), overlay.resources];
  const portable = resources.map(pack => ({ ...pack, resources: Object.fromEntries(Object.entries(pack.resources).map(([id, image]) => [id, { ...image, url: packedImages[image.url] ?? image.url }])) }));
  const resolver = createStaticResourceResolver(portable), context = { manifest: project.manifest, contentPacks: packs };
  // Validate every route's document before starting, including paths the reader may not choose.
  const plans = new Map(project.documents.map(doc => [doc.documentId, courtroomAdapter.compile(doc, context)]));
  return { project, context, resolver, plans };
}
