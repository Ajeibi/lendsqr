import { createTestApp, newUser, resetDb, TestContext } from './utils';

describe('Auth & onboarding (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(ctx.db);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const register = (body: Record<string, unknown>) =>
    ctx.http().post('/api/v1/auth/register').send(body);
  const login = (email: string, password: string) =>
    ctx.http().post('/api/v1/auth/login').send({ email, password });

  describe('POST /auth/register', () => {
    it('creates the user and an empty NGN wallet, and returns a token', async () => {
      const payload = newUser({ email: '  New.User@Test.Local ' });
      const res = await register(payload).expect(201);

      expect(res.body.user).toMatchObject({
        email: 'new.user@test.local',
        phoneNumber: `+234${payload.phoneNumber.slice(1)}`,
        role: 'USER',
        status: 'ACTIVE',
      });
      expect(res.body.wallet).toMatchObject({ currency: 'NGN', balance: 0 });
      expect(res.body.auth).toMatchObject({
        tokenType: 'Bearer',
        accessToken: expect.any(String),
      });
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);

      const wallets = await ctx.db('wallets').where({
        user_id: res.body.user.id,
      });
      expect(wallets).toHaveLength(1);
    });

    it('rejects a duplicate email with 409', async () => {
      const first = newUser();
      await register(first).expect(201);
      const res = await register(newUser({ email: first.email })).expect(409);
      expect(res.body.message).toBe('Email is already registered');
    });

    it('rejects a duplicate phone number in another format with 409', async () => {
      const first = newUser();
      await register(first).expect(201);
      const res = await register(
        newUser({ phoneNumber: `+234${first.phoneNumber.slice(1)}` }),
      ).expect(409);
      expect(res.body.message).toBe('Phone number is already registered');
    });

    it('lets exactly one of two simultaneous identical sign-ups through', async () => {
      const payload = newUser();
      const results = await Promise.all([register(payload), register(payload)]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await ctx.db('users').count({ n: '*' })).toEqual([{ n: 1 }]);
    });

    it('refuses an identity on the local blacklist with 403 and creates nothing', async () => {
      const payload = newUser();
      await ctx.db('blacklist').insert({
        identity_type: 'EMAIL',
        identity: payload.email,
        reason: 'fraud',
      });

      const res = await register(payload).expect(403);
      expect(res.body.message).toMatch(/blacklisted/);
      expect(await ctx.db('users').count({ n: '*' })).toEqual([{ n: 0 }]);
    });

    it('matches blacklisted phone numbers regardless of input format', async () => {
      const payload = newUser();
      await ctx.db('blacklist').insert({
        identity_type: 'PHONE',
        identity: `+234${payload.phoneNumber.slice(1)}`,
      });
      await register(payload).expect(403);
    });

    it.each([
      ['an invalid email', { email: 'not-an-email' }],
      ['a non-Nigerian phone', { phoneNumber: '+14155552671' }],
      ['a weak password', { password: 'password' }],
      ['an empty first name', { firstName: '   ' }],
      ['an unknown field', { role: 'ADMIN' }],
    ])('rejects %s with 400', async (_label, override) => {
      const res = await register(newUser(override)).expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
    });
  });

  describe('POST /auth/login', () => {
    it('returns a token for valid credentials (email is case-insensitive)', async () => {
      const payload = newUser();
      await register(payload).expect(201);

      const res = await login(payload.email.toUpperCase(), payload.password);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        tokenType: 'Bearer',
        accessToken: expect.any(String),
      });
    });

    it('gives the same 401 for a wrong password and an unknown email', async () => {
      const payload = newUser();
      await register(payload).expect(201);

      const wrongPassword = await login(payload.email, 'Wr0ngPassword');
      const unknownEmail = await login('nobody@test.local', payload.password);

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    });

    it('refuses a blocked user with 403', async () => {
      const payload = newUser();
      await register(payload).expect(201);
      await ctx
        .db('users')
        .where({ email: payload.email })
        .update({ status: 'BLOCKED' });

      const res = await login(payload.email, payload.password).expect(403);
      expect(res.body.message).toBe('Account is blocked');
    });
  });

  describe('GET /users/me', () => {
    it('returns the profile and wallet for the token holder', async () => {
      const payload = newUser();
      const { body } = await register(payload).expect(201);

      const res = await ctx
        .http()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${body.auth.accessToken}`)
        .expect(200);

      expect(res.body.user.id).toBe(body.user.id);
      expect(res.body.wallet).toEqual(body.wallet);
    });

    it('requires a token', async () => {
      await ctx.http().get('/api/v1/users/me').expect(401);
    });

    it('rejects a tampered token', async () => {
      const { body } = await register(newUser()).expect(201);
      await ctx
        .http()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${body.auth.accessToken}x`)
        .expect(401);
    });

    it('stops honouring an existing token once the user is blocked', async () => {
      const { body } = await register(newUser()).expect(201);
      await ctx
        .db('users')
        .where({ id: body.user.id })
        .update({ status: 'BLOCKED' });

      await ctx
        .http()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${body.auth.accessToken}`)
        .expect(403);
    });
  });
});
