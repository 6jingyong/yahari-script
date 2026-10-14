import type { ProjectManifest, SceneExit } from './types.js';

export interface FlowIssue { code: string; message: string; severity: 'error' | 'warning'; documentId?: string }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 1000): v is string => typeof v === 'string' && !!v.trim() && v.length <= max;

/** Chapter order is the default route for existing linear works. */
export function orderedSceneIds(manifest: ProjectManifest): string[] {
  const ids = new Set(manifest.documents.map(d => d.id));
  return [...new Set([...(manifest.narrative?.chapters.flatMap(c => c.documentIds) ?? []), ...ids])].filter(id => ids.has(id));
}

export function sceneExit(manifest: ProjectManifest, documentId: string): SceneExit {
  const explicit = manifest.flow?.routes.find(r => r.documentId === documentId)?.exit;
  if (explicit) return structuredClone(explicit);
  const order = orderedSceneIds(manifest), index = order.indexOf(documentId);
  if (index < 0) throw new Error('场景不存在。');
  return index + 1 < order.length ? { type: 'next', targetDocumentId: order[index + 1] } : { type: 'ending', title: '故事结束' };
}

export function exitTargets(exit: SceneExit): string[] {
  return exit.type === 'next' ? [exit.targetDocumentId] : exit.type === 'choice' ? exit.options.map(o => o.targetDocumentId) : [];
}

/** Import checks shapes first; graph checks only run on structurally valid routes. */
export function validateFlow(manifest: ProjectManifest): FlowIssue[] {
  const value: unknown = manifest.flow === undefined ? { version: 1, routes: [] } : manifest.flow;
  const issues: FlowIssue[] = [], ids = new Set(manifest.documents.map(d => d.id)), seen = new Set<string>();
  const error = (message: string, documentId?: string) => issues.push({ code: 'project.flow.invalid', severity: 'error', message, documentId });
  if (!record(value) || value.version !== 1 || !Array.isArray(value.routes) || value.routes.length > 1000) {
    error('剧情路线格式不正确。'); return issues;
  }
  for (const route of value.routes) {
    if (!record(route) || !text(route.documentId, 300) || !record(route.exit)) { error('剧情路线缺少场景或出口。'); continue; }
    const id = route.documentId, exit = route.exit;
    if (!ids.has(id) || seen.has(id)) error('剧情路线引用了不存在或重复的场景。', id);
    seen.add(id);
    if (exit.type === 'next') {
      if (!text(exit.targetDocumentId, 300) || !ids.has(exit.targetDocumentId)) error('下一场景不存在。', id);
    } else if (exit.type === 'choice') {
      if (!text(exit.prompt) || !Array.isArray(exit.options) || exit.options.length < 2 || exit.options.length > 8) {
        error('分支需要问题和 2–8 个选项。', id); continue;
      }
      const optionIds = new Set<string>();
      for (const option of exit.options) {
        if (!record(option) || !text(option.id, 300) || optionIds.has(option.id) || !text(option.label, 200)
          || !text(option.targetDocumentId, 300) || !ids.has(option.targetDocumentId)) { error('分支选项缺少文字、唯一 ID 或有效的目标场景。', id); continue; }
        optionIds.add(option.id);
      }
    } else if (exit.type === 'ending') {
      if (!text(exit.title, 200) || (exit.description !== undefined && (typeof exit.description !== 'string' || exit.description.length > 6000))) error('结局标题或说明不正确。', id);
    } else error('不支持的场景出口。', id);
  }
  if (issues.length) return issues;
  const reachable = new Set<string>(), queue = [manifest.entryDocumentId];
  while (queue.length) {
    const id = queue.pop()!;
    if (!ids.has(id) || reachable.has(id)) continue;
    reachable.add(id); queue.push(...exitTargets(sceneExit(manifest, id)));
  }
  for (const id of ids) if (!reachable.has(id)) issues.push({ code: 'project.flow.unreachable', severity: 'warning', message: '这个场景无法从作品开头到达。', documentId: id });
  // Cycles are allowed, but authors should know which reachable scenes cannot lead to any ending.
  const canEnd = new Set([...ids].filter(id => sceneExit(manifest, id).type === 'ending'));
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of ids) if (!canEnd.has(id) && exitTargets(sceneExit(manifest, id)).some(target => canEnd.has(target))) { canEnd.add(id); changed = true; }
  }
  for (const id of reachable) if (!canEnd.has(id)) issues.push({ code: 'project.flow.no-ending', severity: 'warning', message: '这条路线暂时无法到达任何结局。', documentId: id });
  return issues;
}
