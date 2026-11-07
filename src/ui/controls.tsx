import type { ReactNode } from 'react';
import { PixelIcon } from './PixelIcon';

export function Checkbox({ checked, label }: { checked: boolean; label?: string }) {
  return (
    <span className={`checkbox ${checked ? 'checked' : ''}`} role="checkbox" aria-checked={checked} aria-label={label}>
      {checked && <PixelIcon name="check" size={20} />}
    </span>
  );
}

export function PointsBadge({ points, sign }: { points: number; sign?: '+' | '−' }) {
  return (
    <span className={`points-badge ${sign === '−' ? 'minus' : ''}`}>
      {sign}
      {points}
    </span>
  );
}

interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label?: string;
}

export function Stepper({ value, min, max, onChange, label }: StepperProps) {
  return (
    <div className="stepper" aria-label={label}>
      <button className="stepper-btn" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="weniger">
        −
      </button>
      <span className="stepper-value display">{value}</span>
      <button className="stepper-btn" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="mehr">
        +
      </button>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" className="toggle" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Bar({ value, max, kind, label }: { value: number; max: number; kind: 'xp' | 'vit' | 'vit-low'; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={`bar bar-${kind}`} role="progressbar" aria-valuenow={value} aria-valuemax={max} aria-label={label}>
      <div className="bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Section({ title, right, children }: { title: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h3 className="display">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}
