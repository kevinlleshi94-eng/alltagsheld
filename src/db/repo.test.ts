import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BALANCE } from '../game/balance';
import { addDays } from '../game/dates';
import { clock } from '../lib/clock';
import { createSnapshot, parseSnapshot, restoreSnapshot } from './backup';
import Dexie from 'dexie';
import { AlltagsheldDB, db, SCHEMA_VERSION } from './db';
import {
  createTask,
  deleteTask,
  devAdvanceDays,
  devSetStage,
  devSetVitality,
  ensureInitialized,
  getPendingDays,
  getPlayer,
  recordVictory,
  reorderTasks,
  resetGame,
  runSettlement,
  setTaskArchived,
  tapHabitToday,
  todayKey,
  toggleDaily,
  undoHabitToday,
} from './repo';

const NOON = new Date(2026, 10, 5, 12, 0, 0).getTime();

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOON });
  clock.setOffset(0);
  await db.delete();
  await db.open();
  await ensureInitialized();
});

afterEach(() => {
  vi.useRealTimers();
});

const dailies = async () => (await db.tasks.where('type').equals('daily').sortBy('order'));
const habits = async () => (await db.tasks.where('type').equals('habit').sortBy('order'));

describe('first start', () => {
  it('seeds 13 dailies, 2 habits and a fresh hero', async () => {
    expect(await dailies()).toHaveLength(13);
    expect((await habits()).map((h) => h.title)).toEqual(['Selbst gekocht', 'Fertigessen bestellt']);
    const p = await getPlayer();
    expect(p).toMatchObject({ level: 1, xp: 0, gold: 0, vitality: 100, lastSettledDate: '2026-11-04' });
    expect((await dailies()).reduce((s, t) => s + t.points, 0)).toBe(22);
    expect(await getPendingDays()).toEqual([]);
  });

  it('is idempotent', async () => {
    await ensureInitialized();
    expect(await db.tasks.count()).toBe(15);
  });
});

describe('today actions', () => {
  it('toggling a daily rewards and reverts', async () => {
    const [sleep] = await dailies();
    const r = await toggleDaily(sleep.id);
    expect(r.applied).toEqual({ xp: 30, gold: 15, vitality: 0 });
    expect(await getPlayer()).toMatchObject({ xp: 30, gold: 15 });
    expect((await db.dayLogs.get([todayKey(), sleep.id]))?.done).toBe(true);
    await toggleDaily(sleep.id);
    expect(await getPlayer()).toMatchObject({ xp: 0, gold: 0 });
    expect((await db.dayLogs.get([todayKey(), sleep.id]))?.done).toBe(false);
  });

  it('habit taps are logged and undoable', async () => {
    const [cook, order] = await habits();
    await tapHabitToday(cook.id, 'plus');
    await tapHabitToday(cook.id, 'plus');
    await tapHabitToday(order.id, 'minus');
    expect(await getPlayer()).toMatchObject({ xp: 20, gold: 5, vitality: 97 });
    await undoHabitToday(order.id);
    expect(await getPlayer()).toMatchObject({ xp: 20, gold: 10, vitality: 100 });
    const log = await db.dayLogs.get([todayKey(), cook.id]);
    expect(log?.plusCount).toBe(2);
    expect(log?.taps).toHaveLength(2);
  });

  it('a lethal "−" tap triggers death', async () => {
    const [, order] = await habits();
    await devSetVitality(2);
    const r = await tapHabitToday(order.id, 'minus');
    expect(r.events.map((e) => e.type)).toEqual(['death']);
    expect(await getPlayer()).toMatchObject({ vitality: 100, deaths: 1 });
  });
});

describe('day change', () => {
  it('advancing the clock creates a pending day, settlement applies penalties', async () => {
    const list = await dailies();
    await toggleDaily(list[0].id); // 3 points done today
    await devAdvanceDays(1);
    expect(todayKey()).toBe('2026-11-06');
    expect(await getPendingDays()).toEqual(['2026-11-05']);

    const result = await runSettlement({
      date: '2026-11-05',
      checkedDailyIds: [list[1].id], // +2 points via review
      habitTaps: {},
    });
    expect(result?.summaries[0]).toMatchObject({ doneCount: 2, totalCount: 13, donePoints: 5 });
    // heal capped at 100; penalty = 17 missed points × factor (rounded per day)
    const penalty = Math.round(17 * BALANCE.vitality.missedDailyLossPerPoint);
    expect(await getPlayer()).toMatchObject({ vitality: 100 - penalty, lastSettledDate: '2026-11-05' });
    expect(await getPendingDays()).toEqual([]);
    expect(await db.dayLogs.where('date').equals('2026-11-05').count()).toBe(13);
    // a second run is a no-op
    expect(await runSettlement(null)).toBeNull();
  });

  it('several missed days kill the hero only once', async () => {
    await devAdvanceDays(5);
    const result = await runSettlement(null);
    expect(result?.settledDays).toEqual(['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09']);
    expect(result?.events.filter((e) => e.type === 'death')).toHaveLength(1);
    expect(await getPlayer()).toMatchObject({ deaths: 1, vitality: 100 });
  });

  it('a review for the wrong day is ignored', async () => {
    const list = await dailies();
    await devAdvanceDays(2);
    const result = await runSettlement({ date: '2026-11-05', checkedDailyIds: [list[0].id], habitTaps: {} });
    expect(result?.summaries.every((s) => s.doneCount === 0)).toBe(true);
  });
});

