import * as path from 'path';
import { Knex } from 'knex';
import { types } from 'pg';

const PG_INT8_OID = 20;

/**
 * Postgres BIGINT (int8) arrives as a string by default. Money is stored as
 * BIGINT minor units, and every amount is capped well below 2^53, so it's safe
 * to hand the app plain numbers — but refuse loudly rather than lose precision.
 */
types.setTypeParser(PG_INT8_OID, (value: string) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new RangeError(`int8 value ${value} exceeds Number.MAX_SAFE_INTEGER`);
  }
  return parsed;
});

export interface DatabaseOptions {
  url: string;
  ssl: boolean;
  poolMax?: number;
}

export function buildKnexConfig(options: DatabaseOptions): Knex.Config {
  return {
    client: 'pg',
    connection: {
      connectionString: options.url,
      ssl: options.ssl ? { rejectUnauthorized: false } : false,
    },
    pool: { min: 0, max: options.poolMax ?? 10 },
    migrations: {
      directory: path.join(__dirname, 'migrations'),
      tableName: 'knex_migrations',
      // Runs the .ts sources under ts-node and the compiled .js in dist/.
      loadExtensions: [path.extname(__filename)],
    },
  };
}

export function databaseOptionsFromEnv(): DatabaseOptions {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return {
    url,
    ssl: process.env.DATABASE_SSL === 'true',
    poolMax: Number(process.env.DATABASE_POOL_MAX ?? 10),
  };
}
