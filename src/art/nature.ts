import { hash } from '../core/rng';
import { Pix, darken, lighten, mixc, noise, OUTLINE, ramp } from './pix';

export interface SpriteDef {
  pix: Pix;
  /** x of the footprint's front vertex (sprite bottom-centre anchor) */
  ax: number;
}

export const GREEN = ramp(0x66bd47);
export const LEAF_DARK = ramp(0x3f9a4a);
export const LEAF_PINE = ramp(0x2f8a52);
export const LEAF_BIRCH = ramp(0xf0b45a);
export const WOOD = ramp(0xa8683a);
export const STONE = ramp(0x9a98a8);
export const STONE_WARM = ramp(0xb9a79a);
export const BARK_BIRCH = ramp(0xece6da);
export const LEAF_CHERRY = ramp(0xf472b6);
export const LEAF_WILLOW = ramp(0x84cc16);
export const CRYSTAL_PAL = ramp(0x06b6d4);
export const SHROOM_GLOW = ramp(0xa855f7);
export const CLOUD_GOLD = ramp(0xfef08a);

const sprite = (w: number, h: number, ax = w / 2): [Pix, SpriteDef] => {
  const pix = new Pix(w, h);
  return [pix, { pix, ax }];
};

/** Ground centre of a 1×1 object inside a sprite of height h */
const gc = (h: number) => h - 8;

const trunk = (p: Pix, cx: number, base: number, top: number, w0: number, w1: number, pal = WOOD) => {
  for (let y = top; y <= base; y++) {
    const t = (y - top) / Math.max(1, base - top);
    const w = w0 + (w1 - w0) * t;
    for (let x = Math.round(cx - w / 2); x < Math.round(cx + w / 2); x++) {
      const rel = (x - (cx - w / 2)) / w;
      const n = noise(x, y, 3);
      const c = rel < 0.3 ? pal[3] : rel < 0.7 ? pal[2] : pal[1];
      p.set(x, y, n > 0.88 ? pal[1] : c);
    }
  }
  // roots
  p.set(cx - w1 / 2 - 1, base, pal[1]);
  p.set(cx + w1 / 2, base, pal[0]);
  p.set(cx - w1 / 2 - 2, base + 1, pal[0]);
  p.set(cx + w1 / 2 + 1, base + 1, pal[0]);
}

export const treeBig = (): SpriteDef => {
  const [p, d] = sprite(64, 76);
  const cx = 32, base = gc(76);
  // roots & trunk with a bit of lean
  trunk(p, cx, base, base - 30, 7, 10);
  p.line(cx + 1, base - 22, cx + 12, base - 30, WOOD[2]);
  p.line(cx - 1, base - 24, cx - 11, base - 33, WOOD[1]);
  p.rect(cx + 10, base - 32, 3, 3, WOOD[2]);
  p.rect(cx - 13, base - 35, 3, 3, WOOD[1]);
  const blobs: [number, number, number, number, readonly number[]][] = [
    [cx - 16, base - 36, 15, 11, LEAF_DARK],
    [cx + 17, base - 38, 15, 11, LEAF_DARK],
    [cx, base - 45, 20, 15, GREEN],
    [cx - 11, base - 52, 14, 10, GREEN],
    [cx + 10, base - 54, 14, 10, GREEN],
    [cx - 1, base - 60, 12, 8, GREEN],
  ];
  blobs.forEach(([x, y, rx, ry, pal], i) => p.blob(x, y, rx, ry, pal, 0.22, i + 7));
  // flecks of light & small blossoms
  for (let i = 0; i < 26; i++) {
    const x = 8 + Math.floor(noise(i, 1, 9) * 48);
    const y = 8 + Math.floor(noise(i, 2, 9) * 40);
    if (p.alpha(x, y) && p.getc(x, y) !== WOOD[2]) p.set(x, y, GREEN[3]);
  }
  p.outline(OUTLINE, false);
  p.shadow(cx + 3, base + 1, 19, 6, 70);
  return d;
}

export const oakSmall = (): SpriteDef => {
  const [p, d] = sprite(44, 56);
  const cx = 22, base = gc(56);
  trunk(p, cx, base, base - 20, 5, 7);
  p.blob(cx - 9, base - 24, 10, 8, LEAF_DARK, 0.2, 21);
  p.blob(cx + 10, base - 25, 10, 8, LEAF_DARK, 0.2, 22);
  p.blob(cx, base - 30, 14, 11, GREEN, 0.22, 23);
  p.blob(cx - 4, base - 38, 9, 7, GREEN, 0.22, 24);
  p.blob(cx + 6, base - 36, 8, 6, GREEN, 0.22, 25);
  p.outline();
  p.shadow(cx + 2, base + 1, 13, 5);
  return d;
}

