import { ITEM_BY_ID, STAGES } from './catalog';
import type { GameState, ItemDef, PlacedObject, Terrain } from './types';

export const TILE_W = 32;
export const TILE_H = 16;

/** top vertex of a tile in world space */
export const gridToWorld = (gx: number, gy: number) => ({ x: (gx - gy) * (TILE_W / 2), y: (gx + gy) * (TILE_H / 2) });
/** centre of a tile in world space */
export const cellCenter = (gx: number, gy: number) => {
  const p = gridToWorld(gx, gy);
  return { x: p.x, y: p.y + TILE_H / 2 };
};
/** float grid coordinates for a world point (tile centres are integers) */
export const worldToGridF = (x: number, y: number) => {
  const u = x / (TILE_W / 2);
  const v = (y - TILE_H / 2) / (TILE_H / 2);
  return { gx: (u + v) / 2, gy: (v - u) / 2 };
};
export const worldToCell = (x: number, y: number) => {
  const g = worldToGridF(x, y);
  return { gx: Math.round(g.gx), gy: Math.round(g.gy) };
};

// ------------------------------------------------------------ terrain semantics
export const WATER_TERRAINS: ReadonlySet<Terrain> = new Set(['water', 'hotspring']);
export const SOIL_TERRAINS: ReadonlySet<Terrain> = new Set(['grass', 'snow', 'autumn', 'starstone']);
export const BRIDGE_IDS: ReadonlySet<string> = new Set(['bridge', 'stepping_stones', 'lily_stepping']);

export const isWaterTerrain = (t: Terrain): boolean => WATER_TERRAINS.has(t);
export const isWalkableTerrain = (t: Terrain): boolean => t !== 'void' && !WATER_TERRAINS.has(t);
export const isSoilTerrain = (t: Terrain): boolean => SOIL_TERRAINS.has(t);

// ------------------------------------------------------------ terrain maps (Stages 1..10, invariant (0,0) anchor)
const STAGE1_ROWS: string[] = [
  '.ggggg..',
  'gggggppg',
  'gggggppg',
  'ggggwwgg',
  'gggwwwgg',
  'ggggggss',
  '.ggggggg',
  '..ggggg.',
];

const CH: Record<string, Terrain> = {
  g: 'grass',
  p: 'plot',
  w: 'water',
  s: 'sand',
  n: 'snow',
  i: 'ice',
  a: 'autumn',
  h: 'hotspring',
  k: 'starstone',
  '.': 'void',
};

export interface TerrainMap {
  w: number;
  h: number;
  cells: Terrain[][]; // [gy][gx]
}

const inRoundedBounds = (gx: number, gy: number, n: number): boolean => {
  if (gx < 0 || gy < 0 || gx >= n || gy >= n) return false;
  const bevel = Math.max(1, Math.floor(n / 7));
  // Gentle rounded top crown, deep rounded eastern/western/southern corners
  if (gx + gy < 1) return false;
  if (gx + gy > (n - 1) * 2 - bevel) return false;
  if (gx - gy > n - 1 - bevel) return false;
  if (gy - gx > n - 1 - bevel) return false;
  return true;
};

