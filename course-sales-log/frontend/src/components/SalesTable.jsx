import { useEffect, useState, useCallback } from 'react';
import { Download, ChevronDown, ChevronUp, Receipt, CircleCheck } from 'lucide-react';
import { apiGet, apiPost } from '../utils/api';
import { Card, StatCard, StatusBadge, Pagination, SortIcon, Spinner, EmptyState,
         ErrorMsg, Button, Input, Select, useToast, ToastContainer,
         TableScroll, tableStyle, thStyle, tdStyle } from './ui';
import { useIsNarrow } from '../utils/useMediaQuery';
import { C, FONT, MONO, T, W, LH, fmtMoney, fmtMoneyShort, fmtNum, fmtDate,
         fmtDateTime, buildQuery, hasActiveFilters, PAYMENT_MODES,
         DEFAULT_LIMIT } from '../constants';

const COLUMNS = [
  { key: 'sale_date',        label: 'Date',        sortable: true },
  { key: 'customer_name',    label: 'Customer',    sortable: true },
  { key: 'product_name',     label: 'Product',     sortable: true },
  { key: 'salesperson_name', label: 'Sold by',     sortable: true },
  { key: 'sale_price',       label: 'Price',       sortable: true, right: true },
  { key: 'collected',        label: 'Collected',   sortable: true, right: true },
  { key: 'outstanding',      label: 'Outstanding', sortable: true, right: true },
  { key: 'payment_status',   label: 'Status',      sortable: true },
];

