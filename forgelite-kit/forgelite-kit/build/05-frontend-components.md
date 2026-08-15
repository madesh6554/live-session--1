# Phase 5 — Frontend components (primitives + shell)
The UI primitive library and the app shell (topbar, sidebar/drawer, filter bar).
`ui.jsx` is the biggest file in the project — copy it carefully and completely.

> **Rule:** create every file below with EXACTLY the content shown — byte for byte. No reformatting, no renaming, no improvements, no extra comments. Paths are relative to the project root `course-sales-log/`.

**Files in this phase (4):** `frontend/src/components/ui.jsx` · `frontend/src/components/Topbar.jsx` · `frontend/src/components/Sidebar.jsx` · `frontend/src/components/FilterBar.jsx`

---

#### FILE: frontend/src/components/ui.jsx
````jsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  LoaderCircle, ChevronsUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Inbox, CircleAlert, CircleCheck, TrendingUp, TrendingDown,
} from 'lucide-react';
import { C, FONT, MONO, T, W, LH, STATUS, fmtNum } from '../constants';
import { useIsNarrow } from '../utils/useMediaQuery';

/* ------------------------------ Primitives ------------------------------- */

export function Spinner({ size = 18, color = C.t6, style }) {
  return (
    <LoaderCircle size={size} strokeWidth={2} color={color}
      style={{ animation: 'spin 1s linear infinite', ...style }} />
  );
}

export function SortIcon({ active, asc }) {
  if (!active) return <ChevronsUpDown size={14} strokeWidth={2} style={{ color: C.t8, marginLeft: 4 }} />;
  const I = asc ? ArrowUp : ArrowDown;
  return <I size={14} strokeWidth={2.5} style={{ color: C.primary, marginLeft: 4 }} />;
}

export function Card({ title, tag, children, headerRight, pad = 16, style }) {
  return (
    <div
      data-card={typeof title === 'string' ? title : undefined}
      style={{
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: 'hidden',
        ...style,
      }}
    >
      {title && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: '13px 16px',
          borderBottom: `1px solid ${C.divider}`,
        }}>
          <span style={{ fontFamily: FONT, fontSize: T.h3, fontWeight: W.bold, color: C.t1,
                         lineHeight: LH.tight }}>
            {title}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {tag && (
              <span style={{
                fontFamily: MONO, fontSize: T.micro, fontWeight: W.normal,
                padding: '3px 9px', borderRadius: 999,
                background: C.surfaceMuted, color: C.t3,
                border: `1px solid ${C.borderSubtle}`,
              }}>{tag}</span>
            )}
            {headerRight}
          </div>
        </div>
      )}
      <div style={{ padding: pad }}>{children}</div>
    </div>
  );
}

const ACCENTS = {
  green:  C.successText,
  blue:   C.infoText,
  orange: C.orangeText,
  amber:  C.warnText,
  purple: C.purple,
};

export function StatCard({ label, value, accent = 'green', sub, trend, loading }) {
  const color = ACCENTS[accent] || ACCENTS.green;
  // A 40px KPI does not fit a half-width tile on a 390px screen — ₹20.64L was
  // being clipped mid-number. The tile keeps its two-up layout; the figure steps
  // down instead, because two readable tiles beat one oversized one.
  const narrow = useIsNarrow();
  return (
    <div data-stat={label} style={{
      background: C.cardBg,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 16,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{
          fontFamily: MONO, fontSize: T.label, color: C.t5,
          textTransform: 'uppercase', letterSpacing: '.08em',
        }}>{label}</div>
        {trend !== undefined && trend !== null && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            fontFamily: MONO, fontSize: T.micro, fontWeight: W.bold,
            color: trend >= 0 ? C.successText : C.dangerText,
          }}>
            {trend >= 0 ? <TrendingUp size={13} strokeWidth={2.5} />
                        : <TrendingDown size={13} strokeWidth={2.5} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      {loading ? (
        <div style={{ height: 34, width: 110, borderRadius: 6, background: C.surfaceMuted }} />
      ) : (
        <div data-stat-value style={{
          fontFamily: MONO, fontSize: narrow ? T.h2 : T.kpi, fontWeight: W.heavy,
          lineHeight: 1, color, letterSpacing: '-.02em',
        }}>{value}</div>
      )}
      {sub && (
        <div style={{ fontFamily: FONT, fontSize: T.meta, color: C.t5, marginTop: 7 }}>{sub}</div>
      )}
    </div>
  );
}

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status || '-', text: C.t4, bg: C.surfaceMuted, border: C.border };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: MONO, fontSize: T.micro, fontWeight: W.bold,
      padding: '3px 9px', borderRadius: 999,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor' }} />
      {s.label}
    </span>
  );
}

