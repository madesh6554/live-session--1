# Phase 4 — Frontend core (theme layer + config)
Create the frontend config, the theme layer (both palettes, tokens, provider)
and the utilities. After writing all files, run **in
`course-sales-log/frontend/`**:

    npm install

> **Rule:** create every file below with EXACTLY the content shown — byte for byte. No reformatting, no renaming, no improvements, no extra comments. Paths are relative to the project root `course-sales-log/`.

**Files in this phase (12):** `frontend/package.json` · `frontend/vite.config.js` · `frontend/index.html` · `frontend/src/index.css` · `frontend/src/theme.jsx` · `frontend/src/constants.js` · `frontend/src/main.jsx` · `frontend/src/App.jsx` · `frontend/src/utils/api.js` · `frontend/src/utils/chartSetup.js` · `frontend/src/utils/useMediaQuery.js` · `frontend/src/utils/permissions.js`

---

#### FILE: frontend/package.json
````json
{
  "name": "course-sales-log-frontend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "chart.js": "^4.4.4",
    "lucide-react": "^1.31.0",
    "react": "^18.3.1",
    "react-chartjs-2": "^5.2.0",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.8"
  }
}
````

#### FILE: frontend/vite.config.js
````js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Keeps the browser same-origin, so the httpOnly session cookie just works.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
````

