import { describe, expect, it } from 'vitest';
import {
  applyColorMap,
  chromaKey,
  gradientMap,
  gradientRange,
  gradientStops,
  hexToRgb,
  opaqueBounds,
  packGrid,
  rampMap,
  stripFrames,
  unionBox,
} from './compose';
import { RAMPS } from './palettes';

const px = (...rgba: number[][]) => new Uint8ClampedArray(rgba.flat());

describe('ramp recolouring', () => {
  it('maps the base ramp exactly onto the target ramp', () => {
    const steel = RAMPS.metal.steel;
    const gold = RAMPS.metal.gold;
    const data = px([...hexToRgb(steel[2]), 255], [...hexToRgb(steel[5]), 255], [1, 2, 3, 255]);
    applyColorMap(data, rampMap(steel, gold));
    expect([...data.slice(0, 3)]).toEqual(hexToRgb(gold[2]));
    expect([...data.slice(4, 7)]).toEqual(hexToRgb(gold[5]));
    // colours outside the ramp stay
    expect([...data.slice(8, 11)]).toEqual([1, 2, 3]);
  });

  it('first occurrence wins when a ramp repeats a colour', () => {
    const map = rampMap(['#000000', '#000000', '#ffffff'], ['#111111', '#222222', '#333333']);
    expect(map.size).toBe(2);
    expect(map.get(0)).toEqual(hexToRgb('#111111'));
  });
});

describe('chroma key', () => {
  it('makes magenta transparent, keeps the rest', () => {
    const data = px([255, 0, 255, 255], [250, 10, 245, 255], [200, 0, 200, 255]);
    chromaKey(data);
    expect(data[3]).toBe(0);
    expect(data[7]).toBe(0);
    expect(data[11]).toBe(255);
  });
});

describe('gradient map', () => {
  const stops = gradientStops(['#3a6b8c', '#22445c', '#7fb3d5']);

  it('keeps outlines and transparency, recolours the rest by brightness', () => {
    const data = px([10, 10, 10, 255], [80, 80, 80, 255], [200, 200, 200, 255], [120, 120, 120, 0]);
    gradientMap(data, stops, gradientRange(data));
    expect([...data.slice(0, 4)]).toEqual([10, 10, 10, 255]);
    expect([...data.slice(12, 16)]).toEqual([120, 120, 120, 0]);
    // darkest → first stop, brightest → light colour
    expect([...data.slice(4, 7)]).toEqual(stops[0]);
    expect([...data.slice(8, 11)]).toEqual(hexToRgb('#7fb3d5'));
  });

  it('brighter source pixels stay brighter', () => {
    const grey = (v: number) => [v, v, v, 255];
    const data = px(...[60, 90, 120, 150, 180, 210].map(grey));
    gradientMap(data, stops, gradientRange(data));
    const lum = (i: number) => data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11;
    for (let i = 1; i < 6; i++) expect(lum(i)).toBeGreaterThanOrEqual(lum(i - 1));
  });
});

describe('frames and bounds', () => {
  it('finds the visible box', () => {
    // 3×2 image, one opaque pixel at (2,1)
    const data = new Uint8ClampedArray(3 * 2 * 4);
    data[(1 * 3 + 2) * 4 + 3] = 255;
    expect(opaqueBounds(data, 3, 2)).toEqual({ x0: 2, y0: 1, x1: 2, y1: 1 });
    expect(opaqueBounds(new Uint8ClampedArray(16), 2, 2)).toBeNull();
    expect(unionBox([null, { x0: 1, y0: 1, x1: 2, y1: 2 }, { x0: 0, y0: 3, x1: 1, y1: 4 }])).toEqual({ x0: 0, y0: 1, x1: 2, y1: 4 });
  });

  it('walks a strip, also across rows and with gaps', () => {
    expect(stripFrames({ file: '', w: 10, h: 8, x: 2, y: 4, step: 11, frames: 3, fps: 1 })).toEqual([
      { sx: 2, sy: 4 },
      { sx: 13, sy: 4 },
      { sx: 24, sy: 4 },
    ]);
    expect(stripFrames({ file: '', w: 10, h: 8, y: 0, perRow: 2, frames: 3, fps: 1 })[2]).toEqual({ sx: 0, sy: 8 });
  });

  it('packs wide sprites into several rows (texture width limit)', () => {
    expect(packGrid(24, 100)).toEqual({ cols: 24, rows: 1 });
    expect(packGrid(24, 200)).toEqual({ cols: 20, rows: 2 });
  });
});
