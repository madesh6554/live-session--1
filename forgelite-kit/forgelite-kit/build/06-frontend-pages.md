# Phase 6 — Frontend pages (wizard, dashboard, analytics)
The pages: login gate, dashboard shell, the 5-step entry wizard, admin
settings, and the three analytics panels.

> **Rule:** create every file below with EXACTLY the content shown — byte for byte. No reformatting, no renaming, no improvements, no extra comments. Paths are relative to the project root `course-sales-log/`.

**Files in this phase (7):** `frontend/src/pages/Login.jsx` · `frontend/src/pages/Dashboard.jsx` · `frontend/src/pages/Entry.jsx` · `frontend/src/pages/AdminSettingsPage.jsx` · `frontend/src/components/Overview.jsx` · `frontend/src/components/SalesTable.jsx` · `frontend/src/components/Outstanding.jsx`

---

#### FILE: frontend/src/pages/Login.jsx
````jsx
import { useState, useRef, useEffect } from 'react';
import { LogIn, Sun, Moon, Monitor } from 'lucide-react';
import { apiPost } from '../utils/api';
import { Field, Input, Button, ErrorMsg } from '../components/ui';
import { C, FONT, T, W, LH } from '../constants';
import { useTheme } from '../theme';

const CYCLE = { light: 'dark', dark: 'system', system: 'light' };
const THEME_ICON = { light: Sun, dark: Moon, system: Monitor };

/** Account sign-in for the dashboard. /entry never sees this. */
export default function Login({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const userRef = useRef(null);
  const { theme, setTheme } = useTheme();
  const ThemeIcon = THEME_ICON[theme] || Monitor;

  useEffect(() => { userRef.current?.focus(); }, []);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const { user } = await apiPost('/api/auth/login', { username, password });
      onSuccess(user);
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      height: '100%', display: 'grid', placeItems: 'center',
      background: C.pageBg, padding: 20, position: 'relative',
    }}>
      <button
        onClick={() => setTheme(CYCLE[theme] || 'light')}
        title={`Theme: ${theme}`}
        aria-label={`Theme: ${theme}`}
        style={{
          position: 'absolute', top: 20, right: 20,
          display: 'grid', placeItems: 'center', width: 36, height: 36,
          borderRadius: 9, background: C.surfaceInner,
          border: `1px solid ${C.border}`, color: C.t4, cursor: 'pointer',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = C.surfaceInner; }}
      >
        <ThemeIcon size={17} strokeWidth={2} />
      </button>

      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{
            fontFamily: FONT, fontSize: T.h2, fontWeight: 900,
            color: C.t1, textTransform: 'uppercase', letterSpacing: '-.01em',
            lineHeight: 1,
          }}>
            FORGELITE
          </div>
          <div style={{ fontFamily: FONT, fontSize: T.body, color: C.t5, marginTop: 7,
                        lineHeight: LH.snug }}>
            Sales Dashboard
          </div>
        </div>

        <form onSubmit={submit} style={{
          background: C.cardBg, border: `1px solid ${C.border}`,
          borderRadius: 14, padding: 22, boxShadow: C.shadowMd,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <Field label="Username">
            <Input inputRef={userRef} value={username} autoCapitalize="none" autoCorrect="off"
              autoComplete="username" placeholder="username"
              onChange={(e) => setUsername(e.target.value)} />
          </Field>

          <Field label="Password">
            <Input type="password" value={password} autoComplete="current-password"
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)} />
          </Field>

          <ErrorMsg>{error}</ErrorMsg>

          <Button type="submit" disabled={busy || !username || !password}>
            <LogIn size={16} strokeWidth={2} />
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
````

#### FILE: frontend/src/pages/Dashboard.jsx
````jsx
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
````

#### FILE: frontend/src/pages/Entry.jsx
````jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Check, UserSearch, ArrowRight, ArrowLeft, User, GraduationCap, Wallet,
  IdCard, ClipboardCheck, CircleCheckBig, Pencil,
} from 'lucide-react';
import { apiGet, apiPost } from '../utils/api';
import Topbar from '../components/Topbar';
import { Card, Field, SectionLabel, Input, Select, Button, ErrorMsg, Spinner,
         StatusBadge, Combobox, ChoiceList, useToast, ToastContainer } from '../components/ui';
import { C, FONT, MONO, T, W, LH, PAYMENT_MODES, GENDERS, PROFESSIONS, SOURCES,
         fmtMoney, fmtDate, isoDate } from '../constants';
import { useIsNarrow } from '../utils/useMediaQuery';

const EMPTY = {
  customer_phone: '',
  customer_name: '',
  customer_email: '',
  city: '',
  product_id: '',
  sale_price: '',
  sale_date: isoDate(),
  amount_received: '',
  payment_mode: 'UPI',
  gender: '',
  age: '',
  profession: '',
  source: '',
  notes: '',
};

// The salesperson rarely changes on a given machine, so it survives a save and
// is remembered across reloads — picked once, not re-picked thirty times a day.
const SALESPERSON_KEY = 'csl:salesperson';

/**
 * The wizard, in order. Everything derives from this array — the progress
 * label, the step rail, the validators, the review groups — so a step cannot
 * exist in one of those and be missing from another.
 */
const STEPS = [
  { key: 'customer', label: 'Customer', Icon: User },
  { key: 'course',   label: 'Course',   Icon: GraduationCap },
  { key: 'payment',  label: 'Payment',  Icon: Wallet },
  { key: 'student',  label: 'Student',  Icon: IdCard },
  { key: 'review',   label: 'Review',   Icon: ClipboardCheck },
];
const TOTAL = STEPS.length;

const digits = (v) => String(v || '').replace(/\D/g, '');

/**
 * Per-step validation. Each returns { fieldName: message }.
 *
 * Messages name the field and say what to do. A step that refuses to advance
 * behind a generic "please fill all required fields" is the exact defect this
 * shape exists to prevent.
 */
const VALIDATORS = {
  customer(f) {
    const e = {};
    const d = digits(f.customer_phone);
    if (!d) e.customer_phone = 'Enter the customer’s phone number';
    else if (d.length < 10) e.customer_phone = 'Phone number looks too short — 10 digits minimum';
    if (!f.customer_name.trim()) e.customer_name = 'Enter the customer’s name';
    if (f.customer_email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.customer_email.trim())) {
      e.customer_email = 'That email address doesn’t look right';
    }
    return e;
  },
  course(f) {
    const e = {};
    if (!f.product_id) e.product_id = 'Pick the course being sold';
    const price = Number(f.sale_price);
    if (String(f.sale_price).trim() === '') e.sale_price = 'Enter the agreed price';
    else if (!Number.isFinite(price) || price < 0) e.sale_price = 'Price must be a number';
    if (!f.sale_date) e.sale_date = 'Pick the sale date';
    return e;
  },
  payment(f, { salespersonId }) {
    const e = {};
    if (!salespersonId) e.salesperson_id = 'Pick who made this sale';
    if (String(f.amount_received).trim() !== '') {
      const amt = Number(f.amount_received);
      const price = Number(f.sale_price);
      if (!Number.isFinite(amt) || amt <= 0) e.amount_received = 'Amount must be more than 0';
      else if (Number.isFinite(price) && amt > price) {
        e.amount_received = `Can’t collect more than the ${fmtMoney(price)} sale price`;
      }
      if (!f.payment_mode) e.payment_mode = 'Pick how the money came in';
    }
    return e;
  },
  student(f) {
    const e = {};
    if (String(f.age).trim() !== '') {
      const n = Number(f.age);
      if (!Number.isInteger(n) || n < 5 || n > 99) e.age = 'Age must be between 5 and 99';
    }
    return e;
  },
  review() { return {}; },
};

