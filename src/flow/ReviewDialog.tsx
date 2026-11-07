import { useState } from 'react';
import { formatDateKey } from '../game/dates';
import { dailyRowsForDay, habitsForDay } from '../game/selectors';
import type { ReviewInput } from '../game/settlement';
import { useDayLogs, useTasks } from '../state/hooks';
import { Checkbox, PointsBadge } from '../ui/controls';
import { Sheet } from '../ui/Sheet';

interface Props {
  date: string;
  olderDays: number;
  onDone: (input: ReviewInput) => void;
  onDismiss: () => void;
}

/** "Was hast du gestern geschafft?" – entries are a draft until "Fertig". */
export function ReviewDialog({ date, olderDays, onDone, onDismiss }: Props) {
  const tasks = useTasks();
  const logs = useDayLogs(date);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [taps, setTaps] = useState<Record<string, { plus: number; minus: number }>>({});
  const [busy, setBusy] = useState(false);

  if (!tasks || !logs) return null;
  const rows = dailyRowsForDay(tasks, logs, date);
  const open = rows.filter((r) => !r.done);
  const doneBefore = rows.length - open.length;
  const habits = habitsForDay(tasks, date);
  const logByTask = new Map(logs.map((l) => [l.taskId, l]));

  const toggle = (id: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const setTap = (id: string, kind: 'plus' | 'minus', value: number) =>
    setTaps((t) => ({ ...t, [id]: { ...(t[id] ?? { plus: 0, minus: 0 }), [kind]: Math.max(0, value) } }));

  const submit = () => {
    if (busy) return;
    setBusy(true);
    onDone({ date, checkedDailyIds: [...checked], habitTaps: taps });
  };
  const dismiss = () => {
    if (busy) return;
    setBusy(true);
    onDismiss();
  };

  return (
    <Sheet
      title="Was hast du gestern geschafft?"
      subtitle={formatDateKey(date)}
      onDismiss={dismiss}
      footer={
        <button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>
          Fertig
        </button>
      }
    >
      {olderDays > 0 && (
        <p className="notice">
          Du warst {olderDays === 1 ? 'einen weiteren Tag' : `${olderDays} weitere Tage`} nicht da. Diese Tage zählen als
          nicht erledigt.
        </p>
      )}

      <h3 className="display sub">Tägliche Aufgaben</h3>
      {open.length === 0 ? (
        <p className="all-done display">Gestern war alles erledigt!</p>
      ) : (
        <ul className="list">
          {open.map(({ task }) => (
            <li key={task.id}>
              <button className={`daily-row ${checked.has(task.id) ? 'done-draft' : ''}`} onClick={() => toggle(task.id)}>
                <Checkbox checked={checked.has(task.id)} label={task.title} />
                <span className="daily-title">{task.title}</span>
                <PointsBadge points={task.points} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {doneBefore > 0 && <p className="muted small">Bereits abgehakt: {doneBefore}</p>}

      {habits.length > 0 && (
        <>
          <h3 className="display sub">Gewohnheiten (gestern)</h3>
          <ul className="list">
            {habits.map((h) => {
              const log = logByTask.get(h.id);
              const add = taps[h.id] ?? { plus: 0, minus: 0 };
              return (
                <li key={h.id} className="review-habit">
                  <div className="habit-title">{h.title}</div>
                  <div className="review-habit-counters">
                    {h.plusPoints > 0 && (
                      <Counter
                        label="+"
                        base={log?.plusCount ?? 0}
                        extra={add.plus}
                        onChange={(v) => setTap(h.id, 'plus', v)}
                      />
                    )}
                    {h.minusPoints > 0 && (
                      <Counter
                        label="−"
                        base={log?.minusCount ?? 0}
                        extra={add.minus}
                        onChange={(v) => setTap(h.id, 'minus', v)}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className="muted small hint-bottom">Nach unten wischen oder ✕ = nichts weiter erledigt.</p>
    </Sheet>
  );
}

function Counter({ label, base, extra, onChange }: { label: string; base: number; extra: number; onChange: (v: number) => void }) {
  return (
    <div className={`counter ${label === '−' ? 'minus' : 'plus'}`}>
      <span className="counter-label display">{label}</span>
      <button className="stepper-btn" disabled={extra <= 0} onClick={() => onChange(extra - 1)} aria-label="weniger">
        −
      </button>
      <span className="stepper-value display">{base + extra}</span>
      <button className="stepper-btn" onClick={() => onChange(extra + 1)} aria-label="mehr">
        +
      </button>
    </div>
  );
}
