import { HeroPortrait } from '../battle/HeroPortrait';
import { BALANCE } from '../game/balance';
import { heroStats, positionFromIndex } from '../game/combat';
import { xpToNextLevel } from '../game/progression';
import { isExhausted } from '../game/resources';
import { spendAttributePoint } from '../db/repo';
import { formatStage } from '../game/world';
import { useEquippedItems, usePlayer } from '../state/hooks';
import { Bar, Section } from '../ui/controls';
import { attributeGain, dps, formatNumber, formatSeconds } from '../ui/combatText';
import { ATTRIBUTES } from '../ui/labels';

/** Character info with hero portrait, attribute distribution and combat values (items follow in Phase 4) */
export function CharacterScreen() {
  const player = usePlayer();
  const equipped = useEquippedItems(player);
  if (!player) return null;
  const need = xpToNextLevel(player.level, BALANCE);
  const stats = heroStats(player, equipped, BALANCE);
  const progress = player.progress;
  const highest = positionFromIndex(progress.highestStageIndex, BALANCE);
  const exhausted = isExhausted(player, BALANCE);
  return (
    <div className="screen">
      <Section title={player.name}>
        <div className="card">
          <div className="hero-card">
            <HeroPortrait equipped={equipped} exhausted={exhausted} />
            <div className="hero-card-stats">
              <div className="kv">
                <span>Level</span>
                <span className="display">{player.level}</span>
              </div>
              <div className="kv">
                <span>Erfahrung</span>
                <span className="display">
                  {player.xp} / {need}
                </span>
              </div>
              <Bar value={player.xp} max={need} kind="xp" />
              <div className="kv">
                <span>Vitalität</span>
                <span className={`display ${exhausted ? 'danger' : ''}`}>
                  {player.vitality} / {BALANCE.vitality.max}
                </span>
              </div>
              {exhausted && <div className="danger small">Erschöpft</div>}
              <div className="kv">
                <span>Gold</span>
                <span className="display">{player.gold}</span>
              </div>
              <div className="kv">
                <span>Tode</span>
                <span className="display">{player.deaths}</span>
              </div>
            </div>
          </div>
          <p className="muted small">
            Vitalität ist deine Alltagsenergie: Sie sinkt durch verpasste Aufgaben. Lebenspunkte im Kampf erhöhst du mit
            „Leben“.
          </p>
        </div>
      </Section>

      <Section
        title="Attribute"
        right={player.unspentPoints > 0 ? <span className="badge">{player.unspentPoints} frei</span> : undefined}
      >
        <ul className="list">
          {ATTRIBUTES.map((a) => (
            <li key={a.id} className="attr-row">
              <div>
                <div>{a.label}</div>
                <div className="muted small">{attributeGain(stats, a.id, BALANCE)}</div>
              </div>
              <span className="display attr-value">{player.attributes[a.id]}</span>
              <button
                className="btn btn-small btn-primary"
                disabled={player.unspentPoints <= 0}
                onClick={() => spendAttributePoint(a.id)}
                aria-label={`${a.label} erhöhen`}
              >
                +
              </button>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Kampfwerte">
        <div className="card">
          <div className="kv">
            <span>Lebenspunkte</span>
            <span className="display">{stats.maxHp}</span>
          </div>
          <div className="kv">
            <span>Schaden pro Treffer</span>
            <span className={`display ${stats.exhausted ? 'danger' : ''}`}>
              {formatNumber(stats.damage, Number.isInteger(stats.damage) ? 0 : 1)}
              {stats.exhausted && ' (−25 % erschöpft)'}
            </span>
          </div>
          <div className="kv">
            <span>Angriffsintervall</span>
            <span className="display">{formatSeconds(stats.attackInterval)}</span>
          </div>
          <div className="kv">
            <span>Kritische Treffer</span>
            <span className="display">
              {formatNumber(stats.critChance * 100)} % · ×{formatNumber(stats.critMultiplier, 1)}
            </span>
          </div>
          <div className="kv">
            <span>Schaden pro Sekunde</span>
            <span className="display">≈ {formatNumber(dps(stats), 1)}</span>
          </div>
        </div>
      </Section>

      <Section title="Fortschritt">
        <div className="card">
          <div className="kv">
            <span>Aktuell</span>
            <span className="display">{formatStage(player, BALANCE.combat.stagesPerArea)}</span>
          </div>
          <div className="kv">
            <span>Weiteste Stufe</span>
            <span className="display">{formatStage(highest, BALANCE.combat.stagesPerArea)}</span>
          </div>
          <div className="kv">
            <span>Besiegte Gegner</span>
            <span className="display">{progress.enemiesDefeated}</span>
          </div>
          <div className="kv">
            <span>Davon Bosse</span>
            <span className="display">{progress.bossesDefeated}</span>
          </div>
          {progress.dragonsDefeated > 0 && (
            <div className="kv">
              <span>Drachen besiegt</span>
              <span className="display">{progress.dragonsDefeated}</span>
            </div>
          )}
        </div>
      </Section>
      <p className="muted coming">Ausrüstung, Inventar und Haustiere folgen in Phase 4–5.</p>
    </div>
  );
}

export function ShopScreen() {
  return (
    <div className="screen">
      <Section title="Shop">
        <p className="muted coming">Truhen, Ausrüstung und Inventar kommen in Phase 4. Gold sammelst du schon jetzt!</p>
      </Section>
    </div>
  );
}

export function StatsScreen() {
  return (
    <div className="screen">
      <Section title="Statistik">
        <p className="muted coming">
          Die Statistik kommt in Phase 5. Das Tageslog wird bereits lückenlos gespeichert – deine Daten gehen also nicht
          verloren.
        </p>
      </Section>
    </div>
  );
}
