import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_TABLE = 'schema_migrations';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

function parseMigrationFileName(fileName, direction) {
  const suffix = `.${direction}.sql`;
  if (!fileName.endsWith(suffix)) return null;
  return {
    version: fileName.slice(0, -suffix.length),
    fileName
  };
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function listMigrations(direction) {
  const files = await fs.readdir(MIGRATIONS_DIR);
  const migrations = files
    .map((fileName) => parseMigrationFileName(fileName, direction))
    .filter(Boolean)
    .sort((a, b) => a.version.localeCompare(b.version));
  return migrations;
}

async function readMigrationSql(fileName) {
  const fullPath = path.join(MIGRATIONS_DIR, fileName);
  return fs.readFile(fullPath, 'utf8');
}

async function listAppliedVersions(client) {
  const { rows } = await client.query(
    `SELECT version FROM ${MIGRATIONS_TABLE} ORDER BY version ASC`
  );
  return rows.map((row) => row.version);
}

export async function migrateUp(pool) {
  const client = await pool.connect();
  const appliedVersions = [];
  let inTransaction = false;
  try {
    await ensureMigrationsTable(client);
    const alreadyApplied = new Set(await listAppliedVersions(client));
    const migrations = await listMigrations('up');

    for (const migration of migrations) {
      if (alreadyApplied.has(migration.version)) continue;
      const sql = await readMigrationSql(migration.fileName);
      await client.query('BEGIN');
      inTransaction = true;
      await client.query(sql);
      await client.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (version) VALUES ($1)`,
        [migration.version]
      );
      await client.query('COMMIT');
      inTransaction = false;
      appliedVersions.push(migration.version);
    }

    return appliedVersions;
  } catch (error) {
    if (inTransaction) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function migrateDown(pool, steps = 1) {
  if (!Number.isInteger(steps) || steps < 1) {
    throw new Error('migrateDown steps must be a positive integer');
  }

  const client = await pool.connect();
  const revertedVersions = [];
  let inTransaction = false;
  try {
    await ensureMigrationsTable(client);
    const applied = await listAppliedVersions(client);
    const targets = applied.slice(-steps).reverse();
    if (targets.length === 0) return revertedVersions;

    const downMigrations = await listMigrations('down');
    const downByVersion = new Map(
      downMigrations.map((migration) => [migration.version, migration.fileName])
    );

    for (const version of targets) {
      const downFile = downByVersion.get(version);
      if (!downFile) {
        throw new Error(`Missing down migration file for version ${version}`);
      }
      const sql = await readMigrationSql(downFile);
      await client.query('BEGIN');
      inTransaction = true;
      await client.query(sql);
      await client.query(
        `DELETE FROM ${MIGRATIONS_TABLE} WHERE version = $1`,
        [version]
      );
      await client.query('COMMIT');
      inTransaction = false;
      revertedVersions.push(version);
    }

    return revertedVersions;
  } catch (error) {
    if (inTransaction) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}
