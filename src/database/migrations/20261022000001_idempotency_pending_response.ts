import { Knex } from 'knex';

/**
 * Two changes to idempotency_keys:
 *
 * 1. Response columns become nullable. A key is claimed (inserted) before the
 *    work runs and its response is stored once the work succeeds, all in one
 *    transaction, so the response is unknown at insert time. Other requests
 *    only ever see a committed row, which always has its response filled in.
 *
 * 2. response_body becomes `json` instead of `jsonb`. jsonb normalises key
 *    order; json keeps the text exactly as written, so a replayed response is
 *    byte-for-byte identical to the original.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('idempotency_keys', (t) => {
    t.integer('response_status').nullable().alter();
    t.json('response_body').nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex('idempotency_keys')
    .whereNull('response_status')
    .orWhereNull('response_body')
    .del();
  await knex.schema.alterTable('idempotency_keys', (t) => {
    t.integer('response_status').notNullable().alter();
    t.jsonb('response_body').notNullable().alter();
  });
}
