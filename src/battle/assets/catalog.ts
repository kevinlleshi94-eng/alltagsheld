/**
 * Asset manifest for the battle scene (SPEC 6.5). Pure data – no Phaser, no DOM –
 * so it can be unit-tested (every file must exist, every enemy needs a sprite).
 *
 * Two kinds of sprites:
 *  - LPC characters (hero + humanoid enemies): layers from the Universal LPC generator,
 *    composited at runtime in z-order and recoloured (compose.ts).
 *  - Monster sheets (OpenGameArt): explicit frame rects per animation.
 * Anything missing or failing to load falls back to the old pixel placeholders.
 */
import type { Item, Rarity, Slot } from '../../game/types';
import type { Material } from './palettes';

export const LPC_ROOT = 'assets/lpc/spritesheets/';
export const MONSTER_ROOT = 'assets/monsters/';

// ---------------------------------------------------------------------------
// LPC parts
// ---------------------------------------------------------------------------

export type LpcAnim = 'walk' | 'slash';

export interface LpcLayer {
  anim: LpcAnim;
  /** relative to LPC_ROOT */
  file: string;
  z: number;
  /** frame size of this file (oversize weapon attacks use 128/192) */
  frame: 64 | 128 | 192;
}

export interface LpcPart {
  layers: LpcLayer[];
  /** material for recolouring; base = ramp the file is drawn in (default: BASE_RAMP) */
  material?: Material;
  base?: string;
  /** fixed colour replacements for art without an LPC ramp (e.g. a golden longsword) */
  remap?: Record<string, string>;
  /** sheet definition (assets-src/lpc/sheet_definitions/…) for CREDITS.md */
  credit: string;
}

/** walk + slash in 64 px frames: `<dir>walk.png`, `<dir>slash.png` */
function simple(dir: string, z: number, credit: string, material?: Material, base?: string): LpcPart {
  return {
    layers: [
      { anim: 'walk', file: `${dir}walk.png`, z, frame: 64 },
      { anim: 'slash', file: `${dir}slash.png`, z, frame: 64 },
    ],
    material,
    base,
    credit,
  };
}

/** variant files: `<dir>walk/<v>.png`, `<dir>slash/<v>.png` */
function variant(dir: string, v: string, z: number, credit: string): LpcPart {
  return {
    layers: [
      { anim: 'walk', file: `${dir}walk/${v}.png`, z, frame: 64 },
      { anim: 'slash', file: `${dir}slash/${v}.png`, z, frame: 64 },
    ],
    credit,
  };
}

const D = {
  body: 'body/body.json',
  skeleton: 'body/special/body_skeleton.json',
  zombie: 'body/special/body_zombie.json',
  human: 'head/heads/human/heads_human_male.json',
  hair: 'hair/short/hair_plain.json',
  shirt: 'torso/shirts/longsleeve/torso_clothes_longsleeve.json',
  pants: 'legs/pants/legs_pants.json',
  shoes: 'feet/shoes/feet_shoes_basic.json',
};

const ARMING = 'weapons/sword/weapon_sword_arming.json';
const arming = (metal: string): LpcPart => ({
  layers: [
    { anim: 'walk', file: `weapon/sword/arming/universal/fg/walk/${metal}.png`, z: 140, frame: 64 },
    { anim: 'walk', file: `weapon/sword/arming/universal/bg/walk/${metal}.png`, z: 9, frame: 64 },
    { anim: 'slash', file: `weapon/sword/arming/attack_slash/fg/${metal}.png`, z: 150, frame: 128 },
    { anim: 'slash', file: `weapon/sword/arming/attack_slash/bg/${metal}.png`, z: 8, frame: 128 },
  ],
  credit: ARMING,
});

/** blade greys of the longsword → gold (hilt and outline stay) */
const GOLD_BLADE: Record<string, string> = {
  '#4b444c': '#6d4a00',
  '#7e7068': '#966600',
  '#867e7f': '#b47c0c',
  '#9f9899': '#d89a1c',
  '#b7afae': '#f0b838',
  '#c4b59f': '#ffc95a',
  '#e5e6c7': '#ffe68a',
  '#ffffff': '#fffbd0',
};

