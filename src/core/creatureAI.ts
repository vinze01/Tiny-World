import type { CreatureId, EmotionType, WeatherType } from './types';
import { findPath } from './grid';

export type AIState = 'idle' | 'wander' | 'inspect' | 'interact' | 'rest' | 'sleep';
export type Anim = 'idle' | 'walk' | 'sleep' | 'happy' | 'curious' | 'interact' | 'eat';
export type PoiKind =
  | 'tree'
  | 'bush'
  | 'flower'
  | 'plant'
  | 'light'
  | 'pond'
  | 'cottage'
  | 'shelter'
  | 'mushroom'
  | 'decor'
  | 'bench'
  | 'building'
  | 'crystal'
  | 'bridge'
  | 'fire'
  | 'water';
export type Emote =
  | 'heart'
  | 'zzz'
  | 'sparkle'
  | 'note'
  | 'drop'
  | 'leaf'
  | 'question'
  | 'angry'
  | 'sweat'
  | 'shy'
  | 'star'
  | 'music';

export interface Poi { kind: PoiKind; gx: number; gy: number }
export interface Cell { gx: number; gy: number }

export interface WorldView {
  grid: boolean[][];
  pois: Poi[];
  /** 0 day … 1 deep night */
  night: number;
  others: { id: string; gx: number; gy: number }[];
  rng: () => number;
  weather?: WeatherType;
  emotions?: Record<string, EmotionType>;
}

export interface Actor {
  id: CreatureId;
  state: AIState;
  timer: number;
  gx: number;
  gy: number;
  path: Cell[];
  facing: 1 | -1;
  anim: Anim;
  poi?: Poi;
  /** what to do once the path is finished */
  arrive?: AIState;
  reaction?: { anim: Anim; left: number };
  emotes: Emote[];
  emoteTimer: number;
  /** set after 'arrive' to hold the interaction pose */
  holding: boolean;
  /** current emotional tone synced from persistent state */
  emotion?: EmotionType;
}

interface Personality {
  speed: number;
  weights: Record<AIState, number>;
  inspect: PoiKind[];
  rest: PoiKind[];
  sleep: PoiKind[];
  interact: PoiKind[];
  interactAnim: Anim;
  interactEmote: Emote;
  follow: number;
}

