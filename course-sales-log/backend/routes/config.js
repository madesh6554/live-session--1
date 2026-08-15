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
