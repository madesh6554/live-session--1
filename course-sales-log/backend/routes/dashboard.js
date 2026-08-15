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
