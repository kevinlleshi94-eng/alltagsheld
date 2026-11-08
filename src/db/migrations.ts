import type { Achievement, DayLog, Item, Player, Settings, Task } from '../game/types';
import { BALANCE } from '../game/balance';
import { stageIndex } from '../game/combat';
import { convertLegacyItem } from '../game/items';
import { initialProgress } from '../game/seed';
import { SCHEMA_VERSION } from './db';

export interface SnapshotData {
  tasks: Task[];
  dayLogs: DayLog[];
  player: Player;
  items: Item[];
  achievements: Achievement[];
  settings: Settings;
}

export interface Snapshot {
  app: 'alltagsheld';
  schemaVersion: number;
  exportedAt: number;
  data: SnapshotData;
}

/**
 * Brings a backup file from an older schema version to the current one.
 * Add one `if (version === N)` block per schema bump.
 */
export function migrateSnapshot(snapshot: Snapshot): Snapshot {
  let version = snapshot.schemaVersion;
  let data = snapshot.data;
  if (version === 1) {
    // v2: combat statistics
    const p: Omit<Player, 'progress'> & Partial<Pick<Player, 'progress'>> = data.player;
    data = { ...data, player: { ...p, progress: p.progress ?? initialProgress(stageIndex(p, BALANCE)) } };
    version = 2;
  }
  if (version === 2) {
    // v3: "today" prompt off by default (user feedback)
    data = { ...data, settings: { ...data.settings, todayPromptEnabled: false } };
    version = 3;
  }
  if (version === 3) {
    // v4: new item rules per slot (same value, new split)
    data = { ...data, items: data.items.map((i) => convertLegacyItem(i, BALANCE)) };
    version = 4;
  }
  if (version !== SCHEMA_VERSION) {
    throw new Error(`Backup-Version ${snapshot.schemaVersion} kann nicht migriert werden.`);
  }
  return { ...snapshot, schemaVersion: version, data };
}
