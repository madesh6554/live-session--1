const express = require('express');
const db = require('../db');
const { buildSalesFilter } = require('../lib/filters');
const { requireDashboard, isDashboard } = require('../middleware/requireDashboard');

const router = express.Router();

const PAYMENT_MODES = new Set(['UPI', 'Cash', 'Card', 'NEFT', 'IMPS', 'RTGS', 'Cheque', 'Other']);

// Optional student-profile fields (migration 006). Each list is PAIRED with a
// CHECK constraint of the same values — if you add one here, add it there, or
// the insert fails with a constraint violation instead of a 400.
const GENDERS = new Set(['Male', 'Female', 'Other']);
const PROFESSIONS = new Set([
  'Student', 'Working Professional', 'Business', 'Job Seeker', 'Homemaker', 'Other',
]);
const SOURCES = new Set([
  'Instagram', 'YouTube', 'Facebook', 'Google Search', 'LinkedIn', 'WhatsApp',
  'Friend / Referral', 'Walk-in', 'Other',
]);

/**
 * Read an optional enum field.
 *
 * Blank means "not answered" and must stay null — never an error. These sit
 * behind an optional section on a form used dozens of times a day; a profile
 * field that can reject a sale would be a bug, not a validation.
 */
function optionalEnum(raw, allowed, label, errors) {
  const v = String(raw ?? '').trim();
  if (!v) return null;
  if (!allowed.has(v)) { errors.push(`${label} is not a recognised value`); return null; }
  return v;
}
const SORTABLE = new Set([
  'sale_date', 'customer_name', 'product_name', 'sale_price',
  'collected', 'outstanding', 'payment_status', 'salesperson_name', 'created_at',
]);

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};

/* ------------------------------------------------------------------ *
 * Customer lookup — powers the entry form's phone type-ahead.
 * ------------------------------------------------------------------ */
