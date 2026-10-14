import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const root = process.cwd();
const entryHtml = join(root, "apps/editor/index.html");
const entryJs = join(root, "dist/apps/editor/src/main.js");
for (const file of [entryHtml, entryJs, join(root, "apps/editor/styles.css")]) {
  if (!existsSync(file)) throw new Error(`Missing static asset: ${file}`);
}

const visited = new Set();
function walkModule(path) {
  path = normalize(path);
  if (visited.has(path)) return;
  visited.add(path);
  if (!existsSync(path)) throw new Error(`Broken browser module reference: ${path}`);
  const source = readFileSync(path, "utf8");
  const regex = /(?:from\s+|import\s*)["']([^"']+)["']/g;
  for (const match of source.matchAll(regex)) {
    const specifier = match[1];
    if (!specifier?.startsWith(".")) continue;
    walkModule(normalize(join(dirname(path), specifier)));
  }
}
walkModule(entryJs);
walkModule(join(root, 'dist/apps/player/src/main.js'));
for (const file of ['apps/player/index.html','apps/player/styles.css']) if (!existsSync(join(root,file))) throw new Error(`Missing player asset: ${file}`);

const html = readFileSync(entryHtml, "utf8");
if (!html.includes('../../dist/apps/editor/src/main.js')) throw new Error("Editor HTML is not wired to the portable compiled entry module.");
console.log(`Static smoke passed: ${visited.size} browser modules resolved.`);
