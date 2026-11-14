import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { pendingDays, settle, spread, summarizeDay, type ReviewInput } from './settlement';
import { checkDaily, emptyLog, tapHabit, taskCountsOn } from './taskActions';
import { ctx, makeDaily, makeHabit, makePlayer, NOON, seedTasks, TODAY } from './testUtils';
import type { DayLog, Task } from './types';

// TEST_BALANCE: daily budget 200 XP / 100 gold, quota neutral 60–70 %, −30 at 0 %, +15 at 100 %, perfect day +30 gold
const YESTERDAY = addDays(TODAY, -1);
const DAY_BEFORE = addDays(TODAY, -2);
const DAY_MS = 86_400_000;

function review(over: Partial<ReviewInput> = {}): ReviewInput {
  return { date: YESTERDAY, checkedDailyIds: [], habitTaps: {}, ...over };
}

/** ticks a daily on `date` like the Today screen would */
function tick(player: ReturnType<typeof makePlayer>, task: Task, tasks: Task[], date: string, now: number) {
  return checkDaily(player, task, emptyLog(date, task), taskCountsOn(tasks, date), ctx({ now }));
}

describe('pendingDays', () => {
  it('lists the days between last settlement and today', () => {
    expect(pendingDays(YESTERDAY, TODAY)).toEqual([]);
    expect(pendingDays(DAY_BEFORE, TODAY)).toEqual([YESTERDAY]);
    expect(pendingDays(addDays(TODAY, -4), TODAY)).toEqual([addDays(TODAY, -3), DAY_BEFORE, YESTERDAY]);
  });
});

describe('spread', () => {
  it('splits an integer into whole numbers that add up to it', () => {
    expect(spread(-30, 4)).toEqual([-7, -8, -7, -8]);
    expect(spread(5, 3).reduce((a, b) => a + b, 0)).toBe(5);
    expect(spread(0, 2)).toEqual([0, 0]);
  });
});

