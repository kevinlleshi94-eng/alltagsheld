import { describe, expect, it } from 'vitest';
import { addXp, allocateAttribute, removeLastAttributePoint, removeXp, totalXpForLevel, xpToNextLevel } from './progression';
import { makePlayer, TEST_BALANCE as BALANCE } from './testUtils';

describe('levels', () => {
  it('uses 100 × level^1.2 as start formula', () => {
    expect(xpToNextLevel(1, BALANCE)).toBe(100);
    expect(xpToNextLevel(2, BALANCE)).toBe(230);
    expect(xpToNextLevel(3, BALANCE)).toBe(374);
    expect(totalXpForLevel(3, BALANCE)).toBe(330);
  });

  it('handles multiple level-ups at once and grants attribute points', () => {
    const { player, levelsGained } = addXp(makePlayer(), 340, BALANCE);
    expect(levelsGained).toEqual([2, 3]);
    expect(player.level).toBe(3);
    expect(player.xp).toBe(10);
    expect(player.unspentPoints).toBe(2);
  });

  it('removing XP drops levels and the matching attribute points', () => {
    let p = addXp(makePlayer(), 340, BALANCE).player; // level 3, 2 points
    p = allocateAttribute(p, 'strength');
    p = allocateAttribute(p, 'life'); // history: strength, life
    const r = removeXp(p, 20, BALANCE); // 10 − 20 → back to level 2
    expect(r.levelsLost).toEqual([3]);
    expect(r.player.level).toBe(2);
    expect(r.player.xp).toBe(220);
    expect(r.player.attributes).toEqual({ strength: 1, speed: 0, life: 0 });
    expect(r.player.attributeHistory).toEqual(['strength']);
  });

  it('XP never drops below 0 on level 1', () => {
    const r = removeXp(makePlayer({ xp: 30 }), 100, BALANCE);
    expect(r.player.level).toBe(1);
    expect(r.player.xp).toBe(0);
    expect(r.levelsLost).toEqual([]);
  });
});

describe('attribute points', () => {
  it('allocates only if points are available and records the order', () => {
    let p = makePlayer({ unspentPoints: 2 });
    p = allocateAttribute(p, 'speed');
    p = allocateAttribute(p, 'strength');
    p = allocateAttribute(p, 'life'); // no point left → ignored
    expect(p.attributes).toEqual({ strength: 1, speed: 1, life: 0 });
    expect(p.attributeHistory).toEqual(['speed', 'strength']);
    expect(p.unspentPoints).toBe(0);
  });

  it('removes a saved point first, then the last spent one', () => {
    let p = makePlayer({ unspentPoints: 1, attributes: { strength: 1, speed: 1, life: 0 }, attributeHistory: ['strength', 'speed'] });
    let r = removeLastAttributePoint(p);
    expect(r.removed).toBe('unspent');
    expect(r.player.unspentPoints).toBe(0);
    r = removeLastAttributePoint(r.player);
    expect(r.removed).toBe('speed');
    expect(r.player.attributes.speed).toBe(0);
    r = removeLastAttributePoint(r.player);
    expect(r.removed).toBe('strength');
    r = removeLastAttributePoint(r.player);
    expect(r.removed).toBeNull();
    p = r.player;
    expect(p.attributes).toEqual({ strength: 0, speed: 0, life: 0 });
  });
});
