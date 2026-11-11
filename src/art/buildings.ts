import { Iso, Pix, darken, lighten, mixc, noise, ramp } from './pix';
import { GREEN, STONE, WOOD, type SpriteDef } from './nature';

interface HouseCfg {
  w: number;
  d: number;
  wallH: number;
  roofR: number;
  wall: number;
  trim: number;
  roof: number;
  stoneBase?: boolean;
  timber?: boolean;
  planks?: boolean;
  glass?: boolean;
  chimney?: boolean;
  chimneyAt?: { u: number; v: number };
  door?: { face: 'L' | 'R'; at: number } | number; // u/v centre
  windows?: { face: 'L' | 'R'; at: number }[];
  eave?: number;
  roofKind?: 'gable' | 'gable_v' | 'shed' | 'shed_u';
}

const R_ROOF = (c: number) => ramp(c);
const BRASS = ramp(0xf0c850);

const house = (cfg: HouseCfg): SpriteDef => {
  const { w, d, wallH: H, roofR: R } = cfg;
  const pad = 10;
  const W = (w + d) * 16 + pad * 2;
  const top = H + R + 16;
  const Hc = (w + d) * 8 + top;
  const p = new Pix(W, Hc);
  const ox = pad + d * 16;
  const oy = Hc - (w + d) * 8;
  const iso = new Iso(ox, oy);
  const P = (u: number, v: number, z: number) => iso.p(u, v, z);
  const o = cfg.eave ?? 0.18;
  const wallPal = ramp(cfg.wall);
  const trimPal = ramp(cfg.trim);
  const roofPal = R_ROOF(cfg.roof);

  const timberAt = (s: number, z: number) => {
    // s in cells along the face, z in px
    const fx = s - Math.floor(s);
    return cfg.timber && (fx < 0.08 || fx > 0.92 || (z > H * 0.55 && z < H * 0.55 + 2) || (z > H - 3));
  };
  const wallColor = (lit: number, s: number, z: number, x: number, y: number) => {
    if (cfg.stoneBase && z < 5) {
      const row = Math.floor(z / 2.5), col = Math.floor(s * 4 + (row % 2) * 0.5);
      const n = noise(col, row, 9);
      const b = n > 0.5 ? STONE[2] : STONE[1];
      return lit ? b : darken(b, 0.22);
    }
    if (cfg.planks) {
      const plank = Math.floor(s * 6);
      const edge = s * 6 - plank < 0.12;
      const b = edge ? wallPal[0] : noise(plank, 1, 3) > 0.5 ? wallPal[2] : wallPal[3];
      const c = noise(x, y, 5) > 0.93 ? darken(b, 0.18) : b;
      return lit ? c : darken(c, 0.28);
    }
    if (timberAt(s, z)) return lit ? trimPal[2] : trimPal[1];
    const grain = noise(x, y, 2) > 0.9 ? 1 : 0;
    const b = lit ? wallPal[3] : wallPal[2];
    return grain ? darken(b, 0.07) : b;
  };

  // ---- left face (v = d) lit, right face (u = w) shaded
  p.poly([P(0, d, H), P(w, d, H), P(w, d, 0), P(0, d, 0)], (x, y) => {
    const u = (x + 0.5 - ox) / 16 + d;
    const z = oy + (u + d) * 8 - (y + 0.5);
    return wallColor(1, u, z, x, y);
  });
  p.poly([P(w, 0, H), P(w, d, H), P(w, d, 0), P(w, 0, 0)], (x, y) => {
    const v = w - (x + 0.5 - ox) / 16;
    const z = oy + (w + v) * 8 - (y + 0.5);
    return wallColor(0, v, z, x, y);
  });

  const glassFace = (pts: [number, number][], tone: number) => p.poly(pts, (x, y) => {
    const n = noise(x >> 1, y >> 1, 4);
    return n > 0.7 ? lighten(tone, 0.5) : n > 0.25 ? tone : darken(tone, 0.12);
  });
  const windowL = (uc: number, wide = 0.2) => {
    const z0 = 9, z1 = 19;
    p.poly([P(uc - wide - 0.05, d, z1 + 1.5), P(uc + wide + 0.05, d, z1 + 1.5), P(uc + wide + 0.05, d, z0 - 1.5), P(uc - wide - 0.05, d, z0 - 1.5)], cfg.trim);
    glassFace([P(uc - wide, d, z1), P(uc + wide, d, z1), P(uc + wide, d, z0), P(uc - wide, d, z0)], 0x6ac6ee);
    const a = P(uc, d, z1), b = P(uc, d, z0);
    p.line(a[0], a[1], b[0], b[1], cfg.trim);
    const m1 = P(uc - wide, d, (z0 + z1) / 2), m2 = P(uc + wide, d, (z0 + z1) / 2);
    p.line(m1[0], m1[1], m2[0], m2[1], cfg.trim);
  };
  const windowR = (vc: number, wide = 0.2) => {
    const z0 = 9, z1 = 19;
    p.poly([P(w, vc - wide - 0.05, z1 + 1.5), P(w, vc + wide + 0.05, z1 + 1.5), P(w, vc + wide + 0.05, z0 - 1.5), P(w, vc - wide - 0.05, z0 - 1.5)], darken(cfg.trim, 0.25));
    glassFace([P(w, vc - wide, z1), P(w, vc + wide, z1), P(w, vc + wide, z0), P(w, vc - wide, z0)], 0x4a9acc);
    const a = P(w, vc, z1), b = P(w, vc, z0);
    p.line(a[0], a[1], b[0], b[1], darken(cfg.trim, 0.25));
    const m1 = P(w, vc - wide, (z0 + z1) / 2), m2 = P(w, vc + wide, (z0 + z1) / 2);
    p.line(m1[0], m1[1], m2[0], m2[1], darken(cfg.trim, 0.25));
  };
  for (const win of cfg.windows ?? []) (win.face === 'L' ? windowL : windowR)(win.at);

  if (cfg.door !== undefined) {
    const dFace = typeof cfg.door === 'object' ? cfg.door.face : 'L';
    const uc = typeof cfg.door === 'object' ? cfg.door.at : cfg.door;
    const hw = 0.2, dh = 15;
    const dp = ramp(0x5a6ec8);
    if (dFace === 'L') {
      p.poly([P(uc - hw - 0.05, d, dh + 2), P(uc + hw + 0.05, d, dh + 2), P(uc + hw + 0.05, d, 0), P(uc - hw - 0.05, d, 0)], cfg.trim);
      p.poly([P(uc - hw, d, dh), P(uc + hw, d, dh), P(uc + hw, d, 0), P(uc - hw, d, 0)], (x, y) => {
        const u = (x + 0.5 - ox) / 16 + d;
        const plank = Math.floor((u - (uc - hw)) * 12);
        return plank % 2 ? dp[2] : dp[1];
      });
      const k = P(uc + hw - 0.07, d, 7);
      p.set(k[0], k[1], 0xffd84a);
      // step
      p.poly([P(uc - hw - 0.1, d + 0.08, 1), P(uc + hw + 0.1, d + 0.08, 1), P(uc + hw + 0.1, d, 0), P(uc - hw - 0.1, d, 0)], STONE[2]);
    } else {
      // door on right face (u = w)
      p.poly([P(w, uc - hw - 0.05, dh + 2), P(w, uc + hw + 0.05, dh + 2), P(w, uc + hw + 0.05, 0), P(w, uc - hw - 0.05, 0)], darken(cfg.trim, 0.25));
      p.poly([P(w, uc - hw, dh), P(w, uc + hw, dh), P(w, uc + hw, 0), P(w, uc - hw, 0)], (x, y) => {
        const v = w - (x + 0.5 - ox) / 16;
        const plank = Math.floor((v - (uc - hw)) * 12);
        return plank % 2 ? darken(dp[2], 0.25) : darken(dp[1], 0.25);
      });
      const k = P(w, uc - hw + 0.07, 7);
      p.set(k[0], k[1], 0xffd84a);
      // step
      p.poly([P(w + 0.08, uc - hw - 0.1, 1), P(w + 0.08, uc + hw + 0.1, 1), P(w, uc + hw + 0.1, 0), P(w, uc - hw - 0.1, 0)], darken(STONE[2], 0.22));
    }
  }

  // ---- chimney (drawn before the roof so the slope hides its base)
  if (cfg.chimney) {
    const cu = cfg.chimneyAt?.u ?? w * 0.22;
    const cv = cfg.chimneyAt?.v ?? d * 0.32;
    const sp = ramp(0xa6a2ae);
    const cw = 0.28;
    const z0 = H + 2, z1 = H + R + 9;
    const faceFn = (lit: number) => (x: number, y: number) => {
      const n = noise(x >> 1, y >> 1, 12);
      const b = lit ? sp[2] : sp[1];
      return n > 0.6 ? lighten(b, 0.1) : n < 0.2 ? darken(b, 0.12) : b;
    };
    p.poly([P(cu, cv + cw, z1), P(cu + cw, cv + cw, z1), P(cu + cw, cv + cw, z0), P(cu, cv + cw, z0)], faceFn(1));
    p.poly([P(cu + cw, cv, z1), P(cu + cw, cv + cw, z1), P(cu + cw, cv + cw, z0), P(cu + cw, cv, z0)], faceFn(0));
    p.poly([P(cu, cv, z1), P(cu + cw, cv, z1), P(cu + cw, cv + cw, z1), P(cu, cv + cw, z1)], sp[3]);
    const c = P(cu + cw / 2, cv + cw / 2, z1);
    p.ellipse(c[0], c[1], 3, 1.4, 0x2a2236);
  }

  // ---- roof
  const kind = cfg.roofKind ?? 'gable';
  if (kind === 'gable') {
    const a = d / 2;
    const dv = a + o;
    const tiles = (x: number, y: number) => {
      const xr = (x + 0.5 - ox) / 16;
      const Y = (y + 0.5 - oy + H + R) / 8;
      const t = (Y - xr - 2 * a) / (2 * dv + (R + 2) / 8);
      const u = xr + a + t * dv;
      const rows = Math.max(3, Math.round(R / 3.2));
      const row = Math.floor(t * rows * 1.4);
      const col = Math.floor(u * 4.5 + (row % 2) * 0.5);
      const n = noise(col, row, 21);
      const edgeRow = t * rows * 1.4 - row < 0.22;
      let c: number = n > 0.7 ? roofPal[3] : n > 0.3 ? roofPal[2] : roofPal[1];
      if (edgeRow) c = roofPal[0];
      if (t > 0.94) c = roofPal[0];
      return c;
    };
    p.poly([P(-o, a, H + R), P(w + o, a, H + R), P(w + o, d + o, H - 2), P(-o, d + o, H - 2)], tiles);
    // ridge cap
    const r0 = P(-o, a, H + R), r1 = P(w + o, a, H + R);
    p.line(r0[0], r0[1], r1[0], r1[1], roofPal[3]);
    // gable end (right face) drawn as wall with roof trim
    p.poly([P(w, 0, H), P(w, d, H), P(w, a, H + R)], (x, y) => {
      const v = w - (x + 0.5 - ox) / 16;
      const z = oy + (w + v) * 8 - (y + 0.5);
      return wallColor(0, v, z, x, y);
    });
    const g0 = P(w, d, H), g1 = P(w, a, H + R), g2 = P(w, 0, H);
    p.line(g0[0], g0[1], g1[0], g1[1], trimPal[1]);
    p.line(g1[0], g1[1], g2[0], g2[1], trimPal[0]);
    // eave shadow line under roof
    const e0 = P(-o, d + o, H - 2), e1 = P(w + o, d + o, H - 2);
    p.line(e0[0], e0[1], e1[0], e1[1], roofPal[0]);
  } else if (kind === 'gable_v') {
    const a = w / 2;
    const du = a + o;
    const tiles = (x: number, y: number) => {
      const n = noise(x >> 1, y >> 1, 23);
      return n > 0.7 ? roofPal[3] : n > 0.3 ? roofPal[2] : roofPal[1];
    };
    p.poly([P(a, -o, H + R), P(a, d + o, H + R), P(w + o, d + o, H - 2), P(w + o, -o, H - 2)], tiles);
    // ridge cap
    const r0 = P(a, -o, H + R), r1 = P(a, d + o, H + R);
    p.line(r0[0], r0[1], r1[0], r1[1], roofPal[3]);
    // gable end (left face) drawn as wall with roof trim
    p.poly([P(0, d, H), P(w, d, H), P(a, d, H + R)], (x, y) => {
      const u = (x + 0.5 - ox) / 16 + d;
      const z = oy + (u + d) * 8 - (y + 0.5);
      return wallColor(1, u, z, x, y);
    });
    const g0 = P(0, d, H), g1 = P(a, d, H + R), g2 = P(w, d, H);
    p.line(g0[0], g0[1], g1[0], g1[1], trimPal[3]);
    p.line(g1[0], g1[1], g2[0], g2[1], trimPal[2]);
    // eave shadow line
    const e0 = P(w + o, -o, H - 2), e1 = P(w + o, d + o, H - 2);
    p.line(e0[0], e0[1], e1[0], e1[1], roofPal[0]);
  } else if (kind === 'shed_u') {
    // gable triangle on left face (v = d)
    p.poly([P(0, d, H), P(0, d, H + R), P(w, d, H)], (x, y) => {
      const u = (x + 0.5 - ox) / 16 + d;
      const z = oy + (u + d) * 8 - (y + 0.5);
      return wallColor(1, u, z, x, y);
    });
    const du = w + o;
    const tiles = (x: number, y: number) => {
      const n = noise(x >> 1, y >> 1, 31);
      return n > 0.6 ? roofPal[3] : n > 0.25 ? roofPal[2] : roofPal[1];
    };
    p.poly([P(-o, -o, H + R), P(-o, d + o, H + R), P(du, d + o, H), P(du, -o, H)], tiles);
    const e0 = P(du, -o, H), e1 = P(du, d + o, H);
    p.line(e0[0], e0[1], e1[0], e1[1], roofPal[0]);
    p.line(e1[0], e1[1], P(-o, d + o, H + R)[0], P(-o, d + o, H + R)[1], roofPal[0]);
  } else {
    // shed (slope along v down to front)
    p.poly([P(w, 0, H), P(w, 0, H + R), P(w, d, H)], (x, y) => {
      const v = w - (x + 0.5 - ox) / 16;
      const z = oy + (w + v) * 8 - (y + 0.5);
      return wallColor(0, v, z, x, y);
    });
    const dv = d + o;
    const tiles = (x: number, y: number) => {
      const n = noise(x >> 1, y >> 1, 31);
      return n > 0.6 ? roofPal[3] : n > 0.25 ? roofPal[2] : roofPal[1];
    };
    p.poly([P(-o, -o, H + R), P(w + o, -o, H + R), P(w + o, dv, H), P(-o, dv, H)], tiles);
    const e0 = P(-o, dv, H), e1 = P(w + o, dv, H);
    p.line(e0[0], e0[1], e1[0], e1[1], roofPal[0]);
    p.line(e1[0], e1[1], P(w + o, -o, H + R)[0], P(w + o, -o, H + R)[1], roofPal[0]);
  }

  p.outline();
  const c = P(w / 2, d / 2, 0);
  p.shadow(c[0] + 6, c[1] + 3, (w + d) * 9, (w + d) * 3.4, 60);
  return { pix: p, ax: ox + (w - d) * 16 };
};