export const pine = (): SpriteDef => {
  const [p, d] = sprite(40, 64);
  const cx = 20, base = gc(64);
  trunk(p, cx, base, base - 8, 4, 5);
  const tiers = [[base - 6, 14, 12], [base - 16, 12, 11], [base - 26, 10, 10], [base - 35, 7, 9], [base - 43, 4, 8]];
  tiers.forEach(([y, rx, ry], i) => {
    // triangular tier with serrated lower edge
    for (let yy = y - ry; yy <= y; yy++) {
      const t = (yy - (y - ry)) / ry;
      const half = Math.round(rx * t);
      for (let x = cx - half; x <= cx + half; x++) {
        const rel = (x - cx) / Math.max(1, half);
        const jag = noise(x, yy, i) > 0.6;
        let c: number = rel < -0.35 ? LEAF_PINE[3] : rel < 0.25 ? LEAF_PINE[2] : LEAF_PINE[1];
        if (t > 0.82) c = rel > 0 ? LEAF_PINE[0] : LEAF_PINE[1];
        if (jag && t > 0.4) c = lighten(c, 0.12);
        p.set(x, yy, c);
      }
    }
    // jagged hem
    for (let x = cx - rx; x <= cx + rx; x += 2) p.set(x, y + 1, LEAF_PINE[0]);
  });
  p.outline();
  p.shadow(cx + 2, base + 1, 12, 4);
  return d;
}

export const birch = (): SpriteDef => {
  const [p, d] = sprite(44, 60);
  const cx = 22, base = gc(60);
  trunk(p, cx, base, base - 28, 4, 5, BARK_BIRCH);
  for (let y = base - 26; y < base; y += 4) { p.set(cx - 1, y, 0x4a4250); p.set(cx, y + 1, 0x4a4250); }
  p.blob(cx - 8, base - 28, 10, 8, LEAF_BIRCH, 0.2, 31);
  p.blob(cx + 9, base - 30, 10, 8, LEAF_BIRCH, 0.2, 32);
  p.blob(cx, base - 36, 13, 10, LEAF_BIRCH, 0.22, 33);
  p.blob(cx - 2, base - 44, 8, 6, LEAF_BIRCH, 0.22, 34);
  for (let i = 0; i < 12; i++) {
    const x = 8 + Math.floor(noise(i, 4, 5) * 28), y = 8 + Math.floor(noise(i, 5, 5) * 28);
    if (p.alpha(x, y)) p.set(x, y, 0xffd9e0);
  }
  p.outline();
  p.shadow(cx + 2, base + 1, 11, 4);
  return d;
}

export const bush = (): SpriteDef => {
  const [p, d] = sprite(36, 32);
  const cx = 18, base = gc(32);
  p.blob(cx - 7, base - 5, 9, 7, LEAF_DARK, 0.2, 41);
  p.blob(cx + 7, base - 5, 9, 7, LEAF_DARK, 0.2, 42);
  p.blob(cx, base - 9, 11, 9, GREEN, 0.24, 43);
  for (const [x, y, c] of [[cx - 5, base - 12, 0xfff3d6], [cx + 4, base - 8, 0xff8fb3], [cx - 1, base - 4, 0xfff3d6], [cx + 8, base - 13, 0xffd84a], [cx - 9, base - 6, 0xff8fb3]] as const) {
    p.set(x, y, c);
    p.set(x + 1, y, mixc(c, 0xffffff, 0.2));
  }
  p.outline();
  p.shadow(cx + 2, base + 1, 13, 4);
  return d;
}

export const rock = (): SpriteDef => {
  const [p, d] = sprite(36, 30);
  const cx = 18, base = gc(30);
  p.blob(cx - 3, base - 5, 10, 8, STONE, 0.3, 51);
  p.blob(cx + 7, base - 3, 6, 5, STONE_WARM, 0.3, 52);
  p.blob(cx - 10, base - 1, 4, 3, STONE, 0.2, 53);
  p.set(cx - 5, base - 9, STONE[3]); p.set(cx - 4, base - 9, STONE[3]);
  p.line(cx - 2, base - 6, cx + 1, base - 3, STONE[0]);
  // moss
  for (let i = 0; i < 6; i++) p.set(cx - 8 + i * 2, base - 10 + (i % 2), GREEN[2]);
  p.outline();
  p.shadow(cx + 3, base + 2, 13, 4);
  return d;
}

export const stones = (): SpriteDef => {
  const [p, d] = sprite(32, 22);
  const cx = 16, base = gc(22);
  p.blob(cx - 5, base - 2, 5, 3.5, STONE, 0.2, 61);
  p.blob(cx + 3, base, 4, 3, STONE_WARM, 0.2, 62);
  p.blob(cx + 8, base - 3, 3, 2.5, STONE, 0.2, 63);
  p.blob(cx - 1, base - 6, 3, 2.5, STONE_WARM, 0.2, 64);
  p.outline();
  p.shadow(cx + 2, base + 2, 11, 3, 60);
  return d;
}

