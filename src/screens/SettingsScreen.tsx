import { useEffect, useRef, useState } from 'react';
import { createSnapshot, markBackupDone, parseSnapshot, restoreSnapshot, snapshotFileName } from '../db/backup';
import {
  devAddResources,
  devAdvanceDays,
  devSetStage,
  devSetVitality,
  renamePlayer,
  resetGame,
  todayKey,
  updateSettings,
} from '../db/repo';
import { BALANCE } from '../game/balance';
import { formatDateKey } from '../game/dates';
import { startFlow } from '../flow/flowLogic';
import { guarded } from '../state/actions';
import { usePlayer, useSettings, useToday } from '../state/hooks';
import { eventQueue, flow, pushEvents, toast } from '../state/ui';
import { useConfirm } from '../ui/Confirm';
import { Section, Toggle } from '../ui/controls';

const DEV_KEY = 'alltagsheld.devMenu';

function formatDateTime(ms: number | null): string {
  if (!ms) return 'noch nie';
  return new Date(ms).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

/** After import / reset: forget queued popups and run the open-flow again */
function restartFlow() {
  eventQueue.set([]);
  flow.set({ phase: 'main' });
  startFlow('open');
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function SettingsScreen() {
  const settings = useSettings();
  const player = usePlayer();
  const [confirmUi, ask] = useConfirm();
  const [name, setName] = useState('');
  const [prepared, setPrepared] = useState<File | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [devOpen, setDevOpen] = useState(() => localStorage.getItem(DEV_KEY) === '1');
  const versionTaps = useRef<number[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (player && !name) setName(player.name);
  }, [player, name]);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  if (!settings || !player) return null;

  // --- Backup -------------------------------------------------------------
  const exportBackup = async () => {
    const snap = await guarded(createSnapshot);
    if (!snap) return;
    const file = new File([JSON.stringify(snap)], snapshotFileName(snap), { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      setPrepared(file); // sharing needs a fresh tap (iOS)
    } else {
      download(file);
      await markBackupDone();
      toast('Backup heruntergeladen');
    }
  };

  const sharePrepared = async () => {
    if (!prepared) return;
    try {
      await navigator.share({ files: [prepared], title: 'Alltagsheld-Backup' });
      await markBackupDone();
      toast('Backup gesichert');
      setPrepared(null);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast('Teilen nicht möglich – bitte „Herunterladen“ nutzen.');
    }
  };

  const importBackup = async (file: File) => {
    let snap;
    try {
      snap = parseSnapshot(await file.text());
    } catch (e) {
      toast((e as Error).message);
      return;
    }
    const yes = await ask({
      title: 'Backup importieren?',
      message: (
        <p>
          Sicherung vom {formatDateTime(snap.exportedAt)} ({snap.data.player.name}, Level {snap.data.player.level}).
          Der aktuelle Spielstand wird dabei <strong>überschrieben</strong>.
        </p>
      ),
      confirmLabel: 'Importieren',
      danger: true,
    });
    if (!yes) return;
    if (await guarded(async () => (await restoreSnapshot(snap), true))) {
      toast('Backup importiert');
      restartFlow();
    }
  };

  // --- Reset --------------------------------------------------------------
  const reset = async () => {
    const first = await ask({
      title: 'Spielstand zurücksetzen?',
      message: <p>Alle Aufgaben, die Historie, Level, Gold und Einstellungen werden gelöscht.</p>,
      confirmLabel: 'Weiter',
      danger: true,
    });
    if (!first) return;
    const second = await ask({
      title: 'Wirklich alles löschen?',
      message: <p>Das kann nicht rückgängig gemacht werden. Tipp: vorher ein Backup exportieren.</p>,
      confirmLabel: 'Endgültig löschen',
      danger: true,
    });
    if (!second) return;
    if (await guarded(async () => (await resetGame(), true))) {
      localStorage.removeItem(DEV_KEY);
      setDevOpen(false);
      setName('');
      toast('Spielstand zurückgesetzt');
      restartFlow();
    }
  };

  // --- Hidden dev menu: tap the version 5× -----------------------------------
  const onVersionTap = () => {
    const now = Date.now();
    versionTaps.current = [...versionTaps.current.filter((t) => now - t < 3000), now];
    if (versionTaps.current.length >= 5) {
      versionTaps.current = [];
      const next = !devOpen;
      setDevOpen(next);
      if (next) localStorage.setItem(DEV_KEY, '1');
      else localStorage.removeItem(DEV_KEY);
      toast(next ? 'Entwicklermenü freigeschaltet' : 'Entwicklermenü ausgeblendet');
    }
  };

  const backupAgeDays = player.lastBackupAt ? Math.floor((Date.now() - player.lastBackupAt) / 86_400_000) : null;

  return (
    <div className="screen">
      <Section title="Held">
        <label className="field">
          <span>Name</span>
          <div className="inline-field">
            <input type="text" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
            <button
              className="btn btn-small btn-primary"
              disabled={!name.trim() || name.trim() === player.name}
              onClick={async () => {
                await guarded(() => renamePlayer(name));
                toast('Name gespeichert');
              }}
            >
              Speichern
            </button>
          </div>
        </label>
      </Section>

      <Section title="Ton">
        <Toggle label="Soundeffekte" checked={settings.soundEnabled} onChange={(v) => updateSettings({ soundEnabled: v })} />
        <label className="field-row">
          <span>Lautstärke</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            disabled={!settings.soundEnabled}
            onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
          />
        </label>
        <p className="muted small">Schnell an und aus: Lautsprecher-Taste oben rechts im Kampf.</p>
      </Section>

      <Section title="Ablauf">
        <Toggle
          label="Abfrage „Heute“ beim Öffnen"
          checked={settings.todayPromptEnabled}
          onChange={(v) => updateSettings({ todayPromptEnabled: v })}
        />
      </Section>

      <Section title="Backup">
        <p className="muted small">
          Letztes Backup: {formatDateTime(player.lastBackupAt)}
          {backupAgeDays !== null && backupAgeDays > BALANCE.app.backupReminderDays && ' – Zeit für ein neues!'}
        </p>
        {prepared ? (
          <div className="button-row">
            <button className="btn btn-primary" onClick={sharePrepared}>
              Sichern / Teilen …
            </button>
            <button
              className="btn"
              onClick={async () => {
                download(prepared);
                await markBackupDone();
                setPrepared(null);
                toast('Backup heruntergeladen');
              }}
            >
              Herunterladen
            </button>
          </div>
        ) : (
          <div className="button-row">
            <button className="btn btn-primary" onClick={exportBackup}>
              Backup exportieren
            </button>
            <button className="btn" onClick={() => fileInput.current?.click()}>
              Backup importieren
            </button>
          </div>
        )}
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) importBackup(f);
          }}
        />
        <p className="muted small">
          Speicher:{' '}
          {persisted === true
            ? 'dauerhaft ✓'
            : persisted === false
              ? 'nicht garantiert (der Browser darf Daten bei Platzmangel löschen) – regelmäßig Backups machen!'
              : 'unbekannt'}
        </p>
      </Section>

      <Section title="Gefahrenzone">
        <button className="btn btn-danger btn-block" onClick={reset}>
          Spielstand zurücksetzen
        </button>
      </Section>

      {devOpen && <DevMenu />}

      <button className="version" onClick={onVersionTap}>
        Alltagsheld · Version {__APP_VERSION__}
      </button>
      {confirmUi}
    </div>
  );
}

