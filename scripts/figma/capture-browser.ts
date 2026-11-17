import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import type { CreatureState, GameState, PlacedObject, WeatherType } from '../../src/core/types';
import {
  CREATURES,
  ITEMS,
  ITEM_BY_ID,
  PLANTS,
  STAGES,
  TREAT_ID,
  decorKey,
  seedKey,
} from '../../src/core/catalog';
import { PLANT_ITEM, canPlace, terrainMap } from '../../src/core/grid';
import { createInitialState, stageExpansionObjects, validateState } from '../../src/core/state';
import { decodePng, sha256 } from './codecs';
import {
  TIMES_OF_DAY,
  WEATHER_SHOWCASES,
  type AssetRecord,
  type TimeOfDayPreset,
} from './inventory';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

const TOD_HOURS: Record<TimeOfDayPreset, number> = {
  morning: 7.5,
  day: 13.0,
  sunset: 18.25,
  night: 22.5,
};

export interface BrowserCaptureStats {
  islandPreviews: number;
  uiScreenshots: number;
  uiComponents: number;
  catalogs: number;
  errors: number;
}

export function findChromiumExecutable(): string {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter((p): p is string => Boolean(p));

  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error('No Chromium/Chrome/Edge executable found for browser captures.');
  }
  return found;
}