export const PERSONALITY: Record<CreatureId, Personality> = {
  mossi: { speed: 0.9, weights: { idle: 2, wander: 3, inspect: 3, interact: 1, rest: 1, sleep: 1 }, inspect: ['tree', 'flower', 'plant', 'bridge'], rest: ['bush', 'bench'], sleep: ['bush', 'tree'], interact: ['plant', 'flower'], interactAnim: 'curious', interactEmote: 'leaf', follow: 0.1 },
  bloop: { speed: 1.7, weights: { idle: 1, wander: 4, inspect: 2.5, interact: 3, rest: 0.4, sleep: 0.3 }, inspect: ['pond', 'water', 'bridge'], rest: ['pond', 'water'], sleep: ['pond'], interact: ['pond', 'flower', 'water'], interactAnim: 'happy', interactEmote: 'drop', follow: 0.15 },
  ember: { speed: 1.35, weights: { idle: 1, wander: 4, inspect: 2, interact: 2.2, rest: 2, sleep: 0.5 }, inspect: ['decor', 'plant', 'tree', 'light', 'fire'], rest: ['fire', 'light'], sleep: ['fire', 'light'], interact: ['fire', 'decor', 'flower'], interactAnim: 'interact', interactEmote: 'sparkle', follow: 0.15 },
  puffin: { speed: 0.72, weights: { idle: 2, wander: 1, inspect: 0.6, interact: 1, rest: 2.2, sleep: 3.8 }, inspect: ['flower', 'building'], rest: ['cottage', 'shelter', 'bench', 'building'], sleep: ['cottage', 'shelter', 'bench'], interact: ['cottage', 'shelter'], interactAnim: 'happy', interactEmote: 'heart', follow: 0.55 },
  sprig: { speed: 1, weights: { idle: 2, wander: 1.6, inspect: 3, interact: 2, rest: 1.5, sleep: 1 }, inspect: ['mushroom', 'plant'], rest: ['decor', 'bush', 'tree'], sleep: ['bush', 'mushroom'], interact: ['plant', 'mushroom'], interactAnim: 'interact', interactEmote: 'drop', follow: 0.1 },
  frosty: { speed: 0.95, weights: { idle: 2, wander: 2.5, inspect: 2.5, interact: 2, rest: 1.5, sleep: 1.5 }, inspect: ['crystal', 'pond', 'tree'], rest: ['shelter', 'bench', 'crystal'], sleep: ['shelter', 'tree'], interact: ['crystal', 'decor'], interactAnim: 'curious', interactEmote: 'sparkle', follow: 0.15 },
  nimbus: { speed: 1.25, weights: { idle: 1.5, wander: 3.5, inspect: 2, interact: 1.8, rest: 2, sleep: 1.8 }, inspect: ['building', 'bridge', 'tree'], rest: ['bench', 'bridge', 'shelter'], sleep: ['shelter', 'bench'], interact: ['building', 'flower'], interactAnim: 'happy', interactEmote: 'note', follow: 0.3 },
  glimmer: { speed: 1.15, weights: { idle: 1.5, wander: 2.5, inspect: 3.5, interact: 2.5, rest: 1, sleep: 0.8 }, inspect: ['crystal', 'light', 'water'], rest: ['crystal', 'bench'], sleep: ['crystal', 'shelter'], interact: ['crystal', 'light'], interactAnim: 'curious', interactEmote: 'star', follow: 0.2 },
  cinder: { speed: 1.1, weights: { idle: 1.8, wander: 2.8, inspect: 2, interact: 2.5, rest: 2.2, sleep: 1 }, inspect: ['fire', 'light', 'building'], rest: ['fire', 'building', 'shelter'], sleep: ['fire', 'shelter'], interact: ['fire', 'building'], interactAnim: 'interact', interactEmote: 'sparkle', follow: 0.1 },
  luna: { speed: 0.92, weights: { idle: 2.2, wander: 2, inspect: 3, interact: 1.8, rest: 1.8, sleep: 2 }, inspect: ['light', 'flower', 'crystal', 'building'], rest: ['bench', 'shelter', 'building'], sleep: ['shelter', 'cottage'], interact: ['flower', 'light'], interactAnim: 'curious', interactEmote: 'star', follow: 0.12 },
  pebble: { speed: 0.68, weights: { idle: 3, wander: 1.8, inspect: 2.2, interact: 1.6, rest: 3, sleep: 2.4 }, inspect: ['bench', 'decor', 'crystal', 'bridge'], rest: ['bench', 'decor', 'bush'], sleep: ['bush', 'shelter'], interact: ['bench', 'decor'], interactAnim: 'interact', interactEmote: 'leaf', follow: 0.2 },
  wisp: { speed: 1.08, weights: { idle: 1.6, wander: 3, inspect: 2.8, interact: 2, rest: 1.5, sleep: 1.2 }, inspect: ['water', 'pond', 'mushroom', 'plant'], rest: ['tree', 'water', 'shelter'], sleep: ['tree', 'bush'], interact: ['mushroom', 'flower', 'water'], interactAnim: 'curious', interactEmote: 'drop', follow: 0.22 },
  astra: { speed: 1.32, weights: { idle: 1, wander: 3.6, inspect: 2.8, interact: 2.5, rest: 1.2, sleep: 1 }, inspect: ['light', 'crystal', 'building', 'flower'], rest: ['light', 'bench'], sleep: ['shelter', 'building'], interact: ['crystal', 'light'], interactAnim: 'happy', interactEmote: 'star', follow: 0.35 },
  flurry: { speed: 1.5, weights: { idle: 1, wander: 4, inspect: 2, interact: 2.6, rest: 1, sleep: 0.6 }, inspect: ['decor', 'crystal', 'bridge'], rest: ['shelter', 'fire'], sleep: ['cottage', 'shelter'], interact: ['decor', 'flower'], interactAnim: 'happy', interactEmote: 'music', follow: 0.4 },
  bloom: { speed: 1.05, weights: { idle: 1.5, wander: 2.5, inspect: 3, interact: 3, rest: 1.5, sleep: 1.2 }, inspect: ['flower', 'plant', 'tree', 'building'], rest: ['bench', 'flower', 'shelter'], sleep: ['shelter', 'tree'], interact: ['flower', 'plant'], interactAnim: 'happy', interactEmote: 'heart', follow: 0.45 },
};

export const createActor = (id: CreatureId, gx: number, gy: number): Actor => ({
  id,
  state: 'idle',
  timer: 1.5,
  gx,
  gy,
  path: [],
  facing: 1,
  anim: 'idle',
  emotes: [],
  emoteTimer: 0,
  holding: false,
  emotion: 'happy',
});