#### FILE: frontend/index.html
````html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!-- data: URI suppresses the browser's automatic /favicon.ico request (was a console 404). -->
    <link rel="icon" href="data:," />
    <title>Course Sales Log</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <script>
      // Apply the saved theme before React mounts to avoid a flash of light mode.
      (function () {
        try {
          var p = localStorage.getItem('saleslog.theme') || 'system';
          var dark = p === 'dark' || (p === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
          document.documentElement.dataset.theme = dark ? 'dark' : 'light';
          document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
        } catch (e) {}
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
````

#### FILE: frontend/src/index.css
````css
/* The ForgeGrowth theme layer: two palettes over the same key set, swapped by
   data-theme on <html>. Nothing here is app-specific — every colour a component
   uses comes from the C object in constants.js, which points at these. */

*, *::before, *::after { box-sizing: border-box; }

html, body, #root {
  margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden;
}

body {
  font-family: 'DM Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: var(--c-pageBg);
  color: var(--c-text);
}

input, button, textarea, select { font-family: inherit; }

/* ---------------------------- Light — default ---------------------------- */

:root, :root[data-theme="light"] {
  --c-pageBg: #F7F7F3;
  --c-sidebarBg: #FAF9F5;
  --c-sidebarBorder: #E5E5E0;
  --c-headerBg: #0F0F10;
  --c-headerText: #F5F5F2;
  --c-headerMuted: #A1A1AA;
  --c-headerBorder: rgba(255,255,255,.12);
  --c-headerSurface: rgba(255,255,255,.06);
  --c-cardBg: #ffffff;
  --c-border: #E5E5E0;
  --c-borderDark: #d1d7db;
  --c-text: #111111;
  --c-textSecondary: #6B7280;
  --c-textMuted: #667180;
  --c-primary: #dc2626;
  --c-primaryHover: #b91c1c;
  --c-primaryLight: #FCEBEB;
  --c-primaryText: #111b21;
  --c-purple: #534AB7;
  --c-green: #0F6E56;
  --c-amber: #E8A317;
  --c-shadowSm: 0 1px 2px rgba(0,0,0,.08);
  --c-shadowMd: 0 8px 24px rgba(0,0,0,.06);
  --c-shadowLg: 0 20px 60px rgba(0,0,0,.15);

  /* Surface elevation ramp: page < alt < card < inner < section < muted < subtle */
  --c-surface: #ffffff;
  --c-surfaceAlt: #F7F7F3;
  --c-hover: #EFEEE6;
  --c-surfaceInner: #FAFAF7;
  --c-surfaceSection: #F8F7F2;
  --c-surfaceMuted: #F1F1EE;
  --c-surfaceSubtle: #EEEDE8;
  --c-borderSubtle: #EEEEE8;
  --c-borderStrong: #D5D5D0;
  --c-divider: #F0F0EA;
  --c-rowSep: #F5F5F0;

  --c-nodeBorder: #B4B3AA;
  --c-edgeLine: #8A897F;

  /* Text ramp: t1 strongest -> t8 faintest */
  --c-t1: #111111;
  --c-t2: #222222;
  --c-t3: #444444;
  --c-t4: #666666;
  --c-t5: #737373;
  --c-t6: #7B7B7B;
  --c-t7: #878787;
  --c-t8: #9A9A9A;

  /* Semantic pairs: <name>Text is always legible on <name>Bg */
  --c-dangerText: #A32D2D;
  --c-dangerStrong: #991b1b;
  --c-dangerBg: #FCEBEB;
  --c-dangerBgSoft: #FDF6F6;
  --c-dangerBorder: #F8C8C8;
  --c-dangerSolid: #A32D2D;

  --c-successText: #0F6E56;
  --c-successBright: #1D9E75;
  --c-successBg: #E1F5EE;
  --c-successBgSoft: #E4F3EE;
  --c-successBorder: #B8DCCF;

  --c-warnText: #854F0B;
  --c-warnDeep: #6B5312;
  --c-warnBg: #FAEEDA;
  --c-warnBgSoft: #FFF8E1;
  --c-warnBorder: #F0DCA8;

  --c-orangeText: #E65100;
  --c-orangeBg: #FFF3E0;
  --c-orangeBorder: #FFB74D;

  --c-infoText: #1565C0;
  --c-infoBright: #2563eb;
  --c-infoBg: #E3F2FD;
  --c-infoBorder: #BBDEFB;

  /* Accents */
  --c-purpleBg: #EEEDFE;
  --c-navy: #1B2A4E;   --c-navyBg: #E5EAF2;
  --c-teal: #00796B;   --c-tealBg: #DDF1EE;
  --c-pink: #9C2153;   --c-pinkBg: #FBE5EE;
  --c-successTint: #F0FAF6;
  --c-selectedTint: #FFF7F7;
  --c-watermark: #dddddd;

  /* Chrome */
  --c-toastBg: #111111;
  --c-toastText: #ffffff;
  --c-overlaySoft: rgba(255,255,255,0.50);
  --c-scrollThumb: #d4d4cd;
  --c-scrollTrack: transparent;
  --c-selectionBg: #dc262633;

  /* Sits ON the always-near-black topbar, so it is deliberately theme-INVARIANT
     and carries white in both palettes — a fixed light background needs a fixed
     foreground, or one of the two themes ends up illegible. */
  --c-avatarBg: #5B54C4;
  --c-avatarText: #FFFFFF;
}

/* ------------------------------- Dark ------------------------------------ */
/* header #0D0D0D < page #131313 < sidebar #171717 < card #1C1C1C < panel #222222.
   Kept NEUTRAL (no blue cast) to match the warm-neutral light theme. */

:root[data-theme="dark"] {
  --c-pageBg: #131313;
  --c-sidebarBg: #171717;
  --c-sidebarBorder: #2A2A2A;
  --c-headerBg: #0D0D0D;
  --c-headerText: #F2F2F2;
  --c-headerMuted: #9C9C9C;
  --c-headerBorder: rgba(255,255,255,.10);
  --c-headerSurface: rgba(255,255,255,.07);
  --c-cardBg: #1C1C1C;
  --c-border: #2E2E2E;
  --c-borderDark: #3A3A3A;
  --c-text: #ECECEC;
  --c-textSecondary: #A8A8A8;
  --c-textMuted: #9BA3AC;
  --c-primary: #EF4444;
  --c-primaryHover: #F87171;
  --c-primaryLight: #3A1A1A;
  --c-primaryText: #ECECEC;
  --c-purple: #A99BF5;
  --c-green: #35D0A0;
  --c-amber: #F0B84A;
  /* Shadows carry far less signal on dark — borders do the separating. */
  --c-shadowSm: 0 1px 2px rgba(0,0,0,.5);
  --c-shadowMd: 0 8px 24px rgba(0,0,0,.55);
  --c-shadowLg: 0 20px 60px rgba(0,0,0,.7);

  --c-surface: #1C1C1C;
  --c-surfaceAlt: #161616;
  --c-hover: #262626;
  --c-surfaceInner: #222222;
  --c-surfaceSection: #202020;
  --c-surfaceMuted: #262626;
  --c-surfaceSubtle: #242424;
  --c-borderSubtle: #272727;
  --c-borderStrong: #3A3A3A;
  --c-divider: #242424;
  --c-rowSep: #232323;

  --c-nodeBorder: #4E4E4E;
  --c-edgeLine: #8A8A8A;

  /* Text ramp — mirrors light MONOTONICALLY */
  --c-t1: #F2F2F2;
  --c-t2: #E4E4E4;
  --c-t3: #C9C9C9;
  --c-t4: #ADADAD;
  --c-t5: #9C9C9C;
  --c-t6: #949494;
  --c-t7: #8A8A8A;
  --c-t8: #7E7E7E;

  /* Semantic pairs — tinted background, light readable text */
  --c-dangerText: #F98C8C;
  --c-dangerStrong: #FCA5A5;
  --c-dangerBg: #3A1A1A;
  --c-dangerBgSoft: #2A1616;
  --c-dangerBorder: #5A2626;
  --c-dangerSolid: #B3403E;

  --c-successText: #4ADE9F;
  --c-successBright: #34D399;
  --c-successBg: #123026;
  --c-successBgSoft: #142A23;
  --c-successBorder: #1E5245;

  --c-warnText: #F0B84A;
  --c-warnDeep: #E8C46A;
  --c-warnBg: #33270F;
  --c-warnBgSoft: #2C230F;
  --c-warnBorder: #4D3B15;

  --c-orangeText: #FFA657;
  --c-orangeBg: #35220F;
  --c-orangeBorder: #5A3A18;

  --c-infoText: #7AB4F5;
  --c-infoBright: #8FC0F7;
  --c-infoBg: #14263A;
  --c-infoBorder: #23405F;

  --c-purpleBg: #221F3D;
  --c-navy: #9FB4DC;   --c-navyBg: #1A2233;
  --c-teal: #3FC8B4;   --c-tealBg: #0F2B28;
  --c-pink: #F2789F;   --c-pinkBg: #331722;
  --c-successTint: #14231F;
  --c-selectedTint: #2A1A1A;
  --c-watermark: #3F3F3F;

  --c-toastBg: #2E2E2E;
  --c-toastText: #F2F2F2;
  --c-overlaySoft: rgba(255,255,255,0.08);
  --c-scrollThumb: #3A3A3A;
  --c-scrollTrack: transparent;
  --c-selectionBg: #ef444455;

  /* Identical to light on purpose — see the note there. */
  --c-avatarBg: #5B54C4;
  --c-avatarText: #FFFFFF;
}

/* --------------------- Global chrome that must be themed ------------------ */

input, textarea, select { color: var(--c-text); }
::placeholder { color: var(--c-textMuted); opacity: 1; }
::selection { background: var(--c-selectionBg); color: var(--c-text); }

* { scrollbar-color: var(--c-scrollThumb) var(--c-scrollTrack); }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: var(--c-scrollTrack); }
::-webkit-scrollbar-thumb {
  background: var(--c-scrollThumb);
  border-radius: 8px;
  border: 2px solid transparent;
  background-clip: content-box;
}
::-webkit-scrollbar-thumb:hover { background: var(--c-textMuted); background-clip: content-box; }
::-webkit-scrollbar-corner { background: transparent; }

/* The native date picker's calendar glyph is black artwork; invert it on dark
   or it disappears into the field. */
:root[data-theme="dark"] ::-webkit-calendar-picker-indicator { filter: invert(0.85); }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
````

#### FILE: frontend/src/theme.jsx
````jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Theme manager: 'light' | 'dark' | 'system'. Persisted per-device in
// localStorage (the standard for dark mode). 'system' follows the OS setting
// live via matchMedia. The effective theme is applied as data-theme on <html>,
// which swaps the CSS-variable palette defined in index.css.
const ThemeCtx = createContext(null);
const KEY = 'saleslog.theme';          // must equal the key in index.html

function systemDark() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function resolve(pref) {
  return pref === 'system' ? (systemDark() ? 'dark' : 'light') : pref;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; }
  });
  const [effective, setEffective] = useState(() => resolve(theme));

  const apply = useCallback((pref) => {
    const eff = resolve(pref);
    document.documentElement.dataset.theme = eff;
    document.documentElement.style.colorScheme = eff;
    setEffective(eff);
  }, []);

  const setTheme = useCallback((pref) => {
    try { localStorage.setItem(KEY, pref); } catch { /* private mode */ }
    setThemeState(pref);
    apply(pref);
  }, [apply]);

  // Apply on mount.
  useEffect(() => { apply(theme); /* eslint-disable-next-line */ }, []);

  // When following the system, re-apply whenever the OS theme flips.
  useEffect(() => {
    if (theme !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange); };
  }, [theme, apply]);

  return (
    <ThemeCtx.Provider value={{ theme, setTheme, effective }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx) || { theme: 'light', setTheme: () => {}, effective: 'light' };
}
````

