/** The API's per-transaction cap (MAX_TRANSACTION_AMOUNT): NGN 5,000,000. */
export const MAX_AMOUNT_KOBO = 500_000_000;

/**
 * Formats kobo as naira using integer arithmetic only, so no floating-point
 * value ever represents money: 1100050 -> "₦11,000.50".
 */
export function formatKobo(kobo: number, { signed = false } = {}): string {
  const sign = kobo < 0 ? '−' : signed && kobo > 0 ? '+' : '';
  const abs = Math.abs(kobo);
  const naira = Math.floor(abs / 100).toLocaleString('en-NG');
  const minor = String(abs % 100).padStart(2, '0');
  return `${sign}₦${naira}.${minor}`;
}

export type ParsedAmount = { ok: true; kobo: number } | { ok: false; error: string };

/**
 * Parses what a person types ("1,500", "₦ 1,500.5", "0.75") into kobo by
 * splitting the text into naira and kobo digits. Never multiplies a float by
 * 100, so "19.99" is exactly 1999 rather than 1998.9999999999998.
 */
export function parseNairaToKobo(input: string): ParsedAmount {
  const text = input.replace(/[₦,\s]/g, '');
  if (!text) return { ok: false, error: 'Enter an amount' };

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) {
    return {
      ok: false,
      error: 'Enter an amount in naira, with at most 2 decimal places',
    };
  }

  const naira = Number(match[1]);
  const minor = Number((match[2] ?? '').padEnd(2, '0'));
  const kobo = naira * 100 + minor;

  if (kobo === 0) return { ok: false, error: 'Enter an amount greater than zero' };
  if (!Number.isSafeInteger(kobo) || kobo > MAX_AMOUNT_KOBO) {
    return {
      ok: false,
      error: `The maximum per transaction is ${formatKobo(MAX_AMOUNT_KOBO)}`,
    };
  }
  return { ok: true, kobo };
}
