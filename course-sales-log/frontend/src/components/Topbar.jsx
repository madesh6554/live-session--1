import { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, LogOut, Settings, Menu } from 'lucide-react';
import { C, FONT, MONO, T, W, LH, initials } from '../constants';
import { useTheme } from '../theme';
import { usePagePermissions } from '../utils/permissions';
import { useIsNarrow } from '../utils/useMediaQuery';
import { ADMIN_PAGE } from '../pages/AdminSettingsPage';

const CYCLE = { light: 'dark', dark: 'system', system: 'light' };
const THEME_ICON = { light: Sun, dark: Moon, system: Monitor };

/**
 * 56px, C.headerBg — near-black in BOTH themes. It is the app's constant.
 *
 * Controls living ON this bar use headerSurface / headerMuted / headerBorder.
 * Page tokens (C.hover, C.t4) vanish against near-black and must not be used
 * here — the ONE exception is the dropdown, which is a page surface that merely
 * hangs off the bar.
 *
 * Admin settings is reached from the user menu, not the sidebar: it configures
 * the app rather than being a place in it.
 */
export default function Topbar({ user, onSignOut, onAdminSettings, onMenu, right }) {
  const { theme, setTheme } = useTheme();
  const narrow = useIsNarrow();
  const allowed = usePagePermissions();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const ThemeIcon = THEME_ICON[theme] || Monitor;

  const canAdmin = !allowed || allowed.has(ADMIN_PAGE);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <div style={{
      height: 56,
      background: C.headerBg,
      display: 'flex',
      alignItems: 'center',
      paddingLeft: 16,
      paddingRight: 16,
      gap: 16,
      borderBottom: `1px solid ${C.headerBorder}`,
      flexShrink: 0,
      zIndex: 100,
      position: 'relative',
    }}>
      {/* The only way into the nav on a phone, so it sits first — before the
          wordmark — where a thumb reaches and where every app puts it. */}
      {narrow && onMenu && (
        <button onClick={onMenu} aria-label="Open menu"
          style={{
            display: 'grid', placeItems: 'center', width: 36, height: 36, flexShrink: 0,
            marginLeft: -4, borderRadius: 9,
            background: 'transparent', border: `1px solid ${C.headerBorder}`,
            color: C.headerText, cursor: 'pointer',
          }}>
          <Menu size={18} strokeWidth={2} />
        </button>
      )}

      {/* Wordmark: plain half + badged half. Uppercase at weight 900 with
          NEGATIVE tracking — that tracking is what keeps a heavy uppercase
          lockup from reading loose. The badge is C.primary carrying white in
          both themes, the same solid-fill rule the primary button follows. */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: FONT,
        fontSize: T.h3,
        fontWeight: 900,
        letterSpacing: '-0.01em',
        textTransform: 'uppercase',
        lineHeight: 1,
        userSelect: 'none',
      }}>
        <span style={{ color: C.headerText }}>Forge</span>
        <span style={{
          background: C.primary,
          color: '#fff',
          borderRadius: 7,
          // Optical, not symmetric: uppercase sits high in its em box, so an
          // equal top/bottom pad reads bottom-heavy.
          padding: '4px 7px 5px',
        }}>Lite</span>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        {right}
      </div>

      <button
        onClick={() => setTheme(CYCLE[theme] || 'light')}
        title={`Theme: ${theme} — click for ${CYCLE[theme]}`}
        aria-label={`Theme: ${theme}`}
        style={{
          display: 'grid', placeItems: 'center',
          width: 34, height: 34, flexShrink: 0,
          borderRadius: 9,
          background: C.headerSurface,
          border: `1px solid ${C.headerBorder}`,
          color: C.headerText,
          cursor: 'pointer',
        }}
      >
        <ThemeIcon size={17} strokeWidth={2} />
      </button>

      {user && (
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            title={user.name}
            aria-label={`Account menu for ${user.name}`}
            aria-expanded={menuOpen}
            style={{
              display: 'grid', placeItems: 'center',
              width: 34, height: 34,
              borderRadius: 10,
              background: C.avatarBg,
              // The ring is what lifts the chip off near-black; it brightens on
              // open so the trigger reads as active while the menu is down.
              border: `2px solid ${menuOpen ? C.headerText : C.headerBorder}`,
              color: C.avatarText,
              fontFamily: FONT, fontSize: T.meta, fontWeight: W.bold,
              letterSpacing: '.01em',
              cursor: 'pointer', padding: 0,
            }}
          >
            {initials(user.name).slice(0, 1)}
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute', top: 42, right: 0, minWidth: 210,
              background: C.cardBg,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              boxShadow: C.shadowLg,
              padding: 6,
              zIndex: 200,
            }}>
              <div style={{ padding: '8px 10px 10px' }}>
                <div style={{ fontFamily: FONT, fontSize: T.body, fontWeight: W.bold,
                              color: C.t1, lineHeight: LH.tight }}>
                  {user.name}
                </div>
                <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6 }}>
                  {user.username}
                </div>
              </div>

              {canAdmin && (
                <>
                  <Divider />
                  <MenuItem Icon={Settings} label="Admin Settings"
                    onClick={() => { setMenuOpen(false); onAdminSettings(); }} />
                </>
              )}

              <Divider />
              <MenuItem Icon={LogOut} label="Sign out" danger
                onClick={() => { setMenuOpen(false); onSignOut(); }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: C.divider, margin: '4px 0' }} />;
}

function MenuItem({ Icon, label, danger, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '9px 10px', borderRadius: 8,
        background: 'transparent', border: 'none',
        color: danger ? C.dangerText : C.t2,
        fontFamily: FONT, fontSize: T.body, fontWeight: W.medium,
        cursor: 'pointer', textAlign: 'left',
      }}
      // Background only — never the text colour, so there is nothing for the
      // leave handler to restore wrongly.
      onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={16} strokeWidth={2} />
      {label}
    </button>
  );
}