#### FILE: frontend/src/constants.js
````js
/* Design tokens + formatting helpers.
 *
 * Every colour is `var(--c-x, <light literal>)`. The fallback is never used
 * while the palette is defined; it exists so the migration is provably a no-op
 * in light mode. A page must NEVER define its own palette.
 */

export const C = {
  pageBg:        'var(--c-pageBg, #F7F7F3)',
  sidebarBg:     'var(--c-sidebarBg, #FAF9F5)',
  sidebarBorder: 'var(--c-sidebarBorder, #E5E5E0)',
  headerBg:      'var(--c-headerBg, #0F0F10)',
  headerText:    'var(--c-headerText, #F5F5F2)',
  headerMuted:   'var(--c-headerMuted, #A1A1AA)',
  headerBorder:  'var(--c-headerBorder, rgba(255,255,255,.12))',
  headerSurface: 'var(--c-headerSurface, rgba(255,255,255,.06))',
  cardBg:        'var(--c-cardBg, #ffffff)',
  border:        'var(--c-border, #E5E5E0)',
  borderDark:    'var(--c-borderDark, #d1d7db)',
  text:          'var(--c-text, #111111)',
  textSecondary: 'var(--c-textSecondary, #6B7280)',
  textMuted:     'var(--c-textMuted, #667180)',
  primary:       'var(--c-primary, #dc2626)',
  primaryHover:  'var(--c-primaryHover, #b91c1c)',
  primaryLight:  'var(--c-primaryLight, #FCEBEB)',
  purple:        'var(--c-purple, #534AB7)',
  green:         'var(--c-green, #0F6E56)',
  amber:         'var(--c-amber, #E8A317)',
  shadowSm:      'var(--c-shadowSm, 0 1px 2px rgba(0,0,0,.08))',
  shadowMd:      'var(--c-shadowMd, 0 8px 24px rgba(0,0,0,.06))',
  shadowLg:      'var(--c-shadowLg, 0 20px 60px rgba(0,0,0,.15))',

  // Surfaces
  surface:        'var(--c-surface, #ffffff)',
  surfaceAlt:     'var(--c-surfaceAlt, #F7F7F3)',
  hover:          'var(--c-hover, #EFEEE6)',
  surfaceInner:   'var(--c-surfaceInner, #FAFAF7)',
  surfaceSection: 'var(--c-surfaceSection, #F8F7F2)',
  surfaceMuted:   'var(--c-surfaceMuted, #F1F1EE)',
  surfaceSubtle:  'var(--c-surfaceSubtle, #EEEDE8)',
  borderSubtle:   'var(--c-borderSubtle, #EEEEE8)',
  borderStrong:   'var(--c-borderStrong, #D5D5D0)',
  divider:        'var(--c-divider, #F0F0EA)',
  rowSep:         'var(--c-rowSep, #F5F5F0)',

  // Text ramp (t1 strongest -> t8 faintest)
  t1: 'var(--c-t1, #111111)',  t2: 'var(--c-t2, #222222)',
  t3: 'var(--c-t3, #444444)',  t4: 'var(--c-t4, #666666)',
  t5: 'var(--c-t5, #737373)',  t6: 'var(--c-t6, #7B7B7B)',
  t7: 'var(--c-t7, #878787)',  t8: 'var(--c-t8, #9A9A9A)',

  // Semantic pairs — <name>Text is always legible on <name>Bg
  dangerText:   'var(--c-dangerText, #A32D2D)',
  dangerStrong: 'var(--c-dangerStrong, #991b1b)',
  dangerBg:     'var(--c-dangerBg, #FCEBEB)',
  dangerBgSoft: 'var(--c-dangerBgSoft, #FDF6F6)',
  dangerBorder: 'var(--c-dangerBorder, #F8C8C8)',
  dangerSolid:  'var(--c-dangerSolid, #A32D2D)',
  successText:   'var(--c-successText, #0F6E56)',
  successBright: 'var(--c-successBright, #1D9E75)',
  successBg:     'var(--c-successBg, #E1F5EE)',
  successBgSoft: 'var(--c-successBgSoft, #E4F3EE)',
  successBorder: 'var(--c-successBorder, #B8DCCF)',
  warnText:   'var(--c-warnText, #854F0B)',
  warnDeep:   'var(--c-warnDeep, #6B5312)',
  warnBg:     'var(--c-warnBg, #FAEEDA)',
  warnBgSoft: 'var(--c-warnBgSoft, #FFF8E1)',
  warnBorder: 'var(--c-warnBorder, #F0DCA8)',
  orangeText:   'var(--c-orangeText, #E65100)',
  orangeBg:     'var(--c-orangeBg, #FFF3E0)',
  orangeBorder: 'var(--c-orangeBorder, #FFB74D)',
  infoText:   'var(--c-infoText, #1565C0)',
  infoBright: 'var(--c-infoBright, #2563eb)',
  infoBg:     'var(--c-infoBg, #E3F2FD)',
  infoBorder: 'var(--c-infoBorder, #BBDEFB)',

  // Accents + chrome
  purpleBg:     'var(--c-purpleBg, #EEEDFE)',
  navy: 'var(--c-navy, #1B2A4E)',  navyBg: 'var(--c-navyBg, #E5EAF2)',
  teal: 'var(--c-teal, #00796B)',  tealBg: 'var(--c-tealBg, #DDF1EE)',
  pink: 'var(--c-pink, #9C2153)',  pinkBg: 'var(--c-pinkBg, #FBE5EE)',
  successTint:  'var(--c-successTint, #F0FAF6)',
  selectedTint: 'var(--c-selectedTint, #FFF7F7)',
  watermark:    'var(--c-watermark, #dddddd)',
  toastBg:      'var(--c-toastBg, #111111)',
  toastText:    'var(--c-toastText, #ffffff)',
  overlaySoft:  'var(--c-overlaySoft, rgba(255,255,255,0.50))',
  nodeBorder:   'var(--c-nodeBorder, #B4B3AA)',
  edgeLine:     'var(--c-edgeLine, #8A897F)',
  avatarBg:     'var(--c-avatarBg, #5B54C4)',
  avatarText:   'var(--c-avatarText, #FFFFFF)',
};

