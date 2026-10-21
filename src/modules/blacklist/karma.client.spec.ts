import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { KarmaClient, KarmaUnavailableError } from './karma.client';

const adjutor: AppConfig['adjutor'] = {
  baseUrl: 'https://adjutor.test/v2',
  apiKey: 'test-key',
  timeoutMs: 1000,
  failOpen: false,
};

function makeClient(overrides: Partial<AppConfig['adjutor']> = {}) {
  const config = {
    get: () => ({ ...adjutor, ...overrides }),
  } as unknown as ConfigService<AppConfig, true>;
  return new KarmaClient(config);
}

function respond(status: number, body?: unknown): void {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
    }),
  );
}

const record = (identity: string, mock = false) => ({
  status: 'success',
  message: 'Successful',
  ...(mock ? { 'mock-response': 'This is a mock response' } : {}),
  data: { karma_identity: identity, amount_in_contention: '0.00' },
});

describe('KarmaClient', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is disabled without an API key', () => {
    expect(makeClient({ apiKey: '' }).enabled).toBe(false);
  });

  it('calls the Karma endpoint with a bearer token and encoded identity', async () => {
    respond(404);
    await makeClient().lookup('PHONE', '+2348031234567');

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      'https://adjutor.test/v2/verification/karma/%2B2348031234567',
    );
    expect(init.headers).toEqual({ Authorization: 'Bearer test-key' });
  });

  it('reports a HIT when the returned identity matches the query', async () => {
    respond(200, record('Ada@Example.com'));
    await expect(makeClient().lookup('EMAIL', 'ada@example.com')).resolves.toBe(
      'HIT',
    );
  });

  it('matches phone numbers across formats', async () => {
    respond(200, record('08031234567'));
    await expect(makeClient().lookup('PHONE', '+2348031234567')).resolves.toBe(
      'HIT',
    );
  });

  it('ignores the test-mode mock record that does not match the query', async () => {
    respond(200, record('0zspgifzbo.ga', true));
    await expect(makeClient().lookup('EMAIL', 'ada@example.com')).resolves.toBe(
      'CLEAR',
    );
  });

  it('treats 404 as not blacklisted', async () => {
    respond(404, { status: 'error', message: 'Identity not found' });
    await expect(makeClient().lookup('EMAIL', 'ada@example.com')).resolves.toBe(
      'CLEAR',
    );
  });

  it.each([401, 429, 500, 503])(
    'throws KarmaUnavailableError on HTTP %i',
    async (status) => {
      respond(status, { status: 'error' });
      await expect(
        makeClient().lookup('EMAIL', 'ada@example.com'),
      ).rejects.toBeInstanceOf(KarmaUnavailableError);
    },
  );

  it('throws KarmaUnavailableError on network failure or timeout', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
    await expect(
      makeClient().lookup('EMAIL', 'ada@example.com'),
    ).rejects.toBeInstanceOf(KarmaUnavailableError);
  });

  it('throws KarmaUnavailableError on a malformed body', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('<html>oops</html>', { status: 200 }));
    await expect(
      makeClient().lookup('EMAIL', 'ada@example.com'),
    ).rejects.toBeInstanceOf(KarmaUnavailableError);
  });
});
