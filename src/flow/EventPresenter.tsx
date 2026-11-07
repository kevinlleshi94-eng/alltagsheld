import { useEffect, useMemo, useState } from 'react';
import { playSfx } from '../audio/sfx';
import { getPlayer, spendAttributePoint } from '../db/repo';
import { BALANCE } from '../game/balance';
import { heroStats } from '../game/combat';
import type { Attribute, DeathReport, Player } from '../game/types';
import { formatStage } from '../game/world';
import { useEquippedItems, usePlayer } from '../state/hooks';
import { useStore } from '../state/store';
import { eventQueue, flow, popEvent, type QueuedEvent } from '../state/ui';
import { attributeGain } from '../ui/combatText';
import { ATTRIBUTES, ATTRIBUTE_NAMES as ATTR_NAMES, SLOT_NAMES } from '../ui/labels';
import { PixelIcon } from '../ui/PixelIcon';
import { Modal } from '../ui/Sheet';

/**
 * Shows queued events one after another.
 * Death screens appear as soon as the review/summary is done; other popups only on the main screen.
 */
export function EventPresenter() {
  const queue = useStore(eventQueue);
  const phase = useStore(flow).phase;
  const player = usePlayer();

  const canShowDeath = phase === 'main' || phase === 'todayPrompt';
  const death = canShowDeath ? queue.find((q) => q.event.type === 'death') : undefined;
  const next = death ?? (phase === 'main' ? queue[0] : undefined);

  // drop level-up popups that are no longer valid (level lost again).
  // Checked against the DB, not the live query: that may still lag behind
  // the action that produced the event.
  useEffect(() => {
    if (!next) return;
    if (next.event.type === 'levelDown') {
      popEvent(next.id);
      return;
    }
    if (next.event.type !== 'levelUp') return;
    const { level } = next.event;
    let alive = true;
    getPlayer()
      .then((p) => {
        if (alive && p.level < level) popEvent(next.id);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [next]);

  if (!next || !player) return null;
  if (next.event.type === 'death') return <DeathScreen report={next.event.report} onClose={() => popEvent(next.id)} />;
  if (next.event.type === 'levelUp' && player.level >= next.event.level)
    return <LevelUpPopup key={next.id} item={next} level={next.event.level} player={player} />;
  return null;
}

function LevelUpPopup({ item, level, player }: { item: QueuedEvent; level: number; player: Player }) {
  const unspent = player.unspentPoints;
  const equipped = useEquippedItems(player);
  const stats = heroStats(player, equipped, BALANCE);
  const [busy, setBusy] = useState(false);
  useEffect(() => playSfx('levelUp'), []);
  // the point is spent right here – there is no "later" (user feedback)
  const choose = async (a: Attribute) => {
    if (busy) return;
    setBusy(true);
    try {
      await spendAttributePoint(a);
    } finally {
      popEvent(item.id);
    }
  };
  return (
    <Modal
      className="levelup-modal"
      effect={<LevelUpEffect />}
      title={
        <>
          <span className="levelup-burst" aria-hidden />
          Level {level}!
        </>
      }
      actions={
        unspent > 0 ? null : (
          <button className="btn btn-block" onClick={() => popEvent(item.id)}>
            Weiter
          </button>
        )
      }
    >
      {unspent > 0 ? (
        <>
          <p>Du bekommst 1 Attributpunkt. Wähle:</p>
          <div className="attr-choices">
            {ATTRIBUTES.map((a) => (
              <button key={a.id} className="attr-choice" disabled={busy} onClick={() => choose(a.id)}>
                <span className="display">{a.label}</span>
                <span className="muted small">{attributeGain(stats, a.id, BALANCE)}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="muted">Deine Punkte sind bereits verteilt.</p>
      )}
    </Modal>
  );
}

function LevelUpEffect() {
  const sparks = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        left: `${(i * 37 + 11) % 100}%`,
        delay: `${(i % 9) * 0.13}s`,
        duration: `${1.5 + (i % 5) * 0.25}s`,
        size: i % 3 === 0 ? 6 : 4,
      })),
    [],
  );
  return (
    <div className="levelup-fx" aria-hidden>
      <div className="levelup-rays" />
      <div className="levelup-flash" />
      {sparks.map((s, i) => (
        <span
          key={i}
          className="levelup-spark"
          style={{ left: s.left, animationDelay: s.delay, animationDuration: s.duration, width: s.size, height: s.size }}
        />
      ))}
    </div>
  );
}

function DeathScreen({ report, onClose }: { report: DeathReport; onClose: () => void }) {
  useEffect(() => playSfx('death'), []);
  const lines: string[] = [];
  if (report.levelAfter < report.levelBefore) lines.push(`Level ${report.levelBefore} → ${report.levelAfter}`);
  if (report.removedPoint === 'unspent') lines.push('Ein aufgehobener Attributpunkt ist verloren');
  else if (report.removedPoint) lines.push(`Attributpunkt verloren: ${ATTR_NAMES[report.removedPoint]}`);
  if (report.goldLost > 0) lines.push(`${report.goldLost} Gold verloren`);
  if (report.brokenItem)
    lines.push(`Zerbrochen: ${report.brokenItem.name ?? 'Ausrüstung'} (${SLOT_NAMES[report.brokenItem.slot]})`);
  if (report.stageBefore.stage !== report.stageAfter.stage)
    lines.push(`Zurück nach ${formatStage(report.stageAfter, BALANCE.combat.stagesPerArea)}`);
  lines.push('Deine Vitalität ist wiederhergestellt');

  return (
    <div className="death-screen" role="alertdialog" aria-modal="true">
      <div className="death-inner">
        <PixelIcon name="skull" size={72} className="death-skull" />
        <h1 className="display death-title">Du bist gefallen …</h1>
        <ul className="death-list">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <button className="btn btn-primary death-btn" onClick={onClose}>
          Wieder aufstehen
        </button>
      </div>
    </div>
  );
}
