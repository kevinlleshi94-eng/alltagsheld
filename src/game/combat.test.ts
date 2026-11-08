import { describe, expect, it } from 'vitest';
import { BALANCE, withBalance } from './balance';
import {
  canBeat,
  effectiveAttributes,
  enemyForStage,
  gearCrit,
  heroStats,
  heroStatsFromAttributes,
  nextStage,
  positionFromIndex,
  runFight,
  stageIndex,
  stageKind,
  startFight,
  stepFight,
  wallIndex,
  type FightEvent,
} from './combat';
import { itemPower, rollItemStats, rollRarity } from './items';
import { seededRng } from './rng';
import { makePlayer } from './testUtils';

const attrs = (strength: number, speed: number, life: number) => ({ strength, speed, life });

describe('hero stats (SPEC 6.3)', () => {
  it('uses the start formulas', () => {
    const s = heroStatsFromAttributes(attrs(0, 0, 0), false, BALANCE);
    expect(s).toMatchObject({ maxHp: 100, damage: 10, attackInterval: 1.2, critChance: 0.1, critMultiplier: 1.5 });
    const t = heroStatsFromAttributes(attrs(5, 10, 4), false, BALANCE);
    expect(t.maxHp).toBe(160);
    expect(t.damage).toBe(25);
    expect(t.attackInterval).toBeCloseTo(1.2 / 1.6);
  });

  it('caps the attack interval at 0.25 s', () => {
    expect(heroStatsFromAttributes(attrs(0, 500, 0), false, BALANCE).attackInterval).toBe(0.25);
  });

  it('exhausted heroes deal 25 % less damage', () => {
    const fresh = heroStats(makePlayer({ vitality: 30, attributes: attrs(10, 0, 0) }), [], BALANCE);
    const tired = heroStats(makePlayer({ vitality: 29, attributes: attrs(10, 0, 0) }), [], BALANCE);
    expect(fresh.damage).toBe(40);
    expect(tired.damage).toBe(30);
    expect(tired.exhausted).toBe(true);
  });

  it('adds equipment bonuses as attribute points', () => {
    const a = effectiveAttributes({ attributes: attrs(1, 0, 2) }, [{ stats: { strength: 3 } }, null, { stats: { life: 1, speed: 2 } }]);
    expect(a).toEqual(attrs(4, 2, 3));
  });

  it('shields add Krit-Chance (percent points), capped', () => {
    const shield = { stats: { life: 2, crit: 6 } };
    expect(gearCrit([shield, null, { stats: { strength: 1 } }])).toBe(6);
    expect(effectiveAttributes({ attributes: attrs(0, 0, 0) }, [shield])).toEqual(attrs(0, 0, 2));
    const s = heroStats({ attributes: attrs(0, 0, 0), vitality: 100 }, [shield], BALANCE);
    expect(s.critChance).toBeCloseTo(BALANCE.combat.critChance + 0.06);
    expect(s.critBonus).toBe(6);
    expect(heroStatsFromAttributes(attrs(0, 0, 0), false, BALANCE, 500).critChance).toBe(BALANCE.combat.maxCritChance);
  });
});

describe('stages', () => {
  it('indexes across areas and rounds', () => {
    expect(stageIndex({ round: 1, area: 1, stage: 1 }, BALANCE)).toBe(0);
    expect(stageIndex({ round: 1, area: 2, stage: 1 }, BALANCE)).toBe(25);
    expect(stageIndex({ round: 2, area: 1, stage: 1 }, BALANCE)).toBe(200);
    expect(positionFromIndex(199, BALANCE)).toEqual({ round: 1, area: 8, stage: 25 });
  });

  it('advances stage → area → round', () => {
    expect(nextStage({ round: 1, area: 1, stage: 24 }, BALANCE)).toEqual({ round: 1, area: 1, stage: 25 });
    expect(nextStage({ round: 1, area: 1, stage: 25 }, BALANCE)).toEqual({ round: 1, area: 2, stage: 1 });
    expect(nextStage({ round: 1, area: 8, stage: 25 }, BALANCE)).toEqual({ round: 2, area: 1, stage: 1 });
  });

  it('places bosses on every 10th stage and the area boss on 25', () => {
    expect([1, 9, 10, 11, 20, 24, 25].map((s) => stageKind(s, BALANCE))).toEqual([
      'normal', 'normal', 'boss', 'normal', 'boss', 'normal', 'areaBoss',
    ]);
    const boss = enemyForStage({ round: 1, area: 2, stage: 10 }, BALANCE);
    expect(boss.def.name).toBe('Koboldhäuptling');
    expect(boss.timerSec).toBe(BALANCE.combat.bossTimerSec);
    const areaBoss = enemyForStage({ round: 1, area: 8, stage: 25 }, BALANCE);
    expect(areaBoss.def.name).toBe('Drache');
    expect(areaBoss.timerSec).toBe(BALANCE.combat.areaBossTimerSec);
    expect(enemyForStage({ round: 1, area: 1, stage: 3 }, BALANCE).timerSec).toBe(10);
  });

  it('no fight lasts longer than 10 seconds (user requirement)', () => {
    for (const stage of [1, 10, 20, 25]) {
      expect(enemyForStage({ round: 1, area: 1, stage }, BALANCE).timerSec).toBeLessThanOrEqual(10);
    }
  });

  it('bosses are much stronger than the stage before', () => {
    const before = enemyForStage({ round: 1, area: 3, stage: 9 }, BALANCE);
    const boss = enemyForStage({ round: 1, area: 3, stage: 10 }, BALANCE);
    expect(boss.maxHp).toBeGreaterThan(before.maxHp * 2);
  });

  it('enemies grow stronger with every stage and round', () => {
    const a = enemyForStage({ round: 1, area: 1, stage: 1 }, BALANCE);
    const b = enemyForStage({ round: 2, area: 1, stage: 1 }, BALANCE);
    expect(b.maxHp).toBeGreaterThan(a.maxHp);
    expect(b.damage).toBeGreaterThan(a.damage);
  });

  it('neighbouring stages use different enemies', () => {
    const names = [1, 2, 3, 4, 5].map((s) => enemyForStage({ round: 1, area: 1, stage: s }, BALANCE).def.name);
    for (let i = 1; i < names.length; i++) expect(names[i]).not.toBe(names[i - 1]);
  });
});

