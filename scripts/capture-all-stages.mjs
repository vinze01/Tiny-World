import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const DIST = resolve(rootDir, 'dist');
const OUT_DIR = resolve(rootDir, 'showcase/assets');
mkdirSync(OUT_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function startServer() {
  return new Promise((res) => {
    const srv = createServer((req, reply) => {
      const clean = (req.url ?? '/game.html').split('?')[0];
      const file = resolve(DIST, '.' + (clean === '/' ? '/game.html' : clean));
      if (!file.startsWith(DIST) || !existsSync(file)) {
        reply.writeHead(404);
        reply.end('Not found');
        return;
      }
      reply.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
      reply.end(readFileSync(file));
    });
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      res({ srv, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

const chromePath = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));

if (!chromePath) {
  console.error('No Chromium browser found.');
  process.exit(1);
}

// ---------------------------------------------------------------- scene helpers
const obj = (id, type, gx, gy, rot = 0) => ({ id, type, gx, gy, rot });
const plant = (id, plantId, gx, gy, stage = 4) => ({
  id,
  type: plantId,
  gx,
  gy,
  rot: 0,
  plant: { plantId, plantedAt: Date.now() - 3600000, wateredAt: Date.now(), stage, harvestCount: 0 },
});
const row = (prefix, type, gx, gy, count) =>
  Array.from({ length: count }, (_, i) => obj(`${prefix}_${i}`, type, gx + i, gy));

// The only water tiles that exist on any stage (ponds are painted into newly
// expanded cells only, so later "pond" zones stay grass). Verified against
// terrainMap() in src/core/grid.ts.
const STAGE6_WATER = new Set(['4,3', '5,3', '12,3', '3,4', '4,4', '5,4', '12,4']);

// Mirrors inRoundedBounds() from src/core/grid.ts
const inRoundedBounds = (gx, gy, n) => {
  if (gx < 0 || gy < 0 || gx >= n || gy >= n) return false;
  const bevel = Math.max(1, Math.floor(n / 7));
  if (gx + gy < 1) return false;
  if (gx + gy > (n - 1) * 2 - bevel) return false;
  if (gx - gy > n - 1 - bevel) return false;
  if (gy - gx > n - 1 - bevel) return false;
  return true;
};

/**
 * Paint every land tile of an island, plus a hidden one-tile "mask halo" over the
 * surrounding void. The renderer skips sprites on void tiles, but the halo makes
 * edge tiles treat the abyss as the same material, so no green grass fringe shows.
 */
const fullTerrain = (n, kind) => {
  const map = {};
  for (let gy = 0; gy < n; gy++) {
    for (let gx = 0; gx < n; gx++) {
      if (!inRoundedBounds(gx, gy, n) || STAGE6_WATER.has(`${gx},${gy}`)) continue;
      map[`${gx},${gy}`] = kind;
    }
  }
  for (const key of Object.keys(map)) {
    const [gx, gy] = key.split(',').map(Number);
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nk = `${gx + dx},${gy + dy}`;
      if (map[nk] || STAGE6_WATER.has(nk)) continue;
      map[nk] = kind;
    }
  }
  // Ponds stay water visually (the renderer skips these cells), but tagging them
  // lets shoreline tiles extend the snow/sand right up to the water instead of
  // drawing a grass fringe along the bank.
  for (const key of STAGE6_WATER) map[key] = kind;
  return map;
};
const FULL_SNOW_26 = fullTerrain(26, 'snow');
const FULL_SAND_26 = fullTerrain(26, 'sand');

const { srv, url } = await startServer();
const browser = await chromium.launch({ executablePath: chromePath, headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 960, height: 640 } });
  const page = await context.newPage();

  console.log('Loading game surface at ' + url + '...');
  await page.goto(`${url}/game.html?e2e=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.world-canvas canvas', { timeout: 30000 });
  await page.waitForTimeout(600);

  // Hide UI overlays so ONLY the pure canvas diorama, sky, and atmosphere are rendered
  await page.addStyleTag({
    content: `.app-shell > *:not(.world-canvas) { display: none !important; opacity: 0 !important; pointer-events: none !important; }`,
  });

  const captureStage = async (config) => {
    console.log(`Configuring & capturing: ${config.filename} (${config.title})...`);
    await page.evaluate(async (cfg) => {
      const store = window.__twStore;
      const res = await store.saveStore.mutateWith((s, { now }) => {
        s.tutorial = { step: 5, done: true, skipped: true, tappedTree: true, tappedPond: true, tappedCreature: true };
        s.stage = cfg.stage;
        s.tokens = 999;

        // Settings
        s.settings.cycle = cfg.cycle || 'custom';
        s.settings.manualHour = cfg.hour !== undefined ? cfg.hour : 10.5;
        s.settings.biomeOverride = cfg.biomeOverride || null;

        // Weather
        if (cfg.weather) {
          s.settings.weatherEnabled = true;
          s.settings.particleDensity = 'high';
          s.events.weather = cfg.weather;
          s.events.weatherUntil = Date.now() + 3600000;
        } else {
          s.events.weather = 'clear';
          s.events.weatherUntil = 0;
        }

        // Custom terrain patches
        s.customTerrain = cfg.customTerrain || {};

        // Placed objects & furniture
        s.objects = cfg.objects || [];

        // Creatures
        s.creatures = (cfg.creatures || []).map((c) => ({
          id: c.id,
          name: c.name || c.id,
          emotion: c.emotion || 'happy',
          affection: 50,
          discoveredAt: now,
          lastPetRewardAt: 0,
          lastPetAt: 0,
          lastFedAt: 0,
          petCount: 0,
          fedCount: 0,
        }));

        return { ok: true, effects: [] };
      });

      if (!res.result.ok) throw new Error(res.result.reason || 'Could not set up capture');
      // Update Pinia store state so WorldScene detects the new stage
      store.state = res.state;
      store.activeTab = 'none';
      store.selectedObjectId = null;
      store.selectedCreatureId = null;
      store.buildMode = { kind: 'none' };
      store.multiSelectMode = false;

      // Center camera on the new stage
      store.worldHooks?.centerCamera?.();
      if (cfg.zoomDelta && store.worldHooks?.zoomBy) {
        store.worldHooks.zoomBy(cfg.zoomDelta);
      }
    }, config);

    await page.waitForTimeout(700);
    const shotPath = resolve(OUT_DIR, config.filename);
    await page.screenshot({ path: shotPath });
    console.log(`Saved: ${shotPath}`);
  };

  // 1. Stage 1 — Little Meadow (8×8)
  await captureStage({
    stage: 1,
    title: 'Stage 1 — Little Meadow',
    filename: 'stage1-meadow.png',
    hour: 10,
    zoomDelta: 0.15,
    objects: [
      obj('s1_bench', 'bench', 1, 2),
      obj('s1_birdhouse', 'birdhouse', 3, 1),
      obj('s1_lantern', 'lantern', 6, 2),
      obj('s1_pot', 'pot', 6, 3),
      obj('s1_fence1', 'fence', 1, 5),
      obj('s1_fence2', 'fence', 2, 5),
      obj('s1_bridge', 'bridge', 4, 4),
      obj('s1_path1', 'path', 3, 6),
      obj('s1_path2', 'path', 4, 6),
      plant('s1_daisy', 'daisy', 6, 5),
    ],
    creatures: [{ id: 'mossi', name: 'Mossi', gx: 2, gy: 3, state: 'idle', emotion: 'happy' }],
  });

  // 2. Stage 2 — Blooming Grove (12×12)
  await captureStage({
    stage: 2,
    title: 'Stage 2 — Blooming Grove',
    filename: 'stage2-grove.png',
    hour: 11,
    zoomDelta: 0.05,
    objects: [
      obj('s2_shed', 'shed', 2, 2),
      obj('s2_tea', 'tea_set', 5, 2),
      obj('s2_picnic', 'picnic_table', 7, 2),
      obj('s2_birch', 'birch', 10, 2),
      obj('s2_lantern', 'lantern', 11, 4),
      obj('s2_bed', 'flower_bed', 1, 6),
      obj('s2_deck1', 'wood_deck', 7, 5),
      obj('s2_deck2', 'wood_deck', 8, 5),
      plant('s2_bluebell', 'bluebell', 9, 7),
      obj('s2_pot', 'pot', 3, 7),
      obj('s2_fence1', 'fence', 5, 8),
      obj('s2_fence2', 'fence', 6, 8),
      obj('s2_path1', 'path', 2, 5),
      obj('s2_path2', 'path', 3, 5),
      obj('s2_path3', 'path', 8, 10),
      obj('s2_path4', 'path', 9, 10),
      obj('s2_lantern2', 'lantern', 7, 11),
      obj('s2_bed2', 'flower_bed', 10, 10),
    ],
    creatures: [
      { id: 'mossi', name: 'Mossi', gx: 4, gy: 5, state: 'wander', emotion: 'happy' },
      { id: 'sprig', name: 'Sprig', gx: 6, gy: 4, state: 'curious', emotion: 'excited' },
    ],
  });

  // 3. Stage 3 — Crystal Pond (16×16)
  await captureStage({
    stage: 3,
    title: 'Stage 3 — Crystal Pond',
    filename: 'stage3-pond.png',
    hour: 10.5,
    zoomDelta: 0,
    objects: [
      obj('s3_cottage', 'cottage', 2, 2),
      obj('s3_well', 'well', 6, 2),
      obj('s3_willow', 'willow', 9, 2),
      obj('s3_lantern1', 'lantern', 4, 2),
      obj('s3_bridge', 'bridge', 12, 3),
      obj('s3_stepping', 'stepping_stones', 4, 4),
      obj('s3_reeds', 'reeds', 12, 4),
      obj('s3_reeds2', 'reeds', 5, 3),
      plant('s3_sunflower', 'sunflower', 7, 4),
      plant('s3_daisy', 'daisy', 7, 5),
      plant('s3_bluebell', 'bluebell', 6, 6),
      obj('s3_lantern2', 'lantern', 11, 6),
      obj('s3_pot', 'pot', 13, 3),
      obj('s3_stonebench', 'stone_bench', 3, 7),
      obj('s3_campfire', 'campfire', 2, 8),
      obj('s3_fence1', 'fence', 5, 8),
      obj('s3_fence2', 'fence', 6, 8),
      obj('s3_flowerbed', 'flower_bed', 10, 7),
      obj('s3_path1', 'path', 3, 5),
      obj('s3_path2', 'path', 4, 5),
      obj('s3_path3', 'path', 4, 6),
      obj('s3_path4', 'path', 10, 12),
      obj('s3_path5', 'path', 11, 12),
      obj('s3_path6', 'path', 10, 13),
      obj('s3_path7', 'path', 11, 13),
      obj('s3_bench2', 'stone_bench', 12, 13),
      obj('s3_lantern3', 'lantern', 13, 14),
      obj('s3_flowerbed2', 'flower_bed', 9, 14),
    ],
    creatures: [
      { id: 'mossi', name: 'Mossi', gx: 4, gy: 7, state: 'idle', emotion: 'happy' },
      { id: 'bloop', name: 'Bloop', gx: 5, gy: 7, state: 'wander', emotion: 'curious' },
    ],
  });

  // 4. Stage 4 — Moonlit Garden (20×20)
  await captureStage({
    stage: 4,
    title: 'Stage 4 — Moonlit Garden',
    filename: 'stage4-garden.png',
    hour: 16.5,
    zoomDelta: -0.05,
    objects: [
      obj('s4_greenhouse', 'greenhouse', 2, 2),
      obj('s4_gazebo', 'gazebo', 5, 2),
      obj('s4_cherry', 'cherry', 9, 2),
      obj('s4_lantern1', 'lantern', 13, 3),
      obj('s4_fairylights', 'fairy_lights', 7, 4),
      obj('s4_globe', 'gazing_globe', 7, 6),
      obj('s4_stonebench1', 'stone_bench', 4, 8),
      obj('s4_stonebench2', 'stone_bench', 10, 6),
      plant('s4_moonflower', 'moonflower', 11, 7),
      plant('s4_bluebell', 'bluebell', 8, 5),
      obj('s4_pot', 'pot', 5, 7),
      obj('s4_path1', 'path', 6, 7),
      obj('s4_path2', 'path', 6, 8),
      obj('s4_path3', 'path', 7, 8),
      obj('s4_path4', 'path', 8, 8),
      obj('s4_flowerbed', 'flower_bed', 6, 9),
      obj('s4_glowshrooms', 'glow_shrooms', 12, 9),
      obj('s4_fence1', 'fence', 2, 10),
      obj('s4_fence2', 'fence', 3, 10),
      obj('s4_bridge1', 'bridge', 4, 4),
      obj('s4_bridge2', 'stepping_stones', 5, 4),
      obj('s4_reeds', 'reeds', 5, 3),
      obj('s4_stones', 'stones', 15, 9),
      obj('s4_lantern2', 'lantern', 1, 6),
      obj('s4_path5', 'path', 8, 12),
      obj('s4_path6', 'path', 9, 12),
      obj('s4_path7', 'path', 8, 13),
      obj('s4_path8', 'path', 9, 13),
      obj('s4_stonebench3', 'stone_bench', 11, 13),
      obj('s4_lantern3', 'lantern', 12, 14),
      obj('s4_flowerbed2', 'flower_bed', 10, 15),
      obj('s4_globe2', 'gazing_globe', 13, 15),
      obj('s4_pot2', 'pot', 7, 14),
      obj('s4_glowshrooms2', 'glow_shrooms', 14, 16),
    ],
    creatures: [
      { id: 'mossi', name: 'Mossi', gx: 4, gy: 6, state: 'idle', emotion: 'relaxed' },
      { id: 'puffin', name: 'Puffin', gx: 9, gy: 5, state: 'wander', emotion: 'happy' },
    ],
  });

  // 5. Stage 5 — Cloud Sanctuary (24×24)
  await captureStage({
    stage: 5,
    title: 'Stage 5 — Cloud Sanctuary',
    filename: 'stage5-sanctuary.png',
    hour: 12,
    zoomDelta: -0.1,
    objects: [
      obj('s5_shelter', 'shelter', 2, 2),
      obj('s5_windmill', 'windmill', 6, 2),
      obj('s5_teahouse', 'teahouse', 13, 2),
      obj('s5_cloudtree', 'cloud_tree', 15, 3),
      obj('s5_pot', 'pot', 1, 4),
      obj('s5_flowerbed', 'flower_bed', 16, 5),
      obj('s5_windchime', 'windchime', 19, 5),
      obj('s5_path1', 'path', 5, 6),
      obj('s5_path2', 'path', 5, 7),
      obj('s5_path3', 'path', 4, 8),
      obj('s5_path4', 'path', 5, 8),
      obj('s5_path5', 'path', 6, 8),
      obj('s5_hammock', 'hammock', 2, 7),
      obj('s5_stargazer', 'stargazer', 6, 7),
      obj('s5_lamp1', 'celestial_lamp', 10, 6),
      obj('s5_globe', 'gazing_globe', 12, 7),
      obj('s5_lamp2', 'celestial_lamp', 14, 6),
      plant('s5_starbloom', 'starbloom', 9, 8),
      plant('s5_moonflower', 'moonflower', 9, 9),
      obj('s5_tea', 'tea_set', 7, 9),
      obj('s5_fence1', 'fence', 4, 10),
      obj('s5_fence2', 'fence', 5, 10),
      obj('s5_fence3', 'fence', 6, 10),
      obj('s5_mosaic1', 'mosaic_path', 13, 10),
      obj('s5_mosaic2', 'mosaic_path', 14, 10),
      obj('s5_bridge1', 'bridge', 4, 4),
      obj('s5_bridge2', 'lily_stepping', 5, 4),
      obj('s5_reeds', 'reeds', 5, 3),
      plant('s5_starbloom2', 'starbloom', 19, 9),
      obj('s5_mosaic3', 'mosaic_path', 10, 14),
      obj('s5_mosaic4', 'mosaic_path', 11, 14),
      obj('s5_mosaic5', 'mosaic_path', 10, 15),
      obj('s5_mosaic6', 'mosaic_path', 11, 15),
      obj('s5_globe2', 'gazing_globe', 13, 15),
      obj('s5_bench2', 'stone_bench', 9, 16),
      obj('s5_lamp3', 'celestial_lamp', 14, 16),
      obj('s5_flowerbed2', 'flower_bed', 12, 17),
      obj('s5_tea2', 'tea_set', 15, 17),
      obj('s5_windchime2', 'windchime', 8, 17),
      obj('s5_hammock2', 'hammock', 13, 18),
    ],
    creatures: [
      { id: 'nimbus', name: 'Nimbus', gx: 8, gy: 5, state: 'wander', emotion: 'excited' },
      { id: 'glimmer', name: 'Glimmer', gx: 13, gy: 7, state: 'curious', emotion: 'happy' },
    ],
  });

  // 6. Stage 6 — Frostfall Haven (26×26)
  await captureStage({
    stage: 6,
    title: 'Stage 6 — Frostfall Haven',
    filename: 'stage6-frostfall.png',
    hour: 11,
    zoomDelta: 0.08,
    customTerrain: {
      '5,4': 'snow', '6,4': 'snow', '7,4': 'snow', '8,4': 'snow',
      '5,5': 'snow', '6,5': 'snow', '7,5': 'snow', '8,5': 'snow', '9,5': 'snow',
      '5,6': 'snow', '6,6': 'snow', '7,6': 'snow', '8,6': 'snow', '9,6': 'snow',
      '6,7': 'snow', '7,7': 'snow', '8,7': 'snow',
    },
    objects: [
      obj('s6_lodge', 'ski_lodge', 2, 2),
      obj('s6_cocoa', 'hot_cocoa', 6, 3),
      obj('s6_pine1', 'snow_pine', 9, 2),
      obj('s6_pine2', 'snow_pine', 13, 2),
      obj('s6_snowman1', 'snowman', 7, 5),
      obj('s6_bench1', 'snow_bench', 9, 5),
      obj('s6_crystal1', 'ice_crystal', 11, 5),
      obj('s6_icelantern1', 'ice_lantern', 6, 7),
      obj('s6_fort1', 'snow_fort', 3, 7),
      obj('s6_reindeer1', 'reindeer', 14, 4),
      obj('s6_tree1', 'christmas_tree', 16, 4),
      obj('s6_gifts1', 'gift_boxes', 14, 6),
      obj('s6_candy1', 'candy_cane', 15, 5),
      obj('s6_sleigh', 'santas_sleigh', 17, 6),
      obj('s6_pine3', 'snow_pine', 20, 3),
      obj('s6_bench2', 'snow_bench', 5, 9),
      obj('s6_icelantern2', 'ice_lantern', 10, 8),
      obj('s6_paving1', 'frost_paving', 8, 6),
      obj('s6_paving2', 'frost_paving', 8, 7),
      obj('s6_paving3', 'frost_paving', 9, 6),
      obj('s6_paving4', 'frost_paving', 9, 7),
      obj('s6_paving5', 'frost_paving', 10, 6),
      obj('s6_paving6', 'frost_paving', 10, 7),
      obj('s6_pot', 'pot', 1, 5),
      obj('s6_bridge', 'frost_paving', 22, 10),
      obj('s6_reeds', 'ice_lantern', 23, 9),
      obj('s6_flowerbed', 'flower_bed', 6, 10),
      obj('s6_fort2', 'snow_fort', 18, 8),
      obj('s6_crystal2', 'ice_crystal', 12, 8),
      obj('s6_snowman2', 'snowman', 20, 6),
      obj('s6_icelantern3', 'ice_lantern', 18, 5),
      obj('s6_paving7', 'frost_paving', 12, 16),
      obj('s6_paving8', 'frost_paving', 13, 16),
      obj('s6_paving9', 'frost_paving', 12, 17),
      obj('s6_paving10', 'frost_paving', 13, 17),
      obj('s6_bench3', 'stone_bench', 15, 16),
      obj('s6_crystal3', 'ice_crystal', 14, 18),
      obj('s6_pine4', 'snow_pine', 16, 18),
      obj('s6_globe2', 'gazing_globe', 11, 19),
      obj('s6_tea2', 'tea_set', 17, 19),
      obj('s6_windchime', 'windchime', 15, 20),
    ],
    creatures: [
      { id: 'flurry', name: 'Flurry', gx: 7, gy: 4, state: 'idle', emotion: 'happy' },
      { id: 'frosty', name: 'Frosty', gx: 12, gy: 6, state: 'wander', emotion: 'curious' },
      { id: 'mossi', name: 'Mossi', gx: 4, gy: 6, state: 'idle', emotion: 'relaxed' },
    ],
  });

  // 7. Stage 7 — Mistwood Hollow (28×28)
  await captureStage({
    stage: 7,
    title: 'Stage 7 — Mistwood Hollow',
    filename: 'stage7-mistwood.png',
    hour: 9,
    zoomDelta: 0,
    objects: [
      obj('s7_workshop', 'workshop', 2, 2),
      obj('s7_alchemy', 'alchemy_hut', 6, 2),
      obj('s7_statue', 'moss_statue', 10, 2),
      obj('s7_maple', 'autumn_maple', 8, 5),
      obj('s7_cart', 'harvest_cart', 13, 4),
      obj('s7_lantern1', 'lantern', 17, 4),
      obj('s7_fence1', 'fence', 14, 6),
      obj('s7_fence2', 'fence', 15, 6),
      obj('s7_fence3', 'fence', 16, 6),
      obj('s7_fern1', 'mist_fern', 12, 6),
      obj('s7_lamp1', 'willow_wisp_lamp', 7, 7),
      obj('s7_flowerbed', 'flower_bed', 9, 7),
      plant('s7_orchid1', 'mistorchid', 10, 7),
      obj('s7_fern2', 'mist_fern', 15, 9),
      obj('s7_lantern2', 'lantern', 13, 8),
      obj('s7_lamp2', 'willow_wisp_lamp', 11, 8),
      obj('s7_bench', 'bench', 8, 10),
      obj('s7_tea', 'tea_set', 4, 9),
      obj('s7_pot', 'pot', 2, 9),
      obj('s7_cobble1', 'amber_cobble', 5, 5),
      obj('s7_cobble2', 'amber_cobble', 6, 5),
      obj('s7_cobble3', 'amber_cobble', 7, 5),
      obj('s7_cobble4', 'amber_cobble', 5, 6),
      obj('s7_cobble5', 'amber_cobble', 6, 6),
      obj('s7_bush', 'bush', 17, 8),
      obj('s7_mushrooms', 'mushrooms', 18, 6),
      obj('s7_path1', 'path', 12, 9),
      obj('s7_path2', 'path', 12, 10),
      obj('s7_deck1', 'wood_deck', 10, 11),
      obj('s7_deck2', 'wood_deck', 11, 11),
      obj('s7_deck3', 'wood_deck', 10, 12),
      obj('s7_deck4', 'wood_deck', 11, 12),
      plant('s7_orchid2', 'mistorchid', 10, 8),
      obj('s7_fern3', 'mist_fern', 6, 21),
      obj('s7_stones', 'stones', 6, 22),
      obj('s7_mushrooms2', 'mushrooms', 7, 23),
      plant('s7_orchid3', 'mistorchid', 10, 22),
      obj('s7_cobble6', 'amber_cobble', 16, 20),
      obj('s7_cobble7', 'amber_cobble', 17, 20),
      obj('s7_cobble8', 'amber_cobble', 18, 20),
      obj('s7_cobble9', 'amber_cobble', 16, 21),
      obj('s7_cobble10', 'amber_cobble', 17, 21),
      obj('s7_maple2', 'autumn_maple', 20, 21),
      obj('s7_bench2', 'bench', 18, 22),
      obj('s7_lamp3', 'willow_wisp_lamp', 19, 23),
      obj('s7_fern4', 'mist_fern', 17, 24),
      obj('s7_mushrooms3', 'mushrooms', 16, 23),
      obj('s7_path3', 'path', 18, 24),
      obj('s7_path4', 'path', 19, 24),
    ],
    creatures: [
      { id: 'wisp', name: 'Wisp', gx: 8, gy: 6, state: 'wander', emotion: 'curious' },
      { id: 'pebble', name: 'Pebble', gx: 5, gy: 8, state: 'idle', emotion: 'relaxed' },
    ],
  });

  // 8. Stage 8 — Emberglow Valley (30×30)
  await captureStage({
    stage: 8,
    title: 'Stage 8 — Emberglow Valley',
    filename: 'stage8-emberglow.png',
    hour: 17.5,
    zoomDelta: -0.06,
    objects: [
      obj('s8_bathhouse', 'bathhouse', 2, 6),
      obj('s8_hottub1', 'hot_tub', 8, 3),
      obj('s8_basalt1', 'basalt_spire', 13, 3),
      obj('s8_fern1', 'ember_fern', 6, 6),
      obj('s8_brazier1', 'ember_brazier', 9, 6),
      obj('s8_campfire', 'campfire', 12, 6),
      obj('s8_hottub2', 'hot_tub', 5, 9),
      obj('s8_fern2', 'ember_fern', 10, 8),
      obj('s8_basalt2', 'basalt_spire', 14, 5),
      obj('s8_spinners', 'fire_spinners', 16, 3),
      obj('s8_lantern1', 'lantern', 1, 4),
      obj('s8_lantern2', 'lantern', 7, 5),
      obj('s8_lantern3', 'lantern', 15, 7),
      obj('s8_path1', 'path', 4, 5),
      obj('s8_path2', 'path', 5, 5),
      obj('s8_path3', 'path', 6, 5),
      obj('s8_path4', 'path', 4, 6),
      obj('s8_path5', 'path', 5, 6),
      obj('s8_pot', 'pot', 18, 4),
      obj('s8_flowerbed', 'flower_bed', 11, 9),
      obj('s8_stonebench', 'stone_bench', 8, 10),
      obj('s8_gazebo', 'gazebo', 13, 8),
      obj('s8_bench', 'bench', 3, 10),
      obj('s8_fence1', 'fence', 16, 6),
      obj('s8_fence2', 'fence', 17, 6),
      obj('s8_fence3', 'fence', 18, 6),
      obj('s8_windchime', 'windchime', 19, 5),
      obj('s8_tea', 'tea_set', 6, 11),
      obj('s8_globe', 'gazing_globe', 12, 10),
      obj('s8_fern3', 'ember_fern', 14, 9),
      obj('s8_basalt3', 'basalt_spire', 2, 11),
      obj('s8_brazier2', 'ember_brazier', 17, 8),
      plant('s8_pepper1', 'emberpepper', 20, 6),
      obj('s8_log', 'log', 7, 12),
      obj('s8_stones', 'stones', 9, 11),
      obj('s8_path6', 'path', 10, 10),
      obj('s8_path7', 'path', 11, 10),
      obj('s8_fern4', 'ember_fern', 23, 20),
      obj('s8_stones2', 'stones', 23, 21),
      obj('s8_log2', 'log', 24, 22),
      plant('s8_pepper2', 'emberpepper', 24, 24),
    ],
    creatures: [
      { id: 'ember', name: 'Ember', gx: 9, gy: 7, state: 'wander', emotion: 'excited' },
      { id: 'cinder', name: 'Cinder', gx: 12, gy: 7, state: 'idle', emotion: 'happy' },
    ],
  });

  // 9. Stage 9 — Starlight Isles (32×32)
  await captureStage({
    stage: 9,
    title: 'Stage 9 — Starlight Isles',
    filename: 'stage9-starlight.png',
    hour: 19.5,
    zoomDelta: -0.12,
    objects: [
      obj('s9_observatory', 'observatory', 2, 6),
      obj('s9_planetarium', 'planetarium', 8, 3),
      obj('s9_stardial', 'star_dial', 13, 3),
      obj('s9_starwillow', 'star_willow', 16, 4),
      obj('s9_lantern', 'lantern', 20, 5),
      obj('s9_fairylights1', 'fairy_lights', 18, 8),
      obj('s9_nebula1', 'nebula_orb', 11, 6),
      obj('s9_lamp1', 'celestial_lamp', 6, 6),
      obj('s9_lamp2', 'celestial_lamp', 15, 7),
      obj('s9_globe', 'gazing_globe', 9, 8),
      obj('s9_stargazer', 'stargazer', 13, 8),
      obj('s9_paving1', 'star_paving', 7, 7),
      obj('s9_paving2', 'star_paving', 8, 7),
      obj('s9_paving3', 'star_paving', 9, 7),
      obj('s9_paving4', 'star_paving', 7, 8),
      obj('s9_paving5', 'star_paving', 8, 8),
      obj('s9_paving6', 'star_paving', 7, 9),
      obj('s9_paving7', 'star_paving', 8, 9),
      obj('s9_paving8', 'star_paving', 9, 9),
      obj('s9_paving9', 'star_paving', 10, 9),
      obj('s9_paving10', 'star_paving', 11, 9),
      obj('s9_paving11', 'star_paving', 12, 11),
      obj('s9_paving12', 'star_paving', 13, 11),
      obj('s9_paving13', 'star_paving', 12, 12),
      obj('s9_paving14', 'star_paving', 13, 12),
      obj('s9_paving15', 'star_paving', 14, 12),
      obj('s9_gazebo', 'gazebo', 17, 6),
      obj('s9_fence1', 'fence', 18, 4),
      obj('s9_fence2', 'fence', 19, 4),
      obj('s9_pot1', 'pot', 2, 5),
      obj('s9_flowerbed', 'flower_bed', 12, 10),
      obj('s9_stonebench', 'stone_bench', 5, 10),
      obj('s9_tea', 'tea_set', 4, 12),
      plant('s9_novabloom1', 'novabloom', 10, 5),
      obj('s9_bench', 'bench', 15, 10),
      obj('s9_windchime', 'windchime', 6, 9),
      obj('s9_fairylights2', 'fairy_lights', 2, 8),
      obj('s9_pot2', 'pot', 19, 7),
      obj('s9_nebula2', 'nebula_orb', 16, 9),
      obj('s9_lamp3', 'celestial_lamp', 21, 8),
      obj('s9_paving16', 'star_paving', 14, 26),
      obj('s9_stones', 'stones', 14, 27),
      obj('s9_flowerbed2', 'flower_bed', 15, 28),
      plant('s9_novabloom2', 'novabloom', 17, 28),
    ],
    creatures: [
      { id: 'luna', name: 'Luna', gx: 8, gy: 5, state: 'idle', emotion: 'curious' },
      { id: 'astra', name: 'Astra', gx: 10, gy: 6, state: 'wander', emotion: 'happy' },
      { id: 'glimmer', name: 'Glimmer', gx: 14, gy: 7, state: 'wander', emotion: 'happy' },
    ],
  });

  // 10. Stage 10 — Everdream Paradise (36×36)
  await captureStage({
    stage: 10,
    title: 'Stage 10 — Everdream Paradise',
    filename: 'stage10-everdream.png',
    hour: 14,
    zoomDelta: 0,
    objects: [
      obj('s10_pavilion', 'dream_pavilion', 4, 6),
      obj('s10_planetarium', 'planetarium', 9, 3),
      obj('s10_teahouse', 'teahouse', 14, 3),
      obj('s10_bathhouse', 'bathhouse', 19, 4),
      obj('s10_cloudtree', 'cloud_tree', 28, 5),
      obj('s10_windchime', 'windchime', 24, 5),
      obj('s10_fence1', 'fence', 17, 6),
      obj('s10_fence2', 'fence', 18, 6),
      obj('s10_stonebench', 'stone_bench', 11, 7),
      obj('s10_flowerbed', 'flower_bed', 7, 7),
      obj('s10_pot1', 'pot', 2, 6),
      obj('s10_tea', 'tea_set', 6, 12),
      obj('s10_observatory', 'observatory', 5, 10),
      obj('s10_bench', 'bench', 13, 10),
      obj('s10_gazebo', 'gazebo', 12, 8),
      obj('s10_fountain', 'harmony_fountain', 16, 9),
      obj('s10_everdreamtree', 'everdream_tree', 22, 6),
      obj('s10_starwillow', 'star_willow', 26, 9),
      obj('s10_nebula', 'nebula_orb', 14, 12),
      obj('s10_aurora', 'aurora_beacon', 20, 11),
      obj('s10_lamp1', 'celestial_lamp', 10, 10),
      obj('s10_stardial', 'star_dial', 24, 12),
      obj('s10_globe', 'gazing_globe', 8, 13),
      obj('s10_mosaic1', 'mosaic_path', 12, 11),
      obj('s10_mosaic2', 'mosaic_path', 13, 11),
      obj('s10_stargazer', 'stargazer', 18, 13),
      obj('s10_hammock', 'hammock', 3, 14),
      obj('s10_dreamcatcher', 'dreamcatcher', 12, 14),
      obj('s10_fairylights', 'fairy_lights', 26, 13),
      ...row('s10_paving', 'star_paving', 15, 15, 5),
      ...row('s10_paving2', 'star_paving', 15, 16, 5),
      ...row('s10_paving3', 'star_paving', 15, 17, 5),
      ...row('s10_paving4', 'star_paving', 16, 18, 3),
      plant('s10_lotus1', 'everdream_lotus', 12, 16),
      plant('s10_novabloom', 'novabloom', 20, 15),
      plant('s10_starbloom', 'starbloom', 20, 17),
      obj('s10_bridge1', 'bridge', 4, 3),
      obj('s10_bridge2', 'bridge', 4, 4),
      obj('s10_bridge3', 'stepping_stones', 3, 4),
      obj('s10_bridge4', 'stepping_stones', 12, 3),
      obj('s10_reeds1', 'reeds', 5, 3),
      obj('s10_reeds2', 'reeds', 5, 4),
      obj('s10_reeds3', 'reeds', 12, 4),
      plant('s10_lotus2', 'everdream_lotus', 24, 24),
    ],
    creatures: [
      { id: 'astra', name: 'Astra', gx: 14, gy: 7, state: 'idle', emotion: 'happy' },
      { id: 'bloom', name: 'Bloom', gx: 11, gy: 12, state: 'wander', emotion: 'happy' },
      { id: 'luna', name: 'Luna', gx: 21, gy: 9, state: 'idle', emotion: 'relaxed' },
      { id: 'wisp', name: 'Wisp', gx: 24, gy: 10, state: 'wander', emotion: 'curious' },
      { id: 'cinder', name: 'Cinder', gx: 18, gy: 14, state: 'idle', emotion: 'happy' },
      { id: 'glimmer', name: 'Glimmer', gx: 13, gy: 12, state: 'wander', emotion: 'excited' },
      { id: 'mossi', name: 'Mossi', gx: 7, gy: 9, state: 'idle', emotion: 'happy' },
      { id: 'bloop', name: 'Bloop', gx: 16, gy: 13, state: 'wander', emotion: 'excited' },
      { id: 'ember', name: 'Ember', gx: 20, gy: 16, state: 'idle', emotion: 'happy' },
      { id: 'puffin', name: 'Puffin', gx: 8, gy: 15, state: 'idle', emotion: 'relaxed' },
      { id: 'sprig', name: 'Sprig', gx: 10, gy: 13, state: 'wander', emotion: 'happy' },
      { id: 'frosty', name: 'Frosty', gx: 27, gy: 11, state: 'idle', emotion: 'relaxed' },
      { id: 'nimbus', name: 'Nimbus', gx: 23, gy: 7, state: 'wander', emotion: 'curious' },
      { id: 'pebble', name: 'Pebble', gx: 6, gy: 16, state: 'idle', emotion: 'relaxed' },
      { id: 'flurry', name: 'Flurry', gx: 28, gy: 15, state: 'wander', emotion: 'excited' },
    ],
  });

  // 11. Dedicated Terrain Showcase: Snow Patch & Snow Weather (Winter Wonderland)
  await captureStage({
    stage: 6,
    title: 'Custom Terrain — Snow Patch & Soft Snowfall Weather',
    filename: 'terrain-snow.png',
    hour: 11,
    zoomDelta: 0.04,
    weather: 'snow', // Activates animated falling snowflake particle weather
    customTerrain: FULL_SNOW_26,
    objects: [
      obj('s11_lodge', 'ski_lodge', 2, 6),
      obj('s11_cocoa1', 'hot_cocoa', 6, 3),
      obj('s11_tree1', 'christmas_tree', 6, 6),
      obj('s11_snowman1', 'snowman', 9, 4),
      obj('s11_pine1', 'snow_pine', 8, 8),
      obj('s11_crystal1', 'ice_crystal', 10, 6),
      obj('s11_icelantern1', 'ice_lantern', 5, 8),
      obj('s11_fort1', 'snow_fort', 4, 10),
      obj('s11_bench1', 'snow_bench', 7, 10),
      obj('s11_sleigh', 'santas_sleigh', 12, 6),
      obj('s11_reindeer1', 'reindeer', 11, 8),
      obj('s11_gifts1', 'gift_boxes', 13, 7),
      obj('s11_candy1', 'candy_cane', 12, 5),
      obj('s11_pine2', 'snow_pine', 16, 5),
      obj('s11_pine3', 'snow_pine', 18, 8),
      obj('s11_snowman2', 'snowman', 20, 10),
      obj('s11_icelantern2', 'ice_lantern', 17, 10),
      obj('s11_bench2', 'snow_bench', 14, 11),
      obj('s11_reindeer2', 'reindeer', 9, 13),
      obj('s11_fort2', 'snow_fort', 11, 15),
      obj('s11_tree2', 'christmas_tree', 13, 13),
      obj('s11_bridge', 'bridge', 4, 4),
      obj('s11_reeds', 'reeds', 5, 3),
      obj('s11_pine4', 'snow_pine', 7, 14),
      obj('s11_gifts2', 'gift_boxes', 20, 12),
      obj('s11_candy2', 'candy_cane', 20, 15),
      obj('s11_tree3', 'christmas_tree', 16, 15),
      obj('s11_snowman3', 'snowman', 3, 12),
      obj('s11_crystal2', 'ice_crystal', 15, 7),
      obj('s11_bench3', 'snow_bench', 10, 12),
      obj('s11_fort3', 'snow_fort', 19, 12),
      obj('s11_pine5', 'snow_pine', 22, 5),
      obj('s11_pine6', 'snow_pine', 24, 13),
      obj('s11_icelantern3', 'ice_lantern', 22, 14),
      obj('s11_snowman4', 'snowman', 24, 8),
      obj('s11_cocoa2', 'hot_cocoa', 4, 12),
      obj('s11_gifts3', 'gift_boxes', 12, 10),
      obj('s11_candy3', 'candy_cane', 9, 6),
      obj('s11_paving1', 'frost_paving', 2, 5),
      obj('s11_paving2', 'frost_paving', 3, 5),
      obj('s11_paving3', 'frost_paving', 4, 5),
      obj('s11_paving4', 'frost_paving', 5, 5),
      obj('s11_paving5', 'frost_paving', 6, 5),
      obj('s11_paving6', 'frost_paving', 7, 5),
      obj('s11_paving7', 'frost_paving', 10, 5),
      obj('s11_paving8', 'frost_paving', 11, 5),
      obj('s11_paving9', 'frost_paving', 12, 7),
    ],
    creatures: [
      { id: 'flurry', name: 'Flurry', gx: 7, gy: 4, state: 'idle', emotion: 'happy' },
      { id: 'frosty', name: 'Frosty', gx: 11, gy: 6, state: 'wander', emotion: 'excited' },
      { id: 'mossi', name: 'Mossi', gx: 4, gy: 8, state: 'idle', emotion: 'relaxed' },
      { id: 'puffin', name: 'Puffin', gx: 19, gy: 10, state: 'idle', emotion: 'sleepy' },
    ],
  });

  // 12. Dedicated Terrain Showcase: Sand Patch (Desert Oasis & Sunny Beach)
  await captureStage({
    stage: 6,
    title: 'Custom Terrain — Golden Sand Patch & Desert Oasis',
    filename: 'terrain-sand.png',
    hour: 13,
    zoomDelta: 0.04,
    customTerrain: FULL_SAND_26,
    objects: [
      obj('s12_tent1', 'desert_tent', 3, 5),
      obj('s12_tent2', 'desert_tent', 7, 3),
      obj('s12_fountain1', 'oasis_fountain', 6, 6),
      obj('s12_umbrella1', 'beach_umbrella', 9, 4),
      obj('s12_chair1', 'beach_chair', 10, 5),
      obj('s12_castle1', 'sandcastle', 7, 8),
      obj('s12_palm1', 'desert_palm', 4, 8),
      obj('s12_cactus1', 'cactus_flower', 12, 6),
      obj('s12_zen1', 'zen_garden', 8, 10),
      obj('s12_towel1', 'beach_towel', 11, 10),
      obj('s12_shells1', 'seashell_cluster', 12, 9),
      obj('s12_picnic1', 'picnic_umbrella', 15, 7),
      obj('s12_palm2', 'desert_palm', 17, 5),
      obj('s12_tent3', 'desert_tent', 14, 12),
      obj('s12_fountain2', 'oasis_fountain', 18, 10),
      obj('s12_umbrella2', 'beach_umbrella', 20, 8),
      obj('s12_chair2', 'beach_chair', 20, 12),
      obj('s12_castle2', 'sandcastle', 19, 12),
      obj('s12_cactus2', 'cactus_flower', 16, 14),
      obj('s12_palm3', 'desert_palm', 12, 15),
      obj('s12_picnic2', 'picnic_umbrella', 22, 13),
      obj('s12_towel2', 'beach_towel', 7, 12),
      obj('s12_shells2', 'seashell_cluster', 10, 13),
      obj('s12_castle3', 'sandcastle', 5, 14),
      obj('s12_palm4', 'desert_palm', 23, 5),
      obj('s12_cactus3', 'cactus_flower', 2, 11),
      obj('s12_zen2', 'zen_garden', 24, 15),
      obj('s12_umbrella3', 'beach_umbrella', 9, 15),
      obj('s12_chair3', 'beach_chair', 3, 9),
      obj('s12_tent4', 'desert_tent', 20, 16),
      obj('s12_cactus4', 'cactus_flower', 14, 17),
      obj('s12_bridge', 'bridge', 4, 4),
      obj('s12_reeds', 'reeds', 5, 3),
      obj('s12_fountain3', 'oasis_fountain', 12, 12),
      obj('s12_towel3', 'beach_towel', 15, 11),
      obj('s12_shells3', 'seashell_cluster', 17, 11),
      obj('s12_palm5', 'desert_palm', 25, 10),
      obj('s12_picnic3', 'picnic_umbrella', 8, 14),
      obj('s12_chair4', 'beach_chair', 23, 17),
      obj('s12_zen3', 'zen_garden', 3, 14),
      obj('s12_cactus5', 'cactus_flower', 18, 7),
      obj('s12_shells4', 'seashell_cluster', 6, 9),
      obj('s12_umbrella4', 'beach_umbrella', 24, 18),
      obj('s12_castle4', 'sandcastle', 22, 16),
      obj('s12_tent5', 'desert_tent', 10, 12),
      obj('s12_mosaic1', 'mosaic_path', 9, 7),
      obj('s12_mosaic2', 'mosaic_path', 10, 7),
      obj('s12_mosaic3', 'mosaic_path', 11, 7),
      obj('s12_mosaic4', 'mosaic_path', 9, 8),
      obj('s12_mosaic5', 'mosaic_path', 10, 8),
      obj('s12_mosaic6', 'mosaic_path', 11, 8),
    ],
    creatures: [
      { id: 'mossi', name: 'Mossi', gx: 5, gy: 6, state: 'idle', emotion: 'relaxed' },
      { id: 'bloop', name: 'Bloop', gx: 10, gy: 9, state: 'wander', emotion: 'happy' },
      { id: 'pebble', name: 'Pebble', gx: 19, gy: 10, state: 'idle', emotion: 'relaxed' },
      { id: 'puffin', name: 'Puffin', gx: 16, gy: 8, state: 'idle', emotion: 'sleepy' },
    ],
  });

  // 13. Dedicated Terrain Showcase: Starry Patch, Night Sky & Cozy Lighting
  await captureStage({
    stage: 5,
    title: 'Custom Terrain — Starry Patch, Night Sky & Cozy Illumination',
    filename: 'terrain-starry.png',
    hour: 22.5,
    zoomDelta: 0,
    biomeOverride: 'starlight',
    objects: [
      { id: 'b_cottage', type: 'cottage', gx: 3, gy: 3, rot: 0 },
      { id: 'd_campfire', type: 'campfire', gx: 4, gy: 7, rot: 0 },
      { id: 'd_lantern1', type: 'lantern', gx: 6, gy: 3, rot: 0 },
      { id: 'd_lantern2', type: 'lantern', gx: 2, gy: 6, rot: 0 },
      { id: 'd_telescope', type: 'stargazer', gx: 7, gy: 6, rot: 0 },
      { id: 'd_starpaving1', type: 'star_paving', gx: 5, gy: 5, rot: 0 },
      { id: 'd_starpaving2', type: 'star_paving', gx: 6, gy: 5, rot: 0 },
      { id: 'd_starpaving3', type: 'star_paving', gx: 5, gy: 6, rot: 0 },
      { id: 'd_starpaving4', type: 'star_paving', gx: 6, gy: 6, rot: 0 },
    ],
    creatures: [
      { id: 'mossi', name: 'Mossi', gx: 3, gy: 6, state: 'sleep', emotion: 'sleepy' },
      { id: 'luna', name: 'Luna', gx: 7, gy: 7, state: 'sleep', emotion: 'sleepy' },
    ],
  });

  console.log('\nAll 13 stages and terrain showcases captured successfully!\n');
} finally {
  await browser.close();
  srv.close();
}
