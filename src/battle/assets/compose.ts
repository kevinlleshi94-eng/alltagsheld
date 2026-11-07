/**
 * Builds the battle sprites at runtime:
 *  - LPC characters: every layer recoloured (exact ramp mapping, like the LPC generator)
 *    and drawn in z-order into uniform frames
 *  - monsters: frames cut from their sheet (+ overlays, mirroring, chroma key, gradient recolour)
 * Each sprite ends up in ONE canvas with uniform frames, cropped to the visible art,
 * plus metadata (animations, feet point) for the scene.
 *
 * The pixel helpers are pure (unit-tested); loading/compositing needs a browser.
 */
import {
  LPC_PARTS,
  LPC_ROOT,
  MONSTER_ROOT,
  MONSTERS,
  type CharacterLook,
  type FrameStrip,
  type LpcAnim,
  type LpcPart,
  type MonsterId,
  type MonsterSheet,
} from './catalog';
import { BASE_RAMP, ramp } from './palettes';

export type AnimName = 'idle' | 'walk' | 'attack' | 'retreat';

export interface AnimRange {
  /** first frame index */
  start: number;
  count: number;
  fps: number;
  /** horizontal offset per frame (game px, towards the hero = negative) */
  nudge?: number[];
}

export interface ComposedSprite {
  canvas: HTMLCanvasElement;
  frameW: number;
  frameH: number;
  /** frames per row in the canvas */
  cols: number;
  count: number;
  anims: Record<AnimName, AnimRange>;
  /** feet point inside a frame (px) */
  originX: number;
  originY: number;
  /** visible size of the first idle frame above the feet (native px) */
  height: number;
  width: number;
  /** display scale of the native art */
  scale: number;
  /** flying: px above the ground (native) */
  lift: number;
  ownShadow: boolean;
}

/** canvas width limit (WebGL textures on older iPhones) */
const MAX_TEXTURE_W = 4096;
/** LPC: frames per row of walk and slash sheets, feet line below the frame centre */
export const LPC_FRAMES: Record<LpcAnim, number> = { walk: 9, slash: 6 };
const LPC_FEET_BELOW_CENTER = 30;
const LPC_ROW_LEFT = 1;
const LPC_ROW_RIGHT = 3;

// ---------------------------------------------------------------------------
// pure pixel helpers
// ---------------------------------------------------------------------------

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgbKey = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;

/** exact colour mapping from one 6-colour ramp to another */
export function rampMap(from: readonly string[], to: readonly string[]): Map<number, Rgb> {
  const map = new Map<number, Rgb>();
  from.forEach((hex, i) => {
    const target = to[Math.min(i, to.length - 1)];
    const [r, g, b] = hexToRgb(hex);
    if (!map.has(rgbKey(r, g, b))) map.set(rgbKey(r, g, b), hexToRgb(target));
  });
  return map;
}

export function applyColorMap(data: Uint8ClampedArray, map: Map<number, Rgb>): void {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const to = map.get(rgbKey(data[i], data[i + 1], data[i + 2]));
    if (to) {
      data[i] = to[0];
      data[i + 1] = to[1];
      data[i + 2] = to[2];
    }
  }
}

/** magenta background → transparent */
export function chromaKey(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 230 && data[i + 1] < 40 && data[i + 2] > 230) data[i + 3] = 0;
  }
}

const luminance = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
/** dark outlines stay as they are */
const OUTLINE_LUMA = 34;
const GRADIENT_STEPS = 7;

export interface GradientRange {
  lo: number;
  hi: number;
}

/** brightness range of a sprite (ignores outline and the extreme 4 %) */
export function gradientRange(data: Uint8ClampedArray): GradientRange {
  const values: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const l = luminance(data[i], data[i + 1], data[i + 2]);
    if (l >= OUTLINE_LUMA) values.push(l);
  }
  if (values.length === 0) return { lo: 0, hi: 255 };
  values.sort((a, b) => a - b);
  const lo = values[Math.floor(values.length * 0.04)];
  const hi = values[Math.min(values.length - 1, Math.floor(values.length * 0.96))];
  return { lo, hi: Math.max(hi, lo + 1) };
}

