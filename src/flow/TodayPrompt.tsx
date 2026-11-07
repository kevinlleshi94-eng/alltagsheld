import { formatDateKey } from '../game/dates';
import { habitsForDay } from '../game/selectors';
import { DailyItem, HabitItem } from '../screens/TodayScreen';
import { useDayLogs, useTasks, useToday } from '../state/hooks';
import { Sheet } from '../ui/Sheet';

/** "Heute" prompt: today's open dailies (checks apply immediately) + habit buttons */
export function TodayPrompt({ taskIds, onClose }: { taskIds: string[]; onClose: () => void }) {
  const today = useToday();
  const tasks = useTasks();
  const logs = useDayLogs(today);
  if (!tasks || !logs) return null;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const logByTask = new Map(logs.map((l) => [l.taskId, l]));
  const dailies = taskIds.map((id) => byId.get(id)).filter((t) => t && !t.archived);
  const habits = habitsForDay(tasks, today);
  const openCount = dailies.filter((t) => !logByTask.get(t!.id)?.done).length;

  return (
    <Sheet
      title="Heute"
      subtitle={`${formatDateKey(today)} · noch ${openCount} offen`}
      onDismiss={onClose}
      footer={
        <button className="btn btn-primary btn-block" onClick={onClose}>
          Fertig
        </button>
      }
    >
      <h3 className="display sub">Was hast du heute schon geschafft?</h3>
      <ul className="list">
        {dailies.map((t) => (
          <DailyItem key={t!.id} task={t!} done={!!logByTask.get(t!.id)?.done} />
        ))}
      </ul>
      {habits.length > 0 && (
        <>
          <h3 className="display sub">Gewohnheiten</h3>
          <ul className="list">
            {habits.map((h) => (
              <HabitItem key={h.id} task={h} log={logByTask.get(h.id)} />
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}
