import { terrainMap } from '../core/grid';
import { hash } from '../core/rng';
import type { BiomeId, CustomTerrainKind, Terrain } from '../core/types';
import { Pix, OUTLINE, darken, lighten, mixc, noise, ramp } from './pix';

export interface IslandTex {
  pix: Pix;
  /** pixel coordinates inside the texture that correspond to world (0,0) */
  ox: number;
  oy: number;
}

const GRASS = [0x4c9e3f, 0x62b84a, 0x77cd54, 0x98df68];
const SAND = [0xc9a76a, 0xdfc184, 0xedd39a, 0xf8e6b8];
const SNOW = [0xb8d4ec, 0xd8ecfa, 0xedf7ff, 0xffffff];
const ICE = [0x6cb8e2, 0x8cd0f2, 0xb8e6fa, 0xe8f9ff];
const AUTUMN = [0xa86434, 0xc47b42, 0xd89656, 0xecb674];
const STARSTONE = [0x3b3564, 0x4c447c, 0x62589a, 0x8074ba];
const PLOT_A = ramp(0xd7c199);
const PLOT_B = ramp(0x88bc58);
const WATER = [0x2a88a8, 0x38a8c6, 0x4cc4de, 0xa8f0fa];
const HOTSPRING = [0x2e9ca8, 0x48c4ce, 0x72e4ea, 0xdcfafa];
const CLIFF = [0x483226, 0x6b4b38, 0x8a624a, 0xaa7c5e];
const CLIFF_COOL = [0x3c4a72, 0x50628c, 0x6880aa, 0x8aa4ca];
const CLIFF_FROST = [0x506c90, 0x6c8cb4, 0x8eb0d8, 0xb8d6f4];
const CLIFF_EMBER = [0x3a2428, 0x563234, 0x764242, 0x9c544e];
const CLIFF_STAR = [0x28264c, 0x3a366a, 0x4e4a8c, 0x6c66b2];

const inside = (u: number, v: number) => u >= 0 && u <= 1 && v >= 0 && v <= 1;

export const TERRAIN_KINDS: Exclude<Terrain, 'void'>[] = [
  'grass',
  'plot',
  'water',
  'sand',
  'snow',
  'ice',
  'autumn',
  'hotspring',
  'starstone',
];

export const cliffPaletteFor = (biome: BiomeId) => {
  if (biome === 'frostfall') return CLIFF_FROST;
  if (biome === 'emberglow') return CLIFF_EMBER;
  if (biome === 'starlight') return CLIFF_STAR;
  return CLIFF;
};

export const grassPaletteFor = (biome: BiomeId): number[] => {
  if (biome === 'frostfall') return [0x5ea274, 0x78be8e, 0x96d4a8, 0xbce6c8];
  if (biome === 'mistwood') return [0x3e883e, 0x52a048, 0x68b856, 0x86ce6c];
  if (biome === 'emberglow') return [0x5e963a, 0x76b048, 0x90c658, 0xb0d86e];
  if (biome === 'starlight') return [0x3b7a68, 0x4e9680, 0x62b098, 0x84ceb6];
  if (biome === 'everdream') return [0x54a848, 0x6cc258, 0x86d668, 0xa8ea84];
  return GRASS;
};

/** Render a standalone 32×16 diamond terrain tile swatch using the island tile shader. */
export const buildTerrainTile = (
  kind: Exclude<Terrain, 'void'>,
  biome: BiomeId = 'meadow',
  waterFrame = 0,
): IslandTex => {
  const p = new Pix(32, 16);
  drawTopTile(p, 0, 0, kind, 0, 0, waterFrame, grassPaletteFor(biome), biome);
  return { pix: p, ox: 16, oy: 0 };
};

/**
 * Render a neighbor-aware 32×16 isometric custom terrain patch (`snow` or `sand`).
 *
 * `sameMask` is a 4-bit cardinal mask (`1=N/gy-1, 2=E/gx+1, 4=S/gy+1, 8=W/gx-1`)
 * where bits set to 1 mean the adjacent tile has the *same* terrain, so that edge extends
 * seamlessly to the tile boundary to form a continuous snowfield or desert.
 *
 * `otherMask` is a 4-bit cardinal mask where bits set to 1 mean the adjacent tile has the
 * *opposite* custom terrain (`snow` next to `sand`), creating a cohesive transition with zero gaps.
 *
 * Edges with neither bit set border default meadow grass and render soft scalloped pixel-art transitions
 * with subtle grass blades or sand/snow grains peeking through.
 */
