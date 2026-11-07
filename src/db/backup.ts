import { clock } from '../lib/clock';
import { db, SCHEMA_VERSION } from './db';
import { migrateSnapshot, type Snapshot } from './migrations';

export async function createSnapshot(): Promise<Snapshot> {
  return db.transaction('r', db.allTables, async () => {
    const [tasks, dayLogs, player, items, achievements, settings] = await Promise.all([
      db.tasks.toArray(),
      db.dayLogs.toArray(),
      db.player.get('player'),
      db.items.toArray(),
      db.achievements.toArray(),
      db.settings.get('settings'),
    ]);
    if (!player || !settings) throw new Error('Kein Spielstand vorhanden.');
    return {
      app: 'alltagsheld',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: clock.now(),
      data: { tasks, dayLogs, player, items, achievements, settings },
    };
  });
}

export function snapshotFileName(snapshot: Snapshot): string {
  const d = new Date(snapshot.exportedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `alltagsheld-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Parses + validates a backup file and migrates it to the current schema. Throws German messages. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.');
  }
  if (!isObj(raw) || raw.app !== 'alltagsheld') throw new Error('Das ist keine Alltagsheld-Sicherung.');
  if (typeof raw.schemaVersion !== 'number') throw new Error('Die Sicherung hat keine Versionsnummer.');
  if (raw.schemaVersion > SCHEMA_VERSION)
    throw new Error('Die Sicherung stammt aus einer neueren App-Version. Bitte zuerst die App aktualisieren.');
  const data = raw.data;
  if (!isObj(data)) throw new Error('Die Sicherung enthält keine Daten.');
  for (const key of ['tasks', 'dayLogs', 'items', 'achievements'] as const) {
    if (!Array.isArray(data[key])) throw new Error(`Die Sicherung ist unvollständig (${key}).`);
  }
  if (!isObj(data.player) || data.player.id !== 'player') throw new Error('Die Sicherung enthält keinen Spieler.');
  if (!isObj(data.settings)) throw new Error('Die Sicherung enthält keine Einstellungen.');
  for (const t of data.tasks as unknown[]) {
    if (!isObj(t) || typeof t.id !== 'string' || (t.type !== 'daily' && t.type !== 'habit') || typeof t.title !== 'string')
      throw new Error('Die Sicherung enthält ungültige Aufgaben.');
  }
  return migrateSnapshot(raw as unknown as Snapshot);
}

/** Replaces the complete local game state with the snapshot */
export async function restoreSnapshot(snapshot: Snapshot): Promise<void> {
  const { data } = snapshot;
  await db.transaction('rw', db.allTables, async () => {
    await Promise.all(db.allTables.map((t) => t.clear()));
    await db.tasks.bulkPut(data.tasks);
    await db.dayLogs.bulkPut(data.dayLogs);
    await db.items.bulkPut(data.items);
    await db.achievements.bulkPut(data.achievements);
    await db.player.put(data.player);
    await db.settings.put({ ...data.settings, id: 'settings' });
  });
  clock.setOffset(data.settings.devTimeOffsetMs ?? 0);
}

export async function markBackupDone(): Promise<void> {
  await db.player.update('player', { lastBackupAt: clock.now() });
}