export default function Entry() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [products, setProducts] = useState([]);
  const [salespeople, setSalespeople] = useState([]);
  const [salespersonId, setSalespersonId] = useState(
    () => { try { return localStorage.getItem(SALESPERSON_KEY) || ''; } catch { return ''; } }
  );
  const [match, setMatch] = useState(null);
  const [looking, setLooking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(null);   // the sale just written -> success screen
  const [recent, setRecent] = useState([]);
  const { toasts, push } = useToast();
  const narrow = useIsNarrow();

  const firstRef = useRef(null);
  const current = STEPS[step];

  useEffect(() => {
    apiGet('/api/products').then((d) => setProducts(d.products)).catch(() => {});
    apiGet('/api/salespeople').then((d) => setSalespeople(d.salespeople)).catch(() => {});
  }, []);

  // Autofocus the first field of EVERY step, not just the first screen — a
  // wizard that needs a click per step costs one on every step, every sale.
  useEffect(() => {
    if (saved) return;
    const t = setTimeout(() => firstRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [step, saved]);

  // Drop a remembered salesperson who has since been deactivated.
  useEffect(() => {
    if (!salespeople.length || !salespersonId) return;
    if (!salespeople.some((s) => String(s.id) === String(salespersonId))) setSalespersonId('');
  }, [salespeople, salespersonId]);

  function onSalesperson(id) {
    setSalespersonId(id);
    setErrors((e) => ({ ...e, salesperson_id: undefined }));
    try { localStorage.setItem(SALESPERSON_KEY, id); } catch { /* private mode */ }
  }

  // Editing a field clears its own error — an error that outlives the fix makes
  // the form look stuck.
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };

  /* ---- Phone type-ahead: find an existing customer while they type ---- */
  useEffect(() => {
    const phone = form.customer_phone.trim();
    if (phone.length < 4) { setMatch(null); return; }
    let cancelled = false;
    setLooking(true);
    const t = setTimeout(async () => {
      try {
        const d = await apiGet(`/api/customers/lookup?phone=${encodeURIComponent(phone)}`);
        if (!cancelled) setMatch(d.customer ? d : null);
      } catch {
        if (!cancelled) setMatch(null);
      } finally {
        if (!cancelled) setLooking(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.customer_phone]);

  const applyMatch = useCallback(() => {
    if (!match?.customer) return;
    setForm((f) => ({
      ...f,
      customer_name: match.customer.name || f.customer_name,
      customer_email: match.customer.email || f.customer_email,
    }));
    setErrors((e) => ({ ...e, customer_name: undefined }));
  }, [match]);

  function onProduct(id) {
    const p = products.find((x) => String(x.id) === String(id));
    setForm((f) => ({ ...f, product_id: id, sale_price: p ? String(Number(p.price)) : f.sale_price }));
    setErrors((e) => ({ ...e, product_id: undefined, sale_price: undefined }));
  }

  const listPrice = products.find((p) => String(p.id) === String(form.product_id))?.price;
  const discounted = listPrice !== undefined && form.sale_price !== ''
    && Number(form.sale_price) !== Number(listPrice);

  /* ------------------------------ navigation ----------------------------- */

  function validate(key) {
    const found = VALIDATORS[key](form, { salespersonId });
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  function next() {
    if (!validate(current.key)) return;
    setStep((s) => Math.min(s + 1, TOTAL - 1));
  }

  function back() {
    setErrors({});               // going back is not a failure — clear the red
    setStep((s) => Math.max(s - 1, 0));
  }

  /** Jump straight to a step from the review screen, or via the rail. */
  function editStep(key) {
    setErrors({});
    setStep(STEPS.findIndex((s) => s.key === key));
  }

  // Enter advances rather than submitting, except on Review where it saves.
  function onKeyDown(e) {
    if (e.key !== 'Enter') return;
    if (e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    if (current.key === 'review') submit();
    else next();
  }

  async function submit() {
    if (busy) return;
    setError('');
    // Re-run EVERY validator, not just the last step: a value can be edited from
    // Review and walked back into an invalid state.
    for (const s of STEPS) {
      const found = VALIDATORS[s.key](form, { salespersonId });
      if (Object.keys(found).length) {
        setErrors(found);
        setStep(STEPS.findIndex((x) => x.key === s.key));
        setError('Some details need fixing before this can be saved.');
        return;
      }
    }

    setBusy(true);
    try {
      const payload = { ...form, salesperson_id: salespersonId };
      if (!String(payload.amount_received).trim()) {
        delete payload.amount_received;
        delete payload.payment_mode;
      }
      const { sale } = await apiPost('/api/sales', payload);
      setRecent((r) => [sale, ...r].slice(0, 8));
      setSaved(sale);
      push(`Saved — ${sale.customer_name}, ${fmtMoney(sale.sale_price)}`);
    } catch (err) {
      // Stay on Review with everything intact. Losing four screens of typing to
      // a failed request is unforgivable on a form this long.
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  /** Start the next sale. Keeps the date and the salesperson; clears the rest. */
  function again() {
    setForm({ ...EMPTY, sale_date: form.sale_date });
    setErrors({});
    setMatch(null);
    setSaved(null);
    setError('');
    setStep(0);
  }

  const productName = products.find((p) => String(p.id) === String(form.product_id))?.name;
  const salespersonName = salespeople.find((s) => String(s.id) === String(salespersonId))?.name;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.pageBg }}>
      <Topbar right={
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: FONT, fontSize: T.body, fontWeight: W.bold,
                        color: C.headerText, lineHeight: LH.tight }}>New Sale</div>
          <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.headerMuted,
                        lineHeight: LH.tight }}>
            {saved ? 'Saved' : `${current.label} · Enter to continue`}
          </div>
        </div>
      } />

      <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{
          maxWidth: 940, margin: '0 auto',
          padding: narrow ? '18px 16px 110px' : '26px 24px 40px',
          display: 'grid', gap: 28, alignItems: 'start',
          // The form column is capped at the reference's width so a line of
          // input never becomes a 900px slab on a desktop monitor.
          gridTemplateColumns: narrow ? '1fr' : 'minmax(0, 460px) minmax(0, 300px)',
          justifyContent: 'center',
        }}>
          <div style={{ display: 'grid', gap: 16 }}>
            {saved ? (
              <SuccessScreen sale={saved} onAgain={again} />
            ) : (
              <div>
                <StepHeader step={step} narrow={narrow} />

                <form onKeyDown={onKeyDown} onSubmit={(e) => e.preventDefault()}
                  style={{ display: 'grid', gap: 18 }}>

                  {current.key === 'customer' && (
                    <StepCustomer {...{ form, set, errors, firstRef, looking, match, applyMatch, narrow }} />
                  )}
                  {current.key === 'course' && (
                    <StepCourse {...{ form, set, errors, firstRef, products, onProduct,
                                      discounted, listPrice, narrow }} />
                  )}
                  {current.key === 'payment' && (
                    <StepPayment {...{ form, set, errors, firstRef, salespeople,
                                       salespersonId, onSalesperson, narrow }} />
                  )}
                  {current.key === 'student' && (
                    <StepStudent {...{ form, set, errors, firstRef, narrow }} />
                  )}
                  {current.key === 'review' && (
                    <StepReview {...{ form, productName, salespersonName, onEdit: editStep }} />
                  )}

                  <ErrorMsg>{error}</ErrorMsg>
                </form>

                <StepFooter
                  step={step} busy={busy} narrow={narrow}
                  onBack={back} onNext={next} onSubmit={submit}
                />
              </div>
            )}
          </div>

          <SidePanel match={match} recent={recent} showMatch={!saved && step === 0} />
        </div>
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  );
}

/* ------------------------------- Chrome ---------------------------------- */

function StepHeader({ step, narrow }) {
  const pct = ((step + 1) / TOTAL) * 100;
  return (
    <div style={{ padding: narrow ? '0 0 14px' : '0 0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                    gap: 12, marginBottom: 8 }}>
        <div style={{ fontFamily: FONT, fontSize: T.h2, fontWeight: W.heavy, color: C.t1,
                      letterSpacing: '-.01em', lineHeight: LH.tight }}>
          {STEPS[step].label}
        </div>
        <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6, flexShrink: 0 }}>
          Step {step + 1} of {TOTAL}
        </div>
      </div>
      {/* One thin bar. It answers "how far in am I" without pretending the
          steps are freely navigable. */}
      <div style={{ height: 4, borderRadius: 999, background: C.surfaceMuted, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`,
                      background: C.primary, transition: 'width .25s ease' }} />
      </div>
    </div>
  );
}

function StepFooter({ step, busy, narrow, onBack, onNext, onSubmit }) {
  const last = step === TOTAL - 1;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginTop: 22,
      ...(narrow ? {
        // Pinned on a phone so the action never needs a scroll.
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60,
        padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
        background: C.cardBg, boxShadow: C.shadowMd, borderTop: `1px solid ${C.border}`,
        marginTop: 0,
      } : null),
    }}>
      {step > 0 && (
        <Button type="button" variant="ghost" onClick={onBack}
          style={{ height: 48, flexShrink: 0, paddingLeft: 16, paddingRight: 16 }}>
          <ArrowLeft size={17} strokeWidth={2} /> Back
        </Button>
      )}

      {/* The primary action fills the row. On the reference it is the single
          widest thing on screen, and it should be here too. */}
      {last ? (
        <Button type="button" onClick={onSubmit} disabled={busy}
          style={{ flex: 1, height: 48, fontSize: T.bodyLg }}>
          <Check size={18} strokeWidth={2.5} />
          {busy ? 'Saving…' : 'Save sale'}
        </Button>
      ) : (
        <Button type="button" onClick={onNext}
          style={{ flex: 1, height: 48, fontSize: T.bodyLg }}>
          Continue <ArrowRight size={17} strokeWidth={2} />
        </Button>
      )}
    </div>
  );
}

// One column, always. Two-up halves the width of every label and value, and
// this form is filled top-to-bottom on a phone.
const grid = () => ({ display: 'grid', gap: 18 });
const span2 = () => ({});

/* -------------------------------- Steps ---------------------------------- */

function StepCustomer({ form, set, errors, firstRef, looking, match, applyMatch, narrow }) {
  return (
    <div style={grid()}>
      <SectionLabel>Customer details</SectionLabel>

      <Field label="Phone" required style={span2()} error={errors.customer_phone}
        hint={looking ? 'Checking…' : 'Existing customers are matched as you type'}>
        <div style={{ position: 'relative' }}>
          <Input inputRef={firstRef} mono inputMode="tel" invalid={!!errors.customer_phone}
            value={form.customer_phone}
            onChange={(e) => set('customer_phone', e.target.value)}
            placeholder="9XXXXXXXXX" autoComplete="off" />
          {looking && (
            <Spinner size={16} style={{ position: 'absolute', right: 11, top: '50%',
                                        transform: 'translateY(-50%)' }} />
          )}
        </div>
      </Field>

      {match && (
        <button type="button" onClick={applyMatch}
          style={{
            ...span2(), marginTop: -8,
            display: 'flex', alignItems: 'center', gap: 9,
            borderRadius: 9, border: `1px solid ${C.infoBorder}`, background: C.infoBg,
            padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
            color: C.infoText, fontFamily: FONT, fontSize: T.body, lineHeight: LH.snug,
          }}>
          <UserSearch size={17} strokeWidth={2} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            <strong>{match.customer.name}</strong> has {match.history.length} earlier sale
            {match.history.length === 1 ? '' : 's'} — click to fill
          </span>
          <ArrowRight size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
        </button>
      )}

      <Field label="Customer name" required error={errors.customer_name}>
        <Input value={form.customer_name} invalid={!!errors.customer_name}
          onChange={(e) => set('customer_name', e.target.value)} placeholder="Full name" />
      </Field>

      <Field label="City" hint="Where they're based">
        <Input value={form.city} onChange={(e) => set('city', e.target.value)}
          placeholder="e.g. Coimbatore" />
      </Field>

      <Field label="Email" hint="Optional" error={errors.customer_email} style={span2()}>
        <Input type="email" value={form.customer_email} invalid={!!errors.customer_email}
          onChange={(e) => set('customer_email', e.target.value)}
          placeholder="optional@example.com" />
      </Field>
    </div>
  );
}

function StepCourse({ form, set, errors, firstRef, products, onProduct, discounted, listPrice, narrow }) {
  return (
    <div style={grid()}>
      <SectionLabel>Course &amp; price</SectionLabel>

      <Field label="Course" required style={span2()} error={errors.product_id}>
        <Select value={form.product_id} onChange={onProduct}
          placeholder="Select a course…"
          options={products.map((p) => ({ value: p.id, label: `${p.name} — ${fmtMoney(p.price)}` }))} />
      </Field>

      <Field label="Sale price" required error={errors.sale_price}
        hint={discounted ? `List price is ${fmtMoney(listPrice)}` : 'Auto-filled from the course'}>
        <Input inputRef={firstRef} mono inputMode="decimal" invalid={!!errors.sale_price}
          value={form.sale_price} onChange={(e) => set('sale_price', e.target.value)}
          placeholder="0" />
      </Field>

      <Field label="Sale date" required error={errors.sale_date}>
        <Input mono type="date" value={form.sale_date} invalid={!!errors.sale_date}
          onChange={(e) => set('sale_date', e.target.value)} />
      </Field>
    </div>
  );
}

function StepPayment({ form, set, errors, firstRef, salespeople, salespersonId, onSalesperson, narrow }) {
  const collecting = String(form.amount_received).trim() !== '';
  return (
    <div style={grid()}>
      <SectionLabel>Payment</SectionLabel>

      <Field label="Amount received now" error={errors.amount_received}
        hint="Leave blank if nothing collected yet">
        <Input inputRef={firstRef} mono inputMode="decimal" invalid={!!errors.amount_received}
          value={form.amount_received} onChange={(e) => set('amount_received', e.target.value)}
          placeholder="0" />
      </Field>

      {collecting && (
        <Field label="Payment mode" required error={errors.payment_mode}
          hint="How the money came in">
          <ChoiceList name="Payment mode" columns={2}
            value={form.payment_mode} onChange={(v) => set('payment_mode', v)}
            options={PAYMENT_MODES} />
        </Field>
      )}

      <Field label="Salesperson" required style={span2()} error={errors.salesperson_id}
        hint={salespersonId ? 'Remembered on this machine' : 'Start typing a name'}>
        <Combobox value={salespersonId} onChange={onSalesperson}
          invalid={!salespersonId || !!errors.salesperson_id}
          placeholder="Type a name…"
          options={salespeople.map((s) => ({ value: s.id, label: s.name }))} />
      </Field>
    </div>
  );
}

function StepStudent({ form, set, errors, firstRef, narrow }) {
  return (
    <div style={grid()}>
      <SectionLabel>Student profile</SectionLabel>

      <div style={{ ...span2(), fontFamily: FONT, fontSize: T.meta, color: C.t5,
                    lineHeight: LH.snug, marginBottom: -4 }}>
        All optional — the sale saves without any of it. These are what the dashboard
        slices by, so a few seconds here is what makes &ldquo;which channel is working?&rdquo;
        answerable later.
      </div>

      <Field label="How did they find us?">
        <Select value={form.source} onChange={(v) => set('source', v)}
          placeholder="Not recorded"
          options={[{ value: '', label: 'Not recorded' },
                    ...SOURCES.map((x) => ({ value: x, label: x }))]} />
      </Field>

      <Field label="Profession">
        <Select value={form.profession} onChange={(v) => set('profession', v)}
          placeholder="Not recorded"
          options={[{ value: '', label: 'Not recorded' },
                    ...PROFESSIONS.map((x) => ({ value: x, label: x }))]} />
      </Field>

      <Field label="Gender" hint="Tap again to clear">
        <ChoiceList name="Gender" columns={3} allowClear
          value={form.gender} onChange={(v) => set('gender', v)} options={GENDERS} />
      </Field>

      <Field label="Age" error={errors.age} hint="Between 5 and 99">
        <Input inputRef={firstRef} inputMode="numeric" invalid={!!errors.age}
          value={form.age}
          onChange={(e) => set('age', e.target.value.replace(/\D/g, '').slice(0, 2))}
          placeholder="e.g. 27" />
      </Field>

      <Field label="Notes" hint="Optional" style={span2()}>
        <Input value={form.notes} onChange={(e) => set('notes', e.target.value)}
          placeholder="Anything worth remembering" />
      </Field>
    </div>
  );
}

/* -------------------------------- Review --------------------------------- */

function StepReview({ form, productName, salespersonName, onEdit }) {
  const collected = String(form.amount_received).trim() === '' ? 0 : Number(form.amount_received);
  const price = Number(form.sale_price || 0);
  const status = collected <= 0 ? 'unpaid' : collected >= price ? 'paid' : 'partial';

  const groups = [
    { key: 'customer', label: 'Customer', rows: [
      ['Name', form.customer_name],
      ['Phone', form.customer_phone],
      ['City', form.city],
      ['Email', form.customer_email],
    ]},
    { key: 'course', label: 'Course', rows: [
      ['Course', productName],
      ['Sale price', price ? fmtMoney(price) : ''],
      ['Sale date', fmtDate(form.sale_date)],
    ]},
    { key: 'payment', label: 'Payment', rows: [
      ['Received now', collected ? fmtMoney(collected) : 'Nothing yet'],
      ['Mode', collected ? form.payment_mode : ''],
      ['Outstanding', fmtMoney(Math.max(price - collected, 0))],
      ['Sold by', salespersonName],
    ]},
    { key: 'student', label: 'Student', rows: [
      ['Found us on', form.source],
      ['Profession', form.profession],
      ['Gender', form.gender],
      ['Age', form.age],
      ['Notes', form.notes],
    ]},
  ];

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: FONT, fontSize: T.meta, color: C.t5 }}>
          This is exactly what will be saved.
        </span>
        <StatusBadge status={status} />
      </div>

      {groups.map((g) => {
        const filled = g.rows.filter(([, v]) => String(v ?? '').trim() !== '');
        return (
          <div key={g.key} style={{ border: `1px solid ${C.border}`, borderRadius: 11,
                                    background: C.surfaceInner, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                          padding: '9px 12px', borderBottom: `1px solid ${C.divider}` }}>
              <span style={{ flex: 1, fontFamily: MONO, fontSize: T.label, color: C.t5,
                             textTransform: 'uppercase', letterSpacing: '.07em' }}>
                {g.label}
              </span>
              {/* Edit jumps straight to that step. A review whose only way back
                  is the Back button is a review you cannot act on. */}
              <button type="button" onClick={() => onEdit(g.key)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                         background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                         color: C.primary, fontFamily: FONT, fontSize: T.micro, fontWeight: W.medium }}>
                <Pencil size={12} strokeWidth={2.5} /> Edit
              </button>
            </div>

            {filled.length === 0 ? (
              <div style={{ padding: '10px 12px', fontFamily: FONT, fontSize: T.meta, color: C.t7 }}>
                Nothing recorded
              </div>
            ) : (
              <div style={{ padding: '4px 12px 8px' }}>
                {filled.map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 12, padding: '6px 0',
                                        alignItems: 'baseline' }}>
                    <span style={{ width: 116, flexShrink: 0, fontFamily: FONT,
                                   fontSize: T.meta, color: C.t6 }}>{k}</span>
                    <span style={{ flex: 1, fontFamily: FONT, fontSize: T.body, color: C.t1,
                                   wordBreak: 'break-word' }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------- Success -------------------------------- */

function SuccessScreen({ sale, onAgain }) {
  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                    textAlign: 'center', padding: '18px 8px 8px', gap: 12 }}>
        <CircleCheckBig size={44} strokeWidth={1.75} style={{ color: C.successText }} />
        <div>
          <div style={{ fontFamily: FONT, fontSize: T.h2, fontWeight: W.heavy, color: C.t1,
                        lineHeight: LH.tight }}>Sale recorded</div>
          <div style={{ fontFamily: FONT, fontSize: T.body, color: C.t5, marginTop: 5 }}>
            {sale.customer_name} · {sale.product_name}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center',
                      padding: '4px 0 6px' }}>
          <Figure label="Sale" value={fmtMoney(sale.sale_price)} />
          <Figure label="Collected" value={fmtMoney(sale.collected)} tone={C.successText} />
          <Figure label="Outstanding" value={fmtMoney(sale.outstanding)}
            tone={Number(sale.outstanding) > 0 ? C.warnText : C.t7} />
        </div>

        {/* The reference number is the receipt — the one thing here the
            salesperson cannot reconstruct from memory. */}
        <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6 }}>
          Reference #{sale.id}
        </div>

        <Button onClick={onAgain} style={{ marginTop: 4 }}>
          <ArrowRight size={16} strokeWidth={2} /> Log another sale
        </Button>
      </div>
    </Card>
  );
}

function Figure({ label, value, tone }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6,
                    textTransform: 'uppercase', letterSpacing: '.07em' }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: T.lead, fontWeight: W.bold,
                    color: tone || C.t1, marginTop: 2 }}>{value}</div>
    </div>
  );
}

/* ------------------------------ Side panel ------------------------------- */

function SidePanel({ match, recent, showMatch }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {recent.length > 0 && (
        <Card title="Saved this session" tag={String(recent.length)}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recent.map((s, i) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                gap: 10, padding: '10px 0',
                borderBottom: i === recent.length - 1 ? 'none' : `1px solid ${C.rowSep}`,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: FONT, fontSize: T.body, color: C.t1,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.customer_name}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.product_name}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: MONO, fontSize: T.body, color: C.t1, marginBottom: 4 }}>
                    {fmtMoney(s.sale_price)}
                  </div>
                  <StatusBadge status={s.payment_status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {showMatch && match?.history?.length > 0 && (
        <Card title="Earlier sales" tag={String(match.history.length)}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {match.history.map((h, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, padding: '9px 0',
                borderBottom: i === match.history.length - 1 ? 'none' : `1px solid ${C.rowSep}`,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: FONT, fontSize: T.body, color: C.t1,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.product_name}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6 }}>
                    {fmtDate(h.sale_date)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: MONO, fontSize: T.meta, color: C.t1, marginBottom: 4 }}>
                    {fmtMoney(h.sale_price)}
                  </div>
                  <StatusBadge status={h.payment_status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
````

#### FILE: frontend/src/pages/AdminSettingsPage.jsx
````jsx
import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  SlidersHorizontal, GraduationCap, Users, ShieldCheck, Lock,
  Sun, Moon, Monitor, Plus, Pencil, Eye, EyeOff, KeyRound, Ban, CircleCheck, UserPlus,
} from 'lucide-react';
import { apiGet, apiPost, apiPatch } from '../utils/api';
import { Card, Button, IconButton, Input, ErrorMsg, Spinner, EmptyState,
         useToast, ToastContainer } from '../components/ui';
import { C, FONT, MONO, T, W, LH, fmtMoney, fmtNum, fmtDateTime } from '../constants';
import { useTheme } from '../theme';
import { usePagePermissions } from '../utils/permissions';

/** The nav destination this page owns. Permanent — see permissions.js. */
export const ADMIN_PAGE = 'admin-settings';

const TABS = [
  { key: 'general',     label: 'General',     Icon: SlidersHorizontal },
  { key: 'products',    label: 'Products',    Icon: GraduationCap },
  { key: 'salespeople', label: 'Salespeople', Icon: Users },
  { key: 'accounts',    label: 'Accounts',    Icon: ShieldCheck },
];

const THEMES = [
  { key: 'light',  label: 'Light',  Icon: Sun },
  { key: 'dark',   label: 'Dark',   Icon: Moon },
  { key: 'system', label: 'System', Icon: Monitor },
];

// Each tab IS a page key in the permission vocabulary. DERIVED from the tab key
// so the strip and the grant list cannot name different things.
const pageKey = (t) => `${ADMIN_PAGE}:${t.key}`;

// DERIVED. A hand-maintained copy is how a shipped tab renders its button, sets
// the hash, then silently falls through to visibleTabs[0] and shows General —
// with no error anywhere. That is the bug this one line exists to prevent.
const VALID_TABS = TABS.map((t) => t.key);

const HASH_PREFIX = `#${ADMIN_PAGE}/`;

/** The tab named by the URL hash, or null when the hash names no real tab. */
function tabFromHash() {
  const h = window.location.hash;
  if (!h.startsWith(HASH_PREFIX)) return null;
  const key = h.slice(HASH_PREFIX.length);
  return VALID_TABS.includes(key) ? key : null;
}

/**
 * Admin settings.
 *
 * Manages the lists the entry form depends on, plus the accounts that may read
 * the numbers. Nothing is ever deleted — rows are deactivated, so old sales
 * keep resolving their product and salesperson names.
 *
 * Tabs are hash-routed (`#admin-settings/products`), so a particular tab is
 * linkable and survives a refresh.
 */
export default function AdminSettingsPage({ currentUser }) {
  const allowed = usePagePermissions();
  const { toasts, push } = useToast();

  const visibleTabs = useMemo(
    () => (allowed ? TABS.filter((t) => allowed.has(pageKey(t))) : TABS),
    [allowed]
  );

  const [tab, setTab] = useState(() => tabFromHash() || visibleTabs[0]?.key);

  const select = useCallback((key) => {
    setTab(key);
    // replaceState, not location.hash — pushing would make Back walk every tab
    // the user clicked before it left the page. It also does not fire
    // hashchange, so this cannot loop with the listener below.
    window.history.replaceState(null, '', `${window.location.pathname}${HASH_PREFIX}${key}`);
  }, []);

  // Follow the hash, including back/forward and a pasted link.
  //
  // ⚠ The `else` is the whole point. A hash naming no real tab used to be
  // ignored, which left the address bar advertising `#admin-settings/webhooks`
  // while Salespeople sat on screen — the URL and the UI disagreeing, silently.
  // An unusable hash is corrected to whatever is actually rendered.
  useEffect(() => {
    const onHash = () => {
      const t = tabFromHash();
      if (t) setTab(t);
      else select(tab);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [tab, select]);

  // Same reconciliation for the FIRST paint, where no hashchange ever fires:
  // an unknown tab falls back to the first visible one, and a missing or stale
  // hash is rewritten to match what is being shown.
  useEffect(() => {
    if (!visibleTabs.length) return;
    if (!VALID_TABS.includes(tab)) { select(visibleTabs[0].key); return; }
    if (tabFromHash() !== tab) select(tab);
  }, [tab, visibleTabs, select]);

  if (!visibleTabs.length) {
    return <Denied title="No settings available"
      hint="Your account has no settings pages granted." />;
  }

  // A hash naming a REAL tab this account may not open is a permission denial,
  // not a typo — say so instead of quietly rendering a different tab.
  const permitted = visibleTabs.some((t) => t.key === tab);
  const known = VALID_TABS.includes(tab);

  return (
    <div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 18,
        borderBottom: `1px solid ${C.border}`,
      }}>
        {visibleTabs.map((t) => {
          const on = tab === t.key;
          return (
            <button key={t.key} onClick={() => select(t.key)} data-tab={pageKey(t)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '0 14px', height: 40,
                background: 'transparent', border: 'none',
                borderBottom: `2px solid ${on ? C.primary : 'transparent'}`,
                marginBottom: -1,
                color: on ? C.primary : C.t4,
                fontFamily: FONT, fontSize: T.body, fontWeight: on ? W.bold : W.medium,
                cursor: 'pointer',
              }}
            >
              <t.Icon size={16} strokeWidth={2} />
              {t.label}
            </button>
          );
        })}
      </div>

      {known && !permitted ? (
        <Denied title="Not available on this account"
          hint={`The "${TABS.find((t) => t.key === tab)?.label}" tab is not granted to you.`} />
      ) : (
        <>
          {tab === 'general' && <GeneralTab />}
          {tab === 'products' && <ProductManager onToast={push} />}
          {tab === 'salespeople' && <SalespersonManager onToast={push} />}
          {tab === 'accounts' && <UserManager onToast={push} currentUser={currentUser} />}
        </>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}

function Denied({ title, hint }) {
  return (
    <Card>
      <EmptyState Icon={Lock} title={title} hint={hint} />
    </Card>
  );
}

/* ------------------------------- General -------------------------------- */

function GeneralTab() {
  const { theme, setTheme, effective } = useTheme();

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                  alignItems: 'start' }}>
      <Card title="Appearance">
        <div style={{ fontFamily: FONT, fontSize: T.body, color: C.t4, lineHeight: LH.snug, marginBottom: 14 }}>
          Saved on this device. <strong style={{ color: C.t2 }}>System</strong> follows your OS
          setting and switches live when it changes.
        </div>

        <div style={{
          display: 'flex', gap: 3, padding: 4,
          background: C.surfaceInner, border: `1px solid ${C.border}`, borderRadius: 11,
        }}>
          {THEMES.map((t) => {
            const on = theme === t.key;
            return (
              <button key={t.key} onClick={() => setTheme(t.key)}
                style={{
                  flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  height: 38, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: on ? C.primary : 'transparent',
                  color: on ? '#fff' : C.t3,
                  fontFamily: FONT, fontSize: T.body, fontWeight: on ? W.bold : W.medium,
                }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = C.hover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = on ? C.primary : 'transparent'; }}
              >
                <t.Icon size={16} strokeWidth={2} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6, marginTop: 11 }}>
          Currently rendering: {effective}
        </div>
      </Card>

      <Card title="How the money works">
        <ul style={{
          margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 9,
          fontFamily: FONT, fontSize: T.body, color: C.t4, lineHeight: LH.snug,
        }}>
          <li>
            <strong style={{ color: C.t2 }}>Nothing about money is stored as a calculated
            value.</strong> Collected, outstanding and paid / partial / unpaid are derived at
            query time by the <code style={{ fontFamily: MONO, fontSize: T.micro }}>v_sales</code> view.
          </li>
          <li>
            <strong style={{ color: C.t2 }}>Sale price is the one exception</strong> — it is the
            price agreed at the time, a fact rather than a calculation. Changing a product&apos;s
            price never rewrites past sales.
          </li>
          <li>
            <strong style={{ color: C.t2 }}>A sale is the deal; a payment is one instalment.</strong>{' '}
            Partial payment is a first-class state, not an edge case.
          </li>
          <li>
            <strong style={{ color: C.t2 }}>Sales are never deleted</strong> — the row is marked
            and filtered out of every read path.
          </li>
        </ul>
      </Card>
    </div>
  );
}

/* ------------------------------ Row shell -------------------------------- */

function ListRow({ inactive, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '9px 0', borderBottom: `1px solid ${C.rowSep}`,
      opacity: inactive ? 0.5 : 1,
    }}>
      {children}
    </div>
  );
}

const footNote = {
  fontFamily: FONT, fontSize: T.micro, color: C.t6,
  marginTop: 14, marginBottom: 0, lineHeight: LH.snug,
};

/* ------------------------------- Products -------------------------------- */

function ProductManager({ onToast }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await apiGet('/api/products?all=1');
      setRows(d.products);
      setError('');
    } catch (err) {
      setError(err.message);
      setRows([]); // stop the spinner — a failed load is not a pending one
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await apiPost('/api/products', { name, price });
      setName(''); setPrice('');
      await load();
      onToast('Product added');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function save(id, patch, message) {
    setError('');
    try {
      await apiPatch(`/api/products/${id}`, patch);
      setEditing(null);
      await load();
      onToast(message);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Card title="Products" tag={rows ? String(rows.length) : '…'}>
      <form onSubmit={add} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <Input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Course name" style={{ flex: 1, minWidth: 170 }} />
        <Input mono inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)}
          placeholder="Price" style={{ width: 120, flex: '0 0 auto' }} />
        <Button type="submit" disabled={busy || !name || !price}>
          <Plus size={16} strokeWidth={2.5} /> Add
        </Button>
      </form>

      <ErrorMsg>{error}</ErrorMsg>

      {!rows ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 32 }}><Spinner /></div>
      ) : !rows.length ? (
        <EmptyState Icon={GraduationCap} title="No products yet"
          hint="Add one above — the entry form reads this list." />
      ) : (
        <div>
          {rows.map((p) => (
            <ListRow key={p.id} inactive={!p.active}>
              {editing === p.id ? (
                <InlineProductEdit product={p}
                  onCancel={() => setEditing(null)}
                  onSave={(patch) => save(p.id, patch, 'Product updated')} />
              ) : (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT, fontSize: T.body, color: C.t1,
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6 }}>
                      {fmtMoney(p.price)} · {fmtNum(p.sale_count)} sale{p.sale_count === 1 ? '' : 's'}
                      {!p.active && ' · inactive'}
                    </div>
                  </div>
                  <IconButton Icon={Pencil} title={`Edit ${p.name}`} onClick={() => setEditing(p.id)} />
                  <IconButton Icon={p.active ? EyeOff : Eye}
                    title={p.active ? `Deactivate ${p.name}` : `Reactivate ${p.name}`}
                    onClick={() => save(p.id, { active: !p.active }, p.active ? 'Deactivated' : 'Reactivated')} />
                </>
              )}
            </ListRow>
          ))}
        </div>
      )}

      <p style={footNote}>
        Changing a price never alters past sales — each sale stores the price agreed at the time.
      </p>
    </Card>
  );
}

