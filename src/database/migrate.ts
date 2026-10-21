import 'dotenv/config';
import knex from 'knex';
import { buildKnexConfig, databaseOptionsFromEnv } from './knex.config';

/**
 * Programmatic migration runner, so the same entry point works locally
 * (ts-node against src/) and on Render (node against dist/).
 *
 *   migrate.ts latest | rollback | status
 */
async function main(): Promise<void> {
  const command = process.argv[2] ?? 'latest';
  const db = knex(buildKnexConfig(databaseOptionsFromEnv()));

  try {
    switch (command) {
      case 'latest': {
        const [batch, applied] = (await db.migrate.latest()) as [
          number,
          string[],
        ];
        console.log(
          applied.length
            ? `Batch ${batch}: applied ${applied.join(', ')}`
            : 'Already up to date',
        );
        break;
      }
      case 'rollback': {
        const [batch, reverted] = (await db.migrate.rollback()) as [
          number,
          string[],
        ];
        console.log(
          reverted.length
            ? `Batch ${batch}: rolled back ${reverted.join(', ')}`
            : 'Nothing to roll back',
        );
        break;
      }
      case 'status': {
        const [done, pending] = (await db.migrate.list()) as [
          { name: string }[],
          { file: string }[],
        ];
        console.log(`Applied: ${done.map((m) => m.name).join(', ') || '-'}`);
        console.log(`Pending: ${pending.map((m) => m.file).join(', ') || '-'}`);
        break;
      }
      default:
        throw new Error(`Unknown migrate command "${command}"`);
    }
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
