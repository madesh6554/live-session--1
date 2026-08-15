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
