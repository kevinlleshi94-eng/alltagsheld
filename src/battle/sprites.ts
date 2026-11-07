/**
 * Pixel placeholders for the battle scene: shown until the real sprites (assets/) are
 * composed, and as a fallback if they cannot be loaded.
 * Bitmaps: one character per pixel, '.' = transparent.
 * Enemy palette slots: b = base, d = dark, l = light (from EnemyDef.colors),
 * k = outline, e = eye, p = pupil, r = red accent, w = white.
 * Everything is drawn with whole pixels onto 2D canvases.
 */
import type { EnemyShape } from '../game/world';

export type Bitmap = readonly string[];
export type Palette = Record<string, string>;

export const HERO: Bitmap = [
  '.....hhhhh......',
  '....hhhhhhh.....',
  '....hhvvvvh.....',
  '....hhhhhhh.....',
  '.....ksssk......',
  '...kkrrrrrkk.w..',
  '..ksrrrrrrrsk.w.',
  '..ksrrryrrrskw..',
  '..kssrrrrrrskw..',
  '...kkrrrrrrkkgg.',
  '....kbbkkbbk.g..',
  '....kbbkkbbk....',
  '....kbbkkbbk....',
  '...kdddkkdddk...',
];

export const HERO_PALETTE: Palette = {
  h: '#c9d1d9',
  v: '#2b2f36',
  s: '#f0c8a0',
  r: '#9b2d20',
  y: '#e8b33a',
  w: '#e6ebf0',
  g: '#a8741a',
  b: '#6b4423',
  d: '#2a1a10',
  k: '#1a100a',
};

const SHAPES: Record<EnemyShape, Bitmap> = {
  slime: [
    '......kkkk......',
    '....kkllbbkk....',
    '...kllbbbbbbk...',
    '..klbbbbbbbbbk..',
    '..kbwebbbwebbk..',
    '.kbbwpbbbwpbbbk.',
    '.kbbbbbbbbbbbbk.',
    '.kbbbddddbbbbbk.',
    '.kdbbbbbbbbbbdk.',
    '..kddddddddddk..',
    '...kkkkkkkkkk...',
  ],
  beast: [
    '.kk.............',
    'kbbk............',
    'kbbbk...........',
    'kwpbbkkkkkkkkk..',
    'kbbbbbbbbbbbbbkk',
    'kkrbbllllbbbbbbk',
    '.kkbbbbbbbbbbbbk',
    '...kbbbbbbbbbbk.',
    '...kbddkkkkddbk.',
    '...kbk.....kbk..',
    '...kbk.....kbk..',
    '...kkk.....kkk..',
  ],
  humanoid: [
    '......kkkk......',
    '.....kbbbbk.....',
    '.....kpbpbk.....',
    '.....kbbbbk.....',
    '......kddk......',
    '....kkbbbbkk....',
    '..wkbbbllbbbk...',
    '..wkbkbbbbkbk...',
    '..wkk.bbbb.kk...',
    '..g...kbbk......',
    '.....kddddk.....',
    '.....kd..dk.....',
    '.....kd..dk.....',
    '....kkk..kkk....',
  ],
  flyer: [
    'k..............k',
    'kk....kkkk....kk',
    'kbk..kbbbbk..kbk',
    'kbbkkbpbpbbkkbbk',
    '.kbbbbbbbbbbbbk.',
    '..kbbbdbbdbbbk..',
    '...kk.kbbk.kk...',
    '......kddk......',
    '.......kk.......',
  ],
  bug: [
    '..k.k...........',
    '...kkkkkkkkkk...',
    '..kpbkllllllbkk.',
    '.kbbbkbbbbbbbbbk',
    '.kbbbkbbbbbbbbbk',
    '..kkkkdddddddkk.',
    '..k.k.k..k.k.k..',
    '.k..k..k..k..k..',
  ],
  golem: [
    '....kkkkkkkk....',
    '...kllllbbbbk...',
    '...kbpebbpebk...',
    '...kbbbbbbbbk...',
    '..kkkkkkkkkkkk..',
    '.kbbkllbbbbkbbk.',
    '.kbbkbbbbbbkbbk.',
    '.kbbkbbddbbkbbk.',
    '.kddkbbbbbbkddk.',
    '.kkk.kbbbbk.kkk.',
    '.....kbkkbk.....',
    '....kbbkkbbk....',
    '....kddkkddk....',
    '....kkkkkkkk....',
  ],
  serpent: [
    '......kkkk......',
    '.....kbbbbk.....',
    '....kbpbbbbk....',
    '....kbbbkkbk....',
    '..r..kbk..kk....',
    '..rkkbbk........',
    '....kbbk...kkk..',
    '....kbbbkkkbbbk.',
    '....kbbbbbbbbbk.',
    '.....kdbbbbbdk..',
    '......kkkkkkk...',
  ],
  dragon: [
    '..kk..............kk....',
    '.kbbk...........kkllk...',
    'kbpbbk.........kllbbbk..',
    'kbbbbbk.......kllbbbbbk.',
    '.krbbbbk.....kllbbbbbk..',
    '...kbbbbkkkkkbbbbbbbk...',
    '....kbbbbbbbbbbbbbbk....',
    '.....kbbllllbbbbbbbbk...',
    '....kbbllllllbbbbbbbbk..',
    '....kbbllllllbbbbbbbbbk.',
    '.....kbbllllbbbbbbbbbbk.',
    '......kbbbbbbbbbbbbbbbbk',
    '.......kbbkkkkkkbbkbbbk.',
    '.......kbk......kbk.kbk.',
    '......kbbk.....kbbk.kk..',
    '......kkkk.....kkkk.....',
  ],
};

export function enemyBitmap(shape: EnemyShape): Bitmap {
  return SHAPES[shape] ?? SHAPES.slime;
}

export function enemyPalette(colors: [string, string, string]): Palette {
  return { b: colors[0], d: colors[1], l: colors[2], k: '#1a100a', e: '#ffffff', w: '#e8e8e8', p: '#d8282a', r: '#d8282a' };
}

export function bitmapSize(rows: Bitmap) {
  return { w: Math.max(...rows.map((r) => r.length)), h: rows.length };
}

/** Draws a bitmap; `solid` paints every pixel in one colour (hit flash) */
export function drawBitmap(ctx: CanvasRenderingContext2D, rows: Bitmap, palette: Palette, solid?: string) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const color = solid ?? palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
}
