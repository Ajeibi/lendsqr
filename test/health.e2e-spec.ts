import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Knex } from 'knex';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { KNEX } from '../src/database/database.module';

describe('Health & schema (e2e)', () => {
  let app: INestApplication<App>;
  let db: Knex;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const nestApp = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(nestApp);
    await nestApp.init();
    app = nestApp;
    db = moduleRef.get<Knex>(KNEX);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health reports the database as up', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('returns the shared error shape for unknown routes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/does-not-exist')
      .expect(404);
    expect(res.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      requestId: expect.any(String),
    });
  });

  it('database refuses a negative wallet balance', async () => {
    const trx = await db.transaction();
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
