import { dailyRowsForDay, habitsForDay } from '../game/selectors';
import type { DayLog, Task } from '../game/types';
import { tapHabit, toggleDaily, undoHabit } from '../state/actions';
import { useDayLogs, useTasks, useToday } from '../state/hooks';
import { activeTab } from '../state/ui';
import { Checkbox, PointsBadge, Section } from '../ui/controls';
import { PixelIcon } from '../ui/PixelIcon';

export function DailyItem({ task, done }: { task: Task; done: boolean }) {
  return (
    <li>
      <button
        className={`daily-row ${done ? 'done' : ''}`}
        onClick={(e) => toggleDaily(task.id, e.currentTarget.querySelector('.checkbox'))}
      >
        <Checkbox checked={done} label={task.title} />
        <span className="daily-title">{task.title}</span>
        <PointsBadge points={task.points} />
      </button>
    </li>
  );
}

export function HabitItem({ task, log }: { task: Task; log: DayLog | undefined }) {
  const plus = log?.plusCount ?? 0;
  const minus = log?.minusCount ?? 0;
  const hasTaps = (log?.taps.length ?? 0) > 0;
  return (
    <li className="habit-row">
      {task.minusPoints > 0 ? (
        <button className="habit-btn minus" onClick={(e) => tapHabit(task.id, 'minus', e.currentTarget)} aria-label={`${task.title} minus`}>
          −
        </button>
      ) : (
        <span className="habit-btn-spacer" />
      )}
      <div className="habit-main">
        <div className="habit-title">{task.title}</div>
        <div className="habit-meta">
          {task.plusPoints > 0 && <PointsBadge points={task.plusPoints} sign="+" />}
          {task.minusPoints > 0 && <PointsBadge points={task.minusPoints} sign="−" />}
          <span className="habit-count display">
            {task.plusPoints > 0 && <span className="plus">+{plus}</span>}
            {task.plusPoints > 0 && task.minusPoints > 0 && ' / '}
            {task.minusPoints > 0 && <span className="minus">−{minus}</span>}
            <span className="muted"> heute</span>
          </span>
        </div>
      </div>
      <button
        className="icon-btn habit-undo"
        disabled={!hasTaps}
        onClick={(e) => undoHabit(task.id, e.currentTarget)}
        aria-label="Letzten Tipp rückgängig"
        title="Letzten Tipp rückgängig"
      >
        <PixelIcon name="undo" size={18} />
      </button>
      {task.plusPoints > 0 ? (
        <button className="habit-btn plus" onClick={(e) => tapHabit(task.id, 'plus', e.currentTarget)} aria-label={`${task.title} plus`}>
          +
        </button>
      ) : (
        <span className="habit-btn-spacer" />
      )}
    </li>
  );
}

export function TodayScreen() {
  const today = useToday();
  const tasks = useTasks();
  const logs = useDayLogs(today);
  if (!tasks || !logs) return null;
  const rows = dailyRowsForDay(tasks, logs, today);
  const habits = habitsForDay(tasks, today);
  const logByTask = new Map(logs.map((l) => [l.taskId, l]));
  const doneCount = rows.filter((r) => r.done).length;

  return (
    <div className="screen">
      <Section
        title="Tägliche Aufgaben"
        right={
          <span className="display muted">
            {doneCount}/{rows.length}
          </span>
        }
      >
        {rows.length === 0 ? (
          <EmptyHint />
        ) : (
          <ul className="list">
            {rows.map((r) => (
              <DailyItem key={r.task.id} task={r.task} done={r.done} />
            ))}
          </ul>
        )}
        {rows.length > 0 && doneCount === rows.length && <p className="all-done display">Alles erledigt! Stark.</p>}
      </Section>

      <Section title="Gewohnheiten">
        {habits.length === 0 ? (
          <EmptyHint />
        ) : (
          <ul className="list">
            {habits.map((h) => (
              <HabitItem key={h.id} task={h} log={logByTask.get(h.id)} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function EmptyHint() {
  return (
    <p className="muted empty">
      Noch nichts hier. Unter <button className="link" onClick={() => activeTab.set('more')}>Mehr → Aufgaben verwalten</button> anlegen.
    </p>
  );
}