export default function SalesTable({ filters, onFilters }) {
  const [sort, setSort] = useState({ key: 'sale_date', dir: 'desc' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const { toasts, push } = useToast();
  const narrow = useIsNarrow();

  const page = filters.page || 1;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = buildQuery({
        ...filters, page, limit: DEFAULT_LIMIT, sort: sort.key, dir: sort.dir,
      });
      setData(await apiGet(`/api/sales${qs}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, page, sort]);

  useEffect(() => { load(); }, [load]);

  const toggleSort = (key) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));

  const totals = data?.totals;

  function exportCsv() {
    window.open(`/api/sales/export.csv${buildQuery({ ...filters, page: undefined })}`, '_blank');
  }

  return (
    <div>
      <div style={{
        display: 'grid', gap: 12, marginBottom: 16,
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      }}>
        <StatCard label="Sales" value={fmtNum(totals?.total)} accent="blue" loading={loading && !data} />
        <StatCard label="Expected" value={fmtMoneyShort(totals?.expected)} accent="purple" loading={loading && !data} />
        <StatCard label="Collected" value={fmtMoneyShort(totals?.collected)} accent="green" loading={loading && !data} />
        <StatCard label="Outstanding" value={fmtMoneyShort(totals?.outstanding)} accent="amber" loading={loading && !data} />
      </div>

      <Card pad={0} title="Sales log" headerRight={
        <Button variant="ghost" size="sm" onClick={exportCsv}>
          <Download size={15} strokeWidth={2} /> CSV
        </Button>
      }>
        <div style={{ padding: error ? '14px 16px 0' : 0 }}>
          <ErrorMsg onRetry={load}>{error}</ErrorMsg>
        </div>

        {loading && !data ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: '64px 0' }}><Spinner size={26} /></div>
        ) : !data?.sales.length ? (
          hasActiveFilters(filters) ? (
            <EmptyState Icon={Receipt} title="No sales match these filters"
              hint="Try widening the date range, or clear the filters." />
          ) : (
            <EmptyState Icon={Receipt} title="No sales recorded yet"
              hint="Sales appear here as soon as someone saves one on the entry form." />
          )
        ) : narrow ? (
          // A nine-column table on a 390px screen is scrollable but not
          // readable — the money ends up off-screen, which is the one thing
          // this page exists to show. One card per sale instead.
          <div>
            {data.sales.map((s) => (
              <SaleCard key={s.id} sale={s}
                open={openId === s.id}
                onToggle={() => setOpenId(openId === s.id ? null : s.id)}
                onChanged={(msg) => { push(msg); load(); }} />
            ))}
          </div>
        ) : (
          <TableScroll>
            <table style={{ ...tableStyle, minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 34 }} />
                  {COLUMNS.map((c) => (
                    <th key={c.key} style={{ ...thStyle, textAlign: c.right ? 'right' : 'left' }}>
                      {c.sortable ? (
                        <button onClick={() => toggleSort(c.key)}
                          style={{
                            display: 'inline-flex', alignItems: 'center',
                            flexDirection: c.right ? 'row-reverse' : 'row',
                            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                            font: 'inherit', color: 'inherit', letterSpacing: 'inherit',
                            textTransform: 'inherit',
                          }}>
                          {c.label}
                          <SortIcon active={sort.key === c.key} asc={sort.dir === 'asc'} />
                        </button>
                      ) : c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.sales.map((s) => (
                  <SaleRow key={s.id} sale={s}
                    open={openId === s.id}
                    onToggle={() => setOpenId(openId === s.id ? null : s.id)}
                    onChanged={(msg) => { push(msg); load(); }} />
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}

        {data?.total > 0 && (
          <div style={{ padding: '0 16px 14px' }}>
            <Pagination page={page} limit={DEFAULT_LIMIT} total={data.total}
              onPage={(p) => onFilters({ ...filters, page: p })} />
          </div>
        )}
      </Card>

      <ToastContainer toasts={toasts} />
    </div>
  );
}

/**
 * One sale as a card, for phones.
 *
 * Shows exactly what the table's columns show, stacked by importance: who, what,
 * then the money — so the numbers are never the part you have to scroll to.
 */
function SaleCard({ sale, open, onToggle, onChanged }) {
  const Chevron = open ? ChevronUp : ChevronDown;
  const due = Number(sale.outstanding) > 0;
  return (
    <div style={{ borderBottom: `1px solid ${C.rowSep}`,
                  background: open ? C.selectedTint : 'transparent' }}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%',
          padding: '13px 14px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}>
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0, fontFamily: FONT, fontSize: T.bodyLg,
                           fontWeight: W.bold, color: C.t1, overflow: 'hidden',
                           textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sale.customer_name}
            </span>
            <StatusBadge status={sale.payment_status} />
          </div>

          <div style={{ fontFamily: FONT, fontSize: T.meta, color: C.t4 }}>
            {sale.product_name}
          </div>

          <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6 }}>
            {fmtDate(sale.sale_date)} · {sale.salesperson_name} · {sale.customer_phone}
          </div>

          {/* The money line, always visible — this is the row's point. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 2,
                        fontFamily: MONO, fontSize: T.meta }}>
            <span style={{ color: C.t2 }}>{fmtMoney(sale.sale_price)}</span>
            <span style={{ color: C.successText }}>{fmtMoney(sale.collected)} in</span>
            {due && <span style={{ color: C.warnText, fontWeight: W.bold }}>
              {fmtMoney(sale.outstanding)} due
            </span>}
          </div>
        </div>

        <Chevron size={17} strokeWidth={2} style={{ color: C.t6, flexShrink: 0, marginTop: 2 }} />
      </button>

      {open && (
        <div style={{ background: C.surfaceAlt, padding: 14,
                      borderTop: `1px solid ${C.border}` }}>
          <SaleDetail saleId={sale.id} onChanged={onChanged} />
        </div>
      )}
    </div>
  );
}

function SaleRow({ sale, open, onToggle, onChanged }) {
  const cellFor = (key) => {
    switch (key) {
      case 'sale_date':
        return <span style={{ fontFamily: MONO }}>{fmtDate(sale.sale_date)}</span>;
      case 'customer_name':
        return (
          <div style={{ minWidth: 0 }}>
            <div style={{ color: C.t1, fontWeight: W.medium, lineHeight: LH.tight,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sale.customer_name}
            </div>
            <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6 }}>{sale.customer_phone}</div>
          </div>
        );
      case 'product_name':    return <span style={{ color: C.t4 }}>{sale.product_name}</span>;
      case 'salesperson_name':return <span style={{ color: C.t4 }}>{sale.salesperson_name}</span>;
      case 'sale_price':      return <span style={{ fontFamily: MONO }}>{fmtMoney(sale.sale_price)}</span>;
      case 'collected':
        return <span style={{ fontFamily: MONO, color: C.successText }}>{fmtMoney(sale.collected)}</span>;
      case 'outstanding':
        return (
          <span style={{ fontFamily: MONO, color: Number(sale.outstanding) > 0 ? C.warnText : C.t7 }}>
            {fmtMoney(sale.outstanding)}
          </span>
        );
      case 'payment_status':  return <StatusBadge status={sale.payment_status} />;
      default: return null;
    }
  };

  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <>
      <tr
        onClick={onToggle}
        style={{ cursor: 'pointer', background: open ? C.selectedTint : 'transparent' }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = C.hover; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = open ? C.selectedTint : 'transparent'; }}
      >
        <td style={{ ...tdStyle, paddingLeft: 12, paddingRight: 0 }}>
          <Chevron size={16} strokeWidth={2} style={{ color: C.t6, display: 'block' }} />
        </td>
        {COLUMNS.map((c) => (
          <td key={c.key} style={{ ...tdStyle, textAlign: c.right ? 'right' : 'left' }}>
            {cellFor(c.key)}
          </td>
        ))}
      </tr>
      {open && (
        <tr>
          <td colSpan={COLUMNS.length + 1} style={{
            background: C.surfaceAlt, padding: 18, borderBottom: `1px solid ${C.border}`,
          }}>
            <SaleDetail saleId={sale.id} onChanged={onChanged} />
          </td>
        </tr>
      )}
    </>
  );
}

const subHeading = {
  fontFamily: MONO, fontSize: T.label, color: C.t5,
  textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10,
};

/** Exported so the Outstanding worklist reuses this exact panel rather than
 *  growing a second, drifting copy of the add-payment form. */
export function SaleDetail({ saleId, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('UPI');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await apiGet(`/api/sales/${saleId}`));
    } catch (err) {
      setError(err.message);
    }
  }, [saleId]);

  useEffect(() => { load(); }, [load]);

  async function addPayment(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await apiPost(`/api/sales/${saleId}/payments`, { amount, mode });
      setAmount('');
      await load();
      onChanged('Payment added');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!detail) return <div style={{ display: 'grid', placeItems: 'center', padding: 24 }}><Spinner /></div>;

  const { sale, payments, audit } = detail;
  const settled = Number(sale.outstanding) <= 0;

  return (
    <div style={{ display: 'grid', gap: 22,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
      <div>
        <div style={subHeading}>Payments ({payments.length})</div>
        {payments.length === 0 ? (
          <p style={{ fontFamily: FONT, fontSize: T.body, color: C.t6, margin: 0 }}>
            Nothing collected yet.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td style={{ ...tdStyle, fontFamily: MONO, color: C.t5, padding: '7px 8px 7px 0' }}>
                    {fmtDate(p.paid_on)}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: MONO, fontWeight: W.bold, color: C.successText, padding: '7px 8px' }}>
                    {fmtMoney(p.amount)}
                  </td>
                  <td style={{ ...tdStyle, color: C.t4, padding: '7px 8px' }}>{p.mode}</td>
                  <td style={{ ...tdStyle, color: C.t7, fontSize: T.micro, textAlign: 'right', padding: '7px 0 7px 8px' }}>
                    {p.reference || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {audit.length > 0 && (
          <>
            <div style={{ ...subHeading, marginTop: 18 }}>Edit history</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {audit.map((a, i) => (
                <div key={i} style={{ fontFamily: FONT, fontSize: T.micro, color: C.t6, lineHeight: LH.snug }}>
                  <span style={{ fontFamily: MONO }}>{fmtDateTime(a.changed_at)}</span>
                  {' — '}<strong style={{ color: C.t3 }}>{a.field}</strong>
                  {' changed from '}<span style={{ color: C.t3 }}>{a.old_value ?? '—'}</span>
                  {' to '}<span style={{ color: C.t3 }}>{a.new_value ?? '—'}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div>
        <div style={subHeading}>
          {settled ? 'Fully paid' : `Add payment — ${fmtMoney(sale.outstanding)} due`}
        </div>
        {settled ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7,
                        fontFamily: FONT, fontSize: T.body, color: C.successText }}>
            <CircleCheck size={17} strokeWidth={2} /> Nothing outstanding.
          </div>
        ) : (
          <form onSubmit={addPayment} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Input mono inputMode="decimal" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Up to ${Number(sale.outstanding).toFixed(0)}`} />
            <Select value={mode} onChange={setMode}
              options={PAYMENT_MODES.map((m) => ({ value: m, label: m }))} />
            <ErrorMsg>{error}</ErrorMsg>
            <Button type="submit" size="sm" disabled={busy || !amount}>
              {busy ? 'Adding…' : 'Add payment'}
            </Button>
          </form>
        )}

        {sale.notes && (
          <>
            <div style={{ ...subHeading, marginTop: 18, marginBottom: 5 }}>Notes</div>
            <p style={{ fontFamily: FONT, fontSize: T.body, color: C.t4, margin: 0, lineHeight: LH.snug }}>
              {sale.notes}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
