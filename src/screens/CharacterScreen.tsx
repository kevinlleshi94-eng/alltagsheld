import { useState } from 'react';
import { HeroPortrait } from '../battle/HeroPortrait';
import { spendAttributePoint } from '../db/repo';
import { BALANCE } from '../game/balance';
import { effectiveAttributes, heroStats, positionFromIndex, type HeroStats } from '../game/combat';
import { SLOTS } from '../game/items';
import { xpToNextLevel } from '../game/progression';
import { isExhausted } from '../game/resources';
import { bestRarity, filterInventory, isEquipped, sortInventory, type InventoryFilter } from '../game/shop';
import type { Attribute, Item, Player, Slot } from '../game/types';
import { formatStage } from '../game/world';
import { rarityStyle, statsText } from '../shop/format';
import { ItemIcon, ItemRow, ItemSheet } from '../shop/ItemViews';
import { useEquippedItems, useItems, usePlayer } from '../state/hooks';
import { activeTab, shopSlot } from '../state/ui';
import { Bar, Section } from '../ui/controls';
import { attributePreview, dps, formatNumber, formatSeconds } from '../ui/combatText';
import { ATTRIBUTES, SLOT_NAMES } from '../ui/labels';

/** Character (feedback Phase 4): hero → attributes → equipment → inventory → combat values → progress */
export function CharacterScreen() {
  const player = usePlayer();
  const equipped = useEquippedItems(player);
  const items = useItems();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filter, setFilter] = useState<InventoryFilter>('all');
  if (!player) return null;

  const need = xpToNextLevel(player.level, BALANCE);
  const stats = heroStats(player, equipped, BALANCE);
  const progress = player.progress;
  const highest = positionFromIndex(progress.highestStageIndex, BALANCE);
  const exhausted = isExhausted(player, BALANCE);

  const all = items ?? [];
  const bySlot = (s: Slot): Item | null => all.find((i) => i.id === player.equipped[s]) ?? null;
  const unequipped = all.filter((i) => !isEquipped(player, i.id));
  const inventory = sortInventory(filterInventory(unequipped, filter), BALANCE);
  // the sheet follows the live data (closes when the item was sold)
  const detail = detailId ? all.find((i) => i.id === detailId) : undefined;

  const goShop = (s: Slot) => {
    shopSlot.set(s);
    activeTab.set('shop');
  };

  return (
    <div className="screen">
      <Section title={player.name}>
        <div className="card">
          <div className="hero-card">
            <HeroPortrait equipped={equipped} exhausted={exhausted} aura={bestRarity(equipped)} />
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
            <AttributeRow key={a.id} attr={a.id} label={a.label} player={player} equipped={equipped} stats={stats} />
          ))}
        </ul>
        <p className="muted small attr-note">
          Rechts siehst du den Wert nach dem nächsten Punkt.
          {equipped.length > 0 && ' Grün: Bonus durch deine Ausrüstung.'}
        </p>
      </Section>

      <Section title="Ausrüstung">
        <ul className="list">
          {SLOTS.map((s) => {
            const item = bySlot(s);
            return (
              <li key={s}>
                {item ? (
                  <button className="item-row" style={rarityStyle(item.rarity)} onClick={() => setDetailId(item.id)}>
                    <span className="equip-slot">{SLOT_NAMES[s]}</span>
                    <ItemIcon slot={s} rarity={item.rarity} />
                    <span className="item-row-text">
                      <span className="item-name display">{item.name}</span>
                      <span className="muted small">{statsText(item.stats)}</span>
                    </span>
                  </button>
                ) : (
                  <button className="item-row empty" onClick={() => goShop(s)}>
                    <span className="equip-slot">{SLOT_NAMES[s]}</span>
                    <span className="item-icon empty-icon" aria-hidden />
                    <span className="item-row-text">
                      <span className="muted">leer</span>
                      <span className="muted small">Truhe im Shop öffnen ›</span>
                    </span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Inventar" right={unequipped.length > 0 ? <span className="muted small">{unequipped.length}</span> : undefined}>
        {unequipped.length === 0 ? (
          <div className="card">
            <p className="muted small">
              Noch nichts im Inventar. Gegenstände, die du nicht sofort anlegst, landen hier – zum späteren Anlegen oder
              Verkaufen.
            </p>
          </div>
        ) : (
          <>
            <div className="inventory-filter" role="tablist" aria-label="Inventar filtern">
              {(['all', ...SLOTS] as InventoryFilter[]).map((f) => {
                const count = filterInventory(unequipped, f).length;
                return (
                  <button
                    key={f}
                    role="tab"
                    aria-selected={filter === f}
                    className={`filter-chip ${filter === f ? 'active' : ''}`}
                    disabled={count === 0 && f !== 'all'}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all' ? 'Alle' : SLOT_NAMES[f]}
                    <span className="filter-count">{count}</span>
                  </button>
                );
              })}
            </div>
            {inventory.length === 0 ? (
              <p className="muted small inventory-empty">Keine Gegenstände in dieser Auswahl.</p>
            ) : (
              <ul className="list">
                {inventory.map((item) => (
                  <ItemRow key={item.id} item={item} onClick={() => setDetailId(item.id)} />
                ))}
              </ul>
            )}
          </>
        )}
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
              {stats.critBonus > 0 && <span className="gear-bonus">+{formatNumber(stats.critBonus)} %</span>}
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
      <p className="muted coming">Haustiere folgen in Phase 5.</p>

      {detail && (
        <ItemSheet
          item={detail}
          equipped={isEquipped(player, detail.id)}
          current={bySlot(detail.slot)}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

/**
 * Feedback Phase 4:
 *   Stärke 6 (+2)
 *   Schaden pro Treffer 28   → 31   [+]
 */
function AttributeRow({
  attr,
  label,
  player,
  equipped,
  stats,
}: {
  attr: Attribute;
  label: string;
  player: Player;
  equipped: readonly Item[];
  stats: HeroStats;
}) {
  const total = effectiveAttributes(player, equipped)[attr];
  const bonus = total - player.attributes[attr];
  const preview = attributePreview(stats, attr, BALANCE);
  return (
    <li className="attr-row">
      <div className="attr-main">
        <div className="attr-head">
          <span>{label}</span>
          <span className="display attr-value">{total}</span>
          {bonus > 0 && <span className="gear-bonus">(+{bonus})</span>}
        </div>
        <div className="attr-effect small">
          <span className="muted">{preview.label}</span> <span className="display attr-now">{preview.now}</span>
        </div>
      </div>
      <div className={`attr-next display ${player.unspentPoints > 0 ? 'ready' : ''}`}>
        {preview.next ? `→ ${preview.next}` : 'max.'}
      </div>
      <button
        className="btn btn-small btn-primary"
        disabled={player.unspentPoints <= 0 || !preview.next}
        onClick={() => spendAttributePoint(attr)}
        aria-label={`${label} erhöhen`}
      >
        +
      </button>
    </li>
  );
}