export const log = (): SpriteDef => {
  const [p, d] = sprite(40, 28);
  const cx = 20, base = gc(28);
  // horizontal log lying along the screen x-axis
  for (let x = cx - 14; x <= cx + 14; x++) {
    const y0 = base - 10 + Math.round((x - cx) * 0.0);
    for (let y = y0; y < y0 + 9; y++) {
      const t = (y - y0) / 8;
      p.set(x, y, t < 0.25 ? WOOD[3] : t < 0.6 ? WOOD[2] : t < 0.85 ? WOOD[1] : WOOD[0]);
    }
    if (noise(x, 3, 4) > 0.8) p.set(x, y0 + 3, WOOD[1]);
  }
  p.ellipse(cx + 14, base - 6, 3, 4.5, WOOD[3]);
  p.ellipse(cx + 14, base - 6, 1.8, 2.8, WOOD[2]);
  p.set(cx + 14, base - 6, WOOD[1]);
  // moss cap
  for (let x = cx - 12; x < cx + 8; x++) { p.set(x, base - 11, GREEN[2]); if (noise(x, 1, 5) > 0.3) p.set(x, base - 10, GREEN[1]); }
  p.blob(cx - 3, base - 12, 5, 2.5, GREEN, 0.3, 66);
  p.outline();
  p.shadow(cx + 3, base + 1, 16, 4);
  return d;
}

export const reeds = (): SpriteDef => {
  const [p, d] = sprite(30, 40);
  const cx = 15, base = gc(40);
  const stems: [number, number, number][] = [[-6, 24, 0], [-2, 30, 1], [2, 26, -1], [6, 20, 1], [0, 18, 0]];
  stems.forEach(([dx, h, lean], i) => {
    for (let y = 0; y < h; y++) p.set(cx + dx + Math.round(lean * (y / h) * 2), base - y, y % 5 === 0 ? 0x4a9a42 : 0x66bd47);
    const tx = cx + dx + lean * 2;
    if (i % 2 === 0) p.rect(tx - 1, base - h - 3, 2, 4, 0x8a5a3c);
  });
  p.outline();
  return d;
}

export const mushroomRing = (): SpriteDef => {
  const [p, d] = sprite(40, 24);
  const cx = 20, base = gc(24);
  const spots: [number, number, number, number][] = [[-10, -3, 3, 0xe84a4a], [-3, -6, 2, 0xf3a64a], [6, -5, 3, 0xe84a4a], [11, -1, 2, 0xf3a64a], [-6, 2, 2, 0xe84a4a], [3, 2, 3, 0xf3a64a]];
  for (const [dx, dy, r, c] of spots) {
    p.rect(cx + dx - 1, base + dy, 2, 3, 0xf3e6c8);
    p.ellipse(cx + dx, base + dy - 1, r, r * 0.7 + 0.3, c);
    p.set(cx + dx - 1, base + dy - 2, 0xfff6e0);
  }
  p.outline();
  p.shadow(cx + 1, base + 1, 15, 4, 50);
  return d;
}

export const wildflowers = (): SpriteDef => {
  const [p, d] = sprite(32, 20);
  const cx = 16, base = gc(20);
  const cols = [0xff8fb3, 0xfff6e0, 0xffd84a, 0xb58cf0, 0x8fb0ff];
  for (let i = 0; i < 6; i++) {
    const x = cx - 9 + Math.floor(noise(i, 7, 1) * 18);
    const y = base - 4 + Math.floor(noise(i, 8, 1) * 8);
    p.set(x, y + 1, 0x4a9a42);
    p.set(x, y + 2, 0x3a7a3a);
    const c = cols[i % cols.length];
    p.set(x, y, c);
    p.set(x - 1, y, c); p.set(x + 1, y, c); p.set(x, y - 1, c);
    p.set(x, y, 0xffe9a0);
  }
  return d;
}

export const pumpkin = (): SpriteDef => {
  const [p, d] = sprite(28, 24);
  const cx = 14, base = gc(24);
  const o = ramp(0xf08a2c);
  p.blob(cx - 4, base - 4, 6, 5, o, 0.12, 71);
  p.blob(cx + 4, base - 4, 6, 5, o, 0.12, 72);
  p.blob(cx, base - 5, 6, 6, o, 0.12, 73);
  p.rect(cx - 1, base - 11, 2, 3, 0x5a8a3a);
  p.set(cx + 1, base - 10, 0x66bd47);
  p.outline();
  p.shadow(cx + 2, base + 1, 11, 3);
  return d;
}

