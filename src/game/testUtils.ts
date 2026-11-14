import { BALANCE, type Balance, withBalance } from './balance';
import { seededRng } from './rng';
import { createInitialPlayer, createSeedTasks } from './seed';
import type { LogicContext, Player, Task } from './types';

/** 2026-11-05 12:00 local */
export const NOON = new Date(2026, 10, 5, 12, 0, 0).getTime();
export const TODAY = '2026-11-05';

/**
 * Balance for mechanics tests: pinned level curve (100 × L^1.2), rewards and quota so the tests
 * don't break whenever balance.ts is re-tuned.
 */
export const TEST_BALANCE: Balance = withBalance({
  levels: { xpBase: 100, xpExponent: 1.2, xpMaxPerLevel: Number.POSITIVE_INFINITY },
  rewards: { dailyXp: 200, dailyGold: 100, habitPlusShare: 0.25, habitPlusVitality: 2, habitTapsPerDay: 1 },
  habitMinus: { vitalityLossPerPoint: 3, goldLossPerPoint: 5 },
  vitality: {
    ...BALANCE.vitality,
    quota: { neutralFrom: 0.6, neutralTo: 0.7, lossAtZero: 30, gainAtFull: 15 },
    perfectDayGoldShare: 0.3,
  },
});

export function ctx(overrides: Partial<LogicContext> = {}): LogicContext {
  return { balance: TEST_BALANCE, now: NOON, rng: seededRng(42), ...overrides };
}

export function makePlayer(over: Partial<Player> = {}, balance: Balance = BALANCE): Player {
  return { ...createInitialPlayer(NOON - 10 * 86_400_000, TODAY, balance), ...over };
}

let counter = 0;
export const testId = () => `t${++counter}`;

export function makeDaily(points: number, over: Partial<Task> = {}): Task {
  return {
    id: testId(),
    type: 'daily',
    title: `Daily ${points}`,
    points,
    plusPoints: 0,
    minusPoints: 0,
    order: counter,
    archived: false,
    createdAt: NOON - 30 * 86_400_000,
    archivedAt: null,
    ...over,
  };
}

export function makeHabit(plusPoints: number, minusPoints: number, over: Partial<Task> = {}): Task {
  return {
    id: testId(),
    type: 'habit',
    title: `Habit +${plusPoints}/-${minusPoints}`,
    points: 0,
    plusPoints,
    minusPoints,
    order: counter,
    archived: false,
    createdAt: NOON - 30 * 86_400_000,
    archivedAt: null,
    ...over,
  };
}

export function seedTasks(): Task[] {
  return createSeedTasks(NOON - 30 * 86_400_000, testId);
}
