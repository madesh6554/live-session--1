# SETUP.md — install these first (10-20 minutes, one time)

The build itself is done by Claude Code. Your machine only needs the runtimes.

## 1. Node.js 20 or newer

- Check: `node -v` -> v20.x or higher is fine.
- Windows: `winget install OpenJS.NodeJS.LTS`  -  macOS: `brew install node`
  (or the installer from nodejs.org).

## 2. PostgreSQL — pick ONE (you do NOT need Docker)

**Option 1 (recommended): install PostgreSQL normally**
- Windows: `winget install PostgreSQL.PostgreSQL.17` or the installer from
  postgresql.org. **Write down the password you choose for the `postgres`
  user** — Claude will ask you for it during the build.
- macOS: `brew install postgresql@17 && brew services start postgresql@17`
- Check: `psql --version`

**Option 2: Docker Desktop** (only if you already use Docker)
- Check: `docker info` works. Claude will run the database container for you.

If you have neither, Claude can also run the winget/brew install for you with
your confirmation — but installing beforehand saves time.

## 3. Claude Code

- Install + sign in (Pro plan is enough): https://claude.com/claude-code
- Check: `claude --version`

## 4. Install the project skill (teaches Claude how to extend the app)

From the folder where you unzipped the kit —

**Windows (PowerShell):**
```
New-Item -ItemType Directory -Force "$HOME/.claude/skills/forgelite-sales-log" | Out-Null
Copy-Item forgelite-kit/skills/forgelite-sales-log/SKILL.md "$HOME/.claude/skills/forgelite-sales-log/SKILL.md" -Force
```

**macOS / Linux:**
```
mkdir -p ~/.claude/skills/forgelite-sales-log
cp forgelite-kit/skills/forgelite-sales-log/SKILL.md ~/.claude/skills/forgelite-sales-log/SKILL.md
```

Skills load when a session starts — install it BEFORE opening Claude Code.
(It is not needed for the one-shot build itself — BUILD.md is self-contained.
It is for everything you build AFTER: it maps the app's theme system, UI
primitives, wizard pattern, money model and verification habits.)

## 5. Folder layout for the build

Unzip the kit into an EMPTY folder and open Claude Code in that folder:

```
my-build-folder/
  forgelite-kit/     <- the kit
  (course-sales-log/ will be created here by the build)
```