export const snowman = (): SpriteDef => {
  const [p, d] = sprite(28, 44);
  const cx = 14, base = gc(44);
  const w = ramp(0xf4f8ff);
  p.blob(cx, base - 5, 8, 7, w, 0.1, 81);
  p.blob(cx, base - 16, 6, 6, w, 0.1, 82);
  p.blob(cx, base - 25, 5, 5, w, 0.1, 83);
  p.set(cx - 2, base - 26, 0x2a2236); p.set(cx + 2, base - 26, 0x2a2236);
  p.rect(cx, base - 24, 3, 1, 0xf08a2c);
  p.rect(cx - 5, base - 31, 10, 2, 0x3a3a4a); p.rect(cx - 3, base - 36, 6, 5, 0x3a3a4a);
  p.rect(cx - 5, base - 20, 10, 2, 0xe84a4a);
  p.set(cx, base - 15, 0x2a2236); p.set(cx, base - 11, 0x2a2236);
  p.outline();
  p.shadow(cx + 2, base + 1, 11, 3);
  return d;
};

export const willow = (): SpriteDef => {
  const [p, d] = sprite(56, 68);
  const cx = 28, base = gc(68);
  trunk(p, cx, base, base - 26, 6, 8, WOOD);
  // arching branches
  p.line(cx - 2, base - 18, cx - 18, base - 26, WOOD[1]);
  p.line(cx + 2, base - 18, cx + 18, base - 26, WOOD[2]);
  // main canopy
  p.blob(cx, base - 32, 22, 14, LEAF_WILLOW, 0.25, 110);
  p.blob(cx - 10, base - 30, 14, 12, LEAF_WILLOW, 0.2, 111);
  p.blob(cx + 10, base - 30, 14, 12, LEAF_WILLOW, 0.2, 112);
  // cascading trailing leaves
  for (let i = -16; i <= 16; i += 4) {
    const len = 12 + (noise(i, 4, 1) * 10);
    const topY = base - 26;
    for (let y = 0; y < len; y++) {
      p.set(cx + i, topY + y, y % 3 === 0 ? LEAF_WILLOW[3] : LEAF_WILLOW[2]);
    }
  }
  p.outline();
  p.shadow(cx + 2, base + 1, 18, 4);
  return d;
};

export const crystalCluster = (): SpriteDef => {
  const [p, d] = sprite(32, 32);
  const cx = 16, base = gc(32);
  // rocky mound base
  p.blob(cx, base - 2, 9, 4, STONE, 0.15, 95);
  // tall central crystal
  p.poly([[cx - 3, base - 3], [cx - 3, base - 18], [cx, base - 24], [cx + 3, base - 18], [cx + 3, base - 3]], CRYSTAL_PAL[2]);
  p.poly([[cx - 3, base - 3], [cx - 3, base - 18], [cx, base - 24], [cx, base - 3]], CRYSTAL_PAL[3]);
  // left angled crystal
  p.poly([[cx - 7, base - 2], [cx - 8, base - 12], [cx - 5, base - 16], [cx - 3, base - 12], [cx - 3, base - 2]], CRYSTAL_PAL[2]);
  // right angled crystal
  p.poly([[cx + 3, base - 2], [cx + 3, base - 11], [cx + 6, base - 15], [cx + 8, base - 11], [cx + 7, base - 2]], CRYSTAL_PAL[1]);
  p.set(cx - 1, base - 20, 0xffffff);
  p.set(cx - 5, base - 13, 0xffffff);
  p.outline();
  p.shadow(cx + 2, base + 1, 13, 3, 50);
  return d;
};

export const cherry = (): SpriteDef => {
  const [p, d] = sprite(54, 68);
  const cx = 27, base = gc(68);
  const darkWood = ramp(0x5c3a21);
  trunk(p, cx, base, base - 24, 5, 7, darkWood);
  p.line(cx - 1, base - 16, cx - 12, base - 24, darkWood[1]);
  p.line(cx + 1, base - 16, cx + 12, base - 24, darkWood[2]);
  // pink canopy clouds
  p.blob(cx, base - 34, 21, 16, LEAF_CHERRY, 0.28, 120);
  p.blob(cx - 11, base - 30, 14, 13, LEAF_CHERRY, 0.25, 121);
  p.blob(cx + 11, base - 30, 14, 13, LEAF_CHERRY, 0.25, 122);
  p.blob(cx, base - 40, 14, 10, LEAF_CHERRY, 0.2, 123);
  // floating petals
  for (const [ox, oy] of [[-14, -12], [15, -10], [-6, -4], [10, -3], [-18, 4], [16, 2]] as const) {
    p.set(cx + ox, base + oy, 0xffb5d8);
    p.set(cx + ox + 1, base + oy, 0xffe4f0);
  }
  p.outline();
  p.shadow(cx + 2, base + 1, 16, 4);
  return d;
};

