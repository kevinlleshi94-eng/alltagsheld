import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { configureSfx, resumeAudio } from '../audio/sfx';
import { recordVictory, updateSettings } from '../db/repo';
import { BALANCE } from '../game/balance';
import { heroStats, type HeroStats } from '../game/combat';
import { isExhausted } from '../game/resources';
import { areaDef, areaLabel } from '../game/world';
import { useEquippedItems, usePlayer, useSettings } from '../state/hooks';
import { useStore } from '../state/store';
import type { StagePosition } from '../game/types';
import { activeTab, eventQueue, fightBlockers, flow, pushEvents } from '../state/ui';
import { formatNumber } from '../ui/combatText';
import { PixelIcon } from '../ui/PixelIcon';
import { gearOf } from './assets/catalog';
import { battleHud, battleInput, battleTimer, type BattleBanner } from './bridge';
import type { BattleGameHandle } from './game';

/** a chest from a boss opens after the gold banner has been visible for a moment */
const CHEST_DROP_DELAY_MS = 1600;

/** stores a won fight; a chest dropped by a boss is shown as popup (item is already in the inventory) */
async function saveVictory(pos: StagePosition) {
  const r = await recordVictory(pos);
  const drop = r?.reward?.drop;
  if (r && drop) {
    const current = r.dropCurrent;
    window.setTimeout(
      () => pushEvents([{ type: 'chestDrop', chest: drop.chest, item: drop.item, current }]),
      CHEST_DROP_DELAY_MS,
    );
  }
  return r;
}

