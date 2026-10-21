import { execFileSync } from 'child_process';
import * as path from 'path';
import { TEST_DATABASE_URL } from './test-env';

/** Brings the test database to the latest schema using the compiled migrator. */
export default function globalSetup(): void {
  execFileSync(
    process.execPath,
    [path.join(__dirname, '..', 'dist', 'database', 'migrate.js'), 'latest'],
    {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'inherit',
    },
  );
}