const cellOf = (a: Actor) => ({ gx: Math.round(a.gx), gy: Math.round(a.gy) });
const range = (rng: () => number, lo: number, hi: number) => lo + rng() * (hi - lo);

/** True when a cell has a planted flower/crop or sits directly behind a tree trunk where the canopy hides creatures. */
const isCrowdedTile = (gx: number, gy: number, world: WorldView): boolean => {
  for (const q of world.pois) {
    if (q.kind === 'plant' && q.gx === gx && q.gy === gy) return true;
    if (q.kind === 'tree' && ((gx === q.gx && gy === q.gy - 1) || (gx === q.gx - 1 && gy === q.gy) || (gx === q.gx - 1 && gy === q.gy - 1))) {
      return true;
    }
  }
  return false;
};

/** Count how many walkable tiles are reachable from `start` (up to `limit`) to detect enclosed pockets. */
export const reachableCount = (grid: boolean[][], start: Cell, limit = 6): number => {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  if (start.gx < 0 || start.gy < 0 || start.gx >= w || start.gy >= h || !grid[start.gy][start.gx]) return 0;
  const seen = new Set<number>([start.gy * w + start.gx]);
  const q: Cell[] = [start];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let i = 0; i < q.length && seen.size < limit; i++) {
    const cur = q[i];
    for (const [dx, dy] of dirs) {
      const nx = cur.gx + dx, ny = cur.gy + dy;
      const k = ny * w + nx;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && grid[ny][nx] && !seen.has(k)) {
        seen.add(k);
        q.push({ gx: nx, gy: ny });
      }
    }
  }
  return seen.size;
};

const weightedPick = <T extends string>(rng: () => number, w: Record<T, number>): T => {
  const keys = Object.keys(w) as T[];
  const total = keys.reduce((a, k) => a + Math.max(0, w[k]), 0);
  if (total <= 0) return keys[0];
  let r = rng() * total;
  for (const k of keys) {
    r -= Math.max(0, w[k]);
    if (r <= 0) return k;
  }
  return keys[0];
};

/** Choose the next behaviour from the personality, weather, emotional state, and surroundings. */
export const chooseState = (a: Actor, world: WorldView): AIState => {
  const p = PERSONALITY[a.id];
  const emo = world.emotions?.[a.id] ?? a.emotion ?? 'happy';
  const w = { ...p.weights };

  w.sleep *= 1 + 6 * world.night;
  w.wander *= 1 - 0.65 * world.night;
  w.inspect *= 1 - 0.5 * world.night;
  w.rest *= 1 + 1.4 * world.night;

  // React to dynamic weather
  if (world.weather === 'rain' || world.weather === 'fog') {
    w.rest *= 1.8;
    w.sleep *= 1.3;
    if (a.id === 'bloop' || a.id === 'wisp') {
      w.interact *= 1.8;
      w.wander *= 1.4;
    } else {
      w.wander *= 0.7;
    }
  } else if (world.weather === 'snow') {
    if (a.id === 'frosty' || a.id === 'flurry') {
      w.interact *= 2;
      w.wander *= 1.6;
    } else if (a.id === 'ember' || a.id === 'cinder') {
      w.rest *= 2;
    }
  } else if (world.weather === 'sparkles' || world.weather === 'wind') {
    w.inspect *= 1.5;
    w.interact *= 1.4;
  }

  // React to persistent emotion
  if (emo === 'annoyed' || emo === 'angry') {
    w.wander *= 1.6;
    w.idle *= 1.8;
    w.interact *= 0.2;
    w.rest *= 1.5;
  } else if (emo === 'sleepy') {
    w.sleep *= 3.2;
    w.rest *= 2;
    w.wander *= 0.4;
  } else if (emo === 'excited') {
    w.interact *= 2.2;
    w.wander *= 1.8;
  } else if (emo === 'shy') {
    w.rest *= 1.6;
    w.interact *= 0.5;
  }

  if (a.state === 'sleep') w.sleep *= 0.3;
  if (a.state !== 'idle') w[a.state] *= 0.5;
  const has = (kinds: PoiKind[]) => world.pois.some((q) => kinds.includes(q.kind));
  if (!has(p.inspect)) w.inspect = 0;
  if (!has(p.interact)) w.interact = p.interactAnim === 'happy' || p.interactAnim === 'interact' ? Math.min(w.interact, 0.8) : 0;
  if (!has(p.rest)) w.rest *= 0.5;
  return weightedPick(world.rng, w);
};

