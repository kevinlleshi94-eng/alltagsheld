/**
 * Connection between React and the Phaser scene (no Phaser import here, so the
 * React side can use it without loading the game engine).
 *
 *  React → scene:  battleInput (position, hero stats, visible equipment, paused)
 *  scene → React:  battleHud (enemy name, attempts, banner), battleTimer (10 Hz)
 */
import type { HeroStats, StageKind, VictoryResult } from '../game/combat';
import type { Rarity, Slot, StagePosition } from '../game/types';
import { createStore } from '../state/store';

export interface BattleInput {
  position: StagePosition;
  hero: HeroStats;
  /** rarity of the equipped item per slot (drawn on the hero) */
  gear: Partial<Record<Slot, Rarity>>;
  /** dialogs / popups are open → freeze the fight */
  paused: boolean;
}

export const battleInput = createStore<BattleInput | null>(null);

export interface BattleBanner {
  id: number;
  /** cleared = "Gebiet geschafft!", area/round = name of the new area on black */
  kind: 'boss' | 'areaBoss' | 'cleared' | 'area' | 'round';
  title: string;
  subtitle?: string;
  /** small line above the title */
  overline?: string;
}

export interface BattleHud {
  enemyName: string;
  kind: StageKind;
  /** failed attempts against the current enemy */
  attempts: number;
  banner: BattleBanner | null;
}

export const battleHud = createStore<BattleHud>({ enemyName: '', kind: 'normal', attempts: 0, banner: null });

export interface BattleTimer {
  active: boolean;
  left: number;
  total: number;
}

export const battleTimer = createStore<BattleTimer>({ active: false, left: 0, total: 0 });

export interface BattleCallbacks {
  /** persist a won fight; resolves with the new state (null if the hero had moved) */
  onVictory(pos: StagePosition): Promise<VictoryResult | null>;
}

export const samePosition = (a: StagePosition, b: StagePosition) =>
  a.round === b.round && a.area === b.area && a.stage === b.stage;
