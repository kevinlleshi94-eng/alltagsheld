import { BALANCE } from '../game/balance';
import { xpToNextLevel } from '../game/progression';
import { isExhausted } from '../game/resources';
import { usePlayer } from '../state/hooks';
import { useStore } from '../state/store';
import { activeTab, floats, toasts, type TabId } from '../state/ui';
import { Bar } from './controls';
import { PixelIcon, type IconName } from './PixelIcon';

export function StatusBar() {
  const player = usePlayer();
  if (!player) return <div className="statusbar" />;
  const need = xpToNextLevel(player.level, BALANCE);
  const exhausted = isExhausted(player, BALANCE);
  return (
    <div className="statusbar">
      <button className="status-level display" onClick={() => activeTab.set('character')} aria-label="Charakter öffnen">
        Lv {player.level}
        {player.unspentPoints > 0 && <span className="badge">+{player.unspentPoints}</span>}
      </button>
      <div className="status-bars">
        <div className="status-row">
          <span className="status-label display">XP</span>
          <Bar value={player.xp} max={need} kind="xp" label="Erfahrung" />
          <span className="status-num display">
            {player.xp}/{need}
          </span>
        </div>
        <div className="status-row">
          <span className="status-label vit display" title="Vitalität – sinkt bei verpassten Aufgaben">VIT</span>
          <Bar value={player.vitality} max={BALANCE.vitality.max} kind={exhausted ? 'vit-low' : 'vit'} label="Vitalität" />
          <span className={`status-num display ${exhausted ? 'danger' : ''}`}>{player.vitality}</span>
        </div>
      </div>
      <div className="status-gold display">
        <PixelIcon name="coin" size={16} />
        {player.gold}
      </div>
    </div>
  );
}

const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'today', label: 'Heute', icon: 'today' },
  { id: 'character', label: 'Charakter', icon: 'hero' },
  { id: 'shop', label: 'Shop', icon: 'shop' },
  { id: 'stats', label: 'Statistik', icon: 'stats' },
  { id: 'more', label: 'Mehr', icon: 'more' },
];

export function TabBar() {
  const tab = useStore(activeTab);
  const player = usePlayer();
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`tab ${tab === t.id ? 'active' : ''}`}
          onClick={() => activeTab.set(t.id)}
          aria-current={tab === t.id ? 'page' : undefined}
        >
          <span className="tab-icon">
            <PixelIcon name={t.icon} size={22} />
            {t.id === 'character' && (player?.unspentPoints ?? 0) > 0 && <span className="tab-badge">{player!.unspentPoints}</span>}
          </span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function FloatingLayer() {
  const items = useStore(floats);
  return (
    <div className="float-layer" aria-live="polite">
      {items.map((f) => (
        <div key={f.id} className="float" style={{ left: f.x, top: f.y }}>
          {f.lines.map((l, i) => (
            <div key={i} className={`float-line display float-${l.kind}`} style={{ animationDelay: `${i * 90}ms` }}>
              {l.text}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function Toaster() {
  const items = useStore(toasts);
  return (
    <div className="toaster">
      {items.map((t) => (
        <div key={t.id} className="toast">
          {t.text}
        </div>
      ))}
    </div>
  );
}