const nearestApproach = (a: Actor, poi: Poi, world: WorldView): Cell[] | null => {
  const from = cellOf(a);
  const allCands: Cell[] = [
    { gx: poi.gx + 1, gy: poi.gy },
    { gx: poi.gx, gy: poi.gy + 1 },
    { gx: poi.gx - 1, gy: poi.gy },
    { gx: poi.gx, gy: poi.gy - 1 },
    poi,
  ].filter((c) => world.grid[c.gy]?.[c.gx]);
  if (!allCands.length) return null;
  const clearCands = allCands.filter((c) => !isCrowdedTile(c.gx, c.gy, world));
  const cands = clearCands.length ? clearCands : allCands;
  cands.sort((u, v) => Math.abs(u.gx - from.gx) + Math.abs(u.gy - from.gy) - (Math.abs(v.gx - from.gx) + Math.abs(v.gy - from.gy)));
  for (const c of cands.slice(0, 2)) {
    const path = findPath(world.grid, from, c);
    if (path) return path;
  }
  return null;
};

const pickPoi = (a: Actor, kinds: PoiKind[], world: WorldView): Poi | undefined => {
  const pool = world.pois.filter((q) => kinds.includes(q.kind));
  if (!pool.length) return undefined;
  return pool[Math.floor(world.rng() * pool.length)];
};

const randomWalkable = (a: Actor, world: WorldView, maxDist: number): Cell | null => {
  const from = cellOf(a);
  for (let i = 0; i < 14; i++) {
    const gx = from.gx + Math.round(range(world.rng, -maxDist, maxDist));
    const gy = from.gy + Math.round(range(world.rng, -maxDist, maxDist));
    if (world.grid[gy]?.[gx] && !(gx === from.gx && gy === from.gy) && !isCrowdedTile(gx, gy, world)) {
      return { gx, gy };
    }
  }
  return null;
};

const beginState = (a: Actor, next: AIState, world: WorldView) => {
  const p = PERSONALITY[a.id];
  const emo = world.emotions?.[a.id] ?? a.emotion ?? 'happy';
  a.state = next;
  a.holding = false;
  a.path = [];
  a.poi = undefined;
  a.arrive = undefined;
  const rng = world.rng;
  switch (next) {
    case 'idle':
      a.timer = range(rng, 2, 5);
      break;
    case 'wander': {
      let target: Cell | null = null;
      const socialChance = emo === 'annoyed' || emo === 'angry' ? 0 : p.follow;
      if (socialChance > 0 && rng() < socialChance) {
        const others = world.others.filter((x) => x.id !== a.id);
        if (others.length) {
          const f = others[Math.floor(rng() * others.length)];
          target = { gx: Math.round(f.gx) + (rng() < 0.5 ? 1 : -1), gy: Math.round(f.gy) };
          if (!world.grid[target.gy]?.[target.gx]) target = null;
          if (target && rng() < 0.45) a.emotes.push('note');
        }
      }
      target ??= randomWalkable(a, world, 5);
      const path = target ? findPath(world.grid, cellOf(a), target) : null;
      if (path && path.length) { a.path = path; a.timer = 22; } else { a.state = 'idle'; a.timer = range(rng, 1, 3); }
      break;
    }
    case 'inspect':
    case 'interact':
    case 'rest':
    case 'sleep': {
      let kinds = next === 'inspect' ? p.inspect : next === 'interact' ? p.interact : next === 'rest' ? p.rest : p.sleep;
      if ((next === 'rest' || next === 'sleep') && (world.weather === 'rain' || world.weather === 'snow')) {
        kinds = ['cottage', 'shelter', 'building', ...kinds];
      }
      const poi = pickPoi(a, kinds, world);
      const path = poi ? nearestApproach(a, poi, world) : null;
      if (poi && path) {
        a.poi = poi;
        a.path = path;
        a.arrive = next;
        a.timer = 26;
      } else if (next === 'sleep' || next === 'rest' || next === 'interact') {
        a.holding = true;
        a.timer = next === 'sleep' ? range(rng, 12, 26) : next === 'rest' ? range(rng, 5, 9) : range(rng, 1.8, 3);
      } else {
        a.state = 'idle';
        a.timer = range(rng, 1, 3);
      }
      break;
    }
  }
};

