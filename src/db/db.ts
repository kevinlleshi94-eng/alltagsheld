import Dexie, { type Table } from 'dexie';
import { BALANCE } from '../game/balance';
import { stageIndex } from '../game/combat';
import { initialProgress } from '../game/seed';
import type { Achievement, DayLog, Item, Player, Settings, Task } from '../game/types';

/**
 * Current schema version. When you change the schema:
 *  1. add `this.version(N).stores(...).upgrade(...)` below (never edit old versions)
 *  2. bump SCHEMA_VERSION
 *  3. add a step to `migrateSnapshot` in migrations.ts (for old backup files)
 */
export const SCHEMA_VERSION = 2;

export class AlltagsheldDB extends Dexie {
  tasks!: Table<Task, string>;
  dayLogs!: Table<DayLog, [string, string]>;
  player!: Table<Player, string>;
  items!: Table<Item, string>;
  achievements!: Table<Achievement, string>;
  settings!: Table<Settings, string>;

  constructor(name = 'alltagsheld') {
    super(name);
    this.version(1).stores({
      tasks: 'id, type, order',
      dayLogs: '[date+taskId], date, taskId',
      player: 'id',
      items: 'id, slot',
      achievements: 'id',
      settings: 'id',
    });
    // v2: combat statistics on the player (no index changes)
    this.version(2)
      .stores({})
      .upgrade((tx) =>
        tx
          .table<Player, string>('player')
          .toCollection()
          .modify((p) => {
            p.progress ??= initialProgress(stageIndex(p, BALANCE));
          }),
      );
  }

  get allTables() {
    return [this.tasks, this.dayLogs, this.player, this.items, this.achievements, this.settings];
  }
}

export const db = new AlltagsheldDB();
