import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { AssetManifest } from './inventory';
import { FIGMA_TARGET_URL, runDiscoveryAudit } from './inventory';
import { renderProceduralAssets } from './render-assets';
import { runBrowserCaptures } from './capture-browser';
import { validateExportBundle } from './validate';

export async function runExportPipeline(options: {
  rootDir: string;
  outDir?: string;
  force?: boolean;
  skipBrowser?: boolean;
}): Promise<{ manifest: AssetManifest; ok: boolean }> {
  const rootDir = resolve(options.rootDir);
  const outDir = resolve(options.outDir ?? join(rootDir, 'figma-assets'));
  const distDir = resolve(rootDir, 'dist');
  mkdirSync(outDir, { recursive: true });

  console.log('1/4 Discovering Tiny World visual assets & exporting procedural art...');
  const { records, stats: nodeStats } = renderProceduralAssets(rootDir, outDir, { force: options.force });
  console.log(
    `    Node assets: ${nodeStats.exported} exported, ${nodeStats.cached} cached (${nodeStats.filesWritten} files written), ${nodeStats.errors} errors`,
  );

  let allRecords = records;
  let browserIncluded = false;
  if (options.skipBrowser) {
    console.log('2/4 Skipping browser island previews & UI captures (--skip-browser).');
    for (const rec of allRecords) {
      if (rec.status === 'pending') rec.status = 'skipped';
    }
  } else {
    console.log('2/4 Capturing live Stages 1–10 island scenes, UI screens & catalog boards via Chromium...');
    const br = await runBrowserCaptures(distDir, outDir, allRecords);
    allRecords = [...allRecords, ...br.addedRecords];
    browserIncluded = true;
    console.log(
      `    Browser captures: ${br.stats.islandPreviews} island scenes, ${br.stats.uiScreenshots} UI screens, ${br.stats.uiComponents} components, ${br.stats.catalogs} catalog boards`,
    );
  }

  console.log('3/4 Generating unified figma-assets/manifest.json...');
  const byCategory: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let totalFiles = 0;
  for (const r of allRecords) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    totalFiles += r.files.length;
  }

  const manifest: AssetManifest = {
    schemaVersion: 1,
    generator: 'tinyworld-code-to-figma-exporter',
    generatedAt: new Date().toISOString(),
    figmaTargetUrl: FIGMA_TARGET_URL,
    figmaMaxDimensionPx: 4096,
    summary: {
      totalAssets: allRecords.length,
      totalFiles,
      byCategory,
      byStatus,
      browserCapturesIncluded: browserIncluded,
    },
    audit: runDiscoveryAudit(),
    assets: allRecords,
  };

  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log('4/4 Validating exported binaries, pixel accuracy & Figma constraints...');
  const validation = validateExportBundle(outDir, manifest, {
    requireBrowserCaptures: browserIncluded,
  });
  console.log(
    `    Validated ${validation.checkedFiles} files (${validation.verifiedPixelExactCount} pixel-exact matches). Errors: ${validation.errors.length}, Warnings: ${validation.warnings.length}`,
  );
  if (validation.warnings.length > 0) {
    for (const w of validation.warnings) console.warn(`    [warn] ${w}`);
  }
  if (!validation.ok) {
    for (const e of validation.errors) console.error(`    [error] ${e}`);
    return { manifest, ok: false };
  }

  return { manifest, ok: true };
}
