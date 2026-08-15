/**
 * Regression tests for the findings of the adversarial auth security review.
 * Each check corresponds to a defect that was real and is now fixed.
 *
 *   cd backend && npm run test:security
 */
const crypto = require('crypto');
const path = require('path');
const jwt = require(path.join(__dirname, '..', 'backend', 'node_modules', 'jsonwebtoken'));

const API = 'http://localhost:4000';
const results = [];
const ok = (n, p, d = '') => { results.push(p); console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); };

(async () => {
  // ---- CRITICAL: forged session using the old derivable secret ----
  const oldSecret = crypto.createHash('sha256')
    .update('csl:course_sales_log:postgres').digest('hex');
  const forged = jwt.sign({ uid: 1 }, oldSecret, { algorithm: 'HS256', expiresIn: '1h' });
  const r1 = await fetch(`${API}/api/users`, { headers: { Cookie: `csl_session=${forged}` } });
  ok('forged token from the old derivable secret is rejected', r1.status === 401, `HTTP ${r1.status}`);

  const forged2 = jwt.sign({ uid: 1, pwd_at: 0 }, oldSecret, { algorithm: 'HS256', expiresIn: '1h' });
  const r2 = await fetch(`${API}/api/sales/export.csv`, { headers: { Cookie: `csl_session=${forged2}` } });
  ok('forged token cannot dump the CSV export', r2.status === 401, `HTTP ${r2.status}`);

  // ---- Sign in properly for the rest ----
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  if (!login.ok) { console.log('cannot sign in, aborting'); process.exit(1); }
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const auth = { Cookie: cookie, 'Content-Type': 'application/json' };

  // ---- HIGH: X-Forwarded-For spoofing must not reset the throttle ----
  // Burn the per-account limit, then try to escape it with a new fake IP.
  for (let i = 0; i < 12; i++) {
    await fetch(`${API}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'throttletarget', password: `x${i}` }),
    });
  }
  const spoof = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.99' },
    body: JSON.stringify({ username: 'throttletarget', password: 'another' }),
  });
  ok('X-Forwarded-For cannot reset the login throttle', spoof.status === 429, `HTTP ${spoof.status}`);

  // ---- MED: anonymous callers must not see sale_count ----
  const pubProducts = await (await fetch(`${API}/api/products`)).json();
  ok('public product list omits sale_count',
    pubProducts.products.every((p) => p.sale_count === undefined),
    JSON.stringify(pubProducts.products[0]));
  const pubPeople = await (await fetch(`${API}/api/salespeople`)).json();
  ok('public salespeople list omits sale_count',
    pubPeople.salespeople.every((s) => s.sale_count === undefined));
  const authProducts = await (await fetch(`${API}/api/products?all=1`, { headers: auth })).json();
  ok('signed-in product list still HAS sale_count',
    authProducts.products.every((p) => typeof p.sale_count === 'number'));

  // ---- MED: bad filter params -> 400, not 500 ----
  for (const [qs, label] of [
    ['from=garbage', 'from=garbage'],
    ['to=2026-13-99', 'to=2026-13-99'],
    ['product_id=abc', 'product_id=abc'],
    ['status=nonsense', 'status=nonsense'],
  ]) {
    const r = await fetch(`${API}/api/dashboard/summary?${qs}`, { headers: auth });
    ok(`bad filter (${label}) returns 400 not 500`, r.status === 400, `HTTP ${r.status}`);
  }

  // ---- LOW: null coercion must not rename an account ----
  const nullName = await fetch(`${API}/api/users/1`, {
    method: 'PATCH', headers: auth, body: JSON.stringify({ name: null }),
  });
  ok('PATCH name:null is rejected, not stored as "null"', nullName.status === 400, `HTTP ${nullName.status}`);

  // ---- LOW: over-long password rejected rather than truncated ----
  const longPw = 'a'.repeat(200);
  const longRes = await fetch(`${API}/api/users`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ username: `pwlong${Date.now() % 100000}`, password: longPw }),
  });
  ok('over-72-byte password is rejected', longRes.status === 400, `HTTP ${longRes.status}`);

  // ---- MED: changing a password ends that account's sessions ----
  const uname = `pwrevoke${Date.now() % 100000}`;
  await fetch(`${API}/api/users`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ username: uname, password: 'firstpass1' }),
  });
  const s1 = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: uname, password: 'firstpass1' }),
  });
  const victimCookie = s1.headers.get('set-cookie').split(';')[0];
  const before = await fetch(`${API}/api/dashboard/summary`, { headers: { Cookie: victimCookie } });

  const list = await (await fetch(`${API}/api/users`, { headers: auth })).json();
  const victim = list.users.find((u) => u.username === uname);
  await fetch(`${API}/api/users/${victim.id}`, {
    method: 'PATCH', headers: auth, body: JSON.stringify({ password: 'secondpass2' }),
  });
  const after = await fetch(`${API}/api/dashboard/summary`, { headers: { Cookie: victimCookie } });
  ok('changing a password kills that account\'s existing session',
    before.status === 200 && after.status === 401, `before ${before.status}, after ${after.status}`);

  await fetch(`${API}/api/users/${victim.id}`, {
    method: 'PATCH', headers: auth, body: JSON.stringify({ active: false }),
  });

  // ---- HIGH: CSV formula injection ----
  const products = await (await fetch(`${API}/api/products`)).json();
  const people = await (await fetch(`${API}/api/salespeople`)).json();
  const evil = '=1+1+cmd|\'/c calc\'!A0';
  const phone = `9${Date.now().toString().slice(-9)}`;
  const sale = await fetch(`${API}/api/sales`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: evil, customer_phone: phone,
      product_id: products.products[0].id, salesperson_id: people.salespeople[0].id,
    }),
  });
  if (!sale.ok) {
    ok('CSV injection payload could be submitted', false, `sale POST ${sale.status}`);
  } else {
    const csv = await (await fetch(`${API}/api/sales/export.csv?q=${phone}`, { headers: auth })).text();
    const row = csv.split('\n').find((l) => l.includes(phone)) || '';
    const neutralised = row.includes("'=1+1") || row.includes(`"'=1+1`);
    ok('formula in a customer name is neutralised in the CSV export', neutralised, row.slice(0, 70));
  }

  console.log(`\n${results.filter(Boolean).length}/${results.length} fixes verified`);
  process.exit(results.every(Boolean) ? 0 : 1);
})();
