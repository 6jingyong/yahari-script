import type { YahariProjectFile, ResourceRef } from '../../../packages/core/src/index.js';
import type { CourtroomContentPack, CourtroomCharacterDefinition } from '../../../packages/adapters/courtroom/src/index.js';
import type { StaticResourcePack } from '../../../packages/presentation/src/index.js';
import { courtroomDemoPack } from '../../../content-packs/courtroom-demo/pack.js';

export type EmbeddedPack = NonNullable<YahariProjectFile['embeddedPacks']>[number];
export const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Validate the supported project-owned subset before installing it in the editor. */
export function embeddedCourtroomPack(item: EmbeddedPack): CourtroomContentPack | null {
  if (item.adapterId !== 'official.courtroom') return null;
  const pack = item.definition as unknown as CourtroomContentPack;
  const validRef = (value: unknown): value is ResourceRef => {
    if (!value || typeof value !== 'object') return false;
    const ref = value as ResourceRef;
    return typeof ref.packId === 'string' && !!ref.packId && typeof ref.id === 'string' && !!ref.id
      && (ref.packId !== item.id || IMAGE_DATA_URL.test(item.resources[ref.id] ?? ''));
  };
  if (pack.id !== item.id || pack.version !== item.version || typeof pack.name !== 'string' || !Array.isArray(pack.characters)
    || !Array.isArray(pack.backgrounds) || !Array.isArray(pack.audio?.sfx) || !Array.isArray(pack.audio?.bgm)
    || !validRef(pack.stageScene) || pack.audio.sfx.length || pack.audio.bgm.length) return null;
  const characterIds = new Set<string>();
  for (const actor of pack.characters) {
    if (!actor || typeof actor.id !== 'string' || !actor.id || characterIds.has(actor.id) || typeof actor.name !== 'string'
      || !validRef(actor.portraits?.base) || !validRef(actor.stage?.background)
      || (actor.stage.foreground !== undefined && !validRef(actor.stage.foreground))
      || !Array.isArray(actor.poses) || !actor.poses.length || !Array.isArray(actor.reactions)) return null;
    characterIds.add(actor.id);
    const actionIds = new Set<string>();
    for (const action of [...actor.poses, ...actor.reactions]) {
      if (!action || typeof action.id !== 'string' || !action.id || actionIds.has(action.id)
        || typeof action.label !== 'string' || !validRef(action.asset)) return null;
      actionIds.add(action.id);
    }
  }
  const backgroundIds = new Set<string>();
  for (const background of pack.backgrounds) {
    if (!background || typeof background.id !== 'string' || !background.id || backgroundIds.has(background.id)
      || typeof background.label !== 'string' || !validRef(background.resource)
      || (background.foreground !== undefined && !validRef(background.foreground))) return null;
    backgroundIds.add(background.id);
  }
  return pack;
}

export function embeddedResources(items: readonly EmbeddedPack[]): StaticResourcePack[] {
  return items.map(item => ({ packId: item.id,
    resources: Object.fromEntries(Object.entries(item.resources).map(([id, url]) => [id, { url }])),
  }));
}

function projectPack(project: YahariProjectFile, kind: 'characters' | 'backgrounds'): EmbeddedPack {
  const packId = `local.${project.manifest.projectId}.${kind}`;
  const name=kind === 'characters' ? '本作品原创角色' : '本作品自有背景';
  let embedded = project.embeddedPacks?.find(item => item.id === packId)
    ?? project.embeddedPacks?.find(item=>item.adapterId==='official.courtroom' && item.definition.name===name && embeddedCourtroomPack(item));
  if (!embedded) {
    const definition: CourtroomContentPack = {
      id: packId, version: '1.0.0', name,
      stageScene: courtroomDemoPack.stageScene, characters: [], backgrounds: [], audio: { sfx: [], bgm: [] },
    };
    embedded = { id: packId, version: definition.version, adapterId: 'official.courtroom',
      definition: definition as unknown as Record<string, unknown>, resources: {} };
    (project.embeddedPacks ??= []).push(embedded);
    project.manifest.contentPacks.push({ id: packId, version: embedded.version });
  }
  return embedded;
}

export function addOriginalCharacter(
  project: YahariProjectFile,
  name: string,
  portrait: string,
  expression?: { label: string; image: string },
): { project: YahariProjectFile; castId: string } {
  if (!name.trim() || !IMAGE_DATA_URL.test(portrait) || (expression && !IMAGE_DATA_URL.test(expression.image))) {
    throw new Error('请填写角色名称并提供有效图片。');
  }
  const next = structuredClone(project);
  next.fileVersion = next.manifest.flow ? '0.9' : '0.8';
  const id = `original-${crypto.randomUUID()}`;
  const embedded = projectPack(next, 'characters');
  const ref = (suffix: string): ResourceRef => ({ packId: embedded.id, id: `character/${id}/${suffix}` });
  const base = ref('normal');
  const character: CourtroomCharacterDefinition = {
    id, name: name.trim(), portraits: { base }, stage: { background: courtroomDemoPack.stageScene },
    poses: [{ id: 'normal', label: '平常', asset: base }], reactions: [],
  };
  embedded.resources[base.id] = portrait;
  if (expression) {
    const other = ref('expression');
    character.reactions.push({ id: 'expression', label: expression.label.trim() || '另一种表情', asset: other });
    embedded.resources[other.id] = expression.image;
  }
  (embedded.definition as unknown as CourtroomContentPack).characters.push(character);
  next.manifest.cast.push({ castId: id, displayName: name.trim(), characterRef: { packId: embedded.id, id } });
  return { project: next, castId: id };
}

export function addOriginalBackground(
  project: YahariProjectFile, name: string, image: string,
): { project: YahariProjectFile; backgroundId: string; resource: ResourceRef } {
  if (!name.trim() || !IMAGE_DATA_URL.test(image)) throw new Error('请填写背景名称并提供有效图片。');
  const next = structuredClone(project);
  next.fileVersion = next.manifest.flow ? '0.9' : '0.8';
  const backgroundId = `original-background-${crypto.randomUUID()}`;
  const embedded = projectPack(next, 'backgrounds');
  const resource = { packId: embedded.id, id: `background/${backgroundId}` };
  embedded.resources[resource.id] = image;
  (embedded.definition as unknown as CourtroomContentPack).backgrounds.push({ id: backgroundId, label: name.trim(), resource });
  return { project: next, backgroundId, resource };
}
