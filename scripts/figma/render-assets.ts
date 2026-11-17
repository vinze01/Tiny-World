import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { CreatureId, PlantId } from '../../src/core/types';
import { CREATURES, ITEMS, PLANTS, PLANT_STAGE_NAMES, STAGES } from '../../src/core/catalog';
import {
  ANIM_ORDER,
  ANIM_RATES,
  FRAME,
  FRAME_DEFS,
  buildCreatureSheet,
  drawPipkin,
} from '../../src/art/creatures';
import {
  FX_BUILDERS,
  ITEM_BUILDERS,
  PICKUP_BUILDERS,
  ROTATED_BUILDERS,
  SEED_COL,
  UI_ICON_BUILDERS,
  seedBag,
} from '../../src/art/atlas';
import { buildCustomTerrainPatch, buildIsland, buildTerrainTile } from '../../src/art/island';
import { plantSprite } from '../../src/art/plants';
import {
  blitSurface,
  computeSafeIntegerScale,
  createSurface,
  crispPixelSvg,
  decodePng,
  encodeApng,
  encodeGif,
  encodePng,
  scaleNearest,
  sha256,
  type PixelSurface,
} from './codecs';
import {
  FIGMA_TARGET_URL,
  buildPlannedInventory,
  itemCategoryFolder,
  runDiscoveryAudit,
  type AssetRecord,
  type VariantFile,
} from './inventory';
import { buildTokensBundle } from './tokens';

export interface CacheEntry {
  sourceHash: string;
  nativeWidth: number;
  nativeHeight: number;
  anchorX?: number;
  anchorY?: number;
  files: VariantFile[];
}

export type ExportCache = Record<string, CacheEntry>;

export interface NodeExportStats {
  exported: number;
  cached: number;
  errors: number;
  filesWritten: number;
}

function ensureDir(absFile: string): void {
  mkdirSync(dirname(absFile), { recursive: true });
}

function writeBytes(outDir: string, relPath: string, bytes: Uint8Array): string {
  const abs = join(outDir, relPath);
  ensureDir(abs);
  writeFileSync(abs, bytes);
  return sha256(bytes);
}

function hashFrames(frames: { surface: PixelSurface; delayMs?: number }[], extra = ''): string {
  const parts: Buffer[] = [Buffer.from(extra)];
  for (const f of frames) {
    parts.push(Buffer.from(`${f.surface.w}x${f.surface.h}@${f.delayMs ?? 0}:`));
    parts.push(Buffer.from(f.surface.d.buffer, f.surface.d.byteOffset, f.surface.d.byteLength));
  }
  return sha256(Buffer.concat(parts));
}

function cacheIsValid(outDir: string, entry: CacheEntry | undefined, sourceHash: string, force: boolean): entry is CacheEntry {
  if (force || !entry || entry.sourceHash !== sourceHash || entry.files.length === 0) return false;
  return entry.files.every((f) => existsSync(join(outDir, f.path)));
}

function recordFromCache(rec: AssetRecord, entry: CacheEntry): void {
  rec.nativeWidth = entry.nativeWidth;
  rec.nativeHeight = entry.nativeHeight;
  if (entry.anchorX !== undefined) rec.anchorX = entry.anchorX;
  if (entry.anchorY !== undefined) rec.anchorY = entry.anchorY;
  rec.files = entry.files.map((f) => ({ ...f }));
  rec.status = 'cached';
}

