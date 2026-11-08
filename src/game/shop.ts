/**
 * Shop & equipment actions (SPEC 7.3): buy a chest, equip / unequip, sell.
 * Pure – returns the new player (+ item); db/repo.ts stores the result.
 * Gold only changes through applyDelta.
 */
import type { Balance } from './balance';
import { generateItem, itemPower, itemSellPrice, RARITIES, type ChestId, type ItemStats } from './items';
import { applyDelta } from './resources';
import type { Item, ItemStat, LogicContext, Player, Rarity, Slot } from './types';

export class ShopError extends Error {}

export function chestPrice(chest: ChestId, ctx: Pick<LogicContext, 'balance'>): number {
  return ctx.balance.items.chests[chest].price;
}

export function canAfford(player: Pick<Player, 'gold'>, chest: ChestId, ctx: Pick<LogicContext, 'balance'>): boolean {
  return player.gold >= chestPrice(chest, ctx);
}

/** pays the chest and rolls a new item (not equipped yet – it lands in the inventory) */
export function buyChest(player: Player, slot: Slot, chest: ChestId, ctx: LogicContext, id: string): { player: Player; item: Item } {
  const price = chestPrice(chest, ctx);
  if (player.gold < price) throw new ShopError('Nicht genug Gold');
  const paid = applyDelta(player, { xp: 0, gold: -price, vitality: 0 }, ctx);
  const item = generateItem(slot, chest, player.level, ctx.rng, ctx.balance, id, ctx.now);
  return { player: paid.player, item };
}

/** puts the item into its slot; the item that was there stays in the inventory */
export function equipItem(player: Player, item: Pick<Item, 'id' | 'slot'>): Player {
  return { ...player, equipped: { ...player.equipped, [item.slot]: item.id } };
}

export function unequipSlot(player: Player, slot: Slot): Player {
  return { ...player, equipped: { ...player.equipped, [slot]: null } };
}

export function isEquipped(player: Pick<Player, 'equipped'>, itemId: string): boolean {
  return Object.values(player.equipped).includes(itemId);
}

/** sells for a share of the chest price (unequips it first); the caller deletes the item */
export function sellItem(player: Player, item: Item, ctx: LogicContext): { player: Player; gold: number } {
  let p = isEquipped(player, item.id) ? unequipSlot(player, item.slot) : player;
  const gold = itemSellPrice(item, ctx.balance);
  p = applyDelta(p, { xp: 0, gold, vitality: 0 }, ctx).player;
  return { player: p, gold };
}

/** candidate − current per attribute (only attributes that appear in either) */
export function statDiff(candidate: ItemStats | null | undefined, current: ItemStats | null | undefined): Partial<Record<ItemStat, number>> {
  const out: Partial<Record<ItemStat, number>> = {};
  const keys = new Set([...Object.keys(candidate ?? {}), ...Object.keys(current ?? {})]) as Set<ItemStat>;
  for (const k of keys) out[k] = (candidate?.[k] ?? 0) - (current?.[k] ?? 0);
  return out;
}

/** highest rarity among the items (for the glow at the hero), null if none */
export function bestRarity(items: ReadonlyArray<Pick<Item, 'rarity'> | null | undefined>): Rarity | null {
  let best = -1;
  for (const i of items) if (i) best = Math.max(best, RARITIES.indexOf(i.rarity));
  return best < 0 ? null : RARITIES[best];
}

/** inventory order (user feedback Phase 4): rarest first, then the stronger item, then newest */
export function sortInventory<T extends Pick<Item, 'rarity' | 'stats' | 'acquiredAt'>>(items: readonly T[], balance: Balance): T[] {
  return [...items].sort(
    (a, b) =>
      RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) ||
      itemPower(b.stats, balance) - itemPower(a.stats, balance) ||
      b.acquiredAt - a.acquiredAt,
  );
}

/** inventory filter: all items or one slot */
export type InventoryFilter = Slot | 'all';

export function filterInventory<T extends Pick<Item, 'slot'>>(items: readonly T[], filter: InventoryFilter): T[] {
  return filter === 'all' ? [...items] : items.filter((i) => i.slot === filter);
}
