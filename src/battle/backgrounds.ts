/**
 * Procedural parallax backgrounds per area (Phase 3, SPEC 6.5): sky, clouds,
 * far silhouette, mid layer with props, ground. Drawn once per area into canvas
 * textures with plain rectangles (crisp pixel art at "game pixel" resolution) –
 * no image files needed. Every tile is seamless horizontally.
 */
import * as Phaser from 'phaser';
import type { AreaDef } from '../game/world';

// ---------------------------------------------------------------------------
// geometry
// ---------------------------------------------------------------------------

/** ground band at the bottom of the scene */
export function groundHeight(sceneH: number): number {
  return Math.max(24, Math.round(sceneH * 0.17));
}

/** fighters stand a bit inside the ground band (depth) */
export function feetInset(sceneH: number): number {
  return Math.round(groundHeight(sceneH) * 0.36);
}

const FAR_TILE_W = 384;
const MID_TILE_W = 320;
const CLOUD_TILE_W = 448;
const GROUND_TILE_W = 96;

/** parallax factors relative to the ground */
const PARALLAX = { clouds: 0.04, far: 0.14, mid: 0.42, ground: 1 };

export interface Layers {
  sky: Phaser.GameObjects.Image;
  clouds: Phaser.GameObjects.TileSprite | null;
  far: Phaser.GameObjects.TileSprite;
  mid: Phaser.GameObjects.TileSprite;
  ground: Phaser.GameObjects.TileSprite;
  skyKey: string;
}

export function buildLayers(scene: Phaser.Scene, area: AreaDef, W: number, H: number, groundY: number): Layers {
  const gh = H - groundY;
  const farH = Math.round(H * 0.5);
  const midH = Math.round(H * 0.38);
  const skyKey = `bg-sky-${area.id}-${W}x${H}`;
  const cloudKey = `bg-clouds-${area.id}-${H}`;
  const farKey = `bg-far-${area.id}-${farH}`;
  const midKey = `bg-mid-${area.id}-${midH}`;
  const groundKey = `bg-ground-${area.id}-${gh}`;
  const style = STYLES[area.id] ?? STYLES.street;

  canvasTexture(scene, skyKey, W, H, (ctx) => drawSky(ctx, W, H, area, style));
  const cloudsH = Math.round(H * 0.42);
  if (style.clouds) canvasTexture(scene, cloudKey, CLOUD_TILE_W, cloudsH, (ctx) => drawClouds(ctx, CLOUD_TILE_W, cloudsH, area, style));
  canvasTexture(scene, farKey, FAR_TILE_W, farH, (ctx) => drawFar(ctx, FAR_TILE_W, farH, area, style));
  canvasTexture(scene, midKey, MID_TILE_W, midH, (ctx) => drawMid(ctx, MID_TILE_W, midH, area, style));
  canvasTexture(scene, groundKey, GROUND_TILE_W, gh, (ctx) => drawGround(ctx, GROUND_TILE_W, gh, area, style));

  return {
    sky: scene.add.image(0, 0, skyKey).setOrigin(0, 0).setDepth(0),
    clouds: style.clouds ? scene.add.tileSprite(0, 0, W, cloudsH, cloudKey).setOrigin(0, 0).setDepth(0.5) : null,
    far: scene.add.tileSprite(0, groundY + 2, W, farH, farKey).setOrigin(0, 1).setDepth(1),
    mid: scene.add.tileSprite(0, groundY + 2, W, midH, midKey).setOrigin(0, 1).setDepth(2),
    ground: scene.add.tileSprite(0, groundY, W, gh, groundKey).setOrigin(0, 0).setDepth(3),
    skyKey,
  };
}

export function destroyLayers(l: Layers) {
  const scene = l.sky.scene;
  l.sky.destroy();
  l.clouds?.destroy();
  l.far.destroy();
  l.mid.destroy();
  l.ground.destroy();
  // the sky depends on the scene size → drop it, the tiles are reused per area
  if (scene?.textures.exists(l.skyKey)) scene.textures.remove(l.skyKey);
}

export function scrollLayers(l: Layers, scroll: number) {
  if (l.clouds) l.clouds.tilePositionX = Math.round(scroll * PARALLAX.clouds);
  l.far.tilePositionX = Math.round(scroll * PARALLAX.far);
  l.mid.tilePositionX = Math.round(scroll * PARALLAX.mid);
  l.ground.tilePositionX = Math.round(scroll * PARALLAX.ground);
}

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, Math.max(1, w), Math.max(1, h));
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  tex.refresh();
}

