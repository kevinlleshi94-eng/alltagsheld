/**
 * ALL game numbers live here. Tweak freely – nothing else in the code base
 * should contain balancing constants.
 *
 * Phase 1 uses: rewards, levels, vitality, penalties, death, app timers.
 * Combat / chests / streaks are prepared for later phases.
 */
export const BALANCE = {
  /**
   * Rewards (feedback v0.5: "alle Aufgaben gleich viel wert"). All dailies of a day together are worth
   * `dailyXp` / `dailyGold`; each daily gets an equal share (13 dailies → 15 XP + 8 Gold each). More tasks
   * therefore do not mean more XP. Task points no longer matter for rewards (only "−" habits use them).
   */
  rewards: {
    dailyXp: 200,
    dailyGold: 100,
    /** all "+" habits together are worth this share of the daily budget, split equally over them */
    habitPlusShare: 0.25,
    /** vitality healed by one "+" habit tap */
    habitPlusVitality: 2,
    /** every habit counts at most once per day (user feedback v0.5) */
    habitTapsPerDay: 1,
  },

  /** Habit "−" tap, per minus point */
  habitMinus: {
    vitalityLossPerPoint: 3,
    goldLossPerPoint: 5,
  },

  /**
   * XP needed to go from `level` to `level + 1` = min(xpMaxPerLevel, round(base × level^exponent)).
   * Tuned for the user's 65 % day (~150 XP): almost a level per day at the start, from level 8 on every
   * 3–4 days. See BALANCING.md.
   */
  levels: {
    xpBase: 80,
    xpExponent: 0.9,
    xpMaxPerLevel: 520,
    attributePointsPerLevel: 1,
  },

  vitality: {
    max: 100,
    /**
     * Day quota (done dailies / all dailies, counted by TASKS, feedback v0.5) → vitality at settlement:
     *   below `neutralFrom`: loss, linear from `lossAtZero` (0 %) to 0 (60 %), at least 1
     *   `neutralFrom`–`neutralTo`: ±0 (60–70 % is a normal day)
     *   above `neutralTo`: gain, linear up to `gainAtFull` at 100 %, at least 1
     * 30 % → −15, 0 % → −30: about a week of bad days until death.
     */
    quota: {
      neutralFrom: 0.6,
      neutralTo: 0.7,
      lossAtZero: 30,
      gainAtFull: 15,
    },
    /** 100 % of the dailies done → extra gold: this share of the full daily gold budget */
    perfectDayGoldShare: 0.3,
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
    /** base + Krit-Chance from shields is capped here */
    maxCritChance: 0.6,
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
    /**
     * All fights last at most 10 s (user feedback). Feedback v0.5: a boss is as strong as a normal enemy
     * `bossStageBonus` stages further: the enemies before it are easier, the boss holds the hero up for about
     * 2 days (area boss 2–3), and the 2–3 enemies after it are easy (boss chest). Measured in BALANCING.md;
     * the extra multipliers would only make boss fights longer.
     */
    bossStageBonus: 3,
    bossHpMultiplier: 1,
    bossDamageMultiplier: 1,
    bossTimerSec: 10,
    areaBossStageBonus: 4.5,
    areaBossHpMultiplier: 1,
    areaBossDamageMultiplier: 1,
    areaBossTimerSec: 10,
    failHintAfterAttempts: 3,
    /** scene timings (also used by the simulation) */
    walkInSec: 1.8,
    victorySec: 0.9,
    retreatSec: 1.4,
  },

  /**
   * Enemies (feedback v0.5, tuned with the simulation, see BALANCING.md). Per area the strength (multiplier on
   * baseHp; damage × strength^damageExponent) at four anchors: stage 1, boss 10, boss 20 and the area boss.
   * Normal enemies in between grow evenly; `bend` shapes the part between boss 10 and boss 20 (< 1: strong
   * soon after boss 10). A boss counts as `combat.bossStageBonus` (area boss `areaBossStageBonus`) stages further.
   * Each area starts a bit below the previous area boss; area 1 starts low (stage 1 is beatable without points)
   * and rises quickly (`startBend`). Round 2, 3 …: each round starts where the dragon was.
   * Fitted to the hero's growth at 65 % fulfilment (user profile): area bosses on day ~13, 32, 49, 69, 92, 117,
   * 143, 172 (dragon after ~5.7 months; 90 %: ~4.3 months).
   */
  enemies: {
    baseHp: 95,
    baseDamage: 13.7,
    baseAttackIntervalSec: 1,
    // Straße, Wald, Dunkler Wald, Sumpf, Wüste, Strand, Schnee, Vulkan
    areas: [
      { stage1: 0.7, boss10: 1.58, boss20: 3.03, areaBoss: 3.24, bend: 0.57, startBend: 0.45 },
      { stage1: 2.96, boss10: 4.07, boss20: 4.69, areaBoss: 5.49, bend: 0.72 },
      { stage1: 5.15, boss10: 6.28, boss20: 7.51, areaBoss: 8.39, bend: 1.29 },
      { stage1: 7.67, boss10: 9.55, boss20: 10.9, areaBoss: 12.4, bend: 0.56 },
      { stage1: 11.8, boss10: 14, boss20: 15.7, areaBoss: 17.4, bend: 0.54 },
      { stage1: 16.4, boss10: 19, boss20: 22.1, areaBoss: 24.8, bend: 1.22 },
      { stage1: 23.1, boss10: 28.5, boss20: 32.6, areaBoss: 36, bend: 1.19 },
      { stage1: 33.7, boss10: 39.7, boss20: 44.5, areaBoss: 48.9, bend: 1.6 },
    ] as { stage1: number; boss10: number; boss20: number; areaBoss: number; bend?: number; startBend?: number }[],
    damageExponent: 0.5,
  },

  /**
   * Enemy types: multipliers on HP, damage and attack interval (>1 = slower). Feedback v0.5: all types are about
   * equally hard (otherwise a single "tank" is a wall of several days); they differ in rhythm and in what they test
   * (tank → Stärke/Tempo, brute/caster → Leben).
   */
  archetypes: {
    balanced: { hp: 1, damage: 1, interval: 1 },
    swift: { hp: 1, damage: 0.64, interval: 0.65 },
    brute: { hp: 0.98, damage: 1.36, interval: 1.4 },
    tank: { hp: 1, damage: 1.2, interval: 1.3 },
    caster: { hp: 1, damage: 1.19, interval: 1.25 },
  },

  /** Equipment and chests. Prices ×2.5 after the feedback to Phase 4 (2–3 chests until the first boss) */
  items: {
    chests: {
      wood: { price: 250, odds: [70, 25, 5, 0, 0] },
      iron: { price: 1000, odds: [35, 40, 20, 4.5, 0.5] },
      gold: { price: 3750, odds: [10, 35, 40, 13, 2] },
    },
    /** common, uncommon, rare, epic, legendary */
    rarityFactors: [1, 1.35, 1.8, 2.4, 3.2],
    /** attribute points of a common level-1 item */
    basePoints: 1.5,
    /** +x per player level at purchase */
    levelFactor: 0.12,
    /** ± random spread */
    spread: 0.15,
    /**
     * Slot rules (user feedback Phase 4): weapon → Stärke (some also Tempo), helmet → only Tempo,
     * body → only Leben, shield → Leben + Krit-Chance.
     */
    weaponSpeedChance: 0.4,
    /** share of the budget that goes to Tempo on such a weapon */
    weaponSpeedShare: 0.3,
    /** share of a shield's budget that becomes Krit-Chance (rest = Leben) */
    shieldCritShare: 0.4,
    /** 1 budget point = this many percent points Krit-Chance */
    critPercentPerPoint: 2,
    /** epic/legendary: extra budget on the slot's own values (no foreign bonus any more) */
    highRarityBonus: 0.15,
    sellFraction: 0.25,
  },

  /**
   * Boss rewards: gold + a chest for every boss, only for the FIRST victory over that boss (after a death
   * the hero starts at the area start again and must not farm the same bosses). Feedback v0.5: the chest
   * is kept until the player picks the slot. Chest per area (round 1 = index 0–7, later rounds use the last row):
   * iron from the Wald area boss on, from area 3 also for Zwischenbosse; area bosses one chest better;
   * gold chests from the area boss of area 3 on. The dragon drops `dragonHoard` instead (4 best items).
   */
  bossRewards: {
    goldBoss: 60,
    goldAreaBoss: 150,
    /** × per area, counted over all rounds (Straße R1 = 0 … Vulkan R1 = 7, Straße R2 = 8) */
    goldGrowthPerArea: 1.3,
    chests: [
      { boss: 'wood', areaBoss: 'wood' },
      { boss: 'wood', areaBoss: 'iron' },
      { boss: 'iron', areaBoss: 'gold' },
      { boss: 'iron', areaBoss: 'gold' },
      { boss: 'iron', areaBoss: 'gold' },
      { boss: 'gold', areaBoss: 'gold' },
      { boss: 'gold', areaBoss: 'gold' },
      { boss: 'gold', areaBoss: 'gold' },
    ] as { boss: 'wood' | 'iron' | 'gold'; areaBoss: 'wood' | 'iron' | 'gold' }[],
    /** the dragon: one item per slot of this rarity with the best possible roll */
    dragonHoard: { rarity: 'legendary' as const },
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
