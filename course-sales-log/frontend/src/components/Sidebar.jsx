import { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard, Receipt, CircleAlert,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { C, FONT, T, W } from '../constants';
import { usePagePermissions } from '../utils/permissions';
import { useIsNarrow } from '../utils/useMediaQuery';

const HOME_ITEM = { id: 'overview', label: 'Overview', Icon: LayoutDashboard };

// Grouped by what the user is trying to DO.
//
// Admin settings is deliberately NOT here. The sidebar is places you go to work;
// configuring the app is an account-level action, so it hangs off the user menu
// in the topbar instead.
const GROUPS = [
  { id: 'sales', label: 'Sales', Icon: Receipt, items: [
      { id: 'log',         label: 'Sales Log',   Icon: Receipt },
      { id: 'outstanding', label: 'Outstanding', Icon: CircleAlert },
  ]},
];

// DERIVED, never maintained alongside the groups. The collapsed rail reads
// this too, and a hand-kept second copy WILL drift.
export const NAV_ITEMS = [HOME_ITEM, ...GROUPS.flatMap((g) => g.items)];
export const DEFAULT_PAGE = HOME_ITEM.id;

/**
 * 248px expanded, 68px collapsed.
 *
 * The root is overflow:hidden, so overflow CLIPS rather than scrolls. Only the
 * nav list scrolls; the collapse control is flexShrink:0 so however short the
 * window gets, the toggle stays reachable — otherwise you can collapse the
 * sidebar and never get it back.
 */
export default function Sidebar({ page, onNavigate, open, onClose }) {
  const narrow = useIsNarrow();
  const [collapsed, setCollapsed] = useState(false);
  const [flyout, setFlyout] = useState(null); // { group, top, left }
  const railRef = useRef(null);
  const allowed = usePagePermissions();

  // Permission-filter the items, THEN drop groups left empty. A heading over
  // nothing reads as a broken menu.
  const groups = useMemo(() => GROUPS
    .map((g) => ({ ...g, items: allowed ? g.items.filter((i) => allowed.has(i.id)) : g.items }))
    .filter((g) => g.items.length > 0), [allowed]);

  function openFlyout(group, e) {
    const r = e.currentTarget.getBoundingClientRect();
    const height = group.items.length * 40 + 34;
    setFlyout({
      group,
      // Clamp so a group near the bottom still shows all of its items.
      top: Math.min(r.top, window.innerHeight - height - 8),
      left: r.right + 6,
    });
  }

  // On a phone the nav is a drawer over the content, not a column beside it.
  const drawer = narrow ? {
    position: 'fixed', top: 56, bottom: 0, left: 0, zIndex: 200,
    width: 264,
    transform: open ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform .22s ease',
    boxShadow: open ? C.shadowLg : 'none',
  } : {
    width: collapsed ? 68 : 248,
    transition: 'width .25s ease',
    position: 'relative',
  };

  const go = (id) => { onNavigate(id); if (narrow) onClose?.(); };

  return (
    <>
    {narrow && open && (
      <div onClick={onClose} aria-hidden
        style={{ position: 'fixed', inset: '56px 0 0 0', zIndex: 190,
                 background: 'rgba(0,0,0,.45)' }} />
    )}
    <div
      ref={railRef}
      onMouseLeave={() => setFlyout(null)}
      style={{
        height: narrow ? 'auto' : '100%',
        minHeight: 0,
        background: C.sidebarBg,
        borderRight: `1px solid ${C.sidebarBorder}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        ...drawer,
      }}
    >
      <div style={{
        padding: collapsed ? '10px 8px' : '14px 10px',
        flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
      }}>
        {/* Home is pinned above the groups — it belongs to no category. */}
        <NavRow item={HOME_ITEM} active={page === HOME_ITEM.id} collapsed={collapsed}
          onClick={() => go(HOME_ITEM.id)} />

        {groups.map((g) => (
          <div key={g.id} style={{ marginTop: 14 }}>
            {collapsed ? (
              <div onMouseEnter={(e) => openFlyout(g, e)}>
                <NavRow
                  item={g}
                  active={g.items.some((i) => i.id === page)}
                  collapsed
                  onClick={() => go(g.items[0].id)}
                />
              </div>
            ) : (
              <>
                <div style={{
                  fontFamily: FONT, fontSize: T.label, fontWeight: W.bold,
                  color: C.t6, textTransform: 'uppercase', letterSpacing: '.06em',
                  padding: '0 14px 7px',
                }}>
                  {g.label}
                </div>
                {g.items.map((item) => (
                  <NavRow key={item.id} item={item} active={page === item.id}
                    collapsed={false} indented onClick={() => go(item.id)} />
                ))}
              </>
            )}
          </div>
        ))}
      </div>

      {!narrow && (
      <div style={{ flexShrink: 0, padding: collapsed ? '8px' : '8px 10px 10px',
                    borderTop: `1px solid ${C.sidebarBorder}` }}>
        <div
          onClick={() => { setCollapsed((v) => !v); setFlyout(null); }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 11,
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '11px 0' : '10px 14px',
            borderRadius: 10, cursor: 'pointer',
            color: C.t4, fontFamily: FONT, fontSize: T.meta, fontWeight: W.medium,
            userSelect: 'none', whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {collapsed ? <PanelLeftOpen size={19} strokeWidth={2} />
                     : <PanelLeftClose size={19} strokeWidth={2} />}
          {!collapsed && 'Collapse'}
        </div>
      </div>
      )}

      {/* Portaled + position:fixed. Anything absolutely positioned inside the
          rail is clipped by the root's overflow:hidden. */}
      {collapsed && flyout && createPortal(
        <div
          onMouseLeave={() => setFlyout(null)}
          style={{
            position: 'fixed', top: flyout.top, left: flyout.left,
            minWidth: 190, padding: 6,
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            boxShadow: C.shadowLg,
            zIndex: 300,
          }}
        >
          <div style={{
            fontFamily: FONT, fontSize: T.label, fontWeight: W.bold, color: C.t6,
            textTransform: 'uppercase', letterSpacing: '.06em', padding: '4px 10px 7px',
          }}>
            {flyout.group.label}
          </div>
          {flyout.group.items.map((item) => (
            <NavRow key={item.id} item={item} active={page === item.id} collapsed={false}
              onClick={() => { go(item.id); setFlyout(null); }} />
          ))}
        </div>, document.body)}
    </div>
    </>
  );
}

/**
 * ONE row implementation for the grouped rendering, the flat rail and the
 * fly-out, so the three cannot drift apart. `indented` only shifts it under a
 * group header.
 */
function NavRow({ item, active, collapsed, indented, onClick }) {
  return (
    <div
      onClick={onClick}
      title={collapsed ? item.label : ''}
      style={{
        display: 'flex', alignItems: 'center',
        gap: collapsed ? 0 : 11,
        padding: collapsed ? '13px 0' : (indented ? '11px 14px 11px 26px' : '12px 14px'),
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'background .15s',
        marginBottom: 2,
        background: active ? C.primary : 'transparent',
        // NOT C.t4. A nav label is a PRIMARY destination, not secondary text.
        color: active ? '#fff' : C.t2,
        justifyContent: collapsed ? 'center' : 'flex-start',
        fontFamily: FONT,
        fontSize: T.bodyLg,
        fontWeight: active ? W.bold : W.medium,
        whiteSpace: 'nowrap', overflow: 'hidden', userSelect: 'none',
      }}
      // HOVER CHANGES THE BACKGROUND ONLY — never the text colour, so there is
      // no value for the leave handler to restore wrongly.
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = C.hover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = active ? C.primary : 'transparent'; }}
    >
      <span style={{ width: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <item.Icon size={19} strokeWidth={2} />
      </span>
      {!collapsed && <span style={{ letterSpacing: '-.01em' }}>{item.label}</span>}
    </div>
  );
}
