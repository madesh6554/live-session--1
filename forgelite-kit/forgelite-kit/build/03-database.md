# Phase 3 — Database (PostgreSQL) + .env + migrate + seed

The app needs PostgreSQL 14+ reachable on 127.0.0.1. Support THREE setups —
detect in this order and use the FIRST one that works. Ask the user only
where marked.

## Path A — Docker (use if `docker info` succeeds)

    docker run -d --name saleslog-pg -e POSTGRES_PASSWORD=postgres \
      -e POSTGRES_DB=course_sales_log -p 127.0.0.1:5433:5432 postgres:17-alpine

Wait until `docker exec saleslog-pg pg_isready -U postgres` reports ready.
`.env` values: PGPORT=5433, PGPASSWORD=postgres. Database already exists.

## Path B — Installed PostgreSQL service (use if `psql --version` works and a service is running)

The user chose a password for the `postgres` user when installing.
**Ask the user for that password** — never guess, never reset it.

    createdb -h 127.0.0.1 -p 5432 -U postgres course_sales_log

(If `createdb`/`psql` is not on PATH on Windows, it lives in
`C:\Program Files\PostgreSQL\<version>\bin\`.)
`.env` values: PGPORT=5432, PGPASSWORD=<the user's password>.
If the database already exists, that is fine — continue.

## Path C — Portable cluster (PostgreSQL binaries exist, but no usable service/password)

A private throwaway cluster inside the project — no admin rights, no service:

    initdb -D pgdata -U postgres -A trust -E UTF8
    pg_ctl -D pgdata -o "-p 5433 -h 127.0.0.1" -l pgdata/server.log start
    createdb -h 127.0.0.1 -p 5433 -U postgres course_sales_log

`-A trust` means no password on loopback — acceptable for a local
development database only; say that to the user in one line.
`.env` values: PGPORT=5433, PGPASSWORD=postgres (ignored under trust).
Note: if the project sits inside a OneDrive-synced folder and initdb fails
with permission errors, create the cluster in a non-synced path instead.

## If none of the paths work

PostgreSQL is not installed. Point the user at `forgelite-kit/SETUP.md`
(section "PostgreSQL") and offer to run the install command for them
(winget / brew — it needs their confirmation). Then use Path B (installer
service) or A (Docker).

## Write backend/.env

Copy `backend/.env.example` to `backend/.env`, set PGPORT/PGPASSWORD for the
path you used, and generate the session secret DIRECTLY into the file (never
print it to the chat). **Run this from the project root** (`course-sales-log/`):

    node -e "const fs=require('fs');const s=require('crypto').randomBytes(32).toString('hex');const p='backend/.env';fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(/SESSION_SECRET=.*/,'SESSION_SECRET='+s))"

## Migrate + seed (in `course-sales-log/backend/`)

    npm run migrate      # expect: 7 migrations applied
    npm run seed:demo    # expect: "Seeded 200 sales..." + a status table
    npm run seed:user    # expect: Created account "admin" (admin / admin123)

---
**Checkpoint:** all three commands succeeded. Append `phase 03 done` to
PROGRESS.md, tell the user which database path was used, and continue with
`forgelite-kit/build/04-frontend-core.md`.
