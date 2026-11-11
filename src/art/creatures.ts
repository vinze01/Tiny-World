import type { CreatureId } from '../core/types';
import type { Anim } from '../core/creatureAI';
import { Pix, ramp, lighten, darken, mixc, noise } from './pix';

export const FRAME = 28;
const CX = 14;
const GROUND = 25;

type Eyes = 'open' | 'blink' | 'closed' | 'happy' | 'wide' | 'half';
type Mouth = 'none' | 'smile' | 'open' | 'nom' | 'o' | 'tiny';

export interface Pose {
  sq: number;
  hop: number;
  tilt: number;
  eyes: Eyes;
  mouth: Mouth;
  ear: number;
  tail: number;
  arms: boolean;
  dx: number;
  feet: number;
}
const P = (o: Partial<Pose> = {}): Pose => ({ sq: 1, hop: 0, tilt: 0, eyes: 'open', mouth: 'none', ear: 0, tail: 0, arms: false, dx: 0, feet: 0, ...o });

interface Species {
  rx: number;
  ry: number;
  body: number;
  belly: number;
  cheek: number;
  fuzz: number;
}
export const SPECIES: Record<CreatureId, Species> = {
  mossi: { rx: 8, ry: 7, body: 0x78c868, belly: 0xcdeea4, cheek: 0xff9aa8, fuzz: 0.1 },
  bloop: { rx: 9, ry: 8.5, body: 0x58b6f0, belly: 0xa8e2fa, cheek: 0xff9ac8, fuzz: 0.05 },
  ember: { rx: 7, ry: 6.3, body: 0xf29a4c, belly: 0xffe2b4, cheek: 0xff7a7a, fuzz: 0.1 },
  puffin: { rx: 9.5, ry: 7.5, body: 0xf6e6c8, belly: 0xfffaf0, cheek: 0xff9aa8, fuzz: 0.32 },
  sprig: { rx: 6.2, ry: 5.6, body: 0xf0d8bc, belly: 0xfff0e0, cheek: 0xff9aa8, fuzz: 0.1 },
  frosty: { rx: 7.6, ry: 6.8, body: 0x7cc8f8, belly: 0xe6f7ff, cheek: 0x99d8ff, fuzz: 0.08 },
  nimbus: { rx: 9.2, ry: 7.2, body: 0xe8f2ff, belly: 0xffffff, cheek: 0xffb4c8, fuzz: 0.38 },
  glimmer: { rx: 7.4, ry: 6.8, body: 0xa87ef0, belly: 0xeadcff, cheek: 0xff96d6, fuzz: 0.06 },
  cinder: { rx: 7.5, ry: 6.6, body: 0xd95838, belly: 0xfcb88a, cheek: 0xffa858, fuzz: 0.12 },
  luna: { rx: 7.2, ry: 6.5, body: 0x4c4886, belly: 0xc8ccf8, cheek: 0xf4a8c8, fuzz: 0.12 },
  pebble: { rx: 8.6, ry: 6.6, body: 0x869a74, belly: 0xcce0b8, cheek: 0xf49a9a, fuzz: 0.05 },
  wisp: { rx: 7.2, ry: 6.8, body: 0x94e2c6, belly: 0xdcfef2, cheek: 0xffb2d4, fuzz: 0.15 },
  astra: { rx: 7.4, ry: 6.7, body: 0xf4c848, belly: 0xfff6c2, cheek: 0xff8a7a, fuzz: 0.08 },
  flurry: { rx: 7.8, ry: 7.0, body: 0xf4a6be, belly: 0xffeef4, cheek: 0xff6e96, fuzz: 0.24 },
  bloom: { rx: 8.0, ry: 7.2, body: 0xf28db8, belly: 0xffe4f0, cheek: 0xffca68, fuzz: 0.15 },
};

const DARK = 0x2a2236;

