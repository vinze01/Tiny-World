import {
  ACHIEVEMENTS, AFFECTION_LEVELS, AFFECTION_REWARDS, CREATURE_BY_ID, EVENT_BY_ID, ITEM_BY_ID, MAX_PLAYABLE_STAGE, MS_MIN,
  PLANT_BY_ID, STAGES, TREAT_ID, TREAT_PRICE, affectionLevel, decorKey, obstacleClearCost, resaleValue, seedKey,
} from './catalog';
import { canPlace, objDef, PLANT_ITEM } from './grid';
import { applyWater, canWater, isBlooming, resetAfterHarvest } from './plants';
import { newCreature, sanitizeName, stageExpansionObjects, VALID_BIOMES } from './state';
import { isRealNight } from './daycycle';
import { applyOffline, rollEvent, rollWeather } from './events';
import { addTokens, discover, giveInv, newId } from './helpers';
import type {
  ActionResult, Ctx, CreatureId, CreatureInteractionKind, CreatureState, Effect, EmotionType,
  GameState, PlacedObject, PlantId, Settings,
} from './types';

// ------------------------------------------------------------- helpers
export const fail = (reason: string): ActionResult => ({ ok: false, reason, effects: [] });
export const done = (effects: Effect[], data?: Record<string, unknown>): ActionResult => ({ ok: true, effects, data });

const getObj = (s: GameState, id: string) => s.objects.find((o) => o.id === id);
const inv = (s: GameState, key: string) => s.inventory[key] ?? 0;
const takeInv = (s: GameState, key: string, n = 1): boolean => {
  if (inv(s, key) < n) return false;
  s.inventory[key] -= n;
  if (s.inventory[key] <= 0) delete s.inventory[key];
  return true;
};

export const placedDecorCount = (s: GameState) =>
  s.objects.filter((o) => !o.locked && !o.plant && (ITEM_BY_ID[o.type]?.price ?? 0) >= 5).length;

export const totalHarvests = (s: GameState) =>
  Object.values(s.stats.harvested).reduce((a, b) => a + b, 0);

/** Active emotional state respecting expiration timestamps. */
export const effectiveEmotion = (c: CreatureState, now: number): EmotionType => {
  if (c.annoyedUntil && c.annoyedUntil > now) {
    return c.emotion === 'angry' ? 'angry' : 'annoyed';
  }
  if (c.emotion && c.emotion !== 'annoyed' && c.emotion !== 'angry' && c.emotionUntil && c.emotionUntil > now) {
    return c.emotion;
  }
  return 'happy';
};

export const setCreatureEmotion = (c: CreatureState, emotion: EmotionType, until: number) => {
  c.emotion = emotion;
  c.emotionUntil = until;
};

// ------------------------------------------------------------- finalize
const unlockCreature = (s: GameState, id: CreatureId, ctx: Ctx, fx: Effect[]) => {
  if (s.creatures.some((c) => c.id === id)) return;
  s.creatures.push(newCreature(id, ctx.now));
  discover(s, `creature:${id}`, ctx.now, fx);
  fx.push({ type: 'creature-arrived', id });
  fx.push({ type: 'toast', text: `${CREATURE_BY_ID[id].name} has joined your island!` });
};