export function EmptyState({ Icon = Inbox, title = 'Nothing here yet', hint }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 16px', textAlign: 'center',
    }}>
      <Icon size={38} strokeWidth={1.5} style={{ color: C.t8, marginBottom: 10 }} />
      <div style={{ fontFamily: FONT, fontSize: T.bodyLg, fontWeight: W.medium, color: C.t3 }}>{title}</div>
      {hint && (
        <div style={{ fontFamily: FONT, fontSize: T.meta, color: C.t6, marginTop: 5, maxWidth: 360,
                      lineHeight: LH.snug }}>{hint}</div>
      )}
    </div>
  );
}

export function ErrorMsg({ children, onRetry }) {
  if (!children) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      borderRadius: 9, border: `1px solid ${C.dangerBorder}`, background: C.dangerBg,
      padding: '9px 12px', marginBottom: 12,
      fontFamily: FONT, fontSize: T.body, color: C.dangerText, lineHeight: LH.snug,
    }}>
      <CircleAlert size={17} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ flex: 1 }}>{children}</span>
      {onRetry && (
        <button onClick={onRetry} style={{
          background: 'none', border: 'none', color: C.dangerText,
          textDecoration: 'underline', cursor: 'pointer', flexShrink: 0,
          fontFamily: FONT, fontSize: T.body, padding: 0,
        }}>Retry</button>
      )}
    </div>
  );
}

/**
 * Label above the control, sentence case, with a red asterisk when required.
 *
 * Not the uppercase mono eyebrow used for table heads: a field label is read
 * once per field while filling it in, so it wants to be quick to read, not
 * decorative. The eyebrow style belongs to `SectionLabel`, one level up.
 */
export function Field({ label, hint, error, required, children, style }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0, ...style }}>
      <span style={{ fontFamily: FONT, fontSize: T.meta, fontWeight: W.medium, color: C.t2 }}>
        {label}
        {required && <span style={{ color: C.dangerText, marginLeft: 3 }}>*</span>}
      </span>
      {children}
      {error ? (
        <span style={{ fontFamily: FONT, fontSize: T.micro, color: C.dangerText }}>{error}</span>
      ) : hint ? (
        <span style={{ fontFamily: FONT, fontSize: T.micro, color: C.t6 }}>{hint}</span>
      ) : null}
    </label>
  );
}

/** The uppercase eyebrow that names a group of fields. */
export function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: FONT, fontSize: T.micro, fontWeight: W.bold, color: C.t6,
      textTransform: 'uppercase', letterSpacing: '.05em',
    }}>{children}</div>
  );
}

/**
 * Choices as stacked full-width cards, each with its own radio dot.
 *
 * Preferred over segmented pills whenever the labels are long or there are more
 * than three: a card row keeps the full label readable at any width, and the
 * whole row is the hit target rather than a cramped third of one.
 */
