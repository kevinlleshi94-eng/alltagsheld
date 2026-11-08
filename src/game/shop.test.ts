import { describe, expect, it } from 'vitest';
import { BALANCE } from './balance';
import { CHESTS, convertLegacyItem, generateItem, itemName, itemPower, itemSellPrice, RARITIES, SLOTS, type ChestId } from './items';
import { seededRng } from './rng';
import {
  bestRarity,
  buyChest,
  canAfford,
  equipItem,
  filterInventory,
  isEquipped,
  sellItem,
  ShopError,
  sortInventory,
  statDiff,
  unequipSlot,
} from './shop';
import { ctx, makePlayer, NOON } from './testUtils';
import type { Item } from './types';

const item = (over: Partial<Item> = {}): Item => ({
  id: 'i1',
  slot: 'weapon',
  rarity: 'common',
  name: 'Schlichtes Kurzschwert',
  spriteKey: 'weapon:common',
  stats: { strength: 2 },
  levelAtPurchase: 1,
  chestType: 'wood',
  acquiredAt: NOON,
  ...over,
});

describe('item names', () => {
  const always = (v: number) => () => v;

  it('adjective ending follows the gender of the noun', () => {
    expect(itemName('weapon', 'common', null, always(0))).toBe('Schlichtes Kurzschwert');
    expect(itemName('head', 'common', null, always(0))).toBe('Schlichter Nasalhelm');
    expect(itemName('head', 'rare', null, always(0))).toBe('Edle Barbuta');
    expect(itemName('weapon', 'legendary', null, always(0))).toBe('Legendäre Sonnenklinge');
  });

  it('epic and legendary items name their second bonus', () => {
    expect(itemName('body', 'epic', 'life', always(0.3))).toBe('Verzauberter Plattenpanzer des Lebens');
    expect(itemName('shield', 'legendary', 'speed', always(0))).toBe('Legendärer Goldschild der Schnelligkeit');
  });

  it('leather is never rusty', () => {
    for (let i = 0; i < 50; i++) expect(itemName('body', 'common', null, always(i / 50))).not.toMatch(/^Rostig/);
  });
});

describe('item generator', () => {
  it('builds a complete item from the chest', () => {
    const it1 = generateItem('shield', 'iron', 7, seededRng(3), BALANCE, 'x', NOON);
    expect(it1).toMatchObject({ id: 'x', slot: 'shield', levelAtPurchase: 7, chestType: 'iron', acquiredAt: NOON });
    expect(RARITIES).toContain(it1.rarity);
    expect(it1.spriteKey).toBe(`shield:${it1.rarity}`);
    expect(it1.name.length).toBeGreaterThan(5);
    expect(itemPower(it1.stats, BALANCE)).toBeGreaterThan(0);
  });

  it('is deterministic for the same random numbers', () => {
    const a = generateItem('head', 'gold', 4, seededRng(9), BALANCE, 'a', NOON);
    const b = generateItem('head', 'gold', 4, seededRng(9), BALANCE, 'a', NOON);
    expect(a).toEqual(b);
  });

  it('the wood chest never drops epic or legendary, the gold chest can', () => {
    const rng = seededRng(1);
    const seen = (chest: ChestId) => {
      const s = new Set<string>();
      for (let i = 0; i < 3000; i++) s.add(generateItem('weapon', chest, 1, rng, BALANCE, 'x', NOON).rarity);
      return s;
    };
    const wood = seen('wood');
    expect(wood.has('epic') || wood.has('legendary')).toBe(false);
    expect(seen('gold').has('legendary')).toBe(true);
  });

  it('better chests give more power on average', () => {
    const rng = seededRng(5);
    const avg = (chest: ChestId) => {
      let sum = 0;
      for (let i = 0; i < 2000; i++) sum += itemPower(generateItem('body', chest, 5, rng, BALANCE, 'x', NOON).stats, BALANCE);
      return sum / 2000;
    };
    const [wood, iron, gold] = CHESTS.map(avg);
    expect(iron).toBeGreaterThan(wood);
    expect(gold).toBeGreaterThan(iron);
  });

  it('every slot can be generated', () => {
    for (const slot of SLOTS) expect(generateItem(slot, 'wood', 1, seededRng(2), BALANCE, 'x', NOON).slot).toBe(slot);
  });
});

