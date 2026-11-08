/**
 * Persistence layer: loads state from IndexedDB, runs the pure game logic,
 * writes results back – each action in one transaction.
 */
import { BALANCE } from '../game/balance';
import { winFight, type VictoryOutcome } from '../game/bossRewards';
import { toDateKey } from '../game/dates';
import { allocateAttribute } from '../game/progression';
import type { ChestId } from '../game/items';
import { applyDelta } from '../game/resources';
import { buyChest, equipItem, sellItem, ShopError, unequipSlot } from '../game/shop';
import { createInitialPlayer, createSeedTasks, defaultSettings } from '../game/seed';
import { pendingDays, settle, type ReviewInput, type SettlementResult } from '../game/settlement';
import { checkDaily, emptyLog, tapHabit, uncheckDaily, undoLastHabitTap, type ActionResult } from '../game/taskActions';
import type {
  Attribute,
  Delta,
  GameEvent,
  HabitTapKind,
  Item,
  LogicContext,
  Player,
  Settings,
  Slot,
  StagePosition,
  Task,
  TaskType,
} from '../game/types';
import { clock } from '../lib/clock';
import { db } from './db';

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function logicContext(): LogicContext {
  return { balance: BALANCE, now: clock.now(), rng: Math.random };
}

export function todayKey(): string {
  return toDateKey(clock.now());
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/** Creates the start data on first launch and applies the stored clock offset. */
export async function ensureInitialized(): Promise<void> {
  await db.transaction('rw', db.allTables, async () => {
    let settings = await db.settings.get('settings');
    if (!settings) {
      settings = defaultSettings();
      await db.settings.put(settings);
    }
    clock.setOffset(settings.devTimeOffsetMs);
    const player = await db.player.get('player');
    if (!player) {
      const now = clock.now();
      await db.tasks.bulkPut(createSeedTasks(now, newId));
      await db.player.put(createInitialPlayer(now, toDateKey(now), BALANCE));
    }
  });
}

/** Deletes everything and starts fresh (incl. clock offset). */
export async function resetGame(): Promise<void> {
  await db.transaction('rw', db.allTables, async () => {
    await Promise.all(db.allTables.map((t) => t.clear()));
  });
  clock.setOffset(0);
  await ensureInitialized();
}

export async function getPlayer(): Promise<Player> {
  const p = await db.player.get('player');
  if (!p) throw new Error('Spielstand fehlt');
  return p;
}

// ---------------------------------------------------------------------------
// Task actions (today)
// ---------------------------------------------------------------------------

export interface ActionOutcome {
  events: GameEvent[];
  applied: Delta;
  changed: boolean;
}

async function runTaskAction(
  taskId: string,
  date: string,
  fn: (player: Player, task: Task, log: ReturnType<typeof emptyLog>, ctx: LogicContext) => ActionResult,
): Promise<ActionOutcome> {
  return db.transaction('rw', [db.player, db.tasks, db.dayLogs, db.items], async () => {
    const [player, task] = await Promise.all([getPlayer(), db.tasks.get(taskId)]);
    if (!task) throw new Error('Aufgabe nicht gefunden');
    const log = (await db.dayLogs.get([date, taskId])) ?? emptyLog(date, task);
    const r = fn(player, task, log, logicContext());
    if (!r.changed) return { events: [], applied: r.applied, changed: false };
    const events = await enrichAndBreakItems(r.events, r.brokenItemIds);
    await db.player.put(r.player);
    await db.dayLogs.put(r.log);
    return { events, applied: r.applied, changed: true };
  });
}

/** Adds item names to death reports and deletes broken items */
async function enrichAndBreakItems(events: GameEvent[], brokenItemIds: string[]): Promise<GameEvent[]> {
  if (brokenItemIds.length === 0) return events;
  const items = await db.items.bulkGet(brokenItemIds);
  const names = new Map(items.filter(Boolean).map((i) => [i!.id, i!.name]));
  await db.items.bulkDelete(brokenItemIds);
  return events.map((e) =>
    e.type === 'death' && e.report.brokenItem
      ? { ...e, report: { ...e.report, brokenItem: { ...e.report.brokenItem, name: names.get(e.report.brokenItem.id) } } }
      : e,
  );
}

/** Tick / un-tick a daily for today */
export function toggleDaily(taskId: string, date = todayKey()): Promise<ActionOutcome> {
  return runTaskAction(taskId, date, (player, task, log, ctx) =>
    log.done ? uncheckDaily(player, task, log, ctx) : checkDaily(player, task, log, ctx),
  );
}

export function tapHabitToday(taskId: string, kind: HabitTapKind, date = todayKey()): Promise<ActionOutcome> {
  return runTaskAction(taskId, date, (player, task, log, ctx) => tapHabit(player, task, kind, log, ctx));
}

export function undoHabitToday(taskId: string, date = todayKey()): Promise<ActionOutcome> {
  return runTaskAction(taskId, date, (player, task, log, ctx) => undoLastHabitTap(player, task, log, ctx));
}

export async function spendAttributePoint(attribute: Attribute): Promise<void> {
  await db.transaction('rw', db.player, async () => {
    await db.player.put(allocateAttribute(await getPlayer(), attribute));
  });
}

// ---------------------------------------------------------------------------
// Shop & equipment (SPEC 7.3)
// ---------------------------------------------------------------------------

export interface ChestOutcome {
  item: Item;
  /** what is in that slot right now (for the comparison) */
  current: Item | null;
}

/** pays the chest and stores the new item in the inventory (not equipped yet) */
export async function buyChestItem(slot: Slot, chest: ChestId): Promise<ChestOutcome> {
  return db.transaction('rw', [db.player, db.items], async () => {
    const player = await getPlayer();
    const r = buyChest(player, slot, chest, logicContext(), newId());
    const currentId = player.equipped[slot];
    const current = currentId ? ((await db.items.get(currentId)) ?? null) : null;
    await db.player.put(r.player);
    await db.items.put(r.item);
    return { item: r.item, current };
  });
}

export async function equipItemById(itemId: string): Promise<void> {
  await db.transaction('rw', [db.player, db.items], async () => {
    const item = await db.items.get(itemId);
    if (!item) throw new ShopError('Gegenstand nicht gefunden');
    await db.player.put(equipItem(await getPlayer(), item));
  });
}

export async function unequip(slot: Slot): Promise<void> {
  await db.transaction('rw', db.player, async () => {
    await db.player.put(unequipSlot(await getPlayer(), slot));
  });
}

/** sells the item (also when equipped), returns the gold received */
export async function sellItemById(itemId: string): Promise<number> {
  return db.transaction('rw', [db.player, db.items], async () => {
    const item = await db.items.get(itemId);
    if (!item) throw new ShopError('Gegenstand nicht gefunden');
    const r = sellItem(await getPlayer(), item, logicContext());
    await db.player.put(r.player);
    await db.items.delete(itemId);
    return r.gold;
  });
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

/**
 * The battle scene beat the enemy at `expected`. Advances only if the hero is
 * still there (a death or the dev menu may have moved them in the meantime).
 */
export async function recordVictory(expected: StagePosition): Promise<RecordedVictory | null> {
  return db.transaction('rw', [db.player, db.items], async () => {
    const player = await getPlayer();
    if (player.round !== expected.round || player.area !== expected.area || player.stage !== expected.stage) return null;
    // boss beaten for the first time → gold, maybe a chest (feedback Phase 4)
    const result = winFight(player, logicContext(), newId);
    let current: Item | null = null;
    const drop = result.reward?.drop;
    if (drop) {
      const currentId = result.player.equipped[drop.item.slot];
      current = currentId ? ((await db.items.get(currentId)) ?? null) : null;
      await db.items.put(drop.item);
    }
    await db.player.put(result.player);
    return { ...result, dropCurrent: current };
  });
}

/** victory as stored: + the item worn in the slot of a dropped item (for the comparison) */
export interface RecordedVictory extends VictoryOutcome {
  dropCurrent: Item | null;
}

// ---------------------------------------------------------------------------
// Day change / settlement
// ---------------------------------------------------------------------------

export async function getPendingDays(): Promise<string[]> {
  const player = await getPlayer();
  return pendingDays(player.lastSettledDate, todayKey());
}

export interface SettlementOutcome extends Omit<SettlementResult, 'events'> {
  events: GameEvent[];
}

/** Settles all pending days. `review` = input of the "gestern" dialog (null = dismissed). */
export async function runSettlement(review: ReviewInput | null): Promise<SettlementOutcome | null> {
  return db.transaction('rw', db.allTables, async () => {
    const player = await getPlayer();
    const today = todayKey();
    const days = pendingDays(player.lastSettledDate, today);
    if (days.length === 0) return null;
    const [tasks, logs] = await Promise.all([
      db.tasks.toArray(),
      db.dayLogs.where('date').between(days[0], days[days.length - 1], true, true).toArray(),
    ]);
    const validReview = review && review.date === days[days.length - 1] ? review : null;
    const result = settle({ player, tasks, logs, today, review: validReview }, logicContext());
    const events = await enrichAndBreakItems(result.events, result.brokenItemIds);
    await db.dayLogs.bulkPut(result.logs);
    await db.player.put(result.player);
    return { ...result, events };
  });
}

// ---------------------------------------------------------------------------
// Task management
// ---------------------------------------------------------------------------

export interface TaskDraft {
  type: TaskType;
  title: string;
  points: number;
  plusPoints: number;
  minusPoints: number;
}

const clampPoints = (n: number, min: number) => Math.max(min, Math.min(10, Math.round(Number(n) || 0)));

export function normalizeDraft(d: TaskDraft): TaskDraft {
  return {
    type: d.type,
    title: d.title.trim().slice(0, 120),
    points: d.type === 'daily' ? clampPoints(d.points, 1) : 0,
    plusPoints: d.type === 'habit' ? clampPoints(d.plusPoints, 0) : 0,
    minusPoints: d.type === 'habit' ? clampPoints(d.minusPoints, 0) : 0,
  };
}

export function validateDraft(d: TaskDraft): string | null {
  const n = normalizeDraft(d);
  if (!n.title) return 'Bitte einen Titel eingeben.';
  if (n.type === 'habit' && n.plusPoints === 0 && n.minusPoints === 0)
    return 'Eine Gewohnheit braucht Plus- oder Minus-Punkte.';
  return null;
}

export async function createTask(draft: TaskDraft): Promise<string> {
  const error = validateDraft(draft);
  if (error) throw new Error(error);
  const n = normalizeDraft(draft);
  const id = newId();
  await db.transaction('rw', db.tasks, async () => {
    const sameType = await db.tasks.where('type').equals(n.type).toArray();
    const order = sameType.reduce((m, t) => Math.max(m, t.order), -1) + 1;
    await db.tasks.add({ id, ...n, order, archived: false, createdAt: clock.now(), archivedAt: null });
  });
  return id;
}

export async function updateTask(id: string, draft: TaskDraft): Promise<void> {
  const error = validateDraft(draft);
  if (error) throw new Error(error);
  const n = normalizeDraft(draft);
  await db.tasks.update(id, { title: n.title, points: n.points, plusPoints: n.plusPoints, minusPoints: n.minusPoints });
}

export async function setTaskArchived(id: string, archived: boolean): Promise<void> {
  await db.tasks.update(id, { archived, archivedAt: archived ? clock.now() : null });
}

/** Deletes a task including its history */
export async function deleteTask(id: string): Promise<void> {
  await db.transaction('rw', db.tasks, db.dayLogs, async () => {
    await db.dayLogs.where('taskId').equals(id).delete();
    await db.tasks.delete(id);
  });
}

/** Persists a new order (ids in display order) */
export async function reorderTasks(orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.tasks, async () => {
    await Promise.all(orderedIds.map((id, order) => db.tasks.update(id, { order })));
  });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await db.settings.update('settings', patch);
  if (patch.devTimeOffsetMs !== undefined) clock.setOffset(patch.devTimeOffsetMs);
}

export async function renamePlayer(name: string): Promise<void> {
  const trimmed = name.trim().slice(0, 24);
  if (trimmed) await db.player.update('player', { name: trimmed });
}

// ---------------------------------------------------------------------------
// Developer menu
// ---------------------------------------------------------------------------

export async function devAdvanceDays(days: number): Promise<void> {
  const settings = await db.settings.get('settings');
  await updateSettings({ devTimeOffsetMs: (settings?.devTimeOffsetMs ?? 0) + days * 86_400_000 });
}

/** Adds XP / gold through the normal reward pipeline (level-ups included) */
export async function devAddResources(delta: Partial<Delta>): Promise<GameEvent[]> {
  return db.transaction('rw', [db.player, db.items], async () => {
    const r = applyDelta(await getPlayer(), { xp: 0, gold: 0, vitality: 0, ...delta }, logicContext());
    const events = await enrichAndBreakItems(r.events, r.brokenItemIds);
    await db.player.put(r.player);
    return events;
  });
}

/** Sets vitality; a value ≤ 0 kills the hero */
export async function devSetVitality(value: number): Promise<GameEvent[]> {
  const player = await getPlayer();
  const target = Math.min(BALANCE.vitality.max, Math.round(value));
  return devAddResources({ vitality: target - player.vitality });
}

export async function devSetStage(round: number, area: number, stage: number): Promise<void> {
  const c = BALANCE.combat;
  await db.player.update('player', {
    round: Math.max(1, Math.round(round)),
    area: Math.min(c.areaCount, Math.max(1, Math.round(area))),
    stage: Math.min(c.stagesPerArea, Math.max(1, Math.round(stage))),
  });
}
