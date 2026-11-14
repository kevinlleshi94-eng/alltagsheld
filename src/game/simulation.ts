/**
 * Balancing simulation (SPEC 11). Plays a task profile for N days with a given daily fulfilment
 * and uses the real game functions (rewards, settlement, death, combat engine, boss rewards).
 * Run via `npm run simulate`.
 *
 * Model:
 * - task profiles: "user" = the user's real tasks from the backup (feedback v0.5): 13 dailies, 4 "+" habits,
 *   3 "−" habits; "seed" = the 13 start tasks + "Selbst gekocht" + "Fertigessen bestellt"
 * - every daily task is done with probability `fulfillment` (independent per task and day),
 *   or exactly `missedPerDay` random dailies are missed each day
 * - habits (each at most once a day): every "+" habit with probability `habitPlusChance` (default 0.6 →
 *   ~2.4 a day), every "−" habit with probability `habitMinusChance` (default 0.3 → ~0.9 a day; user: 3–4 of 7 a day),
 *   or exactly `habitMinusPerDay` different "−" habits
 * - level-up points are spent "optimally" (greedy: the attribute that pushes the wall furthest)
 * - shop ("plan", like a player would): first a wooden chest for every slot, then save for an iron chest
 *   per slot, then gold chests. Better items are equipped, worse ones sold for 25 %.
 *   ("greedy" = always buy the best affordable chest right away)
 * - bosses give gold and a chest on the first victory (bossRewards.ts); the chest is opened right away for the
 *   weakest slot, the dragon's hoard is equipped
 * - combat only while the app is open: `simulation.appSecondsPerDay` per day
 */
import type { Balance } from './balance';
import { openPendingChest, winFight } from './bossRewards';
import {
  enemyForStage,
  gearCrit,
  heroStats,
  heroPower,
  heroStatsFromAttributes,
  runFight,
  stageIndex,
  stageKind,
  type HeroStats,
} from './combat';
import { addDays } from './dates';
import { CHESTS, SLOTS, generateItem, itemPower, sellPrice, type ChestId, type ItemStats } from './items';
import { allocateAttribute } from './progression';
import { seededRng } from './rng';
import { createInitialPlayer, createSeedTasks } from './seed';
import { settle } from './settlement';
import { checkDaily, emptyLog, tapHabit, taskCountsOn } from './taskActions';
import type { Attribute, DayLog, LogicContext, Player, Slot, Task } from './types';

export interface SimItem {
  id: string;
  slot: Slot;
  chest: ChestId;
  stats: ItemStats;
}

export interface SimSnapshot {
  day: number;
  level: number;
  round: number;
  area: number;
  stage: number;
  /** highest stage index reached so far (0 = Straße 1) */
  highestIndex: number;
  deaths: number;
  gold: number;
  attributes: Record<Attribute, number>;
  itemPower: number;
  vitality: number;
  exhaustedDays: number;
  fightsWon: number;
  fightsLost: number;
  /** chests bought + dropped by bosses so far */
  chests: number;
  /** first day on which the dragon (end of round 1) was beaten, or null */
  dragonDay: number | null;
}

/** first victory over a boss of round 1 */
export interface SimMilestone {
  area: number;
  stage: number;
  day: number;
  level: number;
  /** chests bought + dropped up to that moment */
  chests: number;
}

export type TaskProfile = 'user' | 'seed';
export type ShopPolicy = 'plan' | 'greedy';

export interface SimConfig {
  fulfillment: number;
  /** exact number of dailies missed per day (overrides `fulfillment` for dailies) */
  missedPerDay?: number;
  /** exact number of "−" habits tapped per day (overrides `habitMinusChance`) */
  habitMinusPerDay?: number;
  /** chance per "+" habit and day (default 0.6) */
  habitPlusChance?: number;
  /** chance per "−" habit and day (default 0.3) */
  habitMinusChance?: number;
  days: number;
  seed: number;
  balance: Balance;
  /** days after which a snapshot is recorded (1-based) */
  checkpoints: number[];
  /** default "user" */
  profile?: TaskProfile;
  /** default "plan" */
  shopPolicy?: ShopPolicy;
  /**
   * Tuning aid: instead of fighting, the hero wins every stage up to this stage index on the given day (1-based),
   * bosses give their rewards as usual. Measures the hero's growth along the intended pace (BALANCING.md).
   */
  followSchedule?: (day: number) => number;
}