export const cottage = (rot: 0 | 1 = 0): SpriteDef =>
  rot === 1
    ? house({
        w: 2, d: 2, wallH: 24, roofR: 20, wall: 0xf3e6c8, trim: 0x8a5a3c, roof: 0xc8553d, stoneBase: true, timber: true, chimney: true,
        chimneyAt: { u: 2 * 0.32, v: 2 * 0.22 },
        door: { face: 'R', at: 1.45 }, windows: [{ face: 'R', at: 0.55 }, { face: 'L', at: 0.55 }, { face: 'L', at: 1.45 }], eave: 0.2, roofKind: 'gable_v',
      })
    : house({
        w: 2, d: 2, wallH: 24, roofR: 20, wall: 0xf3e6c8, trim: 0x8a5a3c, roof: 0xc8553d, stoneBase: true, timber: true, chimney: true,
        door: { face: 'L', at: 1.45 }, windows: [{ face: 'L', at: 0.55 }, { face: 'R', at: 0.55 }, { face: 'R', at: 1.45 }], eave: 0.2, roofKind: 'gable',
      });

export const workshop = (rot: 0 | 1 = 0): SpriteDef =>
  rot === 1
    ? house({
        w: 2, d: 2, wallH: 22, roofR: 11, wall: 0xb9a98e, trim: 0x6a4a2e, roof: 0x6a7a9a, stoneBase: true, chimney: true, planks: true,
        chimneyAt: { u: 2 * 0.32, v: 2 * 0.22 },
        door: { face: 'R', at: 0.55 }, windows: [{ face: 'R', at: 1.45 }, { face: 'L', at: 1.0 }], eave: 0.14, roofKind: 'shed_u',
      })
    : house({
        w: 2, d: 2, wallH: 22, roofR: 11, wall: 0xb9a98e, trim: 0x6a4a2e, roof: 0x6a7a9a, stoneBase: true, chimney: true, planks: true,
        door: { face: 'L', at: 0.55 }, windows: [{ face: 'L', at: 1.45 }, { face: 'R', at: 1.0 }], eave: 0.14, roofKind: 'shed',
      });

