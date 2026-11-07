import type { SettlementOutcome } from '../db/repo';
import { formatDateKey } from '../game/dates';
import { Modal } from '../ui/Sheet';

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0');

export function SummaryDialog({ result, onClose }: { result: SettlementOutcome; onClose: () => void }) {
  const summaries = result.summaries;
  const yesterday = summaries[summaries.length - 1];
  const older = summaries.slice(0, -1);
  const died = summaries.some((s) => s.died);
  const olderVitality = older.reduce((s, d) => s + d.vitality, 0);
  const skipped = summaries.some((s) => s.penaltiesSkipped);

  return (
    <Modal
      title="Tagesabrechnung"
      className="summary-modal"
      actions={
        <button className="btn btn-primary btn-block" onClick={onClose}>
          Weiter
        </button>
      }
    >
      {yesterday && (
        <div className="summary-day">
          <div className="summary-date muted">Gestern · {formatDateKey(yesterday.date)}</div>
          <div className="summary-line display">
            {yesterday.doneCount}/{yesterday.totalCount} erledigt
          </div>
          <div className="summary-stats display">
            <span className="xp">{signed(yesterday.xp)} XP</span>
            <span className="gold">{signed(yesterday.gold)} Gold</span>
            <span className={yesterday.vitality < 0 ? 'loss' : 'vit'}>{signed(yesterday.vitality)} Vitalität</span>
          </div>
        </div>
      )}
      {older.length > 0 && (
        <p className="summary-older">
          Davor: {older.length} {older.length === 1 ? 'Tag' : 'Tage'} ohne Eintrag ({formatDateKey(older[0].date, false)}
          {older.length > 1 && `–${formatDateKey(older[older.length - 1].date, false)}`}) ·{' '}
          <span className="loss display">{signed(olderVitality)} Vitalität</span>
        </p>
      )}
      {died && (
        <p className="summary-death display">
          Deine Vitalität ist auf 0 gefallen.
          {skipped && <span className="small muted"> Weitere Strafen wurden danach nicht mehr angewendet.</span>}
        </p>
      )}
    </Modal>
  );
}
