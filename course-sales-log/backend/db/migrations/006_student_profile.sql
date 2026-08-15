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