export const shed = (rot: 0 | 1 = 0): SpriteDef =>
  rot === 1
    ? house({
        w: 1, d: 2, wallH: 17, roofR: 9, wall: 0xc9985c, trim: 0x6a4a2e, roof: 0x8a5a3c, planks: true,
        door: { face: 'R', at: 1.4 }, windows: [{ face: 'L', at: 0.5 }], eave: 0.14, roofKind: 'shed_u',
      })
    : house({
        w: 2, d: 1, wallH: 17, roofR: 9, wall: 0xc9985c, trim: 0x6a4a2e, roof: 0x8a5a3c, planks: true,
        door: { face: 'L', at: 1.4 }, windows: [{ face: 'R', at: 0.5 }], eave: 0.14, roofKind: 'shed',
      });

export const greenhouse = (rot: 0 | 1 = 0): SpriteDef => {
  const w = 2, d = 2, H = 17, R = 12;
  const pad = 10;
  const W = (w + d) * 16 + pad * 2;
  const Hc = (w + d) * 8 + H + R + 12;
  const p = new Pix(W, Hc);
  const ox = pad + d * 16, oy = Hc - (w + d) * 8;
  const iso = new Iso(ox, oy);
  const P = (u: number, v: number, z: number) => iso.p(u, v, z);
  // soil floor + plants inside
  p.poly([P(0.1, 0.1, 0), P(1.9, 0.1, 0), P(1.9, 1.9, 0), P(0.1, 1.9, 0)], 0x6a4a36);
  for (let i = 0; i < 16; i++) {
    const u = 0.35 + noise(i, 1, 40) * 1.3, v = 0.35 + noise(i, 2, 40) * 1.3;
    const [x, y] = P(u, v, 0);
    const col = [0x66bd47, 0x4a9a42, 0xff8fb3, 0xffd84a][i % 4];
    p.rect(x - 1, y - 5 - (i % 3), 3, 6 + (i % 3), 0x4a9a42);
    p.rect(x - 1, y - 7 - (i % 3), 3, 3, col);
  }
  const frame = 0xf3f1ea;
  const glass = (pts: [number, number][], tone: number) => p.poly(pts, (x, y) => ((x + y) % 5 === 0 ? null : noise(x >> 1, y >> 1, 4) > 0.75 ? lighten(tone, 0.45) : tone));
  glass([P(0, d, H), P(w, d, H), P(w, d, 0), P(0, d, 0)], 0xa6dcec);
  glass([P(w, 0, H), P(w, d, H), P(w, d, 0), P(w, 0, 0)], 0x7ec0da);
  for (let i = 0; i <= 4; i++) {
    const a = P(i * 0.5, d, H), b = P(i * 0.5, d, 0);
    p.line(a[0], a[1], b[0], b[1], frame);
    const c = P(w, i * 0.5, H), e = P(w, i * 0.5, 0);
    p.line(c[0], c[1], e[0], e[1], mixc(frame, 0x7a8aaa, 0.3));
  }
  for (const z of [0, 8, H]) {
    const a = P(0, d, z), b = P(w, d, z), c = P(w, 0, z);
    p.line(a[0], a[1], b[0], b[1], frame);
    p.line(b[0], b[1], c[0], c[1], mixc(frame, 0x7a8aaa, 0.3));
  }
  if (rot === 1) {
    // gable roof of glass along v
    const a = w / 2;
    glass([P(a, 0, H + R), P(a, d, H + R), P(w, d, H), P(w, 0, H)], 0xc4ecf6);
    p.poly([P(0, d, H), P(w, d, H), P(a, d, H + R)], (x, y) => ((x + y) % 4 === 0 ? null : 0x9ad0e4));
    for (let i = 0; i <= 4; i++) {
      const t = i * 0.5;
      const r0 = P(a, t, H + R), r1 = P(w, t, H);
      p.line(r0[0], r0[1], r1[0], r1[1], frame);
    }
    const rr0 = P(a, 0, H + R), rr1 = P(a, d, H + R);
    p.line(rr0[0], rr0[1], rr1[0], rr1[1], frame);
    p.line(P(0, d, H)[0], P(0, d, H)[1], P(a, d, H + R)[0], P(a, d, H + R)[1], frame);
    p.line(P(a, d, H + R)[0], P(a, d, H + R)[1], P(w, d, H)[0], P(w, d, H)[1], frame);
  } else {
    // gable roof of glass along u
    const a = d / 2;
    glass([P(0, a, H + R), P(w, a, H + R), P(w, d, H), P(0, d, H)], 0xc4ecf6);
    p.poly([P(w, 0, H), P(w, d, H), P(w, a, H + R)], (x, y) => ((x + y) % 4 === 0 ? null : 0x9ad0e4));
    for (let i = 0; i <= 4; i++) {
      const t = i * 0.5;
      const r0 = P(t, a, H + R), r1 = P(t, d, H);
      p.line(r0[0], r0[1], r1[0], r1[1], frame);
    }
    const rr0 = P(0, a, H + R), rr1 = P(w, a, H + R);
    p.line(rr0[0], rr0[1], rr1[0], rr1[1], frame);
    p.line(P(w, d, H)[0], P(w, d, H)[1], P(w, a, H + R)[0], P(w, a, H + R)[1], frame);
    p.line(P(w, a, H + R)[0], P(w, a, H + R)[1], P(w, 0, H)[0], P(w, 0, H)[1], frame);
  }
  // base trim
  p.poly([P(0, d, 3), P(w, d, 3), P(w, d, 0), P(0, d, 0)], 0xa38a6a);
  p.poly([P(w, 0, 3), P(w, d, 3), P(w, d, 0), P(w, 0, 0)], 0x7a6650);
  p.outline();
  const c = P(1, 1, 0);
  p.shadow(c[0] + 6, c[1] + 3, 34, 12, 55);
  return { pix: p, ax: ox };
};