export const buildCustomTerrainPatch = (
  kind: CustomTerrainKind,
  sameMask = 0,
  otherMask = 0,
): IslandTex => {
  const p = new Pix(32, 16);
  const pal = kind === 'snow' ? SNOW : SAND;
  const otherPal = kind === 'snow' ? SAND : SNOW;

  const sameN = (sameMask & 1) !== 0; // v = 0 edge (gy - 1)
  const sameE = (sameMask & 2) !== 0; // u = 1 edge (gx + 1)
  const sameS = (sameMask & 4) !== 0; // v = 1 edge (gy + 1)
  const sameW = (sameMask & 8) !== 0; // u = 0 edge (gx - 1)

  const otherN = (otherMask & 1) !== 0;
  const otherE = (otherMask & 2) !== 0;
  const otherS = (otherMask & 4) !== 0;
  const otherW = (otherMask & 8) !== 0;

  for (let dy = 0; dy < 16; dy++) {
    for (let dx = 0; dx < 32; dx++) {
      const rx = dx + 0.5 - 16;
      const ry = dy + 0.5;
      const u = (ry / 8 + rx / 16) / 2;
      const v = (ry / 8 - rx / 16) / 2;
      if (!inside(u, v)) continue;

      const n = noise(dx, dy, kind === 'snow' ? 71 : 83);
      const edgeWobble = (noise(dx * 2, dy * 2, 53) - 0.5) * 0.14;

      // Distance from each cardinal edge when that edge borders grass (not same, not other)
      const grassDistN = sameN || otherN ? 1 : v;
      const grassDistS = sameS || otherS ? 1 : 1 - v;
      const grassDistW = sameW || otherW ? 1 : u;
      const grassDistE = sameE || otherE ? 1 : 1 - u;
      const minGrassDist = Math.min(grassDistN, grassDistS, grassDistW, grassDistE);

      // Soft scalloped transition against meadow grass
      const cutoff = 0.13 + edgeWobble;
      if (minGrassDist < cutoff) {
        // Leave outer fringe transparent so underlying meadow grass peeks through naturally,
        // with occasional scattered snow/sand grains right along the border
        if (minGrassDist > cutoff - 0.045 && n > 0.62) {
          p.set(dx, dy, kind === 'snow' ? GRASS[3] : mixc(pal[0], GRASS[2], 0.45));
        }
        continue;
      }

      // Base surface shading
      let c = n > 0.76 ? pal[3] : n > 0.26 ? pal[2] : pal[1];

      // Soft inner rim shading near grass borders
      if (minGrassDist < cutoff + 0.09) {
        c = n > 0.55 ? pal[1] : pal[0];
      }

      // Coherent interlocking blend where Snow meets Sand directly (no gaps or dark seams)
      const otherDistN = otherN ? v : 1;
      const otherDistS = otherS ? 1 - v : 1;
      const otherDistW = otherW ? u : 1;
      const otherDistE = otherE ? 1 - u : 1;
      const minOtherDist = Math.min(otherDistN, otherDistS, otherDistW, otherDistE);
      if (minOtherDist < 0.16) {
        const blendT = 0.45 * (1 - minOtherDist / 0.16);
        c = mixc(c, otherPal[1], blendT);
      }

      p.set(dx, dy, c);
    }
  }

  // Subtle surface details in the center so connected fields feel alive without visual noise
  if (kind === 'snow') {
    p.set(14, 7, 0xffffff);
    p.set(19, 9, SNOW[0]);
    if (!sameN && !otherN) p.set(16, 3, GRASS[2]);
  } else {
    p.set(13, 8, SAND[3]);
    p.set(18, 7, SAND[0]);
    p.set(20, 9, SAND[3]);
    if (!sameS && !otherS) p.set(15, 12, GRASS[2]);
  }

  return { pix: p, ox: 16, oy: 0 };
};