/** Runs after every mutating action: creature arrivals, blooms and achievements. */
export const finalize = (s: GameState, ctx: Ctx, fx: Effect[]) => {
  const hasObj = (...ids: string[]) => s.objects.some((o) => ids.includes(o.type));
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    const ensure = (cond: boolean, id: CreatureId) => {
      if (cond && !s.creatures.some((c) => c.id === id)) {
        unlockCreature(s, id, ctx, fx);
        changed = true;
      }
    };

    ensure(s.stats.pondTaps >= 3, 'bloop');
    ensure(s.stats.lightsPlaced >= 1, 'ember');
    ensure(s.stage >= 2, 'puffin');
    ensure((s.stats.harvested.mushroom ?? 0) >= 1, 'sprig');
    ensure((s.stage >= 3 && hasObj('crystal_cluster', 'ice_crystal', 'well')) || s.stage >= 4, 'glimmer');
    ensure((s.stage >= 3 && ((s.stats.clearedObstacles ?? 0) >= 1 || hasObj('stones'))) || s.stage >= 5, 'pebble');
    ensure(
      (s.stage >= 4 && ((s.stats.harvested.moonflower ?? 0) >= 1 || s.stats.nightVisits >= 1 || hasObj('observatory', 'fairy_lights'))) || s.stage >= 5,
      'luna',
    );
    ensure(s.stage >= 5, 'nimbus');
    ensure(s.stage >= 6, 'frosty');
    ensure(
      (s.stage >= 6 && (hasObj('snowman', 'hot_cocoa', 'snow_fort', 'ski_lodge') || (s.stats.harvested.frostberry ?? 0) >= 1)) || s.stage >= 7,
      'flurry',
    );
    ensure(s.stage >= 7, 'wisp');
    ensure(s.stage >= 8, 'cinder');
    ensure(s.stage >= 9, 'astra');
    ensure(s.stage >= 10, 'bloom');

    for (const o of s.objects) {
      if (o.plant && isBlooming(o, ctx.now)) {
        const key = `plant:${o.type}`;
        if (!s.discovered[`bloom:${o.type}`]) {
          s.discovered[`bloom:${o.type}`] = ctx.now;
          s.stats.bloomed++;
          fx.push({ type: 'bloom', objectId: o.id });
          changed = true;
        }
        discover(s, key, ctx.now, fx);
      }
    }

    const best = Math.max(0, ...s.creatures.map((c) => affectionLevel(c.affection)));
    const harvests = totalHarvests(s);
    const checks: Record<string, boolean> = {
      first_steps: s.stats.opens >= 1,
      green_thumb: s.stats.bloomed >= 1 || harvests >= 1,
      new_friend: s.creatures.length >= 2,
      cozy_corner: s.stats.decorPlaced >= 5,
      little_explorer: Object.keys(s.discovered).filter((k) => !k.startsWith('bloom:')).length >= 10,
      night_owl: s.stats.nightVisits >= 1,
      snack_time: s.stats.feeds >= 1,
      builder: s.stats.buildingsPlaced >= 1,
      harvest_ten: harvests >= 10,
      best_friends: best >= 3,
      tidy_island: (s.stats.clearedObstacles ?? 0) >= 5,
      thrifty_trader: (s.stats.itemsSold ?? 0) >= 1,
      blooming_grove: s.stage >= 2,
      crystal_pond: s.stage >= 3,
      moonlit_garden: s.stage >= 4,
      cloud_sanctuary: s.stage >= 5,
      frostfall_haven: s.stage >= 6,
      mistwood_hollow: s.stage >= 7,
      emberglow_valley: s.stage >= 8,
      starlight_isles: s.stage >= 9,
      everdream_paradise: s.stage >= 10,
      full_family: s.creatures.length >= 5,
      growing_circle: s.creatures.length >= 10,
      paradise_kin: s.creatures.length >= 15,
      rainy_day: (s.events.counts.rain ?? 0) >= 1,
    };
    for (const a of ACHIEVEMENTS) {
      if (checks[a.id] && !s.achievements[a.id]) {
        s.achievements[a.id] = ctx.now;
        fx.push({ type: 'achievement', id: a.id });
        addTokens(s, a.reward, fx);
        changed = true;
      }
    }
    if (!changed) break;
  }
};

// ------------------------------------------------------------- actions
export type Mutator<P = void> = (s: GameState, ctx: Ctx, p: P) => ActionResult;

const withFinalize = <P>(fn: (s: GameState, ctx: Ctx, p: P, fx: Effect[]) => ActionResult | void): Mutator<P> =>
  (s, ctx, p) => {
    const fx: Effect[] = [];
    const r = fn(s, ctx, p, fx);
    if (r && !r.ok) return r;
    finalize(s, ctx, fx);
    return r ? { ...r, effects: [...r.effects, ...fx] } : done(fx);
  };

/** Called once when an interface opens: offline progression + visit stats. */
export const wake: Mutator<{ hadSave?: boolean } | void> = withFinalize((s, ctx, _p, fx) => {
  const lines = applyOffline(s, ctx, fx);
  s.stats.opens++;
  if (isRealNight(ctx.now)) s.stats.nightVisits++;
  if (lines.length) fx.push({ type: 'welcome-back', lines });
});

/** Lightweight heartbeat so lastActive stays fresh without gameplay changes. */
export const touch: Mutator = (s, ctx) => {
  s.lastActive = Math.max(s.lastActive, ctx.now);
  return done([]);
};

export const collectPickup: Mutator<{ id: string }> = withFinalize((s, ctx, p, fx) => {
  const i = s.pickups.findIndex((x) => x.id === p.id);
  if (i < 0) return fail('Already collected');
  const pk = s.pickups[i];
  s.pickups.splice(i, 1);
  addTokens(s, pk.amount, fx, pk.gx, pk.gy);
  if (pk.bonusItem) {
    giveInv(s, pk.bonusItem, 1);
    const pname = pk.bonusItem.startsWith('seed:') ? `${PLANT_BY_ID[pk.bonusItem.slice(5) as PlantId]?.name ?? 'Mystery'} seed` : 'treat';
    fx.push({ type: 'toast', text: `Found a ${pname}!` });
  }
});