function startStaticServer(distDir: string): Promise<{ srv: Server; url: string }> {
  return new Promise((resolvePromise, reject) => {
    const srv = createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
      const cleanRel = urlPath === '/' ? 'game.html' : urlPath.replace(/^\/+/, '');
      const fullPath = resolve(distDir, cleanRel);
      if (!fullPath.startsWith(resolve(distDir))) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (!existsSync(fullPath) || statSync(fullPath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = extname(fullPath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream' });
      res.end(readFileSync(fullPath));
    });
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to resolve ephemeral HTTP port'));
        return;
      }
      resolvePromise({ srv, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function writeOutPng(outDir: string, relPath: string, buf: Buffer): { sha: string; width: number; height: number } {
  const abs = join(outDir, relPath);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, buf);
  const dec = decodePng(new Uint8Array(buf));
  return { sha: sha256(buf), width: dec.w, height: dec.h };
}

function tryPlaceSpiral(
  state: GameState,
  itemId: string,
  seqStart: number,
  now: number,
): PlacedObject | null {
  const def = ITEM_BY_ID[itemId];
  if (!def) return null;
  const map = terrainMap(state.stage);
  const cx = Math.floor(map.w / 2);
  const cy = Math.floor(map.h / 2);

  const candidates: { gx: number; gy: number; dist: number }[] = [];
  for (let gy = 0; gy < map.h; gy++) {
    for (let gx = 0; gx < map.w; gx++) {
      const dx = gx - cx;
      const dy = gy - cy;
      candidates.push({ gx, gy, dist: dx * dx + dy * dy });
    }
  }
  candidates.sort((a, b) => a.dist - b.dist);

  for (const cand of candidates) {
    for (const rot of def.rotatable ? ([0, 1] as const) : ([0] as const)) {
      const chk = canPlace(state, def, cand.gx, cand.gy, rot);
      if (chk.ok) {
        return {
          id: `show_${seqStart}`,
          type: def.id,
          gx: cand.gx,
          gy: cand.gy,
          rot,
          placedAt: now,
        };
      }
    }
  }
  return null;
}

export function buildShowcaseState(
  stage: number,
  hour: number,
  options: {
    weather?: WeatherType;
    tutorialDone?: boolean;
    dryPlantCount?: number;
  } = {},
): GameState {
  const now = Date.now();
  const base = createInitialState(now, 4242 + stage * 131, false);
  base.stage = stage;
  base.tokens = 4850;
  base.settings.cycle = 'custom';
  base.settings.manualHour = hour;
  base.settings.weatherEnabled = true;
  if (options.weather) {
    base.events.weather = options.weather;
    base.events.weatherUntil = now + 3_600_000;
  }
  if (options.tutorialDone !== false) {
    base.tutorial = {
      step: 5,
      done: true,
      tappedTree: true,
      tappedPond: true,
      tappedCreature: true,
      skipped: false,
    };
  }

  let seq = 100;
  for (let s = 2; s <= stage; s++) {
    const expObjs = stageExpansionObjects(s, now, seq);
    seq += expObjs.length + 5;
    for (const o of expObjs) {
      const def = ITEM_BY_ID[o.type];
      if (!def) continue;
      const chk = canPlace(base, def, o.gx, o.gy, o.rot);
      if (chk.ok) base.objects.push(o);
    }
  }

  // Place real stage-unlocked buildings, furniture, lighting & scenery without over-crowding
  const unlockedItems = ITEMS.filter((i) => i.stage <= stage && !i.scenery).sort((a, b) => b.stage - a.stage);
  const pickedIds: string[] = [];
  for (const cat of ['buildings', 'furniture', 'lighting', 'nature', 'paths'] as const) {
    for (const item of unlockedItems.filter((x) => x.category === cat).slice(0, 2)) {
      if (!pickedIds.includes(item.id)) pickedIds.push(item.id);
    }
  }
  for (const itemId of pickedIds) {
    if (base.objects.some((o) => o.type === itemId)) continue;
    const placed = tryPlaceSpiral(base, itemId, seq++, now);
    if (placed) {
      base.objects.push(placed);
      base.discovered[decorKey(itemId)] = now - 600_000;
    }
  }

  // Populate soil tiles with stage-appropriate blooming (or waterable) plants
  const map = terrainMap(stage);
  const availPlants = PLANTS.filter((p) => p.stage <= stage);
  let plantsPlaced = 0;
  const maxPlants = Math.min(8, 2 + stage);
  const plantCoords: { gx: number; gy: number; dist: number }[] = [];
  const pCx = Math.floor(map.w / 2);
  const pCy = Math.floor(map.h / 2);
  for (let gy = 0; gy < map.h; gy++) {
    for (let gx = 0; gx < map.w; gx++) {
      const dx = gx - pCx;
      const dy = gy - pCy;
      if (dx * dx + dy * dy >= 4) plantCoords.push({ gx, gy, dist: dx * dx + dy * dy });
    }
  }
  plantCoords.sort((a, b) => a.dist - b.dist);
  for (const { gx, gy } of plantCoords) {
    if (plantsPlaced >= maxPlants) break;
    const chk = canPlace(base, PLANT_ITEM, gx, gy, 0, undefined, { plant: true });
    if (!chk.ok) continue;
    const pDef = availPlants[(availPlants.length - 1 - (plantsPlaced % availPlants.length)) % availPlants.length];
    const isDry = (options.dryPlantCount ?? 0) > plantsPlaced;
    base.objects.push({
      id: `p_show_${seq++}`,
      type: pDef.id,
      gx,
      gy,
      rot: 0,
      placedAt: now - 3_600_000,
      plant: isDry
        ? { plantedAt: now - 60_000, bonusMs: 0, waterCount: 0 }
        : { plantedAt: now - 3_600_000, bonusMs: 120_000, waterCount: 2 },
    });
    base.discovered[`plant:${pDef.id}`] = now - 500_000;
    plantsPlaced++;
  }

  // Populate rich inventory & treats using real catalog IDs
  const firstSeed = PLANTS[0]?.id ?? 'daisy';
  const secondSeed = PLANTS[1]?.id;
  const thirdSeed = PLANTS[2]?.id;
  const sampleFurn = ITEMS.find((i) => i.category === 'furniture' && !i.scenery)?.id;
  const sampleLight = ITEMS.find((i) => i.category === 'lighting' && !i.scenery)?.id;
  const sampleBld = ITEMS.find((i) => i.category === 'buildings' && i.stage <= stage && !i.scenery)?.id;
  base.inventory = {
    [seedKey(firstSeed)]: 6,
    ...(secondSeed ? { [seedKey(secondSeed)]: 4 } : {}),
    ...(thirdSeed ? { [seedKey(thirdSeed)]: 3 } : {}),
    ...(sampleFurn ? { [decorKey(sampleFurn)]: 2 } : {}),
    ...(sampleLight ? { [decorKey(sampleLight)]: 2 } : {}),
    ...(sampleBld ? { [decorKey(sampleBld)]: 1 } : {}),
    [TREAT_ID]: 6,
  };

  // Unlock creatures proportional to stage (all 15 by stage 10)
  const targetCreatures = stage >= 10 ? CREATURES.length : Math.min(CREATURES.length, 1 + stage + Math.floor(stage / 2));
  const unlockedIds = new Set(base.creatures.map((c) => c.id));
  for (let i = 0; i < targetCreatures; i++) {
    const cDef = CREATURES[i];
    if (unlockedIds.has(cDef.id)) continue;
    const cs: CreatureState = {
      id: cDef.id,
      name: cDef.name,
      affection: Math.min(60, 12 + i * 3),
      discoveredAt: now - 1_200_000 + i * 30_000,
      lastPetRewardAt: 0,
      lastPetAt: 0,
      lastFedAt: 0,
      petCount: 2 + (i % 4),
      fedCount: 1 + (i % 3),
      emotion: i % 3 === 0 ? 'happy' : 'curious',
      emotionUntil: now + 600_000,
    };
    base.creatures.push(cs);
    base.discovered[`creature:${cDef.id}`] = cs.discoveredAt;
    unlockedIds.add(cDef.id);
  }
  base.nextId = seq + 50;
  base.stats.pets = Math.max(5, stage * 4);
  base.stats.planted = Math.max(4, stage * 3);

  return validateState(base, now) ?? base;
}

async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __twStore?: { ready?: boolean } };
      return Boolean(w.__twStore?.ready && document.querySelector('canvas'));
    },
    null,
    { timeout: 15000 },
  );
  await page.waitForTimeout(450);
}

async function installCleanCanvasCss(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `.app-shell > *:not(.world-canvas) { display: none !important; opacity: 0 !important; pointer-events: none !important; }`,
  });
}

