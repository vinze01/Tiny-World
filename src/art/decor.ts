import { Iso, Pix, OUTLINE, noise, ramp, darken, lighten } from './pix';
import { GREEN, STONE, STONE_WARM, WOOD, type SpriteDef } from './nature';

const sprite = (w: number, h: number, ax = w / 2): [Pix, SpriteDef] => {
  const pix = new Pix(w, h);
  return [pix, { pix, ax }];
};

type Pal = readonly number[];
/** Axis-aligned iso box with 3 lit faces (top, left-front, right-front). Light is top-left. */
export const box = (p: Pix, iso: Iso, u0: number, u1: number, v0: number, v1: number, z0: number, z1: number, pal: Pal, grain = 0) => {
  const P = (u: number, v: number, z: number) => iso.p(u, v, z);
  const tex = (base: number, x: number, y: number) => {
    if (!grain) return base;
    return noise(x, y, grain) > 0.82 ? darken(base, 0.15) : base;
  };
  p.poly([P(u0, v1, z1), P(u1, v1, z1), P(u1, v1, z0), P(u0, v1, z0)], (x, y) => tex(pal[2], x, y));
  p.poly([P(u1, v0, z1), P(u1, v1, z1), P(u1, v1, z0), P(u1, v0, z0)], (x, y) => tex(pal[1], x, y));
  p.poly([P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)], (x, y) => tex(pal[3], x, y));
}

export const bench = (rot: 0 | 1 = 0): SpriteDef => {
  const [p, d] = sprite(32, 32);
  const iso = new Iso(16, 16);
  const cx = 16;
  if (rot === 1) {
    box(p, iso, 0.3, 0.36, 0.14, 0.88, 8, 17, WOOD, 7);
    box(p, iso, 0.34, 0.66, 0.16, 0.24, 0, 8, WOOD);
    box(p, iso, 0.34, 0.66, 0.76, 0.84, 0, 8, WOOD);
    box(p, iso, 0.3, 0.7, 0.12, 0.9, 7, 10, WOOD, 7);
    p.outline();
    p.shadow(cx - 2, 24, 13, 4, 60);
    return d;
  }
  // back rest first, then legs, then seat
  box(p, iso, 0.14, 0.88, 0.3, 0.36, 8, 17, WOOD, 7);
  box(p, iso, 0.16, 0.24, 0.34, 0.66, 0, 8, WOOD);
  box(p, iso, 0.76, 0.84, 0.34, 0.66, 0, 8, WOOD);
  box(p, iso, 0.12, 0.9, 0.3, 0.7, 7, 10, WOOD, 7);
  p.outline();
  p.shadow(cx + 2, 24, 13, 4, 60);
  return d;
};

export const fence = (rot: 0 | 1 = 0): SpriteDef => {
  const [p, d] = sprite(32, 32);
  const iso = new Iso(16, 16);
  if (rot === 1) {
    box(p, iso, 0.44, 0.5, 0.06, 0.94, 3, 5, WOOD);
    box(p, iso, 0.44, 0.5, 0.06, 0.94, 8, 10, WOOD);
    for (let i = 0; i < 4; i++) {
      const v = 0.08 + i * 0.25;
      box(p, iso, 0.4, 0.54, v, v + 0.13, 0, 12, ramp(0xf2e6c8));
    }
    p.outline();
    p.shadow(14, 24, 13, 3, 50);
    return d;
  }
  box(p, iso, 0.06, 0.94, 0.44, 0.5, 3, 5, WOOD);
  box(p, iso, 0.06, 0.94, 0.44, 0.5, 8, 10, WOOD);
  for (let i = 0; i < 4; i++) {
    const u = 0.08 + i * 0.25;
    box(p, iso, u, u + 0.13, 0.4, 0.54, 0, 12, ramp(0xf2e6c8));
  }
  p.outline();
  p.shadow(18, 24, 13, 3, 50);
  return d;
};

export const sign = (rot: 0 | 1 = 0): SpriteDef => {
  const [p, d] = sprite(32, 40);
  const iso = new Iso(16, 24);
  box(p, iso, 0.44, 0.56, 0.44, 0.56, 0, 18, WOOD);
  if (rot === 1) {
    box(p, iso, 0.42, 0.58, 0.12, 0.88, 14, 23, ramp(0xd9a35f), 5);
    const [x, y] = iso.p(0.5, 0.88, 18);
    p.poly([[x, y - 5], [x - 4, y - 1], [x, y + 3]], 0xd9a35f);
    const [tx, ty] = iso.p(0.59, 0.5, 18);
    p.set(tx + 4, ty - 1, 0x6a4a2e); p.set(tx + 3, ty, 0x6a4a2e); p.set(tx, ty, 0x6a4a2e); p.set(tx - 3, ty + 1, 0x6a4a2e); p.set(tx - 4, ty + 2, 0x6a4a2e);
    p.outline();
    p.shadow(14, 32, 9, 3, 55);
    return d;
  }
  box(p, iso, 0.12, 0.88, 0.42, 0.58, 14, 23, ramp(0xd9a35f), 5);
  // little arrow tip on the right
  const [x, y] = iso.p(0.88, 0.5, 18);
  p.poly([[x, y - 5], [x + 4, y - 1], [x, y + 3]], 0xd9a35f);
  const [tx, ty] = iso.p(0.5, 0.59, 18);
  p.set(tx - 4, ty - 1, 0x6a4a2e); p.set(tx - 3, ty, 0x6a4a2e); p.set(tx, ty, 0x6a4a2e); p.set(tx + 3, ty + 1, 0x6a4a2e); p.set(tx + 4, ty + 2, 0x6a4a2e);
  p.outline();
  p.shadow(18, 32, 9, 3, 55);
  return d;
};

export const pot = (): SpriteDef => {
  const [p, d] = sprite(28, 32);
  const cx = 14, base = 24;
  const clay = ramp(0xd9764a);
  for (let y = 0; y < 9; y++) {
    const half = 5 - Math.floor(y / 3) * 0.7;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const rel = (x - cx) / half;
      p.set(x, base - 9 + y, y < 2 ? clay[3] : rel < -0.3 ? clay[3] : rel < 0.4 ? clay[2] : clay[1]);
    }
  }
  p.rect(cx - 6, base - 11, 13, 3, clay[2]);
  p.rect(cx - 6, base - 11, 13, 1, clay[3]);
  p.rect(cx - 5, base - 9, 11, 1, clay[0]);
  // soil + flower
  p.rect(cx - 4, base - 12, 9, 2, 0x5a3a2a);
  for (const [dx, h, c] of [[-2, 8, 0xff8fb3], [1, 11, 0xfff6e0], [3, 7, 0xffd84a]] as const) {
    for (let y = 0; y < h; y++) p.set(cx + dx, base - 12 - y, 0x4a9a42);
    const ty = base - 12 - h;
    p.set(cx + dx, ty, 0xffe9a0);
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) p.set(cx + dx + ox, ty + oy, c);
  }
  p.set(cx - 3, base - 8, 0x6a8a4a);
  p.outline();
  p.shadow(cx + 2, base, 9, 3, 55);
  return d;
}

