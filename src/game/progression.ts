import type { Balance } from './balance';
import type { Attribute, Player } from './types';

/** XP needed to advance from `level` to `level + 1` */
export function xpToNextLevel(level: number, balance: Balance): number {
  const l = balance.levels;
  return Math.max(1, Math.min(l.xpMaxPerLevel, Math.round(l.xpBase * Math.pow(level, l.xpExponent))));
}

/** Total XP needed to reach `level` from level 1 (statistics / simulation) */
export function totalXpForLevel(level: number, balance: Balance): number {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpToNextLevel(l, balance);
  return sum;
}

/** Adds XP and processes level-ups. Returns the newly reached levels. */
export function addXp(
  player: Player,
  amount: number,
  balance: Balance,
): { player: Player; levelsGained: number[] } {
  if (amount <= 0) return { player, levelsGained: [] };
  let { level, xp, unspentPoints } = player;
  xp += amount;
  const levelsGained: number[] = [];
  while (xp >= xpToNextLevel(level, balance)) {
    xp -= xpToNextLevel(level, balance);
    level += 1;
    unspentPoints += balance.levels.attributePointsPerLevel;
    levelsGained.push(level);
  }
  return { player: { ...player, level, xp, unspentPoints }, levelsGained };
}

/**
 * Removes XP (used when a reward is taken back). Drops levels if needed and
 * removes the matching attribute points. XP never goes below 0 on level 1.
 * Returns the levels that were lost (the level numbers left behind).
 */
export function removeXp(
  player: Player,
  amount: number,
  balance: Balance,
): { player: Player; levelsLost: number[] } {
  if (amount <= 0) return { player, levelsLost: [] };
  let p: Player = { ...player, xp: player.xp - amount };
  const levelsLost: number[] = [];
  while (p.xp < 0 && p.level > 1) {
    levelsLost.push(p.level);
    const newLevel = p.level - 1;
    p = { ...p, level: newLevel, xp: p.xp + xpToNextLevel(newLevel, balance) };
    for (let i = 0; i < balance.levels.attributePointsPerLevel; i++) {
      p = removeLastAttributePoint(p).player;
    }
  }
  if (p.xp < 0) p = { ...p, xp: 0 };
  return { player: p, levelsLost };
}

/** Spends one saved attribute point */
export function allocateAttribute(player: Player, attribute: Attribute): Player {
  if (player.unspentPoints <= 0) return player;
  return {
    ...player,
    unspentPoints: player.unspentPoints - 1,
    attributes: { ...player.attributes, [attribute]: player.attributes[attribute] + 1 },
    attributeHistory: [...player.attributeHistory, attribute],
  };
}

/**
 * Removes the most recently gained attribute point:
 * a saved (unspent) point first, otherwise the last spent one.
 */
export function removeLastAttributePoint(player: Player): {
  player: Player;
  removed: Attribute | 'unspent' | null;
} {
  if (player.unspentPoints > 0) {
    return { player: { ...player, unspentPoints: player.unspentPoints - 1 }, removed: 'unspent' };
  }
  const history = [...player.attributeHistory];
  const last = history.pop();
  if (!last) return { player, removed: null };
  return {
    player: {
      ...player,
      attributeHistory: history,
      attributes: { ...player.attributes, [last]: Math.max(0, player.attributes[last] - 1) },
    },
    removed: last,
  };
}
