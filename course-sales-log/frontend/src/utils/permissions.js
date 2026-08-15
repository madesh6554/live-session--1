/**
 * The page-permission seam.
 *
 * This app deliberately has NO roles — every account that can sign in gets
 * everything, including account management (see the README). So there is
 * nothing to filter yet, and this returns `null`.
 *
 * `null` is load-bearing, not a placeholder: it is the exact shape the nav and
 * tab filters branch on — `allowed ? xs.filter(...) : xs` — so the day per-user
 * page grants land, they land HERE and nowhere else. Returning an all-inclusive
 * Set instead would mean every new page has to remember to add itself to it.
 *
 * Page keys are the permission vocabulary:
 *   'overview' | 'log' | 'outstanding' | 'admin-settings'
 *   'admin-settings:<tab>'  — one per settings tab
 *
 * ⚠ Route keys are PERMANENT. Renaming one silently drops any stored per-user
 * override for it. Change a label freely; never change an id.
 */
export function usePagePermissions() {
  return null; // null = no restriction
}
