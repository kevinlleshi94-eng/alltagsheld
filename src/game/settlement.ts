import { addDays, datesBetween, toDateKey } from './dates';
import { applyDelta } from './resources';
import { checkDaily, emptyLog, tapHabit } from './taskActions';
import type { DayLog, GameEvent, LogicContext, Player, Task } from './types';

/** Days that still need to be settled: after lastSettledDate, before today */
export function pendingDays(lastSettledDate: string, today: string): string[] {
  return datesBetween(lastSettledDate, today);
}

/** Was the task active (existing, not archived) on that day? */
export function isTaskActiveOn(task: Task, date: string): boolean {
  return !task.archived && toDateKey(task.createdAt) <= date;
}

/** Input of the "Was hast du gestern geschafft?" dialog */
export interface ReviewInput {
  date: string;
  /** dailies ticked in the dialog */
  checkedDailyIds: string[];
  /** additional habit taps entered in the dialog */
  habitTaps: Record<string, { plus: number; minus: number }>;
}

export interface DaySummary {
  date: string;
  doneCount: number;
  totalCount: number;
  donePoints: number;
  totalPoints: number;
  /** net effects of the whole day (incl. actions during the day) */
  xp: number;
  gold: number;
  vitality: number;
  /** vitality lost through missed dailies */
  penalty: number;
  died: boolean;
  /** true if penalties were skipped because of an earlier death in this run */
  penaltiesSkipped: boolean;
}

export interface SettlementInput {
  player: Player;
  tasks: Task[];
  /** existing logs of the pending days (other days are ignored) */
  logs: DayLog[];
  today: string;
  review: ReviewInput | null;
}

export interface SettlementResult {
  player: Player;
  /** all logs of the settled days (to upsert) */
  logs: DayLog[];
  summaries: DaySummary[];
  events: GameEvent[];
  brokenItemIds: string[];
  settledDays: string[];
}

/**
 * Sums up one day. `countedDailyIds` = dailies that were active that day
 * (they form the "x/y erledigt" count); resource effects include all logs.
 */
export function summarizeDay(
  date: string,
  logs: DayLog[],
  countedDailyIds: ReadonlySet<string>,
): Omit<DaySummary, 'died' | 'penaltiesSkipped'> {
  let doneCount = 0, totalCount = 0, donePoints = 0, totalPoints = 0, xp = 0, gold = 0, vitality = 0, penalty = 0;
  for (const log of logs) {
    if (log.date !== date) continue;
    if (log.type === 'daily' && countedDailyIds.has(log.taskId)) {
      totalCount += 1;
      totalPoints += log.points;
      if (log.done) {
        doneCount += 1;
        donePoints += log.points;
      }
    }
    if (log.reward) {
      xp += log.reward.xp;
      gold += log.reward.gold;
      vitality += log.reward.vitality;
    }
    for (const tap of log.taps) {
      xp += tap.applied.xp;
      gold += tap.applied.gold;
      vitality += tap.applied.vitality;
    }
    vitality -= log.penalty;
    penalty += log.penalty;
  }
  return { date, doneCount, totalCount, donePoints, totalPoints, xp, gold, vitality, penalty };
}

/**
 * Settles all pending days in chronological order.
 * - Days before yesterday count as "nothing more done".
 * - The review input (yesterday) is applied before yesterday's penalties.
 * - The hero can die at most `balance.death.maxDeathsPerSettlement` times per run;
 *   after that, further losses of this run are skipped.
 */
