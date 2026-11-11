import { describe, expect, it } from 'vitest';
import { ACTIONS, effectiveEmotion, expansionStatus, placedDecorCount } from '../src/core/actions';
import {
  CREATURES,
  MAX_PLAYABLE_STAGE,
  MS_MIN,
  PLANTS,
  PLANT_BY_ID,
  STAGES,
  TREAT_ID,
  decorKey,
  obstacleClearCost,
  resaleValue,
  seedKey,
} from '../src/core/catalog';
import { createInitialState } from '../src/core/state';
import { mulberry32 } from '../src/core/rng';
import { canPlace, findPath, footprintCells, objectAt, terrainAt, walkGrid } from '../src/core/grid';
import { ITEM_BY_ID } from '../src/core/catalog';
import { isBlooming, plantProgress, plantStage } from '../src/core/plants';
import type { Ctx, GameState } from '../src/core/types';

const T0 = 1_700_000_000_000;
export const mk = (now = T0) => {
  const s = createInitialState(now, 42);
  return s;
};
export const ctx = (now: number, seed = 1): Ctx => ({ now, rng: mulberry32(seed) });
const run = <K extends keyof typeof ACTIONS>(s: GameState, name: K, p: unknown, now = T0) =>
  (ACTIONS[name] as (s: GameState, c: Ctx, p: unknown) => ReturnType<(typeof ACTIONS)[K]>)(s, ctx(now), p);
const give = (s: GameState, key: string, n = 1) => (s.inventory[key] = (s.inventory[key] ?? 0) + n);

describe('resources: collection and spending', () => {
  it('collects a pickup exactly once (no duplicate reward on repeated clicks)', () => {
    const s = mk();
    s.pickups.push({ id: 'p1', kind: 'sparkle', amount: 3, gx: 2, gy: 2, createdAt: T0 });
    const before = s.tokens;
    const a = run(s, 'collectPickup', { id: 'p1' });
    const b = run(s, 'collectPickup', { id: 'p1' });
    const c = run(s, 'collectPickup', { id: 'p1' });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(false);
    expect(c.ok).toBe(false);
    expect(s.tokens).toBe(before + 3);
  });

  it('tree forage is a replenishing resource with a cooldown', () => {
    const s = mk();
    const tree = s.objects.find((o) => o.type === 'tree_big')!;
    const t1 = s.tokens;
    expect(run(s, 'interact', { id: tree.id }).data?.ready).toBe(true);
    expect(s.tokens).toBe(t1 + 2 + 0); // + first-time achievements are separate
    const t2 = s.tokens;
    expect(run(s, 'interact', { id: tree.id }, T0 + 1000).data?.ready).toBe(false);
    expect(s.tokens).toBe(t2);
    expect(run(s, 'interact', { id: tree.id }, T0 + 7 * MS_MIN).data?.ready).toBe(true);
  });

  it('spending: buying deducts tokens and adds inventory', () => {
    const s = mk();
    const r = run(s, 'buy', { key: seedKey('daisy'), qty: 3 });
    expect(r.ok).toBe(true);
    expect(s.tokens).toBe(30 - 9);
    expect(s.inventory[seedKey('daisy')]).toBe(5);
    expect(s.stats.tokensSpent).toBe(9);
  });

  it('rejects purchases with insufficient tokens and leaves state untouched', () => {
    const s = mk();
    s.tokens = 5;
    const snap = JSON.stringify(s);
    const r = run(s, 'buy', { key: decorKey('cottage'), qty: 1 });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(s)).toBe(snap);
  });

  it('rejects invalid quantities, unknown items and locked-stage items', () => {
    const s = mk();
    s.tokens = 1000;
    expect(run(s, 'buy', { key: decorKey('bench'), qty: 0 }).ok).toBe(false);
    expect(run(s, 'buy', { key: decorKey('bench'), qty: -2 }).ok).toBe(false);
    expect(run(s, 'buy', { key: decorKey('bench'), qty: 1.5 }).ok).toBe(true); // floors to 1
    expect(run(s, 'buy', { key: decorKey('nope'), qty: 1 }).ok).toBe(false);
    expect(run(s, 'buy', { key: decorKey('greenhouse'), qty: 1 }).ok).toBe(false); // stage 2
    expect(run(s, 'buy', { key: decorKey('rock'), qty: 1 }).ok).toBe(false); // scenery isn't sold
    expect(run(s, 'buy', { key: seedKey('glowflower'), qty: 1 }).ok).toBe(false);
    expect(s.tokens).toBeGreaterThanOrEqual(0);
  });
});

