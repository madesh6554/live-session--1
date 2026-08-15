# Phase 2 — Backend (Express API)
Create every backend file, then install its dependencies.

After writing all files, run **in `course-sales-log/backend/`**:

    npm install

(Do not run the API yet — the database does not exist until Phase 3.
Never run `npm audit fix`.)

> **Rule:** create every file below with EXACTLY the content shown — byte for byte. No reformatting, no renaming, no improvements, no extra comments. Paths are relative to the project root `course-sales-log/`.

**Files in this phase (23):** `backend/package.json` · `backend/server.js` · `backend/auth.js` · `backend/db/index.js` · `backend/db/migrations/001_init.sql` · `backend/db/migrations/002_views.sql` · `backend/db/migrations/003_seed.sql` · `backend/db/migrations/004_users.sql` · `backend/db/migrations/005_session_revocation.sql` · `backend/db/migrations/006_student_profile.sql` · `backend/db/migrations/007_views_profile.sql` · `backend/middleware/requireDashboard.js` · `backend/lib/filters.js` · `backend/routes/auth.js` · `backend/routes/users.js` · `backend/routes/config.js` · `backend/routes/sales.js` · `backend/routes/dashboard.js` · `backend/scripts/migrate.js` · `backend/scripts/seed-user.js` · `backend/scripts/seed-demo.js` · `backend/.env.example` · `tests/security.js`

---

#### FILE: backend/package.json
````json
{
  "name": "course-sales-log-backend",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "migrate": "node scripts/migrate.js",
    "seed:user": "node scripts/seed-user.js",
    "seed:demo": "node scripts/seed-demo.js",
    "test:security": "node ../tests/security.js",
    "test": "npm run test:security"
  },
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "compression": "^1.7.4",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.3",
    "pg": "^8.13.0"
  }
}
````

#### FILE: backend/server.js
````js
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { handleFilterError } = require('./lib/filters');

const app = express();

// Only trust X-Forwarded-For when a proxy that overwrites it is actually in
// front. This app listens directly on :4000, so trusting it unconditionally
// would let any client set its own req.ip and walk straight past the login
// throttle by sending a different X-Forwarded-For on each attempt.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
}
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true, // the dashboard session rides on a cookie
}));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use(require('./routes/auth'));
app.use(require('./routes/users'));
app.use(require('./routes/config'));
app.use(require('./routes/sales'));
app.use(require('./routes/dashboard'));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // A bad query param is the caller's mistake, not a server fault.
  if (handleFilterError(err, res)) return;
  console.error('[error]', err.message);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
````

#### FILE: backend/auth.js
````js
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
 * Single role by design: anyone who can sign in gets everything, including the
 * user manager. See 004_users.sql.
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
    `select id, username, name, password_hash, active,
            (extract(epoch from password_changed_at) * 1000000)::bigint as pwd_at
       from users where lower(username) = lower($1)`,
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

  return { id: user.id, username: user.username, name: user.name, pwd_at: Number(user.pwd_at) };
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
    `select id, username, name, active,
            (extract(epoch from password_changed_at) * 1000000)::bigint as pwd_at
       from users where id = $1`,
    [payload.uid]
  );
  const user = rows[0];
  if (!user || !user.active) return null;

  // Reject tokens minted before the current password. Tokens issued by an
  // older build carry no pwd_at, so they are rejected too — correct, since
  // those were signed with the old derivable secret.
  if (Number(payload.pwd_at) !== Number(user.pwd_at)) return null;

  return { id: user.id, username: user.username, name: user.name };
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
````

#### FILE: backend/db/index.js
````js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'course_sales_log',
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[db] idle client error', err.message);
});

const query = (text, params) => pool.query(text, params);