export function settle(input: SettlementInput, ctx: LogicContext): SettlementResult {
  const days = pendingDays(input.player.lastSettledDate, input.today);
  let player = input.player;
  const events: GameEvent[] = [];
  const brokenItemIds: string[] = [];
  const summaries: DaySummary[] = [];
  const outLogs: DayLog[] = [];
  let deathsThisRun = 0;

  const logIndex = new Map<string, DayLog>();
  for (const log of input.logs) logIndex.set(`${log.date}|${log.taskId}`, log);
  const getLog = (date: string, task: Task) => logIndex.get(`${date}|${task.id}`) ?? emptyLog(date, task);

  const suppress = () => deathsThisRun >= ctx.balance.death.maxDeathsPerSettlement;
  const collect = (r: { player: Player; events: GameEvent[]; brokenItemIds: string[] }) => {
    player = r.player;
    events.push(...r.events);
    brokenItemIds.push(...r.brokenItemIds);
    if (r.events.some((e) => e.type === 'death')) deathsThisRun += 1;
  };

  for (const date of days) {
    const deathsBefore = deathsThisRun;
    const dailies = input.tasks
      .filter((t) => t.type === 'daily' && isTaskActiveOn(t, date))
      .sort((a, b) => a.order - b.order);
    const habits = input.tasks.filter((t) => t.type === 'habit' && isTaskActiveOn(t, date));
    const dayLogs = new Map<string, DayLog>();

    // 1. Review entries (only for the reviewed day = yesterday)
    if (input.review && input.review.date === date) {
      for (const task of dailies) {
        if (!input.review.checkedDailyIds.includes(task.id)) continue;
        const r = checkDaily(player, task, getLog(date, task), ctx, { suppressLosses: suppress() });
        collect(r);
        dayLogs.set(task.id, r.log);
      }
      for (const task of habits) {
        const add = input.review.habitTaps[task.id];
        if (!add) continue;
        let log = dayLogs.get(task.id) ?? getLog(date, task);
        for (const [kind, count] of [['plus', add.plus], ['minus', add.minus]] as const) {
          for (let i = 0; i < count; i++) {
            const r = tapHabit(player, task, kind, log, ctx, { suppressLosses: suppress() });
            collect(r);
            log = r.log;
          }
        }
        dayLogs.set(task.id, log);
      }
    }

    // 2. Penalties for missed dailies. The factor may be fractional (1.5): the day's
    //    total is rounded once and spread over the tasks, so every penalty is a whole number.
    let penaltiesSkipped = false;
    let missedPoints = 0;
    const lossFactor = ctx.balance.vitality.missedDailyLossPerPoint;
    for (const task of dailies) {
      const log = dayLogs.get(task.id) ?? getLog(date, task);
      if (log.done) {
        dayLogs.set(task.id, { ...log, settled: true });
        continue;
      }
      const loss = Math.round((missedPoints + task.points) * lossFactor) - Math.round(missedPoints * lossFactor);
      missedPoints += task.points;
      let penalty = 0;
      if (suppress()) {
        penaltiesSkipped = true;
      } else {
        const r = applyDelta(player, { xp: 0, gold: 0, vitality: -loss }, ctx);
        collect(r);
        penalty = -r.applied.vitality;
      }
      dayLogs.set(task.id, { ...log, points: task.points, penalty, settled: true });
    }

    // 3. Close all other logs of that day (habits, archived tasks)
    for (const log of input.logs) {
      if (log.date === date && !dayLogs.has(log.taskId)) dayLogs.set(log.taskId, { ...log, settled: true });
    }
    for (const task of habits) {
      const log = dayLogs.get(task.id);
      if (log) dayLogs.set(task.id, { ...log, settled: true });
    }

    const logsOfDay = [...dayLogs.values()];
    outLogs.push(...logsOfDay);
    summaries.push({
      ...summarizeDay(date, logsOfDay, new Set(dailies.map((t) => t.id))),
      died: deathsThisRun > deathsBefore,
      penaltiesSkipped,
    });
  }

  if (days.length > 0) player = { ...player, lastSettledDate: days[days.length - 1] };

  return { player, logs: outLogs, summaries, events, brokenItemIds, settledDays: days };
}

/** Initial lastSettledDate for a new game: yesterday (nothing to settle yet) */
export function initialLastSettledDate(today: string): string {
  return addDays(today, -1);
}
