import { EVENTS, EVENT_BY_ID, MAX_OFFLINE_EVENTS, MAX_PICKUPS, MS_MIN, OFFLINE_CAP_MS, PLANTS, seedKey, stageBiome } from './catalog';
import { terrainMap, walkGrid } from './grid';
import { discover, newId } from './helpers';
import { canWater, applyWater, isBlooming } from './plants';
import { hash, mulberry32 } from './rng';
import { phaseOf, hourFor } from './daycycle';
import type { BiomeId, Ctx, Effect, GameState, Pickup, PickupKind, Terrain, WeatherType } from './types';
import type { EventDef } from './catalog';

export const EVENT_MIN_GAP = 45_000;
const OFFLINE_EVENT_SPACING = 20 * MS_MIN;
const RAIN_DURATION = 50_000;
const WEATHER_DURATION_MS = 90_000;
/** accept at most this much clock rewind as "frozen game time"; beyond it we treat the clock as repaired */
export const CLOCK_REPAIR_MS = 3 * 24 * 60 * MS_MIN;

const PICKUP_TERRAINS: ReadonlySet<Terrain> = new Set(['grass', 'snow', 'autumn', 'starstone', 'sand']);

export const WEATHER_META: Record<WeatherType, { label: string; icon: string }> = {
  clear: { label: 'Clear Skies', icon: '☀️' },
  cloudy: { label: 'Drifting Clouds', icon: '☁️' },
  rain: { label: 'Gentle Rain', icon: '🌧️' },
  snow: { label: 'Soft Snowfall', icon: '❄️' },
  fog: { label: 'Misty Air', icon: '🌫️' },
  wind: { label: 'Warm Breeze', icon: '🍃' },
  sparkles: { label: 'Starlight Drift', icon: '✨' },
};

const BIOME_WEATHER_WEIGHTS: Record<BiomeId, Partial<Record<WeatherType, number>>> = {
  meadow: { clear: 42, cloudy: 18, wind: 20, rain: 12, sparkles: 8 },
  breeze: { clear: 36, wind: 26, cloudy: 16, rain: 12, sparkles: 10 },
  crystal: { clear: 32, sparkles: 24, wind: 16, cloudy: 14, fog: 8, rain: 6 },
  mist: { fog: 28, clear: 24, rain: 18, cloudy: 16, sparkles: 8, wind: 6 },
  sky: { clear: 34, wind: 24, sparkles: 22, cloudy: 14, fog: 6 },
  frostfall: { snow: 42, clear: 22, cloudy: 16, wind: 10, sparkles: 10 },
  mistwood: { fog: 30, rain: 20, clear: 22, cloudy: 14, sparkles: 8, wind: 6 },
  emberglow: { clear: 34, wind: 24, cloudy: 18, sparkles: 16, fog: 8 },
  starlight: { sparkles: 34, clear: 30, fog: 14, wind: 12, cloudy: 10 },
  everdream: { sparkles: 26, clear: 26, wind: 18, rain: 12, snow: 10, fog: 8 },
};

export const activeBiome = (s: GameState): BiomeId =>
  s.settings.biomeOverride ?? stageBiome(s.stage);

export const activeWeather = (s: GameState, now: number): WeatherType => {
  if (!s.settings.weatherEnabled) return 'clear';
  if (s.events.rainUntil > now) return 'rain';
  if ((s.events.weatherUntil ?? 0) > now && s.events.weather) return s.events.weather;
  return 'clear';
};

export const nextEventEtaMs = (s: GameState, now: number): number => {
  if (s.events.lastEventAt > now) return EVENT_MIN_GAP;
  return Math.max(0, s.events.lastEventAt + EVENT_MIN_GAP - now);
};

export const rollWeather = (s: GameState, ctx: Ctx, fx: Effect[]): WeatherType => {
  const cur = activeWeather(s, ctx.now);
  if (!s.settings.weatherEnabled || s.events.rainUntil > ctx.now) return cur;
  if ((s.events.weatherUntil ?? 0) > ctx.now && s.events.weather) return cur;
  const biome = activeBiome(s);
  const weights = BIOME_WEATHER_WEIGHTS[biome] ?? BIOME_WEATHER_WEIGHTS.meadow;
  const entries = (Object.entries(weights) as [WeatherType, number][]).filter(([, w]) => w > 0);
  const total = entries.reduce((acc, [, w]) => acc + w, 0);
  let r = ctx.rng() * total;
  let next: WeatherType = 'clear';
  for (const [wType, weight] of entries) {
    r -= weight;
    if (r <= 0) {
      next = wType;
      break;
    }
  }
  s.events.weather = next;
  s.events.weatherUntil = ctx.now + WEATHER_DURATION_MS + Math.floor(ctx.rng() * 35_000);
  if (next === 'rain') {
    s.events.rainUntil = Math.max(s.events.rainUntil, ctx.now + RAIN_DURATION);
    for (const o of s.objects) if (o.plant && canWater(o, ctx.now)) applyWater(o);
  }
  if (next !== cur) fx.push({ type: 'weather', weather: next });
  return next;
};