export const glowShrooms = (): SpriteDef => {
  const [p, d] = sprite(32, 28);
  const cx = 16, base = gc(28);
  // mossy ground
  p.blob(cx, base - 2, 11, 4, GREEN, 0.15, 87);
  // 3 glowing mushrooms
  const shroom = (sx: number, sy: number, r: number, h: number) => {
    p.rect(sx - 1, sy - h, 2, h, 0xe0e7ff);
    p.blob(sx, sy - h - 1, r, r * 0.7, SHROOM_GLOW, 0.12, sx);
    p.set(sx - 1, sy - h - 2, 0xf3e8ff);
    p.set(sx + 1, sy - h - 1, 0x7c3aed);
  };
  shroom(cx - 4, base - 1, 5, 5);
  shroom(cx + 4, base - 2, 4, 4);
  shroom(cx, base - 3, 3, 3);
  // spore sparkles
  p.set(cx - 6, base - 10, 0xd8b4fe);
  p.set(cx + 6, base - 9, 0xd8b4fe);
  p.set(cx + 1, base - 12, 0xf5d0fe);
  p.outline();
  p.shadow(cx + 2, base + 1, 13, 3, 40);
  return d;
};

export const cloudTree = (): SpriteDef => {
  const [p, d] = sprite(56, 74);
  const cx = 28, base = gc(74);
  const paleWood = ramp(0xe2e8f0);
  trunk(p, cx, base, base - 26, 6, 8, paleWood);
  p.line(cx - 2, base - 18, cx - 14, base - 28, paleWood[1]);
  p.line(cx + 2, base - 18, cx + 14, base - 28, paleWood[2]);
  // golden glowing cloud canopy
  p.blob(cx, base - 38, 22, 17, CLOUD_GOLD, 0.28, 130);
  p.blob(cx - 12, base - 32, 15, 14, CLOUD_GOLD, 0.25, 131);
  p.blob(cx + 12, base - 32, 15, 14, CLOUD_GOLD, 0.25, 132);
  p.blob(cx, base - 44, 15, 11, CLOUD_GOLD, 0.2, 133);
  // golden sparkles
  for (const [ox, oy] of [[-12, -38], [12, -36], [-4, -46], [6, -42], [-16, -26], [16, -24]] as const) {
    p.set(cx + ox, base + oy, 0xffffff);
    p.set(cx + ox, base + oy + 1, 0xfde047);
  }
  p.outline();
  p.shadow(cx + 2, base + 1, 18, 4);
  return d;
};

export const flowerBed = (): SpriteDef => {
  const [p, d] = sprite(32, 16);
  for (let y = 2; y < 14; y++) {
    for (let x = 4; x < 28; x++) {
      const e = Math.abs(x - 16) / 14 + Math.abs(y - 8) / 7;
      if (e > 0.95) continue;
      p.set(x, y, (x + y) % 3 === 0 ? GREEN[2] : GREEN[1]);
    }
  }
  const cols = [0xff8fb3, 0xfef08a, 0x93c5fd, 0xf5d0fe, 0xffffff];
  for (let i = 0; i < 11; i++) {
    const k = hash(i, 7, 11);
    const fx = 7 + (k % 18), fy = 4 + ((k >> 4) % 8);
    p.set(fx, fy, cols[i % cols.length]);
    p.set(fx + 1, fy, lighten(cols[i % cols.length], 0.3));
  }
  p.outline(OUTLINE, false);
  return d;
};

export const snowPine = (): SpriteDef => {
  const [p, d] = sprite(44, 60);
  const cx = 22, base = gc(60);
  trunk(p, cx, base, base - 14, 4, 6);
  const pinePal = ramp(0x286f5c);
  const snowPal = [0xbfdcf4, 0xdcf0fe, 0xf2faff, 0xffffff];
  for (const [ty, rx, h] of [[base - 12, 16, 15], [base - 24, 13, 14], [base - 35, 9, 13]] as const) {
    for (let y = 0; y < h; y++) {
      const w = (y / h) * rx;
      for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) {
        const isSnow = y < Math.max(3, h * 0.36) || noise(x, ty + y, 12) > 0.65;
        const pal = isSnow ? snowPal : pinePal;
        const c = x < cx - w * 0.3 ? pal[3] : x < cx + w * 0.25 ? pal[2] : pal[1];
        p.set(x, ty - h + y, c);
      }
    }
  }
  p.outline();
  p.shadow(cx + 2, base + 1, 13, 3.5);
  return d;
};

export const iceCrystal = (): SpriteDef => {
  const [p, d] = sprite(38, 44);
  const cx = 19, base = gc(44);
  const icePal = [0x38bdf8, 0x7dd3fc, 0xbae6fd, 0xf0f9ff];
  p.blob(cx, base - 2, 12, 5, [0x94a3b8, 0xcbd5e1, 0xe2e8f0, 0xffffff], 0.1, 30);
  p.poly([[cx - 4, base - 3], [cx - 3, base - 24], [cx, base - 30], [cx + 4, base - 23], [cx + 5, base - 3]], icePal[2]);
  p.poly([[cx, base - 30], [cx + 4, base - 23], [cx + 5, base - 3], [cx, base - 3]], icePal[1]);
  p.poly([[cx - 8, base - 2], [cx - 9, base - 15], [cx - 5, base - 19], [cx - 3, base - 14], [cx - 3, base - 2]], icePal[3]);
  p.poly([[cx + 4, base - 2], [cx + 5, base - 13], [cx + 8, base - 17], [cx + 10, base - 12], [cx + 9, base - 2]], icePal[0]);
  p.set(cx - 1, base - 24, 0xffffff);
  p.outline();
  p.shadow(cx + 2, base + 1, 13, 3, 45);
  return d;
};

