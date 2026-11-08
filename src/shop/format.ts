import type { CSSProperties } from 'react';
import { ITEM_STATS, type ItemStats } from '../game/items';
import type { ItemStat, Rarity } from '../game/types';
import { RARITY_COLORS, STAT_SHORT } from '../ui/labels';

export const STAT_ORDER: ItemStat[] = ITEM_STATS;

/** CSS variable --rarity for rarity-coloured text and glows */
export const rarityStyle = (rarity: Rarity): CSSProperties => ({ '--rarity': RARITY_COLORS[rarity] }) as CSSProperties;

/** value of one item stat as text: „+3“, Krit-Chance „+4 %“ */
export function statValue(stat: ItemStat, value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
  return `${sign}${Math.abs(value)}${stat === 'crit' ? ' %' : ''}`;
}

/** „+3 Stärke · +1 Tempo“, „+4 Leben · +3 % Krit“ */
export function statsText(stats: ItemStats): string {
  return STAT_ORDER.filter((a) => stats[a])
    .map((a) => `${statValue(a, stats[a]!)} ${STAT_SHORT[a]}`)
    .join(' · ');
}
