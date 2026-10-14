import { createReadStream, existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createChatGptBridge, openAccountStore } from './chatgpt-account.mjs';

const root = normalize(join(fileURLToPath(new URL("..", import.meta.url))));
const port = Number(process.env.PORT ?? 4173);
const localUrl = `http://127.0.0.1:${port}`;
const editorUrl = `${localUrl}/apps/editor/`;
const instanceToken = randomBytes(24).toString("hex");
const replacePrevious = process.argv.includes("--replace");
const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
]);

let server;
let accountBridge;
async function handleRequest(request, response) {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (accountBridge && await accountBridge.handle(request, response, url)) return;
    if (url.pathname.startsWith('/api/chatgpt/')) {
      response.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ error: '本地 ChatGPT 账户服务无法启动，请检查启动窗口。' }));
      return;
    }
    if (url.pathname === "/__yahari/instance" && request.method === "GET") {
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ kind: "yahari-script-local", root: resolve(root), token: instanceToken }));
      return;
    }
    if (url.pathname === "/__yahari/shutdown" && request.method === "POST") {
      if (request.headers["x-yahari-instance"] !== instanceToken) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      response.writeHead(204).end();
      response.on("finish", () => {
        server.close();
        server.closeAllConnections();
      });
      return;
    }
    const decoded = decodeURIComponent(url.pathname);
    if (decoded.split(/[\\/]/).some(part => part.startsWith('.'))) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    let path = normalize(join(root, decoded));
    if (!path.startsWith(root)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    if (existsSync(path) && statSync(path).isDirectory()) path = join(path, "index.html");
    if (!existsSync(path) || !statSync(path).isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": mime.get(extname(path).toLowerCase()) ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    createReadStream(path).pipe(response);
  } catch (error) {
    response.writeHead(500).end(error instanceof Error ? error.message : String(error));
  }
}

function openBrowser() {
  if (process.argv.includes("--open")) {
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", `Start-Process -FilePath '${editorUrl}'`], {
      stdio: "ignore",
      windowsHide: true,
    });
    child.on("error", (error) => console.error(`Could not open browser: ${error.message}`));
  }
}

async function probe(path) {
  try {
    return await fetch(`${localUrl}${path}`, { signal: AbortSignal.timeout(1800), redirect: "error" });
  } catch { return null; }
}

async function replaceExisting() {
  const response = await probe("/__yahari/instance");
  if (response?.ok) {
    let instance;
    try { instance = await response.json(); } catch { /* Ignore malformed replies. */ }
    if (instance?.kind === "yahari-script-local"
      && typeof instance.root === "string"
      && instance.root.toLowerCase() === resolve(root).toLowerCase()
      && typeof instance.token === "string") {
      try {
        const stopped = await fetch(`${localUrl}/__yahari/shutdown`, {
          method: "POST",
          headers: { "X-Yahari-Instance": instance.token },
          signal: AbortSignal.timeout(1800),
        });
        if (stopped.status === 204) {
          console.log("Previous Yahari Script server stopped; starting the refreshed version...");
          return "retry";
        }
      } catch { return "retry"; }
    }
    return "occupied";
  }

  // Servers from earlier releases lack the handoff endpoint. They serve the
  // freshly built files from disk, so reuse that address for this one launch.
  const legacy = await probe("/apps/editor/");
  if (legacy?.ok && (await legacy.text()).includes("<title>矢张剧本 · Yahari Script</title>")) {
    const marker = randomBytes(16).toString("hex");
    const markerDir = join(root, "work");
    const markerPath = join(markerDir, `.yahari-handoff-${marker}`);
    try {
      mkdirSync(markerDir, { recursive: true });
      writeFileSync(markerPath, marker);
      const check = await probe(`/work/.yahari-handoff-${marker}`);
      if (check?.ok && (await check.text()) === marker) {
        console.log(`Yahari Script is already running at ${editorUrl}; opening it.`);
        openBrowser();
        return "reused";
      }
    } catch { /* A legacy server that cannot prove its root is left alone. */ }
    finally { try { unlinkSync(markerPath); } catch { /* Marker was not created. */ } }
  }
  return "occupied";
}

async function listenOnce() {
  if (!accountBridge) {
    try { accountBridge = createChatGptBridge({ origin: localUrl, store: await openAccountStore(join(root, '.local', 'chatgpt')) }); }
    catch { console.error('ChatGPT account storage could not be opened. The editor remains available.'); }
  }
  server = createServer(handleRequest);
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, "127.0.0.1", resolveListen);
  });
  console.log(`Yahari Script editor: ${editorUrl}`);
  openBrowser();
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 40 && !ready; attempt++) {
    try {
      await listenOnce();
      ready = true;
    } catch (error) {
      if (error.code !== "EADDRINUSE" || !replacePrevious) throw error;
      if (attempt === 0) {
        const result = await replaceExisting();
        if (result === "reused") { ready = true; break; }
        if (result !== "retry") throw new Error(`Port ${port} belongs to another process. Close it before starting Yahari Script.`);
      }
      await new Promise(resolveWait => setTimeout(resolveWait, 150));
    }
  }
  if (!ready) throw new Error(`Port ${port} did not become available after stopping the previous server.`);
} catch (error) {
  console.error(error.code === "EADDRINUSE"
    ? `Port ${port} is already in use. Launch with --replace to hand off a previous Yahari Script server.`
    : error.message);
  process.exitCode = 1;
}
