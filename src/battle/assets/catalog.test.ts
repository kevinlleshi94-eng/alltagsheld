import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Rarity, Slot } from '../../game/types';
import { AREAS } from '../../game/world';
import {
  ENEMY_SPRITES,
  heroLook,
  LPC_PARTS,
  LPC_ROOT,
  lookFiles,
  lookKey,
  MONSTER_ROOT,
  MONSTERS,
  type CharacterLook,
  type LpcPartId,
} from './catalog';
import { LPC_FRAMES, stripFrames } from './compose';
import { ramp } from './palettes';

const PUBLIC = 'public/';
const DEFINITIONS = 'assets-src/lpc/sheet_definitions/';

/** width/height from the PNG header */
function pngSize(file: string): { w: number; h: number } {
  const b = readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const allEnemies = AREAS.flatMap((a) => [...a.enemies, ...a.midBosses, a.boss]);
const looks: [string, CharacterLook][] = [
  ...Object.entries(ENEMY_SPRITES).flatMap(([id, s]) => (s.kind === 'lpc' ? [[id, s.look] as [string, CharacterLook]] : [])),
  ['hero (nothing)', heroLook({})],
  ['hero (legendary)', heroLook({ head: 'legendary', body: 'legendary', weapon: 'legendary', shield: 'legendary' })],
];

describe('LPC parts', () => {
  for (const [id, part] of Object.entries(LPC_PARTS)) {
    it(`${id}: files exist with the LPC layout`, () => {
      expect(existsSync(DEFINITIONS + part.credit), part.credit).toBe(true);
      for (const layer of part.layers) {
        const file = PUBLIC + LPC_ROOT + layer.file;
        expect(existsSync(file), file).toBe(true);
        const { w, h } = pngSize(file);
        expect(w, file).toBe(LPC_FRAMES[layer.anim] * layer.frame);
        // 4 directions (up, left, down, right)
        expect(h, file).toBe(4 * layer.frame);
      }
      // every part has both animations
      expect(new Set(part.layers.map((l) => l.anim))).toEqual(new Set(['walk', 'slash']));
    });
  }
});

describe('character looks', () => {
  it.each(looks)('%s: colours exist in the material ramps', (_id, look) => {
    for (const use of look) {
      const part = LPC_PARTS[use.part];
      if (!use.color) continue;
      expect(part.material, `${use.part} cannot be recoloured`).toBeDefined();
      expect(ramp(part.material!, use.color), `${use.part}:${use.color}`).not.toBeNull();
      if (part.base) expect(ramp(part.material!, part.base)).not.toBeNull();
    }
  });

  it.each(looks)('%s: one body, one head', (_id, look) => {
    const ids = look.map((u) => u.part);
    expect(ids.filter((p) => p.startsWith('body')).length).toBe(1);
    expect(ids.filter((p) => p.startsWith('head')).length).toBeLessThanOrEqual(1);
  });

  // LPC armour and shirts only exist for the male body
  const MALE_ONLY: LpcPartId[] = ['shirt', 'armourLeather', 'armourLegion', 'armourPlate', 'bandages'];
  it.each(looks)('%s: no male-only clothes on a muscular body', (_id, look) => {
    const ids = look.map((u) => u.part);
    if (ids.includes('bodyMuscular')) expect(ids.filter((p) => MALE_ONLY.includes(p))).toEqual([]);
  });
});

describe('hero equipment', () => {
  const slots: Slot[] = ['head', 'body', 'weapon', 'shield'];
  const rarities: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

  it('every rarity looks different in every slot', () => {
    for (const slot of slots) {
      const keys = new Set([lookKey(heroLook({})), ...rarities.map((r) => lookKey(heroLook({ [slot]: r })))]);
      expect(keys.size, slot).toBe(rarities.length + 1);
    }
  });

  it('always has a weapon and a body, a shield only when equipped', () => {
    const bare = heroLook({}).map((u) => u.part);
    expect(bare).toContain('dagger');
    expect(bare).toContain('bodyMale');
    expect(bare.some((p) => p.startsWith('shield'))).toBe(false);
    expect(heroLook({ shield: 'common' }).some((u) => u.part.startsWith('shield'))).toBe(true);
  });

  it('lists the files a look needs (for preloading)', () => {
    const files = lookFiles(heroLook({ weapon: 'epic' }));
    expect(files.some((f) => f.includes('longsword'))).toBe(true);
    expect(new Set(files).size).toBe(files.length);
  });
});

describe('monster sheets', () => {
  for (const [id, sheet] of Object.entries(MONSTERS)) {
    it(`${id}: all frames inside the image`, () => {
      for (const strip of [sheet.walk, sheet.attack]) {
        for (const file of [strip.file, ...(strip.overlays ?? [])]) {
          const path = PUBLIC + MONSTER_ROOT + file;
          expect(existsSync(path), path).toBe(true);
          const { w, h } = pngSize(path);
          for (const f of stripFrames(strip)) {
            expect(f.sx + strip.w, `${file} x`).toBeLessThanOrEqual(w);
            expect(f.sy + strip.h, `${file} y`).toBeLessThanOrEqual(h);
          }
        }
        if (strip.nudge) expect(strip.nudge.length).toBe(strip.frames);
      }
    });
  }
});

describe('enemy sprites', () => {
  it('every enemy of every area has a sprite', () => {
    const missing = allEnemies.filter((e) => !ENEMY_SPRITES[e.id]).map((e) => e.id);
    expect(missing).toEqual([]);
  });

  it('no sprite for an unknown enemy (typos)', () => {
    const ids = new Set(allEnemies.map((e) => e.id));
    expect(Object.keys(ENEMY_SPRITES).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('bosses look different from the normal enemies of their area', () => {
    for (const area of AREAS) {
      const normal = new Set(area.enemies.map((e) => JSON.stringify(ENEMY_SPRITES[e.id])));
      for (const boss of [...area.midBosses, area.boss]) {
        const s = ENEMY_SPRITES[boss.id];
        // same monster is fine when it is recoloured (boss colours differ)
        if (s.kind === 'monster' && s.recolor) continue;
        expect(normal.has(JSON.stringify(s)), boss.id).toBe(false);
      }
    }
  });
});
