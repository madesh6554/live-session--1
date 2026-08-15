# Forgelite Sales Log — One-Shot Build Kit

One kit, one prompt, one finished full-stack app. This kit contains the
COMPLETE verified source of the project embedded in phase-by-phase build
files, so Claude Code can assemble, run and verify the whole thing in a single
session — no design decisions, no wandering, no wasted tokens.

**What gets built:** a sales-log app — 5-step entry wizard (open, no login),
password-protected dashboard (KPIs, charts, sales log, outstanding worklist,
admin settings), light/dark/system theming, mobile drawer navigation,
PostgreSQL money model where every rupee is derived in one SQL view, httpOnly
session auth with revocation, and a 14-check security regression suite.

## How to use it

1. Do `SETUP.md` once (Node, PostgreSQL, Claude Code, the skill).
2. Unzip the kit into an empty folder. Open a terminal there. Run `claude`.
3. Make sure the model is Sonnet (`/model sonnet`) — default effort, no
   extended thinking.
4. Paste the prompt from `PROMPT.txt`:

   > Read forgelite-kit/BUILD.md and follow it exactly, phase by phase, until the Phase 7 checklist passes. Copy every code block byte-for-byte. Log each finished phase to course-sales-log/PROGRESS.md.

5. Approve the permission prompts as they come (file writes, npm, database).
   Claude asks exactly one question if you installed PostgreSQL yourself:
   the `postgres` password you chose.
6. ~20-40 minutes later (mostly `npm install` time) you have the running app
   and a verification report. Sign in at http://localhost:5173/dashboard with
   **admin / admin123**.

## Token budget (Pro plan, Sonnet, default/medium effort)

Estimates by size of what must be read and written (tokens = characters / 3.5),
rounded up. Real usage varies with retries — treat as +/-40%.

| Phase | Content size | Est. tokens (read + write) |
|---|---|---|
| 1 scaffold | 5 KB | ~4k |
| 2 backend | 84 KB | ~50k |
| 3 database | 2 KB | ~2k |
| 4 frontend core | 30 KB | ~18k |
| 5 components | 55 KB | ~33k |
| 6 pages | 118 KB | ~70k |
| 7 run + verify | 2 KB | ~2k |
| Setup/verify chatter + tool overhead | — | ~15-25k |
| **Total, one-shot build** | ~299 KB of source | **~182k** |

That usually completes in ONE Pro session (Sonnet); plan for two if your
5-hour window is already partly used. If you hit the cap mid-build, nothing is
lost: open a new session and say
*"Continue the build: read course-sales-log/PROGRESS.md, then resume
forgelite-kit/BUILD.md from the first phase not listed there."*

Token hygiene that keeps it cheap: fresh session for the build, stay on
Sonnet, don't ask Claude to explain the code while it builds (do that after),
and let the phase files drive — they tell Claude exactly what to read so it
never re-explores.

## What's in the kit

```
forgelite-kit/
  BUILD.md              the one-shot build entry (rules + phase index + resume)
  PROMPT.txt            the exact prompt to paste
  SETUP.md              installs to do first (Node, PostgreSQL, the skill)
  README.md             this file
  build/01..07          the phases (project source embedded verbatim)
  skills/
    forgelite-sales-log/SKILL.md   the project skill — how to EXTEND the app
```

## After the build — next-step exercises

Each of these is a real gap or feature, sized for a hands-on session with
Sonnet + the `forgelite-sales-log` skill installed:

1. **Outstanding page on mobile** still uses a scrolling table — convert it to
   the same card layout the Sales Log uses (`SaleCard` pattern). ~15 min.
2. Add a **notification bell** to the topbar fed by overdue balances.
3. Add **filter chips** showing active filters above the dashboard panels.
4. Add an **Undo** toast (5s) after deactivating a product/salesperson.
5. Ask Claude to apply the skill's **"Definition of done" (section 6)** to any
   page — both themes, 390px width, console, empty states — and fix findings.

## Honest notes

- The security suite (14 checks) is included and must pass in Phase 7. The old
  browser e2e suite is NOT included: it depends on a machine-specific
  Playwright runner and predates the wizard UI. Writing a fresh e2e suite is a
  good advanced exercise.
- `npm install` resolves dependency versions fresh (no lockfiles in the kit);
  ranges are pinned to the majors the project was verified with.
- The build was verified end-to-end on Windows 11 + Node 24 + PostgreSQL 17
  (Docker and native both tested paths).

## Demoing the build live (optional)

1. (2 min) Show the kit tree: every file of a working app, as data.
2. (3 min) Paste the prompt, let the build start. Narrate the ground rules —
   verbatim blocks, checkpoints, PROGRESS.md as the resume point.
3. (While it builds) Open build/02-backend.md and show how the money view
   (migrations 002/007) makes wrong totals impossible; open the
   `forgelite-sales-log` skill and explain why it exists — project knowledge
   packaged once, reusable for pennies.
4. (5 min) Phase 7 output: the auth-boundary table and 14/14 security checks —
   the app proves itself.
5. (Rest) Exercise #1 (Outstanding cards) hands-on.
