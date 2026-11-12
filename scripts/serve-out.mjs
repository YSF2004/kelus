// Serves the static export in out/ the way Cloudflare does, for e2e against a real build (playwright.static.config.ts).
// Two types matter: .txt must be text/plain, or Next treats every RSC payload as foreign and turns each client-side
// navigation into a full page load; .mjs must be text/javascript, or the PDF worker never starts. Range requests are
// answered so PDF.js can read files in pieces.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "out");
const port = Number(process.argv[3] || 3200);
const types = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
};

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  let file = path.join(root, pathname);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    // trailingSlash: true, as on kelus.me: /today → /today/
    if (!pathname.endsWith("/")) { res.writeHead(308, { Location: `${pathname}/${url.search}` }); return res.end(); }
    file = path.join(file, "index.html");
  }
  if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file += ".html";
  if (!fs.existsSync(file)) {
    const notFound = path.join(root, "404.html");
    res.writeHead(404, { "Content-Type": types[".html"] });
    return fs.existsSync(notFound) ? fs.createReadStream(notFound).pipe(res) : res.end();
  }
  const size = fs.statSync(file).size;
  const type = types[path.extname(file)] || "application/octet-stream";
  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (range) {
    const start = range[1] ? Number(range[1]) : size - Number(range[2]);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": size });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`out/ on http://127.0.0.1:${port}`));