export const shelter = (rot: 0 | 1 = 0): SpriteDef => {
  if (rot === 1) {
    const w = 1, d = 2;
    const p = new Pix(72, 56);
    const ox = 16 + 2 * 16;
    const oy = 56 - 24;
    const iso = new Iso(ox, oy);
    const [cx, cy] = iso.p(0.5, 1, 0);
    p.blob(cx, cy - 6, 22, 19, GREEN, 0.2, 101);
    p.blob(cx - 14, cy - 7, 10, 8, GREEN, 0.2, 102);
    p.blob(cx + 14, cy - 1, 10, 8, GREEN, 0.2, 103);
    const [dx, dy] = iso.p(1, 1.2, 0);
    p.ellipse(dx, dy - 2, 7, 9, WOOD[1]);
    p.ellipse(dx, dy - 1, 5, 7.5, 0x2a2236);
    p.rect(dx - 5, dy - 2, 2, 8, WOOD[2]);
    p.rect(dx + 4, dy - 2, 2, 8, WOOD[1]);
    p.rect(dx - 6, dy - 10, 13, 2, WOOD[3]);
    p.ellipse(dx, dy + 2, 3, 3, 0x6a4a50);
    for (const [x, y, c] of [[cx - 8, cy - 15, 0xff8fb3], [cx + 6, cy - 17, 0xfff6e0], [cx + 12, cy - 10, 0xffd84a], [cx - 14, cy - 8, 0xfff6e0]] as const) {
      p.set(x, y, c); p.set(x + 1, y, c); p.set(x, y - 1, c);
    }
    p.rect(cx - 2, cy - 20, 2, 3, 0xf3e6c8); p.ellipse(cx - 1, cy - 21, 3.5, 2.4, 0xe84a4a); p.set(cx - 2, cy - 22, 0xfff6e0);
    p.outline();
    p.shadow(cx + 4, cy + 11, 28, 8, 60);
    return { pix: p, ax: ox + (w - d) * 16 };
  }
  const w = 2, d = 1;
  const p = new Pix(72, 56);
  const iso = new Iso(16 + 16, 56 - 24);
  const [cx, cy] = iso.p(1, 0.5, 0);
  // mossy mound
  p.blob(cx, cy - 6, 27, 18, GREEN, 0.2, 101);
  p.blob(cx - 16, cy - 2, 10, 7, GREEN, 0.2, 102);
  p.blob(cx + 17, cy - 2, 10, 7, GREEN, 0.2, 103);
  // doorway arch on left-front side
  const dx = cx - 3, dy = cy + 2;
  p.ellipse(dx, dy, 8, 9, WOOD[1]);
  p.ellipse(dx, dy + 1, 6, 7.5, 0x2a2236);
  p.rect(dx - 7, dy, 2, 9, WOOD[2]);
  p.rect(dx + 6, dy, 2, 9, WOOD[1]);
  p.rect(dx - 8, dy - 8, 17, 2, WOOD[3]);
  // soft glow inside
  p.ellipse(dx, dy + 4, 3, 3, 0x6a4a50);
  // roof shingles / flowers
  for (const [x, y, c] of [[cx - 10, cy - 15, 0xff8fb3], [cx + 8, cy - 17, 0xfff6e0], [cx + 14, cy - 10, 0xffd84a], [cx - 18, cy - 8, 0xfff6e0]] as const) {
    p.set(x, y, c); p.set(x + 1, y, c); p.set(x, y - 1, c);
  }
  // tiny mushrooms on top
  p.rect(cx + 2, cy - 21, 2, 3, 0xf3e6c8); p.ellipse(cx + 3, cy - 22, 3.5, 2.4, 0xe84a4a); p.set(cx + 2, cy - 23, 0xfff6e0);
  p.outline();
  p.shadow(cx + 6, cy + 11, 31, 8, 60);
  return { pix: p, ax: 48 };
};

