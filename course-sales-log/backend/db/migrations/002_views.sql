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
