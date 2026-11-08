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

const dec = (n: number) => num(n, Number.isInteger(n) ? 0 : 1);

export interface AttributePreview {
  /** what the attribute changes, e.g. „Schaden pro Treffer“ */
  label: string;
  /** value now */
  now: string;
  /** value after one more point (null = already at the maximum) */
  next: string | null;
}

/** current combat value of an attribute and the value after one more point (feedback Phase 4) */
export function attributePreview(current: HeroStats, attr: Attribute, balance: Balance): AttributePreview {
  const attrs = { ...current.attributes, [attr]: current.attributes[attr] + 1 };
  const next = heroStatsFromAttributes(attrs, current.exhausted, balance, current.critBonus);
  switch (attr) {
    case 'strength':
      return { label: 'Schaden pro Treffer', now: dec(current.damage), next: dec(next.damage) };
    case 'life':
      return { label: 'Lebenspunkte', now: num(current.maxHp), next: num(next.maxHp) };
    case 'speed':
      return {
        label: 'Angriff alle',
        now: formatSeconds(current.attackInterval),
        next: next.attackInterval < current.attackInterval ? formatSeconds(next.attackInterval) : null,
      };
  }
}

/** „Schaden pro Treffer 28 → 31“ – what one more point in `attr` would change right now */
export function attributeGain(current: HeroStats, attr: Attribute, balance: Balance): string {
  const p = attributePreview(current, attr, balance);
  return p.next ? `${p.label} ${p.now} → ${p.next}` : `${p.label} ${p.now} (Maximum)`;
}