export const birdhouse = (rot: 0 | 1 = 0): SpriteDef => {
  const [p, d] = sprite(32, 48);
  const iso = new Iso(16, 32);
  box(p, iso, 0.46, 0.54, 0.46, 0.54, 0, 20, WOOD);
  box(p, iso, 0.22, 0.78, 0.22, 0.78, 20, 31, ramp(0xe9d6a8), 9);
  // roof: pyramid
  const apex = iso.p(0.5, 0.5, 42);
  const a = iso.p(0.15, 0.85, 31), b = iso.p(0.85, 0.85, 31), c = iso.p(0.85, 0.15, 31);
  p.poly([apex, a, b], ramp(0xc8553d)[2]);
  p.poly([apex, b, c], ramp(0xc8553d)[1]);
  if (rot === 1) {
    const [hx, hy] = iso.p(0.78, 0.5, 25);
    p.ellipse(hx + 1, hy, 2.5, 2.8, 0x3a2a30);
    p.rect(hx - 1, hy + 3, 4, 1, WOOD[3]);
    p.outline();
    p.shadow(14, 40, 8, 3, 55);
    return d;
  }
  const [hx, hy] = iso.p(0.5, 0.78, 25);
  p.ellipse(hx - 1, hy, 2.5, 2.8, 0x3a2a30);
  p.rect(hx - 2, hy + 3, 4, 1, WOOD[3]);
  p.outline();
  p.shadow(18, 40, 8, 3, 55);
  return d;
};

export const lantern = (): SpriteDef => {
  const [p, d] = sprite(28, 52);
  const cx = 14, base = 44;
  const iron = ramp(0x4a4458);
  p.rect(cx - 1, base - 26, 3, 26, iron[2]);
  p.rect(cx - 1, base - 26, 1, 26, iron[3]);
  p.rect(cx - 3, base - 2, 7, 2, iron[1]);
  p.rect(cx - 4, base - 30, 9, 2, iron[1]);
  // glass lamp
  p.rect(cx - 3, base - 38, 7, 8, 0xffe08a);
  p.rect(cx - 2, base - 37, 3, 6, 0xfff6c8);
  p.rect(cx + 2, base - 38, 2, 8, 0xf3b84a);
  p.rect(cx - 4, base - 40, 9, 2, iron[1]);
  p.poly([[cx - 3, base - 40], [cx + 4, base - 40], [cx + 1, base - 44], [cx, base - 44]], iron[2]);
  p.set(cx, base - 45, iron[3]);
  p.outline();
  p.shadow(cx + 2, base, 7, 3, 55);
  return d;
}

export const campfireBase = (): SpriteDef => {
  const [p, d] = sprite(36, 28);
  const cx = 18, base = 20;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = cx + Math.cos(a) * 10, y = base - 3 + Math.sin(a) * 5;
    p.blob(x, y, 3.2, 2.6, i % 2 ? STONE : STONE_WARM, 0.2, 90 + i);
  }
  p.ellipse(cx, base - 3, 7, 3.5, 0x3a2a30);
  // crossed logs
  p.line(cx - 6, base - 2, cx + 5, base - 6, WOOD[2]);
  p.line(cx - 6, base - 3, cx + 5, base - 7, WOOD[3]);
  p.line(cx + 6, base - 2, cx - 5, base - 6, WOOD[1]);
  p.line(cx + 6, base - 3, cx - 5, base - 7, WOOD[2]);
  p.outline();
  p.shadow(cx + 3, base + 1, 14, 4, 60);
  return d;
}

/** two animated flame frames drawn above the campfire */
export const campfireFlame = (frame: number): SpriteDef => {
  const [p, d] = sprite(14, 18);
  const cx = 7;
  const h = frame ? 13 : 15;
  const wob = frame ? 1 : -1;
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const half = Math.max(0, Math.round(5 * Math.sin(Math.PI * (0.15 + t * 0.85)) * (1 - t * 0.5)));
    for (let x = -half; x <= half; x++) {
      const yy = 17 - y;
      const xx = cx + x + Math.round(wob * t * 1.5);
      const core = Math.abs(x) <= half * 0.45 && t < 0.6;
      p.set(xx, yy, core ? 0xfff2a8 : t < 0.5 ? 0xffb43a : 0xf0642a);
    }
  }
  return d;
}

export const path = (): SpriteDef => {
  const [p, d] = sprite(32, 16);
  const cobble = [0xe9d3a8, 0xdcc294, 0xc9ab7c];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      const e = Math.abs(x + 0.5 - 16) / 16 + Math.abs(y + 0.5 - 8) / 8;
      if (e > 0.96) continue;
      const cx = Math.floor(x / 5), cy = Math.floor((y + (cx % 2) * 2) / 4);
      const lx = x - cx * 5, ly = (y + (cx % 2) * 2) - cy * 4;
      const edge = lx === 0 || ly === 0 || (e > 0.84 && noise(x, y, 2) > 0.45);
      if (edge) { if (noise(x, y, 4) > 0.5) p.set(x, y, 0x7fa84a); else p.set(x, y, 0xb8996c); continue; }
      const n = noise(cx, cy, 11);
      p.set(x, y, n > 0.66 ? cobble[0] : n > 0.3 ? cobble[1] : cobble[2]);
    }
  }
  return d;
}

