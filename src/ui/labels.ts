import type { ChestId } from '../game/items';
import type { Attribute, ItemStat, Rarity, Slot } from '../game/types';

/** German UI labels */
export const ATTRIBUTES: { id: Attribute; label: string; hint: string }[] = [
  { id: 'strength', label: 'Stärke', hint: 'mehr Schaden pro Treffer' },
  { id: 'speed', label: 'Angriffsgeschwindigkeit', hint: 'kürzere Zeit zwischen Angriffen' },
  { id: 'life', label: 'Leben', hint: 'mehr Lebenspunkte im Kampf' },
];

export const ATTRIBUTE_NAMES: Record<Attribute, string> = {
  strength: 'Stärke',
  speed: 'Angriffsgeschwindigkeit',
  life: 'Leben',
};

/** what an item can give (attributes + Krit-Chance of shields) */
export const STAT_NAMES: Record<ItemStat, string> = {
  ...ATTRIBUTE_NAMES,
  crit: 'Krit-Chance',
};

/** short form for compact item lines */
export const STAT_SHORT: Record<ItemStat, string> = {
  strength: 'Stärke',
  speed: 'Tempo',
  life: 'Leben',
  crit: 'Krit',
};

/** equipment slots, named like the item (user feedback: „Kopf/Körper“ was unclear) */
export const SLOT_NAMES: Record<Slot, string> = { head: 'Helm', body: 'Rüstung', weapon: 'Waffe', shield: 'Schild' };
/** where the item sits at the hero */
export const SLOT_PLACES: Record<Slot, string> = { head: 'Kopf', body: 'Körper', weapon: 'Hand', shield: 'Arm' };

export const RARITY_NAMES: Record<Rarity, string> = {
  common: 'Gewöhnlich',
  uncommon: 'Ungewöhnlich',
  rare: 'Selten',
  epic: 'Episch',
  legendary: 'Legendär',
};

/** SPEC 7.3: grau / grün / blau / lila / orange (also used by the battle scene) */
export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#b9b2a6',
  uncommon: '#62c84c',
  rare: '#4f9dff',
  epic: '#b872f2',
  legendary: '#ff9b30',
};

export const CHEST_NAMES: Record<ChestId, string> = { wood: 'Holztruhe', iron: 'Eisentruhe', gold: 'Goldtruhe' };
