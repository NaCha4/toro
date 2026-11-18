import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../docs/", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary",
  ".webmanifest": "application/manifest+json",
};
const port = Number(process.env.PORT || 4173);
http
  .createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
      const relative =
        pathname.replace(/^\/toro(?=\/)/, "").replace(/^\//, "") ||
        "index.html";
      const target = path.resolve(
        root,
        relative.endsWith("/") ? `${relative}index.html` : relative,
      );
      const within = path.relative(root, target);
      if (within.startsWith("..") || path.isAbsolute(within)) {
        response.writeHead(403).end();
        return;
      }
      const data = await readFile(target);
      response.writeHead(200, {
        "Content-Type":
          types[path.extname(target)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(request.method === "HEAD" ? undefined : data);
    } catch {
      response.writeHead(404).end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Local preview http://127.0.0.1:${port}/toro/`),
  );
