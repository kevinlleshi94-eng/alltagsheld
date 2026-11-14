import { BALANCE } from '../game/balance';
import { quotaEffect } from '../game/resources';
import { dailyRowsForDay, habitsForDay } from '../game/selectors';
import { habitUsedUp } from '../game/taskActions';
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
      </button>
    </li>
  );
}

/** every habit counts once per day (feedback v0.5): after a tap both buttons rest until tomorrow (undo still works) */
export function HabitItem({ task, log }: { task: Task; log: DayLog | undefined }) {
  const plus = log?.plusCount ?? 0;
  const minus = log?.minusCount ?? 0;
  const hasTaps = (log?.taps.length ?? 0) > 0;
  const usedUp = habitUsedUp(log, BALANCE);
  const state = plus > 0 ? 'plus' : minus > 0 ? 'minus' : null;
  return (
    <li className={`habit-row ${state ? `tapped-${state}` : ''}`}>
      {task.minusPoints > 0 ? (
        <button
          className="habit-btn minus"
          disabled={usedUp}
          onClick={(e) => tapHabit(task.id, 'minus', e.currentTarget)}
          aria-label={`${task.title} minus`}
        >
          −
        </button>
      ) : (
        <span className="habit-btn-spacer" />
      )}
      <div className="habit-main">
        <div className="habit-title">{task.title}</div>
        <div className="habit-meta">
          {task.minusPoints > 0 && <PointsBadge points={task.minusPoints} sign="−" />}
          <span className="habit-count display">
            {state === 'plus' && <span className="plus">✓ heute geschafft</span>}
            {state === 'minus' && <span className="minus">✗ heute passiert</span>}
            {!state && <span className="muted">heute noch offen</span>}
          </span>
        </div>
      </div>
      <button
        className="icon-btn habit-undo"
        disabled={!hasTaps}
        onClick={(e) => undoHabit(task.id, e.currentTarget)}
        aria-label="Tipp rückgängig"
        title="Tipp rückgängig"
      >
        <PixelIcon name="undo" size={18} />
      </button>
      {task.plusPoints > 0 ? (
        <button
          className="habit-btn plus"
          disabled={usedUp}
          onClick={(e) => tapHabit(task.id, 'plus', e.currentTarget)}
          aria-label={`${task.title} plus`}
        >
          +
        </button>
      ) : (
        <span className="habit-btn-spacer" />
      )}
    </li>
  );
}

/** today's quota and what it will mean at midnight (vitality ±, perfect-day gold) */
export function QuotaMeter({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  const q = done / total;
  const effect = quotaEffect(done, total, BALANCE);
  const { neutralFrom, neutralTo } = BALANCE.vitality.quota;
  const zone = effect.vitality < 0 ? 'loss' : effect.vitality > 0 ? 'gain' : 'neutral';
  const vit = effect.vitality > 0 ? `+${effect.vitality}` : effect.vitality < 0 ? `−${-effect.vitality}` : '±0';
  return (
    <div className={`quota quota-${zone}`}>
      <div className="quota-bar" role="img" aria-label={`${Math.round(q * 100)} % erledigt`}>
        <div className="quota-fill" style={{ width: `${q * 100}%` }} />
        <span className="quota-mark" style={{ left: `${neutralFrom * 100}%` }} />
        <span className="quota-mark" style={{ left: `${neutralTo * 100}%` }} />
      </div>
      <div className="quota-text small">
        <span className="display">{Math.round(q * 100)} %</span>
        <span>
          Heute Nacht: <b className="display">{vit} Vitalität</b>
          {effect.gold > 0 && <b className="display gold"> · +{effect.gold} Gold Bonus</b>}
        </span>
      </div>
    </div>
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
        <QuotaMeter done={doneCount} total={rows.length} />
        {rows.length === 0 ? (
          <EmptyHint />
        ) : (
          <ul className="list">
            {rows.map((r) => (
              <DailyItem key={r.task.id} task={r.task} done={r.done} />
            ))}
          </ul>
        )}
        {rows.length > 0 && doneCount === rows.length && <p className="all-done display">Alles erledigt! Stark. Heute Nacht gibt es den Bonus.</p>}
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
