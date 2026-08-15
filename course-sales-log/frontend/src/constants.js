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
