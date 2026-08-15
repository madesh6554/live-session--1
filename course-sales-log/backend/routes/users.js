const express = require('express');
const db = require('../db');
const { hashPassword, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } = require('../auth');
const { requireDashboard } = require('../middleware/requireDashboard');

const router = express.Router();

// Managing accounts is itself a dashboard action. Single role by design: any
// signed-in user can add or disable others.
router.use('/api/users', requireDashboard);

/** Never leak password_hash — it is not selected anywhere in this file. */
const PUBLIC_COLUMNS = 'id, username, name, active, created_at, last_login_at';

// Reject non-strings outright. `String(null)` is "null" and `String(["a"])` is
// "a", so coercing first would silently accept a JSON null as a real value —
// which previously renamed an account to the literal text "null".
function isPlainString(v) {
  return typeof v === 'string';
}

function validatePassword(password) {
  if (!isPlainString(password)) return 'Password must be text';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  // bcrypt ignores bytes past 72; refuse rather than silently truncate.
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} bytes`;
  }
  return null;
}

function validateUsername(username) {
  if (!isPlainString(username)) return 'Username must be text';
  const u = username.trim();
  if (!u) return 'Username is required';
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(u)) {
    return 'Username must be 3-32 characters, letters/numbers/dot/dash/underscore only';
  }
  return null;
}

function validateName(name) {
  if (!isPlainString(name)) return 'Name must be text';
  if (!name.trim()) return 'Name cannot be empty';
  if (name.trim().length > 120) return 'Name is too long';
  return null;
}

router.get('/api/users', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `select ${PUBLIC_COLUMNS} from users order by active desc, lower(username)`
    );
    res.json({ users: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/api/users', async (req, res, next) => {
  try {
    const uErr = validateUsername(req.body?.username);
    if (uErr) return res.status(400).json({ error: uErr });
    const username = req.body.username.trim();

    const name = req.body?.name === undefined || req.body.name === null || req.body.name === ''
      ? username
      : req.body.name;
    const nErr = validateName(name);
    if (nErr) return res.status(400).json({ error: nErr });
    const pErr = validatePassword(req.body?.password);
    if (pErr) return res.status(400).json({ error: pErr });

    const hash = await hashPassword(req.body.password);
    const { rows } = await db.query(
      `insert into users (username, name, password_hash) values ($1,$2,$3)
       returning ${PUBLIC_COLUMNS}`,
      [username, String(name).trim(), hash]
    );
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That username is already taken' });
    next(err);
  }
});

router.patch('/api/users/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });

    const { rows: existing } = await db.query('select id, active from users where id = $1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'User not found' });

    const sets = [];
    const params = [id];
    const push = (v) => { params.push(v); return `$${params.length}`; };

    if (req.body?.name !== undefined) {
      const nErr = validateName(req.body.name);
      if (nErr) return res.status(400).json({ error: nErr });
      sets.push(`name = ${push(req.body.name.trim())}`);
    }

    if (req.body?.username !== undefined) {
      const uErr = validateUsername(req.body.username);
      if (uErr) return res.status(400).json({ error: uErr });
      sets.push(`username = ${push(req.body.username.trim())}`);
    }

    if (req.body?.password !== undefined) {
      const pErr = validatePassword(req.body.password);
      if (pErr) return res.status(400).json({ error: pErr });
      sets.push(`password_hash = ${push(await hashPassword(req.body.password))}`);
      // Ends every existing session for this account — see 005_session_revocation.sql.
      sets.push('password_changed_at = clock_timestamp()');
    }

    const disabling = req.body?.active !== undefined && !req.body.active && existing[0].active;
    if (req.body?.active !== undefined) sets.push(`active = ${push(!!req.body.active)}`);

    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    // Disabling the last account would lock everyone out of the dashboard with
    // no way back short of editing the database by hand. The check and the
    // update run in one transaction, with the other rows locked, so two
    // concurrent disables cannot both see "one other account still active".
    const updated = await db.withTransaction(async (client) => {
      if (disabling) {
        const { rows: remaining } = await client.query(
          'select id from users where active = true and id <> $1 for update', [id]
        );
        if (remaining.length === 0) return null;
      }
      const { rows } = await client.query(
        `update users set ${sets.join(', ')} where id = $1 returning ${PUBLIC_COLUMNS}`,
        params
      );
      return rows[0];
    });

    if (!updated) {
      return res.status(400).json({
        error: 'This is the only active account — add another before disabling it',
      });
    }
    res.json({ user: updated });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That username is already taken' });
    next(err);
  }
});

module.exports = router;
