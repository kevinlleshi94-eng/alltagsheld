/**
 * Creates the Phaser game inside `parent`. Loaded via dynamic import so the
 * engine (~1 MB) does not block the first paint of the task list.
 */
import * as Phaser from 'phaser';
import { BattleScene } from './BattleScene';
import type { BattleCallbacks } from './bridge';

/**
 * Game pixels = art pixels. The LPC figures (~50 px) are made for a scene of about
 * TARGET_HEIGHT game pixels, so on phones one game pixel is one CSS pixel and the
 * browser scales the canvas by the device pixel ratio with nearest-neighbour
 * (pixelArt) – every art pixel becomes a crisp dpr×dpr block (iPhone: 3×3).
 * Only much taller scenes zoom in, always by whole device pixels.
 */
const TARGET_HEIGHT = 270;

function measure(el: HTMLElement) {
  const w = Math.max(1, el.clientWidth);
  const h = Math.max(1, el.clientHeight);
  const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
  const devicePxPerGamePx = Math.max(dpr, Math.round((h * dpr) / TARGET_HEIGHT));
  const zoom = devicePxPerGamePx / dpr;
  return { zoom, width: Math.ceil(w / zoom), height: Math.ceil(h / zoom) };
}

export interface BattleGameHandle {
  destroy(): void;
}

export function createBattleGame(parent: HTMLElement, cb: BattleCallbacks): BattleGameHandle {
  const m = measure(parent);
  // HTML layer for damage numbers: text stays sharp and readable at any zoom
  const fx = document.createElement('div');
  fx.className = 'battle-fx';
  parent.appendChild(fx);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: m.width,
    height: m.height,
    zoom: m.zoom,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#000000',
    banner: false,
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    scale: { mode: Phaser.Scale.NONE },
    fps: { target: 60 },
    scene: new BattleScene(cb, fx),
  });

  // debugging handle in the dev server only
  if (import.meta.env.DEV) (window as unknown as { __battle?: Phaser.Game }).__battle = game;

  const observer = new ResizeObserver(() => {
    // hidden or detached → keep the last size instead of shrinking the game to 1×1
    if (!parent.isConnected || parent.clientWidth === 0 || parent.clientHeight === 0) return;
    const n = measure(parent);
    if (n.zoom !== game.scale.zoom) game.scale.setZoom(n.zoom);
    if (n.width !== game.scale.width || n.height !== game.scale.height) game.scale.resize(n.width, n.height);
  });
  observer.observe(parent);

  return {
    destroy() {
      observer.disconnect();
      game.destroy(true);
      fx.remove();
    },
  };
}