export const bridge = (rot: 0 | 1 = 0): SpriteDef => {
  const [p, d] = sprite(32, 32);
  const iso = new Iso(16, 16);
  if (rot === 1) {
    // Planks run along v (gy axis)
    p.poly([iso.p(0, 0, 1), iso.p(1, 0, 1), iso.p(1, 1, 1), iso.p(0, 1, 1)], (x, y) => {
      const v = (-(x - 16 + 0.5) / 16 + (y - 16 + 0.5 - -1) / 8) / 2;
      const idx = Math.floor(v * 7);
      const gap = Math.abs(v * 7 - Math.round(v * 7)) < 0.07;
      if (gap) return WOOD[0];
      return idx % 2 ? WOOD[3] : WOOD[2];
    });
    box(p, iso, 0.9, 1, 0, 1, 0, 1, WOOD);
    // rails along v
    box(p, iso, 0.04, 0.12, 0.02, 0.14, 1, 9, WOOD);
    box(p, iso, 0.04, 0.12, 0.86, 0.98, 1, 9, WOOD);
    box(p, iso, 0.04, 0.1, 0.02, 0.98, 6, 8, WOOD);
    box(p, iso, 0.88, 0.96, 0.02, 0.14, 1, 9, WOOD);
    box(p, iso, 0.88, 0.96, 0.86, 0.98, 1, 9, WOOD);
    box(p, iso, 0.88, 0.94, 0.02, 0.98, 6, 8, WOOD);
    p.outline();
    return d;
  }
  // Planks run along u (gx axis)
  p.poly([iso.p(0, 0, 1), iso.p(1, 0, 1), iso.p(1, 1, 1), iso.p(0, 1, 1)], (x, y) => {
    const u = ((x - 16 + 0.5) / 16 + (y - 16 + 0.5 - -1) / 8) / 2;
    const idx = Math.floor(u * 7);
    const gap = Math.abs(u * 7 - Math.round(u * 7)) < 0.07;
    if (gap) return WOOD[0];
    return idx % 2 ? WOOD[3] : WOOD[2];
  });
  box(p, iso, 0, 1, 0.9, 1, 0, 1, WOOD);
  // rails along u
  box(p, iso, 0.02, 0.14, 0.04, 0.12, 1, 9, WOOD);
  box(p, iso, 0.86, 0.98, 0.04, 0.12, 1, 9, WOOD);
  box(p, iso, 0.02, 0.98, 0.04, 0.1, 6, 8, WOOD);
  box(p, iso, 0.02, 0.14, 0.88, 0.96, 1, 9, WOOD);
  box(p, iso, 0.86, 0.98, 0.88, 0.96, 1, 9, WOOD);
  box(p, iso, 0.02, 0.98, 0.88, 0.94, 6, 8, WOOD);
  p.outline();
  return d;
};

const MARBLE = ramp(0xe4eaf0);
const BRASS = ramp(0xf0c850);
const IRON_DARK = ramp(0x383244);

export const stoneBench = (rot: 0 | 1 = 0): SpriteDef => {
  const [p, d] = sprite(32, 32);
  const iso = new Iso(16, 16);
  const cx = 16;
  if (rot === 1) {
    box(p, iso, 0.28, 0.38, 0.12, 0.88, 8, 18, MARBLE, 5);
    box(p, iso, 0.3, 0.7, 0.15, 0.27, 0, 8, MARBLE);
    box(p, iso, 0.3, 0.7, 0.73, 0.85, 0, 8, MARBLE);
    box(p, iso, 0.26, 0.74, 0.1, 0.9, 7, 11, MARBLE, 5);
    p.outline();
    p.shadow(cx - 2, 24, 13, 4, 60);
    return d;
  }
  box(p, iso, 0.12, 0.88, 0.28, 0.38, 8, 18, MARBLE, 5);
  box(p, iso, 0.15, 0.27, 0.3, 0.7, 0, 8, MARBLE);
  box(p, iso, 0.73, 0.85, 0.3, 0.7, 0, 8, MARBLE);
  box(p, iso, 0.1, 0.9, 0.26, 0.74, 7, 11, MARBLE, 5);
  p.outline();
  p.shadow(cx + 2, 24, 13, 4, 60);
  return d;
};

export const picnicTable = (rot: 0 | 1 = 0): SpriteDef => {
  if (rot === 1) {
    // 1x2 footprint: w=1, d=2
    const w = 1, d = 2;
    const pad = 8;
    const W = (w + d) * 16 + pad * 2; // 3 * 16 + 16 = 64
    const Hc = (w + d) * 8 + 36; // 24 + 36 = 60
    const p = new Pix(W, Hc);
    const ox = pad + d * 16; // 8 + 32 = 40
    const oy = Hc - (w + d) * 8; // 36
    const iso = new Iso(ox, oy);

    // Benches on left and right of table along v axis
    box(p, iso, 0.08, 0.26, 0.15, 1.85, 0, 6, WOOD);
    box(p, iso, 0.74, 0.92, 0.15, 1.85, 0, 6, WOOD);

    // Table legs and tabletop
    box(p, iso, 0.34, 0.66, 0.25, 0.38, 0, 11, WOOD);
    box(p, iso, 0.34, 0.66, 1.62, 1.75, 0, 11, WOOD);
    // Tabletop
    box(p, iso, 0.25, 0.75, 0.1, 1.9, 10, 13, WOOD);
    // Gingham cloth on table top
    const [c0, c1, c2, c3] = [iso.p(0.27, 0.12, 13.5), iso.p(0.73, 0.12, 13.5), iso.p(0.73, 1.88, 13.5), iso.p(0.27, 1.88, 13.5)];
    p.poly([c0, c1, c2, c3], (x, y) => {
      const red = 0xe84a5a;
      const pink = 0xffa4b4;
      const white = 0xffffff;
      const gx = Math.floor(x / 3) % 2;
      const gy = Math.floor(y / 3) % 2;
      if (gx === 0 && gy === 0) return red;
      if (gx === 1 && gy === 1) return white;
      return pink;
    });

    p.outline();
    p.shadow(ox - 8, oy + 18, 28, 8, 55);
    return { pix: p, ax: ox + (w - d) * 16 };
  }

  // 2x1 footprint: w=2, d=1
  const w = 2, d = 1;
  const pad = 8;
  const W = (w + d) * 16 + pad * 2;
  const Hc = (w + d) * 8 + 36;
  const p = new Pix(W, Hc);
  const ox = pad + d * 16;
  const oy = Hc - (w + d) * 8;
  const iso = new Iso(ox, oy);

  // Benches on front and back of table along u axis
  box(p, iso, 0.15, 1.85, 0.08, 0.26, 0, 6, WOOD);
  box(p, iso, 0.15, 1.85, 0.74, 0.92, 0, 6, WOOD);

  // Table legs and tabletop
  box(p, iso, 0.25, 0.38, 0.34, 0.66, 0, 11, WOOD);
  box(p, iso, 1.62, 1.75, 0.34, 0.66, 0, 11, WOOD);
  // Tabletop
  box(p, iso, 0.1, 1.9, 0.25, 0.75, 10, 13, WOOD);
  // Gingham cloth
  const [c0, c1, c2, c3] = [iso.p(0.12, 0.27, 13.5), iso.p(1.88, 0.27, 13.5), iso.p(1.88, 0.73, 13.5), iso.p(0.12, 0.73, 13.5)];
  p.poly([c0, c1, c2, c3], (x, y) => {
    const red = 0xe84a5a;
    const pink = 0xffa4b4;
    const white = 0xffffff;
    const gx = Math.floor(x / 3) % 2;
    const gy = Math.floor(y / 3) % 2;
    if (gx === 0 && gy === 0) return red;
    if (gx === 1 && gy === 1) return white;
    return pink;
  });

  p.outline();
  p.shadow(ox + 8, oy + 18, 28, 8, 55);
  return { pix: p, ax: ox + 16 };
};

