// Downloads the few LPC generator layers the game uses (walk + slash only) into
// public/assets/lpc/spritesheets/… and their sheet definitions (credits!) into assets-src/lpc/.
// Source: https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator
// Usage: node scripts/fetch-lpc.mjs   (skips files that already exist)
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const RAW = 'https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/master';
const OUT_IMG = 'public/assets/lpc/spritesheets';
const OUT_DEF = 'assets-src/lpc/sheet_definitions';
const ANIMS = ['walk', 'slash'];

/** definition → body types to fetch (+ optional subset of colour variants) */
const ITEMS = [
  // hero base
  ['body/body.json', ['male', 'muscular']],
  ['head/heads/human/heads_human_male.json', ['male', 'muscular']],
  ['hair/short/hair_plain.json', ['male']],
  ['torso/shirts/longsleeve/torso_clothes_longsleeve.json', ['male', 'muscular']],
  ['legs/pants/legs_pants.json', ['male', 'muscular']],
  ['feet/shoes/feet_shoes_basic.json', ['male', 'muscular']],
  // armour / helmets (metal recolour at runtime)
  ['torso/armour/torso_armour_leather.json', ['male', 'muscular']],
  ['torso/armour/torso_armour_legion.json', ['male', 'muscular']],
  ['torso/armour/torso_armour_plate.json', ['male', 'muscular']],
  ['headwear/helmets/helmets/hat_helmet_nasal.json', ['male']],
  ['headwear/helmets/helmets/hat_helmet_spangenhelm.json', ['male']],
  ['headwear/helmets/helmets/hat_helmet_barbuta.json', ['male']],
  ['headwear/helmets/helmets/hat_helmet_armet.json', ['male']],
  ['headwear/helmets/helmets/hat_helmet_greathelm.json', ['male']],
  ['headwear/helmets/helmets/hat_helmet_horned.json', ['male', 'muscular']],
  // weapons (variants = metal colours)
  ['weapons/sword/weapon_sword_dagger.json', ['male']],
  ['weapons/sword/weapon_sword_arming.json', ['male'], ['iron', 'steel', 'silver', 'gold']],
  ['weapons/sword/weapon_sword_longsword.json', ['male']],
  ['weapons/sword/weapon_sword_saber.json', ['male']],
  // shields
  ['weapons/shields/shield_round.json', ['male']],
  ['weapons/shields/shield_kite.json', ['male'], ['kite gray', 'kite blue gray', 'kite red gray', 'kite orange']],
  // enemies
  ['body/special/body_skeleton.json', ['male', 'skeleton']],
  ['body/special/body_zombie.json', ['male', 'zombie']],
  ['head/heads/undead/heads_skeleton.json', ['male', 'skeleton']],
  ['head/heads/undead/heads_zombie.json', ['male', 'zombie']],
  ['head/heads/reptile/heads_lizard_male.json', ['male', 'muscular']],
  ['head/heads/fantasy/heads_troll.json', ['male', 'muscular']],
  ['head/heads/fantasy/heads_orc_male.json', ['male', 'muscular']],
  ['headwear/coverings/hoods/hat_hood_cloth.json', ['male']],
  ['headwear/coverings/bandana/hat_bandana_pirate.json', ['male']],
  ['headwear/hats/tricorne/hat_tricorne_captain.json', ['male']],
  ['torso/torso_bandages.json', ['male']],
];

let downloaded = 0;
let bytes = 0;
const missing = [];

async function get(url) {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function save(rel, outRoot, url) {
  const file = join(outRoot, rel);
  if (existsSync(file)) return true;
  const buf = await get(url);
  if (!buf) return false;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buf);
  downloaded++;
  bytes += buf.length;
  return true;
}

const fileName = (variant) => variant.replace(/ /g, '_') + '.png';

for (const [defPath, bodyTypes, variantSubset] of ITEMS) {
  const defBuf = await get(`${RAW}/sheet_definitions/${defPath}`);
  if (!defBuf) {
    missing.push('definition ' + defPath);
    continue;
  }
  mkdirSync(dirname(join(OUT_DEF, defPath)), { recursive: true });
  writeFileSync(join(OUT_DEF, defPath), defBuf);
  const def = JSON.parse(defBuf.toString('utf8'));
  const variants = variantSubset ?? (def.variants ? [def.variants[0]] : null);
  const layers = Object.keys(def).filter((k) => k.startsWith('layer_'));
  for (const key of layers) {
    const layer = def[key];
    const paths = new Set(bodyTypes.map((b) => layer[b]).filter(Boolean));
    for (const lp of paths) {
      if (layer.custom_animation) {
        if (layer.custom_animation !== 'slash_128' && layer.custom_animation !== 'slash_oversize') continue;
        for (const v of variants ?? []) {
          const rel = `${lp}${fileName(v)}`;
          if (!(await save(rel, OUT_IMG, `${RAW}/spritesheets/${rel}`))) missing.push(rel);
        }
        continue;
      }
      for (const anim of ANIMS) {
        if (variants) {
          for (const v of variants) {
            const rel = `${lp}${anim}/${fileName(v)}`;
            if (!(await save(rel, OUT_IMG, `${RAW}/spritesheets/${rel}`))) missing.push(rel);
          }
        } else {
          const rel = `${lp}${anim}.png`;
          if (!(await save(rel, OUT_IMG, `${RAW}/spritesheets/${rel}`))) missing.push(rel);
        }
      }
    }
  }
}

console.log(`downloaded ${downloaded} files, ${(bytes / 1024).toFixed(0)} KB`);
if (missing.length) console.log('not found (ok for weapons without slash etc.):\n  ' + missing.join('\n  '));
