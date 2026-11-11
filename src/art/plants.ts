import type { PlantId } from '../core/types';
import { Pix, ramp, darken, lighten, noise } from './pix';
import { GREEN, LEAF_DARK, type SpriteDef } from './nature';

const W = 30, H = 50;
const cx = 15, gy = H - 8;

const mound = (p: Pix, r = 5, col = 0x9a6a46) => {
  const dirt = ramp(col);
  p.blob(cx, gy - 1, r + 2, 3, dirt, 0.2, 5);
};
const leaf = (p: Pix, x: number, y: number, dir: number, len: number, pal = GREEN) => {
  for (let i = 0; i < len; i++) {
    const yy = y - Math.round(i * 0.45);
    const xx = x + dir * i;
    p.set(xx, yy, pal[2]);
    if (i > 0 && i < len - 1) p.set(xx, yy - 1, pal[3]);
    if (i > 1) p.set(xx, yy + 1, pal[1]);
  }
};
const stem = (p: Pix, x: number, y0: number, h: number, lean = 0, col = 0x4a9a42) => {
  for (let i = 0; i < h; i++) p.set(x + Math.round(lean * (i / h)), y0 - i, i % 4 === 3 ? darken(col, 0.15) : col);
};
const petals = (p: Pix, x: number, y: number, r: number, col: number, center: number, n = 8) => {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.8;
    p.ellipse(px, py, 1.6, 1.6, col);
  }
  p.ellipse(x, y, r * 0.55 + 0.5, r * 0.5 + 0.5, center);
  p.set(x - 1, y - 1, lighten(center, 0.4));
};

