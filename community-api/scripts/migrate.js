import { db } from '../src/db.js';
import { migrateDown, migrateUp } from '../src/migrations.js';

function parseDownSteps(raw) {
  if (raw === undefined) return 1;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('Down migration requires a positive integer step count');
  }
  return parsed;
}

async function main() {
  const command = process.argv[2] || 'up';

  if (command === 'up') {
    const applied = await migrateUp(db);
    console.log(
      applied.length
        ? `Applied migrations: ${applied.join(', ')}`
        : 'No pending migrations.'
    );
    return;
  }

  if (command === 'down') {
    const steps = parseDownSteps(process.argv[3]);
    const reverted = await migrateDown(db, steps);
    console.log(
      reverted.length
        ? `Reverted migrations: ${reverted.join(', ')}`
        : 'No applied migrations to revert.'
    );
    return;
  }

  throw new Error(`Unsupported migration command: ${command}`);
}

try {
  await main();
} catch (error) {
  console.error('[migrate]', error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
