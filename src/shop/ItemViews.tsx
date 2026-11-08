import { equipItemById, sellItemById, unequip } from '../db/repo';
import { BALANCE } from '../game/balance';
import { isChestId, itemPower, itemSellPrice, type ItemStats } from '../game/items';
import { statDiff } from '../game/shop';
import type { Item, ItemStat, Rarity, Slot } from '../game/types';
import { guarded } from '../state/actions';
import { toast } from '../state/ui';
import { formatNumber } from '../ui/combatText';
import { useConfirm } from '../ui/Confirm';
import { CHEST_NAMES, RARITY_COLORS, RARITY_NAMES, SLOT_NAMES, STAT_NAMES } from '../ui/labels';
import { PixelIcon, PixelSprite } from '../ui/PixelIcon';
import { Sheet } from '../ui/Sheet';
import { ITEM_ART, itemPalette } from './art';
import { rarityStyle, STAT_ORDER, statsText, statValue } from './format';

/** item picture in the material the hero wears; epic / legendary glow in their rarity colour */
export function ItemIcon({ slot, rarity, scale = 3 }: { slot: Slot; rarity: Rarity; scale?: number }) {
  return (
    <span className={`item-icon rarity-${rarity}`} style={rarityStyle(rarity)}>
      <PixelSprite rows={ITEM_ART[slot]} palette={itemPalette(slot, rarity)} scale={scale} />
    </span>
  );
}

const num = (n: number) => formatNumber(n, Number.isInteger(n) ? 0 : 1);

/** one line per value: value of the candidate and the difference to the current item (green / red) */
export function StatCompare({ stats, current, compare }: { stats: ItemStats; current: ItemStats | null; compare: boolean }) {
  const diff = statDiff(stats, current);
  const shown = STAT_ORDER.filter((a) => stats[a] || (compare && current?.[a]));
  const total = itemPower(stats, BALANCE) - itemPower(current, BALANCE);
  const delta = (d: number, unit = '') =>
    Math.abs(d) < 0.05 ? (
      <span className="stat-delta same">±0</span>
    ) : (
      <span className={`stat-delta ${d > 0 ? 'up' : 'down'}`}>
        {d > 0 ? '▲' : '▼'} {num(Math.abs(d))}
        {unit}
      </span>
    );
  return (
    <div className={`stat-compare ${compare ? 'compare' : ''}`}>
      {shown.map((a: ItemStat) => (
        <div key={a} className="stat-line">
          <span>{STAT_NAMES[a]}</span>
          <span className="display stat-value">{stats[a] ? statValue(a, stats[a]!) : '–'}</span>
          {compare && delta(diff[a] ?? 0, a === 'crit' ? ' %' : '')}
        </div>
      ))}
      {compare && (
        <div className="stat-line stat-total">
          <span>Gesamtwert</span>
          <span className="display stat-value">{num(itemPower(stats, BALANCE))}</span>
          {delta(total)}
        </div>
      )}
    </div>
  );
}

/** list row: icon, name in rarity colour, stats */
export function ItemRow({ item, onClick, tag }: { item: Item; onClick: () => void; tag?: string }) {
  return (
    <li>
      <button className="item-row" style={rarityStyle(item.rarity)} onClick={onClick}>
        <ItemIcon slot={item.slot} rarity={item.rarity} />
        <span className="item-row-text">
          <span className="item-name display">{item.name}</span>
          <span className="muted small">
            {tag ?? SLOT_NAMES[item.slot]} · {statsText(item.stats)}
          </span>
        </span>
      </button>
    </li>
  );
}

/** detail sheet: compare with the equipped item, equip / unequip, sell */
export function ItemSheet({
  item,
  equipped,
  current,
  onClose,
}: {
  item: Item;
  /** this item is worn right now */
  equipped: boolean;
  /** the item worn in that slot (null = slot empty) */
  current: Item | null;
  onClose: () => void;
}) {
  const [confirmUi, ask] = useConfirm();
  const price = itemSellPrice(item, BALANCE);
  const chest = isChestId(item.chestType) ? CHEST_NAMES[item.chestType] : 'Truhe';
  const compare = !equipped;

  const equip = async () => {
    if ((await guarded(async () => (await equipItemById(item.id), true))) !== undefined) {
      toast(`${item.name} angelegt`);
      onClose();
    }
  };
  const takeOff = async () => {
    if ((await guarded(async () => (await unequip(item.slot), true))) !== undefined) {
      toast(`${item.name} abgelegt`);
      onClose();
    }
  };
  const sell = async () => {
    const yes = await ask({
      title: 'Verkaufen?',
      message: (
        <p>
          <strong style={{ color: RARITY_COLORS[item.rarity] }}>{item.name}</strong> für {price} Gold verkaufen?
          {equipped && ' Der Gegenstand wird dabei abgelegt.'} Das kann nicht rückgängig gemacht werden.
        </p>
      ),
      confirmLabel: 'Verkaufen',
      danger: true,
    });
    if (!yes) return;
    const gold = await guarded(() => sellItemById(item.id));
    if (gold !== undefined) {
      toast(`Verkauft: +${gold} Gold`);
      onClose();
    }
  };

  return (
    <>
      <Sheet
        size="auto"
        className="item-sheet"
        onDismiss={onClose}
        title={
          <span className="item-sheet-title" style={rarityStyle(item.rarity)}>
            {item.name}
          </span>
        }
        subtitle={`${RARITY_NAMES[item.rarity]} · ${SLOT_NAMES[item.slot]} · ${chest}, Level ${item.levelAtPurchase}`}
        footer={
          <div className="button-row item-actions">
            {equipped ? (
              <button className="btn" onClick={takeOff}>
                Ablegen
              </button>
            ) : (
              <button className="btn btn-primary" onClick={equip}>
                Anlegen
              </button>
            )}
            <button className="btn btn-danger" onClick={sell}>
              <PixelIcon name="coin" size={14} /> Verkaufen · {price}
            </button>
          </div>
        }
      >
        <div className="item-detail" style={rarityStyle(item.rarity)}>
          <div className="item-detail-icon">
            <ItemIcon slot={item.slot} rarity={item.rarity} scale={5} />
          </div>
          <div className="item-detail-stats">
            <StatCompare stats={item.stats} current={current?.stats ?? null} compare={compare} />
            <p className="muted small">
              {equipped
                ? 'Gerade angelegt.'
                : current
                  ? `Verglichen mit: ${current.name}`
                  : `Der Platz „${SLOT_NAMES[item.slot]}“ ist noch leer.`}
            </p>
          </div>
        </div>
      </Sheet>
      {confirmUi}
    </>
  );
}