export const plantSprite = (id: PlantId, stage: number): SpriteDef => {
  const p = new Pix(W, H);
  mound(p);
  if (stage === 0) {
    p.set(cx - 1, gy - 4, 0xd8c08a); p.set(cx, gy - 4, 0xb89860); p.set(cx + 1, gy - 5, 0x7a5a3a);
    p.outline();
    return { pix: p, ax: cx };
  }
  const hs = [0, 6, 11, 16, 20][stage];
  switch (id) {
    case 'daisy':
      stem(p, cx, gy - 2, hs);
      leaf(p, cx, gy - 3, -1, stage + 2); leaf(p, cx, gy - 5, 1, stage + 2);
      if (stage === 3) { p.ellipse(cx, gy - 2 - hs - 1, 1.6, 2, 0xf6f0d8); }
      if (stage === 4) petals(p, cx, gy - 2 - hs - 2, 4, 0xfffaf0, 0xffd84a);
      break;
    case 'sunflower': {
      // H = 50 -> bloom center sits cleanly inside y = 11 with radius 7.6px (zero top clipping!)
      const h = [0, 8, 15, 22, 26][stage];
      stem(p, cx, gy - 2, h, 0);
      stem(p, cx + 1, gy - 2, h, 0, 0x3a7a3a);
      leaf(p, cx, gy - 5, -1, stage + 2); leaf(p, cx + 1, gy - 8, 1, stage + 2);
      if (stage >= 3) leaf(p, cx, gy - 12, -1, 5);
      if (stage === 3) p.ellipse(cx, gy - 2 - h - 1, 2.5, 3, 0x7ab84a);
      if (stage === 4) petals(p, cx, gy - 2 - h - 3, 6, 0xffd23a, 0x6a4326, 12);
      break;
    }
    case 'bluebell': {
      const h = [0, 7, 12, 17, 21][stage];
      stem(p, cx, gy - 2, h, 3);
      leaf(p, cx, gy - 3, -1, stage + 2); leaf(p, cx, gy - 4, 1, stage + 1);
      if (stage >= 3) {
        const tx = cx + 3;
        const col = stage === 4 ? 0x7a9cff : 0xb6c8ff;
        for (let i = 0; i < (stage === 4 ? 4 : 2); i++) {
          const bx = tx + (i % 2 ? 2 : -2), by = gy - 2 - h + 3 + i * 3;
          p.set(bx, by - 1, 0x4a9a42);
          p.rect(bx - 1, by, 3, 2, col);
          p.set(bx - 2, by + 2, col); p.set(bx + 2, by + 2, col); p.set(bx, by + 2, lighten(col, 0.4));
        }
      }
      break;
    }
    case 'mushroom': {
      const caps = [0, 3, 5, 7, 8][stage];
      const stemH = [0, 3, 4, 5, 6][stage];
      p.rect(cx - 1, gy - 2 - stemH, 3, stemH, 0xf3e6c8);
      p.set(cx + 1, gy - 2 - stemH + 1, 0xd9c8a0);
      const col = stage === 4 ? ramp(0xe84a4a) : stage === 3 ? ramp(0xd96a4a) : ramp(0xb8845a);
      p.blob(cx, gy - 2 - stemH - 1, caps, caps * 0.7, col, 0.12, 8);
      if (stage >= 3) { p.set(cx - 2, gy - 2 - stemH - 3, 0xfff6e0); p.set(cx + 2, gy - 2 - stemH - 2, 0xfff6e0); }
      if (stage === 4) { p.set(cx, gy - 2 - stemH - 5, 0xfff6e0); p.set(cx - 4, gy - 2 - stemH - 1, 0xfff6e0); p.set(cx + 4, gy - 2 - stemH - 2, 0xfff6e0); }
      break;
    }
    case 'berry': {
      const r = [0, 3, 5, 7, 8][stage];
      p.blob(cx - r * 0.5, gy - 3 - r * 0.5, r, r * 0.8, LEAF_DARK, 0.2, 12);
      p.blob(cx + r * 0.5, gy - 3 - r * 0.5, r, r * 0.8, LEAF_DARK, 0.2, 13);
      p.blob(cx, gy - 4 - r * 0.8, r, r * 0.9, GREEN, 0.22, 14);
      const berries = stage === 4 ? 9 : stage === 3 ? 4 : 0;
      for (let i = 0; i < berries; i++) {
        const bx = cx - 6 + Math.floor(noise(i, 9, 2) * 12), by = gy - 4 - r * 1.2 + Math.floor(noise(i, 8, 2) * r * 1.4);
        p.set(bx, by, 0xe83a5a); p.set(bx + 1, by, 0xb82444); p.set(bx, by - 1, 0xff8aa0);
      }
      break;
    }
    case 'glowflower': {
      const h = [0, 7, 12, 17, 20][stage];
      stem(p, cx, gy - 2, h, 0, 0x3a9a7a);
      leaf(p, cx, gy - 4, -1, stage + 2, ramp(0x3a9a7a)); leaf(p, cx, gy - 6, 1, stage + 2, ramp(0x3a9a7a));
      if (stage === 3) p.ellipse(cx, gy - 2 - h - 1, 2.5, 3, 0x7ad0e8);
      if (stage === 4) {
        petals(p, cx, gy - 2 - h - 3, 5, 0x8ae8f0, 0xfff6a8, 7);
        for (const [dx, dy] of [[-7, -3], [8, -6], [-4, 4]]) p.set(cx + dx, gy - 2 - h + dy, 0xe8ffff);
      }
      break;
    }
    case 'waterlily': {
      const r = [0, 4, 6, 8, 9][stage];
      p.ellipse(cx, gy - 2, r, r * 0.45, 0x3e8e41);
      p.ellipse(cx, gy - 2, r - 1, (r - 1) * 0.45, 0x4a9a42);
      for (let i = 0; i < 4; i++) p.set(cx + i, gy - 2, 0x9a6a46);
      if (stage === 1) p.ellipse(cx, gy - 4, 1.5, 2, 0xffb6c1);
      if (stage === 2) p.ellipse(cx, gy - 5, 2.5, 3, 0xff8fb3);
      if (stage === 3) {
        p.ellipse(cx, gy - 6, 3.5, 4, 0xff8fb3);
        p.ellipse(cx, gy - 6, 2, 2.5, 0xffd1dc);
      }
      if (stage === 4) {
        petals(p, cx, gy - 7, 5, 0xff8fb3, 0xffd84a, 8);
        petals(p, cx, gy - 7, 3, 0xfff0f5, 0xffd84a, 6);
        p.set(cx, gy - 7, 0xffffff);
      }
      break;
    }
    case 'moonflower': {
      const h = [0, 8, 14, 19, 23][stage];
      stem(p, cx, gy - 2, h, -1, 0x475569);
      leaf(p, cx, gy - 4, -1, stage + 2, ramp(0x64748b));
      leaf(p, cx, gy - 7, 1, stage + 2, ramp(0x64748b));
      if (stage === 3) p.ellipse(cx - 1, gy - 2 - h - 1, 2.5, 3, 0xa5b4fc);
      if (stage === 4) {
        petals(p, cx - 1, gy - 2 - h - 3, 5.5, 0xc4b5fd, 0xe0e7ff, 6);
        petals(p, cx - 1, gy - 2 - h - 3, 3, 0xe0e7ff, 0xffffff, 5);
        for (const [dx, dy] of [[-6, -5], [6, -4], [-2, 5], [5, 4]]) p.set(cx + dx, gy - 2 - h + dy, 0xf5f3ff);
      }
      break;
    }
    case 'starbloom': {
      const h = [0, 8, 13, 18, 22][stage];
      stem(p, cx, gy - 2, h, 0, 0x15803d);
      leaf(p, cx, gy - 5, -1, stage + 3, ramp(0x16a34a));
      leaf(p, cx, gy - 8, 1, stage + 3, ramp(0x16a34a));
      if (stage === 3) p.ellipse(cx, gy - 2 - h - 1, 3, 3, 0xfde047);
      if (stage === 4) {
        const topY = gy - 2 - h - 3;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const tipX = cx + Math.cos(a) * 6, tipY = topY + Math.sin(a) * 6;
          p.line(cx, topY, Math.round(tipX), Math.round(tipY), 0xfde047);
          p.ellipse(tipX, tipY, 1.5, 1.5, 0xfef08a);
        }
        p.ellipse(cx, topY, 2.8, 2.8, 0xf97316);
        p.set(cx, topY, 0xffffff);
        for (const [dx, dy] of [[-7, -2], [7, -6], [-5, 6], [6, 5]]) p.set(cx + dx, topY + dy, 0xfef9c3);
      }
      break;
    }
    case 'frostberry': {
      const frost = ramp(0x60a5fa);
      const r = [0, 3, 5, 7, 8][stage];
      p.blob(cx - r * 0.5, gy - 3 - r * 0.5, r, r * 0.8, ramp(0x2563eb), 0.2, 16);
      p.blob(cx + r * 0.5, gy - 3 - r * 0.5, r, r * 0.8, ramp(0x3b82f6), 0.2, 17);
      p.blob(cx, gy - 4 - r * 0.8, r, r * 0.9, frost, 0.22, 18);
      if (stage >= 3) {
        for (const [dx, dy] of [[-4, -2], [4, -4], [0, -6], [-2, 1], [3, 0]].slice(0, stage === 4 ? 5 : 2)) {
          p.set(cx + dx, gy - 4 - r * 0.7 + dy, 0xe0f2fe);
          p.set(cx + dx + 1, gy - 4 - r * 0.7 + dy, 0x38bdf8);
        }
      }
      break;
    }
    case 'mistorchid': {
      const h = [0, 7, 13, 18, 22][stage];
      stem(p, cx, gy - 2, h, -2, 0x166534);
      leaf(p, cx, gy - 4, -1, stage + 2, ramp(0x22c55e));
      leaf(p, cx, gy - 7, 1, stage + 2, ramp(0x22c55e));
      if (stage === 3) p.ellipse(cx - 2, gy - 2 - h - 1, 2.5, 3, 0xd8b4fe);
      if (stage === 4) {
        petals(p, cx - 2, gy - 2 - h - 3, 5, 0xa855f7, 0xf5d0fe, 5);
        petals(p, cx + 2, gy - 2 - h + 2, 3.6, 0xc084fc, 0xfef08a, 5);
      }
      break;
    }
    case 'emberpepper': {
      const r = [0, 3, 5, 6.5, 7.5][stage];
      p.blob(cx, gy - 4 - r * 0.7, r, r * 0.9, ramp(0x2d6a4f), 0.2, 22);
      const count = stage === 4 ? 6 : stage === 3 ? 3 : 0;
      for (let i = 0; i < count; i++) {
        const px = cx - 5 + Math.round((i / Math.max(1, count - 1)) * 10);
        const py = gy - 4 - Math.round(r * (0.4 + (i % 2) * 0.5));
        p.rect(px, py, 2, 3, 0xf97316);
        p.set(px, py + 2, 0xdc2626);
        p.set(px + 1, py, 0xfef08a);
      }
      break;
    }
    case 'novabloom': {
      const h = [0, 8, 14, 20, 24][stage];
      stem(p, cx, gy - 2, h, 0, 0x312e81);
      leaf(p, cx, gy - 5, -1, stage + 2, ramp(0x4338ca));
      leaf(p, cx, gy - 8, 1, stage + 2, ramp(0x4338ca));
      if (stage === 3) p.ellipse(cx, gy - 2 - h - 1, 3, 3, 0x818cf8);
      if (stage === 4) {
        const topY = gy - 2 - h - 4;
        petals(p, cx, topY, 6, 0x6366f1, 0xe0e7ff, 8);
        petals(p, cx, topY, 3.4, 0xf472b6, 0xfef08a, 6);
        p.set(cx, topY, 0xffffff);
      }
      break;
    }
    case 'everdream_lotus': {
      const r = [0, 4, 6, 8, 9][stage];
      p.ellipse(cx, gy - 2, r, r * 0.45, 0x0f766e);
      p.ellipse(cx, gy - 2, r - 1, (r - 1) * 0.45, 0x14b8a6);
      if (stage >= 2) p.ellipse(cx, gy - 6, 2 + stage * 0.6, 2 + stage * 0.6, 0xf472b6);
      if (stage === 4) {
        petals(p, cx, gy - 8, 6, 0xf472b6, 0xfef08a, 10);
        petals(p, cx, gy - 8, 3.6, 0x93c5fd, 0xffffff, 6);
        p.set(cx - 5, gy - 12, 0xfef9c3);
        p.set(cx + 5, gy - 12, 0xe0f2fe);
      }
      break;
    }
  }
  p.outline();
  p.shadow(cx + 1, gy, 7, 2.4, 50);
  return { pix: p, ax: cx };
};