/**
 * Run fn inside a transaction. Rolls back on any throw.
 * Used by POST /api/sales so a sale can never save without its first payment.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
````

#### FILE: backend/db/migrations/001_init.sql
````sql
-- 001_init.sql — core tables
-- Money is numeric(12,2) everywhere. Never float.
--
-- No sign-in: this is an open internal tool on one machine, reached at /entry
-- and /dashboard. The salesperson on a sale is chosen from a dropdown, and both
-- that list and the product list are managed from the dashboard's Settings tab.

create table if not exists products (
  id         serial primary key,
  name       text not null unique,
  price      numeric(12,2) not null check (price >= 0),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists salespeople (
  id         serial primary key,
  name       text not null unique,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- The deal. One product per sale.
create table if not exists sales (
  id             bigserial primary key,
  customer_name  text not null,
  customer_phone text not null,
  customer_email text,
  product_id     integer not null references products(id),
  salesperson_id integer not null references salespeople(id),
  -- Snapshot of the agreed price at sale time. Deliberately stored: it is a
  -- fact, not a calculation, and must not track later product price changes.
  sale_price     numeric(12,2) not null check (sale_price >= 0),
  sale_date      date not null default current_date,
  notes          text,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One row per payment. A sale with three instalments has three rows.
create table if not exists payments (
  id         bigserial primary key,
  sale_id    bigint not null references sales(id),
  amount     numeric(12,2) not null check (amount > 0),
  mode       text not null check (mode in ('UPI','Cash','Card','NEFT','IMPS','RTGS','Cheque','Other')),
  paid_on    date not null default current_date,
  reference  text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Written by PATCH /api/sales/:id only.
create table if not exists sale_audit (
  id         bigserial primary key,
  sale_id    bigint not null references sales(id),
  field      text not null,
  old_value  text,
  new_value  text,
  changed_at timestamptz not null default now()
);

create index if not exists idx_sales_phone  on sales (customer_phone) where deleted_at is null;
create index if not exists idx_sales_date   on sales (sale_date)      where deleted_at is null;
create index if not exists idx_sales_person on sales (salesperson_id) where deleted_at is null;
create index if not exists idx_payments_sale on payments (sale_id)    where deleted_at is null;
create index if not exists idx_payments_paid on payments (paid_on)    where deleted_at is null;
create index if not exists idx_audit_sale    on sale_audit (sale_id);
````

#### FILE: backend/db/migrations/002_views.sql
````sql
-- 002_views.sql — all money maths lives here and nowhere else.
-- Every read path (list, detail, dashboard, CSV) goes through v_sales.

create or replace view v_sales as
select
  s.id,
  s.customer_name,
  s.customer_phone,
  s.customer_email,
  s.sale_date,
  s.sale_price,
  s.notes,
  s.product_id,
  s.salesperson_id,
  s.created_at,
  s.updated_at,
  p.name  as product_name,
  sp.name as salesperson_name,
  coalesce(pay.collected, 0)                            as collected,
  s.sale_price - coalesce(pay.collected, 0)             as outstanding,
  case
    when coalesce(pay.collected, 0) <= 0            then 'unpaid'
    when coalesce(pay.collected, 0) >= s.sale_price then 'paid'
    else 'partial'
  end                                                   as payment_status,
  pay.last_paid_on,
  coalesce(pay.payment_count, 0)                        as payment_count,
  pay.last_mode
from sales s
join products    p  on p.id  = s.product_id
join salespeople sp on sp.id = s.salesperson_id
left join lateral (
  select
    sum(amount)                                         as collected,
    max(paid_on)                                        as last_paid_on,
    count(*)                                            as payment_count,
    (array_agg(mode order by paid_on desc, id desc))[1] as last_mode
  from payments
  where sale_id = s.id and deleted_at is null
) pay on true
where s.deleted_at is null;

-- Flat per-payment view joined to its sale, for the payment-mode breakdown
-- and the drill-down history.
create or replace view v_payments as
select
  pm.id,
  pm.sale_id,
  pm.amount,
  pm.mode,
  pm.paid_on,
  pm.reference,
  pm.created_at,
  s.product_id,
  s.salesperson_id,
  s.customer_name,
  s.customer_phone,
  s.sale_date,
  pr.name as product_name,
  sp.name as salesperson_name
from payments pm
join sales       s  on s.id  = pm.sale_id and s.deleted_at is null
join products    pr on pr.id = s.product_id
join salespeople sp on sp.id = s.salesperson_id
where pm.deleted_at is null;
````

#### FILE: backend/db/migrations/003_seed.sql
````sql
-- 003_seed.sql — starting product and salesperson lists.
-- Both are editable from the dashboard's Settings tab; these are just a start.

insert into products (name, price) values
  ('Spoken English — Basic',        4500.00),
  ('Spoken English — Intermediate', 7500.00),
  ('Spoken English — Advanced',     12000.00),
  ('IELTS Preparation',             18000.00),
  ('Business English',              15000.00),
  ('Personality Development',       6000.00)
on conflict (name) do nothing;

insert into salespeople (name) values
  ('Priya Raman'),
  ('Arjun Menon'),
  ('Fatima Sheikh'),
  ('Vikram Desai')
on conflict (name) do nothing;
````

#### FILE: backend/db/migrations/004_users.sql
````sql
-- 004_users.sql — dashboard accounts.
--
-- Replaces the single shared DASHBOARD_PASSWORD with real named accounts.
-- There is deliberately no role column: every account that can sign in gets
-- the whole dashboard, including the user manager. If that ever needs to
-- change, add a role column here rather than checking usernames in code.
--
-- Accounts gate /dashboard only. /entry stays open — salespeople are a lookup
-- list, not accounts, and are unrelated to this table.

create table if not exists users (
  id            serial primary key,
  username      text not null unique,
  name          text not null,
  password_hash text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- Usernames are matched case-insensitively at login, so stop two accounts
-- differing only by case from ever existing.
create unique index if not exists idx_users_username_lower on users (lower(username));
````

#### FILE: backend/db/migrations/005_session_revocation.sql
````sql
-- 005_session_revocation.sql
--
-- Changing an account's password must end that account's existing sessions —
-- otherwise resetting a password because it leaked leaves the thief signed in
-- for up to 12 more hours.
--
-- The session token carries this timestamp; a mismatch on any request means the
-- password changed since the token was issued, so the token is rejected.

alter table users add column if not exists password_changed_at timestamptz not null default now();
````

#### FILE: backend/db/migrations/006_student_profile.sql
````sql
-- 006_student_profile.sql — who the customer is, not just what they bought.
--
-- Modelled on the EP sales-log form, which captures a student profile alongside
-- the transaction. Without these the dashboard can report how much was sold but
-- never which channel or which segment produced it.
--
-- EVERY COLUMN IS NULLABLE. The entry form is used dozens of times a day and its
-- speed is the product; these fields sit behind an optional section and must
-- never be able to block a save. Existing rows stay valid untouched.

alter table sales
  add column if not exists gender     text,
  add column if not exists age        integer,
  add column if not exists profession text,
  add column if not exists source     text,
  add column if not exists city       text;

-- Constrained the same way payments.mode is: a CHECK in the database plus a Set
-- in the route, so a typo cannot land and the two lists are visibly paired.
-- Adding a value means a migration — deliberate, because these feed dashboard
-- breakdowns and a free-text channel column degrades into "instagram",
-- "Instagram " and "IG" within a month.
do $$ begin
  alter table sales add constraint sales_gender_check
    check (gender is null or gender in ('Male','Female','Other'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table sales add constraint sales_age_check
    check (age is null or (age between 5 and 99));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table sales add constraint sales_profession_check
    check (profession is null or profession in
      ('Student','Working Professional','Business','Job Seeker','Homemaker','Other'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table sales add constraint sales_source_check
    check (source is null or source in
      ('Instagram','YouTube','Facebook','Google Search','LinkedIn','WhatsApp',
       'Friend / Referral','Walk-in','Other'));
exception when duplicate_object then null; end $$;

-- The dashboard groups by these two, and both are low-cardinality filters over a
-- growing table.
create index if not exists sales_source_idx     on sales (source)     where deleted_at is null;
create index if not exists sales_profession_idx on sales (profession) where deleted_at is null;
````

#### FILE: backend/db/migrations/007_views_profile.sql
````sql
-- 007_views_profile.sql — surface the 006 profile columns through v_sales.
--
-- A separate migration rather than an edit to 002: 002 is already applied, and
-- the runner tracks by filename, so editing it changes the file on disk without
-- ever touching a database that has run it. Every environment must get the same
-- ordered list of changes.
--
-- The money logic below is IDENTICAL to 002. Only the passthrough columns are
-- added — if the two ever disagree, 002 is the one that is stale.
--
-- The new columns go at the END of the select list because `create or replace
-- view` refuses to reorder or insert; it can only append.

create or replace view v_sales as
select
  s.id,
  s.customer_name,
  s.customer_phone,
  s.customer_email,
  s.sale_date,
  s.sale_price,
  s.notes,
  s.product_id,
  s.salesperson_id,
  s.created_at,
  s.updated_at,
  p.name  as product_name,
  sp.name as salesperson_name,
  coalesce(pay.collected, 0)                            as collected,
  s.sale_price - coalesce(pay.collected, 0)             as outstanding,
  case
    when coalesce(pay.collected, 0) <= 0            then 'unpaid'
    when coalesce(pay.collected, 0) >= s.sale_price then 'paid'
    else 'partial'
  end                                                   as payment_status,
  pay.last_paid_on,
  coalesce(pay.payment_count, 0)                        as payment_count,
  pay.last_mode,
  -- APPENDED, not inserted: `create or replace view` may only add columns at
  -- the end — reordering an existing one is rejected outright. Every read maps
  -- by name, so position carries no meaning here.
  s.gender,
  s.age,
  s.profession,
  s.source,
  s.city
from sales s
join products    p  on p.id  = s.product_id
join salespeople sp on sp.id = s.salesperson_id
left join lateral (
  select
    sum(amount)                                         as collected,
    max(paid_on)                                        as last_paid_on,
    count(*)                                            as payment_count,
    (array_agg(mode order by paid_on desc, id desc))[1] as last_mode
  from payments
  where sale_id = s.id and deleted_at is null
) pay on true
where s.deleted_at is null;
````

#### FILE: backend/middleware/requireDashboard.js
````js
const { COOKIE_NAME, userFromToken } = require('../auth');

/**
 * Gates everything the dashboard reads or edits, and attaches req.user.
 *
 * Deliberately NOT applied to the handful of endpoints the open /entry page
 * needs: GET /api/products, GET /api/salespeople, GET /api/customers/lookup
 * and POST /api/sales. Those stay public so a salesperson can log a sale
 * without an account — see auth.js for why.
 */