// ---------------------------------------------------------------------------
// area styles
// ---------------------------------------------------------------------------

type FarKind = 'town' | 'hills' | 'jagged' | 'flat' | 'dunes' | 'sea' | 'mountains' | 'volcano';
type MidKind = 'houses' | 'trees' | 'deadtrees' | 'willows' | 'cacti' | 'palms' | 'pines' | 'spires';
type GroundKind = 'cobble' | 'grass' | 'roots' | 'mud' | 'sand' | 'beach' | 'snow' | 'basalt';

interface Style {
  far: FarKind;
  mid: MidKind;
  ground: GroundKind;
  /** sun / moon (share of the scene; kept below the HUD at the top) */
  orb: { x: number; y: number; r: number; color: string; glow: string } | null;
  stars?: boolean;
  clouds?: string;
  /** haze over the horizon */
  haze?: string;
  /** falling flakes / ash drawn into the sky */
  flakes?: string;
}

const STYLES: Record<string, Style> = {
  street: {
    far: 'town',
    mid: 'houses',
    ground: 'cobble',
    orb: { x: 0.8, y: 0.31, r: 13, color: '#fff3c4', glow: '#d8ecf6' },
    clouds: '#f4f8fb',
  },
  forest: {
    far: 'hills',
    mid: 'trees',
    ground: 'grass',
    orb: { x: 0.84, y: 0.33, r: 12, color: '#fff6d0', glow: '#cfe8da' },
    clouds: '#eef7f1',
  },
  darkforest: {
    far: 'jagged',
    mid: 'deadtrees',
    ground: 'roots',
    orb: { x: 0.8, y: 0.3, r: 11, color: '#e8e6f4', glow: '#4a4a72' },
    stars: true,
    haze: '#2c3a3a',
  },
  swamp: {
    far: 'flat',
    mid: 'willows',
    ground: 'mud',
    orb: { x: 0.72, y: 0.35, r: 14, color: '#e8e8c0', glow: '#a8b48a' },
    haze: '#a8b490',
  },
  desert: {
    far: 'dunes',
    mid: 'cacti',
    ground: 'sand',
    orb: { x: 0.78, y: 0.31, r: 17, color: '#fff8dc', glow: '#fbe6bc' },
    haze: '#f8e0b0',
  },
  beach: {
    far: 'sea',
    mid: 'palms',
    ground: 'beach',
    orb: { x: 0.85, y: 0.3, r: 14, color: '#fffbe0', glow: '#d4eefa' },
    clouds: '#ffffff',
  },
  snow: {
    far: 'mountains',
    mid: 'pines',
    ground: 'snow',
    orb: { x: 0.82, y: 0.33, r: 12, color: '#ffffff', glow: '#eef4fa' },
    clouds: '#f6f9fc',
    flakes: '#ffffff',
  },
  volcano: {
    far: 'volcano',
    mid: 'spires',
    ground: 'basalt',
    orb: null,
    haze: '#c0401a',
    flakes: '#ff9a4a',
  },
};

// ---------------------------------------------------------------------------
// colour + drawing helpers
// ---------------------------------------------------------------------------

function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const seedOf = (text: string, salt: number) => [...text].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, salt);

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const hex = (r: number, g: number, b: number) =>
  `#${((Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).padStart(6, '0')}`;

export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return hex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** lighten (+) / darken (−) */
export function shade(c: string, amount: number): string {
  return amount >= 0 ? mix(c, '#ffffff', amount) : mix(c, '#000000', -amount);
}

/** rectangle that wraps around the tile edge (seamless tiles) */
function wrapRect(ctx: CanvasRenderingContext2D, w: number, x: number, y: number, rw: number, rh: number, c: string) {
  ctx.fillStyle = c;
  const xx = ((Math.round(x) % w) + w) % w;
  ctx.fillRect(xx, Math.round(y), rw, rh);
  if (xx + rw > w) ctx.fillRect(xx - w, Math.round(y), rw, rh);
}

/** filled circle from scanlines (no anti-aliasing) */
function disc(ctx: CanvasRenderingContext2D, w: number, cx: number, cy: number, r: number, c: string) {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    wrapRect(ctx, w, cx - half, cy + dy, half * 2 + 1, 1, c);
  }
}

