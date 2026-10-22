import { describe, expect, it } from 'vitest';
import { keyFor, newIdempotencyKey } from './idempotency';

describe('keyFor', () => {
  let n = 0;
  const next = () => `key-${++n}`;

  it('keeps the key when the same request is retried', () => {
    const first = keyFor({ fingerprint: '', key: 'key-0' }, 'send:100:tunde', next);
    expect(keyFor(first, 'send:100:tunde', next)).toBe(first);
  });

  it('issues a new key once the request changes', () => {
    const first = keyFor({ fingerprint: '', key: 'key-0' }, 'send:100:tunde', next);
    const edited = keyFor(first, 'send:200:tunde', next);
    expect(edited.key).not.toBe(first.key);
    expect(edited.fingerprint).toBe('send:200:tunde');
  });

  it('issues a new key when the user changes it back (a fresh request)', () => {
    const a = keyFor({ fingerprint: '', key: 'key-0' }, 'A', next);
    const b = keyFor(a, 'B', next);
    expect(keyFor(b, 'A', next).key).not.toBe(a.key);
  });
});

describe('newIdempotencyKey', () => {
  it('produces keys the API accepts (UUIDs) and never repeats', () => {
    const keys = new Set(Array.from({ length: 100 }, newIdempotencyKey));
    expect(keys.size).toBe(100);
    for (const key of keys) expect(key).toMatch(/^[A-Za-z0-9_.:-]{8,255}$/);
  });
});
