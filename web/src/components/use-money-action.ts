'use client';

import { useRef, useState } from 'react';
import { ApiError, type ApiResult } from '@/lib/api';
import { keyFor, newIdempotencyKey, type KeyState } from '@/lib/idempotency';

export interface MoneyActionResult<T> {
  data: T;
  replayed: boolean;
}

/**
 * Runs a money-moving request with the right Idempotency-Key.
 *
 * The key is chosen at submit time from the request's fingerprint: an
 * identical retry (after a timeout, a failure or a double click) reuses it,
 * so the server never processes it twice; any edit gets a fresh key. A
 * successful request retires its key.
 */
export function useMoneyAction<T>() {
  const lastKey = useRef<KeyState>({ fingerprint: '', key: '' });
  // A ref, not state: a second click in the same frame must see it immediately.
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<MoneyActionResult<T> | null>(null);

  async function run(
    fingerprint: string,
    request: (idempotencyKey: string) => Promise<ApiResult<T>>,
  ): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    lastKey.current = keyFor(lastKey.current, fingerprint, newIdempotencyKey);
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const { data, replayed } = await request(lastKey.current.key);
      lastKey.current = { fingerprint: '', key: '' };
      setResult({ data, replayed });
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, ['Something went wrong']));
      return false;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  /** Clears the last outcome, e.g. once the user starts the next one. */
  function dismiss() {
    setResult(null);
    setError(null);
  }

  return { run, pending, error, result, dismiss };
}