export const FORAGE_COOLDOWN = 6 * MS_MIN;
/** Tap a tree or bush. Naturally replenishing: tokens once every few minutes. */
export const interact: Mutator<{ id: string }> = withFinalize((s, ctx, p, fx) => {
  const o = getObj(s, p.id);
  if (!o) return fail('Nothing there');
  const tags = ITEM_BY_ID[o.type]?.tags ?? [];
  if (tags.includes('tree') || tags.includes('bush')) {
    if (tags.includes('tree')) s.stats.treeTaps++;
    s.tutorial.tappedTree = s.tutorial.tappedTree || tags.includes('tree');
    const ready = (s.forage[o.id] ?? 0) <= ctx.now;
    if (!ready) return done([], { ready: false, waitMs: s.forage[o.id] - ctx.now });
    s.forage[o.id] = ctx.now + FORAGE_COOLDOWN;
    const amt = tags.includes('tree') ? 2 : 1;
    addTokens(s, amt, fx, o.gx, o.gy);
    fx.push({ type: 'toast', text: tags.includes('tree') ? 'An acorn dropped from the branches!' : 'You found a few berries!' });
    return done([], { ready: true, amount: amt });
  }
  return done([], { ready: false, inert: true });
});

export const tapPond: Mutator = withFinalize((s, ctx, _p, fx) => {
  s.stats.pondTaps++;
  const first = !s.tutorial.tappedPond;
  s.tutorial.tappedPond = true;
  if (first) {
    addTokens(s, 2, fx);
    fx.push({ type: 'toast', text: 'Something sparkly floated up from the pond!' });
  }
  discover(s, 'item:pond', ctx.now, fx);
});

const KIND_PREFIX: Record<string, string> = { seed: 'seed:', decor: 'decor:', food: 'food:' };

export const buy: Mutator<{ key: string; qty: number }> = withFinalize((s, ctx, p, fx) => {
  const qty = Math.floor(p.qty);
  if (!Number.isFinite(qty) || qty < 1 || qty > 99) return fail('Invalid amount');
  const [kind, id] = p.key.split(':');
  if (!KIND_PREFIX[kind]) return fail('Unknown item');
  let unit = 0;
  if (kind === 'seed') {
    const pd = PLANT_BY_ID[id as PlantId];
    if (!pd) return fail('Unknown seed');
    if (pd.stage > s.stage) return fail('Not unlocked yet');
    unit = pd.seedPrice;
  } else if (kind === 'decor') {
    const d = ITEM_BY_ID[id];
    if (!d || d.scenery) return fail('Unknown item');
    if (d.stage > s.stage) return fail('Not unlocked yet');
    unit = d.price;
  } else {
    if (p.key !== TREAT_ID) return fail('Unknown item');
    unit = TREAT_PRICE;
  }
  const total = unit * qty;
  if (s.tokens < total) return fail('Not enough Nature Tokens');
  s.tokens -= total;
  s.stats.tokensSpent += total;
  giveInv(s, p.key, qty);
  if (kind === 'decor') discover(s, `item:${id}`, ctx.now, fx);
  fx.push({ type: 'tokens', amount: -total });
  return done([], { total });
});

export const sellItem: Mutator<{ key: string; qty: number }> = withFinalize((s, _ctx, p, fx) => {
  const qty = Math.floor(p.qty);
  if (!Number.isFinite(qty) || qty < 1 || qty > 9999) return fail('Invalid quantity');
  const owned = inv(s, p.key);
  if (owned < qty) return fail('You do not have that many');
  const [kind, id] = p.key.split(':');
  let basePrice = 0;
  let label = 'Item';
  if (kind === 'seed') {
    const pd = PLANT_BY_ID[id as PlantId];
    if (!pd) return fail('Cannot sell unknown item');
    basePrice = pd.seedPrice;
    label = `${pd.name} Seed`;
  } else if (kind === 'decor') {
    const d = ITEM_BY_ID[id];
    if (!d || d.scenery || d.price <= 0) return fail('This item cannot be sold');
    basePrice = d.price;
    label = d.name;
  } else if (p.key === TREAT_ID) {
    basePrice = TREAT_PRICE;
    label = 'Pipkin Treat';
  } else {
    return fail('This item cannot be sold');
  }
  const unitResale = resaleValue(basePrice);
  if (unitResale <= 0) return fail('This item has no resale value');
  if (!takeInv(s, p.key, qty)) return fail('You do not have that many');
  const total = unitResale * qty;
  s.stats.itemsSold = (s.stats.itemsSold ?? 0) + qty;
  addTokens(s, total, fx);
  fx.push({ type: 'sold', id: p.key, qty, amount: total });
  fx.push({ type: 'toast', text: `Sold ${qty}× ${label} for +${total} Tokens!` });
  return done([], { total, unitResale, qty });
});

export const placeItem: Mutator<{ itemId: string; gx: number; gy: number; rot: 0 | 1 }> = withFinalize((s, ctx, p, fx) => {
  const def = ITEM_BY_ID[p.itemId];
  if (!def || def.scenery) return fail('Unknown item');
  if (inv(s, decorKey(def.id)) < 1) return fail("You don't own this item");
  const rot: 0 | 1 = def.rotatable && p.rot === 1 ? 1 : 0;
  const chk = canPlace(s, def, p.gx, p.gy, rot);
  if (!chk.ok) return fail(chk.reason ?? 'Cannot place here');
  takeInv(s, decorKey(def.id));
  const obj: PlacedObject = { id: newId(s), type: def.id, gx: p.gx, gy: p.gy, rot, placedAt: ctx.now };
  s.objects.push(obj);
  if (def.price >= 5) s.stats.decorPlaced++;
  if (def.category === 'buildings') s.stats.buildingsPlaced++;
  if (def.light) s.stats.lightsPlaced++;
  return done([], { id: obj.id });
});