const freeCell = (s: GameState, rng: () => number): { gx: number; gy: number } | null => {
  const grid = walkGrid(s);
  const m = terrainMap(s.stage);
  const cells: { gx: number; gy: number }[] = [];
  for (let gy = 0; gy < m.h; gy++) {
    for (let gx = 0; gx < m.w; gx++) {
      if (!grid[gy][gx] || !PICKUP_TERRAINS.has(m.cells[gy][gx])) continue;
      if (s.pickups.some((p) => p.gx === gx && p.gy === gy)) continue;
      cells.push({ gx, gy });
    }
  }
  if (!cells.length) return null;
  return cells[Math.floor(rng() * cells.length)];
}

const addPickup = (s: GameState, ctx: Ctx, kind: PickupKind, amount: number, bonusItem?: string): Pickup | null => {
  if (s.pickups.length >= MAX_PICKUPS) return null;
  const c = freeCell(s, ctx.rng);
  if (!c) return null;
  const p: Pickup = { id: newId(s), kind, amount, gx: c.gx, gy: c.gy, createdAt: ctx.now, bonusItem };
  s.pickups.push(p);
  return p;
}

const eligible = (s: GameState, e: EventDef, night: boolean, now: number): boolean => {
  if (e.nightOnly && !night) return false;
  if (e.dayOnly && night) return false;
  if (e.id === 'twofriends' && s.creatures.length < 2) return false;
  const makesPickup = ['butterfly', 'rareflower', 'shinystone', 'mushroomgrow', 'gift', 'shootingstar'].includes(e.id);
  if (makesPickup && s.pickups.length >= MAX_PICKUPS) return false;
  if (e.id === 'rain' && !s.objects.some((o) => o.plant && canWater(o, 0))) {
    // still allowed – rain is pretty – unless it is already raining
  }
  if (e.id === 'rain' && s.events.rainUntil > 0) return false;
  return true;
}

const choose = (s: GameState, rng: () => number, night: boolean, now: number, force?: string): EventDef | null => {
  if (force) return EVENT_BY_ID[force] ?? null;
  const recent = s.events.recent.slice(-3);
  const pool = EVENTS.filter((e) => !recent.includes(e.id) && eligible(s, e, night, now));
  const total = pool.reduce((a, e) => a + e.weight, 0);
  if (!total) return null;
  let r = rng() * total;
  for (const e of pool) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return pool[pool.length - 1];
}

/**
 * Roll one random world event. Outcomes are always bounded: pickups are capped at MAX_PICKUPS
 * and every pickup carries a small fixed value.
 */
export const rollEvent = (
  s: GameState,
  ctx: Ctx,
  fx: Effect[],
  opts: { offline: boolean; night: boolean; force?: string },
): EventDef | null => {
  if (!opts.offline && !opts.force && ctx.now - s.events.lastEventAt < EVENT_MIN_GAP && s.events.lastEventAt <= ctx.now) return null;
  const e = choose(s, ctx.rng, opts.night, ctx.now, opts.force);
  if (!e) return null;
  s.events.lastEventAt = ctx.now;
  s.events.recent = [...s.events.recent, e.id].slice(-6);
  s.events.counts[e.id] = (s.events.counts[e.id] ?? 0) + 1;
  discover(s, `event:${e.id}`, ctx.now, fx);
  const visual = !opts.offline;
  const note = (t: string) => fx.push({ type: 'toast', text: t });

  switch (e.id) {
    case 'butterfly': {
      const p = addPickup(s, ctx, 'sparkle', 1);
      if (visual) fx.push({ type: 'fx', name: 'butterfly', gx: p?.gx, gy: p?.gy });
      note('A butterfly visited the island!');
      break;
    }
    case 'rareflower': {
      addPickup(s, ctx, 'rareflower', 5);
      note('A rare flower bloomed on its own!');
      break;
    }
    case 'shinystone': {
      const c = s.creatures[Math.floor(ctx.rng() * s.creatures.length)];
      const p = addPickup(s, ctx, 'stone', 6 + Math.floor(ctx.rng() * 3));
      if (visual) fx.push({ type: 'fx', name: 'dig', creature: c?.id, gx: p?.gx, gy: p?.gy });
      note(`${c?.name ?? 'A Pipkin'} found a shiny stone!`);
      break;
    }
    case 'shootingstar': {
      if (visual) fx.push({ type: 'fx', name: 'shootingstar' });
      addPickup(s, ctx, 'wish', 2);
      note('A shooting star! Make a wish.');
      break;
    }
    case 'mushroomgrow': {
      addPickup(s, ctx, 'mushroom', 2);
      note('A mushroom sprouted near the tree.');
      break;
    }
    case 'twofriends': {
      const pool = [...s.creatures];
      const a = pool.splice(Math.floor(ctx.rng() * pool.length), 1)[0];
      const b = pool[Math.floor(ctx.rng() * pool.length)];
      a.affection += 1;
      b.affection += 1;
      if (visual) fx.push({ type: 'fx', name: 'twoFriends', creature: a.id });
      note(`${a.name} and ${b.name} stopped to chat.`);
      break;
    }
    case 'rain': {
      s.events.rainUntil = ctx.now + RAIN_DURATION;
      s.events.weather = 'rain';
      s.events.weatherUntil = ctx.now + RAIN_DURATION;
      for (const o of s.objects) if (o.plant && canWater(o, ctx.now)) applyWater(o);
      if (visual) fx.push({ type: 'fx', name: 'rain' });
      fx.push({ type: 'weather', weather: 'rain' });
      note('A gentle rain is watering your garden.');
      break;
    }
    case 'gift': {
      const unlocked = PLANTS.filter((p) => p.stage <= s.stage);
      const seed = unlocked[Math.floor(ctx.rng() * unlocked.length)];
      addPickup(s, ctx, 'gift', 8 + Math.floor(ctx.rng() * 5), seedKey(seed.id));
      note('A mysterious gift appeared!');
      break;
    }
  }
  return e;
}