function writeStaticVariants(
  rec: AssetRecord,
  surface: PixelSurface,
  relBaseNoExt: string,
  outDir: string,
  cache: ExportCache,
  force: boolean,
  stats: NodeExportStats,
  opts?: { preferredScale?: number; maxScaleDim?: number; includeSvg?: boolean; ax?: number; ay?: number },
): void {
  const prefScale = opts?.preferredScale ?? 4;
  const maxDim = opts?.maxScaleDim ?? 4096;
  const safeScale = computeSafeIntegerScale(surface.w, surface.h, prefScale, maxDim);
  const includeSvg = opts?.includeSvg ?? (surface.w <= 48 && surface.h <= 48);
  const srcHash = hashFrames([{ surface }], `v1:scale=${safeScale}:svg=${includeSvg}:ax=${opts?.ax ?? ''}:ay=${opts?.ay ?? ''}`);

  if (cacheIsValid(outDir, cache[rec.id], srcHash, force)) {
    recordFromCache(rec, cache[rec.id]);
    stats.cached++;
    return;
  }

  const files: VariantFile[] = [];
  const nativePath = `${relBaseNoExt}.png`;
  const nativePng = encodePng(surface);
  files.push({
    label: 'native',
    format: 'png',
    path: nativePath,
    width: surface.w,
    height: surface.h,
    scale: 1,
    sha256: writeBytes(outDir, nativePath, nativePng),
    lossless: true,
  });
  stats.filesWritten++;

  if (safeScale > 1) {
    const scaled = scaleNearest(surface, safeScale);
    const scaledPath = `${relBaseNoExt}@${safeScale}x.png`;
    const scaledPng = encodePng(scaled);
    files.push({
      label: `@${safeScale}x`,
      format: 'png',
      path: scaledPath,
      width: scaled.w,
      height: scaled.h,
      scale: safeScale,
      sha256: writeBytes(outDir, scaledPath, scaledPng),
      lossless: true,
    });
    stats.filesWritten++;
  }

  if (includeSvg) {
    const svgPath = `${relBaseNoExt}.svg`;
    const svgText = crispPixelSvg(surface, 4);
    const svgBytes = Buffer.from(svgText, 'utf8');
    files.push({
      label: 'crisp-svg',
      format: 'svg',
      path: svgPath,
      width: surface.w * 4,
      height: surface.h * 4,
      scale: 4,
      sha256: writeBytes(outDir, svgPath, svgBytes),
      lossless: true,
    });
    stats.filesWritten++;
  }

  rec.nativeWidth = surface.w;
  rec.nativeHeight = surface.h;
  if (opts?.ax !== undefined) rec.anchorX = opts.ax;
  if (opts?.ay !== undefined) rec.anchorY = opts.ay;
  rec.primaryFile = nativePath;
  rec.files = files;
  rec.status = 'exported';

  cache[rec.id] = {
    sourceHash: srcHash,
    nativeWidth: surface.w,
    nativeHeight: surface.h,
    anchorX: opts?.ax,
    anchorY: opts?.ay,
    files,
  };
  stats.exported++;
}

