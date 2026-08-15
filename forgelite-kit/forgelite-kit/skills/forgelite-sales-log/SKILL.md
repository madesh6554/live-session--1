---
name: forgelite-sales-log
description: "The project skill for the Forgelite Course Sales Log app (React+Vite frontend, Express API, PostgreSQL). Use when adding or changing ANY feature, page, panel, field, or UI in this project. Covers: where the theme lives and how to add a token safely (two palettes, same 86 keys), the C/T/W/LH token vocabulary, the shell (FORGE|LITE topbar, sidebar that becomes a mobile drawer), the ui.jsx primitive inventory and when to reach for each (never a raw <select>), the 5-step wizard pattern (everything derives from STEPS), the money model (all maths in the v_sales view), the three paired lists that must change together, and the verification habits (both themes, 390px, console at 0 errors). The project is the source of truth — this skill tells you where to look and which rules keep it correct."
user-invocable: true
---

# Forgelite Sales Log — project skill

This app is ALREADY BUILT and verified. Your job when extending it is to stay
inside its system. **The code is the source of truth — this skill is the map,
not a copy.** When this file and the code disagree, the code wins; update this
file.

## §0 The app in one breath

- `/entry` — open (no login) 5-step sale wizard. Speed is the product.
- `/dashboard` — session-gated: Overview, Sales Log, Outstanding, Admin Settings.
- Backend: Express + PostgreSQL. Every rupee is derived in ONE SQL view.
- Frontend: React 18 + Vite, **inline styles only**, tokens for everything,
  light/dark/system theme, lucide-react icons only, no Tailwind, no CSS files
  beyond `index.css`.

## §1 Theme layer — the five files that own appearance

| File | Owns |
|---|---|
| `frontend/index.html` | anti-FOUC boot script (localStorage key `saleslog.theme`) |
| `frontend/src/index.css` | BOTH palettes — light and dark define the **same 86 `--c-*` keys** |
| `frontend/src/theme.jsx` | ThemeProvider / `useTheme()` → `{ theme, setTheme, effective }` |
| `frontend/src/constants.js` | `C` (every colour as `var(--c-x, <light literal>)`), `T`/`W`/`LH` type scale, series palettes, formatters, option lists |
| `frontend/src/utils/chartSetup.js` | `cssVar()` + `applyChartTheme()` for canvas |

**Adding a colour token (the only safe way):**
1. Add `--c-name` to BOTH `:root` blocks in index.css (light AND dark values).
2. Add `name: 'var(--c-name, <exact light literal>)'` to `C` in constants.js.
3. The fallback MUST equal the light value — that is the migration-is-a-no-op
   guarantee. A token that exists in one palette only is the classic
   unreadable-in-dark bug.
- A deliberately theme-INVARIANT colour (something living on the always-dark
  topbar, like `--c-avatarBg`) gets the SAME value in both palettes, with a
  comment saying it is invariant on purpose.

**Type:** sizes from `T` (micro 11 → kpi 40), weights from `W` (500 minimum for
readable text), leading from `LH`. Never an ad-hoc `fontSize: 13`.

**Charts:** a canvas cannot resolve `var()`. Chart colours come from
`cssVar('--c-x', fallback)` or `seriesColors(effective)`; key the chart on
`effective` so it rebuilds on theme flip; `applyChartTheme()` re-pushes global
defaults (Dashboard.jsx does this in an effect). Magnitude bars are ONE hue
(`magnitudeColor`) — colour must never track sort order.

## §2 The shell

- **Topbar** (`components/Topbar.jsx`): FORGE + red **LITE** badge wordmark,
  theme-cycle button, avatar menu (user info · Admin Settings · Sign out).
  Controls ON the bar use `headerSurface/headerText/headerBorder` tokens —
  page tokens vanish against near-black. On narrow viewports it grows a
  hamburger (`onMenu`) as the FIRST element.
- **Sidebar** (`components/Sidebar.jsx`): 248px, collapsible to a 68px rail on
  desktop; on narrow (`useIsNarrow()`, ≤640px) it is an **off-canvas drawer**
  over a scrim — closes on navigate, scrim click, and Escape. Nav model:
  `GROUPS` → `NAV_ITEMS` is **flatMapped, never hand-kept**. Permission filter
  drops items THEN empty groups.
- **Admin Settings** (`pages/AdminSettingsPage.jsx`) is reached from the avatar
  menu, NOT the sidebar. Tabs are hash-routed (`#admin-settings/<tab>`);
  `VALID_TABS` derives from `TABS`; an unusable hash is corrected to what is
  rendered (both directions), and leaving the page clears the hash.
- **Route/page keys are permanent** (`overview`, `log`, `outstanding`,
  `admin-settings`, `admin-settings:<tab>`). Rename labels freely; never ids —
  ids are the permission vocabulary (`utils/permissions.js` is the seam;
  `null` = no restriction).

