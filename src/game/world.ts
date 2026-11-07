import type { StagePosition } from './types';

/**
 * World content: names, enemy types and placeholder looks.
 * All numbers (HP, damage, growth, archetype multipliers) live in balance.ts.
 */

export type Archetype = 'balanced' | 'swift' | 'brute' | 'tank' | 'caster';
/** placeholder sprite families (replaced by real art in Phase 3) */
export type EnemyShape = 'slime' | 'beast' | 'humanoid' | 'flyer' | 'bug' | 'golem' | 'serpent' | 'dragon';

export interface EnemyDef {
  id: string;
  name: string;
  archetype: Archetype;
  shape: EnemyShape;
  /** base / dark / light colour of the placeholder sprite */
  colors: [string, string, string];
}

export interface AreaDef {
  id: string;
  name: string;
  /** sky top, sky bottom, far hills, near hills, ground, ground dark */
  palette: [string, string, string, string, string, string];
  enemies: [EnemyDef, EnemyDef, EnemyDef, EnemyDef];
  /** stage 10 and 20 */
  midBosses: [EnemyDef, EnemyDef];
  boss: EnemyDef;
}

const e = (
  id: string,
  name: string,
  archetype: Archetype,
  shape: EnemyShape,
  colors: [string, string, string],
): EnemyDef => ({ id, name, archetype, shape, colors });