/** longsword / saber: fixed colours, oversize (192 px) attack */
const bigBlade = (name: 'longsword' | 'saber', behindZ: number, remap?: Record<string, string>): LpcPart => ({
  layers: [
    { anim: 'walk', file: `weapon/sword/${name}/walk/${name}.png`, z: 140, frame: 64 },
    { anim: 'walk', file: `weapon/sword/${name}/universal_behind/walk/${name}.png`, z: 9, frame: 64 },
    { anim: 'slash', file: `weapon/sword/${name}/attack_slash/${name}.png`, z: 150, frame: 192 },
    { anim: 'slash', file: `weapon/sword/${name}/attack_slash/behind/${name}.png`, z: behindZ, frame: 192 },
  ],
  remap,
  credit: `weapons/sword/weapon_sword_${name}.json`,
});

const PARTS = {
  // bodies & heads
  bodyMale: simple('body/bodies/male/', 10, D.body, 'body'),
  bodyMuscular: simple('body/bodies/muscular/', 10, D.body, 'body'),
  bodySkeleton: simple('body/bodies/skeleton/', 10, D.skeleton),
  bodyZombie: variant('body/bodies/zombie/', 'zombie', 10, D.zombie),
  headHuman: simple('head/heads/human/male/', 100, D.human, 'body'),
  headLizard: simple('head/heads/lizard/male/', 100, 'head/heads/reptile/heads_lizard_male.json', 'body', 'green'),
  headOrc: simple('head/heads/orc/male/', 100, 'head/heads/fantasy/heads_orc_male.json', 'body', 'green'),
  headTroll: simple('head/heads/troll/adult/', 100, 'head/heads/fantasy/heads_troll.json', 'body', 'green'),
  headSkeleton: simple('head/heads/skeleton/adult/', 100, 'head/heads/undead/heads_skeleton.json'),
  headZombie: simple('head/heads/zombie/adult/', 100, 'head/heads/undead/heads_zombie.json', 'body'),
  hair: simple('hair/plain/adult/', 120, D.hair, 'hair'),
  // clothes
  shirt: simple('torso/clothes/longsleeve/longsleeve/male/', 35, D.shirt, 'cloth'),
  pants: simple('legs/pants/male/', 20, D.pants, 'cloth'),
  shoes: simple('feet/shoes/basic/male/', 15, D.shoes, 'cloth'),
  bandages: variant('torso/bandage/male/', 'white', 110, 'torso/torso_bandages.json'),
  hood: simple('hat/cloth/hood/adult/', 130, 'headwear/coverings/hoods/hat_hood_cloth.json', 'cloth'),
  bandana: simple('hat/pirate/bandana/adult/', 120, 'headwear/coverings/bandana/hat_bandana_pirate.json', 'cloth', 'black'),
  tricorne: variant('hat/pirate/tricorne/captain/adult/', 'black', 130, 'headwear/hats/tricorne/hat_tricorne_captain.json'),
  // armour
  armourLeather: simple('torso/armour/leather/male/', 60, 'torso/armour/torso_armour_leather.json', 'cloth', 'leather'),
  armourLegion: simple('torso/armour/legion/male/', 60, 'torso/armour/torso_armour_legion.json', 'metal'),
  armourPlate: simple('torso/armour/plate/male/', 60, 'torso/armour/torso_armour_plate.json', 'metal'),
  // helmets
  helmNasal: simple('hat/helmet/nasal/adult/', 130, 'headwear/helmets/helmets/hat_helmet_nasal.json', 'metal'),
  helmSpangen: simple('hat/helmet/spangenhelm/adult/', 130, 'headwear/helmets/helmets/hat_helmet_spangenhelm.json', 'metal'),
  helmBarbuta: simple('hat/helmet/barbuta/male/', 130, 'headwear/helmets/helmets/hat_helmet_barbuta.json', 'metal'),
  helmArmet: simple('hat/helmet/armet/adult/', 130, 'headwear/helmets/helmets/hat_helmet_armet.json', 'metal'),
  helmGreat: simple('hat/helmet/greathelm/male/', 130, 'headwear/helmets/helmets/hat_helmet_greathelm.json', 'metal'),
  helmHorned: simple('hat/helmet/horned/adult/', 130, 'headwear/helmets/helmets/hat_helmet_horned.json', 'metal'),
  // shields
  shieldRound: variant('shield/round/', 'brown', 110, 'weapons/shields/shield_round.json'),
  shieldKiteGray: variant('shield/kite/male/', 'kite_gray', 110, 'weapons/shields/shield_kite.json'),
  shieldKiteBlue: variant('shield/kite/male/', 'kite_blue_gray', 110, 'weapons/shields/shield_kite.json'),
  shieldKiteRed: variant('shield/kite/male/', 'kite_red_gray', 110, 'weapons/shields/shield_kite.json'),
  shieldKiteGold: variant('shield/kite/male/', 'kite_orange', 110, 'weapons/shields/shield_kite.json'),
  // weapons
  dagger: {
    layers: [
      { anim: 'walk', file: 'weapon/sword/dagger/walk/dagger.png', z: 140, frame: 64 },
      { anim: 'walk', file: 'weapon/sword/dagger/behind/walk/dagger.png', z: 9, frame: 64 },
      { anim: 'slash', file: 'weapon/sword/dagger/slash/dagger.png', z: 140, frame: 64 },
      { anim: 'slash', file: 'weapon/sword/dagger/behind/slash/dagger.png', z: 9, frame: 64 },
    ],
    credit: 'weapons/sword/weapon_sword_dagger.json',
  },
  swordIron: arming('iron'),
  swordSteel: arming('steel'),
  swordSilver: arming('silver'),
  swordGold: arming('gold'),
  longsword: bigBlade('longsword', -1),
  longswordGold: bigBlade('longsword', -1, GOLD_BLADE),
  saber: bigBlade('saber', 8),
} satisfies Record<string, LpcPart>;

