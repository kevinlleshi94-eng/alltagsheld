/**
 * Item value generation (stats only). Names, sprites, shop UI and inventory follow in Phase 4.
 */
import type { Balance } from './balance';
import type { Attribute, Rarity, Slot } from './types';

export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const SLOTS: Slot[] = ['head', 'body', 'weapon', 'shield'];
export type ChestId = 'wood' | 'iron' | 'gold';
export const CHESTS: ChestId[] = ['wood', 'iron', 'gold'];

export type ItemStats = Partial<Record<Attribute, number>>;

export function rollRarity(chest: ChestId, rng: () => number, balance: Balance): Rarity {
  const odds = balance.items.chests[chest].odds;
  const total = odds.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < odds.length; i++) {
    r -= odds[i];
    if (r < 0) return RARITIES[i];
  }
  return RARITIES[odds.length - 1];
}

/** total attribute points an item of this rarity/level is worth (before rounding) */
export function itemBudget(rarity: Rarity, level: number, balance: Balance): number {
  const b = balance.items;
  return b.basePoints * b.rarityFactors[RARITIES.indexOf(rarity)] * (1 + b.levelFactor * Math.max(0, level - 1));
}

const ATTRS: Attribute[] = ['strength', 'speed', 'life'];

/**
 * Slot rules (SPEC 7.2): weapon → Stärke, shield → Leben, head → Leben (+ chance Geschwindigkeit),
 * body → Leben and/or Stärke. Epic and legendary get an additional second bonus.
 */
export function rollItemStats(slot: Slot, rarity: Rarity, level: number, rng: () => number, balance: Balance): ItemStats {
  const b = balance.items;
  const budget = itemBudget(rarity, level, balance) * (1 - b.spread + 2 * b.spread * rng());
  const stats: ItemStats = {};
  const add = (a: Attribute, v: number) => {
    stats[a] = (stats[a] ?? 0) + v;
  };

  switch (slot) {
    case 'weapon':
      add('strength', budget);
      break;
    case 'shield':
      add('life', budget);
      break;
    case 'head':
      if (rng() < b.headSpeedChance) {
        add('life', budget * 0.5);
        add('speed', budget * 0.5);
      } else add('life', budget);
      break;
    case 'body': {
      const r = rng();
      if (r < 1 / 3) add('life', budget);
      else if (r < 2 / 3) add('strength', budget);
      else {
        add('life', budget * 0.5);
        add('strength', budget * 0.5);
      }
      break;
    }
  }

  if (rarity === 'epic' || rarity === 'legendary') {
    const main = Object.keys(stats) as Attribute[];
    const options = ATTRS.filter((a) => !main.includes(a));
    const pick = options.length > 0 ? options : ATTRS;
    add(pick[Math.min(pick.length - 1, Math.floor(rng() * pick.length))], budget * b.secondBonusFraction);
  }

  for (const k of Object.keys(stats) as Attribute[]) stats[k] = Math.max(1, Math.round(stats[k]!));
  return stats;
}

/** Simple value of an item = sum of its attribute points */
export function itemPower(stats: ItemStats | undefined | null): number {
  if (!stats) return 0;
  return (stats.strength ?? 0) + (stats.speed ?? 0) + (stats.life ?? 0);
}

export function sellPrice(chest: ChestId, balance: Balance): number {
  return Math.floor(balance.items.chests[chest].price * balance.items.sellFraction);
}
