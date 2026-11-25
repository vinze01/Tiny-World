import {
  CREATURE_BY_ID, ITEM_BY_ID, NAME_MAX, PLANT_BY_ID, SCHEMA_VERSION, STARTING_SEEDS, STARTING_TOKENS, STAGES,
} from './catalog';
import { footprintCells, isWaterTerrain, objDef, terrainAt, terrainKey } from './grid';
import type { BiomeId, CreatureState, CustomTerrainKind, GameState, PlacedObject, Settings, Stats, Tutorial, WeatherType } from './types';

export const VALID_BIOMES: ReadonlySet<BiomeId> = new Set(STAGES.map((s) => s.biome));
const VALID_WEATHERS: ReadonlySet<WeatherType> = new Set(['clear', 'cloudy', 'rain', 'snow', 'fog', 'wind', 'sparkles']);

export const defaultSettings = (reducedMotion = false): Settings => ({
  sound: true,
  volume: 0.5,
  ambient: true,
  reducedMotion,
  cycle: 'real',
  hints: true,
  manualHour: null,
  weatherEnabled: true,
  particleDensity: 'normal',
  biomeOverride: null,
});

export const defaultTutorial = (): Tutorial => ({
  step: 0, done: false, tappedTree: false, tappedPond: false, tappedCreature: false, skipped: false,
});

export const defaultStats = (): Stats => ({
  opens: 0, nightVisits: 0, pondTaps: 0, treeTaps: 0, decorPlaced: 0, buildingsPlaced: 0, lightsPlaced: 0,
  planted: 0, watered: 0, tokensEarned: 0, tokensSpent: 0, pets: 0, feeds: 0, harvested: {}, bloomed: 0,
  clearedObstacles: 0, itemsSold: 0, pipkinInteractions: 0,
});

export const newCreature = (id: CreatureState['id'], now: number): CreatureState => ({
  id,
  name: CREATURE_BY_ID[id].name,
  affection: 0,
  discoveredAt: now,
  lastPetRewardAt: 0,
  lastPetAt: 0,
  lastFedAt: 0,
  petCount: 0,
  fedCount: 0,
  petWindowTimestamps: [],
  annoyedUntil: 0,
  emotion: 'happy',
  emotionUntil: 0,
  interactionCooldowns: {},
});

export const startingObjects = (now: number): PlacedObject[] => {
  const mk = (n: number, type: string, gx: number, gy: number, locked = true): PlacedObject => ({
    id: `o${n}`, type, gx, gy, rot: 0, placedAt: now, locked,
  });
  const objs = [
    mk(1, 'tree_big', 2, 1),
    mk(2, 'bush', 1, 4),
    mk(3, 'bush', 6, 6),
    mk(4, 'rock', 0, 2),
    mk(5, 'rock', 7, 3),
    mk(6, 'rock', 3, 6),
    mk(7, 'wildflowers', 3, 2),
    mk(8, 'wildflowers', 6, 4),
    mk(9, 'wildflowers', 2, 5),
    mk(10, 'wildflowers', 4, 6),
    mk(11, 'wildflowers', 1, 2),
    mk(12, 'bench', 6, 3, false),
  ];
  objs[11].rot = 0;
  return objs;
};

export const createInitialState = (now: number, seed = Math.floor(Math.random() * 2 ** 31), reducedMotion = false): GameState => {
  const objects = startingObjects(now);
  return {
    schema: SCHEMA_VERSION,
    rev: 0,
    seed,
    createdAt: now,
    lastActive: now,
    tokens: STARTING_TOKENS,
    stage: 1,
    inventory: { ...STARTING_SEEDS },
    customTerrain: {},
    objects,
    pickups: [],
    creatures: [newCreature('mossi', now)],
    discovered: { 'creature:mossi': now, 'item:bench': now, 'item:tree_big': now, 'plant:daisy': now },
    achievements: {},
    stats: defaultStats(),
    events: { lastEventAt: 0, recent: [], rainUntil: 0, counts: {}, weather: 'clear', weatherUntil: 0 },
    forage: {},
    settings: defaultSettings(reducedMotion),
    tutorial: defaultTutorial(),
    nextId: 100,
  };
};

/**
 * Minimal natural landmark accents added when expanding to a new stage.
 * Newly opened buildable ground is intentionally kept uncluttered (no auto-spawned paths,
 * stepping stones, or locked rocks) so the player can design freely.
 */
