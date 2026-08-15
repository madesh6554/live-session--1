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
