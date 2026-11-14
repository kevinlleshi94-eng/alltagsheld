/**
 * Item generator (SPEC 7.3): rarity from the chest odds, stats scaled by rarity and player level,
 * German names. Pure – the shop actions live in shop.ts, persistence in db/repo.ts.
 */
import type { Balance } from './balance';
import type { Attribute, Item, ItemStat, Rarity, Slot } from './types';

export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const SLOTS: Slot[] = ['head', 'body', 'weapon', 'shield'];
export type ChestId = 'wood' | 'iron' | 'gold';
export const CHESTS: ChestId[] = ['wood', 'iron', 'gold'];

export type ItemStats = Partial<Record<ItemStat, number>>;
export const ITEM_STATS: ItemStat[] = ['strength', 'speed', 'life', 'crit'];

/** what each slot can give (user feedback Phase 4) – also shown in the shop */
export const SLOT_STATS: Record<Slot, ItemStat[]> = {
  weapon: ['strength', 'speed'],
  head: ['speed'],
  body: ['life'],
  shield: ['life', 'crit'],
};

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

/**
 * Slot rules (user feedback Phase 4, see SLOT_STATS): weapon → Stärke (some also Tempo), helmet → Tempo,
 * body → Leben, shield → Leben + Krit-Chance. Epic and legendary get a bigger budget instead of a foreign bonus.
 */
export function rollItemStats(slot: Slot, rarity: Rarity, level: number, rng: () => number, balance: Balance): ItemStats {
  const b = balance.items;
  const budget =
    itemBudget(rarity, level, balance) *
    (1 - b.spread + 2 * b.spread * rng()) *
    (isHighRarity(rarity) ? 1 + b.highRarityBonus : 1);
  return splitBudget(slot, budget, rng() < b.weaponSpeedChance, balance);
}

/** distributes a budget (attribute points) over the slot's values; rounded, every value ≥ 1 */
export function splitBudget(slot: Slot, budget: number, weaponSpeed: boolean, balance: Balance): ItemStats {
  const b = balance.items;
  const raw: ItemStats = {};
  switch (slot) {
    case 'weapon':
      if (weaponSpeed) {
        raw.strength = budget * (1 - b.weaponSpeedShare);
        raw.speed = budget * b.weaponSpeedShare;
      } else raw.strength = budget;
      break;
    case 'head':
      raw.speed = budget;
      break;
    case 'body':
      raw.life = budget;
      break;
    case 'shield':
      raw.life = budget * (1 - b.shieldCritShare);
      raw.crit = budget * b.shieldCritShare * b.critPercentPerPoint;
      break;
  }
  const stats: ItemStats = {};
  for (const k of ITEM_STATS) if (raw[k] !== undefined) stats[k] = Math.max(1, Math.round(raw[k]!));
  return stats;
}

/** value of an item in attribute points (Krit-Chance converted back) – for comparisons */
export function itemPower(stats: ItemStats | undefined | null, balance: Balance): number {
  if (!stats) return 0;
  const crit = (stats.crit ?? 0) / balance.items.critPercentPerPoint;
  return (stats.strength ?? 0) + (stats.speed ?? 0) + (stats.life ?? 0) + crit;
}

/**
 * Schema v4: items from before the new slot rules keep their value but get the new split
 * (an old helmet with Leben becomes a helmet with Tempo). The name suffix follows the new values.
 */
export function convertLegacyItem(item: Item, balance: Balance): Item {
  const old = item.stats as Partial<Record<Attribute, number>>;
  const points = (old.strength ?? 0) + (old.speed ?? 0) + (old.life ?? 0);
  const stats = splitBudget(item.slot, Math.max(1, points), item.slot === 'weapon' && (old.speed ?? 0) > 0, balance);
  const base = stripSuffix(item.name);
  return { ...item, stats, name: isHighRarity(item.rarity) ? `${base} ${SUFFIX[nameStat(item.slot, stats)]}` : base };
}

function isHighRarity(rarity: Rarity): boolean {
  return rarity === 'epic' || rarity === 'legendary';
}

export function sellPrice(chest: ChestId, balance: Balance): number {
  return Math.floor(balance.items.chests[chest].price * balance.items.sellFraction);
}

export function isChestId(v: string): v is ChestId {
  return (CHESTS as string[]).includes(v);
}