/** Top area: Phaser canvas + HTML overlays (labels, timer, banner, hint) */
export function BattleView() {
  const player = usePlayer();
  const settings = useSettings();
  const equipped = useEquippedItems(player);
  const phase = useStore(flow).phase;
  const queued = useStore(eventQueue).length;
  const blockers = useStore(fightBlockers);
  const hud = useStore(battleHud);
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const stats = useMemo(() => (player ? heroStats(player, equipped, BALANCE) : null), [player, equipped]);
  const gear = useMemo(() => gearOf(equipped), [equipped]);

  // React → scene
  useEffect(() => {
    if (!player || !stats) return;
    battleInput.set({
      position: { round: player.round, area: player.area, stage: player.stage },
      hero: stats,
      gear,
      paused: phase !== 'main' || queued > 0 || blockers > 0,
    });
  }, [player, stats, gear, phase, queued, blockers]);

  // mount the game once (engine is loaded lazily)
  useEffect(() => {
    let cancelled = false;
    let handle: BattleGameHandle | undefined;
    (async () => {
      try {
        const { createBattleGame } = await import('./game');
        if (cancelled || !hostRef.current) return;
        handle = createBattleGame(hostRef.current, { onVictory: saveVictory });
      } catch (err) {
        console.error('Kampfszene konnte nicht starten', err);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      handle?.destroy();
    };
  }, []);

  // The canvas host must stay mounted at all times: the Phaser game lives inside it
  // and is created only once. (Resetting the game briefly has no player – rendering
  // a different tree then used to throw the canvas out of the page.)
  const exhausted = !!player && isExhausted(player, BALANCE);
  const area = player ? areaDef(player.area) : null;
  const offsetDays = Math.round((settings?.devTimeOffsetMs ?? 0) / 86_400_000);

  return (
    <div className={`battle ${exhausted ? 'exhausted' : ''}`} style={area ? { background: area.palette[0] } : undefined}>
      <div className="battle-canvas" ref={hostRef} aria-hidden />
      {player && stats && area && (
        <>
          <div className="battle-stage display">
            <span className="battle-stage-area">{areaLabel(player.area, player.round)}</span>
            <span>
              Stufe {player.stage}/{BALANCE.combat.stagesPerArea}
            </span>
          </div>
          <TimerBar />
          <HeroStatsPanel stats={stats} />
          <SoundButton enabled={settings?.soundEnabled ?? true} volume={settings?.volume ?? 0.7} />
          {hud.attempts >= BALANCE.combat.failHintAfterAttempts && (
            <div className="battle-hint">Erledige Aufgaben, um stärker zu werden.</div>
          )}
          {hud.enemyName && <div className={`battle-name foe display ${hud.kind}`}>{hud.enemyName}</div>}
          {exhausted && <div className="battle-name hero display exhausted-label">Erschöpft</div>}
          {hud.banner && <Banner key={hud.banner.id} banner={hud.banner} />}
          {(import.meta.env.DEV || offsetDays !== 0) && (
            // PC test version (dev server) must be recognisable next to the installed online app
            <div className={`dev-chip display ${import.meta.env.DEV ? 'pc' : ''}`}>
              {[import.meta.env.DEV && 'PC-Test', offsetDays !== 0 && `DEV +${offsetDays} T`].filter(Boolean).join(' · ')}
            </div>
          )}
        </>
      )}
      {failed && <div className="battle-note">Kampfszene konnte nicht geladen werden.</div>}
    </div>
  );
}

function TimerBar() {
  const t = useStore(battleTimer);
  if (!t.active || t.total <= 0) return null;
  const frac = Math.max(0, Math.min(1, t.left / t.total));
  return (
    <div className={`battle-timer ${t.left <= 3 ? 'urgent' : ''}`} role="timer" aria-label="Kampfzeit">
      <span className="display">{Math.ceil(t.left)} s</span>
      <div className="battle-timer-track">
        <div className="battle-timer-fill" style={{ width: `${frac * 100}%` }} />
      </div>
    </div>
  );
}

/** combat values at a glance – tap opens the character tab */
function HeroStatsPanel({ stats }: { stats: HeroStats }) {
  return (
    <button className="battle-stats display" onClick={() => activeTab.set('character')} aria-label="Kampfwerte – Charakter öffnen">
      <span title="Schaden pro Treffer (Stärke)">
        <PixelIcon name="sword" size={13} />
        {formatNumber(stats.damage)}
      </span>
      <span title="Lebenspunkte im Kampf (Leben)">
        <PixelIcon name="heart" size={13} />
        {formatNumber(stats.maxHp)}
      </span>
      <span title="Angriff alle … Sekunden (Tempo)">
        <PixelIcon name="bolt" size={13} />
        {formatNumber(stats.attackInterval, 2)} s
      </span>
      <span title="Chance auf kritischen Treffer">
        <PixelIcon name="star" size={13} />
        {formatNumber(stats.critChance * 100)} %
      </span>
    </button>
  );
}

function SoundButton({ enabled, volume }: { enabled: boolean; volume: number }) {
  const toggle = () => {
    const next = !enabled;
    // switch immediately (inside the tap, so iOS allows audio), then persist
    configureSfx({ enabled: next, volume });
    if (next) resumeAudio();
    void updateSettings({ soundEnabled: next });
  };
  return (
    <button
      className={`battle-sound ${enabled ? '' : 'off'}`}
      onClick={toggle}
      aria-label={enabled ? 'Ton ausschalten' : 'Ton einschalten'}
      aria-pressed={!enabled}
    >
      <PixelIcon name={enabled ? 'speaker' : 'speakerOff'} size={20} />
    </button>
  );
}

/** how long each banner stays (area banners span the whole black screen + fade-in) */
const BANNER_MS: Record<BattleBanner['kind'], number> = {
  boss: 2000,
  areaBoss: 2000,
  reward: 2200,
  cleared: 2700,
  area: 3600,
  round: 4200,
};

function Banner({ banner }: { banner: BattleBanner }) {
  const [visible, setVisible] = useState(true);
  const ms = BANNER_MS[banner.kind];
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), ms);
    return () => clearTimeout(t);
  }, [ms]);
  if (!visible) return null;
  return (
    <div className={`battle-banner ${banner.kind}`} style={{ '--banner-ms': `${ms}ms` } as CSSProperties}>
      {banner.overline && <div className="battle-banner-over display">{banner.overline}</div>}
      <div className="battle-banner-title display">{banner.title}</div>
      {banner.subtitle && <div className="battle-banner-sub display">{banner.subtitle}</div>}
    </div>
  );
}
