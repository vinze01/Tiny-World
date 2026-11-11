import { createHash } from 'node:crypto';
import { deflateSync, inflateSync } from 'node:zlib';

export interface PixelSurface {
  w: number;
  h: number;
  d: Uint8ClampedArray;
}

export interface EncodedGif {
  bytes: Uint8Array;
  lossless: boolean;
  uniqueColors: number;
}

const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(parts: Uint8Array[]): number {
  let c = 0xffffffff;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      c = CRC_TABLE[(c ^ part[i]) & 0xff] ^ (c >>> 8);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u32be(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, false);
  return b;
}

function u16be(n: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n & 0xffff, false);
  return b;
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Buffer.from(type, 'ascii');
  const out = new Uint8Array(12 + data.length);
  out.set(u32be(data.length), 0);
  out.set(typeBytes, 4);
  out.set(data, 8);
  out.set(u32be(crc32([typeBytes, data])), 8 + data.length);
  return out;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

export function sha256(input: Uint8Array | string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function createSurface(w: number, h: number): PixelSurface {
  return { w, h, d: new Uint8ClampedArray(w * h * 4) };
}

export function scaleNearest(src: PixelSurface, factor: number): PixelSurface {
  const f = Math.max(1, Math.floor(factor));
  if (f === 1) return { w: src.w, h: src.h, d: new Uint8ClampedArray(src.d) };
  const dstW = src.w * f;
  const dstH = src.h * f;
  const out = new Uint8ClampedArray(dstW * dstH * 4);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4;
      const r = src.d[si];
      const g = src.d[si + 1];
      const b = src.d[si + 2];
      const a = src.d[si + 3];
      if ((r | g | b | a) === 0) continue;
      for (let dy = 0; dy < f; dy++) {
        const rowOff = ((y * f + dy) * dstW + x * f) * 4;
        for (let dx = 0; dx < f; dx++) {
          const di = rowOff + dx * 4;
          out[di] = r;
          out[di + 1] = g;
          out[di + 2] = b;
          out[di + 3] = a;
        }
      }
    }
  }
  return { w: dstW, h: dstH, d: out };
}

export function computeSafeIntegerScale(w: number, h: number, preferred: number, maxDim = 4096): number {
  const capW = Math.max(1, Math.floor(maxDim / Math.max(1, w)));
  const capH = Math.max(1, Math.floor(maxDim / Math.max(1, h)));
  return Math.max(1, Math.min(preferred, capW, capH));
}

export function blitSurface(dst: PixelSurface, src: PixelSurface, dx: number, dy: number): void {
  for (let sy = 0; sy < src.h; sy++) {
    const ty = dy + sy;
    if (ty < 0 || ty >= dst.h) continue;
    for (let sx = 0; sx < src.w; sx++) {
      const tx = dx + sx;
      if (tx < 0 || tx >= dst.w) continue;
      const si = (sy * src.w + sx) * 4;
      const sa = src.d[si + 3];
      if (sa === 0) continue;
      const di = (ty * dst.w + tx) * 4;
      if (sa === 255 || dst.d[di + 3] === 0) {
        dst.d[di] = src.d[si];
        dst.d[di + 1] = src.d[si + 1];
        dst.d[di + 2] = src.d[si + 2];
        dst.d[di + 3] = sa;
      } else {
        const a = sa / 255;
        const da = dst.d[di + 3] / 255;
        const outA = a + da * (1 - a);
        dst.d[di] = Math.round((src.d[si] * a + dst.d[di] * da * (1 - a)) / outA);
        dst.d[di + 1] = Math.round((src.d[si + 1] * a + dst.d[di + 1] * da * (1 - a)) / outA);
        dst.d[di + 2] = Math.round((src.d[si + 2] * a + dst.d[di + 2] * da * (1 - a)) / outA);
        dst.d[di + 3] = Math.round(outA * 255);
      }
    }
  }
}

