import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = normalize(join(fileURLToPath(new URL("..", import.meta.url))));
const port = Number(process.env.PORT ?? 4173);
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

const server = createServer((request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const decoded = decodeURIComponent(url.pathname);
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
}).listen(port, "127.0.0.1", () => {
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/apps/editor/`;
  console.log(`Yahari Script editor: ${url}`);
  if (process.argv.includes("--open")) {
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", `Start-Process -FilePath '${url}'`], {
      stdio: "ignore",
      windowsHide: true,
    });
    child.on("error", (error) => console.error(`Could not open browser: ${error.message}`));
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Close the previous local server and try again.`);
  } else {
    console.error(error.message);
  }
  process.exitCode = 1;
});