export interface SimResult {
  snapshots: SimSnapshot[];
  /** highest stage index and level at the end of every day (index 0 = day 1) */
  days: { highestIndex: number; level: number; deaths: number; hero: HeroStats }[];
  milestones: SimMilestone[];
  bought: Record<ChestId, number>;
  dropped: number;
  goldFromTasks: number;
  goldFromBosses: number;
}

const START = '2026-01-05';

/** the user's real tasks (backup of 14.11.2026): 13 dailies, 4 "+" habits, 3 "−" habits with 1 point */
export const USER_DAILIES = 13;
export const USER_PLUS_HABITS = 4;
export const USER_MINUS_HABITS = 3;

function userTasks(now: number, newId: () => string): Task[] {
  const base = { points: 1, plusPoints: 0, minusPoints: 0, archived: false, createdAt: now, archivedAt: null };
  const dailies: Task[] = Array.from({ length: USER_DAILIES }, (_, i) => ({
    ...base,
    id: newId(),
    type: 'daily',
    title: `Aufgabe ${i + 1}`,
    order: i,
  }));
  const habits: Task[] = [
    ...Array.from({ length: USER_PLUS_HABITS }, (_, i): Task => ({
      ...base,
      id: newId(),
      type: 'habit',
      title: `Gute Gewohnheit ${i + 1}`,
      points: 0,
      plusPoints: 1,
      order: i,
    })),
    ...Array.from({ length: USER_MINUS_HABITS }, (_, i): Task => ({
      ...base,
      id: newId(),
      type: 'habit',
      title: `Schlechte Gewohnheit ${i + 1}`,
      points: 0,
      minusPoints: 1,
      order: USER_PLUS_HABITS + i,
    })),
  ];
  return [...dailies, ...habits];
}

function noonOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getTime();
}

export function simulate(cfg: SimConfig): SimSnapshot[] {
  return simulateDetailed(cfg).snapshots;
}