export const moveObject: Mutator<{ id: string; gx: number; gy: number; rot: 0 | 1 }> = withFinalize((s, _ctx, p) => {
  const o = getObj(s, p.id);
  if (!o) return fail('Nothing there');
  if (o.locked) return fail('This is part of the island');
  if (o.plant) return fail('Plants stay where they grow');
  const def = objDef(o);
  const rot: 0 | 1 = def.rotatable && p.rot === 1 ? 1 : 0;
  const chk = canPlace(s, def, p.gx, p.gy, rot, o.id);
  if (!chk.ok) return fail(chk.reason ?? 'Cannot place here');
  o.gx = p.gx;
  o.gy = p.gy;
  o.rot = rot;
  return done([]);
});

export const rotateObject: Mutator<{ id: string }> = withFinalize((s, _ctx, p, fx) => {
  const o = getObj(s, p.id);
  if (!o) return fail('Nothing there');
  if (o.locked) return fail('This is part of the island');
  if (o.plant) return fail('Plants cannot be rotated');
  const def = objDef(o);
  if (!def.rotatable) return fail('This item keeps one orientation');
  const nextRot: 0 | 1 = o.rot === 1 ? 0 : 1;
  const chk = canPlace(s, def, o.gx, o.gy, nextRot, o.id);
  if (!chk.ok) return fail(chk.reason ?? 'Not enough space to rotate here');
  o.rot = nextRot;
  fx.push({ type: 'fx', name: 'sparkle', gx: o.gx, gy: o.gy });
  return done([], { rot: nextRot });
});

export const removeObject: Mutator<{ id: string }> = withFinalize((s, _ctx, p) => {
  const i = s.objects.findIndex((o) => o.id === p.id);
  if (i < 0) return fail('Nothing there');
  const o = s.objects[i];
  if (o.locked) return fail('This is part of the island');
  s.objects.splice(i, 1);
  delete s.forage[o.id];
  if (o.plant) giveInv(s, seedKey(o.type));
  else giveInv(s, decorKey(o.type));
  return done([], { returned: o.plant ? seedKey(o.type) : decorKey(o.type) });
});

export const sellPlacedObject: Mutator<{ id: string }> = withFinalize((s, _ctx, p, fx) => {
  const i = s.objects.findIndex((o) => o.id === p.id);
  if (i < 0) return fail('Nothing there');
  const o = s.objects[i];
  if (o.locked) return fail('Clear this obstacle instead of selling');
  let basePrice = 0;
  let label = 'Item';
  if (o.plant) {
    const pd = PLANT_BY_ID[o.type as PlantId];
    if (!pd) return fail('Cannot sell unknown plant');
    basePrice = pd.seedPrice;
    label = `${pd.name} Seed`;
  } else {
    const d = ITEM_BY_ID[o.type];
    if (!d || d.scenery || d.price <= 0) return fail('This item cannot be sold');
    basePrice = d.price;
    label = d.name;
  }
  const amount = resaleValue(basePrice);
  if (amount <= 0) return fail('This item has no resale value');
  s.objects.splice(i, 1);
  delete s.forage[o.id];
  s.stats.itemsSold = (s.stats.itemsSold ?? 0) + 1;
  addTokens(s, amount, fx, o.gx, o.gy);
  fx.push({ type: 'sold', id: o.plant ? seedKey(o.type) : decorKey(o.type), qty: 1, amount });
  fx.push({ type: 'toast', text: `Sold ${label} for +${amount} Tokens!` });
  return done([], { amount });
});

export const clearObstacle: Mutator<{ id: string }> = withFinalize((s, _ctx, p, fx) => {
  const i = s.objects.findIndex((o) => o.id === p.id);
  if (i < 0) return fail('Nothing there');
  const o = s.objects[i];
  if (!o.locked) return fail('Store or move player items freely instead');
  const def = ITEM_BY_ID[o.type];
  if (!def || def.protected) return fail('The Great Old Tree watches over this island and cannot be removed');
  const cost = obstacleClearCost(o.type);
  if (cost <= 0) return fail('Cannot be removed');
  if (s.tokens < cost) return fail(`Need ${cost} Nature Tokens to clear ${def.name}`);
  s.tokens -= cost;
  s.stats.tokensSpent += cost;
  s.stats.clearedObstacles = (s.stats.clearedObstacles ?? 0) + 1;
  s.objects.splice(i, 1);
  delete s.forage[o.id];
  fx.push({ type: 'tokens', amount: -cost, gx: o.gx, gy: o.gy });
  fx.push({ type: 'cleared', objectId: o.id, cost, gx: o.gx, gy: o.gy });
  fx.push({ type: 'fx', name: 'clear', gx: o.gx, gy: o.gy });
  fx.push({ type: 'toast', text: `Cleared ${def.name} (-${cost} Tokens).` });
  return done([], { cost, type: o.type });
});

