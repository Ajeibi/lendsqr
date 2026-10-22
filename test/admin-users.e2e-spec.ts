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

describe('Admin block/unblock (e2e)', () => {
  let ctx: TestContext;
  let admin: TestUser;
  let user: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(ctx.db);
    [admin, user, other] = await Promise.all([
      registerUser(ctx),
      registerUser(ctx),
      registerUser(ctx),
    ]);
    await ctx.db('users').where({ id: admin.id }).update({ role: 'ADMIN' });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const block = (
    id: string,
    reason = 'Suspicious activity',
    token = admin.token,
  ) =>
    ctx
      .http()
      .patch(`/api/v1/admin/users/${id}/block`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason });
  const unblock = (id: string, reason = 'Verified by support') =>
    ctx
      .http()
      .patch(`/api/v1/admin/users/${id}/unblock`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason });
  const transfer = (from: TestUser, to: TestUser, amount: number) =>
    ctx
      .http()
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${from.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ recipientWalletId: to.walletId, amount });
  const login = (u: TestUser) =>
    ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ email: u.email, password: u.password });

  describe('blocking', () => {
    it('blocks the account and records who did it and why', async () => {
      const res = await block(user.id).expect(200);
      expect(res.body).toMatchObject({ id: user.id, status: 'BLOCKED' });

      const detail = await ctx
        .http()
        .get(`/api/v1/admin/users/${user.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(detail.body.user.status).toBe('BLOCKED');
      expect(detail.body.wallet.id).toBe(user.walletId);
      expect(detail.body.statusHistory).toEqual([
        expect.objectContaining({
          action: 'BLOCK',
          reason: 'Suspicious activity',
          actorId: admin.id,
        }),
      ]);
    });

    it('cuts the user off everywhere: login, existing token, sending and receiving', async () => {
      await fundWallet(ctx, user, 5_000);
      await fundWallet(ctx, other, 5_000);
      await block(user.id).expect(200);

      await login(user).expect(403);
      await ctx
        .http()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(403);
      await transfer(user, other, 100).expect(403);
      await transfer(other, user, 100).expect(422);
    });

    it('rejects blocking an already-blocked user (409) without a second audit entry', async () => {
      await block(user.id).expect(200);
      const res = await block(user.id).expect(409);
      expect(res.body.message).toBe('User is already blocked');
      const events = await ctx
        .db('account_status_events')
        .where({ user_id: user.id });
      expect(events).toHaveLength(1);
    });

    it('stops an admin from blocking themselves', async () => {
      await block(admin.id).expect(400);
    });

    it('requires a reason', async () => {
      await block(user.id, '   ').expect(400);
    });

    it('returns 404 for an unknown user and 400 for a malformed id', async () => {
      await block(randomUUID()).expect(404);
      await block('nope').expect(400);
    });

    it('is admin-only', async () => {
      await block(other.id, 'r', user.token).expect(403);
    });
  });

  describe('unblocking', () => {
    it('restores access and appends to the history', async () => {
      await fundWallet(ctx, other, 1_000);
      await block(user.id).expect(200);
      const res = await unblock(user.id).expect(200);
      expect(res.body.status).toBe('ACTIVE');

      await login(user).expect(200);
      await transfer(other, user, 100).expect(201);

      const actions = await ctx
        .db('account_status_events')
        .where({ user_id: user.id })
        .orderBy('id')
        .pluck('action');
      expect(actions).toEqual(['BLOCK', 'UNBLOCK']);
    });

    it('rejects unblocking an active user (409)', async () => {
      const res = await unblock(user.id).expect(409);
      expect(res.body.message).toBe('User is already active');
    });
  });

  describe('listing', () => {
    it('lists users newest first and filters by email', async () => {
      const all = await ctx
        .http()
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(all.body.meta.total).toBe(3);
      expect(JSON.stringify(all.body)).not.toMatch(/password/i);

      const one = await ctx
        .http()
        .get(
          `/api/v1/admin/users?email=${encodeURIComponent(user.email.toUpperCase())}`,
        )
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(one.body.data).toEqual([expect.objectContaining({ id: user.id })]);
    });
  });

  describe('racing a block against in-flight transfers', () => {
    it('stays consistent, with no deadlocks or errors', async () => {
      await fundWallet(ctx, user, 20_000);

      const transfers = Array.from({ length: 20 }, () =>
        transfer(user, other, 500),
      );
      const [blockRes, ...results] = await Promise.all([
        block(user.id),
        ...transfers,
      ]);

      expect(blockRes.status).toBe(200);
      // Each transfer either completed before the block or was refused after it.
      expect(results.every((r) => r.status === 201 || r.status === 403)).toBe(
        true,
      );

      // Once the block has committed, nothing more gets through.
      await transfer(user, other, 500).expect(403);

      await expectLedgerConsistent(ctx.db);
      await expectMoneyConserved(ctx.db);
    });
  });
});