async function requireDashboard(req, res, next) {
  try {
    const user = await userFromToken(req.cookies?.[COOKIE_NAME]);
    if (!user) return res.status(401).json({ error: 'Sign in to view the dashboard' });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Same check as a predicate, for endpoints that are only partly protected
 * (the customer lookup, and the `?all=1` variants of the config lists).
 */
async function isDashboard(req) {
  if (req.user) return true;
  try {
    const user = await userFromToken(req.cookies?.[COOKIE_NAME]);
    if (user) req.user = user;
    return Boolean(user);
  } catch {
    return false;
  }
}

module.exports = { requireDashboard, isDashboard };
````

#### FILE: backend/lib/filters.js
````js
const STATUSES = new Set(['paid', 'partial', 'unpaid']);

/** Thrown for bad query params so callers can answer 400 instead of leaking a 500. */
class FilterError extends Error {}

// Postgres raises on `'garbage'::date`, which surfaced as a 500 on every
// dashboard read. Validate the shape here and reject it as a client error.
const isIsoDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

function intParam(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new FilterError(`${label} is invalid`);
  return n;
}

/**
 * Builds the shared WHERE clause used by the sales list, the CSV export and
 * every dashboard panel, so one filter bar drives all of them identically.
 *
 * Returns { where, params } where `where` always starts with 'where '.
 */
function buildSalesFilter(req, { dateColumn = 'sale_date' } = {}) {
  const q = req.query || {};
  const params = [];
  const parts = ['1=1'];

  const push = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  // Array-valued params (?from=a&from=b) arrive as arrays; coerce to a scalar
  // so a crafted query cannot smuggle an unexpected type into the cast.
  const one = (v) => (Array.isArray(v) ? v[v.length - 1] : v);

  const from = one(q.from);
  const to = one(q.to);
  if (from) {
    if (!isIsoDate(from)) throw new FilterError('from date is invalid');
    parts.push(`${dateColumn} >= ${push(from)}::date`);
  }
  if (to) {
    if (!isIsoDate(to)) throw new FilterError('to date is invalid');
    parts.push(`${dateColumn} <= ${push(to)}::date`);
  }

  if (one(q.product_id)) parts.push(`product_id = ${push(intParam(one(q.product_id), 'product_id'))}`);
  if (one(q.salesperson_id)) {
    parts.push(`salesperson_id = ${push(intParam(one(q.salesperson_id), 'salesperson_id'))}`);
  }

  const status = one(q.status);
  if (status) {
    if (!STATUSES.has(status)) throw new FilterError('status is invalid');
    parts.push(`payment_status = ${push(status)}`);
  }

  if (one(q.q)) {
    const term = `%${String(one(q.q)).trim()}%`;
    parts.push(`(customer_name ilike ${push(term)} or customer_phone ilike ${push(term)})`);
  }

  return { where: `where ${parts.join(' and ')}`, params };
}

/** Express error middleware turns a FilterError into a 400. */
function handleFilterError(err, res) {
  if (err instanceof FilterError) {
    res.status(400).json({ error: err.message });
    return true;
  }
  return false;
}

module.exports = { buildSalesFilter, STATUSES, FilterError, handleFilterError };
````

#### FILE: backend/routes/auth.js
````js
const express = require('express');
const db = require('../db');
const {
  COOKIE_NAME, verifyCredentials, signToken, userFromToken, cookieOptions,
} = require('../auth');

const router = express.Router();

/**
 * Small in-memory login throttle. Resets on restart, which is fine at this scale.
 *
 * Two buckets with DIFFERENT ceilings, and that difference matters:
 *
 *  - per (IP + username): tight, because repeated failures against one account
 *    is what password guessing looks like.
 *  - per IP across all usernames: deliberately far looser. Everyone on a LAN
 *    tool shares one source IP, so a tight IP-wide cap means a handful of
 *    ordinary typos — or one person deliberately failing ten times — locks the
 *    whole office out. That is a denial-of-service, not a defence.
 *
 * A successful sign-in clears BOTH buckets, so one person fumbling their
 * password cannot leave a limit hanging over the next person.
 */
const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_ACCOUNT = 10;
const MAX_PER_IP = 60;

function keyFor(ip, username) {
  // Bound the username portion so an enormous body cannot bloat a map key.
  return `${ip}::${String(username ?? '').toLowerCase().slice(0, 64)}`;
}

function isLockedOut(key, max) {
  const rec = attempts.get(key);
  if (!rec) return false;
  if (Date.now() - rec.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return rec.count >= max;
}

// Keys include a caller-supplied username, so the map is attacker-influenced.
// Cap it: past the ceiling we stop adding new keys rather than letting a
// spray of unique usernames grow the map without bound.
const MAX_TRACKED_KEYS = 5000;

function recordFailure(key) {
  const rec = attempts.get(key);
  if (rec && Date.now() - rec.first <= WINDOW_MS) {
    rec.count++;
    return;
  }
  if (!rec && attempts.size >= MAX_TRACKED_KEYS) return;
  attempts.set(key, { first: Date.now(), count: 1 });
}

// Keep the map from growing without bound on a long-running process.
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [k, v] of attempts) if (v.first < cutoff) attempts.delete(k);
}, WINDOW_MS).unref();