describe('settle', () => {
  it('does nothing when no day change happened', () => {
    const player = makePlayer({ lastSettledDate: YESTERDAY });
    const r = settle({ player, tasks: [makeDaily(3)], logs: [], today: TODAY, review: null }, ctx());
    expect(r.player).toBe(player);
    expect(r.logs).toEqual([]);
    expect(r.summaries).toEqual([]);
  });

  it('below 60 % done costs vitality, spread over the dailies, and writes a gap-free log', () => {
    const a = makeDaily(3);
    const b = makeDaily(2);
    const start = makePlayer({ lastSettledDate: DAY_BEFORE, vitality: 80 });
    const checked = tick(start, a, [a, b], YESTERDAY, NOON - DAY_MS);
    expect(checked.applied).toEqual({ xp: 100, gold: 50, vitality: 0 });
    const r = settle({ player: checked.player, tasks: [a, b], logs: [checked.log], today: TODAY, review: null }, ctx());

    // 1/2 = 50 % → −round(30 × 0.1 / 0.6) = −5
    expect(r.player.vitality).toBe(75);
    expect(r.player.lastSettledDate).toBe(YESTERDAY);
    expect(r.logs).toHaveLength(2);
    expect(r.logs.every((l) => l.settled && Number.isInteger(l.penalty))).toBe(true);
    expect(r.logs.reduce((s, l) => s + l.penalty, 0)).toBe(5);
    expect(r.summaries).toEqual([
      expect.objectContaining({
        date: YESTERDAY,
        doneCount: 1,
        totalCount: 2,
        xp: 100,
        gold: 50,
        vitality: -5,
        quotaVitality: -5,
        bonusGold: 0,
        penalty: 5,
        died: false,
      }),
    ]);
  });

  it('60–70 % is neutral', () => {
    const tasks = [makeDaily(1), makeDaily(1), makeDaily(1)];
    const r = settle(
      {
        player: makePlayer({ lastSettledDate: DAY_BEFORE, vitality: 50 }),
        tasks,
        logs: [],
        today: TODAY,
        review: review({ checkedDailyIds: [tasks[0].id, tasks[1].id] }),
      },
      ctx(),
    );
    expect(r.player.vitality).toBe(50);
    expect(r.summaries[0]).toMatchObject({ doneCount: 2, totalCount: 3, quotaVitality: 0, penalty: 0 });
  });

  it('a perfect day gives +15 vitality and 30 % of the daily gold extra', () => {
    const tasks = [makeDaily(3), makeDaily(1)];
    const r = settle(
      {
        player: makePlayer({ lastSettledDate: DAY_BEFORE, vitality: 50 }),
        tasks,
        logs: [],
        today: TODAY,
        review: review({ checkedDailyIds: tasks.map((t) => t.id) }),
      },
      ctx(),
    );
    expect(r.player).toMatchObject({ vitality: 65, level: 2, xp: 100, gold: 130 });
    expect(r.summaries[0]).toMatchObject({ quotaVitality: 15, bonusGold: 30, gold: 130, vitality: 15 });
    const settledGold = r.logs.reduce((s, l) => s + (l.settlement?.gold ?? 0), 0);
    expect(settledGold).toBe(30);
  });

  it('applies the review for yesterday before the quota', () => {
    const a = makeDaily(3);
    const b = makeDaily(2);
    const r = settle(
      {
        player: makePlayer({ lastSettledDate: DAY_BEFORE, vitality: 50 }),
        tasks: [a, b],
        logs: [],
        today: TODAY,
        review: review({ checkedDailyIds: [b.id] }),
      },
      ctx(),
    );
    expect(r.player).toMatchObject({ vitality: 45, level: 2, xp: 0, gold: 50 });
    expect(r.summaries[0]).toMatchObject({ doneCount: 1, totalCount: 2, penalty: 5 });
  });

  it('settles older days first (chronological order matters for the vitality cap)', () => {
    const t = makeDaily(10);
    const r = settle(
      {
        player: makePlayer({ lastSettledDate: addDays(TODAY, -3), vitality: 100 }),
        tasks: [t],
        logs: [],
        today: TODAY,
        review: review({ checkedDailyIds: [t.id] }),
      },
      ctx(),
    );
    // day −2: missed → 70; yesterday: ticked in the review → perfect day → 85
    expect(r.player.vitality).toBe(85);
    expect(r.summaries.map((s) => s.date)).toEqual([DAY_BEFORE, YESTERDAY]);
  });

  it('keeps dailies that were ticked on older days as done', () => {
    const t = makeDaily(4);
    const start = makePlayer({ lastSettledDate: addDays(TODAY, -3), vitality: 60 });
    const checked = tick(start, t, [t], DAY_BEFORE, NOON - 2 * DAY_MS);
    const r = settle({ player: checked.player, tasks: [t], logs: [checked.log], today: TODAY, review: null }, ctx());
    expect(r.summaries[0]).toMatchObject({ date: DAY_BEFORE, doneCount: 1, penalty: 0, quotaVitality: 15 });
    expect(r.summaries[1]).toMatchObject({ date: YESTERDAY, doneCount: 0, penalty: 30 });
    expect(r.player.vitality).toBe(60 + 15 - 30);
  });

  it('four completely missed days in a row = death', () => {
    const tasks = seedTasks();
    const r = settle(
      { player: makePlayer({ lastSettledDate: addDays(TODAY, -5), vitality: 100, level: 3, gold: 200 }), tasks, logs: [], today: TODAY, review: null },
      ctx(),
    );
    expect(r.summaries.map((s) => s.died)).toEqual([false, false, false, true]);
    expect(r.summaries[0]).toMatchObject({ penalty: 30, quotaVitality: -30 });
    expect(r.player).toMatchObject({ deaths: 1, vitality: 100, level: 2, gold: 0 });
    expect(r.events.filter((e) => e.type === 'death')).toHaveLength(1);
  });

  it('the hero dies at most once per settlement run', () => {
    const tasks = seedTasks();
    const r = settle(
      { player: makePlayer({ lastSettledDate: addDays(TODAY, -11), vitality: 100 }), tasks, logs: [], today: TODAY, review: null },
      ctx(),
    );
    expect(r.settledDays).toHaveLength(10);
    expect(r.player.deaths).toBe(1);
    expect(r.player.vitality).toBe(100);
    expect(r.summaries.filter((s) => s.died)).toHaveLength(1);
    expect(r.summaries.slice(4).every((s) => s.penalty === 0 && s.penaltiesSkipped)).toBe(true);
    // gap-free log: 13 dailies × 10 days
    expect(r.logs.filter((l) => l.type === 'daily')).toHaveLength(130);
  });

  it('after a death in the run, the quota costs nothing more', () => {
    const daily = makeDaily(3);
    const junk = makeHabit(0, 2);
    const r = settle(
      {
        player: makePlayer({ lastSettledDate: DAY_BEFORE, vitality: 5 }),
        tasks: [daily, junk],
        logs: [],
        today: TODAY,
        review: review({ habitTaps: { [junk.id]: { plus: 0, minus: 1 } } }),
      },
      ctx(),
    );
    expect(r.player).toMatchObject({ deaths: 1, vitality: 100 });
    expect(r.logs.find((l) => l.taskId === junk.id)!.minusCount).toBe(1);
    expect(r.logs.find((l) => l.taskId === daily.id)).toMatchObject({ penalty: 0, settled: true });
    expect(r.summaries[0]).toMatchObject({ died: true, penaltiesSkipped: true });
  });

  it('records habit taps from the review, at most once per habit and day', () => {
    const cook = makeHabit(1, 0);
    const walk = makeHabit(1, 0);
    const tasks = [cook, walk];
    const start = makePlayer({ lastSettledDate: DAY_BEFORE, vitality: 90 });
    const tapped = tapHabit(start, cook, 'plus', emptyLog(YESTERDAY, cook), taskCountsOn(tasks, YESTERDAY), ctx({ now: NOON - DAY_MS }));
    const r = settle(
      {
        player: tapped.player,
        tasks,
        logs: [tapped.log],
        today: TODAY,
        review: review({ habitTaps: { [cook.id]: { plus: 1, minus: 0 }, [walk.id]: { plus: 1, minus: 0 } } }),
      },
      ctx(),
    );
    expect(r.logs.find((l) => l.taskId === cook.id)).toMatchObject({ plusCount: 1, settled: true });
    expect(r.logs.find((l) => l.taskId === walk.id)).toMatchObject({ plusCount: 1, settled: true });
    // 2 "+" habits → 25 XP, 13 gold (12.5 rounded), +2 vitality per tap
    expect(r.player).toMatchObject({ xp: 50, gold: 26, vitality: 94 });
    expect(r.summaries[0]).toMatchObject({ xp: 50, gold: 26, vitality: 4, totalCount: 0 });
  });

  it('ignores tasks created later and archived tasks, but closes their logs', () => {
    const old = makeDaily(2);
    const fresh = makeDaily(5, { createdAt: NOON });
    const archived = makeDaily(4, { archived: true, archivedAt: NOON - 3600_000 });
    const start = makePlayer({ lastSettledDate: DAY_BEFORE, vitality: 70 });
    const archivedLog: DayLog = { ...emptyLog(YESTERDAY, archived), done: true, doneAt: NOON - DAY_MS };
    const r = settle(
      { player: start, tasks: [old, fresh, archived], logs: [archivedLog], today: TODAY, review: null },
      ctx(),
    );
    expect(r.player.vitality).toBe(40);
    expect(r.summaries[0]).toMatchObject({ totalCount: 1, penalty: 30 });
    expect(r.logs.find((l) => l.taskId === archived.id)?.settled).toBe(true);
    expect(r.logs.find((l) => l.taskId === fresh.id)).toBeUndefined();
  });

  it('is idempotent: settling again changes nothing', () => {
    const tasks = seedTasks();
    const first = settle({ player: makePlayer({ lastSettledDate: DAY_BEFORE }), tasks, logs: [], today: TODAY, review: null }, ctx());
    const second = settle({ player: first.player, tasks, logs: first.logs, today: TODAY, review: null }, ctx());
    expect(second.player).toBe(first.player);
    expect(second.logs).toEqual([]);
  });
});

describe('summarizeDay', () => {
  it('still reads logs from before v0.5 (penalty only, no settlement field)', () => {
    const t = makeDaily(3);
    const old: DayLog = { ...emptyLog(YESTERDAY, t), penalty: 9, settled: true };
    const s = summarizeDay(YESTERDAY, [old], new Set([t.id]));
    expect(s).toMatchObject({ totalCount: 1, doneCount: 0, penalty: 9, vitality: -9, quotaVitality: -9, bonusGold: 0 });
  });
});