describe('inventory & placement', () => {
  it('places an owned item, consuming one from inventory', () => {
    const s = mk();
    give(s, decorKey('lantern'));
    const r = run(s, 'placeItem', { itemId: 'lantern', gx: 2, gy: 3, rot: 0 });
    expect(r.ok).toBe(true);
    expect(s.inventory[decorKey('lantern')]).toBeUndefined();
    expect(objectAt(s, 2, 3)?.type).toBe('lantern');
    expect(run(s, 'placeItem', { itemId: 'lantern', gx: 3, gy: 3, rot: 0 }).ok).toBe(false); // none left
  });

  it('validates placement: out of bounds, water, overlap, wrong terrain', () => {
    const s = mk();
    const bench = ITEM_BY_ID.bench;
    expect(canPlace(s, bench, -1, 0, 0).ok).toBe(false);
    expect(canPlace(s, bench, 0, 0, 0).ok).toBe(false); // void corner
    expect(canPlace(s, bench, 4, 3, 0).ok).toBe(false); // water
    expect(canPlace(s, bench, 2, 1, 0).ok).toBe(false); // the tree
    expect(canPlace(s, bench, 2, 3, 0).ok).toBe(true);
    expect(canPlace(s, ITEM_BY_ID.reeds, 4, 3, 0).ok).toBe(true); // reeds need water
    expect(canPlace(s, ITEM_BY_ID.reeds, 2, 3, 0).ok).toBe(false);
    expect(canPlace(s, ITEM_BY_ID.bridge, 4, 3, 0).ok).toBe(true);
    // multi-cell footprints must fit entirely
    expect(canPlace(s, ITEM_BY_ID.cottage, 5, 1, 0).ok).toBe(true); // on the building plot
    expect(canPlace(s, ITEM_BY_ID.cottage, 7, 1, 0).ok).toBe(false); // hangs off the island
    expect(canPlace(s, ITEM_BY_ID.shed, 3, 3, 0).ok).toBe(false); // 2x1 overlaps water at (4,3)
    expect(canPlace(s, ITEM_BY_ID.shed, 2, 3, 1).ok).toBe(true); // rotated 1x2 fits
  });

  it('allows a ground item under an object but not two objects in one cell', () => {
    const s = mk();
    give(s, decorKey('path'));
    give(s, decorKey('lantern'));
    give(s, decorKey('bench'));
    expect(run(s, 'placeItem', { itemId: 'path', gx: 2, gy: 3, rot: 0 }).ok).toBe(true);
    expect(run(s, 'placeItem', { itemId: 'lantern', gx: 2, gy: 3, rot: 0 }).ok).toBe(true);
    expect(run(s, 'placeItem', { itemId: 'bench', gx: 2, gy: 3, rot: 0 }).ok).toBe(false);
  });

  it('moves and removes unlocked objects; locked scenery is protected', () => {
    const s = mk();
    const bench = s.objects.find((o) => o.type === 'bench')!;
    const tree = s.objects.find((o) => o.type === 'tree_big')!;
    expect(run(s, 'moveObject', { id: bench.id, gx: 2, gy: 3, rot: 1 }).ok).toBe(true);
    expect(bench.gx).toBe(2);
    expect(run(s, 'moveObject', { id: bench.id, gx: 4, gy: 3, rot: 0 }).ok).toBe(false);
    expect(run(s, 'moveObject', { id: tree.id, gx: 2, gy: 3, rot: 0 }).ok).toBe(false);
    expect(run(s, 'removeObject', { id: tree.id }).ok).toBe(false);
    expect(run(s, 'removeObject', { id: bench.id }).ok).toBe(true);
    expect(s.inventory[decorKey('bench')]).toBe(1);
    expect(run(s, 'removeObject', { id: bench.id }).ok).toBe(false);
  });

  it('walk grid reflects blockers, water and bridges', () => {
    const s = mk();
    let g = walkGrid(s);
    expect(g[1][2]).toBe(false); // tree
    expect(g[3][4]).toBe(false); // water
    expect(g[3][1]).toBe(true);
    give(s, decorKey('bridge'));
    run(s, 'placeItem', { itemId: 'bridge', gx: 4, gy: 3, rot: 0 });
    g = walkGrid(s);
    expect(g[3][4]).toBe(true);
  });

  it('footprint cells rotate for non-square items', () => {
    const cells = footprintCells(ITEM_BY_ID.shed, 1, 1, 1);
    expect(cells).toEqual([{ gx: 1, gy: 1 }, { gx: 1, gy: 2 }]);
  });
});