export const gazingGlobe = (): SpriteDef => {
  const [p, d] = sprite(32, 42);
  const cx = 16, base = 34;
  // Carved stone pedestal
  box(p, new Iso(cx, base), 0.2, 0.8, 0.2, 0.8, 0, 5, MARBLE);
  box(p, new Iso(cx, base), 0.32, 0.68, 0.32, 0.68, 5, 16, MARBLE);
  box(p, new Iso(cx, base), 0.15, 0.85, 0.15, 0.85, 16, 20, MARBLE);

  // Basin rim and water reflecting celestial starlight
  const [bx, by] = new Iso(cx, base).p(0.5, 0.5, 20);
  p.ellipse(bx, by, 7.5, 4.5, MARBLE[2]);
  p.ellipse(bx, by, 6, 3.5, 0x1d3557);
  // water shimmer / stars in reflection
  p.set(bx - 2, by - 1, 0x8ecae6);
  p.set(bx + 1, by + 1, 0x8ecae6);
  p.set(bx - 1, by + 1, 0xffffff);
  p.set(bx + 2, by - 1, 0xffd166);

  p.outline();
  p.shadow(cx + 2, base + 2, 11, 4, 60);
  return d;
};

export const gazebo = (rot: 0 | 1 = 0): SpriteDef => {
  const [p, d] = sprite(36, 48);
  const iso = new Iso(18, 36);
  // 4 wooden trellis corner pillars
  box(p, iso, 0.1, 0.22, 0.1, 0.22, 0, 24, WOOD);
  box(p, iso, 0.78, 0.9, 0.1, 0.22, 0, 24, WOOD);
  box(p, iso, 0.1, 0.22, 0.78, 0.9, 0, 24, WOOD);
  box(p, iso, 0.78, 0.9, 0.78, 0.9, 0, 24, WOOD);

  // Trellis lattice roof rails
  box(p, iso, 0.05, 0.95, 0.08, 0.24, 22, 25, WOOD);
  box(p, iso, 0.05, 0.95, 0.76, 0.92, 22, 25, WOOD);
  box(p, iso, 0.08, 0.24, 0.05, 0.95, 22, 25, WOOD);
  box(p, iso, 0.76, 0.92, 0.05, 0.95, 22, 25, WOOD);

  // Arch roof canopy with leafy vines and pink roses
  for (let z = 24; z <= 29; z += 2) {
    for (let u = 0.15; u <= 0.85; u += 0.22) {
      for (let v = 0.15; v <= 0.85; v += 0.22) {
        const [x, y] = iso.p(u, v, z);
        p.blob(x, y, 3, 2.5, GREEN, 0.15, Math.floor(u * 10 + v * 5));
        if ((Math.floor(u * 10 + v * 7) % 3) === 0) {
          p.set(x, y - 1, 0xff8fb3);
          p.set(x + 1, y, 0xff6b8b);
          p.set(x, y, 0xfff6a8);
        }
      }
    }
  }

  p.outline();
  p.shadow(20, 38, 14, 5, 55);
  return d;
};

export const stargazer = (): SpriteDef => {
  const [p, d] = sprite(32, 44);
  const cx = 16, base = 36;
  const iso = new Iso(cx, base);
  // Tripod legs
  const center = iso.p(0.5, 0.5, 16);
  const leg1 = iso.p(0.2, 0.8, 0);
  const leg2 = iso.p(0.8, 0.8, 0);
  const leg3 = iso.p(0.5, 0.2, 0);
  p.line(center[0], center[1], leg1[0], leg1[1], WOOD[2]);
  p.line(center[0], center[1], leg2[0], leg2[1], WOOD[1]);
  p.line(center[0], center[1], leg3[0], leg3[1], WOOD[3]);

  // Brass mount and telescope tube angled up towards upper-left
  p.ellipse(center[0], center[1], 2.5, 2.5, BRASS[2]);
  p.line(center[0] + 5, center[1] + 3, center[0] - 8, center[1] - 12, BRASS[1]);
  p.line(center[0] + 4, center[1] + 2, center[0] - 9, center[1] - 13, BRASS[3]);
  p.line(center[0] + 5, center[1] + 2, center[0] - 8, center[1] - 13, BRASS[2]);
  // Eyepiece and lens
  p.ellipse(center[0] + 6, center[1] + 4, 1.5, 1.5, BRASS[0]);
  p.ellipse(center[0] - 9, center[1] - 13, 2.5, 2.5, 0x88ccff);

  p.outline();
  p.shadow(cx + 2, base, 10, 4, 55);
  return d;
};

export const torches = (): SpriteDef => {
  const [p, d] = sprite(28, 44);
  const cx = 14, base = 38;
  // Bamboo shaft
  p.rect(cx - 1, base - 22, 3, 22, 0xb89248);
  p.rect(cx - 1, base - 22, 1, 22, 0xd4b068);
  p.set(cx - 2, base - 16, 0x8a6428); p.set(cx + 2, base - 16, 0x8a6428);
  p.set(cx - 2, base - 8, 0x8a6428); p.set(cx + 2, base - 8, 0x8a6428);
  // Basket top holding burning oil/pitch
  p.rect(cx - 3, base - 25, 7, 4, 0x5a4228);
  p.rect(cx - 4, base - 26, 9, 2, 0x3a2818);
  // Crackling flame
  p.blob(cx, base - 31, 3.5, 4.5, ramp(0xff6a28), 0.1, 88);
  p.blob(cx, base - 31, 2, 2.5, ramp(0xffe868), 0.1, 89);
  p.set(cx, base - 33, 0xfffcf0);

  p.outline();
  p.shadow(cx + 1, base, 6, 2.5, 55);
  return d;
};

