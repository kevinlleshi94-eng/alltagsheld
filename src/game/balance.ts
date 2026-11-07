/**
 * ALL game numbers live here. Tweak freely – nothing else in the code base
 * should contain balancing constants.
 *
 * Phase 1 uses: rewards, levels, vitality, penalties, death, app timers.
 * Combat / chests / streaks are prepared for later phases.
 */
export const BALANCE = {
  /** Reward per task point (daily checked or habit "+") */
  rewards: {
    xpPerPoint: 10,
    goldPerPoint: 5,
    vitalityHealPerPoint: 1,
  },

  /** Habit "−" tap, per minus point */
  habitMinus: {
    vitalityLossPerPoint: 3,
    goldLossPerPoint: 5,
  },

  /**
   * XP needed to go from `level` to `level + 1` = min(xpMaxPerLevel, round(base × level^exponent)).
   * A perfect day gives 220 XP: level 3 on day 1, then level-ups every 2–3 days,
   * from level 8 on about every 4–5 days (cap).
   */
  levels: {
    xpBase: 50,
    xpExponent: 1.5,
    xpMaxPerLevel: 1000,
    attributePointsPerLevel: 1,
  },

  vitality: {
    max: 100,
    /**
     * Vitality loss per point of a daily task that was NOT done at settlement.
     * SPEC said 3; lowered to 1.5 after the Phase 2 feedback (5 missed tasks a day
     * should mean ~8 deaths per half year, see BALANCING.md). Fractions are
     * rounded per day, so vitality stays a whole number.
     */
    missedDailyLossPerPoint: 1.5,
    /** Below this fraction of max vitality the hero is "erschöpft" */
    exhaustedThreshold: 0.3,
    /** Damage multiplier while exhausted (used in combat, Phase 2) */
    exhaustedDamageMultiplier: 0.75,
  },

  /** Consequences of death – each can be switched off individually */
  death: {
    loseLevel: true,
    loseGold: true,
    breakRandomEquippedItem: true,
    resetToAreaStart: true,
    /** Vitality after death, as fraction of max */
    vitalityAfterDeath: 1,
    /** Max deaths per settlement run (spec: 1) */
    maxDeathsPerSettlement: 1,
  },

  /** App flow timers */
  app: {
    /**
     * The "Heute" prompt re-appears after returning from background only if the
     * app was hidden at least this long (avoids popping up on quick app switches).
     */
    todayPromptMinHiddenMs: 5 * 60 * 1000,
    /** How often the app checks for midnight while open */
    dayChangeCheckIntervalMs: 30 * 1000,
    /** Backup reminder after this many days (Phase 5) */
    backupReminderDays: 14,
  },

  /**
   * Hero combat values. Equipment bonuses count as additional attribute points
   * (e.g. a sword with +3 Stärke adds 3 × damagePerStrength).
   */
  combat: {
    baseHp: 100,
    hpPerLife: 15,
    baseDamage: 10,
    damagePerStrength: 3,
    baseAttackIntervalSec: 1.2,
    speedFactorPerPoint: 0.06,
    minAttackIntervalSec: 0.25,
    critChance: 0.1,
    critMultiplier: 1.5,
    /** random spread of every hit (±) */
    damageVariance: 0.1,
    /** time until the first strike after contact */
    heroFirstAttackSec: 0.35,
    enemyFirstAttackSec: 0.6,
    stagesPerArea: 25,
    areaCount: 8,
    fightTimerSec: 10,
    bossEveryNStages: 10,
    /** all fights last at most 10 s (user feedback) – boss HP multipliers are tuned for that */
    bossHpMultiplier: 2,
    bossDamageMultiplier: 1.5,
    bossTimerSec: 10,
    areaBossHpMultiplier: 3,
    areaBossDamageMultiplier: 1.5,
    areaBossTimerSec: 10,
    failHintAfterAttempts: 3,
    /** scene timings (also used by the simulation) */
    walkInSec: 1.8,
    victorySec: 0.9,
    retreatSec: 1.4,
  },

  /**
   * Enemy base values (Straße, Stufe 1) and growth ("sawtooth"):
   *   scale = areaScale × (1 + stageGrowth × (stage − 1))
   *   areaScale = (1 + areaGrowthLinear × a) × (1 + areaGrowthExponential)^a
   * a = area index across rounds (Straße R1 = 0, Vulkan R1 = 7, Straße R2 = 8 …).
   * Each new area starts easier than the previous boss, the wall forms inside the area.
   * Start (feedback iPhone test): a new hero gets to stage 9, the boss at stage 10 stops him;
   * 1 point rarely, 2 points reliably beat it. Higher base HP, flatter area growth → late game unchanged.
   */
  enemies: {
    baseHp: 56,
    baseDamage: 6,
    baseAttackIntervalSec: 1.5,
    stageHpGrowth: 0.04,
    stageDamageGrowth: 0.04,
    areaHpGrowthLinear: 0,
    areaHpGrowthExponential: 0.36,
    areaDamageGrowthLinear: 0,
    areaDamageGrowthExponential: 0.12,
  },

  /** Enemy types: multipliers on HP, damage and attack interval (>1 = slower) */
  archetypes: {
    balanced: { hp: 1, damage: 1, interval: 1 },
    swift: { hp: 0.85, damage: 0.75, interval: 0.65 },
    brute: { hp: 1.1, damage: 1.5, interval: 1.4 },
    tank: { hp: 1.3, damage: 1.1, interval: 1.5 },
    caster: { hp: 0.8, damage: 1.6, interval: 1.25 },
  },

  /** Equipment (stats used in combat now, shop UI in Phase 4) */
  items: {
    chests: {
      wood: { price: 100, odds: [70, 25, 5, 0, 0] },
      iron: { price: 400, odds: [35, 40, 20, 4.5, 0.5] },
      gold: { price: 1500, odds: [10, 35, 40, 13, 2] },
    },
    /** common, uncommon, rare, epic, legendary */
    rarityFactors: [1, 1.5, 2.2, 3.2, 5],
    /** attribute points of a common level-1 item */
    basePoints: 1.5,
    /** +x per player level at purchase */
    levelFactor: 0.12,
    /** ± random spread */
    spread: 0.15,
    /** chance that a helmet also gives Angriffsgeschwindigkeit */
    headSpeedChance: 0.35,
    /** epic/legendary second bonus as fraction of the main budget */
    secondBonusFraction: 0.5,
    sellFraction: 0.25,
  },

  /** Balancing simulation (npm run simulate) */
  simulation: {
    /** how long the app is open per day (combat only runs while open) */
    appSecondsPerDay: 300,
    seeds: 7,
  },
};

export type Balance = typeof BALANCE;

/** Partial overrides per section, e.g. for tests */
export type BalanceOverrides = {
  [K in keyof Balance]?: Partial<Balance[K]>;
};

export function withBalance(overrides: BalanceOverrides): Balance {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(BALANCE) as (keyof Balance)[]) {
    out[key] = { ...BALANCE[key], ...(overrides[key] ?? {}) };
  }
  return out as Balance;
}