export const windmill = (rot: 0 | 1 = 0): SpriteDef => {
  const w = 2, d = 2, pad = 16;
  const W = (w + d) * 16 + pad * 2; // 96
  const Hc = 86;
  const p = new Pix(W, Hc);
  const ox = pad + d * 16; // 48
  const oy = Hc - (w + d) * 8 - 4; // 86 - 32 - 4 = 50
  const iso = new Iso(ox, oy);
  const P = (u: number, v: number, z: number) => iso.p(u, v, z);

  // Octagonal tapered stone & wood tower body
  const stonePal = ramp(0xc8c4bc);
  const woodPal = ramp(0xb88850);
  const roofPal = ramp(0x7a8aaa);

  // Lower stone base (z = 0 to 12)
  p.poly([P(0.3, d - 0.3, 12), P(w - 0.3, d - 0.3, 12), P(w - 0.2, d - 0.2, 0), P(0.2, d - 0.2, 0)], stonePal[2]);
  p.poly([P(w - 0.3, 0.3, 12), P(w - 0.3, d - 0.3, 12), P(w - 0.2, d - 0.2, 0), P(w - 0.2, 0.2, 0)], stonePal[1]);

  // Arched wooden door on left or right face
  if (rot === 1) {
    p.poly([P(w - 0.3, 0.6, 10), P(w - 0.3, 1.4, 10), P(w - 0.2, 1.4, 0), P(w - 0.2, 0.6, 0)], WOOD[1]);
    p.ellipse(P(w - 0.3, 1.0, 10)[0], P(w - 0.3, 1.0, 10)[1], 3, 2, WOOD[0]);
  } else {
    p.poly([P(0.6, d - 0.3, 10), P(1.4, d - 0.3, 10), P(1.4, d - 0.2, 0), P(0.6, d - 0.2, 0)], WOOD[2]);
    p.ellipse(P(1.0, d - 0.3, 10)[0], P(1.0, d - 0.3, 10)[1], 3, 2, WOOD[1]);
  }

  // Upper wooden tower (z = 12 to 32)
  p.poly([P(0.4, d - 0.4, 32), P(w - 0.4, d - 0.4, 32), P(w - 0.3, d - 0.3, 12), P(0.3, d - 0.3, 12)], (x, y) => {
    return (Math.floor(x / 3) % 2 === 0) ? woodPal[3] : woodPal[2];
  });
  p.poly([P(w - 0.4, 0.4, 32), P(w - 0.4, d - 0.4, 32), P(w - 0.3, d - 0.3, 12), P(w - 0.3, 0.3, 12)], (x, y) => {
    return (Math.floor(x / 3) % 2 === 0) ? woodPal[1] : woodPal[0];
  });

  // Windows
  if (rot === 1) {
    p.rect(P(w - 0.38, 1.0, 24)[0] - 2, P(w - 0.38, 1.0, 24)[1] - 4, 4, 6, 0x5a9ad6);
  } else {
    p.rect(P(1.0, d - 0.38, 24)[0] - 2, P(1.0, d - 0.38, 24)[1] - 4, 4, 6, 0x88ccff);
  }

  // Conical cap roof (z = 32 to 46)
  const apex = P(1, 1, 46);
  p.poly([apex, P(0.3, d - 0.3, 32), P(w - 0.3, d - 0.3, 32)], roofPal[2]);
  p.poly([apex, P(w - 0.3, d - 0.3, 32), P(w - 0.3, 0.3, 32)], roofPal[1]);

  // Sails (4 fabric blades around axle hub)
  const hub = rot === 1 ? P(w - 0.35, 1.0, 36) : P(1.0, d - 0.35, 36);
  const hx = hub[0], hy = hub[1];
  const sailLen = 22;

  // Draw 4 lattice sails with cream fabric
  const drawSail = (ang: number) => {
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const ex = hx + cos * sailLen, ey = hy + sin * sailLen * 0.85;
    p.line(hx, hy, ex, ey, WOOD[1]);
    // Sail cloth vane along one side of the spar
    const nx = -sin * 5, ny = cos * 4;
    p.poly([[hx + cos * 5, hy + sin * 5 * 0.85], [ex, ey], [ex + nx, ey + ny], [hx + cos * 5 + nx, hy + sin * 5 * 0.85 + ny]], 0xfffcf0);
    p.line(ex, ey, ex + nx, ey + ny, WOOD[0]);
  };

  const offset = rot === 1 ? Math.PI / 6 : Math.PI / 4;
  for (let i = 0; i < 4; i++) {
    drawSail(offset + (i * Math.PI) / 2);
  }
  // Center cap hub
  p.ellipse(hx, hy, 3, 3, BRASS[2]);
  p.ellipse(hx, hy, 1.5, 1.5, 0x3a2a30);

  p.outline();
  const c = P(1, 1, 0);
  p.shadow(c[0] + 6, c[1] + 3, 36, 13, 60);
  return { pix: p, ax: ox };
};