const drawEyes = (p: Pix, id: CreatureId, x1: number, x2: number, y: number, eyes: Eyes) => {
  const shy = id === 'sprig';
  const both = (fn: (x: number) => void) => { fn(x1); fn(x2); };
  switch (eyes) {
    case 'open':
      both((x) => { p.rect(x, y, 2, shy ? 2 : 3, DARK); p.set(x, y, 0xffffff); });
      break;
    case 'wide':
      both((x) => { p.rect(x - 0, y - 1, 3, 4, DARK); p.set(x, y - 1, 0xffffff); p.set(x + 1, y, 0xffffff); });
      break;
    case 'half':
      both((x) => { p.rect(x, y + 1, 2, 2, DARK); p.set(x, y + 1, 0xdedede); });
      break;
    case 'blink':
      both((x) => { p.rect(x, y + 1, 2, 1, DARK); });
      break;
    case 'closed':
      both((x) => { p.rect(x, y + 1, 3, 1, DARK); p.set(x - 0, y, DARK); p.set(x + 2, y, DARK); });
      break;
    case 'happy':
      both((x) => { p.set(x, y + 2, DARK); p.set(x + 1, y + 1, DARK); p.set(x + 2, y + 2, DARK); p.set(x + 1, y, DARK); });
      break;
  }
}
const drawMouth = (p: Pix, x: number, y: number, m: Mouth) => {
  switch (m) {
    case 'smile': p.set(x - 1, y, DARK); p.set(x, y + 1, DARK); p.set(x + 1, y, DARK); break;
    case 'tiny': p.set(x, y + 1, DARK); p.set(x + 1, y + 1, DARK); break;
    case 'open': p.rect(x - 1, y, 3, 2, DARK); p.set(x, y + 1, 0xff7a8a); break;
    case 'nom': p.rect(x - 1, y + 1, 3, 1, DARK); p.set(x - 2, y, DARK); p.set(x + 2, y, DARK); break;
    case 'o': p.rect(x, y, 2, 2, DARK); break;
    default: break;
  }
}

