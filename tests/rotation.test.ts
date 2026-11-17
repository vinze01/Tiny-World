import { describe, it, expect } from 'vitest';
import { ITEMS, ITEM_BY_ID, SHOP_ITEMS } from '../src/core/catalog';
import { footprintDims, footprintCells, canPlace } from '../src/core/grid';
import { createInitialState } from '../src/core/state';
import { placeItem, moveObject, rotateObject } from '../src/core/actions';
import { itemTexKey, spriteMeta } from '../src/art/atlas';
import type { Ctx } from '../src/core/types';

describe('Shop item rotation validation', () => {
  const ctx: Ctx = { now: 1000, rng: () => 0.5 };

  it('shed has correct footprint in both rotations', () => {
    const def = ITEM_BY_ID['shed'];
    expect(def).toBeDefined();
    expect(def.rotatable).toBe(true);

    const dims0 = footprintDims(def, 0);
    expect(dims0).toEqual({ w: 2, d: 1 });
    const cells0 = footprintCells(def, 3, 3, 0);
    expect(cells0).toEqual([
      { gx: 3, gy: 3 },
      { gx: 4, gy: 3 },
    ]);

    const dims1 = footprintDims(def, 1);
    expect(dims1).toEqual({ w: 1, d: 2 });
    const cells1 = footprintCells(def, 3, 3, 1);
    expect(cells1).toEqual([
      { gx: 3, gy: 3 },
      { gx: 3, gy: 4 },
    ]);
  });

  it('shelter has correct footprint in both rotations', () => {
    const def = ITEM_BY_ID['shelter'];
    expect(def).toBeDefined();
    expect(def.rotatable).toBe(true);

    const dims0 = footprintDims(def, 0);
    expect(dims0).toEqual({ w: 2, d: 1 });
    const dims1 = footprintDims(def, 1);
    expect(dims1).toEqual({ w: 1, d: 2 });
  });

  it('can place and rotate shed and shelter in game state', () => {
    const s = createInitialState(1000);
    s.tokens = 9999;
    s.inventory['decor:shed'] = 1;
    s.inventory['decor:shelter'] = 1;

    // Place shed at (5, 1) rot 0 on plot
    const r0 = placeItem(s, ctx, { itemId: 'shed', gx: 5, gy: 1, rot: 0 });
    expect(r0.ok).toBe(true);
    const shedObj = s.objects.find((o) => o.type === 'shed');
    expect(shedObj).toBeDefined();
    expect(shedObj!.rot).toBe(0);

    // Rotate shed to rot 1
    const r1 = moveObject(s, ctx, { id: shedObj!.id, gx: 5, gy: 1, rot: 1 });
    expect(r1.ok).toBe(true);
    expect(shedObj!.rot).toBe(1);

    // Rotate shed back to rot 0
    const r2 = moveObject(s, ctx, { id: shedObj!.id, gx: 5, gy: 1, rot: 0 });
    expect(r2.ok).toBe(true);
    expect(shedObj!.rot).toBe(0);
  });

  it('all dedicated rotatable items have rot:0 and rot:1 textures registered', () => {
    const dedicated = [
      'bench', 'fence', 'sign', 'birdhouse', 'bridge',
      'stone_bench', 'picnic_table', 'gazebo',
      'cottage', 'shed', 'greenhouse', 'shelter', 'workshop',
      'windmill', 'observatory', 'sanctuary_bell',
      'snow_bench', 'snowy_fence', 'santas_sleigh', 'christmas_stall',
      'beach_chair', 'beach_towel', 'picnic_umbrella',
    ];

    for (const id of dedicated) {
      const tex0 = itemTexKey(id, 0);
      const tex1 = itemTexKey(id, 1);

      expect(tex0.key).toBe(`item:${id}:0`);
      expect(tex0.flip).toBe(false);

      expect(tex1.key).toBe(`item:${id}:1`);
      expect(tex1.flip).toBe(false);

      const m0 = spriteMeta(tex0.key);
      const m1 = spriteMeta(tex1.key);

      expect(m0.w).toBeGreaterThan(0);
      expect(m0.h).toBeGreaterThan(0);
      expect(m0.ax).toBeGreaterThan(0);

      expect(m1.w).toBeGreaterThan(0);
      expect(m1.h).toBeGreaterThan(0);
      expect(m1.ax).toBeGreaterThan(0);
    }
  });

  it('all shop items have valid rotation behavior', () => {
    for (const item of SHOP_ITEMS) {
      const dims0 = footprintDims(item, 0);
      const dims1 = footprintDims(item, 1);

      if (item.rotatable) {
        if (item.w !== item.d) {
          expect(dims1.w).toBe(item.d);
          expect(dims1.d).toBe(item.w);
        } else {
          expect(dims1.w).toBe(item.w);
          expect(dims1.d).toBe(item.d);
        }

        const t0 = itemTexKey(item.id, 0);
        const t1 = itemTexKey(item.id, 1);
        expect(t0.key).toBeTruthy();
        expect(t1.key).toBeTruthy();
        const m0 = spriteMeta(t0.key);
        const m1 = spriteMeta(t1.key);
        expect(m0.w).toBeGreaterThan(0);
        expect(m1.w).toBeGreaterThan(0);
      } else {
        // Non-rotatable items should keep default dims
        expect(dims0).toEqual({ w: item.w, d: item.d });
        const t0 = itemTexKey(item.id, 0);
        expect(t0.key).toBe(`item:${item.id}`);
        expect(t0.flip).toBe(false);
        expect(spriteMeta(t0.key).w).toBeGreaterThan(0);
      }
    }
  });

  it('rotates placed objects and paths in-place via rotateObject action', () => {
    const s = createInitialState(1000);
    s.stage = 10;
    s.inventory['decor:wood_deck'] = 1;
    s.inventory['decor:bench'] = 1;
    s.inventory['decor:rock'] = 1;

    expect(placeItem(s, ctx, { itemId: 'wood_deck', gx: 2, gy: 3, rot: 0 }).ok).toBe(true);
    const deck = s.objects.find((o) => o.type === 'wood_deck')!;
    expect(rotateObject(s, ctx, { id: deck.id }).ok).toBe(true);
    expect(deck.rot).toBe(1);
    expect(rotateObject(s, ctx, { id: deck.id }).ok).toBe(true);
    expect(deck.rot).toBe(0);

    expect(placeItem(s, ctx, { itemId: 'bench', gx: 3, gy: 3, rot: 0 }).ok).toBe(true);
    const bench = s.objects.find((o) => o.gx === 3 && o.gy === 3 && o.type === 'bench')!;
    expect(rotateObject(s, ctx, { id: bench.id }).ok).toBe(true);
    expect(bench.rot).toBe(1);
  });
});