export const observatory = (rot: 0 | 1 = 0): SpriteDef => {
  const w = 2, d = 2, pad = 12;
  const W = (w + d) * 16 + pad * 2; // 88
  const Hc = 82;
  const p = new Pix(W, Hc);
  const ox = pad + d * 16;
  const oy = Hc - (w + d) * 8 - 4;
  const iso = new Iso(ox, oy);
  const P = (u: number, v: number, z: number) => iso.p(u, v, z);

  // Circular stone base tower
  const stonePal = ramp(0x7a8494);
  const copperPal = ramp(0x42968f);

  // Tower cylinder (z = 0 to 22)
  p.poly([P(0.2, d - 0.2, 22), P(w - 0.2, d - 0.2, 22), P(w - 0.2, d - 0.2, 0), P(0.2, d - 0.2, 0)], stonePal[2]);
  p.poly([P(w - 0.2, 0.2, 22), P(w - 0.2, d - 0.2, 22), P(w - 0.2, d - 0.2, 0), P(w - 0.2, 0.2, 0)], stonePal[1]);

  // Arched entrance door
  if (rot === 1) {
    p.poly([P(w - 0.2, 0.7, 12), P(w - 0.2, 1.3, 12), P(w - 0.2, 1.3, 0), P(w - 0.2, 0.7, 0)], WOOD[1]);
  } else {
    p.poly([P(0.7, d - 0.2, 12), P(1.3, d - 0.2, 12), P(1.3, d - 0.2, 0), P(0.7, d - 0.2, 0)], WOOD[2]);
  }

  // Stone gallery balcony cornice (z = 22 to 25)
  p.poly([P(0.1, d - 0.1, 25), P(w - 0.1, d - 0.1, 25), P(w - 0.1, d - 0.1, 22), P(0.1, d - 0.1, 22)], stonePal[3]);
  p.poly([P(w - 0.1, 0.1, 25), P(w - 0.1, d - 0.1, 25), P(w - 0.1, d - 0.1, 22), P(w - 0.1, 0.1, 22)], stonePal[2]);

  // Hemispherical copper dome (z = 25 to 44)
  const domeCenter = P(1, 1, 25);
  p.ellipse(domeCenter[0], domeCenter[1] - 8, 19, 17, copperPal[2]);
  p.ellipse(domeCenter[0] + 5, domeCenter[1] - 8, 12, 16, copperPal[1]);
  p.ellipse(domeCenter[0] - 5, domeCenter[1] - 12, 7, 7, copperPal[3]);

  // Telescope slit aperture and large brass refractor telescope pointing to the stars
  if (rot === 1) {
    p.poly([[domeCenter[0] + 2, domeCenter[1] - 22], [domeCenter[0] + 8, domeCenter[1] - 22], [domeCenter[0] + 8, domeCenter[1]], [domeCenter[0] + 2, domeCenter[1]]], 0x222230);
    // Telescope tube protruding out
    p.line(domeCenter[0] + 4, domeCenter[1] - 8, domeCenter[0] + 16, domeCenter[1] - 24, BRASS[2]);
    p.line(domeCenter[0] + 5, domeCenter[1] - 8, domeCenter[0] + 17, domeCenter[1] - 24, BRASS[3]);
    p.ellipse(domeCenter[0] + 17, domeCenter[1] - 24, 3, 3, 0xaae8ff);
  } else {
    p.poly([[domeCenter[0] - 8, domeCenter[1] - 22], [domeCenter[0] - 2, domeCenter[1] - 22], [domeCenter[0] - 2, domeCenter[1]], [domeCenter[0] - 8, domeCenter[1]]], 0x222230);
    // Telescope tube protruding out
    p.line(domeCenter[0] - 4, domeCenter[1] - 8, domeCenter[0] - 16, domeCenter[1] - 24, BRASS[2]);
    p.line(domeCenter[0] - 5, domeCenter[1] - 8, domeCenter[0] - 17, domeCenter[1] - 24, BRASS[3]);
    p.ellipse(domeCenter[0] - 17, domeCenter[1] - 24, 3, 3, 0xaae8ff);
  }

  p.outline();
  const c = P(1, 1, 0);
  p.shadow(c[0] + 6, c[1] + 3, 36, 13, 60);
  return { pix: p, ax: ox };
};