/** pointed roof standing on (x, y) with the given width; steep > 1 makes a spire */
function gable(ctx: CanvasRenderingContext2D, w: number, x: number, y: number, width: number, c: string, steep = 0.6) {
  const rows = Math.max(2, Math.round((width / 2) * steep));
  for (let r = 0; r < rows; r++) {
    const rw = Math.max(1, Math.round(((r + 1) / rows) * width));
    wrapRect(ctx, w, x + Math.floor((width - rw) / 2), y - rows + r, rw, 1, c);
  }
}

/** periodic height profile (seamless over the tile width) */
function profile(w: number, rand: () => number, waves: [number, number][]): (x: number) => number {
  const phases = waves.map(() => rand() * Math.PI * 2);
  const tau = Math.PI * 2;
  return (x) => waves.reduce((v, [freq, amp], i) => v + amp * Math.sin((tau * freq * x) / w + phases[i]), 0);
}

/** silhouette from a height function: top line in `edge`, body in `fill` */
function silhouette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  top: (x: number) => number,
  fill: string,
  edge?: string,
) {
  for (let x = 0; x < w; x++) {
    const y = Math.max(0, Math.round(top(x)));
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, 1, h - y);
    if (edge) {
      ctx.fillStyle = edge;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// sky + clouds
// ---------------------------------------------------------------------------

function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, area: AreaDef, style: Style) {
  const [topC, bottomC] = area.palette;
  const bands = 14;
  for (let i = 0; i < bands; i++) {
    const y0 = Math.floor((i * h) / bands);
    const y1 = Math.floor(((i + 1) * h) / bands);
    ctx.fillStyle = mix(topC, bottomC, Math.pow(i / (bands - 1), 1.3));
    ctx.fillRect(0, y0, w, y1 - y0);
    // dithered seam between two bands (pixel look)
    if (i < bands - 1) {
      ctx.fillStyle = mix(topC, bottomC, Math.pow((i + 1) / (bands - 1), 1.3));
      for (let x = (i % 2) * 2; x < w; x += 4) ctx.fillRect(x, y1 - 1, 2, 1);
    }
  }
  const rand = prng(seedOf(area.id, 11));
  if (style.stars) {
    for (let i = 0; i < Math.round((w * h) / 900); i++) {
      ctx.fillStyle = rand() < 0.3 ? '#ffffff' : '#9a9ac8';
      ctx.fillRect(Math.floor(rand() * w), Math.floor(rand() * h * 0.55), 1, 1);
    }
  }
  if (style.orb) {
    const o = style.orb;
    const cx = Math.round(w * o.x);
    const cy = Math.round(h * o.y);
    disc(ctx, w * 4, cx, cy, o.r + 6, mix(o.glow, bottomC, 0.35));
    disc(ctx, w * 4, cx, cy, o.r + 3, o.glow);
    disc(ctx, w * 4, cx, cy, o.r, o.color);
    if (style.stars) {
      // moon craters
      disc(ctx, w * 4, cx - 3, cy - 2, 2, shade(o.color, -0.1));
      disc(ctx, w * 4, cx + 4, cy + 3, 1, shade(o.color, -0.1));
    }
  }
  if (area.id === 'volcano') {
    // red glow from below + smoke columns
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = mix(bottomC, '#ff6a2a', 0.08 * (6 - i));
      ctx.fillRect(0, Math.round(h * (0.62 + i * 0.06)), w, Math.ceil(h * 0.06));
    }
  }
  if (style.flakes) {
    for (let i = 0; i < Math.round((w * h) / 650); i++) {
      ctx.fillStyle = rand() < 0.5 ? style.flakes : mix(style.flakes, bottomC, 0.5);
      ctx.fillRect(Math.floor(rand() * w), Math.floor(rand() * h * 0.8), 1, 1);
    }
  }
  if (style.haze) {
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = style.haze;
      ctx.globalAlpha = 0.07 + i * 0.03;
      ctx.fillRect(0, Math.round(h * (0.48 + i * 0.07)), w, h);
    }
    ctx.globalAlpha = 1;
  }
}

function drawClouds(ctx: CanvasRenderingContext2D, w: number, h: number, area: AreaDef, style: Style) {
  const rand = prng(seedOf(area.id, 23));
  const color = style.clouds!;
  const shadow = mix(color, area.palette[1], 0.45);
  const count = 5;
  for (let i = 0; i < count; i++) {
    const cx = Math.round((i + 0.2 + rand() * 0.6) * (w / count));
    const cy = Math.round(h * (0.2 + rand() * 0.6));
    const len = 24 + Math.round(rand() * 34);
    const puffs = 3 + Math.floor(rand() * 3);
    // flat bottom, puffy top
    wrapRect(ctx, w, cx - len / 2, cy, len, 4, shadow);
    for (let p = 0; p < puffs; p++) {
      const px = cx - len / 2 + 6 + (p * (len - 12)) / Math.max(1, puffs - 1);
      const r = 4 + Math.round(rand() * 5);
      disc(ctx, w, Math.round(px), cy - 1, r, color);
    }
    wrapRect(ctx, w, cx - len / 2 + 2, cy + 1, len - 4, 3, color);
    wrapRect(ctx, w, cx - len / 2 + 3, cy + 4, len - 6, 1, shadow);
  }
}

