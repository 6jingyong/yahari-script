import type { RichNode, ScriptDocument } from "./types.js";

function sameMarks(a: RichNode, b: RichNode): boolean {
  if (a.type !== "text" || b.type !== "text") return false;
  return JSON.stringify(a.marks ?? []) === JSON.stringify(b.marks ?? []);
}

export function normalizeRichNodes(nodes: RichNode[]): RichNode[] {
  const normalized: RichNode[] = [];

  for (const node of nodes) {
    if (node.type === "text" && node.text.length === 0) continue;

    const previous = normalized.at(-1);
    if (previous && previous.type === "text" && node.type === "text" && sameMarks(previous, node)) {
      previous.text += node.text;
      continue;
    }

    normalized.push(structuredClone(node));
  }

  return normalized;
}

export function normalizeDocument(document: ScriptDocument): ScriptDocument {
  const clone = structuredClone(document);
  clone.blocks = clone.blocks.map((block) =>
    block.type === "dialogue"
      ? { ...block, content: normalizeRichNodes(block.content) }
      : block,
  );
  return clone;
}
