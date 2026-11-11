import { Pix, ramp, lighten, darken, OUTLINE, noise } from './pix';
import type { SpriteDef } from './nature';

const sp = (w: number, h: number): [Pix, SpriteDef] => {
  const p = new Pix(w, h);
  return [p, { pix: p, ax: w / 2 }];
};
const from = (rows: string[], map: Record<string, number>): SpriteDef => {
  const p = new Pix(rows[0].length, rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (map[ch] !== undefined) p.set(x, y, map[ch]); }));
  return { pix: p, ax: p.w / 2 };
};

export const heart = (): SpriteDef => {
  return from([
    '.dd.dd.',
    'dppdppd',
    'dpwpppd',
    'dppppd.',
    '.dpppd.',
    '..dpd..',
    '...d...',
  ], { d: 0xb83a62, p: 0xff6a90, w: 0xffc4d4 });
}
export const sparkle = (): SpriteDef => {
  return from([
    '..y..',
    '..y..',
    'yywyy',
    '..y..',
    '..y..',
  ], { y: 0xffe27a, w: 0xffffff });
}
export const zzz = (): SpriteDef => {
  return from([
    'wwwww',
    '...w.',
    '..w..',
    '.w...',
    'wwwww',
  ], { w: 0xdfeaff });
}
export const drop = (): SpriteDef => {
  return from([
    '..b..',
    '.bbb.',
    'bbwbb',
    'bbbbb',
    '.bbb.',
  ], { b: 0x6ac6ee, w: 0xe8fbff });
}
export const leafFx = (): SpriteDef => {
  return from([
    '...gg',
    '..ggg',
    '.gglg',
    'gggg.',
    'dg...',
  ], { g: 0x66bd47, l: 0xaee67a, d: 0x3a7a3a });
}
export const note = (): SpriteDef => {
  return from([
    '..ww',
    '..w.',
    '..w.',
    'ww..',
    'ww..',
  ], { w: 0xfff2a8 });
}
export const question = (): SpriteDef => {
  return from([
    '.www.',
    'w...w',
    '...w.',
    '..w..',
    '.....',
    '..w..',
  ], { w: 0xffffff });
}
export const star = (): SpriteDef => {
  return from([
    '...y...',
    '...y...',
    '..yyy..',
    'yyyyyyy',
    '.yyyyy.',
    '..y.y..',
    '.y...y.',
  ], { y: 0xfff2a8 });
}
export const raindrop = (): SpriteDef => {
  return from(['b', 'b', 'b'], { b: 0xbfe8ff });
}
export const firefly = (): SpriteDef => {
  const p = new Pix(9, 9);
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    const d = Math.hypot(x - 4, y - 4);
    if (d < 4.2) p.set(x, y, 0xfff2a8, Math.round(255 * Math.pow(1 - d / 4.2, 1.6)));
  }
  p.set(4, 4, 0xffffff);
  return { pix: p, ax: 4.5 };
}
export const glow = (): SpriteDef => {
  const s = 64;
  const p = new Pix(s, s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const d = Math.hypot(x - s / 2 + 0.5, y - s / 2 + 0.5) / (s / 2);
    if (d < 1) p.set(x, y, 0xffffff, Math.round(255 * Math.pow(1 - d, 2.2)));
  }
  return { pix: p, ax: s / 2 };
}

export const butterfly = (frame: number): SpriteDef => {
  const open = frame === 0;
  return from(open
    ? ['p..k..p', 'ppp.k.ppp'.slice(0, 7), 'pwp.k.pwp'.slice(0, 7), '.pp...pp'.slice(0, 7), '..p...p.'.slice(0, 7)]
    : ['...k...', '..pkp..', '..pkp..', '..p.p..', '.......'],
  { p: 0xff9ac8, w: 0xffffff, k: 0x4a3a4e });
}

export const cloud = (kind: number): SpriteDef => {
  const pal = [0xaab8d6, 0xdbe3f2, 0xffffff, 0xffffff];
  const specs: [number, number, [number, number, number, number][]][] = [
    [72, 30, [[22, 18, 14, 9], [40, 14, 16, 11], [56, 19, 12, 8], [34, 22, 24, 7]]],
    [54, 24, [[16, 14, 11, 8], [32, 12, 12, 9], [42, 16, 9, 7], [28, 18, 18, 6]]],
    [40, 20, [[12, 12, 9, 7], [26, 10, 10, 8], [20, 15, 14, 5]]],
  ];
  const [w, h, blobs] = specs[kind % 3];
  const p = new Pix(w, h);
  for (const [x, y, rx, ry] of blobs) p.blob(x, y, rx, ry, pal, 0.06, kind + 3);
  return { pix: p, ax: w / 2 };
}

