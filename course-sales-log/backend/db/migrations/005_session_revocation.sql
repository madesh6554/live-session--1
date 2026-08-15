-- 005_session_revocation.sql
--
-- Changing an account's password must end that account's existing sessions —
-- otherwise resetting a password because it leaked leaves the thief signed in
-- for up to 12 more hours.
--
-- The session token carries this timestamp; a mismatch on any request means the
-- password changed since the token was issued, so the token is rejected.

alter table users add column if not exists password_changed_at timestamptz not null default now();