export function ChoiceList({ value, onChange, options, name, allowClear = false, columns = 1 }) {
  return (
    <div role="radiogroup" aria-label={name}
      style={{ display: 'grid', gap: 8, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const val = o.value ?? o;
        const label = o.label ?? o;
        const on = String(value) === String(val);
        return (
          <button key={String(val)} type="button" role="radio" aria-checked={on}
            onClick={() => onChange(allowClear && on ? '' : val)}
            style={{
              display: 'flex', alignItems: 'center', gap: 11,
              width: '100%', minHeight: 48, padding: '10px 14px',
              borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              borderWidth: 1, borderStyle: 'solid',
              borderColor: on ? C.primary : C.border,
              background: on ? C.primaryLight : C.surfaceInner,
              color: on ? C.t1 : C.t2,
              fontFamily: FONT, fontSize: T.body, fontWeight: on ? W.bold : W.medium,
            }}
            onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = C.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = on ? C.primaryLight : C.surfaceInner; }}
          >
            {/* The dot carries selection alongside fill and weight, so state is
                never colour alone. */}
            <span style={{
              width: 18, height: 18, borderRadius: 999, flexShrink: 0,
              display: 'grid', placeItems: 'center',
              borderWidth: on ? 5 : 1.5, borderStyle: 'solid',
              borderColor: on ? C.primary : C.borderStrong,
              background: on ? C.cardBg : 'transparent',
            }} />
            <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Shared field geometry. Spread it, then override per call site.
 *
 * The border is declared LONGHAND on purpose. The focus/blur handlers write
 * `borderColor`, and React warns — correctly — that mixing the `border`
 * shorthand with a longhand for the same value causes styling bugs: whichever
 * is applied second wins, so a re-render while focused can drop the focus ring
 * or strip the border entirely.
 */
export const inputStyle = {
  height: 46,
  padding: '0 13px',
  borderRadius: 10,
  background: C.surfaceInner,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: C.borderStrong,
  color: C.text,
  fontFamily: FONT,
  fontSize: T.body,
  outline: 'none',
  width: '100%',
  minWidth: 0,
};

/** Focus ring without a stylesheet — the border is the only thing that moves. */
export function Input({ style, mono = false, invalid = false, inputRef, ...props }) {
  return (
    <input
      ref={inputRef}
      {...props}
      style={{
        ...inputStyle,
        fontFamily: mono ? MONO : FONT,
        // Amber, not red: the brand accent (and so focus) is red, so a red
        // "not filled in yet" border is indistinguishable from focus.
        ...(invalid ? { borderColor: C.warnBorder, background: C.warnBgSoft } : null),
        ...style,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = C.primary; props.onFocus?.(e); }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = invalid ? C.warnBorder : C.borderStrong;
        props.onBlur?.(e);
      }}
    />
  );
}

const BUTTON_VARIANTS = {
  primary: { background: C.primary, color: '#fff', border: `1px solid ${C.primary}` },
  ghost:   { background: C.surfaceInner, color: C.t2, border: `1px solid ${C.border}` },
  subtle:  { background: 'transparent', color: C.t4, border: '1px solid transparent' },
  danger:  { background: C.dangerSolid, color: '#fff', border: `1px solid ${C.dangerSolid}` },
};

const BUTTON_SIZES = {
  md: { height: 38, padding: '0 15px', fontSize: T.body },
  sm: { height: 31, padding: '0 11px', fontSize: T.meta },
};

export function Button({ children, variant = 'primary', size = 'md', style, disabled, ...props }) {
  const v = BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary;
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        borderRadius: 9,
        fontFamily: FONT, fontWeight: W.medium,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        transition: 'background .15s',
        ...v,
        ...BUTTON_SIZES[size],
        ...style,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background =
          variant === 'primary' ? C.primaryHover : variant === 'danger' ? C.dangerStrong : C.hover;
      }}
      onMouseLeave={(e) => { e.currentTarget.style.background = v.background; }}
    >
      {children}
    </button>
  );
}