export const drawPipkin = (id: CreatureId, pose: Pose): Pix => {
  const p = new Pix(FRAME, FRAME);
  const s = SPECIES[id];
  const rx = s.rx * (1 + (1 - pose.sq) * 0.75);
  const ry = s.ry * pose.sq;
  const hop = Math.round(pose.hop);
  const cx = CX + pose.dx;
  const cy = GROUND - ry - hop - (id === 'bloop' ? 0.2 : 0);
  const pal = ramp(s.body);
  const headX = cx + pose.tilt * 0.5;

  // ---------- behind the body: tail & ears
  if (id === 'ember') {
    const tx = cx - rx - 1, ty = cy + 1 - pose.hop * 0;
    p.blob(tx - 1, ty + 1, 3.5, 2.5, ramp(0xd9783a), 0.1, 3);
    const fl = [0xffd84a, 0xffb43a, 0xfff2a8][pose.tail % 3];
    const lift = [0, 1, -1][pose.tail % 3];
    p.ellipse(tx - 4, ty - 1 + lift, 2.6, 3.4, 0xf0642a);
    p.ellipse(tx - 4, ty - 1 + lift, 1.7, 2.4, fl);
    p.set(tx - 4, ty - 4 + lift, 0xffb43a);
  }
  if (id === 'mossi') {
    const lp = ramp(0x4ea84a);
    const flap = pose.ear;
    for (const side of [-1, 1]) {
      const bx = headX + side * (rx * 0.62), by = cy - ry * 0.75;
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const ex = bx + side * (t * 4 + 1 + flap * side * 0.5);
        const ey = by - t * 6 + flap * t * 2 + (side === 1 ? 0 : 0);
        const wd = Math.sin(t * Math.PI) * 2.4 + 0.6;
        for (let k = -Math.round(wd); k <= Math.round(wd); k++) p.set(ex, ey + k * 0.5, k < 0 ? lp[3] : k > 0 ? lp[1] : lp[2]);
        p.set(ex, ey, lp[3]);
      }
    }
  }
  if (id === 'ember') {
    const ep = ramp(0xf29a4c);
    for (const side of [-1, 1]) {
      const bx = headX + side * rx * 0.55;
      p.poly([[bx - 2, cy - ry * 0.6], [bx + 2, cy - ry * 0.6], [bx + side * 1.5 + pose.ear * side * 0.6, cy - ry - 5]], side < 0 ? ep[2] : ep[1]);
      p.set(bx + side * 0.5, cy - ry - 1, 0xffd0a0);
    }
  }
  if (id === 'puffin') {
    const ep = ramp(0xf6e6c8);
    const droop = 2 + pose.ear;
    for (const side of [-1, 1]) {
      const bx = headX + side * (rx * 0.78);
      p.blob(bx + side * 1.5, cy - ry * 0.4 + droop * 0.4, 3.2, 6.5, ep, 0.3, side + 5);
      p.ellipse(bx + side * 1.5, cy - ry * 0.35 + droop * 0.4, 1.4, 4, 0xffc4cc);
    }
  }
  if (id === 'frosty') {
    for (const side of [-1, 1]) {
      const bx = headX + side * rx * 0.52;
      p.poly([[bx - 2, cy - ry * 0.65], [bx + 2, cy - ry * 0.65], [bx + side * 2, cy - ry - 5]], 0xb8e6ff);
      p.set(bx + side, cy - ry - 3, 0xffffff);
    }
  }
  if (id === 'luna') {
    const lp = ramp(0x3a356e);
    for (const side of [-1, 1]) {
      const bx = headX + side * rx * 0.56;
      p.poly([[bx - 2, cy - ry * 0.55], [bx + 2, cy - ry * 0.55], [bx + side * 2.5, cy - ry - 6]], lp[2]);
      p.set(bx + side, cy - ry - 2, 0xfef08a);
    }
  }
  if (id === 'cinder') {
    const tx = cx - rx - 1, ty = cy + 2;
    p.blob(tx - 2, ty, 3, 2.2, ramp(0x523438), 0.1, 4);
    p.ellipse(tx - 4, ty - 1 + (pose.tail % 2), 2, 2.6, 0xf97316);
    p.set(tx - 4, ty - 3 + (pose.tail % 2), 0xfef08a);
  }
  if (id === 'wisp') {
    const ty = cy + 2;
    p.ellipse(cx - rx - 1, ty, 2.5, 3, 0x6ee7b7);
    p.set(cx - rx - 3, ty + 2, 0xa7f3d0);
  }
  if (id === 'glimmer') {
    for (const side of [-1, 1]) {
      const ax = headX + side * 4;
      p.line(Math.round(ax), Math.round(cy - ry), Math.round(ax + side * 2), Math.round(cy - ry - 5), 0x8b5cf6);
      p.ellipse(ax + side * 2, cy - ry - 5, 1.5, 1.5, 0xf0abfc);
    }
  }
  if (id === 'astra') {
    for (const side of [-1, 1]) {
      const bx = headX + side * rx * 0.55;
      p.poly([[bx - 2, cy - ry * 0.6], [bx + 2, cy - ry * 0.6], [bx + side * 2, cy - ry - 5]], 0xfef08a);
    }
  }

  // ---------- body
  if (id === 'bloop') {
    // jelly dome with a flat base
    p.ellipseFn(cx, cy, rx, ry, (nx, ny, x, y) => {
      if (y > GROUND - hop - 0.5) return null;
      const t = -(nx * 0.55 + ny * 0.8);
      const edge = nx * nx + ny * ny;
      if (edge > 0.8 && t < -0.2) return pal[0];
      if (t > 0.55) return pal[3];
      if (t > -0.1) return pal[2];
      if (t > -0.6) return pal[1];
      return pal[0];
    });
    // wobbly lower rim
    for (let x = Math.round(cx - rx + 1); x < Math.round(cx + rx); x++) p.set(x, GROUND - hop - 1, pal[1]);
    p.set(cx - 5, cy - 4, 0xffffff); p.set(cx - 4, cy - 5, 0xffffff); p.set(cx - 6, cy - 3, 0xdff6ff);
    p.rect(cx + 3, cy - 5, 2, 1, lighten(pal[3], 0.5));
    // antenna droplet
    p.rect(cx - 1 + pose.tilt * 0.5, cy - ry - 3, 2, 3, pal[2]);
    p.ellipse(cx + pose.tilt * 0.5, cy - ry - 4, 2, 2, pal[3]);
    p.set(cx - 1 + pose.tilt * 0.5, cy - ry - 5, 0xffffff);
  } else {
    p.blob(cx, cy, rx, ry, pal, s.fuzz, 7 + id.length);
    // belly
    p.ellipseFn(cx + 1, cy + ry * 0.38, rx * 0.55, ry * 0.5, (nx, ny, x, y) => (noise(x, y, 1) > 0.15 ? s.belly : null));
  }

  // fluffy tufts for puffin & nimbus
  if (id === 'puffin' || id === 'nimbus') {
    for (const [dx, dy] of [[-9, 0], [9, -1], [-8, 4], [8, 4], [0, -8], [-4, -8], [4, -8]]) p.set(cx + dx, cy + dy, pal[3]);
  }
  if (id === 'nimbus') {
    p.ellipse(cx - rx - 1, cy, 2.5, 2.5, 0xffffff);
    p.ellipse(cx + rx + 1, cy, 2.5, 2.5, 0xe2e8f0);
  }
  if (id === 'pebble') {
    // mossy stone shell cap on top
    p.ellipseFn(headX, cy - ry * 0.4, rx * 0.9, ry * 0.55, (nx, ny) => (ny < 0.25 ? (nx + ny < 0 ? 0xa3b18a : 0x588157) : null));
    p.set(headX, cy - ry - 1, 0x84cc16);
    p.set(headX + 1, cy - ry - 2, 0xbef264);
  }

  // ---------- face
  const ey = Math.round(cy - ry * (id === 'sprig' ? -0.05 : 0.18));
  const gap = id === 'bloop' ? 6 : id === 'sprig' ? 4 : 5;
  const x1 = Math.round(headX - gap / 2 + 1);
  const x2 = x1 + gap;
  drawEyes(p, id, x1, x2, ey, pose.eyes);
  // cheeks
  const ck = s.cheek;
  p.set(x1 - 2, ey + 3, ck); p.set(x1 - 1, ey + 3, ck);
  p.set(x2 + 2, ey + 3, ck); p.set(x2 + 3, ey + 3, ck);
  drawMouth(p, Math.round((x1 + x2) / 2) + 1, ey + 4, pose.mouth);

  // ---------- species details on top
  if (id === 'sprig') {
    const capPal = ramp(0xd9514a);
    const capY = cy - ry * 0.55 - pose.hop * 0;
    p.ellipseFn(headX, capY - 3.5, 10.5, 6.5, (nx, ny, x, y) => {
      if (ny > 0.35) return null;
      const t = -(nx * 0.55 + ny * 0.8);
      if (t > 0.45) return capPal[3];
      if (t > -0.15) return capPal[2];
      if (t > -0.6) return capPal[1];
      return capPal[0];
    });
    p.rect(Math.round(headX - 10), Math.round(capY - 3), 21, 2, capPal[1]);
    for (const [dx, dy, r] of [[-5, -7, 1.6], [3, -9, 1.8], [7, -5, 1.4], [-1, -4, 1.2]] as const) p.ellipse(headX + dx, capY + dy, r, r, 0xfff3dc);
    p.set(headX + 9, capY - 9, 0x66bd47); p.set(headX + 10, capY - 10, 0x66bd47); p.set(headX + 10, capY - 9, 0x4a9a42);
  }
  if (id === 'mossi') {
    // tiny sprout tuft between ears
    p.set(headX, cy - ry - 1, 0x4ea84a); p.set(headX + 1, cy - ry - 2, 0x78c868); p.set(headX - 1, cy - ry - 2, 0x4ea84a);
  }
  if (id === 'frosty') {
    p.set(headX, cy - ry - 1, 0xffffff);
    p.set(headX - 1, ey - 3, 0x38bdf8);
    p.set(headX, ey - 4, 0xffffff);
    p.set(headX + 1, ey - 3, 0x38bdf8);
  }
  if (id === 'glimmer') {
    p.set(headX, ey - 3, 0xfef08a);
    p.set(headX - 1, ey - 2, 0xf0abfc);
  }
  if (id === 'luna') {
    p.set(headX, ey - 3, 0xfef08a);
    p.set(headX - 1, ey - 4, 0xfef08a);
  }
  if (id === 'flurry') {
    // cozy plum wool scarf + knit bobble
    p.rect(Math.round(cx - rx + 1), Math.round(cy + 2), Math.round(rx * 2 - 2), 3, 0x7e22ce);
    p.rect(Math.round(cx - 3), Math.round(cy + 4), 3, 3, 0xa855f7);
    p.ellipse(headX, cy - ry - 1, 2.5, 2, 0xc084fc);
    p.set(headX, cy - ry - 3, 0xffffff);
  }
  if (id === 'bloom') {
    // spring flower crown
    for (const [dx, col] of [[-4, 0xfef08a], [-1, 0xf472b6], [2, 0x60a5fa], [5, 0xfef08a]] as const) {
      p.ellipse(headX + dx, cy - ry + 0.5, 1.5, 1.5, col);
    }
  }
  if (id === 'astra') {
    p.set(cx - 2, cy + 2, 0xffffff);
    p.set(cx + 3, cy + 1, 0xfef08a);
  }
  if (id === 'cinder') {
    p.poly([[headX - 2, cy - ry], [headX + 2, cy - ry], [headX, cy - ry - 4]], 0xfbbf24);
  }

  // ---------- feet
  const feetMap: Partial<Record<CreatureId, number | null>> = {
    ember: 0xb8602a,
    mossi: 0x8a6a3c,
    bloop: null,
    wisp: null,
    sprig: 0xc8a07a,
    frosty: 0x38bdf8,
    cinder: 0x7c2d12,
    luna: 0x312e81,
    glimmer: 0x7e22ce,
    pebble: 0x4d7c0f,
    astra: 0xd97706,
    flurry: 0x9d174d,
    bloom: 0xdb2777,
  };
  const feetCol = id in feetMap ? feetMap[id] ?? null : 0xd8c4a0;
  if (feetCol !== null && hop < 2) {
    const a = pose.feet === 1 ? 1 : 0;
    p.rect(Math.round(cx - 4), GROUND - hop - 1, 3, 2 - a, feetCol);
    p.rect(Math.round(cx + 2), GROUND - hop - 1 + a, 3, 2 - a, feetCol);
  }
  if (pose.arms) {
    const ac = lighten(pal[2], 0.1);
    p.rect(Math.round(cx - rx - 1), Math.round(cy - 3), 2, 4, ac);
    p.rect(Math.round(cx + rx), Math.round(cy - 5), 2, 4, ac);
  }

  p.outline();
  // bloop gets a lighter inner outline so the jelly stays glossy
  const sh = 8 - hop * 0.8;
  p.shadow(cx + 1, GROUND + 0.5, Math.max(4, rx * 0.95 - hop * 0.3), 2.2, 70 * (sh / 8) + 20);
  return p;
}

