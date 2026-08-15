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
