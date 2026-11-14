import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useState } from 'react';
import {
  createTask,
  deleteTask,
  reorderTasks,
  setTaskArchived,
  updateTask,
  validateDraft,
  type TaskDraft,
} from '../db/repo';
import type { Task, TaskType } from '../game/types';
import { guarded } from '../state/actions';
import { useTasks } from '../state/hooks';
import { toast } from '../state/ui';
import { useConfirm } from '../ui/Confirm';
import { BALANCE } from '../game/balance';
import { PointsBadge, Section, Stepper, Toggle } from '../ui/controls';
import { PixelIcon } from '../ui/PixelIcon';
import { Sheet } from '../ui/Sheet';

type EditorState = { mode: 'new'; type: TaskType } | { mode: 'edit'; task: Task } | null;

export function ManageTasksScreen() {
  const tasks = useTasks();
  const [type, setType] = useState<TaskType>('daily');
  const [editor, setEditor] = useState<EditorState>(null);
  const [showArchived, setShowArchived] = useState(false);
  if (!tasks) return null;

  const active = tasks.filter((t) => t.type === type && !t.archived).sort((a, b) => a.order - b.order);
  const archived = tasks.filter((t) => t.type === type && t.archived);

  return (
    <div className="screen">
      <div className="segmented">
        <button className={type === 'daily' ? 'active' : ''} onClick={() => setType('daily')}>
          Tägliche Aufgaben
        </button>
        <button className={type === 'habit' ? 'active' : ''} onClick={() => setType('habit')}>
          Gewohnheiten
        </button>
      </div>

      <Section
        title={type === 'daily' ? 'Täglich' : 'Gewohnheiten'}
        right={
          <button className="btn btn-small btn-primary" onClick={() => setEditor({ mode: 'new', type })}>
            + Neu
          </button>
        }
      >
        <p className="muted small">Zum Sortieren am Griff links ziehen. Antippen zum Bearbeiten.</p>
        <SortableTaskList tasks={active} onEdit={(task) => setEditor({ mode: 'edit', task })} />
      </Section>

      {archived.length > 0 && (
        <Section
          title={`Archiv (${archived.length})`}
          right={
            <button className="btn btn-small" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? 'Ausblenden' : 'Anzeigen'}
            </button>
          }
        >
          {showArchived && (
            <ul className="list">
              {archived.map((t) => (
                <li key={t.id} className="manage-row archived">
                  <button className="manage-main" onClick={() => setEditor({ mode: 'edit', task: t })}>
                    <span className="manage-title">{t.title}</span>
                    <TaskPoints task={t} />
                  </button>
                  <button className="btn btn-small" onClick={() => guarded(() => setTaskArchived(t.id, false))}>
                    Zurückholen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {editor && <TaskEditor state={editor} onClose={() => setEditor(null)} />}
    </div>
  );
}

/** v0.5: dailies and "+" have no points any more (every task is worth the same) – only "−" keeps its strength */
function TaskPoints({ task }: { task: Task }) {
  if (task.type === 'daily') return null;
  return (
    <span className="badges">
      {task.plusPoints > 0 && <span className="points-badge">+</span>}
      {task.minusPoints > 0 && <PointsBadge points={task.minusPoints} sign="−" />}
    </span>
  );
}

function SortableTaskList({ tasks, onEdit }: { tasks: Task[]; onEdit: (t: Task) => void }) {
  const [ids, setIds] = useState(tasks.map((t) => t.id));
  const key = tasks.map((t) => t.id).join('|');
  useEffect(() => setIds(key ? key.split('|') : []), [key]);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const next = arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
    setIds(next);
    guarded(() => reorderTasks(next));
  };

  if (tasks.length === 0) return <p className="muted empty">Keine aktiven Einträge.</p>;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="list">
          {ids.map((id) => {
            const t = byId.get(id);
            return t ? <SortableRow key={id} task={t} onEdit={onEdit} /> : null;
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  return (
    <li
      ref={setNodeRef}
      className={`manage-row ${isDragging ? 'dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button ref={setActivatorNodeRef} className="drag-handle" {...attributes} {...listeners} aria-label="Verschieben">
        <PixelIcon name="grip" size={18} />
      </button>
      <button className="manage-main" onClick={() => onEdit(task)}>
        <span className="manage-title">{task.title}</span>
        <TaskPoints task={task} />
      </button>
    </li>
  );
}

function TaskEditor({ state, onClose }: { state: NonNullable<EditorState>; onClose: () => void }) {
  const initial: TaskDraft =
    state.mode === 'edit'
      ? { ...state.task }
      : { type: state.type, title: '', points: 2, plusPoints: 1, minusPoints: 0 };
  const [draft, setDraft] = useState<TaskDraft>(initial);
  const [confirmUi, ask] = useConfirm();
  const error = validateDraft(draft);
  const isHabit = draft.type === 'habit';
  const existing = state.mode === 'edit' ? state.task : null;

  const save = async () => {
    if (error) return;
    const ok = await guarded(async () => {
      if (existing) await updateTask(existing.id, draft);
      else await createTask(draft);
      return true;
    });
    if (ok) onClose();
  };

  const remove = async () => {
    if (!existing) return;
    const yes = await ask({
      title: 'Aufgabe löschen?',
      message: (
        <>
          <p>„{existing.title}“ wird endgültig gelöscht – inklusive ihrer Historie in der Statistik.</p>
          <p className="muted small">Tipp: „Archivieren“ blendet sie aus und behält die Historie.</p>
        </>
      ),
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!yes) return;
    await guarded(() => deleteTask(existing.id));
    toast('Aufgabe gelöscht');
    onClose();
  };

  const toggleArchive = async () => {
    if (!existing) return;
    await guarded(() => setTaskArchived(existing.id, !existing.archived));
    toast(existing.archived ? 'Aufgabe zurückgeholt' : 'Aufgabe archiviert');
    onClose();
  };

  return (
    <Sheet
      title={existing ? 'Bearbeiten' : isHabit ? 'Neue Gewohnheit' : 'Neue tägliche Aufgabe'}
      onDismiss={onClose}
      size="auto"
      footer={
        <button className="btn btn-primary btn-block" disabled={!!error} onClick={save}>
          Speichern
        </button>
      }
    >
      <label className="field">
        <span>Titel</span>
        <input
          type="text"
          value={draft.title}
          maxLength={120}
          autoFocus={!existing}
          placeholder={isHabit ? 'z. B. Selbst gekocht' : 'z. B. Dehnen'}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </label>

      {!isHabit ? (
        <p className="muted small">
          Alle täglichen Aufgaben sind gleich viel wert: Zusammen bringen sie immer gleich viel XP und Gold, egal wie viele
          es sind.
        </p>
      ) : (
        <>
          <Toggle
            checked={draft.plusPoints > 0}
            onChange={(on) => setDraft({ ...draft, plusPoints: on ? 1 : 0 })}
            label="Plus-Button (gute Gewohnheit)"
          />
          <div className="field-row">
            <span>Minus-Stärke</span>
            <Stepper value={draft.minusPoints} min={0} max={10} onChange={(minusPoints) => setDraft({ ...draft, minusPoints })} />
          </div>
          <p className="muted small">
            Jede Gewohnheit zählt höchstens 1× am Tag. „+“ gibt einen kleinen Bonus, „−“ kostet je Stärke{' '}
            {BALANCE.habitMinus.vitalityLossPerPoint} Vitalität (0 = kein Minus-Button).
          </p>
        </>
      )}
      {error && draft.title.trim() && <p className="danger small">{error}</p>}

      {existing && (
        <div className="editor-actions">
          <button className="btn" onClick={toggleArchive}>
            {existing.archived ? 'Zurückholen' : 'Archivieren'}
          </button>
          <button className="btn btn-danger" onClick={remove}>
            Löschen
          </button>
        </div>
      )}
      {confirmUi}
    </Sheet>
  );
}
