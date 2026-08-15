const express = require('express');
const db = require('../db');
const { hashPassword, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } = require('../auth');
const { requireDashboard } = require('../middleware/requireDashboard');

const router = express.Router();

// Managing accounts is itself a dashboard action: any signed-in user can add
// or disable others, regardless of their own role.
router.use('/api/users', requireDashboard);

/** Never leak password_hash — it is not selected anywhere in this file. */
const PUBLIC_COLUMNS = `u.id, u.username, u.name, u.active, u.created_at, u.last_login_at,
       u.role_id, r.name as role_name`;
const FROM_USERS = 'from users u left join roles r on r.id = u.role_id';

async function roleExists(roleId) {
  if (roleId === null) return true;
  const { rows } = await db.query('select id from roles where id = $1', [roleId]);
  return rows.length > 0;
}

/** role_id: undefined = not touched, null = unassign (unrestricted), a number = assign. */
function parseRoleId(raw) {
  if (raw === null) return { value: null };
  const n = Number(raw);
  if (!Number.isInteger(n)) return { error: 'Role is invalid' };
  return { value: n };
}

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
      `select ${PUBLIC_COLUMNS} ${FROM_USERS} order by u.active desc, lower(u.username)`
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

    let roleId = null;
    if (req.body?.role_id !== undefined) {
      const parsed = parseRoleId(req.body.role_id);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      roleId = parsed.value;
      if (!(await roleExists(roleId))) return res.status(400).json({ error: 'Unknown role' });
    }

    const hash = await hashPassword(req.body.password);
    const { rows } = await db.query(
      `insert into users (username, name, password_hash, role_id) values ($1,$2,$3,$4)
       returning id`,
      [username, String(name).trim(), hash, roleId]
    );
    const { rows: created } = await db.query(
      `select ${PUBLIC_COLUMNS} ${FROM_USERS} where u.id = $1`, [rows[0].id]
    );
    res.status(201).json({ user: created[0] });
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

    if (req.body?.role_id !== undefined) {
      const parsed = parseRoleId(req.body.role_id);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      if (!(await roleExists(parsed.value))) return res.status(400).json({ error: 'Unknown role' });
      sets.push(`role_id = ${push(parsed.value)}`);
    }

    const disabling = req.body?.active !== undefined && !req.body.active && existing[0].active;
    if (req.body?.active !== undefined) sets.push(`active = ${push(!!req.body.active)}`);

    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    // Disabling the last account would lock everyone out of the dashboard with
    // no way back short of editing the database by hand. The check and the
    // update run in one transaction, with the other rows locked, so two
    // concurrent disables cannot both see "one other account still active".
    const updatedId = await db.withTransaction(async (client) => {
      if (disabling) {
        const { rows: remaining } = await client.query(
          'select id from users where active = true and id <> $1 for update', [id]
        );
        if (remaining.length === 0) return null;
      }
      const { rows } = await client.query(
        `update users set ${sets.join(', ')} where id = $1 returning id`,
        params
      );
      return rows[0]?.id ?? null;
    });

    if (!updatedId) {
      return res.status(400).json({
        error: 'This is the only active account — add another before disabling it',
      });
    }
    const { rows: updated } = await db.query(
      `select ${PUBLIC_COLUMNS} ${FROM_USERS} where u.id = $1`, [updatedId]
    );
    res.json({ user: updated[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That username is already taken' });
    next(err);
  }
});

module.exports = router;