export const autumnMaple = (): SpriteDef => {
  const [p, d] = sprite(54, 68);
  const cx = 27, base = gc(68);
  const mapleWood = ramp(0x523426);
  trunk(p, cx, base, base - 24, 5, 7, mapleWood);
  const autumn = [0x9a3412, 0xd97706, 0xf59e0b, 0xfcd34d];
  p.blob(cx, base - 35, 20, 15, autumn, 0.25, 41);
  p.blob(cx - 11, base - 30, 13, 12, [0x991b1b, 0xdc2626, 0xef4444, 0xfca5a5], 0.2, 42);
  p.blob(cx + 11, base - 30, 13, 12, autumn, 0.22, 43);
  p.blob(cx, base - 41, 13, 10, autumn, 0.2, 44);
  p.outline();
  p.shadow(cx + 2, base + 1, 16, 4);
  return d;
};

export const mistFern = (): SpriteDef => {
  const [p, d] = sprite(32, 26);
  const cx = 16, base = gc(26);
  const fern = ramp(0x2d8a68);
  p.blob(cx - 5, base - 4, 6, 4.5, fern, 0.25, 19);
  p.blob(cx + 5, base - 4, 6, 4.5, fern, 0.25, 20);
  p.blob(cx, base - 7, 7, 5.5, [0x226a52, 0x389e78, 0x56c298, 0x99e8c8], 0.25, 21);
  p.set(cx - 3, base - 9, 0xdcfce7);
  p.set(cx + 4, base - 7, 0xdcfce7);
  p.outline();
  p.shadow(cx + 1, base + 1, 10, 3);
  return d;
};

export const emberFern = (): SpriteDef => {
  const [p, d] = sprite(32, 30);
  const cx = 16, base = gc(30);
  const pal = [0x7c2d12, 0xc2410c, 0xf97316, 0xfdba74];
  p.blob(cx - 4, base - 5, 5, 4, pal, 0.2, 51);
  p.blob(cx + 4, base - 5, 5, 4, pal, 0.2, 52);
  p.blob(cx, base - 8, 6, 5.5, pal, 0.2, 53);
  p.set(cx, base - 13, 0xfef08a);
  p.set(cx - 4, base - 10, 0xfef08a);
  p.set(cx + 4, base - 10, 0xfef08a);
  p.outline();
  p.shadow(cx + 1, base + 1, 9, 3);
  return d;
};

export const basaltSpire = (): SpriteDef => {
  const [p, d] = sprite(36, 42);
  const cx = 18, base = gc(42);
  const bas = ramp(0x474554);
  p.poly([[cx - 8, base - 1], [cx - 6, base - 22], [cx, base - 28], [cx + 6, base - 20], [cx + 8, base - 1]], bas[2]);
  p.poly([[cx, base - 28], [cx + 6, base - 20], [cx + 8, base - 1], [cx, base - 1]], bas[1]);
  p.poly([[cx - 2, base - 16], [cx + 1, base - 18], [cx, base - 6]], 0xf97316);
  p.set(cx - 1, base - 16, 0xfef08a);
  p.outline();
  p.shadow(cx + 2, base + 1, 11, 3);
  return d;
};

export const starWillow = (): SpriteDef => {
  const [p, d] = sprite(56, 70);
  const cx = 28, base = gc(70);
  const bark = ramp(0x3b3363);
  trunk(p, cx, base, base - 25, 5, 8, bark);
  const starPal = [0x312e81, 0x4338ca, 0x6366f1, 0xa5b4fc];
  p.blob(cx, base - 36, 20, 15, starPal, 0.22, 60);
  for (let i = -16; i <= 16; i += 4) {
    const len = 10 + (Math.abs(i) % 7);
    for (let y = 0; y < len; y++) {
      p.set(cx + i, base - 26 + y, y > len - 3 ? 0xfef08a : starPal[2]);
    }
  }
  p.outline();
  p.shadow(cx + 2, base + 1, 16, 4);
  return d;
};