function InlineProductEdit({ product, onSave, onCancel }) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(Number(product.price)));

  return (
    <form style={{ display: 'flex', flex: 1, flexWrap: 'wrap', gap: 8 }}
      onSubmit={(e) => { e.preventDefault(); onSave({ name, price }); }}>
      <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus
        style={{ flex: 1, minWidth: 140, height: 32, fontSize: T.meta }} />
      <Input mono inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)}
        style={{ width: 100, flex: '0 0 auto', height: 32, fontSize: T.meta }} />
      <Button type="submit" size="sm">Save</Button>
      <Button type="button" size="sm" variant="subtle" onClick={onCancel}>Cancel</Button>
    </form>
  );
}

/* ----------------------------- Salespeople ------------------------------- */

function SalespersonManager({ onToast }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await apiGet('/api/salespeople?all=1');
      setRows(d.salespeople);
      setError('');
    } catch (err) {
      setError(err.message);
      setRows([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await apiPost('/api/salespeople', { name });
      setName('');
      await load();
      onToast('Salesperson added');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function save(id, patch, message) {
    setError('');
    try {
      await apiPatch(`/api/salespeople/${id}`, patch);
      setEditing(null);
      await load();
      onToast(message);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Card title="Salespeople" tag={rows ? String(rows.length) : '…'}>
      <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Full name" style={{ flex: 1 }} />
        <Button type="submit" disabled={busy || !name}>
          <Plus size={16} strokeWidth={2.5} /> Add
        </Button>
      </form>

      <ErrorMsg>{error}</ErrorMsg>

      {!rows ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 32 }}><Spinner /></div>
      ) : !rows.length ? (
        <EmptyState Icon={Users} title="No salespeople yet"
          hint="Add one above — the entry form can't save a sale without it." />
      ) : (
        <div>
          {rows.map((s) => (
            <ListRow key={s.id} inactive={!s.active}>
              {editing === s.id ? (
                <form style={{ display: 'flex', flex: 1, gap: 8 }}
                  onSubmit={(e) => { e.preventDefault(); save(s.id, { name: draft }, 'Renamed'); }}>
                  <Input value={draft} autoFocus onChange={(e) => setDraft(e.target.value)}
                    style={{ flex: 1, height: 32, fontSize: T.meta }} />
                  <Button type="submit" size="sm">Save</Button>
                  <Button type="button" size="sm" variant="subtle" onClick={() => setEditing(null)}>Cancel</Button>
                </form>
              ) : (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT, fontSize: T.body, color: C.t1,
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6 }}>
                      {fmtNum(s.sale_count)} sale{s.sale_count === 1 ? '' : 's'}
                      {!s.active && ' · inactive'}
                    </div>
                  </div>
                  <IconButton Icon={Pencil} title={`Rename ${s.name}`}
                    onClick={() => { setEditing(s.id); setDraft(s.name); }} />
                  <IconButton Icon={s.active ? EyeOff : Eye}
                    title={s.active ? `Deactivate ${s.name}` : `Reactivate ${s.name}`}
                    onClick={() => save(s.id, { active: !s.active }, s.active ? 'Deactivated' : 'Reactivated')} />
                </>
              )}
            </ListRow>
          ))}
        </div>
      )}

      <p style={footNote}>
        Deactivating hides someone from the entry form but keeps all their past sales.
      </p>
    </Card>
  );
}

