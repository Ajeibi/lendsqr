import { describe, expect, it } from 'vitest';
import { formatKobo, MAX_AMOUNT_KOBO, parseNairaToKobo } from './money';

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

  it('never goes through floating point', () => {
    expect(formatKobo(Number.MAX_SAFE_INTEGER)).toBe('₦90,071,992,547,409.91');
  });
});

describe('parseNairaToKobo', () => {
  it.each([
    ['1500', 150_000],
    ['1,500', 150_000],
    ['₦ 1,500.50', 150_050],
    ['0.5', 50],
    ['0.07', 7],
    ['19.99', 1_999], // 19.99 * 100 in floating point is 1998.9999999999998
    ['5000000', MAX_AMOUNT_KOBO],
  ])('%p -> %i kobo', (input, kobo) => {
    expect(parseNairaToKobo(input)).toEqual({ ok: true, kobo });
  });

  it.each([
    ['', /enter an amount/i],
    ['   ', /enter an amount/i],
    ['0', /greater than zero/i],
    ['0.00', /greater than zero/i],
    ['-5', /2 decimal places/i],
    ['1.234', /2 decimal places/i],
    ['12abc', /2 decimal places/i],
    ['1e3', /2 decimal places/i],
    ['5000000.01', /maximum per transaction is ₦5,000,000.00/],
    ['99999999999999999999', /maximum/],
  ])('rejects %p', (input, error) => {
    const result = parseNairaToKobo(input);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(error);
  });
});