export const FONT = "'DM Sans', system-ui, sans-serif";
export const MONO = "'DM Mono', monospace";

/**
 * The steps are deliberately few. Every extra step is a decision someone has to
 * make correctly at 200 call sites.
 *
 *   micro   11  hard FLOOR for real UI text. A badge count or a timestamp
 *               sitting beside something bigger. NEVER body copy.
 *   label   12  uppercase letterspaced column heads, eyebrow labels, chips.
 *   meta    13  secondary lines under a title; dense table cells.
 *   body    14  the default. If you are unsure, this is the answer.
 *   bodyLg  15  primary rows people scan — nav items, list titles, form values.
 *   lead    16  the strongest line in a card; sub-section headings.
 *   h3      18  panel and card titles.
 *   h2      22  section titles.
 *   h1      30  page titles.
 *   kpi     40  a single number that is the point of its card.
 */
export const T = {
  micro: 11, label: 12, meta: 13, body: 14, bodyLg: 15,
  lead: 16, h3: 18, h2: 22, h1: 30, kpi: 40,
};

/** 500 is the LIGHTEST weight allowed for anything a user reads. */
export const W = {
  normal: 500,
  medium: 600,
  bold:   700,
  heavy:  800,
};

/** Small text needs proportionally MORE leading, not less. */
export const LH = { tight: 1.25, snug: 1.4, normal: 1.55 };

