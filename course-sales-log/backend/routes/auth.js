const express = require('express');
const db = require('../db');
const {
  COOKIE_NAME, verifyCredentials, signToken, userFromToken, cookieOptions,
} = require('../auth');

const router = express.Router();

/**
 * Small in-memory login throttle. Resets on restart, which is fine at this scale.
 *
 * Two buckets with DIFFERENT ceilings, and that difference matters:
 *
 *  - per (IP + username): tight, because repeated failures against one account
 *    is what password guessing looks like.
 *  - per IP across all usernames: deliberately far looser. Everyone on a LAN
 *    tool shares one source IP, so a tight IP-wide cap means a handful of
 *    ordinary typos — or one person deliberately failing ten times — locks the
 *    whole office out. That is a denial-of-service, not a defence.
 *
 * A successful sign-in clears BOTH buckets, so one person fumbling their
 * password cannot leave a limit hanging over the next person.
 */
const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_ACCOUNT = 10;
const MAX_PER_IP = 60;

function keyFor(ip, username) {
  // Bound the username portion so an enormous body cannot bloat a map key.
  return `${ip}::${String(username ?? '').toLowerCase().slice(0, 64)}`;
}

function isLockedOut(key, max) {
  const rec = attempts.get(key);
  if (!rec) return false;
  if (Date.now() - rec.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return rec.count >= max;
}

// Keys include a caller-supplied username, so the map is attacker-influenced.
// Cap it: past the ceiling we stop adding new keys rather than letting a
// spray of unique usernames grow the map without bound.
const MAX_TRACKED_KEYS = 5000;

function recordFailure(key) {
  const rec = attempts.get(key);
  if (rec && Date.now() - rec.first <= WINDOW_MS) {
    rec.count++;
    return;
  }
  if (!rec && attempts.size >= MAX_TRACKED_KEYS) return;
  attempts.set(key, { first: Date.now(), count: 1 });
}

// Keep the map from growing without bound on a long-running process.
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [k, v] of attempts) if (v.first < cutoff) attempts.delete(k);
}, WINDOW_MS).unref();

router.post('/api/auth/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const ip = req.ip || 'unknown';
    const perAccount = keyFor(ip, username);
    const perIp = keyFor(ip, '*');

    if (isLockedOut(perAccount, MAX_PER_ACCOUNT) || isLockedOut(perIp, MAX_PER_IP)) {
      return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
    }

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await verifyCredentials(username, password);
    if (!user) {
      recordFailure(perAccount);
      recordFailure(perIp);
      // One message for unknown user, wrong password and disabled account.
      return res.status(401).json({ error: 'Wrong username or password' });
    }

    // Clear both: a proven-good sign-in from this IP means the earlier failures
    // were fumbles, not an attack, and must not penalise the next person.
    attempts.delete(perAccount);
    attempts.delete(perIp);

    await db.query('update users set last_login_at = now() where id = $1', [user.id]);

    res.cookie(COOKIE_NAME, signToken(user), cookieOptions());
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

/** Cheap check the dashboard calls on load to decide gate vs content. */
router.get('/api/auth/me', async (req, res, next) => {
  try {
    const user = await userFromToken(req.cookies?.[COOKIE_NAME]);
    res.json({ authenticated: Boolean(user), user: user || null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
