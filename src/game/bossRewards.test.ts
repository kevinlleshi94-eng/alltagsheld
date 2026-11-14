import { describe, expect, it } from 'vitest';
import { BALANCE, withBalance } from './balance';
import { bossGold, bossLoot, dragonHoard, isFirstVictory, openPendingChest, winFight } from './bossRewards';
import { generateItem, itemBudget, SLOTS } from './items';
import { seededRng } from './rng';
import { initialProgress } from './seed';
import { makePlayer, NOON, testId } from './testUtils';
import type { LogicContext } from './types';

const ctx = (rng: () => number = () => 0.5, balance = BALANCE): LogicContext => ({ balance, now: NOON, rng });
const at = (area: number, stage: number, round = 1) => ({ round, area, stage });

describe('boss rewards (feedback v0.5)', () => {
  it('gold grows per area, area bosses give more', () => {
    const r = BALANCE.bossRewards;
    expect(bossGold(at(1, 5), BALANCE)).toBe(0);
    expect(bossGold(at(1, 10), BALANCE)).toBe(r.goldBoss);
    expect(bossGold(at(1, 20), BALANCE)).toBe(r.goldBoss);
    expect(bossGold(at(1, 25), BALANCE)).toBe(r.goldAreaBoss);
    expect(bossGold(at(2, 10), BALANCE)).toBe(Math.round(r.goldBoss * r.goldGrowthPerArea));
    // round 2 continues the growth
    expect(bossGold(at(1, 10, 2), BALANCE)).toBeGreaterThan(bossGold(at(8, 10), BALANCE));
  });

  it('every boss drops a chest from the table, normal enemies nothing, the dragon its hoard', () => {
    expect(bossLoot(at(1, 3), BALANCE)).toBeNull();
    expect(bossLoot(at(1, 10), BALANCE)).toBe('wood');
    expect(bossLoot(at(2, 25), BALANCE)).toBe('iron');
    expect(bossLoot(at(3, 10), BALANCE)).toBe('iron');
    expect(bossLoot(at(3, 25), BALANCE)).toBe('gold');
    expect(bossLoot(at(6, 20), BALANCE)).toBe('gold');
    expect(bossLoot(at(8, 25), BALANCE)).toBe('dragon');
    // later rounds use the last row; the dragon of every round drops the hoard
    expect(bossLoot(at(1, 10, 2), BALANCE)).toBe('wood');
    expect(bossLoot(at(8, 25, 2), BALANCE)).toBe('dragon');
  });

  it('only the first victory over a boss counts', () => {
    const fresh = makePlayer({ area: 1, stage: 10, progress: initialProgress(9) });
    expect(isFirstVictory(fresh, BALANCE)).toBe(true);
    // after a death: back at the area start, but stage 21 was already reached
    const again = makePlayer({ area: 1, stage: 10, progress: initialProgress(20) });
    expect(isFirstVictory(again, BALANCE)).toBe(false);
  });

  it('winFight advances, adds the gold and keeps the chest until the slot is chosen', () => {
    const player = makePlayer({ area: 1, stage: 10, gold: 5, progress: initialProgress(9) });
    const v = winFight(player, ctx(), testId);
    expect(v.kind).toBe('boss');
    expect(v.player.stage).toBe(11);
    expect(v.player.gold).toBe(5 + BALANCE.bossRewards.goldBoss);
    expect(v.reward?.chest).toMatchObject({ chest: 'wood', from: at(1, 10), at: NOON });
    expect(v.reward?.hoard).toEqual([]);
    expect(v.player.pendingChests).toEqual([v.reward!.chest]);
  });

  it('winFight gives nothing for a boss beaten before', () => {
    const player = makePlayer({ area: 1, stage: 10, gold: 5, progress: initialProgress(30) });
    const v = winFight(player, ctx(), testId);
    expect(v.reward).toBeNull();
    expect(v.player.gold).toBe(5);
    expect(v.player.stage).toBe(11);
    expect(v.player.pendingChests).toEqual([]);
  });

  it('opening a kept chest creates an item for the chosen slot and removes the chest', () => {
    const v = winFight(makePlayer({ area: 1, stage: 10, progress: initialProgress(9) }), ctx(), testId);
    const pending = v.reward!.chest!;
    const opened = openPendingChest(v.player, pending.id, 'shield', ctx(seededRng(3)), 'item-1')!;
    expect(opened.chest).toBe('wood');
    expect(opened.item).toMatchObject({ id: 'item-1', slot: 'shield', chestType: 'wood' });
    expect(opened.player.pendingChests).toEqual([]);
    expect(Object.values(opened.player.equipped)).not.toContain('item-1');
    expect(openPendingChest(opened.player, pending.id, 'shield', ctx(), 'item-2')).toBeNull();
  });

  it('the dragon drops the best legendary item for every slot', () => {
    const player = makePlayer({ area: 8, stage: 25, level: 40, progress: initialProgress(199) });
    const v = winFight(player, ctx(), testId);
    expect(v.reward?.chest).toBeNull();
    expect(v.reward?.hoard.map((i) => i.slot)).toEqual([...SLOTS]);
    expect(v.reward?.hoard.every((i) => i.rarity === 'legendary')).toBe(true);
    // no legendary roll from a chest can beat it
    const hoard = dragonHoard(40, ctx(), testId);
    for (let s = 0; s < 30; s++) {
      const roll = generateItem('weapon', 'gold', 40, seededRng(s), BALANCE, 'x', NOON);
      const sum = (st: typeof roll.stats) => (st.strength ?? 0) + (st.speed ?? 0);
      expect(sum(roll.stats)).toBeLessThanOrEqual(sum(hoard.find((i) => i.slot === 'weapon')!.stats));
    }
    expect(itemBudget('legendary', 40, BALANCE)).toBeGreaterThan(itemBudget('epic', 40, BALANCE));
  });

  it('respects balance overrides', () => {
    const b = withBalance({ bossRewards: { goldBoss: 1, chests: [{ boss: 'gold', areaBoss: 'gold' }] } });
    const v = winFight(makePlayer({ area: 1, stage: 10, progress: initialProgress(9) }), ctx(() => 0, b), testId);
    expect(v.reward?.gold).toBe(1);
    expect(v.reward?.chest?.chest).toBe('gold');
  });
});
