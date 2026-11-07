import {
  applyDelta,
  lossForMinusPoints,
  negate,
  rewardForPoints,
  type ApplyOptions,
} from './resources';
import type { DayLog, GameEvent, HabitTapKind, LogicContext, Player, Task } from './types';

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
  ctx: LogicContext,
  opts?: ApplyOptions,
): ActionResult {
  if (task.type !== 'daily' || log.done || log.settled) return unchanged(player, log);
  const r = applyDelta(player, rewardForPoints(task.points, ctx.balance), ctx, opts);
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
  ctx: LogicContext,
  opts?: ApplyOptions,
): ActionResult {
  if (task.type !== 'habit' || log.settled) return unchanged(player, log);
  const points = kind === 'plus' ? task.plusPoints : task.minusPoints;
  if (points <= 0) return unchanged(player, log);
  const delta = kind === 'plus' ? rewardForPoints(points, ctx.balance) : lossForMinusPoints(points, ctx.balance);
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