async function loadStateIntoPage(page: Page, baseUrl: string, entry: string, state: GameState): Promise<void> {
  if (!page.url().startsWith(baseUrl)) {
    await page.goto(`${baseUrl}/${entry}`, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
  }
  await page.evaluate(async (st) => {
    const w = window as unknown as { __twStore: { saveStore: { importState: (s: unknown) => Promise<void> } } };
    await w.__twStore.saveStore.importState(st);
  }, state);
  await page.goto(`${baseUrl}/${entry}`, { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await page.evaluate(() => {
    const w = window as unknown as {
      __twStore: { worldHooks?: { centerCamera?: () => void } };
    };
    w.__twStore.worldHooks?.centerCamera?.();
  });
  await page.waitForTimeout(450);
}

async function renderCatalogBoards(
  page: Page,
  outDir: string,
  records: AssetRecord[],
  stats: BrowserCaptureStats,
): Promise<AssetRecord[]> {
  const catalogRecords: AssetRecord[] = [];
  const dataUriCache = new Map<string, string>();

  const toDataUri = (relPath: string): string => {
    const hit = dataUriCache.get(relPath);
    if (hit) return hit;
    const abs = join(outDir, relPath);
    if (!existsSync(abs)) return '';
    const uri = `data:image/png;base64,${readFileSync(abs).toString('base64')}`;
    dataUriCache.set(relPath, uri);
    return uri;
  };

  interface CardItem {
    title: string;
    subtitle: string;
    badge: string;
    imgRel: string;
    w: number;
    h: number;
    maxPreviewPx?: number;
  }

  const cardFor = (r: AssetRecord, maxPreviewPx = 88): CardItem | null => {
    const pngFile =
      r.files.find((f) => f.format === 'png' && f.label !== 'native') ??
      r.files.find((f) => f.format === 'png');
    const rel = pngFile?.path ?? r.primaryFile;
    if (!rel.endsWith('.png') || !existsSync(join(outDir, rel))) return null;
    const natW = r.nativeWidth || pngFile?.width || 32;
    const natH = r.nativeHeight || pngFile?.height || 32;
    return {
      title: r.name,
      subtitle: `${natW}×${natH}px · ${r.sourceModule.replace(/^src\//, '')}`,
      badge: r.stageMin ? `Stage ${r.stageMin}` : r.subcategory ?? r.category,
      imgRel: rel,
      w: natW,
      h: natH,
      maxPreviewPx,
    };
  };

  const renderBoard = async (
    id: string,
    title: string,
    subtitle: string,
    sections: { heading: string; cols: number; cardHeight: number; items: CardItem[] }[],
    outRel: string,
    boardWidth = 1920,
  ) => {
    const htmlSections = sections
      .map((sec) => {
        const cardsHtml = sec.items
          .map((item) => {
            const uri = toDataUri(item.imgRel);
            const scale = Math.max(1, Math.min(4, Math.floor((item.maxPreviewPx ?? 84) / Math.max(item.w, item.h, 1))));
            const dispW = Math.min(item.maxPreviewPx ?? 128, item.w * scale);
            const dispH = Math.min(sec.cardHeight - 46, item.h * scale);
            return `<div class="card" style="height:${sec.cardHeight}px">
              <div class="thumb">${uri ? `<img src="${uri}" style="width:${dispW}px;height:${dispH}px;object-fit:contain"/>` : ''}</div>
              <div class="meta">
                <div class="name">${item.title}</div>
                <div class="sub"><span>${item.subtitle}</span><span class="pill">${item.badge}</span></div>
              </div>
            </div>`;
          })
          .join('');
        return `<section>
          <h2>${sec.heading} <span class="cnt">(${sec.items.length})</span></h2>
          <div class="grid" style="grid-template-columns:repeat(${sec.cols}, minmax(0, 1fr))">${cardsHtml}</div>
        </section>`;
      })
      .join('');

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: ${boardWidth}px;
    background: #f5ebd4;
    color: #3b2d23;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    padding: 28px 32px 36px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 3px solid #7a5a42;
    padding-bottom: 14px;
    margin-bottom: 22px;
  }
  header h1 { font-size: 30px; font-weight: 900; letter-spacing: -0.02em; color: #2d6838; }
  header p { font-size: 13px; color: #6e5a4a; margin-top: 4px; font-weight: 600; }
  header .stamp { font-size: 12px; font-weight: 800; background: #fffaf0; border: 2px solid #4a3525; padding: 6px 12px; border-radius: 10px; }
  section { margin-bottom: 24px; }
  section h2 { font-size: 17px; font-weight: 800; color: #4a3525; margin-bottom: 10px; border-left: 5px solid #4b9b58; padding-left: 10px; }
  section h2 .cnt { color: #6e5a4a; font-weight: 700; font-size: 14px; }
  .grid { display: grid; gap: 10px; }
  .card {
    background: #fffaf0;
    border: 2px solid #c6b18b;
    border-radius: 12px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
  }
  .thumb {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background-color: #ece0c4;
    background-image:
      linear-gradient(45deg, #e1d2af 25%, transparent 25%),
      linear-gradient(-45deg, #e1d2af 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #e1d2af 75%),
      linear-gradient(-45deg, transparent 75%, #e1d2af 75%);
    background-size: 16px 16px;
    background-position: 0 0, 0 8px, 8px -8px, -8px 0;
    min-height: 0;
    padding: 4px;
  }
  .thumb img { image-rendering: pixelated; display: block; }
  .meta { padding-top: 6px; }
  .name { font-size: 12px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { display: flex; justify-content: space-between; align-items: center; gap: 4px; font-size: 10px; color: #6e5a4a; margin-top: 2px; font-weight: 600; }
  .sub span:first-child { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pill { background: #ebd9b9; color: #3b2d23; border-radius: 999px; padding: 1px 6px; font-size: 9.5px; font-weight: 800; flex-shrink: 0; }
</style>
</head>
<body>
  <header>
    <div>
      <h1>TinyWorld — ${title}</h1>
      <p>${subtitle}</p>
    </div>
    <div class="stamp">Figma Safe Board · Pixel-Exact Nearest Scaling</div>
  </header>
  ${htmlSections}
</body>
</html>`;

    await page.setViewportSize({ width: boardWidth, height: 1080 });
    await page.setContent(html, { waitUntil: 'load' });
    const fullH = await page.evaluate(() => Math.min(4096, Math.ceil(document.body.scrollHeight)));
    await page.setViewportSize({ width: boardWidth, height: Math.max(600, fullH) });
    const buf = await page.screenshot({ fullPage: false });
    const info = writeOutPng(outDir, outRel, buf);
    stats.catalogs++;
    catalogRecords.push({
      id: `catalog:${id}`,
      name: `Catalog Board: ${title}`,
      category: 'catalogs',
      subcategory: id,
      kind: 'catalog',
      sourceModule: 'scripts/figma/capture-browser.ts',
      nativeWidth: info.width,
      nativeHeight: info.height,
      primaryFile: outRel,
      files: [{ label: 'catalog-png', format: 'png', path: outRel, width: info.width, height: info.height, scale: 1, sha256: info.sha, lossless: true }],
      tags: ['catalog', 'figma-board', id],
      status: 'exported',
    });
  };

  const creaturesCards = records
    .filter((r) => r.category === 'creatures' && r.kind === 'sprite')
    .map((r) => cardFor(r, 112))
    .filter((x): x is CardItem => Boolean(x));

  const buildingCards = records
    .filter((r) => r.category === 'buildings' && r.rotation === 0)
    .map((r) => cardFor(r, 128))
    .filter((x): x is CardItem => Boolean(x));

  const decorCards = records
    .filter((r) => r.category === 'decorations' && r.rotation === 0)
    .map((r) => cardFor(r, 96))
    .filter((x): x is CardItem => Boolean(x));

  const natureCards = records
    .filter((r) => r.category === 'nature' && r.rotation === 0)
    .map((r) => cardFor(r, 112))
    .filter((x): x is CardItem => Boolean(x));

  const plantCards = records
    .filter((r) => r.category === 'plants' && r.kind === 'progression')
    .map((r) => cardFor(r, 160))
    .filter((x): x is CardItem => Boolean(x));

  const plantSeedCards = records
    .filter((r) => r.category === 'plants' && r.subcategory === 'seeds')
    .map((r) => cardFor(r, 80))
    .filter((x): x is CardItem => Boolean(x));

  const islandPreviewCards = records
    .filter((r) => r.id.startsWith('island-preview:') && r.id.endsWith(':day'))
    .map((r) => ({
      title: r.name.replace(' (day)', ''),
      subtitle: `${STAGES.find((s) => s.id === r.stageMin)?.gridW ?? '?'}×${STAGES.find((s) => s.id === r.stageMin)?.gridH ?? '?'} · ${r.biome ?? 'meadow'}`,
      badge: `Stage ${r.stageMin ?? 1}`,
      imgRel: r.primaryFile,
      w: 1200,
      h: 840,
      maxPreviewPx: 340,
    }));

  const islandStageCards = records
    .filter((r) => r.kind === 'island-stage')
    .map((r) => cardFor(r, 220))
    .filter((x): x is CardItem => Boolean(x));

  const fxCards = records
    .filter((r) => r.category === 'effects' && r.kind === 'sprite')
    .map((r) => cardFor(r, 72))
    .filter((x): x is CardItem => Boolean(x));

  try {
    await renderBoard(
      'creatures',
      'Pipkin Species Sheet',
      'All 15 procedural creatures at crisp integer magnification',
      [{ heading: 'Pipkins', cols: 5, cardHeight: 168, items: creaturesCards }],
      'catalogs/creatures.png',
    );
    await renderBoard(
      'buildings',
      'Buildings Catalog',
      'All 14 architectural structures (rot 0° reference)',
      [{ heading: 'Buildings', cols: 5, cardHeight: 196, items: buildingCards }],
      'catalogs/buildings.png',
    );
    await renderBoard(
      'decorations',
      'Decorations & Thematic Catalog',
      'Furniture, Lighting, Paths, Seasonal, Winter, Christmas, Desert & Beach Collections (rot 0°)',
      [
        {
          heading: 'Furniture',
          cols: 7,
          cardHeight: 146,
          items: records.filter((r) => r.category === 'decorations' && r.subcategory === 'furniture' && r.rotation === 0).map((r) => cardFor(r, 84)!).filter(Boolean),
        },
        {
          heading: 'Lighting',
          cols: 7,
          cardHeight: 146,
          items: records.filter((r) => r.category === 'decorations' && r.subcategory === 'lighting' && r.rotation === 0).map((r) => cardFor(r, 84)!).filter(Boolean),
        },
        {
          heading: 'Paths & Classic Seasonal',
          cols: 7,
          cardHeight: 146,
          items: records.filter((r) => r.category === 'decorations' && (r.subcategory === 'paths' || r.subcategory === 'seasonal') && r.rotation === 0).map((r) => cardFor(r, 84)!).filter(Boolean),
        },
        {
          heading: 'Winter & Christmas Seasonal Collection',
          cols: 7,
          cardHeight: 146,
          items: records.filter((r) => (r.category === 'decorations' || r.category === 'nature') && (r.subcategory === 'winter' || r.subcategory === 'christmas') && r.rotation === 0).map((r) => cardFor(r, 84)!).filter(Boolean),
        },
        {
          heading: 'Desert, Beach & Summer Collection',
          cols: 7,
          cardHeight: 146,
          items: records.filter((r) => (r.category === 'decorations' || r.category === 'nature') && (r.subcategory === 'desert' || r.subcategory === 'beach') && r.rotation === 0).map((r) => cardFor(r, 84)!).filter(Boolean),
        },
      ],
      'catalogs/decorations.png',
    );
    await renderBoard(
      'nature',
      'Nature & Scenery Catalog',
      'Trees, Rocks, Flora, Springs, Crystals & Environmental Details',
      [{ heading: 'Nature Items', cols: 5, cardHeight: 174, items: natureCards }],
      'catalogs/nature.png',
    );
    await renderBoard(
      'plants',
      'Crops & Growth Progressions',
      'Seed packets & 5-stage botanical life cycles (Seed → Sprout → Growing → Mature → Blooming)',
      [
        { heading: 'Growth Stage Strips (s0 – s4)', cols: 4, cardHeight: 158, items: plantCards },
        { heading: 'Seed Packets', cols: 7, cardHeight: 132, items: plantSeedCards },
      ],
      'catalogs/plants.png',
    );
    await renderBoard(
      'islands',
      'World Progression & Customizable Terrain',
      'Live WorldScene daytime captures, customizable terrain patches & raw island geometry',
      [
        { heading: 'Curated Daytime Island Previews (Stages 1–10)', cols: 5, cardHeight: 290, items: islandPreviewCards.filter((c) => existsSync(join(outDir, c.imgRel))) },
        { heading: 'Terrain & Landscaping Patches & Transitions', cols: 5, cardHeight: 160, items: records.filter((r) => r.category === 'islands' && (r.subcategory === 'terrain' || r.subcategory === 'transitions')).map((r) => cardFor(r, 84)!).filter(Boolean) },
        { heading: 'Raw Procedural Island Geometry', cols: 5, cardHeight: 240, items: islandStageCards },
      ],
      'catalogs/islands.png',
    );
    await renderBoard(
      'all-assets',
      'Complete Game Visual Asset Master Index',
      'Unified Figma Overview Board (<4096px) across Creatures, Buildings, Decor, Nature, Terrain, Plants, Stages & FX',
      [
        { heading: 'Pipkins', cols: 15, cardHeight: 112, items: creaturesCards.map((c) => ({ ...c, maxPreviewPx: 56 })) },
        { heading: 'Buildings', cols: 7, cardHeight: 144, items: buildingCards.map((c) => ({ ...c, maxPreviewPx: 82 })) },
        { heading: 'Decorations & Thematic Sets', cols: 10, cardHeight: 118, items: decorCards.map((c) => ({ ...c, maxPreviewPx: 56 })) },
        { heading: 'Nature', cols: 9, cardHeight: 128, items: natureCards.map((c) => ({ ...c, maxPreviewPx: 66 })) },
        { heading: 'Terrain Patches & Transitions', cols: 8, cardHeight: 112, items: records.filter((r) => r.category === 'islands' && (r.subcategory === 'terrain' || r.subcategory === 'transitions')).map((r) => cardFor(r, 56)!).filter(Boolean) },
        { heading: 'Plants (Growth Strips)', cols: 7, cardHeight: 124, items: plantCards.map((c) => ({ ...c, maxPreviewPx: 140 })) },
        { heading: 'Effects & Pickups', cols: 12, cardHeight: 104, items: fxCards.map((c) => ({ ...c, maxPreviewPx: 46 })) },
      ],
      'catalogs/all-assets.png',
      2400,
    );
  } catch (err) {
    stats.errors++;
    console.warn('Warning generating catalog board:', err);
  }

  return catalogRecords;
}

export async function runBrowserCaptures(
  distDir: string,
  outDir: string,
  existingRecords: AssetRecord[],
  options: { skipExisting?: boolean } = {},
): Promise<{
  addedRecords: AssetRecord[];
  stats: BrowserCaptureStats;
}> {
  if (!existsSync(join(distDir, 'game.html'))) {
    throw new Error(`Missing built extension in ${distDir}; run "npm run build" first.`);
  }

  const stats: BrowserCaptureStats = {
    islandPreviews: 0,
    uiScreenshots: 0,
    uiComponents: 0,
    catalogs: 0,
    errors: 0,
  };
  const addedRecords: AssetRecord[] = [];
  const recById = new Map(existingRecords.map((r) => [r.id, r]));

  const chromePath = findChromiumExecutable();
  const { srv, url } = await startStaticServer(distDir);
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ executablePath: chromePath, headless: true });
    const context = await browser.newContext({ viewport: { width: 1200, height: 840 } });
    const page = await context.newPage();

    // ---------------------------------------------------------
    // PART A: Phase 4 Complete Island Previews (10 Stages x 4 ToD + Weather)
    // ---------------------------------------------------------
    for (const st of STAGES) {
      const state = buildShowcaseState(st.id, TOD_HOURS.day, { weather: 'clear' });
      await loadStateIntoPage(page, url, 'game.html', state);
      await installCleanCanvasCss(page);

      for (const tod of TIMES_OF_DAY) {
        const recId = `island-preview:stage-${st.id}:${tod}`;
        const rec = recById.get(recId);
        const relPath = `islands/previews/stage-${st.id}-${tod}.png`;
        if (options.skipExisting && existsSync(join(outDir, relPath)) && rec) {
          const dec = decodePng(new Uint8Array(readFileSync(join(outDir, relPath))));
          rec.files = [{ label: 'scene', format: 'png', path: relPath, width: dec.w, height: dec.h, scale: 1, lossless: true }];
          rec.status = 'cached';
          continue;
        }
        await page.evaluate(
          (hour) => {
            const w = window as unknown as {
              __twStore: { setTimeOverride: (c: string, h: number) => Promise<void> };
            };
            return w.__twStore.setTimeOverride('custom', hour);
          },
          TOD_HOURS[tod],
        );
        await page.waitForTimeout(320);
        const buf = await page.screenshot({ fullPage: false });
        const info = writeOutPng(outDir, relPath, buf);
        stats.islandPreviews++;
        if (rec) {
          rec.nativeWidth = info.width;
          rec.nativeHeight = info.height;
          rec.files = [{ label: 'scene', format: 'png', path: relPath, width: info.width, height: info.height, scale: 1, sha256: info.sha, lossless: true }];
          rec.status = 'exported';
        }
      }
    }

    for (const wspec of WEATHER_SHOWCASES) {
      const rec = recById.get(`island-weather:${wspec.id}`);
      const relPath = `islands/previews/${wspec.id}.png`;
      const state = buildShowcaseState(wspec.stage, TOD_HOURS[wspec.tod], { weather: wspec.weather });
      await loadStateIntoPage(page, url, 'game.html', state);
      await installCleanCanvasCss(page);
      await page.waitForTimeout(1150);
      const buf = await page.screenshot({ fullPage: false });
      const info = writeOutPng(outDir, relPath, buf);
      stats.islandPreviews++;
      if (rec) {
        rec.nativeWidth = info.width;
        rec.nativeHeight = info.height;
        rec.files = [{ label: 'scene', format: 'png', path: relPath, width: info.width, height: info.height, scale: 1, sha256: info.sha, lossless: true }];
        rec.status = 'exported';
      }
    }

    // ---------------------------------------------------------
    // PART B: Phase 5 UI Screenshots & Tight Component Specimens
    // ---------------------------------------------------------
    const uiState = buildShowcaseState(5, TOD_HOURS.day, { weather: 'clear' });
    const dryState = buildShowcaseState(5, TOD_HOURS.day, { weather: 'clear', dryPlantCount: 3 });

    const captureUiScreen = async (id: string, name: string, relPath: string, width: number, height: number) => {
      const buf = await page.screenshot({ fullPage: false });
      const info = writeOutPng(outDir, relPath, buf);
      stats.uiScreenshots++;
      addedRecords.push({
        id: `ui-screen:${id}`,
        name: `UI Screen: ${name}`,
        category: 'ui',
        subcategory: 'screenshots',
        kind: 'ui-screenshot',
        sourceModule: 'src/ui/App.vue',
        nativeWidth: width,
        nativeHeight: height,
        primaryFile: relPath,
        files: [{ label: 'screenshot', format: 'png', path: relPath, width: info.width, height: info.height, scale: 1, sha256: info.sha, lossless: true }],
        tags: ['ui', 'screenshot', id],
        status: 'exported',
      });
    };

    const captureComponent = async (id: string, name: string, selector: string, relPath: string, sourceModule: string) => {
      const loc = page.locator(selector).first();
      if ((await loc.count()) === 0) return;
      const box = await loc.boundingBox();
      if (!box || box.width < 4 || box.height < 4) return;
      const buf = await loc.screenshot();
      const info = writeOutPng(outDir, relPath, buf);
      stats.uiComponents++;
      addedRecords.push({
        id: `ui-comp:${id}`,
        name: `UI Component Specimen: ${name}`,
        category: 'ui',
        subcategory: 'components',
        kind: 'ui-component',
        sourceModule,
        nativeWidth: info.width,
        nativeHeight: info.height,
        primaryFile: relPath,
        files: [{ label: 'component-png', format: 'png', path: relPath, width: info.width, height: info.height, scale: 1, sha256: info.sha, lossless: true }],
        tags: ['ui', 'component', 'specimen', id],
        status: 'exported',
      });
    };

    // 1. Onboarding Stage 1
    await page.setViewportSize({ width: 1280, height: 800 });
    await loadStateIntoPage(page, url, 'game.html', buildShowcaseState(1, TOD_HOURS.morning, { weather: 'clear', tutorialDone: false }));
    await captureUiScreen('onboarding', 'Onboarding Card (Stage 1)', 'ui/screenshots/onboarding-card.png', 1280, 800);
    await captureComponent('onboarding-card', 'OnboardingCard', '.onboarding-card', 'ui/components/comp-onboarding-card.png', 'src/ui/OnboardingCard.vue');

    // 2. Popup surface (420x560)
    await page.setViewportSize({ width: 420, height: 560 });
    await loadStateIntoPage(page, url, 'popup.html', uiState);
    await captureUiScreen('popup-main', 'Extension Popup (420×560)', 'ui/screenshots/popup-main.png', 420, 560);

    // 3. Sidepanel surface (380x700)
    await page.setViewportSize({ width: 380, height: 700 });
    await loadStateIntoPage(page, url, 'sidepanel.html', uiState);
    await captureUiScreen('sidepanel-main', 'Chrome Side Panel (380×700)', 'ui/screenshots/sidepanel-main.png', 380, 700);

    // 4. Full Desktop World + Garden Quickbar + HUD components (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await loadStateIntoPage(page, url, 'game.html', dryState);
    await captureUiScreen('full-main', 'Full World HUD (Day, 1280×800)', 'ui/screenshots/full-main.png', 1280, 800);
    await captureUiScreen('garden-quickbar', 'Garden Quick Actions Bar', 'ui/screenshots/garden-quickbar.png', 1280, 800);
    await captureComponent('hud-top', 'Top HUD Bar', '.hud-top', 'ui/components/comp-hud-top.png', 'src/ui/App.vue');
    await captureComponent('bottom-dock', 'Bottom Action Dock', '.hud-bottom .dock', 'ui/components/comp-bottom-dock.png', 'src/ui/App.vue');

    // 5. Night glow
    await page.evaluate(() => {
      const w = window as unknown as { __twStore: { setTimeOverride: (c: string, h: number) => Promise<void> } };
      return w.__twStore.setTimeOverride('custom', 22.5);
    });
    await page.waitForTimeout(450);
    await captureUiScreen('full-night-glow', 'Full World HUD (Night & Lantern Glow)', 'ui/screenshots/full-night-glow.png', 1280, 800);
    await page.evaluate(() => {
      const w = window as unknown as { __twStore: { setTimeOverride: (c: string, h: number) => Promise<void> } };
      return w.__twStore.setTimeOverride('custom', 13.0);
    });
    await page.waitForTimeout(300);

    // 6. Time preview popover
    await page.click('button[title="Adjust Time of Day Preview"]');
    await page.waitForTimeout(220);
    await captureUiScreen('time-popover', 'Sky & Time Preview Popover', 'ui/screenshots/time-popover.png', 1280, 800);
    await page.click('button[aria-label="Close time controls"]');
    await page.waitForTimeout(150);

    // 7. Shop drawer tabs (Seeds, Buildings, Furniture)
    await page.evaluate(() => {
      (window as unknown as { __twStore: { activeTab: string } }).__twStore.activeTab = 'shop';
    });
    await page.waitForTimeout(250);
    await captureUiScreen('shop-seeds', 'Shop Drawer — Seeds', 'ui/screenshots/shop-seeds.png', 1280, 800);
    await captureComponent('shop-drawer', 'Inventory / Shop Drawer', '.panel-overlay > :first-child', 'ui/components/comp-shop-drawer.png', 'src/ui/InventoryShopDrawer.vue');

    const bldBtn = page.locator('.panel-overlay button:has-text("Buildings")').first();
    if (await bldBtn.count()) {
      await bldBtn.click();
      await page.waitForTimeout(200);
      await captureUiScreen('shop-buildings', 'Shop Drawer — Buildings', 'ui/screenshots/shop-buildings.png', 1280, 800);
    }
    const furnBtn = page.locator('.panel-overlay button:has-text("Furniture")').first();
    if (await furnBtn.count()) {
      await furnBtn.click();
      await page.waitForTimeout(200);
      await captureUiScreen('shop-furniture', 'Shop Drawer — Furniture', 'ui/screenshots/shop-furniture.png', 1280, 800);
    }
    const terrainBtn = page.locator('.panel-overlay button:has-text("Terrain & Landscaping")').first();
    if (await terrainBtn.count()) {
      await terrainBtn.click();
      await page.waitForTimeout(200);
      await captureUiScreen('shop-terrain', 'Shop Drawer — Terrain & Landscaping', 'ui/screenshots/shop-terrain.png', 1280, 800);
    }
    const seasonalBtn = page.locator('.panel-overlay button:has-text("Seasonal")').first();
    if (await seasonalBtn.count()) {
      await seasonalBtn.click();
      await page.waitForTimeout(200);
      await captureUiScreen('shop-seasonal', 'Shop Drawer — Seasonal Collections', 'ui/screenshots/shop-seasonal.png', 1280, 800);
    }

    // 8. Inventory / Bag + Sell ledger
    await page.evaluate(() => {
      (window as unknown as { __twStore: { activeTab: string } }).__twStore.activeTab = 'inventory';
    });
    await page.waitForTimeout(250);
    const sellBtn = page.locator('.panel-overlay .sell-chip').first();
    if (await sellBtn.count()) {
      await sellBtn.click();
      await page.waitForTimeout(200);
    }
    await captureUiScreen('inventory-bag', 'Inventory Bag & Sell Ledger', 'ui/screenshots/inventory-bag.png', 1280, 800);

    // 9. Creatures Panel
    await page.evaluate(() => {
      (window as unknown as { __twStore: { activeTab: string } }).__twStore.activeTab = 'creatures';
    });
    await page.waitForTimeout(250);
    await captureUiScreen('creatures-panel', 'Pipkins Companions Panel', 'ui/screenshots/creatures-panel.png', 1280, 800);
    await captureComponent('creatures-panel', 'CreaturesPanel', '.panel-overlay > :first-child', 'ui/components/comp-creatures-panel.png', 'src/ui/CreaturesPanel.vue');

    // 10. Journal, Achievements & Expand Island
    await page.evaluate(() => {
      (window as unknown as { __twStore: { activeTab: string } }).__twStore.activeTab = 'journal';
    });
    await page.waitForTimeout(250);
    await captureUiScreen('journal-discoveries', 'Island Journal — Discoveries', 'ui/screenshots/journal-discoveries.png', 1280, 800);
    await captureComponent('journal-panel', 'JournalPanel', '.panel-overlay > :first-child', 'ui/components/comp-journal-panel.png', 'src/ui/JournalPanel.vue');

    await page.evaluate(() => {
      (window as unknown as { __twStore: { activeTab: string } }).__twStore.activeTab = 'none';
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      (window as unknown as { __twStore: { activeTab: string } }).__twStore.activeTab = 'achievements';
    });
    await page.waitForTimeout(250);
    await captureUiScreen('achievements-list', 'Achievements Panel', 'ui/screenshots/achievements-list.png', 1280, 800);

    await page.evaluate(() => {
      (window as unknown as { __twStore: { activeTab: string } }).__twStore.activeTab = 'none';
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      (window as unknown as { __twStore: { activeTab: string } }).__twStore.activeTab = 'expand';
    });
    await page.waitForTimeout(250);
    await captureUiScreen('expand-island', 'Island Expansion & Biome Roadmap', 'ui/screenshots/expand-island.png', 1280, 800);

    // 11. Settings Modal
    await page.evaluate(() => {
      (window as unknown as { __twStore: { activeTab: string } }).__twStore.activeTab = 'settings';
    });
    await page.waitForTimeout(250);
    await captureUiScreen('settings-modal', 'Settings & Save Management Modal', 'ui/screenshots/settings-modal.png', 1280, 800);
    await captureComponent('settings-modal', 'SettingsModal', '.panel-overlay > :first-child', 'ui/components/comp-settings-modal.png', 'src/ui/SettingsModal.vue');

    // 12. Inspectors & Placement Mode & Welcome Back Toast
    await page.evaluate(() => {
      const w = window as unknown as {
        __twStore: {
          activeTab: string;
          selectedObjectId: string | null;
          selectedCreatureId: string | null;
          state: { objects: { id: string; plant?: unknown }[]; creatures: { id: string }[] };
        };
      };
      w.__twStore.activeTab = 'none';
      const plantObj = w.__twStore.state.objects.find((o) => Boolean(o.plant));
      w.__twStore.selectedCreatureId = null;
      w.__twStore.selectedObjectId = plantObj?.id ?? w.__twStore.state.objects[0]?.id ?? null;
    });
    await page.waitForTimeout(220);
    await captureUiScreen('object-inspector', 'Contextual Plant / Object Inspector', 'ui/screenshots/object-inspector.png', 1280, 800);

    await page.evaluate(() => {
      const w = window as unknown as {
        __twStore: {
          selectedObjectId: string | null;
          selectedCreatureId: string | null;
          state: { creatures: { id: string }[] };
        };
      };
      w.__twStore.selectedObjectId = null;
      w.__twStore.selectedCreatureId = w.__twStore.state.creatures[0]?.id ?? null;
    });
    await page.waitForTimeout(220);
    await captureUiScreen('creature-inspector', 'Selected Pipkin Context Card', 'ui/screenshots/creature-inspector.png', 1280, 800);

    const placementItemId =
      ITEMS.find((i) => i.category === 'lighting' && !i.scenery && i.stage <= 5)?.id ??
      ITEMS.find((i) => i.rotatable && !i.scenery)?.id ??
      'bench';
    await page.evaluate((itemId) => {
      const w = window as unknown as {
        __twStore: {
          selectedCreatureId: string | null;
          startPlaceDecor: (id: string) => void;
          cursorCell: { gx: number; gy: number };
        };
      };
      w.__twStore.selectedCreatureId = null;
      w.__twStore.cursorCell = { gx: 10, gy: 10 };
      w.__twStore.startPlaceDecor(itemId);
    }, placementItemId);
    await page.waitForTimeout(250);
    await captureUiScreen('placement-mode', 'Build & Placement Isometric Mode', 'ui/screenshots/placement-mode.png', 1280, 800);

    await page.evaluate(() => {
      const w = window as unknown as {
        __twStore: {
          cancelBuild: () => void;
          welcomeLines: string[];
        };
      };
      w.__twStore.cancelBuild();
      w.__twStore.welcomeLines = [
        'Your Pipkins tended the meadow while you were away.',
        '2 flowers bloomed in full sunshine (+48 Nature Tokens ready).',
        'Dewdrop left a shining pearl near the eastern pond.',
      ];
    });
    await page.waitForTimeout(220);
    await captureUiScreen('welcome-back-toast', 'Offline Welcome Back Digest Card', 'ui/screenshots/welcome-back-toast.png', 1280, 800);

    // ---------------------------------------------------------
    // PART C: Phase 6 Labeled Catalog Overview Boards
    // ---------------------------------------------------------
    const catalogPage = await browser.newPage();
    const catalogs = await renderCatalogBoards(catalogPage, outDir, existingRecords, stats);
    addedRecords.push(...catalogs);
  } finally {
    if (browser) await browser.close();
    srv.close();
  }

  return { addedRecords, stats };
}