// ---------------------------------------------------------------------------
// far layer
// ---------------------------------------------------------------------------

function drawFar(ctx: CanvasRenderingContext2D, w: number, h: number, area: AreaDef, style: Style) {
  const rand = prng(seedOf(area.id, 37));
  const base = area.palette[2];
  const back = mix(base, area.palette[1], 0.45);
  const edge = shade(base, 0.12);
  switch (style.far) {
    case 'town': {
      const hills = profile(w, rand, [[1, 8], [3, 4]]);
      const hillTop = (x: number) => h * 0.5 + hills(x);
      silhouette(ctx, w, h, hillTop, back);
      // castle on the far hill: keep with battlements, two towers with pointed roofs
      const cx = Math.round(w * 0.3);
      const cy = Math.round(hillTop(cx)) + 2;
      const castle = mix(back, base, 0.45);
      wrapRect(ctx, w, cx - 16, cy - 30, 32, 32, castle);
      for (let k = -16; k < 16; k += 4) wrapRect(ctx, w, cx + k, cy - 33, 2, 3, castle);
      for (const tx of [cx - 25, cx + 17]) {
        wrapRect(ctx, w, tx, cy - 40, 9, 42, castle);
        gable(ctx, w, tx - 1, cy - 40, 11, shade(castle, -0.12));
        wrapRect(ctx, w, tx + 3, cy - 32, 2, 3, '#e8d07a');
      }
      wrapRect(ctx, w, cx - 3, cy - 10, 6, 12, shade(castle, -0.2));
      // the town below: gabled houses and a church spire, few lit windows
      let x = 0;
      let church = Math.floor(rand() * 4) + 3;
      while (x < w) {
        const bw = 12 + Math.floor(rand() * 12);
        const bh = Math.round(h * (0.07 + rand() * 0.06));
        const y = Math.round(h * 0.68 - bh);
        const wall = rand() < 0.5 ? base : shade(base, 0.05);
        if (--church === 0) {
          const tx = x + 2;
          wrapRect(ctx, w, tx, y - 26, 7, h - y + 26, wall);
          gable(ctx, w, tx - 1, y - 26, 9, shade(base, -0.14), 2.2);
          wrapRect(ctx, w, tx + 2, y - 20, 3, 3, '#e8d07a');
          church = 9 + Math.floor(rand() * 4);
        }
        wrapRect(ctx, w, x, y, bw, h - y, wall);
        gable(ctx, w, x - 1, y, bw + 2, shade(base, -0.12));
        if (rand() < 0.5) wrapRect(ctx, w, x + 3 + Math.floor(rand() * (bw - 6)), y + 3, 2, 2, '#e8d07a');
        x += bw + Math.floor(rand() * 5) - 1;
      }
      const front = profile(w, rand, [[2, 4], [5, 2]]);
      silhouette(ctx, w, h, (xx) => h * 0.74 + front(xx), shade(base, -0.06), edge);
      break;
    }
    case 'hills':
    case 'flat': {
      const amp = style.far === 'flat' ? 0.4 : 1;
      const p1 = profile(w, rand, [[1, 14 * amp], [2, 8 * amp], [5, 3 * amp]]);
      silhouette(ctx, w, h, (x) => h * 0.38 + p1(x), back, shade(back, 0.08));
      const p2 = profile(w, rand, [[2, 10 * amp], [3, 6 * amp], [9, 2]]);
      silhouette(ctx, w, h, (x) => h * 0.56 + p2(x), base, edge);
      if (style.far === 'hills') {
        // tree tops along the front hills
        for (let x = 0; x < w; x += 3) {
          const y = Math.round(h * 0.56 + p2(x));
          wrapRect(ctx, w, x, y - 2 - Math.floor(rand() * 3), 3, 4, shade(base, -0.05));
        }
      } else {
        // mist bands over the swamp
        ctx.globalAlpha = 0.25;
        for (let i = 0; i < 3; i++) wrapRect(ctx, w, 0, h * (0.6 + i * 0.1), w, 3, '#d8e0c8');
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'jagged': {
      const p1 = profile(w, rand, [[2, 16], [5, 7], [11, 4]]);
      silhouette(ctx, w, h, (x) => h * 0.36 + p1(x) + (x % 7 < 3 ? -2 : 0), back);
      const p2 = profile(w, rand, [[3, 10], [7, 5]]);
      silhouette(ctx, w, h, (x) => h * 0.55 + p2(x), base, shade(base, 0.1));
      // spiky conifer silhouettes
      for (let i = 0; i < 28; i++) {
        const tx = Math.floor(rand() * w);
        const th = 10 + Math.floor(rand() * 16);
        const by = Math.round(h * 0.6 + p2(tx));
        for (let r = 0; r < th; r++) wrapRect(ctx, w, tx - Math.floor((r * 3) / th), by - th + r, 1 + 2 * Math.floor((r * 3) / th), 1, shade(base, -0.15));
      }
      break;
    }
    case 'dunes': {
      const p1 = profile(w, rand, [[1, 10], [2, 6]]);
      silhouette(ctx, w, h, (x) => h * 0.5 + p1(x), back, shade(back, 0.1));
      // pyramids
      for (const [px, size] of [
        [0.22, 30],
        [0.36, 20],
        [0.7, 24],
      ] as const) {
        const cx = Math.round(w * px);
        const by = Math.round(h * 0.62);
        for (let r = 0; r < size; r++) {
          wrapRect(ctx, w, cx - r, by - size + r, r, 1, shade(base, 0.04));
          wrapRect(ctx, w, cx, by - size + r, r + 1, 1, shade(base, -0.1));
        }
      }
      const p2 = profile(w, rand, [[2, 7], [3, 4]]);
      silhouette(ctx, w, h, (x) => h * 0.64 + p2(x), base, edge);
      break;
    }
    case 'sea': {
      // islands on the horizon, then the sea
      const horizon = Math.round(h * 0.55);
      for (const [ix, iw] of [
        [0.15, 46],
        [0.62, 70],
      ] as const) {
        const cx = Math.round(w * ix);
        for (let x = -iw / 2; x < iw / 2; x++) {
          const t = 1 - Math.abs(x) / (iw / 2);
          const ih = Math.round(Math.sqrt(t) * 12);
          wrapRect(ctx, w, cx + x, horizon - ih, 1, ih, back);
        }
      }
      for (let y = horizon; y < h; y++) {
        const t = (y - horizon) / (h - horizon);
        ctx.fillStyle = mix(shade(base, 0.12), shade(base, -0.12), t);
        ctx.fillRect(0, y, w, 1);
      }
      // glitter
      for (let i = 0; i < 70; i++) {
        const y = horizon + 2 + Math.floor(rand() * (h - horizon - 4));
        wrapRect(ctx, w, Math.floor(rand() * w), y, 2 + Math.floor(rand() * 5), 1, shade(base, 0.35));
      }
      break;
    }
    case 'mountains': {
      const p1 = profile(w, rand, [[1, 20], [3, 10], [7, 3]]);
      const top = (x: number) => h * 0.3 + p1(x) + Math.abs(((x % 64) - 32) / 32) * 18;
      silhouette(ctx, w, h, top, back);
      // snow caps
      for (let x = 0; x < w; x++) {
        const y = Math.round(top(x));
        const cap = 4 + Math.round(3 * Math.sin(x * 0.7));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, 1, cap);
      }
      const p2 = profile(w, rand, [[2, 8], [5, 4]]);
      silhouette(ctx, w, h, (x) => h * 0.6 + p2(x), base, '#ffffff');
      break;
    }
    case 'volcano': {
      const p1 = profile(w, rand, [[2, 8], [5, 4]]);
      silhouette(ctx, w, h, (x) => h * 0.58 + p1(x), back);
      // the volcano cone with a glowing crater and lava streams
      const cx = Math.round(w * 0.55);
      const peak = Math.round(h * 0.18);
      const foot = Math.round(h * 0.75);
      for (let y = peak; y < h; y++) {
        const half = 9 + Math.round(((y - peak) / (foot - peak)) * 90);
        wrapRect(ctx, w, cx - half, y, half * 2, 1, base);
      }
      wrapRect(ctx, w, cx - 8, peak - 2, 16, 3, '#ffb040');
      wrapRect(ctx, w, cx - 6, peak - 4, 12, 2, '#ff6a2a');
      for (const dir of [-1, 1]) {
        let x = cx + dir * 3;
        for (let y = peak + 1; y < foot; y++) {
          if ((y - peak) % 3 === 0) x += dir * (rand() < 0.6 ? 1 : 2);
          wrapRect(ctx, w, x, y, 2, 1, y % 5 === 0 ? '#ffb040' : '#e0501a');
        }
      }
      const p2 = profile(w, rand, [[3, 6], [7, 3]]);
      silhouette(ctx, w, h, (x) => h * 0.7 + p2(x), shade(base, -0.1), '#8a2a1a');
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// mid layer: props
// ---------------------------------------------------------------------------

function drawMid(ctx: CanvasRenderingContext2D, w: number, h: number, area: AreaDef, style: Style) {
  const rand = prng(seedOf(area.id, 53));
  const base = area.palette[3];
  const dark = shade(base, -0.18);
  const light = shade(base, 0.14);
  const r = (x: number, y: number, rw: number, rh: number, c: string) => wrapRect(ctx, w, x, y, rw, rh, c);
  const groundLine = h - 5;
  // low band the props stand on
  const band = profile(w, rand, [[1, 2], [3, 1.5]]);
  silhouette(ctx, w, h, (x) => groundLine - 3 + band(x), base, light);

  const count = { houses: 4, trees: 7, deadtrees: 6, willows: 5, cacti: 5, palms: 5, pines: 9, spires: 5 }[style.mid];
  for (let i = 0; i < count; i++) {
    const x = Math.floor((i * w) / count + rand() * (w / count) * 0.6);
    const s = 0.75 + rand() * 0.5;
    const by = groundLine + Math.round(band(x));
    switch (style.mid) {
      case 'houses': {
        const hw = Math.round(40 * s);
        const hh = Math.round(30 * s);
        const wall = mix(base, '#d8c8a8', 0.45);
        const beam = shade(wall, -0.35);
        const roofC = mix('#9a4a32', dark, 0.25);
        // chimney behind the roof
        r(x + hw - 11, by - hh - Math.round(hw * 0.3), 5, Math.round(hw * 0.3), shade(wall, -0.3));
        r(x, by - hh, hw, hh + 3, wall);
        r(x, by - hh, 2, hh, shade(wall, -0.15));
        // timber frame
        r(x, by - hh, hw, 1, beam);
        r(x, by - hh + Math.floor(hh / 2), hw, 1, beam);
        for (let k = 0; k < hw; k += Math.round(hw / 4)) r(x + k, by - hh, 1, hh, beam);
        r(x + hw - 1, by - hh, 1, hh, beam);
        gable(ctx, w, x - 3, by - hh, hw + 6, roofC);
        // windows + door
        r(x + 5, by - hh + 4, 6, 7, '#3a3040');
        r(x + 6, by - hh + 5, 4, 5, '#f2d27a');
        r(x + 8, by - hh + 5, 1, 5, '#3a3040');
        if (hw > 30) {
          r(x + hw - 11, by - hh + 4, 6, 7, '#3a3040');
          r(x + hw - 10, by - hh + 5, 4, 5, '#f2d27a');
          r(x + hw - 8, by - hh + 5, 1, 5, '#3a3040');
        }
        r(x + Math.floor(hw / 2) - 3, by - 11, 7, 11, '#4a3020');
        r(x + Math.floor(hw / 2) - 3, by - 11, 7, 1, beam);
        break;
      }
      case 'trees': {
        const th = Math.round(54 * s);
        const crown = Math.round(17 * s);
        r(x - 2, by - th + crown, 5, th - crown + 2, '#4a3220');
        r(x - 2, by - th + crown, 2, th - crown + 2, '#3a2416');
        const cy = by - th + crown;
        disc(ctx, w, x, cy, crown, dark);
        disc(ctx, w, x - Math.round(crown * 0.5), cy + 4, Math.round(crown * 0.7), dark);
        disc(ctx, w, x + Math.round(crown * 0.55), cy + 3, Math.round(crown * 0.7), dark);
        disc(ctx, w, x - 2, cy - 2, Math.round(crown * 0.75), base);
        disc(ctx, w, x - 4, cy - 5, Math.round(crown * 0.35), light);
        break;
      }
      case 'deadtrees': {
        const th = Math.round(60 * s);
        const trunk = shade(dark, -0.1);
        r(x - 2, by - th, 4, th + 2, trunk);
        const branch = (bx: number, byy: number, dir: number, len: number) => {
          for (let k = 0; k < len; k++) r(bx + dir * k, byy - Math.floor(k / 2), 2, 2, trunk);
        };
        branch(x, by - th + 10, -1, 14);
        branch(x + 2, by - th + 18, 1, 16);
        branch(x, by - th + 28, -1, 10);
        branch(x + 1, by - th + 4, 1, 8);
        break;
      }
      case 'willows': {
        const th = Math.round(44 * s);
        r(x - 2, by - th, 4, th + 2, '#3a3020');
        const crown = Math.round(16 * s);
        disc(ctx, w, x, by - th, crown, dark);
        // hanging strands
        for (let k = -crown; k <= crown; k += 2) {
          const len = Math.round(crown * 0.8 + rand() * crown);
          r(x + k, by - th, 1, len, k % 4 === 0 ? base : dark);
        }
        // reeds in front
        for (let k = 0; k < 6; k++) {
          const rh = 8 + Math.floor(rand() * 10);
          r(x + 18 + k * 2, by - rh, 1, rh, k % 2 ? light : base);
          r(x + 18 + k * 2, by - rh - 3, 1, 3, '#5a3a20');
        }
        break;
      }
      case 'cacti': {
        const ch = Math.round(34 * s);
        const c = mix('#4a8a3a', base, 0.25);
        r(x - 3, by - ch, 7, ch + 2, c);
        r(x - 3, by - ch, 2, ch, shade(c, 0.15));
        r(x - 11, by - ch + 12, 8, 4, c);
        r(x - 11, by - ch + 3, 4, 12, c);
        r(x + 4, by - ch + 16, 7, 4, c);
        r(x + 7, by - ch + 7, 4, 12, c);
        // rocks
        r(x + 14, by - 4, 10, 5, dark);
        r(x + 15, by - 5, 6, 1, light);
        break;
      }
      case 'palms': {
        const ph = Math.round(58 * s);
        let tx = x;
        for (let k = 0; k < ph; k++) {
          if (k % 8 === 7) tx += 1;
          r(tx, by - k, 4, 1, k % 4 === 0 ? '#6a4a2a' : '#8a6a3a');
        }
        const top = by - ph;
        const leaf = mix('#3a8a3a', base, 0.2);
        for (const [dx, dy, len] of [
          [-1, 0, 16],
          [1, 0, 16],
          [-1, -1, 10],
          [1, -1, 10],
        ] as const) {
          for (let k = 0; k < len; k++) r(tx + 2 + dx * k, top + dy * Math.floor(k / 3) + Math.floor((k * k) / 40), 3, 2, leaf);
        }
        r(tx, top + 1, 4, 3, '#5a3a1a');
        break;
      }
      case 'pines': {
        const th = Math.round(48 * s);
        r(x - 1, by - 6, 3, 8, '#4a3428');
        const c = mix('#2a5a4a', base, 0.3);
        for (let k = 0; k < th; k++) {
          const half = Math.floor(((k % Math.round(th / 3)) + k / 3) * 0.45) + 1;
          r(x - half, by - 6 - th + k, half * 2 + 1, 1, c);
          if (k % Math.round(th / 3) < 2) r(x - half, by - 6 - th + k, half * 2 + 1, 1, '#ffffff');
        }
        break;
      }
      case 'spires': {
        const sh = Math.round(46 * s);
        const sw = Math.round(14 * s);
        for (let k = 0; k < sh; k++) {
          const half = Math.max(1, Math.round((sw / 2) * (0.35 + 0.65 * (k / sh))));
          r(x - half, by - sh + k, half * 2, 1, k % 9 === 0 ? light : dark);
        }
        // glowing cracks
        for (let k = 6; k < sh - 2; k += 2) r(x + (k % 4 === 0 ? -1 : 0), by - sh + k, 1, 2, k % 6 === 0 ? '#ffb040' : '#e0501a');
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// ground
// ---------------------------------------------------------------------------

function drawGround(ctx: CanvasRenderingContext2D, w: number, h: number, area: AreaDef, style: Style) {
  const rand = prng(seedOf(area.id, 71));
  const top = area.palette[4];
  const soil = area.palette[5];
  const r = (x: number, y: number, rw: number, rh: number, c: string) => wrapRect(ctx, w, x, y, rw, rh, c);
  // vertical gradient: lighter at the top edge, darker towards the viewer
  for (let y = 0; y < h; y++) {
    ctx.fillStyle = mix(top, soil, Math.min(1, y / (h * 0.9)));
    ctx.fillRect(0, y, w, 1);
  }
  const specks = (n: number, c1: string, c2: string, y0 = 3) => {
    for (let i = 0; i < n; i++) r(rand() * w, y0 + rand() * (h - y0), 1 + Math.floor(rand() * 2), 1, rand() < 0.5 ? c1 : c2);
  };

  switch (style.ground) {
    case 'cobble': {
      const rows = Math.max(3, Math.round(h / 9));
      for (let row = 0; row < rows; row++) {
        const y = 3 + Math.round((row * (h - 3)) / rows);
        const rh = Math.round((h - 3) / rows) - 1;
        const sw = 10 + row * 2;
        const off = (row % 2) * Math.round(sw / 2);
        for (let x = -off; x < w; x += sw) {
          const c = mix(top, soil, 0.15 + row / rows / 2 + (rand() - 0.5) * 0.15);
          r(x + 1, y, sw - 2, rh, c);
          r(x + 1, y, sw - 2, 1, shade(c, 0.12));
        }
      }
      r(0, 0, w, 3, shade(top, 0.1));
      break;
    }
    case 'grass':
    case 'roots': {
      const grass = style.ground === 'grass' ? mix('#5a9a3a', top, 0.4) : mix('#3a4a2a', top, 0.4);
      r(0, 0, w, 5, grass);
      for (let x = 0; x < w; x += 2) r(x, 5, 2, Math.floor(rand() * 4), grass);
      for (let i = 0; i < 18; i++) r(rand() * w, 0, 1, 2 + Math.floor(rand() * 3), shade(grass, 0.15));
      if (style.ground === 'grass') {
        for (let i = 0; i < 4; i++) {
          const fx = rand() * w;
          const fy = 2 + rand() * 4;
          r(fx, fy, 2, 2, rand() < 0.5 ? '#f4e05a' : '#f0f0f0');
        }
      } else {
        // roots crossing the path
        for (let i = 0; i < 3; i++) {
          let x = rand() * w;
          for (let y = 6; y < h; y += 2) {
            x += rand() < 0.5 ? -1 : 1;
            r(x, y, 3, 2, shade(soil, -0.2));
          }
        }
      }
      specks(30, shade(soil, -0.1), shade(soil, 0.08), 8);
      break;
    }
    case 'mud': {
      r(0, 0, w, 3, shade(top, 0.08));
      for (let i = 0; i < 3; i++) {
        const px = rand() * w;
        const py = 8 + rand() * (h - 14);
        const pw = 14 + Math.floor(rand() * 16);
        r(px, py, pw, 3, '#4a5a4a');
        r(px + 2, py, pw - 6, 1, '#7a8a7a');
      }
      specks(36, shade(soil, -0.12), shade(top, 0.05));
      break;
    }
    case 'sand':
    case 'beach': {
      // ripples
      for (let y = 6; y < h; y += 5) {
        for (let x = 0; x < w; x += 12) r(x + ((y / 5) % 2) * 6, y, 7, 1, shade(top, -0.08));
      }
      r(0, 0, w, 2, shade(top, 0.12));
      if (style.ground === 'beach') {
        for (let i = 0; i < 4; i++) {
          const sx = rand() * w;
          const sy = 6 + rand() * (h - 10);
          r(sx, sy, 3, 2, '#f8f0e0');
          r(sx + 1, sy - 1, 1, 1, '#e8a0a0');
        }
      }
      specks(24, shade(soil, -0.06), shade(top, 0.1));
      break;
    }
    case 'snow': {
      r(0, 0, w, 3, '#ffffff');
      for (let y = 7; y < h; y += 6) for (let x = 0; x < w; x += 16) r(x + (y % 12), y, 9, 1, shade(soil, -0.04));
      specks(18, '#ffffff', shade(soil, -0.08));
      break;
    }
    case 'basalt': {
      const rows = Math.max(3, Math.round(h / 10));
      for (let row = 0; row < rows; row++) {
        const y = Math.round((row * h) / rows);
        r(0, y, w, 1, shade(soil, -0.25));
        const off = (row % 2) * 8;
        for (let x = off; x < w; x += 16) r(x, y, 1, Math.round(h / rows), shade(soil, -0.25));
      }
      // lava cracks
      for (let i = 0; i < 3; i++) {
        let x = rand() * w;
        for (let y = 4; y < h; y += 1) {
          if (rand() < 0.3) x += rand() < 0.5 ? -1 : 1;
          r(x, y, 1, 1, y % 3 === 0 ? '#ffb040' : '#e0501a');
        }
      }
      r(0, 0, w, 2, shade(top, 0.08));
      break;
    }
  }
}
