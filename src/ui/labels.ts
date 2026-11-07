import type { Attribute, Slot } from '../game/types';

/** German UI labels */
export const ATTRIBUTES: { id: Attribute; label: string; hint: string }[] = [
  { id: 'strength', label: 'Stärke', hint: 'mehr Schaden pro Treffer' },
  { id: 'speed', label: 'Angriffsgeschwindigkeit', hint: 'kürzere Zeit zwischen Angriffen' },
  { id: 'life', label: 'Leben', hint: 'mehr Lebenspunkte im Kampf' },
];

export const ATTRIBUTE_NAMES: Record<Attribute, string> = {
  strength: 'Stärke',
  speed: 'Angriffsgeschwindigkeit',
  life: 'Leben',
};

export const SLOT_NAMES: Record<Slot, string> = { head: 'Kopf', body: 'Körper', weapon: 'Waffe', shield: 'Schild' };