export function normalizeFrames(frames: { surface: PixelSurface; ax?: number; delayMs: number }[]): {
  w: number;
  h: number;
  frames: { surface: PixelSurface; delayMs: number }[];
} {
  let maxW = 1;
  let maxH = 1;
  for (const f of frames) {
    if (f.surface.w > maxW) maxW = f.surface.w;
    if (f.surface.h > maxH) maxH = f.surface.h;
  }
  const allSame = frames.every((f) => f.surface.w === maxW && f.surface.h === maxH);
  if (allSame) {
    return {
      w: maxW,
      h: maxH,
      frames: frames.map((f) => ({ surface: f.surface, delayMs: f.delayMs })),
    };
  }
  return {
    w: maxW,
    h: maxH,
    frames: frames.map((f) => {
      const canvas = createSurface(maxW, maxH);
      const ax = f.ax ?? Math.floor(f.surface.w / 2);
      const targetX = Math.floor(maxW / 2) - ax;
      const targetY = maxH - f.surface.h;
      blitSurface(canvas, f.surface, Math.max(0, Math.min(maxW - f.surface.w, targetX)), Math.max(0, targetY));
      return { surface: canvas, delayMs: f.delayMs };
    }),
  };
}

function buildFilteredScanlines(surface: PixelSurface): Uint8Array {
  const rowBytes = surface.w * 4;
  const raw = new Uint8Array(surface.h * (1 + rowBytes));
  for (let y = 0; y < surface.h; y++) {
    const outOff = y * (1 + rowBytes);
    raw[outOff] = 0; // Filter type 0 (None): fast & bit-exact for deflate on crisp pixel art
    const inOff = y * rowBytes;
    raw.set(surface.d.subarray(inOff, inOff + rowBytes), outOff + 1);
  }
  return deflateSync(raw, { level: 9 });
}

