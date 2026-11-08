import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { playSfx } from '../audio/sfx';
import { equipItemById, type ChestOutcome } from '../db/repo';
import type { ChestId } from '../game/items';
import { guarded } from '../state/actions';
import { prefersReducedMotion, usePauseFight } from '../state/hooks';
import { toast } from '../state/ui';
import { CHEST_NAMES, RARITY_COLORS, RARITY_NAMES, SLOT_NAMES } from '../ui/labels';
import { PixelSprite } from '../ui/PixelIcon';
import { Portal } from '../ui/Portal';
import { CHEST_CLOSED, CHEST_OPEN, chestPalette, mix, rgba } from './art';
import { ItemIcon, StatCompare } from './ItemViews';

type Stage = 'shake' | 'open' | 'reveal';

/** animation lengths (ms); "Bewegung reduzieren" → short fades only */
const TIMING = {
  normal: { shake: 1150, open: 950 },
  reduced: { shake: 250, open: 450 },
};
const SPARKS = 14;

/**
 * SPEC 7.3: chest wobbles → pops open → light beam in the rarity colour → item with comparison,
 * then „Anlegen“ or „Ins Inventar“. The item is already stored (unequipped) when this opens,
 * so closing the app mid-animation loses nothing. Tap skips ahead.
 */
export function ChestOpening({
  chest,
  outcome,
  caption,
  onDone,
}: {
  chest: ChestId;
  outcome: ChestOutcome;
  /** small line above the closed chest, e.g. „Beute vom Boss!“ */
  caption?: string;
  onDone: () => void;
}) {
  const { item, current } = outcome;
  usePauseFight();
  const reduced = useMemo(prefersReducedMotion, []);
  const timing = reduced ? TIMING.reduced : TIMING.normal;
  const [stage, setStage] = useState<Stage>('shake');
  const [busy, setBusy] = useState(false);
  const rare = item.rarity === 'epic' || item.rarity === 'legendary';
  const color = RARITY_COLORS[item.rarity];

  useEffect(() => {
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    if (stage === 'shake') {
      playSfx('chestShake');
      if (!reduced) at(560, () => playSfx('chestShake'));
      at(timing.shake, () => setStage('open'));
    } else if (stage === 'open') {
      playSfx('chestOpen');
      if (rare) at(240, () => playSfx('chestRare'));
      at(timing.open, () => setStage('reveal'));
    }
    return () => timers.forEach((t) => clearTimeout(t));
  }, [stage, reduced, rare, timing]);

  const skip = () => {
    if (stage === 'shake') setStage('open');
    else if (stage === 'open') setStage('reveal');
  };

  const equip = async () => {
    setBusy(true);
    const ok = await guarded(async () => (await equipItemById(item.id), true));
    setBusy(false);
    if (ok) {
      toast(`${item.name} angelegt`);
      onDone();
    }
  };
  const keep = () => {
    toast('Ins Inventar gelegt');
    onDone();
  };

  const style = {
    '--rarity': color,
    '--rarity-light': mix(color, '#ffffff', 0.55),
    '--rarity-ray': rgba(color, 0.22),
  } as CSSProperties;
  const opened = stage !== 'shake';

  return (
    <Portal>
      <div className="modal-backdrop chest-backdrop" style={style}>
        <div className={`chest-scene stage-${stage} ${rare ? 'rare' : ''}`} onClick={skip} aria-hidden={stage !== 'reveal'}>
          {opened && (
            <>
              {item.rarity === 'legendary' && <div className="chest-rays" />}
              <div className="chest-flash" />
              <div className="chest-beam" />
              {rare &&
                Array.from({ length: SPARKS }, (_, i) => (
                  <span
                    key={i}
                    className="chest-spark"
                    style={{ left: `${18 + ((i * 41) % 64)}%`, animationDelay: `${((i * 0.29) % 1.8).toFixed(2)}s` }}
                  />
                ))}
              <div className="chest-item">
                <ItemIcon slot={item.slot} rarity={item.rarity} scale={5} />
              </div>
            </>
          )}
          <div className="chest-sprite">
            <PixelSprite
              rows={opened ? CHEST_OPEN : CHEST_CLOSED}
              palette={chestPalette(chest, opened ? item.rarity : undefined)}
              scale={6}
            />
          </div>
          {!opened && (
            <div className="chest-caption display">
              {caption && <div className="chest-overline">{caption}</div>}
              {CHEST_NAMES[chest]}
            </div>
          )}
        </div>

        {stage === 'reveal' && (
          <div className={`modal chest-result ${rare ? 'rare' : ''}`} role="dialog" aria-modal="true">
            <div className="chest-rarity display">
              {RARITY_NAMES[item.rarity]} · {SLOT_NAMES[item.slot]}
            </div>
            <h2 className="display chest-item-name">{item.name}</h2>
            <StatCompare stats={item.stats} current={current?.stats ?? null} compare />
            <p className="muted small">
              {current ? `Verglichen mit: ${current.name}` : `Der Platz „${SLOT_NAMES[item.slot]}“ ist noch leer.`}
            </p>
            <div className="modal-actions">
              <button className="btn" onClick={keep} disabled={busy}>
                Ins Inventar
              </button>
              <button className="btn btn-primary" onClick={equip} disabled={busy}>
                Anlegen
              </button>
            </div>
          </div>
        )}
      </div>
    </Portal>
  );
}
