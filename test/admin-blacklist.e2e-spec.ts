import { randomUUID } from 'crypto';
import {
  createTestApp,
  newUser,
  registerUser,
  resetDb,
  TestContext,
  TestUser,
} from './utils';

describe('Admin blacklist (e2e)', () => {
  let ctx: TestContext;
  let admin: TestUser;
  let user: TestUser;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(ctx.db);
    admin = await registerUser(ctx);
    await ctx.db('users').where({ id: admin.id }).update({ role: 'ADMIN' });
    user = await registerUser(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const as = (token: string) => ({
    add: (body: Record<string, unknown>) =>
      ctx
        .http()
        .post('/api/v1/admin/blacklist')
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    list: (query = '') =>
      ctx
        .http()
        .get(`/api/v1/admin/blacklist${query}`)
        .set('Authorization', `Bearer ${token}`),
    remove: (id: string) =>
      ctx
        .http()
        .delete(`/api/v1/admin/blacklist/${id}`)
        .set('Authorization', `Bearer ${token}`),
  });
  const register = (body: Record<string, unknown>) =>
    ctx.http().post('/api/v1/auth/register').send(body);

  describe('access control', () => {
    it('forbids regular users from every admin route (403)', async () => {
      const api = as(user.token);
      await api
        .add({ identityType: 'EMAIL', identity: 'x@y.com', reason: 'r' })
        .expect(403);
      await api.list().expect(403);
      await api.remove(randomUUID()).expect(403);
    });

    it('requires authentication (401)', async () => {
      await ctx.http().get('/api/v1/admin/blacklist').expect(401);
    });
  });

  describe('POST /admin/blacklist', () => {
    it('stores a normalised entry with the acting admin for audit', async () => {
      const res = await as(admin.token)
        .add({
          identityType: 'EMAIL',
          identity: '  Fraud.Ster@Example.COM ',
          reason: 'Card fraud',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        identityType: 'EMAIL',
        identity: 'fraud.ster@example.com',
        reason: 'Card fraud',
        createdBy: admin.id,
      });
    });

    it('blocks onboarding for a blacklisted email in any letter case', async () => {
      await as(admin.token)
        .add({ identityType: 'EMAIL', identity: 'bad@actor.com', reason: 'r' })
        .expect(201);

      const res = await register(newUser({ email: 'BAD@Actor.com' })).expect(
        403,
      );
      expect(res.body.message).toMatch(/blacklisted/);
    });

    it('blocks onboarding for a blacklisted phone in any format', async () => {
      await as(admin.token)
        .add({ identityType: 'PHONE', identity: '0809 111 2222', reason: 'r' })
        .expect(201);

      await register(newUser({ phoneNumber: '+2348091112222' })).expect(403);
    });

    it('rejects a duplicate entry, even in another format (409)', async () => {
      await as(admin.token)
        .add({ identityType: 'PHONE', identity: '08091112222', reason: 'r' })
        .expect(201);
      const res = await as(admin.token)
        .add({ identityType: 'PHONE', identity: '+2348091112222', reason: 'r' })
        .expect(409);
      expect(res.body.message).toBe('Identity is already blacklisted');
    });

    it.each([
      ['an invalid email', { identityType: 'EMAIL', identity: 'nope' }],
      ['an invalid phone', { identityType: 'PHONE', identity: '12345' }],
      ['a 10-digit BVN', { identityType: 'BVN', identity: '1234567890' }],
      ['an unknown type', { identityType: 'NIN', identity: '12345678901' }],
    ])('rejects %s (400)', async (_label, body) => {
      await as(admin.token)
        .add({ ...body, reason: 'r' })
        .expect(400);
    });

    it('requires a reason (400)', async () => {
      await as(admin.token)
        .add({ identityType: 'BVN', identity: '22212345678', reason: '  ' })
        .expect(400);
    });
  });

  describe('GET /admin/blacklist', () => {
    it('lists entries newest first with pagination metadata', async () => {
      for (const n of [1, 2, 3]) {
        await as(admin.token)
          .add({ identityType: 'EMAIL', identity: `b${n}@x.com`, reason: 'r' })
          .expect(201);
      }

      const identities = (body: { data: { identity: string }[] }) =>
        body.data.map((e) => e.identity);

      const page1 = await as(admin.token).list('?page=1&limit=2').expect(200);
      expect(page1.body.meta).toEqual({ page: 1, limit: 2, total: 3 });
      expect(identities(page1.body)).toEqual(['b3@x.com', 'b2@x.com']);

      const page2 = await as(admin.token).list('?page=2&limit=2').expect(200);
      expect(identities(page2.body)).toEqual(['b1@x.com']);
    });

    it.each(['?limit=0', '?limit=101', '?page=0', '?page=abc'])(
      'rejects invalid pagination %s (400)',
      async (query) => {
        await as(admin.token).list(query).expect(400);
      },
    );
  });

  describe('DELETE /admin/blacklist/:id', () => {
    it('removes an entry so the identity can sign up again', async () => {
      const { body: entry } = await as(admin.token)
        .add({
          identityType: 'EMAIL',
          identity: 'second@chance.com',
          reason: 'r',
        })
        .expect(201);
      await register(newUser({ email: 'second@chance.com' })).expect(403);

      await as(admin.token).remove(entry.id).expect(204);
      await register(newUser({ email: 'second@chance.com' })).expect(201);
    });

    it('returns 404 for an unknown entry and 400 for a malformed id', async () => {
      await as(admin.token).remove(randomUUID()).expect(404);
      await as(admin.token).remove('not-a-uuid').expect(400);
    });
  });
});
