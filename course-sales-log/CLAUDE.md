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