/** Small square icon-only button — used for row actions. */
export function IconButton({ Icon, title, danger = false, style, ...props }) {
  const rest = { background: 'transparent' };
  return (
    <button
      {...props}
      title={title}
      aria-label={title}
      style={{
        display: 'grid', placeItems: 'center',
        width: 30, height: 30, flexShrink: 0,
        borderRadius: 8, border: '1px solid transparent',
        color: danger ? C.dangerText : C.t5,
        cursor: 'pointer',
        ...rest,
        ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={16} strokeWidth={2} />
    </button>
  );
}

/* ------------------------------ Pagination ------------------------------- */

export function Pagination({ page, limit, total, onPage }) {
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const totalPages = Math.max(Math.ceil(total / limit), 1);

  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  const arrow = (disabled) => ({
    display: 'grid', placeItems: 'center', width: 28, height: 28,
    borderRadius: 7, border: 'none', background: 'transparent',
    color: C.t4, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.3 : 1,
  });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.divider}`,
    }}>
      <span style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6 }}>
        {total === 0 ? 'No results' : `${start}–${end} of ${fmtNum(total)}`}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"
          style={arrow(page <= 1)}>
          <ChevronLeft size={17} strokeWidth={2} />
        </button>
        {pages.map((p, i) => p === '...' ? (
          <span key={`dots-${i}`} style={{ padding: '0 4px', color: C.t8, fontSize: T.micro }}>…</span>
        ) : (
          <button key={p} onClick={() => onPage(p)}
            style={{
              minWidth: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer',
              fontFamily: MONO, fontSize: T.micro, fontWeight: W.medium,
              background: p === page ? C.primary : 'transparent',
              color: p === page ? '#fff' : C.t4,
            }}
            onMouseEnter={(e) => { if (p !== page) e.currentTarget.style.background = C.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = p === page ? C.primary : 'transparent'; }}
          >{p}</button>
        ))}
        <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page"
          style={arrow(page >= totalPages)}>
          <ChevronRight size={17} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------- Selects -------------------------------- */

/**
 * Portaled to document.body so it escapes any overflow-hidden ancestor —
 * which, in this shell, is every ancestor.
 */
export function Select({ value, onChange, options, placeholder = 'All', disabled, style }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const listRef = useRef(null);

  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    reposition();
    // The list is portaled to <body>, so it is NOT inside triggerRef. It has to
    // be checked separately — otherwise mousedown on an option counts as
    // "outside", the portal unmounts, and the click never lands.
    const close = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (listRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, reposition]);

  const selected = options.find((o) => String(o.value) === String(value));

  return (
    <>
      <button ref={triggerRef} type="button" disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          height: 46, padding: '0 13px', borderRadius: 10,
          background: C.surfaceInner,
          borderWidth: 1, borderStyle: 'solid', borderColor: C.borderStrong,
          color: selected ? C.text : C.t6,
          fontFamily: FONT, fontSize: T.body,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          whiteSpace: 'nowrap',
          ...style,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={15} strokeWidth={2} style={{ color: C.t6, flexShrink: 0 }} />
      </button>

      {open && createPortal(
        <div ref={listRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width,
          maxHeight: 288, overflowY: 'auto',
          background: C.cardBg, border: `1px solid ${C.border}`,
          borderRadius: 10, boxShadow: C.shadowLg, padding: 5, zIndex: 400,
        }}>
          {options.map((o) => {
            const on = String(o.value) === String(value);
            return (
              <button key={String(o.value)} type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 10px', borderRadius: 7, border: 'none',
                  background: on ? C.primaryLight : 'transparent',
                  color: on ? C.primary : C.t2,
                  fontFamily: FONT, fontSize: T.body, fontWeight: on ? W.medium : W.normal,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = C.hover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = on ? C.primaryLight : 'transparent'; }}
              >{o.label}</button>
            );
          })}
        </div>, document.body)}
    </>
  );
}

/**
 * Type-to-filter combobox: a real text input, not a dropdown.
 *
 * Type to narrow, ArrowUp/Down to move, Enter to pick. While the list is open
 * Enter picks instead of submitting the form; once closed, Enter submits like
 * any other field. Free text that doesn't resolve to an option is reverted on
 * blur, so the value handed back is always a real id.
 */
export function Combobox({ value, onChange, options, placeholder = '', inputRef, invalid = false }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  // Has the user typed since the list opened? Until they do, the text in the
  // box is the CURRENT SELECTION, not a search — see the filter below.
  const [typed, setTyped] = useState(false);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value));
  const selectedLabel = selected ? selected.label : '';

  // Keep the text in step with the selected option, including when options
  // arrive after a value was restored from localStorage.
  useEffect(() => {
    if (!open) setText(selectedLabel);
  }, [selectedLabel, open]);

  /**
   * Filter ONLY once the user has typed.
   *
   * Filtering on the box's contents unconditionally means opening a combobox
   * that already holds a value shows exactly one option — the value you already
   * had — because the selected label is a perfect match for itself. It reads as
   * "there is only one salesperson", and the only way to see the rest is to
   * manually clear the box, which nobody guesses.
   */
  const filtered = typed && text.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(text.trim().toLowerCase())).slice(0, 8)
    : options.slice(0, 8);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  function pick(option) {
    onChange(option.value);
    setText(option.label);
    setTyped(false);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); setHighlight(0); return; }
      setHighlight((h) => {
        const next = e.key === 'ArrowDown' ? h + 1 : h - 1;
        return (next + filtered.length) % Math.max(filtered.length, 1);
      });
      return;
    }
    if (e.key === 'Enter' && open && filtered[highlight]) {
      // Pick from the list rather than submitting the form.
      e.preventDefault();
      pick(filtered[highlight]);
      return;
    }
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
      setTyped(false);
      setText(selectedLabel);
    }
  }

  function onBlur() {
    // Give a click on the list time to land before reverting.
    setTimeout(() => {
      const entered = text.trim().toLowerCase();
      const exact = options.find((o) => o.label.toLowerCase() === entered);
      setTyped(false);
      if (exact) { onChange(exact.value); setText(exact.label); }
      else if (!entered) { onChange(''); }
      else setText(selectedLabel);
    }, 120);
  }

  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <Input
        inputRef={inputRef}
        invalid={invalid}
        style={{ paddingRight: 30 }}
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onChange={(e) => { setText(e.target.value); setTyped(true); setOpen(true); setHighlight(0); }}
        // Opening is not searching: show the whole list, and highlight the row
        // that is already selected so Enter is a no-op rather than a surprise.
        onFocus={() => {
          setTyped(false);
          setOpen(true);
          const i = options.findIndex((o) => String(o.value) === String(value));
          setHighlight(i > -1 ? i : 0);
        }}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      />
      <Chevron size={15} strokeWidth={2} style={{
        pointerEvents: 'none', position: 'absolute', right: 10, top: '50%',
        transform: 'translateY(-50%)', color: C.t6,
      }} />

      {open && (
        <div ref={listRef} style={{
          position: 'absolute', zIndex: 300, marginTop: 4, width: '100%',
          maxHeight: 224, overflowY: 'auto',
          background: C.cardBg, border: `1px solid ${C.border}`,
          borderRadius: 10, boxShadow: C.shadowLg, padding: 5,
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '8px 10px', fontFamily: FONT, fontSize: T.body, color: C.t6 }}>
              No match
            </div>
          ) : filtered.map((o, i) => {
            const on = String(o.value) === String(value);
            return (
              <button key={String(o.value)} type="button" data-active={i === highlight}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  background: i === highlight ? C.hover : 'transparent',
                  color: on ? C.primary : C.t2,
                  fontFamily: FONT, fontSize: T.body, fontWeight: on ? W.medium : W.normal,
                }}
              >{o.label}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * A radio group drawn as full-width segments.
 *
 * For a short, known set this beats a dropdown on a phone: every option is
 * visible and costs ONE tap instead of open-scroll-tap. Selection is carried by
 * fill AND weight AND `aria-checked`, never by colour alone.
 */
export function PillGroup({ value, onChange, options, name, allowClear = false }) {
  return (
    <div role="radiogroup" aria-label={name}
      style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 11,
               background: C.surfaceInner, border: `1px solid ${C.border}` }}>
      {options.map((o) => {
        const val = o.value ?? o;
        const label = o.label ?? o;
        const on = String(value) === String(val);
        return (
          <button key={String(val)} type="button" role="radio" aria-checked={on}
            onClick={() => onChange(allowClear && on ? '' : val)}
            style={{
              flex: 1, minWidth: 0, height: 34, borderRadius: 8, border: 'none',
              cursor: 'pointer', padding: '0 6px',
              background: on ? C.primary : 'transparent',
              color: on ? '#fff' : C.t3,
              fontFamily: FONT, fontSize: T.meta, fontWeight: on ? W.bold : W.medium,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = C.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = on ? C.primary : 'transparent'; }}
          >{label}</button>
        );
      })}
    </div>
  );
}

/**
 * A collapsed section for fields that are worth having but must never slow the
 * common path. The count badge is the point: it says at a glance whether this
 * sale carries detail, so "collapsed" never means "forgotten".
 */
export function Disclosure({ label, filledCount = 0, open, onToggle, children }) {
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 11, background: C.surfaceInner }}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 9, width: '100%',
          padding: '11px 13px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left',
          fontFamily: FONT, fontSize: T.body, fontWeight: W.medium, color: C.t2,
        }}>
        <Chevron size={16} strokeWidth={2} style={{ color: C.t5, flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{label}</span>
        {filledCount > 0 && (
          <span style={{
            fontFamily: MONO, fontSize: T.micro, fontWeight: W.bold,
            padding: '2px 8px', borderRadius: 999,
            background: C.successBg, color: C.successText,
            border: `1px solid ${C.successBorder}`,
          }}>{filledCount} added</span>
        )}
      </button>
      {open && (
        <div style={{ padding: '4px 13px 14px', display: 'grid', gap: 14 }}>{children}</div>
      )}
    </div>
  );
}

/* -------------------------------- Toasts --------------------------------- */

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const push = useCallback((message, type = 'success') => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);
  return { toasts, push };
}

export function ToastContainer({ toasts }) {
  return createPortal(
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 500,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {toasts.map((t) => {
        const err = t.type === 'error';
        return (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            borderRadius: 10, padding: '10px 14px',
            background: err ? C.dangerBg : C.successBg,
            border: `1px solid ${err ? C.dangerBorder : C.successBorder}`,
            color: err ? C.dangerText : C.successText,
            boxShadow: C.shadowMd,
            fontFamily: FONT, fontSize: T.body, fontWeight: W.medium,
            animation: 'fadeIn .15s ease-out',
          }}>
            {err ? <CircleAlert size={17} strokeWidth={2} /> : <CircleCheck size={17} strokeWidth={2} />}
            {t.message}
          </div>
        );
      })}
    </div>, document.body);
}

/* -------------------------------- Charts --------------------------------- */

/**
 * Horizontal proportion bar. Thin mark, rounded data-end, recessive track.
 * One colour for every bar by default — length already encodes magnitude, so
 * spending hue on it too would double-encode and tie colour to sort order.
 */
export function HBar({ value, max, color, height = 6 }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{
      height, width: '100%', borderRadius: 999,
      background: C.surfaceMuted, overflow: 'hidden',
    }}>
      <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: color }} />
    </div>
  );
}

/**
 * A single ratio against a limit — the form for "collected out of expected".
 * A meter, not a two-slice pie: the track IS the limit, so the gap is readable
 * as the shortfall without a second colour.
 */
export function Meter({ value, max, color, height = 10, label }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div style={{
        height, width: '100%', borderRadius: 999,
        background: C.surfaceMuted, overflow: 'hidden',
      }}>
        <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: color,
                      transition: 'width .3s ease' }} />
      </div>
      {label && (
        <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6, marginTop: 7 }}>{label}</div>
      )}
    </div>
  );
}

/**
 * Part-to-whole across a handful of states, as one horizontal stacked bar.
 *
 * Segments are separated by a 2px SURFACE GAP rather than a border — a stroke
 * around each segment would add a third colour to every edge.
 */
export function StackedBar({ segments, height = 12 }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const shown = segments.filter((s) => s.value > 0);
  return (
    <div style={{ display: 'flex', gap: 2, height, width: '100%' }}>
      {shown.map((s, i) => (
        <div key={s.label} title={`${s.label}: ${s.value}`}
          style={{
            width: `${(s.value / total) * 100}%`,
            background: s.color,
            borderRadius: shown.length === 1 ? 999
              : i === 0 ? '999px 3px 3px 999px'
              : i === shown.length - 1 ? '3px 999px 999px 3px' : 3,
          }} />
      ))}
    </div>
  );
}

/* -------------------------------- Tables --------------------------------- */

export const thStyle = {
  padding: '10px 12px',
  textAlign: 'left',
  fontFamily: MONO,
  fontSize: T.label,
  fontWeight: W.medium,
  color: C.t6,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  whiteSpace: 'nowrap',
  borderBottom: `1px solid ${C.border}`,
  background: C.surfaceSection,
};

export const tdStyle = {
  padding: '11px 12px',
  fontFamily: FONT,
  fontSize: T.meta,
  color: C.t2,
  borderBottom: `1px solid ${C.rowSep}`,
};

/** Wraps a wide table so IT scrolls, never the page body. */
export function TableScroll({ children }) {
  return <div style={{ overflowX: 'auto', width: '100%' }}>{children}</div>;
}

export const tableStyle = { width: '100%', borderCollapse: 'collapse', minWidth: 640 };
````

#### FILE: frontend/src/components/Topbar.jsx
````jsx
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
````

#### FILE: frontend/src/components/Sidebar.jsx
````jsx
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
````

#### FILE: frontend/src/components/FilterBar.jsx
````jsx
import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { apiGet } from '../utils/api';
import { Select, Input } from './ui';
import { C, FONT, MONO, T, W, isoDate } from '../constants';

const RANGES = [
  { key: '7d',  label: '7D',  from: () => isoDate(-6) },
  { key: '30d', label: '30D', from: () => isoDate(-29) },
  { key: '90d', label: '90D', from: () => isoDate(-89) },
  { key: 'all', label: 'All', from: () => '' },
];

/** One filter bar drives every panel on every data page. */
export default function FilterBar({ value, onChange, showStatus = true, right }) {
  const [options, setOptions] = useState({ products: [], salespeople: [] });

  useEffect(() => {
    apiGet('/api/dashboard/filters').then(setOptions).catch(() => {});
  }, []);

  const set = (patch) => onChange({ ...value, ...patch, page: 1 });

  const applyRange = (r) => set({ from: r.from(), to: r.key === 'all' ? '' : isoDate() });
  const activeRange = RANGES.find((r) =>
    (r.key === 'all' && !value.from) || (value.from && value.from === r.from())
  );

  const isDirty = value.from || value.to || value.product_id || value.salesperson_id
    || value.status || value.q;

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        borderRadius: 9, border: `1px solid ${C.border}`,
        background: C.surfaceInner, padding: 3,
      }}>
        {RANGES.map((r) => {
          const on = activeRange?.key === r.key;
          return (
            <button key={r.key} onClick={() => applyRange(r)}
              style={{
                padding: '0 11px', height: 30, borderRadius: 7, border: 'none',
                cursor: 'pointer',
                fontFamily: MONO, fontSize: T.micro, fontWeight: W.medium,
                background: on ? C.primary : 'transparent',
                color: on ? '#fff' : C.t4,
              }}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = C.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = on ? C.primary : 'transparent'; }}
            >{r.label}</button>
          );
        })}
      </div>

      <Input type="date" value={value.from || ''} mono aria-label="From date"
        onChange={(e) => set({ from: e.target.value })}
        style={{ width: 150, fontSize: T.meta }} />
      <span style={{ fontFamily: FONT, fontSize: T.meta, color: C.t6 }}>to</span>
      <Input type="date" value={value.to || ''} mono aria-label="To date"
        onChange={(e) => set({ to: e.target.value })}
        style={{ width: 150, fontSize: T.meta }} />

      <Select placeholder="All products" value={value.product_id || ''}
        onChange={(v) => set({ product_id: v })}
        options={[{ value: '', label: 'All products' },
                  ...options.products.map((p) => ({ value: p.id, label: p.name }))]} />

      <Select placeholder="All salespeople" value={value.salesperson_id || ''}
        onChange={(v) => set({ salesperson_id: v })}
        options={[{ value: '', label: 'All salespeople' },
                  ...options.salespeople.map((s) => ({ value: s.id, label: s.name }))]} />

      {showStatus && (
        <Select placeholder="Any status" value={value.status || ''}
          onChange={(v) => set({ status: v })}
          options={[
            { value: '', label: 'Any status' },
            { value: 'paid', label: 'Paid' },
            { value: 'partial', label: 'Partial' },
            { value: 'unpaid', label: 'Unpaid' },
          ]} />
      )}

      <div style={{ position: 'relative', width: 200 }}>
        <Search size={15} strokeWidth={2} style={{
          pointerEvents: 'none', position: 'absolute', left: 10, top: '50%',
          transform: 'translateY(-50%)', color: C.t6,
        }} />
        <Input value={value.q || ''} onChange={(e) => set({ q: e.target.value })}
          placeholder="Name or phone" aria-label="Search name or phone"
          style={{ paddingLeft: 31 }} />
      </div>

      {isDirty && (
        <button onClick={() => onChange({ page: 1 })}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            height: 38, padding: '0 10px', borderRadius: 9,
            background: 'transparent', border: '1px solid transparent',
            color: C.t5, fontFamily: FONT, fontSize: T.meta, cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <X size={14} strokeWidth={2.5} /> Clear
        </button>
      )}

      {right && <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>{right}</div>}
    </div>
  );
}
````

---
**Checkpoint:** 4 files written. Append `phase 05 done` to PROGRESS.md and
continue with `forgelite-kit/build/06-frontend-pages.md`.
