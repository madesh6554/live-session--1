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
