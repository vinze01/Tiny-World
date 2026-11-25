import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname, join, dirname, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const showcaseDir = join(rootDir, 'showcase');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const port = Number(process.env.SHOWCASE_PORT || 3000);

const srv = createServer((req, res) => {
  let cleanUrl;
  try {
    cleanUrl = decodeURIComponent((req.url ?? '/').split('?')[0]);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }
  const rel = cleanUrl === '/' ? 'index.html' : cleanUrl.replace(/^\/+/, '');
  const target = resolve(showcaseDir, rel);
  const fromShowcase = relative(showcaseDir, target);

  if (fromShowcase === '..' || fromShowcase.startsWith(`..${sep}`) || isAbsolute(fromShowcase)
    || !existsSync(target) || !statSync(target).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
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

srv.listen(port, '127.0.0.1', () => {
  console.log(`\n✦ Tiny World Showcase preview server running at:`);
  console.log(`   http://127.0.0.1:${srv.address().port}\n`);
});
