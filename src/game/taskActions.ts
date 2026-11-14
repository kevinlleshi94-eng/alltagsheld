import { toDateKey } from './dates';
import { applyDelta, dailyReward, habitPlusReward, lossForMinusPoints, negate, type ApplyOptions } from './resources';
import type { DayLog, GameEvent, HabitTapKind, LogicContext, Player, Task } from './types';

/** Was the task active (existing, not archived) on that day? */
export function isTaskActiveOn(task: Task, date: string): boolean {
  return !task.archived && toDateKey(task.createdAt) <= date;
}

/** How many tasks share the day's reward budget (feedback v0.5: every daily is worth the same) */
export interface TaskCounts {
  dailies: number;
  /** habits with a "+" button */
  plusHabits: number;
}

export function taskCountsOn(tasks: Task[], date: string): TaskCounts {
  let dailies = 0;
  let plusHabits = 0;
  for (const t of tasks) {
    if (!isTaskActiveOn(t, date)) continue;
    if (t.type === 'daily') dailies += 1;
    else if (t.plusPoints > 0) plusHabits += 1;
  }
  return { dailies, plusHabits };
}

/** has this habit already been tapped as often as allowed today? */
export function habitUsedUp(log: DayLog | undefined, balance: LogicContext['balance']): boolean {
  return (log?.taps.length ?? 0) >= balance.rewards.habitTapsPerDay;
}

export interface ActionResult {
  player: Player;
  log: DayLog;
  events: GameEvent[];
  brokenItemIds: string[];
  /** applied resource change, for the floating "+20 XP" feedback */
  applied: { xp: number; gold: number; vitality: number };
  changed: boolean;
}

export function emptyLog(date: string, task: Task): DayLog {
  return {
    date,
    taskId: task.id,
    type: task.type,
    done: false,
    doneAt: null,
    reward: null,
    points: task.type === 'daily' ? task.points : 0,
    penalty: 0,
    plusCount: 0,
    minusCount: 0,
    taps: [],
    settled: false,
  };
}

function unchanged(player: Player, log: DayLog): ActionResult {
  return { player, log, events: [], brokenItemIds: [], applied: { xp: 0, gold: 0, vitality: 0 }, changed: false };
}

/** A reward granted before the most recent death is not taken back (death already took its toll). */
function isReversible(at: number | null, player: Player): boolean {
  if (at === null) return false;
  return player.lastDeathAt === null || at > player.lastDeathAt;
}

export function checkDaily(
  player: Player,
  task: Task,
  log: DayLog,
  counts: TaskCounts,
  ctx: LogicContext,
  opts?: ApplyOptions,
): ActionResult {
  if (task.type !== 'daily' || log.done || log.settled) return unchanged(player, log);
  const r = applyDelta(player, dailyReward(counts.dailies, ctx.balance), ctx, opts);
  return {
    player: r.player,
    log: { ...log, done: true, doneAt: ctx.now, reward: r.applied, points: task.points },
    events: r.events,
    brokenItemIds: r.brokenItemIds,
    applied: r.applied,
    changed: true,
  };
}

/** Same-day un-check: takes the reward back */
export function uncheckDaily(player: Player, task: Task, log: DayLog, ctx: LogicContext): ActionResult {
  if (task.type !== 'daily' || !log.done || log.settled) return unchanged(player, log);
  const newLog: DayLog = { ...log, done: false, doneAt: null, reward: null };
  if (!log.reward || !isReversible(log.doneAt, player)) {
    return { ...unchanged(player, newLog), changed: true };
  }
  const r = applyDelta(player, negate(log.reward), ctx);
  return {
    player: r.player,
    log: newLog,
    events: r.events,
    brokenItemIds: r.brokenItemIds,
    applied: r.applied,
    changed: true,
  };
}

export function tapHabit(
  player: Player,
  task: Task,
  kind: HabitTapKind,
  log: DayLog,
  counts: TaskCounts,
  ctx: LogicContext,
  opts?: ApplyOptions,
): ActionResult {
  if (task.type !== 'habit' || log.settled || habitUsedUp(log, ctx.balance)) return unchanged(player, log);
  const points = kind === 'plus' ? task.plusPoints : task.minusPoints;
  if (points <= 0) return unchanged(player, log);
  const delta = kind === 'plus' ? habitPlusReward(counts.plusHabits, ctx.balance) : lossForMinusPoints(points, ctx.balance);
  const r = applyDelta(player, delta, ctx, opts);
  const newLog: DayLog = {
    ...log,
    plusCount: log.plusCount + (kind === 'plus' ? 1 : 0),
    minusCount: log.minusCount + (kind === 'minus' ? 1 : 0),
    taps: [...log.taps, { kind, at: ctx.now, applied: r.applied }],
  };
  return {
    player: r.player,
    log: newLog,
    events: r.events,
    brokenItemIds: r.brokenItemIds,
    applied: r.applied,
    changed: true,
  };
}

/** Removes the last tap of this habit on this day and reverts its effect. */
export function undoLastHabitTap(player: Player, task: Task, log: DayLog, ctx: LogicContext): ActionResult {
  if (task.type !== 'habit' || log.settled || log.taps.length === 0) return unchanged(player, log);
  const taps = [...log.taps];
  const last = taps.pop()!;
  const newLog: DayLog = {
    ...log,
    taps,
    plusCount: log.plusCount - (last.kind === 'plus' ? 1 : 0),
    minusCount: log.minusCount - (last.kind === 'minus' ? 1 : 0),
  };
  if (!isReversible(last.at, player)) return { ...unchanged(player, newLog), changed: true };
  const r = applyDelta(player, negate(last.applied), ctx);
  return {
    player: r.player,
    log: newLog,
    events: r.events,
    brokenItemIds: r.brokenItemIds,
    applied: r.applied,
    changed: true,
  };
}