export function encodePng(surface: PixelSurface): Uint8Array {
  const ihdr = new Uint8Array(13);
  ihdr.set(u32be(surface.w), 0);
  ihdr.set(u32be(surface.h), 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = buildFilteredScanlines(surface);
  return concatBytes([
    PNG_SIG,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', new Uint8Array(0)),
  ]);
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export interface DecodedPng {
  w: number;
  h: number;
  d: Uint8ClampedArray;
  bitDepth: number;
  colorType: number;
  chunks: string[];
}

export function decodePng(bytes: Uint8Array): DecodedPng {
  if (bytes.length < 24) throw new Error('PNG too small');
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIG[i]) throw new Error('Invalid PNG signature');
  }

  let off = 8;
  let w = 0;
  let h = 0;
  let bitDepth = 8;
  let colorType = 6;
  const idatParts: Uint8Array[] = [];
  let palette: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  const chunks: string[] = [];

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (off + 12 <= bytes.length) {
    const len = view.getUint32(off, false);
    const type = String.fromCharCode(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7]);
    const dataStart = off + 8;
    const dataEnd = dataStart + len;
    if (dataEnd + 4 > bytes.length) throw new Error(`Truncated chunk ${type}`);
    const payload = bytes.subarray(dataStart, dataEnd);
    const expectedCrc = view.getUint32(dataEnd, false);
    const actualCrc = crc32([bytes.subarray(off + 4, dataEnd)]);
    if (expectedCrc !== actualCrc) throw new Error(`CRC mismatch in ${type}`);

    chunks.push(type);
    if (type === 'IHDR') {
      const iv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
      w = iv.getUint32(0, false);
      h = iv.getUint32(4, false);
      bitDepth = payload[8];
      colorType = payload[9];
      if (bitDepth !== 8) throw new Error(`Unsupported PNG bitDepth ${bitDepth}`);
      if (payload[12] !== 0) throw new Error(`Unsupported PNG interlace ${payload[12]}`);
    } else if (type === 'PLTE') {
      palette = payload;
    } else if (type === 'tRNS') {
      trns = payload;
    } else if (type === 'IDAT') {
      idatParts.push(payload);
    } else if (type === 'IEND') {
      break;
    }
    off = dataEnd + 4;
  }

  if (w <= 0 || h <= 0) throw new Error('Missing or invalid IHDR');
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
  const stride = w * bpp;
  const inflated = new Uint8Array(inflateSync(concatBytes(idatParts)));
  if (inflated.length !== h * (1 + stride)) {
    throw new Error(`Unexpected inflated byte count: got ${inflated.length}, expected ${h * (1 + stride)}`);
  }

  const unfiltered = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = inflated[y * (1 + stride)];
    const rowStart = y * stride;
    const rawStart = y * (1 + stride) + 1;
    for (let i = 0; i < stride; i++) {
      const x = inflated[rawStart + i];
      const a = i >= bpp ? unfiltered[rowStart + i - bpp] : 0;
      const b = y > 0 ? unfiltered[rowStart - stride + i] : 0;
      const c = y > 0 && i >= bpp ? unfiltered[rowStart - stride + i - bpp] : 0;
      let val = x;
      if (filter === 1) val = (x + a) & 0xff;
      else if (filter === 2) val = (x + b) & 0xff;
      else if (filter === 3) val = (x + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) val = (x + paethPredictor(a, b, c)) & 0xff;
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
      unfiltered[rowStart + i] = val;
    }
  }

  const d = new Uint8ClampedArray(w * h * 4);
  if (colorType === 6) {
    d.set(unfiltered);
  } else if (colorType === 2) {
    for (let i = 0, p = 0; i < unfiltered.length; i += 3, p += 4) {
      d[p] = unfiltered[i];
      d[p + 1] = unfiltered[i + 1];
      d[p + 2] = unfiltered[i + 2];
      d[p + 3] = 255;
    }
  } else if (colorType === 3 && palette) {
    for (let i = 0, p = 0; i < unfiltered.length; i++, p += 4) {
      const idx = unfiltered[i];
      d[p] = palette[idx * 3] ?? 0;
      d[p + 1] = palette[idx * 3 + 1] ?? 0;
      d[p + 2] = palette[idx * 3 + 2] ?? 0;
      d[p + 3] = trns && idx < trns.length ? trns[idx] : 255;
    }
  } else if (colorType === 4) {
    for (let i = 0, p = 0; i < unfiltered.length; i += 2, p += 4) {
      d[p] = unfiltered[i];
      d[p + 1] = unfiltered[i];
      d[p + 2] = unfiltered[i];
      d[p + 3] = unfiltered[i + 1];
    }
  } else {
    for (let i = 0, p = 0; i < unfiltered.length; i++, p += 4) {
      d[p] = unfiltered[i];
      d[p + 1] = unfiltered[i];
      d[p + 2] = unfiltered[i];
      d[p + 3] = 255;
    }
  }

  return { w, h, d, bitDepth, colorType, chunks };
}

export function pixelsMatch(a: PixelSurface, b: PixelSurface): {
  ok: boolean;
  mismatchCount: number;
  firstMismatch?: { x: number; y: number };
} {
  if (a.w !== b.w || a.h !== b.h) {
    return { ok: false, mismatchCount: Math.max(a.w * a.h, b.w * b.h), firstMismatch: { x: 0, y: 0 } };
  }
  let mismatchCount = 0;
  let firstMismatch: { x: number; y: number } | undefined;
  for (let i = 0; i < a.d.length; i += 4) {
    if (
      a.d[i] !== b.d[i] ||
      a.d[i + 1] !== b.d[i + 1] ||
      a.d[i + 2] !== b.d[i + 2] ||
      a.d[i + 3] !== b.d[i + 3]
    ) {
      mismatchCount++;
      if (!firstMismatch) {
        const px = i / 4;
        firstMismatch = { x: px % a.w, y: Math.floor(px / a.w) };
      }
    }
  }
  return { ok: mismatchCount === 0, mismatchCount, firstMismatch };
}

export function hasTransparency(surface: PixelSurface): boolean {
  for (let i = 3; i < surface.d.length; i += 4) {
    if (surface.d[i] < 255) return true;
  }
  return false;
}

