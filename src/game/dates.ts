/**
 * Date helpers working on local "date keys" (YYYY-MM-DD).
 * The day boundary is local midnight.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date of a timestamp as YYYY-MM-DD */
export function toDateKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function keyToUtcMs(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcMsToKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Calendar arithmetic, independent of DST */
export function addDays(key: string, days: number): string {
  return utcMsToKey(keyToUtcMs(key) + days * 86_400_000);
}

/** Number of days from a to b (b − a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((keyToUtcMs(b) - keyToUtcMs(a)) / 86_400_000);
}

/** All date keys strictly between `fromExclusive` and `toExclusive`, ascending */
export function datesBetween(fromExclusive: string, toExclusive: string): string[] {
  const out: string[] = [];
  for (let d = addDays(fromExclusive, 1); d < toExclusive; d = addDays(d, 1)) out.push(d);
  return out;
}

export function isValidDateKey(key: unknown): key is string {
  return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && utcMsToKey(keyToUtcMs(key)) === key;
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** e.g. "Mi, 05.11." */
export function formatDateKey(key: string, withWeekday = true): string {
  const [y, m, d] = key.split('-').map(Number);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${withWeekday ? `${wd}, ` : ''}${pad(d)}.${pad(m)}.`;
}
