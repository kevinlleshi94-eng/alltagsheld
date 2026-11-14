import { useEffect, useState } from 'react';
import { openBossChest, type ChestOutcome } from '../db/repo';
import { BALANCE } from '../game/balance';
import type { ChestId } from '../game/items';
import type { Item, Slot } from '../game/types';
import { formatStage } from '../game/world';
import { guarded } from '../state/actions';
import { useItems, usePauseFight, usePlayer } from '../state/hooks';
import { CHEST_NAMES, SLOT_NAMES } from '../ui/labels';
import { PixelSprite } from '../ui/PixelIcon';
import { Modal } from '../ui/Sheet';
import { CHEST_CLOSED, chestPalette } from './art';
import { ChestOpening } from './ChestOpening';
import { SlotTiles } from './SlotTiles';

/**
 * A kept boss chest (feedback v0.5): the player picks the slot, then the normal opening animation runs.
 * „Später“ keeps the chest – it waits in the shop under „Boss-Beute“.
 */
export function BossChestDialog({
  pendingId,
  chest,
  caption,
  onClose,
}: {
  pendingId: string;
  chest: ChestId;
  caption: string;
  onClose: () => void;
}) {
  const player = usePlayer();
  const items = useItems();
  usePauseFight();
  const [slot, setSlot] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<ChestOutcome | null>(null);
  const pending = player?.pendingChests.find((c) => c.id === pendingId);
  const gone = !!player && !pending && !opened && !busy;

  // already opened elsewhere (e.g. in the shop) → nothing to show
  useEffect(() => {
    if (gone) onClose();
  }, [gone, onClose]);

  if (!player || !items) return null;
  if (opened) return <ChestOpening chest={chest} outcome={opened} caption={caption} onDone={onClose} />;
  if (!pending) return null;

  const open = async () => {
    if (!slot || busy) return;
    setBusy(true);
    const r = await guarded(() => openBossChest(pendingId, slot));
    if (r) setOpened(r);
    setBusy(false);
  };

  return (
    <Modal
      className="boss-chest-modal"
      title={caption}
      actions={
        <>
          <button className="btn btn-primary btn-block" disabled={!slot || busy} onClick={open}>
            {slot ? `Für ${SLOT_NAMES[slot]} öffnen` : 'Erst Platz wählen'}
          </button>
          <button className="btn btn-block" disabled={busy} onClick={onClose}>
            Später (im Shop)
          </button>
        </>
      }
    >
      <div className="boss-chest-head">
        <PixelSprite rows={CHEST_CLOSED} palette={chestPalette(chest)} scale={4} />
        <div>
          <div className="display boss-chest-name">{CHEST_NAMES[chest]}</div>
          <div className="muted small">vom Boss {formatStage(pending.from, BALANCE.combat.stagesPerArea)}</div>
        </div>
      </div>
      <p className="small">Für welches Ausrüstungsteil öffnest du die Truhe?</p>
      <SlotTiles player={player} items={items} selected={slot} onSelect={setSlot} />
    </Modal>
  );
}

/** the dragon's hoard: the four best items (already in the inventory), opened one after another */
export function DragonHoard({ items: hoard, onDone }: { items: Item[]; onDone: () => void }) {
  const player = usePlayer();
  const items = useItems();
  const [index, setIndex] = useState(0);
  const item = hoard[index];

  useEffect(() => {
    if (!item) onDone();
  }, [item, onDone]);

  if (!player || !items || !item) return null;
  const currentId = player.equipped[item.slot];
  const current = currentId && currentId !== item.id ? (items.find((i) => i.id === currentId) ?? null) : null;
  return (
    <ChestOpening
      key={item.id}
      chest="gold"
      outcome={{ item, current }}
      caption={`Drachenschatz ${index + 1}/${hoard.length}`}
      onDone={() => setIndex((i) => i + 1)}
    />
  );
}
