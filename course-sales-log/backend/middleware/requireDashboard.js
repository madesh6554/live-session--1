const { COOKIE_NAME, userFromToken } = require('../auth');

/**
 * Gates everything the dashboard reads or edits, and attaches req.user.
 *
 * Deliberately NOT applied to the handful of endpoints the open /entry page
 * needs: GET /api/products, GET /api/salespeople, GET /api/customers/lookup
 * and POST /api/sales. Those stay public so a salesperson can log a sale
 * without an account — see auth.js for why.
 */
async function requireDashboard(req, res, next) {
  try {
    const user = await userFromToken(req.cookies?.[COOKIE_NAME]);
    if (!user) return res.status(401).json({ error: 'Sign in to view the dashboard' });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Same check as a predicate, for endpoints that are only partly protected
 * (the customer lookup, and the `?all=1` variants of the config lists).
 */
async function isDashboard(req) {
  if (req.user) return true;
  try {
    const user = await userFromToken(req.cookies?.[COOKIE_NAME]);
    if (user) req.user = user;
    return Boolean(user);
  } catch {
    return false;
  }
}

module.exports = { requireDashboard, isDashboard };
