#!/usr/bin/env node
/**
 * Applies every .sql file in db/migrations in filename order.
 * Tracks what has run in the schema_migrations table, so re-running is safe.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

const DIR = path.join(__dirname, '..', 'db', 'migrations');

async function main() {
  await pool.query(`
    create table if not exists schema_migrations (
      filename   text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const { rows } = await pool.query('select filename from schema_migrations');
  const applied = new Set(rows.map((r) => r.filename));

  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  let ran = 0;

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  skip  ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('insert into schema_migrations (filename) values ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  ok    ${file}`);
      ran++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  FAIL  ${file}\n        ${err.message}`);
      process.exitCode = 1;
      return;
    } finally {
      client.release();
    }
  }

  console.log(ran ? `\n${ran} migration(s) applied.` : '\nAlready up to date.');
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
