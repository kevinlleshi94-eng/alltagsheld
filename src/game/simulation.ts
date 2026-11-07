/**
 * Balancing simulation (SPEC 11). Plays the start tasks for N days with a given
 * daily fulfilment and uses the real game functions (rewards, settlement, death,
 * combat engine). Run via `npm run simulate`.
 *
 * Model:
 * - every daily task is done with probability `fulfillment` (independent per task and day),
 *   or exactly `missedPerDay` random dailies are missed each day
 * - habits: "+" habits are tapped once with probability `fulfillment`; "−" habits once with probability
 *   1 − fulfillment, or exactly `habitMinusPerDay` "−" taps per day
 * - level-up points are spent "optimally" (greedy: the attribute that pushes the wall furthest)
 * - shop: whenever gold ≥ cheapest chest, buy the best affordable chest for the weakest slot;
 *   equip if better, sell the worse item for 25 %
 * - combat only while the app is open: `simulation.appSecondsPerDay` per day
 */
import type { Balance } from './balance';
import { addDays } from './dates';
import {
  applyVictory,
  enemyForStage,
  heroStats,
  heroStatsFromAttributes,
  runFight,
  wallIndex,
} from './combat';
import { CHESTS, SLOTS, itemPower, rollItemStats, rollRarity, sellPrice, type ChestId, type ItemStats } from './items';
import { allocateAttribute } from './progression';
import { seededRng } from './rng';
import { createInitialPlayer, createSeedTasks } from './seed';
import { settle } from './settlement';
import { checkDaily, emptyLog, tapHabit } from './taskActions';
import type { Attribute, DayLog, LogicContext, Player, Slot } from './types';

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
  /** first day on which the dragon (end of round 1) was beaten, or null */
  dragonDay: number | null;
}

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
}

const START = '2026-01-05';

function noonOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getTime();
}

export function simulate(cfg: SimConfig): SimSnapshot[] {
  const { balance } = cfg;
  const rng = seededRng(cfg.seed);
  let idc = 0;
  const newId = () => `s${++idc}`;
  const tasks = createSeedTasks(noonOf(START) - 3600_000, newId);
  const dailies = tasks.filter((t) => t.type === 'daily');
  const plusHabits = tasks.filter((t) => t.type === 'habit' && t.plusPoints > 0);
  const minusHabits = tasks.filter((t) => t.type === 'habit' && t.minusPoints > 0);
  let player: Player = createInitialPlayer(noonOf(START), START, balance);
  const items = new Map<string, SimItem>();
  const equipped = () => SLOTS.map((s) => (player.equipped[s] ? items.get(player.equipped[s]!) : undefined));
  const ctx = (now: number): LogicContext => ({ balance, now, rng });

  let exhaustedDays = 0;
  let fightsWon = 0;
  let fightsLost = 0;
  let dragonDay: number | null = null;
  const dragonIndex = balance.combat.stagesPerArea * balance.combat.areaCount;
  const snapshots: SimSnapshot[] = [];

  const breakItems = (ids: string[]) => ids.forEach((id) => items.delete(id));

  const spendPoints = () => {
    while (player.unspentPoints > 0) {
      let best: Attribute = 'strength';
      let bestScore = -Infinity;
      for (const a of ['strength', 'speed', 'life'] as Attribute[]) {
        const attrs = { ...heroStats(player, equipped(), balance).attributes };
        attrs[a] += 1;
        const s = heroStatsFromAttributes(attrs, false, balance);
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

  const shop = () => {
    const prices = CHESTS.map((c) => balance.items.chests[c].price);
    while (player.gold >= Math.min(...prices)) {
      const chest = [...CHESTS].reverse().find((c) => player.gold >= balance.items.chests[c].price)!;
      const slot = [...SLOTS].sort((a, b) => slotPower(a) - slotPower(b))[0];
      player = { ...player, gold: player.gold - balance.items.chests[chest].price };
      const rarity = rollRarity(chest, rng, balance);
      const item: SimItem = { id: newId(), slot, chest, stats: rollItemStats(slot, rarity, player.level, rng, balance) };
      const current = player.equipped[slot] ? items.get(player.equipped[slot]!) : undefined;
      if (!current || itemPower(item.stats) > itemPower(current.stats)) {
        items.set(item.id, item);
        player = { ...player, equipped: { ...player.equipped, [slot]: item.id } };
        if (current) {
          items.delete(current.id);
          player = { ...player, gold: player.gold + sellPrice(current.chest, balance) };
        }
      } else {
        player = { ...player, gold: player.gold + sellPrice(chest, balance) };
      }
    }
  };
  const slotPower = (slot: Slot) => {
    const id = player.equipped[slot];
    return id ? itemPower(items.get(id)?.stats) : -1;
  };

  const fightDay = (day: number) => {
    const c = balance.combat;
    let time = 0;
    while (time < balance.simulation.appSecondsPerDay) {
      const enemy = enemyForStage(player, balance);
      const hero = heroStats(player, equipped(), balance);
      const r = runFight(hero, enemy, rng, balance);
      time += c.walkInSec + r.duration + (r.result === 'won' ? c.victorySec : c.retreatSec);
      if (r.result === 'won') {
        fightsWon += 1;
        const v = applyVictory(player, balance);
        player = v.player;
        if (dragonDay === null && v.roundCleared) dragonDay = day;
      } else {
        fightsLost += 1;
      }
    }
  };

  for (let d = 0; d < cfg.days; d++) {
    const date = addDays(START, d);
    const now = noonOf(date);
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
    const tap = (task: (typeof tasks)[number], kind: 'plus' | 'minus') => {
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
    // 2. level-ups, shopping, combat (while the app is open)
    spendPoints();
    shop();
    if (player.vitality < balance.vitality.max * balance.vitality.exhaustedThreshold) exhaustedDays += 1;
    fightDay(d + 1);
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
        itemPower: equipped().reduce((s, i) => s + itemPower(i?.stats), 0),
        vitality: player.vitality,
        exhaustedDays,
        fightsWon,
        fightsLost,
        dragonDay,
      });
    }
  }
  return snapshots;
}

/** Median helper for the report */
export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
