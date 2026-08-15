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