/* ------------------------------ App constants ----------------------------- */

/**
 * Chart series palette — VALIDATED, not eyeballed.
 *
 * Both columns clear every check against this app's real chart surfaces
 * (#ffffff light card, #1C1C1C dark card) on the adjacent pairlist:
 *
 *   node scripts/validate_palette.js "<light hexes>" --mode light --surface "#ffffff"
 *   node scripts/validate_palette.js "<dark hexes>"  --mode dark  --surface "#1C1C1C"
 *
 * Light worst adjacent CVD ΔE 9.1 / normal 19.6; dark 8.4 / 19.3. The light
 * column carries a contrast WARN on three slots, which is discharged because
 * every mark using them is directly labelled — do not use these on an unlabelled
 * mark. Re-run the validator before changing a single value here.
 *
 * Canvas cannot resolve var(), so these are real literals per theme.
 */
const SERIES_LIGHT = ['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4','#008300','#4a3aa7','#e34948'];
const SERIES_DARK  = ['#3987e5','#d95926','#199e70','#c98500','#d55181','#008300','#9085e9','#e66767'];

export const seriesColors = (effective) => (effective === 'dark' ? SERIES_DARK : SERIES_LIGHT);

/**
 * Magnitude bars are ONE hue — slot 1.
 *
 * Giving each bar its own colour double-encodes length as hue: it spends the
 * only free channel on information the bar already shows, and because the rows
 * are sorted, the hue tracks RANK — so filtering one row out repaints all the
 * survivors and "the green one" silently becomes a different product.
 */
