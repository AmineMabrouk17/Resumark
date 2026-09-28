/**
 * Zero-dependency static file server for the exported Next.js site (`out/`).
 *
 * Resumark is a fully client-side app: `npm run build` produces a static
 * bundle, and this server simply hands the files to the browser. It exists to
 * prove there is no backend (PRD §31, AC-09) and to provide `npm start`.
 *
 *   npm run build && npm start           # serves ./out on $PORT (default 4173)
 */

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../out", import.meta.url)));
const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.HOST ?? "127.0.0.1";

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/**
 * Maps a URL pathname to a file inside ROOT, refusing any traversal attempt.
 * Falls back to `index.html` so client-side routes keep working.
 */
async function resolveFile(pathname) {
  const decoded = decodeURIComponent(pathname);
  const candidate = resolve(join(ROOT, normalize(decoded)));
  if (candidate !== ROOT && !candidate.startsWith(ROOT + sep)) return null;

  const targets = [candidate];
  if (!extname(candidate)) {
    targets.push(`${candidate}.html`, join(candidate, "index.html"));
  }

  for (const target of targets) {
    try {
      const info = await stat(target);
      if (info.isFile()) return { path: target, size: info.size };
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

const server = createServer((request, response) => {
  const { pathname } = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  void resolveFile(pathname).then(
    (file) => {
      if (!file) {
        response.writeHead(404, { "content-type": MIME[".txt"] });
        response.end("404 Not Found — did you run `npm run build`?\n");
        return;
      }
      response.writeHead(200, {
        "content-type": MIME[extname(file.path).toLowerCase()] ?? "application/octet-stream",
        "content-length": file.size,
        "cache-control": "no-store",
      });
      createReadStream(file.path).pipe(response);
    },
    (error) => {
      response.writeHead(500, { "content-type": MIME[".txt"] });
      response.end(`500 ${error instanceof Error ? error.message : "Server error"}\n`);
    },
  );
});

server.listen(PORT, HOST, () => {
  console.log(`Resumark (static export) → http://${HOST}:${PORT}`);
});