export const plantSeed: Mutator<{ plantId: PlantId; gx: number; gy: number }> = withFinalize((s, ctx, p, fx) => {
  const def = PLANT_BY_ID[p.plantId];
  if (!def) return fail('Unknown plant');
  if (def.stage > s.stage) return fail('Not unlocked yet');
  if (inv(s, seedKey(def.id)) < 1) return fail('You have no seeds of this kind');
  const chk = canPlace(s, PLANT_ITEM, p.gx, p.gy, 0, undefined, { plant: true });
  if (!chk.ok) return fail(chk.reason ?? 'Cannot plant here');
  takeInv(s, seedKey(def.id));
  const o: PlacedObject = {
    id: newId(s), type: def.id, gx: p.gx, gy: p.gy, rot: 0, placedAt: ctx.now,
    plant: { plantedAt: ctx.now, bonusMs: 0, waterCount: 0 },
  };
  s.objects.push(o);
  s.stats.planted++;
  discover(s, `plant:${def.id}`, ctx.now, fx);
  return done([], { id: o.id });
});

export const waterPlant: Mutator<{ id: string }> = withFinalize((s, ctx, p, fx) => {
  const o = getObj(s, p.id);
  if (!o?.plant) return fail('Nothing to water');
  if (!canWater(o, ctx.now)) return fail(isBlooming(o, ctx.now) ? 'Already in bloom!' : 'Plenty of water for now');
  applyWater(o);
  s.stats.watered++;
  fx.push({ type: 'toast', text: 'Splash! It will grow a little faster.' });
});

export const waterAll: Mutator = withFinalize((s, ctx, _p, fx) => {
  const targets = s.objects.filter((o) => o.plant && canWater(o, ctx.now));
  if (!targets.length) return fail('No growing plants need water right now');
  for (const o of targets) {
    applyWater(o);
    fx.push({ type: 'fx', name: 'sparkle', gx: o.gx, gy: o.gy });
  }
  s.stats.watered += targets.length;
  fx.push({ type: 'toast', text: `Watered ${targets.length} plant${targets.length > 1 ? 's' : ''}!` });
  return done([], { count: targets.length });
});

export const harvestPlant: Mutator<{ id: string }> = withFinalize((s, ctx, p, fx) => {
  const o = getObj(s, p.id);
  if (!o?.plant) return fail('Nothing to harvest');
  if (!isBlooming(o, ctx.now)) return fail('Not ready yet');
  const def = PLANT_BY_ID[o.type as PlantId];
  addTokens(s, def.yield, fx, o.gx, o.gy);
  if (def.treats) giveInv(s, TREAT_ID, def.treats);
  s.stats.harvested[o.type] = (s.stats.harvested[o.type] ?? 0) + 1;
  resetAfterHarvest(o, ctx.now);
  return done([], { yield: def.yield });
});

export const harvestAll: Mutator = withFinalize((s, ctx, _p, fx) => {
  const targets = s.objects.filter((o) => o.plant && isBlooming(o, ctx.now));
  if (!targets.length) return fail('No plants are ready to harvest yet');
  let totalTokens = 0;
  let totalTreats = 0;
  for (const o of targets) {
    const def = PLANT_BY_ID[o.type as PlantId];
    if (!def) continue;
    totalTokens += def.yield;
    totalTreats += def.treats ?? 0;
    s.stats.harvested[o.type] = (s.stats.harvested[o.type] ?? 0) + 1;
    resetAfterHarvest(o, ctx.now);
    fx.push({ type: 'fx', name: 'sparkle', gx: o.gx, gy: o.gy });
  }
  addTokens(s, totalTokens, fx);
  if (totalTreats > 0) giveInv(s, TREAT_ID, totalTreats);
  const treatSuffix = totalTreats > 0 ? ` and +${totalTreats} treat${totalTreats > 1 ? 's' : ''}` : '';
  fx.push({ type: 'toast', text: `Harvested ${targets.length} plant${targets.length > 1 ? 's' : ''} (+${totalTokens} Tokens${treatSuffix})!` });
  return done([], { count: targets.length, totalTokens, totalTreats });
});

// ------------------------------------------------------------- creatures & annoyance
export const PET_COOLDOWN = 4_000;
export const PET_REWARD_COOLDOWN = 3 * MS_MIN;
export const FEED_COOLDOWN = 3_000;
export const PET_WINDOW_MS = 18_000;
export const ANNOY_DURATION_MS = 28_000;