## §3 Primitive inventory (`components/ui.jsx`) — reach, don't rebuild

| Need | Use | Notes |
|---|---|---|
| Panel with title/tag | `Card` | `pad={0}` for full-bleed tables |
| KPI tile | `StatCard` | accents green/blue/orange/amber/purple; figure steps down on narrow |
| Status chip | `StatusBadge` | colour + dot + label — never colour alone |
| Long option list | `Select` | portaled; escapes overflow-hidden ancestors |
| Type-to-search picker | `Combobox` | **filters only after the user types** — opening shows ALL options (the selected-label-filters-itself bug is fixed; keep it fixed) |
| 2–4 short options | `PillGroup` | segmented; `allowClear` for optional fields |
| Choices with long labels | `ChoiceList` | stacked radio cards, `columns={2}` |
| Collapsible optional section | `Disclosure` | shows a "N added" count badge |
| Ratio vs limit | `Meter` | never a two-slice pie |
| Part-to-whole states | `StackedBar` | 2px surface gaps, no borders |
| Magnitude row | `HBar` + `BreakdownRow` pattern (Overview.jsx) | one hue |
| Tables | `TableScroll` + `tableStyle/thStyle/tdStyle` | table scrolls in its OWN container, the page never scrolls sideways |
| Inputs | `Input` (+`Field` label/hint/error) | border is LONGHAND (borderColor) — do not reintroduce the `border` shorthand, it fights the focus handler |
| Feedback | `useToast`/`ToastContainer`, `ErrorMsg`, `EmptyState`, `Spinner` | |

**Interaction rules:** hover changes the BACKGROUND only, never text colour.
`user-select` off on chrome only, never on data. Disabled controls say WHY in
the hint. Escape closes every overlay and returns focus.

## §4 Page patterns

- **Wizard** (`pages/Entry.jsx`): everything derives from the `STEPS` array —
  chrome, progress, `VALIDATORS`, review groups. To add a step: add to `STEPS`,
  add its validator, add its `<StepX/>` block, add its review group. Validation
  messages name the field ("Enter the customer's phone number"), errors clear
  on edit, Enter advances, submit re-runs EVERY validator, a failed submit
  stays on Review with data intact, autofocus on every step.
- **Dashboard pages**: driven by one `filters` object through `FilterBar`;
  `FILTERED_PAGES` controls which pages show it. New analytics panel =
  (1) add a query to the `Promise.all` in `backend/routes/dashboard.js`
  summary, (2) add a card in `Overview.jsx`. Optional-field breakdowns render
  **"Not recorded" as a real, grey bucket + a coverage note** — hiding blanks
  silently inflates every share.
- **Mobile**: branch with `useIsNarrow()`. Data tables become cards on phones
  (see `SaleCard` in SalesTable.jsx); KPI figures step down; action bars pin
  to the bottom with safe-area padding.
- **Empty states**: empty-because-no-data and empty-because-filtered are
  DIFFERENT messages (`hasActiveFilters(filters)` decides). Server-side caps
  are stated in the UI ("Showing the 10 largest of 97…").

## §5 Backend rules

- **All money maths lives in `v_sales`** (migrations 002 + 007). Routes and
  components never compute collected/outstanding/status. If a number is wrong,
  someone computed money outside the view — that is the bug.
- `sales.sale_price` is a stored FACT (price agreed at the time). Never derive.
- **Soft delete everywhere** (`deleted_at`); products/salespeople/accounts
  deactivate, never delete. The last active account cannot be disabled.
- **The auth boundary is server-side** (`middleware/requireDashboard.js`).
  `/entry`'s endpoints (products, salespeople, exact-phone lookup, POST sales)
  are public BY DESIGN; everything else 401s anonymously. Never widen the
  public lookup beyond exact match.
- **Migrations are append-only.** Never edit an applied migration — add a new
  numbered one. `CREATE OR REPLACE VIEW` can only APPEND columns.
- **The three paired lists** — changing one means changing all three, same
  values, same spelling:
  1. `frontend/src/constants.js` → GENDERS / PROFESSIONS / SOURCES
  2. `backend/routes/sales.js` → the allow-list Sets
  3. `backend/db/migrations/006_student_profile.sql` → CHECK constraints
     (a new value here = a NEW migration altering the constraint)
- Enum-ish request fields: blank → null (never an error for optional fields);
  unknown value → 400 with a named message, so it never reaches the DB check.

## §6 Definition of done (verify like the project was verified)

1. Drive the feature in the real browser — click it, don't just load it.
2. Both themes (toggle + reload; assert `document.documentElement.dataset.theme`).
3. 390px width: no page-level horizontal scroll; drawer nav works.
4. Console: **0 errors** (React Router future-flag warnings are the known 2).
5. `cd backend && npm test` still 14/14.
6. Empty/loading/error states exist for anything that fetches.
7. Money numbers cross-checked against `v_sales` if you touched data paths.
