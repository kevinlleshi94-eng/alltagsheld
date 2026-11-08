import type { Balance } from './balance';
import { initialLastSettledDate } from './settlement';
import type { CombatProgress, Player, Settings, Task } from './types';

export const SEED_DAILIES: ReadonlyArray<[string, number]> = [
  ['7 Std. Schlaf', 3],
  ['Direkt nach dem Wecker aufgestanden', 2],
  ['Bett machen', 1],
  ['Badroutine morgens', 1],
  ['Vitamine morgens', 1],
  ['Mehr als 10.000 Schritte', 3],
  ['2,5 Liter Wasser getrunken', 2],
  ['Wohnung aufgeräumt', 2],
  ['Klamotten für den nächsten Tag vorbereitet', 1],
  ['Dehnen', 2],
  ['Meditation', 2],
  ['Vitamine abends', 1],
  ['Badroutine abends', 1],
];

export const SEED_HABITS: ReadonlyArray<[string, number, number]> = [
  ['Selbst gekocht', 1, 0],
  ['Fertigessen bestellt', 0, 1],
];

export function createSeedTasks(now: number, newId: () => string): Task[] {
  const dailies: Task[] = SEED_DAILIES.map(([title, points], i) => ({
    id: newId(),
    type: 'daily',
    title,
    points,
    plusPoints: 0,
    minusPoints: 0,
    order: i,
    archived: false,
    createdAt: now,
    archivedAt: null,
  }));
  const habits: Task[] = SEED_HABITS.map(([title, plusPoints, minusPoints], i) => ({
    id: newId(),
    type: 'habit',
    title,
    points: 0,
    plusPoints,
    minusPoints,
    order: i,
    archived: false,
    createdAt: now,
    archivedAt: null,
  }));
  return [...dailies, ...habits];
}

/** Combat statistics of a new hero (or of a v1 save at the given stage index) */
export function initialProgress(highestStageIndex = 0): CombatProgress {
  return { enemiesDefeated: 0, bossesDefeated: 0, highestStageIndex, dragonsDefeated: 0 };
}

export function createInitialPlayer(now: number, today: string, balance: Balance): Player {
  return {
    id: 'player',
    name: 'Held',
    look: { bodyType: 'a', skin: 'light', hair: 'short', hairColor: 'brown' },
    level: 1,
    xp: 0,
    gold: 0,
    vitality: balance.vitality.max,
    attributes: { strength: 0, speed: 0, life: 0 },
    unspentPoints: 0,
    attributeHistory: [],
    equipped: { head: null, body: null, weapon: null, shield: null },
    activePet: null,
    unlockedPets: [],
    round: 1,
    area: 1,
    stage: 1,
    progress: initialProgress(),
    deaths: 0,
    lastSettledDate: initialLastSettledDate(today),
    lastBackupAt: null,
    lastDeathAt: null,
    createdAt: now,
  };
}

export function defaultSettings(): Settings {
  return {
    id: 'settings',
    soundEnabled: true,
    volume: 0.7,
    // user feedback: only the review of yesterday on the first open of a day, no "today" prompt
    todayPromptEnabled: false,
    devTimeOffsetMs: 0,
  };
}