const PET_TOLERANCE: Record<CreatureId, number> = {
  puffin: 5, pebble: 5, mossi: 5, bloom: 5, wisp: 5,
  bloop: 4, ember: 4, flurry: 4, glimmer: 4, nimbus: 4, astra: 4,
  sprig: 3, luna: 3, cinder: 3, frosty: 3,
};

const giveAffection = (s: GameState, c: CreatureState, n: number, fx: Effect[]) => {
  const before = affectionLevel(c.affection);
  c.affection += n;
  const after = affectionLevel(c.affection);
  for (let l = before + 1; l <= after; l++) {
    addTokens(s, AFFECTION_REWARDS[l], fx);
    fx.push({ type: 'level-up', creature: c.id, level: l });
  }
};

const clearAnnoyance = (c: CreatureState, until: number, fx: Effect[], toEmotion: EmotionType = 'happy') => {
  c.annoyedUntil = 0;
  c.petWindowTimestamps = [];
  setCreatureEmotion(c, toEmotion, until);
  fx.push({ type: 'emotion', creature: c.id, emotion: toEmotion, emote: 'heart' });
};

const performPet = (s: GameState, c: CreatureState, ctx: Ctx, fx: Effect[]): ActionResult => {
  s.tutorial.tappedCreature = true;
  const now = ctx.now;
  const win = (c.petWindowTimestamps ?? []).filter((t) => now - t <= PET_WINDOW_MS && t <= now);
  win.push(now);
  c.petWindowTimestamps = win.slice(-12);

  const tolerance = PET_TOLERANCE[c.id] ?? 4;
  const isAlreadyAnnoyed = (c.annoyedUntil ?? 0) > now;
  const overPetted = win.length > tolerance;

  if (isAlreadyAnnoyed || overPetted) {
    const angry = win.length >= tolerance + 2;
    const emo: EmotionType = angry ? 'angry' : 'annoyed';
    c.annoyedUntil = now + ANNOY_DURATION_MS;
    setCreatureEmotion(c, emo, c.annoyedUntil);
    fx.push({ type: 'emotion', creature: c.id, emotion: emo, emote: 'angry' });
    fx.push({
      type: 'toast',
      text: angry
        ? `${c.name} huffs indignantly and steps back! Try Cheer Up or a treat.`
        : `${c.name} needs a little breathing room right now.`,
    });
    return done([], { cooldown: false, annoyed: true, angry, emotion: emo });
  }

  if (now - c.lastPetAt < PET_COOLDOWN && c.lastPetAt <= now) {
    return done([], { cooldown: true, petsInWindow: win.length, tolerance });
  }

  c.lastPetAt = now;
  c.petCount++;
  s.stats.pets++;
  s.stats.pipkinInteractions = (s.stats.pipkinInteractions ?? 0) + 1;
  setCreatureEmotion(c, 'happy', now + 18_000);
  fx.push({ type: 'emotion', creature: c.id, emotion: 'happy', emote: 'heart' });
  giveAffection(s, c, 1, fx);
  if (now - c.lastPetRewardAt >= PET_REWARD_COOLDOWN || c.lastPetRewardAt > now) {
    c.lastPetRewardAt = now;
    addTokens(s, 1, fx);
  }
  return done([], { cooldown: false, annoyed: false, emotion: 'happy' });
};

const performFeed = (s: GameState, c: CreatureState, ctx: Ctx, fx: Effect[]): ActionResult => {
  if (inv(s, TREAT_ID) < 1) return fail('You need a Pipkin Treat — buy one in the shop');
  if (ctx.now - c.lastFedAt < FEED_COOLDOWN && c.lastFedAt <= ctx.now) return fail('Still munching…');
  takeInv(s, TREAT_ID);
  c.lastFedAt = ctx.now;
  c.fedCount++;
  s.stats.feeds++;
  s.stats.pipkinInteractions = (s.stats.pipkinInteractions ?? 0) + 1;
  const wasAnnoyed = (c.annoyedUntil ?? 0) > ctx.now;
  clearAnnoyance(c, ctx.now + 24_000, fx, 'excited');
  giveAffection(s, c, 6, fx);
  if (wasAnnoyed) fx.push({ type: 'toast', text: `${c.name} forgave you immediately for that delicious treat!` });
  return done([], { soothed: wasAnnoyed, emotion: 'excited' });
};

export const petCreature: Mutator<{ id: CreatureId }> = withFinalize((s, ctx, p, fx) => {
  const c = s.creatures.find((x) => x.id === p.id);
  if (!c) return fail('Creature not found');
  return performPet(s, c, ctx, fx);
});

export const feedCreature: Mutator<{ id: CreatureId }> = withFinalize((s, ctx, p, fx) => {
  const c = s.creatures.find((x) => x.id === p.id);
  if (!c) return fail('Creature not found');
  return performFeed(s, c, ctx, fx);
});