export type LpcPartId = keyof typeof PARTS;
export const LPC_PARTS: Record<LpcPartId, LpcPart> = PARTS;

/** a part plus optional colour (ramp name of the part's material) */
export interface PartUse {
  part: LpcPartId;
  color?: string;
}

export type CharacterLook = PartUse[];

// ---------------------------------------------------------------------------
// Hero: base look + visible equipment (slot × rarity)
// ---------------------------------------------------------------------------

export interface GearLook {
  slot: Slot;
  rarity: Rarity;
}

const HERO_BASE: CharacterLook = [
  { part: 'bodyMale' },
  { part: 'headHuman' },
  { part: 'pants', color: 'brown' },
  { part: 'shoes', color: 'black' },
];

const GEAR: Record<Slot, Record<Rarity | 'none', PartUse[]>> = {
  head: {
    none: [{ part: 'hair', color: 'dark_brown' }],
    common: [{ part: 'helmNasal', color: 'iron' }],
    uncommon: [{ part: 'helmSpangen', color: 'steel' }],
    rare: [{ part: 'helmBarbuta', color: 'silver' }],
    epic: [{ part: 'helmArmet', color: 'steel' }],
    legendary: [{ part: 'helmGreat', color: 'gold' }],
  },
  body: {
    none: [{ part: 'shirt', color: 'maroon' }],
    common: [{ part: 'shirt', color: 'maroon' }, { part: 'armourLeather' }],
    uncommon: [{ part: 'shirt', color: 'navy' }, { part: 'armourLegion', color: 'iron' }],
    rare: [{ part: 'shirt', color: 'navy' }, { part: 'armourLegion', color: 'steel' }],
    epic: [{ part: 'shirt', color: 'charcoal' }, { part: 'armourPlate', color: 'silver' }],
    legendary: [{ part: 'shirt', color: 'red' }, { part: 'armourPlate', color: 'gold' }],
  },
  weapon: {
    none: [{ part: 'dagger' }],
    common: [{ part: 'swordIron' }],
    uncommon: [{ part: 'swordSteel' }],
    rare: [{ part: 'swordSilver' }],
    epic: [{ part: 'longsword' }],
    legendary: [{ part: 'longswordGold' }],
  },
  shield: {
    none: [],
    common: [{ part: 'shieldRound' }],
    uncommon: [{ part: 'shieldKiteGray' }],
    rare: [{ part: 'shieldKiteBlue' }],
    epic: [{ part: 'shieldKiteRed' }],
    legendary: [{ part: 'shieldKiteGold' }],
  },
};