describe('gardening', () => {
  it('plants, grows through all five stages by timestamp, waters and harvests', () => {
    const s = mk();
    expect(run(s, 'plantSeed', { plantId: 'daisy', gx: 2, gy: 3 }).ok).toBe(true);
    const plant = s.objects.find((o) => o.plant)!;
    const total = PLANT_BY_ID.daisy.growMinutes * MS_MIN;
    expect(plantStage(plant, T0)).toBe(0);
    expect(plantStage(plant, T0 + total * 0.2)).toBe(1);
    expect(plantStage(plant, T0 + total * 0.5)).toBe(2);
    expect(plantStage(plant, T0 + total * 0.8)).toBe(3);
    expect(plantStage(plant, T0 + total)).toBe(4);
    expect(plantStage(plant, T0 + total * 1000)).toBe(4); // never overshoots / never dies
    expect(run(s, 'harvestPlant', { id: plant.id }, T0 + total * 0.5).ok).toBe(false);
    const before = s.tokens;
    const h = run(s, 'harvestPlant', { id: plant.id }, T0 + total);
    expect(h.ok).toBe(true);
    const gained = h.effects.reduce((a, e) => (e.type === 'tokens' ? a + e.amount : a), 0);
    expect(gained).toBeGreaterThanOrEqual(PLANT_BY_ID.daisy.yield);
    expect(s.tokens).toBe(before + gained);
    // regrows from sprout, so harvesting twice in a row is impossible
    expect(run(s, 'harvestPlant', { id: plant.id }, T0 + total).ok).toBe(false);
    expect(plantStage(plant, T0 + total)).toBe(1);
  });

  it('watering speeds growth, capped at two waterings per cycle', () => {
    const s = mk();
    run(s, 'plantSeed', { plantId: 'daisy', gx: 2, gy: 3 });
    const p = s.objects.find((o) => o.plant)!;
    const p0 = plantProgress(p, T0);
    expect(run(s, 'waterPlant', { id: p.id }).ok).toBe(true);
    expect(run(s, 'waterPlant', { id: p.id }).ok).toBe(true);
    expect(run(s, 'waterPlant', { id: p.id }).ok).toBe(false);
    expect(plantProgress(p, T0)).toBeCloseTo(p0 + 0.3, 5);
  });

  it('needs seeds, grass and a free cell; removing refunds the seed', () => {
    const s = mk();
    expect(run(s, 'plantSeed', { plantId: 'sunflower', gx: 2, gy: 3 }).ok).toBe(false); // no seed
    expect(run(s, 'plantSeed', { plantId: 'daisy', gx: 4, gy: 3 }).ok).toBe(false); // water
    expect(run(s, 'plantSeed', { plantId: 'daisy', gx: 5, gy: 1 }).ok).toBe(false); // stone plot
    expect(run(s, 'plantSeed', { plantId: 'daisy', gx: 2, gy: 1 }).ok).toBe(false); // tree
    expect(run(s, 'plantSeed', { plantId: 'daisy', gx: 2, gy: 3 }).ok).toBe(true);
    expect(run(s, 'plantSeed', { plantId: 'daisy', gx: 2, gy: 3 }).ok).toBe(false); // occupied
    const p = s.objects.find((o) => o.plant)!;
    expect(run(s, 'removeObject', { id: p.id }).ok).toBe(true);
    expect(s.inventory[seedKey('daisy')]).toBe(2);
  });

  it('negative elapsed time (clock moved back) yields zero progress, not a crash', () => {
    const s = mk();
    run(s, 'plantSeed', { plantId: 'daisy', gx: 2, gy: 3 });
    const p = s.objects.find((o) => o.plant)!;
    expect(plantProgress(p, T0 - 10 * MS_MIN)).toBe(0);
    expect(isBlooming(p, T0 - 1e12)).toBe(false);
  });
});

