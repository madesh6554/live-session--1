import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  SlidersHorizontal, GraduationCap, Users, ShieldCheck, Lock, Check,
  Sun, Moon, Monitor, Plus, Pencil, Eye, EyeOff, KeyRound, Ban, CircleCheck, UserPlus,
} from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiFetch } from '../utils/api';
import { Card, Button, IconButton, Input, Select, ErrorMsg, Spinner, EmptyState,
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
  { key: 'roles',       label: 'Roles',       Icon: Lock },
];

/**
 * The permission vocabulary a role can be built from — PAIRED with
 * backend/routes/roles.js PAGE_KEYS. Adding a page means adding it here too.
 */
const PERMISSION_OPTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'log', label: 'Sales Log' },
  { key: 'outstanding', label: 'Outstanding' },
  { key: 'admin-settings', label: 'Admin Settings (menu)' },
  { key: 'admin-settings:general', label: 'Settings — General' },
  { key: 'admin-settings:products', label: 'Settings — Products' },
  { key: 'admin-settings:salespeople', label: 'Settings — Salespeople' },
  { key: 'admin-settings:accounts', label: 'Settings — Accounts' },
  { key: 'admin-settings:roles', label: 'Settings — Roles' },
];
const PERMISSION_LABELS = Object.fromEntries(PERMISSION_OPTIONS.map((o) => [o.key, o.label]));

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
          {tab === 'roles' && <RoleManager onToast={push} />}
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

/* ---------------------------------- Roles --------------------------------- */

