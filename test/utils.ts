import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Knex } from 'knex';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { KNEX } from '../src/database/database.module';

export interface TestContext {
  app: INestApplication<App>;
  db: Knex;
  http: () => ReturnType<typeof request>;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();

  return {
    app,
    db: moduleRef.get<Knex>(KNEX),
    http: () => request(app.getHttpServer()),
  };
}

/** Wipes all data tables (not the migration bookkeeping) between tests. */
export async function resetDb(db: Knex): Promise<void> {
  await db.raw(`
    TRUNCATE users, wallets, transactions, ledger_entries, idempotency_keys,
             blacklist, account_status_events
    RESTART IDENTITY CASCADE
  `);
}

let counter = 0;

/** A valid, unique registration payload. */
export function newUser(overrides: Record<string, unknown> = {}) {
  counter += 1;
  const suffix = String(counter).padStart(4, '0');
  return {
    email: `user${suffix}@test.local`,
    phoneNumber: `0803000${suffix}`,
    firstName: 'Test',
    lastName: `User${suffix}`,
    password: 'Passw0rd!',
    ...overrides,
  };
}