/**
 * Offline progression. Plant growth is derived from timestamps (nothing to simulate); here we only
 * (1) repair clock problems, (2) roll a bounded number of events, and (3) build a summary.
 */
export const applyOffline = (s: GameState, ctx: Ctx, fx: Effect[]): string[] => {
  const lines: string[] = [];
  const prev = s.lastActive;
  let now = ctx.now;

  if (prev - now > CLOCK_REPAIR_MS) {
    // clock was set far ahead and then fixed: re-anchor instead of freezing the island for years
    for (const o of s.objects) if (o.plant && o.plant.plantedAt > now) o.plant.plantedAt = now;
    for (const k of Object.keys(s.forage)) if (s.forage[k] > now + 6 * MS_MIN) s.forage[k] = now;
    for (const c of s.creatures) {
      c.lastPetAt = 0;
      c.lastFedAt = 0;
      c.lastPetRewardAt = 0;
      c.petWindowTimestamps = [];
      c.annoyedUntil = 0;
      c.emotion = 'relaxed';
      c.emotionUntil = 0;
      c.interactionCooldowns = {};
    }
    s.events.lastEventAt = 0;
    s.events.rainUntil = 0;
    s.events.weatherUntil = 0;
    s.events.weather = 'clear';
    s.lastActive = now;
    return lines;
  }
  if (now < prev) now = prev; // clock moved backwards a little: game time never goes back

  const elapsed = Math.min(Math.max(0, now - prev), OFFLINE_CAP_MS);
  const before = new Set(s.objects.filter((o) => o.plant && isBlooming(o, prev)).map((o) => o.id));
  const bloomed = s.objects.filter((o) => o.plant && isBlooming(o, now) && !before.has(o.id));
  if (bloomed.length) lines.push(`${bloomed.length} plant${bloomed.length > 1 ? 's' : ''} bloomed while you were away.`);

  if (s.events.rainUntil && s.events.rainUntil <= now) s.events.rainUntil = 0;
  if (s.events.weatherUntil && s.events.weatherUntil <= now) {
    s.events.weatherUntil = 0;
    s.events.weather = 'clear';
  }

  const n = Math.min(MAX_OFFLINE_EVENTS, Math.floor(elapsed / OFFLINE_EVENT_SPACING));
  const pickupsBefore = s.pickups.length;
  const names: string[] = [];
  const off: Effect[] = [];
  const offlineCycle = s.settings.cycle === 'fast' || s.settings.cycle === 'custom' ? 'real' : s.settings.cycle;
  for (let i = 0; i < n; i++) {
    const rng = mulberry32(hash(s.seed, prev, i));
    const t = prev + (elapsed * (i + 1)) / (n + 1);
    const night = phaseOf(hourFor(t, offlineCycle)) === 'night';
    const e = rollEvent(s, { now: t, rng }, off, { offline: true, night });
    if (e) names.push(e.name);
  }
  fx.push(...off.filter((x) => x.type === 'discover'));
  if (names.length) lines.push(`Something happened: ${names.join(', ')}.`);
  if (s.pickups.length > pickupsBefore) lines.push(`${s.pickups.length - pickupsBefore} sparkle${s.pickups.length - pickupsBefore > 1 ? 's' : ''} are waiting to be collected.`);
  if (elapsed > 30 * MS_MIN && s.creatures.length) {
    const c = s.creatures[hash(s.seed, prev) % s.creatures.length];
    lines.push(`${c.name} had a lovely nap.`);
  }
  s.lastActive = now;
  return lines;
}