describe('fight engine', () => {
  const hero = heroStatsFromAttributes(attrs(0, 0, 0), false, BALANCE);

  it('is deterministic with a seeded rng and ends with exactly one end event', () => {
    const enemy = enemyForStage({ round: 1, area: 1, stage: 1 }, BALANCE);
    const run = () => stepFight(startFight(hero, enemy, 10, BALANCE), Infinity, seededRng(7), BALANCE);
    const a = run();
    const b = run();
    expect(a.events).toEqual(b.events);
    expect(a.events.filter((e) => e.type === 'end')).toHaveLength(1);
    expect(a.state.result).toBe('won');
  });

  it('stepping in small frames gives the same result as one big step', () => {
    const enemy = enemyForStage({ round: 1, area: 1, stage: 4 }, BALANCE);
    let state = startFight(hero, enemy, 10, BALANCE);
    const rng = seededRng(3);
    const events: FightEvent[] = [];
    while (!state.result) {
      const r = stepFight(state, 1 / 60, rng, BALANCE);
      state = r.state;
      events.push(...r.events);
    }
    const once = stepFight(startFight(hero, enemy, 10, BALANCE), Infinity, seededRng(3), BALANCE);
    const norm = (list: FightEvent[]) => list.map((e) => ({ ...e, at: Math.round(e.at * 1e6) / 1e6 }));
    expect(norm(events)).toEqual(norm(once.events));
  });

  it('alternates attacks in each side\'s own rhythm', () => {
    const tank = { maxHp: 10_000, damage: 1, attackInterval: 2, critChance: 0, critMultiplier: 1 };
    const { events } = stepFight(startFight(hero, tank, 10, BALANCE), Infinity, () => 0.5, BALANCE, { deterministic: true });
    const heroHits = events.filter((e) => e.type === 'attack' && e.by === 'hero');
    const enemyHits = events.filter((e) => e.type === 'attack' && e.by === 'enemy');
    expect(heroHits.length).toBe(9); // 0.35, 1.55 … 9.95
    expect(enemyHits.length).toBe(5); // 0.6, 2.6 … 8.6
    expect(events[events.length - 1]).toMatchObject({ type: 'end', result: 'timeout' });
  });

  it('a hero with 0 HP loses', () => {
    const killer = { maxHp: 10_000, damage: 1000, attackInterval: 1, critChance: 0, critMultiplier: 1 };
    const r = runFight(hero, { ...enemyForStage({ round: 1, area: 1, stage: 1 }, BALANCE), ...killer }, seededRng(1), BALANCE);
    expect(r.result).toBe('lost');
    expect(r.duration).toBeCloseTo(0.6);
  });

  it('crits are 1.5× and happen about 10 % of the time', () => {
    const dummy = { maxHp: 1e9, damage: 0, attackInterval: 1e9, critChance: 0, critMultiplier: 1 };
    const fast = { ...hero, attackInterval: 0.25 };
    const { events } = stepFight(startFight(fast, dummy, 2500, BALANCE), Infinity, seededRng(11), BALANCE);
    const hits = events.filter((e): e is Extract<FightEvent, { type: 'attack' }> => e.type === 'attack');
    const critRate = hits.filter((h) => h.crit).length / hits.length;
    expect(critRate).toBeGreaterThan(0.08);
    expect(critRate).toBeLessThan(0.12);
    expect(Math.max(...hits.map((h) => h.damage))).toBeLessThanOrEqual(Math.round(10 * 1.1 * 1.5));
  });
});

