import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CREATURES, ITEMS, PLANTS, STAGES } from '../src/core/catalog';
import { drawPipkin, FRAME_DEFS } from '../src/art/creatures';
import { FX_BUILDERS, ITEM_BUILDERS, ROTATED_BUILDERS } from '../src/art/atlas';
import { buildIsland } from '../src/art/island';
import { plantSprite } from '../src/art/plants';
import {
  computeSafeIntegerScale,
  crispPixelSvg,
  decodePng,
  encodeApng,
  encodeGif,
  encodePng,
  pixelsMatch,
  scaleNearest,
} from '../scripts/figma/codecs';
import { buildPlannedInventory, runDiscoveryAudit } from '../scripts/figma/inventory';
import { renderProceduralAssets } from '../scripts/figma/render-assets';
import { buildTokensBundle } from '../scripts/figma/tokens';
import { validateExportBundle } from '../scripts/figma/validate';

const rootDir = resolve(__dirname, '..');
const tempDirs: string[] = [];

afterAll(() => {
  for (const d of tempDirs) {
    rmSync(d, { recursive: true, force: true });
  }
});

describe('Code-to-Figma codecs', () => {
  it('round-trips RGBA sprites pixel-identically via PNG and nearest-neighbor scaling', () => {
    const native = drawPipkin(CREATURES[0].id, FRAME_DEFS.idle[0]);
    const pngBytes = encodePng(native);
    const decoded = decodePng(pngBytes);
    expect(pixelsMatch(native, { w: decoded.w, h: decoded.h, d: decoded.d }).ok).toBe(true);

    const x4 = scaleNearest(native, 4);
    expect(x4.w).toBe(native.w * 4);
    expect(x4.h).toBe(native.h * 4);
    const dec4 = decodePng(encodePng(x4));
    expect(pixelsMatch(x4, { w: dec4.w, h: dec4.h, d: dec4.d }).ok).toBe(true);
  });

  it('produces valid animated APNG and lossless palette GIF89a for small sprites', () => {
    const creatureFrames = FRAME_DEFS.happy.map((pose) => ({
      surface: scaleNearest(drawPipkin(CREATURES[1].id, pose), 2),
      delayMs: 140,
    }));

    const apng = encodeApng(creatureFrames, 0);
    const decApng = decodePng(apng);
    expect(decApng.chunks).toContain('acTL');
    expect(decApng.chunks).toContain('fcTL');
    expect(decApng.chunks).toContain('fdAT');

    const creatureGif = encodeGif(creatureFrames, 0);
    expect(creatureGif.uniqueColors).toBeLessThanOrEqual(255);
    expect(Buffer.from(creatureGif.bytes.subarray(0, 6)).toString('ascii')).toBe('GIF89a');
    expect(creatureGif.bytes[creatureGif.bytes.length - 1]).toBe(0x3b);
    expect(Buffer.from(creatureGif.bytes).includes(Buffer.from('NETSCAPE2.0', 'ascii'))).toBe(true);

    // Hard-alpha flame frames maintain strictly lossless GIF palette + binary alpha
    const flameFrames = [FX_BUILDERS['fx:flame0'](), FX_BUILDERS['fx:flame1']()].map((f) => ({
      surface: scaleNearest(f.pix, 2),
      delayMs: 180,
    }));
    const flameGif = encodeGif(flameFrames, 0);
    expect(flameGif.lossless).toBe(true);
    expect(flameGif.uniqueColors).toBeLessThanOrEqual(255);
  });

  it('produces crisp rectangular SVG pixel grids without smoothing and respects 4096px scale caps', () => {
    const spr = plantSprite(PLANTS[0].id, 4);
    const svg = crispPixelSvg(spr.pix, 4);
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('<rect ');
    expect(computeSafeIntegerScale(1250, 900, 4, 4096)).toBe(3);
    expect(computeSafeIntegerScale(28, 28, 4, 4096)).toBe(4);
  });
});