/** Shop/Bag icon sprite for terrain customization patches (Green Grass, Snow Patch, Sand Patch). */
export const terrainPatchSprite = (kind: 'grass' | CustomTerrainKind): { pix: Pix; ax: number } => {
  const p = new Pix(32, 20);
  const topPal = kind === 'snow' ? SNOW : kind === 'sand' ? SAND : GRASS;
  // Draw raised 32x16 diamond with a 3px earthen rim and crisp outline for Shop/Bag readability
  for (let dy = 0; dy < 16; dy++) {
    for (let dx = 0; dx < 32; dx++) {
      const rx = dx + 0.5 - 16;
      const ry = dy + 0.5;
      const u = (ry / 8 + rx / 16) / 2;
      const v = (ry / 8 - rx / 16) / 2;
      if (!inside(u, v)) continue;
      const edge = Math.min(u, v, 1 - u, 1 - v);
      if (edge < 0.08) continue;
      const n = noise(dx, dy, kind === 'snow' ? 17 : kind === 'sand' ? 29 : 11);
      const c = edge < 0.18 ? topPal[0] : n > 0.72 ? topPal[3] : n > 0.28 ? topPal[2] : topPal[1];
      p.set(dx, dy + 1, c);
      if (u > 0.78 || v > 0.78) {
        p.set(dx, dy + 2, CLIFF[2]);
        p.set(dx, dy + 3, CLIFF[1]);
      }
    }
  }
  if (kind === 'grass') {
    p.set(14, 7, GRASS[3]);
    p.set(15, 6, GRASS[3]);
    p.set(18, 9, 0xfef08a);
  } else if (kind === 'snow') {
    p.set(13, 7, 0xffffff);
    p.set(18, 8, 0xffffff);
    p.set(16, 6, ICE[2]);
  } else {
    p.set(14, 8, SAND[3]);
    p.set(17, 7, SAND[0]);
    p.set(19, 9, SAND[3]);
  }
  p.outline(OUTLINE);
  return { pix: p, ax: 16 };
};

