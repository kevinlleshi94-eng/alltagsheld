// Generates the PWA / home-screen icons as pixel-art PNGs (no external tools needed).
// Usage: npm run icons  → writes into /public
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public');
mkdirSync(outDir, { recursive: true });

const COLORS = {
  bg: [27, 18, 12, 255],
  bgLight: [46, 30, 19, 255],
  outline: [14, 8, 4, 255],
  gold: [232, 179, 58, 255],
  goldDark: [168, 116, 26, 255],
  red: [155, 45, 32, 255],
  redDark: [110, 29, 20, 255],
  blade: [222, 228, 235, 255],
  bladeShadow: [138, 150, 163, 255],
  grip: [107, 68, 35, 255],
};

// --- 16×16 logical pixel art -------------------------------------------------
const N = 16;
const art = Array.from({ length: N }, () => Array(N).fill(null));
const shieldRows = {
  2: [2, 13], 3: [2, 13], 4: [2, 13], 5: [2, 13], 6: [2, 13], 7: [2, 13], 8: [2, 13],
  9: [3, 12], 10: [3, 12], 11: [4, 11], 12: [5, 10], 13: [6, 9], 14: [7, 8],
};
const inShield = (x, y) => shieldRows[y] && x >= shieldRows[y][0] && x <= shieldRows[y][1];
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    if (!inShield(x, y)) continue;
    const edge = !inShield(x - 1, y) || !inShield(x + 1, y) || !inShield(x, y - 1) || !inShield(x, y + 1);
    const nearEdge =
      !inShield(x - 2, y) || !inShield(x + 2, y) || !inShield(x, y - 2) || !inShield(x, y + 2);
    if (edge) art[y][x] = 'outline';
    else if (nearEdge) art[y][x] = x < 8 ? 'gold' : 'goldDark';
    else art[y][x] = x < 8 ? 'red' : 'redDark';
  }
}
// Sword (pointing up) drawn over the shield
const sword = [];
for (let y = 1; y <= 10; y++) {
  sword.push([7, y, 'blade'], [8, y, 'bladeShadow']);
}
for (let x = 4; x <= 11; x++) sword.push([x, 11, x < 8 ? 'gold' : 'goldDark']);
sword.push([7, 12, 'grip'], [8, 12, 'grip'], [7, 13, 'grip'], [8, 13, 'grip']);
sword.push([7, 14, 'gold'], [8, 14, 'goldDark']);
const swordSet = new Set(sword.map(([x, y]) => `${x},${y}`));
for (const [x, y] of sword) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= N || ny >= N || swordSet.has(`${nx},${ny}`)) continue;
    art[ny][nx] = 'outline';
  }
}
for (const [x, y, c] of sword) art[y][x] = c;
art[0][7] = 'outline';
art[0][8] = 'outline';

// --- PNG encoding --------------------------------------------------------------
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function renderIcon(size, artFraction) {
  const scale = Math.max(1, Math.floor((size * artFraction) / N));
  const offset = Math.floor((size - scale * N) / 2);
  return encodePng(size, (x, y) => {
    const ax = Math.floor((x - offset) / scale);
    const ay = Math.floor((y - offset) / scale);
    const key = ax >= 0 && ay >= 0 && ax < N && ay < N ? art[ay][ax] : null;
    if (key) return COLORS[key];
    // subtle vignette-ish checker for a "wood" feel
    const band = Math.floor(y / Math.max(2, Math.floor(size / 24))) % 2 === 0;
    return band ? COLORS.bg : COLORS.bgLight;
  });
}

const outputs = [
  ['favicon.png', 64, 0.9],
  ['apple-touch-icon.png', 180, 0.75],
  ['icon-192.png', 192, 0.75],
  ['icon-512.png', 512, 0.75],
  ['icon-512-maskable.png', 512, 0.6],
];
for (const [name, size, frac] of outputs) {
  writeFileSync(join(outDir, name), renderIcon(size, frac));
  console.log(`wrote public/${name}`);
}