/** sell value of a stored item (unknown chest → cheapest chest) */
export function itemSellPrice(item: Pick<Item, 'chestType'>, balance: Balance): number {
  return sellPrice(isChestId(item.chestType) ? item.chestType : 'wood', balance);
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

type Gender = 'm' | 'f' | 'n';

/** base noun per slot and rarity – matches the look at the hero (GEAR in battle/assets/catalog.ts) */
const NOUNS: Record<Slot, Record<Rarity, [string, Gender]>> = {
  head: {
    common: ['Nasalhelm', 'm'],
    uncommon: ['Spangenhelm', 'm'],
    rare: ['Barbuta', 'f'],
    epic: ['Visierhelm', 'm'],
    legendary: ['Sonnenhelm', 'm'],
  },
  body: {
    common: ['Lederwams', 'n'],
    uncommon: ['Legionärspanzer', 'm'],
    rare: ['Schienenpanzer', 'm'],
    epic: ['Plattenpanzer', 'm'],
    legendary: ['Drachenschuppenpanzer', 'm'],
  },
  weapon: {
    common: ['Kurzschwert', 'n'],
    uncommon: ['Stahlschwert', 'n'],
    rare: ['Silberschwert', 'n'],
    epic: ['Langschwert', 'n'],
    legendary: ['Sonnenklinge', 'f'],
  },
  shield: {
    common: ['Rundschild', 'm'],
    uncommon: ['Eisenschild', 'm'],
    rare: ['Wappenschild', 'm'],
    epic: ['Drachenschild', 'm'],
    legendary: ['Goldschild', 'm'],
  },
};

/** adjective stems; the ending follows the noun's gender (strong declension, no article) */
const ADJECTIVES: Record<Rarity, string[]> = {
  common: ['Schlicht', 'Abgenutzt', 'Einfach', 'Grob', 'Rostig'],
  uncommon: ['Solid', 'Verstärkt', 'Geschmiedet', 'Robust'],
  rare: ['Edl', 'Geschliffen', 'Meisterhaft', 'Glänzend'],
  epic: ['Runenbesetzt', 'Verzaubert', 'Heroisch', 'Uralt'],
  legendary: ['Legendär', 'Göttlich', 'Sagenhaft', 'Mythisch'],
};
const ENDINGS: Record<Gender, string> = { m: 'er', f: 'e', n: 'es' };
/** "rusty" only fits metal */
const NOT_FOR_LEATHER = new Set(['Rostig']);

/** epic/legendary name suffix, after the item's characteristic value */
const SUFFIX: Record<ItemStat, string> = {
  strength: 'der Stärke',
  speed: 'der Schnelligkeit',
  life: 'des Lebens',
  crit: 'der Präzision',
};

/** the value an epic/legendary item is named after (weapon with Tempo → Schnelligkeit, shield → Präzision) */
export function nameStat(slot: Slot, stats: ItemStats): ItemStat {
  switch (slot) {
    case 'weapon':
      return stats.speed ? 'speed' : 'strength';
    case 'head':
      return 'speed';
    case 'body':
      return 'life';
    case 'shield':
      return 'crit';
  }
}

function stripSuffix(name: string): string {
  for (const s of Object.values(SUFFIX)) if (name.endsWith(` ${s}`)) return name.slice(0, -s.length - 1);
  return name;
}

/** e.g. „Rostiges Kurzschwert“, „Verzauberter Plattenpanzer des Lebens“ */
export function itemName(slot: Slot, rarity: Rarity, suffix: ItemStat | null, rng: () => number): string {
  const [noun, gender] = NOUNS[slot][rarity];
  const stems = ADJECTIVES[rarity].filter((s) => !(noun === 'Lederwams' && NOT_FOR_LEATHER.has(s)));
  const stem = stems[Math.min(stems.length - 1, Math.floor(rng() * stems.length))];
  const name = `${stem}${ENDINGS[gender]} ${noun}`;
  return suffix ? `${name} ${SUFFIX[suffix]}` : name;
}

/** look of an item at the hero: one look per slot and rarity */
export function itemSpriteKey(slot: Slot, rarity: Rarity): string {
  return `${slot}:${rarity}`;
}

/** the dragon's hoard (v0.5): an item of the given rarity with the best possible roll (no Tempo split on weapons) */
export function generateBestItem(slot: Slot, rarity: Rarity, level: number, rng: () => number, balance: Balance, id: string, now: number): Item {
  const b = balance.items;
  const budget = itemBudget(rarity, level, balance) * (1 + b.spread) * (isHighRarity(rarity) ? 1 + b.highRarityBonus : 1);
  const stats = splitBudget(slot, budget, false, balance);
  return {
    id,
    slot,
    rarity,
    name: itemName(slot, rarity, isHighRarity(rarity) ? nameStat(slot, stats) : null, rng),
    spriteKey: itemSpriteKey(slot, rarity),
    stats,
    levelAtPurchase: level,
    chestType: 'gold',
    acquiredAt: now,
  };
}

/** a new item from a chest (rarity, stats, name) */
export function generateItem(
  slot: Slot,
  chest: ChestId,
  level: number,
  rng: () => number,
  balance: Balance,
  id: string,
  now: number,
): Item {
  const rarity = rollRarity(chest, rng, balance);
  const stats = rollItemStats(slot, rarity, level, rng, balance);
  return {
    id,
    slot,
    rarity,
    name: itemName(slot, rarity, isHighRarity(rarity) ? nameStat(slot, stats) : null, rng),
    spriteKey: itemSpriteKey(slot, rarity),
    stats,
    levelAtPurchase: level,
    chestType: chest,
    acquiredAt: now,
  };
}