function writeAnimatedVariants(
  rec: AssetRecord,
  frames: { surface: PixelSurface; ax?: number; delayMs: number }[],
  relBaseNoExt: string,
  outDir: string,
  cache: ExportCache,
  force: boolean,
  stats: NodeExportStats,
  opts?: { preferredScale?: number; maxScaleDim?: number; includeGif?: boolean },
): void {
  const maxW = Math.max(...frames.map((f) => f.surface.w));
  const maxH = Math.max(...frames.map((f) => f.surface.h));
  const safeScale = computeSafeIntegerScale(maxW, maxH, opts?.preferredScale ?? 4, opts?.maxScaleDim ?? 2048);
  const srcHash = hashFrames(frames, `anim:scale=${safeScale}:gif=${opts?.includeGif ?? true}`);

  if (cacheIsValid(outDir, cache[rec.id], srcHash, force)) {
    recordFromCache(rec, cache[rec.id]);
    stats.cached++;
    return;
  }

  const scaledFrames = frames.map((f) => ({
    surface: safeScale > 1 ? scaleNearest(f.surface, safeScale) : f.surface,
    ax: f.ax !== undefined ? f.ax * safeScale : undefined,
    delayMs: f.delayMs,
  }));

  const files: VariantFile[] = [];
  const apngPath = `${relBaseNoExt}.apng`;
  const apngBytes = encodeApng(scaledFrames, 0);
  files.push({
    label: `apng@${safeScale}x`,
    format: 'apng',
    path: apngPath,
    width: maxW * safeScale,
    height: maxH * safeScale,
    scale: safeScale,
    sha256: writeBytes(outDir, apngPath, apngBytes),
    lossless: true,
  });
  stats.filesWritten++;

  if (opts?.includeGif ?? true) {
    const gifPath = `${relBaseNoExt}.gif`;
    const gifRes = encodeGif(scaledFrames, 0);
    files.push({
      label: `gif@${safeScale}x`,
      format: 'gif',
      path: gifPath,
      width: maxW * safeScale,
      height: maxH * safeScale,
      scale: safeScale,
      sha256: writeBytes(outDir, gifPath, gifRes.bytes),
      lossless: gifRes.lossless,
    });
    stats.filesWritten++;
  }

  rec.nativeWidth = maxW;
  rec.nativeHeight = maxH;
  if (rec.animation) {
    rec.animation.frameWidth = maxW;
    rec.animation.frameHeight = maxH;
  }
  rec.primaryFile = apngPath;
  rec.files = files;
  rec.status = 'exported';

  cache[rec.id] = {
    sourceHash: srcHash,
    nativeWidth: maxW,
    nativeHeight: maxH,
    files,
  };
  stats.exported++;
}

function buildCreaturePoseGrid(creatureId: CreatureId): PixelSurface {
  // 2 rows x 4 columns of animation key poses across 7 animations (plus walk frame 2)
  const samplePoses = ANIM_ORDER.map((anim) => FRAME_DEFS[anim][0]);
  samplePoses.push(FRAME_DEFS.happy[FRAME_DEFS.happy.length - 1]);
  const cols = 4;
  const rows = 2;
  const pad = 2;
  const cell = FRAME + pad * 2;
  const out = createSurface(cols * cell, rows * cell);
  samplePoses.forEach((pose, idx) => {
    const cx = idx % cols;
    const cy = Math.floor(idx / cols);
    const framePix = drawPipkin(creatureId, pose);
    blitSurface(out, framePix, cx * cell + pad, cy * cell + pad);
  });
  return out;
}

function buildPlantProgressionStrip(plantId: PlantId): PixelSurface {
  const sw = 30;
  const sh = 50;
  const out = createSurface(sw * PLANT_STAGE_NAMES.length, sh);
  for (let s = 0; s < PLANT_STAGE_NAMES.length; s++) {
    const sp = plantSprite(plantId, s);
    blitSurface(out, sp.pix, s * sw + (Math.floor(sw / 2) - sp.ax), sh - sp.pix.h);
  }
  return out;
}

