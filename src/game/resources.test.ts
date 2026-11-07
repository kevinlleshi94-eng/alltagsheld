import { describe, expect, it } from 'vitest';
import { BALANCE, withBalance } from './balance';
import { applyDeath } from './death';
import { applyDelta, isExhausted } from './resources';
import { ctx, makePlayer } from './testUtils';

describe('applyDelta', () => {
  it('caps vitality at max and reports the applied amount', () => {
    const r = applyDelta(makePlayer({ vitality: 98 }), { xp: 10, gold: 5, vitality: 5 }, ctx());
    expect(r.player.vitality).toBe(100);
    expect(r.applied).toEqual({ xp: 10, gold: 5, vitality: 2 });
  });

  it('never lets gold go below 0', () => {
    const r = applyDelta(makePlayer({ gold: 3 }), { xp: 0, gold: -10, vitality: 0 }, ctx());
    expect(r.player.gold).toBe(0);
    expect(r.applied.gold).toBe(-3);
  });

  it('kills the hero at vitality ≤ 0', () => {
    const r = applyDelta(makePlayer({ vitality: 3, level: 2, gold: 50 }), { xp: 0, gold: 0, vitality: -3 }, ctx());
    expect(r.died).toBe(true);
    expect(r.player.vitality).toBe(100);
    expect(r.player.gold).toBe(0);
    expect(r.player.deaths).toBe(1);
    expect(r.events.map((e) => e.type)).toEqual(['death']);
  });

  it('can suppress death or losses', () => {
    const noDeath = applyDelta(makePlayer({ vitality: 3 }), { xp: 0, gold: 0, vitality: -10 }, ctx(), { allowDeath: false });
    expect(noDeath.died).toBe(false);
    expect(noDeath.player.vitality).toBe(1);

    const noLoss = applyDelta(makePlayer({ vitality: 3, gold: 9 }), { xp: 0, gold: -5, vitality: -10 }, ctx(), {
      suppressLosses: true,
    });
    expect(noLoss.player.vitality).toBe(3);
    expect(noLoss.player.gold).toBe(9);
    expect(noLoss.applied).toEqual({ xp: 0, gold: 0, vitality: 0 });
  });

  it('emits level events', () => {
    const up = applyDelta(makePlayer(), { xp: 100, gold: 0, vitality: 0 }, ctx());
    expect(up.events).toEqual([{ type: 'levelUp', level: 2 }]);
    const down = applyDelta(up.player, { xp: -1, gold: 0, vitality: 0 }, ctx());
    expect(down.events).toEqual([{ type: 'levelDown', level: 1 }]);
    expect(down.player.unspentPoints).toBe(0);
  });

  it('detects exhaustion below 30 %', () => {
    expect(isExhausted(makePlayer({ vitality: 30 }), BALANCE)).toBe(false);
    expect(isExhausted(makePlayer({ vitality: 29 }), BALANCE)).toBe(true);
  });
});

describe('death', () => {
  const equipped = { head: 'helm', body: null, weapon: 'sword', shield: null };

  it('applies all five consequences', () => {
    const p = makePlayer({
      level: 4,
      xp: 120,
      gold: 345,
      vitality: -5,
      unspentPoints: 0,
      attributes: { strength: 2, speed: 0, life: 1 },
      attributeHistory: ['strength', 'life', 'strength'],
      equipped,
      area: 3,
      stage: 17,
      round: 2,
    });
    const { player, report } = applyDeath(p, ctx({ rng: () => 0.99 }));
    expect(player.level).toBe(3);
    expect(player.xp).toBe(0);
    expect(player.attributes).toEqual({ strength: 1, speed: 0, life: 1 });
    expect(player.attributeHistory).toEqual(['strength', 'life']);
    expect(player.gold).toBe(0);
    expect(player.equipped).toEqual({ head: 'helm', body: null, weapon: null, shield: null });
    expect(player.stage).toBe(1);
    expect(player.area).toBe(3);
    expect(player.round).toBe(2);
    expect(player.vitality).toBe(100);
    expect(player.deaths).toBe(1);
    expect(player.lastDeathAt).toBe(ctx().now);
    expect(report).toMatchObject({
      levelBefore: 4,
      levelAfter: 3,
      goldLost: 345,
      removedPoint: 'strength',
      brokenItem: { id: 'sword', slot: 'weapon' },
      stageBefore: { round: 2, area: 3, stage: 17 },
      stageAfter: { round: 2, area: 3, stage: 1 },
    });
  });

  it('removes a saved point before a spent one', () => {
    const p = makePlayer({ level: 3, unspentPoints: 1, attributes: { strength: 1, speed: 0, life: 0 }, attributeHistory: ['strength'] });
    const { player, report } = applyDeath(p, ctx());
    expect(report.removedPoint).toBe('unspent');
    expect(player.unspentPoints).toBe(0);
    expect(player.attributes.strength).toBe(1);
  });

  it('cannot go below level 1', () => {
    const { player, report } = applyDeath(makePlayer({ level: 1, xp: 50 }), ctx());
    expect(player.level).toBe(1);
    expect(player.xp).toBe(0);
    expect(report.removedPoint).toBeNull();
    expect(report.brokenItem).toBeNull();
  });

  it('respects the switches in balance.death', () => {
    const balance = withBalance({
      death: { loseLevel: false, loseGold: false, breakRandomEquippedItem: false, resetToAreaStart: false },
    });
    const p = makePlayer({ level: 5, xp: 40, gold: 99, stage: 12, equipped });
    const { player } = applyDeath(p, ctx({ balance }));
    expect(player).toMatchObject({ level: 5, xp: 40, gold: 99, stage: 12, equipped, vitality: 100, deaths: 1 });
  });
});
