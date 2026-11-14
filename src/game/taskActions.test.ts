import { describe, expect, it } from 'vitest';
import {
  checkDaily,
  emptyLog,
  habitUsedUp,
  tapHabit,
  taskCountsOn,
  uncheckDaily,
  undoLastHabitTap,
  type TaskCounts,
} from './taskActions';
import { ctx, makeDaily, makeHabit, makePlayer, NOON, TEST_BALANCE, TODAY } from './testUtils';

/** 4 dailies, 4 "+" habits → a daily is worth 200/4 XP and 100/4 gold, a "+" tap 50/4 XP and 25/4 gold */
const COUNTS: TaskCounts = { dailies: 4, plusHabits: 4 };

describe('daily tasks', () => {
  it('every daily is worth the same share of the daily budget, no vitality', () => {
    const task = makeDaily(3);
    const r = checkDaily(makePlayer({ vitality: 50 }), task, emptyLog(TODAY, task), COUNTS, ctx());
    expect(r.player).toMatchObject({ xp: 50, gold: 25, vitality: 50 });
    expect(r.log).toMatchObject({ done: true, doneAt: NOON, reward: { xp: 50, gold: 25, vitality: 0 } });
    expect(r.applied).toEqual({ xp: 50, gold: 25, vitality: 0 });

    const small = makeDaily(1);
    const r2 = checkDaily(makePlayer(), small, emptyLog(TODAY, small), COUNTS, ctx());
    expect(r2.applied).toEqual(r.applied);
  });

  it('the share depends on how many dailies are active', () => {
    const task = makeDaily(2);
    const r = checkDaily(makePlayer(), task, emptyLog(TODAY, task), { dailies: 13, plusHabits: 4 }, ctx());
    expect(r.applied).toEqual({ xp: 15, gold: 8, vitality: 0 });
  });

  it('checking twice does nothing', () => {
    const task = makeDaily(3);
    const once = checkDaily(makePlayer(), task, emptyLog(TODAY, task), COUNTS, ctx());
    const twice = checkDaily(once.player, task, once.log, COUNTS, ctx());
    expect(twice.changed).toBe(false);
    expect(twice.player).toBe(once.player);
  });

  it('un-checking the same day takes the exact reward back', () => {
    const task = makeDaily(5);
    const start = makePlayer({ vitality: 98, gold: 7 });
    const checked = checkDaily(start, task, emptyLog(TODAY, task), COUNTS, ctx());
    const unchecked = uncheckDaily(checked.player, task, checked.log, ctx());
    expect(unchecked.player).toMatchObject({ xp: 0, gold: 7, vitality: 98, level: 1 });
    expect(unchecked.log).toMatchObject({ done: false, doneAt: null, reward: null });
  });

  it('un-checking reverts a level-up incl. its attribute point', () => {
    const task = makeDaily(10);
    const start = makePlayer({ xp: 60 });
    const checked = checkDaily(start, task, emptyLog(TODAY, task), { dailies: 2, plusHabits: 0 }, ctx());
    expect(checked.player.level).toBe(2);
    expect(checked.player.unspentPoints).toBe(1);
    expect(checked.events).toEqual([{ type: 'levelUp', level: 2 }]);
    const unchecked = uncheckDaily(checked.player, task, checked.log, ctx());
    expect(unchecked.player).toMatchObject({ level: 1, xp: 60, unspentPoints: 0 });
    expect(unchecked.events).toEqual([{ type: 'levelDown', level: 1 }]);
  });

  it('does not take back rewards that were granted before a death', () => {
    const task = makeDaily(3);
    const checked = checkDaily(makePlayer(), task, emptyLog(TODAY, task), COUNTS, ctx({ now: NOON }));
    const afterDeath = { ...checked.player, lastDeathAt: NOON + 1000, xp: 0, gold: 0 };
    const r = uncheckDaily(afterDeath, task, checked.log, ctx({ now: NOON + 2000 }));
    expect(r.log.done).toBe(false);
    expect(r.player).toBe(afterDeath);
  });

  it('settled logs cannot be changed', () => {
    const task = makeDaily(3);
    const log = { ...emptyLog('2026-11-04', task), settled: true };
    expect(checkDaily(makePlayer(), task, log, COUNTS, ctx()).changed).toBe(false);
  });
});

