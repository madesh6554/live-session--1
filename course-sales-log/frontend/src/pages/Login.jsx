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
