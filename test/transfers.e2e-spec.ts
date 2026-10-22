import { randomUUID } from 'crypto';
import {
  createTestApp,
  expectLedgerConsistent,
  expectMoneyConserved,
  fundWallet,
  registerUser,
  resetDb,
  TestContext,
  TestUser,
} from './utils';

describe('Transfers (e2e)', () => {
  let ctx: TestContext;
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(ctx.db);
    [alice, bob] = await Promise.all([registerUser(ctx), registerUser(ctx)]);
    await fundWallet(ctx, alice, 10_000);
  });

  afterEach(async () => {
    await expectLedgerConsistent(ctx.db);
    await expectMoneyConserved(ctx.db);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const transfer = (
    from: TestUser,
    body: Record<string, unknown>,
    key: string = randomUUID(),
  ) =>
    ctx
      .http()
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${from.token}`)
      .set('Idempotency-Key', key)
      .send(body);

  const balanceOf = async (user: TestUser) =>
    (await ctx.db('wallets').where({ id: user.walletId }).first('balance'))
      .balance as number;

  const countTransfers = async () => {
    const [{ n }] = await ctx
      .db('transactions')
      .where({ type: 'TRANSFER' })
      .count<{ n: number }[]>({ n: '*' });
    return Number(n);
  };

  describe('happy path', () => {
    it('moves money by wallet id and writes a DEBIT + CREDIT pair', async () => {
      const res = await transfer(alice, {
        recipientWalletId: bob.walletId,
        amount: 2_500,
        narration: 'Lunch',
      }).expect(201);

      expect(res.body.transaction).toMatchObject({
        reference: expect.stringMatching(/^TRF-/),
        type: 'TRANSFER',
        status: 'SUCCESS',
        amount: 2_500,
        sourceWalletId: alice.walletId,
        destinationWalletId: bob.walletId,
        narration: 'Lunch',
      });
      expect(res.body.wallet).toEqual({
        id: alice.walletId,
        currency: 'NGN',
        balance: 7_500,
      });
      expect(await balanceOf(alice)).toBe(7_500);
      expect(await balanceOf(bob)).toBe(2_500);

      const entries = await ctx
        .db('ledger_entries')
        .where({ transaction_id: res.body.transaction.id })
        .orderBy('id');
      expect(entries).toEqual([
        expect.objectContaining({
          wallet_id: alice.walletId,
          direction: 'DEBIT',
          amount: 2_500,
          balance_before: 10_000,
          balance_after: 7_500,
        }),
        expect.objectContaining({
          wallet_id: bob.walletId,
          direction: 'CREDIT',
          amount: 2_500,
          balance_before: 0,
          balance_after: 2_500,
        }),
      ]);
    });

    it("moves money by the recipient's email (any letter case)", async () => {
      await transfer(alice, {
        recipientEmail: bob.email.toUpperCase(),
        amount: 1_000,
      }).expect(201);
      expect(await balanceOf(bob)).toBe(1_000);
    });

    it("never exposes the recipient's balance to the sender", async () => {
      const res = await transfer(alice, {
        recipientWalletId: bob.walletId,
        amount: 1,
      }).expect(201);
      // Only the sender's own wallet carries a balance; the transaction doesn't.
      expect(Object.keys(res.body).sort()).toEqual(['transaction', 'wallet']);
      expect(res.body.transaction).not.toHaveProperty('balance');
      expect(res.body.wallet.id).toBe(alice.walletId);
    });

    it('allows spending the exact balance down to zero', async () => {
      await transfer(alice, {
        recipientWalletId: bob.walletId,
        amount: 10_000,
      }).expect(201);
      expect(await balanceOf(alice)).toBe(0);
    });
  });

  describe('business rules', () => {
    it('refuses insufficient funds (422) and moves nothing', async () => {
      const res = await transfer(alice, {
        recipientWalletId: bob.walletId,
        amount: 10_001,
      }).expect(422);
      expect(res.body.message).toBe('Insufficient funds');
      expect(await balanceOf(alice)).toBe(10_000);
      expect(await countTransfers()).toBe(0);
    });

    it('refuses a transfer to your own wallet (400)', async () => {
      await transfer(alice, {
        recipientWalletId: alice.walletId,
        amount: 100,
      }).expect(400);
      await transfer(alice, {
        recipientEmail: alice.email,
        amount: 100,
      }).expect(400);
    });

    it('returns 404 for an unknown recipient', async () => {
      await transfer(alice, {
        recipientWalletId: randomUUID(),
        amount: 100,
      }).expect(404);
      await transfer(alice, {
        recipientEmail: 'nobody@test.local',
        amount: 100,
      }).expect(404);
    });

    it('refuses a blocked recipient (422)', async () => {
      await ctx.db('users').where({ id: bob.id }).update({ status: 'BLOCKED' });
      const res = await transfer(alice, {
        recipientWalletId: bob.walletId,
        amount: 100,
      }).expect(422);
      expect(res.body.message).toBe(
        'Recipient account cannot receive transfers',
      );
      expect(await balanceOf(alice)).toBe(10_000);
    });

    it('refuses a blocked sender (403)', async () => {
      await ctx
        .db('users')
        .where({ id: alice.id })
        .update({ status: 'BLOCKED' });
      await transfer(alice, {
        recipientWalletId: bob.walletId,
        amount: 100,
      }).expect(403);
      expect(await balanceOf(alice)).toBe(10_000);
    });

    it('rejects an amount above the per-transaction limit (400)', async () => {
      await transfer(alice, {
        recipientWalletId: bob.walletId,
        amount: 500_000_001,
      }).expect(400);
    });

    it.each([
      ['no recipient', { amount: 100 }],
      [
        'both recipient fields',
        { recipientWalletId: 'WALLET', recipientEmail: 'x@y.com', amount: 100 },
      ],
      ['a malformed wallet id', { recipientWalletId: 'abc', amount: 100 }],
      ['a malformed email', { recipientEmail: 'abc', amount: 100 }],
      ['a zero amount', { recipientWalletId: 'WALLET', amount: 0 }],
      ['a string amount', { recipientWalletId: 'WALLET', amount: '100' }],
      ['a fractional amount', { recipientWalletId: 'WALLET', amount: 1.5 }],
      ['an unknown field', { recipientWalletId: 'WALLET', amount: 1, fee: 0 }],
    ])('rejects %s (400)', async (_label, body) => {
      const payload = Object.fromEntries(
        Object.entries(body).map(([k, v]) => [
          k,
          v === 'WALLET' ? bob.walletId : v,
        ]),
      );
      await transfer(alice, payload).expect(400);
      expect(await balanceOf(alice)).toBe(10_000);
    });

    it('requires an Idempotency-Key (400) and authentication (401)', async () => {
      await ctx
        .http()
        .post('/api/v1/transfers')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ recipientWalletId: bob.walletId, amount: 100 })
        .expect(400);
      await ctx
        .http()
        .post('/api/v1/transfers')
        .set('Idempotency-Key', randomUUID())
        .send({ recipientWalletId: bob.walletId, amount: 100 })
        .expect(401);
    });
  });

  describe('idempotency', () => {
    it('replays a retried transfer byte-for-byte and moves money once', async () => {
      const key = randomUUID();
      const body = { recipientWalletId: bob.walletId, amount: 3_000 };
      const first = await transfer(alice, body, key).expect(201);
      const retry = await transfer(alice, body, key).expect(201);

      expect(retry.headers['idempotent-replayed']).toBe('true');
      expect(retry.text).toBe(first.text);
      expect(await balanceOf(bob)).toBe(3_000);
      expect(await countTransfers()).toBe(1);
    });

    it('rejects the same key with a different payload (422)', async () => {
      const key = randomUUID();
      await transfer(
        alice,
        { recipientWalletId: bob.walletId, amount: 100 },
        key,
      ).expect(201);
      await transfer(
        alice,
        { recipientWalletId: bob.walletId, amount: 200 },
        key,
      ).expect(422);
      expect(await balanceOf(bob)).toBe(100);
    });

    it('does not let a key used for funding be replayed as a transfer', async () => {
      const key = randomUUID();
      await ctx
        .http()
        .post('/api/v1/wallets/fund')
        .set('Authorization', `Bearer ${alice.token}`)
        .set('Idempotency-Key', key)
        .send({ amount: 100 })
        .expect(201);
      await transfer(
        alice,
        { recipientWalletId: bob.walletId, amount: 100 },
        key,
      ).expect(422);
    });

    it('lets a transfer that failed for insufficient funds be retried with the same key', async () => {
      const key = randomUUID();
      const body = { recipientWalletId: bob.walletId, amount: 15_000 };
      await transfer(alice, body, key).expect(422);

      await fundWallet(ctx, alice, 5_000);
      const res = await transfer(alice, body, key).expect(201);
      expect(res.headers['idempotent-replayed']).toBeUndefined();
      expect(await balanceOf(bob)).toBe(15_000);
    });

    it('moves money once when the same transfer is fired 10 times concurrently', async () => {
      const key = randomUUID();
      const body = { recipientWalletId: bob.walletId, amount: 1_000 };
      const responses = await Promise.all(
        Array.from({ length: 10 }, () => transfer(alice, body, key)),
      );

      expect(responses.map((r) => r.status)).toEqual(Array(10).fill(201));
      expect(new Set(responses.map((r) => r.text)).size).toBe(1);
      expect(await balanceOf(alice)).toBe(9_000);
      expect(await balanceOf(bob)).toBe(1_000);
    });
  });

  describe('concurrency', () => {
    it('lets exactly the affordable transfers through when 50 race for one balance', async () => {
      // 10,000 kobo funds exactly 10 transfers of 1,000.
      const responses = await Promise.all(
        Array.from({ length: 50 }, () =>
          transfer(alice, { recipientWalletId: bob.walletId, amount: 1_000 }),
        ),
      );

      const statuses = responses.map((r) => r.status);
      expect(statuses.filter((s) => s === 201)).toHaveLength(10);
      expect(statuses.filter((s) => s === 422)).toHaveLength(40);
      expect(await balanceOf(alice)).toBe(0);
      expect(await balanceOf(bob)).toBe(10_000);
      expect(await countTransfers()).toBe(10);
    });

    it('handles simultaneous transfers in opposite directions without deadlock', async () => {
      await fundWallet(ctx, bob, 10_000);
      const responses = await Promise.all(
        Array.from({ length: 40 }, (_, i) =>
          i % 2 === 0
            ? transfer(alice, { recipientWalletId: bob.walletId, amount: 100 })
            : transfer(bob, { recipientWalletId: alice.walletId, amount: 100 }),
        ),
      );

      expect(responses.every((r) => r.status === 201)).toBe(true);
      expect(await balanceOf(alice)).toBe(10_000);
      expect(await balanceOf(bob)).toBe(10_000);
    });

    it('credits a shared recipient correctly when many senders pay it at once', async () => {
      const senders = await Promise.all(
        Array.from({ length: 8 }, () => registerUser(ctx)),
      );
      await Promise.all(senders.map((s) => fundWallet(ctx, s, 5_000)));

      const responses = await Promise.all(
        senders.flatMap((s) =>
          [1, 2, 3].map(() =>
            transfer(s, { recipientWalletId: bob.walletId, amount: 1_000 }),
          ),
        ),
      );

      expect(responses.every((r) => r.status === 201)).toBe(true);
      expect(await balanceOf(bob)).toBe(8 * 3 * 1_000);
    });
  });
});
