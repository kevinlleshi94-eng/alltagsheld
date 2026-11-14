import { useState } from 'react';
import { buyChestItem, type ChestOutcome } from '../db/repo';
import { BALANCE } from '../game/balance';
import { CHESTS, RARITIES, type ChestId } from '../game/items';
import { chestPrice } from '../game/shop';
import type { PendingChest, Player, Slot } from '../game/types';
import { formatStage } from '../game/world';
import { BossChestDialog } from '../shop/BossChest';
import { SlotTiles } from '../shop/SlotTiles';
import { ChestOpening } from '../shop/ChestOpening';
import { CHEST_CLOSED, chestPalette } from '../shop/art';
import { rarityStyle, statsText } from '../shop/format';
import { ItemIcon } from '../shop/ItemViews';
import { guarded } from '../state/actions';
import { useItems, usePlayer } from '../state/hooks';
import { useStore } from '../state/store';
import { activeTab, shopSlot } from '../state/ui';
import { Section } from '../ui/controls';
import { CHEST_NAMES, RARITY_NAMES } from '../ui/labels';
import { PixelIcon, PixelSprite } from '../ui/PixelIcon';

const NOTHING_WORN: Record<Slot, string> = {
  head: 'keinen Helm',
  body: 'keine Rüstung',
  weapon: 'keine Waffe',
  shield: 'keinen Schild',
};

const percent = (v: number) => `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;

/** SPEC 7.3: pick a slot, buy a chest, open it */
export function ShopScreen() {
  const player = usePlayer();
  const items = useItems();
  const slot = useStore(shopSlot);
  const [opening, setOpening] = useState<{ chest: ChestId; outcome: ChestOutcome } | null>(null);
  const [busy, setBusy] = useState(false);
  const [bossChest, setBossChest] = useState<PendingChest | null>(null);
  if (!player || !items) return null;

  const current = items.find((i) => i.id === player.equipped[slot]) ?? null;
  const inventoryCount = items.filter((i) => !Object.values(player.equipped).includes(i.id)).length;

  const buy = async (chest: ChestId) => {
    if (busy) return;
    setBusy(true);
    const outcome = await guarded(() => buyChestItem(slot, chest));
    setBusy(false);
    if (outcome) setOpening({ chest, outcome });
  };

  return (
    <div className="screen">
      {player.pendingChests.length > 0 && (
        <Section title="Boss-Beute">
          <p className="shop-intro">Ungeöffnete Truhen von Bossen – du wählst den Platz beim Öffnen.</p>
          <ul className="list">
            {player.pendingChests.map((c) => (
              <li key={c.id} className="card chest-row">
                <div className="chest-thumb">
                  <PixelSprite rows={CHEST_CLOSED} palette={chestPalette(c.chest)} scale={3} />
                </div>
                <div className="chest-info">
                  <div className="display chest-name">{CHEST_NAMES[c.chest]}</div>
                  <div className="muted small">vom Boss {formatStage(c.from, BALANCE.combat.stagesPerArea)}</div>
                </div>
                <button className="btn btn-primary chest-buy" onClick={() => setBossChest(c)}>
                  <span className="chest-buy-label">Öffnen</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Truhen" right={<GoldChip gold={player.gold} />}>
        <p className="shop-intro">Für welches Ausrüstungsteil öffnest du die Truhe?</p>
        <SlotTiles player={player} items={items} selected={slot} onSelect={(s) => shopSlot.set(s)} />
        <div className="shop-current small">
          {current ? (
            <>
              <span className="muted">Angelegt:</span>
              <ItemIcon slot={current.slot} rarity={current.rarity} scale={2} />
              <span className="shop-current-name" style={rarityStyle(current.rarity)}>
                {current.name}
              </span>
              <span className="muted">({statsText(current.stats)})</span>
            </>
          ) : (
            <span className="muted">Du trägst noch {NOTHING_WORN[slot]}.</span>
          )}
        </div>

        <ul className="list">
          {CHESTS.map((c) => (
            <ChestCard key={c} chest={c} player={player} disabled={busy} onBuy={() => buy(c)} />
          ))}
        </ul>
        <div className="rarity-legend">
          {RARITIES.map((r) => (
            <span key={r} style={rarityStyle(r)}>
              {RARITY_NAMES[r]}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Inventar">
        <div className="card">
          <p className="muted small">
            {inventoryCount === 0
              ? 'Neue Gegenstände landen im Inventar, wenn du sie nicht sofort anlegst.'
              : `${inventoryCount} ${inventoryCount === 1 ? 'Gegenstand liegt' : 'Gegenstände liegen'} im Inventar.`}{' '}
            Anlegen, ablegen und verkaufen (für {Math.round(BALANCE.items.sellFraction * 100)} % des Truhenpreises) kannst du
            im Charakter-Tab.
          </p>
          <button className="btn btn-small" onClick={() => activeTab.set('character')}>
            Zum Charakter
          </button>
        </div>
      </Section>

      {opening && <ChestOpening chest={opening.chest} outcome={opening.outcome} onDone={() => setOpening(null)} />}
      {bossChest && (
        <BossChestDialog
          pendingId={bossChest.id}
          chest={bossChest.chest}
          caption="Boss-Beute"
          onClose={() => setBossChest(null)}
        />
      )}
    </div>
  );
}

function GoldChip({ gold }: { gold: number }) {
  return (
    <span className="gold-chip display">
      <PixelIcon name="coin" size={16} /> {gold}
    </span>
  );
}

function ChestCard({ chest, player, disabled, onBuy }: { chest: ChestId; player: Player; disabled: boolean; onBuy: () => void }) {
  const price = chestPrice(chest, { balance: BALANCE });
  const missing = price - player.gold;
  const odds = BALANCE.items.chests[chest].odds;
  const total = odds.reduce((a, b) => a + b, 0);
  return (
    <li className="card chest-row">
      <div className="chest-thumb">
        <PixelSprite rows={CHEST_CLOSED} palette={chestPalette(chest)} scale={3} />
      </div>
      <div className="chest-info">
        <div className="display chest-name">{CHEST_NAMES[chest]}</div>
        <div className="odds-bar" aria-hidden>
          {RARITIES.map((r, i) =>
            odds[i] > 0 ? <span key={r} style={{ ...rarityStyle(r), width: `${(odds[i] / total) * 100}%` }} /> : null,
          )}
        </div>
        <div className="odds-text">
          {RARITIES.map((r, i) =>
            odds[i] > 0 ? (
              <span key={r} style={rarityStyle(r)} title={RARITY_NAMES[r]}>
                {percent((odds[i] / total) * 100)}
              </span>
            ) : null,
          )}
        </div>
        {missing > 0 && <div className="muted small">Noch {missing} Gold</div>}
      </div>
      <button
        className="btn btn-primary chest-buy"
        disabled={disabled || missing > 0}
        onClick={onBuy}
        aria-label={`${CHEST_NAMES[chest]} für ${price} Gold öffnen`}
      >
        <span className="chest-buy-label">Öffnen</span>
        <span className="chest-buy-price">
          <PixelIcon name="coin" size={13} /> {price}
        </span>
      </button>
    </li>
  );
}