describe('shop', () => {
  it('buying pays the chest price and returns an unequipped item', () => {
    const price = BALANCE.items.chests.iron.price;
    const player = makePlayer({ gold: price + 50, level: 3 });
    const r = buyChest(player, 'weapon', 'iron', ctx(), 'new');
    expect(r.player.gold).toBe(50);
    expect(r.item).toMatchObject({ id: 'new', slot: 'weapon', chestType: 'iron', levelAtPurchase: 3 });
    expect(isEquipped(r.player, 'new')).toBe(false);
  });

  it('refuses when gold is missing (nothing changes)', () => {
    const gold = BALANCE.items.chests.wood.price - 1;
    const player = makePlayer({ gold });
    expect(canAfford(player, 'wood', ctx())).toBe(false);
    expect(() => buyChest(player, 'head', 'wood', ctx(), 'x')).toThrow(ShopError);
    expect(player.gold).toBe(gold);
  });

  it('equipping replaces the item in that slot, unequipping empties it', () => {
    let p = equipItem(makePlayer(), item({ id: 'a' }));
    p = equipItem(p, item({ id: 'b' }));
    expect(p.equipped.weapon).toBe('b');
    expect(isEquipped(p, 'a')).toBe(false);
    p = unequipSlot(p, 'weapon');
    expect(p.equipped.weapon).toBeNull();
  });

  it('selling gives 25 % of the chest price and unequips the item', () => {
    const sword = item({ id: 's', chestType: 'gold' });
    const p = equipItem(makePlayer({ gold: 10 }), sword);
    const r = sellItem(p, sword, ctx());
    const back = Math.floor(BALANCE.items.chests.gold.price * BALANCE.items.sellFraction);
    expect(r.gold).toBe(back);
    expect(r.player.gold).toBe(10 + back);
    expect(r.player.equipped.weapon).toBeNull();
    // unknown chest (old data) → cheapest chest
    expect(itemSellPrice({ chestType: '?' }, BALANCE)).toBe(Math.floor(BALANCE.items.chests.wood.price * BALANCE.items.sellFraction));
  });

  it('compares stats (positive = better than the current item)', () => {
    expect(statDiff({ strength: 5, speed: 1 }, { strength: 3, life: 2 })).toEqual({ strength: 2, speed: 1, life: -2 });
    expect(statDiff({ life: 4 }, null)).toEqual({ life: 4 });
  });

  it('finds the best rarity', () => {
    expect(bestRarity([null, item({ rarity: 'rare' }), item({ rarity: 'epic' })])).toBe('epic');
    expect(bestRarity([])).toBeNull();
  });

  it('sorts the inventory rarest first, then stronger, then newest (feedback Phase 4)', () => {
    const sorted = sortInventory(
      [
        item({ id: 'common', slot: 'head', rarity: 'common' }),
        item({ id: 'rare-weak', slot: 'shield', rarity: 'rare', stats: { life: 2 } }),
        item({ id: 'legendary', slot: 'head', rarity: 'legendary' }),
        item({ id: 'rare-strong', slot: 'weapon', rarity: 'rare', stats: { strength: 6 } }),
        item({ id: 'rare-crit', slot: 'shield', rarity: 'rare', stats: { life: 2, crit: 4 } }),
      ],
      BALANCE,
    );
    expect(sorted.map((i) => i.id)).toEqual(['legendary', 'rare-strong', 'rare-crit', 'rare-weak', 'common']);
  });

  it('filters the inventory by slot', () => {
    const list = [item({ id: 'a', slot: 'head' }), item({ id: 'b', slot: 'shield' }), item({ id: 'c', slot: 'head' })];
    expect(filterInventory(list, 'all').map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(filterInventory(list, 'head').map((i) => i.id)).toEqual(['a', 'c']);
    expect(filterInventory(list, 'body')).toEqual([]);
  });

  it('item power counts Krit-Chance at its point value', () => {
    expect(itemPower({ life: 3, crit: 4 }, BALANCE)).toBe(3 + 4 / BALANCE.items.critPercentPerPoint);
    expect(statDiff({ life: 3, crit: 4 }, { life: 5 })).toEqual({ life: -2, crit: 4 });
  });

  it('converts items from before the new slot rules without losing value (schema v4)', () => {
    const oldHelmet = item({ slot: 'head', rarity: 'epic', stats: { life: 6, strength: 3 }, name: 'Uralter Visierhelm der Stärke' });
    const helmet = convertLegacyItem(oldHelmet, BALANCE);
    expect(helmet.stats).toEqual({ speed: 9 });
    expect(helmet.name).toBe('Uralter Visierhelm der Schnelligkeit');
    const shield = convertLegacyItem(item({ slot: 'shield', stats: { life: 5 }, name: 'Grober Rundschild' }), BALANCE);
    expect(Object.keys(shield.stats)).toEqual(['life', 'crit']);
    expect(itemPower(shield.stats, BALANCE)).toBeCloseTo(5, 0);
    expect(shield.name).toBe('Grober Rundschild');
    const body = convertLegacyItem(item({ slot: 'body', stats: { strength: 2, life: 2 } }), BALANCE);
    expect(body.stats).toEqual({ life: 4 });
  });
});
