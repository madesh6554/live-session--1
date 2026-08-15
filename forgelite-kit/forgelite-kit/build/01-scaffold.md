# Phase 1 — Scaffold the project
Create the project folder and its root files.

1. Create the directory `course-sales-log/` (as a sibling of `forgelite-kit/`)
   and treat it as the project root for every later phase.
2. Create the three root files below.
3. Create `PROGRESS.md` in the project root containing the single line:
   `phase 01 done` — you will append one line per finished phase from now on.

> **Rule:** create every file below with EXACTLY the content shown — byte for byte. No reformatting, no renaming, no improvements, no extra comments. Paths are relative to the project root `course-sales-log/`.

**Files in this phase (3):** `.gitignore` · `README.md` · `CLAUDE.md`

---

#### FILE: .gitignore
````
node_modules/
dist/
backups/
pgdata/
.env
*.log
.DS_Store
````

#### FILE: README.md
````md
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
````

#### FILE: CLAUDE.md
````md
# CLAUDE.md — Course Sales Log

## Commands
- API: `cd backend && npm run dev` (port 4000; needs PostgreSQL up + backend/.env)
- UI: `cd frontend && npm run dev` (port 5173, proxies /api -> 4000)
- Migrate: `cd backend && npm run migrate` · Seed demo: `npm run seed:demo`
- Create/reset account: `npm run seed:user [-- user pass "Name"]` (default admin/admin123)
- Tests: `cd backend && npm test` (security suite; API must be running)

## Architecture — the rules that keep this app correct
- **All money maths lives in the `v_sales` view** (migrations 002 + 007). No route
  or component ever computes collected/outstanding/status itself.
- **`sales.sale_price` is a stored fact** (price agreed at sale time). Never make it
  track later product price changes.
- **Nothing is hard-deleted.** Sales/products/salespeople/accounts are soft-deleted
  or deactivated; every read path filters `deleted_at`.
- **/entry is deliberately open; everything with money behind it requires a session**
  (httpOnly cookie, 12h, revocation table). The boundary is enforced server-side in
  `middleware/requireDashboard.js` — never only in the UI.
- **Route/page keys are permanent** (`admin-settings`, `admin-settings:<tab>`, nav ids).
  Rename labels freely; never rename ids.
- **Paired lists must change together**: GENDERS/PROFESSIONS/SOURCES exist in
  frontend/src/constants.js + backend/routes/sales.js (allow-lists) + migration 006
  (CHECK constraints). Adding a value means touching all three.

## Frontend conventions
- **Inline styles only**, every colour from the `C` token object (constants.js).
  The two palettes in index.css define the SAME 86 keys; `data-theme` on <html>
  swaps them. Never hardcode a hex in a component (chart literals live in
  constants.js and are validator-approved — see the dataviz notes there).
- Type scale `T` / weights `W` / leading `LH` from constants.js — no ad-hoc px.
- **lucide-react icons only.** No emoji in UI, no raw `<select>` (use Select /
  ChoiceList / PillGroup / Combobox from components/ui.jsx).
- **Hover changes background only, never text colour** — restore-on-leave bugs.
- Derive, never duplicate: nav flat list from GROUPS, wizard chrome/validators
  from the STEPS array, valid tab keys from TABS.
- Charts: canvas can't read CSS vars — colours come from cssVar()/seriesColors()
  and re-apply on theme change (see utils/chartSetup.js + Dashboard.jsx).

## When adding UI or features
Load the `forgelite-sales-log` skill BEFORE designing — it maps the theme
layer, the ui.jsx primitive inventory, the wizard/dashboard patterns, the
paired lists and the money model. Always verify: drive the feature in the
browser, check both themes, check 390px width, keep the console at 0 errors.
````

---
**Checkpoint:** project folder exists with `.gitignore`, `README.md`, `CLAUDE.md`,
`PROGRESS.md`. Tell the user in one line, then continue with
`forgelite-kit/build/02-backend.md`.