const paintStageFeatures = (cells: Terrain[][], stage: number, n: number) => {
  const setIfVoidOrNew = (gx: number, gy: number, t: Terrain) => {
    if (gx < 0 || gy < 0 || gx >= n || gy >= n) return;
    if (!inRoundedBounds(gx, gy, n)) return;
    // Only fill cells that were void before this stage's expansion so existing placements never shift or break
    if (cells[gy][gx] === 'void') cells[gy][gx] = t;
  };
  const setZone = (x0: number, y0: number, x1: number, y1: number, t: Terrain) => {
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) setIfVoidOrNew(gx, gy, t);
    }
  };

  if (stage === 2) {
    setZone(9, 5, 10, 6, 'plot');
    setZone(8, 5, 8, 6, 'sand');
  } else if (stage === 3) {
    setZone(10, 3, 12, 4, 'water');
    setZone(9, 4, 9, 4, 'sand');
    setZone(6, 11, 8, 12, 'plot');
  } else if (stage === 4) {
    setZone(13, 8, 15, 10, 'water');
    setZone(16, 9, 16, 10, 'sand');
    setZone(13, 13, 15, 14, 'plot');
  } else if (stage === 5) {
    setZone(17, 13, 19, 15, 'water');
    setZone(16, 15, 16, 16, 'sand');
    setZone(18, 8, 20, 9, 'plot');
  } else if (stage === 6) {
    // Frostfall Haven: powdery snow crown + glacial pools
    setZone(20, 4, 24, 12, 'snow');
    setZone(21, 9, 23, 11, 'water');
    setZone(20, 10, 20, 11, 'ice');
    setZone(18, 21, 21, 23, 'snow');
  } else if (stage === 7) {
    // Mistwood Hollow: amber woodland clearing + brook
    setZone(2, 18, 9, 25, 'autumn');
    setZone(5, 21, 7, 23, 'water');
    setZone(9, 22, 11, 23, 'plot');
  } else if (stage === 8) {
    // Emberglow Valley: warm sands & soothing geothermal hotsprings
    setZone(20, 18, 26, 25, 'sand');
    setZone(22, 20, 24, 22, 'hotspring');
    setZone(23, 24, 25, 25, 'plot');
  } else if (stage === 9) {
    // Starlight Isles: cosmic starstone terrace + mirror sky pool
    setZone(10, 24, 17, 30, 'starstone');
    setZone(13, 26, 15, 28, 'water');
    setZone(16, 27, 17, 28, 'plot');
  } else if (stage === 10) {
    // Everdream Paradise: outer ring uniting meadow, snow, autumn, and starlight
    setZone(28, 8, 33, 15, 'snow');
    setZone(27, 17, 33, 24, 'grass');
    setZone(29, 20, 31, 22, 'water');
    setZone(18, 28, 26, 33, 'starstone');
    setZone(21, 30, 23, 31, 'hotspring');
    setZone(6, 27, 14, 33, 'autumn');
  }

  // Fill remaining reachable rounded-island void tiles with biome-appropriate default land
  const defaultLand: Terrain =
    stage === 6 ? 'snow' :
    stage === 7 ? 'autumn' :
    stage === 9 ? 'starstone' :
    'grass';

  for (let gy = 0; gy < n; gy++) {
    for (let gx = 0; gx < n; gx++) {
      if (!inRoundedBounds(gx, gy, n)) continue;
      if (cells[gy][gx] !== 'void') continue;
      if (stage === 10) {
        if (gx >= 26 && gy <= 16) cells[gy][gx] = 'snow';
        else if (gx <= 14 && gy >= 26) cells[gy][gx] = 'autumn';
        else if (gy >= 27 && gx >= 15) cells[gy][gx] = 'starstone';
        else cells[gy][gx] = 'grass';
      } else {
        cells[gy][gx] = defaultLand;
      }
    }
  }
};

const cache = new Map<number, TerrainMap>();

export const terrainMap = (stage: number): TerrainMap => {
  const safe = Number.isFinite(stage) ? Math.floor(stage) : 1;
  const st = Math.min(Math.max(safe, 1), STAGES.length);
  let m = cache.get(st);
  if (m) return m;

  if (st === 1) {
    m = { w: 8, h: 8, cells: STAGE1_ROWS.map((r) => [...r].map((c) => CH[c])) };
    cache.set(1, m);
    return m;
  }

  // Incrementally expand from Stage (st - 1) so every non-void cell keeps its exact (gx, gy) and terrain
  const prev = terrainMap(st - 1);
  const def = STAGES[st - 1];
  const w = def.gridW;
  const h = def.gridH;
  const cells: Terrain[][] = Array.from({ length: h }, (_, gy) =>
    Array.from({ length: w }, (_, gx) => (gy < prev.h && gx < prev.w ? prev.cells[gy][gx] : 'void')),
  );
  paintStageFeatures(cells, st, w);
  m = { w, h, cells };
  cache.set(st, m);
  return m;
};

export const terrainAt = (stage: number, gx: number, gy: number): Terrain => {
  const m = terrainMap(stage);
  if (gx < 0 || gy < 0 || gx >= m.w || gy >= m.h) return 'void';
  return m.cells[gy][gx];
};

export const stageGrid = (stage: number) => {
  const safe = Number.isFinite(stage) ? Math.floor(stage) : 1;
  return STAGES[Math.min(Math.max(safe, 1), STAGES.length) - 1];
};

// ------------------------------------------------------------ footprints
export const footprintDims = (def: ItemDef, rot: 0 | 1) => {
  return rot === 1 ? { w: def.d, d: def.w } : { w: def.w, d: def.d };
};
export const footprintCells = (def: ItemDef, gx: number, gy: number, rot: 0 | 1) => {
  const { w, d } = footprintDims(def, rot);
  const out: { gx: number; gy: number }[] = [];
  for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) out.push({ gx: gx + x, gy: gy + y });
  return out;
};
export const objDef = (o: PlacedObject): ItemDef =>
  o.plant ? PLANT_ITEM : ITEM_BY_ID[o.type];

