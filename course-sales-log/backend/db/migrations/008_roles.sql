-- 008_roles.sql — configurable roles for dashboard accounts.
--
-- users.role_id is nullable ON PURPOSE: an account with no role is
-- unrestricted (the original single-tier behaviour from 004_users.sql).
-- Assigning a role narrows what that account may see, via the same page-key
-- vocabulary already used by frontend/src/utils/permissions.js
-- ('overview', 'log', 'outstanding', 'admin-settings:<tab>', ...).

create table if not exists roles (
  id          serial primary key,
  name        text not null unique,
  permissions jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

alter table users add column if not exists role_id integer references roles(id);