const INTERACTION_COOLDOWNS: Partial<Record<CreatureInteractionKind, number>> = {
  play: 15_000,
  wave: 10_000,
  call: 6_000,
  observe: 2_000,
  gift: 45_000,
  cheer: 10_000,
  follow: 6_000,
  rest: 10_000,
};

export const interactCreature: Mutator<{ id: CreatureId; kind: CreatureInteractionKind }> = withFinalize((s, ctx, p, fx) => {
  const c = s.creatures.find((x) => x.id === p.id);
  if (!c) return fail('Creature not found');
  if (p.kind === 'pet') return performPet(s, c, ctx, fx);
  if (p.kind === 'feed') return performFeed(s, c, ctx, fx);

  const now = ctx.now;
  c.interactionCooldowns ??= {};
  const lastAt = c.interactionCooldowns[p.kind] ?? 0;
  const cd = INTERACTION_COOLDOWNS[p.kind] ?? 5_000;
  const readyReward = now - lastAt >= cd || lastAt > now;
  const def = CREATURE_BY_ID[c.id];
  s.tutorial.tappedCreature = true;
  s.stats.pipkinInteractions = (s.stats.pipkinInteractions ?? 0) + 1;

  if (readyReward) c.interactionCooldowns[p.kind] = now;
  const annoyed = (c.annoyedUntil ?? 0) > now;

  switch (p.kind) {
    case 'play': {
      if (annoyed) {
        fx.push({ type: 'emotion', creature: c.id, emotion: effectiveEmotion(c, now), emote: 'angry' });
        fx.push({ type: 'toast', text: `${c.name} turns away grumpy. Cheer them up first!` });
        return done([], { action: 'play', blockedByAnnoyance: true });
      }
      setCreatureEmotion(c, 'excited', now + 20_000);
      fx.push({ type: 'emotion', creature: c.id, emotion: 'excited', emote: 'music' });
      if (readyReward) giveAffection(s, c, 2, fx);
      fx.push({ type: 'toast', text: `${c.name} does a joyful little spin!` });
      return done([], { action: 'play', emotion: 'excited' });
    }
    case 'wave': {
      const emo: EmotionType = annoyed ? 'shy' : 'happy';
      setCreatureEmotion(c, emo, now + 15_000);
      fx.push({ type: 'emotion', creature: c.id, emotion: emo, emote: annoyed ? 'sweat' : 'note' });
      if (readyReward && !annoyed) giveAffection(s, c, 1, fx);
      fx.push({ type: 'toast', text: annoyed ? `${c.name} peaks back shyly.` : `${c.name} waves happily back!` });
      return done([], { action: 'wave', emotion: emo });
    }
    case 'call': {
      setCreatureEmotion(c, annoyed ? 'shy' : 'curious', now + 16_000);
      fx.push({ type: 'emotion', creature: c.id, emotion: annoyed ? 'shy' : 'curious', emote: 'question' });
      fx.push({ type: 'toast', text: `You call ${c.name} over!` });
      return done([], { action: 'call', emotion: annoyed ? 'shy' : 'curious' });
    }
    case 'observe': {
      const emo = effectiveEmotion(c, now);
      if (emo === 'happy') setCreatureEmotion(c, 'curious', now + 10_000);
      fx.push({ type: 'emotion', creature: c.id, emotion: emo, emote: 'question' });
      fx.push({ type: 'toast', text: `${c.name} (${def.species}): currently ${emo}. ${def.likes}.` });
      return done([], { action: 'observe', emotion: emo });
    }
    case 'gift': {
      if (!readyReward) {
        return fail('Give them a moment to enjoy your last keepsake');
      }
      clearAnnoyance(c, now + 26_000, fx, 'excited');
      giveAffection(s, c, 4, fx);
      fx.push({ type: 'toast', text: `${c.name} treasured your tiny keepsake! (+4 Affection)` });
      return done([], { action: 'gift', emotion: 'excited' });
    }
    case 'cheer': {
      if (annoyed) {
        clearAnnoyance(c, now + 22_000, fx, 'happy');
        giveAffection(s, c, 2, fx);
        fx.push({ type: 'toast', text: `${c.name} relaxes and smiles again!` });
      } else {
        setCreatureEmotion(c, 'excited', now + 18_000);
        fx.push({ type: 'emotion', creature: c.id, emotion: 'excited', emote: 'heart' });
        if (readyReward) giveAffection(s, c, 1, fx);
        fx.push({ type: 'toast', text: `You cheered on ${c.name}!` });
      }
      return done([], { action: 'cheer', emotion: c.emotion });
    }
    case 'follow': {
      setCreatureEmotion(c, 'curious', now + 22_000);
      fx.push({ type: 'emotion', creature: c.id, emotion: 'curious', emote: 'star' });
      fx.push({ type: 'toast', text: `${c.name} trots along beside your view!` });
      return done([], { action: 'follow', emotion: 'curious' });
    }
    case 'rest': {
      c.annoyedUntil = 0;
      c.petWindowTimestamps = [];
      setCreatureEmotion(c, 'sleepy', now + 25_000);
      fx.push({ type: 'emotion', creature: c.id, emotion: 'sleepy', emote: 'zzz' });
      if (readyReward) giveAffection(s, c, 1, fx);
      fx.push({ type: 'toast', text: `${c.name} curls up for a cozy rest.` });
      return done([], { action: 'rest', emotion: 'sleepy' });
    }
  }
});