export const magnitudeColor = (effective) => seriesColors(effective)[0];

/* No categorical encoding survives on this dashboard: every panel is either a
 * magnitude comparison or a single time series, so slot 1 is the only series
 * colour actually used. Identity colour was tried for the leaderboard avatars
 * and removed — white initials on the lighter slots failed contrast, and a
 * colour that only repeats an adjacent label is not worth a legibility risk.
 * If a real categorical chart lands here later, key its colour on the row's own
 * id, never its sorted position.
 */

export const PAYMENT_MODES = ['UPI', 'Cash', 'Card', 'NEFT', 'IMPS', 'RTGS', 'Cheque', 'Other'];

/**
 * Optional student-profile options.
 *
 * These three lists are PAIRED with allow-lists in routes/sales.js and CHECK
 * constraints in migration 006. All three must change together — the server
 * rejects an unknown value, so a list that drifts here produces a 400 the user
 * cannot act on.
 */
export const GENDERS = ['Male', 'Female', 'Other'];
export const PROFESSIONS = [
  'Student', 'Working Professional', 'Business', 'Job Seeker', 'Homemaker', 'Other',
];
export const SOURCES = [
  'Instagram', 'YouTube', 'Facebook', 'Google Search', 'LinkedIn', 'WhatsApp',
  'Friend / Referral', 'Walk-in', 'Other',
];

/** A status is a semantic PAIR — never one half, or dark mode goes light-on-light. */
export const STATUS = {
  paid:    { label: 'Paid',    text: C.successText, bg: C.successBg, border: C.successBorder },
  partial: { label: 'Partial', text: C.warnText,    bg: C.warnBg,    border: C.warnBorder },
  unpaid:  { label: 'Unpaid',  text: C.dangerText,  bg: C.dangerBg,  border: C.dangerBorder },
};

export const DEFAULT_LIMIT = 50;

/**
 * Is the view narrowed by anything the user chose?
 *
 * Empty-because-no-data and empty-because-no-match need DIFFERENT copy: the
 * first says "here's how to start", the second says "widen your filters". One
 * message for both is why an empty screen reads as a broken app.
 */
export function hasActiveFilters(f = {}) {
  return Boolean(f.from || f.to || f.product_id || f.salesperson_id || f.status || f.q);
}

