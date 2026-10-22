import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearToken,
  isExpired,
  readClaims,
  readToken,
  saveToken,
  subscribeToToken,
} from './session-store';

const encode = (claims: object) =>
  `h.${btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.s`;

describe('token claims', () => {
  it('reads the subject and expiry from a JWT', () => {
    expect(readClaims(encode({ sub: 'u1', exp: 2_000_000_000 }))).toMatchObject({
      sub: 'u1',
      exp: 2_000_000_000,
    });
  });

  it('rejects malformed tokens', () => {
    expect(readClaims('not-a-jwt')).toBeNull();
    expect(readClaims('a.!!!.c')).toBeNull();
    expect(readClaims(encode({ exp: 1 }))).toBeNull();
  });

  it('treats a token as expired at or after its exp', () => {
    const token = encode({ sub: 'u1', exp: 1_000 });
    expect(isExpired(token, 999_999)).toBe(false);
    expect(isExpired(token, 1_000_000)).toBe(true);
    expect(isExpired('garbage')).toBe(true);
  });
});

describe('token store', () => {
  const data = new Map<string, string>();
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
      removeItem: (k: string) => data.delete(k),
    },
  });
  afterEach(() => data.clear());

  it('saves, reads and clears a token, notifying subscribers', () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToToken(onChange);
    const token = encode({ sub: 'u1', exp: Date.now() / 1000 + 3600 });

    saveToken(token);
    expect(readToken()).toBe(token);
    clearToken();
    expect(readToken()).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('never hands out an expired token', () => {
    saveToken(encode({ sub: 'u1', exp: 1 }));
    expect(readToken()).toBeNull();
  });
});
