#!/usr/bin/env node
/**
 * Creates or resets a dashboard account. Every other account is managed from
 * Settings > Users; this exists to create the first one, and to rescue you if
 * you ever forget the password.
 *
 *   npm run seed:user                       -> admin / admin123
 *   npm run seed:user -- priya Sup3rSecret  -> priya / Sup3rSecret
 *   npm run seed:user -- priya Sup3rSecret "Priya Raman"
 *
 * Re-running for an existing username resets that password and reactivates
 * the account.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { pool } = require('../db');
const { hashPassword, MIN_PASSWORD_LENGTH } = require('../auth');

async function main() {
  const [username = 'admin', password = 'admin123', name] = process.argv.slice(2);

  if (String(password).length < MIN_PASSWORD_LENGTH) {
    console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exitCode = 1;
    return;
  }

  const hash = await hashPassword(password);

  // Match on lower(username), not username. Logins are case-insensitive and
  // the uniqueness index is on lower(username), so `on conflict (username)`
  // would miss a case variant and then fail the index instead of resetting the
  // password — breaking the documented recovery path for e.g. "Admin".
  const { rows } = await pool.query(
    `insert into users (username, name, password_hash)
     values ($1, $2, $3)
     on conflict (lower(username)) do update
       set password_hash       = excluded.password_hash,
           name                = coalesce($2, users.name),
           active              = true,
           password_changed_at = now()
     returning id, username, name, (xmax = 0) as created`,
    [username, name || username, hash]
  );

  const u = rows[0];
  console.log(`${u.created ? 'Created' : 'Reset  '} account "${u.username}" (${u.name})`);
  if (password === 'admin123') {
    console.log('\nThis is the default password. Change it in Settings > Users.');
  }
  console.log(`\nSign in at http://localhost:5173/dashboard`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
