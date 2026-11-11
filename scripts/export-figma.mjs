import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, createServer } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const skipBrowser = args.has('--skip-browser');
const skipBuild = args.has('--no-build');

if (!skipBrowser && (!skipBuild || !existsSync(join(rootDir, 'dist/game.html')))) {
  console.log('Building production extension dist/ for live scene & UI captures...');
  await build({ root: rootDir, configFile: join(rootDir, 'vite.config.ts'), logLevel: 'warn' });
}

const server = await createServer({
  root: rootDir,
  configFile: false,
  logLevel: 'silent',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true },
});

try {
  const mod = await server.ssrLoadModule('/scripts/figma/run.ts');
  const { ok, manifest } = await mod.runExportPipeline({
    rootDir,
    force,
    skipBrowser,
  });
  console.log(
    `\nTinyWorld Figma export ${ok ? 'COMPLETE' : 'FAILED'}: ${manifest.summary.totalAssets} assets (${manifest.summary.totalFiles} files) in figma-assets/`,
  );
  if (!ok) process.exitCode = 1;
} finally {
  await server.close();
}
