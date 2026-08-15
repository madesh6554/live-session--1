# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this directory is

This is **not** an app's source tree — it's the unexpanded `forgelite-kit/`
build kit for a full-stack app called **Forgelite Course Sales Log**. The kit
contains the complete verified source of that project embedded inside
phase-by-phase markdown build files, plus a project skill for extending the
app after it exists. As of now, no `course-sales-log/` project has been built
in this folder yet — running the build is what creates it.

```
live class/
  forgelite-kit/forgelite-kit/
    BUILD.md              one-shot build entry point (rules + phase index + resume logic)
    PROMPT.txt             the exact prompt used to kick off the build
    SETUP.md               one-time host setup (Node, PostgreSQL, the skill)
    README.md               kit overview, token budget, demo script
    build/01..07-*.md      the 7 build phases — project source embedded verbatim
    skills/forgelite-sales-log/SKILL.md   project skill for EXTENDING the app once built
  (course-sales-log/ does not exist yet — created by running the build)
```

## Running the build

The build is driven entirely by `forgelite-kit/forgelite-kit/BUILD.md`. To
execute it in a fresh session, the prompt is exactly the contents of
`PROMPT.txt`:

> Read forgelite-kit/BUILD.md and follow it exactly, phase by phase, until the Phase 7 checklist passes. Copy every code block byte-for-byte. Log each finished phase to course-sales-log/PROGRESS.md.

Ground rules from BUILD.md (these override normal judgment while building):
- **Code blocks are law** — copy every `#### FILE:` block byte-for-byte; never
  reformat, rename, "improve", add comments, or add dependencies.
- **One phase at a time, in order** — open only the build file for the phase
  being executed; do not pre-read later phases.
- After each phase, append `phase NN done` to `course-sales-log/PROGRESS.md`.
- Run `npm install` only where a phase explicitly says to; never `npm audit fix`.
- Generate `SESSION_SECRET` straight into `backend/.env` in Phase 3; never
  print or commit `.env`.
- Ask the user only when Phase 3 (database) needs their PostgreSQL password.
- If a command fails, check the Troubleshooting table in
  `build/07-run-and-verify.md` first — fix the environment, don't work around
  it by editing project code.
- Finish only when the Phase 7 checklist passes.

If a build session is interrupted, resume in a new session with: read
`course-sales-log/PROGRESS.md`, then continue `BUILD.md` from the first phase
not listed there. Phases already on disk with exact kit content can be
skipped within a half-finished phase.

The phases: `01-scaffold` → `02-backend` (Express API + `npm install`) →
`03-database` (PostgreSQL setup, migrate, seed) → `04-frontend-core` (Vite,
theme layer, tokens + `npm install`) → `05-frontend-components` (ui
primitives, topbar, sidebar, filters) → `06-frontend-pages` (wizard,
dashboard, analytics, admin settings) → `07-run-and-verify` (run both
servers, full verification checklist).

## Once built: architecture of the app (`course-sales-log/`)

This section describes the app the kit produces, summarized from
`skills/forgelite-sales-log/SKILL.md`. **Once the app exists, that skill file
is the authoritative map for extending it** — install it per `SETUP.md` step 4
so it loads automatically in future sessions. When the skill and the actual
code disagree, the code wins.

- `/entry` — an open (no-login) 5-step sale wizard. Speed is the product.
- `/dashboard` — session-gated: Overview, Sales Log, Outstanding, Admin Settings.
- Backend: Express + PostgreSQL, httpOnly session auth with revocation.
- Frontend: React 18 + Vite, **inline styles only** driven by design tokens —
  no Tailwind, no CSS files beyond `index.css` — light/dark/system theme,
  lucide-react icons only.

**Money model:** all revenue math (collected/outstanding/status) lives in a
single SQL view, `v_sales` (migrations 002 + 007). Routes and components never
compute money themselves — a wrong number means someone computed it outside
the view. `sales.sale_price` is a stored fact, never derived. Soft delete
everywhere (`deleted_at`); products/salespeople/accounts deactivate, never
delete.

**Theme layer** — five files own all appearance: `frontend/index.html`
(anti-FOUC boot script), `frontend/src/index.css` (both palettes, same 86
`--c-*` keys), `frontend/src/theme.jsx` (`ThemeProvider`/`useTheme()`),
`frontend/src/constants.js` (`C`/`T`/`W`/`LH` token objects), and
`frontend/src/utils/chartSetup.js` (`cssVar()`/`applyChartTheme()` for
canvas, since charts can't resolve `var()`). Adding a color token means adding
it to both palettes in `index.css` AND to `C` in `constants.js`, with the
fallback equal to the light value.

**Auth boundary is server-side** (`middleware/requireDashboard.js`).
`/entry`'s endpoints (products, salespeople, exact-phone lookup, POST sales)
are public by design; everything else 401s anonymously.

**The three paired lists** — changing one requires changing all three with
identical values/spelling: `frontend/src/constants.js` (GENDERS/PROFESSIONS/SOURCES),
`backend/routes/sales.js` (allow-list Sets), and
`backend/db/migrations/006_student_profile.sql` (CHECK constraints — a new
value needs a new migration).

**Migrations are append-only** — never edit an applied migration; add a new
numbered one. `CREATE OR REPLACE VIEW` can only append columns.

### Commands (once built)

```
cd backend  && npm run dev     # API on http://localhost:4000
cd frontend && npm run dev     # Vite dev server on http://localhost:5173
cd backend  && npm test        # 14/14 security regression suite (API must be running)
```

Health check: `curl -s http://127.0.0.1:4000/api/health` → `{"ok":true}`.
Dashboard sign-in: `admin` / `admin123`.

### Definition of done for any change to the built app

1. Drive the feature in the real browser — click it, don't just load it.
2. Check both themes (toggle + reload).
3. Check 390px width: no page-level horizontal scroll; drawer nav works.
4. Console must show 0 errors (React Router future-flag warnings are the
   known exception).
5. `cd backend && npm test` still 14/14.
6. Empty/loading/error states exist for anything that fetches.
7. Cross-check money numbers against `v_sales` if data paths were touched.