export function renderProceduralAssets(
  rootDir: string,
  outDir: string,
  options: { force?: boolean } = {},
): {
  records: AssetRecord[];
  stats: NodeExportStats;
  cache: ExportCache;
} {
  const force = Boolean(options.force);
  const cachePath = join(outDir, '.export-cache.json');
  let cache: ExportCache = {};
  if (!force && existsSync(cachePath)) {
    try {
      cache = JSON.parse(readFileSync(cachePath, 'utf8')) as ExportCache;
    } catch {
      cache = {};
    }
  }

  const records = buildPlannedInventory();
  const byId = new Map<string, AssetRecord>();
  for (const r of records) byId.set(r.id, r);

  const stats: NodeExportStats = { exported: 0, cached: 0, errors: 0, filesWritten: 0 };

  const recordErr = (rec: AssetRecord, err: unknown) => {
    rec.status = 'error';
    rec.error = err instanceof Error ? err.message : String(err);
    stats.errors++;
  };

  // 1. Creatures (idle sprites, sheets, pose gallery, 7 animations each)
  for (const c of CREATURES) {
    try {
      const idlePix = drawPipkin(c.id, FRAME_DEFS.idle[0]);
      const rec = byId.get(`creature:${c.id}`)!;
      writeStaticVariants(rec, idlePix, `creatures/sprites/${c.id}`, outDir, cache, force, stats, {
        preferredScale: 4,
        includeSvg: true,
        ax: FRAME / 2,
        ay: FRAME - 3,
      });

      const sheetData = buildCreatureSheet(c.id);
      const sheetRec = byId.get(`creature-sheet:${c.id}`)!;
      writeStaticVariants(
        sheetRec,
        sheetData.sheet,
        `creatures/spritesheets/${c.id}-sheet`,
        outDir,
        cache,
        force,
        stats,
        { preferredScale: 4, maxScaleDim: 4096, includeSvg: false },
      );

      const poseGrid = buildCreaturePoseGrid(c.id);
      const previewRec = byId.get(`creature-preview:${c.id}`)!;
      writeStaticVariants(
        previewRec,
        poseGrid,
        `creatures/previews/${c.id}-poses`,
        outDir,
        cache,
        force,
        stats,
        { preferredScale: 4, includeSvg: false },
      );

      for (const anim of ANIM_ORDER) {
        const animRec = byId.get(`creature-anim:${c.id}:${anim}`)!;
        const cfg = ANIM_RATES[anim];
        const poses = FRAME_DEFS[anim];
        const seqIndices = cfg.seq ?? poses.map((_, i) => i);
        const delayMs = Math.round(1000 / cfg.rate);
        const frames = seqIndices.map((idx) => ({
          surface: drawPipkin(c.id, poses[idx] ?? poses[0]),
          delayMs,
        }));
        writeAnimatedVariants(animRec, frames, `creatures/animations/${c.id}-${anim}`, outDir, cache, force, stats, {
          preferredScale: 4,
          includeGif: true,
        });
      }
    } catch (e) {
      const rec = byId.get(`creature:${c.id}`);
      if (rec) recordErr(rec, e);
    }
  }

  // 2. Items: Buildings, Decorations, Nature
  for (const item of ITEMS) {
    const dest = itemCategoryFolder(item.category);
    const rec = byId.get(`item:${item.id}`)!;
    try {
      const sp0 = ITEM_BUILDERS[item.id]();
      writeStaticVariants(rec, sp0.pix, `${dest.dir}/${item.id}`, outDir, cache, force, stats, {
        preferredScale: 4,
        includeSvg: sp0.pix.w <= 48 && sp0.pix.h <= 48,
        ax: sp0.ax,
        ay: sp0.pix.h,
      });

      if (ROTATED_BUILDERS[item.id]) {
        const rotRec = byId.get(`item:${item.id}:rot1`)!;
        const sp1 = ROTATED_BUILDERS[item.id](1);
        writeStaticVariants(rotRec, sp1.pix, `${dest.dir}/${item.id}-rot1`, outDir, cache, force, stats, {
          preferredScale: 4,
          includeSvg: sp1.pix.w <= 48 && sp1.pix.h <= 48,
          ax: sp1.ax,
          ay: sp1.pix.h,
        });
      }
    } catch (e) {
      recordErr(rec, e);
    }
  }

  // 3. Plants (seeds, stages, progression strip + growth loop GIF/APNG)
  for (const plant of PLANTS) {
    try {
      const seedDef = seedBag(SEED_COL[plant.id]);
      const seedRec = byId.get(`plant-seed:${plant.id}`)!;
      writeStaticVariants(seedRec, seedDef.pix, `plants/seeds/${plant.id}-seed`, outDir, cache, force, stats, {
        preferredScale: 4,
        includeSvg: true,
        ax: seedDef.ax,
        ay: seedDef.pix.h,
      });

      const growthFrames: { surface: PixelSurface; ax: number; delayMs: number }[] = [];
      for (let s = 0; s < PLANT_STAGE_NAMES.length; s++) {
        const stDef = plantSprite(plant.id, s);
        growthFrames.push({ surface: stDef.pix, ax: stDef.ax, delayMs: 550 });
        const stRec = byId.get(`plant-stage:${plant.id}:${s}`)!;
        writeStaticVariants(
          stRec,
          stDef.pix,
          `plants/growth-stages/${plant.id}-s${s}`,
          outDir,
          cache,
          force,
          stats,
          { preferredScale: 4, includeSvg: true, ax: stDef.ax, ay: stDef.pix.h },
        );
      }

      const strip = buildPlantProgressionStrip(plant.id);
      const progRec = byId.get(`plant-progression:${plant.id}`)!;
      writeStaticVariants(progRec, strip, `plants/previews/${plant.id}-progression`, outDir, cache, force, stats, {
        preferredScale: 4,
        includeSvg: false,
      });

      const gifPath = `plants/previews/${plant.id}-growth.gif`;
      const apngPath = `plants/previews/${plant.id}-growth.apng`;
      if (
        progRec.status !== 'cached' ||
        !progRec.files.some((f) => f.path === apngPath) ||
        !existsSync(join(outDir, apngPath)) ||
        !existsSync(join(outDir, gifPath))
      ) {
        const safeScale = 4;
        const scaledGrowth = growthFrames.map((f) => ({
          surface: scaleNearest(f.surface, safeScale),
          ax: f.ax * safeScale,
          delayMs: f.delayMs,
        }));
        const gifRes = encodeGif(scaledGrowth, 0);
        const apngBytes = encodeApng(scaledGrowth, 0);
        const extraFiles: VariantFile[] = [
          {
            label: 'growth-apng@4x',
            format: 'apng',
            path: apngPath,
            width: 30 * safeScale,
            height: 50 * safeScale,
            scale: safeScale,
            sha256: writeBytes(outDir, apngPath, apngBytes),
            lossless: true,
          },
          {
            label: 'growth-gif@4x',
            format: 'gif',
            path: gifPath,
            width: 30 * safeScale,
            height: 50 * safeScale,
            scale: safeScale,
            sha256: writeBytes(outDir, gifPath, gifRes.bytes),
            lossless: gifRes.lossless,
          },
        ];
        progRec.files = [
          ...progRec.files.filter((f) => f.path !== apngPath && f.path !== gifPath),
          ...extraFiles,
        ];
        if (cache[progRec.id]) {
          cache[progRec.id].files = progRec.files.map((f) => ({ ...f }));
        }
        stats.filesWritten += 2;
      }
    } catch (e) {
      const rec = byId.get(`plant-progression:${plant.id}`);
      if (rec) recordErr(rec, e);
    }
  }

  // 4. Islands: terrain tiles, custom terrain transition examples & Stages 1..10 raw islands + animated water
  for (const rec of records.filter((r) => r.kind === 'terrain-tile')) {
    try {
      if (rec.id.startsWith('terrain-transition:')) {
        const [, kind, mode] = rec.id.split(':') as ['terrain-transition', 'snow' | 'sand', string];
        const sameMask = mode === 'connected' ? 15 : 0;
        const otherMask = mode === 'sand-border' ? 6 : 0;
        const tex = buildCustomTerrainPatch(kind, sameMask, otherMask);
        const relNoExt = rec.primaryFile.replace(/\.png$/, '');
        writeStaticVariants(rec, tex.pix, relNoExt, outDir, cache, force, stats, {
          preferredScale: 4,
          includeSvg: true,
          ax: tex.ox,
          ay: tex.oy,
        });
      } else {
        const [, kind, biome] = rec.id.split(':') as ['terrain', Exclude<Parameters<typeof buildTerrainTile>[0], 'void'>, NonNullable<Parameters<typeof buildTerrainTile>[1]>];
        const tex = buildTerrainTile(kind, biome, 0);
        writeStaticVariants(rec, tex.pix, `islands/terrain/tile-${kind}-${biome}`, outDir, cache, force, stats, {
          preferredScale: 4,
          includeSvg: true,
          ax: tex.ox,
          ay: tex.oy,
        });
      }
    } catch (e) {
      recordErr(rec, e);
    }
  }

  for (const st of STAGES) {
    const rec = byId.get(`island-stage:${st.id}`)!;
    try {
      const frame0 = buildIsland(st.id, 0, st.biome);
      writeStaticVariants(rec, frame0.pix, `islands/stages/stage-${st.id}`, outDir, cache, force, stats, {
        preferredScale: 4,
        maxScaleDim: 4096,
        includeSvg: false,
        ax: frame0.ox,
        ay: frame0.oy,
      });

      const waterGifPath = `islands/stages/stage-${st.id}-water.gif`;
      if (
        rec.status !== 'cached' ||
        !rec.files.some((f) => f.path === waterGifPath) ||
        !existsSync(join(outDir, waterGifPath))
      ) {
        const waterScale = computeSafeIntegerScale(frame0.pix.w, frame0.pix.h, 2, 720);
        const frame1 = buildIsland(st.id, 1, st.biome);
        const frame2 = buildIsland(st.id, 2, st.biome);
        const waterFrames = [frame0, frame1, frame2].map((f) => ({
          surface: waterScale > 1 ? scaleNearest(f.pix, waterScale) : f.pix,
          delayMs: 360,
        }));
        const waterGif = encodeGif(waterFrames, 0);
        const waterFile: VariantFile = {
          label: `water-gif@${waterScale}x`,
          format: 'gif',
          path: waterGifPath,
          width: frame0.pix.w * waterScale,
          height: frame0.pix.h * waterScale,
          scale: waterScale,
          sha256: writeBytes(outDir, waterGifPath, waterGif.bytes),
          lossless: waterGif.lossless,
        };
        rec.files = [...rec.files.filter((f) => f.path !== waterGifPath), waterFile];
        if (cache[rec.id]) {
          cache[rec.id].files = rec.files.map((f) => ({ ...f }));
        }
        stats.filesWritten++;
      }
      if (rec.animation) {
        rec.animation.frameWidth = frame0.pix.w;
        rec.animation.frameHeight = frame0.pix.h;
      }
    } catch (e) {
      recordErr(rec, e);
    }
  }

  // 5. Effects & Pickups
  for (const [fxKey, build] of Object.entries(FX_BUILDERS)) {
    const rec = byId.get(fxKey)!;
    const slug = fxKey.replace(/^fx:/, '');
    try {
      const def = build();
      writeStaticVariants(rec, def.pix, `effects/${slug}`, outDir, cache, force, stats, {
        preferredScale: 4,
        includeSvg: def.pix.w <= 40 && def.pix.h <= 40,
        ax: def.ax,
        ay: def.pix.h,
      });
    } catch (e) {
      recordErr(rec, e);
    }
  }

  writeAnimatedVariants(
    byId.get('fx-anim:flame')!,
    [
      { surface: FX_BUILDERS['fx:flame0']().pix, delayMs: 180 },
      { surface: FX_BUILDERS['fx:flame1']().pix, delayMs: 180 },
    ],
    'effects/flame',
    outDir,
    cache,
    force,
    stats,
    { preferredScale: 4 },
  );

  writeAnimatedVariants(
    byId.get('fx-anim:butterfly')!,
    [
      { surface: FX_BUILDERS['fx:bfly0']().pix, delayMs: 160 },
      { surface: FX_BUILDERS['fx:bfly1']().pix, delayMs: 160 },
    ],
    'effects/butterfly',
    outDir,
    cache,
    force,
    stats,
    { preferredScale: 4 },
  );

  for (const [pkKey, build] of Object.entries(PICKUP_BUILDERS)) {
    const rec = byId.get(pkKey)!;
    const slug = pkKey.replace(/^pickup:/, 'pickup-');
    try {
      const def = build();
      writeStaticVariants(rec, def.pix, `effects/${slug}`, outDir, cache, force, stats, {
        preferredScale: 4,
        includeSvg: true,
        ax: def.ax,
        ay: def.pix.h,
      });
    } catch (e) {
      recordErr(rec, e);
    }
  }

  // 6. UI Icons & Chrome Extension Icons
  for (const [uiKey, build] of Object.entries(UI_ICON_BUILDERS)) {
    const rec = byId.get(uiKey)!;
    const slug = uiKey.replace(':', '-');
    try {
      const def = build();
      writeStaticVariants(rec, def.pix, `ui/icons/${slug}`, outDir, cache, force, stats, {
        preferredScale: 4,
        includeSvg: true,
        ax: def.ax,
        ay: def.pix.h,
      });
    } catch (e) {
      recordErr(rec, e);
    }
  }

  for (const size of [16, 48, 128] as const) {
    const rec = byId.get(`ext-icon:${size}`)!;
    const srcPath = resolve(rootDir, `public/icons/icon${size}.png`);
    try {
      const rawBytes = new Uint8Array(readFileSync(srcPath));
      const decoded = decodePng(rawBytes);
      writeStaticVariants(
        rec,
        { w: decoded.w, h: decoded.h, d: decoded.d },
        `ui/icons/ext-icon-${size}`,
        outDir,
        cache,
        force,
        stats,
        { preferredScale: size === 16 ? 4 : size === 48 ? 2 : 1, includeSvg: size === 16 },
      );
    } catch (e) {
      recordErr(rec, e);
    }
  }

  // 7. Design tokens & vector UI components
  const tokensBundle = buildTokensBundle(rootDir);
  const tokensJsonStr = `${JSON.stringify(tokensBundle.designTokens, null, 2)}\n`;
  const figmaVarsJsonStr = `${JSON.stringify(tokensBundle.figmaVariables, null, 2)}\n`;

  const rootTokHash = writeBytes(outDir, 'design-tokens.json', Buffer.from(tokensJsonStr, 'utf8'));
  const uiTokHash = writeBytes(outDir, 'ui/tokens/design-tokens.json', Buffer.from(tokensJsonStr, 'utf8'));
  const figVarsHash = writeBytes(outDir, 'ui/tokens/figma-variables.json', Buffer.from(figmaVarsJsonStr, 'utf8'));
  const tokenRec = byId.get('ui-tokens:design-tokens')!;
  tokenRec.files = [
    { label: 'design-tokens', format: 'json', path: 'design-tokens.json', sha256: rootTokHash, lossless: true },
    { label: 'ui-tokens-mirror', format: 'json', path: 'ui/tokens/design-tokens.json', sha256: uiTokHash, lossless: true },
    { label: 'figma-variables', format: 'json', path: 'ui/tokens/figma-variables.json', sha256: figVarsHash, lossless: true },
  ];
  tokenRec.status = 'exported';
  stats.exported++;
  stats.filesWritten += 3;

  const vecIds: Record<string, string> = {
    'ui/components/tw-panel.svg': 'ui-vec:panel',
    'ui/components/tw-buttons-states.svg': 'ui-vec:buttons',
    'ui/components/tw-medallion.svg': 'ui-vec:medallion',
    'ui/components/tw-heart-bar.svg': 'ui-vec:heart-bar',
    'ui/components/tw-sky-gradients.svg': 'ui-vec:sky-cycle',
  };
  for (const comp of tokensBundle.componentSvgs) {
    const rec = byId.get(vecIds[comp.filename]);
    if (!rec) continue;
    const h = writeBytes(outDir, comp.filename, Buffer.from(comp.svg, 'utf8'));
    rec.files = [
      {
        label: 'svg',
        format: 'svg',
        path: comp.filename,
        width: rec.nativeWidth,
        height: rec.nativeHeight,
        sha256: h,
        lossless: true,
      },
    ];
    rec.status = 'exported';
    stats.exported++;
    stats.filesWritten++;
  }

  // Write cache
  writeBytes(outDir, '.export-cache.json', Buffer.from(`${JSON.stringify(cache, null, 2)}\n`, 'utf8'));

  // Write figma-assets/README.md
  const audit = runDiscoveryAudit();
  const readme = buildFigmaReadme(audit);
  writeBytes(outDir, 'README.md', Buffer.from(readme, 'utf8'));

  return { records, stats, cache };
}

