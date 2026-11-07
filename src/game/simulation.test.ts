import { describe, expect, it } from 'vitest';
import { BALANCE } from './balance';
import { median, simulate } from './simulation';

// Coarse guard rails for the tuned values in balance.ts (see BALANCING.md).
// Deliberately loose – they only catch accidental, large balance regressions.
describe('balancing simulation', () => {
  const run = (fulfillment: number, days: number, seeds = 3) =>
    Array.from({ length: seeds }, (_, s) =>
      simulate({ fulfillment, days, seed: 1000 + s, balance: BALANCE, checkpoints: [1, days] }),
    );

  it('reaches level 3 on the first day with good fulfilment', () => {
    expect(median(run(0.9, 1).map((r) => r[0].level))).toBeGreaterThanOrEqual(3);
  });

  it('more fulfilment means more progress and fewer deaths', () => {
    const low = run(0.5, 60);
    const high = run(0.9, 60);
    const idx = (r: ReturnType<typeof run>) => median(r.map((x) => x[1].highestIndex));
    const deaths = (r: ReturnType<typeof run>) => median(r.map((x) => x[1].deaths));
    expect(idx(high)).toBeGreaterThan(idx(low) + 25);
    expect(deaths(low)).toBeGreaterThan(deaths(high));
    expect(deaths(high)).toBe(0);
  });

  // user target (feedback Phase 2): 5 dailies missed + 2 habit "−" every day
  // → roughly 8 deaths in half a year, but still some progress
  it('5 missed dailies + 2 habit "−" a day: about 8 deaths in 180 days', () => {
    const runs = Array.from({ length: 3 }, (_, s) =>
      simulate({
        fulfillment: 0.6,
        missedPerDay: 5,
        habitMinusPerDay: 2,
        days: 180,
        seed: 2000 + s,
        balance: BALANCE,
        checkpoints: [180],
      }),
    );
    const deaths = median(runs.map((r) => r[0].deaths));
    expect(deaths).toBeGreaterThanOrEqual(4);
    expect(deaths).toBeLessThanOrEqual(14);
    expect(median(runs.map((r) => r[0].level))).toBeGreaterThan(8);
  });

  it('is deterministic for a fixed seed', () => {
    const a = simulate({ fulfillment: 0.75, days: 20, seed: 7, balance: BALANCE, checkpoints: [20] });
    const b = simulate({ fulfillment: 0.75, days: 20, seed: 7, balance: BALANCE, checkpoints: [20] });
    expect(a).toEqual(b);
  });
});
