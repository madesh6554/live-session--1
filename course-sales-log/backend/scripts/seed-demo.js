#!/usr/bin/env node
/**
 * Generates ~200 sales and ~350 payments across 90 days so the dashboard can be
 * built against realistic data shapes instead of an empty table.
 *
 * Deterministic (seeded PRNG) so re-runs are comparable. Refuses to run twice
 * unless you pass --force.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { pool } = require('../db');

const SALE_COUNT = 200;

// Optional student profile (migration 006). ~18% are left blank on purpose:
// the fields are optional on the entry form, and a demo where every one is
// filled hides the coverage problem the dashboard is meant to surface.
const SOURCES = ['Instagram', 'YouTube', 'Facebook', 'Google Search', 'LinkedIn',
                 'WhatsApp', 'Friend / Referral', 'Walk-in'];
const PROFESSIONS = ['Student', 'Working Professional', 'Business', 'Job Seeker', 'Homemaker'];
const GENDERS = ['Male', 'Female'];
const CITIES = ['Chennai', 'Coimbatore', 'Madurai', 'Bengaluru', 'Salem', 'Trichy'];
const DAYS_BACK = 90;
const MODES = ['UPI', 'UPI', 'UPI', 'Cash', 'Card', 'NEFT', 'IMPS', 'Cheque', 'Other'];

// Small deterministic PRNG (mulberry32) — no Math.random, so runs are repeatable.
let state = 0x9e3779b9;
function rand() {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

const FIRST = ['Aarav','Diya','Rohan','Ananya','Karthik','Meera','Ishaan','Sneha','Vivek','Nisha',
  'Rahul','Divya','Aditya','Pooja','Sanjay','Kavya','Manish','Lakshmi','Vishal','Anjali',
  'Nikhil','Shruti','Rajesh','Preethi','Suresh','Ritu','Ganesh','Swati','Deepak','Harini'];
const LAST = ['Sharma','Nair','Iyer','Patel','Reddy','Kumar','Menon','Gupta','Rao','Singh',
  'Pillai','Joshi','Verma','Bose','Chandra','Mehta','Krishnan','Das','Malhotra','Kaur'];

async function main() {
  const force = process.argv.includes('--force');

  const { rows: existing } = await pool.query('select count(*)::int as n from sales');
  if (existing[0].n > 0 && !force) {
    console.log(`sales already has ${existing[0].n} row(s). Re-run with --force to add more.`);
    return;
  }

  const { rows: products } = await pool.query('select id, price from products where active = true');
  const { rows: people } = await pool.query('select id from salespeople where active = true');
  if (!products.length || !people.length) {
    console.error('No products or salespeople. Run "npm run migrate" first.');
    process.exitCode = 1;
    return;
  }

  let salesMade = 0;
  let paymentsMade = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (let i = 0; i < SALE_COUNT; i++) {
      const product = pick(products);
      const listPrice = Number(product.price);

      // 25% of deals get a small discount — keeps sale_price ≠ product price,
      // which is exactly the case the price-snapshot column exists for.
      const salePrice = rand() < 0.25
        ? Math.round(listPrice * (1 - int(5, 20) / 100) / 50) * 50
        : listPrice;

      const daysAgo = int(0, DAYS_BACK);
      const saleDate = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      const phone = `9${int(100000000, 999999999)}`;

      const { rows: saleRows } = await client.query(
        `insert into sales (customer_name, customer_phone, customer_email,
                            product_id, salesperson_id, sale_price, sale_date,
                            source, profession, gender, age, city)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
        [name, phone, `${name.split(' ')[0].toLowerCase()}${int(1, 99)}@example.com`,
         product.id, pick(people).id, salePrice, saleDate,
         // Null together, not independently: a real unanswered profile means
         // the section was never opened, so the whole group is blank.
         ...(rand() < 0.18
           ? [null, null, null, null, null]
           : [pick(SOURCES), pick(PROFESSIONS), pick(GENDERS), int(18, 49), pick(CITIES)])]
      );
      const saleId = saleRows[0].id;
      salesMade++;

      // Payment mix: 55% fully paid, 30% partial, 15% nothing collected yet.
      const roll = rand();
      if (roll < 0.55) {
        // Paid — sometimes in two instalments.
        if (rand() < 0.35) {
          const first = Math.round(salePrice * (int(30, 60) / 100) / 10) * 10;
          await addPayment(client, saleId, first, saleDate);
          const secondDate = new Date(Date.now() - Math.max(0, daysAgo - int(3, 20)) * 86400000)
            .toISOString().slice(0, 10);
          await addPayment(client, saleId, salePrice - first, secondDate);
          paymentsMade += 2;
        } else {
          await addPayment(client, saleId, salePrice, saleDate);
          paymentsMade++;
        }
      } else if (roll < 0.85) {
        const part = Math.round(salePrice * (int(20, 70) / 100) / 10) * 10;
        if (part > 0) {
          await addPayment(client, saleId, part, saleDate);
          paymentsMade++;
        }
      }
      // else: unpaid, no payment rows at all — a legitimate state.
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log(`Seeded ${salesMade} sales and ${paymentsMade} payments.`);

  const { rows: check } = await pool.query(
    `select payment_status, count(*)::int as n, sum(collected)::numeric as collected
       from v_sales group by payment_status order by payment_status`
  );
  console.table(check);
}

function addPayment(client, saleId, amount, date) {
  return client.query(
    `insert into payments (sale_id, amount, mode, paid_on) values ($1,$2,$3,$4)`,
    [saleId, amount, pick(MODES), date]
  );
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
