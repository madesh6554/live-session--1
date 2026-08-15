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
