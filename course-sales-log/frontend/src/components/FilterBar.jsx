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
