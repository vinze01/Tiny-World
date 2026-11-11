import { describe, expect, it } from 'vitest';
import { ACTIONS } from '../src/core/actions';
import { MAX_PICKUPS, MS_MIN, OFFLINE_CAP_MS, PLANT_BY_ID, decorKey, seedKey } from '../src/core/catalog';
import { chooseState, createActor, directActor, react, tickActor, type WorldView } from '../src/core/creatureAI';
import { hourFor, isRealNight, phaseOf, skyAt } from '../src/core/daycycle';
import { activeBiome, activeWeather, applyOffline, nextEventEtaMs, rollEvent, rollWeather } from '../src/core/events';
import { findPath, walkGrid } from '../src/core/grid';
import { isBlooming, plantProgress } from '../src/core/plants';
import { mulberry32 } from '../src/core/rng';
import { createInitialState } from '../src/core/state';
import type { Ctx, Effect } from '../src/core/types';

const T0 = 1_700_000_000_000;
const mkCtx = (now: number, seed = 99): Ctx => ({ now, rng: mulberry32(seed) });

describe('offline progression & system clock edge cases', () => {
  it('advances plants to bloom and rolls bounded events across a 2-hour break', () => {
    const s = createInitialState(T0, 123);
    ACTIONS.plantSeed(s, mkCtx(T0), { plantId: 'daisy', gx: 2, gy: 3 });
    const later = T0 + 2 * 60 * MS_MIN;
    const fx: Effect[] = [];
    const summary = applyOffline(s, mkCtx(later), fx);
    const plant = s.objects.find((o) => o.plant)!;
    expect(isBlooming(plant, later)).toBe(true);
    expect(summary.some((l) => l.includes('bloomed'))).toBe(true);
    expect(s.pickups.length).toBeLessThanOrEqual(MAX_PICKUPS);
  });

  it('caps offline rewards on huge time gaps (30 days away does not create unbounded resources)', () => {
    const s = createInitialState(T0, 777);
    const thirtyDaysLater = T0 + 30 * 24 * 60 * MS_MIN;
    const fx: Effect[] = [];
    applyOffline(s, mkCtx(thirtyDaysLater), fx);
    expect(s.pickups.length).toBeLessThanOrEqual(MAX_PICKUPS);
    expect(s.tokens).toBe(30); // no exponential passive token printing
    expect(s.lastActive).toBe(thirtyDaysLater);
    expect(OFFLINE_CAP_MS).toBe(24 * 60 * MS_MIN);
  });

  it('handles small negative elapsed time (system clock moved backwards by 15 minutes)', () => {
    const s = createInitialState(T0, 55);
    const fx: Effect[] = [];
    const lines = applyOffline(s, mkCtx(T0 - 15 * MS_MIN), fx);
    expect(lines).toEqual([]);
    expect(s.lastActive).toBe(T0); // monotonic
  });

  it('repairs extreme clock skew (clock was set 10 days ahead then fixed back to normal)', () => {
    const future = T0 + 10 * 24 * 60 * MS_MIN;
    const s = createInitialState(future, 88);
    ACTIONS.plantSeed(s, mkCtx(future), { plantId: 'daisy', gx: 2, gy: 3 });
    s.forage.o1 = future + 5 * MS_MIN;
    const fx: Effect[] = [];
    applyOffline(s, mkCtx(T0), fx);
    expect(s.lastActive).toBe(T0);
    const plant = s.objects.find((o) => o.plant)!;
    expect(plant.plant!.plantedAt).toBe(T0);
    expect(s.forage.o1).toBe(T0);
  });
});

describe('random world events', () => {
  it('enforces cooldowns, avoids immediate repeats, and bounds pickups at MAX_PICKUPS', () => {
    const s = createInitialState(T0, 101);
    const fx: Effect[] = [];
    const e1 = rollEvent(s, mkCtx(T0, 1), fx, { offline: false, night: false });
    expect(e1).not.toBeNull();
    // immediate second call is blocked by EVENT_MIN_GAP
    const eBlocked = rollEvent(s, mkCtx(T0 + 5_000, 2), fx, { offline: false, night: false });
    expect(eBlocked).toBeNull();

    // roll 25 events spaced by 1 minute; pickups never exceed MAX_PICKUPS
    for (let i = 1; i <= 25; i++) {
      rollEvent(s, mkCtx(T0 + i * 60_000, i + 10), fx, { offline: false, night: i % 2 === 0 });
      expect(s.pickups.length).toBeLessThanOrEqual(MAX_PICKUPS);
    }
  });

  it('rain event waters growing plants and unlocks Rainy Day achievement on finalize', () => {
    const s = createInitialState(T0, 202);
    s.inventory[seedKey('sunflower')] = 1;
    ACTIONS.plantSeed(s, mkCtx(T0), { plantId: 'sunflower', gx: 2, gy: 3 });
    const plant = s.objects.find((o) => o.plant)!;
    expect(plant.plant!.waterCount).toBe(0);
    ACTIONS.tickEvent(s, mkCtx(T0 + 60_000), { night: false, force: 'rain' });
    expect(plant.plant!.waterCount).toBe(1);
    expect(s.achievements.rainy_day).toBeTruthy();
  });
});