/** Checkbox-as-pill row, shared by the "new role" form and the edit form. */
function PermissionToggles({ value, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {PERMISSION_OPTIONS.map((o) => {
        const on = value.includes(o.key);
        return (
          <button key={o.key} type="button" disabled={disabled}
            onClick={() => onChange(on ? value.filter((k) => k !== o.key) : [...value, o.key])}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '6px 11px', borderRadius: 999,
              cursor: disabled ? 'not-allowed' : 'pointer',
              borderWidth: 1, borderStyle: 'solid',
              borderColor: on ? C.primary : C.border,
              background: on ? C.primaryLight : C.surfaceInner,
              color: on ? C.t1 : C.t3,
              fontFamily: FONT, fontSize: T.meta, fontWeight: on ? W.bold : W.medium,
            }}
            onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = C.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = on ? C.primaryLight : C.surfaceInner; }}
          >
            {on && <Check size={13} strokeWidth={2.5} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Roles decide what a dashboard account may see.
 *
 * An account with no role assigned stays unrestricted (the original
 * single-tier behaviour) — a role only ever NARROWS access, never widens it
 * past what an unassigned account already has.
 */
function RoleManager({ onToast }) {
  const [roles, setRoles] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [newPerms, setNewPerms] = useState([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPerms, setEditPerms] = useState([]);

  const load = useCallback(async () => {
    try {
      const d = await apiGet('/api/roles');
      setRoles(d.roles);
      setError('');
    } catch (err) {
      setError(err.message);
      setRoles([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await apiPost('/api/roles', { name, permissions: newPerms });
      setName(''); setNewPerms([]);
      await load();
      onToast('Role added');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(role) {
    setEditing(role.id);
    setEditName(role.name);
    setEditPerms(role.permissions || []);
  }

  async function saveEdit(id) {
    setError('');
    try {
      await apiPatch(`/api/roles/${id}`, { name: editName, permissions: editPerms });
      setEditing(null);
      await load();
      onToast('Role updated');
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(role) {
    setError('');
    try {
      await apiFetch(`/api/roles/${role.id}`, { method: 'DELETE' });
      await load();
      onToast('Role deleted');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Card title="Roles" tag={roles ? String(roles.length) : '…'}>
      <form onSubmit={add} style={{
        display: 'grid', gap: 10, marginBottom: 18, paddingBottom: 18,
        borderBottom: `1px solid ${C.divider}`,
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Role name, e.g. Salesperson" style={{ flex: 1, minWidth: 200 }} />
          <Button type="submit" disabled={busy || !name}>
            <Plus size={16} strokeWidth={2.5} /> Add role
          </Button>
        </div>
        <PermissionToggles value={newPerms} onChange={setNewPerms} />
      </form>

      <ErrorMsg>{error}</ErrorMsg>

      {!roles ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 32 }}><Spinner /></div>
      ) : !roles.length ? (
        <EmptyState Icon={Lock} title="No roles yet"
          hint="Create one above, then assign it to an account in the Accounts tab." />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {roles.map((r) => (
            <div key={r.id} style={{
              border: `1px solid ${C.border}`, borderRadius: 11, padding: 12,
              background: C.surfaceInner,
            }}>
              {editing === r.id ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)}
                    autoFocus style={{ maxWidth: 280, height: 34, fontSize: T.meta }} />
                  <PermissionToggles value={editPerms} onChange={setEditPerms} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button size="sm" onClick={() => saveEdit(r.id)} disabled={!editName.trim()}>Save</Button>
                    <Button size="sm" variant="subtle" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONT, fontSize: T.bodyLg, fontWeight: W.bold, color: C.t1 }}>
                        {r.name}
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6 }}>
                        {fmtNum(r.user_count)} account{r.user_count === 1 ? '' : 's'}
                      </div>
                    </div>
                    <IconButton Icon={Pencil} title={`Edit ${r.name}`} onClick={() => startEdit(r)} />
                    <IconButton Icon={Ban} danger title={`Delete ${r.name}`} onClick={() => remove(r)} />
                  </div>
                  {r.permissions?.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {r.permissions.map((p) => (
                        <span key={p} style={{
                          fontFamily: MONO, fontSize: T.micro, padding: '3px 9px', borderRadius: 999,
                          background: C.surfaceMuted, color: C.t4, border: `1px solid ${C.borderSubtle}`,
                        }}>{PERMISSION_LABELS[p] || p}</span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontFamily: FONT, fontSize: T.meta, color: C.t7 }}>
                      No pages granted — accounts with this role see nothing until it's edited.
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <p style={footNote}>
        An account with no role stays unrestricted. Assigning a role limits it to exactly the
        pages checked here — set it on the Accounts tab.
      </p>
    </Card>
  );
}

/* -------------------------- Dashboard accounts --------------------------- */

/**
 * Accounts that can sign in to the dashboard.
 *
 * Unrelated to the salespeople list: salespeople are who a sale is credited to,
 * these are who can read the numbers. A role narrows what an account can see;
 * an account with no role is unrestricted.
 */
function UserManager({ onToast, currentUser }) {
  const [rows, setRows] = useState(null);
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', name: '', password: '', role_id: '' });
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [changingRole, setChangingRole] = useState(null);
  const [roleDraft, setRoleDraft] = useState('');

  const load = useCallback(async () => {
    try {
      const [u, r] = await Promise.all([apiGet('/api/users'), apiGet('/api/roles')]);
      setRows(u.users);
      setRoles(r.roles);
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
      await apiPost('/api/users', { ...form, role_id: form.role_id || null });
      setForm({ username: '', name: '', password: '', role_id: '' });
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
      setChangingRole(null);
      await load();
      onToast(message);
    } catch (err) {
      setError(err.message);
    }
  }

  const roleOptions = [{ value: '', label: 'Unrestricted' }, ...roles.map((r) => ({ value: r.id, label: r.name }))];

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
        <Select value={form.role_id} onChange={(v) => setForm((f) => ({ ...f, role_id: v }))}
          options={roleOptions} />
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
                ) : changingRole === u.id ? (
                  <form style={{ display: 'flex', flex: 1, flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
                    onSubmit={(e) => { e.preventDefault(); save(u.id, { role_id: roleDraft || null }, 'Role updated'); }}>
                    <Select value={roleDraft} onChange={setRoleDraft} options={roleOptions} />
                    <Button type="submit" size="sm">Save</Button>
                    <Button type="button" size="sm" variant="subtle"
                      onClick={() => setChangingRole(null)}>Cancel</Button>
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
                        {u.role_name || 'Unrestricted'}
                        {' · '}
                        {u.last_login_at ? `last in ${fmtDateTime(u.last_login_at)}` : 'never signed in'}
                        {!u.active && ' · disabled'}
                      </div>
                    </div>
                    <IconButton Icon={ShieldCheck} title={`Change role for ${u.username}`}
                      onClick={() => { setChangingRole(u.id); setRoleDraft(u.role_id || ''); }} />
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
        Accounts are never deleted — disabling one ends its sessions immediately. The last
        active account can&apos;t be disabled, so you can&apos;t lock yourself out. A role
        limits what an account can see; leave it Unrestricted for full access.
      </p>
    </Card>
  );
}
