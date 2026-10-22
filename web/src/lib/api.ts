/**
 * Thin fetch wrapper for the wallet API. In production the client is served
 * by the API itself, so the base is same-origin; `next dev` points it at the
 * local API via NEXT_PUBLIC_API_BASE.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api/v1';

/** Fired when the server ends the session (expired token, blocked account). */
export const SESSION_ENDED_EVENT = 'wallet:session-ended';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly messages: string[],
    readonly requestId?: string,
  ) {
    super(messages[0] ?? 'Something went wrong');
    this.name = 'ApiError';
  }

  /** Not the user's fault and worth retrying: offline, rate-limited, upstream down. */
  get isTransient(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

interface ErrorBody {
  message?: string | string[];
  requestId?: string;
}

/** Normalises the API's `{ statusCode, error, message, requestId }` shape. */
export function toApiError(status: number, body: unknown): ApiError {
  const { message, requestId } = (body ?? {}) as ErrorBody;
  const messages = Array.isArray(message)
    ? message
    : message
      ? [message]
      : [fallbackMessage(status)];
  return new ApiError(status, messages, requestId);
}

function fallbackMessage(status: number): string {
  if (status === 429) return 'Too many attempts. Wait a minute and try again.';
  if (status >= 500) return 'The server had a problem. Try again shortly.';
  return 'Something went wrong';
}

/** Whether a failed authenticated call means the session is over. */
export function endsSession(error: ApiError): boolean {
  return (
    error.status === 401 ||
    (error.status === 403 && error.message === 'Account is blocked')
  );
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  idempotencyKey?: string;
}

export interface ApiResult<T> {
  data: T;
  /** True when the server replayed a stored response for this Idempotency-Key. */
  replayed: boolean;
}

export async function api<T>(
  path: string,
  { method = 'GET', body, token, idempotencyKey }: ApiOptions = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, [
      "Couldn't reach the server. Check your connection and try again.",
    ]);
  }

  const text = await response.text();
  const json: unknown = text ? safeJson(text) : null;

  if (!response.ok) {
    const error = toApiError(response.status, json);
    if (token && endsSession(error)) {
      window.dispatchEvent(
        new CustomEvent(SESSION_ENDED_EVENT, { detail: error.message }),
      );
    }
    throw error;
  }

  return {
    data: json as T,
    replayed: response.headers.get('Idempotent-Replayed') === 'true',
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
