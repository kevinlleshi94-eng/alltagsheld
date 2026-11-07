import { useEffect, useMemo, useRef, useState } from 'react';
import type { Item } from '../game/types';
import { PixelSprite } from '../ui/PixelIcon';
import { gearOf, heroLook, lookKey } from './assets/catalog';
import { composeCharacter, opaqueBounds } from './assets/compose';
import { HERO, HERO_PALETTE } from './sprites';

/** CSS px per art pixel */
const SCALE = 3;
/** transparent border around the visible figure (art px) */
const PAD = 2;
/** ground shadow (art px) */
const SHADOW_RX = 11;
const SHADOW_RY = 3;

/** Hero as in the fight (same LPC parts and equipment), standing still. Falls back to the placeholder art. */
export function HeroPortrait({ equipped, exhausted }: { equipped: readonly Item[]; exhausted?: boolean }) {
  const look = useMemo(() => heroLook(gearOf(equipped)), [equipped]);
  const key = lookKey(look);
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;
    composeCharacter(look, 'right')
      .then((sprite) => {
        const out = ref.current;
        if (cancelled || !out) return;
        // idle = frame 0 (top left of the packed sheet); crop to the figure itself
        const frame = document.createElement('canvas');
        frame.width = sprite.frameW;
        frame.height = sprite.frameH;
        const fctx = frame.getContext('2d')!;
        fctx.drawImage(sprite.canvas, 0, 0, sprite.frameW, sprite.frameH, 0, 0, sprite.frameW, sprite.frameH);
        const box = opaqueBounds(fctx.getImageData(0, 0, frame.width, frame.height).data, frame.width, frame.height);
        if (!box) throw new Error('leeres Sprite');
        // crop = figure + shadow under the feet (the weapon may stick out to one side)
        const fx = sprite.originX;
        const fy = sprite.originY;
        const x0 = Math.min(box.x0, fx - SHADOW_RX) - PAD;
        const x1 = Math.max(box.x1, fx + SHADOW_RX) + PAD;
        const y0 = box.y0 - PAD;
        const y1 = Math.max(box.y1, fy + SHADOW_RY) + PAD;
        const w = x1 - x0 + 1;
        const h = y1 - y0 + 1;
        out.width = w;
        out.height = h;
        out.style.width = `${w * SCALE}px`;
        out.style.height = `${h * SCALE}px`;
        const ctx = out.getContext('2d')!;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(fx - x0, fy - y0 - 1, SHADOW_RX, SHADOW_RY, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(frame, x0, y0, w, h, 0, 0, w, h);
        setState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('Heldenbild konnte nicht geladen werden', err);
        setState('failed');
      });
    return () => {
      cancelled = true;
    };
    // `key` describes `look` completely
  }, [key]);

  return (
    <div className={`hero-portrait ${exhausted ? 'exhausted' : ''}`} aria-hidden>
      <canvas ref={ref} className="hero-portrait-canvas" hidden={state !== 'ready'} />
      {state === 'failed' && <PixelSprite rows={HERO} palette={HERO_PALETTE} scale={SCALE * 2} />}
    </div>
  );
}