export const fairyLights = (): SpriteDef => {
  const [p, d] = sprite(32, 50);
  const cx = 16, base = 42;
  // Dark wrought-iron curved garden shepherd's hook
  p.rect(cx - 1, base - 32, 2, 32, IRON_DARK[2]);
  p.rect(cx - 1, base - 32, 1, 32, IRON_DARK[3]);
  p.rect(cx - 3, base - 2, 6, 2, IRON_DARK[1]);
  // Curved arm
  p.line(cx, base - 32, cx + 5, base - 35, IRON_DARK[2]);
  p.line(cx + 5, base - 35, cx + 8, base - 33, IRON_DARK[2]);
  p.line(cx, base - 32, cx - 5, base - 34, IRON_DARK[2]);

  // Glass hanging lanterns with glowing fireflies
  const drawJar = (jx: number, jy: number, col: number) => {
    p.line(jx, jy - 3, jx, jy, IRON_DARK[1]);
    p.rect(jx - 2, jy, 5, 6, 0xd8f0ff);
    p.rect(jx - 1, jy + 1, 3, 4, col);
    p.set(jx, jy + 2, 0xffffff);
  };
  drawJar(cx + 8, base - 30, 0xffea78);
  drawJar(cx - 5, base - 31, 0x78f0d8);

  p.outline();
  p.shadow(cx + 2, base, 7, 3, 55);
  return d;
};

export const celestialLamp = (): SpriteDef => {
  const [p, d] = sprite(30, 52);
  const cx = 15, base = 44;
  // Ornate golden pedestal and pillar
  p.rect(cx - 4, base - 3, 9, 3, BRASS[1]);
  p.rect(cx - 3, base - 2, 7, 2, BRASS[2]);
  p.rect(cx - 1, base - 26, 3, 24, BRASS[2]);
  p.rect(cx - 1, base - 26, 1, 24, BRASS[3]);
  // Golden bowl capital
  p.rect(cx - 4, base - 28, 9, 3, BRASS[2]);
  p.rect(cx - 5, base - 30, 11, 2, BRASS[3]);

  // Floating radiant celestial orb
  p.blob(cx, base - 38, 5, 5, ramp(0xffe860), 0.1, 77);
  p.ellipse(cx - 1, base - 39, 2.5, 2.5, 0xffffff);
  // Ring of stardust
  p.ellipse(cx, base - 38, 7.5, 2.5, 0xffffff);
  p.set(cx - 6, base - 38, 0xffea78);
  p.set(cx + 6, base - 38, 0xffea78);

  p.outline();
  p.shadow(cx + 2, base, 8, 3, 55);
  return d;
};

export const steppingStones = (): SpriteDef => {
  const [p, d] = sprite(32, 16);
  // Three smooth river stones set slightly above water surface
  p.blob(9, 6, 4.5, 3, STONE_WARM, 0.15, 12);
  p.blob(19, 10, 5, 3.2, STONE, 0.15, 14);
  p.blob(23, 5, 3.5, 2.4, STONE_WARM, 0.15, 16);
  // Ripples around stones
  p.ellipse(9, 8, 6, 2.5, 0x82c8e6);
  p.ellipse(19, 12, 6.5, 2.5, 0x82c8e6);
  p.outline();
  return d;
};

export const mosaicPath = (): SpriteDef => {
  const [p, d] = sprite(32, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      const e = Math.abs(x + 0.5 - 16) / 16 + Math.abs(y + 0.5 - 8) / 8;
      if (e > 0.96) continue;
      // Diamond star mosaic
      const u = (x - 16) / 16 + (y - 8) / 8;
      const v = -(x - 16) / 16 + (y - 8) / 8;
      const star = Math.abs(u) + Math.abs(v);
      if (star < 0.28) {
        p.set(x, y, 0xfff6e0); // Pearl center star
      } else if (star < 0.55) {
        p.set(x, y, 0x4169e1); // Royal lapis blue
      } else if (star < 0.75) {
        p.set(x, y, 0x70a5e8); // Sky blue
      } else {
        p.set(x, y, (x + y) % 2 === 0 ? 0xeae6df : 0xd8d4cc); // Ivory marble border
      }
    }
  }
  return d;
};

export const windchime = (): SpriteDef => {
  const [p, d] = sprite(28, 44);
  const cx = 14, base = 36;
  // Wooden top hanger
  p.rect(cx - 6, base - 30, 13, 2, WOOD[2]);
  p.line(cx, base - 34, cx, base - 30, 0x4a4458);
  // Hanging bamboo tubes of varying lengths
  const lengths = [14, 18, 12, 16, 10];
  for (let i = 0; i < 5; i++) {
    const x = cx - 4 + i * 2;
    const len = lengths[i];
    p.line(x, base - 28, x, base - 28 + len, i % 2 ? 0xd4b068 : 0xb89248);
    p.set(x, base - 28 + len, 0x8a6428);
  }
  // Wind catcher paddle dangling at bottom
  p.line(cx, base - 10, cx, base - 4, 0x4a4458);
  p.rect(cx - 2, base - 4, 5, 6, 0xc8553d);

  p.outline();
  p.shadow(cx + 1, base + 2, 7, 2.5, 45);
  return d;
};

export const zenGarden = (): SpriteDef => {
  const [p, d] = sprite(32, 16);
  const sand = [0xf5edd6, 0xe8ddc2, 0xd4c7a6];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      const e = Math.abs(x + 0.5 - 16) / 16 + Math.abs(y + 0.5 - 8) / 8;
      if (e > 0.96) continue;
      // Raked ripple rings in sand
      const dist = Math.hypot(x - 16, (y - 8) * 2);
      const ring = Math.floor(dist) % 3;
      p.set(x, y, sand[ring]);
    }
  }
  // Placed zen stones with sand shadow
  p.blob(16, 8, 3.5, 2.2, STONE, 0.1, 41);
  p.blob(12, 10, 2.4, 1.8, STONE_WARM, 0.1, 42);
  p.outline();
  return d;
};

