import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../..');
const galleryDir = join(rootDir, 'tools/asset-gallery');
const assetsDir = join(rootDir, 'figma-assets');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.apng': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
};

const port = Number(process.env.GALLERY_PORT || 4178);
const host = process.env.GALLERY_HOST || '127.0.0.1';

export function startGalleryServer(listenPort = port, listenHost = host) {
  const srv = createServer((req, res) => {
    const cleanUrl = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (cleanUrl === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, hasManifest: existsSync(join(assetsDir, 'manifest.json')) }));
      return;
    }

    let target;
    if (cleanUrl.startsWith('/assets/')) {
      const rel = cleanUrl.slice('/assets/'.length).replace(/^\/+/, '');
      target = resolve(assetsDir, rel);
      if (!target.startsWith(assetsDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
    } else {
      const rel = cleanUrl === '/' ? 'index.html' : cleanUrl.replace(/^\/+/, '');
      target = resolve(galleryDir, rel);
      if (!target.startsWith(galleryDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
    }

    if (!existsSync(target) || statSync(target).isDirectory()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = extname(target).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(readFileSync(target));
  });

  return new Promise((resolvePromise, reject) => {
    srv.on('error', reject);
    srv.listen(listenPort, listenHost, () => {
      const addr = srv.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : listenPort;
      resolvePromise({ srv, url: `http://${listenHost}:${actualPort}` });
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { url } = await startGalleryServer();
  console.log(`Tiny World Local Asset Gallery running at ${url}`);
  if (!existsSync(join(assetsDir, 'manifest.json'))) {
    console.warn('Note: figma-assets/manifest.json not found yet. Run "npm run export:figma" first.');
  }
}
