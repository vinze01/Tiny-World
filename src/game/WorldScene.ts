import Phaser from 'phaser';
import {
  ensureCustomTerrainTexture,
  ensureIslandTextures,
  getIsland,
  islandTexKey,
  itemTexKey,
  registerPhaserAssets,
  spriteMeta,
} from '../art/atlas';
import { ITEM_BY_ID } from '../core/catalog';
import { effectiveEmotion } from '../core/actions';
import {
  createActor,
  directActor,
  nudgeActor,
  react as reactActor,
  tickActor,
  type Actor,
  type Emote,
  type Poi,
  type PoiKind,
} from '../core/creatureAI';
import {
  BRIDGE_IDS,
  PLANT_ITEM,
  canMoveObjects,
  canPlace,
  cellCenter,
  footprintCells,
  footprintDims,
  gridToWorld,
  isWaterTerrain,
  objDef,
  terrainAt,
  terrainMap,
  terrainNeighborMask,
  terrainOppositeNeighborMask,
  walkGrid,
  worldToCell,
} from '../core/grid';
import { plantStage } from '../core/plants';
import { mulberry32 } from '../core/rng';
import type { BiomeId, CreatureId, CreatureInteractionKind, Effect, EmotionType, PlacedObject } from '../core/types';
import type { useGameStore } from '../stores/gameStore';

type Store = ReturnType<typeof useGameStore>;

interface CloudItem {
  spr: Phaser.GameObjects.Image;
  vx: number;
  baseY: number;
}

interface FireflyItem {
  spr: Phaser.GameObjects.Image;
  phase: number;
  bx: number;
  by: number;
}

export class WorldScene extends Phaser.Scene {
  private store!: Store;
  private skyGfx!: Phaser.GameObjects.Graphics;
  private stars: Phaser.GameObjects.Image[] = [];
  private celestial!: Phaser.GameObjects.Image;
  private clouds: CloudItem[] = [];
  private islandSpr!: Phaser.GameObjects.Image;
  private highlightGfx!: Phaser.GameObjects.Graphics;
  private previewSpr!: Phaser.GameObjects.Image;
  private groupPreviewSprs: Phaser.GameObjects.Image[] = [];

  private objSprites = new Map<string, Phaser.GameObjects.Image>();
  private terrainSprites = new Map<string, Phaser.GameObjects.Image>();
  private objFlames = new Map<string, Phaser.GameObjects.Sprite>();
  private objGlows = new Map<string, Phaser.GameObjects.Image>();
  private pickupSprites = new Map<string, Phaser.GameObjects.Image>();
  private pickupHalos = new Map<string, Phaser.GameObjects.Image>();
  private creatureSprites = new Map<CreatureId, Phaser.GameObjects.Sprite>();
  private actors = new Map<CreatureId, Actor>();
  private fireflies: FireflyItem[] = [];
  private weatherPool: Phaser.GameObjects.Image[] = [];
  private fogBands: Phaser.GameObjects.Image[] = [];

  private rng = mulberry32(1337);
  private waterFrame = 0;
  private waterTimer = 0;
  private smokeTimer = 0;
  private eventRollTimer = 0;
  private dragStart: { x: number; y: number; scrollX: number; scrollY: number; moved: boolean } | null = null;
  private currentStage = 1;
  private currentBiome: BiomeId = 'meadow';

  // Cached grid & POIs per state revision (major speedup on 24..36 grids with 15 creatures)
  private cachedRev = -1;
  private cachedWalkGrid: boolean[][] = [];
  private cachedPois: Poi[] = [];

  constructor(store: Store) {
    super('WorldScene');
    this.store = store;
  }

  create() {
    registerPhaserAssets(this);
    const cam = this.cameras.main;
    cam.setRoundPixels(true);

    // 1. Fixed screen-space sky & stars
    this.skyGfx = this.add.graphics().setScrollFactor(0).setDepth(-2000);
    for (let i = 0; i < 40; i++) {
      const st = this.add
        .image((i * 73) % 900, (i * 41) % 360, 'fx:sparkle')
        .setScrollFactor(0)
        .setDepth(-1950)
        .setScale(i % 3 === 0 ? 1 : 0.6)
        .setAlpha(0);
      this.stars.push(st);
    }
    this.celestial = this.add.image(80, 56, 'fx:sun').setScrollFactor(0).setDepth(-1920);

    // 2. Drifting clouds behind the island
    for (let i = 0; i < 6; i++) {
      const spr = this.add
        .image(-180 + i * 90, -85 + (i % 3) * 28, `fx:cloud${i % 3}`)
        .setDepth(-1200)
        .setAlpha(0.88);
      this.clouds.push({ spr, vx: 3.5 + (i % 3) * 1.4, baseY: spr.y });
    }

    // 3. Floating island base (unified green meadow across all stages unless biomeOverride is explicitly set)
    this.currentStage = this.store.state.stage;
    this.currentBiome = this.store.state.settings.biomeOverride ?? 'meadow';
    ensureIslandTextures(this, this.currentStage, this.currentBiome);
    const isl = getIsland(this.currentStage, 0, this.currentBiome);
    this.islandSpr = this.add
      .image(-isl.ox, -isl.oy, islandTexKey(this.currentStage, this.currentBiome, 0))
      .setOrigin(0, 0)
      .setDepth(-500);

    // 4. Grid highlight & placement preview
    this.highlightGfx = this.add.graphics().setDepth(900);
    this.previewSpr = this.add.image(0, 0, 'item:bench').setDepth(910).setVisible(false).setAlpha(0.78);

    // 5. Night fireflies
    for (let i = 0; i < 12; i++) {
      const p = cellCenter(1 + (i % 6), 1 + ((i * 2) % 6));
      const spr = this.add.image(p.x, p.y - 10, 'fx:firefly').setDepth(850).setAlpha(0);
      this.fireflies.push({ spr, phase: i * 1.1, bx: p.x, by: p.y - 10 });
    }

    // 6. Weather particle pool (reused for rain, snow, wind, sparkles)
    for (let i = 0; i < 42; i++) {
      const r = this.add.image(0, 0, 'fx:raindrop').setDepth(960).setVisible(false).setAlpha(0.78);
      this.weatherPool.push(r);
    }
    for (let i = 0; i < 7; i++) {
      const f = this.add.image(-120 + i * 55, 10 + (i % 3) * 32, 'fx:fog').setDepth(945).setVisible(false).setAlpha(0.28).setScale(2.6);
      this.fogBands.push(f);
    }

    this.centerCamera();
    this.setupInputs();

    this.store.worldHooks = {
      onEffects: (fx) => this.playEffects(fx),
      onCreatureReact: (id, kind) => {
        const a = this.actors.get(id);
        if (a) reactActor(a, kind);
      },
      onCreatureAction: (id, kind, data) => this.handleCreatureAction(id, kind, data),
      centerCamera: () => this.centerCamera(),
      focusCell: (gx, gy) => this.focusCell(gx, gy),
      zoomBy: (delta) => this.zoomBy(delta),
    };

    this.scale.on('resize', () => {
      this.centerCamera();
      this.drawSky();
    });

    this.syncAll(0);
    this.drawSky();
  }

