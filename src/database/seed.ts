import 'dotenv/config';
import * as argon2 from 'argon2';
import knex, { Knex } from 'knex';
import { buildKnexConfig, databaseOptionsFromEnv } from './knex.config';

interface SeedUser {
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role: 'USER' | 'ADMIN';
  openingBalance: number; // kobo
}

interface IdRow {
  id: string;
}

const ADMIN: SeedUser = {
  email: 'admin@demo.wallet',
  phoneNumber: '+2348000000000',
  firstName: 'Demo',
  lastName: 'Admin',
  role: 'ADMIN',
  openingBalance: 0,
};

const DEMO_USERS: SeedUser[] = [
  {
    email: 'ada@demo.wallet',
    phoneNumber: '+2348000000001',
    firstName: 'Ada',
    lastName: 'Obi',
    role: 'USER',
    openingBalance: 1_000_000, // NGN 10,000.00
  },
  {
    email: 'tunde@demo.wallet',
    phoneNumber: '+2348000000002',
    firstName: 'Tunde',
    lastName: 'Bello',
    role: 'USER',
    openingBalance: 500_000, // NGN 5,000.00
  },
];

/**
 * Idempotent demo seed: creates an admin and two funded users so reviewers
 * can exercise transfers straight away. Passwords come from the environment
 * (SEED_ADMIN_PASSWORD / SEED_DEMO_PASSWORD); without them, seeding is skipped.
 */
async function main(): Promise<void> {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const demoPassword = process.env.SEED_DEMO_PASSWORD;
  if (!adminPassword || !demoPassword) {
    console.log(
      'SEED_ADMIN_PASSWORD / SEED_DEMO_PASSWORD not set; skipping seed',
    );
    return;
  }

  const db = knex(buildKnexConfig(databaseOptionsFromEnv()));
  try {
    const adminId = await upsertUser(db, ADMIN, adminPassword, null);
    for (const user of DEMO_USERS) {
      await upsertUser(db, user, demoPassword, adminId);
    }
  } finally {
    await db.destroy();
  }
}

async function upsertUser(
  db: Knex,
  user: SeedUser,
  password: string,
  funderId: string | null,
): Promise<string> {
  return db.transaction(async (trx) => {
    const existing = await trx<{ id: string; email: string }>('users')
      .where({ email: user.email })
      .first('id');
    if (existing) {
      console.log(`exists  ${user.email}`);
      return existing.id;
    }

    const [{ id: userId }] = await trx('users')
      .insert({
        email: user.email,
        phone_number: user.phoneNumber,
        first_name: user.firstName,
        last_name: user.lastName,
        password_hash: await argon2.hash(password),
        role: user.role,
      })
      .returning<IdRow[]>('id');

    const [{ id: walletId }] = await trx('wallets')
      .insert({ user_id: userId, balance: user.openingBalance })
      .returning<IdRow[]>('id');

    // Opening balances go through the ledger like any other funding.
    if (user.openingBalance > 0 && funderId) {
      const [{ id: transactionId }] = await trx('transactions')
        .insert({
          reference: `SEED-${walletId}`,
          type: 'FUNDING',
          status: 'SUCCESS',
          amount: user.openingBalance,
          currency: 'NGN',
          destination_wallet_id: walletId,
          narration: 'Opening balance (seed)',
          initiated_by: funderId,
        })
        .returning<IdRow[]>('id');

      await trx('ledger_entries').insert({
        transaction_id: transactionId,
        wallet_id: walletId,
        direction: 'CREDIT',
        amount: user.openingBalance,
        balance_before: 0,
        balance_after: user.openingBalance,
      });
    }

    console.log(`created ${user.email}`);
    return userId;
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