const SLOTS: Slot[] = ['head', 'body', 'weapon', 'shield'];

/** LPC parts for the hero with the given equipment (missing slot = nothing equipped) */
export function heroLook(gear: Partial<Record<Slot, Rarity>>): CharacterLook {
  return [...HERO_BASE, ...SLOTS.flatMap((s) => GEAR[s][gear[s] ?? 'none'])];
}

/** equipped items → rarity per slot (input for heroLook) */
export function gearOf(items: readonly Pick<Item, 'slot' | 'rarity'>[]): Partial<Record<Slot, Rarity>> {
  return Object.fromEntries(items.map((i) => [i.slot, i.rarity]));
}

/** stable cache key for a look */
export function lookKey(look: CharacterLook): string {
  return look.map((p) => (p.color ? `${p.part}:${p.color}` : p.part)).join('|');
}

// ---------------------------------------------------------------------------
// Monster sheets (OpenGameArt) – layouts checked frame by frame (see CREDITS.md for sources)
// ---------------------------------------------------------------------------

export interface FrameStrip {
  /** relative to MONSTER_ROOT */
  file: string;
  /** extra files with the identical layout, drawn on top in order (e.g. boar armour) */
  overlays?: string[];
  /** frame size in the source sheet */
  w: number;
  h: number;
  /** top-left of the first frame (default 0/0) */
  x?: number;
  y: number;
  /** distance between frames (default w) */
  step?: number;
  /** frames per row before wrapping to the next row (default: all in one row) */
  perRow?: number;
  frames: number;
  fps: number;
  /** horizontal offset per frame (negative = towards the hero) */
  nudge?: number[];
}

export interface MonsterSheet {
  walk: FrameStrip;
  attack: FrameStrip;
  /** source faces right → mirror it (enemies look to the left) */
  flip?: boolean;
  /** display scale of the native art (small 32 px art ×2, the huge dragon smaller) */
  scale?: number;
  /** remove the magenta background (#ff00ff) */
  chromaKey?: boolean;
  /** flying creatures: game pixels above the ground (native size) */
  lift?: number;
  /** the art already contains a ground shadow */
  ownShadow?: boolean;
  /** keep the walk cycle running while standing (flying, slithering, wobbling) */
  idleLoop?: boolean;
  credit: MonsterCredit;
}

export type MonsterCredit =
  | 'monsters'
  | 'wolf'
  | 'spider'
  | 'golem'
  | 'imp'
  | 'goblin'
  | 'beetle'
  | 'frogman'
  | 'boar'
  | 'ratdog'
  | 'dragon';

/** LPC-style sheets: rows up, left, down, right → row 1 faces left */
const row = (file: string, frames: number, r = 1, x = 0) => ({ file, w: 64, h: 64, x, y: r * 64, frames });

const BOAR_ARMOUR = [
  'flank_armor_straps',
  'leg_guard_straps',
  'backplate_straps',
  'rump_armor_straps',
  'flank_armor',
  'leg_guards',
  'headpiece',
  'backplate',
  'rump_armor',
  'spikes',
];
const armour = (anim: 'walk' | 'attack') => BOAR_ARMOUR.map((p) => `boar/armor-${p}-${anim}.png`);
const BOAR_NUDGE = [0, 0, -6, -3, 0, 0];

