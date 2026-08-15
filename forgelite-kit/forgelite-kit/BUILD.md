# BUILD.md — build the whole Course Sales Log project in one run

You are building a COMPLETE, verified project from exact sources. Your job is
faithful assembly, not design — every design decision was already made and
tested. Total build: ~49 files, ~7,512 lines.

## Ground rules (read carefully, they are what keeps this cheap and unbreakable)

1. **Code blocks are law.** Copy every `#### FILE:` block byte-for-byte. Never
   reformat, rename, "improve", add comments, or add dependencies.
2. **Work phase by phase, in order.** Open exactly one build file at a time —
   the one for the phase you are executing. Do not pre-read the others.
3. **Track progress.** After each phase, append `phase NN done` to
   `course-sales-log/PROGRESS.md` and tell the user in one line.
4. **npm:** run `npm install` only where a phase says so. Never `npm audit fix`.
5. **Secrets:** generate SESSION_SECRET straight into backend/.env (Phase 3).
   Never print it, never commit .env.
6. **Ask the user only when Phase 3 Path B needs their PostgreSQL password.**
7. **If a command fails,** check the Troubleshooting table in
   `build/07-run-and-verify.md` first. Fix the environment; do not edit the
   project code to work around an environment problem.
8. Finish only when the Phase 7 checklist passes.

## Phases

| # | File | What it does |
|---|---|---|
| 1 | build/01-scaffold.md | project folder + root files |
| 2 | build/02-backend.md | full Express API + `npm install` |
| 3 | build/03-database.md | PostgreSQL (3 supported setups) + .env + migrate + seed |
| 4 | build/04-frontend-core.md | Vite config, theme layer, tokens, utils + `npm install` |
| 5 | build/05-frontend-components.md | ui primitives + topbar + sidebar + filters |
| 6 | build/06-frontend-pages.md | wizard, dashboard, analytics, admin settings |
| 7 | build/07-run-and-verify.md | run both servers + full verification checklist |

Start now with `forgelite-kit/build/01-scaffold.md`.

## If the session is interrupted (rate limit, closed window)

Nothing is lost. In a NEW session, say:

> Continue the build: read course-sales-log/PROGRESS.md, then resume
> forgelite-kit/BUILD.md from the first phase not listed there.

Phases already done are on disk; the build continues from the checkpoint.
Inside a half-finished phase, any file that already exists on disk with the
exact kit content may be skipped — only write what is missing or different.
