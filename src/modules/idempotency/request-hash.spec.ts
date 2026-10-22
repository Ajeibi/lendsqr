import { canonicalJson, hashRequest } from './request-hash';

describe('request fingerprinting', () => {
  it('ignores object key order at every level', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(
      canonicalJson({ a: { c: 3, d: 2 }, b: 1 }),
    );
    expect(hashRequest('POST /x', { amount: 100, narration: 'hi' })).toBe(
      hashRequest('POST /x', { narration: 'hi', amount: 100 }),
    );
  });

  it('keeps array order significant', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  it('distinguishes payloads and scopes', () => {
    const base = hashRequest('POST /wallets/fund', { amount: 100 });
    expect(hashRequest('POST /wallets/fund', { amount: 101 })).not.toBe(base);
    expect(hashRequest('POST /transfers', { amount: 100 })).not.toBe(base);
  });

  it('treats an omitted optional field the same as undefined', () => {
    expect(hashRequest('s', { amount: 1, narration: undefined })).toBe(
      hashRequest('s', { amount: 1 }),
    );
  });

  it('produces a 64-char hex SHA-256 digest', () => {
    expect(hashRequest('s', {})).toMatch(/^[0-9a-f]{64}$/);
  });
});