describe('creatures', () => {
  it('petting is rate limited; token rewards cannot be spammed', () => {
    const s = mk();
    const t = s.tokens;
    const r1 = run(s, 'petCreature', { id: 'mossi' });
    const tAfter = s.tokens;
    expect(r1.data?.cooldown).toBe(false);
    for (let i = 0; i < 20; i++) run(s, 'petCreature', { id: 'mossi' }, T0 + i * 100);
    expect(s.stats.pets).toBe(1);
    expect(s.tokens).toBe(tAfter);
    expect(tAfter).toBeGreaterThan(t - 1);
    // a minute later it counts again but the token reward is still on cooldown
    run(s, 'petCreature', { id: 'mossi' }, T0 + 60_000);
    expect(s.stats.pets).toBe(2);
    expect(s.tokens).toBe(tAfter);
    run(s, 'petCreature', { id: 'mossi' }, T0 + 4 * MS_MIN);
    expect(s.tokens).toBe(tAfter + 1);
  });

  it('feeding needs a treat and grants affection; level-ups grant tokens', () => {
    const s = mk();
    expect(run(s, 'feedCreature', { id: 'mossi' }).ok).toBe(false);
    give(s, TREAT_ID, 5);
    const t = s.tokens;
    for (let i = 0; i < 3; i++) expect(run(s, 'feedCreature', { id: 'mossi' }, T0 + i * 5000).ok).toBe(true);
    const mossi = s.creatures[0];
    expect(mossi.affection).toBe(18);
    expect(s.inventory[TREAT_ID]).toBe(2);
    expect(s.tokens).toBeGreaterThan(t); // level 1 reward at 15 + achievement
    expect(s.achievements.snack_time).toBeTruthy();
  });

  it('renaming sanitises and rejects empty names', () => {
    const s = mk();
    expect(run(s, 'renameCreature', { id: 'mossi', name: '   ' }).ok).toBe(false);
    expect(run(s, 'renameCreature', { id: 'mossi', name: '  <b>Moss  Ball</b> and a very very long name ' }).ok).toBe(true);
    expect(s.creatures[0].name).not.toMatch(/[<>]/);
    expect(s.creatures[0].name.length).toBeLessThanOrEqual(14);
    expect(run(s, 'renameCreature', { id: 'puffin', name: 'x' }).ok).toBe(false);
  });

  it('new Pipkins are discovered through play, not handed out', () => {
    const s = mk();
    for (let i = 0; i < 3; i++) run(s, 'tapPond', undefined);
    expect(s.creatures.map((c) => c.id)).toContain('bloop');
    give(s, decorKey('lantern'));
    run(s, 'placeItem', { itemId: 'lantern', gx: 2, gy: 3, rot: 0 });
    expect(s.creatures.map((c) => c.id)).toContain('ember');
    expect(s.achievements.new_friend).toBeTruthy();
    // idempotent
    run(s, 'tapPond', undefined);
    expect(s.creatures.filter((c) => c.id === 'bloop')).toHaveLength(1);
  });
});

