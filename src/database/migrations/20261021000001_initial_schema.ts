import { Knex } from 'knex';

/**
 * Initial schema.
 *
 * - Money is BIGINT minor units (kobo); never floats.
 * - CHECK constraints are the last line of defence: even buggy app code
 *   cannot drive a balance negative or record a non-positive amount.
 * - Every balance change is mirrored by ledger entries (double entry), so
 *   wallets.balance can always be reconciled against the ledger.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('email', 255).notNullable().unique(); // stored lower-cased
    t.string('phone_number', 20).notNullable().unique(); // stored E.164-ish
    t.string('first_name', 100).notNullable();
    t.string('last_name', 100).notNullable();
    t.string('password_hash', 255).notNullable();
    t.string('role', 16)
      .notNullable()
      .defaultTo('USER')
      .checkIn(['USER', 'ADMIN'], 'users_role_check');
    t.string('status', 16)
      .notNullable()
      .defaultTo('ACTIVE')
      .checkIn(['ACTIVE', 'BLOCKED'], 'users_status_check');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('wallets', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('user_id')
      .notNullable()
      .unique()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    t.string('currency', 3).notNullable().defaultTo('NGN');
    t.bigInteger('balance').notNullable().defaultTo(0);
    t.timestamps(true, true);
    t.check('?? >= 0', ['balance'], 'wallets_balance_non_negative');
  });

  await knex.schema.createTable('transactions', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('reference', 64).notNullable().unique();
    t.string('type', 16)
      .notNullable()
      .checkIn(['FUNDING', 'TRANSFER'], 'transactions_type_check');
    t.string('status', 16)
      .notNullable()
      .checkIn(['SUCCESS', 'FAILED'], 'transactions_status_check');
    t.bigInteger('amount').notNullable();
    t.string('currency', 3).notNullable();
    // Null for FUNDING: money enters the system from outside.
    t.uuid('source_wallet_id').nullable().references('id').inTable('wallets');
    t.uuid('destination_wallet_id')
      .notNullable()
      .references('id')
      .inTable('wallets');
    t.string('narration', 255).nullable();
    t.uuid('initiated_by').notNullable().references('id').inTable('users');
    t.timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    t.check('?? > 0', ['amount'], 'transactions_amount_positive');
    t.check(
      '?? IS NULL OR ?? <> ??',
      ['source_wallet_id', 'source_wallet_id', 'destination_wallet_id'],
      'transactions_no_self_transfer',
    );
    t.index(['source_wallet_id', 'created_at']);
    t.index(['destination_wallet_id', 'created_at']);
  });

  await knex.schema.createTable('ledger_entries', (t) => {
    t.bigIncrements('id').primary();
    t.uuid('transaction_id')
      .notNullable()
      .references('id')
      .inTable('transactions');
    t.uuid('wallet_id').notNullable().references('id').inTable('wallets');
    t.string('direction', 6)
      .notNullable()
      .checkIn(['DEBIT', 'CREDIT'], 'ledger_entries_direction_check');
    t.bigInteger('amount').notNullable();
    t.bigInteger('balance_before').notNullable();
    t.bigInteger('balance_after').notNullable();
    t.timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    t.check('?? > 0', ['amount'], 'ledger_entries_amount_positive');
    t.check(
      '?? >= 0',
      ['balance_after'],
      'ledger_entries_balance_non_negative',
    );
    t.index(['wallet_id', 'created_at']);
    t.index(['transaction_id']);
  });

  // Replay / duplicate protection. Keys are scoped per user, and the request
  // hash catches a key being reused for a different payload.
  await knex.schema.createTable('idempotency_keys', (t) => {
    t.uuid('user_id').notNullable().references('id').inTable('users');
    t.string('key', 255).notNullable();
    t.string('request_method', 8).notNullable();
    t.string('request_path', 255).notNullable();
    t.string('request_hash', 64).notNullable();
    t.integer('response_status').notNullable();
    t.jsonb('response_body').notNullable();
    t.timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.timestamp('expires_at', { useTz: true }).notNullable();

    t.primary(['user_id', 'key']);
    t.index(['expires_at']);
  });

  await knex.schema.createTable('blacklist', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('identity_type', 16)
      .notNullable()
      .checkIn(['EMAIL', 'PHONE', 'BVN'], 'blacklist_identity_type_check');
    t.string('identity', 255).notNullable(); // normalised before insert
    t.string('reason', 255).nullable();
    t.uuid('created_by').nullable().references('id').inTable('users');
    t.timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    t.unique(['identity_type', 'identity']);
  });

  // Audit trail for block / unblock actions.
  await knex.schema.createTable('account_status_events', (t) => {
    t.bigIncrements('id').primary();
    t.uuid('user_id').notNullable().references('id').inTable('users');
    t.string('action', 16)
      .notNullable()
      .checkIn(['BLOCK', 'UNBLOCK'], 'account_status_events_action_check');
    t.string('reason', 255).notNullable();
    t.uuid('actor_id').notNullable().references('id').inTable('users');
    t.timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    t.index(['user_id', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('account_status_events');
  await knex.schema.dropTableIfExists('blacklist');
  await knex.schema.dropTableIfExists('idempotency_keys');
  await knex.schema.dropTableIfExists('ledger_entries');
  await knex.schema.dropTableIfExists('transactions');
  await knex.schema.dropTableIfExists('wallets');
  await knex.schema.dropTableIfExists('users');
}