function DevMenu() {
  const settings = useSettings();
  const player = usePlayer();
  const today = useToday();
  const [vit, setVit] = useState('10');
  const [pos, setPos] = useState<{ round: string; area: string; stage: string } | null>(null);

  useEffect(() => {
    if (player && !pos) setPos({ round: String(player.round), area: String(player.area), stage: String(player.stage) });
  }, [player, pos]);

  if (!settings || !player || !pos) return null;
  const offsetDays = Math.round(settings.devTimeOffsetMs / 86_400_000);
  const add = async (delta: { xp?: number; gold?: number }) => {
    const events = await guarded(() => devAddResources(delta));
    if (events) pushEvents(events);
  };

  return (
    <Section title="Entwicklermenü">
      <div className="dev">
        <p className="small">
          Spieldatum: <strong>{formatDateKey(today)}</strong> ({todayKey()}) · Versatz: +{offsetDays} Tag(e)
        </p>
        <div className="button-row">
          <button className="btn btn-primary" onClick={() => guarded(() => devAdvanceDays(1))}>
            Datum +1 Tag
          </button>
        </div>
        <p className="muted small">
          Vorspulen ist nicht umkehrbar. Zum Aufräumen: vorher Backup exportieren und danach wieder importieren – oder
          den Spielstand zurücksetzen.
        </p>

        <div className="button-row">
          <button className="btn" onClick={() => add({ gold: 100 })}>
            +100 Gold
          </button>
          <button className="btn" onClick={() => add({ gold: 1000 })}>
            +1000 Gold
          </button>
          <button className="btn" onClick={() => add({ xp: 100 })}>
            +100 XP
          </button>
          <button className="btn" onClick={() => add({ xp: 1000 })}>
            +1000 XP
          </button>
        </div>

        <div className="field-row">
          <span>Vitalität</span>
          <div className="inline-field">
            <input type="number" inputMode="numeric" value={vit} onChange={(e) => setVit(e.target.value)} />
            <button
              className="btn btn-small"
              onClick={async () => {
                const events = await guarded(() => devSetVitality(Number(vit)));
                if (events) pushEvents(events);
              }}
            >
              Setzen
            </button>
          </div>
        </div>
        <p className="muted small">Wert ≤ 0 löst sofort den Tod aus.</p>

        <div className="field-row">
          <span>Stufe</span>
          <div className="inline-field stage-inputs">
            <input aria-label="Runde" type="number" inputMode="numeric" value={pos.round} onChange={(e) => setPos({ ...pos, round: e.target.value })} />
            <input aria-label="Gebiet" type="number" inputMode="numeric" value={pos.area} onChange={(e) => setPos({ ...pos, area: e.target.value })} />
            <input aria-label="Stufe" type="number" inputMode="numeric" value={pos.stage} onChange={(e) => setPos({ ...pos, stage: e.target.value })} />
            <button
              className="btn btn-small"
              onClick={async () => {
                await guarded(() => devSetStage(Number(pos.round), Number(pos.area), Number(pos.stage)));
                toast('Stufe gesetzt');
              }}
            >
              Setzen
            </button>
          </div>
        </div>
        <p className="muted small">Runde · Gebiet (1–{BALANCE.combat.areaCount}) · Stufe (1–{BALANCE.combat.stagesPerArea})</p>
      </div>
    </Section>
  );
}