export const everdreamTree = (): SpriteDef => {
  const [p, d] = sprite(58, 74);
  const cx = 29, base = gc(74);
  const pale = ramp(0xd6c7b8);
  trunk(p, cx, base, base - 26, 6, 8, pale);
  p.blob(cx - 11, base - 33, 14, 13, [0x9d174d, 0xdb2777, 0xf472b6, 0xfbcfe8], 0.24, 71);
  p.blob(cx + 11, base - 33, 14, 13, [0x0369a1, 0x0ea5e9, 0x7dd3fc, 0xe0f2fe], 0.24, 72);
  p.blob(cx, base - 41, 16, 13, [0xb45309, 0xf59e0b, 0xfde047, 0xfef9c3], 0.24, 73);
  for (const [ox, oy] of [[-12, -36], [10, -34], [0, -45], [-6, -24], [8, -22]] as const) {
    p.set(cx + ox, base + oy, 0xffffff);
  }
  p.outline();
  p.shadow(cx + 2, base + 1, 18, 4);
  return d;
};

const CACTUS_GREEN = [0x1b5e3a, 0x28804f, 0x3ba368, 0x6fd492];
const SANDSTONE = [0x8c4d2b, 0xb86b3d, 0xd98c54, 0xf2b880];
const PALM_WOOD = [0x5c3c24, 0x7d5434, 0x9e6e46, 0xc28e60];

export const cactusSmall = (): SpriteDef => {
  const [p, d] = sprite(28, 34);
  const cx = 14, base = gc(34);
  // Warm sandy base mound
  p.ellipse(cx, base - 1, 6, 2.5, SANDSTONE[2]);
  // Ribbed single cactus column
  p.blob(cx, base - 10, 4.5, 9, CACTUS_GREEN, 0.08, 81);
  for (let y = base - 17; y <= base - 3; y += 2) {
    p.set(cx - 2, y, CACTUS_GREEN[3]);
    p.set(cx + 2, y, CACTUS_GREEN[0]);
  }
  // Tiny golden crown bud
  p.set(cx, base - 19, 0xfef08a);
  p.set(cx - 1, base - 18, 0xf472b6);
  p.outline();
  p.shadow(cx + 1, base + 1, 7, 2.5);
  return d;
};

export const cactusTall = (rot: 0 | 1 = 0): SpriteDef => {
  const [p, d] = sprite(36, 48);
  const cx = 18, base = gc(48);
  const dir = rot === 1 ? -1 : 1;
  p.ellipse(cx, base - 1, 7, 2.5, SANDSTONE[2]);
  // Central trunk
  p.blob(cx, base - 16, 4.8, 15, CACTUS_GREEN, 0.06, 82);
  // Left & right saguaro arms at asymmetric heights
  const arm1X = cx - 7 * dir;
  const arm2X = cx + 7 * dir;
  p.blob(arm1X, base - 17, 3.2, 6, CACTUS_GREEN, 0.06, 83);
  p.rect(Math.min(cx, arm1X), base - 13, 7, 3, CACTUS_GREEN[2]);
  p.blob(arm2X, base - 21, 3.2, 6.5, CACTUS_GREEN, 0.06, 84);
  p.rect(Math.min(cx, arm2X), base - 17, 7, 3, CACTUS_GREEN[1]);
  for (let y = base - 28; y <= base - 4; y += 3) {
    p.set(cx - 1, y, CACTUS_GREEN[3]);
    p.set(cx + 2, y, CACTUS_GREEN[0]);
  }
  p.outline();
  p.shadow(cx + 2, base + 1, 10, 3);
  return d;
};

export const cactusFlower = (): SpriteDef => {
  const [p, d] = sprite(30, 34);
  const cx = 15, base = gc(34);
  p.ellipse(cx, base - 1, 6.5, 2.5, SANDSTONE[2]);
  // Barrel cactus body
  p.blob(cx, base - 8, 6.5, 7, CACTUS_GREEN, 0.1, 85);
  for (let dx = -4; dx <= 4; dx += 2) {
    for (let y = base - 13; y <= base - 4; y += 2) {
      p.set(cx + dx, y, dx < 0 ? CACTUS_GREEN[3] : CACTUS_GREEN[1]);
    }
  }
  // Vibrant blossoms on crown
  p.ellipse(cx - 2, base - 15, 3, 2, 0xf43f5e);
  p.ellipse(cx + 2, base - 14, 3, 2, 0xfb7185);
  p.set(cx - 2, base - 15, 0xfef08a);
  p.set(cx + 2, base - 14, 0xfef08a);
  p.outline();
  p.shadow(cx + 1, base + 1, 8, 3);
  return d;
};

export const desertRock = (rot: 0 | 1 = 0): SpriteDef => {
  const [p, d] = sprite(36, 32);
  const cx = 18, base = gc(32);
  const dir = rot === 1 ? -1 : 1;
  // Layered warm sandstone mesa formation
  p.blob(cx - 3 * dir, base - 8, 9, 7.5, SANDSTONE, 0.15, 86);
  p.blob(cx + 5 * dir, base - 5, 7, 5.5, SANDSTONE, 0.15, 87);
  // Horizontal sedimentary strata lines
  for (let x = cx - 10; x <= cx + 10; x++) {
    if (p.getc(x, base - 9)) p.set(x, base - 9, SANDSTONE[0]);
    if (p.getc(x, base - 5)) p.set(x, base - 5, SANDSTONE[3]);
  }
  p.outline();
  p.shadow(cx + 1, base + 1, 12, 3);
  return d;
};

