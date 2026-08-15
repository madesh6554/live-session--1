import { createContext, useContext, createElement } from 'react';

/**
 * The page-permission seam.
 *
 * An account with no role assigned is unrestricted — `usePagePermissions()`
 * returns `null`. An account WITH a role is limited to that role's
 * `permissions` list, supplied by the backend on `/api/auth/me` and threaded
 * down from Dashboard.jsx via `PermissionsProvider`.
 *
 * `null` is load-bearing, not a placeholder: it is the exact shape the nav and
 * tab filters branch on — `allowed ? xs.filter(...) : xs`. Returning an
 * all-inclusive Set instead would mean every new page has to remember to add
 * itself to it.
 *
 * Page keys are the permission vocabulary (PAIRED with backend/routes/roles.js
 * PAGE_KEYS and the Roles tab in AdminSettingsPage.jsx):
 *   'overview' | 'log' | 'outstanding' | 'admin-settings'
 *   'admin-settings:<tab>'  — one per settings tab
 *
 * ⚠ Route keys are PERMANENT. Renaming one silently drops any stored role
 * grant for it. Change a label freely; never change an id.
 */
const PermissionsCtx = createContext(null);

export function PermissionsProvider({ value, children }) {
  return createElement(PermissionsCtx.Provider, { value }, children);
}

export function usePagePermissions() {
  const perms = useContext(PermissionsCtx);
  return perms ? new Set(perms) : null;
}