describe('habits', () => {
  it('"+" gives an equal share of the habit budget + vitality, once per day', () => {
    const habit = makeHabit(1, 0);
    const a = tapHabit(makePlayer({ vitality: 90 }), habit, 'plus', emptyLog(TODAY, habit), COUNTS, ctx());
    expect(a.player).toMatchObject({ xp: 13, gold: 6, vitality: 92 });
    expect(a.log.plusCount).toBe(1);
    expect(a.log.taps).toEqual([{ kind: 'plus', at: NOON, applied: { xp: 13, gold: 6, vitality: 2 } }]);
    expect(habitUsedUp(a.log, TEST_BALANCE)).toBe(true);
    const b = tapHabit(a.player, habit, 'plus', a.log, COUNTS, ctx({ now: NOON + 1 }));
    expect(b.changed).toBe(false);
  });

  it('"−" costs vitality = points×3 and gold = points×5, no XP loss, gold not below 0', () => {
    const habit = makeHabit(0, 2);
    const r = tapHabit(makePlayer({ vitality: 80, gold: 4, xp: 20 }), habit, 'minus', emptyLog(TODAY, habit), COUNTS, ctx());
    expect(r.player).toMatchObject({ vitality: 74, gold: 0, xp: 20 });
    expect(r.log.minusCount).toBe(1);
    expect(r.log.taps[0].applied).toEqual({ xp: 0, gold: -4, vitality: -6 });
  });

  it('"+" and "−" share the one tap per day', () => {
    const habit = makeHabit(1, 1);
    const a = tapHabit(makePlayer(), habit, 'plus', emptyLog(TODAY, habit), COUNTS, ctx());
    expect(tapHabit(a.player, habit, 'minus', a.log, COUNTS, ctx()).changed).toBe(false);
  });

  it('ignores a direction without points', () => {
    const habit = makeHabit(1, 0);
    expect(tapHabit(makePlayer(), habit, 'minus', emptyLog(TODAY, habit), COUNTS, ctx()).changed).toBe(false);
  });

  it('"−" can kill the hero immediately', () => {
    const habit = makeHabit(0, 1);
    const r = tapHabit(makePlayer({ vitality: 3, level: 2 }), habit, 'minus', emptyLog(TODAY, habit), COUNTS, ctx());
    expect(r.player.deaths).toBe(1);
    expect(r.player.vitality).toBe(100);
    expect(r.events[0].type).toBe('death');
  });

  it('undo reverts the tap and allows tapping again', () => {
    const habit = makeHabit(1, 1);
    const start = makePlayer({ vitality: 50, gold: 20 });
    const a = tapHabit(start, habit, 'minus', emptyLog(TODAY, habit), COUNTS, ctx({ now: NOON }));
    const undone = undoLastHabitTap(a.player, habit, a.log, ctx());
    expect(undone.log).toMatchObject({ plusCount: 0, minusCount: 0, taps: [] });
    expect(undone.player).toMatchObject({ vitality: 50, gold: 20, xp: 0 });
    expect(habitUsedUp(undone.log, TEST_BALANCE)).toBe(false);
    const again = tapHabit(undone.player, habit, 'plus', undone.log, COUNTS, ctx({ now: NOON + 1 }));
    expect(again.changed).toBe(true);
    expect(undoLastHabitTap(start, habit, emptyLog(TODAY, habit), ctx()).changed).toBe(false);
  });

  it('the lethal tap cannot be undone into resurrection bonus', () => {
    const habit = makeHabit(0, 1);
    const killed = tapHabit(makePlayer({ vitality: 2 }), habit, 'minus', emptyLog(TODAY, habit), COUNTS, ctx());
    const undone = undoLastHabitTap(killed.player, habit, killed.log, ctx({ now: NOON + 5 }));
    expect(undone.log.minusCount).toBe(0);
    expect(undone.player).toBe(killed.player);
  });
});

describe('task counts', () => {
  it('counts active dailies and habits with a "+" on that day', () => {
    const tasks = [
      makeDaily(1),
      makeDaily(2),
      makeDaily(3, { archived: true }),
      makeDaily(1, { createdAt: NOON + 86_400_000 }),
      makeHabit(1, 1),
      makeHabit(2, 0),
      makeHabit(0, 3),
    ];
    expect(taskCountsOn(tasks, TODAY)).toEqual({ dailies: 2, plusHabits: 2 });
  });

  it('habitUsedUp is false without a log', () => {
    expect(habitUsedUp(undefined, TEST_BALANCE)).toBe(false);
  });
});
