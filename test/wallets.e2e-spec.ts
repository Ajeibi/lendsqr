import { randomUUID } from 'crypto';
import {
  createTestApp,
  expectLedgerConsistent,
  registerUser,
  resetDb,
  TestContext,
  TestUser,
} from './utils';

describe('Wallet funding (e2e)', () => {
  let ctx: TestContext;
  let user: TestUser;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(ctx.db);
    user = await registerUser(ctx);
  });

  afterEach(async () => {
    await expectLedgerConsistent(ctx.db);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const fund = (
    body: Record<string, unknown>,
    key: string | null = randomUUID(),
    token = user.token,
  ) => {
    const req = ctx
      .http()
      .post('/api/v1/wallets/fund')
      .set('Authorization', `Bearer ${token}`);
    if (key !== null) void req.set('Idempotency-Key', key);
    return req.send(body);
  };

  const balanceOf = async (walletId: string) =>
    (await ctx.db('wallets').where({ id: walletId }).first('balance'))
      .balance as number;

  const countRows = async (table: string): Promise<number> => {
    const [{ n }] = await ctx.db(table).count<{ n: number }[]>({ n: '*' });
    return Number(n);
  };

  describe('happy path', () => {
    it('credits the wallet and records a FUNDING transaction with one ledger entry', async () => {
      const res = await fund({
        amount: 250_000,
        narration: '  Salary  ',
      }).expect(201);

      expect(res.headers['idempotent-replayed']).toBeUndefined();
      expect(res.body.wallet).toEqual({
        id: user.walletId,
        currency: 'NGN',
        balance: 250_000,
      });
      expect(res.body.transaction).toMatchObject({
        reference: expect.stringMatching(/^FND-/),
        type: 'FUNDING',
        status: 'SUCCESS',
        amount: 250_000,
        currency: 'NGN',
        sourceWalletId: null,
        destinationWalletId: user.walletId,
        narration: 'Salary',
      });

      const entries = await ctx
        .db('ledger_entries')
        .where({ transaction_id: res.body.transaction.id });
      expect(entries).toEqual([
        expect.objectContaining({
          wallet_id: user.walletId,
          direction: 'CREDIT',
          amount: 250_000,
          balance_before: 0,
          balance_after: 250_000,
        }),
      ]);
    });

    it('accumulates successive fundings', async () => {
      await fund({ amount: 100 }).expect(201);
      const res = await fund({ amount: 50 }).expect(201);
      expect(res.body.wallet.balance).toBe(150);
    });

    it('GET /wallets/me reflects the balance', async () => {
      await fund({ amount: 1_234 }).expect(201);
      const res = await ctx
        .http()
        .get('/api/v1/wallets/me')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);
      expect(res.body).toEqual({
        id: user.walletId,
        currency: 'NGN',
        balance: 1_234,
      });
    });
  });

  describe('idempotency', () => {
    it('replays the original response for a retried key without crediting again', async () => {
      const key = randomUUID();
      const first = await fund({ amount: 5_000 }, key).expect(201);
      const retry = await fund({ amount: 5_000 }, key).expect(201);

      expect(retry.headers['idempotent-replayed']).toBe('true');
      expect(retry.text).toBe(first.text); // byte-for-byte, not just deep-equal
      expect(await balanceOf(user.walletId)).toBe(5_000);
      expect(await countRows('transactions')).toBe(1);
    });

    it('treats a reordered but identical payload as the same request', async () => {
      const key = randomUUID();
      await fund({ amount: 700, narration: 'x' }, key).expect(201);
      const retry = await fund({ narration: 'x', amount: 700 }, key).expect(
        201,
      );
      expect(retry.headers['idempotent-replayed']).toBe('true');
    });

    it('rejects a reused key with a different payload (422) and moves no money', async () => {
      const key = randomUUID();
      await fund({ amount: 5_000 }, key).expect(201);
      const res = await fund({ amount: 9_000 }, key).expect(422);

      expect(res.body.message).toMatch(/different request/);
      expect(await balanceOf(user.walletId)).toBe(5_000);
    });

    it('scopes keys per user: the same key is independent for another user', async () => {
      const other = await registerUser(ctx);
      const key = randomUUID();
      await fund({ amount: 100 }, key).expect(201);
      const res = await fund({ amount: 100 }, key, other.token).expect(201);

      expect(res.headers['idempotent-replayed']).toBeUndefined();
      expect(await balanceOf(other.walletId)).toBe(100);
    });

    it('credits exactly once when the same request is fired 10 times concurrently', async () => {
      const key = randomUUID();
      const responses = await Promise.all(
        Array.from({ length: 10 }, () => fund({ amount: 1_000 }, key)),
      );

      expect(responses.map((r) => r.status)).toEqual(Array(10).fill(201));
      const references = new Set(
        responses.map((r) => String(r.body.transaction.reference)),
      );
      expect(references.size).toBe(1);
      expect(
        responses.filter((r) => r.headers['idempotent-replayed'] === 'true'),
      ).toHaveLength(9);
      expect(await balanceOf(user.walletId)).toBe(1_000);
      expect(await countRows('transactions')).toBe(1);
    });

    it('does not burn the key when the request fails, so it can be retried', async () => {
      const key = randomUUID();
      await ctx
        .db('users')
        .where({ id: user.id })
        .update({ status: 'BLOCKED' });
      await fund({ amount: 100 }, key).expect(403);

      await ctx.db('users').where({ id: user.id }).update({ status: 'ACTIVE' });
      const res = await fund({ amount: 100 }, key).expect(201);
      expect(res.headers['idempotent-replayed']).toBeUndefined();
      expect(await countRows('idempotency_keys')).toBe(1);
    });

    it('allows an expired key to be used for a new operation', async () => {
      const key = randomUUID();
      await fund({ amount: 100 }, key).expect(201);
      await ctx
        .db('idempotency_keys')
        .where({ key })
        .update({ expires_at: ctx.db.raw("now() - interval '1 second'") });

      const res = await fund({ amount: 300 }, key).expect(201);
      expect(res.headers['idempotent-replayed']).toBeUndefined();
      expect(await balanceOf(user.walletId)).toBe(400);
    });

    it.each([
      ['missing', null, /header is required/],
      ['too short', 'abc', /must be 8-255 characters/],
      ['containing spaces', 'not a valid key', /must be 8-255 characters/],
    ])(
      'rejects a %s Idempotency-Key with 400',
      async (_label, key, message) => {
        const res = await fund({ amount: 100 }, key).expect(400);
        expect(res.body.message).toMatch(message);
        expect(await balanceOf(user.walletId)).toBe(0);
      },
    );
  });

  describe('concurrency', () => {
    it('applies 25 concurrent fundings with distinct keys without losing any update', async () => {
      const amounts = Array.from({ length: 25 }, (_, i) => (i + 1) * 100);
      const responses = await Promise.all(
        amounts.map((amount) => fund({ amount })),
      );

      expect(responses.every((r) => r.status === 201)).toBe(true);
      expect(await balanceOf(user.walletId)).toBe(
        amounts.reduce((a, b) => a + b, 0),
      );
      expect(await countRows('transactions')).toBe(25);
    });
  });

  describe('validation and access', () => {
    it.each([
      ['zero', { amount: 0 }],
      ['negative', { amount: -500 }],
      ['fractional', { amount: 10.5 }],
      ['a numeric string', { amount: '100' }],
      ['missing', {}],
      ['an unknown field', { amount: 100, walletId: randomUUID() }],
      ['an over-long narration', { amount: 100, narration: 'x'.repeat(256) }],
    ])('rejects an amount that is %s with 400', async (_label, body) => {
      await fund(body).expect(400);
      expect(await balanceOf(user.walletId)).toBe(0);
    });

    it('rejects an amount above the per-transaction limit without using the key', async () => {
      const key = randomUUID();
      const res = await fund({ amount: 500_000_001 }, key).expect(400);
      expect(res.body.message).toMatch(/must not exceed/);
      expect(await countRows('idempotency_keys')).toBe(0);
    });

    it('requires authentication', async () => {
      await ctx
        .http()
        .post('/api/v1/wallets/fund')
        .set('Idempotency-Key', randomUUID())
        .send({ amount: 100 })
        .expect(401);
    });

    it('refuses a blocked user', async () => {
      await ctx
        .db('users')
        .where({ id: user.id })
        .update({ status: 'BLOCKED' });
      await fund({ amount: 100 }).expect(403);
      expect(await balanceOf(user.walletId)).toBe(0);
    });
  });
});
