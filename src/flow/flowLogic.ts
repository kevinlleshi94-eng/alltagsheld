import { db } from '../db/db';
import { getPendingDays, runSettlement, todayKey } from '../db/repo';
import { dailyRowsForDay } from '../game/selectors';
import type { ReviewInput } from '../game/settlement';
import { guarded } from '../state/actions';
import { flow, pushEvents } from '../state/ui';

export type FlowTrigger = 'open' | 'resume' | 'tick';

let checking = false;

/**
 * Decides what comes next when the app opens / resumes / the date changes:
 * review yesterday → summary → today prompt → main.
 * 'tick' only reacts to a day change (no today prompt).
 */
export async function startFlow(trigger: FlowTrigger) {
  if (checking) return;
  checking = true;
  try {
    await decide(trigger);
  } finally {
    checking = false;
  }
}

async function decide(trigger: FlowTrigger) {
  const current = flow.get().phase;
  if (current !== 'main' && current !== 'boot') return; // a flow is already running
  const pending = await getPendingDays();
  if (pending.length > 0) {
    flow.set({ phase: 'review', date: pending[pending.length - 1], olderDays: pending.length - 1 });
    return;
  }
  if (trigger === 'tick') {
    if (current === 'boot') flow.set({ phase: 'main' });
    return;
  }
  await goToTodayPromptOrMain();
}

export async function goToTodayPromptOrMain() {
  const settings = await db.settings.get('settings');
  if (settings?.todayPromptEnabled) {
    const today = todayKey();
    const [tasks, logs] = await Promise.all([db.tasks.toArray(), db.dayLogs.where('date').equals(today).toArray()]);
    const taskIds = dailyRowsForDay(tasks, logs, today)
      .filter((r) => !r.done)
      .map((r) => r.task.id);
    if (taskIds.length > 0) {
      flow.set({ phase: 'todayPrompt', taskIds });
      return;
    }
  }
  flow.set({ phase: 'main' });
}

/** Called by the review dialog: "Fertig" (with input) or dismissed (null) */
export async function finishReview(review: ReviewInput | null) {
  const result = await guarded(() => runSettlement(review));
  if (result) {
    pushEvents(result.events);
    flow.set({ phase: 'summary', result });
  } else {
    await goToTodayPromptOrMain();
  }
}