  private defaultZoom(): number {
    const w = this.scale.width;
    const h = this.scale.height;
    const m = terrainMap(this.store.state.stage);
    const spanW = (m.w + m.h) * 16 + 44;
    const spanH = (m.w + m.h) * 8 + 135;
    const raw = Math.min(w / spanW, h / spanH);
    return Math.max(0.55, Math.min(3.0, Math.round(raw * 4) / 4));
  }

  centerCamera() {
    const cam = this.cameras.main;
    if (!cam) return;
    const m = terrainMap(this.store.state.stage);
    const c = cellCenter((m.w - 1) / 2, (m.h - 1) / 2);
    cam.setZoom(this.defaultZoom());
    cam.centerOn(c.x, c.y + 18);
    this.drawSky();
  }

  focusCell(gx: number, gy: number) {
    const cam = this.cameras.main;
    if (!cam) return;
    const c = cellCenter(gx, gy);
    if (cam.zoom < 1.3) cam.setZoom(1.5);
    cam.pan(c.x, c.y, 320, 'Sine.easeInOut');
    this.drawSky();
    const ring = this.add.circle(c.x, c.y, 8, 0xfef08a, 0.2).setStrokeStyle(2, 0xfef08a, 0.95).setDepth(1300);
    this.tweens.add({
      targets: ring,
      scale: 2.6,
      alpha: 0,
      duration: 950,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });
    this.spawnFloatIcon(c.x, c.y - 12, 'fx:sparkle');
  }

  zoomBy(delta: number) {
    const cam = this.cameras.main;
    if (!cam) return;
    const next = Phaser.Math.Clamp(cam.zoom + delta, 0.55, 4);
    cam.setZoom(next);
    this.drawSky();
  }

