/**
 * E2E tests run against a dedicated database (created by docker/init-test-db.sql).
 * Real env vars win over .env, so setting them here keeps tests off dev data.
 */
export const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  'postgres://wallet:wallet@localhost:5432/wallet_test';

export function applyTestEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.DATABASE_SSL = 'false';
  process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
  process.env.ADJUTOR_API_KEY = '';
  process.env.THROTTLE_LIMIT = '10000';
}
