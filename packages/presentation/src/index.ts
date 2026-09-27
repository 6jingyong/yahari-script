import type { ResourceRef } from "../../core/src/index.js";

export type ImageFrame = readonly [number, number, number, number];
export type ColorKey = "magenta";

export interface ImageResourceDescriptor {
  url: string;
  frame?: ImageFrame;
  colorKey?: ColorKey;
}

export interface StaticResourcePack {
  packId: string;
  resources: Record<string, ImageResourceDescriptor>;
}

export interface ResolvedImageResource extends ImageResourceDescriptor {
  ref: ResourceRef;
}

export interface ResourceResolver {
  resolve(ref: ResourceRef): ResolvedImageResource | undefined;
  findByUrl(url: string): ResolvedImageResource | undefined;
}

function key(ref: ResourceRef): string {
  return `${ref.packId}::${ref.id}`;
}

export function sameResource(a: ResourceRef | undefined, b: ResourceRef | undefined): boolean {
  return !!a && !!b && a.packId === b.packId && a.id === b.id;
}

export function createStaticResourceResolver(packs: readonly StaticResourcePack[]): ResourceResolver {
  const byRef = new Map<string, ResolvedImageResource>();
  const byUrl = new Map<string, ResolvedImageResource>();

  for (const pack of packs) {
    for (const [id, descriptor] of Object.entries(pack.resources)) {
      const resolved: ResolvedImageResource = {
        ...descriptor,
        ref: { packId: pack.packId, id },
      };
      byRef.set(key(resolved.ref), resolved);
      if (!byUrl.has(resolved.url)) byUrl.set(resolved.url, resolved);
    }
  }

  return {
    resolve(ref) {
      return byRef.get(key(ref));
    },
    findByUrl(url) {
      return byUrl.get(url);
    },
  };
}
