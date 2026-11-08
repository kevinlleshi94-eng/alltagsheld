import { describe, expect, it } from 'vitest';
import { CHESTS, RARITIES, SLOTS } from '../game/items';
import { RARITY_COLORS } from '../ui/labels';
import { CHEST_CLOSED, CHEST_OPEN, chestPalette, ITEM_ART, itemPalette, mix, rgba } from './art';

const keysOf = (rows: readonly string[]) => new Set(rows.join('').replace(/\./g, ''));

describe('shop pixel art', () => {
  it('every bitmap is a rectangle', () => {
    for (const rows of [...Object.values(ITEM_ART), CHEST_CLOSED, CHEST_OPEN]) {
      for (const r of rows) expect(r.length).toBe(rows[0].length);
    }
    expect(CHEST_OPEN[0].length).toBe(CHEST_CLOSED[0].length);
  });

  it('every pixel has a colour in every palette', () => {
    for (const slot of SLOTS)
      for (const rarity of RARITIES) {
        const pal = itemPalette(slot, rarity);
        for (const k of keysOf(ITEM_ART[slot])) expect(pal[k], `${slot} ${k}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    for (const chest of CHESTS)
      for (const glow of [undefined, ...RARITIES]) {
        const pal = chestPalette(chest, glow);
        for (const k of [...keysOf(CHEST_CLOSED), ...keysOf(CHEST_OPEN)]) expect(pal[k], `${chest} ${k}`).toMatch(/^#[0-9a-f]{6}$/);
      }
  });

  it('item icons use the material, not the rarity colour (feedback Phase 4)', () => {
    for (const slot of SLOTS)
      for (const rarity of RARITIES) expect(itemPalette(slot, rarity).m).not.toBe(RARITY_COLORS[rarity]);
    // same slot, legendary is golden, common is not
    expect(itemPalette('head', 'legendary').m).not.toBe(itemPalette('head', 'common').m);
  });

  it('mixes colours', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#ff0000', '#0000ff', 0)).toBe('#ff0000');
  });
});

describe('rgba', () => {
  it('converts hex colours', () => {
    expect(rgba('#ff8000', 0.5)).toBe('rgba(255, 128, 0, 0.5)');
  });
});