export const stageExpansionObjects = (stage: number, now: number, startId: number): PlacedObject[] => {
  const mk = (n: number, type: string, gx: number, gy: number, rot: 0 | 1 = 0): PlacedObject => ({
    id: `o${n}`, type, gx, gy, rot, placedAt: now, locked: true,
  });
  switch (stage) {
    case 2: return [mk(startId, 'birch', 9, 2)];
    case 3: return [mk(startId, 'crystal_cluster', 13, 3)];
    case 4: return [mk(startId, 'cherry', 16, 4)];
    case 5: return [mk(startId, 'cloud_tree', 21, 5)];
    case 6: return [mk(startId, 'snow_pine', 22, 6)];
    case 7: return [mk(startId, 'autumn_maple', 5, 19)];
    case 8: return [mk(startId, 'basalt_spire', 25, 20)];
    case 9: return [mk(startId, 'star_willow', 12, 29)];
    case 10: return [mk(startId, 'everdream_tree', 30, 12)];
    default: return [];
  }
};

export const grovePlants = (now: number, startId: number): PlacedObject[] => stageExpansionObjects(2, now, startId);

// ---------------------------------------------------------------- validation
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Migrations: each entry upgrades from version N to N+1.
 * Keep them pure and idempotent.
 */
export const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  // 0 -> 1: pre-release saves without schema and with `coins` instead of `tokens`
  0: (raw) => {
    const out = { ...raw };
    if (out.tokens === undefined && isNum(out.coins)) out.tokens = out.coins;
    delete out.coins;
    out.schema = 1;
    return out;
  },
  // 1 -> 2: unlock previously-locked path/stepping tiles, add weather/visual settings & creature states
  1: (raw) => {
    const out = { ...raw };
    if (Array.isArray(raw.objects)) {
      out.objects = raw.objects.map((o) => {
        if (!isObj(o) || typeof o.type !== 'string') return o;
        const def = ITEM_BY_ID[o.type];
        if (def && !def.scenery && def.layer === 'ground' && o.locked === true) {
          const clone = { ...o };
          delete clone.locked;
          return clone;
        }
        return o;
      });
    }
    const prevSettings = isObj(raw.settings) ? raw.settings : {};
    out.settings = {
      manualHour: null,
      weatherEnabled: true,
      particleDensity: 'normal',
      biomeOverride: null,
      ...prevSettings,
    };
    const prevEvents = isObj(raw.events) ? raw.events : {};
    out.events = {
      weather: 'clear',
      weatherUntil: 0,
      ...prevEvents,
    };
    out.schema = 2;
    return out;
  },
};

export const migrate = (raw: unknown): Record<string, unknown> | null => {
  if (!isObj(raw)) return null;
  let cur: Record<string, unknown> = { ...raw };
  let v = isNum(cur.schema) ? cur.schema : 0;
  if (v > SCHEMA_VERSION) return null; // saved by a newer version: refuse rather than corrupt it
  while (v < SCHEMA_VERSION) {
    const fn = MIGRATIONS[v];
    if (!fn) return null;
    cur = fn(cur);
    v = isNum(cur.schema) ? cur.schema : v + 1;
  }
  return cur;
};

/**
 * Validate (and gently repair) loaded data. Returns null when the data cannot be trusted at all.
 */
export const sanitizeName = (raw: string): string =>
  raw.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);