export const AREAS: AreaDef[] = [
  {
    id: 'street',
    name: 'Straße',
    palette: ['#3d5a80', '#98c1d9', '#5b7c6a', '#4a6b52', '#7a6a55', '#5a4b3a'],
    enemies: [
      e('rat', 'Ratte', 'swift', 'beast', ['#8a7f76', '#5c544e', '#b8aea4']),
      e('slime', 'Schleim', 'tank', 'slime', ['#6cc24a', '#3f8a2a', '#b4f08f']),
      e('thief', 'Strauchdieb', 'balanced', 'humanoid', ['#7a5c3e', '#4e3a26', '#c9a37a']),
      e('dog', 'Streunender Hund', 'brute', 'beast', ['#a0703c', '#6b4723', '#d8a86c']),
    ],
    midBosses: [
      e('ratking', 'Rattenkönig', 'swift', 'beast', ['#6e6259', '#433a33', '#c2b29f']),
      e('thiefmaster', 'Meisterdieb', 'balanced', 'humanoid', ['#4a3f5c', '#2c253a', '#8c7fa8']),
    ],
    boss: e('banditlord', 'Banditenanführer', 'brute', 'humanoid', ['#8f2a20', '#5e1410', '#e07a5f']),
  },
  {
    id: 'forest',
    name: 'Wald',
    palette: ['#2f5d50', '#8fc0a9', '#2f6b3f', '#245232', '#4f7a32', '#365622'],
    enemies: [
      e('wolf', 'Wolf', 'swift', 'beast', ['#7d7d85', '#4d4d55', '#b5b5bd']),
      e('kobold', 'Kobold', 'caster', 'humanoid', ['#6f9a3a', '#466524', '#a9d16b']),
      e('beetle', 'Riesenkäfer', 'tank', 'bug', ['#3a6b8c', '#22445c', '#7fb3d5']),
      e('boar', 'Wildschwein', 'brute', 'beast', ['#6b4a35', '#43291b', '#a47a5a']),
    ],
    midBosses: [
      e('koboldchief', 'Koboldhäuptling', 'caster', 'humanoid', ['#8aa83a', '#566b20', '#cde27a']),
      e('boarlord', 'Keilerfürst', 'brute', 'beast', ['#5a3a28', '#331f14', '#94664a']),
    ],
    boss: e('alphawolf', 'Alpha-Wolf', 'swift', 'beast', ['#a8a8b8', '#5c5c6e', '#e8e8f4']),
  },
  {
    id: 'darkforest',
    name: 'Dunkler Wald',
    palette: ['#1b1b2f', '#3b3b5c', '#22302a', '#18231e', '#2e3b26', '#1d2618'],
    enemies: [
      e('spider', 'Riesenspinne', 'brute', 'bug', ['#3b2f4a', '#211a2b', '#7a6690']),
      e('bat', 'Fledermaus', 'swift', 'flyer', ['#4a3a4f', '#2a1f2d', '#8e7596']),
      e('skeleton', 'Skelett', 'balanced', 'humanoid', ['#d8d4c8', '#9a958a', '#ffffff']),
      e('wisp', 'Irrlicht', 'caster', 'flyer', ['#7fd6ff', '#3a8fb8', '#e0f7ff']),
    ],
    midBosses: [
      e('spiderqueen', 'Spinnenkönigin', 'brute', 'bug', ['#5e2a5e', '#3a163a', '#b066b0']),
      e('skeletonknight', 'Skelettritter', 'tank', 'humanoid', ['#b8b4a8', '#6e6a60', '#efece2']),
    ],
    boss: e('treant', 'Verdorbener Baumgeist', 'tank', 'golem', ['#4e3b2a', '#2b1f15', '#7a9a4a']),
  },
  {
    id: 'swamp',
    name: 'Sumpf',
    palette: ['#3e4a3a', '#8a9a6a', '#4a5a3a', '#3a4a2c', '#4b5a34', '#323e22'],
    enemies: [
      e('swampslime', 'Sumpfschleim', 'tank', 'slime', ['#5a6b2a', '#38441a', '#9aaa5a']),
      e('lizard', 'Echsenkrieger', 'brute', 'humanoid', ['#3a8a5a', '#225a38', '#7acc96']),
      e('bogcorpse', 'Moorleiche', 'balanced', 'humanoid', ['#6a7a5a', '#3e4a32', '#a8b892']),
      e('frog', 'Riesenfrosch', 'swift', 'slime', ['#4ab84a', '#2a7a2a', '#9ae89a']),
    ],
    midBosses: [
      e('lizardchief', 'Echsenhäuptling', 'brute', 'humanoid', ['#2a7a6a', '#164a40', '#6acab8']),
      e('bogterror', 'Sumpfschrecken', 'caster', 'slime', ['#5a3a6a', '#36203f', '#a07ab8']),
    ],
    boss: e('hydra', 'Hydra', 'brute', 'serpent', ['#2a8a4a', '#16522a', '#8ae0a0']),
  },
  {
    id: 'desert',
    name: 'Wüste',
    palette: ['#e09f3e', '#f6d8a8', '#d9a566', '#c48a4a', '#e0c080', '#b8955a'],
    enemies: [
      e('scorpion', 'Skorpion', 'caster', 'bug', ['#b8652a', '#7a3e16', '#e8a06a']),
      e('scarab', 'Skarabäus', 'tank', 'bug', ['#2a6a8a', '#16405a', '#6ab0d8']),
      e('mummy', 'Mumie', 'balanced', 'humanoid', ['#d8ccaa', '#9a8e6e', '#f8f0d8']),
      e('sandworm', 'Sandwurm', 'brute', 'serpent', ['#c8a46a', '#8a6a3a', '#ecd2a0']),
    ],
    midBosses: [
      e('giantscorpion', 'Riesenskorpion', 'brute', 'bug', ['#a83a2a', '#6a1e14', '#e07a6a']),
      e('pharaoh', 'Mumienpharao', 'caster', 'humanoid', ['#e8c04a', '#a8801e', '#fff0a0']),
    ],
    boss: e('sandwormking', 'Sandwurm-König', 'tank', 'serpent', ['#d8b45a', '#9a7a2a', '#fff0b0']),
  },
  {
    id: 'beach',
    name: 'Strand',
    palette: ['#3a86c8', '#b8e0f8', '#3a9ab8', '#2a7a98', '#e8d8a0', '#c8b478'],
    enemies: [
      e('crab', 'Riesenkrabbe', 'tank', 'bug', ['#d84a3a', '#8a2a1e', '#f8987a']),
      e('pirateskeleton', 'Piratenskelett', 'balanced', 'humanoid', ['#c8c0b0', '#7a7266', '#f0ece4']),
      e('fishman', 'Fischmensch', 'swift', 'humanoid', ['#3a9a9a', '#1e6060', '#8ad8d8']),
      e('seaserpent', 'Seeschlange', 'caster', 'serpent', ['#2a6ab8', '#16407a', '#7ab0f0']),
    ],
    midBosses: [
      e('crabking', 'Krabbenkönig', 'tank', 'bug', ['#e86a2a', '#9a3e14', '#ffb07a']),
      e('piratecaptain', 'Piratenkapitän', 'brute', 'humanoid', ['#3a3a5a', '#1e1e36', '#8a8ab0']),
    ],
    boss: e('kraken', 'Kraken', 'brute', 'slime', ['#8a3a8a', '#541e54', '#d07ad0']),
  },
  {
    id: 'snow',
    name: 'Schnee',
    palette: ['#8aa8c8', '#e8f0f8', '#c8d8e8', '#a8c0d8', '#f0f4f8', '#c8d4e0'],
    enemies: [
      e('icewolf', 'Eiswolf', 'swift', 'beast', ['#a8d0f0', '#5a8ab8', '#ffffff']),
      e('yeti', 'Yeti', 'brute', 'humanoid', ['#e8eef4', '#a8b4c4', '#ffffff']),
      e('icegolem', 'Eisgolem', 'tank', 'golem', ['#7ac0e8', '#3a7aa8', '#d0f0ff']),
      e('frostspirit', 'Frostgeist', 'caster', 'flyer', ['#b0e0ff', '#5aa0d0', '#ffffff']),
    ],
    midBosses: [
      e('yetichief', 'Yeti-Häuptling', 'brute', 'humanoid', ['#d0dce8', '#8a98aa', '#ffffff']),
      e('glaciergolem', 'Gletschergolem', 'tank', 'golem', ['#5aa0d8', '#2a6098', '#b0e0ff']),
    ],
    boss: e('frostgiant', 'Frostriese', 'tank', 'humanoid', ['#6a9ad8', '#3a5a98', '#c0e0ff']),
  },
  {
    id: 'volcano',
    name: 'Vulkan',
    palette: ['#2a0e0e', '#8a2a1a', '#4a1e16', '#36140e', '#3a2a26', '#241816'],
    enemies: [
      e('fireimp', 'Feuerkobold', 'swift', 'humanoid', ['#e85a2a', '#9a3014', '#ffb05a']),
      e('lavagolem', 'Lavagolem', 'tank', 'golem', ['#d8401a', '#7a1e0e', '#ffa040']),
      e('hellhound', 'Höllenhund', 'brute', 'beast', ['#4a1e1e', '#2a0e0e', '#e8401a']),
      e('fireelemental', 'Feuerelementar', 'caster', 'flyer', ['#ffa02a', '#d8501a', '#fff0a0']),
    ],
    midBosses: [
      e('hellhoundalpha', 'Höllenhund-Alpha', 'brute', 'beast', ['#6a1e1e', '#3a0e0e', '#ff6a2a']),
      e('magmatitan', 'Magmatitan', 'tank', 'golem', ['#b8301a', '#5a120a', '#ffc040']),
    ],
    boss: e('dragon', 'Drache', 'brute', 'dragon', ['#b8201a', '#6a0e0a', '#f0a040']),
  },
];

export function areaDef(area: number): AreaDef {
  return AREAS[Math.min(AREAS.length, Math.max(1, area)) - 1];
}

export function areaName(area: number): string {
  return areaDef(area).name;
}

/** "Gebiet 2 – Wald" (+ ★ from round 2 on) */
export function areaLabel(area: number, round = 1): string {
  return `Gebiet ${area} – ${areaName(area)}${roundStars(round)}`;
}

/** "Gebiet 2 – Wald · Stufe 14/25" (+ ★ from round 2 on) */
/** "", " ★", " ★★", … " ★×4" – one star per completed round */
export function roundStars(round: number): string {
  const n = round - 1;
  return n <= 0 ? '' : n <= 3 ? ` ${'★'.repeat(n)}` : ` ★×${n}`;
}

export function formatStage(pos: StagePosition, stagesPerArea: number): string {
  return `${areaLabel(pos.area, pos.round)} · Stufe ${pos.stage}/${stagesPerArea}`;
}