/* -------------------------- Dashboard accounts --------------------------- */

/**
 * Accounts that can sign in to the dashboard.
 *
 * Unrelated to the salespeople list: salespeople are who a sale is credited to,
 * these are who can read the numbers. Everyone here has the same permissions.
 */
function UserManager({ onToast, currentUser }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', name: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await apiGet('/api/users');
      setRows(d.users);
      setError('');
    } catch (err) {
      setError(err.message);
      setRows([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await apiPost('/api/users', form);
      setForm({ username: '', name: '', password: '' });
      await load();
      onToast('Account created');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function save(id, patch, message) {
    setError('');
    try {
      await apiPatch(`/api/users/${id}`, patch);
      setResetting(null);
      setNewPassword('');
      await load();
      onToast(message);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Card title="Dashboard accounts" tag={rows ? String(rows.length) : '…'}>
      <form onSubmit={add} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <Input value={form.username} autoCapitalize="none" autoCorrect="off" placeholder="username"
          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          style={{ flex: 1, minWidth: 150 }} />
        <Input value={form.name} placeholder="Display name (optional)"
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          style={{ flex: 1, minWidth: 150 }} />
        <Input type="password" value={form.password} placeholder="Password (6+ chars)"
          autoComplete="new-password"
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          style={{ flex: 1, minWidth: 150 }} />
        <Button type="submit" disabled={busy || !form.username || !form.password}>
          <UserPlus size={16} strokeWidth={2} /> Add
        </Button>
      </form>

      <ErrorMsg>{error}</ErrorMsg>

      {!rows ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 32 }}><Spinner /></div>
      ) : !rows.length ? (
        <EmptyState Icon={ShieldCheck} title="No accounts yet" />
      ) : (
        <div>
          {rows.map((u) => {
            const isMe = currentUser && u.id === currentUser.id;
            return (
              <ListRow key={u.id} inactive={!u.active}>
                {resetting === u.id ? (
                  <form style={{ display: 'flex', flex: 1, flexWrap: 'wrap', gap: 8 }}
                    onSubmit={(e) => { e.preventDefault(); save(u.id, { password: newPassword }, 'Password changed'); }}>
                    <Input type="password" value={newPassword} autoFocus
                      placeholder="New password (6+ chars)" autoComplete="new-password"
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{ flex: 1, minWidth: 160, height: 32, fontSize: T.meta }} />
                    <Button type="submit" size="sm" disabled={newPassword.length < 6}>Set</Button>
                    <Button type="button" size="sm" variant="subtle"
                      onClick={() => { setResetting(null); setNewPassword(''); }}>Cancel</Button>
                  </form>
                ) : (
                  <>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONT, fontSize: T.body, color: C.t1,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.name}
                        {isMe && (
                          <span style={{ color: C.primary, fontSize: T.micro, marginLeft: 6,
                                         fontWeight: W.bold }}>you</span>
                        )}
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.username}
                        {' · '}
                        {u.last_login_at ? `last in ${fmtDateTime(u.last_login_at)}` : 'never signed in'}
                        {!u.active && ' · disabled'}
                      </div>
                    </div>
                    <IconButton Icon={KeyRound} title={`Change password for ${u.username}`}
                      onClick={() => { setResetting(u.id); setNewPassword(''); }} />
                    <IconButton Icon={u.active ? Ban : CircleCheck}
                      danger={u.active}
                      title={u.active ? `Disable ${u.username}` : `Enable ${u.username}`}
                      onClick={() => save(u.id, { active: !u.active }, u.active ? 'Account disabled' : 'Account enabled')} />
                  </>
                )}
              </ListRow>
            );
          })}
        </div>
      )}

      <p style={footNote}>
        Everyone here has the same access, including this page. Accounts are never deleted —
        disabling one ends its sessions immediately. The last active account can&apos;t be
        disabled, so you can&apos;t lock yourself out.
      </p>
    </Card>
  );
}
````

