import type { DeathReport, LogicContext, Player, Slot } from './types';
import { removeLastAttributePoint } from './progression';

/**
 * Applies all death consequences (each switchable in balance.death).
 * Returns the new player and a report. The caller must delete
 * `report.brokenItem.id` from the item store.
 */
export function applyDeath(player: Player, ctx: LogicContext): { player: Player; report: DeathReport } {
  const cfg = ctx.balance.death;
  const before = player;
  let p: Player = { ...player };

  // 1. −1 level, XP to 0, remove last attribute point
  let removedPoint: DeathReport['removedPoint'] = null;
  if (cfg.loseLevel) {
    if (p.level > 1) {
      p.level -= 1;
      const r = removeLastAttributePoint(p);
      p = r.player;
      removedPoint = r.removed;
    }
    p.xp = 0;
  }

  // 2. lose all gold
  const goldLost = cfg.loseGold ? p.gold : 0;
  if (cfg.loseGold) p.gold = 0;

  // 3. a random equipped item breaks
  let brokenItem: DeathReport['brokenItem'] = null;
  if (cfg.breakRandomEquippedItem) {
    const slots = (Object.keys(p.equipped) as Slot[]).filter((s) => p.equipped[s] !== null);
    if (slots.length > 0) {
      const slot = slots[Math.min(slots.length - 1, Math.floor(ctx.rng() * slots.length))];
      brokenItem = { id: p.equipped[slot] as string, slot };
      p.equipped = { ...p.equipped, [slot]: null };
    }
  }

  // 4. back to stage 1 of the current area
  if (cfg.resetToAreaStart) p.stage = 1;

  // 5. vitality refilled
  p.vitality = Math.round(ctx.balance.vitality.max * cfg.vitalityAfterDeath);
  p.deaths += 1;
  p.lastDeathAt = ctx.now;

  return {
    player: p,
    report: {
      at: ctx.now,
      levelBefore: before.level,
      levelAfter: p.level,
      goldLost,
      removedPoint,
      brokenItem,
      stageBefore: { round: before.round, area: before.area, stage: before.stage },
      stageAfter: { round: p.round, area: p.area, stage: p.stage },
    },
  };
}