export function simulateDetailed(cfg: SimConfig): SimResult {
  const { balance } = cfg;
  const rng = seededRng(cfg.seed);
  let idc = 0;
  const newId = () => `s${++idc}`;
  const created = noonOf(START) - 3600_000;
  const tasks = (cfg.profile ?? 'user') === 'user' ? userTasks(created, newId) : createSeedTasks(created, newId);
  const counts = taskCountsOn(tasks, START);
  const plusChance = cfg.habitPlusChance ?? 0.6;
  const minusChance = cfg.habitMinusChance ?? 0.3;
  const dailies = tasks.filter((t) => t.type === 'daily');
  const plusHabits = tasks.filter((t) => t.type === 'habit' && t.plusPoints > 0);
  const minusHabits = tasks.filter((t) => t.type === 'habit' && t.minusPoints > 0);
  let player: Player = createInitialPlayer(noonOf(START), START, balance);
  const items = new Map<string, SimItem>();
  const equipped = () => SLOTS.map((s) => (player.equipped[s] ? items.get(player.equipped[s]!) : undefined));
  const ctx = (now: number): LogicContext => ({ balance, now, rng });
  const policy = cfg.shopPolicy ?? 'plan';
  const tier: Record<ChestId, number> = { wood: 0, iron: 1, gold: 2 };

  let exhaustedDays = 0;
  let fightsWon = 0;
  let fightsLost = 0;
  let dragonDay: number | null = null;
  const bought: Record<ChestId, number> = { wood: 0, iron: 0, gold: 0 };
  let dropped = 0;
  let goldFromTasks = 0;
  let goldFromBosses = 0;
  const chestCount = () => bought.wood + bought.iron + bought.gold + dropped;
  const snapshots: SimSnapshot[] = [];
  const milestones: SimMilestone[] = [];
  const dayStats: SimResult['days'] = [];

  const breakItems = (ids: string[]) => ids.forEach((id) => items.delete(id));
  const power = (stats: ItemStats | undefined) => itemPower(stats, balance);

  /** a sensible player: the point goes where the fighting power grows most (preview in the Charakter tab) */
  const spendPoints = () => {
    while (player.unspentPoints > 0) {
      let best: Attribute = 'strength';
      let bestScore = -Infinity;
      const crit = gearCrit(equipped());
      for (const a of ['strength', 'speed', 'life'] as Attribute[]) {
        const attrs = { ...heroStats(player, equipped(), balance).attributes };
        attrs[a] += 1;
        const s = heroStatsFromAttributes(attrs, false, balance, crit);
        const dps = (s.damage * (1 + s.critChance * (s.critMultiplier - 1))) / s.attackInterval;
        const score = heroPower(s, balance) * 1e6 + s.maxHp * dps;
        if (score > bestScore) {
          bestScore = score;
          best = a;
        }
      }
      player = allocateAttribute(player, best);
    }
  };

  const slotPower = (slot: Slot) => {
    const id = player.equipped[slot];
    return id ? power(items.get(id)?.stats) : -1;
  };
  const slotTier = (slot: Slot) => {
    const id = player.equipped[slot];
    const it = id ? items.get(id) : undefined;
    return it ? tier[it.chest] : -1;
  };

  /** new item: equip if better (sell the old one), otherwise sell it */
  const takeItem = (item: SimItem) => {
    const current = player.equipped[item.slot] ? items.get(player.equipped[item.slot]!) : undefined;
    if (!current || power(item.stats) > power(current.stats)) {
      items.set(item.id, item);
      player = { ...player, equipped: { ...player.equipped, [item.slot]: item.id } };
      if (current) {
        items.delete(current.id);
        player = { ...player, gold: player.gold + sellPrice(current.chest, balance) };
      }
    } else {
      player = { ...player, gold: player.gold + sellPrice(item.chest, balance) };
    }
  };

  const shop = (now: number) => {
    for (;;) {
      let chest: ChestId | undefined;
      let slot: Slot;
      if (policy === 'greedy') {
        chest = [...CHESTS].reverse().find((c) => player.gold >= balance.items.chests[c].price);
        slot = [...SLOTS].sort((a, b) => slotPower(a) - slotPower(b))[0];
      } else {
        const minTier = Math.min(...SLOTS.map(slotTier));
        const target: ChestId = minTier < 0 ? 'wood' : minTier < 1 ? 'iron' : 'gold';
        slot = [...SLOTS].sort((a, b) => slotTier(a) - slotTier(b) || slotPower(a) - slotPower(b))[0];
        if (player.gold >= balance.items.chests[target].price) chest = target;
      }
      if (!chest) return;
      player = { ...player, gold: player.gold - balance.items.chests[chest].price };
      bought[chest] += 1;
      const item = generateItem(slot, chest, player.level, rng, balance, newId(), now);
      takeItem({ id: item.id, slot, chest, stats: item.stats });
    }
  };

  const win = (day: number, now: number) => {
    const pos = { round: player.round, area: player.area, stage: player.stage };
    const v = winFight(player, ctx(now), newId);
    player = v.player;
    if (v.reward) {
      goldFromBosses += v.reward.gold;
      if (v.reward.chest) {
        // the player opens the boss chest right away for the weakest slot
        dropped += 1;
        const slot = [...SLOTS].sort((a, b) => slotTier(a) - slotTier(b) || slotPower(a) - slotPower(b))[0];
        const opened = openPendingChest(player, v.reward.chest.id, slot, ctx(now), newId())!;
        player = opened.player;
        takeItem({ id: opened.item.id, slot, chest: opened.chest, stats: opened.item.stats });
      }
      for (const it of v.reward.hoard) takeItem({ id: it.id, slot: it.slot, chest: 'gold', stats: it.stats });
      if (pos.round === 1 && stageKind(pos.stage, balance) !== 'normal')
        milestones.push({ area: pos.area, stage: pos.stage, day, level: player.level, chests: chestCount() });
    }
    if (dragonDay === null && v.roundCleared) dragonDay = day;
  };

  const fightDay = (day: number, now: number) => {
    if (cfg.followSchedule) {
      const target = cfg.followSchedule(day);
      while (stageIndex(player, balance) < target) win(day, now);
      return;
    }
    const c = balance.combat;
    let time = 0;
    while (time < balance.simulation.appSecondsPerDay) {
      const enemy = enemyForStage(player, balance);
      const hero = heroStats(player, equipped(), balance);
      const r = runFight(hero, enemy, rng, balance);
      time += c.walkInSec + r.duration + (r.result === 'won' ? c.victorySec : c.retreatSec);
      if (r.result === 'won') {
        fightsWon += 1;
        win(day, now);
      } else {
        fightsLost += 1;
      }
    }
  };

  for (let d = 0; d < cfg.days; d++) {
    const date = addDays(START, d);
    const now = noonOf(date);
    const goldBefore = player.gold;
    // 1. the day's tasks
    const logs: DayLog[] = [];
    let missed: Set<string> | null = null;
    if (cfg.missedPerDay !== undefined) {
      const pool = dailies.map((t) => t.id);
      missed = new Set();
      while (missed.size < Math.min(cfg.missedPerDay, pool.length)) missed.add(pool[Math.floor(rng() * pool.length)]);
    }
    for (const task of dailies) {
      const done = missed ? !missed.has(task.id) : rng() < cfg.fulfillment;
      if (!done) continue;
      const r = checkDaily(player, task, emptyLog(date, task), counts, ctx(now));
      player = r.player;
      breakItems(r.brokenItemIds);
      logs.push(r.log);
    }
    const habitLogs = new Map<string, DayLog>();
    const tap = (task: Task, kind: 'plus' | 'minus') => {
      const r = tapHabit(player, task, kind, habitLogs.get(task.id) ?? emptyLog(date, task), counts, ctx(now));
      player = r.player;
      breakItems(r.brokenItemIds);
      habitLogs.set(task.id, r.log);
    };
    for (const h of plusHabits) if (rng() < plusChance) tap(h, 'plus');
    if (minusHabits.length > 0) {
      if (cfg.habitMinusPerDay !== undefined) {
        for (let i = 0; i < Math.min(cfg.habitMinusPerDay, minusHabits.length); i++) tap(minusHabits[i], 'minus');
      } else {
        for (const h of minusHabits) if (rng() < minusChance) tap(h, 'minus');
      }
    }
    logs.push(...habitLogs.values());
    goldFromTasks += Math.max(0, player.gold - goldBefore);
    // 2. level-ups, shopping, combat (while the app is open), shopping again (boss gold)
    spendPoints();
    shop(now);
    if (player.vitality < balance.vitality.max * balance.vitality.exhaustedThreshold) exhaustedDays += 1;
    fightDay(d + 1, now);
    shop(now);
    // 3. midnight: settlement (penalties, maybe death)
    const res = settle({ player, tasks, logs, today: addDays(date, 1), review: null }, ctx(now + 12 * 3600_000));
    player = res.player;
    breakItems(res.brokenItemIds);
    spendPoints();
    dayStats.push({
      highestIndex: player.progress.highestStageIndex,
      level: player.level,
      deaths: player.deaths,
      hero: heroStats(player, equipped(), balance),
    });

    if (cfg.checkpoints.includes(d + 1)) {
      snapshots.push({
        day: d + 1,
        level: player.level,
        round: player.round,
        area: player.area,
        stage: player.stage,
        highestIndex: player.progress.highestStageIndex,
        deaths: player.deaths,
        gold: player.gold,
        attributes: { ...player.attributes },
        itemPower: equipped().reduce((s, i) => s + power(i?.stats), 0),
        vitality: player.vitality,
        exhaustedDays,
        fightsWon,
        fightsLost,
        chests: chestCount(),
        dragonDay,
      });
    }
  }
  return { snapshots, days: dayStats, milestones, bought, dropped, goldFromTasks, goldFromBosses };
}

/** Median helper for the report */
export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
