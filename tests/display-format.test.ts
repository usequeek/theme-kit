import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DISPLAY_LOCALE, DISPLAY_TIME_ZONE, formatCount, formatDisplayDate, formatMoney } from '../utils/format';

/**
 * Storefront pages render on the server first. A date formatted with the
 * runtime's default locale printed "Feb 14, 2026" on the server (Node: en-US,
 * UTC) and "14 Feb 2026" in a Nigerian browser; React then failed hydration
 * (#418) and re-rendered the whole page on the client — seen live on every
 * store page with a reviews block. Everything the kit displays is formatted in
 * one fixed locale and zone instead.
 */
describe('display formatting is the same on the server and in the browser', () => {
  it('uses one fixed locale and zone', () => {
    expect(DISPLAY_LOCALE).toBe('en-NG');
    expect(DISPLAY_TIME_ZONE).toBe('Africa/Lagos');
  });

  it('formats dates in Lagos time, whatever the machine is set to', () => {
    expect(formatDisplayDate('2026-02-14T10:00:00Z')).toBe('14 Feb 2026');
    // 23:30 UTC is already the 15th in Lagos (UTC+1) — the server (UTC) and the
    // browser (Lagos) used to print different days for this review.
    expect(formatDisplayDate('2026-02-14T23:30:00Z')).toBe('15 Feb 2026');
    expect(formatDisplayDate('2026-02-14', {})).toBe('14/02/2026');
    expect(formatDisplayDate('2026-02-14T23:30:00Z', { year: 'numeric', month: 'long', day: 'numeric' }, 'en-US')).toBe('February 15, 2026');
    expect(formatDisplayDate('not a date')).toBe('');
  });

  it('formats counts and money with fixed grouping', () => {
    expect(formatCount(1234567)).toBe('1,234,567');
    expect(formatMoney(12500)).toBe('₦12,500');
  });

  it('no kit source formats with the runtime default locale', () => {
    const ROOT = resolve(__dirname, '..');
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (entry === 'node_modules' || entry === 'tests' || entry.startsWith('.')) return [];
      if (statSync(path).isDirectory()) return walk(path);
      return /\.(ts|tsx)$/.test(entry) ? [path] : [];
    });
    const offenders = walk(ROOT).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return /\.toLocale(?:Date|Time)?String\(\s*(?:undefined\s*[,)]|\))/.test(source) ? [relative(ROOT, file)] : [];
    });
    expect(offenders).toEqual([]);
  });
});
