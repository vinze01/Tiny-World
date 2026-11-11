import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';

const DIST = resolve('dist');
const SHOTS = resolve('test-results');
mkdirSync(SHOTS, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const startServer = () => {
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

const { srv, url } = await startServer();
const browser = await chromium.launch({ executablePath: chromePath, headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // 1. Open Full-Page Game
  await page.goto(`${url}/game.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.world-canvas canvas', { timeout: 10000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(SHOTS, '01-full-onboarding.png') });

  // 2. Onboarding Step 1 -> Step 2 (Name Mossi) -> Skip Tour
  await page.click('text=Meet Your Pipkin');
  await page.fill('input[aria-label="Name your Pipkin"]', 'Clover');
  await page.click('text=Continue');
  await page.click('text=Skip Tour');
  await page.waitForTimeout(300);

  // 3. Switch to Daytime for bright daytime screenshot, then plant a Daisy seed via Bag
  await page.click('button[aria-label="Settings"]');
  await page.selectOption('#sel-cycle', 'day');
  await page.click('button[aria-label="Close settings"]');
  await page.click('button:has-text("Bag")');
  await page.waitForSelector('text=Daisy Seed');
  await page.click('button[title="Plant Daisy Seed"]');
  await page.waitForSelector('text=Place Here');
  await page.click('button:has-text("Place Here")');
  await page.waitForTimeout(400);

  // 4. Open Shop, buy a Garden Lantern + Campfire + Sunflower Seed, and place them on island
  await page.click('button:has-text("Shop")');
  await page.click('button:has-text("Lighting")');
  await page.click('button:has-text("Garden Lantern")');
  await page.screenshot({ path: resolve(SHOTS, '02-shop-drawer.png') });
  await page.click('button:has-text("Confirm Purchase")');

  // Also test Shop search + add tokens for Campfire & Sunflower verification in screenshots
  await page.evaluate(async () => {
    const res = await window.__twStore.saveStore.mutateWith((s) => {
      s.tokens += 150;
      return { ok: true, effects: [] };
    });
    window.__twStore.state = res.state;
  });
  await page.fill('input[aria-label="Search shop items"]', 'Campfire');
  await page.click('button:has-text("Campfire")');
  await page.click('button:has-text("Confirm Purchase")');
  await page.fill('input[aria-label="Search shop items"]', 'Sunflower');
  await page.click('button:has-text("Sunflower Seed")');
  await page.click('button:has-text("Confirm Purchase")');

  await page.click('button:has-text("Bag")');
  await page.click('button[title="Place Garden Lantern"]');
  await page.evaluate(() => { window.__twStore.cursorCell = { gx: 4, gy: 2 }; });
  await page.click('button:has-text("Place Here")');

  // Place Campfire and blooming Sunflower to inspect campfire flame centering & unclipped bloom
  await page.click('button:has-text("Bag")');
  await page.click('button[title="Place Campfire"]');
  await page.evaluate(() => { window.__twStore.cursorCell = { gx: 3, gy: 4 }; });
  await page.click('button:has-text("Place Here")');

  await page.click('button:has-text("Bag")');
  await page.click('button[title="Plant Sunflower Seed"]');
  await page.evaluate(() => { window.__twStore.cursorCell = { gx: 2, gy: 3 }; });
  await page.click('button:has-text("Place Here")');
  await page.evaluate(async () => {
    const res = await window.__twStore.saveStore.mutateWith((s) => {
      for (const o of s.objects) {
        if (o.plant && o.type === 'sunflower') o.plant.plantedAt = Date.now() - 3600_000;
      }
      return { ok: true, effects: [] };
    });
    window.__twStore.state = res.state;
    window.__twStore.nowTick = Date.now();
    window.__twStore.worldHooks.refresh?.();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: resolve(SHOTS, '03-island-day.png') });

  // 4b. Test Storage Shed purchase, rotation toggle, and placement
  await page.evaluate(async () => {
    const res = await window.__twStore.saveStore.mutateWith((s) => {
      s.tokens += 100;
      return { ok: true, effects: [] };
    });
    window.__twStore.state = res.state;
  });
  await page.click('button:has-text("Shop")');
  await page.click('button:has-text("Buildings")');
  await page.click('button:has-text("Storage Shed")');
  await page.click('button:has-text("Confirm Purchase")');
  await page.click('button:has-text("Bag")');
  await page.click('button[title="Place Storage Shed"]');
  await page.waitForSelector('button:has-text("Rotate (R)")');

  // Verify initial rotation is 0
  let shedRot = await page.evaluate(() => window.__twStore.buildMode.rot);
  if (shedRot !== 0) throw new Error('Expected initial shed buildMode rot to be 0');

  // Click Rotate button -> verify rot becomes 1
  await page.click('button:has-text("Rotate (R)")');
  shedRot = await page.evaluate(() => window.__twStore.buildMode.rot);
  if (shedRot !== 1) throw new Error('Expected shed buildMode rot to be 1 after clicking Rotate');

  // Press 'R' key -> verify rot toggles back to 0
  await page.keyboard.press('KeyR');
  shedRot = await page.evaluate(() => window.__twStore.buildMode.rot);
  if (shedRot !== 0) throw new Error('Expected shed buildMode rot to toggle to 0 via R key');

  // Rotate back to 1 for placement on plot
  await page.keyboard.press('KeyR');
  await page.screenshot({ path: resolve(SHOTS, '03b-shed-rotating.png') });
  await page.click('button:has-text("Cancel (Esc)")');
  await page.waitForTimeout(300);

  // 5. Open Pipkins panel and verify Clover + newly arrived Ember
  await page.click('button:has-text("Pipkins")');
  await page.waitForSelector('text=Clover');
  await page.waitForSelector('text=Ember');
  await page.screenshot({ path: resolve(SHOTS, '04-pipkins-panel.png') });
  await page.click('button[aria-label="Close panel"]');

  // 6. Open Journal & Achievements
  await page.click('button:has-text("Journal")');
  await page.screenshot({ path: resolve(SHOTS, '05-journal-panel.png') });
  await page.click('button[aria-label="Close panel"]');

  // 7. Switch to Starry Night in Settings and verify night lighting
  await page.click('button[aria-label="Settings"]');
  await page.selectOption('#sel-cycle', 'night');
  await page.click('button[aria-label="Close settings"]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(SHOTS, '06-island-night.png') });

  // 7b. Expand island to Stage 3 (Crystal Pond), verify Stage 3 shop items unlock
  await page.evaluate(async () => {
    const res = await window.__twStore.saveStore.mutateWith((s) => {
      s.stage = 3;
      s.tokens += 500;
      return { ok: true, effects: [] };
    });
    window.__twStore.state = res.state;
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: resolve(SHOTS, '06b-crystal-pond-stage3.png') });

  // Verify Stage 3 shop items appear in Shop
  await page.click('button:has-text("Shop")');
  await page.click('button:has-text("Buildings")');
  await page.waitForSelector('text=Mini Windmill');
  await page.click('button:has-text("Nature")');
  await page.waitForSelector('text=Weeping Willow');
  await page.click('button[aria-label="Close panel"]');
  await page.waitForTimeout(300);

  // 7c. Test Time Preview popover, Garden Quick Bar (Harvest All / Water All), Obstacle Clearing, Bag Sell, Pickup focus, and Pipkin Annoyance + Contextual bar
  await page.click('button[title="Adjust Time of Day Preview"]');
  await page.waitForSelector('input[aria-label="Manual sky hour slider"]');
  await page.click('button:has-text("☀️ Daytime")');
  await page.click('button[aria-label="Close time controls"]');

  // Garden Quick Bar: water & harvest blooming sunflower
  await page.waitForSelector('button:has-text("Harvest All")');
  await page.click('button:has-text("Harvest All")');
  await page.waitForSelector('button:has-text("Water All")');
  await page.click('button:has-text("Water All")');

  // Select a removable locked obstacle (rock) and clear it via inspector confirmation
  const rockId = await page.evaluate(() => {
    const r = window.__twStore.state.objects.find((o) => o.locked && o.type === 'rock');
    if (r) window.__twStore.selectedObjectId = r.id;
    return r?.id ?? null;
  });
  if (rockId) {
    await page.waitForSelector('button:has-text("Clear")');
    await page.click('button:has-text("Clear")');
    await page.click('button:has-text("Confirm Clear")');
    await page.waitForFunction(
      (id) => !window.__twStore.state.objects.some((o) => o.id === id),
      rockId,
      { timeout: 5000 },
    );
  }

  // Bag Sell: buy 2 Pots, open Bag, sell 1 via 50% resale
  await page.click('button:has-text("Shop")');
  await page.click('button:has-text("Furniture")');
  await page.click('button:has-text("Flower Pot")');
  await page.click('button:has-text("Confirm Purchase")');
  await page.click('button:has-text("Bag")');
  const sellBtn = page.locator('.bag-card:has-text("Flower Pot") button:has-text("Sell")');
  await sellBtn.click();
  await page.waitForSelector('.sell-ledger');
  await page.click('.sell-ledger button:has-text("Sell (+")');
  await page.click('button[aria-label="Close panel"]');

  // Pickup focus badge
  await page.evaluate(async () => {
    const res = await window.__twStore.saveStore.mutateWith((s) => {
      s.pickups.push({ id: 'pk_e2e', kind: 'sparkle', amount: 4, gx: 3, gy: 3, createdAt: Date.now() });
      return { ok: true, effects: [] };
    });
    window.__twStore.state = res.state;
  });
  await page.waitForSelector('button.pickup-alert.active');
  await page.click('button.pickup-alert.active');

  // Pipkin annoyance & 10-action contextual bar
  await page.evaluate(() => {
    window.__twStore.selectedObjectId = null;
    window.__twStore.selectedCreatureId = 'mossi';
  });
  await page.waitForSelector('.creature-inspector');
  for (let i = 0; i < 6; i++) {
    await page.click('.creature-inspector button:has-text("Pet")');
  }
  await page.waitForSelector('.mood-pill.annoyed');
  await page.click('.creature-inspector button:has-text("Cheer")');
  await page.waitForSelector('.mood-pill:not(.annoyed)');
  await page.click('.creature-inspector button:has-text("More")');
  await page.waitForSelector('.extra-creature-actions button:has-text("Wave")');
  await page.click('.creature-inspector button[aria-label="Close inspector"]');

  // 7d. Verify Stage 6 (Frostfall Haven) & Stage 10 (Everdream Paradise) rendering & weather FX
  await page.evaluate(async () => {
    const res = await window.__twStore.saveStore.mutateWith((s) => {
      s.stage = 6;
      return { ok: true, effects: [] };
    });
    window.__twStore.state = res.state;
    window.__twStore.worldHooks.centerCamera?.();
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(SHOTS, '08-frostfall-stage6.png') });

  await page.evaluate(async () => {
    const res = await window.__twStore.saveStore.mutateWith((s) => {
      s.stage = 10;
      return { ok: true, effects: [] };
    });
    window.__twStore.state = res.state;
    window.__twStore.worldHooks.zoomBy?.(-0.35);
    window.__twStore.worldHooks.centerCamera?.();
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(SHOTS, '09-everdream-stage10.png') });

  // 8. Open Popup surface simultaneously and verify shared persisted state + non-overlapping toast/HUD layout
  const popupPage = await context.newPage();
  await popupPage.setViewportSize({ width: 420, height: 580 });
  await popupPage.goto(`${url}/popup.html`, { waitUntil: 'networkidle' });
  await popupPage.waitForSelector('.world-canvas canvas');
  await popupPage.evaluate(() => {
    window.__twStore.toasts.push({ id: 999, text: 'Test toast notification spacing', kind: 'info' });
  });
  await popupPage.waitForTimeout(500);
  await popupPage.screenshot({ path: resolve(SHOTS, '07-popup-surface.png') });

  const popupOverlap = await popupPage.evaluate(() => {
    const hud = document.querySelector('.hud-top')?.getBoundingClientRect();
    const toast = document.querySelector('.toast-stack')?.getBoundingClientRect();
    if (!hud || !toast || toast.height === 0) return false;
    return toast.top < hud.bottom - 2;
  });
  if (popupOverlap) {
    throw new Error('Popup toast-stack overlapped hud-top!');
  }

  const popupTokens = await popupPage.textContent('.token-val');
  const fullTokens = await page.textContent('.token-val');
  if (popupTokens !== fullTokens) {
    throw new Error(`Token mismatch between popup (${popupTokens}) and full page (${fullTokens})`);
  }

  // 9. Open Side Panel surface and verify
  const sidePage = await context.newPage();
  await sidePage.setViewportSize({ width: 380, height: 720 });
  await sidePage.goto(`${url}/sidepanel.html`, { waitUntil: 'networkidle' });
  await sidePage.waitForSelector('.world-canvas canvas');
  await sidePage.waitForTimeout(500);

  if (errors.length) {
    throw new Error('Page errors encountered: ' + errors.join('; '));
  }
  console.log('E2E checks passed across Full-Page, Popup, and Side Panel surfaces!');
} finally {
  await browser.close();
  srv.close();
}