router.get('/api/customers/lookup', async (req, res, next) => {
  try {
    const phone = String(req.query.phone || '').trim();
    if (phone.length < 4) return res.json({ customer: null, history: [] });

    // This endpoint stays public because the open /entry form depends on it,
    // but that makes it the one place customer data is reachable without the
    // dashboard password. Unauthenticated callers therefore get an EXACT phone
    // match only — you have to already know the number. A partial `like` scan
    // would let anyone trawl the customer list a digit at a time.
    const exactOnly = !(await isDashboard(req));

    const { rows } = await db.query(
      `select customer_name, customer_phone, customer_email, product_name,
              sale_price, collected, outstanding, payment_status, sale_date
         from v_sales
        where customer_phone ${exactOnly ? '= $1' : 'like $1'}
        order by sale_date desc, id desc
        limit 5`,
      [exactOnly ? phone : `%${phone}%`]
    );

    if (!rows.length) return res.json({ customer: null, history: [] });
    const [first] = rows;
    res.json({
      customer: {
        name: first.customer_name,
        phone: first.customer_phone,
        email: first.customer_email,
      },
      history: rows,
    });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * Create a sale (+ optional first payment) in ONE transaction.
 * ------------------------------------------------------------------ */
router.post('/api/sales', async (req, res, next) => {
  try {
    const b = req.body || {};
    const errors = [];

    const customerName = String(b.customer_name || '').trim();
    const customerPhone = String(b.customer_phone || '').trim();
    const productId = Number(b.product_id);
    const salespersonId = Number(b.salesperson_id);

    if (!customerName) errors.push('Customer name is required');
    if (!customerPhone) errors.push('Customer phone is required');
    if (!Number.isInteger(productId)) errors.push('Product is required');
    if (!Number.isInteger(salespersonId)) errors.push('Salesperson is required');

    // Bail before the database sees a NaN — a missing id must come back as a
    // 400 telling the user what is missing, not a 500 from a failed cast.
    if (errors.length) return res.status(400).json({ error: errors[0], errors });

    const { rows: prodRows } = await db.query(
      'select id, price from products where id = $1 and active = true',
      [productId]
    );
    if (!prodRows.length) errors.push('Unknown or inactive product');

    const { rows: spRows } = await db.query(
      'select id from salespeople where id = $1 and active = true',
      [salespersonId]
    );
    if (!spRows.length) errors.push('Unknown or inactive salesperson');

    // Price falls back to the product list price when the form omits it.
    const salePrice = b.sale_price === undefined || b.sale_price === null || b.sale_price === ''
      ? Number(prodRows[0]?.price ?? NaN)
      : money(b.sale_price);
    if (!Number.isFinite(salePrice) || salePrice < 0) errors.push('Sale price is invalid');

    // Optional "amount received now".
    const hasPayment = b.amount_received !== undefined
      && b.amount_received !== null
      && String(b.amount_received).trim() !== '';
    const amount = hasPayment ? money(b.amount_received) : 0;
    if (hasPayment) {
      if (!Number.isFinite(amount) || amount <= 0) errors.push('Amount received must be greater than 0');
      if (Number.isFinite(amount) && Number.isFinite(salePrice) && amount > salePrice) {
        errors.push('Amount received cannot exceed the sale price');
      }
      if (!PAYMENT_MODES.has(b.payment_mode)) errors.push('A valid payment mode is required');
    }

    // --- optional student profile (all nullable, none can block a save) ---
    const gender = optionalEnum(b.gender, GENDERS, 'Gender', errors);
    const profession = optionalEnum(b.profession, PROFESSIONS, 'Profession', errors);
    const source = optionalEnum(b.source, SOURCES, 'Source', errors);
    const city = String(b.city || '').trim().slice(0, 120) || null;

    let age = null;
    if (b.age !== undefined && b.age !== null && String(b.age).trim() !== '') {
      age = Number(b.age);
      // Bounds mirror the CHECK in 006 so a bad value is a 400 here rather than
      // a 500 from the database.
      if (!Number.isInteger(age) || age < 5 || age > 99) {
        errors.push('Age must be a whole number between 5 and 99');
        age = null;
      }
    }

    if (errors.length) return res.status(400).json({ error: errors[0], errors });

    const saleId = await db.withTransaction(async (client) => {
      const { rows: saleRows } = await client.query(
        `insert into sales
           (customer_name, customer_phone, customer_email, product_id, salesperson_id,
            sale_price, sale_date, notes,
            gender, age, profession, source, city)
         values ($1,$2,$3,$4,$5,$6, coalesce($7::date, current_date), $8,
                 $9,$10,$11,$12,$13)
         returning id`,
        [
          customerName, customerPhone, String(b.customer_email || '').trim() || null,
          productId, salespersonId, salePrice, b.sale_date || null,
          String(b.notes || '').trim() || null,
          gender, age, profession, source, city,
        ]
      );
      const id = saleRows[0].id;

      if (hasPayment) {
        await client.query(
          `insert into payments (sale_id, amount, mode, paid_on, reference)
           values ($1,$2,$3, coalesce($4::date, current_date), $5)`,
          [id, amount, b.payment_mode, b.sale_date || null,
           String(b.payment_reference || '').trim() || null]
        );
      }
      return id;
    });

    const { rows } = await db.query('select * from v_sales where id = $1', [saleId]);
    res.status(201).json({ sale: rows[0] });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * List — filtered, sorted, paginated.
 * ------------------------------------------------------------------ */
router.get('/api/sales', requireDashboard, async (req, res, next) => {
  try {
    const { where, params } = buildSalesFilter(req);

    const sort = SORTABLE.has(req.query.sort) ? req.query.sort : 'sale_date';
    const dir = String(req.query.dir).toLowerCase() === 'asc' ? 'asc' : 'desc';
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    const { rows: countRows } = await db.query(
      `select count(*)::int as total,
              coalesce(sum(sale_price),0)::numeric  as expected,
              coalesce(sum(collected),0)::numeric   as collected,
              coalesce(sum(outstanding),0)::numeric as outstanding
         from v_sales ${where}`,
      params
    );

    const { rows } = await db.query(
      `select * from v_sales ${where}
        order by ${sort} ${dir}, id desc
        limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({ sales: rows, totals: countRows[0], page, limit, total: countRows[0].total });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * CSV export of the current filter.
 * ------------------------------------------------------------------ */
router.get('/api/sales/export.csv', requireDashboard, async (req, res, next) => {
  try {
    const { where, params } = buildSalesFilter(req);
    const { rows } = await db.query(
      `select sale_date, customer_name, customer_phone, customer_email, product_name,
              salesperson_name, sale_price, collected, outstanding, payment_status,
              payment_count, last_paid_on, notes
         from v_sales ${where} order by sale_date desc, id desc`,
      params
    );

    const headers = ['Date','Customer','Phone','Email','Product','Salesperson','Sale Price',
      'Collected','Outstanding','Status','Payments','Last Paid','Notes'];
    // Anyone can post a sale through the open /entry form, so customer names
    // and notes are untrusted input that lands in this file. Excel, Sheets and
    // Numbers execute a cell starting with = + - @ (or a leading tab/CR), so a
    // customer called `=cmd|...` would run on whoever opens the export. Prefix
    // those with a single quote to force them to stay text.
    const esc = (v) => {
      if (v === null || v === undefined) return '';
      let s = String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const body = rows.map((r) => [
      r.sale_date, r.customer_name, r.customer_phone, r.customer_email, r.product_name,
      r.salesperson_name, r.sale_price, r.collected, r.outstanding, r.payment_status,
      r.payment_count, r.last_paid_on, r.notes,
    ].map(esc).join(','));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sales-log.csv"');
    res.send([headers.join(','), ...body].join('\n'));
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * Outstanding-balance worklist for collections follow-up.
 * ------------------------------------------------------------------ */
router.get('/api/sales/outstanding', requireDashboard, async (req, res, next) => {
  try {
    const { where, params } = buildSalesFilter(req);
    const { rows } = await db.query(
      `select * from v_sales ${where} and payment_status <> 'paid'
        order by outstanding desc, sale_date asc
        limit 200`,
      params
    );
    res.json({ sales: rows });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * Detail + payment history + edit trail.
 * ------------------------------------------------------------------ */
router.get('/api/sales/:id', requireDashboard, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });

    const { rows } = await db.query('select * from v_sales where id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Sale not found' });

    const { rows: payments } = await db.query(
      `select id, amount, mode, paid_on, reference, created_at
         from v_payments where sale_id = $1 order by paid_on desc, id desc`,
      [id]
    );
    const { rows: audit } = await db.query(
      `select field, old_value, new_value, changed_at
         from sale_audit where sale_id = $1 order by changed_at desc`,
      [id]
    );

    res.json({ sale: rows[0], payments, audit });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * Edit — every changed field writes an audit row.
 * ------------------------------------------------------------------ */
const EDITABLE = ['customer_name', 'customer_phone', 'customer_email', 'product_id',
  'salesperson_id', 'sale_price', 'sale_date', 'notes'];

router.patch('/api/sales/:id', requireDashboard, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });

    const { rows: existing } = await db.query(
      'select * from sales where id = $1 and deleted_at is null', [id]
    );
    if (!existing.length) return res.status(404).json({ error: 'Sale not found' });
    const current = existing[0];

    const changes = [];
    for (const field of EDITABLE) {
      if (!(field in req.body)) continue;
      let next = req.body[field];
      if (field === 'sale_price') next = money(next);
      if (field === 'product_id' || field === 'salesperson_id') {
        next = Number(next);
        if (!Number.isInteger(next)) {
          return res.status(400).json({ error: `${field.replace('_id', '')} is invalid` });
        }
      }
      if (typeof next === 'string') next = next.trim() || null;

      const before = current[field];
      const same = String(before ?? '') === String(next ?? '')
        || (field === 'sale_price' && Number(before) === Number(next))
        || (field === 'sale_date' && new Date(before).toISOString().slice(0, 10) === String(next));
      if (same) continue;
      changes.push({ field, before, after: next });
    }

    if (!changes.length) return res.status(400).json({ error: 'Nothing to update' });

    if (changes.some((c) => c.field === 'sale_price' && (!Number.isFinite(c.after) || c.after < 0))) {
      return res.status(400).json({ error: 'Sale price is invalid' });
    }

    // Re-pointing a sale must land on a row that exists, otherwise the foreign
    // key would surface as a 500 instead of a useful message.
    for (const [field, table, label] of [
      ['product_id', 'products', 'Product'],
      ['salesperson_id', 'salespeople', 'Salesperson'],
    ]) {
      const change = changes.find((c) => c.field === field);
      if (!change) continue;
      const { rows } = await db.query(`select id from ${table} where id = $1`, [change.after]);
      if (!rows.length) return res.status(400).json({ error: `Unknown ${label.toLowerCase()}` });
    }

    await db.withTransaction(async (client) => {
      const sets = changes.map((c, i) => `${c.field} = $${i + 2}`);
      await client.query(
        `update sales set ${sets.join(', ')}, updated_at = now() where id = $1`,
        [id, ...changes.map((c) => c.after)]
      );
      for (const c of changes) {
        await client.query(
          `insert into sale_audit (sale_id, field, old_value, new_value) values ($1,$2,$3,$4)`,
          [id, c.field,
           c.before === null ? null : String(c.before),
           c.after === null ? null : String(c.after)]
        );
      }
    });

    const { rows } = await db.query('select * from v_sales where id = $1', [id]);
    res.json({ sale: rows[0], changed: changes.map((c) => c.field) });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * Soft delete. Never a real DELETE.
 * ------------------------------------------------------------------ */
router.delete('/api/sales/:id', requireDashboard, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
    const { rowCount } = await db.query(
      `update sales set deleted_at = now(), updated_at = now()
        where id = $1 and deleted_at is null`, [id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Sale not found' });

    await db.query(
      `insert into sale_audit (sale_id, field, old_value, new_value)
       values ($1,'deleted_at',null,now()::text)`,
      [id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * Add a payment against an existing sale.
 * ------------------------------------------------------------------ */
router.post('/api/sales/:id/payments', requireDashboard, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });

    const { rows } = await db.query(
      'select id, sale_price, collected, outstanding from v_sales where id = $1', [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Sale not found' });
    const sale = rows[0];

    const amount = money(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    if (amount > Number(sale.outstanding)) {
      return res.status(400).json({
        error: `Amount exceeds the outstanding balance of ${Number(sale.outstanding).toFixed(2)}`,
      });
    }
    if (!PAYMENT_MODES.has(req.body?.mode)) {
      return res.status(400).json({ error: 'A valid payment mode is required' });
    }

    const { rows: created } = await db.query(
      `insert into payments (sale_id, amount, mode, paid_on, reference)
       values ($1,$2,$3, coalesce($4::date, current_date), $5)
       returning id`,
      [id, amount, req.body.mode, req.body.paid_on || null,
       String(req.body.reference || '').trim() || null]
    );

    const { rows: updated } = await db.query('select * from v_sales where id = $1', [id]);
    res.status(201).json({ payment_id: created[0].id, sale: updated[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
