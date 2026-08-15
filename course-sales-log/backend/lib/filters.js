const STATUSES = new Set(['paid', 'partial', 'unpaid']);

/** Thrown for bad query params so callers can answer 400 instead of leaking a 500. */
class FilterError extends Error {}

// Postgres raises on `'garbage'::date`, which surfaced as a 500 on every
// dashboard read. Validate the shape here and reject it as a client error.
const isIsoDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

function intParam(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new FilterError(`${label} is invalid`);
  return n;
}

/**
 * Builds the shared WHERE clause used by the sales list, the CSV export and
 * every dashboard panel, so one filter bar drives all of them identically.
 *
 * Returns { where, params } where `where` always starts with 'where '.
 */
function buildSalesFilter(req, { dateColumn = 'sale_date' } = {}) {
  const q = req.query || {};
  const params = [];
  const parts = ['1=1'];

  const push = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  // Array-valued params (?from=a&from=b) arrive as arrays; coerce to a scalar
  // so a crafted query cannot smuggle an unexpected type into the cast.
  const one = (v) => (Array.isArray(v) ? v[v.length - 1] : v);

  const from = one(q.from);
  const to = one(q.to);
  if (from) {
    if (!isIsoDate(from)) throw new FilterError('from date is invalid');
    parts.push(`${dateColumn} >= ${push(from)}::date`);
  }
  if (to) {
    if (!isIsoDate(to)) throw new FilterError('to date is invalid');
    parts.push(`${dateColumn} <= ${push(to)}::date`);
  }

  if (one(q.product_id)) parts.push(`product_id = ${push(intParam(one(q.product_id), 'product_id'))}`);
  if (one(q.salesperson_id)) {
    parts.push(`salesperson_id = ${push(intParam(one(q.salesperson_id), 'salesperson_id'))}`);
  }

  const status = one(q.status);
  if (status) {
    if (!STATUSES.has(status)) throw new FilterError('status is invalid');
    parts.push(`payment_status = ${push(status)}`);
  }

  if (one(q.q)) {
    const term = `%${String(one(q.q)).trim()}%`;
    parts.push(`(customer_name ilike ${push(term)} or customer_phone ilike ${push(term)})`);
  }

  return { where: `where ${parts.join(' and ')}`, params };
}

/** Express error middleware turns a FilterError into a 400. */
function handleFilterError(err, res) {
  if (err instanceof FilterError) {
    res.status(400).json({ error: err.message });
    return true;
  }
  return false;
}

module.exports = { buildSalesFilter, STATUSES, FilterError, handleFilterError };