const drawTopTile = (
  p: Pix,
  tx: number,
  ty: number,
  kind: Terrain,
  gx: number,
  gy: number,
  frame: number,
  grassPal: number[],
  biome: BiomeId,
) => {
  const sandPal = biome === 'emberglow' ? [0xa47a52, 0xbc9064, 0xd4aa7c, 0xe8c494] : SAND;
  for (let dy = 0; dy < 16; dy++) {
    for (let dx = 0; dx < 32; dx++) {
      const rx = dx + 0.5 - 16, ry = dy + 0.5;
      const u = (ry / 8 + rx / 16) / 2;
      const v = (ry / 8 - rx / 16) / 2;
      if (!inside(u, v)) continue;
      const x = tx + dx, y = ty + dy;
      const edge = Math.min(u, v, 1 - u, 1 - v);
      const n = noise(x, y, 7);
      let c = grassPal[1];
      if (kind === 'grass') {
        const patch = ((gx + gy) & 1) === 0;
        c = patch ? grassPal[2] : mixc(grassPal[1], grassPal[2], 0.55);
        if (edge < 0.08 && n > 0.35) c = grassPal[1];
        if (n > 0.86) c = grassPal[3];
        else if (n < 0.09) c = grassPal[0];
      } else if (kind === 'sand') {
        c = n > 0.7 ? sandPal[2] : n > 0.25 ? sandPal[1] : sandPal[0];
        if (n > 0.92) c = sandPal[3];
      } else if (kind === 'snow') {
        c = n > 0.74 ? SNOW[3] : n > 0.25 ? SNOW[2] : SNOW[1];
        if (edge < 0.1 && n > 0.45) c = SNOW[0];
      } else if (kind === 'ice') {
        const glint = Math.abs(u - v) < 0.12 && n > 0.3;
        c = glint ? ICE[3] : n > 0.65 ? ICE[2] : ICE[1];
        if (edge < 0.08) c = ICE[0];
      } else if (kind === 'autumn') {
        const patch = ((gx + gy) & 1) === 0;
        c = patch ? AUTUMN[2] : mixc(AUTUMN[1], AUTUMN[2], 0.55);
        if (n > 0.87) c = AUTUMN[3];
        else if (n < 0.1) c = AUTUMN[0];
      } else if (kind === 'starstone') {
        const seam = edge < 0.07;
        c = seam ? STARSTONE[0] : n > 0.94 ? 0xfef08a : n > 0.68 ? STARSTONE[2] : STARSTONE[1];
      } else if (kind === 'plot') {
        const su = u * 2, sv = v * 2;
        const iu = Math.floor(su), iv = Math.floor(sv);
        const fu = su - iu, fv = sv - iv;
        const seam = fu < 0.1 || fu > 0.9 || fv < 0.1 || fv > 0.9;
        const mossy = ((gx * 2 + iu + gy * 2 + iv) % 3) === 0;
        const pal = mossy ? PLOT_B : PLOT_A;
        c = seam ? pal[0] : fu + fv < 0.9 ? pal[3] : pal[2];
        if (!seam && n > 0.85) c = pal[1];
      } else if (kind === 'water' || kind === 'hotspring') {
        const pal = kind === 'hotspring' ? HOTSPRING : WATER;
        if (u < 0.14 || v < 0.14) {
          c = kind === 'hotspring' ? 0x5c4238 : u < v ? 0x6a4e3a : 0x523c2c;
        } else {
          const wave = (dx + dy * 2 + frame * 5 + gx * 3) % 13;
          c = wave === 0 || wave === 1 ? pal[3] : u + v < 0.9 ? pal[1] : pal[2];
          if (edge < 0.12) c = pal[0];
        }
      }
      p.set(x, y, c);
    }
  }
  if (kind === 'grass' && hash(gx, gy, 19) % 3 !== 0) {
    const k = hash(gx, gy, 23);
    const ox = tx + 11 + (k % 10), oy = ty + 5 + ((k >> 4) % 6);
    p.set(ox, oy, grassPal[0]); p.set(ox - 1, oy - 1, grassPal[3]); p.set(ox + 1, oy - 1, grassPal[3]); p.set(ox, oy - 1, grassPal[2]);
  } else if (kind === 'autumn' && hash(gx, gy, 29) % 2 === 0) {
    const k = hash(gx, gy, 31);
    const ox = tx + 10 + (k % 12), oy = ty + 5 + ((k >> 4) % 5);
    p.set(ox, oy, 0xf59e0b); p.set(ox + 1, oy - 1, 0xfef08a);
  } else if (kind === 'snow' && hash(gx, gy, 37) % 3 === 0) {
    const k = hash(gx, gy, 41);
    const ox = tx + 12 + (k % 8), oy = ty + 6 + ((k >> 4) % 4);
    p.set(ox, oy, 0xffffff); p.set(ox + 1, oy, SNOW[0]);
  }
};

const column = (p: Pix, cx: number, topY: number, h: number, r: number, cool: number, seed: number, basePal: number[], mossPal: number[]) => {
  const capH = Math.max(2, Math.round(r * 0.45));
  const pal = basePal.map((c, i) => mixc(c, CLIFF_COOL[i], cool));
  const vary = (noise(seed, 1, 9) - 0.5) * 0.16;
  const col = (i: number) => (vary > 0 ? lighten(pal[i], vary) : darken(pal[i], -vary));
  const x0 = Math.round(cx - r), x1 = Math.round(cx - r * 0.25), x2 = Math.round(cx + r * 0.35), x3 = Math.round(cx + r);
  const yStart = Math.round(topY + capH);
  for (let y = yStart; y < yStart + h; y++) {
    const t = (y - yStart) / Math.max(1, h);
    const bot = mixc(0x28365e, 0x1e2240, t);
    const band = (y - yStart) % 5 === 0;
    for (let x = x0; x <= x3; x++) {
      let c = x < x1 ? col(2) : x < x2 ? col(1) : col(0);
      if (band && noise(x, y, seed) > 0.35) c = darken(c, 0.18);
      if (x === x0 || x === x3) c = col(0);
      c = mixc(c, bot, Math.max(0, t - 0.55) * 1.3);
      p.set(x, y, c);
    }
  }
  p.ellipseFn(cx, topY + capH * 0.65, r, capH * 0.7, (nx, ny) => (nx + ny < -0.2 ? col(3) : col(2)));
  for (let x = x0 + 1; x < x3; x++) p.set(x, Math.round(topY + capH), x < cx ? col(3) : col(1));
  if (cool < 0.25 && hash(seed, 7) % 6 === 0) {
    p.blob(cx, topY + 1, r * 0.6, 2.0, mossPal, 0.2, seed);
  }
};

