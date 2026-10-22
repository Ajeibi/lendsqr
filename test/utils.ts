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
  // Listen once on a random port so concurrent supertest calls share one
  // server instead of each binding its own.
  await app.listen(0, '127.0.0.1');

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

export interface TestUser {
  id: string;
  walletId: string;
  token: string;
  email: string;
  password: string;
}

/** Registers a fresh user through the API and returns their token and wallet. */
export async function registerUser(
  ctx: TestContext,
  overrides: Record<string, unknown> = {},
): Promise<TestUser> {
  const payload = newUser(overrides);
  const res = await ctx.http().post('/api/v1/auth/register').send(payload);
  if (res.status !== 201) {
    throw new Error(
      `register failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return {
    id: res.body.user.id,
    walletId: res.body.wallet.id,
    token: res.body.auth.accessToken,
    email: payload.email,
    password: payload.password,
  };
}

/**
 * Checks the ledger invariants for every wallet:
 * - balance equals credits minus debits;
 * - each entry's balance_after = balance_before ± amount;
 * - entries chain: each balance_before equals the previous balance_after.
 */
export async function expectLedgerConsistent(db: Knex): Promise<void> {
  const mismatches = await db.raw<{ rows: unknown[] }>(`
    SELECT w.id, w.balance,
           COALESCE(SUM(CASE l.direction WHEN 'CREDIT' THEN l.amount ELSE -l.amount END), 0) AS ledger
      FROM wallets w
      LEFT JOIN ledger_entries l ON l.wallet_id = w.id
     GROUP BY w.id
    HAVING w.balance <> COALESCE(SUM(CASE l.direction WHEN 'CREDIT' THEN l.amount ELSE -l.amount END), 0)
  `);
  expect(mismatches.rows).toEqual([]);

  const badArithmetic = await db.raw<{ rows: unknown[] }>(`
    SELECT id FROM ledger_entries
     WHERE balance_after <> balance_before
           + CASE direction WHEN 'CREDIT' THEN amount ELSE -amount END
  `);
  expect(badArithmetic.rows).toEqual([]);

  const brokenChain = await db.raw<{ rows: unknown[] }>(`
    SELECT id FROM (
      SELECT id, balance_before,
             LAG(balance_after) OVER (PARTITION BY wallet_id ORDER BY id) AS prev_after
        FROM ledger_entries
    ) e
     WHERE prev_after IS NOT NULL AND balance_before <> prev_after
  `);
  expect(brokenChain.rows).toEqual([]);
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
