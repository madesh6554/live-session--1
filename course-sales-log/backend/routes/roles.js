const express = require('express');
const db = require('../db');
const { requireDashboard } = require('../middleware/requireDashboard');

const router = express.Router();

/**
 * Roles configure what a dashboard account may see.
 *
 * The permission vocabulary here is PAIRED with the page keys read by
 * frontend/src/utils/permissions.js and frontend/src/pages/AdminSettingsPage.jsx
 * (pageKey()). Adding a page later means adding its key to both places.
 */
const PAGE_KEYS = new Set([
  'overview', 'log', 'outstanding',
  'admin-settings',
  'admin-settings:general', 'admin-settings:products',
  'admin-settings:salespeople', 'admin-settings:accounts', 'admin-settings:roles',
]);

router.use('/api/roles', requireDashboard);

function validatePermissions(perms) {
  if (!Array.isArray(perms)) return 'Permissions must be a list';
  for (const p of perms) {
    if (typeof p !== 'string' || !PAGE_KEYS.has(p)) return `Unknown permission: ${p}`;
  }
  return null;
}

router.get('/api/roles', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `select r.id, r.name, r.permissions,
              (select count(*)::int from users u where u.role_id = r.id) as user_count
         from roles r order by r.name`
    );
    res.json({ roles: rows, page_keys: [...PAGE_KEYS] });
  } catch (err) {
    next(err);
  }
});

router.post('/api/roles', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const permissions = req.body?.permissions ?? [];
    const pErr = validatePermissions(permissions);
    if (pErr) return res.status(400).json({ error: pErr });

    const { rows } = await db.query(
      'insert into roles (name, permissions) values ($1,$2::jsonb) returning id, name, permissions',
      [name, JSON.stringify(permissions)]
    );
    res.status(201).json({ role: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A role with that name already exists' });
    next(err);
  }
});

router.patch('/api/roles/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });

    const sets = [];
    const params = [id];
    const push = (v) => { params.push(v); return `$${params.length}`; };

    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: 'Name cannot be empty' });
      sets.push(`name = ${push(name)}`);
    }
    if (req.body?.permissions !== undefined) {
      const pErr = validatePermissions(req.body.permissions);
      if (pErr) return res.status(400).json({ error: pErr });
      sets.push(`permissions = ${push(JSON.stringify(req.body.permissions))}::jsonb`);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    const { rows } = await db.query(
      `update roles set ${sets.join(', ')} where id = $1 returning id, name, permissions`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Role not found' });
    res.json({ role: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A role with that name already exists' });
    next(err);
  }
});

// No hard delete: a role in use by an account must not silently vanish from
// under it (the account would fall back to unrestricted, which is a privilege
// escalation, not a safe default). Unassign every account first.
router.delete('/api/roles/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });

    const { rows: inUse } = await db.query('select id from users where role_id = $1 limit 1', [id]);
    if (inUse.length) {
      return res.status(400).json({ error: 'Move every account off this role before deleting it' });
    }

    const { rowCount } = await db.query('delete from roles where id = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Role not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