export const moon = (): SpriteDef => {
  const p = new Pix(22, 22);
  p.ellipse(11, 11, 8, 8, 0xfff6d0);
  p.ellipse(15, 8, 7, 7, 0);
  // carve a crescent by repainting transparent
  for (let y = 0; y < 22; y++) for (let x = 0; x < 22; x++) {
    const inBig = Math.hypot(x - 10.5, y - 11) <= 8;
    const inCut = Math.hypot(x - 14.5, y - 9) <= 7;
    p.set(x, y, 0, 0);
    if (inBig && !inCut) p.set(x, y, Math.hypot(x - 8, y - 9) < 4 ? 0xffffff : 0xfff0b8);
  }
  return { pix: p, ax: 11 };
}
export const sun = (): SpriteDef => {
  const p = new Pix(26, 26);
  p.ellipse(13, 13, 8, 8, 0xffe27a);
  p.ellipse(11, 11, 4, 4, 0xfff6c8);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    p.set(13 + Math.cos(a) * 11, 13 + Math.sin(a) * 11, 0xffd24a);
    p.set(13 + Math.cos(a) * 10, 13 + Math.sin(a) * 10, 0xffe27a);
  }
  return { pix: p, ax: 13 };
}

// ------------------------------------------------------------------ pickups
export const pickupSprite = (kind: string): SpriteDef => {
  switch (kind) {
    case 'gift':
      return from([
        '..rr.rr..',
        '.r..r..r.',
        '..rrrrr..',
        'bbbbrbbbb',
        'blllrllllb'.slice(0, 9),
        'bllrrrllb',
        'blllrllllb'.slice(0, 9),
        'bbbbrbbbb',
      ], { r: 0xe84a6a, b: 0x3a7ac8, l: 0x6ab0f0 });
    case 'stone':
      return from([
        '...ww...',
        '..wccw..',
        '.wcccdw.',
        'wcccwcdw',
        'wccdcddw',
        '.wdddww.',
        '..wwww..',
      ], { w: 0xe8ffff, c: 0x5ad8e0, d: 0x2c9ab8 });
    case 'rareflower':
      return from([
        '..pp.pp..',
        '.pppppp..'.slice(0, 9),
        '.ppwywpp.',
        '.pppyppp.',
        '..ppppp..',
        '...ggg...',
        '..g.g....',
        '....g.g..',
      ], { p: 0xc08af0, w: 0xfff0ff, y: 0xffd84a, g: 0x4a9a42 });
    case 'mushroom':
      return from([
        '..rrrr..',
        '.rwrrwr.',
        'rrrrrrrr',
        'rrwrrrrr',
        '...cc...',
        '...cc...',
        '..cccc..',
      ], { r: 0xe84a4a, w: 0xfff6e0, c: 0xf3e6c8 });
    case 'wish':
      return star();
    default:
      return coin(14);
  }
}

export const coin = (size = 14): SpriteDef => {
  const p = new Pix(size, size);
  const r = size / 2 - 0.5;
  const g = ramp(0xf2c14a);
  p.ellipseFn(size / 2, size / 2, r, r, (nx, ny) => {
    const t = -(nx * 0.55 + ny * 0.8);
    return t > 0.5 ? g[3] : t > -0.3 ? g[2] : t > -0.65 ? g[1] : g[0];
  });
  // leaf emblem
  const c = Math.floor(size / 2);
  const gl = 0x4a9a42;
  p.set(c - 1, c + 1, gl); p.set(c, c, gl); p.set(c + 1, c - 1, gl); p.set(c, c - 1, 0x66bd47); p.set(c - 1, c, 0x66bd47); p.set(c + 1, c, gl);
  p.set(c - 2, c - 2, 0xffffff);
  p.outline();
  return { pix: p, ax: size / 2 };
}

export const angryEmote = (): SpriteDef =>
  from([
    '.r...r.',
    'rr.r.rr',
    '..r.r..',
    'rr.r.rr',
    '.r...r.',
  ], { r: 0xef4444 });

export const sweatEmote = (): SpriteDef =>
  from([
    '..b..',
    '.bwb.',
    'bbbbb',
    'bbbbb',
    '.bbb.',
  ], { b: 0x38bdf8, w: 0xe0f2fe });

export const shyEmote = (): SpriteDef =>
  from([
    '.......',
    '.pp.pp.',
    'ppppppp',
    '.ppppp.',
  ], { p: 0xf472b6 });

export const musicEmote = (): SpriteDef =>
  from([
    '..yyyy',
    '..y..y',
    '..y..y',
    'yyy.yy',
    'yyy.yy',
  ], { y: 0xfef08a });

export const snowflakeFx = (): SpriteDef =>
  from([
    '.w.w.',
    'wccwc',
    '.wcw.',
    'wcwcw',
    '.w.w.',
  ], { w: 0xffffff, c: 0xbae6fd });

export const petalFx = (): SpriteDef =>
  from([
    '.pp.',
    'plpp',
    '.pp.',
  ], { p: 0xf9a8d4, l: 0xfdf2f8 });

export const emberFx = (): SpriteDef =>
  from([
    '.o.',
    'oyo',
    '.o.',
  ], { o: 0xf97316, y: 0xfef08a });

export const fogWispFx = (): SpriteDef => {
  const [p, d] = sp(44, 14);
  p.ellipseFn(22, 7, 20, 6, (nx, ny) => {
    const rad = Math.hypot(nx, ny);
    if (rad > 1) return null;
    return rad < 0.55 ? 0xf8fafc : 0xe2e8f0;
  });
  return d;
};

export { darken, lighten, noise, OUTLINE, sp };