export const sanctuaryBell = (rot: 0 | 1 = 0): SpriteDef => {
  const w = 2, d = 2, pad = 12;
  const W = (w + d) * 16 + pad * 2; // 88
  const Hc = 84;
  const p = new Pix(W, Hc);
  const ox = pad + d * 16;
  const oy = Hc - (w + d) * 8 - 4;
  const iso = new Iso(ox, oy);
  const P = (u: number, v: number, z: number) => iso.p(u, v, z);

  // Elevated stone platform with steps
  p.poly([P(0.1, d - 0.1, 4), P(w - 0.1, d - 0.1, 4), P(w - 0.1, d - 0.1, 0), P(0.1, d - 0.1, 0)], STONE[2]);
  p.poly([P(w - 0.1, 0.1, 4), P(w - 0.1, d - 0.1, 4), P(w - 0.1, d - 0.1, 0), P(w - 0.1, 0.1, 0)], STONE[1]);
  p.poly([P(0.1, 0.1, 4), P(w - 0.1, 0.1, 4), P(w - 0.1, d - 0.1, 4), P(0.1, d - 0.1, 4)], STONE[3]);

  // 4 vermilion shrine pillars
  const PILLAR = ramp(0xc83a3a);
  const drawPillar = (u: number, v: number) => {
    p.poly([P(u - 0.08, v + 0.08, 26), P(u + 0.08, v + 0.08, 26), P(u + 0.08, v + 0.08, 4), P(u - 0.08, v + 0.08, 4)], PILLAR[2]);
    p.poly([P(u + 0.08, v - 0.08, 26), P(u + 0.08, v + 0.08, 26), P(u + 0.08, v + 0.08, 4), P(u + 0.08, v - 0.08, 4)], PILLAR[1]);
  };
  drawPillar(0.3, 0.3);
  drawPillar(1.7, 0.3);
  drawPillar(0.3, 1.7);
  drawPillar(1.7, 1.7);

  // Suspended golden temple bell in center
  const bellCenter = P(1, 1, 16);
  // Hanging chain/beam
  p.line(P(1, 1, 26)[0], P(1, 1, 26)[1], bellCenter[0], bellCenter[1] - 6, BRASS[1]);
  p.blob(bellCenter[0], bellCenter[1], 5.5, 7, BRASS, 0.1, 55);
  p.ellipse(bellCenter[0], bellCenter[1] + 5, 5, 2, BRASS[3]);
  p.ellipse(bellCenter[0], bellCenter[1] + 6, 2, 1, 0x3a2a20);

  // Tiered pagoda roof with upward flaring eaves
  const roofDark = ramp(0x323a48);
  const apex = P(1, 1, 44);

  // Eave flare corners
  p.poly([apex, P(-0.2, d + 0.2, 26), P(w + 0.2, d + 0.2, 26)], roofDark[2]);
  p.poly([apex, P(w + 0.2, d + 0.2, 26), P(w + 0.2, -0.2, 26)], roofDark[1]);
  // Golden roof finial
  p.ellipse(apex[0], apex[1] - 2, 2.5, 5, BRASS[3]);
  p.set(apex[0], apex[1] - 7, BRASS[3]);

  p.outline();
  const c = P(1, 1, 0);
  p.shadow(c[0] + 6, c[1] + 3, 38, 14, 60);
  return { pix: p, ax: ox };
};

export const teahouse = (rot: 0 | 1 = 0): SpriteDef =>
  rot === 1
    ? house({
        w: 2, d: 2, wallH: 20, roofR: 15, wall: 0xfef3c7, trim: 0x5c4033, roof: 0x0d9488, timber: true, chimney: true,
        chimneyAt: { u: 2 * 0.35, v: 2 * 0.25 },
        door: { face: 'R', at: 1.0 }, windows: [{ face: 'L', at: 0.6 }, { face: 'L', at: 1.4 }], eave: 0.24, roofKind: 'gable_v',
      })
    : house({
        w: 2, d: 2, wallH: 20, roofR: 15, wall: 0xfef3c7, trim: 0x5c4033, roof: 0x0d9488, timber: true, chimney: true,
        door: { face: 'L', at: 1.0 }, windows: [{ face: 'R', at: 0.6 }, { face: 'R', at: 1.4 }], eave: 0.24, roofKind: 'gable',
      });

