import { isTaskActiveOn } from './taskActions';
import type { DayLog, Task } from './types';

export interface DailyRow {
  task: Task;
  log: DayLog | undefined;
  done: boolean;
}

/** Today's dailies: open ones first, done ones at the bottom (each group by order) */
export function dailyRowsForDay(tasks: Task[], logs: DayLog[], date: string): DailyRow[] {
  const byTask = new Map(logs.filter((l) => l.date === date).map((l) => [l.taskId, l]));
  return tasks
    .filter((t) => t.type === 'daily' && isTaskActiveOn(t, date))
    .map((task) => {
      const log = byTask.get(task.id);
      return { task, log, done: !!log?.done };
    })
    .sort((a, b) => Number(a.done) - Number(b.done) || a.task.order - b.task.order);
}

export function habitsForDay(tasks: Task[], date: string): Task[] {
  return tasks.filter((t) => t.type === 'habit' && isTaskActiveOn(t, date)).sort((a, b) => a.order - b.order);
}

export function openDailiesCount(tasks: Task[], logs: DayLog[], date: string): number {
  return dailyRowsForDay(tasks, logs, date).filter((r) => !r.done).length;
}
