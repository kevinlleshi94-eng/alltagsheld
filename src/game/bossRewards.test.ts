import { describe, expect, it } from 'vitest';
import { BALANCE, withBalance } from './balance';
import { bossGold, isFirstVictory, rollBossReward, winFight } from './bossRewards';
import { initialProgress } from './seed';
import { makePlayer, NOON, testId } from './testUtils';
import type { LogicContext } from './types';

const ctx = (rng: () => number = () => 0.5, balance = BALANCE): LogicContext => ({ balance, now: NOON, rng });
const at = (area: number, stage: number, round = 1) => ({ round, area, stage });

describe('boss rewards (feedback Phase 4)', () => {
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

  it('normal enemies give nothing, chests follow the chance', () => {
    expect(rollBossReward(at(1, 3), () => 0, BALANCE)).toBeNull();
    expect(rollBossReward(at(1, 10), () => 0, BALANCE)?.chest).toBe('wood');
    expect(rollBossReward(at(1, 10), () => 0.99, BALANCE)?.chest).toBeNull();
    expect(rollBossReward(at(3, 25), () => 0, BALANCE)?.chest).toBe('iron');
    // the dragon always drops a gold chest
    expect(rollBossReward(at(8, 25), () => 0.999, BALANCE)?.chest).toBe('gold');
  });

  it('only the first victory over a boss counts', () => {
    const fresh = makePlayer({ area: 1, stage: 10, progress: initialProgress(9) });
    expect(isFirstVictory(fresh, BALANCE)).toBe(true);
    // after a death: back at the area start, but stage 21 was already reached
    const again = makePlayer({ area: 1, stage: 10, progress: initialProgress(20) });
    expect(isFirstVictory(again, BALANCE)).toBe(false);
  });

  it('winFight advances, adds the gold and creates the dropped item', () => {
    const player = makePlayer({ area: 1, stage: 10, gold: 5, progress: initialProgress(9) });
    const v = winFight(player, ctx(() => 0), testId);
    expect(v.kind).toBe('boss');
    expect(v.player.stage).toBe(11);
    expect(v.player.gold).toBe(5 + BALANCE.bossRewards.goldBoss);
    expect(v.reward?.drop?.chest).toBe('wood');
    expect(v.reward?.drop?.item.chestType).toBe('wood');
    expect(Object.values(v.player.equipped)).not.toContain(v.reward?.drop?.item.id);
  });

  it('winFight gives nothing for a boss beaten before', () => {
    const player = makePlayer({ area: 1, stage: 10, gold: 5, progress: initialProgress(30) });
    const v = winFight(player, ctx(() => 0), testId);
    expect(v.reward).toBeNull();
    expect(v.player.gold).toBe(5);
    expect(v.player.stage).toBe(11);
  });

  it('respects balance overrides', () => {
    const b = withBalance({ bossRewards: { goldBoss: 1, chestBoss: { chance: 0, chest: 'wood' } } });
    const v = winFight(makePlayer({ area: 1, stage: 10, progress: initialProgress(9) }), ctx(() => 0, b), testId);
    expect(v.reward).toEqual({ gold: 1, drop: null });
  });
});
