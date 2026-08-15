import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../utils/api';
import Topbar from '../components/Topbar';
import Sidebar, { NAV_ITEMS, DEFAULT_PAGE } from '../components/Sidebar';
import FilterBar from '../components/FilterBar';
import Overview from '../components/Overview';
import SalesTable from '../components/SalesTable';
import Outstanding from '../components/Outstanding';
import AdminSettingsPage, { ADMIN_PAGE } from './AdminSettingsPage';
import { Spinner } from '../components/ui';
import { C, FONT, T, W, LH } from '../constants';
import { useTheme } from '../theme';
import { applyChartTheme } from '../utils/chartSetup';
import Login from './Login';

// Only these pages are driven by the filter bar. Settings edits the lists, not
// the sales, so it has no window of data to narrow.
const FILTERED_PAGES = new Set(['overview', 'log', 'outstanding']);
const STATUS_PAGES = new Set(['log']);

const SUBTITLES = {
  overview:      'Collections, outstanding and the full picture',
  log:           'Every sale, with its payments and edit trail',
  outstanding:   'Unpaid and part-paid sales, biggest balance first',
  [ADMIN_PAGE]:  'The lists the entry form reads, and who may sign in',
};

// A pasted #admin-settings/<tab> link must land on the admin page, not on the
// default one with a hash nothing reads.
const pageFromHash = () =>
  window.location.hash.startsWith(`#${ADMIN_PAGE}/`) ? ADMIN_PAGE : null;

export default function Dashboard() {
  const [page, setPage] = useState(() => pageFromHash() || DEFAULT_PAGE);
  const [navOpen, setNavOpen] = useState(false);
  const [filters, setFilters] = useState({ page: 1 });
  const [authed, setAuthed] = useState(null); // null = still checking
  const [user, setUser] = useState(null);
  const { effective } = useTheme();

  // A canvas cannot read CSS variables, so Chart.js' global defaults have to be
  // re-pushed by hand every time the palette swaps.
  useEffect(() => { applyChartTheme(); }, [effective]);

  const check = useCallback(async () => {
    try {
      const { authenticated, user } = await apiGet('/api/auth/me');
      setAuthed(authenticated);
      setUser(user);
    } catch {
      setAuthed(false);
      setUser(null);
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  // If a session expires mid-session, any 401 drops straight back to the gate
  // rather than leaving broken panels on screen.
  useEffect(() => {
    const onUnauthorized = () => { setAuthed(false); setUser(null); };
    window.addEventListener('csl:unauthorized', onUnauthorized);
    return () => window.removeEventListener('csl:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e) => e.key === 'Escape' && setNavOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen]);

  const navigate = useCallback((next) => {
    setPage(next);
    if (next !== ADMIN_PAGE && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  async function logout() {
    try { await apiPost('/api/auth/logout', {}); } catch { /* already gone */ }
    setAuthed(false);
    setUser(null);
  }

  if (authed === null) {
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center', background: C.pageBg }}>
        <Spinner size={28} />
      </div>
    );
  }

  if (!authed) {
    return <Login onSuccess={(u) => { setUser(u); setAuthed(true); }} />;
  }

  // admin-settings is reachable but is NOT a nav item, so its title cannot come
  // from NAV_ITEMS — without this it silently fell back to "Overview".
  const title = page === ADMIN_PAGE
    ? 'Admin Settings'
    : (NAV_ITEMS.find((i) => i.id === page) || NAV_ITEMS[0]).label;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.pageBg }}>
      <Topbar user={user} onSignOut={logout}
        onAdminSettings={() => navigate(ADMIN_PAGE)}
        onMenu={() => setNavOpen((v) => !v)} />

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <Sidebar page={page} onNavigate={navigate}
          open={navOpen} onClose={() => setNavOpen(false)} />

        {/* The ONLY scrolling region. html/body are overflow:hidden, so the
            page never scrolls behind the topbar. */}
        <main style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          <div style={{ maxWidth: 1500, margin: '0 auto', padding: '22px 24px 40px' }}>
            <div style={{ marginBottom: 18 }}>
              <h1 style={{
                margin: 0, fontFamily: FONT, fontSize: T.h1, fontWeight: W.heavy,
                color: C.t1, letterSpacing: '-.02em', lineHeight: LH.tight,
              }}>{title}</h1>
              <p style={{
                margin: '4px 0 0', fontFamily: FONT, fontSize: T.body, color: C.t5,
              }}>{SUBTITLES[page]}</p>
            </div>

            {FILTERED_PAGES.has(page) && (
              <FilterBar value={filters} onChange={setFilters} showStatus={STATUS_PAGES.has(page)} />
            )}

            {page === 'overview' && <Overview filters={filters} />}
            {page === 'log' && <SalesTable filters={filters} onFilters={setFilters} />}
            {page === 'outstanding' && <Outstanding filters={filters} />}
            {page === ADMIN_PAGE && <AdminSettingsPage currentUser={user} />}
          </div>
        </main>
      </div>
    </div>
  );
}
