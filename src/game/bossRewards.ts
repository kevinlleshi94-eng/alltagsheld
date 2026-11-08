/**
 * Boss rewards (user feedback Phase 4): gold for every boss, sometimes a chest.
 * Only the first victory over a boss counts (no farming after a death). Pure – db/repo.ts stores the result.
 */
import type { Balance } from './balance';
import { applyVictory, stageIndex, stageKind, type StageKind, type VictoryResult } from './combat';
import { generateItem, SLOTS, type ChestId } from './items';
import { applyDelta } from './resources';
import type { Item, LogicContext, Player, StagePosition } from './types';

export interface BossReward {
  gold: number;
  /** chest that dropped (null = none this time) */
  chest: ChestId | null;
}

export interface ChestDrop {
  chest: ChestId;
  /** the new item (already in the inventory, not equipped) */
  item: Item;
}

export interface VictoryOutcome extends VictoryResult {
  /** gold / chest for a boss beaten for the first time, otherwise null */
  reward: { gold: number; drop: ChestDrop | null } | null;
}

/** true if the hero has never beaten the enemy at their current stage (= standing at the furthest stage) */
export function isFirstVictory(player: Pick<Player, 'round' | 'area' | 'stage' | 'progress'>, balance: Balance): boolean {
  return stageIndex(player, balance) >= player.progress.highestStageIndex;
}

/** area index over all rounds (Straße R1 = 0, Straße R2 = areaCount) */
function areaIndex(pos: StagePosition, balance: Balance): number {
  return (pos.round - 1) * balance.combat.areaCount + (pos.area - 1);
}

/** gold of a boss at this position (0 for normal enemies) */
export function bossGold(pos: StagePosition, balance: Balance): number {
  const kind = stageKind(pos.stage, balance);
  if (kind === 'normal') return 0;
  const r = balance.bossRewards;
  const base = kind === 'areaBoss' ? r.goldAreaBoss : r.goldBoss;
  return Math.round(base * Math.pow(r.goldGrowthPerArea, areaIndex(pos, balance)));
}

function chestRule(pos: StagePosition, kind: StageKind, balance: Balance) {
  const r = balance.bossRewards;
  if (kind === 'areaBoss') return pos.area === balance.combat.areaCount ? r.chestDragon : r.chestAreaBoss;
  return r.chestBoss;
}

/** reward for beating the boss at `pos` (rolls the chest) – null for normal enemies */
export function rollBossReward(pos: StagePosition, rng: () => number, balance: Balance): BossReward | null {
  const kind = stageKind(pos.stage, balance);
  if (kind === 'normal') return null;
  const rule = chestRule(pos, kind, balance);
  return { gold: bossGold(pos, balance), chest: rng() < rule.chance ? rule.chest : null };
}

/**
 * Victory + boss reward in one step: advance, add the gold (via applyDelta) and, if a chest dropped,
 * create its item for a random slot. The caller stores the player and the new item.
 */
export function winFight(player: Player, ctx: LogicContext, newItemId: () => string): VictoryOutcome & { player: Player } {
  const first = isFirstVictory(player, ctx.balance);
  const result = applyVictory(player, ctx.balance);
  const reward = first ? rollBossReward(player, ctx.rng, ctx.balance) : null;
  if (!reward) return { ...result, reward: null };
  const p = applyDelta(result.player, { xp: 0, gold: reward.gold, vitality: 0 }, ctx).player;
  let drop: ChestDrop | null = null;
  if (reward.chest) {
    const slot = SLOTS[Math.min(SLOTS.length - 1, Math.floor(ctx.rng() * SLOTS.length))];
    drop = { chest: reward.chest, item: generateItem(slot, reward.chest, p.level, ctx.rng, ctx.balance, newItemId(), ctx.now) };
  }
  return { ...result, player: p, reward: { gold: reward.gold, drop } };
}