router.post('/api/auth/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const ip = req.ip || 'unknown';
    const perAccount = keyFor(ip, username);
    const perIp = keyFor(ip, '*');

    if (isLockedOut(perAccount, MAX_PER_ACCOUNT) || isLockedOut(perIp, MAX_PER_IP)) {
      return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
    }

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await verifyCredentials(username, password);
    if (!user) {
      recordFailure(perAccount);
      recordFailure(perIp);
      // One message for unknown user, wrong password and disabled account.
      return res.status(401).json({ error: 'Wrong username or password' });
    }

    // Clear both: a proven-good sign-in from this IP means the earlier failures
    // were fumbles, not an attack, and must not penalise the next person.
    attempts.delete(perAccount);
    attempts.delete(perIp);

    await db.query('update users set last_login_at = now() where id = $1', [user.id]);

    res.cookie(COOKIE_NAME, signToken(user), cookieOptions());
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

/** Cheap check the dashboard calls on load to decide gate vs content. */
router.get('/api/auth/me', async (req, res, next) => {
  try {
    const user = await userFromToken(req.cookies?.[COOKIE_NAME]);
    res.json({ authenticated: Boolean(user), user: user || null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
````

#### FILE: backend/routes/users.js
````js
const express = require('express');
const db = require('../db');
const { hashPassword, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } = require('../auth');
const { requireDashboard } = require('../middleware/requireDashboard');

const router = express.Router();

// Managing accounts is itself a dashboard action. Single role by design: any
// signed-in user can add or disable others.
router.use('/api/users', requireDashboard);

/** Never leak password_hash — it is not selected anywhere in this file. */
const PUBLIC_COLUMNS = 'id, username, name, active, created_at, last_login_at';

// Reject non-strings outright. `String(null)` is "null" and `String(["a"])` is
// "a", so coercing first would silently accept a JSON null as a real value —
// which previously renamed an account to the literal text "null".
function isPlainString(v) {
  return typeof v === 'string';
}

function validatePassword(password) {
  if (!isPlainString(password)) return 'Password must be text';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  // bcrypt ignores bytes past 72; refuse rather than silently truncate.
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} bytes`;
  }
  return null;
}

function validateUsername(username) {
  if (!isPlainString(username)) return 'Username must be text';
  const u = username.trim();
  if (!u) return 'Username is required';
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(u)) {
    return 'Username must be 3-32 characters, letters/numbers/dot/dash/underscore only';
  }
  return null;
}

function validateName(name) {
  if (!isPlainString(name)) return 'Name must be text';
  if (!name.trim()) return 'Name cannot be empty';
  if (name.trim().length > 120) return 'Name is too long';
  return null;
}

router.get('/api/users', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `select ${PUBLIC_COLUMNS} from users order by active desc, lower(username)`
    );
    res.json({ users: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/api/users', async (req, res, next) => {
  try {
    const uErr = validateUsername(req.body?.username);
    if (uErr) return res.status(400).json({ error: uErr });
    const username = req.body.username.trim();

    const name = req.body?.name === undefined || req.body.name === null || req.body.name === ''
      ? username
      : req.body.name;
    const nErr = validateName(name);
    if (nErr) return res.status(400).json({ error: nErr });
    const pErr = validatePassword(req.body?.password);
    if (pErr) return res.status(400).json({ error: pErr });

    const hash = await hashPassword(req.body.password);
    const { rows } = await db.query(
      `insert into users (username, name, password_hash) values ($1,$2,$3)
       returning ${PUBLIC_COLUMNS}`,
      [username, String(name).trim(), hash]
    );
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That username is already taken' });
    next(err);
  }
});

router.patch('/api/users/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });

    const { rows: existing } = await db.query('select id, active from users where id = $1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'User not found' });

    const sets = [];
    const params = [id];
    const push = (v) => { params.push(v); return `$${params.length}`; };

    if (req.body?.name !== undefined) {
      const nErr = validateName(req.body.name);
      if (nErr) return res.status(400).json({ error: nErr });
      sets.push(`name = ${push(req.body.name.trim())}`);
    }

    if (req.body?.username !== undefined) {
      const uErr = validateUsername(req.body.username);
      if (uErr) return res.status(400).json({ error: uErr });
      sets.push(`username = ${push(req.body.username.trim())}`);
    }

    if (req.body?.password !== undefined) {
      const pErr = validatePassword(req.body.password);
      if (pErr) return res.status(400).json({ error: pErr });
      sets.push(`password_hash = ${push(await hashPassword(req.body.password))}`);
      // Ends every existing session for this account — see 005_session_revocation.sql.
      sets.push('password_changed_at = clock_timestamp()');
    }

    const disabling = req.body?.active !== undefined && !req.body.active && existing[0].active;
    if (req.body?.active !== undefined) sets.push(`active = ${push(!!req.body.active)}`);

    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    // Disabling the last account would lock everyone out of the dashboard with
    // no way back short of editing the database by hand. The check and the
    // update run in one transaction, with the other rows locked, so two
    // concurrent disables cannot both see "one other account still active".
    const updated = await db.withTransaction(async (client) => {
      if (disabling) {
        const { rows: remaining } = await client.query(
          'select id from users where active = true and id <> $1 for update', [id]
        );
        if (remaining.length === 0) return null;
      }
      const { rows } = await client.query(
        `update users set ${sets.join(', ')} where id = $1 returning ${PUBLIC_COLUMNS}`,
        params
      );
      return rows[0];
    });

    if (!updated) {
      return res.status(400).json({
        error: 'This is the only active account — add another before disabling it',
      });
    }
    res.json({ user: updated });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That username is already taken' });
    next(err);
  }
});

module.exports = router;
````

#### FILE: backend/routes/config.js
````js
const express = require('express');
const db = require('../db');
const { requireDashboard, isDashboard } = require('../middleware/requireDashboard');

const router = express.Router();

/**
 * Products and salespeople — both editable from the dashboard's Settings tab.
 *
 * Neither is ever hard-deleted. Rows are deactivated instead, so historical
 * sales keep resolving their product name and salesperson. A deactivated row
 * disappears from the entry-form dropdowns but stays in every past record.
 */

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};

/* ----------------------------- Products ----------------------------- */

// Public: the open /entry form needs the dropdown. `?all=1` exposes inactive
// rows and sale counts, so that variant is dashboard-only.
router.get('/api/products', async (req, res, next) => {
  try {
    const all = req.query.all === '1';
    const authed = await isDashboard(req);
    if (all && !authed) return res.status(401).json({ error: 'Sign in to view the dashboard' });

    // sale_count is business data. The public variant of this endpoint exists
    // only to fill the entry form's dropdown, so it returns nothing more.
    const { rows } = await db.query(
      `select p.id, p.name, p.price, p.active
              ${authed ? `, (select count(*)::int from sales s
                              where s.product_id = p.id and s.deleted_at is null) as sale_count` : ''}
         from products p
        ${all ? '' : 'where p.active = true'}
        order by p.active desc, p.name`
    );
    res.json({ products: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/api/products', requireDashboard, async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const price = money(req.body?.price);
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'Price is invalid' });

    const { rows } = await db.query(
      'insert into products (name, price) values ($1,$2) returning id, name, price, active',
      [name, price]
    );
    res.status(201).json({ product: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A product with that name already exists' });
    next(err);
  }
});

router.patch('/api/products/:id', requireDashboard, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });

    const sets = [];
    const params = [id];
    const push = (v) => { params.push(v); return `$${params.length}`; };

    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: 'Name cannot be empty' });
      sets.push(`name = ${push(name)}`);
    }
    if (req.body?.price !== undefined) {
      const price = money(req.body.price);
      if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'Price is invalid' });
      sets.push(`price = ${push(price)}`);
    }
    if (req.body?.active !== undefined) sets.push(`active = ${push(!!req.body.active)}`);

    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    const { rows } = await db.query(
      `update products set ${sets.join(', ')} where id = $1 returning id, name, price, active`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });

    // Changing the list price never touches past sales — sale_price is a
    // snapshot taken at sale time, on purpose.
    res.json({ product: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A product with that name already exists' });
    next(err);
  }
});

/* --------------------------- Salespeople ---------------------------- */

// Public for the same reason as products: /entry needs the name list.
router.get('/api/salespeople', async (req, res, next) => {
  try {
    const all = req.query.all === '1';
    const authed = await isDashboard(req);
    if (all && !authed) return res.status(401).json({ error: 'Sign in to view the dashboard' });

    // Same reasoning as products: no sale counts for anonymous callers.
    const { rows } = await db.query(
      `select sp.id, sp.name, sp.active
              ${authed ? `, (select count(*)::int from sales s
                              where s.salesperson_id = sp.id and s.deleted_at is null) as sale_count` : ''}
         from salespeople sp
        ${all ? '' : 'where sp.active = true'}
        order by sp.active desc, sp.name`
    );
    res.json({ salespeople: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/api/salespeople', requireDashboard, async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const { rows } = await db.query(
      'insert into salespeople (name) values ($1) returning id, name, active',
      [name]
    );
    res.status(201).json({ salesperson: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That name is already in the list' });
    next(err);
  }
});

router.patch('/api/salespeople/:id', requireDashboard, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });

    const sets = [];
    const params = [id];
    const push = (v) => { params.push(v); return `$${params.length}`; };

    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: 'Name cannot be empty' });
      sets.push(`name = ${push(name)}`);
    }
    if (req.body?.active !== undefined) sets.push(`active = ${push(!!req.body.active)}`);

    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    const { rows } = await db.query(
      `update salespeople set ${sets.join(', ')} where id = $1 returning id, name, active`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Salesperson not found' });
    res.json({ salesperson: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That name is already in the list' });
    next(err);
  }
});

module.exports = router;
````

#### FILE: backend/routes/sales.js
````js
const express = require('express');
const db = require('../db');
const { buildSalesFilter } = require('../lib/filters');
const { requireDashboard, isDashboard } = require('../middleware/requireDashboard');

const router = express.Router();

const PAYMENT_MODES = new Set(['UPI', 'Cash', 'Card', 'NEFT', 'IMPS', 'RTGS', 'Cheque', 'Other']);

// Optional student-profile fields (migration 006). Each list is PAIRED with a
// CHECK constraint of the same values — if you add one here, add it there, or
// the insert fails with a constraint violation instead of a 400.
const GENDERS = new Set(['Male', 'Female', 'Other']);
const PROFESSIONS = new Set([
  'Student', 'Working Professional', 'Business', 'Job Seeker', 'Homemaker', 'Other',
]);
const SOURCES = new Set([
  'Instagram', 'YouTube', 'Facebook', 'Google Search', 'LinkedIn', 'WhatsApp',
  'Friend / Referral', 'Walk-in', 'Other',
]);

/**
 * Read an optional enum field.
 *
 * Blank means "not answered" and must stay null — never an error. These sit
 * behind an optional section on a form used dozens of times a day; a profile
 * field that can reject a sale would be a bug, not a validation.
 */
function optionalEnum(raw, allowed, label, errors) {
  const v = String(raw ?? '').trim();
  if (!v) return null;
  if (!allowed.has(v)) { errors.push(`${label} is not a recognised value`); return null; }
  return v;
}
const SORTABLE = new Set([
  'sale_date', 'customer_name', 'product_name', 'sale_price',
  'collected', 'outstanding', 'payment_status', 'salesperson_name', 'created_at',
]);

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};

/* ------------------------------------------------------------------ *
 * Customer lookup — powers the entry form's phone type-ahead.
 * ------------------------------------------------------------------ */
router.get('/api/customers/lookup', async (req, res, next) => {
  try {
    const phone = String(req.query.phone || '').trim();
    if (phone.length < 4) return res.json({ customer: null, history: [] });

    // This endpoint stays public because the open /entry form depends on it,
    // but that makes it the one place customer data is reachable without the
    // dashboard password. Unauthenticated callers therefore get an EXACT phone
    // match only — you have to already know the number. A partial `like` scan
    // would let anyone trawl the customer list a digit at a time.
    const exactOnly = !(await isDashboard(req));

    const { rows } = await db.query(
      `select customer_name, customer_phone, customer_email, product_name,
              sale_price, collected, outstanding, payment_status, sale_date
         from v_sales
        where customer_phone ${exactOnly ? '= $1' : 'like $1'}
        order by sale_date desc, id desc
        limit 5`,
      [exactOnly ? phone : `%${phone}%`]
    );

    if (!rows.length) return res.json({ customer: null, history: [] });
    const [first] = rows;
    res.json({
      customer: {
        name: first.customer_name,
        phone: first.customer_phone,
        email: first.customer_email,
      },
      history: rows,
    });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * Create a sale (+ optional first payment) in ONE transaction.
 * ------------------------------------------------------------------ */
router.post('/api/sales', async (req, res, next) => {
  try {
    const b = req.body || {};
    const errors = [];

    const customerName = String(b.customer_name || '').trim();
    const customerPhone = String(b.customer_phone || '').trim();
    const productId = Number(b.product_id);
    const salespersonId = Number(b.salesperson_id);

    if (!customerName) errors.push('Customer name is required');
    if (!customerPhone) errors.push('Customer phone is required');
    if (!Number.isInteger(productId)) errors.push('Product is required');
    if (!Number.isInteger(salespersonId)) errors.push('Salesperson is required');

    // Bail before the database sees a NaN — a missing id must come back as a
    // 400 telling the user what is missing, not a 500 from a failed cast.
    if (errors.length) return res.status(400).json({ error: errors[0], errors });

    const { rows: prodRows } = await db.query(
      'select id, price from products where id = $1 and active = true',
      [productId]
    );
    if (!prodRows.length) errors.push('Unknown or inactive product');

    const { rows: spRows } = await db.query(
      'select id from salespeople where id = $1 and active = true',
      [salespersonId]
    );
    if (!spRows.length) errors.push('Unknown or inactive salesperson');

    // Price falls back to the product list price when the form omits it.
    const salePrice = b.sale_price === undefined || b.sale_price === null || b.sale_price === ''
      ? Number(prodRows[0]?.price ?? NaN)
      : money(b.sale_price);
    if (!Number.isFinite(salePrice) || salePrice < 0) errors.push('Sale price is invalid');

    // Optional "amount received now".
    const hasPayment = b.amount_received !== undefined
      && b.amount_received !== null
      && String(b.amount_received).trim() !== '';
    const amount = hasPayment ? money(b.amount_received) : 0;
    if (hasPayment) {
      if (!Number.isFinite(amount) || amount <= 0) errors.push('Amount received must be greater than 0');
      if (Number.isFinite(amount) && Number.isFinite(salePrice) && amount > salePrice) {
        errors.push('Amount received cannot exceed the sale price');
      }
      if (!PAYMENT_MODES.has(b.payment_mode)) errors.push('A valid payment mode is required');
    }

    // --- optional student profile (all nullable, none can block a save) ---
    const gender = optionalEnum(b.gender, GENDERS, 'Gender', errors);
    const profession = optionalEnum(b.profession, PROFESSIONS, 'Profession', errors);
    const source = optionalEnum(b.source, SOURCES, 'Source', errors);
    const city = String(b.city || '').trim().slice(0, 120) || null;

    let age = null;
    if (b.age !== undefined && b.age !== null && String(b.age).trim() !== '') {
      age = Number(b.age);
      // Bounds mirror the CHECK in 006 so a bad value is a 400 here rather than
      // a 500 from the database.
      if (!Number.isInteger(age) || age < 5 || age > 99) {
        errors.push('Age must be a whole number between 5 and 99');
        age = null;
      }
    }

    if (errors.length) return res.status(400).json({ error: errors[0], errors });

    const saleId = await db.withTransaction(async (client) => {
      const { rows: saleRows } = await client.query(
        `insert into sales
           (customer_name, customer_phone, customer_email, product_id, salesperson_id,
            sale_price, sale_date, notes,
            gender, age, profession, source, city)
         values ($1,$2,$3,$4,$5,$6, coalesce($7::date, current_date), $8,
                 $9,$10,$11,$12,$13)
         returning id`,
        [
          customerName, customerPhone, String(b.customer_email || '').trim() || null,
          productId, salespersonId, salePrice, b.sale_date || null,
          String(b.notes || '').trim() || null,
          gender, age, profession, source, city,
        ]
      );
      const id = saleRows[0].id;

      if (hasPayment) {
        await client.query(
          `insert into payments (sale_id, amount, mode, paid_on, reference)
           values ($1,$2,$3, coalesce($4::date, current_date), $5)`,
          [id, amount, b.payment_mode, b.sale_date || null,
           String(b.payment_reference || '').trim() || null]
        );
      }
      return id;
    });

    const { rows } = await db.query('select * from v_sales where id = $1', [saleId]);
    res.status(201).json({ sale: rows[0] });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * List — filtered, sorted, paginated.
 * ------------------------------------------------------------------ */
router.get('/api/sales', requireDashboard, async (req, res, next) => {
  try {
    const { where, params } = buildSalesFilter(req);

    const sort = SORTABLE.has(req.query.sort) ? req.query.sort : 'sale_date';
    const dir = String(req.query.dir).toLowerCase() === 'asc' ? 'asc' : 'desc';
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    const { rows: countRows } = await db.query(
      `select count(*)::int as total,
              coalesce(sum(sale_price),0)::numeric  as expected,
              coalesce(sum(collected),0)::numeric   as collected,
              coalesce(sum(outstanding),0)::numeric as outstanding
         from v_sales ${where}`,
      params
    );

    const { rows } = await db.query(
      `select * from v_sales ${where}
        order by ${sort} ${dir}, id desc
        limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({ sales: rows, totals: countRows[0], page, limit, total: countRows[0].total });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * CSV export of the current filter.
 * ------------------------------------------------------------------ */
router.get('/api/sales/export.csv', requireDashboard, async (req, res, next) => {
  try {
    const { where, params } = buildSalesFilter(req);
    const { rows } = await db.query(
      `select sale_date, customer_name, customer_phone, customer_email, product_name,
              salesperson_name, sale_price, collected, outstanding, payment_status,
              payment_count, last_paid_on, notes
         from v_sales ${where} order by sale_date desc, id desc`,
      params
    );

    const headers = ['Date','Customer','Phone','Email','Product','Salesperson','Sale Price',
      'Collected','Outstanding','Status','Payments','Last Paid','Notes'];
    // Anyone can post a sale through the open /entry form, so customer names
    // and notes are untrusted input that lands in this file. Excel, Sheets and
    // Numbers execute a cell starting with = + - @ (or a leading tab/CR), so a
    // customer called `=cmd|...` would run on whoever opens the export. Prefix
    // those with a single quote to force them to stay text.
    const esc = (v) => {
      if (v === null || v === undefined) return '';
      let s = String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const body = rows.map((r) => [
      r.sale_date, r.customer_name, r.customer_phone, r.customer_email, r.product_name,
      r.salesperson_name, r.sale_price, r.collected, r.outstanding, r.payment_status,
      r.payment_count, r.last_paid_on, r.notes,
    ].map(esc).join(','));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sales-log.csv"');
    res.send([headers.join(','), ...body].join('\n'));
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * Outstanding-balance worklist for collections follow-up.
 * ------------------------------------------------------------------ */
router.get('/api/sales/outstanding', requireDashboard, async (req, res, next) => {
  try {
    const { where, params } = buildSalesFilter(req);
    const { rows } = await db.query(
      `select * from v_sales ${where} and payment_status <> 'paid'
        order by outstanding desc, sale_date asc
        limit 200`,
      params
    );
    res.json({ sales: rows });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * Detail + payment history + edit trail.
 * ------------------------------------------------------------------ */
router.get('/api/sales/:id', requireDashboard, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });

    const { rows } = await db.query('select * from v_sales where id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Sale not found' });

    const { rows: payments } = await db.query(
      `select id, amount, mode, paid_on, reference, created_at
         from v_payments where sale_id = $1 order by paid_on desc, id desc`,
      [id]
    );
    const { rows: audit } = await db.query(
      `select field, old_value, new_value, changed_at
         from sale_audit where sale_id = $1 order by changed_at desc`,
      [id]
    );

    res.json({ sale: rows[0], payments, audit });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * Edit — every changed field writes an audit row.
 * ------------------------------------------------------------------ */
const EDITABLE = ['customer_name', 'customer_phone', 'customer_email', 'product_id',
  'salesperson_id', 'sale_price', 'sale_date', 'notes'];

router.patch('/api/sales/:id', requireDashboard, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });

    const { rows: existing } = await db.query(
      'select * from sales where id = $1 and deleted_at is null', [id]
    );
    if (!existing.length) return res.status(404).json({ error: 'Sale not found' });
    const current = existing[0];

    const changes = [];
    for (const field of EDITABLE) {
      if (!(field in req.body)) continue;
      let next = req.body[field];
      if (field === 'sale_price') next = money(next);
      if (field === 'product_id' || field === 'salesperson_id') {
        next = Number(next);
        if (!Number.isInteger(next)) {
          return res.status(400).json({ error: `${field.replace('_id', '')} is invalid` });
        }
      }
      if (typeof next === 'string') next = next.trim() || null;

      const before = current[field];
      const same = String(before ?? '') === String(next ?? '')
        || (field === 'sale_price' && Number(before) === Number(next))
        || (field === 'sale_date' && new Date(before).toISOString().slice(0, 10) === String(next));
      if (same) continue;
      changes.push({ field, before, after: next });
    }

    if (!changes.length) return res.status(400).json({ error: 'Nothing to update' });

    if (changes.some((c) => c.field === 'sale_price' && (!Number.isFinite(c.after) || c.after < 0))) {
      return res.status(400).json({ error: 'Sale price is invalid' });
    }

    // Re-pointing a sale must land on a row that exists, otherwise the foreign
    // key would surface as a 500 instead of a useful message.
    for (const [field, table, label] of [
      ['product_id', 'products', 'Product'],
      ['salesperson_id', 'salespeople', 'Salesperson'],
    ]) {
      const change = changes.find((c) => c.field === field);
      if (!change) continue;
      const { rows } = await db.query(`select id from ${table} where id = $1`, [change.after]);
      if (!rows.length) return res.status(400).json({ error: `Unknown ${label.toLowerCase()}` });
    }

    await db.withTransaction(async (client) => {
      const sets = changes.map((c, i) => `${c.field} = $${i + 2}`);
      await client.query(
        `update sales set ${sets.join(', ')}, updated_at = now() where id = $1`,
        [id, ...changes.map((c) => c.after)]
      );
      for (const c of changes) {
        await client.query(
          `insert into sale_audit (sale_id, field, old_value, new_value) values ($1,$2,$3,$4)`,
          [id, c.field,
           c.before === null ? null : String(c.before),
           c.after === null ? null : String(c.after)]
        );
      }
    });

    const { rows } = await db.query('select * from v_sales where id = $1', [id]);
    res.json({ sale: rows[0], changed: changes.map((c) => c.field) });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * Soft delete. Never a real DELETE.
 * ------------------------------------------------------------------ */
router.delete('/api/sales/:id', requireDashboard, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
    const { rowCount } = await db.query(
      `update sales set deleted_at = now(), updated_at = now()
        where id = $1 and deleted_at is null`, [id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Sale not found' });

    await db.query(
      `insert into sale_audit (sale_id, field, old_value, new_value)
       values ($1,'deleted_at',null,now()::text)`,
      [id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * Add a payment against an existing sale.
 * ------------------------------------------------------------------ */
router.post('/api/sales/:id/payments', requireDashboard, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });

    const { rows } = await db.query(
      'select id, sale_price, collected, outstanding from v_sales where id = $1', [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Sale not found' });
    const sale = rows[0];

    const amount = money(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    if (amount > Number(sale.outstanding)) {
      return res.status(400).json({
        error: `Amount exceeds the outstanding balance of ${Number(sale.outstanding).toFixed(2)}`,
      });
    }
    if (!PAYMENT_MODES.has(req.body?.mode)) {
      return res.status(400).json({ error: 'A valid payment mode is required' });
    }

    const { rows: created } = await db.query(
      `insert into payments (sale_id, amount, mode, paid_on, reference)
       values ($1,$2,$3, coalesce($4::date, current_date), $5)
       returning id`,
      [id, amount, req.body.mode, req.body.paid_on || null,
       String(req.body.reference || '').trim() || null]
    );

    const { rows: updated } = await db.query('select * from v_sales where id = $1', [id]);
    res.status(201).json({ payment_id: created[0].id, sale: updated[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
````

#### FILE: backend/routes/dashboard.js
````js
const express = require('express');
const db = require('../db');
const { buildSalesFilter } = require('../lib/filters');

const { requireDashboard } = require('../middleware/requireDashboard');

const router = express.Router();

// The whole dashboard surface sits behind the password.
router.use(requireDashboard);

/**
 * Every panel in one call. All arithmetic is SQL — the browser only renders.
 * The same buildSalesFilter drives every panel, so one filter bar is coherent
 * across the whole screen.
 */
router.get('/api/dashboard/summary', async (req, res, next) => {
  try {
    const { where, params } = buildSalesFilter(req);
    const scoped = `(select id from v_sales ${where})`;

    const [kpis, leaderboard, byProduct, byMode, trend, topOutstanding,
           bySource, byProfession, byGender] = await Promise.all([
      db.query(
        `select count(*)::int                          as sale_count,
                coalesce(sum(sale_price), 0)           as expected,
                coalesce(sum(collected), 0)            as collected,
                coalesce(sum(outstanding), 0)          as outstanding,
                coalesce(avg(sale_price), 0)           as avg_ticket,
                count(*) filter (where payment_status = 'paid')::int    as paid_count,
                count(*) filter (where payment_status = 'partial')::int as partial_count,
                count(*) filter (where payment_status = 'unpaid')::int  as unpaid_count
           from v_sales ${where}`,
        params
      ),
      db.query(
        `select salesperson_id, salesperson_name,
                count(*)::int                 as sale_count,
                coalesce(sum(sale_price), 0)  as expected,
                coalesce(sum(collected), 0)   as collected,
                coalesce(sum(outstanding), 0) as outstanding,
                coalesce(avg(sale_price), 0)  as avg_ticket
           from v_sales ${where}
          group by salesperson_id, salesperson_name
          order by collected desc`,
        params
      ),
      db.query(
        `select product_id, product_name,
                count(*)::int                 as sale_count,
                coalesce(sum(sale_price), 0)  as expected,
                coalesce(sum(collected), 0)   as collected,
                coalesce(sum(outstanding), 0) as outstanding
           from v_sales ${where}
          group by product_id, product_name
          order by collected desc`,
        params
      ),
      db.query(
        `select mode,
                count(*)::int            as payment_count,
                coalesce(sum(amount), 0) as collected
           from v_payments
          where sale_id in ${scoped}
          group by mode
          order by collected desc`,
        params
      ),
      db.query(
        `select paid_on::text            as date,
                coalesce(sum(amount), 0) as collected,
                count(*)::int            as payment_count
           from v_payments
          where sale_id in ${scoped}
          group by paid_on
          order by paid_on`,
        params
      ),
      db.query(
        `select id, sale_date, customer_name, customer_phone, product_name,
                sale_price, collected, outstanding, payment_status, last_paid_on
           from v_sales ${where} and payment_status <> 'paid'
          order by outstanding desc, sale_date asc
          limit 10`,
        params
      ),
      // --- student profile (migration 006). Every one of these is optional on
      // the entry form, so 'Not recorded' is a real and important bucket: hiding
      // it would silently inflate every share below it. ---
      db.query(
        `select coalesce(source, 'Not recorded') as source,
                count(*)::int                 as sale_count,
                coalesce(sum(sale_price), 0)  as expected,
                coalesce(sum(collected), 0)   as collected
           from v_sales ${where}
          group by 1 order by collected desc, sale_count desc`,
        params
      ),
      db.query(
        `select coalesce(profession, 'Not recorded') as profession,
                count(*)::int                 as sale_count,
                coalesce(sum(collected), 0)   as collected
           from v_sales ${where}
          group by 1 order by sale_count desc`,
        params
      ),
      db.query(
        `select coalesce(gender, 'Not recorded') as gender,
                count(*)::int                 as sale_count,
                round(avg(age) filter (where age is not null), 1) as avg_age
           from v_sales ${where}
          group by 1 order by sale_count desc`,
        params
      ),
    ]);

    res.json({
      kpis: kpis.rows[0],
      leaderboard: leaderboard.rows,
      by_product: byProduct.rows,
      by_mode: byMode.rows,
      trend: trend.rows,
      top_outstanding: topOutstanding.rows,
      by_source: bySource.rows,
      by_profession: byProfession.rows,
      by_gender: byGender.rows,
    });
  } catch (err) {
    next(err);
  }
});

/** Leaderboard drill-down for one salesperson, honouring the same filters. */
router.get('/api/dashboard/salesperson/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });

    const scopedReq = { ...req, query: { ...req.query, salesperson_id: id } };
    const { where, params } = buildSalesFilter(scopedReq);

    const [byProduct, recent, byStatus] = await Promise.all([
      db.query(
        `select product_name, count(*)::int as sale_count,
                coalesce(sum(sale_price),0) as expected,
                coalesce(sum(collected),0)  as collected
           from v_sales ${where} group by product_name order by collected desc`,
        params
      ),
      db.query(
        `select id, sale_date, customer_name, product_name, sale_price,
                collected, outstanding, payment_status
           from v_sales ${where} order by sale_date desc, id desc limit 10`,
        params
      ),
      db.query(
        `select payment_status, count(*)::int as sale_count,
                coalesce(sum(outstanding),0) as outstanding
           from v_sales ${where} group by payment_status`,
        params
      ),
    ]);

    res.json({ by_product: byProduct.rows, recent: recent.rows, by_status: byStatus.rows });
  } catch (err) {
    next(err);
  }
});

/** Values for the filter-bar dropdowns. */
router.get('/api/dashboard/filters', async (req, res, next) => {
  try {
    const [products, salespeople] = await Promise.all([
      db.query('select id, name from products where active = true order by name'),
      db.query('select id, name from salespeople where active = true order by name'),
    ]);
    res.json({ products: products.rows, salespeople: salespeople.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
````

#### FILE: backend/scripts/migrate.js
````js
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
````

#### FILE: backend/scripts/seed-user.js
````js
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
````

#### FILE: backend/scripts/seed-demo.js
````js
#!/usr/bin/env node
/**
 * Generates ~200 sales and ~350 payments across 90 days so the dashboard can be
 * built against realistic data shapes instead of an empty table.
 *
 * Deterministic (seeded PRNG) so re-runs are comparable. Refuses to run twice
 * unless you pass --force.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { pool } = require('../db');

const SALE_COUNT = 200;

// Optional student profile (migration 006). ~18% are left blank on purpose:
// the fields are optional on the entry form, and a demo where every one is
// filled hides the coverage problem the dashboard is meant to surface.
const SOURCES = ['Instagram', 'YouTube', 'Facebook', 'Google Search', 'LinkedIn',
                 'WhatsApp', 'Friend / Referral', 'Walk-in'];
const PROFESSIONS = ['Student', 'Working Professional', 'Business', 'Job Seeker', 'Homemaker'];
const GENDERS = ['Male', 'Female'];
const CITIES = ['Chennai', 'Coimbatore', 'Madurai', 'Bengaluru', 'Salem', 'Trichy'];
const DAYS_BACK = 90;
const MODES = ['UPI', 'UPI', 'UPI', 'Cash', 'Card', 'NEFT', 'IMPS', 'Cheque', 'Other'];

// Small deterministic PRNG (mulberry32) — no Math.random, so runs are repeatable.
let state = 0x9e3779b9;
function rand() {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

const FIRST = ['Aarav','Diya','Rohan','Ananya','Karthik','Meera','Ishaan','Sneha','Vivek','Nisha',
  'Rahul','Divya','Aditya','Pooja','Sanjay','Kavya','Manish','Lakshmi','Vishal','Anjali',
  'Nikhil','Shruti','Rajesh','Preethi','Suresh','Ritu','Ganesh','Swati','Deepak','Harini'];
const LAST = ['Sharma','Nair','Iyer','Patel','Reddy','Kumar','Menon','Gupta','Rao','Singh',
  'Pillai','Joshi','Verma','Bose','Chandra','Mehta','Krishnan','Das','Malhotra','Kaur'];

async function main() {
  const force = process.argv.includes('--force');

  const { rows: existing } = await pool.query('select count(*)::int as n from sales');
  if (existing[0].n > 0 && !force) {
    console.log(`sales already has ${existing[0].n} row(s). Re-run with --force to add more.`);
    return;
  }

  const { rows: products } = await pool.query('select id, price from products where active = true');
  const { rows: people } = await pool.query('select id from salespeople where active = true');
  if (!products.length || !people.length) {
    console.error('No products or salespeople. Run "npm run migrate" first.');
    process.exitCode = 1;
    return;
  }

  let salesMade = 0;
  let paymentsMade = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (let i = 0; i < SALE_COUNT; i++) {
      const product = pick(products);
      const listPrice = Number(product.price);

      // 25% of deals get a small discount — keeps sale_price ≠ product price,
      // which is exactly the case the price-snapshot column exists for.
      const salePrice = rand() < 0.25
        ? Math.round(listPrice * (1 - int(5, 20) / 100) / 50) * 50
        : listPrice;

      const daysAgo = int(0, DAYS_BACK);
      const saleDate = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      const phone = `9${int(100000000, 999999999)}`;

      const { rows: saleRows } = await client.query(
        `insert into sales (customer_name, customer_phone, customer_email,
                            product_id, salesperson_id, sale_price, sale_date,
                            source, profession, gender, age, city)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
        [name, phone, `${name.split(' ')[0].toLowerCase()}${int(1, 99)}@example.com`,
         product.id, pick(people).id, salePrice, saleDate,
         // Null together, not independently: a real unanswered profile means
         // the section was never opened, so the whole group is blank.
         ...(rand() < 0.18
           ? [null, null, null, null, null]
           : [pick(SOURCES), pick(PROFESSIONS), pick(GENDERS), int(18, 49), pick(CITIES)])]
      );
      const saleId = saleRows[0].id;
      salesMade++;

      // Payment mix: 55% fully paid, 30% partial, 15% nothing collected yet.
      const roll = rand();
      if (roll < 0.55) {
        // Paid — sometimes in two instalments.
        if (rand() < 0.35) {
          const first = Math.round(salePrice * (int(30, 60) / 100) / 10) * 10;
          await addPayment(client, saleId, first, saleDate);
          const secondDate = new Date(Date.now() - Math.max(0, daysAgo - int(3, 20)) * 86400000)
            .toISOString().slice(0, 10);
          await addPayment(client, saleId, salePrice - first, secondDate);
          paymentsMade += 2;
        } else {
          await addPayment(client, saleId, salePrice, saleDate);
          paymentsMade++;
        }
      } else if (roll < 0.85) {
        const part = Math.round(salePrice * (int(20, 70) / 100) / 10) * 10;
        if (part > 0) {
          await addPayment(client, saleId, part, saleDate);
          paymentsMade++;
        }
      }
      // else: unpaid, no payment rows at all — a legitimate state.
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log(`Seeded ${salesMade} sales and ${paymentsMade} payments.`);

  const { rows: check } = await pool.query(
    `select payment_status, count(*)::int as n, sum(collected)::numeric as collected
       from v_sales group by payment_status order by payment_status`
  );
  console.table(check);
}

function addPayment(client, saleId, amount, date) {
  return client.query(
    `insert into payments (sale_id, amount, mode, paid_on) values ($1,$2,$3,$4)`,
    [saleId, amount, pick(MODES), date]
  );
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
````

#### FILE: backend/.env.example
````
# Copy to .env and fill in. .env is gitignored — never commit it.

PGHOST=127.0.0.1
# 5433 = Docker container or portable cluster (setup paths A and C).
# 5432 = a normally-installed PostgreSQL service (setup path B).
PGPORT=5433
PGUSER=postgres
# Path A (Docker) and C (portable cluster): postgres
# Path B (installed service): the password you chose when installing PostgreSQL
PGPASSWORD=postgres
PGDATABASE=course_sales_log

PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Signs session cookies. REQUIRED to be random and secret. Generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# If unset, a random one is generated per process and restarts sign everyone out.
SESSION_SECRET=
````

#### FILE: tests/security.js
````js
/**
 * Regression tests for the findings of the adversarial auth security review.
 * Each check corresponds to a defect that was real and is now fixed.
 *
 *   cd backend && npm run test:security
 */
const crypto = require('crypto');
const path = require('path');
const jwt = require(path.join(__dirname, '..', 'backend', 'node_modules', 'jsonwebtoken'));

const API = 'http://localhost:4000';
const results = [];
const ok = (n, p, d = '') => { results.push(p); console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); };

(async () => {
  // ---- CRITICAL: forged session using the old derivable secret ----
  const oldSecret = crypto.createHash('sha256')
    .update('csl:course_sales_log:postgres').digest('hex');
  const forged = jwt.sign({ uid: 1 }, oldSecret, { algorithm: 'HS256', expiresIn: '1h' });
  const r1 = await fetch(`${API}/api/users`, { headers: { Cookie: `csl_session=${forged}` } });
  ok('forged token from the old derivable secret is rejected', r1.status === 401, `HTTP ${r1.status}`);

  const forged2 = jwt.sign({ uid: 1, pwd_at: 0 }, oldSecret, { algorithm: 'HS256', expiresIn: '1h' });
  const r2 = await fetch(`${API}/api/sales/export.csv`, { headers: { Cookie: `csl_session=${forged2}` } });
  ok('forged token cannot dump the CSV export', r2.status === 401, `HTTP ${r2.status}`);

  // ---- Sign in properly for the rest ----
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  if (!login.ok) { console.log('cannot sign in, aborting'); process.exit(1); }
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const auth = { Cookie: cookie, 'Content-Type': 'application/json' };

  // ---- HIGH: X-Forwarded-For spoofing must not reset the throttle ----
  // Burn the per-account limit, then try to escape it with a new fake IP.
  for (let i = 0; i < 12; i++) {
    await fetch(`${API}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'throttletarget', password: `x${i}` }),
    });
  }
  const spoof = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.99' },
    body: JSON.stringify({ username: 'throttletarget', password: 'another' }),
  });
  ok('X-Forwarded-For cannot reset the login throttle', spoof.status === 429, `HTTP ${spoof.status}`);

  // ---- MED: anonymous callers must not see sale_count ----
  const pubProducts = await (await fetch(`${API}/api/products`)).json();
  ok('public product list omits sale_count',
    pubProducts.products.every((p) => p.sale_count === undefined),
    JSON.stringify(pubProducts.products[0]));
  const pubPeople = await (await fetch(`${API}/api/salespeople`)).json();
  ok('public salespeople list omits sale_count',
    pubPeople.salespeople.every((s) => s.sale_count === undefined));
  const authProducts = await (await fetch(`${API}/api/products?all=1`, { headers: auth })).json();
  ok('signed-in product list still HAS sale_count',
    authProducts.products.every((p) => typeof p.sale_count === 'number'));

  // ---- MED: bad filter params -> 400, not 500 ----
  for (const [qs, label] of [
    ['from=garbage', 'from=garbage'],
    ['to=2026-13-99', 'to=2026-13-99'],
    ['product_id=abc', 'product_id=abc'],
    ['status=nonsense', 'status=nonsense'],
  ]) {
    const r = await fetch(`${API}/api/dashboard/summary?${qs}`, { headers: auth });
    ok(`bad filter (${label}) returns 400 not 500`, r.status === 400, `HTTP ${r.status}`);
  }

  // ---- LOW: null coercion must not rename an account ----
  const nullName = await fetch(`${API}/api/users/1`, {
    method: 'PATCH', headers: auth, body: JSON.stringify({ name: null }),
  });
  ok('PATCH name:null is rejected, not stored as "null"', nullName.status === 400, `HTTP ${nullName.status}`);

  // ---- LOW: over-long password rejected rather than truncated ----
  const longPw = 'a'.repeat(200);
  const longRes = await fetch(`${API}/api/users`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ username: `pwlong${Date.now() % 100000}`, password: longPw }),
  });
  ok('over-72-byte password is rejected', longRes.status === 400, `HTTP ${longRes.status}`);

  // ---- MED: changing a password ends that account's sessions ----
  const uname = `pwrevoke${Date.now() % 100000}`;
  await fetch(`${API}/api/users`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ username: uname, password: 'firstpass1' }),
  });
  const s1 = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: uname, password: 'firstpass1' }),
  });
  const victimCookie = s1.headers.get('set-cookie').split(';')[0];
  const before = await fetch(`${API}/api/dashboard/summary`, { headers: { Cookie: victimCookie } });

  const list = await (await fetch(`${API}/api/users`, { headers: auth })).json();
  const victim = list.users.find((u) => u.username === uname);
  await fetch(`${API}/api/users/${victim.id}`, {
    method: 'PATCH', headers: auth, body: JSON.stringify({ password: 'secondpass2' }),
  });
  const after = await fetch(`${API}/api/dashboard/summary`, { headers: { Cookie: victimCookie } });
  ok('changing a password kills that account\'s existing session',
    before.status === 200 && after.status === 401, `before ${before.status}, after ${after.status}`);

  await fetch(`${API}/api/users/${victim.id}`, {
    method: 'PATCH', headers: auth, body: JSON.stringify({ active: false }),
  });

  // ---- HIGH: CSV formula injection ----
  const products = await (await fetch(`${API}/api/products`)).json();
  const people = await (await fetch(`${API}/api/salespeople`)).json();
  const evil = '=1+1+cmd|\'/c calc\'!A0';
  const phone = `9${Date.now().toString().slice(-9)}`;
  const sale = await fetch(`${API}/api/sales`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: evil, customer_phone: phone,
      product_id: products.products[0].id, salesperson_id: people.salespeople[0].id,
    }),
  });
  if (!sale.ok) {
    ok('CSV injection payload could be submitted', false, `sale POST ${sale.status}`);
  } else {
    const csv = await (await fetch(`${API}/api/sales/export.csv?q=${phone}`, { headers: auth })).text();
    const row = csv.split('\n').find((l) => l.includes(phone)) || '';
    const neutralised = row.includes("'=1+1") || row.includes(`"'=1+1`);
    ok('formula in a customer name is neutralised in the CSV export', neutralised, row.slice(0, 70));
  }

  console.log(`\n${results.filter(Boolean).length}/${results.length} fixes verified`);
  process.exit(results.every(Boolean) ? 0 : 1);
})();
````

---
**Checkpoint:** `npm install` finished without errors (deprecation warnings are
fine). Append `phase 02 done` to PROGRESS.md and continue with
`forgelite-kit/build/03-database.md`.