export const mailbox = (rot: 0 | 1 = 0): SpriteDef => {
  const [p, d] = sprite(26, 34);
  const cx = 13, base = 26;
  p.rect(cx - 1, base - 14, 3, 14, WOOD[1]);
  p.rect(cx - 1, base - 14, 1, 14, WOOD[2]);
  const boxPal = ramp(0x5288d8);
  const dx = rot === 1 ? -2 : 2;
  p.rect(cx - 5 + dx, base - 20, 9, 7, boxPal[2]);
  p.rect(cx - 5 + dx, base - 21, 9, 2, boxPal[3]);
  p.rect(cx + (rot === 1 ? -4 : 3), base - 18, 2, 4, 0xfef08a);
  p.rect(cx + (rot === 1 ? 3 : -4), base - 22, 1, 4, 0xe84a6a);
  p.outline();
  p.shadow(cx + 1, base, 6, 2.5, 45);
  return d;
};

export const teaSet = (rot: 0 | 1 = 0): SpriteDef => {
  const [p, d] = sprite(32, 32);
  const iso = new Iso(16, 16);
  box(p, iso, 0.35, 0.65, 0.35, 0.65, 0, 8, WOOD);
  box(p, iso, 0.2, 0.8, 0.2, 0.8, 8, 10, MARBLE);
  const [tx, ty] = iso.p(0.5, 0.5, 10);
  p.ellipse(tx + (rot ? 1 : -1), ty - 1, 3, 2.5, 0xf472b6);
  p.set(tx + (rot ? -3 : 3), ty + 1, 0xffffff);
  p.set(tx, ty + 2, 0xfff6e0);
  p.outline();
  p.shadow(17, 24, 9, 3.5, 50);
  return d;
};

export const well = (rot: 0 | 1 = 0): SpriteDef => {
  const [p, d] = sprite(34, 46);
  const iso = new Iso(17, 30);
  box(p, iso, 0.2, 0.8, 0.2, 0.8, 0, 9, STONE);
  const [wx, wy] = iso.p(0.5, 0.5, 9);
  p.ellipse(wx, wy, 6, 3.2, 0x38bdf8);
  const posts: [number, number][] = rot === 1 ? [[0.5, 0.22], [0.5, 0.78]] : [[0.22, 0.5], [0.78, 0.5]];
  for (const [u, v] of posts) box(p, iso, u - 0.05, u + 0.05, v - 0.05, v + 0.05, 9, 21, WOOD);
  box(p, iso, 0.14, 0.86, 0.14, 0.86, 20, 26, ramp(0xc8553d));
  p.outline();
  p.shadow(18, 38, 12, 4, 55);
  return d;
};

export const hammock = (rot: 0 | 1 = 0): SpriteDef => {
  const w = rot === 1 ? 1 : 2, d = rot === 1 ? 2 : 1;
  const pad = 8;
  const W = (w + d) * 16 + pad * 2;
  const Hc = (w + d) * 8 + 34;
  const p = new Pix(W, Hc);
  const ox = pad + d * 16;
  const oy = Hc - (w + d) * 8;
  const iso = new Iso(ox, oy);
  if (rot === 1) {
    box(p, iso, 0.42, 0.58, 0.12, 0.26, 0, 18, WOOD);
    box(p, iso, 0.42, 0.58, 1.74, 1.88, 0, 18, WOOD);
    const a = iso.p(0.5, 0.22, 16), b = iso.p(0.5, 1.78, 16);
    p.poly([a, b, [b[0] + 4, b[1] + 5], [a[0] - 4, a[1] + 5]], 0xfbcfe8);
    p.line(a[0], a[1], b[0], b[1], 0xf472b6);
  } else {
    box(p, iso, 0.12, 0.26, 0.42, 0.58, 0, 18, WOOD);
    box(p, iso, 1.74, 1.88, 0.42, 0.58, 0, 18, WOOD);
    const a = iso.p(0.22, 0.5, 16), b = iso.p(1.78, 0.5, 16);
    p.poly([a, b, [b[0] - 4, b[1] + 5], [a[0] + 4, a[1] + 5]], 0xfbcfe8);
    p.line(a[0], a[1], b[0], b[1], 0xf472b6);
  }
  p.outline();
  p.shadow(ox + (w - d) * 8, oy + 16, 26, 7, 50);
  return { pix: p, ax: ox + (w - d) * 16 };
};

export const hotCocoa = (rot: 0 | 1 = 0): SpriteDef => {
  const [p, d] = sprite(34, 46);
  const iso = new Iso(17, 30);
  box(p, iso, 0.15, 0.85, 0.15, 0.85, 0, 10, WOOD);
  box(p, iso, 0.18, 0.28, 0.18, 0.28, 10, 22, WOOD);
  box(p, iso, 0.72, 0.82, 0.18, 0.28, 10, 22, WOOD);
  const [mx, my] = iso.p(rot ? 0.35 : 0.65, 0.55, 10);
  p.rect(mx - 2, my - 3, 4, 3, 0xfff6e0);
  p.set(mx, my - 5, 0xe2e8f0);
  box(p, iso, 0.1, 0.9, 0.1, 0.9, 21, 26, ramp(0xdc2626));
  p.outline();
  p.shadow(18, 38, 12, 4, 55);
  return d;
};

export const mossStatue = (rot: 0 | 1 = 0): SpriteDef => {
  const [p, d] = sprite(32, 42);
  const cx = 16, base = 34;
  box(p, new Iso(cx, base), 0.22, 0.78, 0.22, 0.78, 0, 6, STONE);
  p.blob(cx, base - 14, 7, 6.5, STONE, 0.12, 71);
  p.blob(cx - 2, base - 19, 4, 2.5, GREEN, 0.2, 72);
  const ex = rot === 1 ? cx - 2 : cx + 2;
  p.set(ex - 2, base - 14, OUTLINE);
  p.set(ex + 1, base - 14, OUTLINE);
  p.outline();
  p.shadow(cx + 1, base + 1, 9, 3, 55);
  return d;
};

