import { describe, expect, it } from 'vitest';
import { formatKobo } from './money';

describe('formatKobo', () => {
  it.each([
    [0, '₦0.00'],
    [7, '₦0.07'],
    [1_100_050, '₦11,000.50'],
    [500_000_000, '₦5,000,000.00'],
  ])('%i kobo -> %s', (kobo, text) => {
    expect(formatKobo(kobo)).toBe(text);
  });

  it('signs amounts when asked', () => {
    expect(formatKobo(150_000, { signed: true })).toBe('+₦1,500.00');
    expect(formatKobo(-150_000, { signed: true })).toBe('−₦1,500.00');
  });

  it('never goes through floating point (no 0.1 + 0.2 artefacts)', () => {
    expect(formatKobo(Number.MAX_SAFE_INTEGER)).toBe('₦90,071,992,547,409.91');
  });
});
