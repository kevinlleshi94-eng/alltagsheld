import type { SettlementOutcome } from '../db/repo';
import type { Delta, GameEvent } from '../game/types';
import { createStore } from './store';

// ---------------------------------------------------------------------------
// Event queue: level-ups, deaths … shown one after another
// ---------------------------------------------------------------------------
export interface QueuedEvent {
  id: number;
  event: GameEvent;
}
let eventId = 0;
export const eventQueue = createStore<QueuedEvent[]>([]);

export function pushEvents(events: GameEvent[]) {
  if (events.length === 0) return;
  eventQueue.set((q) => {
    let next = [...q];
    for (const event of events) {
      // a level lost again → drop its pending level-up popup
      if (event.type === 'levelDown') {
        next = next.filter((e) => !(e.event.type === 'levelUp' && e.event.level > event.level));
        continue;
      }
      next.push({ id: ++eventId, event });
    }
    return next;
  });
}

export function popEvent(id: number) {
  eventQueue.set((q) => q.filter((e) => e.id !== id));
}

// ---------------------------------------------------------------------------
// App-open flow: review yesterday → summary → today prompt → main
// ---------------------------------------------------------------------------
export type FlowState =
  | { phase: 'boot' }
  | { phase: 'review'; date: string; olderDays: number }
  | { phase: 'summary'; result: SettlementOutcome }
  | { phase: 'todayPrompt'; taskIds: string[] }
  | { phase: 'main' };

export const flow = createStore<FlowState>({ phase: 'boot' });

// ---------------------------------------------------------------------------
// Floating reward texts ("+20 XP")
// ---------------------------------------------------------------------------
export interface FloatText {
  id: number;
  x: number;
  y: number;
  lines: { text: string; kind: 'xp' | 'gold' | 'vit' | 'loss' }[];
}
let floatId = 0;
export const floats = createStore<FloatText[]>([]);

export function spawnFloat(anchor: { x: number; y: number }, applied: Delta) {
  const lines: FloatText['lines'] = [];
  const sign = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);
  if (applied.xp) lines.push({ text: `${sign(applied.xp)} XP`, kind: applied.xp > 0 ? 'xp' : 'loss' });
  if (applied.gold) lines.push({ text: `${sign(applied.gold)} Gold`, kind: applied.gold > 0 ? 'gold' : 'loss' });
  if (applied.vitality)
    lines.push({ text: `${sign(applied.vitality)} Vitalität`, kind: applied.vitality > 0 ? 'vit' : 'loss' });
  if (lines.length === 0) return;
  const id = ++floatId;
  floats.set((f) => [...f, { id, x: anchor.x, y: anchor.y, lines }]);
  setTimeout(() => floats.set((f) => f.filter((t) => t.id !== id)), 1700);
}

export function anchorOf(el: Element | null): { x: number; y: number } {
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  // keep the (up to ~140px wide) text fully on screen
  const margin = 72;
  const x = Math.min(window.innerWidth - margin, Math.max(margin, r.left + r.width / 2));
  return { x, y: r.top };
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------
export interface Toast {
  id: number;
  text: string;
}
let toastId = 0;
export const toasts = createStore<Toast[]>([]);

export function toast(text: string) {
  const id = ++toastId;
  toasts.set((t) => [...t, { id, text }]);
  setTimeout(() => toasts.set((t) => t.filter((x) => x.id !== id)), 2800);
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
export type TabId = 'today' | 'character' | 'shop' | 'stats' | 'more';
export const activeTab = createStore<TabId>('today');