/** ₹ with Indian digit grouping. No decimals — this is a sales log, not a ledger. */
export function fmtMoney(n) {
  const v = Number(n ?? 0);
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/** Compact ₹ for stat cards: ₹1.2L, ₹3.4Cr. */
export function fmtMoneyShort(n) {
  const v = Number(n ?? 0);
  if (Math.abs(v) >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  if (Math.abs(v) >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function fmtNum(n) {
  return Number(n ?? 0).toLocaleString('en-IN');
}

/** Date-only, IST. Sale dates are dates, not timestamps — no timezone shifting. */
export function fmtDate(d) {
  if (!d) return '-';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  if (!y || !m || !day) return '-';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day} ${months[Number(m) - 1]} ${y}`;
}

export function fmtDateTime(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function buildQuery(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** Today / N days ago as yyyy-mm-dd in local time. */
export function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
````

#### FILE: frontend/src/main.jsx
````jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './theme';
import './utils/chartSetup';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
````

#### FILE: frontend/src/App.jsx
````jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Entry from './pages/Entry';
import Dashboard from './pages/Dashboard';

/**
 * Two URLs, no sign-in:
 *   /entry     — the fast entry form, all a salesperson ever sees
 *   /dashboard — KPIs, charts and the full sales log
 */
export default function App() {
  return (
    <Routes>
      <Route path="/entry" element={<Entry />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="*" element={<Navigate to="/entry" replace />} />
    </Routes>
  );
}
````

#### FILE: frontend/src/utils/api.js
````js
const API_DOWN = 'Cannot reach the API on port 4000. Start it with: cd backend && npm run dev';

/** Thin fetch wrapper around the JSON API. */
export async function apiFetch(path, options = {}) {
  let res;
  try {
    res = await fetch(path, {
      credentials: 'include', // carries the dashboard session cookie
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
  } catch {
    // Network-level failure — no server, DNS, or CORS.
    throw new Error(API_DOWN);
  }

  // An expired or missing dashboard session anywhere sends the UI back to the
  // login gate instead of leaving half-rendered panels behind.
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    window.dispatchEvent(new CustomEvent('csl:unauthorized'));
  }

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const body = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    // A non-JSON error body means the response came from the Vite proxy, not
    // our API — which almost always means the API process isn't running.
    if (!isJson) throw new Error(API_DOWN);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body;
}

export const apiGet = (path) => apiFetch(path);
export const apiPost = (path, data) =>
  apiFetch(path, { method: 'POST', body: JSON.stringify(data) });
export const apiPatch = (path, data) =>
  apiFetch(path, { method: 'PATCH', body: JSON.stringify(data) });
````

#### FILE: frontend/src/utils/chartSetup.js
````js
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler
);

ChartJS.defaults.font.family = "'DM Sans', system-ui, sans-serif";
ChartJS.defaults.font.size = 12;
ChartJS.defaults.plugins.legend.display = false;
ChartJS.defaults.plugins.tooltip.borderWidth = 1;
ChartJS.defaults.plugins.tooltip.cornerRadius = 6;
ChartJS.defaults.plugins.tooltip.padding = 10;
ChartJS.defaults.plugins.tooltip.titleFont = { family: "'DM Mono', monospace", size: 12 };
ChartJS.defaults.plugins.tooltip.bodyFont = { family: "'DM Sans', sans-serif", size: 12 };
ChartJS.defaults.responsive = true;
ChartJS.defaults.maintainAspectRatio = false;

/**
 * A canvas cannot resolve `var(--c-x)` — Chart.js writes the string straight
 * into a 2D context, which silently paints nothing. So the palette has to be
 * READ from the document and handed over as literals, and re-read whenever
 * data-theme flips.
 */
export function cssVar(name, fallback = '') {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v.trim() || fallback;
}

/** Push the current palette into Chart.js' global defaults. */
export function applyChartTheme() {
  ChartJS.defaults.color = cssVar('--c-t5', '#737373');
  ChartJS.defaults.borderColor = cssVar('--c-border', '#E5E5E0');
  ChartJS.defaults.plugins.tooltip.backgroundColor = cssVar('--c-toastBg', '#111111');
  ChartJS.defaults.plugins.tooltip.titleColor = cssVar('--c-toastText', '#ffffff');
  ChartJS.defaults.plugins.tooltip.bodyColor = cssVar('--c-toastText', '#ffffff');
  ChartJS.defaults.plugins.tooltip.borderColor = cssVar('--c-borderStrong', '#D5D5D0');
}

export default ChartJS;
````

#### FILE: frontend/src/utils/useMediaQuery.js
````js
import { useState, useEffect } from 'react';

/**
 * Inline styles cannot carry a media query, so responsive branches are decided
 * in JS instead. One listener per query, and the initial value is read
 * synchronously so the first paint is already correct.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

export const useIsNarrow = () => useMediaQuery('(max-width: 640px)');
````

#### FILE: frontend/src/utils/permissions.js
````js
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
````

---
**Checkpoint:** `npm install` finished. Append `phase 04 done` to PROGRESS.md and
continue with `forgelite-kit/build/05-frontend-components.md`.