export function encodeApng(
  rawFrames: { surface: PixelSurface; ax?: number; delayMs: number }[],
  loopCount = 0,
): Uint8Array {
  if (rawFrames.length === 0) throw new Error('APNG requires at least one frame');
  const norm = normalizeFrames(rawFrames);
  const ihdr = new Uint8Array(13);
  ihdr.set(u32be(norm.w), 0);
  ihdr.set(u32be(norm.h), 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const actl = concatBytes([u32be(norm.frames.length), u32be(loopCount)]);
  const parts: Uint8Array[] = [PNG_SIG, makeChunk('IHDR', ihdr), makeChunk('acTL', actl)];

  let seq = 0;
  const makeFctl = (delayMs: number) => {
    const ms = Math.max(10, Math.round(delayMs));
    const fctl = new Uint8Array(26);
    fctl.set(u32be(seq++), 0);
    fctl.set(u32be(norm.w), 4);
    fctl.set(u32be(norm.h), 8);
    fctl.set(u32be(0), 12); // x_offset
    fctl.set(u32be(0), 16); // y_offset
    fctl.set(u16be(ms), 20);
    fctl.set(u16be(1000), 22);
    fctl[24] = 1; // APNG_DISPOSE_OP_BACKGROUND
    fctl[25] = 0; // APNG_BLEND_OP_SOURCE
    return makeChunk('fcTL', fctl);
  };

  parts.push(makeFctl(norm.frames[0].delayMs));
  parts.push(makeChunk('IDAT', buildFilteredScanlines(norm.frames[0].surface)));

  for (let i = 1; i < norm.frames.length; i++) {
    parts.push(makeFctl(norm.frames[i].delayMs));
    const zdata = buildFilteredScanlines(norm.frames[i].surface);
    const fdat = new Uint8Array(4 + zdata.length);
    fdat.set(u32be(seq++), 0);
    fdat.set(zdata, 4);
    parts.push(makeChunk('fdAT', fdat));
  }

  parts.push(makeChunk('IEND', new Uint8Array(0)));
  return concatBytes(parts);
}

interface ColorEntry {
  r: number;
  g: number;
  b: number;
  count: number;
}

function medianCutPalette(colors: ColorEntry[], maxColors: number): [number, number, number][] {
  const boxes: ColorEntry[][] = [colors.slice()];
  while (boxes.length < maxColors) {
    let bestIdx = -1;
    let bestRange = 0;
    let bestChannel: 'r' | 'g' | 'b' = 'r';
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.length < 2) continue;
      let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
      for (const c of box) {
        if (c.r < rMin) rMin = c.r;
        if (c.r > rMax) rMax = c.r;
        if (c.g < gMin) gMin = c.g;
        if (c.g > gMax) gMax = c.g;
        if (c.b < bMin) bMin = c.b;
        if (c.b > bMax) bMax = c.b;
      }
      const rSpan = rMax - rMin;
      const gSpan = gMax - gMin;
      const bSpan = bMax - bMin;
      const span = Math.max(rSpan, gSpan, bSpan);
      if (span > bestRange) {
        bestRange = span;
        bestIdx = i;
        bestChannel = rSpan >= gSpan && rSpan >= bSpan ? 'r' : gSpan >= bSpan ? 'g' : 'b';
      }
    }
    if (bestIdx === -1) break;
    const target = boxes.splice(bestIdx, 1)[0];
    target.sort((a, b) => a[bestChannel] - b[bestChannel]);
    const mid = Math.floor(target.length / 2);
    boxes.push(target.slice(0, mid), target.slice(mid));
  }
  return boxes.map((box) => {
    let rw = 0, gw = 0, bw = 0, tw = 0;
    for (const c of box) {
      rw += c.r * c.count;
      gw += c.g * c.count;
      bw += c.b * c.count;
      tw += c.count;
    }
    if (tw === 0) return [0, 0, 0];
    return [Math.round(rw / tw), Math.round(gw / tw), Math.round(bw / tw)];
  });
}