const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/** gradient stops dark → light from an enemy's [base, dark, light] colours */
export function gradientStops(colors: readonly [string, string, string]): Rgb[] {
  const [base, dark, light] = colors.map(hexToRgb) as [Rgb, Rgb, Rgb];
  return [mixRgb(dark, [12, 8, 14], 0.45), dark, base, light];
}

/** recolour by brightness: keeps shading and outlines, replaces the hue */
export function gradientMap(data: Uint8ClampedArray, stops: Rgb[], range: GradientRange): void {
  const last = stops.length - 1;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const l = luminance(data[i], data[i + 1], data[i + 2]);
    if (l < OUTLINE_LUMA) continue;
    let t = Math.min(1, Math.max(0, (l - range.lo) / (range.hi - range.lo)));
    t = Math.round(t * (GRADIENT_STEPS - 1)) / (GRADIENT_STEPS - 1);
    const pos = t * last;
    const k = Math.min(last - 1, Math.floor(pos));
    const c = mixRgb(stops[k], stops[k + 1], pos - k);
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
  }
}

export interface Box {
  x0: number;
  y0: number;
  /** inclusive */
  x1: number;
  y1: number;
}

/** bounding box of the non-transparent pixels, null if empty */
export function opaqueBounds(data: Uint8ClampedArray, w: number, h: number): Box | null {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

export function unionBox(boxes: (Box | null)[]): Box | null {
  let out: Box | null = null;
  for (const b of boxes) {
    if (!b) continue;
    out = out
      ? { x0: Math.min(out.x0, b.x0), y0: Math.min(out.y0, b.y0), x1: Math.max(out.x1, b.x1), y1: Math.max(out.y1, b.y1) }
      : { ...b };
  }
  return out;
}

/** source rectangles (top-left) of every frame of a strip */
export function stripFrames(s: FrameStrip): { sx: number; sy: number }[] {
  const per = s.perRow ?? s.frames;
  const step = s.step ?? s.w;
  return Array.from({ length: s.frames }, (_, i) => ({
    sx: (s.x ?? 0) + (i % per) * step,
    sy: s.y + Math.floor(i / per) * s.h,
  }));
}

/** grid for packing n frames of width fw into a texture */
export function packGrid(n: number, fw: number): { cols: number; rows: number } {
  const cols = Math.max(1, Math.min(n, Math.floor(MAX_TEXTURE_W / Math.max(1, fw))));
  return { cols, rows: Math.ceil(n / cols) };
}

// ---------------------------------------------------------------------------
// browser: loading
// ---------------------------------------------------------------------------

const BASE_URL: string = import.meta.env?.BASE_URL ?? '/';
const images = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  let p = images.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Bild fehlt: ${url}`));
      img.src = url;
    });
    // a failed load may be retried later (e.g. offline before the SW cached it)
    p.catch(() => images.delete(url));
    images.set(url, p);
  }
  return p;
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D nicht verfügbar');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** image → canvas copy, pixels changed by `edit` */
function editedCopy(img: CanvasImageSource & { width: number; height: number }, edit: (d: Uint8ClampedArray) => void) {
  const c = canvas(img.width, img.height);
  const ctx = ctx2d(c);
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, c.width, c.height);
  edit(id.data);
  ctx.putImageData(id, 0, 0);
  return c;
}

const recoloured = new Map<string, Promise<CanvasImageSource>>();

/** fixed colour table → map for applyColorMap */
export function remapTable(table: Record<string, string>): Map<number, Rgb> {
  const map = new Map<number, Rgb>();
  for (const [from, to] of Object.entries(table)) {
    const [r, g, b] = hexToRgb(from);
    map.set(rgbKey(r, g, b), hexToRgb(to));
  }
  return map;
}

/** LPC layer sheet in the wanted colour (cached) */
function lpcSource(file: string, part: LpcPart, color?: string): Promise<CanvasImageSource> {
  const url = BASE_URL + LPC_ROOT + file;
  const { material, base, remap } = part;
  if (remap) {
    const key = `${file}|remap:${JSON.stringify(remap)}`;
    let p = recoloured.get(key);
    if (!p) {
      const map = remapTable(remap);
      p = loadImage(url).then((img) => editedCopy(img, (d) => applyColorMap(d, map)));
      p.catch(() => recoloured.delete(key));
      recoloured.set(key, p);
    }
    return p;
  }
  if (!material || !color) return loadImage(url);
  const fromName = base ?? BASE_RAMP[material];
  const from = ramp(material, fromName);
  const to = ramp(material, color);
  if (!from || !to || fromName === color) return loadImage(url);
  const key = `${file}|${color}`;
  let p = recoloured.get(key);
  if (!p) {
    const map = rampMap(from, to);
    p = loadImage(url).then((img) => editedCopy(img, (d) => applyColorMap(d, map)));
    p.catch(() => recoloured.delete(key));
    recoloured.set(key, p);
  }
  return p;
}

function monsterSource(file: string, chroma: boolean): Promise<CanvasImageSource> {
  const url = BASE_URL + MONSTER_ROOT + file;
  if (!chroma) return loadImage(url);
  const key = `${file}|chroma`;
  let p = recoloured.get(key);
  if (!p) {
    p = loadImage(url).then((img) => editedCopy(img, chromaKey));
    p.catch(() => recoloured.delete(key));
    recoloured.set(key, p);
  }
  return p;
}

// ---------------------------------------------------------------------------
// browser: packing frames into one sprite canvas
// ---------------------------------------------------------------------------

interface RawFrames {
  frames: HTMLCanvasElement[];
  w: number;
  h: number;
}

function frameData(f: HTMLCanvasElement) {
  return ctx2d(f).getImageData(0, 0, f.width, f.height);
}

/** crop all frames to their common visible box and pack them into a grid */
function pack(raw: RawFrames, crop: Box) {
  const fw = crop.x1 - crop.x0 + 1;
  const fh = crop.y1 - crop.y0 + 1;
  const { cols, rows } = packGrid(raw.frames.length, fw);
  const out = canvas(cols * fw, rows * fh);
  const ctx = ctx2d(out);
  raw.frames.forEach((f, i) => {
    ctx.drawImage(f, crop.x0, crop.y0, fw, fh, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh);
  });
  return { canvas: out, frameW: fw, frameH: fh, cols, count: raw.frames.length };
}

const pad = (b: Box, w: number, h: number): Box => ({
  x0: Math.max(0, b.x0 - 1),
  y0: Math.max(0, b.y0 - 1),
  x1: Math.min(w - 1, b.x1 + 1),
  y1: Math.min(h - 1, b.y1 + 1),
});

// ---------------------------------------------------------------------------
// LPC characters
// ---------------------------------------------------------------------------

interface LpcSection {
  anim: LpcAnim;
  row: number;
}

/**
 * Hero: faces right (walk, slash) + walking left for the retreat.
 * Enemies: face left (walk, slash).
 */
export async function composeCharacter(look: CharacterLook, facing: 'right' | 'left'): Promise<ComposedSprite> {
  const row = facing === 'right' ? LPC_ROW_RIGHT : LPC_ROW_LEFT;
  const sections: LpcSection[] = [
    { anim: 'walk', row },
    { anim: 'slash', row },
  ];
  if (facing === 'right') sections.push({ anim: 'walk', row: LPC_ROW_LEFT });

  const layers = look.flatMap((use, order) => {
    const part = LPC_PARTS[use.part];
    return part.layers.map((layer) => ({ layer, order, src: lpcSource(layer.file, part, use.color) }));
  });
  const sources = await Promise.all(layers.map((l) => l.src));
  const F = Math.max(...layers.map((l) => l.layer.frame));

  const frames: HTMLCanvasElement[] = [];
  for (const s of sections) {
    // stable sort: same z keeps the order of the look
    const drawn = layers
      .map((l, i) => ({ ...l, img: sources[i] }))
      .filter((l) => l.layer.anim === s.anim)
      .sort((a, b) => a.layer.z - b.layer.z || a.order - b.order);
    for (let i = 0; i < LPC_FRAMES[s.anim]; i++) {
      const c = canvas(F, F);
      const ctx = ctx2d(c);
      for (const l of drawn) {
        const fs = l.layer.frame;
        const off = (F - fs) / 2;
        ctx.drawImage(l.img, i * fs, s.row * fs, fs, fs, off, off, fs, fs);
      }
      frames.push(c);
    }
  }

  const boxes = frames.map((f) => opaqueBounds(frameData(f).data, F, F));
  const union = unionBox(boxes);
  if (!union) throw new Error('leeres Sprite');
  const crop = pad(union, F, F);
  const packed = pack({ frames, w: F, h: F }, crop);
  const feetX = F / 2;
  const feetY = F / 2 + LPC_FEET_BELOW_CENTER;
  const idle = boxes[0] ?? union;

  const walkN = LPC_FRAMES.walk;
  const slashN = LPC_FRAMES.slash;
  return {
    ...packed,
    anims: {
      idle: { start: 0, count: 1, fps: 1 },
      walk: { start: 1, count: walkN - 1, fps: 11 },
      attack: { start: walkN, count: slashN, fps: 16 },
      retreat:
        facing === 'right'
          ? { start: walkN + slashN + 1, count: walkN - 1, fps: 11 }
          : { start: 1, count: walkN - 1, fps: 11 },
    },
    originX: feetX - crop.x0,
    originY: feetY - crop.y0,
    height: feetY - idle.y0,
    width: idle.x1 - idle.x0 + 1,
    scale: 1,
    lift: 0,
    ownShadow: false,
  };
}

// ---------------------------------------------------------------------------
// monsters
// ---------------------------------------------------------------------------

export async function composeMonster(id: MonsterId, colors?: readonly [string, string, string]): Promise<ComposedSprite> {
  const sheet: MonsterSheet = MONSTERS[id];
  const strips = [sheet.walk, sheet.attack];
  const chroma = !!sheet.chromaKey;
  const W = Math.max(...strips.map((s) => s.w));
  const H = Math.max(...strips.map((s) => s.h));

  const frames: HTMLCanvasElement[] = [];
  for (const strip of strips) {
    const files = [strip.file, ...(strip.overlays ?? [])];
    const imgs = await Promise.all(files.map((f) => monsterSource(f, chroma)));
    const dx = Math.floor((W - strip.w) / 2);
    const dy = H - strip.h;
    for (const { sx, sy } of stripFrames(strip)) {
      const c = canvas(W, H);
      const ctx = ctx2d(c);
      ctx.save();
      if (sheet.flip) {
        ctx.translate(dx + strip.w, dy);
        ctx.scale(-1, 1);
      } else ctx.translate(dx, dy);
      for (const img of imgs) ctx.drawImage(img, sx, sy, strip.w, strip.h, 0, 0, strip.w, strip.h);
      ctx.restore();
      frames.push(c);
    }
  }

  const data = frames.map(frameData);
  if (colors) {
    const range = gradientRange(data[0].data);
    const stops = gradientStops(colors);
    data.forEach((d, i) => {
      gradientMap(d.data, stops, range);
      ctx2d(frames[i]).putImageData(d, 0, 0);
    });
  }

  const boxes = data.map((d) => opaqueBounds(d.data, W, H));
  const union = unionBox(boxes);
  if (!union) throw new Error('leeres Sprite');
  const walkN = sheet.walk.frames;
  const walkBoxes = boxes.slice(0, walkN);
  const first = boxes[0] ?? union;
  // feet: lowest visible pixel of the walk cycle; centre: first frame
  const feetY = Math.max(...walkBoxes.map((b) => (b ? b.y1 + 1 : 0)));
  const feetX = (first.x0 + first.x1 + 1) / 2;
  const crop = pad(union, W, H);
  const packed = pack({ frames, w: W, h: H }, crop);

  const walk: AnimRange = { start: 0, count: walkN, fps: sheet.walk.fps };
  const attack: AnimRange = { start: walkN, count: sheet.attack.frames, fps: sheet.attack.fps, nudge: sheet.attack.nudge };
  return {
    ...packed,
    anims: {
      idle: sheet.idleLoop ? { ...walk, fps: Math.max(3, Math.round(walk.fps * 0.6)) } : { start: 0, count: 1, fps: 1 },
      walk,
      attack,
      retreat: walk,
    },
    originX: feetX - crop.x0,
    originY: feetY - crop.y0,
    height: feetY - first.y0,
    width: first.x1 - first.x0 + 1,
    scale: sheet.scale ?? 1,
    lift: sheet.lift ?? 0,
    ownShadow: !!sheet.ownShadow,
  };
}
