import { describe, expect, it } from 'vitest';
import { BALANCE } from './balance';
import { median, simulate, simulateDetailed } from './simulation';

// Coarse guard rails for the tuned values in balance.ts (see BALANCING.md).
// Deliberately loose – they only catch accidental, large balance regressions.
describe('balancing simulation', () => {
  const run = (fulfillment: number, days: number, seeds = 3) =>
    Array.from({ length: seeds }, (_, s) =>
      simulate({ fulfillment, days, seed: 1000 + s, balance: BALANCE, checkpoints: [1, days] }),
    );

  // feedback v0.5: level-ups almost daily at the start, later every few days
  it('levels up on the first day and about every 1–2 days in the first week', () => {
    const r = run(0.65, 7, 5);
    expect(median(r.map((x) => x[0].level))).toBe(2);
    expect(median(r.map((x) => x[1].level))).toBeGreaterThanOrEqual(4);
    expect(median(r.map((x) => x[1].level))).toBeLessThanOrEqual(6);
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

  // feedback v0.5 (user profile 13 dailies): 5 missed = 62 % → no quota loss, only the 2 "−" (−3 each) hurt
  it('5 missed dailies + 2 habit "−" a day: a few deaths in 180 days, still progress', () => {
    const runs = Array.from({ length: 3 }, (_, s) =>
      simulate({ fulfillment: 0.6, missedPerDay: 5, habitMinusPerDay: 2, days: 180, seed: 2000 + s, balance: BALANCE, checkpoints: [180] }),
    );
    const deaths = median(runs.map((r) => r[0].deaths));
    expect(deaths).toBeGreaterThanOrEqual(1);
    expect(deaths).toBeLessThanOrEqual(9);
    expect(median(runs.map((r) => r[0].level))).toBeGreaterThan(20);
  });

  // feedback v0.5: below 60 % vitality is lost every day → a bad phase kills the hero within about a week
  it('bad days (30 %) kill the hero within about a week, 65 % never', () => {
    const bad = Array.from({ length: 5 }, (_, s) =>
      simulateDetailed({ fulfillment: 0.3, days: 20, seed: 3000 + s, balance: BALANCE, checkpoints: [20] }),
    );
    const firstDeath = median(bad.map((r) => r.days.findIndex((d) => d.deaths > 0) + 1));
    expect(firstDeath).toBeGreaterThanOrEqual(4);
    expect(firstDeath).toBeLessThanOrEqual(10);
    expect(median(run(0.65, 60).map((r) => r[1].deaths))).toBe(0);
  });

  // feedback v0.5 at 65 %: boss 10 on day 4–6 with the first chests, boss 20 about a week later, area boss ~day 14–16
  it('user profile at 65 %: first bosses on the planned days', () => {
    const runs = Array.from({ length: 7 }, (_, s) =>
      simulateDetailed({ fulfillment: 0.65, days: 25, seed: 1000 + s, balance: BALANCE, checkpoints: [25] }),
    );
    const day = (stage: number) => median(runs.map((r) => r.milestones.find((m) => m.area === 1 && m.stage === stage)?.day ?? 99));
    const chests = (stage: number) => median(runs.map((r) => r.milestones.find((m) => m.area === 1 && m.stage === stage)?.chests ?? -1));
    expect(day(10)).toBeGreaterThanOrEqual(4);
    expect(day(10)).toBeLessThanOrEqual(6);
    expect(chests(10)).toBeGreaterThanOrEqual(1);
    expect(chests(10)).toBeLessThanOrEqual(3);
    expect(day(20)).toBeGreaterThanOrEqual(9);
    expect(day(20)).toBeLessThanOrEqual(14);
    expect(day(25)).toBeGreaterThanOrEqual(12);
    expect(day(25)).toBeLessThanOrEqual(18);
  });

  it('is deterministic for a fixed seed', () => {
    const a = simulate({ fulfillment: 0.75, days: 20, seed: 7, balance: BALANCE, checkpoints: [20] });
    const b = simulate({ fulfillment: 0.75, days: 20, seed: 7, balance: BALANCE, checkpoints: [20] });
    expect(a).toEqual(b);
  });
});
