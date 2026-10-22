/**
 * The access token lives in sessionStorage: it survives a refresh but not
 * closing the tab, and never persists like localStorage would. (An HttpOnly
 * cookie would be stronger but needs CSRF protection on the API; out of scope.)
 *
 * Exposed as a tiny external store so React can read it with
 * useSyncExternalStore: no effect-driven state, and no mismatch with the
 * prerendered HTML (which has no storage).
 */
const TOKEN_KEY = 'wallet.token';
const listeners = new Set<() => void>();

interface JwtClaims {
  sub: string;
  exp?: number;
}

/** Reads a JWT's claims without verifying it; the server is the authority. */
export function readClaims(token: string): JwtClaims | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(json) as Partial<JwtClaims>;
    return typeof claims.sub === 'string' ? (claims as JwtClaims) : null;
  } catch {
    return null;
  }
}

export function isExpired(token: string, nowMs = Date.now()): boolean {
  const claims = readClaims(token);
  if (!claims) return true;
  return claims.exp !== undefined && claims.exp * 1000 <= nowMs;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** The stored token if it's still usable, else null. Pure: safe to call during render. */
export function readToken(): string | null {
  const token = storage()?.getItem(TOKEN_KEY) ?? null;
  return token && !isExpired(token) ? token : null;
}

export function saveToken(token: string): void {
  storage()?.setItem(TOKEN_KEY, token);
  listeners.forEach((notify) => notify());
}

export function clearToken(): void {
  storage()?.removeItem(TOKEN_KEY);
  listeners.forEach((notify) => notify());
}

export function subscribeToToken(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}