const SHEETS = {
  slime: {
    idleLoop: true,
    walk: { ...row('lpc-monsters/slime.png', 8), fps: 8 },
    attack: { ...row('lpc-monsters/slime.png', 3, 0, 192), fps: 8 },
    credit: 'monsters',
  },
  bat: {
    idleLoop: true,
    walk: { ...row('lpc-monsters/bat.png', 4, 1, 64), fps: 10 },
    attack: { ...row('lpc-monsters/bat.png', 3, 1, 256), fps: 10 },
    lift: 14,
    scale: 1.5,
    credit: 'monsters',
  },
  snake: {
    idleLoop: true,
    walk: { ...row('lpc-monsters/snake.png', 4), fps: 7 },
    attack: { ...row('lpc-monsters/snake.png', 3, 1, 256), fps: 9 },
    credit: 'monsters',
  },
  ghost: {
    idleLoop: true,
    walk: { ...row('lpc-monsters/ghost.png', 3), fps: 6 },
    attack: { ...row('lpc-monsters/ghost.png', 2, 1, 256), fps: 6 },
    ownShadow: true,
    credit: 'monsters',
  },
  eyeball: {
    idleLoop: true,
    walk: { ...row('lpc-monsters/eyeball.png', 4), fps: 6 },
    attack: { ...row('lpc-monsters/eyeball.png', 2, 1, 256), fps: 6 },
    ownShadow: true,
    credit: 'monsters',
  },
  worm: {
    idleLoop: true,
    walk: { ...row('lpc-monsters/big_worm.png', 4), fps: 6 },
    attack: { ...row('lpc-monsters/big_worm.png', 2, 1, 256), fps: 5 },
    credit: 'monsters',
  },
  flower: {
    idleLoop: true,
    // row 3 lunges to the left
    walk: { file: 'lpc-monsters/man_eater_flower.png', w: 128, h: 128, y: 384, frames: 3, fps: 5 },
    attack: { file: 'lpc-monsters/man_eater_flower.png', w: 128, h: 128, x: 384, y: 384, frames: 3, fps: 7 },
    credit: 'monsters',
  },
  wolf: {
    // lower half of the sheet faces left: walk (row 9), bite (row 11)
    walk: { file: 'wolf/wolfsheet1.png', w: 64, h: 32, x: 320, y: 288, frames: 5, fps: 10 },
    attack: { file: 'wolf/wolfsheet1.png', w: 64, h: 32, x: 320, y: 352, frames: 5, fps: 12 },
    credit: 'wolf',
  },
  spider: {
    walk: { ...row('spider/spider01.png', 6, 1, 256), fps: 10 },
    attack: { ...row('spider/spider01.png', 4), fps: 9 },
    credit: 'spider',
  },
  spiderRed: {
    walk: { ...row('spider/spider03.png', 6, 1, 256), fps: 10 },
    attack: { ...row('spider/spider03.png', 4), fps: 9 },
    credit: 'spider',
  },
  golem: {
    walk: { ...row('golem/golem-walk.png', 7), fps: 7 },
    attack: { file: 'golem/golem-atk.png', w: 64, h: 96, y: 96, frames: 7, fps: 9 },
    credit: 'golem',
  },
  imp: {
    idleLoop: true,
    walk: { ...row('imp/walk-pitchfork.png', 4), fps: 8 },
    attack: { ...row('imp/attack-pitchfork.png', 4), fps: 9 },
    credit: 'imp',
  },
  goblin: {
    // this sheet has right in row 1 and left in row 3
    walk: { ...row('goblin/goblin.png', 7, 3, 64), fps: 9 },
    attack: { ...row('goblin/goblin.png', 3, 3, 512), fps: 8 },
    credit: 'goblin',
  },
  goblinSword: {
    walk: { ...row('goblin/goblinsword.png', 7, 3, 64), fps: 9 },
    attack: { ...row('goblin/goblinsword.png', 3, 3, 512), fps: 8 },
    credit: 'goblin',
  },
  beetle: {
    // 48 px cells between 1 px white grid lines on magenta, row 2 faces left
    walk: { file: 'beetle/beetle.png', w: 48, h: 48, x: 2, y: 100, step: 49, frames: 5, fps: 8 },
    attack: { file: 'beetle/beetle.png', w: 48, h: 48, x: 2, y: 100, step: 49, frames: 5, fps: 16 },
    chromaKey: true,
    scale: 1.5,
    credit: 'beetle',
  },
  frogman: {
    walk: { file: 'frogman/frogman.png', w: 80, h: 96, y: 480, frames: 6, fps: 9 },
    attack: { file: 'frogman/frogman.png', w: 80, h: 96, y: 96, frames: 4, fps: 8 },
    credit: 'frogman',
  },
  boar: {
    walk: { ...row('boar/walk.png', 4), fps: 8 },
    attack: { ...row('boar/attack.png', 6), fps: 12, nudge: BOAR_NUDGE },
    credit: 'boar',
  },
  boarArmoured: {
    walk: { ...row('boar/walk.png', 4), overlays: armour('walk'), fps: 8 },
    attack: { ...row('boar/attack.png', 6), overlays: armour('attack'), fps: 12, nudge: BOAR_NUDGE },
    credit: 'boar',
  },
  rat: {
    walk: { file: 'ratdog/ratdog.png', w: 32, h: 32, y: 32, frames: 3, fps: 9 },
    attack: { file: 'ratdog/ratdog.png', w: 32, h: 32, y: 32, frames: 3, fps: 16 },
    scale: 2,
    credit: 'ratdog',
  },
  dog: {
    walk: { file: 'ratdog/ratdog.png', w: 32, h: 32, y: 160, frames: 3, fps: 9 },
    attack: { file: 'ratdog/ratdog.png', w: 32, h: 32, y: 160, frames: 3, fps: 16 },
    scale: 2,
    credit: 'ratdog',
  },
  dragon: {
    idleLoop: true,
    // one 8-frame flight cycle in rows 0–1 (rows 2–3 repeat it with a hit flash)
    walk: { file: 'dragon/reddragonfly.png', w: 205, h: 161, y: 0, perRow: 4, frames: 8, fps: 8 },
    attack: { file: 'dragon/reddragonfly.png', w: 205, h: 161, y: 161, frames: 4, fps: 10 },
    flip: true,
    scale: 0.6,
    lift: 10,
    credit: 'dragon',
  },
} satisfies Record<string, MonsterSheet>;