#### FILE: frontend/src/components/Overview.jsx
````jsx
import { Fragment, useEffect, useState, useCallback, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { LineChart, Trophy, GraduationCap, Wallet, CircleCheckBig,
         Megaphone, Briefcase } from 'lucide-react';
import { apiGet } from '../utils/api';
import { Card, StatCard, Spinner, EmptyState, ErrorMsg, HBar, Meter, StackedBar,
         StatusBadge, TableScroll, tableStyle, thStyle, tdStyle } from './ui';
import { C, FONT, MONO, T, W, LH, STATUS, magnitudeColor, hasActiveFilters,
         fmtMoney, fmtMoneyShort, fmtNum, fmtDate, buildQuery, initials } from '../constants';
import { useTheme } from '../theme';
import { cssVar } from '../utils/chartSetup';
import { useIsNarrow } from '../utils/useMediaQuery';

export default function Overview({ filters }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await apiGet(`/api/dashboard/summary${buildQuery({ ...filters, page: undefined })}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const k = data?.kpis;

  return (
    <div>
      <ErrorMsg onRetry={load}>{error}</ErrorMsg>

      <HeadlineRow k={k} loading={loading && !data} />

      {loading && !data ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: '80px 0' }}>
          <Spinner size={28} />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
          <TrendCard trend={data?.trend || []} />

          <LeaderboardCard rows={data?.leaderboard || []} filters={filters}
            openId={openId} setOpenId={setOpenId} />

          <div style={{ display: 'grid', gap: 16,
                        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))' }}>
            <ProductCard rows={data?.by_product || []} />
            <ModeCard rows={data?.by_mode || []} />
          </div>

          <div style={{ display: 'grid', gap: 16,
                        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))' }}>
            <SourceCard rows={data?.by_source || []} />
            <ProfessionCard rows={data?.by_profession || []} genders={data?.by_gender || []} />
          </div>

          <OutstandingCard rows={data?.top_outstanding || []} total={k?.outstanding}
            openCount={Number(k?.partial_count || 0) + Number(k?.unpaid_count || 0)} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Headline row ------------------------------ */

/**
 * Collected is the number this page exists to report, so it gets a hero figure
 * and a meter against Expected — a single ratio against a limit, which is a
 * meter's exact job rather than a two-slice pie.
 *
 * The remaining four are a KPI row beside it. The old layout gave all five equal
 * weight and wrapped 3-then-2, which said "these are equally important" while
 * looking like a mistake.
 */
function HeadlineRow({ k, loading }) {
  const narrow = useIsNarrow();
  const collected = Number(k?.collected || 0);
  const expected = Number(k?.expected || 0);
  const rate = expected > 0 ? Math.round((collected / expected) * 100) : 0;

  const statuses = [
    { key: 'paid',    label: 'Paid',    value: Number(k?.paid_count || 0) },
    { key: 'partial', label: 'Partial', value: Number(k?.partial_count || 0) },
    { key: 'unpaid',  label: 'Unpaid',  value: Number(k?.unpaid_count || 0) },
  ];

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))' }}>
      {/* Flex column so the card fills the row height gracefully: the status
          split is pushed to the bottom edge rather than leaving a dead band
          under it when the tile grid beside it is taller. */}
      <div style={{
        background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: 18, position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                      background: C.successText }} />
        <div style={{ fontFamily: MONO, fontSize: T.label, color: C.t5,
                      textTransform: 'uppercase', letterSpacing: '.08em' }}>
          Collected
        </div>

        {loading ? (
          <div style={{ height: 44, width: 180, borderRadius: 6, background: C.surfaceMuted,
                        margin: '10px 0' }} />
        ) : (
          <div style={{
            fontFamily: MONO, fontSize: narrow ? 34 : 44, fontWeight: W.heavy, lineHeight: 1.05,
            color: C.successText, letterSpacing: '-.02em', margin: '6px 0 14px',
          }}>{fmtMoneyShort(collected)}</div>
        )}

        <div style={{ marginBottom: 'auto' }}>
          <Meter value={collected} max={expected} color={C.successText}
            label={`${rate}% of ${fmtMoneyShort(expected)} expected · ${fmtMoneyShort(Math.max(expected - collected, 0))} still out`} />
        </div>

        {/* Part-to-whole over three states — the one place on this page where
            colour carries meaning rather than decorating a length. Status
            colours are reserved for exactly this and ship with labels. */}
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.divider}` }}>
          <StackedBar segments={statuses.map((s) => ({
            label: s.label, value: s.value, color: STATUS[s.key].text,
          }))} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 9 }}>
            {statuses.map((s) => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, flexShrink: 0,
                               background: STATUS[s.key].text }} />
                <span style={{ fontFamily: FONT, fontSize: T.micro, color: C.t5 }}>
                  {s.label}
                </span>
                <span style={{ fontFamily: MONO, fontSize: T.micro, fontWeight: W.bold, color: C.t2 }}>
                  {fmtNum(s.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    alignContent: 'start' }}>
        <StatCard label="Expected" accent="purple" loading={loading}
          value={fmtMoneyShort(k?.expected)} sub={`${fmtNum(k?.sale_count)} sales`} />
        <StatCard label="Outstanding" accent="amber" loading={loading}
          value={fmtMoneyShort(k?.outstanding)}
          sub={`${fmtNum(Number(k?.partial_count || 0) + Number(k?.unpaid_count || 0))} open`} />
        <StatCard label="Sales" accent="blue" loading={loading}
          value={fmtNum(k?.sale_count)} sub={`${fmtNum(k?.paid_count)} fully paid`} />
        <StatCard label="Avg ticket" accent="orange" loading={loading}
          value={fmtMoneyShort(k?.avg_ticket)} sub="per sale" />
      </div>
    </div>
  );
}

/* ---------------------------- Collections trend --------------------------- */

/**
 * The API returns only days that HAD a payment. Plotting those rows straight
 * onto a category axis draws a quiet fortnight and a busy fortnight at the same
 * width, so the line lies about when money arrived. Fill every missing day with
 * zero so the x axis is proportional to time.
 */