// ------------------------------------------------------------------ animation sheet
export interface FrameDef { name: string; pose: Pose }
export const FRAME_DEFS: Record<Anim, Pose[]> = {
  idle: [P(), P({ sq: 0.955, feet: 0 }), P({ eyes: 'blink' })],
  walk: [P({ sq: 0.94, feet: 1, ear: 1, tail: 0 }), P({ sq: 1.07, hop: 2, tail: 1, ear: -1 }), P({ sq: 0.94, feet: 1, ear: 1, tail: 2 }), P({ sq: 1.04, hop: 1, tail: 0, ear: -1 })],
  sleep: [P({ sq: 0.9, eyes: 'closed', ear: 2, tail: 0 }), P({ sq: 0.945, eyes: 'closed', ear: 2, tail: 1 })],
  happy: [P({ sq: 0.88, eyes: 'happy', mouth: 'open' }), P({ sq: 1.12, hop: 5, eyes: 'happy', mouth: 'open', ear: -2, tail: 1 }), P({ sq: 1, hop: 2, eyes: 'happy', mouth: 'smile', ear: -1, tail: 2 })],
  curious: [P({ tilt: 3, eyes: 'wide', mouth: 'o', ear: -1, dx: 1 }), P({ tilt: -3, eyes: 'wide', mouth: 'tiny', ear: 1, dx: -1 })],
  interact: [P({ arms: true, mouth: 'smile', eyes: 'happy' }), P({ arms: true, sq: 0.95, mouth: 'smile', eyes: 'open', dx: 1 }), P({ arms: true, sq: 1.04, hop: 1, mouth: 'open', eyes: 'happy', tail: 1 })],
  eat: [P({ mouth: 'open', eyes: 'open' }), P({ mouth: 'nom', eyes: 'happy', sq: 0.96 }), P({ mouth: 'open', eyes: 'happy', sq: 1.03 })],
};

