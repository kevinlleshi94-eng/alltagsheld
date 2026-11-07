/** Domain types shared by game logic, storage and UI. */

export type TaskType = 'daily' | 'habit';

export interface Task {
  id: string;
  type: TaskType;
  title: string;
  /** Daily: points 1–10 */
  points: number;
  /** Habit: points for "+" (0 = no plus button) */
  plusPoints: number;
  /** Habit: points for "−" (0 = no minus button) */
  minusPoints: number;
  order: number;
  archived: boolean;
  /** ms epoch (game clock) */
  createdAt: number;
  archivedAt: number | null;
}

/** Actually applied change of player resources */
export interface Delta {
  xp: number;
  gold: number;
  vitality: number;
}

export type HabitTapKind = 'plus' | 'minus';

export interface HabitTap {
  kind: HabitTapKind;
  /** ms epoch (game clock) */
  at: number;
  /** what this tap actually changed (used for undo + statistics) */
  applied: Delta;
}

/** One entry per (day, task). Dailies get an entry for every settled day (gap-free log). */
export interface DayLog {
  /** YYYY-MM-DD (local) */
  date: string;
  taskId: string;
  type: TaskType;
  // --- daily ---
  done: boolean;
  doneAt: number | null;
  /** applied reward of the current check (null if not done) */
  reward: Delta | null;
  /** task points at check / settlement time (for statistics) */
  points: number;
  /** vitality lost at settlement because not done (positive number) */
  penalty: number;
  // --- habit ---
  plusCount: number;
  minusCount: number;
  taps: HabitTap[];
  /** day has been settled – no more changes */
  settled: boolean;
}

export type Attribute = 'strength' | 'speed' | 'life';
export type Slot = 'head' | 'body' | 'weapon' | 'shield';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface AvatarLook {
  bodyType: string;
  skin: string;
  hair: string;
  hairColor: string;
}

export interface CombatProgress {
  enemiesDefeated: number;
  /** stage-10/20 bosses and area bosses */
  bossesDefeated: number;
  /** furthest stage ever reached (0 = Straße 1 of round 1) */
  highestStageIndex: number;
  dragonsDefeated: number;
}

export interface Player {
  id: 'player';
  name: string;
  look: AvatarLook;
  level: number;
  /** XP inside the current level */
  xp: number;
  gold: number;
  vitality: number;
  attributes: Record<Attribute, number>;
  unspentPoints: number;
  /** order in which attribute points were spent (needed for death penalty) */
  attributeHistory: Attribute[];
  equipped: Record<Slot, string | null>;
  activePet: string | null;
  unlockedPets: string[];
  round: number;
  area: number;
  stage: number;
  /** combat statistics (schema v2) */
  progress: CombatProgress;
  deaths: number;
  /** last day (YYYY-MM-DD) that has been settled */
  lastSettledDate: string;
  lastBackupAt: number | null;
  lastDeathAt: number | null;
  createdAt: number;
}

export interface Item {
  id: string;
  slot: Slot;
  rarity: Rarity;
  name: string;
  spriteKey: string;
  stats: Partial<Record<Attribute, number>>;
  levelAtPurchase: number;
  chestType: string;
  acquiredAt: number;
}

export interface Achievement {
  id: string;
  unlockedAt: number | null;
  progress: number;
}

export interface Settings {
  id: 'settings';
  soundEnabled: boolean;
  /** 0..1 */
  volume: number;
  todayPromptEnabled: boolean;
  /** developer menu: shifts the game clock (ms) */
  devTimeOffsetMs: number;
}

export interface StagePosition {
  round: number;
  area: number;
  stage: number;
}

export interface DeathReport {
  at: number;
  levelBefore: number;
  levelAfter: number;
  goldLost: number;
  /** which attribute point was removed ('unspent' = a saved point) */
  removedPoint: Attribute | 'unspent' | null;
  brokenItem: { id: string; slot: Slot; name?: string } | null;
  stageBefore: StagePosition;
  stageAfter: StagePosition;
}

export type GameEvent =
  | { type: 'levelUp'; level: number }
  | { type: 'levelDown'; level: number }
  | { type: 'death'; report: DeathReport };

/** Context passed into all logic functions (keeps them pure & testable) */
export interface LogicContext {
  balance: import('./balance').Balance;
  /** current game-clock time (ms) */
  now: number;
  /** random number in [0, 1) */
  rng: () => number;
}
