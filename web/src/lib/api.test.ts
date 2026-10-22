import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, endsSession, SESSION_ENDED_EVENT, toApiError } from './api';

describe('toApiError', () => {
  it('keeps every validation message and the request id', () => {
    const error = toApiError(400, {
      statusCode: 400,
      message: ['email must be an email', 'property role should not exist'],
      requestId: 'abc-123',
    });
    expect(error.messages).toHaveLength(2);
    expect(error.message).toBe('email must be an email');
    expect(error.requestId).toBe('abc-123');
  });

  it('wraps a single message', () => {
    expect(toApiError(409, { message: 'Email is already registered' }).messages).toEqual([
      'Email is already registered',
    ]);
  });

  it('falls back to a helpful message when the body is unusable', () => {
    expect(toApiError(429, null).message).toMatch(/too many attempts/i);
    expect(toApiError(502, '<html>').message).toMatch(/server had a problem/i);
  });

  it('marks network, rate-limit and server errors as transient', () => {
    expect(new ApiError(0, ['offline']).isTransient).toBe(true);
    expect(new ApiError(429, ['slow down']).isTransient).toBe(true);
    expect(new ApiError(503, ['karma down']).isTransient).toBe(true);
    expect(new ApiError(422, ['Insufficient funds']).isTransient).toBe(false);
  });
});

describe('endsSession', () => {
  it('ends the session on 401 and on a blocked account, not on other 403s', () => {
    expect(endsSession(new ApiError(401, ['Invalid or expired token']))).toBe(true);
    expect(endsSession(new ApiError(403, ['Account is blocked']))).toBe(true);
    expect(endsSession(new ApiError(403, ['Insufficient permissions']))).toBe(false);
  });
});

describe('api()', () => {
  const dispatched: string[] = [];
  vi.stubGlobal('window', {
    dispatchEvent: (event: CustomEvent<string>) => {
      dispatched.push(`${event.type}:${event.detail}`);
      return true;
    },
  });
  vi.stubGlobal(
    'CustomEvent',
    class<T> {
      constructor(
        readonly type: string,
        readonly init: { detail: T },
      ) {}
      get detail() {
        return this.init.detail;
      }
    },
  );

  afterEach(() => {
    vi.restoreAllMocks();
    dispatched.length = 0;
  });

  function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
    return vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(body), { status, headers }));
  }

  it('sends the token and Idempotency-Key, and reports a replay', async () => {
    const fetchMock = respond(201, { ok: true }, { 'Idempotent-Replayed': 'true' });
    const result = await api('/transfers', {
      method: 'POST',
      body: { amount: 100 },
      token: 't0k',
      idempotencyKey: 'key-12345678',
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer t0k',
      'Idempotency-Key': 'key-12345678',
      'Content-Type': 'application/json',
    });
    expect(result).toEqual({ data: { ok: true }, replayed: true });
  });

  it('announces the end of the session when an authenticated call gets 401', async () => {
    respond(401, { message: 'Invalid or expired token' });
    await expect(api('/users/me', { token: 'old' })).rejects.toBeInstanceOf(ApiError);
    expect(dispatched).toEqual([`${SESSION_ENDED_EVENT}:Invalid or expired token`]);
  });

  it('does not end a session that never existed (a failed login)', async () => {
    respond(401, { message: 'Invalid email or password' });
    await expect(api('/auth/login', { method: 'POST', body: {} })).rejects.toThrow(
      'Invalid email or password',
    );
    expect(dispatched).toEqual([]);
  });

  it('turns a network failure into a friendly, transient error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const error = await api('/users/me').catch((e: ApiError) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isTransient).toBe(true);
  });
});