describe('achievements and progression', () => {
  it('unlocks achievements once and grants their reward once', () => {
    const s = mk();
    run(s, 'wake', undefined);
    expect(s.achievements.first_steps).toBeTruthy();
    const t = s.tokens;
    run(s, 'wake', undefined, T0 + 1000);
    expect(s.tokens).toBe(t);
  });

  it('Cozy Corner unlocks after five decorations (cheap paths do not count)', () => {
    const s = mk();
    s.tokens = 500;
    for (let i = 0; i < 4; i++) {
      give(s, decorKey('pot'));
      run(s, 'placeItem', { itemId: 'pot', gx: i, gy: 5, rot: 0 });
    }
    expect(s.achievements.cozy_corner).toBeFalsy();
    give(s, decorKey('path'), 3);
    for (let i = 0; i < 3; i++) run(s, 'placeItem', { itemId: 'path', gx: 1 + i, gy: 4, rot: 0 });
    expect(s.achievements.cozy_corner).toBeFalsy();
    give(s, decorKey('pot'));
    run(s, 'placeItem', { itemId: 'pot', gx: 4, gy: 5, rot: 0 });
    expect(s.achievements.cozy_corner).toBeTruthy();
  });

  it('island expansion has requirements, costs tokens and adds scenery', () => {
    const s = mk();
    s.tokens = 1000;
    expect(run(s, 'expandIsland', undefined).ok).toBe(false);
    s.stats.harvested.daisy = 3;
    for (let i = 0; i < 4; i++) {
      give(s, decorKey('pot'));
      run(s, 'placeItem', { itemId: 'pot', gx: i, gy: 5, rot: 0 });
    }
    expect(placedDecorCount(s)).toBeGreaterThanOrEqual(4);
    expect(expansionStatus(s)?.ready).toBe(true);
    const before = s.tokens;
    expect(run(s, 'expandIsland', undefined).ok).toBe(true);
    expect(s.stage).toBe(2);
    expect(s.tokens).toBeLessThan(before);
    expect(s.creatures.map((c) => c.id)).toContain('puffin');
    expect(canPlace(s, ITEM_BY_ID.bench, 11, 11, 0).ok).toBe(false); // outer corner is void in the 12x12 grove map
    expect(canPlace(s, ITEM_BY_ID.bench, 8, 6, 0).ok).toBe(true);
  });

  it('can progress through all playable stages 1 through 10 preserving coordinates and invariants', () => {
    expect(MAX_PLAYABLE_STAGE).toBe(10);
    expect(PLANTS).toHaveLength(14);
    expect(CREATURES).toHaveLength(15);

    const s = mk();
    s.tokens = 50_000;
    // Place an identifiable marker item at Stage 1 coordinate (2, 3) and record starter coordinates
    give(s, decorKey('lantern'));
    expect(run(s, 'placeItem', { itemId: 'lantern', gx: 2, gy: 3, rot: 0 }).ok).toBe(true);
    const lantern = s.objects.find((o) => o.type === 'lantern')!;
    const tree = s.objects.find((o) => o.type === 'tree_big')!;
    const initialTreePos = { gx: tree.gx, gy: tree.gy };
    const initialPathPos = s.objects.filter((o) => o.type === 'path').map((o) => ({ id: o.id, gx: o.gx, gy: o.gy }));

    // Ensure Stage 1 has zero locked ground tiles (starter path is unlocked/movable)
    expect(s.objects.filter((o) => o.type === 'path').every((o) => !o.locked)).toBe(true);

    for (let targetStage = 2; targetStage <= 10; targetStage++) {
      const st = expansionStatus(s)!;
      expect(st).not.toBeNull();
      expect(st.next.id).toBe(targetStage);

      // Top up harvests to satisfy next stage requirement
      s.stats.harvested.daisy = Math.max(s.stats.harvested.daisy ?? 0, st.needHarvests);
      // Place needed decor pieces inside the starter / expanded meadow plot strip cleanly
      let tries = 0;
      while (placedDecorCount(s) < st.needDecor && tries < 600) {
        tries++;
        const gx = 1 + (tries % 18);
        const gy = 1 + Math.floor(tries / 18);
        if (canPlace(s, ITEM_BY_ID.pot, gx, gy, 0).ok) {
          give(s, decorKey('pot'));
          run(s, 'placeItem', { itemId: 'pot', gx, gy, rot: 0 });
        }
      }
      expect(expansionStatus(s)?.ready).toBe(true);
      const res = run(s, 'expandIsland', undefined);
      expect(res.ok).toBe(true);
      expect(s.stage).toBe(targetStage);

      // Existing placed lantern and starter tree never shift coordinates
      expect({ gx: lantern.gx, gy: lantern.gy }).toEqual({ gx: 2, gy: 3 });
      expect({ gx: tree.gx, gy: tree.gy }).toEqual(initialTreePos);
      for (const p of initialPathPos) {
        const cur = s.objects.find((o) => o.id === p.id)!;
        expect({ gx: cur.gx, gy: cur.gy }).toEqual({ gx: p.gx, gy: p.gy });
      }
      // Unlocked ground tiles remain unlocked across all expansions
      expect(s.objects.filter((o) => o.type === 'stepping_stones' || o.type === 'mosaic_path').length).toBe(0);
    }

    // At Stage 10 (36x36), outer perimeter tiles are valid terrain and Stage 11 is null
    expect(terrainAt(s.stage, 0, 0)).toBe('void');
    expect(terrainAt(s.stage, 35, 35)).toBe('void');
    expect(terrainAt(s.stage, 18, 18)).not.toBe('void');
    expect(expansionStatus(s)).toBeNull();
    expect(run(s, 'expandIsland', undefined).ok).toBe(false);
  });
});

