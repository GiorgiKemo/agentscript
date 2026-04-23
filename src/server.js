import fs from "node:fs";
import path from "node:path";
import http from "node:http";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".awuib": "application/octet-stream",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

function resolveRequest(rootDir, urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  const relativePath = cleanPath === "/" ? "index.html" : cleanPath.replace(/^\/+/, "");
  const resolvedPath = path.resolve(rootDir, relativePath);
  const normalizedRoot = path.resolve(rootDir);

  if (!resolvedPath.startsWith(normalizedRoot)) {
    return null;
  }

  return resolvedPath;
}

function createServer(rootDir, port) {
  return http.createServer((request, response) => {
    const targetPath = resolveRequest(rootDir, request.url ?? "/");
    if (!targetPath) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    fs.readFile(targetPath, (error, file) => {
      if (error) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      const extension = path.extname(targetPath).toLowerCase();
      response.writeHead(200, {
        "Content-Type": MIME_TYPES[extension] ?? "application/octet-stream",
        "Cache-Control": "no-store"
      });
      response.end(file);
    });
  }).listen(port, "127.0.0.1", () => {
    console.log(`AgentScript preview server running at http://127.0.0.1:${port}`);
    console.log(`Serving files from ${path.resolve(rootDir)}`);
  });
}

const [, , rootDirArg = "dist", portArg = "4173"] = process.argv;
const rootDir = path.resolve(rootDirArg);
const port = Number(portArg);

if (!Number.isInteger(port) || port <= 0) {
  console.error(`Invalid port "${portArg}"`);
  process.exit(1);
}

if (!fs.existsSync(rootDir)) {
  console.error(`Directory does not exist: ${rootDir}`);
  process.exit(1);
}

createServer(rootDir, port);
