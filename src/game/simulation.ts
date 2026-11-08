/**
 * Balancing simulation (SPEC 11). Plays a task profile for N days with a given daily fulfilment
 * and uses the real game functions (rewards, settlement, death, combat engine, boss rewards).
 * Run via `npm run simulate`.
 *
 * Model:
 * - task profiles: "user" = the user's real volume (15 dailies with 25 points + 10 "+" habit taps, feedback Phase 4),
 *   "seed" = the 13 start tasks (22 points) + "Selbst gekocht"
 * - every daily task is done with probability `fulfillment` (independent per task and day),
 *   or exactly `missedPerDay` random dailies are missed each day
 * - habits: "+" habits are tapped once with probability `fulfillment`; "−" habits once with probability
 *   1 − fulfillment, or exactly `habitMinusPerDay` "−" taps per day
 * - level-up points are spent "optimally" (greedy: the attribute that pushes the wall furthest)
 * - shop ("plan", like a player would): first a wooden chest for every slot, then save for an iron chest
 *   per slot, then gold chests. Better items are equipped, worse ones sold for 25 %.
 *   ("greedy" = always buy the best affordable chest right away)
 * - bosses give gold and sometimes a chest on the first victory (bossRewards.ts)
 * - combat only while the app is open: `simulation.appSecondsPerDay` per day
 */
import type { Balance } from './balance';
import { winFight } from './bossRewards';
import { enemyForStage, gearCrit, heroStats, heroStatsFromAttributes, runFight, stageKind, wallIndex } from './combat';
import { addDays } from './dates';
import { CHESTS, SLOTS, generateItem, itemPower, sellPrice, type ChestId, type ItemStats } from './items';
import { allocateAttribute } from './progression';
import { seededRng } from './rng';
import { createInitialPlayer, createSeedTasks } from './seed';
import { settle } from './settlement';
import { checkDaily, emptyLog, tapHabit } from './taskActions';
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
  /** exact number of "−" habit taps per day (default: probability 1 − fulfillment per "−" habit) */
  habitMinusPerDay?: number;
  days: number;
  seed: number;
  balance: Balance;
  /** days after which a snapshot is recorded (1-based) */
  checkpoints: number[];
  /** default "user" */
  profile?: TaskProfile;
  /** default "plan" */
  shopPolicy?: ShopPolicy;
}

export interface SimResult {
  snapshots: SimSnapshot[];
  milestones: SimMilestone[];
  bought: Record<ChestId, number>;
  dropped: number;
  goldFromTasks: number;
  goldFromBosses: number;
}

const START = '2026-01-05';

/** the user's volume (feedback Phase 4): 15 dailies with 25 points, 10 "+" habits, 1 "−" habit */
export const USER_DAILY_POINTS = [3, 3, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1];
export const USER_PLUS_HABITS = 10;

function userTasks(now: number, newId: () => string): Task[] {
  const base = { plusPoints: 0, minusPoints: 0, archived: false, createdAt: now, archivedAt: null };
  const dailies: Task[] = USER_DAILY_POINTS.map((points, i) => ({
    ...base,
    id: newId(),
    type: 'daily',
    title: `Aufgabe ${i + 1}`,
    points,
    order: i,
  }));
  const habits: Task[] = Array.from({ length: USER_PLUS_HABITS }, (_, i) => ({
    ...base,
    id: newId(),
    type: 'habit',
    title: `Gewohnheit ${i + 1}`,
    points: 0,
    plusPoints: 1,
    order: i,
  }));
  habits.push({ ...base, id: newId(), type: 'habit', title: 'Fertigessen', points: 0, minusPoints: 1, order: USER_PLUS_HABITS });
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
  const dragonIndex = balance.combat.stagesPerArea * balance.combat.areaCount;
  const snapshots: SimSnapshot[] = [];
  const milestones: SimMilestone[] = [];

  const breakItems = (ids: string[]) => ids.forEach((id) => items.delete(id));
  const power = (stats: ItemStats | undefined) => itemPower(stats, balance);

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
        const score = wallIndex(s, balance, dragonIndex * 2) * 1e6 + s.maxHp * dps;
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

  const fightDay = (day: number, now: number) => {
    const c = balance.combat;
    let time = 0;
    while (time < balance.simulation.appSecondsPerDay) {
      const enemy = enemyForStage(player, balance);
      const hero = heroStats(player, equipped(), balance);
      const r = runFight(hero, enemy, rng, balance);
      time += c.walkInSec + r.duration + (r.result === 'won' ? c.victorySec : c.retreatSec);
      if (r.result === 'won') {
        fightsWon += 1;
        const pos = { round: player.round, area: player.area, stage: player.stage };
        const v = winFight(player, ctx(now), newId);
        player = v.player;
        if (v.reward) {
          goldFromBosses += v.reward.gold;
          if (v.reward.drop) {
            dropped += 1;
            const it = v.reward.drop.item;
            takeItem({ id: it.id, slot: it.slot, chest: v.reward.drop.chest, stats: it.stats });
          }
          if (pos.round === 1 && stageKind(pos.stage, balance) !== 'normal')
            milestones.push({ area: pos.area, stage: pos.stage, day, level: player.level, chests: chestCount() });
        }
        if (dragonDay === null && v.roundCleared) dragonDay = day;
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
      const r = checkDaily(player, task, emptyLog(date, task), ctx(now));
      player = r.player;
      breakItems(r.brokenItemIds);
      logs.push(r.log);
    }
    const habitLogs = new Map<string, DayLog>();
    const tap = (task: Task, kind: 'plus' | 'minus') => {
      const r = tapHabit(player, task, kind, habitLogs.get(task.id) ?? emptyLog(date, task), ctx(now));
      player = r.player;
      breakItems(r.brokenItemIds);
      habitLogs.set(task.id, r.log);
    };
    for (const h of plusHabits) if (rng() < cfg.fulfillment) tap(h, 'plus');
    if (minusHabits.length > 0) {
      if (cfg.habitMinusPerDay !== undefined) {
        for (let i = 0; i < cfg.habitMinusPerDay; i++) tap(minusHabits[i % minusHabits.length], 'minus');
      } else {
        for (const h of minusHabits) if (rng() >= cfg.fulfillment) tap(h, 'minus');
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
  return { snapshots, milestones, bought, dropped, goldFromTasks, goldFromBosses };
}

/** Median helper for the report */
export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
