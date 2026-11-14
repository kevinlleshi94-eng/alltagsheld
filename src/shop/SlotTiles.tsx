import { SLOT_STATS, SLOTS } from '../game/items';
import type { Item, Player, Slot } from '../game/types';
import { SLOT_NAMES, STAT_SHORT } from '../ui/labels';
import { ItemIcon } from './ItemViews';

/** the four equipment slots as tiles (shop + boss chests): icon of the worn item, name, what the slot gives */
export function SlotTiles({
  player,
  items,
  selected,
  onSelect,
}: {
  player: Player;
  items: Item[];
  selected: Slot | null;
  onSelect: (slot: Slot) => void;
}) {
  return (
    <div className="slot-tiles" role="tablist">
      {SLOTS.map((s) => {
        const worn = items.find((i) => i.id === player.equipped[s]);
        return (
          <button
            key={s}
            role="tab"
            aria-selected={s === selected}
            className={`slot-tile ${s === selected ? 'active' : ''} ${worn ? '' : 'empty'}`}
            onClick={() => onSelect(s)}
          >
            <ItemIcon slot={s} rarity={worn?.rarity ?? 'common'} scale={3} />
            <span className="slot-tile-name display">{SLOT_NAMES[s]}</span>
            <span className="slot-tile-stats">{SLOT_STATS[s].map((st) => STAT_SHORT[st]).join(' + ')}</span>
          </button>
        );
      })}
    </div>
  );
}