export const renameCreature: Mutator<{ id: CreatureId; name: string }> = (s, _ctx, p) => {
  const c = s.creatures.find((x) => x.id === p.id);
  if (!c) return fail('Creature not found');
  const name = sanitizeName(p.name);
  if (!name) return fail('Please enter a name');
  c.name = name;
  return done([]);
};

export const expansionStatus = (s: GameState) => {
  const next = STAGES[s.stage]; // index s.stage = stage s.stage+1
  if (!next || s.stage >= MAX_PLAYABLE_STAGE || !next.playable) return null;
  const decor = placedDecorCount(s);
  const harvests = totalHarvests(s);
  return {
    next,
    decor, needDecor: next.needDecor, harvests, needHarvests: next.needHarvests,
    cost: next.cost, canAfford: s.tokens >= next.cost,
    ready: decor >= next.needDecor && harvests >= next.needHarvests && s.tokens >= next.cost,
  };
};

const STAGE_DISCOVERIES: Record<number, string[]> = {
  2: ['item:pine', 'item:birch'],
  3: ['item:crystal_cluster', 'item:willow'],
  4: ['item:cherry', 'item:glow_shrooms'],
  5: ['item:cloud_tree', 'item:celestial_lamp'],
  6: ['item:snow_pine', 'item:ice_crystal'],
  7: ['item:autumn_maple', 'item:mist_fern'],
  8: ['item:basalt_spire', 'item:hot_tub'],
  9: ['item:star_willow', 'item:planetarium'],
  10: ['item:everdream_tree', 'item:dream_pavilion'],
};

export const expandIsland: Mutator = withFinalize((s, ctx, _p, fx) => {
  const st = expansionStatus(s);
  if (!st) return fail('No further expansion available yet');
  if (!st.ready) {
    if (!st.canAfford) return fail('Not enough Nature Tokens');
    return fail('Complete the goals first');
  }
  s.tokens -= st.cost;
  s.stats.tokensSpent += st.cost;
  s.stage = st.next.id;
  const newObjs = stageExpansionObjects(s.stage, ctx.now, s.nextId);
  s.objects.push(...newObjs);
  s.nextId += newObjs.length + 2;
  fx.push({ type: 'expanded', stage: s.stage });
  discover(s, `stage:${s.stage}`, ctx.now, fx);
  for (const key of STAGE_DISCOVERIES[s.stage] ?? []) {
    discover(s, key, ctx.now, fx);
  }
  return done([]);
});

export const setSettings: Mutator<Partial<Settings>> = (s, _ctx, p) => {
  const n = { ...s.settings, ...p };
  n.volume = Math.min(1, Math.max(0, Number(n.volume) || 0));
  if (!['real', 'fast', 'day', 'night', 'custom'].includes(n.cycle)) n.cycle = 'real';
  n.manualHour = typeof n.manualHour === 'number' && Number.isFinite(n.manualHour)
    ? Math.min(23.99, Math.max(0, n.manualHour))
    : null;
  if (n.cycle === 'custom' && n.manualHour === null) n.manualHour = 12;
  if (typeof n.weatherEnabled !== 'boolean') n.weatherEnabled = true;
  if (!['low', 'normal', 'high'].includes(n.particleDensity)) n.particleDensity = 'normal';
  if (n.biomeOverride !== null && !VALID_BIOMES.has(n.biomeOverride)) n.biomeOverride = null;
  s.settings = n;
  return done([]);
};

export const setTutorial: Mutator<Partial<GameState['tutorial']>> = (s, _ctx, p) => {
  s.tutorial = { ...s.tutorial, ...p };
  return done([]);
};

export const tickEvent: Mutator<{ night: boolean; force?: string }> = withFinalize((s, ctx, p, fx) => {
  if (!p.force) rollWeather(s, ctx, fx);
  const res = rollEvent(s, ctx, fx, { offline: false, night: p.night, force: p.force });
  return done([], { event: res?.id ?? null });
});

export const ACTIONS = {
  wake, touch, collectPickup, interact, tapPond, buy, sellItem, sellPlacedObject,
  placeItem, moveObject, rotateObject, removeObject, clearObstacle,
  plantSeed, waterPlant, waterAll, harvestPlant, harvestAll,
  petCreature, feedCreature, interactCreature, renameCreature,
  expandIsland, setSettings, setTutorial, tickEvent,
};
export type ActionName = keyof typeof ACTIONS;
export { EVENT_BY_ID, AFFECTION_LEVELS, addTokens, discover, newId };