export const skiLodge = (rot: 0 | 1 = 0): SpriteDef =>
  rot === 1
    ? house({
        w: 2, d: 2, wallH: 22, roofR: 18, wall: 0x9a643d, trim: 0x452a19, roof: 0xe2e8f0, stoneBase: true, planks: true, chimney: true,
        chimneyAt: { u: 2 * 0.3, v: 2 * 0.24 },
        door: { face: 'R', at: 1.35 }, windows: [{ face: 'R', at: 0.6 }, { face: 'L', at: 0.6 }, { face: 'L', at: 1.4 }], eave: 0.22, roofKind: 'gable_v',
      })
    : house({
        w: 2, d: 2, wallH: 22, roofR: 18, wall: 0x9a643d, trim: 0x452a19, roof: 0xe2e8f0, stoneBase: true, planks: true, chimney: true,
        door: { face: 'L', at: 1.35 }, windows: [{ face: 'L', at: 0.6 }, { face: 'R', at: 0.6 }, { face: 'R', at: 1.4 }], eave: 0.22, roofKind: 'gable',
      });

export const alchemyHut = (rot: 0 | 1 = 0): SpriteDef =>
  rot === 1
    ? house({
        w: 2, d: 2, wallH: 23, roofR: 20, wall: 0xd6d3d1, trim: 0x44403c, roof: 0x6d28d9, stoneBase: true, timber: true, chimney: true,
        chimneyAt: { u: 2 * 0.32, v: 2 * 0.24 },
        door: { face: 'R', at: 0.65 }, windows: [{ face: 'R', at: 1.4 }, { face: 'L', at: 1.0 }], eave: 0.2, roofKind: 'gable_v',
      })
    : house({
        w: 2, d: 2, wallH: 23, roofR: 20, wall: 0xd6d3d1, trim: 0x44403c, roof: 0x6d28d9, stoneBase: true, timber: true, chimney: true,
        door: { face: 'L', at: 0.65 }, windows: [{ face: 'L', at: 1.4 }, { face: 'R', at: 1.0 }], eave: 0.2, roofKind: 'gable',
      });

export const bathhouse = (rot: 0 | 1 = 0): SpriteDef =>
  rot === 1
    ? house({
        w: 2, d: 2, wallH: 21, roofR: 14, wall: 0xf1f5f9, trim: 0x9a3412, roof: 0xbe123c, stoneBase: true, chimney: true,
        chimneyAt: { u: 2 * 0.35, v: 2 * 0.25 },
        door: { face: 'R', at: 1.0 }, windows: [{ face: 'L', at: 0.6 }, { face: 'L', at: 1.4 }], eave: 0.22, roofKind: 'shed_u',
      })
    : house({
        w: 2, d: 2, wallH: 21, roofR: 14, wall: 0xf1f5f9, trim: 0x9a3412, roof: 0xbe123c, stoneBase: true, chimney: true,
        door: { face: 'L', at: 1.0 }, windows: [{ face: 'R', at: 0.6 }, { face: 'R', at: 1.4 }], eave: 0.22, roofKind: 'shed',
      });

export const planetarium = (rot: 0 | 1 = 0): SpriteDef => {
  const w = 2, d = 2, pad = 12;
  const W = (w + d) * 16 + pad * 2;
  const Hc = (w + d) * 8 + 56;
  const p = new Pix(W, Hc);
  const ox = pad + d * 16;
  const oy = Hc - (w + d) * 8 - 4;
  const iso = new Iso(ox, oy);
  const P = (u: number, v: number, z: number) => iso.p(u, v, z);
  const wallPal = ramp(0x312e81);
  p.poly([P(0.15, d - 0.15, 18), P(w - 0.15, d - 0.15, 18), P(w - 0.15, d - 0.15, 0), P(0.15, d - 0.15, 0)], wallPal[2]);
  p.poly([P(w - 0.15, 0.15, 18), P(w - 0.15, d - 0.15, 18), P(w - 0.15, d - 0.15, 0), P(w - 0.15, 0.15, 0)], wallPal[1]);
  p.poly([P(0.15, 0.15, 18), P(w - 0.15, 0.15, 18), P(w - 0.15, d - 0.15, 18), P(0.15, d - 0.15, 18)], wallPal[3]);
  const dome = P(1, 1, 20);
  p.ellipse(dome[0], dome[1] - 7, 19, 16, 0x4338ca);
  p.ellipse(dome[0] - 4, dome[1] - 11, 11, 10, 0x6366f1);
  const dir = rot === 1 ? 10 : -10;
  p.line(dome[0], dome[1] - 10, dome[0] + dir, dome[1] - 24, BRASS[3]);
  p.set(dome[0], dome[1] - 25, 0xfef08a);
  p.outline();
  const c = P(1, 1, 0);
  p.shadow(c[0] + 6, c[1] + 3, 36, 13, 60);
  return { pix: p, ax: ox };
};

export const dreamPavilion = (rot: 0 | 1 = 0): SpriteDef =>
  rot === 1
    ? house({
        w: 2, d: 2, wallH: 22, roofR: 18, wall: 0xfff1f2, trim: 0xdb2777, roof: 0xf472b6, stoneBase: true,
        door: { face: 'R', at: 1.0 }, windows: [{ face: 'R', at: 0.5 }, { face: 'L', at: 0.5 }, { face: 'L', at: 1.45 }], eave: 0.24, roofKind: 'gable_v',
      })
    : house({
        w: 2, d: 2, wallH: 22, roofR: 18, wall: 0xfff1f2, trim: 0xdb2777, roof: 0xf472b6, stoneBase: true,
        door: { face: 'L', at: 1.0 }, windows: [{ face: 'L', at: 0.5 }, { face: 'R', at: 0.5 }, { face: 'R', at: 1.45 }], eave: 0.24, roofKind: 'gable',
      });
