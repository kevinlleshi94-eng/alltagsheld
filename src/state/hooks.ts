import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useSyncExternalStore } from 'react';
import { BALANCE } from '../game/balance';
import { toDateKey } from '../game/dates';
import type { DayLog, Item, Player, Settings, Task } from '../game/types';
import { db } from '../db/db';
import { clock } from '../lib/clock';
import { createStore } from './store';
import { fightBlockers } from './ui';

// "today" changes at midnight or when the dev menu shifts the clock
const todayStore = createStore(toDateKey(clock.now()));
const refreshToday = () => {
  const t = toDateKey(clock.now());
  if (t !== todayStore.get()) todayStore.set(t);
};
clock.subscribe(refreshToday);
if (typeof window !== 'undefined') {
  setInterval(refreshToday, BALANCE.app.dayChangeCheckIntervalMs);
  document.addEventListener('visibilitychange', refreshToday);
}

export function useToday(): string {
  return useSyncExternalStore(todayStore.subscribe, todayStore.get, todayStore.get);
}

export function usePlayer(): Player | undefined {
  return useLiveQuery(() => db.player.get('player'), []);
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => db.settings.get('settings'), []);
}

export function useTasks(): Task[] | undefined {
  return useLiveQuery(() => db.tasks.orderBy('order').toArray(), []);
}

export function useDayLogs(date: string): DayLog[] | undefined {
  return useLiveQuery(() => db.dayLogs.where('date').equals(date).toArray(), [date]);
}

const NO_ITEMS: Item[] = [];

/** Items currently equipped by the hero (stable empty array while none) */
export function useEquippedItems(player: Player | undefined): Item[] {
  const ids = player ? Object.values(player.equipped).filter((id): id is string => !!id) : [];
  const key = ids.join(',');
  const items = useLiveQuery(
    async () => (ids.length ? (await db.items.bulkGet(ids)).filter((i): i is Item => !!i) : NO_ITEMS),
    [key],
  );
  return items ?? NO_ITEMS;
}

/** All items (inventory + equipped), live */
export function useItems(): Item[] | undefined {
  return useLiveQuery(() => db.items.toArray(), []);
}

/** Freezes the fight while the calling component is mounted (and `active`) */
export function usePauseFight(active = true) {
  useEffect(() => {
    if (!active) return;
    fightBlockers.set((n) => n + 1);
    return () => fightBlockers.set((n) => n - 1);
  }, [active]);
}

/** true when the user asked iOS/the OS for less motion */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Runs `fn` when the clock offset changes (dev menu) */
export function useClockChange(fn: () => void) {
  useEffect(() => clock.subscribe(fn), [fn]);
}
