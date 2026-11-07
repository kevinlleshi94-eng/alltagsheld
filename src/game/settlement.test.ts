import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { pendingDays, settle, type ReviewInput } from './settlement';
import { checkDaily, emptyLog, tapHabit } from './taskActions';
import { withBalance } from './balance';
import { ctx, makeDaily, makeHabit, makePlayer, NOON, seedTasks, TEST_BALANCE, TODAY } from './testUtils';
import type { DayLog, Task } from './types';

const YESTERDAY = addDays(TODAY, -1);
const DAY_BEFORE = addDays(TODAY, -2);

function review(over: Partial<ReviewInput> = {}): ReviewInput {
  return { date: YESTERDAY, checkedDailyIds: [], habitTaps: {}, ...over };
}

describe('pendingDays', () => {
  it('lists the days between last settlement and today', () => {
    expect(pendingDays(YESTERDAY, TODAY)).toEqual([]);
    expect(pendingDays(DAY_BEFORE, TODAY)).toEqual([YESTERDAY]);
    expect(pendingDays(addDays(TODAY, -4), TODAY)).toEqual([addDays(TODAY, -3), DAY_BEFORE, YESTERDAY]);
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

  it('penalises missed dailies with points × 3 and writes a gap-free log', () => {
    const a = makeDaily(3);
    const b = makeDaily(2);
    const start = makePlayer({ lastSettledDate: DAY_BEFORE, vitality: 80 });
    const checked = checkDaily(start, a, emptyLog(YESTERDAY, a), ctx({ now: NOON - 86_400_000 }));
    const r = settle({ player: checked.player, tasks: [a, b], logs: [checked.log], today: TODAY, review: null }, ctx());

    expect(r.player.vitality).toBe(80 + 3 - 6);
    expect(r.player.lastSettledDate).toBe(YESTERDAY);
    expect(r.logs).toHaveLength(2);
    expect(r.logs.every((l) => l.settled)).toBe(true);
    expect(r.logs.find((l) => l.taskId === b.id)).toMatchObject({ done: false, penalty: 6, points: 2 });
    expect(r.summaries).toEqual([
      expect.objectContaining({
        date: YESTERDAY,
        doneCount: 1,
        totalCount: 2,
        donePoints: 3,
        totalPoints: 5,
        xp: 30,
        gold: 15,
        vitality: -3,
        penalty: 6,
        died: false,
      }),
    ]);
  });

  it('rounds a fractional penalty factor per day, every penalty a whole number', () => {
    const balance = withBalance({ ...TEST_BALANCE, vitality: { ...TEST_BALANCE.vitality, missedDailyLossPerPoint: 1.5 } });
    const tasks = [makeDaily(1, { order: 0 }), makeDaily(1, { order: 1 }), makeDaily(1, { order: 2 }), makeDaily(3, { order: 3 })];
    const start = makePlayer({ lastSettledDate: DAY_BEFORE, vitality: 80 });
    const r = settle({ player: start, tasks, logs: [], today: TODAY, review: null }, ctx({ balance }));

    const penalties = tasks.map((t) => r.logs.find((l) => l.taskId === t.id)!.penalty);
    expect(penalties.every((p) => Number.isInteger(p))).toBe(true);
    // 6 missed points × 1.5 = 9, spread as 2 + 1 + 2 + 4
    expect(penalties).toEqual([2, 1, 2, 4]);
    expect(r.player.vitality).toBe(80 - 9);
  });

  it('applies the review for yesterday before its penalties', () => {
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
    expect(r.player).toMatchObject({ vitality: 50 + 2 - 9, xp: 20, gold: 10 });
    expect(r.summaries[0]).toMatchObject({ doneCount: 1, totalCount: 2, penalty: 9 });
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
    // day −2: missed → 70; yesterday: ticked in review → 80
    expect(r.player.vitality).toBe(80);
    expect(r.summaries.map((s) => s.date)).toEqual([DAY_BEFORE, YESTERDAY]);
  });

  it('keeps dailies that were ticked on older days as done', () => {
    const t = makeDaily(4);
    const start = makePlayer({ lastSettledDate: addDays(TODAY, -3), vitality: 60 });
    const checked = checkDaily(start, t, emptyLog(DAY_BEFORE, t), ctx({ now: NOON - 2 * 86_400_000 }));
    const r = settle({ player: checked.player, tasks: [t], logs: [checked.log], today: TODAY, review: null }, ctx());
    expect(r.summaries[0]).toMatchObject({ date: DAY_BEFORE, doneCount: 1, penalty: 0 });
    expect(r.summaries[1]).toMatchObject({ date: YESTERDAY, doneCount: 0, penalty: 12 });
    expect(r.player.vitality).toBe(60 + 4 - 12);
  });

  it('two completely missed days with the start tasks = death', () => {
    const tasks = seedTasks();
    const r = settle(
      { player: makePlayer({ lastSettledDate: addDays(TODAY, -3), vitality: 100, level: 3, gold: 200 }), tasks, logs: [], today: TODAY, review: null },
      ctx(),
    );
    expect(r.summaries[0]).toMatchObject({ penalty: 66, died: false });
    expect(r.summaries[1]).toMatchObject({ died: true, penaltiesSkipped: true });
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
    expect(r.summaries.slice(2).every((s) => s.penalty === 0 && s.penaltiesSkipped)).toBe(true);
    // gap-free log: 13 dailies × 10 days
    expect(r.logs.filter((l) => l.type === 'daily')).toHaveLength(130);
  });

  it('after a death in the run, review "−" taps cost nothing more', () => {
    const daily = makeDaily(3);
    const junk = makeHabit(0, 2);
    const r = settle(
      {
        player: makePlayer({ lastSettledDate: DAY_BEFORE, vitality: 5 }),
        tasks: [daily, junk],
        logs: [],
        today: TODAY,
        review: review({ habitTaps: { [junk.id]: { plus: 0, minus: 2 } } }),
      },
      ctx(),
    );
    expect(r.player).toMatchObject({ deaths: 1, vitality: 100 });
    const habitLog = r.logs.find((l) => l.taskId === junk.id)!;
    expect(habitLog.minusCount).toBe(2);
    expect(habitLog.taps[1].applied.vitality).toBe(0);
    expect(r.logs.find((l) => l.taskId === daily.id)).toMatchObject({ penalty: 0, settled: true });
  });

  it('records habit taps from the review', () => {
    const cook = makeHabit(1, 0);
    const start = makePlayer({ lastSettledDate: DAY_BEFORE, vitality: 90 });
    const tapped = tapHabit(start, cook, 'plus', emptyLog(YESTERDAY, cook), ctx({ now: NOON - 86_400_000 }));
    const r = settle(
      {
        player: tapped.player,
        tasks: [cook],
        logs: [tapped.log],
        today: TODAY,
        review: review({ habitTaps: { [cook.id]: { plus: 2, minus: 0 } } }),
      },
      ctx(),
    );
    const log = r.logs.find((l) => l.taskId === cook.id)!;
    expect(log).toMatchObject({ plusCount: 3, settled: true });
    expect(r.player).toMatchObject({ xp: 30, gold: 15, vitality: 93 });
    expect(r.summaries[0]).toMatchObject({ xp: 30, gold: 15, vitality: 3, totalCount: 0 });
  });

  it('ignores tasks created later and archived tasks, but closes their logs', () => {
    const old = makeDaily(2);
    const fresh = makeDaily(5, { createdAt: NOON });
    const archived = makeDaily(4, { archived: true, archivedAt: NOON - 3600_000 });
    const start = makePlayer({ lastSettledDate: DAY_BEFORE, vitality: 70 });
    const archivedLog: DayLog = { ...emptyLog(YESTERDAY, archived), done: true, doneAt: NOON - 86_400_000 };
    const r = settle(
      { player: start, tasks: [old, fresh, archived], logs: [archivedLog], today: TODAY, review: null },
      ctx(),
    );
    expect(r.player.vitality).toBe(64);
    expect(r.summaries[0]).toMatchObject({ totalCount: 1, penalty: 6 });
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

  describe('break-even at ~75 % (start tasks, 22 points)', () => {
    const tasks: Task[] = seedTasks();
    const dailies = tasks.filter((t) => t.type === 'daily');
    const run = (indices: number[]) =>
      settle(
        {
          player: makePlayer({ lastSettledDate: DAY_BEFORE, vitality: 50 }),
          tasks,
          logs: [],
          today: TODAY,
          review: review({ checkedDailyIds: indices.map((i) => dailies[i].id) }),
        },
        ctx(),
      );

    it('17/22 points (77 %) → vitality rises', () => {
      const r = run([0, 1, 2, 3, 4, 5, 6, 7, 9]);
      expect(r.summaries[0].donePoints).toBe(17);
      expect(r.player.vitality).toBe(52);
    });

    it('16/22 points (73 %) → vitality falls', () => {
      const r = run([0, 1, 2, 3, 4, 5, 6, 7, 8]);
      expect(r.summaries[0].donePoints).toBe(16);
      expect(r.player.vitality).toBe(48);
    });
  });
});