const onArrive = (a: Actor, world: WorldView) => {
  const p = PERSONALITY[a.id];
  const rng = world.rng;
  a.holding = true;
  if (a.poi) {
    const dx = a.poi.gx - a.gx;
    const dy = a.poi.gy - a.gy;
    const sx = dx - dy;
    if (Math.abs(sx) > 0.01) a.facing = sx > 0 ? 1 : -1;
  }
  switch (a.state) {
    case 'inspect': a.timer = range(rng, 2.2, 4); a.emotes.push('question'); break;
    case 'interact': a.timer = range(rng, 2, 3.4); a.emotes.push(p.interactEmote); break;
    case 'rest': a.timer = range(rng, 6, 12); break;
    case 'sleep': a.timer = range(rng, 14, 34); break;
    default: a.timer = 1;
  }
};

const animFor = (a: Actor): Anim => {
  if (a.reaction) return a.reaction.anim;
  if (a.path.length && !a.holding) return 'walk';
  const p = PERSONALITY[a.id];
  switch (a.state) {
    case 'inspect': return a.holding ? 'curious' : 'idle';
    case 'interact': return a.holding ? p.interactAnim : 'idle';
    case 'sleep': return a.holding ? 'sleep' : 'idle';
    default: return 'idle';
  }
};

/** Advance the finite-state machine by `dt` seconds. */
export const tickActor = (a: Actor, dt: number, world: WorldView) => {
  dt = Math.min(dt, 0.25);
  const p = PERSONALITY[a.id];
  if (world.emotions?.[a.id]) a.emotion = world.emotions[a.id];

  const here = cellOf(a);
  if (!world.grid[here.gy]?.[here.gx] || reachableCount(world.grid, here, 5) < 5) {
    let best: Cell | null = null;
    let bd = 1e9;
    world.grid.forEach((row, gy) =>
      row.forEach((ok, gx) => {
        if (!ok || reachableCount(world.grid, { gx, gy }, 5) < 5 || isCrowdedTile(gx, gy, world)) return;
        const d = (gx - a.gx) ** 2 + (gy - a.gy) ** 2;
        if (d < bd) {
          bd = d;
          best = { gx, gy };
        }
      }),
    );
    if (!best) {
      world.grid.forEach((row, gy) =>
        row.forEach((ok, gx) => {
          if (!ok) return;
          const d = (gx - a.gx) ** 2 + (gy - a.gy) ** 2;
          if (d < bd) {
            bd = d;
            best = { gx, gy };
          }
        }),
      );
    }
    if (best) {
      a.gx = (best as Cell).gx;
      a.gy = (best as Cell).gy;
      a.path = [];
      a.state = 'idle';
      a.timer = 1;
    }
  } else if (!a.path.length && !a.reaction && isCrowdedTile(here.gx, here.gy, world)) {
    nudgeActor(a, world);
  }

  if (a.reaction) {
    a.reaction.left -= dt;
    if (a.reaction.left <= 0) {
      a.reaction = undefined;
      a.state = 'idle';
      a.holding = false;
      a.timer = range(world.rng, 1, 2.5);
    }
    a.anim = animFor(a);
    return;
  }

  if (a.path.length && !a.holding) {
    const next = a.path[0];
    if (!world.grid[next.gy]?.[next.gx]) {
      a.path = [];
      a.state = 'idle';
      a.timer = 1;
    } else {
      const dx = next.gx - a.gx;
      const dy = next.gy - a.gy;
      const dist = Math.hypot(dx, dy);
      const speedMult = a.emotion === 'excited' ? 1.25 : a.emotion === 'sleepy' ? 0.78 : a.emotion === 'annoyed' || a.emotion === 'angry' ? 1.18 : 1;
      const step = p.speed * speedMult * dt;
      const sx = dx - dy;
      if (Math.abs(sx) > 0.05) a.facing = sx > 0 ? 1 : -1;
      if (dist <= step) {
        a.gx = next.gx;
        a.gy = next.gy;
        a.path.shift();
        if (!a.path.length) {
          if (a.arrive) { const s = a.arrive; a.arrive = undefined; a.state = s; onArrive(a, world); }
          else { a.state = 'idle'; a.timer = range(world.rng, 1.5, 4); }
        }
      } else {
        a.gx += (dx / dist) * step;
        a.gy += (dy / dist) * step;
      }
    }
  } else {
    a.timer -= dt;
    if (a.state === 'sleep' && a.holding) {
      a.emoteTimer -= dt;
      if (a.emoteTimer <= 0) { a.emoteTimer = 2.4; a.emotes.push('zzz'); }
    }
    if (a.state === 'rest' && a.holding && (a.id === 'ember' || a.id === 'cinder')) {
      a.emoteTimer -= dt;
      if (a.emoteTimer <= 0) { a.emoteTimer = 3; a.emotes.push('sparkle'); }
    }
    if ((a.emotion === 'annoyed' || a.emotion === 'angry') && a.timer % 2 < dt) {
      a.emoteTimer -= dt;
      if (a.emoteTimer <= 0) { a.emoteTimer = 2.8; a.emotes.push(a.emotion === 'angry' ? 'angry' : 'sweat'); }
    }
    if (a.timer <= 0) beginState(a, chooseState(a, world), world);
  }
  if (a.emotes.length > 6) a.emotes.length = 6;
  a.anim = animFor(a);
};

