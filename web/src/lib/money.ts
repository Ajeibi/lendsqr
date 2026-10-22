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
