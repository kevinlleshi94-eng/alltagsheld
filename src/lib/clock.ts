/**
 * Game clock. Everything time-related goes through here so the developer
 * menu can shift the date ("Datum um 1 Tag vorspulen").
 */
let offsetMs = 0;
const listeners = new Set<() => void>();

export const clock = {
  now(): number {
    return Date.now() + offsetMs;
  },
  getOffset(): number {
    return offsetMs;
  },
  setOffset(ms: number): void {
    offsetMs = ms;
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