function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;

  const out: number[] = [];
  let bitBuf = 0;
  let bitCount = 0;

  const emit = (code: number, size: number) => {
    bitBuf |= code << bitCount;
    bitCount += size;
    while (bitCount >= 8) {
      out.push(bitBuf & 0xff);
      bitBuf >>>= 8;
      bitCount -= 8;
    }
  };

  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  let dict = new Map<number, number>();

  const reset = () => {
    dict = new Map<number, number>();
    codeSize = minCodeSize + 1;
    nextCode = eoiCode + 1;
  };

  emit(clearCode, codeSize);
  if (indices.length === 0) {
    emit(eoiCode, codeSize);
    if (bitCount > 0) out.push(bitBuf & 0xff);
    return new Uint8Array(out);
  }

  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const hit = dict.get(key);
    if (hit !== undefined) {
      prefix = hit;
    } else {
      emit(prefix, codeSize);
      if (nextCode < 4096) {
        dict.set(key, nextCode);
        nextCode++;
        if (nextCode > (1 << codeSize) && codeSize < 12) {
          codeSize++;
        }
      } else {
        emit(clearCode, codeSize);
        reset();
      }
      prefix = k;
    }
  }
  emit(prefix, codeSize);
  emit(eoiCode, codeSize);
  if (bitCount > 0) out.push(bitBuf & 0xff);
  return new Uint8Array(out);
}

export function encodeGif(
  rawFrames: { surface: PixelSurface; ax?: number; delayMs: number }[],
  loopCount = 0,
): EncodedGif {
  if (rawFrames.length === 0) throw new Error('GIF requires at least one frame');
  const norm = normalizeFrames(rawFrames);
  const colorCounts = new Map<number, number>();
  let partialAlpha = false;

  for (const frame of norm.frames) {
    const d = frame.surface.d;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (a > 0 && a < 255) partialAlpha = true;
      if (a < 64) continue;
      const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
    }
  }

  const entries: ColorEntry[] = [];
  for (const [key, count] of colorCounts) {
    entries.push({ r: (key >> 16) & 0xff, g: (key >> 8) & 0xff, b: key & 0xff, count });
  }
  entries.sort((a, b) => b.count - a.count);

  const exactColors = entries.length <= 255;
  const paletteRgb: [number, number, number][] = exactColors
    ? entries.map((e) => [e.r, e.g, e.b])
    : medianCutPalette(entries.slice(0, 2048), 255);

  const totalEntries = 1 + paletteRgb.length; // index 0 is transparent
  let tableBits = 1;
  while ((1 << tableBits) < totalEntries) tableBits++;
  tableBits = Math.max(2, tableBits);
  const tableSize = 1 << tableBits;

  const exactLookup = new Map<number, number>();
  if (exactColors) {
    for (let i = 0; i < paletteRgb.length; i++) {
      const [r, g, b] = paletteRgb[i];
      exactLookup.set((r << 16) | (g << 8) | b, i + 1);
    }
  }
  const nearestCache = new Map<number, number>();
  const mapColor = (r: number, g: number, b: number): number => {
    const key = (r << 16) | (g << 8) | b;
    if (exactColors) return exactLookup.get(key) ?? 1;
    const cached = nearestCache.get(key);
    if (cached !== undefined) return cached;
    let bestIdx = 1;
    let bestDist = Infinity;
    for (let i = 0; i < paletteRgb.length; i++) {
      const [pr, pg, pb] = paletteRgb[i];
      const dr = r - pr;
      const dg = g - pg;
      const db = b - pb;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i + 1;
        if (dist === 0) break;
      }
    }
    nearestCache.set(key, bestIdx);
    return bestIdx;
  };

  const chunks: Uint8Array[] = [];
  const le16 = (v: number) => new Uint8Array([v & 0xff, (v >> 8) & 0xff]);

  // Header + Logical Screen Descriptor
  chunks.push(Buffer.from('GIF89a', 'ascii'));
  const lsd = new Uint8Array(7);
  lsd.set(le16(norm.w), 0);
  lsd.set(le16(norm.h), 2);
  lsd[4] = 0x80 | ((tableBits - 1) << 4) | (tableBits - 1);
  lsd[5] = 0;
  lsd[6] = 0;
  chunks.push(lsd);

  // Global Color Table (index 0 transparent)
  const gct = new Uint8Array(tableSize * 3);
  for (let i = 0; i < paletteRgb.length; i++) {
    const [r, g, b] = paletteRgb[i];
    const off = (i + 1) * 3;
    gct[off] = r;
    gct[off + 1] = g;
    gct[off + 2] = b;
  }
  chunks.push(gct);

  // NETSCAPE2.0 looping extension
  const appExt = new Uint8Array(19);
  appExt[0] = 0x21;
  appExt[1] = 0xff;
  appExt[2] = 11;
  appExt.set(Buffer.from('NETSCAPE2.0', 'ascii'), 3);
  appExt[14] = 3;
  appExt[15] = 1;
  appExt.set(le16(loopCount), 16);
  appExt[18] = 0;
  chunks.push(appExt);

  const lzwMinCodeSize = tableBits;
  for (const frame of norm.frames) {
    const cs = Math.max(2, Math.round(frame.delayMs / 10));
    const gce = new Uint8Array(8);
    gce[0] = 0x21;
    gce[1] = 0xf9;
    gce[2] = 4;
    gce[3] = 0x09; // disposal method 2 (restore background) + transparent flag 1
    gce.set(le16(cs), 4);
    gce[6] = 0; // transparent index 0
    gce[7] = 0;
    chunks.push(gce);

    const imgDesc = new Uint8Array(10);
    imgDesc[0] = 0x2c;
    imgDesc.set(le16(0), 1);
    imgDesc.set(le16(0), 3);
    imgDesc.set(le16(norm.w), 5);
    imgDesc.set(le16(norm.h), 7);
    imgDesc[9] = 0;
    chunks.push(imgDesc);

    const idxBuf = new Uint8Array(norm.w * norm.h);
    const d = frame.surface.d;
    for (let p = 0, i = 0; p < idxBuf.length; p++, i += 4) {
      idxBuf[p] = d[i + 3] < 64 ? 0 : mapColor(d[i], d[i + 1], d[i + 2]);
    }
    const lzw = lzwEncode(idxBuf, lzwMinCodeSize);
    chunks.push(new Uint8Array([lzwMinCodeSize]));
    for (let off = 0; off < lzw.length; off += 255) {
      const sub = lzw.subarray(off, Math.min(lzw.length, off + 255));
      chunks.push(new Uint8Array([sub.length]), sub);
    }
    chunks.push(new Uint8Array([0x00]));
  }

  chunks.push(new Uint8Array([0x3b]));
  return {
    bytes: concatBytes(chunks),
    lossless: exactColors && !partialAlpha,
    uniqueColors: entries.length,
  };
}

