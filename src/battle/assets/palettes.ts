/**
 * LPC colour ramps (6 colours, dark → light) from the Universal LPC generator
 * (palette_definitions/*_ulpc.json). Recolouring maps the base ramp of a material
 * onto another ramp, colour by colour (same technique as the generator).
 * Generated from assets-src/lpc/palette_definitions – do not edit by hand.
 */
export const RAMPS = {
  metal: {
    steel: [
      "#1d131e",
      "#4d4a5d",
      "#726b7e",
      "#867e7f",
      "#c4b59f",
      "#ffffff"
    ],
    iron: [
      "#000000",
      "#1b192b",
      "#29253a",
      "#343043",
      "#484152",
      "#726b7e"
    ],
    silver: [
      "#1d131e",
      "#31313e",
      "#4a5057",
      "#818b8b",
      "#d6e1d3",
      "#ffffff"
    ],
    gold: [
      "#2e2533",
      "#6d4a00",
      "#966600",
      "#dc6f35",
      "#ffc95a",
      "#ffff61"
    ],
    bronze: [
      "#4f2313",
      "#6d4a00",
      "#966600",
      "#bf8200",
      "#e7a820",
      "#fbe3b0"
    ],
    copper: [
      "#691503",
      "#7b2008",
      "#973c23",
      "#9d5427",
      "#ec855c",
      "#ffc95a"
    ],
    brass: [
      "#1a1213",
      "#61482c",
      "#836332",
      "#af8a35",
      "#fdd082",
      "#fdf5cc"
    ]
  },
  cloth: {
    white: [
      "#281820",
      "#4d4a5d",
      "#958080",
      "#c4b59f",
      "#e5e6c7",
      "#ffffff"
    ],
    leather: [
      "#2b1c1d",
      "#311210",
      "#4b2b13",
      "#704325",
      "#75502d",
      "#9a6f37"
    ],
    brown: [
      "#1d131e",
      "#411e05",
      "#4b2b13",
      "#62351c",
      "#744b30",
      "#996b4a"
    ],
    maroon: [
      "#1d131e",
      "#400b1f",
      "#551c22",
      "#682121",
      "#832121",
      "#ae424a"
    ],
    red: [
      "#1d131e",
      "#400b1f",
      "#651117",
      "#82171c",
      "#ab1e1e",
      "#cd2429"
    ],
    blue: [
      "#180716",
      "#281e41",
      "#322d6a",
      "#3c49ad",
      "#466ac9",
      "#61a0ef"
    ],
    navy: [
      "#180716",
      "#20102b",
      "#281e41",
      "#322d6a",
      "#3c49ad",
      "#466ac9"
    ],
    black: [
      "#000000",
      "#101414",
      "#1c2222",
      "#22282a",
      "#2a3034",
      "#4a5057"
    ],
    charcoal: [
      "#000000",
      "#130d14",
      "#1c2222",
      "#2a3034",
      "#4a5057",
      "#6e7675"
    ],
    gray: [
      "#0e0e18",
      "#201e2b",
      "#373340",
      "#585561",
      "#797580",
      "#a2a0a4"
    ],
    purple: [
      "#180716",
      "#13112d",
      "#261044",
      "#411357",
      "#621e78",
      "#813089"
    ],
    forest: [
      "#09131d",
      "#07391d",
      "#0b1f25",
      "#0b2b28",
      "#134507",
      "#1b5502"
    ],
    green: [
      "#101820",
      "#192832",
      "#0b5c2f",
      "#214437",
      "#2f8136",
      "#64a42c"
    ],
    tan: [
      "#3e2613",
      "#684415",
      "#986a20",
      "#b78c41",
      "#b7996a",
      "#cfc587"
    ],
    teal: [
      "#180716",
      "#1b2b47",
      "#0e4e72",
      "#156c99",
      "#0098b2",
      "#00cfdf"
    ],
    slate: [
      "#1d131e",
      "#31313e",
      "#4a5057",
      "#818b8b",
      "#b3afa1",
      "#e5e6c7"
    ]
  },
  body: {
    light: [
      "#271920",
      "#99423c",
      "#cc8665",
      "#e4a47c",
      "#f9d5ba",
      "#faece7"
    ],
    olive: [
      "#271920",
      "#442725",
      "#7f4c31",
      "#ae6b3f",
      "#d38b59",
      "#e4a47c"
    ],
    green: [
      "#140c09",
      "#09320b",
      "#19541d",
      "#228236",
      "#39aa4e",
      "#53bf71"
    ],
    dark_green: [
      "#011708",
      "#02280e",
      "#06410e",
      "#255e1d",
      "#508a48",
      "#509e59"
    ],
    blue: [
      "#16171b",
      "#46425d",
      "#586b90",
      "#748da4",
      "#a9c9ca",
      "#c8e8e8"
    ],
    fur_white: [
      "#17171a",
      "#36363f",
      "#484e57",
      "#8b9498",
      "#b8bbbc",
      "#d8dcdc"
    ],
    zombie_green: [
      "#101925",
      "#074337",
      "#4a7a69",
      "#839f6e",
      "#d4d887",
      "#f2f0c4"
    ],
    lavender: [
      "#16171b",
      "#393b44",
      "#787c8f",
      "#a0a5bc",
      "#c9d0ee",
      "#fbece6"
    ]
  },
  hair: {
    orange: [
      "#260d14",
      "#6a1108",
      "#a42600",
      "#bf4000",
      "#e55600",
      "#ff8a00"
    ],
    dark_brown: [
      "#050100",
      "#160701",
      "#290e02",
      "#421603",
      "#5f1f04",
      "#792806"
    ],
    chestnut: [
      "#200c0d",
      "#3a130e",
      "#63200b",
      "#81310a",
      "#b6550e",
      "#d28102"
    ],
    black: [
      "#000000",
      "#080a0a",
      "#101414",
      "#1c2222",
      "#31313e",
      "#4a5057"
    ]
  }
} as const;

export type Material = keyof typeof RAMPS;
/** colour the original sprites are drawn in */
export const BASE_RAMP: Record<Material, string> = { metal: 'steel', cloth: 'white', body: 'light', hair: 'orange' };

export function ramp(material: Material, name: string): readonly string[] | null {
  return (RAMPS[material] as Record<string, readonly string[]>)[name] ?? null;
}