function fillDayGaps(trend) {
  if (trend.length < 2) return trend.map((t) => ({ ...t, collected: Number(t.collected) }));
  const byDate = new Map(trend.map((t) => [String(t.date).slice(0, 10), Number(t.collected)]));
  const out = [];
  const cur = new Date(`${String(trend[0].date).slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${String(trend[trend.length - 1].date).slice(0, 10)}T00:00:00Z`);
  // Guard against a bad range spinning forever on a malformed date.
  for (let i = 0; cur <= end && i < 2000; i++) {
    const iso = cur.toISOString().slice(0, 10);
    out.push({ date: iso, collected: byDate.get(iso) ?? 0 });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function TrendCard({ trend }) {
  const { effective } = useTheme();
  const series = useMemo(() => fillDayGaps(trend), [trend]);

  const chart = useMemo(() => {
    if (!series.length) return null;
    const line = cssVar('--c-successBright', '#1D9E75');
    return {
      labels: series.map((t) => fmtDate(t.date)),
      datasets: [{
        data: series.map((t) => t.collected),
        borderColor: line,
        backgroundColor: (ctx) => {
          const { chart } = ctx;
          if (!chart.chartArea) return 'transparent';
          const g = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom);
          g.addColorStop(0, hexA(line, effective === 'dark' ? 0.26 : 0.22));
          g.addColorStop(1, hexA(line, 0));
          return g;
        },
        borderWidth: 2,          // thin mark
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 5,     // >= 8px hit target
        pointHoverBorderWidth: 2,
        pointHoverBorderColor: cssVar('--c-cardBg', '#ffffff'),
        pointHoverBackgroundColor: line,
      }],
    };
  }, [series, effective]);

  const total = series.reduce((s, t) => s + t.collected, 0);
  const peak = series.reduce((a, b) => (b.collected > (a?.collected ?? -1) ? b : a), null);
  const days = series.length;
  const avg = days ? total / days : 0;

  return (
    <Card title="Collections over time" tag={fmtMoney(total)}>
      {!chart ? (
        <EmptyState Icon={LineChart} title="No payments in this range" />
      ) : (
        <>
          {/* Selective direct labels: the two values worth reading off the plot,
              stated once here instead of a number on every point. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 14 }}>
            <Figure label="Best day"
              value={fmtMoney(peak?.collected)} sub={fmtDate(peak?.date)} />
            <Figure label="Daily average" value={fmtMoney(avg)} sub={`over ${days} days`} />
          </div>
          <div style={{ height: 250 }}>
            <Line key={effective} data={chart} options={{
              scales: {
                x: {
                  grid: { display: false },
                  ticks: { maxTicksLimit: 8, font: { size: 11 }, maxRotation: 0, autoSkip: true },
                },
                y: {
                  border: { display: false },
                  grid: { color: cssVar('--c-divider', '#F0F0EA'), drawTicks: false },
                  ticks: { callback: (v) => fmtMoneyShort(v), font: { size: 11 }, padding: 8 },
                  beginAtZero: true,
                },
              },
              plugins: {
                tooltip: {
                  callbacks: { label: (c) => `Collected ${fmtMoney(c.parsed.y)}` },
                },
              },
              // Crosshair-style read: hovering anywhere in the column reports
              // that day, rather than demanding a hit on the 2px line.
              interaction: { mode: 'index', intersect: false },
            }} />
          </div>
        </>
      )}
    </Card>
  );
}

function Figure({ label, value, sub }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6,
                    textTransform: 'uppercase', letterSpacing: '.07em' }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: T.lead, fontWeight: W.bold, color: C.t1,
                    lineHeight: LH.tight, marginTop: 2 }}>{value}</div>
      <div style={{ fontFamily: FONT, fontSize: T.micro, color: C.t6 }}>{sub}</div>
    </div>
  );
}

/** #rrggbb + alpha -> rgba(). Chart gradients need a real colour, not a token. */
function hexA(hex, a) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16));
  return `rgba(${r},${g},${b},${a})`;
}

/* ------------------------------ Leaderboard ------------------------------- */

function LeaderboardCard({ rows, filters, openId, setOpenId }) {
  const { effective } = useTheme();
  const bar = magnitudeColor(effective);
  const max = Math.max(...rows.map((r) => Number(r.collected)), 1);

  return (
    <Card title="Salesperson leaderboard" tag={String(rows.length)} pad={0}>
      {!rows.length ? (
        <EmptyState Icon={Trophy}
          title={hasActiveFilters(filters) ? 'No sales match these filters' : 'No sales recorded yet'}
          hint={hasActiveFilters(filters)
            ? 'Try widening the date range, or clear the filters.'
            : 'The leaderboard fills in as sales are recorded.'} />
      ) : (
        <TableScroll>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 48, textAlign: 'center' }}>#</th>
                <th style={thStyle}>Salesperson</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Sales</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Expected</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Collected</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Outstanding</th>
                <th style={{ ...thStyle, width: 160 }}>Share of collections</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const open = openId === r.salesperson_id;
                return (
                  <Fragment key={r.salesperson_id}>
                    <tr
                      onClick={() => setOpenId(open ? null : r.salesperson_id)}
                      style={{ cursor: 'pointer', background: open ? C.selectedTint : 'transparent' }}
                      onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = C.hover; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = open ? C.selectedTint : 'transparent'; }}
                    >
                      <td style={{ ...tdStyle, fontFamily: MONO, color: C.t6, textAlign: 'center' }}>
                        {i + 1}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          {/* Neutral, NOT a series colour. White initials on a
                              categorical hue fails contrast on the lighter slots,
                              and colour here would only repeat what the name
                              beside it already says. */}
                          <span style={{
                            display: 'grid', placeItems: 'center',
                            width: 28, height: 28, borderRadius: 999, flexShrink: 0,
                            fontFamily: MONO, fontSize: T.micro, fontWeight: W.bold,
                            background: C.surfaceMuted,
                            border: `1px solid ${C.borderSubtle}`,
                            color: C.t3,
                          }}>{initials(r.salesperson_name)}</span>
                          <span style={{ fontSize: T.body, fontWeight: W.medium, color: C.t1 }}>
                            {r.salesperson_name}
                          </span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right' }}>{fmtNum(r.sale_count)}</td>
                      <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right', color: C.t5 }}>{fmtMoney(r.expected)}</td>
                      <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right', fontWeight: W.bold, color: C.successText }}>
                        {fmtMoney(r.collected)}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right',
                                   color: Number(r.outstanding) > 0 ? C.warnText : C.t7 }}>
                        {fmtMoney(r.outstanding)}
                      </td>
                      <td style={tdStyle}>
                        <HBar value={Number(r.collected)} max={max} color={bar} />
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={7} style={{
                          background: C.surfaceAlt, padding: 18,
                          borderBottom: `1px solid ${C.border}`,
                        }}>
                          <SalespersonDetail id={r.salesperson_id} filters={filters} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      )}
    </Card>
  );
}

const subHeading = {
  fontFamily: MONO, fontSize: T.label, color: C.t5,
  textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10,
};

function SalespersonDetail({ id, filters }) {
  const { effective } = useTheme();
  const bar = magnitudeColor(effective);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiGet(`/api/dashboard/salesperson/${id}${buildQuery({ ...filters, page: undefined })}`)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [id, filters]);

  if (error) return <ErrorMsg>{error}</ErrorMsg>;
  if (!detail) return <div style={{ display: 'grid', placeItems: 'center', padding: 24 }}><Spinner /></div>;

  const maxProduct = Math.max(...detail.by_product.map((p) => Number(p.collected)), 1);

  return (
    <div style={{ display: 'grid', gap: 22, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
      <div>
        <div style={subHeading}>Products sold</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {detail.by_product.map((p) => (
            <div key={p.product_name}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                            gap: 8, marginBottom: 5 }}>
                <span style={{ fontFamily: FONT, fontSize: T.body, color: C.t2,
                               overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.product_name}
                </span>
                <span style={{ fontFamily: MONO, fontSize: T.micro, color: C.t5, flexShrink: 0 }}>
                  {fmtNum(p.sale_count)} · {fmtMoney(p.collected)}
                </span>
              </div>
              <HBar value={Number(p.collected)} max={maxProduct} color={bar} />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {detail.by_status.map((s) => (
            <div key={s.payment_status} style={{
              flex: 1, borderRadius: 9, border: `1px solid ${C.border}`,
              background: C.cardBg, padding: '9px 10px',
            }}>
              <StatusBadge status={s.payment_status} />
              <div style={{ fontFamily: MONO, fontSize: T.body, fontWeight: W.bold, color: C.t1, marginTop: 6 }}>
                {fmtNum(s.sale_count)}
              </div>
              {Number(s.outstanding) > 0 && (
                <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.warnText }}>
                  {fmtMoney(s.outstanding)} due
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={subHeading}>Recent sales</div>
        {!detail.recent.length ? (
          <p style={{ fontFamily: FONT, fontSize: T.body, color: C.t6, margin: 0 }}>
            No sales in this range.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {detail.recent.map((s) => (
                <tr key={s.id}>
                  <td style={{ ...tdStyle, fontFamily: MONO, fontSize: T.micro, color: C.t6, padding: '7px 0' }}>
                    {fmtDate(s.sale_date)}
                  </td>
                  <td style={{ ...tdStyle, padding: '7px 8px', maxWidth: 150, overflow: 'hidden',
                               textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.customer_name}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right', padding: '7px 8px' }}>
                    {fmtMoney(s.sale_price)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', padding: '7px 0' }}>
                    <StatusBadge status={s.payment_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* --------------------------- Magnitude breakdowns ------------------------- */

/**
 * One shared row for both breakdowns — same job (compare magnitude across
 * nominal categories), so the same form, and no chance of the two drifting.
 */
function BreakdownRow({ name, value, max, color, meta, format = fmtMoney }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                    gap: 10, marginBottom: 5 }}>
        <span style={{ fontFamily: FONT, fontSize: T.body, color: C.t2, minWidth: 0,
                       overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
        <span style={{ fontFamily: MONO, fontSize: T.body, fontWeight: W.bold,
                       color: C.t1, flexShrink: 0 }}>
          {format(value)}
        </span>
      </div>
      <HBar value={value} max={max} color={color} />
      {meta && (
        <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6, marginTop: 5 }}>{meta}</div>
      )}
    </div>
  );
}

function ProductCard({ rows }) {
  const { effective } = useTheme();
  const bar = magnitudeColor(effective);
  const max = Math.max(...rows.map((r) => Number(r.collected)), 1);

  return (
    <Card title="By product" tag={String(rows.length)}>
      {!rows.length ? (
        <EmptyState Icon={GraduationCap} title="Nothing to show" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rows.map((r, i) => (
            <BreakdownRow key={r.product_id ?? i}
              name={r.product_name} value={Number(r.collected)} max={max} color={bar}
              meta={<>
                {fmtNum(r.sale_count)} sales · {fmtMoney(r.expected)} expected
                {Number(r.outstanding) > 0 && (
                  <span style={{ color: C.warnText }}> · {fmtMoney(r.outstanding)} due</span>
                )}
              </>} />
          ))}
        </div>
      )}
    </Card>
  );
}

/**
 * Was a doughnut. Eight payment modes with several close values is precisely
 * what a doughnut cannot do — comparing arc lengths around a ring is far harder
 * than comparing bar lengths against a shared baseline, and eight slices blows
 * past the ~6-segment ceiling for part-to-whole at a glance. Same data, bars.
 */
function ModeCard({ rows }) {
  const { effective } = useTheme();
  const bar = magnitudeColor(effective);
  const total = rows.reduce((s, r) => s + Number(r.collected), 0);
  const max = Math.max(...rows.map((r) => Number(r.collected)), 1);

  return (
    <Card title="By payment mode" tag={fmtMoney(total)}>
      {!rows.length ? (
        <EmptyState Icon={Wallet} title="No payments yet" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rows.map((r) => (
            <BreakdownRow key={r.mode}
              name={r.mode} value={Number(r.collected)} max={max} color={bar}
              meta={`${fmtNum(r.payment_count)} payments · ${total > 0 ? Math.round((Number(r.collected) / total) * 100) : 0}% of collections`} />
          ))}
        </div>
      )}
    </Card>
  );
}

/* ------------------------- Student profile panels ------------------------- */

/**
 * "Not recorded" is rendered as a real bucket, deliberately.
 *
 * These fields are optional on the entry form, so coverage is part of the
 * answer: a channel breakdown that quietly drops unanswered sales reports a
 * clean split of whatever happened to be filled in, and every share below it is
 * inflated by exactly the amount you cannot see.
 */
function CoverageNote({ rows, noun }) {
  const total = rows.reduce((s, r) => s + Number(r.sale_count), 0);
  const missing = Number(rows.find((r) => r.isMissing)?.sale_count || 0);
  if (!total || !missing) return null;
  const pct = Math.round((missing / total) * 100);
  return (
    <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6, marginTop: 12,
                  paddingTop: 11, borderTop: `1px solid ${C.divider}` }}>
      {pct}% of sales have no {noun} recorded — shares below are of all sales, not
      only the answered ones.
    </div>
  );
}

const MISSING = 'Not recorded';

function SourceCard({ rows }) {
  const { effective } = useTheme();
  const bar = magnitudeColor(effective);
  const marked = rows.map((r) => ({ ...r, isMissing: r.source === MISSING }));
  const max = Math.max(...marked.map((r) => Number(r.collected)), 1);
  const totalSales = marked.reduce((s, r) => s + Number(r.sale_count), 0);

  return (
    <Card title="How they found us" tag={String(marked.length)}>
      {!marked.length ? (
        <EmptyState Icon={Megaphone} title="No sales in this range" />
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {marked.map((r) => (
              <BreakdownRow key={r.source}
                name={r.source} value={Number(r.collected)} max={max}
                // The unanswered bucket is drawn recessive: it is context for
                // the others, not a channel competing with them.
                color={r.isMissing ? C.t8 : bar}
                meta={`${fmtNum(r.sale_count)} sales · ${totalSales ? Math.round((r.sale_count / totalSales) * 100) : 0}% of all`} />
            ))}
          </div>
          <CoverageNote rows={marked} noun="source" />
        </>
      )}
    </Card>
  );
}

function ProfessionCard({ rows, genders }) {
  const { effective } = useTheme();
  const bar = magnitudeColor(effective);
  const marked = rows.map((r) => ({ ...r, isMissing: r.profession === MISSING }));
  const max = Math.max(...marked.map((r) => Number(r.sale_count)), 1);
  const known = genders.filter((g) => g.gender !== MISSING);
  const avgAge = known.find((g) => g.avg_age != null)?.avg_age;

  return (
    <Card title="Who they are" tag={String(marked.length)}>
      {!marked.length ? (
        <EmptyState Icon={Briefcase} title="No sales in this range" />
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {marked.map((r) => (
              <BreakdownRow key={r.profession}
                name={r.profession} value={Number(r.sale_count)} max={max}
                color={r.isMissing ? C.t8 : bar}
                format={fmtNum}
                meta={`${fmtMoney(r.collected)} collected`} />
            ))}
          </div>

          {known.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 14,
                          paddingTop: 12, borderTop: `1px solid ${C.divider}` }}>
              {known.map((g) => (
                <div key={g.gender} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: FONT, fontSize: T.micro, color: C.t5 }}>{g.gender}</span>
                  <span style={{ fontFamily: MONO, fontSize: T.meta, fontWeight: W.bold, color: C.t1 }}>
                    {fmtNum(g.sale_count)}
                  </span>
                </div>
              ))}
              {avgAge != null && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: FONT, fontSize: T.micro, color: C.t5 }}>Avg age</span>
                  <span style={{ fontFamily: MONO, fontSize: T.meta, fontWeight: W.bold, color: C.t1 }}>
                    {avgAge}
                  </span>
                </div>
              )}
            </div>
          )}
          <CoverageNote rows={marked} noun="profession" />
        </>
      )}
    </Card>
  );
}

/* --------------------- Outstanding-balance worklist ----------------------- */

/**
 * The API caps this at the 10 largest balances, but the card's tag reports the
 * FULL outstanding total — so without the note below, ten rows read as "this is
 * all of it" while claiming a number they do not add up to.
 */
function OutstandingCard({ rows, total, openCount = 0 }) {
  const capped = openCount > rows.length;
  return (
    <Card title="Chase these first" tag={fmtMoney(total)} pad={0}>
      {!rows.length ? (
        <EmptyState Icon={CircleCheckBig} title="Nothing outstanding"
          hint="Every sale in this range is fully paid." />
      ) : (
        <TableScroll>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>Product</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Price</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Collected</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Outstanding</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={tdStyle}>
                    <div style={{ fontSize: T.body, color: C.t1, fontWeight: W.medium, lineHeight: LH.tight }}>
                      {s.customer_name}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6 }}>{s.customer_phone}</div>
                  </td>
                  <td style={{ ...tdStyle, color: C.t4 }}>{s.product_name}</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right' }}>{fmtMoney(s.sale_price)}</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right', color: C.successText }}>
                    {fmtMoney(s.collected)}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right', fontWeight: W.bold, color: C.warnText }}>
                    {fmtMoney(s.outstanding)}
                  </td>
                  <td style={tdStyle}><StatusBadge status={s.payment_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
      {capped && (
        <div style={{
          padding: '11px 12px', borderTop: `1px solid ${C.divider}`,
          fontFamily: MONO, fontSize: T.micro, color: C.t6,
        }}>
          Showing the {rows.length} largest of {fmtNum(openCount)} open balances — open
          Outstanding for the full list.
        </div>
      )}
    </Card>
  );
}
````

