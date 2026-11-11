// Generates original pixel-art Chrome Extension PNG icons (16, 32, 48, 128) with zero external dependencies.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
const encodePng = (w, h, rgba) => {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Draw a 16x16 miniature floating island with a leafy tree, then nearest-neighbor scale to target size
const drawBase16 = () => {
  const grid = [
    '................',
    '......gggg......',
    '....gggggggg....',
    '...ggllgggggg...',
    '...ggllgggggg...',
    '....gggggggg....',
    '......tttt......',
    '......tttt......',
    '..gggggggggggg..',
    '.gggggggggggggg.',
    '.ggssssssssssgg.',
    '..cccccccccccc..',
    '...cccccccccc...',
    '....cccccccc....',
    '.....cccccc.....',
    '......cccc......',
  ];
  const pal = {
    g: [0x66, 0xbd, 0x47, 255],
    l: [0x98, 0xdf, 0x68, 255],
    t: [0xa8, 0x68, 0x3a, 255],
    s: [0x4c, 0x9e, 0x3f, 255],
    c: [0x7a, 0x58, 0x42, 255],
  };
  return { grid, pal };
}

const makeIcon = (size) => {
  const { grid, pal } = drawBase16();
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = Math.min(15, Math.floor((x / size) * 16));
      const gy = Math.min(15, Math.floor((y / size) * 16));
      const ch = grid[gy][gx];
      const rgba = pal[ch] ?? [0, 0, 0, 0];
      const i = (y * size + x) * 4;
      buf[i] = rgba[0];
      buf[i + 1] = rgba[1];
      buf[i + 2] = rgba[2];
      buf[i + 3] = rgba[3];
    }
  }
  return encodePng(size, size, buf);
}

mkdirSync('public/icons', { recursive: true });
for (const sz of [16, 32, 48, 128]) {
  writeFileSync(`public/icons/icon${sz}.png`, makeIcon(sz));
}
console.log('Generated icons: 16, 32, 48, 128');