function buildFigmaReadme(audit: ReturnType<typeof runDiscoveryAudit>): string {
  return `# TinyWorld — Figma Import Asset Bundle

Auto-generated from TinyWorld TypeScript procedural art & UI sources via \`npm run export:figma\`.

- **Target Figma File**: ${FIGMA_TARGET_URL}
- **Discovered Totals**: ${audit.creatureCount} Pipkin species, ${audit.plantCount} plants, ${audit.itemCount} shop & scenery items, ${audit.stageCount} island progression stages
- **Figma Bitmap Import Guardrail**: All PNGs enforce nearest-neighbor integer scaling strictly \`<= 4096px\` per side.

## Folder Map

- \`design-tokens.json\` — W3C Design Tokens (UI CSS variables, outlines, species palettes, biome ramps, 24h sky curves, typography, spacing, radii, shadows)
- \`creatures/\` — Pipkin native sprites, \`@4x\` sprites, spritesheets, animated GIFs + APNGs, and pose grids
- \`buildings/\` — All 14 procedural structures (including rotated variants)
- \`decorations/\` — Furniture, lighting, paths, and seasonal decorations (including rotated variants)
- \`nature/\` — Trees, rocks, crystals, logs, wildflowers, and biome flora
- \`plants/\` — Seed packets, stages \`s0..s4\`, growth progression strips, and animated growth cycles
- \`islands/\` — Biome terrain tiles, Stages 1–10 procedural islands (native + safe integer scale + water GIF), and live rendered day-cycle/weather scenes (\`previews/\`)
- \`effects/\` — Particles, emotions, pickups, animated flame & butterfly loops
- \`ui/\` — UI icons, extension icons, SVG & cropped UI components, Tailwind/CSS Figma Variables JSON, and full-screen surface screenshots
- \`catalogs/\` — Labeled overview contact sheets (\`all-assets.png\`, \`creatures.png\`, \`buildings.png\`, \`decorations.png\`, \`nature.png\`, \`plants.png\`, \`islands.png\`)

## Recommended Figma Page Structure

1. **\`01 — Design System\`**: Import \`ui/tokens/figma-variables.json\` (via Figma Variables / Tokens Studio), \`ui/components/*.svg\`, and \`ui/tokens/design-tokens.json\`.
2. **\`02 — World & Islands\`**: Place \`catalogs/islands.png\`, \`islands/stages/*.png\`, \`islands/terrain/*\`, and \`islands/previews/stage-*-{morning,day,sunset,night}.png\`.
3. **\`03 — Creatures (Pipkins)\`**: Place \`catalogs/creatures.png\`, \`creatures/sprites/*@4x.png\`, animated \`.gif\` previews, and spritesheets.
4. **\`04 — Plants & Nature\`**: Place \`catalogs/plants.png\`, \`catalogs/nature.png\`, seed packets, growth progression strips, and nature items.
5. **\`05 — Buildings & Decorations\`**: Place \`catalogs/buildings.png\`, \`catalogs/decorations.png\`, and rotated variants side-by-side.
6. **\`06 — UI Components & Screens\`**: Place \`ui/screenshots/*.png\`, \`ui/components/*\`, and \`ui/icons/*\`.
7. **\`07 — Concepts & Future Designs\`**: Workspace for Figma-first mockups before implementing changes back into \`src/\`.
`;
}