export const buildIsland = (stage: number, waterFrame: number, biomeOverride?: BiomeId | null): IslandTex => {
  const m = terrainMap(stage);
  // All stages 1..10 share a unified green meadow base by default unless an explicit biome preview is requested
  const biome: BiomeId = biomeOverride ?? 'meadow';
  const cliffPal = cliffPaletteFor(biome);
  const grassPal = grassPaletteFor(biome);
  const padX = 28, padTop = 18;
  const cliffDepth = Math.min(180, 68 + (stage - 1) * 12);
  const w = (m.w + m.h) * 16 + padX * 2;
  const h = (m.w + m.h) * 8 + padTop + cliffDepth;
  const ox = padX + m.h * 16;
  const oy = padTop;
  const p = new Pix(w, h);

  const solid = (gx: number, gy: number) => gx >= 0 && gy >= 0 && gx < m.w && gy < m.h && m.cells[gy][gx] !== 'void';

  // Compute exact per-pixel-column bottom silhouette from solid terrain tiles (eliminates wing overhangs & seams)
  const colFloorY = new Int16Array(w).fill(-1);
  let minSolidX = w;
  let maxSolidX = -1;
  for (let gy = 0; gy < m.h; gy++) {
    for (let gx = 0; gx < m.w; gx++) {
      if (!solid(gx, gy)) continue;
      const tx = ox + (gx - gy) * 16 - 16;
      const ty = oy + (gx + gy) * 8;
      if (tx + 2 < minSolidX) minSolidX = tx + 2;
      if (tx + 30 > maxSolidX) maxSolidX = tx + 30;
      for (let dx = 0; dx < 32; dx++) {
        const x = tx + dx;
        if (x < 0 || x >= w) continue;
        const yBot = dx < 16 ? ty + 8 + Math.floor(dx / 2) : ty + 15 - Math.floor((dx - 16) / 2);
        if (yBot > colFloorY[x]) colFloorY[x] = yBot;
      }
    }
  }

  const centerX = Math.round((minSolidX + maxSolidX) / 2);
  const fullHalfSpan = Math.max(24, (maxSolidX - minSolidX) / 2 - 4);

  // ---- 1. Tapered rocky underside strictly anchored beneath solid perimeter edges
  interface Col { cx: number; y: number; h: number; r: number; cool: number; seed: number }
  const cols: Col[] = [];
  const rows = Math.min(20, 9 + stage);
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    const halfW = fullHalfSpan * Math.pow(1 - t * 0.88, 0.88);
    const step = 8.5 - t * 1.4;
    const count = Math.max(1, Math.round((halfW * 2) / step));
    for (let i = 0; i < count; i++) {
      const u = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
      const jitter = (noise(i, r, 31) - 0.5) * 3;
      const cx = centerX + u * halfW + jitter;
      const rad = 5.0 - t * 1.6 + (noise(i, r, 33) - 0.5) * 0.9;
      const ix = Math.round(cx);
      // Clip any column whose edge extends past actual island tiles on left/right corners
      if (ix < 6 || ix >= w - 6 || colFloorY[ix] < 0 || colFloorY[ix - 4] < 0 || colFloorY[ix + 4] < 0) continue;
      // Start row 0 inside the 16..20px earth wall right under the tile rim so zero gap ever opens
      const edgeY = colFloorY[ix];
      const depthCurve = cliffDepth * (0.28 + 0.62 * (1 - Math.pow(Math.abs(u), 1.35)));
      const y = edgeY + 2 + t * (depthCurve - 16) + (noise(i, r, 32) - 0.5) * 2.5;
      const len = 18 + (1 - t) * 12 + noise(i, r, 34) * 6;
      cols.push({ cx, y, h: len, r: Math.max(2.6, rad), cool: Math.max(0, (t - 0.2) / 0.8), seed: r * 100 + i });
    }
  }
  cols.sort((a, b) => a.y - b.y);
  for (const c of cols) column(p, c.cx, c.y, c.h, c.r, c.cool, c.seed, cliffPal, grassPal);

  // ---- 2. Immediate earth wall & turf overhang under exposed front-left / front-right tile edges
  const lipPal = (k: Terrain) =>
    k === 'sand' ? SAND : k === 'snow' ? SNOW : k === 'autumn' ? AUTUMN : k === 'starstone' ? STARSTONE : grassPal;

  const frontEdges: { vx: number; vy: number }[] = [];
  for (let gy = 0; gy < m.h; gy++) {
    for (let gx = 0; gx < m.w; gx++) {
      if (!solid(gx, gy)) continue;
      const tx = ox + (gx - gy) * 16 - 16;
      const ty = oy + (gx + gy) * 8;
      const lip = lipPal(m.cells[gy][gx]);
      // left-front edge (gy+1 is void)
      if (!solid(gx, gy + 1)) {
        if ((hash(gx, gy, 43) % 7) === 0) frontEdges.push({ vx: tx + 8, vy: ty + 14 });
        for (let i = 0; i < 16; i++) {
          const x = tx + i;
          const yEdge = ty + 8 + Math.floor(i / 2);
          const wallH = 16 + (hash(gx, gy, i) % 5);
          const hang = 2 + (hash(gx, i, 2) % 3);
          for (let d = 0; d < wallH; d++) {
            const c = d < hang ? (d === 0 ? lip[2] : lip[0]) : d < hang + 2 ? cliffPal[3] : (d % 4 === 0 ? cliffPal[1] : cliffPal[2]);
            p.set(x, yEdge + d, c);
          }
        }
      }
      // right-front edge (gx+1 is void)
      if (!solid(gx + 1, gy)) {
        if ((hash(gx, gy, 47) % 8) === 0) frontEdges.push({ vx: tx + 24, vy: ty + 14 });
        for (let i = 0; i < 16; i++) {
          const x = tx + 16 + i;
          const yEdge = ty + 15 - Math.floor(i / 2);
          const wallH = 16 + (hash(gy, gx, i) % 5);
          const hang = 2 + (hash(gy, i, 3) % 3);
          for (let d = 0; d < wallH; d++) {
            const c = d < hang ? lip[0] : d < hang + 2 ? cliffPal[2] : (d % 4 === 0 ? cliffPal[0] : cliffPal[1]);
            p.set(x, yEdge + d, c);
          }
        }
      }
    }
  }

  // ---- 3. Top tiles (back to front)
  for (let s = 0; s < m.w + m.h; s++) {
    for (let gx = 0; gx < m.w; gx++) {
      const gy = s - gx;
      if (!solid(gx, gy)) continue;
      const tx = ox + (gx - gy) * 16 - 16;
      const ty = oy + (gx + gy) * 8;
      drawTopTile(p, tx, ty, m.cells[gy][gx], gx, gy, waterFrame, grassPal, biome);
    }
  }

  // ---- 4. Hanging vines along genuine front cliff faces
  const vineColor = biome === 'frostfall' ? SNOW : biome === 'mistwood' ? AUTUMN : grassPal;
  for (let i = 0; i < frontEdges.length; i++) {
    const { vx, vy } = frontEdges[i];
    const len = 8 + (i % 4) * 3;
    for (let k = 0; k < len; k++) {
      const sway = Math.round(Math.sin((k + waterFrame) * 0.7) * 0.55);
      p.set(vx + sway, vy + k, k % 2 ? vineColor[1] : vineColor[0]);
      if (k % 3 === 1) p.set(vx + sway - 1, vy + k, vineColor[2]);
    }
  }
  p.outline(OUTLINE, false);

  // Tiny floating pebbles drifting gently below center rock base
  const midRim = colFloorY[Math.min(w - 1, Math.max(0, centerX))] > 0
    ? colFloorY[Math.min(w - 1, Math.max(0, centerX))]
    : oy + (m.w + m.h) * 4;
  for (const [dx, dy, r] of [[-28, cliffDepth - 14, 2.8], [26, cliffDepth - 18, 2.4], [4, cliffDepth - 6, 2.1]] as const) {
    const rx = Math.round(centerX + dx);
    const ry = Math.min(h - 6, Math.round(midRim + dy + (waterFrame === 1 ? 1 : 0)));
    p.blob(rx, ry, r, r * 0.8, CLIFF_COOL, 0.2, dx);
  }
  return { pix: p, ox, oy };
};
