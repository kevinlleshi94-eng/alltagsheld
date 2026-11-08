/**
 * Pixel art for the shop: item icons (per slot, in the material the hero wears) and chests (closed / open).
 * Bitmaps as strings, drawn by PixelSprite. Keys are explained next to each palette.
 */
import type { ChestId } from '../game/items';
import type { Rarity, Slot } from '../game/types';
import { RARITY_COLORS } from '../ui/labels';

// ---------------------------------------------------------------------------
// colours
// ---------------------------------------------------------------------------

/** mixes two #rrggbb colours (t = 0 → a, 1 → b) */
export function mix(a: string, b: string, t: number): string {
  const p = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  const ch = (i: number) =>
    Math.round(p(a, i) + (p(b, i) - p(a, i)) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

const OUTLINE = '#140b05';

// ---------------------------------------------------------------------------
// items (12×12)
// o outline · m main (material) · h highlight · s shade · b leather/grip · y trim
// ---------------------------------------------------------------------------

export const ITEM_ART: Record<Slot, readonly string[]> = {
  head: [
    '............',
    '....oooo....',
    '..oohmmmoo..',
    '.ohhmmmmmso.',
    '.ohmmmmmmso.',
    '.ommmmmmmso.',
    '.ommoooomso.',
    '.omo....oso.',
    '.omo....oso.',
    '.omso..osso.',
    '..oo....oo..',
    '............',
  ],
  body: [
    '............',
    '.ooo....ooo.',
    'ohmmoooommso',
    'ohmmmmmmmmso',
    '.ohmmmmmmso.',
    '.ohmmhmmmso.',
    '.ommmhmmmso.',
    '.ommmmmmmso.',
    '.osmmmmmsso.',
    '.obbbyybbbo.',
    '.osmmmmmsso.',
    '..oooooooo..',
  ],
  weapon: [
    '.....oo.....',
    '....ohmo....',
    '....ohmo....',
    '....ohmo....',
    '....ohmo....',
    '....ohso....',
    '....ohso....',
    '.oooohsoooo.',
    '.oyyyyyyyyo.',
    '.oooobboooo.',
    '....obbo....',
    '....oyyo....',
  ],
  shield: [
    '............',
    '.oooooooooo.',
    '.ohhmmmmmso.',
    '.ohmmyymmso.',
    '.ohmmyymmso.',
    '.ohyyyyyyso.',
    '.ommmyymmso.',
    '..ommyymso..',
    '..osmyymso..',
    '...osmmso...',
    '....osso....',
    '.....oo.....',
  ],
};

/** main / highlight / shade of a material (lighter than the LPC ramps, so icons read on the dark UI) */
const MATERIALS = {
  iron: { m: '#6f6880', h: '#9d96aa', s: '#3c3748' },
  steel: { m: '#8f8784', h: '#cdbea6', s: '#55505f' },
  silver: { m: '#9aa4a3', h: '#e2ebdf', s: '#525960' },
  gold: { m: '#f0b13c', h: '#ffe57a', s: '#b76a1e' },
  leather: { m: '#8a5a2e', h: '#b37c46', s: '#5a3618' },
  wood: { m: '#9a6332', h: '#c08048', s: '#6a3d1c' },
  kiteGray: { m: '#8c8f96', h: '#c3c7cc', s: '#55585e' },
  kiteBlue: { m: '#4a6fb0', h: '#86a6dc', s: '#2c4373' },
  kiteRed: { m: '#b0403a', h: '#e0766b', s: '#6e2420' },
  kiteOrange: { m: '#e08a2c', h: '#ffc06a', s: '#9a5512' },
} as const;
type Material = keyof typeof MATERIALS;

const TRIM = { gold: '#e8b33a', iron: '#6f6880', brass: '#c08a2c' } as const;

/**
 * Look of an item icon = the same material as at the hero in the fight (GEAR in battle/assets/catalog.ts).
 * Rarity is shown by the name colour only (user feedback Phase 4: a green icon for a silver helmet was confusing).
 */
export const ITEM_LOOK: Record<Slot, Record<Rarity, { material: Material; trim: string }>> = {
  head: {
    common: { material: 'iron', trim: TRIM.iron },
    uncommon: { material: 'steel', trim: TRIM.iron },
    rare: { material: 'silver', trim: TRIM.iron },
    epic: { material: 'steel', trim: TRIM.gold },
    legendary: { material: 'gold', trim: TRIM.gold },
  },
  body: {
    common: { material: 'leather', trim: TRIM.brass },
    uncommon: { material: 'iron', trim: TRIM.brass },
    rare: { material: 'steel', trim: TRIM.brass },
    epic: { material: 'silver', trim: TRIM.gold },
    legendary: { material: 'gold', trim: TRIM.gold },
  },
  weapon: {
    common: { material: 'iron', trim: TRIM.brass },
    uncommon: { material: 'steel', trim: TRIM.brass },
    rare: { material: 'silver', trim: TRIM.gold },
    epic: { material: 'steel', trim: TRIM.gold },
    legendary: { material: 'gold', trim: TRIM.gold },
  },
  shield: {
    common: { material: 'wood', trim: TRIM.iron },
    uncommon: { material: 'kiteGray', trim: TRIM.iron },
    rare: { material: 'kiteBlue', trim: '#c3c7cc' },
    epic: { material: 'kiteRed', trim: '#c3c7cc' },
    legendary: { material: 'kiteOrange', trim: TRIM.gold },
  },
};

export function itemPalette(slot: Slot, rarity: Rarity): Record<string, string> {
  const look = ITEM_LOOK[slot][rarity];
  return { o: OUTLINE, ...MATERIALS[look.material], b: '#7a4a22', y: look.trim };
}

// ---------------------------------------------------------------------------
// chests (16 wide; the open chest is 2 rows taller – align at the bottom)
// o outline · l/L lid light/main · B/b body main/shade · M/n metal band/shade
// K/k lock/lock shade · d inside of the lid · g/i glow inside (rarity colour)
// ---------------------------------------------------------------------------

export const CHEST_CLOSED: readonly string[] = [
  '..oooooooooooo..',
  '.olMllllllllMlo.',
  '.oLMLLLLLLLLMLo.',
  '.oLMLLLLLLLLMLo.',
  '.oMMMMMKKMMMMMo.',
  '.oBMBBKkkKBBMBo.',
  '.oBMBBKkkKBBMBo.',
  '.oBMBBBKKBBBMBo.',
  '.obnbbbbbbbbnbo.',
  '.oMMMMMMMMMMMMo.',
  '.onnnnnnnnnnnno.',
  '..oooooooooooo..',
];

export const CHEST_OPEN: readonly string[] = [
  '...oooooooooo...',
  '..oddddddddddo..',
  '.oddddddddddddo.',
  '.oMMMMMMMMMMMMo.',
  '.oggggggggggggo.',
  '.oiggggggggggio.',
  '.oMMMMMKKMMMMMo.',
  '.oBMBBKkkKBBMBo.',
  '.oBMBBKkkKBBMBo.',
  '.oBMBBBKKBBBMBo.',
  '.obnbbbbbbbbnbo.',
  '.oMMMMMMMMMMMMo.',
  '.onnnnnnnnnnnno.',
  '..oooooooooooo..',
];

const CHEST_COLORS: Record<ChestId, Record<string, string>> = {
  wood: { l: '#c08048', L: '#9a6332', B: '#8a5428', b: '#6a3d1c', M: '#6b7078', n: '#41454c', K: '#e8b33a', k: '#7a5212', d: '#4a2a12' },
  iron: { l: '#c3cad3', L: '#939ba5', B: '#7d858f', b: '#5e646c', M: '#3f444b', n: '#2a2e33', K: '#e8b33a', k: '#7a5212', d: '#3a3f46' },
  gold: { l: '#ffe08a', L: '#e6b43e', B: '#cf9a2c', b: '#a0721a', M: '#8a5a12', n: '#5e3c0a', K: '#e0554a', k: '#6e1a14', d: '#6a4a10' },
};

/** chest colours; `glow` = rarity colour of what is inside (open chest) */
export function chestPalette(chest: ChestId, glow?: Rarity): Record<string, string> {
  const g = glow ? RARITY_COLORS[glow] : '#2a1a0c';
  return { o: OUTLINE, ...CHEST_COLORS[chest], g: glow ? mix(g, '#ffffff', 0.45) : g, i: g };
}

/** #rrggbb → rgba() with alpha */
export function rgba(hex: string, alpha: number): string {
  const p = (i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgba(${p(0)}, ${p(1)}, ${p(2)}, ${alpha})`;
}