function hexByte(n: number): string {
  return n.toString(16).padStart(2, '0');
}

export function crispPixelSvg(surface: PixelSurface, scale = 1): string {
  const s = Math.max(1, Math.floor(scale));
  const outW = surface.w * s;
  const outH = surface.h * s;
  const rects: string[] = [];

  for (let y = 0; y < surface.h; y++) {
    let x = 0;
    while (x < surface.w) {
      const i = (y * surface.w + x) * 4;
      const a = surface.d[i + 3];
      if (a === 0) {
        x++;
        continue;
      }
      const r = surface.d[i];
      const g = surface.d[i + 1];
      const b = surface.d[i + 2];
      let run = 1;
      while (x + run < surface.w) {
        const j = (y * surface.w + x + run) * 4;
        if (surface.d[j] !== r || surface.d[j + 1] !== g || surface.d[j + 2] !== b || surface.d[j + 3] !== a) {
          break;
        }
        run++;
      }
      const fill = `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
      const opAttr = a === 255 ? '' : ` fill-opacity="${(a / 255).toFixed(3)}"`;
      rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${fill}"${opAttr}/>`);
      x += run;
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${surface.w} ${surface.h}" width="${outW}" height="${outH}" shape-rendering="crispEdges">`,
    ...rects,
    '</svg>',
    '',
  ].join('\n');
}