#### FILE: frontend/src/components/SalesTable.jsx
````jsx
import { useEffect, useState, useCallback } from 'react';
import { Download, ChevronDown, ChevronUp, Receipt, CircleCheck } from 'lucide-react';
import { apiGet, apiPost } from '../utils/api';
import { Card, StatCard, StatusBadge, Pagination, SortIcon, Spinner, EmptyState,
         ErrorMsg, Button, Input, Select, useToast, ToastContainer,
         TableScroll, tableStyle, thStyle, tdStyle } from './ui';
import { useIsNarrow } from '../utils/useMediaQuery';
import { C, FONT, MONO, T, W, LH, fmtMoney, fmtMoneyShort, fmtNum, fmtDate,
         fmtDateTime, buildQuery, hasActiveFilters, PAYMENT_MODES,
         DEFAULT_LIMIT } from '../constants';

const COLUMNS = [
  { key: 'sale_date',        label: 'Date',        sortable: true },
  { key: 'customer_name',    label: 'Customer',    sortable: true },
  { key: 'product_name',     label: 'Product',     sortable: true },
  { key: 'salesperson_name', label: 'Sold by',     sortable: true },
  { key: 'sale_price',       label: 'Price',       sortable: true, right: true },
  { key: 'collected',        label: 'Collected',   sortable: true, right: true },
  { key: 'outstanding',      label: 'Outstanding', sortable: true, right: true },
  { key: 'payment_status',   label: 'Status',      sortable: true },
];

