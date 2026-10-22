export interface KeyState {
  /** Canonical form of the request the key belongs to. */
  fingerprint: string;
  key: string;
}

/**
 * Decides which Idempotency-Key a form should send.
 *
 * - Same request as before (a retry after a failure, a double click): keep the
 *   key, so the server recognises the repeat and never moves money twice.
 * - Different request (amount or recipient edited): new key, otherwise the
 *   server would rightly refuse a reused key with a different payload (422).
 */
export function keyFor(
  previous: KeyState,
  fingerprint: string,
  newKey: () => string,
): KeyState {
  return previous.fingerprint === fingerprint
    ? previous
    : { fingerprint, key: newKey() };
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