describe('early game (SPEC 11)', () => {
  it('a fresh level-1 hero gets to stage 9 at most, the first boss stops him', () => {
    const fresh = heroStatsFromAttributes(attrs(0, 0, 0), false, BALANCE);
    for (let s = 1; s <= 5; s++) expect(canBeat(fresh, enemyForStage({ round: 1, area: 1, stage: s }, BALANCE), BALANCE)).toBe(true);
    const wall = wallIndex(fresh, BALANCE);
    expect(wall).toBeGreaterThanOrEqual(5);
    expect(wall).toBeLessThanOrEqual(9); // index 9 = stage 10 (first boss)
  });

  const winRate = (hero: ReturnType<typeof heroStatsFromAttributes>, stage: number, n = 300) => {
    const enemy = enemyForStage({ round: 1, area: 1, stage }, BALANCE);
    const rng = seededRng(11);
    let wins = 0;
    for (let i = 0; i < n; i++) if (runFight(hero, enemy, rng, BALANCE).result === 'won') wins++;
    return wins / n;
  };

  // feedback Phase 4 (user volume 35 points/day): boss 10 on day 3–4 with level 5 + the first 2–3 chests,
  // boss 20 about 5 days later (level 8, 4 chests) – see BALANCING.md
  it('the first boss (stage 10) needs level 5 and the first chests', () => {
    expect(winRate(heroStatsFromAttributes(attrs(2, 0, 0), false, BALANCE), 10)).toBe(0); // day 1
    expect(winRate(heroStatsFromAttributes(attrs(4, 0, 0), false, BALANCE), 10)).toBeLessThan(0.1); // level 5, no items
    expect(winRate(heroStatsFromAttributes(attrs(6, 1, 1), false, BALANCE), 10)).toBeGreaterThan(0.9); // + 2 wood items
  });

  it('the second boss (stage 20) needs about a week more', () => {
    expect(winRate(heroStatsFromAttributes(attrs(6, 1, 1), false, BALANCE), 20)).toBe(0);
    expect(winRate(heroStatsFromAttributes(attrs(12, 2, 2), false, BALANCE), 20)).toBeGreaterThan(0.8);
  });

  it('attribute points move the wall', () => {
    const weak = wallIndex(heroStatsFromAttributes(attrs(0, 0, 0), false, BALANCE), BALANCE);
    const strong = wallIndex(heroStatsFromAttributes(attrs(5, 3, 2), false, BALANCE), BALANCE);
    expect(strong).toBeGreaterThan(weak);
  });
});

describe('items', () => {
  it('rolls rarities according to the chest table', () => {
    const rng = seededRng(5);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 20_000; i++) {
      const r = rollRarity('wood', rng, BALANCE);
      counts[r] = (counts[r] ?? 0) + 1;
    }
    expect(counts.common / 20_000).toBeCloseTo(0.7, 1);
    expect(counts.rare / 20_000).toBeCloseTo(0.05, 1);
    expect(counts.epic ?? 0).toBe(0);
  });

  it('follows the slot rules (feedback Phase 4)', () => {
    const rng = seededRng(9);
    for (const rarity of ['common', 'rare', 'legendary'] as const)
      for (let i = 0; i < 30; i++) {
        const weapon = rollItemStats('weapon', rarity, 10, rng, BALANCE);
        expect(weapon.strength).toBeGreaterThan(0);
        expect(Object.keys(weapon).every((k) => k === 'strength' || k === 'speed')).toBe(true);
        expect(Object.keys(rollItemStats('head', rarity, 10, rng, BALANCE))).toEqual(['speed']);
        expect(Object.keys(rollItemStats('body', rarity, 10, rng, BALANCE))).toEqual(['life']);
        expect(Object.keys(rollItemStats('shield', rarity, 10, rng, BALANCE))).toEqual(['life', 'crit']);
      }
  });

  it('some weapons also give Tempo', () => {
    const rng = seededRng(4);
    const withSpeed = Array.from({ length: 400 }, () => rollItemStats('weapon', 'rare', 5, rng, BALANCE)).filter((w) => w.speed).length;
    expect(withSpeed / 400).toBeCloseTo(BALANCE.items.weaponSpeedChance, 1);
  });

  it('item value grows with rarity and player level', () => {
    const avg = (rarity: 'common' | 'legendary', level: number) => {
      const rng = seededRng(2);
      let sum = 0;
      for (let i = 0; i < 200; i++) sum += itemPower(rollItemStats('weapon', rarity, level, rng, BALANCE), BALANCE);
      return sum / 200;
    };
    expect(avg('legendary', 1)).toBeGreaterThan(avg('common', 1) * 3);
    expect(avg('common', 20)).toBeGreaterThan(avg('common', 1) * 2);
  });

  it('respects balance overrides', () => {
    const b = withBalance({ items: { ...BALANCE.items, chests: { ...BALANCE.items.chests, wood: { price: 100, odds: [0, 0, 0, 0, 1] } } } });
    expect(rollRarity('wood', Math.random, b)).toBe('legendary');
  });
});
