// One-shot DB bootstrap: loads database/schema.sql and (optionally) seed.sql
// into whatever MySQL the server is currently configured to talk to.
//
// Usage:
//   # against your local docker MySQL (already auto-inits, so this is mostly for Railway):
//   node scripts/init-db.js
//
//   # without seed data (production):
//   SKIP_SEED=1 node scripts/init-db.js
//
// Honors the same env vars as src/db.js (MYSQL_URL / DATABASE_URL, or DB_*,
// or MYSQL*). Safe to run multiple times — schema.sql uses CREATE TABLE IF
// NOT EXISTS where appropriate.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const schemaPath = path.join(repoRoot, 'database', 'schema.sql');
const seedPath = path.join(repoRoot, 'database', 'seed.sql');

function buildConfig() {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (url) return { uri: url, multipleStatements: true };
  return {
    host: process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT) || 3306,
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'hmis',
    multipleStatements: true,
  };
}

async function runFile(conn, file, label) {
  if (!fs.existsSync(file)) {
    console.warn(`[init-db] ${label} not found at ${file} — skipping.`);
    return;
  }
  const sql = fs.readFileSync(file, 'utf8');
  console.log(`[init-db] Applying ${label} (${sql.length} bytes)...`);
  await conn.query(sql);
  console.log(`[init-db] ${label} applied.`);
}

async function main() {
  const conn = await mysql.createConnection(buildConfig());
  try {
    await runFile(conn, schemaPath, 'schema.sql');
    if (process.env.SKIP_SEED) {
      console.log('[init-db] SKIP_SEED set — not loading seed.sql.');
    } else {
      await runFile(conn, seedPath, 'seed.sql');
    }
    console.log('[init-db] Done.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[init-db] Failed:', err);
  process.exit(1);
});
