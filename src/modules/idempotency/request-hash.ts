import { createHash } from 'crypto';

/** JSON with object keys sorted at every level, so key order never changes the hash. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : v,
  );
}

/** Fingerprint of an operation: which endpoint, with which (validated) payload. */
export function hashRequest(scope: string, payload: unknown): string {
  return createHash('sha256')
    .update(`${scope}\n${canonicalJson(payload)}`)
    .digest('hex');
}