export const hotTub = (rot: 0 | 1 = 0): SpriteDef => {
  const w = rot === 1 ? 1 : 2, d = rot === 1 ? 2 : 1;
  const pad = 8;
  const W = (w + d) * 16 + pad * 2;
  const Hc = (w + d) * 8 + 30;
  const p = new Pix(W, Hc);
  const ox = pad + d * 16;
  const oy = Hc - (w + d) * 8;
  const iso = new Iso(ox, oy);
  const uMax = rot === 1 ? 0.9 : 1.9;
  const vMax = rot === 1 ? 1.9 : 0.9;
  box(p, iso, 0.1, uMax, 0.1, vMax, 0, 11, WOOD, 7);
  p.poly([iso.p(0.22, 0.22, 11), iso.p(uMax - 0.12, 0.22, 11), iso.p(uMax - 0.12, vMax - 0.12, 11), iso.p(0.22, vMax - 0.12, 11)], 0x38bdf8);
  const c = iso.p(uMax / 2, vMax / 2, 13);
  p.set(c[0] - 4, c[1] - 4, 0xffffff);
  p.set(c[0] + 4, c[1] - 6, 0xe0f2fe);
  p.outline();
  p.shadow(ox + (w - d) * 8, oy + 16, 26, 7, 55);
  return { pix: p, ax: ox + (w - d) * 16 };
};

export const starDial = (rot: 0 | 1 = 0): SpriteDef => {
  const [p, d] = sprite(32, 44);
  const cx = 16, base = 36;
  box(p, new Iso(cx, base), 0.24, 0.76, 0.24, 0.76, 0, 12, MARBLE);
  const cy = base - 20;
  p.ellipse(cx, cy, 6, 6, BRASS[2]);
  p.ellipse(cx, cy, 4, 4, 0x1e1b4b);
  p.line(cx + (rot ? 4 : -4), cy - 4, cx + (rot ? -4 : 4), cy + 4, BRASS[3]);
  p.set(cx, cy, 0xffffff);
  p.outline();
  p.shadow(cx + 1, base, 9, 3.5, 50);
  return d;
};

export const harmonyFountain = (_rot: 0 | 1 = 0): SpriteDef => {
  const w = 2, d = 2, pad = 10;
  const W = (w + d) * 16 + pad * 2;
  const Hc = (w + d) * 8 + 42;
  const p = new Pix(W, Hc);
  const ox = pad + d * 16;
  const oy = Hc - (w + d) * 8;
  const iso = new Iso(ox, oy);
  box(p, iso, 0.15, 1.85, 0.15, 1.85, 0, 7, MARBLE);
  p.poly([iso.p(0.28, 0.28, 7), iso.p(1.72, 0.28, 7), iso.p(1.72, 1.72, 7), iso.p(0.28, 1.72, 7)], 0x38bdf8);
  box(p, iso, 0.72, 1.28, 0.72, 1.28, 7, 17, MARBLE);
  const [tx, ty] = iso.p(1, 1, 17);
  p.ellipse(tx, ty - 2, 7, 4, MARBLE[3]);
  p.ellipse(tx, ty - 6, 3, 5, 0xbae6fd);
  p.set(tx, ty - 11, 0xffffff);
  p.outline();
  p.shadow(ox, oy + 20, 32, 11, 55);
  return { pix: p, ax: ox };
};

export const iceLantern = (): SpriteDef => {
  const [p, d] = sprite(26, 36);
  const cx = 13, base = 30;
  const ice = [0x38bdf8, 0x7dd3fc, 0xbae6fd, 0xffffff];
  p.rect(cx - 3, base - 4, 7, 4, ice[1]);
  p.rect(cx - 1, base - 14, 3, 10, ice[2]);
  p.rect(cx - 3, base - 21, 7, 7, 0x7dd3fc);
  p.rect(cx - 2, base - 20, 5, 5, 0xe0f2fe);
  p.poly([[cx - 4, base - 21], [cx + 4, base - 21], [cx, base - 26]], ice[3]);
  p.outline();
  p.shadow(cx + 1, base, 6, 2.5, 45);
  return d;
};

export const willowWispLamp = (): SpriteDef => {
  const [p, d] = sprite(26, 38);
  const cx = 13, base = 31;
  box(p, new Iso(cx, base), 0.3, 0.7, 0.3, 0.7, 0, 12, STONE);
  p.ellipse(cx, base - 16, 4.5, 4.5, 0x34d399);
  p.ellipse(cx, base - 16, 2.5, 2.5, 0xd1fae5);
  p.set(cx - 1, base - 17, 0xffffff);
  p.outline();
  p.shadow(cx + 1, base, 6, 2.5, 45);
  return d;
};

export const emberBrazier = (): SpriteDef => {
  const [p, d] = sprite(28, 34);
  const cx = 14, base = 28;
  const iron = ramp(0x57534e);
  p.rect(cx - 4, base - 6, 9, 5, iron[1]);
  p.ellipse(cx, base - 7, 6, 3, iron[2]);
  p.ellipse(cx, base - 9, 4.5, 4.5, 0xf97316);
  p.ellipse(cx, base - 10, 2.5, 3, 0xfef08a);
  p.outline();
  p.shadow(cx + 1, base, 8, 3, 50);
  return d;
};

export const nebulaOrb = (): SpriteDef => {
  const [p, d] = sprite(28, 42);
  const cx = 14, base = 35;
  p.rect(cx - 1, base - 18, 3, 18, BRASS[1]);
  p.ellipse(cx, base - 23, 5.5, 5.5, 0x8b5cf6);
  p.ellipse(cx - 1, base - 24, 3, 3, 0xf0abfc);
  p.set(cx - 2, base - 25, 0xffffff);
  p.outline();
  p.shadow(cx + 1, base, 7, 2.5, 45);
  return d;
};

export const auroraBeacon = (): SpriteDef => {
  const [p, d] = sprite(30, 48);
  const cx = 15, base = 40;
  box(p, new Iso(cx, base), 0.22, 0.78, 0.22, 0.78, 0, 7, MARBLE);
  p.poly([[cx - 4, base - 7], [cx - 2, base - 30], [cx, base - 35], [cx + 2, base - 30], [cx + 4, base - 7]], 0x67e8f9);
  p.poly([[cx, base - 35], [cx + 2, base - 30], [cx + 4, base - 7], [cx, base - 7]], 0xc084fc);
  p.set(cx, base - 32, 0xffffff);
  p.outline();
  p.shadow(cx + 1, base, 9, 3, 45);
  return d;
};

export const woodDeck = (rot: 0 | 1 = 0): SpriteDef => {
  const [p, d] = sprite(32, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      const e = Math.abs(x + 0.5 - 16) / 16 + Math.abs(y + 0.5 - 8) / 8;
      if (e > 0.96) continue;
      const u = rot === 1 ? y : Math.floor((x + y * 2) / 4);
      p.set(x, y, u % 2 === 0 ? WOOD[2] : WOOD[1]);
    }
  }
  p.outline(OUTLINE, false);
  return d;
};

