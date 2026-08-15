# Phase 7 — Run it and PROVE it works

## Start both servers (backgrounded, from the project root)

    cd backend  && npm run dev     # "API listening on http://localhost:4000"
    cd frontend && npm run dev     # "VITE ready" on http://localhost:5173

## Automated checks (run these yourself)

1. Health: `curl -s http://127.0.0.1:4000/api/health` → `{"ok":true}`
2. The auth boundary — anonymous must get **401** on ALL of:
   `/api/sales` `/api/dashboard/summary` `/api/users` `/api/sales/outstanding`
   `/api/sales/export.csv`
3. Public endpoints must get **200**: `/api/products` `/api/salespeople`
   `/api/customers/lookup?phone=9999999999`
4. Security suite: `cd backend && npm test` → **14/14 fixes verified**
   (the API must be running — it tests the live server).

If any check fails, STOP and fix it before continuing (see Troubleshooting).

## Hand-verification in the browser (walk the user through it)

1. Open **http://localhost:5173/entry** — the 5-step wizard: fill Customer →
   Course → Payment (pick a salesperson) → Student (all optional) → Review →
   Save. A success screen with a Reference # appears.
2. Open **http://localhost:5173/dashboard** — sign in **admin / admin123**.
   Overview shows KPI cards + charts; the sale just saved is in the Sales Log.
3. Click the theme button in the topbar — light / dark / system all render.
4. DevTools → device toolbar → 390px wide: the sidebar becomes a hamburger
   drawer and the Sales Log becomes cards. No sideways page scroll anywhere.
5. Avatar menu → Admin Settings: General / Products / Salespeople / Accounts
   tabs all work, URL hash follows the tab.

## Done

Append `phase 07 done` to PROGRESS.md and give the user a short summary:
what runs where, the admin login, and that CLAUDE.md + the
`forgelite-sales-log` skill are there for building the next features.

## Troubleshooting

| Symptom | Cause → fix |
|---|---|
| `ECONNREFUSED 127.0.0.1:5433` from migrate | database not running → redo Phase 3 start step (Docker container up? `pg_ctl status`?) |
| `password authentication failed` | wrong PGPASSWORD in backend/.env → Path B: re-ask the user |
| `database "course_sales_log" does not exist` | run the `createdb` line for your path |
| `psql`/`createdb`/`initdb` not found (Windows) | add `C:\Program Files\PostgreSQL\<ver>\bin` to PATH or call by full path |
| Docker: `open //./pipe/...` error | Docker Desktop not running → start it, or use Path B/C |
| Port 4000 or 5173 already in use | another process → stop it or change PORT/vite port consistently (PORT in .env AND the vite proxy target) |
| `npm.ps1 cannot be loaded` (PowerShell policy) | use `npm.cmd install` |
| `vite: not found` | `npm install` was skipped in frontend/ → run it |
| initdb permission errors under OneDrive | create the cluster outside the synced folder |
| Browser shows raw 401 JSON on /dashboard | that IS the gate working — the React login screen appears at the /dashboard URL; sign in with admin/admin123 |