export const desertPalm = (): SpriteDef => {
  const [p, d] = sprite(48, 62);
  const cx = 24, base = gc(62);
  // Gently curving oasis palm trunk with rings
  for (let y = 0; y < 28; y++) {
    const t = y / 27;
    const xOff = Math.round(Math.sin(t * Math.PI * 0.85) * 3);
    const w = Math.max(2, Math.round(3.5 - t * 1.3));
    for (let dx = -w; dx <= w; dx++) {
      const c = y % 4 === 0 ? PALM_WOOD[0] : dx < 0 ? PALM_WOOD[3] : dx === 0 ? PALM_WOOD[2] : PALM_WOOD[1];
      p.set(cx + xOff + dx, base - y, c);
    }
  }
  const topX = cx + 2, topY = base - 29;
  const frondPal = [0x1e6b3a, 0x2e8f4e, 0x4cb566, 0x8ae096];
  // Fanning palm fronds
  for (const [fx, fy, rx, ry, s] of [
    [-11, -3, 10, 4.5, 91],
    [11, -3, 10, 4.5, 92],
    [-8, -8, 9, 4, 93],
    [8, -8, 9, 4, 94],
    [0, -10, 8, 4.5, 95],
    [-6, 2, 7, 3.5, 96],
    [6, 2, 7, 3.5, 97],
  ] as const) {
    p.blob(topX + fx, topY + fy, rx, ry, frondPal, 0.2, s);
  }
  // Golden dates cluster under crown
  p.set(topX - 2, topY + 2, 0xf59e0b);
  p.set(topX + 2, topY + 2, 0xd97706);
  p.outline();
  p.shadow(cx + 2, base + 1, 14, 4);
  return d;
};

export const tropicalPlant = (): SpriteDef => {
  const [p, d] = sprite(34, 34);
  const cx = 17, base = gc(34);
  const trop = [0x146c43, 0x1ea362, 0x38cf82, 0x7ef2b2];
  p.blob(cx - 5, base - 7, 7, 5.5, trop, 0.2, 101);
  p.blob(cx + 5, base - 7, 7, 5.5, trop, 0.2, 102);
  p.blob(cx, base - 11, 7.5, 6.5, trop, 0.2, 103);
  // Bright hibiscus & bird-of-paradise blooms
  p.ellipse(cx - 4, base - 11, 2.8, 2.5, 0xf43f5e);
  p.set(cx - 4, base - 11, 0xfef08a);
  p.ellipse(cx + 4, base - 9, 2.6, 2.2, 0xf97316);
  p.set(cx + 4, base - 9, 0xfef08a);
  p.set(cx, base - 15, 0xec4899);
  p.outline();
  p.shadow(cx + 1, base + 1, 11, 3);
  return d;
};

export const coconutTree = (): SpriteDef => {
  const [p, d] = sprite(48, 62);
  const cx = 24, base = gc(62);
  // Coastal leaning trunk
  for (let y = 0; y < 29; y++) {
    const t = y / 28;
    const xOff = Math.round(Math.sin(t * Math.PI * 0.75) * -4);
    const w = Math.max(2, Math.round(3.5 - t * 1.4));
    for (let dx = -w; dx <= w; dx++) {
      const c = y % 4 === 0 ? PALM_WOOD[0] : dx < 0 ? PALM_WOOD[3] : PALM_WOOD[2];
      p.set(cx + xOff + dx, base - y, c);
    }
  }
  const topX = cx - 3, topY = base - 30;
  const palm = [0x22783c, 0x36a152, 0x58c96c, 0x98eb9e];
  for (const [fx, fy, rx, ry, s] of [
    [-11, -2, 10, 4.5, 104],
    [11, -2, 10, 4.5, 105],
    [-7, -8, 9, 4, 106],
    [7, -8, 9, 4, 107],
    [0, -10, 8, 4, 108],
  ] as const) {
    p.blob(topX + fx, topY + fy, rx, ry, palm, 0.2, s);
  }
  // Three plump brown coconuts under the fronds
  p.ellipse(topX - 2, topY + 2, 2.2, 2.2, 0x5c3418);
  p.ellipse(topX + 2, topY + 2, 2.2, 2.2, 0x784421);
  p.ellipse(topX, topY + 3, 2.2, 2.2, 0x472610);
  p.outline();
  p.shadow(cx + 1, base + 1, 14, 4);
  return d;
};

export { darken, lighten };