export default function SalesTable({ filters, onFilters }) {
  const [sort, setSort] = useState({ key: 'sale_date', dir: 'desc' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const { toasts, push } = useToast();
  const narrow = useIsNarrow();

  const page = filters.page || 1;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = buildQuery({
        ...filters, page, limit: DEFAULT_LIMIT, sort: sort.key, dir: sort.dir,
      });
      setData(await apiGet(`/api/sales${qs}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, page, sort]);

  useEffect(() => { load(); }, [load]);

  const toggleSort = (key) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));

  const totals = data?.totals;

  function exportCsv() {
    window.open(`/api/sales/export.csv${buildQuery({ ...filters, page: undefined })}`, '_blank');
  }

  return (
    <div>
      <div style={{
        display: 'grid', gap: 12, marginBottom: 16,
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      }}>
        <StatCard label="Sales" value={fmtNum(totals?.total)} accent="blue" loading={loading && !data} />
        <StatCard label="Expected" value={fmtMoneyShort(totals?.expected)} accent="purple" loading={loading && !data} />
        <StatCard label="Collected" value={fmtMoneyShort(totals?.collected)} accent="green" loading={loading && !data} />
        <StatCard label="Outstanding" value={fmtMoneyShort(totals?.outstanding)} accent="amber" loading={loading && !data} />
      </div>

      <Card pad={0} title="Sales log" headerRight={
        <Button variant="ghost" size="sm" onClick={exportCsv}>
          <Download size={15} strokeWidth={2} /> CSV
        </Button>
      }>
        <div style={{ padding: error ? '14px 16px 0' : 0 }}>
          <ErrorMsg onRetry={load}>{error}</ErrorMsg>
        </div>

        {loading && !data ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: '64px 0' }}><Spinner size={26} /></div>
        ) : !data?.sales.length ? (
          hasActiveFilters(filters) ? (
            <EmptyState Icon={Receipt} title="No sales match these filters"
              hint="Try widening the date range, or clear the filters." />
          ) : (
            <EmptyState Icon={Receipt} title="No sales recorded yet"
              hint="Sales appear here as soon as someone saves one on the entry form." />
          )
        ) : narrow ? (
          // A nine-column table on a 390px screen is scrollable but not
          // readable — the money ends up off-screen, which is the one thing
          // this page exists to show. One card per sale instead.
          <div>
            {data.sales.map((s) => (
              <SaleCard key={s.id} sale={s}
                open={openId === s.id}
                onToggle={() => setOpenId(openId === s.id ? null : s.id)}
                onChanged={(msg) => { push(msg); load(); }} />
            ))}
          </div>
        ) : (
          <TableScroll>
            <table style={{ ...tableStyle, minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 34 }} />
                  {COLUMNS.map((c) => (
                    <th key={c.key} style={{ ...thStyle, textAlign: c.right ? 'right' : 'left' }}>
                      {c.sortable ? (
                        <button onClick={() => toggleSort(c.key)}
                          style={{
                            display: 'inline-flex', alignItems: 'center',
                            flexDirection: c.right ? 'row-reverse' : 'row',
                            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                            font: 'inherit', color: 'inherit', letterSpacing: 'inherit',
                            textTransform: 'inherit',
                          }}>
                          {c.label}
                          <SortIcon active={sort.key === c.key} asc={sort.dir === 'asc'} />
                        </button>
                      ) : c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.sales.map((s) => (
                  <SaleRow key={s.id} sale={s}
                    open={openId === s.id}
                    onToggle={() => setOpenId(openId === s.id ? null : s.id)}
                    onChanged={(msg) => { push(msg); load(); }} />
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}

        {data?.total > 0 && (
          <div style={{ padding: '0 16px 14px' }}>
            <Pagination page={page} limit={DEFAULT_LIMIT} total={data.total}
              onPage={(p) => onFilters({ ...filters, page: p })} />
          </div>
        )}
      </Card>

      <ToastContainer toasts={toasts} />
    </div>
  );
}

/**
 * One sale as a card, for phones.
 *
 * Shows exactly what the table's columns show, stacked by importance: who, what,
 * then the money — so the numbers are never the part you have to scroll to.
 */
function SaleCard({ sale, open, onToggle, onChanged }) {
  const Chevron = open ? ChevronUp : ChevronDown;
  const due = Number(sale.outstanding) > 0;
  return (
    <div style={{ borderBottom: `1px solid ${C.rowSep}`,
                  background: open ? C.selectedTint : 'transparent' }}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%',
          padding: '13px 14px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}>
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0, fontFamily: FONT, fontSize: T.bodyLg,
                           fontWeight: W.bold, color: C.t1, overflow: 'hidden',
                           textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sale.customer_name}
            </span>
            <StatusBadge status={sale.payment_status} />
          </div>

          <div style={{ fontFamily: FONT, fontSize: T.meta, color: C.t4 }}>
            {sale.product_name}
          </div>

          <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6 }}>
            {fmtDate(sale.sale_date)} · {sale.salesperson_name} · {sale.customer_phone}
          </div>

          {/* The money line, always visible — this is the row's point. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 2,
                        fontFamily: MONO, fontSize: T.meta }}>
            <span style={{ color: C.t2 }}>{fmtMoney(sale.sale_price)}</span>
            <span style={{ color: C.successText }}>{fmtMoney(sale.collected)} in</span>
            {due && <span style={{ color: C.warnText, fontWeight: W.bold }}>
              {fmtMoney(sale.outstanding)} due
            </span>}
          </div>
        </div>

        <Chevron size={17} strokeWidth={2} style={{ color: C.t6, flexShrink: 0, marginTop: 2 }} />
      </button>

      {open && (
        <div style={{ background: C.surfaceAlt, padding: 14,
                      borderTop: `1px solid ${C.border}` }}>
          <SaleDetail saleId={sale.id} onChanged={onChanged} />
        </div>
      )}
    </div>
  );
}

function SaleRow({ sale, open, onToggle, onChanged }) {
  const cellFor = (key) => {
    switch (key) {
      case 'sale_date':
        return <span style={{ fontFamily: MONO }}>{fmtDate(sale.sale_date)}</span>;
      case 'customer_name':
        return (
          <div style={{ minWidth: 0 }}>
            <div style={{ color: C.t1, fontWeight: W.medium, lineHeight: LH.tight,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sale.customer_name}
            </div>
            <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6 }}>{sale.customer_phone}</div>
          </div>
        );
      case 'product_name':    return <span style={{ color: C.t4 }}>{sale.product_name}</span>;
      case 'salesperson_name':return <span style={{ color: C.t4 }}>{sale.salesperson_name}</span>;
      case 'sale_price':      return <span style={{ fontFamily: MONO }}>{fmtMoney(sale.sale_price)}</span>;
      case 'collected':
        return <span style={{ fontFamily: MONO, color: C.successText }}>{fmtMoney(sale.collected)}</span>;
      case 'outstanding':
        return (
          <span style={{ fontFamily: MONO, color: Number(sale.outstanding) > 0 ? C.warnText : C.t7 }}>
            {fmtMoney(sale.outstanding)}
          </span>
        );
      case 'payment_status':  return <StatusBadge status={sale.payment_status} />;
      default: return null;
    }
  };

  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <>
      <tr
        onClick={onToggle}
        style={{ cursor: 'pointer', background: open ? C.selectedTint : 'transparent' }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = C.hover; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = open ? C.selectedTint : 'transparent'; }}
      >
        <td style={{ ...tdStyle, paddingLeft: 12, paddingRight: 0 }}>
          <Chevron size={16} strokeWidth={2} style={{ color: C.t6, display: 'block' }} />
        </td>
        {COLUMNS.map((c) => (
          <td key={c.key} style={{ ...tdStyle, textAlign: c.right ? 'right' : 'left' }}>
            {cellFor(c.key)}
          </td>
        ))}
      </tr>
      {open && (
        <tr>
          <td colSpan={COLUMNS.length + 1} style={{
            background: C.surfaceAlt, padding: 18, borderBottom: `1px solid ${C.border}`,
          }}>
            <SaleDetail saleId={sale.id} onChanged={onChanged} />
          </td>
        </tr>
      )}
    </>
  );
}

const subHeading = {
  fontFamily: MONO, fontSize: T.label, color: C.t5,
  textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10,
};

/** Exported so the Outstanding worklist reuses this exact panel rather than
 *  growing a second, drifting copy of the add-payment form. */
export function SaleDetail({ saleId, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('UPI');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await apiGet(`/api/sales/${saleId}`));
    } catch (err) {
      setError(err.message);
    }
  }, [saleId]);

  useEffect(() => { load(); }, [load]);

  async function addPayment(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await apiPost(`/api/sales/${saleId}/payments`, { amount, mode });
      setAmount('');
      await load();
      onChanged('Payment added');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!detail) return <div style={{ display: 'grid', placeItems: 'center', padding: 24 }}><Spinner /></div>;

  const { sale, payments, audit } = detail;
  const settled = Number(sale.outstanding) <= 0;

  return (
    <div style={{ display: 'grid', gap: 22,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
      <div>
        <div style={subHeading}>Payments ({payments.length})</div>
        {payments.length === 0 ? (
          <p style={{ fontFamily: FONT, fontSize: T.body, color: C.t6, margin: 0 }}>
            Nothing collected yet.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td style={{ ...tdStyle, fontFamily: MONO, color: C.t5, padding: '7px 8px 7px 0' }}>
                    {fmtDate(p.paid_on)}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: MONO, fontWeight: W.bold, color: C.successText, padding: '7px 8px' }}>
                    {fmtMoney(p.amount)}
                  </td>
                  <td style={{ ...tdStyle, color: C.t4, padding: '7px 8px' }}>{p.mode}</td>
                  <td style={{ ...tdStyle, color: C.t7, fontSize: T.micro, textAlign: 'right', padding: '7px 0 7px 8px' }}>
                    {p.reference || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {audit.length > 0 && (
          <>
            <div style={{ ...subHeading, marginTop: 18 }}>Edit history</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {audit.map((a, i) => (
                <div key={i} style={{ fontFamily: FONT, fontSize: T.micro, color: C.t6, lineHeight: LH.snug }}>
                  <span style={{ fontFamily: MONO }}>{fmtDateTime(a.changed_at)}</span>
                  {' — '}<strong style={{ color: C.t3 }}>{a.field}</strong>
                  {' changed from '}<span style={{ color: C.t3 }}>{a.old_value ?? '—'}</span>
                  {' to '}<span style={{ color: C.t3 }}>{a.new_value ?? '—'}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div>
        <div style={subHeading}>
          {settled ? 'Fully paid' : `Add payment — ${fmtMoney(sale.outstanding)} due`}
        </div>
        {settled ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7,
                        fontFamily: FONT, fontSize: T.body, color: C.successText }}>
            <CircleCheck size={17} strokeWidth={2} /> Nothing outstanding.
          </div>
        ) : (
          <form onSubmit={addPayment} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Input mono inputMode="decimal" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Up to ${Number(sale.outstanding).toFixed(0)}`} />
            <Select value={mode} onChange={setMode}
              options={PAYMENT_MODES.map((m) => ({ value: m, label: m }))} />
            <ErrorMsg>{error}</ErrorMsg>
            <Button type="submit" size="sm" disabled={busy || !amount}>
              {busy ? 'Adding…' : 'Add payment'}
            </Button>
          </form>
        )}

        {sale.notes && (
          <>
            <div style={{ ...subHeading, marginTop: 18, marginBottom: 5 }}>Notes</div>
            <p style={{ fontFamily: FONT, fontSize: T.body, color: C.t4, margin: 0, lineHeight: LH.snug }}>
              {sale.notes}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
````

#### FILE: frontend/src/components/Outstanding.jsx
````jsx
import { Fragment, useEffect, useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, CircleCheckBig } from 'lucide-react';
import { apiGet } from '../utils/api';
import { Card, StatCard, StatusBadge, Spinner, EmptyState, ErrorMsg,
         useToast, ToastContainer, TableScroll, tableStyle, thStyle, tdStyle } from './ui';
import { SaleDetail } from './SalesTable';
import { C, MONO, T, W, LH, fmtMoney, fmtMoneyShort, fmtNum, fmtDate, buildQuery } from '../constants';

/**
 * The chase worklist: every sale in the current filter window that isn't fully
 * paid, biggest balance first. Server-capped at 200 rows — see the note below
 * the table, which says so rather than silently truncating.
 */
export default function Outstanding({ filters }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const { toasts, push } = useToast();

  const load = useCallback(async () => {
    setError('');
    try {
      const d = await apiGet(`/api/sales/outstanding${buildQuery({ ...filters, page: undefined })}`);
      setRows(d.sales);
    } catch (err) {
      setError(err.message);
      setRows([]); // a failed load is not a pending one
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const totalDue = (rows || []).reduce((s, r) => s + Number(r.outstanding), 0);
  const partial = (rows || []).filter((r) => r.payment_status === 'partial').length;
  const unpaid = (rows || []).filter((r) => r.payment_status === 'unpaid').length;

  return (
    <div>
      <ErrorMsg onRetry={load}>{error}</ErrorMsg>

      <div style={{
        display: 'grid', gap: 12, marginBottom: 16,
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      }}>
        <StatCard label="Outstanding" accent="amber" loading={!rows}
          value={fmtMoneyShort(totalDue)} sub={`across ${fmtNum(rows?.length)} sales`} />
        <StatCard label="Part paid" accent="orange" loading={!rows}
          value={fmtNum(partial)} sub="something collected" />
        <StatCard label="Nothing paid" accent="blue" loading={!rows}
          value={fmtNum(unpaid)} sub="no payment at all" />
      </div>

      <Card pad={0} title="Chase list" tag={rows ? String(rows.length) : '…'}>
        {!rows ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: '64px 0' }}><Spinner size={26} /></div>
        ) : !rows.length ? (
          <EmptyState Icon={CircleCheckBig} title="Nothing outstanding"
            hint="Every sale in this filter window is fully paid." />
        ) : (
          <>
            <TableScroll>
              <table style={{ ...tableStyle, minWidth: 860 }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 34 }} />
                    <th style={thStyle}>Customer</th>
                    <th style={thStyle}>Product</th>
                    <th style={thStyle}>Sold by</th>
                    <th style={thStyle}>Sale date</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Price</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Collected</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Outstanding</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const open = openId === s.id;
                    const Chevron = open ? ChevronUp : ChevronDown;
                    return (
                      <Fragment key={s.id}>
                        <tr
                          onClick={() => setOpenId(open ? null : s.id)}
                          style={{ cursor: 'pointer', background: open ? C.selectedTint : 'transparent' }}
                          onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = C.hover; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = open ? C.selectedTint : 'transparent'; }}
                        >
                          <td style={{ ...tdStyle, paddingLeft: 12, paddingRight: 0 }}>
                            <Chevron size={16} strokeWidth={2} style={{ color: C.t6, display: 'block' }} />
                          </td>
                          <td style={tdStyle}>
                            <div style={{ color: C.t1, fontWeight: W.medium, lineHeight: LH.tight }}>
                              {s.customer_name}
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6 }}>
                              {s.customer_phone}
                            </div>
                          </td>
                          <td style={{ ...tdStyle, color: C.t4 }}>{s.product_name}</td>
                          <td style={{ ...tdStyle, color: C.t4 }}>{s.salesperson_name}</td>
                          <td style={{ ...tdStyle, fontFamily: MONO, color: C.t5 }}>{fmtDate(s.sale_date)}</td>
                          <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right' }}>{fmtMoney(s.sale_price)}</td>
                          <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right', color: C.successText }}>
                            {fmtMoney(s.collected)}
                          </td>
                          <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right',
                                       fontWeight: W.bold, color: C.warnText }}>
                            {fmtMoney(s.outstanding)}
                          </td>
                          <td style={tdStyle}><StatusBadge status={s.payment_status} /></td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={9} style={{
                              background: C.surfaceAlt, padding: 18,
                              borderBottom: `1px solid ${C.border}`,
                            }}>
                              <SaleDetail saleId={s.id}
                                onChanged={(msg) => { push(msg); load(); }} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
            {rows.length >= 200 && (
              <div style={{ padding: '10px 16px 14px', fontFamily: MONO, fontSize: T.micro, color: C.t6 }}>
                Showing the 200 largest balances. Narrow the filters to see the rest.
              </div>
            )}
          </>
        )}
      </Card>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
````

---
**Checkpoint:** all files written. Append `phase 06 done` to PROGRESS.md and
continue with `forgelite-kit/build/07-run-and-verify.md`.