/** plants are placed objects with a shared pseudo-definition (walkable so Pipkins never get trapped by gardens) */
export const PLANT_ITEM: ItemDef = {
  id: 'plant', name: 'Plant', desc: '', category: 'nature', price: 0, stage: 1, w: 1, d: 1,
  layer: 'object', blocks: false, placeOn: 'land', rotatable: false, tags: ['plant'],
};

export interface PlaceCheck {
  ok: boolean;
  reason?: string;
}

/** Validate placing `def` at (gx, gy). `ignoreId` lets an object move onto its own cells. */
export const canPlace = (
  state: Pick<GameState, 'stage' | 'objects'>,
  def: ItemDef,
  gx: number,
  gy: number,
  rot: 0 | 1,
  ignoreId?: string,
  opts: { plant?: boolean } = {},
): PlaceCheck => {
  const cells = footprintCells(def, gx, gy, rot);
  const others = state.objects.filter((o) => o.id !== ignoreId);
  for (const c of cells) {
    const t = terrainAt(state.stage, c.gx, c.gy);
    if (t === 'void') return { ok: false, reason: 'Out of the island' };
    if (def.placeOn === 'water') {
      if (!isWaterTerrain(t)) return { ok: false, reason: 'Needs water' };
    } else if (def.placeOn === 'land') {
      if (isWaterTerrain(t)) return { ok: false, reason: "Can't build on water" };
      if (opts.plant && !isSoilTerrain(t)) return { ok: false, reason: 'Plants need soft soil' };
    }
    for (const o of others) {
      const od = objDef(o);
      if (!od) continue;
      const oc = footprintCells(od, o.gx, o.gy, o.rot);
      if (!oc.some((p) => p.gx === c.gx && p.gy === c.gy)) continue;
      if (od.layer === def.layer) return { ok: false, reason: 'Something is already here' };
      if (def.layer === 'object' && BRIDGE_IDS.has(od.id)) return { ok: false, reason: 'Not on a water crossing' };
    }
  }
  return { ok: true };
};

/** Which cells can creatures walk through? */
export const walkGrid = (state: Pick<GameState, 'stage' | 'objects'>): boolean[][] => {
  const m = terrainMap(state.stage);
  const g = m.cells.map((row) => row.map((t) => isWalkableTerrain(t)));
  for (const o of state.objects) {
    const d = objDef(o);
    if (!d) continue;
    for (const c of footprintCells(d, o.gx, o.gy, o.rot)) {
      if (c.gy < 0 || c.gx < 0 || c.gy >= m.h || c.gx >= m.w) continue;
      if (BRIDGE_IDS.has(d.id)) g[c.gy][c.gx] = true;
      else if (d.blocks) g[c.gy][c.gx] = false;
    }
  }
  return g;
};

export const objectAt = (state: Pick<GameState, 'objects'>, gx: number, gy: number, layer?: 'object' | 'ground'): PlacedObject | undefined => {
  for (const o of state.objects) {
    const d = objDef(o);
    if (!d) continue;
    if (layer && d.layer !== layer) continue;
    if (footprintCells(d, o.gx, o.gy, o.rot).some((c) => c.gx === gx && c.gy === gy)) return o;
  }
  return undefined;
};

/** Breadth-first path on the walk grid (4-neighbour). Returns cells excluding start. */
export const findPath = (grid: boolean[][], from: { gx: number; gy: number }, to: { gx: number; gy: number }, maxLen = 96): { gx: number; gy: number }[] | null => {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && grid[y][x];
  if (!ok(to.gx, to.gy)) return null;
  if (from.gx === to.gx && from.gy === to.gy) return [];
  const key = (x: number, y: number) => y * w + x;
  const prev = new Map<number, number>();
  prev.set(key(from.gx, from.gy), -1);
  const q: [number, number][] = [[from.gx, from.gy]];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (!ok(nx, ny) || prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), key(x, y));
      if (nx === to.gx && ny === to.gy) {
        const path: { gx: number; gy: number }[] = [];
        let k = key(nx, ny);
        while (k !== -1 && k !== key(from.gx, from.gy)) {
          path.push({ gx: k % w, gy: Math.floor(k / w) });
          k = prev.get(k)!;
        }
        path.reverse();
        return path.length > maxLen ? null : path;
      }
      q.push([nx, ny]);
    }
  }
  return null;
};
