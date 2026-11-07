/** UI-level actions: call the repo, then show feedback (floating text, popups, toasts). */
import * as repo from '../db/repo';
import type { HabitTapKind } from '../game/types';
import { anchorOf, pushEvents, spawnFloat, toast } from './ui';

async function guarded<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    console.error(e);
    toast(e instanceof Error ? e.message : 'Etwas ist schiefgelaufen.');
    return undefined;
  }
}

export async function toggleDaily(taskId: string, anchorEl: Element | null) {
  const anchor = anchorOf(anchorEl);
  const r = await guarded(() => repo.toggleDaily(taskId));
  if (!r) return;
  spawnFloat(anchor, r.applied);
  pushEvents(r.events);
}

export async function tapHabit(taskId: string, kind: HabitTapKind, anchorEl: Element | null) {
  const anchor = anchorOf(anchorEl);
  const r = await guarded(() => repo.tapHabitToday(taskId, kind));
  if (!r) return;
  spawnFloat(anchor, r.applied);
  pushEvents(r.events);
}

export async function undoHabit(taskId: string, anchorEl: Element | null) {
  const anchor = anchorOf(anchorEl);
  const r = await guarded(() => repo.undoHabitToday(taskId));
  if (!r || !r.changed) return;
  spawnFloat(anchor, r.applied);
  pushEvents(r.events);
}

export { guarded };