export const ANIM_ORDER: Anim[] = ['idle', 'walk', 'sleep', 'happy', 'curious', 'interact', 'eat'];
export const ANIM_RATES: Record<Anim, { rate: number; repeat: boolean; seq?: number[] }> = {
  idle: { rate: 2, repeat: true, seq: [0, 0, 1, 0, 0, 1, 0, 2] },
  walk: { rate: 9, repeat: true },
  sleep: { rate: 1.2, repeat: true },
  happy: { rate: 7, repeat: true, seq: [0, 1, 2, 1, 0, 1, 2, 1] },
  curious: { rate: 2.2, repeat: true },
  interact: { rate: 3.5, repeat: true },
  eat: { rate: 5, repeat: true, seq: [0, 1, 0, 1, 2, 1] },
};

export const buildCreatureSheet = (id: CreatureId) => {
  const frames: { name: string; x: number }[] = [];
  const total = ANIM_ORDER.reduce((a, k) => a + FRAME_DEFS[k].length, 0);
  const sheet = new Pix(total * FRAME, FRAME);
  let i = 0;
  for (const anim of ANIM_ORDER) {
    FRAME_DEFS[anim].forEach((pose, n) => {
      sheet.blit(drawPipkin(id, pose), i * FRAME, 0);
      frames.push({ name: `${anim}_${n}`, x: i * FRAME });
      i++;
    });
  }
  return { sheet, frames };
}

export { lighten, darken, mixc };
