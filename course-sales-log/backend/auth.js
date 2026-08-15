const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

/**
 * Dashboard accounts.
 *
 * /entry stays open — salespeople are a dropdown lookup, not accounts. What
 * needs protecting is /dashboard: revenue totals, every customer's phone and
 * balance, and the Settings editors. Those sit behind a named account.
 *
 * Accounts default to unrestricted (role_id null), matching the original
 * single-tier behaviour from 004_users.sql. Assigning a role (008_roles.sql)
 * narrows what that account may see, via the page-key vocabulary in
 * frontend/src/utils/permissions.js.
 */

const COOKIE_NAME = 'csl_session';
const TOKEN_TTL_SECONDS = 12 * 60 * 60;
const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 6;
// bcrypt silently ignores everything past 72 bytes, so a longer password would
// give a false sense of strength. Reject rather than truncate.
const MAX_PASSWORD_LENGTH = 72;

/**
 * Session signing key.
 *
 * This MUST be unpredictable. An earlier version derived it from PGDATABASE and
 * PGUSER, which are not secrets — they are printed in .env.example and the
 * README — so anyone could recompute the key and mint a session cookie for any
 * user id, walking straight past the login. Never derive a signing key from
 * configuration that is safe to publish.
 *
 * With no SESSION_SECRET set we now generate a random one per process. That is
 * safe by default; the cost is that restarting the API signs everyone out, and
 * the warning below says so. Set SESSION_SECRET in .env for stable sessions.
 */
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

if (!process.env.SESSION_SECRET) {
  console.warn(
    'WARNING: SESSION_SECRET is not set — generated a random one for this process.\n'
    + '         Sessions will not survive a restart. Set it in .env:\n'
    + '           node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
} else if (process.env.SESSION_SECRET.length < 32) {
  console.warn('WARNING: SESSION_SECRET is shorter than 32 characters.');
}

const hashPassword = (plain) => bcrypt.hash(String(plain), BCRYPT_ROUNDS);

/**
 * Verifies a username/password pair.
 *
 * Always runs a bcrypt comparison, even when the user does not exist, so an
 * unknown username and a wrong password take the same time — otherwise the
 * response time leaks which usernames are real.
 */
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

async function verifyCredentials(username, password) {
  const { rows } = await db.query(
    `select u.id, u.username, u.name, u.password_hash, u.active, u.role_id,
            r.name as role_name, r.permissions,
            (extract(epoch from u.password_changed_at) * 1000000)::bigint as pwd_at
       from users u
       left join roles r on r.id = u.role_id
      where lower(u.username) = lower($1)`,
    [String(username ?? '').trim()]
  );
  const user = rows[0];

  const candidate = String(password ?? '');
  // Over-long input never reaches bcrypt's 72-byte truncation as a "match".
  const ok = candidate.length <= MAX_PASSWORD_LENGTH
    && await bcrypt.compare(candidate, user?.password_hash ?? DUMMY_HASH);

  // Same failure for unknown user, wrong password and deactivated account —
  // never tell the caller which of the three it was.
  if (!user || !user.active || !ok) return null;

  return {
    id: user.id, username: user.username, name: user.name, pwd_at: Number(user.pwd_at),
    role: user.role_id ? { id: user.role_id, name: user.role_name } : null,
    // No role assigned = unrestricted, same "null is load-bearing" convention
    // as usePagePermissions() on the frontend.
    permissions: user.role_id ? user.permissions : null,
  };
}

// pwd_at pins the token to the password it was issued under, so a password
// change or reset immediately invalidates every session for that account.
// It is microseconds, not seconds: at second resolution a login and a password
// change in the same second compared equal and the old session survived.
const signToken = (user) =>
  jwt.sign({ uid: user.id, pwd_at: user.pwd_at }, SECRET, {
    algorithm: 'HS256',
    expiresIn: TOKEN_TTL_SECONDS,
  });

/**
 * Resolves a session cookie to a live user row.
 *
 * The row is re-read on every request rather than trusted from the token, so
 * deactivating or renaming an account takes effect immediately instead of when
 * their 12-hour token happens to expire.
 */
async function userFromToken(token) {
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
  if (!Number.isInteger(payload?.uid)) return null;

  const { rows } = await db.query(
    `select u.id, u.username, u.name, u.active, u.role_id,
            r.name as role_name, r.permissions,
            (extract(epoch from u.password_changed_at) * 1000000)::bigint as pwd_at
       from users u
       left join roles r on r.id = u.role_id
      where u.id = $1`,
    [payload.uid]
  );
  const user = rows[0];
  if (!user || !user.active) return null;

  // Reject tokens minted before the current password. Tokens issued by an
  // older build carry no pwd_at, so they are rejected too — correct, since
  // those were signed with the old derivable secret.
  if (Number(payload.pwd_at) !== Number(user.pwd_at)) return null;

  return {
    id: user.id, username: user.username, name: user.name,
    role: user.role_id ? { id: user.role_id, name: user.role_name } : null,
    permissions: user.role_id ? user.permissions : null,
  };
}

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: TOKEN_TTL_SECONDS * 1000,
  path: '/',
});

module.exports = {
  COOKIE_NAME,
  TOKEN_TTL_SECONDS,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  hashPassword,
  verifyCredentials,
  signToken,
  userFromToken,
  cookieOptions,
};
