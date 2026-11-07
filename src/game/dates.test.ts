import { describe, expect, it } from 'vitest';
import { addDays, datesBetween, daysBetween, formatDateKey, isValidDateKey, toDateKey } from './dates';

describe('dates', () => {
  it('formats local dates as YYYY-MM-DD', () => {
    expect(toDateKey(new Date(2026, 0, 3, 0, 0, 1).getTime())).toBe('2026-01-03');
    expect(toDateKey(new Date(2026, 0, 3, 23, 59, 59).getTime())).toBe('2026-01-03');
  });

  it('adds days across month, year and DST boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    // DST in Germany: 2026-03-29 and 2026-10-25
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });

  it('computes ranges and differences', () => {
    expect(datesBetween('2026-11-01', '2026-11-05')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04']);
    expect(datesBetween('2026-11-04', '2026-11-05')).toEqual([]);
    expect(datesBetween('2026-11-06', '2026-11-05')).toEqual([]);
    expect(daysBetween('2026-11-01', '2026-11-05')).toBe(4);
  });

  it('validates and pretty-prints keys', () => {
    expect(isValidDateKey('2026-11-05')).toBe(true);
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('foo')).toBe(false);
    expect(formatDateKey('2026-11-05')).toBe('Do, 05.11.');
  });
});