  private setupInputs() {
    const cam = this.cameras.main;

    this.input.on('wheel', (_p: unknown, _go: unknown, _dx: number, dy: number) => {
      this.zoomBy(dy > 0 ? -0.25 : 0.25);
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragStart = { x: p.x, y: p.y, scrollX: cam.scrollX, scrollY: cam.scrollY, moved: false };
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const wp = cam.getWorldPoint(p.x, p.y);
      const cell = worldToCell(wp.x, wp.y);
      const m = terrainMap(this.store.state.stage);
      if (cell.gx >= 0 && cell.gy >= 0 && cell.gx < m.w && cell.gy < m.h) {
        this.store.cursorCell = cell;
      }
      if (p.isDown && this.dragStart) {
        const dx = p.x - this.dragStart.x;
        const dy = p.y - this.dragStart.y;
        if (Math.hypot(dx, dy) > 6) {
          this.dragStart.moved = true;
          cam.scrollX = this.dragStart.scrollX - dx / cam.zoom;
          cam.scrollY = this.dragStart.scrollY - dy / cam.zoom;
        }
      }
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const moved = this.dragStart?.moved ?? false;
      this.dragStart = null;
      if (moved) return;
      const wp = cam.getWorldPoint(p.x, p.y);
      const ev = p.event as MouseEvent | PointerEvent | undefined;
      const multi = !!(ev && (ev.shiftKey || ev.ctrlKey || ev.metaKey));
      this.handleWorldTap(wp.x, wp.y, multi);
    });

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const m = terrainMap(this.store.state.stage);
      const cur = { ...this.store.cursorCell };
      if (ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W') {
        cur.gy = Math.max(0, cur.gy - 1);
        this.store.cursorCell = cur;
        ev.preventDefault();
      } else if (ev.key === 'ArrowDown' || ev.key === 's' || ev.key === 'S') {
        cur.gy = Math.min(m.h - 1, cur.gy + 1);
        this.store.cursorCell = cur;
        ev.preventDefault();
      } else if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A') {
        cur.gx = Math.max(0, cur.gx - 1);
        this.store.cursorCell = cur;
        ev.preventDefault();
      } else if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') {
        cur.gx = Math.min(m.w - 1, cur.gx + 1);
        this.store.cursorCell = cur;
        ev.preventDefault();
      } else if (ev.key === 'r' || ev.key === 'R') {
        this.store.rotatePlacement();
      } else if (ev.key === 'Escape') {
        if (this.store.buildMode.kind !== 'none') this.store.cancelBuild();
        else if (this.store.multiSelectMode) this.store.exitMultiSelect();
        else {
          this.store.selectedObjectId = null;
          this.store.selectedCreatureId = null;
          this.store.activeTab = 'none';
        }
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        const pt = cellCenter(cur.gx, cur.gy);
        this.handleWorldTap(pt.x, pt.y, ev.shiftKey || ev.ctrlKey || ev.metaKey);
        ev.preventDefault();
      }
    });
  }

  private ensureWorldCache() {
    const st = this.store.state;
    if (this.cachedRev === st.rev && this.cachedWalkGrid.length) {
      return { grid: this.cachedWalkGrid, pois: this.cachedPois };
    }
    this.cachedRev = st.rev;
    this.cachedWalkGrid = walkGrid(st);
    this.cachedPois = this.buildPois();
    return { grid: this.cachedWalkGrid, pois: this.cachedPois };
  }

  private handleCreatureAction(id: CreatureId, kind: CreatureInteractionKind, data?: Record<string, unknown>) {
    const actor = this.actors.get(id);
    if (!actor) return;
    const { grid, pois } = this.ensureWorldCache();
    const others = [...this.actors.values()].map((a) => ({ id: a.id, gx: a.gx, gy: a.gy }));
    const world = { grid, pois, night: this.store.sky.night, weather: this.store.weather, others, rng: this.rng };

    if (kind === 'call' || kind === 'follow') {
      const m = terrainMap(this.store.state.stage);
      const fallback = { gx: Math.floor(m.w / 2), gy: Math.floor(m.h / 2) };
      const goal = grid[this.store.cursorCell.gy]?.[this.store.cursorCell.gx] ? this.store.cursorCell : fallback;
      directActor(actor, goal, world, kind);
    } else if (kind === 'rest') {
      const spot = pois.find((p) => p.kind === 'bench' || p.kind === 'shelter' || p.kind === 'cottage');
      if (!spot || !directActor(actor, spot, world, 'rest')) reactActor(actor, 'rest');
    } else if (kind === 'pet' && data?.annoyed) {
      const away = [
        { gx: Math.round(actor.gx) + 2, gy: Math.round(actor.gy) },
        { gx: Math.round(actor.gx), gy: Math.round(actor.gy) + 2 },
        { gx: Math.round(actor.gx) - 2, gy: Math.round(actor.gy) },
      ].find((c) => grid[c.gy]?.[c.gx]);
      if (away) directActor(actor, away, world, 'retreat');
      reactActor(actor, data.angry ? 'angry' : 'annoyed');
    }
  }

  private handleWorldTap(wx: number, wy: number, multi = false) {
    const cell = worldToCell(wx, wy);
    const bm = this.store.buildMode;
    if (bm.kind !== 'none') {
      this.fireAction(this.store.commitPlacementAt(cell.gx, cell.gy));
      return;
    }

    const objs = this.store.state.objects.filter((o) =>
      footprintCells(objDef(o), o.gx, o.gy, o.rot).some((c) => c.gx === cell.gx && c.gy === cell.gy),
    );
    const topObj = objs.find((o) => objDef(o).layer === 'object') ?? objs[0];

    // Multi-select prioritizes toggling objects directly without triggering harvests, pond, or Pipkins
    if (this.store.multiSelectMode || multi) {
      if (topObj) this.fireAction(this.store.tapObject(topObj.id, { multi: true }));
      return;
    }

    // 1. Check pickups near tap
    for (const pk of this.store.state.pickups) {
      const pc = cellCenter(pk.gx, pk.gy);
      if (Math.hypot(wx - pc.x, wy - (pc.y - 6)) < 16) {
        this.fireAction(this.store.collectPickup(pk.id));
        return;
      }
    }

    // 2. Prioritize plants so Pipkins never block watering/harvesting
    if (topObj?.plant) {
      this.nudgeActorsNear(cell.gx, cell.gy);
      this.fireAction(this.store.tapObject(topObj.id));
      return;
    }

    // 3. Water / hotspring pond taps (when no bridge/stepping-stone sits on top)
    const t = terrainAt(this.store.state.stage, cell.gx, cell.gy);
    if (isWaterTerrain(t) && !topObj) {
      this.nudgeActorsNear(cell.gx, cell.gy);
      this.spawnFloatIcon(wx, wy - 6, 'fx:drop');
      this.fireAction(this.store.tapPond());
      return;
    }

    // 4. Creatures near tap
    for (const [id, actor] of this.actors.entries()) {
      const cc = cellCenter(actor.gx, actor.gy);
      if (Math.hypot(wx - cc.x, wy - (cc.y - 8)) < 14) {
        this.fireAction(this.store.selectAndPetCreature(id));
        return;
      }
    }

    // 5. Objects or ground tiles (paths, stepping stones, trees, rocks, buildings)
    if (topObj) {
      this.fireAction(this.store.tapObject(topObj.id));
      return;
    }

    this.store.selectedObjectId = null;
    this.store.selectedCreatureId = null;
  }

  /**
   * Fire-and-forget player-initiated store action. Rule/gameplay failures already
   * surface through store toasts and error sounds; this guard only catches
   * storage-level rejections (IndexedDB unavailable), which would otherwise be
   * unhandled. State is unchanged on such failures, so a toast is the right signal.
   */
  private fireAction(p: Promise<unknown>) {
    p.catch(() => {
      this.store.pushToast("That action couldn't be saved — please try again.", 'warn');
    });
  }

  private nudgeActorsNear(gx: number, gy: number) {
    const { grid, pois } = this.ensureWorldCache();
    const others = [...this.actors.values()].map((a) => ({ id: a.id, gx: a.gx, gy: a.gy }));
    const world = { grid, pois, night: this.store.sky.night, weather: this.store.weather, others, rng: this.rng };
    for (const actor of this.actors.values()) {
      if (Math.hypot(actor.gx - gx, actor.gy - gy) < 1.35) {
        nudgeActor(actor, world);
      }
    }
  }

  private drawSky() {
    const w = this.scale.width;
    const h = this.scale.height;
    const sky = this.store.sky;
    const cam = this.cameras.main;
    if (cam) cam.setBackgroundColor(sky.skyBottom);
    const z = Math.max(0.25, cam?.zoom ?? 1);
    const vx = w / 2 - (w / 2) / z;
    const vy = h / 2 - (h / 2) / z;
    const vw = w / z;
    const vh = h / z;

    this.skyGfx.clear();
    const bands = 24;
    const r1 = (sky.skyTop >> 16) & 255;
    const g1 = (sky.skyTop >> 8) & 255;
    const b1 = sky.skyTop & 255;
    const r2 = (sky.skyBottom >> 16) & 255;
    const g2 = (sky.skyBottom >> 8) & 255;
    const b2 = sky.skyBottom & 255;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const col =
        (Math.round(r1 + (r2 - r1) * t) << 16) |
        (Math.round(g1 + (g2 - g1) * t) << 8) |
        Math.round(b1 + (b2 - b1) * t);
      this.skyGfx.fillStyle(col, 1);
      this.skyGfx.fillRect(
        vx - 2,
        vy + Math.floor((i * vh) / bands),
        vw + 4,
        Math.ceil(vh / bands) + 2,
      );
    }

    this.stars.forEach((st, i) => {
      const sx = vx + (((i * 97) % Math.max(200, Math.floor(w - 20))) + 10) / z;
      const sy = vy + (((i * 53) % Math.max(120, Math.floor(h * 0.65))) + 8) / z;
      st.setPosition(sx, sy);
      st.setScale((i % 3 === 0 ? 1 : 0.6) / z);
      const twinkle = 0.65 + 0.35 * Math.sin(this.time.now * 0.003 + i);
      st.setAlpha(sky.night * twinkle);
    });

    this.celestial.setTexture(sky.night > 0.5 ? 'fx:moon' : 'fx:sun');
    this.celestial.setPosition(vx + (Math.max(46, w - 58)) / z, vy + 48 / z);
    this.celestial.setScale(1 / z);
    this.celestial.setAlpha(0.92);
  }

  private objectVisualTex(o: PlacedObject, now: number, rotOverride?: 0 | 1): { key: string; flip: boolean } {
    if (o.plant) return { key: `plant:${o.type}:${plantStage(o, now)}`, flip: false };
    return itemTexKey(o.type, rotOverride ?? o.rot);
  }

  private hideGroupPreviews() {
    for (const spr of this.groupPreviewSprs) spr.setVisible(false);
  }

  private objectScreenPos(o: PlacedObject) {
    const d = objDef(o);
    const { w, d: dep } = footprintDims(d, o.rot);
    const front = gridToWorld(o.gx + w, o.gy + dep);
    return { x: front.x, y: front.y, sortY: front.y + (d.layer === 'ground' ? -14 : 0) };
  }

  private buildPois(): Poi[] {
    const pois: Poi[] = [];
    const m = terrainMap(this.store.state.stage);
    for (let gy = 0; gy < m.h; gy++) {
      for (let gx = 0; gx < m.w; gx++) {
        const t = m.cells[gy][gx];
        if (t === 'water') pois.push({ kind: 'pond', gx, gy });
        else if (t === 'hotspring') pois.push({ kind: 'water', gx, gy });
      }
    }
    for (const o of this.store.state.objects) {
      if (o.plant) {
        pois.push({ kind: 'plant', gx: o.gx, gy: o.gy });
        continue;
      }
      const def = ITEM_BY_ID[o.type];
      const tags = def?.tags ?? [];
      let kind: PoiKind = 'decor';
      if (BRIDGE_IDS.has(o.type) || tags.includes('bridge')) kind = 'bridge';
      else if (tags.includes('crystal')) kind = 'crystal';
      else if (tags.includes('fire')) kind = 'fire';
      else if (tags.includes('tree')) kind = 'tree';
      else if (tags.includes('bush')) kind = 'bush';
      else if (tags.includes('flower')) kind = 'flower';
      else if (tags.includes('light')) kind = 'light';
      else if (tags.includes('cottage')) kind = 'cottage';
      else if (tags.includes('shelter')) kind = 'shelter';
      else if (tags.includes('building')) kind = 'building';
      else if (tags.includes('mushroom')) kind = 'mushroom';
      else if (tags.includes('bench')) kind = 'bench';
      else if (tags.includes('water')) kind = 'water';
      pois.push({ kind, gx: o.gx, gy: o.gy });
    }
    return pois;
  }

  private syncAll(dt: number) {
    const st = this.store.state;
    const sky = this.store.sky;
    const islandBiome: BiomeId = st.settings.biomeOverride ?? 'meadow';
    const reduced = st.settings.reducedMotion;
    const now = this.store.nowTick;

    // Island stage / biome / water frame
    if (this.currentStage !== st.stage || this.currentBiome !== islandBiome) {
      const stageChanged = this.currentStage !== st.stage;
      this.currentStage = st.stage;
      this.currentBiome = islandBiome;
      ensureIslandTextures(this, st.stage, islandBiome);
      if (stageChanged) this.centerCamera();
    }
    const isl = getIsland(st.stage, this.waterFrame, islandBiome);
    const bob = reduced ? 0 : Math.sin(this.time.now * 0.0014) * 1.6;
    this.islandSpr
      .setTexture(islandTexKey(st.stage, islandBiome, this.waterFrame))
      .setPosition(-isl.ox, -isl.oy + bob)
      .setTint(sky.tint);

    // Sync player-placed custom terrain patches (Snow Patch, Sand Patch) with neighbor-aware transitions
    const liveTerrainKeys = new Set<string>();
    const customTerrain = st.customTerrain ?? {};
    for (const [k, kind] of Object.entries(customTerrain)) {
      if (kind !== 'snow' && kind !== 'sand') continue;
      const [gxStr, gyStr] = k.split(',');
      const gx = Number(gxStr);
      const gy = Number(gyStr);
      if (!Number.isInteger(gx) || !Number.isInteger(gy)) continue;
      const baseT = terrainAt(st.stage, gx, gy);
      if (baseT === 'void' || isWaterTerrain(baseT)) continue;
      liveTerrainKeys.add(k);
      const sameMask = terrainNeighborMask(customTerrain, gx, gy, kind);
      const otherMask = terrainOppositeNeighborMask(customTerrain, gx, gy, kind);
      const texKey = ensureCustomTerrainTexture(this, kind, sameMask, otherMask);
      let tspr = this.terrainSprites.get(k);
      if (!tspr) {
        tspr = this.add.image(0, 0, texKey).setOrigin(0.5, 0);
        this.terrainSprites.set(k, tspr);
      }
      if (tspr.texture.key !== texKey) tspr.setTexture(texKey);
      const top = gridToWorld(gx, gy);
      tspr.setPosition(top.x, top.y + bob).setDepth(-490 + (gx + gy) * 0.001).setTint(sky.tint);
    }
    for (const [k, tspr] of this.terrainSprites.entries()) {
      if (!liveTerrainKeys.has(k)) {
        tspr.destroy();
        this.terrainSprites.delete(k);
      }
    }

    // Sync placed objects
    const bm = this.store.buildMode;
    const movingSet = new Set(
      bm.kind === 'move-object' ? [bm.objectId] : bm.kind === 'move-group' ? bm.objectIds : [],
    );
    const liveIds = new Set<string>();
    for (const o of st.objects) {
      liveIds.add(o.id);
      const { key: texKey, flip } = this.objectVisualTex(o, now);
      const meta = spriteMeta(texKey);
      let spr = this.objSprites.get(o.id);
      if (!spr) {
        spr = this.add.image(0, 0, texKey);
        this.objSprites.set(o.id, spr);
      }
      if (spr.texture.key !== texKey) spr.setTexture(texKey);
      const pos = this.objectScreenPos(o);
      spr.setFlipX(flip);
      const ax = flip ? 1 - meta.ax / meta.w : meta.ax / meta.w;
      spr.setOrigin(ax, 1);

      const animKind = o.plant ? 'sway' : ITEM_BY_ID[o.type]?.anim;
      const sway =
        !reduced && animKind === 'sway'
          ? Math.sin(this.time.now * 0.0022 + o.gx * 1.7 + o.gy * 2.3) * 1.6
          : 0;
      spr.setAngle(sway);
      spr.setPosition(pos.x, pos.y + bob);
      spr.setDepth(pos.sortY);
      spr.setTint(o.type === 'glowflower' && plantStage(o, now) === 4 ? 0xffffff : sky.tint);

      // Fade moving items to highlight pickup, or fade tall trees/buildings when a Pipkin is behind their canopy
      const isLifted = movingSet.has(o.id);
      const tags = o.plant ? [] : (ITEM_BY_ID[o.type]?.tags ?? []);
      if (isLifted) {
        spr.setAlpha(0.35);
      } else if (tags.includes('tree') || tags.includes('building')) {
        let occluded = false;
        for (const actor of this.actors.values()) {
          const awp = cellCenter(actor.gx, actor.gy);
          if (awp.y < pos.y && pos.y - awp.y < 42 && Math.abs(awp.x - pos.x) < 24) {
            occluded = true;
            break;
          }
        }
        spr.setAlpha(occluded ? 0.62 : 1);
      } else {
        spr.setAlpha(1);
      }

      // Centered campfire animated flame anchored in the log pit
      if (o.type === 'campfire') {
        let fl = this.objFlames.get(o.id);
        if (!fl) {
          fl = this.add.sprite(pos.x, pos.y - 9, 'fx:flame0').setOrigin(0.5, 0.92).play('flame');
          this.objFlames.set(o.id, fl);
        }
        fl.setPosition(pos.x, pos.y - 9 + bob).setAlpha(isLifted ? 0.35 : 1).setDepth(pos.sortY + 2);
      }

      // Warm night/ambient glow for lights, cozy buildings, crystals, and blooming glowflowers
      const itemDef = ITEM_BY_ID[o.type];
      const hasLight =
        itemDef?.light ||
        o.type === 'cottage' ||
        o.type === 'workshop' ||
        (o.type === 'glowflower' && plantStage(o, now) === 4);
      if (hasLight) {
        let gl = this.objGlows.get(o.id);
        if (!gl) {
          gl = this.add.image(pos.x, pos.y - 12, 'fx:glow').setBlendMode(Phaser.BlendModes.ADD);
          this.objGlows.set(o.id, gl);
        }
        const flicker = reduced ? 1 : 0.9 + 0.1 * Math.sin(this.time.now * 0.01 + o.gx);
        const col =
          o.type === 'glowflower' || o.type === 'ice_lantern' || o.type === 'ice_crystal' || o.type === 'ice_sculpture'
            ? 0x7af0ff
            : o.type === 'nebula_orb' || o.type === 'planetarium'
              ? 0xc084fc
              : 0xffcc68;
        gl.setTint(col)
          .setPosition(pos.x, pos.y - 14 + bob)
          .setScale(itemDef?.category === 'buildings' ? 1.35 : 0.95)
          .setAlpha(Math.max(0.18, sky.glow * 0.55) * flicker * (isLifted ? 0.35 : 1))
          .setDepth(pos.sortY + 2);
      }
    }
    for (const [id, spr] of this.objSprites.entries()) {
      if (!liveIds.has(id)) {
        spr.destroy();
        this.objSprites.delete(id);
        this.objFlames.get(id)?.destroy();
        this.objFlames.delete(id);
        this.objGlows.get(id)?.destroy();
        this.objGlows.delete(id);
      }
    }

    // Sync pickups with pulsing golden-mint halo so Nature Tokens & gifts always stand out
    const livePickups = new Set<string>();
    for (const pk of st.pickups) {
      livePickups.add(pk.id);
      let halo = this.pickupHalos.get(pk.id);
      if (!halo) {
        halo = this.add.image(0, 0, 'fx:glow').setBlendMode(Phaser.BlendModes.ADD);
        this.pickupHalos.set(pk.id, halo);
      }
      let spr = this.pickupSprites.get(pk.id);
      const key = `pickup:${pk.kind}`;
      if (!spr) {
        spr = this.add.image(0, 0, key).setOrigin(0.5, 1);
        this.pickupSprites.set(pk.id, spr);
      }
      const c = cellCenter(pk.gx, pk.gy);
      const floatY = reduced ? 0 : Math.sin(this.time.now * 0.005 + pk.gx) * 2.5;
      const pulse = reduced ? 0.55 : 0.45 + 0.3 * Math.sin(this.time.now * 0.006 + pk.gy);
      halo.setTint(0xfef08a).setPosition(c.x, c.y - 7 + bob).setScale(0.7 + pulse * 0.25).setAlpha(pulse).setDepth(c.y + 3.5);
      spr.setTexture(key).setPosition(c.x, c.y - 2 + floatY + bob).setDepth(c.y + 5);
    }
    for (const [id, spr] of this.pickupSprites.entries()) {
      if (!livePickups.has(id)) {
        spr.destroy();
        this.pickupSprites.delete(id);
        this.pickupHalos.get(id)?.destroy();
        this.pickupHalos.delete(id);
      }
    }

    // Sync & tick creatures
    const { grid, pois } = this.ensureWorldCache();
    const spawnCells = [
      { gx: 3, gy: 3 },
      { gx: 2, gy: 4 },
      { gx: 5, gy: 5 },
      { gx: 4, gy: 2 },
      { gx: 1, gy: 5 },
      { gx: 6, gy: 2 },
    ];
    const emotions: Record<string, EmotionType> = {};
    for (const c of st.creatures) emotions[c.id] = effectiveEmotion(c, now);

    const others = [...this.actors.values()].map((a) => ({ id: a.id, gx: a.gx, gy: a.gy }));
    const weather = this.store.weather;
    st.creatures.forEach((c, idx) => {
      let actor = this.actors.get(c.id);
      if (!actor) {
        const sp = spawnCells[idx % spawnCells.length];
        actor = createActor(c.id, sp.gx, sp.gy);
        this.actors.set(c.id, actor);
      }
      let spr = this.creatureSprites.get(c.id);
      if (!spr) {
        spr = this.add.sprite(0, 0, `creature:${c.id}`, 'idle_0').setOrigin(0.5, 0.9);
        this.creatureSprites.set(c.id, spr);
      }
      if (dt > 0) {
        tickActor(actor, dt, { grid, pois, night: sky.night, weather, emotions, others, rng: this.rng });
      }
      const animKey = `${c.id}:${actor.anim}`;
      if (spr.anims.currentAnim?.key !== animKey) spr.play(animKey, true);
      spr.setFlipX(actor.facing < 0);
      const wp = cellCenter(actor.gx, actor.gy);
      spr.setPosition(wp.x, wp.y + 2 + bob).setDepth(wp.y + 3);

      // Subtle tint feedback for annoyance / blushing / nighttime light
      const emo = emotions[c.id];
      if (emo === 'angry' || emo === 'annoyed') spr.setTint(0xffb4b4);
      else spr.setTint(sky.tint);

      while (actor.emotes.length) {
        const em = actor.emotes.shift()!;
        this.spawnEmote(wp.x, wp.y - 18 + bob, em);
      }
    });

    this.drawPlacementAndHighlight(bob);
  }

  private drawPlacementAndHighlight(bob: number) {
    this.highlightGfx.clear();
    const bm = this.store.buildMode;
    const cell = this.store.cursorCell;

    const drawDiamond = (gx: number, gy: number, w: number, d: number, color: number, fillAlpha: number) => {
      const p0 = gridToWorld(gx, gy);
      const p1 = gridToWorld(gx + w, gy);
      const p2 = gridToWorld(gx + w, gy + d);
      const p3 = gridToWorld(gx, gy + d);
      this.highlightGfx.fillStyle(color, fillAlpha);
      this.highlightGfx.lineStyle(1.5, color, 0.95);
      this.highlightGfx.beginPath();
      this.highlightGfx.moveTo(p0.x, p0.y + bob);
      this.highlightGfx.lineTo(p1.x, p1.y + bob);
      this.highlightGfx.lineTo(p2.x, p2.y + bob);
      this.highlightGfx.lineTo(p3.x, p3.y + bob);
      this.highlightGfx.closePath();
      this.highlightGfx.fillPath();
      this.highlightGfx.strokePath();
    };

    if (bm.kind === 'none') {
      this.previewSpr.setVisible(false);
      this.hideGroupPreviews();
      if (this.store.multiSelectMode || this.store.selectedObjects.length > 0) {
        for (const o of this.store.selectedObjects) {
          const def = objDef(o);
          const { w, d } = footprintDims(def, o.rot);
          const col = o.locked ? 0xfb923c : def.layer === 'ground' ? 0x38bdf8 : 0xffe27a;
          drawDiamond(o.gx, o.gy, w, d, col, 0.28);
        }
      } else if (this.store.selectedObject) {
        const o = this.store.selectedObject;
        const def = objDef(o);
        const { w, d } = footprintDims(def, o.rot);
        const col = o.locked ? 0xfb923c : def.layer === 'ground' ? 0x38bdf8 : 0xffe27a;
        drawDiamond(o.gx, o.gy, w, d, col, 0.24);
      }
      return;
    }

    if (bm.kind === 'move-group') {
      this.previewSpr.setVisible(false);
      const idSet = new Set(bm.objectIds);
      const movingObjs = this.store.state.objects.filter((o) => idSet.has(o.id));
      const dx = cell.gx - bm.anchorGx;
      const dy = cell.gy - bm.anchorGy;
      const check = canMoveObjects(this.store.state, movingObjs, dx, dy);
      const blockedSet = new Set(check.blockedIds);
      const now = this.store.nowTick;

      const sorted = [...movingObjs].sort((a, b) => {
        const pa = this.objectScreenPos(a);
        const pb = this.objectScreenPos(b);
        return pa.sortY - pb.sortY;
      });

      sorted.forEach((o, i) => {
        const def = objDef(o);
        const { w, d } = footprintDims(def, o.rot);
        const tx = o.gx + dx;
        const ty = o.gy + dy;
        const valid = !blockedSet.has(o.id);
        drawDiamond(tx, ty, w, d, valid ? 0x6ee86e : 0xff6262, 0.32);

        const { key: texKey, flip } = this.objectVisualTex(o, now);
        const meta = spriteMeta(texKey);
        const front = gridToWorld(tx + w, ty + d);
        const ax = flip ? 1 - meta.ax / meta.w : meta.ax / meta.w;
        let spr = this.groupPreviewSprs[i];
        if (!spr) {
          spr = this.add.image(0, 0, texKey).setAlpha(0.78);
          this.groupPreviewSprs.push(spr);
        }
        spr
          .setTexture(texKey)
          .setFlipX(flip)
          .setOrigin(ax, 1)
          .setPosition(front.x, front.y + bob)
          .setDepth(910 + i * 0.01)
          .setTint(valid ? 0xb8ffbe : 0xff9a9a)
          .setVisible(true);
      });
      for (let i = sorted.length; i < this.groupPreviewSprs.length; i++) {
        this.groupPreviewSprs[i].setVisible(false);
      }
      return;
    }

    this.hideGroupPreviews();

    if (bm.kind === 'place-item' || bm.kind === 'move-object') {
      const movingObj = bm.kind === 'move-object'
        ? this.store.state.objects.find((x) => x.id === bm.objectId)
        : undefined;
      if (bm.kind === 'move-object' && !movingObj) {
        this.previewSpr.setVisible(false);
        return;
      }
      const isPlant = !!movingObj?.plant;
      const def = movingObj ? objDef(movingObj) : ITEM_BY_ID[bm.kind === 'place-item' ? bm.itemId : ''];
      if (!def) return;
      const rot: 0 | 1 = !isPlant && def.rotatable && bm.rot === 1 ? 1 : 0;
      const ignoreId = movingObj?.id;
      const chk = canPlace(this.store.state, def, cell.gx, cell.gy, rot, ignoreId, { plant: isPlant });
      const { w, d } = footprintDims(def, rot);
      drawDiamond(cell.gx, cell.gy, w, d, chk.ok ? 0x6ee86e : 0xff6262, 0.32);

      const { key: texKey, flip } = movingObj
        ? this.objectVisualTex(movingObj, this.store.nowTick, rot)
        : itemTexKey(def.id, rot);
      const meta = spriteMeta(texKey);
      const front = gridToWorld(cell.gx + w, cell.gy + d);
      const ax = flip ? 1 - meta.ax / meta.w : meta.ax / meta.w;
      this.previewSpr
        .setTexture(texKey)
        .setFlipX(flip)
        .setOrigin(ax, 1)
        .setPosition(front.x, front.y + bob)
        .setTint(chk.ok ? 0xb8ffbe : 0xff9a9a)
        .setVisible(true);
    } else if (bm.kind === 'plant-seed') {
      const chk = canPlace(this.store.state, PLANT_ITEM, cell.gx, cell.gy, 0, undefined, { plant: true });
      drawDiamond(cell.gx, cell.gy, 1, 1, chk.ok ? 0x6ee86e : 0xff6262, 0.32);
      const texKey = `plant:${bm.plantId}:4`;
      const meta = spriteMeta(texKey);
      const front = gridToWorld(cell.gx + 1, cell.gy + 1);
      this.previewSpr
        .setTexture(texKey)
        .setFlipX(false)
        .setOrigin(meta.ax / meta.w, 1)
        .setPosition(front.x, front.y + bob)
        .setTint(chk.ok ? 0xb8ffbe : 0xff9a9a)
        .setVisible(true);
    }
  }

  private spawnEmote(x: number, y: number, em: Emote) {
    const keyMap: Record<Emote, string> = {
      heart: 'fx:heart',
      zzz: 'fx:zzz',
      sparkle: 'fx:sparkle',
      note: 'fx:note',
      drop: 'fx:drop',
      leaf: 'fx:leaf',
      question: 'fx:question',
      angry: 'fx:angry',
      sweat: 'fx:sweat',
      shy: 'fx:shy',
      star: 'fx:star',
      music: 'fx:music',
    };
    this.spawnFloatIcon(x, y, keyMap[em] ?? 'fx:heart');
  }

  private spawnFloatIcon(x: number, y: number, key: string) {
    const spr = this.add.image(x, y, key).setDepth(1200);
    this.tweens.add({
      targets: spr,
      y: y - 14,
      alpha: { from: 1, to: 0 },
      duration: 1100,
      ease: 'Sine.easeOut',
      onComplete: () => spr.destroy(),
    });
  }

  private playEffects(fx: Effect[]) {
    for (const e of fx) {
      if (e.type === 'tokens' && e.amount > 0 && e.gx !== undefined && e.gy !== undefined) {
        const c = cellCenter(e.gx, e.gy);
        this.spawnFloatIcon(c.x, c.y - 12, 'fx:token');
      } else if (e.type === 'fx') {
        if (e.name === 'butterfly') this.spawnButterfly();
        else if (e.name === 'shootingstar') this.spawnShootingStar();
        else if (e.name === 'clear' && e.gx !== undefined && e.gy !== undefined) {
          const c = cellCenter(e.gx, e.gy);
          this.spawnFloatIcon(c.x, c.y - 8, 'fx:leaf');
          this.spawnFloatIcon(c.x + 6, c.y - 12, 'fx:sparkle');
        } else if (e.name === 'sparkle' && e.gx !== undefined && e.gy !== undefined) {
          const c = cellCenter(e.gx, e.gy);
          this.spawnFloatIcon(c.x, c.y - 10, 'fx:sparkle');
        }
      }
    }
  }

  private spawnButterfly() {
    const b = this.add.sprite(-120, -20, 'fx:bfly0').play('bfly').setDepth(1100);
    this.tweens.add({
      targets: b,
      x: 120,
      y: 40,
      duration: 6500,
      onUpdate: () => {
        b.y += Math.sin(this.time.now * 0.012) * 0.35;
      },
      onComplete: () => b.destroy(),
    });
  }

  private spawnShootingStar() {
    const s = this.add.image(this.scale.width * 0.75, 24, 'fx:star').setScrollFactor(0).setDepth(-1900);
    this.tweens.add({
      targets: s,
      x: this.scale.width * 0.2,
      y: 130,
      alpha: { from: 1, to: 0 },
      duration: 1200,
      onComplete: () => s.destroy(),
    });
  }

  private updateWeatherVisuals() {
    const st = this.store.state;
    const weather = this.store.weather;
    const enabled = st.settings.weatherEnabled && !st.settings.reducedMotion;
    const density = st.settings.particleDensity;
    const count = !enabled || weather === 'clear' || weather === 'cloudy' ? 0 : density === 'low' ? 12 : density === 'high' ? 42 : 24;

    const m = terrainMap(st.stage);
    const center = cellCenter(m.w / 2, m.h / 2);
    const spreadX = Math.max(180, (m.w + m.h) * 14);
    const topY = center.y - Math.max(100, m.h * 9);
    const height = Math.max(220, m.h * 16);

    const tex =
      weather === 'snow'
        ? 'fx:snowflake'
        : weather === 'wind'
          ? 'fx:petal'
          : weather === 'sparkles'
            ? (this.store.biome === 'emberglow' ? 'fx:ember' : 'fx:sparkle')
            : 'fx:raindrop';

    this.weatherPool.forEach((p, i) => {
      if (i >= count || weather === 'fog') {
        p.setVisible(false);
        return;
      }
      if (p.texture.key !== tex) p.setTexture(tex);
      p.setVisible(true);
      const tNow = this.time.now;
      if (weather === 'rain') {
        const cyc = ((tNow * 0.22 + i * 47) % height) + topY;
        p.setPosition(center.x - spreadX / 2 + ((i * 53) % spreadX), cyc).setAlpha(0.75);
      } else if (weather === 'snow') {
        const cyc = ((tNow * 0.055 + i * 61) % height) + topY;
        const drift = Math.sin(tNow * 0.0018 + i) * 14;
        p.setPosition(center.x - spreadX / 2 + ((i * 59) % spreadX) + drift, cyc).setAlpha(0.88);
      } else if (weather === 'wind') {
        const cycX = ((tNow * 0.09 + i * 71) % spreadX) + (center.x - spreadX / 2);
        const cycY = topY + ((i * 39) % (height * 0.7)) + Math.sin(tNow * 0.003 + i) * 10;
        p.setPosition(cycX, cycY).setAlpha(0.82);
      } else {
        // starlight sparkles / floating embers
        const cycY = topY + height - ((tNow * 0.04 + i * 53) % height);
        const drift = Math.cos(tNow * 0.002 + i * 1.4) * 10;
        p.setPosition(center.x - spreadX / 2 + ((i * 67) % spreadX) + drift, cycY).setAlpha(0.5 + 0.45 * Math.sin(tNow * 0.005 + i));
      }
    });

    const showFog = enabled && weather === 'fog';
    this.fogBands.forEach((f, i) => {
      f.setVisible(showFog);
      if (!showFog) return;
      const fx = ((this.time.now * 0.015 + i * 88) % spreadX) + (center.x - spreadX / 2);
      f.setPosition(fx, center.y - 40 + (i % 3) * 32).setAlpha(density === 'low' ? 0.16 : 0.28);
    });

    // Cloud tint/count cue on cloudy days
    this.clouds.forEach((c) => {
      c.spr.setAlpha(weather === 'cloudy' || weather === 'rain' ? 0.96 : 0.78);
    });
  }

  update(_time: number, deltaMs: number) {
    if (typeof document !== 'undefined' && document.hidden) return;
    const dt = deltaMs / 1000;
    const st = this.store.state;
    const reduced = st.settings.reducedMotion;

    this.waterTimer += dt;
    if (this.waterTimer >= (reduced ? 1.4 : 0.55)) {
      this.waterTimer = 0;
      this.waterFrame = (this.waterFrame + 1) % 3;
      this.drawSky();
    }

    // Clouds
    if (!reduced) {
      for (const c of this.clouds) {
        c.spr.x += c.vx * dt;
        if (c.spr.x > 320) c.spr.x = -320;
      }
    }

    // Chimney / steam smoke puffs
    this.smokeTimer += dt;
    if (!reduced && this.smokeTimer >= 1.6) {
      this.smokeTimer = 0;
      for (const o of st.objects) {
        if (ITEM_BY_ID[o.type]?.anim === 'smoke') {
          const p = this.objectScreenPos(o);
          const puff = this.add
            .circle(p.x - 6, p.y - 42, 2.5, 0xf4f0e8, 0.75)
            .setDepth(p.sortY + 5);
          this.tweens.add({
            targets: puff,
            y: puff.y - 18,
            x: puff.x + 6,
            scale: 1.8,
            alpha: 0,
            duration: 2100,
            onComplete: () => puff.destroy(),
          });
        }
      }
    }

    // Night fireflies
    const night = this.store.sky.night;
    const fMult = st.settings.particleDensity === 'low' ? 0.45 : st.settings.particleDensity === 'high' ? 1 : 0.8;
    this.fireflies.forEach((f, i) => {
      if (night < 0.35 || !st.settings.weatherEnabled) {
        f.spr.setAlpha(0);
        return;
      }
      const t = this.time.now * 0.002 + f.phase;
      f.spr.setPosition(f.bx + Math.sin(t) * 10, f.by + Math.cos(t * 1.3 + i) * 6);
      f.spr.setAlpha(night * fMult * (0.45 + 0.5 * Math.sin(t * 2.2)));
    });

    this.updateWeatherVisuals();

    // Periodic gentle world event & weather roll
    this.eventRollTimer += dt;
    if (this.eventRollTimer >= 46) {
      this.eventRollTimer = 0;
      // Background roll: a transient storage failure here is harmless (nothing
      // changed), so just keep the rejection from becoming unhandled noise.
      this.store.maybeRollWorldEvent().catch(() => undefined);
    }

    this.syncAll(dt);
  }
}