/** Gently ask a Pipkin to step onto an open meadow tile so they don't block gardening or hide behind trees. */
export const nudgeActor = (a: Actor, world: WorldView) => {
  const from = cellOf(a);
  const cands: Cell[] = [
    { gx: from.gx + 1, gy: from.gy },
    { gx: from.gx, gy: from.gy + 1 },
    { gx: from.gx - 1, gy: from.gy },
    { gx: from.gx, gy: from.gy - 1 },
    { gx: from.gx + 1, gy: from.gy + 1 },
    { gx: from.gx + 2, gy: from.gy },
    { gx: from.gx, gy: from.gy + 2 },
  ];
  for (const c of cands) {
    if (!world.grid[c.gy]?.[c.gx] || isCrowdedTile(c.gx, c.gy, world)) continue;
    const path = findPath(world.grid, from, c);
    if (path && path.length) {
      a.reaction = undefined;
      a.holding = false;
      a.arrive = undefined;
      a.state = 'wander';
      a.path = path;
      a.timer = 10;
      return;
    }
  }
};

/** Direct a Pipkin to walk to a goal cell (used by Call, Follow, Rest, or annoyance retreat). */
export const directActor = (
  a: Actor,
  target: Cell,
  world: WorldView,
  mode: 'call' | 'follow' | 'rest' | 'retreat',
): boolean => {
  const from = cellOf(a);
  let dest = target;
  if (!world.grid[dest.gy]?.[dest.gx]) {
    const nearby = [
      { gx: target.gx + 1, gy: target.gy },
      { gx: target.gx, gy: target.gy + 1 },
      { gx: target.gx - 1, gy: target.gy },
      { gx: target.gx, gy: target.gy - 1 },
    ].find((c) => world.grid[c.gy]?.[c.gx]);
    if (!nearby) return false;
    dest = nearby;
  }
  const path = findPath(world.grid, from, dest);
  if (!path || !path.length) return false;
  a.reaction = undefined;
  a.holding = false;
  a.path = path;
  a.state = mode === 'rest' ? 'rest' : 'wander';
  a.arrive = mode === 'rest' ? 'sleep' : 'idle';
  a.timer = 18;
  if (mode === 'retreat') a.emotes.push('angry');
  else if (mode === 'follow') a.emotes.push('star');
  else if (mode === 'call') a.emotes.push('note');
  return true;
};

/** Immediate player-driven reaction (pet / feed / play / wave / annoyed / cheer / etc.). */
export const react = (
  a: Actor,
  kind: 'pet' | 'feed' | 'curious' | 'arrive' | 'spin' | 'play' | 'wave' | 'call' | 'cheer' | 'annoyed' | 'angry' | 'rest',
) => {
  a.path = [];
  a.holding = false;
  a.arrive = undefined;
  if (kind === 'pet') {
    a.reaction = { anim: a.id === 'mossi' ? 'curious' : 'happy', left: 1.6 };
    a.emotes.push('heart');
  } else if (kind === 'feed') {
    a.reaction = { anim: 'eat', left: 1.4 };
    a.emotes.push('heart', 'sparkle');
  } else if (kind === 'arrive' || kind === 'spin' || kind === 'play') {
    a.reaction = { anim: 'happy', left: 1.8 };
    a.emotes.push('music', 'sparkle');
  } else if (kind === 'wave' || kind === 'cheer') {
    a.reaction = { anim: 'happy', left: 1.5 };
    a.emotes.push('heart', 'note');
  } else if (kind === 'annoyed' || kind === 'angry') {
    a.reaction = { anim: 'interact', left: 1.4 };
    a.emotes.push(kind === 'angry' ? 'angry' : 'sweat');
  } else if (kind === 'rest') {
    a.state = 'sleep';
    a.holding = true;
    a.timer = 12;
    a.emotes.push('zzz');
  } else {
    a.reaction = { anim: 'curious', left: 1.4 };
    a.emotes.push('question');
  }
};