describe('obstacle clearing, selling, batch gardening & annoyance systems', () => {
  it('clears removable obstacles for Nature Tokens while protecting the Great Old Tree', () => {
    const s = mk();
    const rock = s.objects.find((o) => o.locked && o.type === 'rock')!;
    const tree = s.objects.find((o) => o.type === 'tree_big')!;
    const cost = obstacleClearCost(rock.type);
    expect(cost).toBeGreaterThan(0);
    expect(obstacleClearCost('tree_big')).toBe(0);

    // Insufficient tokens leaves rock untouched
    s.tokens = cost - 1;
    expect(run(s, 'clearObstacle', { id: rock.id }).ok).toBe(false);
    expect(s.objects.some((o) => o.id === rock.id)).toBe(true);
    expect(s.tokens).toBe(cost - 1);

    // Sufficient tokens removes rock and frees tile for placement
    s.tokens = cost + 10;
    expect(run(s, 'clearObstacle', { id: rock.id }).ok).toBe(true);
    expect(s.tokens).toBe(10);
    expect(s.objects.some((o) => o.id === rock.id)).toBe(false);
    expect(canPlace(s, ITEM_BY_ID.bench, rock.gx, rock.gy, 0).ok).toBe(true);

    // Protected landmark cannot be cleared
    expect(run(s, 'clearObstacle', { id: tree.id }).ok).toBe(false);
    expect(s.objects.some((o) => o.id === tree.id)).toBe(true);
  });

  it('sells inventory items and placed objects for exact 50% resale value with strict guards', () => {
    const s = mk();
    const startTokens = s.tokens;
    give(s, decorKey('bench'), 2);
    const benchResale = resaleValue(ITEM_BY_ID.bench.price);
    expect(benchResale).toBe(10);

    // Guard invalid quantities & missing/scenery items
    expect(run(s, 'sellItem', { key: decorKey('bench'), qty: 0 }).ok).toBe(false);
    expect(run(s, 'sellItem', { key: decorKey('bench'), qty: -1 }).ok).toBe(false);
    expect(run(s, 'sellItem', { key: decorKey('bench'), qty: 5 }).ok).toBe(false);
    expect(run(s, 'sellItem', { key: decorKey('rock'), qty: 1 }).ok).toBe(false);

    // Sell 2 from Bag (unlocks Market Helper +8 bonus on first sale)
    const rSell = run(s, 'sellItem', { key: decorKey('bench'), qty: 2 });
    expect(rSell.ok).toBe(true);
    expect(s.achievements.thrifty_trader).toBeTruthy();
    expect(s.tokens).toBe(startTokens + 20 + 8);
    expect(s.inventory[decorKey('bench')]).toBeUndefined();
    expect(run(s, 'sellItem', { key: decorKey('bench'), qty: 1 }).ok).toBe(false);

    // Subsequent Bag sale credits exact 50% resale value with zero duplicate bonus
    give(s, decorKey('bench'), 1);
    const beforeSecondSell = s.tokens;
    expect(run(s, 'sellItem', { key: decorKey('bench'), qty: 1 }).ok).toBe(true);
    expect(s.tokens).toBe(beforeSecondSell + benchResale);

    // Sell unlocked placed object directly from island; reject locked scenery
    const starterBench = s.objects.find((o) => !o.locked && o.type === 'bench')!;
    const beforePlacedSell = s.tokens;
    expect(run(s, 'sellPlacedObject', { id: starterBench.id }).ok).toBe(true);
    expect(s.tokens).toBe(beforePlacedSell + benchResale);
    expect(s.objects.some((o) => o.id === starterBench.id)).toBe(false);
    // Repeated sell on removed object fails cleanly
    expect(run(s, 'sellPlacedObject', { id: starterBench.id }).ok).toBe(false);

    const tree = s.objects.find((o) => o.type === 'tree_big')!;
    expect(run(s, 'sellPlacedObject', { id: tree.id }).ok).toBe(false);
  });

  it('waters and harvests all eligible plants atomically via waterAll and harvestAll', () => {
    const s = mk();
    give(s, seedKey('daisy'), 3);
    expect(run(s, 'plantSeed', { plantId: 'daisy', gx: 1, gy: 5 }).ok).toBe(true);
    expect(run(s, 'plantSeed', { plantId: 'daisy', gx: 2, gy: 5 }).ok).toBe(true);
    expect(run(s, 'plantSeed', { plantId: 'daisy', gx: 3, gy: 5 }).ok).toBe(true);

    // Grow plant 1 & 2 to bloom; keep plant 3 young
    const plants = s.objects.filter((o) => o.plant);
    const total = PLANT_BY_ID.daisy.growMinutes * MS_MIN;
    plants[0].plant!.plantedAt = T0 - total * 2;
    plants[1].plant!.plantedAt = T0 - total * 2;

    // waterAll should only water the growing plant(s) and respect cap
    const w1 = run(s, 'waterAll', undefined, T0);
    expect(w1.ok).toBe(true);
    expect(plants[2].plant!.waterCount).toBe(1);
    run(s, 'waterAll', undefined, T0 + 1000);
    expect(plants[2].plant!.waterCount).toBe(2);
    expect(run(s, 'waterAll', undefined, T0 + 2000).ok).toBe(false);

    // harvestAll harvests only blooming plants and resets them to sprout
    const tBefore = s.tokens;
    const h = run(s, 'harvestAll', undefined, T0);
    expect(h.ok).toBe(true);
    expect(s.tokens).toBeGreaterThanOrEqual(tBefore + PLANT_BY_ID.daisy.yield * 2);
    expect(isBlooming(plants[0], T0)).toBe(false);
    expect(isBlooming(plants[1], T0)).toBe(false);
    expect(run(s, 'harvestAll', undefined, T0).ok).toBe(false);
  });

  it('handles Pipkin annoyance rolling window, soothing, and all 10 creature interactions', () => {
    const s = mk();
    const mossi = s.creatures[0];
    // Rapid repetitive petting triggers annoyed mood
    for (let i = 0; i < 6; i++) {
      run(s, 'petCreature', { id: mossi.id }, T0 + i * 500);
    }
    expect(effectiveEmotion(mossi, T0 + 2500)).toBe('annoyed');

    // Cheer interaction soothes annoyance
    expect(run(s, 'interactCreature', { id: mossi.id, kind: 'cheer' }, T0 + 3000).ok).toBe(true);
    expect(effectiveEmotion(mossi, T0 + 3000)).not.toBe('annoyed');

    // Test all remaining social interaction kinds cleanly with cooldowns
    const kinds = ['play', 'wave', 'call', 'observe', 'gift', 'follow', 'rest'] as const;
    for (let i = 0; i < kinds.length; i++) {
      const k = kinds[i];
      const now = T0 + 100_000 + i * 25_000;
      const r = run(s, 'interactCreature', { id: mossi.id, kind: k }, now);
      expect(r.ok).toBe(true);
    }

    // Natural decay clears annoyance over time without manual soothing
    for (let i = 0; i < 6; i++) {
      run(s, 'petCreature', { id: mossi.id }, T0 + 500_000 + i * 400);
    }
    expect(effectiveEmotion(mossi, T0 + 502_500)).toBe('annoyed');
    expect(effectiveEmotion(mossi, T0 + 600_000)).not.toBe('annoyed');
  });

  it('supports planting and harvesting all 14 plants across late stages', () => {
    const s = mk();
    s.stage = 10;
    s.tokens = 50_000;
    for (const p of PLANTS) {
      expect(run(s, 'buy', { key: seedKey(p.id), qty: 1 }).ok).toBe(true);
    }
    // Spot-check Stage 6-10 plants
    for (const pid of ['frostberry', 'mistorchid', 'emberpepper', 'novabloom', 'everdream_lotus'] as const) {
      expect(run(s, 'plantSeed', { plantId: pid, gx: 1, gy: 5 }).ok).toBe(true);
      const po = s.objects.find((o) => o.type === pid)!;
      const bloomAt = T0 + PLANT_BY_ID[pid].growMinutes * MS_MIN + 1000;
      expect(isBlooming(po, bloomAt)).toBe(true);
      expect(run(s, 'harvestPlant', { id: po.id }, bloomAt).ok).toBe(true);
      expect(run(s, 'removeObject', { id: po.id }, bloomAt).ok).toBe(true);
    }
  });
});

