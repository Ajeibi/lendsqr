import { randomUUID } from 'crypto';
import {
  createTestApp,
  fundWallet,
  registerUser,
  resetDb,
  TestContext,
  TestUser,
} from './utils';

interface Line {
  reference: string;
  type: string;
  direction: string;
  amount: number;
  balanceAfter: number;
}

describe('Transaction history (e2e)', () => {
  let ctx: TestContext;
  let alice: TestUser;
  let bob: TestUser;
  let carol: TestUser;
  let transferRef: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(ctx.db);
    [alice, bob, carol] = await Promise.all([
      registerUser(ctx),
      registerUser(ctx),
      registerUser(ctx),
    ]);
    await fundWallet(ctx, alice, 10_000);
    const res = await ctx
      .http()
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        recipientWalletId: bob.walletId,
        amount: 3_000,
        narration: 'Rent',
      })
      .expect(201);
    transferRef = res.body.transaction.reference;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const get = (user: TestUser, path: string) =>
    ctx
      .http()
      .get(`/api/v1/transactions${path}`)
      .set('Authorization', `Bearer ${user.token}`);

  it("lists the caller's statement newest first with direction and running balance", async () => {
    const res = await get(alice, '').expect(200);
    const lines = res.body.data as Line[];

    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2 });
    expect(
      lines.map((l) => [l.type, l.direction, l.amount, l.balanceAfter]),
    ).toEqual([
      ['TRANSFER', 'DEBIT', 3_000, 7_000],
      ['FUNDING', 'CREDIT', 10_000, 10_000],
    ]);
  });

  it('orders the statement by when balances actually changed, even under concurrency', async () => {
    // Concurrent transfers queue on the wallet lock: one that *started* first
    // can be *applied* later, so ordering must follow the ledger, not start time.
    await Promise.all(
      Array.from({ length: 15 }, () =>
        ctx
          .http()
          .post('/api/v1/transfers')
          .set('Authorization', `Bearer ${alice.token}`)
          .set('Idempotency-Key', randomUUID())
          .send({ recipientWalletId: bob.walletId, amount: 100 })
          .expect(201),
      ),
    );

    const { balance } = await ctx
      .db('wallets')
      .where({ id: alice.walletId })
      .first('balance');
    const lines = (await get(alice, '?limit=100').expect(200)).body
      .data as Line[];

    expect(lines[0].balanceAfter).toBe(balance);
    // Walking back through the statement replays the balance exactly.
    for (let i = 0; i < lines.length - 1; i++) {
      const delta =
        lines[i].direction === 'DEBIT' ? -lines[i].amount : lines[i].amount;
      expect(lines[i].balanceAfter - delta).toBe(lines[i + 1].balanceAfter);
    }
  });

  it('shows the same transfer as a CREDIT on the recipient side', async () => {
    const res = await get(bob, '').expect(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        reference: transferRef,
        direction: 'CREDIT',
        amount: 3_000,
        balanceAfter: 3_000,
        narration: 'Rent',
        sourceWalletId: alice.walletId,
      }),
    ]);
  });

  it('shows nothing that does not involve the caller', async () => {
    const res = await get(carol, '').expect(200);
    expect(res.body).toEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0 },
    });
  });

  it('paginates', async () => {
    for (let i = 0; i < 4; i++) await fundWallet(ctx, alice, 100);

    const page = await get(alice, '?page=2&limit=2').expect(200);
    expect(page.body.meta).toEqual({ page: 2, limit: 2, total: 6 });
    expect(page.body.data).toHaveLength(2);
    await get(alice, '?limit=500').expect(400);
  });

  it('returns one transaction by reference to either party', async () => {
    const asSender = await get(alice, `/${transferRef}`).expect(200);
    const asRecipient = await get(bob, `/${transferRef}`).expect(200);
    expect(asSender.body.direction).toBe('DEBIT');
    expect(asRecipient.body.direction).toBe('CREDIT');
  });

  it("returns 404 for someone else's transaction, same as for a non-existent one", async () => {
    const other = await get(carol, `/${transferRef}`).expect(404);
    const missing = await get(carol, '/TRF-does-not-exist').expect(404);
    expect(other.body.message).toBe(missing.body.message);
  });

  it('requires authentication', async () => {
    await ctx.http().get('/api/v1/transactions').expect(401);
  });
});
