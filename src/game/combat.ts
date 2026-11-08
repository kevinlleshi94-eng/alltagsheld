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
  const en = balance.enemies;
  const a = (pos.round - 1) * balance.combat.areaCount + (pos.area - 1);
  const s = pos.stage - 1;
  return {
    hp: (1 + en.areaHpGrowthLinear * a) * Math.pow(1 + en.areaHpGrowthExponential, a) * (1 + en.stageHpGrowth * s),
    damage:
      (1 + en.areaDamageGrowthLinear * a) * Math.pow(1 + en.areaDamageGrowthExponential, a) * (1 + en.stageDamageGrowth * s),
  };
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

/** First stage index (from 0) the hero cannot beat (deterministic estimate) */
export function wallIndex(hero: FighterStats, balance: Balance, maxIndex = stagesPerRound(balance) * 3): number {
  for (let i = 0; i < maxIndex; i++) {
    if (!canBeat(hero, enemyForStage(positionFromIndex(i, balance), balance), balance)) return i;
  }
  return maxIndex;
}
