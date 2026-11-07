import type { Balance } from './balance';
import { applyDeath } from './death';
import { addXp, removeXp } from './progression';
import type { Delta, GameEvent, LogicContext, Player } from './types';

export const ZERO_DELTA: Delta = { xp: 0, gold: 0, vitality: 0 };

export function negate(d: Delta): Delta {
  return { xp: -d.xp, gold: -d.gold, vitality: -d.vitality };
}

export function sumDeltas(...ds: Delta[]): Delta {
  return ds.reduce((a, b) => ({ xp: a.xp + b.xp, gold: a.gold + b.gold, vitality: a.vitality + b.vitality }), {
    ...ZERO_DELTA,
  });
}

export function isExhausted(player: Player, balance: Balance): boolean {
  return player.vitality < balance.vitality.max * balance.vitality.exhaustedThreshold;
}

export interface ApplyOptions {
  /** If false, a lethal vitality loss is not applied as death (vitality stops at its current value). */
  allowDeath?: boolean;
  /** If true, losses (negative gold / vitality) are ignored. Used after a death in a settlement run. */
  suppressLosses?: boolean;
}

export interface ApplyResult {
  player: Player;
  /** what was really changed (gold clamped at 0, vitality clamped at max) */
  applied: Delta;
  events: GameEvent[];
  died: boolean;
  /** item ids the caller must delete (broken by death) */
  brokenItemIds: string[];
}

/**
 * The single place where XP / gold / vitality are changed.
 * Handles level-up/-down, gold floor, vitality cap and death.
 */
export function applyDelta(player: Player, delta: Delta, ctx: LogicContext, opts: ApplyOptions = {}): ApplyResult {
  const { balance } = ctx;
  const allowDeath = opts.allowDeath ?? true;
  const events: GameEvent[] = [];
  let p = player;

  // XP
  let xpApplied = 0;
  if (delta.xp > 0) {
    const r = addXp(p, delta.xp, balance);
    p = r.player;
    xpApplied = delta.xp;
    for (const level of r.levelsGained) events.push({ type: 'levelUp', level });
  } else if (delta.xp < 0) {
    const r = removeXp(p, -delta.xp, balance);
    p = r.player;
    xpApplied = delta.xp;
    for (const level of r.levelsLost) events.push({ type: 'levelDown', level: level - 1 });
  }

  // Gold (never below 0)
  let goldDelta = delta.gold;
  if (goldDelta < 0 && opts.suppressLosses) goldDelta = 0;
  const newGold = Math.max(0, p.gold + goldDelta);
  const goldApplied = newGold - p.gold;
  p = { ...p, gold: newGold };

  // Vitality (capped at max, may drop to ≤ 0 → death)
  let vitDelta = delta.vitality;
  if (vitDelta < 0 && opts.suppressLosses) vitDelta = 0;
  let newVit = Math.min(balance.vitality.max, p.vitality + vitDelta);
  if (newVit <= 0 && !allowDeath) newVit = Math.min(p.vitality, Math.max(1, newVit));
  const vitApplied = newVit - p.vitality;
  p = { ...p, vitality: newVit };

  let died = false;
  const brokenItemIds: string[] = [];
  if (p.vitality <= 0 && allowDeath) {
    const d = applyDeath(p, ctx);
    p = d.player;
    died = true;
    if (d.report.brokenItem) brokenItemIds.push(d.report.brokenItem.id);
    events.push({ type: 'death', report: d.report });
  }

  return {
    player: p,
    applied: { xp: xpApplied, gold: goldApplied, vitality: vitApplied },
    events,
    died,
    brokenItemIds,
  };
}

/** Reward for completing a daily / tapping habit "+" with `points` */
export function rewardForPoints(points: number, balance: Balance): Delta {
  return {
    xp: points * balance.rewards.xpPerPoint,
    gold: points * balance.rewards.goldPerPoint,
    vitality: points * balance.rewards.vitalityHealPerPoint,
  };
}

/** Effect of a habit "−" tap with `points` */
export function lossForMinusPoints(points: number, balance: Balance): Delta {
  return {
    xp: 0,
    gold: -Math.round(points * balance.habitMinus.goldLossPerPoint),
    vitality: -Math.round(points * balance.habitMinus.vitalityLossPerPoint),
  };
}
