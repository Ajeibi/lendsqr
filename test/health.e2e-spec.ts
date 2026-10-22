import { createTestApp, TestContext } from './utils';

describe('Health & schema (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /health reports the database as up', async () => {
    const res = await ctx.http().get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('redirects the bare service URL to the API docs', async () => {
    const res = await ctx.http().get('/').expect(302);
    expect(res.headers.location).toBe('/docs');
  });

  it('keeps the redirect off the versioned API prefix', async () => {
    await ctx.http().get('/api/v1').expect(404);
  });

  it('returns the shared error shape for unknown routes', async () => {
    const res = await ctx.http().get('/api/v1/does-not-exist').expect(404);
    expect(res.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      requestId: expect.any(String),
    });
  });

  it('database refuses a negative wallet balance', async () => {
    const trx = await ctx.db.transaction();
    try {
      const [{ id: userId }] = await trx('users')
        .insert({
          email: 'constraint-check@test.local',
          phone_number: '+2340000000099',
          first_name: 'Check',
          last_name: 'Constraint',
          password_hash: 'x',
        })
        .returning<{ id: string }[]>('id');

      await expect(
        trx('wallets').insert({ user_id: userId, balance: -1 }),
      ).rejects.toThrow(/wallets_balance_non_negative/);
    } finally {
      await trx.rollback();
    }
  });
});
