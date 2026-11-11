import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PlantId } from '../../src/core/types';
import { CREATURES, ITEMS, PLANTS, STAGES } from '../../src/core/catalog';
import { FRAME_DEFS, drawPipkin } from '../../src/art/creatures';
import { ITEM_BUILDERS, ROTATED_BUILDERS, SEED_COL, seedBag } from '../../src/art/atlas';
import { plantSprite } from '../../src/art/plants';
import {
  decodePng,
  hasTransparency,
  pixelsMatch,
  scaleNearest,
  type PixelSurface,
} from './codecs';
import type { AssetManifest } from './inventory';

export interface ValidationReport {
  ok: boolean;
  checkedFiles: number;
  verifiedPixelExactCount: number;
  errors: string[];
  warnings: string[];
}

export function validateExportBundle(
  outDir: string,
  manifest: AssetManifest,
  options: { requireBrowserCaptures?: boolean } = {},
): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  let checkedFiles = 0;
  let verifiedPixelExactCount = 0;

  // 1. Audit completeness
  if (manifest.audit.missingItemBuilders.length > 0) {
    errors.push(`Missing ITEM_BUILDERS for: ${manifest.audit.missingItemBuilders.join(', ')}`);
  }
  if (manifest.audit.extraItemBuilders.length > 0) {
    warnings.push(`Extra ITEM_BUILDERS not in catalog ITEMS: ${manifest.audit.extraItemBuilders.join(', ')}`);
  }
  if (manifest.audit.missingRotatedBuilders.length > 0) {
    errors.push(`Missing ROTATED_BUILDERS for rotatable items: ${manifest.audit.missingRotatedBuilders.join(', ')}`);
  }
  if (manifest.audit.missingSeedColors.length > 0) {
    errors.push(`Missing SEED_COL for plants: ${manifest.audit.missingSeedColors.join(', ')}`);
  }
  if (manifest.audit.missingFxBuilders.length > 0) {
    errors.push(`Missing FX_BUILDERS: ${manifest.audit.missingFxBuilders.join(', ')}`);
  }

  // 2. Duplicate checks
  const seenIds = new Set<string>();
  const seenFiles = new Set<string>();
  for (const rec of manifest.assets) {
    if (seenIds.has(rec.id)) errors.push(`Duplicate asset id: ${rec.id}`);
    seenIds.add(rec.id);

    if (rec.status === 'error') {
      errors.push(`Asset ${rec.id} failed export: ${rec.error ?? 'unknown error'}`);
    }
    if (rec.status === 'pending') {
      errors.push(`Asset ${rec.id} remained in pending status`);
    }
    if (rec.status === 'skipped') {
      if (options.requireBrowserCaptures) {
        errors.push(`Asset ${rec.id} was skipped while browser captures were required`);
      }
      continue;
    }

    for (const f of rec.files) {
      if (seenFiles.has(f.path)) {
        errors.push(`Duplicate output file path referenced in manifest: ${f.path}`);
      }
      seenFiles.add(f.path);
      const abs = join(outDir, f.path);
      if (!existsSync(abs)) {
        errors.push(`Missing exported file on disk: ${f.path}`);
        continue;
      }
      const buf = readFileSync(abs);
      if (buf.length === 0) {
        errors.push(`Empty exported file: ${f.path}`);
        continue;
      }
      checkedFiles++;

      if (f.format === 'png') {
        try {
          const dec = decodePng(new Uint8Array(buf));
          if (dec.w <= 0 || dec.h <= 0) {
            errors.push(`Invalid PNG dimensions for ${f.path}: ${dec.w}x${dec.h}`);
          }
          if (f.width !== undefined && dec.w !== f.width) {
            errors.push(`PNG width mismatch for ${f.path}: manifest=${f.width}, actual=${dec.w}`);
          }
          if (f.height !== undefined && dec.h !== f.height) {
            errors.push(`PNG height mismatch for ${f.path}: manifest=${f.height}, actual=${dec.h}`);
          }
          if (dec.w > 4096 || dec.h > 4096) {
            errors.push(`PNG exceeds Figma 4096px limit (${dec.w}x${dec.h}): ${f.path}`);
          }
          if (
            (rec.kind === 'sprite' || rec.kind === 'spritesheet' || rec.kind === 'terrain-tile' || rec.kind === 'island-stage') &&
            rec.category !== 'effects' &&
            !hasTransparency({ w: dec.w, h: dec.h, d: dec.d })
          ) {
            errors.push(`Standalone sprite missing alpha transparency: ${f.path}`);
          }
        } catch (err) {
          errors.push(`Corrupt PNG ${f.path}: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else if (f.format === 'apng') {
        try {
          const dec = decodePng(new Uint8Array(buf));
          if (!dec.chunks.includes('acTL') || !dec.chunks.includes('fcTL')) {
            errors.push(`APNG missing acTL/fcTL chunks: ${f.path}`);
          }
          if (dec.w > 4096 || dec.h > 4096) {
            errors.push(`APNG exceeds Figma 4096px limit: ${f.path}`);
          }
        } catch (err) {
          errors.push(`Corrupt APNG ${f.path}: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else if (f.format === 'gif') {
        if (buf.length < 20 || buf.subarray(0, 6).toString('ascii') !== 'GIF89a') {
          errors.push(`Invalid GIF89a header: ${f.path}`);
        } else if (buf[buf.length - 1] !== 0x3b) {
          errors.push(`GIF missing 0x3b trailer: ${f.path}`);
        } else if (!buf.includes(Buffer.from('NETSCAPE2.0', 'ascii'))) {
          errors.push(`Animated GIF missing NETSCAPE2.0 loop block: ${f.path}`);
        }
      } else if (f.format === 'svg') {
        const text = buf.toString('utf8');
        if (!text.includes('<svg') || !text.includes('</svg>')) {
          errors.push(`Invalid SVG markup: ${f.path}`);
        }
        if (rec.kind === 'sprite' && !text.includes('shape-rendering="crispEdges"')) {
          errors.push(`Pixel SVG missing crispEdges attribute: ${f.path}`);
        }
      } else if (f.format === 'json') {
        try {
          JSON.parse(buf.toString('utf8'));
        } catch (err) {
          errors.push(`Invalid JSON in ${f.path}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  // 3. Pixel-exact regression verification against live procedural builders
  const checkExactSurface = (relPath: string, expected: PixelSurface, scale = 1) => {
    const abs = join(outDir, relPath);
    if (!existsSync(abs)) {
      errors.push(`Missing PNG during pixel verification: ${relPath}`);
      return;
    }
    const dec = decodePng(new Uint8Array(readFileSync(abs)));
    const target = scale > 1 ? scaleNearest(expected, scale) : expected;
    const match = pixelsMatch({ w: dec.w, h: dec.h, d: dec.d }, target);
    if (!match.ok) {
      errors.push(
        `Pixel mismatch for ${relPath}: ${match.mismatchCount} differing pixels (first @ ${match.firstMismatch?.x},${match.firstMismatch?.y})`,
      );
    } else {
      verifiedPixelExactCount++;
    }
  };

  for (const c of CREATURES) {
    const pix = drawPipkin(c.id, FRAME_DEFS.idle[0]);
    checkExactSurface(`creatures/sprites/${c.id}.png`, pix, 1);
    checkExactSurface(`creatures/sprites/${c.id}@4x.png`, pix, 4);
  }
  for (const item of ITEMS) {
    const rec = manifest.assets.find((r) => r.id === `item:${item.id}`);
    const def0 = ITEM_BUILDERS[item.id]();
    if (rec) {
      checkExactSurface(rec.primaryFile, def0.pix, 1);
      const scaled = rec.files.find((f) => f.format === 'png' && (f.scale ?? 1) > 1);
      if (scaled?.scale) checkExactSurface(scaled.path, def0.pix, scaled.scale);
    }
    if (ROTATED_BUILDERS[item.id]) {
      const rotRec = manifest.assets.find((r) => r.id === `item:${item.id}:rot1`);
      const def1 = ROTATED_BUILDERS[item.id](1);
      if (rotRec) checkExactSurface(rotRec.primaryFile, def1.pix, 1);
    }
  }
  for (const p of PLANTS) {
    checkExactSurface(`plants/seeds/${p.id}-seed.png`, seedBag(SEED_COL[p.id]).pix, 1);
    for (let s = 0; s < 5; s++) {
      checkExactSurface(`plants/growth-stages/${p.id}-s${s}.png`, plantSprite(p.id as PlantId, s).pix, 1);
    }
  }

  // 4. Required high-level asset families presence
  if (STAGES.length < 10) {
    errors.push(`Expected 10 stages in STAGES catalog, found ${STAGES.length}`);
  }
  if (options.requireBrowserCaptures) {
    for (const cat of ['all-assets', 'creatures', 'buildings', 'decorations', 'nature', 'plants', 'islands']) {
      if (!existsSync(join(outDir, `catalogs/${cat}.png`))) {
        errors.push(`Missing catalog overview PNG: catalogs/${cat}.png`);
      }
    }
    for (const st of STAGES) {
      for (const tod of ['morning', 'day', 'sunset', 'night']) {
        const p = `islands/previews/stage-${st.id}-${tod}.png`;
        if (!existsSync(join(outDir, p))) errors.push(`Missing island preview: ${p}`);
      }
    }
    for (const scr of ['popup-main', 'sidepanel-main', 'full-main', 'shop-seeds', 'inventory-bag', 'creatures-panel', 'journal-discoveries', 'settings-modal']) {
      const p = `ui/screenshots/${scr}.png`;
      if (!existsSync(join(outDir, p))) errors.push(`Missing UI screenshot: ${p}`);
    }
  }

  return {
    ok: errors.length === 0,
    checkedFiles,
    verifiedPixelExactCount,
    errors,
    warnings,
  };
}
