/**
 * Tiny pixel-art painter. All Tiny World artwork is generated from code with this class so the
 * game has zero binary art dependencies and a perfectly consistent pixel grid.
 * Colours are 0xRRGGBB numbers.
 */
import { hash } from '../core/rng';

export const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const;
export const pack = (r: number, g: number, b: number) => ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
export const mixc = (a: number, b: number, t: number) => {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return pack(Math.round(r1 + (r2 - r1) * t), Math.round(g1 + (g2 - g1) * t), Math.round(b1 + (b2 - b1) * t));
};
export const lighten = (c: number, t: number) => mixc(c, 0xffffff, t);
export const darken = (c: number, t: number) => mixc(c, 0x1d1830, t);
/** four-tone ramp from one base colour: dark → shade → base → light */
export const ramp = (base: number): [number, number, number, number] => [darken(base, 0.55), darken(base, 0.28), base, lighten(base, 0.28)];

/** noise in 0..1 for integer pixel coordinates */
export const noise = (x: number, y: number, s = 0) => (hash(x, y, s) % 1000) / 1000;

export const OUTLINE = 0x2a2236;

export class Pix {
  readonly d: Uint8ClampedArray<ArrayBuffer>;
  constructor(public w: number, public h: number) {
    this.d = new Uint8ClampedArray(new ArrayBuffer(w * h * 4));
  }
  set(x: number, y: number, c: number, a = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = (c >> 16) & 255;
    this.d[i + 1] = (c >> 8) & 255;
    this.d[i + 2] = c & 255;
    this.d[i + 3] = a;
  }
  alpha(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[(y * this.w + x) * 4 + 3];
  }
  getc(x: number, y: number) {
    const i = (y * this.w + x) * 4;
    return (this.d[i] << 16) | (this.d[i + 1] << 8) | this.d[i + 2];
  }
  rect(x: number, y: number, w: number, h: number, c: number, a = 255) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a);
  }
  /** filled ellipse; fn picks colour per pixel (nx, ny in -1..1) */
  ellipseFn(cx: number, cy: number, rx: number, ry: number, fn: (nx: number, ny: number, x: number, y: number) => number | null) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const c = fn(nx, ny, x, y);
        if (c !== null) this.set(x, y, c);
      }
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number) {
    this.ellipseFn(cx, cy, rx, ry, () => c);
  }
  /**
   * Lit blob: light comes from the top-left. `pal` is a 4-tone ramp (dark..light).
   * `fuzz` adds pixel noise on tone boundaries which gives leaves/fur their painterly clumps.
   */
  blob(cx: number, cy: number, rx: number, ry: number, pal: readonly number[], fuzz = 0.18, seed = 0) {
    this.ellipseFn(cx, cy, rx, ry, (nx, ny, x, y) => {
      const t = -(nx * 0.55 + ny * 0.8) + (noise(x, y, seed) - 0.5) * fuzz * 2;
      const edge = nx * nx + ny * ny;
      if (edge > 0.78 && t < -0.2) return pal[0];
      if (t > 0.5) return pal[3];
      if (t > -0.05) return pal[2];
      if (t > -0.55) return pal[1];
      return pal[0];
    });
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** scanline polygon fill. fn receives pixel coords to allow textured faces. */
  poly(pts: [number, number][], c: number | ((x: number, y: number) => number | null)) {
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    for (let y = Math.floor(minY); y < Math.ceil(maxY); y++) {
      const yy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) xs.push(a[0] + ((yy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) {
          const col = typeof c === 'number' ? c : c(x, y);
          if (col !== null) this.set(x, y, col);
        }
      }
    }
  }
  /** one-pixel outline around opaque pixels (writes only onto fully transparent pixels) */
  outline(c: number = OUTLINE, diagonals = false) {
    const out: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alpha(x, y) > 0) continue;
        if (
          this.alpha(x - 1, y) > 200 || this.alpha(x + 1, y) > 200 || this.alpha(x, y - 1) > 200 || this.alpha(x, y + 1) > 200 ||
          (diagonals && (this.alpha(x - 1, y - 1) > 200 || this.alpha(x + 1, y - 1) > 200 || this.alpha(x - 1, y + 1) > 200 || this.alpha(x + 1, y + 1) > 200))
        ) out.push(x, y);
      }
    }
    for (let i = 0; i < out.length; i += 2) this.set(out[i], out[i + 1], c);
    return this;
  }
  /** soft ground shadow – only draws where the sprite is empty so it never covers artwork */
  shadow(cx: number, cy: number, rx: number, ry: number, a = 70) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        if (this.alpha(x, y) === 0) this.set(x, y, 0x1b2a22, a);
      }
    }
  }
  blit(src: Pix, ox: number, oy: number, flip = false) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4;
        if (src.d[i + 3] === 0) continue;
        const dx = ox + (flip ? src.w - 1 - x : x);
        const dy = oy + y;
        if (dx < 0 || dy < 0 || dx >= this.w || dy >= this.h) continue;
        const j = (dy * this.w + dx) * 4;
        this.d[j] = src.d[i]; this.d[j + 1] = src.d[i + 1]; this.d[j + 2] = src.d[i + 2]; this.d[j + 3] = src.d[i + 3];
      }
    }
  }
  toCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const ctx = c.getContext('2d')!;
    ctx.putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return c;
  }
}

/** An isometric projection helper for buildings and furniture. u runs along +gx, v along +gy. */
export class Iso {
  constructor(public ox: number, public oy: number) {}
  /** project footprint-local (u,v) in cells plus height z in pixels */
  p(u: number, v: number, z = 0): [number, number] {
    return [this.ox + (u - v) * 16, this.oy + (u + v) * 8 - z];
  }
}