export const validateState = (raw: unknown, now = Date.now()): GameState | null => {
  const m = migrate(raw);
  if (!m) return null;
  const base = createInitialState(now, isNum(m.seed) ? m.seed : 1);
  const s: GameState = { ...base };
  if (!isNum(m.tokens) || m.tokens < 0) return null;
  s.tokens = Math.floor(Math.min(m.tokens, 1e9));
  s.stage = isNum(m.stage) ? Math.min(Math.max(1, Math.floor(m.stage)), STAGES.filter((x) => x.playable).length) : 1;
  s.rev = isNum(m.rev) ? Math.max(0, Math.floor(m.rev)) : 0;
  s.createdAt = isNum(m.createdAt) ? m.createdAt : now;
  s.lastActive = isNum(m.lastActive) ? m.lastActive : now;
  s.nextId = isNum(m.nextId) ? Math.max(100, Math.floor(m.nextId)) : 100;

  s.inventory = {};
  if (isObj(m.inventory)) {
    for (const [k, v] of Object.entries(m.inventory)) {
      if (isNum(v) && v > 0 && /^(seed|decor|food):/.test(k)) s.inventory[k] = Math.min(Math.floor(v), 9999);
    }
  }

  s.customTerrain = {};
  if (isObj(m.customTerrain)) {
    for (const [k, v] of Object.entries(m.customTerrain)) {
      if (v !== 'snow' && v !== 'sand') continue;
      const parts = k.split(',');
      if (parts.length !== 2) continue;
      const gx = Number(parts[0]);
      const gy = Number(parts[1]);
      if (!Number.isInteger(gx) || !Number.isInteger(gy)) continue;
      const t = terrainAt(s.stage, gx, gy);
      if (t === 'void' || isWaterTerrain(t)) continue;
      s.customTerrain[terrainKey(gx, gy)] = v as CustomTerrainKind;
    }
  }

  const seen = new Set<string>();
  const placedTerrain = new Set<string>();
  const objs: PlacedObject[] = [];
  if (!Array.isArray(m.objects)) return null;
  for (const o of m.objects) {
    if (!isObj(o) || typeof o.id !== 'string' || typeof o.type !== 'string' || seen.has(o.id)) continue;
    if (!isNum(o.gx) || !isNum(o.gy)) continue;
    const isPlant = isObj(o.plant) && o.type in PLANT_BY_ID;
    if (!isPlant && !ITEM_BY_ID[o.type]) continue;
    const po: PlacedObject = {
      id: o.id, type: o.type, gx: Math.floor(o.gx), gy: Math.floor(o.gy), rot: o.rot === 1 ? 1 : 0,
      placedAt: isNum(o.placedAt) ? o.placedAt : now,
    };
    if (o.locked === true) po.locked = true;
    if (isPlant) {
      const p = o.plant as Record<string, unknown>;
      po.plant = {
        plantedAt: isNum(p.plantedAt) ? p.plantedAt : now,
        bonusMs: isNum(p.bonusMs) ? Math.max(0, p.bonusMs) : 0,
        waterCount: isNum(p.waterCount) ? Math.max(0, Math.floor(p.waterCount)) : 0,
      };
    }
    const d = objDef(po);
    if (footprintCells(d, po.gx, po.gy, po.rot).some((c) => terrainAt(s.stage, c.gx, c.gy) === 'void')) continue;
    if (d.terrainPaint) {
      const key = terrainKey(po.gx, po.gy);
      if (s.customTerrain[key] !== d.terrainPaint || placedTerrain.has(key)) continue;
      placedTerrain.add(key);
      delete po.locked;
      po.rot = 0;
    }
    seen.add(po.id);
    objs.push(po);
  }
  // Older saves have painted cells without placed items. Keep stable IDs until the next save.
  for (const [key, paint] of Object.entries(s.customTerrain)) {
    if (placedTerrain.has(key)) continue;
    const [gx, gy] = key.split(',').map(Number);
    let id = `terrain:${key}`;
    while (seen.has(id)) id += ':';
    objs.push({ id, type: paint === 'snow' ? 'snow_patch' : 'sand_patch', gx, gy, rot: 0, placedAt: s.createdAt });
  }
  s.objects = objs;

  s.pickups = [];
  if (Array.isArray(m.pickups)) {
    for (const p of m.pickups) {
      if (!isObj(p) || typeof p.id !== 'string' || !isNum(p.gx) || !isNum(p.gy) || !isNum(p.amount)) continue;
      if (terrainAt(s.stage, p.gx, p.gy) === 'void') continue;
      s.pickups.push({
        id: p.id, kind: (typeof p.kind === 'string' ? p.kind : 'sparkle') as GameState['pickups'][number]['kind'],
        amount: Math.min(Math.max(1, Math.floor(p.amount)), 100), gx: p.gx, gy: p.gy,
        createdAt: isNum(p.createdAt) ? p.createdAt : now,
        bonusItem: typeof p.bonusItem === 'string' ? p.bonusItem : undefined,
      });
    }
    s.pickups = s.pickups.slice(0, 12);
  }

  s.creatures = [];
  if (Array.isArray(m.creatures)) {
    const ids = new Set<string>();
    for (const c of m.creatures) {
      if (!isObj(c) || typeof c.id !== 'string' || !(c.id in CREATURE_BY_ID) || ids.has(c.id)) continue;
      ids.add(c.id);
      const nc = newCreature(c.id as CreatureState['id'], isNum(c.discoveredAt) ? c.discoveredAt : now);
      nc.name = sanitizeName(typeof c.name === 'string' ? c.name : '') || nc.name;
      nc.affection = isNum(c.affection) ? Math.max(0, Math.floor(c.affection)) : 0;
      for (const k of ['lastPetRewardAt', 'lastPetAt', 'lastFedAt', 'petCount', 'fedCount', 'annoyedUntil', 'emotionUntil'] as const) {
        if (isNum(c[k])) nc[k] = c[k] as number;
      }
      if (Array.isArray(c.petWindowTimestamps)) {
        nc.petWindowTimestamps = c.petWindowTimestamps.filter(isNum).slice(-12);
      }
      if (typeof c.emotion === 'string') {
        nc.emotion = c.emotion as CreatureState['emotion'];
      }
      if (isObj(c.interactionCooldowns)) {
        const ic: Record<string, number> = {};
        for (const [ik, iv] of Object.entries(c.interactionCooldowns)) if (isNum(iv)) ic[ik] = iv;
        nc.interactionCooldowns = ic;
      }
      s.creatures.push(nc);
    }
  }
  if (!s.creatures.length) s.creatures.push(newCreature('mossi', now));

  const numRecord = (v: unknown): Record<string, number> => {
    const out: Record<string, number> = {};
    if (isObj(v)) for (const [k, x] of Object.entries(v)) if (isNum(x)) out[k] = x;
    return out;
  };
  s.discovered = numRecord(m.discovered);
  s.achievements = numRecord(m.achievements);
  s.forage = numRecord(m.forage);

  s.stats = { ...defaultStats(), harvested: {} };
  if (isObj(m.stats)) {
    for (const k of Object.keys(s.stats) as (keyof Stats)[]) {
      if (k === 'harvested') s.stats.harvested = numRecord((m.stats as Record<string, unknown>).harvested);
      else if (isNum((m.stats as Record<string, unknown>)[k])) (s.stats[k] as number) = (m.stats as Record<string, number>)[k];
    }
  }
  s.events = { lastEventAt: 0, recent: [], rainUntil: 0, counts: {}, weather: 'clear', weatherUntil: 0 };
  if (isObj(m.events)) {
    s.events.lastEventAt = isNum(m.events.lastEventAt) ? m.events.lastEventAt : 0;
    s.events.rainUntil = isNum(m.events.rainUntil) ? m.events.rainUntil : 0;
    s.events.recent = Array.isArray(m.events.recent) ? m.events.recent.filter((x) => typeof x === 'string').slice(-6) : [];
    s.events.counts = numRecord(m.events.counts);
    if (typeof m.events.weather === 'string' && VALID_WEATHERS.has(m.events.weather as WeatherType)) {
      s.events.weather = m.events.weather as WeatherType;
    }
    s.events.weatherUntil = isNum(m.events.weatherUntil) ? m.events.weatherUntil : 0;
  }
  s.settings = { ...defaultSettings() };
  if (isObj(m.settings)) {
    const st = m.settings;
    if (typeof st.sound === 'boolean') s.settings.sound = st.sound;
    if (typeof st.ambient === 'boolean') s.settings.ambient = st.ambient;
    if (typeof st.reducedMotion === 'boolean') s.settings.reducedMotion = st.reducedMotion;
    if (typeof st.hints === 'boolean') s.settings.hints = st.hints;
    if (isNum(st.volume)) s.settings.volume = Math.min(1, Math.max(0, st.volume));
    if (st.cycle === 'real' || st.cycle === 'fast' || st.cycle === 'day' || st.cycle === 'night' || st.cycle === 'custom') {
      s.settings.cycle = st.cycle;
    }
    s.settings.manualHour = isNum(st.manualHour) ? ((st.manualHour % 24) + 24) % 24 : null;
    if (typeof st.weatherEnabled === 'boolean') s.settings.weatherEnabled = st.weatherEnabled;
    if (st.particleDensity === 'low' || st.particleDensity === 'normal' || st.particleDensity === 'high') {
      s.settings.particleDensity = st.particleDensity;
    }
    s.settings.biomeOverride = typeof st.biomeOverride === 'string' && VALID_BIOMES.has(st.biomeOverride as BiomeId)
      ? (st.biomeOverride as BiomeId)
      : null;
  }
  s.tutorial = defaultTutorial();
  if (isObj(m.tutorial)) {
    const t = m.tutorial;
    s.tutorial.step = isNum(t.step) ? Math.max(0, Math.floor(t.step)) : 0;
    for (const k of ['done', 'tappedTree', 'tappedPond', 'tappedCreature', 'skipped'] as const) {
      if (typeof t[k] === 'boolean') s.tutorial[k] = t[k] as boolean;
    }
  } else {
    s.tutorial.done = true;
  }
  return s;
};
