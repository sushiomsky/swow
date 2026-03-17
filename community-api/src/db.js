import pkg from 'pg';
import { config } from './config.js';

const { Pool } = pkg;
export const db = new Pool({ connectionString: config.pgUrl });

export async function runStartupMigrations() {
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'`);
}

export async function healthcheckDb() {
  const { rows } = await db.query('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}
