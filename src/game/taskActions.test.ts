import { describe, expect, it } from 'vitest';
import { checkDaily, emptyLog, tapHabit, uncheckDaily, undoLastHabitTap } from './taskActions';
import { ctx, makeDaily, makeHabit, makePlayer, NOON, TODAY } from './testUtils';

describe('daily tasks', () => {
  it('rewards XP = points×10, gold = points×5, vitality + points', () => {
    const task = makeDaily(3);
    const r = checkDaily(makePlayer({ vitality: 50 }), task, emptyLog(TODAY, task), ctx());
    expect(r.player).toMatchObject({ xp: 30, gold: 15, vitality: 53 });
    expect(r.log).toMatchObject({ done: true, doneAt: NOON, reward: { xp: 30, gold: 15, vitality: 3 }, points: 3 });
    expect(r.applied).toEqual({ xp: 30, gold: 15, vitality: 3 });
  });

  it('checking twice does nothing', () => {
    const task = makeDaily(3);
    const once = checkDaily(makePlayer(), task, emptyLog(TODAY, task), ctx());
    const twice = checkDaily(once.player, task, once.log, ctx());
    expect(twice.changed).toBe(false);
    expect(twice.player).toBe(once.player);
  });

  it('un-checking the same day takes the exact reward back (incl. vitality cap)', () => {
    const task = makeDaily(5);
    const start = makePlayer({ vitality: 98, gold: 7 });
    const checked = checkDaily(start, task, emptyLog(TODAY, task), ctx());
    expect(checked.log.reward).toEqual({ xp: 50, gold: 25, vitality: 2 });
    const unchecked = uncheckDaily(checked.player, task, checked.log, ctx());
    expect(unchecked.player).toMatchObject({ xp: 0, gold: 7, vitality: 98, level: 1 });
    expect(unchecked.log).toMatchObject({ done: false, doneAt: null, reward: null });
  });

  it('un-checking reverts a level-up incl. its attribute point', () => {
    const task = makeDaily(10);
    const start = makePlayer({ xp: 50 });
    const checked = checkDaily(start, task, emptyLog(TODAY, task), ctx());
    expect(checked.player.level).toBe(2);
    expect(checked.player.unspentPoints).toBe(1);
    expect(checked.events).toEqual([{ type: 'levelUp', level: 2 }]);
    const unchecked = uncheckDaily(checked.player, task, checked.log, ctx());
    expect(unchecked.player).toMatchObject({ level: 1, xp: 50, unspentPoints: 0 });
    expect(unchecked.events).toEqual([{ type: 'levelDown', level: 1 }]);
  });

  it('does not take back rewards that were granted before a death', () => {
    const task = makeDaily(3);
    const checked = checkDaily(makePlayer(), task, emptyLog(TODAY, task), ctx({ now: NOON }));
    const afterDeath = { ...checked.player, lastDeathAt: NOON + 1000, xp: 0, gold: 0 };
    const r = uncheckDaily(afterDeath, task, checked.log, ctx({ now: NOON + 2000 }));
    expect(r.log.done).toBe(false);
    expect(r.player).toBe(afterDeath);
  });

  it('settled logs cannot be changed', () => {
    const task = makeDaily(3);
    const log = { ...emptyLog('2026-11-04', task), settled: true };
    expect(checkDaily(makePlayer(), task, log, ctx()).changed).toBe(false);
  });
});

describe('habits', () => {
  it('"+" works like a daily reward and is logged with timestamp', () => {
    const habit = makeHabit(1, 0);
    let p = makePlayer({ vitality: 90 });
    let log = emptyLog(TODAY, habit);
    for (let i = 0; i < 3; i++) {
      const r = tapHabit(p, habit, 'plus', log, ctx({ now: NOON + i }));
      p = r.player;
      log = r.log;
    }
    expect(p).toMatchObject({ xp: 30, gold: 15, vitality: 93 });
    expect(log.plusCount).toBe(3);
    expect(log.taps.map((t) => t.at)).toEqual([NOON, NOON + 1, NOON + 2]);
  });

  it('"−" costs vitality = points×3 and gold = points×5, no XP loss, gold not below 0', () => {
    const habit = makeHabit(0, 2);
    const r = tapHabit(makePlayer({ vitality: 80, gold: 4, xp: 20 }), habit, 'minus', emptyLog(TODAY, habit), ctx());
    expect(r.player).toMatchObject({ vitality: 74, gold: 0, xp: 20 });
    expect(r.log.minusCount).toBe(1);
    expect(r.log.taps[0].applied).toEqual({ xp: 0, gold: -4, vitality: -6 });
  });

  it('ignores a direction without points', () => {
    const habit = makeHabit(1, 0);
    expect(tapHabit(makePlayer(), habit, 'minus', emptyLog(TODAY, habit), ctx()).changed).toBe(false);
  });

  it('"−" can kill the hero immediately', () => {
    const habit = makeHabit(0, 1);
    const r = tapHabit(makePlayer({ vitality: 3, level: 2 }), habit, 'minus', emptyLog(TODAY, habit), ctx());
    expect(r.player.deaths).toBe(1);
    expect(r.player.vitality).toBe(100);
    expect(r.events[0].type).toBe('death');
  });

  it('undo removes the last tap of the day and reverts it', () => {
    const habit = makeHabit(1, 1);
    const start = makePlayer({ vitality: 50, gold: 20 });
    const a = tapHabit(start, habit, 'plus', emptyLog(TODAY, habit), ctx({ now: NOON }));
    const b = tapHabit(a.player, habit, 'minus', a.log, ctx({ now: NOON + 1 }));
    const undone = undoLastHabitTap(b.player, habit, b.log, ctx());
    expect(undone.log).toMatchObject({ plusCount: 1, minusCount: 0 });
    expect(undone.log.taps).toHaveLength(1);
    expect(undone.player).toMatchObject({ vitality: a.player.vitality, gold: a.player.gold, xp: a.player.xp });
    const undone2 = undoLastHabitTap(undone.player, habit, undone.log, ctx());
    expect(undone2.player).toMatchObject({ vitality: 50, gold: 20, xp: 0 });
    expect(undoLastHabitTap(undone2.player, habit, undone2.log, ctx()).changed).toBe(false);
  });

  it('the lethal tap cannot be undone into resurrection bonus', () => {
    const habit = makeHabit(0, 1);
    const killed = tapHabit(makePlayer({ vitality: 2 }), habit, 'minus', emptyLog(TODAY, habit), ctx());
    const undone = undoLastHabitTap(killed.player, habit, killed.log, ctx({ now: NOON + 5 }));
    expect(undone.log.minusCount).toBe(0);
    expect(undone.player).toBe(killed.player);
  });
});
