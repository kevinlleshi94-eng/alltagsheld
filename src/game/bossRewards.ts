/**
 * Boss rewards: gold + a chest for every boss on the FIRST victory (no farming after a death).
 * Feedback v0.5: the chest is kept (player.pendingChests) until the player picks the slot; the dragon drops
 * the best item for every slot instead. Pure – db/repo.ts stores the result.
 */
import type { Balance } from './balance';
import { applyVictory, stageIndex, stageKind, type VictoryResult } from './combat';
import { generateBestItem, generateItem, SLOTS, type ChestId } from './items';
import { applyDelta } from './resources';
import type { Item, LogicContext, PendingChest, Player, Slot, StagePosition } from './types';

export type BossLoot = ChestId | 'dragon';

export interface VictoryOutcome extends VictoryResult {
  /** gold + loot for a boss beaten for the first time, otherwise null */
  reward: {
    gold: number;
    /** chest waiting for the slot choice (null for the dragon) */
    chest: PendingChest | null;
    /** the dragon's hoard: one best item per slot (already meant for the inventory) */
    hoard: Item[];
  } | null;
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

/** what the boss at `pos` drops (null for normal enemies) */
export function bossLoot(pos: StagePosition, balance: Balance): BossLoot | null {
  const kind = stageKind(pos.stage, balance);
  if (kind === 'normal') return null;
  if (kind === 'areaBoss' && pos.area === balance.combat.areaCount) return 'dragon';
  const table = balance.bossRewards.chests;
  const row = table[Math.min(table.length - 1, pos.area - 1)];
  return kind === 'areaBoss' ? row.areaBoss : row.boss;
}

/** the dragon's hoard: the best item of every slot for the hero's level */
export function dragonHoard(level: number, ctx: LogicContext, newItemId: () => string): Item[] {
  const rarity = ctx.balance.bossRewards.dragonHoard.rarity;
  return SLOTS.map((slot) => generateBestItem(slot, rarity, level, ctx.rng, ctx.balance, newItemId(), ctx.now));
}

/**
 * Victory + boss reward in one step: advance, add the gold (via applyDelta) and keep the chest
 * (or create the dragon's hoard). The caller stores the player and the hoard items.
 */
export function winFight(player: Player, ctx: LogicContext, newItemId: () => string): VictoryOutcome & { player: Player } {
  const first = isFirstVictory(player, ctx.balance);
  const pos: StagePosition = { round: player.round, area: player.area, stage: player.stage };
  const result = applyVictory(player, ctx.balance);
  const loot = first ? bossLoot(pos, ctx.balance) : null;
  if (!loot) return { ...result, reward: null };
  const gold = bossGold(pos, ctx.balance);
  let p = applyDelta(result.player, { xp: 0, gold, vitality: 0 }, ctx).player;
  if (loot === 'dragon') {
    return { ...result, player: p, reward: { gold, chest: null, hoard: dragonHoard(p.level, ctx, newItemId) } };
  }
  const chest: PendingChest = { id: newItemId(), chest: loot, from: pos, at: ctx.now };
  p = { ...p, pendingChests: [...(p.pendingChests ?? []), chest] };
  return { ...result, player: p, reward: { gold, chest, hoard: [] } };
}

/** opens a kept boss chest for the chosen slot: the item lands in the inventory (not equipped) */
export function openPendingChest(
  player: Player,
  pendingId: string,
  slot: Slot,
  ctx: LogicContext,
  itemId: string,
): { player: Player; item: Item; chest: ChestId } | null {
  const pending = (player.pendingChests ?? []).find((c) => c.id === pendingId);
  if (!pending) return null;
  const item = generateItem(slot, pending.chest, player.level, ctx.rng, ctx.balance, itemId, ctx.now);
  return {
    player: { ...player, pendingChests: player.pendingChests.filter((c) => c.id !== pendingId) },
    item,
    chest: pending.chest,
  };
}