describe('day and night cycle', () => {
  it('computes morning, day, sunset, and night phases and sky tints', () => {
    const dMorning = new Date(2026, 5, 1, 7, 30).getTime();
    const dNoon = new Date(2026, 5, 1, 13, 0).getTime();
    const dSunset = new Date(2026, 5, 1, 18, 15).getTime();
    const dNight = new Date(2026, 5, 1, 23, 0).getTime();

    expect(skyAt(dMorning, 'real').phase).toBe('morning');
    expect(skyAt(dNoon, 'real').phase).toBe('day');
    expect(skyAt(dSunset, 'real').phase).toBe('sunset');
    expect(skyAt(dNight, 'real').phase).toBe('night');
    expect(skyAt(dNight, 'real').night).toBeGreaterThan(0.8);
    expect(skyAt(dNoon, 'real').night).toBe(0);
    expect(isRealNight(dNight)).toBe(true);
    expect(isRealNight(dNoon)).toBe(false);
    expect(phaseOf(hourFor(dNoon, 'night'))).toBe('night');
    expect(phaseOf(hourFor(dNight, 'day'))).toBe('day');

    // Manual hour override and biome override are visual-only (do not mutate clock-based rules)
    expect(hourFor(dNoon, 'custom', 23.25)).toBeCloseTo(23.25, 2);
    expect(skyAt(dNoon, 'custom', 23.25).phase).toBe('night');
    expect(skyAt(dNoon, 'custom', 7.5).phase).toBe('morning');
    expect(isRealNight(dNoon)).toBe(false); // manualHour never fakes real Night Owl time

    const s = createInitialState(dNoon, 515);
    s.settings.cycle = 'custom';
    s.settings.manualHour = 23.5;
    s.settings.biomeOverride = 'frostfall';
    expect(activeBiome(s)).toBe('frostfall');
    ACTIONS.plantSeed(s, mkCtx(dNoon), { plantId: 'daisy', gx: 2, gy: 3 });
    const plant = s.objects.find((o) => o.plant)!;
    // Plant growth remains identical regardless of custom sky hour or biome override
    expect(plantProgress(plant, dNoon + 30_000)).toBeGreaterThan(0);
    expect(s.achievements.night_owl).toBeFalsy();
  });
});

describe('weather separation, offline resets & Stage 10 pathfinding', () => {
  it('separates activeWeather from pickup cooldowns and rolls valid biome weather', () => {
    const s = createInitialState(T0, 616);
    s.stage = 6; // frostfall
    const eta0 = nextEventEtaMs(s, T0);
    expect(eta0).toBeGreaterThanOrEqual(0);
    const tLater = T0 + 20 * MS_MIN;
    const changed = rollWeather(s, mkCtx(tLater, 77), []);
    expect(changed === null || ['clear', 'cloudy', 'rain', 'snow', 'fog', 'wind', 'sparkles'].includes(activeWeather(s, tLater))).toBe(true);
    expect(activeWeather(s, tLater)).toBe(s.events.weather ?? 'clear');
  });

  it('finds long paths up to maxLen 96 on 36x36 Stage 10 island and supports directed creature actions', () => {
    const s = createInitialState(T0, 909);
    s.stage = 10;
    const grid = walkGrid(s);
    expect(grid.length).toBe(36);
    expect(grid[0].length).toBe(36);
    // Find a guaranteed walkable far cell >= (18, 18)
    let farTarget = { gx: 20, gy: 20 };
    outer: for (let gy = 25; gy >= 18; gy--) {
      for (let gx = 25; gx >= 18; gx--) {
        if (grid[gy]?.[gx]) {
          farTarget = { gx, gy };
          break outer;
        }
      }
    }
    const path = findPath(grid, { gx: 2, gy: 3 }, farTarget);
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(20);

    const a = createActor('mossi', 3, 3);
    const okCall = directActor(
      a,
      { gx: 5, gy: 5 },
      { grid, pois: [], night: 0, others: [], rng: mulberry32(1) },
      'call',
    );
    expect(okCall).toBe(true);
    expect(a.path.length).toBeGreaterThan(0);
    expect(a.emotes).toContain('note');
    react(a, 'annoyed');
    expect(a.emotes).toContain('sweat');
  });
});

