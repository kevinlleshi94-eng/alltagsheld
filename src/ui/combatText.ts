import type { Balance } from '../game/balance';
import { heroStatsFromAttributes, type HeroStats } from '../game/combat';
import type { Attribute } from '../game/types';

const num = (n: number, digits = 0) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const formatSeconds = (s: number) => `${num(s, 2)} s`;
export const formatNumber = num;

/** expected damage per second incl. crits */
export function dps(s: HeroStats): number {
  return (s.damage * (1 + s.critChance * (s.critMultiplier - 1))) / s.attackInterval;
}

/** "+3 Schaden" etc. – what one more point in `attr` would change right now */
export function attributeGain(current: HeroStats, attr: Attribute, balance: Balance): string {
  const attrs = { ...current.attributes, [attr]: current.attributes[attr] + 1 };
  const next = heroStatsFromAttributes(attrs, current.exhausted, balance);
  switch (attr) {
    case 'strength':
      return `+${num(next.damage - current.damage, Number.isInteger(next.damage - current.damage) ? 0 : 1)} Schaden pro Treffer`;
    case 'life':
      return `+${num(next.maxHp - current.maxHp)} Lebenspunkte im Kampf`;
    case 'speed':
      return next.attackInterval < current.attackInterval
        ? `Angriff alle ${formatSeconds(current.attackInterval)} → ${formatSeconds(next.attackInterval)}`
        : 'Maximales Tempo erreicht';
  }
}