describe('task management', () => {
  it('creates, archives, reorders and deletes tasks', async () => {
    const id = await createTask({ type: 'daily', title: '  Lesen ', points: 15, plusPoints: 0, minusPoints: 0 });
    const t = await db.tasks.get(id);
    expect(t).toMatchObject({ title: 'Lesen', points: 10, order: 13, archived: false });

    await expect(createTask({ type: 'habit', title: 'X', points: 0, plusPoints: 0, minusPoints: 0 })).rejects.toThrow();

    await setTaskArchived(id, true);
    expect((await db.tasks.get(id))?.archived).toBe(true);

    const ids = (await dailies()).map((d) => d.id).reverse();
    await reorderTasks(ids);
    expect((await dailies()).map((d) => d.id)).toEqual(ids);

    await toggleDaily(ids[0]);
    await deleteTask(ids[0]);
    expect(await db.tasks.get(ids[0])).toBeUndefined();
    expect(await db.dayLogs.where('taskId').equals(ids[0]).count()).toBe(0);
  });

  it('archived tasks are not penalised', async () => {
    for (const t of await dailies()) await setTaskArchived(t.id, true);
    await devAdvanceDays(1);
    await runSettlement(null);
    expect((await getPlayer()).vitality).toBe(100);
  });
});

describe('backup', () => {
  it('round-trips the whole game state', async () => {
    const [sleep] = await dailies();
    await toggleDaily(sleep.id);
    await devAdvanceDays(1);
    const snapshot = await createSnapshot();
    const json = JSON.stringify(snapshot);

    await resetGame();
    expect((await getPlayer()).xp).toBe(0);
    expect(clock.getOffset()).toBe(0);

    await restoreSnapshot(parseSnapshot(json));
    expect((await getPlayer()).xp).toBe(30);
    expect(await db.dayLogs.count()).toBe(1);
    expect(clock.getOffset()).toBe(86_400_000);
    expect(await getPendingDays()).toEqual(['2026-11-05']);
  });

  it('rejects invalid files with a German message', () => {
    expect(() => parseSnapshot('nope')).toThrow('kein gültiges JSON');
    expect(() => parseSnapshot('{"app":"other"}')).toThrow('keine Alltagsheld-Sicherung');
    expect(() => parseSnapshot('{"app":"alltagsheld","schemaVersion":999,"data":{}}')).toThrow('neueren App-Version');
    expect(() => parseSnapshot('{"app":"alltagsheld","schemaVersion":1,"data":{"tasks":[]}}')).toThrow('unvollständig');
  });

  it('exported file names use the game date', async () => {
    const { snapshotFileName } = await import('./backup');
    expect(snapshotFileName(await createSnapshot())).toBe(`alltagsheld-backup-${addDays('2026-11-04', 1)}.json`);
  });
});

describe('combat progress', () => {
  it('a victory advances the stage and counts it', async () => {
    const r = await recordVictory({ round: 1, area: 1, stage: 1 });
    expect(r?.kind).toBe('normal');
    const p = await getPlayer();
    expect(p).toMatchObject({ round: 1, area: 1, stage: 2 });
    expect(p.progress).toEqual({ enemiesDefeated: 1, bossesDefeated: 0, highestStageIndex: 1, dragonsDefeated: 0 });
  });

  it('ignores a victory for a stage the hero has already left', async () => {
    await recordVictory({ round: 1, area: 1, stage: 1 });
    expect(await recordVictory({ round: 1, area: 1, stage: 1 })).toBeNull();
    expect((await getPlayer()).stage).toBe(2);
  });

  it('beating the dragon starts round 2', async () => {
    await devSetStage(1, 8, 25);
    const r = await recordVictory({ round: 1, area: 8, stage: 25 });
    expect(r).toMatchObject({ kind: 'areaBoss', areaCleared: true, roundCleared: true });
    const p = await getPlayer();
    expect(p).toMatchObject({ round: 2, area: 1, stage: 1 });
    expect(p.progress).toMatchObject({ bossesDefeated: 1, dragonsDefeated: 1, highestStageIndex: 200 });
  });
});

describe('schema v2', () => {
  it('migrates v1 backups (adds combat progress)', async () => {
    await devSetStage(1, 2, 5);
    const snapshot = await createSnapshot();
    const { progress: _drop, ...v1Player } = snapshot.data.player;
    const v1 = { ...snapshot, schemaVersion: 1, data: { ...snapshot.data, player: v1Player } };
    await restoreSnapshot(parseSnapshot(JSON.stringify(v1)));
    expect((await getPlayer()).progress).toEqual({
      enemiesDefeated: 0,
      bossesDefeated: 0,
      highestStageIndex: 29,
      dragonsDefeated: 0,
    });
  });

  it('upgrades an existing v1 database', async () => {
    const name = 'alltagsheld-upgrade-test';
    await Dexie.delete(name);
    const v1 = new Dexie(name);
    v1.version(1).stores({
      tasks: 'id, type, order',
      dayLogs: '[date+taskId], date, taskId',
      player: 'id',
      items: 'id, slot',
      achievements: 'id',
      settings: 'id',
    });
    const { progress: _drop, ...v1Player } = await getPlayer();
    await v1.table('player').put({ ...v1Player, area: 3, stage: 1 });
    v1.close();

    const upgraded = new AlltagsheldDB(name);
    const p = await upgraded.player.get('player');
    expect(p?.progress).toEqual({ enemiesDefeated: 0, bossesDefeated: 0, highestStageIndex: 50, dragonsDefeated: 0 });
    expect(upgraded.verno).toBe(SCHEMA_VERSION);
    upgraded.close();
    await Dexie.delete(name);
  });
});