export type MonsterId = keyof typeof SHEETS;
export const MONSTERS: Record<MonsterId, MonsterSheet> = SHEETS;

// ---------------------------------------------------------------------------
// Enemy id (world.ts) → sprite
// ---------------------------------------------------------------------------

export type EnemySprite =
  | { kind: 'monster'; id: MonsterId; recolor?: boolean }
  | { kind: 'lpc'; look: CharacterLook };

const m = (id: MonsterId, recolor = false): EnemySprite => ({ kind: 'monster', id, recolor });
const c = (...look: CharacterLook): EnemySprite => ({ kind: 'lpc', look });

const skeleton: CharacterLook = [{ part: 'bodySkeleton' }, { part: 'headSkeleton' }];
const zombie: CharacterLook = [{ part: 'bodyZombie' }, { part: 'headZombie' }];

export const ENEMY_SPRITES: Record<string, EnemySprite> = {
  // Straße
  rat: m('rat'),
  slime: m('slime'),
  thief: c(
    { part: 'bodyMale', color: 'olive' },
    { part: 'headHuman', color: 'olive' },
    { part: 'pants', color: 'charcoal' },
    { part: 'shoes', color: 'black' },
    { part: 'shirt', color: 'brown' },
    { part: 'hood', color: 'charcoal' },
    { part: 'dagger' },
  ),
  dog: m('dog'),
  ratking: m('rat', true),
  thiefmaster: c(
    { part: 'bodyMale', color: 'olive' },
    { part: 'headHuman', color: 'olive' },
    { part: 'pants', color: 'black' },
    { part: 'shoes', color: 'black' },
    { part: 'shirt', color: 'purple' },
    { part: 'armourLeather' },
    { part: 'hood', color: 'purple' },
    { part: 'swordIron' },
  ),
  banditlord: c(
    { part: 'bodyMuscular' },
    { part: 'headHuman' },
    { part: 'pants', color: 'maroon' },
    { part: 'shoes', color: 'black' },
    { part: 'helmHorned', color: 'iron' },
    { part: 'swordSteel' },
    { part: 'shieldRound' },
  ),
  // Wald
  wolf: m('wolf'),
  kobold: m('goblin'),
  beetle: m('beetle', true),
  boar: m('boar'),
  koboldchief: m('goblinSword'),
  boarlord: m('boarArmoured'),
  alphawolf: m('wolf', true),
  // Dunkler Wald
  spider: m('spider'),
  bat: m('bat'),
  skeleton: c(...skeleton, { part: 'dagger' }),
  wisp: m('ghost', true),
  spiderqueen: m('spiderRed'),
  skeletonknight: c(
    ...skeleton,
    { part: 'armourPlate', color: 'iron' },
    { part: 'helmBarbuta', color: 'iron' },
    { part: 'swordSteel' },
    { part: 'shieldKiteGray' },
  ),
  treant: m('golem', true),
  // Sumpf
  swampslime: m('slime', true),
  lizard: c(
    { part: 'bodyMale', color: 'green' },
    { part: 'headLizard', color: 'green' },
    { part: 'pants', color: 'brown' },
    { part: 'armourLeather' },
    { part: 'swordIron' },
    { part: 'shieldRound' },
  ),
  bogcorpse: c(...zombie, { part: 'pants', color: 'forest' }),
  frog: m('frogman'),
  lizardchief: c(
    { part: 'bodyMale', color: 'dark_green' },
    { part: 'headLizard', color: 'dark_green' },
    { part: 'pants', color: 'teal' },
    { part: 'armourLegion', color: 'bronze' },
    { part: 'longsword' },
  ),
  bogterror: m('flower', true),
  hydra: m('snake', true),
  // Wüste
  scorpion: m('spider', true),
  scarab: m('beetle', true),
  mummy: c(...zombie, { part: 'pants', color: 'tan' }, { part: 'bandages' }),
  sandworm: m('worm'),
  giantscorpion: m('spider', true),
  pharaoh: c(
    ...zombie,
    { part: 'pants', color: 'tan' },
    { part: 'bandages' },
    { part: 'armourLegion', color: 'gold' },
    { part: 'helmHorned', color: 'gold' },
    { part: 'swordGold' },
  ),
  sandwormking: m('worm', true),
  // Strand
  crab: m('beetle', true),
  pirateskeleton: c(...skeleton, { part: 'bandana', color: 'red' }, { part: 'saber' }),
  fishman: m('frogman', true),
  seaserpent: m('snake', true),
  crabking: m('beetle', true),
  piratecaptain: c(
    { part: 'bodyMale', color: 'olive' },
    { part: 'headHuman', color: 'olive' },
    { part: 'pants', color: 'navy' },
    { part: 'shoes', color: 'black' },
    { part: 'shirt', color: 'white' },
    { part: 'armourLeather' },
    { part: 'tricorne' },
    { part: 'saber' },
  ),
  // eye with tentacles
  kraken: m('eyeball', true),
  // Schnee
  icewolf: m('wolf', true),
  yeti: c({ part: 'bodyMuscular', color: 'fur_white' }, { part: 'headTroll', color: 'fur_white' }),
  icegolem: m('golem', true),
  frostspirit: m('ghost', true),
  yetichief: c(
    { part: 'bodyMuscular', color: 'fur_white' },
    { part: 'headTroll', color: 'fur_white' },
    { part: 'helmHorned', color: 'bronze' },
    { part: 'longsword' },
  ),
  glaciergolem: m('golem', true),
  frostgiant: c(
    { part: 'bodyMuscular', color: 'blue' },
    { part: 'headTroll', color: 'blue' },
    { part: 'pants', color: 'slate' },
    { part: 'helmHorned', color: 'silver' },
    { part: 'longsword' },
  ),
  // Vulkan
  fireimp: m('imp'),
  lavagolem: m('golem', true),
  hellhound: m('wolf', true),
  fireelemental: m('ghost', true),
  hellhoundalpha: m('wolf', true),
  magmatitan: m('golem', true),
  dragon: m('dragon'),
};

/** files a look needs (for preloading and tests) */
export function lookFiles(look: CharacterLook): string[] {
  return [...new Set(look.flatMap((u) => LPC_PARTS[u.part].layers.map((l) => l.file)))];
}