describe('Dynamic discovery & catalog parity', () => {
  it('discovers all CREATURES, PLANTS, ITEMS, ROTATED_BUILDERS, and STAGES with zero gaps', () => {
    const audit = runDiscoveryAudit();
    expect(audit.creatureCount).toBe(CREATURES.length);
    expect(audit.plantCount).toBe(PLANTS.length);
    expect(audit.itemCount).toBe(ITEMS.length);
    expect(audit.stageCount).toBe(STAGES.length);
    expect(audit.missingItemBuilders).toEqual([]);
    expect(audit.missingRotatedBuilders).toEqual([]);
    expect(audit.missingSeedColors).toEqual([]);
    expect(audit.missingFxBuilders).toEqual([]);

    const planned = buildPlannedInventory();
    const plannedIds = new Set(planned.map((r) => r.id));
    for (const item of ITEMS) {
      expect(ITEM_BUILDERS[item.id]).toBeTypeOf('function');
      expect(plannedIds.has(`item:${item.id}`)).toBe(true);
      if (ROTATED_BUILDERS[item.id]) {
        expect(plannedIds.has(`item:${item.id}:rot1`)).toBe(true);
      }
    }
    for (const stage of STAGES) {
      expect(plannedIds.has(`island-stage:${stage.id}`)).toBe(true);
      expect(buildIsland(stage.id, 0, stage.biome).pix.w).toBeLessThanOrEqual(4096);
    }
  });

  it('extracts live design tokens and SVG UI specimens from theme.css & art modules', () => {
    const bundle = buildTokensBundle(rootDir);
    const tok = bundle.designTokens as {
      color: { ui: Record<string, { $value: string }>; creatures: Record<string, unknown>; biomes: Record<string, unknown> };
      isometric: { tileWidthPx: number; tileHeightPx: number };
    };
    expect(tok.color.ui.cream.$value).toMatch(/^#/);
    expect(Object.keys(tok.color.creatures).length).toBe(CREATURES.length);
    expect(Object.keys(tok.color.biomes).length).toBe(10);
    expect(tok.isometric.tileWidthPx).toBe(32);
    expect(tok.isometric.tileHeightPx).toBe(16);
    expect(bundle.componentSvgs.length).toBeGreaterThanOrEqual(5);
  });
});

describe('End-to-end procedural exporter & cache', () => {
  it('exports procedural assets to an isolated folder, passes validation, and reuses SHA cache on re-run', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'tw-figma-test-'));
    tempDirs.push(tmp);
    mkdirSync(tmp, { recursive: true });

    const first = renderProceduralAssets(rootDir, tmp, { force: true });
    expect(first.stats.errors).toBe(0);
    expect(first.stats.exported).toBeGreaterThan(200);
    expect(existsSync(join(tmp, 'design-tokens.json'))).toBe(true);
    expect(existsSync(join(tmp, 'ui/components/tw-panel.svg'))).toBe(true);

    // Mark browser-only entries as skipped as --skip-browser does, then run full validator
    for (const r of first.records) {
      if (r.status === 'pending') r.status = 'skipped';
    }
    const manifest = {
      schemaVersion: 1,
      generator: 'test',
      generatedAt: new Date().toISOString(),
      figmaTargetUrl: 'https://www.figma.com/design/TCEjXAmLGD0mgNZc4nbWW0/Untitled',
      figmaMaxDimensionPx: 4096,
      summary: {
        totalAssets: first.records.length,
        totalFiles: 0,
        byCategory: {},
        byStatus: {},
        browserCapturesIncluded: false,
      },
      audit: runDiscoveryAudit(),
      assets: first.records,
    };
    const report = validateExportBundle(tmp, manifest, { requireBrowserCaptures: false });
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.verifiedPixelExactCount).toBeGreaterThan(150);

    // Second run with cache enabled should cache all procedural sprite entries without re-writing
    const second = renderProceduralAssets(rootDir, tmp, { force: false });
    expect(second.stats.errors).toBe(0);
    expect(second.stats.cached).toBeGreaterThan(200);
    const rotPng = join(tmp, 'buildings/windmill-rot1.png');
    expect(existsSync(rotPng)).toBe(true);
    expect(decodePng(new Uint8Array(readFileSync(rotPng))).w).toBeGreaterThan(0);
  }, 30000);
});
