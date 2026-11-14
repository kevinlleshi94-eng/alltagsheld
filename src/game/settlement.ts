import { addDays, datesBetween } from './dates';
import { applyDelta, quotaEffect } from './resources';
import { checkDaily, emptyLog, isTaskActiveOn, tapHabit, taskCountsOn } from './taskActions';
import type { DayLog, Delta, GameEvent, LogicContext, Player, Task } from './types';

export { isTaskActiveOn };

/** Days that still need to be settled: after lastSettledDate, before today */
export function pendingDays(lastSettledDate: string, today: string): string[] {
  return datesBetween(lastSettledDate, today);
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
  /** vitality lost through the quota (missed dailies) */
  penalty: number;
  /** vitality change through the day's quota (±) */
  quotaVitality: number;
  /** extra gold for a perfect day */
  bonusGold: number;
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
  let quotaVitality = 0, bonusGold = 0;
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
    penalty += log.penalty;
    if (log.settlement) {
      xp += log.settlement.xp;
      gold += log.settlement.gold;
      vitality += log.settlement.vitality;
      quotaVitality += log.settlement.vitality;
      bonusGold += log.settlement.gold;
    } else {
      // logs from before v0.5: only the penalty of the missed task
      vitality -= log.penalty;
      quotaVitality -= log.penalty;
    }
  }
  return { date, doneCount, totalCount, donePoints, totalPoints, xp, gold, vitality, penalty, quotaVitality, bonusGold };
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

    const counts = taskCountsOn(input.tasks, date);

    // 1. Review entries (only for the reviewed day = yesterday)
    if (input.review && input.review.date === date) {
      for (const task of dailies) {
        if (!input.review.checkedDailyIds.includes(task.id)) continue;
        const r = checkDaily(player, task, getLog(date, task), counts, ctx, { suppressLosses: suppress() });
        collect(r);
        dayLogs.set(task.id, r.log);
      }
      for (const task of habits) {
        const add = input.review.habitTaps[task.id];
        if (!add) continue;
        let log = dayLogs.get(task.id) ?? getLog(date, task);
        for (const [kind, count] of [['plus', add.plus], ['minus', add.minus]] as const) {
          for (let i = 0; i < count; i++) {
            const r = tapHabit(player, task, kind, log, counts, ctx, { suppressLosses: suppress() });
            collect(r);
            log = r.log;
          }
        }
        dayLogs.set(task.id, log);
      }
    }

    // 2. The day's quota (done / all dailies, by tasks) → vitality ± and the perfect-day gold.
    //    The applied effect is spread over the day's dailies, so every log holds whole numbers.
    let penaltiesSkipped = false;
    const dailyLogs = dailies.map((task) => ({ task, log: dayLogs.get(task.id) ?? getLog(date, task) }));
    const effect = quotaEffect(dailyLogs.filter((d) => d.log.done).length, dailyLogs.length, ctx.balance);
    let applied: Delta = { xp: 0, gold: 0, vitality: 0 };
    if (effect.vitality < 0 && suppress()) penaltiesSkipped = true;
    if (effect.vitality !== 0 || effect.gold !== 0) {
      const r = applyDelta(player, effect, ctx, { suppressLosses: suppress() });
      collect(r);
      applied = r.applied;
    }
    const goldShares = spread(applied.gold, dailyLogs.length);
    const vitShares = spread(applied.vitality, dailyLogs.length);
    dailyLogs.forEach(({ task, log }, i) => {
      const settlement: Delta = { xp: 0, gold: goldShares[i], vitality: vitShares[i] };
      dayLogs.set(task.id, {
        ...log,
        points: log.done ? log.points : task.points,
        penalty: Math.max(0, -settlement.vitality),
        settlement,
        settled: true,
      });
    });

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

/** splits an integer into `n` integers that add up to it (as equal as possible) */
export function spread(total: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.round((total * (i + 1)) / n) - Math.round((total * i) / n));
}

/** Initial lastSettledDate for a new game: yesterday (nothing to settle yet) */
export function initialLastSettledDate(today: string): string {
  return addDays(today, -1);
}