export const petalPath = (): SpriteDef => {
  const [p, d] = sprite(32, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      const e = Math.abs(x + 0.5 - 16) / 16 + Math.abs(y + 0.5 - 8) / 8;
      if (e > 0.92) continue;
      p.set(x, y, (x + y) % 5 === 0 ? 0xfbcfe8 : e > 0.7 ? 0xd6d3d1 : 0xf5f5f4);
    }
  }
  return d;
};

export const lilyStepping = (): SpriteDef => {
  const [p, d] = sprite(32, 16);
  p.ellipse(11, 7, 5.5, 3, GREEN[2]);
  p.ellipse(21, 9, 5, 2.8, GREEN[1]);
  p.set(11, 6, 0xf472b6);
  p.set(21, 8, 0xfef08a);
  p.outline();
  return d;
};

export const frostPaving = (): SpriteDef => {
  const [p, d] = sprite(32, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      const e = Math.abs(x + 0.5 - 16) / 16 + Math.abs(y + 0.5 - 8) / 8;
      if (e > 0.94) continue;
      p.set(x, y, (x % 6 === 0 || y % 4 === 0) ? 0x93c5fd : 0xe0f2fe);
    }
  }
  return d;
};

export const amberCobble = (): SpriteDef => {
  const [p, d] = sprite(32, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      const e = Math.abs(x + 0.5 - 16) / 16 + Math.abs(y + 0.5 - 8) / 8;
      if (e > 0.94) continue;
      p.set(x, y, (x + y) % 4 === 0 ? 0xf59e0b : (x % 5 === 0 ? 0x78716c : 0xa8a29e));
    }
  }
  return d;
};

export const starPaving = (): SpriteDef => {
  const [p, d] = sprite(32, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      const e = Math.abs(x + 0.5 - 16) / 16 + Math.abs(y + 0.5 - 8) / 8;
      if (e > 0.94) continue;
      p.set(x, y, e > 0.72 ? 0x1e1b4b : 0x312e81);
    }
  }
  p.set(16, 8, 0xfef08a);
  p.set(11, 7, 0x93c5fd);
  p.set(21, 9, 0x93c5fd);
  return d;
};

export const springPinwheel = (): SpriteDef => {
  const [p, d] = sprite(24, 34);
  const cx = 12, base = 28;
  p.line(cx, base, cx, base - 16, WOOD[2]);
  p.ellipse(cx - 3, base - 18, 3, 2, 0xf472b6);
  p.ellipse(cx + 3, base - 18, 3, 2, 0x60a5fa);
  p.ellipse(cx, base - 21, 2, 3, 0xfef08a);
  p.ellipse(cx, base - 15, 2, 3, 0x34d399);
  p.set(cx, base - 18, 0xffffff);
  p.outline();
  p.shadow(cx + 1, base, 5, 2, 40);
  return d;
};

export const snowFort = (rot: 0 | 1 = 0): SpriteDef => {
  const [p, d] = sprite(36, 36);
  const cx = 18, base = 28;
  p.blob(cx, base - 9, 13, 10, [0x93c5fd, 0xdbeafe, 0xeff6ff, 0xffffff], 0.08, 66);
  const dx = rot === 1 ? -4 : 4;
  p.ellipse(cx + dx, base - 4, 4, 5, 0xf59e0b);
  p.ellipse(cx + dx, base - 4, 2.5, 3, 0xfef08a);
  p.outline();
  p.shadow(cx + 1, base, 12, 4, 50);
  return d;
};

export const harvestCart = (rot: 0 | 1 = 0): SpriteDef => {
  const w = rot === 1 ? 1 : 2, d = rot === 1 ? 2 : 1;
  const pad = 8;
  const W = (w + d) * 16 + pad * 2;
  const Hc = (w + d) * 8 + 30;
  const p = new Pix(W, Hc);
  const ox = pad + d * 16;
  const oy = Hc - (w + d) * 8;
  const iso = new Iso(ox, oy);
  const uMax = rot === 1 ? 0.85 : 1.75;
  const vMax = rot === 1 ? 1.75 : 0.85;
  box(p, iso, 0.15, uMax, 0.15, vMax, 3, 12, WOOD, 7);
  const [px, py] = iso.p(uMax * 0.55, vMax * 0.55, 14);
  p.ellipse(px - 3, py, 4, 3.5, 0xf97316);
  p.ellipse(px + 3, py - 1, 3.5, 3, 0xfef08a);
  const wh = iso.p(uMax * 0.5, vMax, 3);
  p.ellipse(wh[0], wh[1] + 2, 4, 4, WOOD[1]);
  p.outline();
  p.shadow(ox + (w - d) * 8, oy + 16, 26, 7, 55);
  return { pix: p, ax: ox + (w - d) * 16 };
};

export const fireSpinners = (): SpriteDef => {
  const [p, d] = sprite(24, 36);
  const cx = 12, base = 30;
  p.line(cx, base, cx, base - 17, WOOD[0]);
  p.ellipse(cx, base - 19, 5, 5, 0xdc2626);
  p.ellipse(cx, base - 19, 3, 3, 0xfef08a);
  p.set(cx - 4, base - 19, 0xf97316);
  p.set(cx + 4, base - 19, 0xf97316);
  p.outline();
  p.shadow(cx + 1, base, 5, 2, 40);
  return d;
};

export const dreamcatcher = (rot: 0 | 1 = 0): SpriteDef => {
  const [p, d] = sprite(32, 44);
  const cx = 16, base = 36;
  box(p, new Iso(cx, base), 0.16, 0.26, 0.16, 0.26, 0, 22, MARBLE);
  box(p, new Iso(cx, base), 0.74, 0.84, 0.74, 0.84, 0, 22, MARBLE);
  p.line(cx - 8, base - 24, cx + 8, base - 24, BRASS[3]);
  const fx = rot === 1 ? cx - 2 : cx + 2;
  p.ellipse(fx, base - 18, 4.5, 4.5, 0xc084fc);
  p.ellipse(fx, base - 18, 2.5, 2.5, 0xfef08a);
  p.line(fx - 3, base - 14, fx - 3, base - 9, 0x93c5fd);
  p.line(fx + 3, base - 14, fx + 3, base - 9, 0xf472b6);
  p.outline();
  p.shadow(cx + 1, base, 10, 3.5, 45);
  return d;
};

export { GREEN, lighten, OUTLINE };
