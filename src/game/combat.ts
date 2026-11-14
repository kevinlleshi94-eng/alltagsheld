/**
 * Pure combat logic: hero/enemy stats, stage progression and the fight engine.
 * The Phaser scene and the balancing simulation both use this engine.
 */
import type { Balance } from './balance';
import { isExhausted } from './resources';
import type { Attribute, Item, Player, StagePosition } from './types';
import { areaDef, type Archetype, type EnemyDef } from './world';

export interface FighterStats {
  maxHp: number;
  damage: number;
  attackInterval: number;
  critChance: number;
  critMultiplier: number;
}

export interface HeroStats extends FighterStats {
  /** attributes incl. equipment */
  attributes: Record<Attribute, number>;
  exhausted: boolean;
  /** Krit-Chance from equipment, percent points */
  critBonus: number;
}

export type StageKind = 'normal' | 'boss' | 'areaBoss';

export interface EnemyStats extends FighterStats {
  def: EnemyDef;
  kind: StageKind;
  timerSec: number;
  stageIndex: number;
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

/** Base attributes + bonuses of the equipped items */
export function effectiveAttributes(
  player: Pick<Player, 'attributes'>,
  equipped: ReadonlyArray<Pick<Item, 'stats'> | null | undefined>,
): Record<Attribute, number> {
  const out = { ...player.attributes };
  for (const item of equipped) {
    if (!item) continue;
    for (const k of ATTRIBUTE_KEYS) out[k] += item.stats[k] ?? 0;
  }
  return out;
}

const ATTRIBUTE_KEYS: Attribute[] = ['strength', 'speed', 'life'];

/** extra Krit-Chance of the equipped items in percent points (shields) */
export function gearCrit(equipped: ReadonlyArray<Pick<Item, 'stats'> | null | undefined>): number {
  return equipped.reduce((sum, item) => sum + (item?.stats.crit ?? 0), 0);
}

/** `critBonus` = extra Krit-Chance from equipment in percent points */
export function heroStatsFromAttributes(
  attrs: Record<Attribute, number>,
  exhausted: boolean,
  balance: Balance,
  critBonus = 0,
): HeroStats {
  const c = balance.combat;
  const damage = (c.baseDamage + c.damagePerStrength * attrs.strength) * (exhausted ? balance.vitality.exhaustedDamageMultiplier : 1);
  return {
    attributes: attrs,
    exhausted,
    critBonus,
    maxHp: Math.round(c.baseHp + c.hpPerLife * attrs.life),
    damage,
    attackInterval: Math.max(c.minAttackIntervalSec, c.baseAttackIntervalSec / (1 + c.speedFactorPerPoint * attrs.speed)),
    critChance: Math.min(c.maxCritChance, c.critChance + critBonus / 100),
    critMultiplier: c.critMultiplier,
  };
}

export function heroStats(
  player: Pick<Player, 'attributes' | 'vitality'>,
  equipped: ReadonlyArray<Pick<Item, 'stats'> | null | undefined>,
  balance: Balance,
): HeroStats {
  return heroStatsFromAttributes(
    effectiveAttributes(player, equipped),
    isExhausted(player as Player, balance),
    balance,
    gearCrit(equipped),
  );
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

export function stagesPerRound(balance: Balance): number {
  return balance.combat.stagesPerArea * balance.combat.areaCount;
}

/** 0-based index across areas and rounds */
export function stageIndex(pos: StagePosition, balance: Balance): number {
  return (pos.round - 1) * stagesPerRound(balance) + (pos.area - 1) * balance.combat.stagesPerArea + (pos.stage - 1);
}

export function positionFromIndex(index: number, balance: Balance): StagePosition {
  const per = stagesPerRound(balance);
  const round = Math.floor(index / per) + 1;
  const rest = index % per;
  return { round, area: Math.floor(rest / balance.combat.stagesPerArea) + 1, stage: (rest % balance.combat.stagesPerArea) + 1 };
}

export function nextStage(pos: StagePosition, balance: Balance): StagePosition {
  return positionFromIndex(stageIndex(pos, balance) + 1, balance);
}

export interface VictoryResult {
  player: Player;
  /** kind of the defeated enemy */
  kind: StageKind;
  /** area boss beaten → next area starts */
  areaCleared: boolean;
  /** dragon beaten → next round starts */
  roundCleared: boolean;
}

/** Hero beat the enemy of the current stage: advance and count it */
export function applyVictory(player: Player, balance: Balance): VictoryResult {
  const kind = stageKind(player.stage, balance);
  const next = nextStage(player, balance);
  const areaCleared = kind === 'areaBoss';
  const roundCleared = areaCleared && player.area === balance.combat.areaCount;
  const pr = player.progress;
  return {
    player: {
      ...player,
      round: next.round,
      area: next.area,
      stage: next.stage,
      progress: {
        enemiesDefeated: pr.enemiesDefeated + 1,
        bossesDefeated: pr.bossesDefeated + (kind === 'normal' ? 0 : 1),
        highestStageIndex: Math.max(pr.highestStageIndex, stageIndex(next, balance)),
        dragonsDefeated: pr.dragonsDefeated + (roundCleared ? 1 : 0),
      },
    },
    kind,
    areaCleared,
    roundCleared,
  };
}

export function stageKind(stage: number, balance: Balance): StageKind {
  if (stage === balance.combat.stagesPerArea) return 'areaBoss';
  if (stage % balance.combat.bossEveryNStages === 0) return 'boss';
  return 'normal';
}

export function enemyDefFor(pos: StagePosition, balance: Balance): EnemyDef {
  const area = areaDef(pos.area);
  const kind = stageKind(pos.stage, balance);
  if (kind === 'areaBoss') return area.boss;
  if (kind === 'boss') return area.midBosses[Math.min(1, pos.stage / balance.combat.bossEveryNStages - 1)];
  return area.enemies[(pos.stage - 1) % area.enemies.length];
}

/** Difficulty multipliers of a stage (1 / 1 at Straße 1) – see balance.enemies */
export function stageScale(pos: StagePosition, balance: Balance): { hp: number; damage: number } {
  const hp = areaScale(pos.area, virtualStage(pos.stage, balance), balance) * Math.pow(roundScale(balance), pos.round - 1);
  return { hp, damage: Math.pow(hp, balance.enemies.damageExponent) };
}

/**
 * Virtual position of a stage inside its area for the strength curve: normal enemies stage − 1,
 * a boss counts `bossStageBonus` (area boss `areaBossStageBonus`) stages further.
 */
export function virtualStage(stage: number, balance: Balance): number {
  const c = balance.combat;
  const kind = stageKind(stage, balance);
  return stage - 1 + (kind === 'areaBoss' ? c.areaBossStageBonus : kind === 'boss' ? c.bossStageBonus : 0);
}

/**
 * Strength (HP scale) inside round 1 at virtual position `v`: the area's anchors at stage 1, boss 10,
 * boss 20 and the area boss, growing evenly (geometrically) in between. Between boss 10 and boss 20 the
 * optional `bend` shapes the growth (< 1: the enemies after boss 10 get strong quickly, > 1: slowly);
 * `startBend` does the same between stage 1 and boss 10 (used for a gentle first fight).
 */
export function areaScale(area: number, v: number, balance: Balance): number {
  const areas = balance.enemies.areas;
  const a = areas[Math.min(areas.length, Math.max(1, area)) - 1];
  const c = balance.combat;
  const knots = [0, virtualStage(c.bossEveryNStages, balance), virtualStage(2 * c.bossEveryNStages, balance), virtualStage(c.stagesPerArea, balance)];
  const values = [a.stage1, a.boss10, a.boss20, a.areaBoss];
  let i = 0;
  while (i < knots.length - 2 && v > knots[i + 1]) i++;
  let t = (v - knots[i]) / (knots[i + 1] - knots[i]);
  if (i === 0 && a.startBend) t = Math.pow(Math.max(0, t), a.startBend);
  if (i === 1 && a.bend) t = Math.pow(Math.max(0, t), a.bend);
  return values[i] * Math.pow(values[i + 1] / values[i], t);
}

/** every further round starts where the dragon was (its 5th enemy is as strong as the dragon) */
function roundScale(balance: Balance): number {
  const c = balance.combat;
  return areaScale(c.areaCount, virtualStage(c.stagesPerArea, balance), balance) / areaScale(1, 4, balance);
}

export function enemyForStage(pos: StagePosition, balance: Balance): EnemyStats {
  const c = balance.combat;
  const en = balance.enemies;
  const index = stageIndex(pos, balance);
  const def = enemyDefFor(pos, balance);
  const kind = stageKind(pos.stage, balance);
  const arch = balance.archetypes[def.archetype as Archetype];
  const scale = stageScale(pos, balance);
  const hpMul = kind === 'areaBoss' ? c.areaBossHpMultiplier : kind === 'boss' ? c.bossHpMultiplier : 1;
  const dmgMul = kind === 'areaBoss' ? c.areaBossDamageMultiplier : kind === 'boss' ? c.bossDamageMultiplier : 1;
  return {
    def,
    kind,
    stageIndex: index,
    timerSec: kind === 'areaBoss' ? c.areaBossTimerSec : kind === 'boss' ? c.bossTimerSec : c.fightTimerSec,
    maxHp: Math.max(1, Math.round(en.baseHp * scale.hp * arch.hp * hpMul)),
    damage: en.baseDamage * scale.damage * arch.damage * dmgMul,
    attackInterval: en.baseAttackIntervalSec * arch.interval,
    critChance: 0,
    critMultiplier: 1,
  };
}

// ---------------------------------------------------------------------------
// Fight engine
// ---------------------------------------------------------------------------

export type Side = 'hero' | 'enemy';
export type FightResult = 'won' | 'lost' | 'timeout';

export interface FighterState {
  stats: FighterStats;
  hp: number;
  /** seconds until the next attack */
  cooldown: number;
}

export interface FightState {
  hero: FighterState;
  enemy: FighterState;
  elapsed: number;
  timeLimit: number;
  result: FightResult | null;
}

export type FightEvent =
  | { type: 'attack'; by: Side; damage: number; crit: boolean; targetHp: number; at: number }
  | { type: 'end'; result: FightResult; at: number };

export interface FightOptions {
  /** no randomness: crits count as expected value (used for "can I beat this?" estimates) */
  deterministic?: boolean;
}

export function startFight(hero: FighterStats, enemy: FighterStats, timeLimit: number, balance: Balance): FightState {
  return {
    hero: { stats: hero, hp: hero.maxHp, cooldown: balance.combat.heroFirstAttackSec },
    enemy: { stats: enemy, hp: enemy.maxHp, cooldown: balance.combat.enemyFirstAttackSec },
    elapsed: 0,
    timeLimit,
    result: null,
  };
}

function rollDamage(s: FighterStats, rng: () => number, balance: Balance, deterministic: boolean) {
  if (deterministic) {
    return { damage: Math.max(1, Math.round(s.damage * (1 + s.critChance * (s.critMultiplier - 1)))), crit: false };
  }
  const v = balance.combat.damageVariance;
  let dmg = s.damage * (1 - v + 2 * v * rng());
  const crit = s.critChance > 0 && rng() < s.critChance;
  if (crit) dmg *= s.critMultiplier;
  return { damage: Math.max(1, Math.round(dmg)), crit };
}

const EPS = 1e-9;

/**
 * Advances the fight by `dt` seconds (use Infinity to run it to the end).
 * Both sides attack on their own rhythm; on a tie the hero strikes first.
 */
export function stepFight(
  input: FightState,
  dt: number,
  rng: () => number,
  balance: Balance,
  opts: FightOptions = {},
): { state: FightState; events: FightEvent[] } {
  const s: FightState = { ...input, hero: { ...input.hero }, enemy: { ...input.enemy } };
  const events: FightEvent[] = [];
  const det = !!opts.deterministic;
  let remaining = dt;

  while (!s.result) {
    const toTimer = s.timeLimit - s.elapsed;
    const next = Math.min(s.hero.cooldown, s.enemy.cooldown);
    if (toTimer < next - EPS) {
      if (toTimer > remaining) {
        advance(s, remaining);
        break;
      }
      advance(s, toTimer);
      s.result = 'timeout';
      break;
    }
    if (next > remaining) {
      advance(s, remaining);
      break;
    }
    remaining -= next;
    advance(s, next);

    if (s.hero.cooldown <= EPS) {
      const hit = rollDamage(s.hero.stats, rng, balance, det);
      s.enemy.hp = Math.max(0, s.enemy.hp - hit.damage);
      s.hero.cooldown += s.hero.stats.attackInterval;
      events.push({ type: 'attack', by: 'hero', damage: hit.damage, crit: hit.crit, targetHp: s.enemy.hp, at: s.elapsed });
      if (s.enemy.hp <= 0) {
        s.result = 'won';
        break;
      }
    }
    if (s.enemy.cooldown <= EPS) {
      const hit = rollDamage(s.enemy.stats, rng, balance, det);
      s.hero.hp = Math.max(0, s.hero.hp - hit.damage);
      s.enemy.cooldown += s.enemy.stats.attackInterval;
      events.push({ type: 'attack', by: 'enemy', damage: hit.damage, crit: hit.crit, targetHp: s.hero.hp, at: s.elapsed });
      if (s.hero.hp <= 0) {
        s.result = 'lost';
        break;
      }
    }
  }
  if (s.result) events.push({ type: 'end', result: s.result, at: s.elapsed });
  return { state: s, events };
}

function advance(s: FightState, t: number) {
  s.elapsed += t;
  s.hero.cooldown -= t;
  s.enemy.cooldown -= t;
}

/** Runs a complete fight. Returns result and duration in seconds. */
export function runFight(
  hero: FighterStats,
  enemy: EnemyStats,
  rng: () => number,
  balance: Balance,
  opts: FightOptions = {},
): { result: FightResult; duration: number } {
  const { state } = stepFight(startFight(hero, enemy, enemy.timerSec, balance), Infinity, rng, balance, opts);
  return { result: state.result!, duration: state.elapsed };
}

/** Expected outcome without randomness */
export function canBeat(hero: FighterStats, enemy: EnemyStats, balance: Balance): boolean {
  return runFight(hero, enemy, () => 0.5, balance, { deterministic: true }).result === 'won';
}

/**
 * Hero's fighting power: the largest enemy scale (balanced type, Straße values of balance.enemies) the hero
 * beats without luck. Used by the simulation to spend attribute points like a sensible player.
 */
export function heroPower(hero: FighterStats, balance: Balance): number {
  const en = balance.enemies;
  const ref = enemyForStage({ round: 1, area: 1, stage: 1 }, balance);
  let lo = 0.01;
  let hi = 1e7;
  for (let i = 0; i < 40; i++) {
    const x = Math.sqrt(lo * hi);
    const enemy: EnemyStats = {
      ...ref,
      maxHp: Math.max(1, Math.round(en.baseHp * x)),
      damage: en.baseDamage * Math.pow(x, en.damageExponent),
      attackInterval: en.baseAttackIntervalSec,
      timerSec: balance.combat.fightTimerSec,
    };
    if (canBeat(hero, enemy, balance)) lo = x;
    else hi = x;
  }
  return lo;
}

/** First stage index (from 0) the hero cannot beat (deterministic estimate) */
export function wallIndex(hero: FighterStats, balance: Balance, maxIndex = stagesPerRound(balance) * 3): number {
  for (let i = 0; i < maxIndex; i++) {
    if (!canBeat(hero, enemyForStage(positionFromIndex(i, balance), balance), balance)) return i;
  }
  return maxIndex;
}
