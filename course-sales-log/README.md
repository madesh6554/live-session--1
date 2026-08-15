# Course Sales Log

Record course sales and the payments against them; see collections, outstanding
balances and breakdowns on a dashboard.

React 18 + Vite frontend (inline styles on a token system, light/dark/system
theme), Express API, PostgreSQL. The `forgelite-sales-log` skill documents the
design system and the rules for extending the app.

## Two URLs

| URL | Login? | What it is |
|---|---|---|
| http://localhost:5173/entry | No | 5-step sale entry wizard. All a salesperson needs. |
| http://localhost:5173/dashboard | Yes | KPIs, charts, sales log, outstanding, admin settings. |

Default account (created by `npm run seed:user`): **admin / admin123** — change
it in Admin Settings once signed in.

## Run it

```
cd backend  && npm run dev     # API on http://localhost:4000
cd frontend && npm run dev     # UI  on http://localhost:5173
```

PostgreSQL must be running first (see forgelite-kit/build/03-database.md for the
three supported setups). Vite proxies /api to port 4000, so the browser stays
same-origin and the httpOnly session cookie just works.

## How the money works

Nothing about money is stored as a calculated value. `collected`, `outstanding`
and paid/partial/unpaid are derived at query time by the `v_sales` view
(backend/db/migrations/002 + 007). The one exception: `sales.sale_price` is
stored, because it is the price agreed at the time — a fact, not a calculation.
Sales are never hard-deleted; `deleted_at` is set and every read path filters it.

## Tests

```
cd backend && npm test    # 14 security regression checks (needs API running)
```

## Layout

```
backend/    server.js · auth.js · routes/ · middleware/ · lib/ · db/migrations/ · scripts/
frontend/   src/pages (Entry wizard · Dashboard · Login · AdminSettingsPage)
            src/components (ui.jsx primitives · Topbar · Sidebar · Overview · SalesTable …)
            src/theme.jsx · src/constants.js (design tokens) · src/index.css (two palettes)
tests/      security.js
```
