/**
 * Procedural 8-bit style sound effects (Web Audio, no files needed).
 * iOS only allows audio after a user gesture → `installAudioUnlock()` resumes
 * the AudioContext on the first tap. Respects the sound settings via `configureSfx`.
 * Real sound files can replace these in Phase 5.
 */
export type SfxName =
  | 'hit'
  | 'crit'
  | 'hurt'
  | 'enemyDefeated'
  | 'bossAppear'
  | 'fightLost'
  | 'areaCleared'
  | 'levelUp'
  | 'death';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let volume = 0.7;
const lastPlayed = new Map<SfxName, number>();

type AudioContextCtor = typeof AudioContext;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  return ctx;
}

export function configureSfx(opts: { enabled: boolean; volume: number }) {
  enabled = opts.enabled;
  volume = Math.max(0, Math.min(1, opts.volume));
  if (master) master.gain.value = volume;
}

/** Starts/resumes the audio context – must run inside a user gesture on iOS */
export function resumeAudio() {
  const c = audio();
  if (c && c.state !== 'running') void c.resume().catch(() => undefined);
}

/** Resume audio on every user gesture (iOS suspends it after interruptions too) */
export function installAudioUnlock() {
  const unlock = () => {
    if (enabled) resumeAudio();
  };
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  window.addEventListener('keydown', unlock, { capture: true });
}

// ---------------------------------------------------------------------------
// building blocks
// ---------------------------------------------------------------------------

interface ToneOpts {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}

function tone(c: AudioContext, o: ToneOpts) {
  const t0 = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'square';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g).connect(master!);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.02);
}

let noiseBuffer: AudioBuffer | null = null;

interface NoiseOpts {
  dur: number;
  gain?: number;
  /** filter frequency, optionally swept to `to` */
  freq?: number;
  to?: number;
  q?: number;
  delay?: number;
  type?: BiquadFilterType;
}

function noise(c: AudioContext, o: NoiseOpts) {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate * 1, c.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = c.currentTime + (o.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = c.createBiquadFilter();
  filter.type = o.type ?? 'bandpass';
  filter.frequency.setValueAtTime(o.freq ?? 1800, t0);
  if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
  if (o.q) filter.Q.value = o.q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  src.connect(filter).connect(g).connect(master!);
  // random start offset → repeated hits do not sound identical
  src.start(t0, Math.random() * 0.3);
  src.stop(t0 + o.dur + 0.02);
}

const notes = (c: AudioContext, freqs: number[], step: number, o: Omit<ToneOpts, 'freq'>) =>
  freqs.forEach((freq, i) => tone(c, { ...o, freq, delay: (o.delay ?? 0) + i * step }));

/** ±8 % pitch variation */
const vary = () => 0.92 + Math.random() * 0.16;

const SOUNDS: Record<SfxName, (c: AudioContext) => void> = {
  // sword slash: falling "swish" + short thump
  hit: (c) => {
    const v = vary();
    noise(c, { dur: 0.1, gain: 0.24, freq: 3400 * v, to: 700, q: 0.9 });
    tone(c, { freq: 190 * v, to: 70, dur: 0.08, type: 'triangle', gain: 0.22 });
  },
  // heavy slash: brighter swish, deeper impact, metallic ring
  crit: (c) => {
    const v = vary();
    noise(c, { dur: 0.16, gain: 0.28, freq: 5200 * v, to: 900, q: 0.8 });
    tone(c, { freq: 150, to: 50, dur: 0.16, type: 'triangle', gain: 0.3 });
    tone(c, { freq: 1568 * v, dur: 0.26, type: 'triangle', gain: 0.07, delay: 0.02 });
    tone(c, { freq: 2349 * v, dur: 0.18, type: 'triangle', gain: 0.05, delay: 0.02 });
  },
  // hero is hit: dull blow
  hurt: (c) => {
    const v = vary();
    noise(c, { dur: 0.12, gain: 0.22, freq: 1100 * v, to: 260, type: 'lowpass' });
    tone(c, { freq: 120 * v, to: 45, dur: 0.14, type: 'triangle', gain: 0.28 });
    tone(c, { freq: 240 * v, to: 150, dur: 0.07, type: 'square', gain: 0.035 });
  },
  enemyDefeated: (c) => {
    noise(c, { dur: 0.18, gain: 0.15, freq: 900 });
    notes(c, [392, 523, 659], 0.06, { dur: 0.09, gain: 0.09, delay: 0.05 });
  },
  bossAppear: (c) => {
    tone(c, { freq: 82, to: 55, dur: 0.9, type: 'sawtooth', gain: 0.18 });
    tone(c, { freq: 110, to: 73, dur: 0.9, type: 'square', gain: 0.07 });
    noise(c, { dur: 0.35, gain: 0.2, freq: 220, type: 'lowpass' });
    noise(c, { dur: 0.35, gain: 0.2, freq: 220, type: 'lowpass', delay: 0.45 });
  },
  fightLost: (c) => notes(c, [392, 330, 262, 196], 0.13, { dur: 0.16, type: 'triangle', gain: 0.16 }),
  areaCleared: (c) => {
    notes(c, [523, 659, 784], 0.1, { dur: 0.12, gain: 0.1 });
    tone(c, { freq: 1047, dur: 0.45, gain: 0.1, delay: 0.3 });
    tone(c, { freq: 784, dur: 0.45, gain: 0.06, delay: 0.3, type: 'triangle' });
  },
  levelUp: (c) => {
    notes(c, [523, 659, 784, 1047], 0.08, { dur: 0.12, gain: 0.1 });
    notes(c, [1319, 1568, 2093], 0.06, { dur: 0.1, gain: 0.05, type: 'triangle', delay: 0.34 });
    tone(c, { freq: 1047, dur: 0.6, gain: 0.07, type: 'triangle', delay: 0.34 });
  },
  death: (c) => {
    notes(c, [330, 311, 294, 262], 0.22, { dur: 0.28, type: 'triangle', gain: 0.16 });
    tone(c, { freq: 131, to: 65, dur: 1.1, type: 'sawtooth', gain: 0.08, delay: 0.9 });
    noise(c, { dur: 0.6, gain: 0.08, freq: 300, type: 'lowpass', delay: 0.9 });
  },
};

/** Plays a sound (silently ignored if muted, locked or unsupported) */
export function playSfx(name: SfxName) {
  if (!enabled || volume <= 0) return;
  const c = audio();
  if (!c || c.state !== 'running' || !master) return;
  const now = c.currentTime;
  if (now - (lastPlayed.get(name) ?? -1) < 0.03) return;
  lastPlayed.set(name, now);
  try {
    SOUNDS[name](c);
  } catch {
    // audio must never break the game
  }
}