describe('creature finite-state machine AI', () => {
  it('transitions states, walks along valid paths, sleeps more at night, and reacts to player actions', () => {
    const s = createInitialState(T0, 303);
    const grid = walkGrid(s);
    const rng = mulberry32(42);
    const worldDay: WorldView = {
      grid,
      pois: [
        { kind: 'tree', gx: 2, gy: 1 },
        { kind: 'bush', gx: 1, gy: 4 },
        { kind: 'pond', gx: 4, gy: 3 },
      ],
      night: 0,
      others: [],
      rng,
    };

    const mossi = createActor('mossi', 3, 3);
    for (let i = 0; i < 80; i++) {
      tickActor(mossi, 0.2, worldDay);
      // Creature never steps onto non-walkable tiles
      const cx = Math.round(mossi.gx);
      const cy = Math.round(mossi.gy);
      expect(grid[cy]?.[cx]).toBe(true);
    }

    // At night, sleep weight dominates
    const worldNight: WorldView = { ...worldDay, night: 1, rng: mulberry32(7) };
    let sleepCount = 0;
    for (let i = 0; i < 40; i++) {
      if (chooseState(mossi, worldNight) === 'sleep') sleepCount++;
    }
    expect(sleepCount).toBeGreaterThan(10);

    // Player reactions override current state and emit emotes
    react(mossi, 'pet');
    expect(mossi.emotes).toContain('heart');
    tickActor(mossi, 0.1, worldDay);
    expect(mossi.anim).toBe('curious');

    react(mossi, 'feed');
    tickActor(mossi, 0.1, worldDay);
    expect(mossi.anim).toBe('eat');

    // If a decoration is placed on the creature's tile, it hops to the nearest walkable tile
    s.inventory[decorKey('bench')] = 1;
    const cellX = Math.round(mossi.gx);
    const cellY = Math.round(mossi.gy);
    grid[cellY][cellX] = false;
    tickActor(mossi, 0.1, { ...worldDay, grid });
    expect(grid[Math.round(mossi.gy)][Math.round(mossi.gx)]).toBe(true);
  });

  it('never traps Pipkins behind the Great Old Tree when surrounded by plants or enclosed in a pocket', () => {
    const s = createInitialState(T0, 404);
    s.inventory[seedKey('daisy')] = 10;
    // Plant daisies all around the Great Old Tree at (2, 1)
    for (const [gx, gy] of [[1, 1], [1, 2], [2, 2], [3, 2], [3, 1]] as const) {
      ACTIONS.plantSeed(s, mkCtx(T0), { plantId: 'daisy', gx, gy });
    }
    const grid = walkGrid(s);
    // Planted flowers are walkable so Pipkins can freely pass through the garden
    expect(grid[2][2]).toBe(true);
    expect(grid[1][1]).toBe(true);

    // If a Pipkin is placed behind the tree or on a plant tile, it nudges itself onto an open meadow tile
    const ember = createActor('ember', 2, 0);
    const world: WorldView = {
      grid,
      pois: [
        { kind: 'tree', gx: 2, gy: 1 },
        { kind: 'plant', gx: 2, gy: 2 },
      ],
      night: 0,
      others: [],
      rng: mulberry32(19),
    };
    tickActor(ember, 0.1, world);
    expect(ember.path.length).toBeGreaterThan(0);

    // If a Pipkin is walled into a tiny 1-tile pocket by solid fences, tickActor hops it out to the open meadow
    const pocketGrid = walkGrid(s);
    pocketGrid[0][1] = false;
    pocketGrid[1][2] = false;
    pocketGrid[0][3] = false;
    const trapped = createActor('mossi', 2, 0);
    tickActor(trapped, 0.1, { ...world, grid: pocketGrid });
    expect(!(Math.round(trapped.gx) === 2 && Math.round(trapped.gy) === 0)).toBe(true);
  });
});
