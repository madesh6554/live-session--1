import { Fragment, useEffect, useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, CircleCheckBig } from 'lucide-react';
import { apiGet } from '../utils/api';
import { Card, StatCard, StatusBadge, Spinner, EmptyState, ErrorMsg,
         useToast, ToastContainer, TableScroll, tableStyle, thStyle, tdStyle } from './ui';
import { SaleDetail } from './SalesTable';
import { C, MONO, T, W, LH, fmtMoney, fmtMoneyShort, fmtNum, fmtDate, buildQuery } from '../constants';

/**
 * The chase worklist: every sale in the current filter window that isn't fully
 * paid, biggest balance first. Server-capped at 200 rows — see the note below
 * the table, which says so rather than silently truncating.
 */
export default function Outstanding({ filters }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const { toasts, push } = useToast();

  const load = useCallback(async () => {
    setError('');
    try {
      const d = await apiGet(`/api/sales/outstanding${buildQuery({ ...filters, page: undefined })}`);
      setRows(d.sales);
    } catch (err) {
      setError(err.message);
      setRows([]); // a failed load is not a pending one
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const totalDue = (rows || []).reduce((s, r) => s + Number(r.outstanding), 0);
  const partial = (rows || []).filter((r) => r.payment_status === 'partial').length;
  const unpaid = (rows || []).filter((r) => r.payment_status === 'unpaid').length;

  return (
    <div>
      <ErrorMsg onRetry={load}>{error}</ErrorMsg>

      <div style={{
        display: 'grid', gap: 12, marginBottom: 16,
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      }}>
        <StatCard label="Outstanding" accent="amber" loading={!rows}
          value={fmtMoneyShort(totalDue)} sub={`across ${fmtNum(rows?.length)} sales`} />
        <StatCard label="Part paid" accent="orange" loading={!rows}
          value={fmtNum(partial)} sub="something collected" />
        <StatCard label="Nothing paid" accent="blue" loading={!rows}
          value={fmtNum(unpaid)} sub="no payment at all" />
      </div>

      <Card pad={0} title="Chase list" tag={rows ? String(rows.length) : '…'}>
        {!rows ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: '64px 0' }}><Spinner size={26} /></div>
        ) : !rows.length ? (
          <EmptyState Icon={CircleCheckBig} title="Nothing outstanding"
            hint="Every sale in this filter window is fully paid." />
        ) : (
          <>
            <TableScroll>
              <table style={{ ...tableStyle, minWidth: 860 }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 34 }} />
                    <th style={thStyle}>Customer</th>
                    <th style={thStyle}>Product</th>
                    <th style={thStyle}>Sold by</th>
                    <th style={thStyle}>Sale date</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Price</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Collected</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Outstanding</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const open = openId === s.id;
                    const Chevron = open ? ChevronUp : ChevronDown;
                    return (
                      <Fragment key={s.id}>
                        <tr
                          onClick={() => setOpenId(open ? null : s.id)}
                          style={{ cursor: 'pointer', background: open ? C.selectedTint : 'transparent' }}
                          onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = C.hover; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = open ? C.selectedTint : 'transparent'; }}
                        >
                          <td style={{ ...tdStyle, paddingLeft: 12, paddingRight: 0 }}>
                            <Chevron size={16} strokeWidth={2} style={{ color: C.t6, display: 'block' }} />
                          </td>
                          <td style={tdStyle}>
                            <div style={{ color: C.t1, fontWeight: W.medium, lineHeight: LH.tight }}>
                              {s.customer_name}
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6 }}>
                              {s.customer_phone}
                            </div>
                          </td>
                          <td style={{ ...tdStyle, color: C.t4 }}>{s.product_name}</td>
                          <td style={{ ...tdStyle, color: C.t4 }}>{s.salesperson_name}</td>
                          <td style={{ ...tdStyle, fontFamily: MONO, color: C.t5 }}>{fmtDate(s.sale_date)}</td>
                          <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right' }}>{fmtMoney(s.sale_price)}</td>
                          <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right', color: C.successText }}>
                            {fmtMoney(s.collected)}
                          </td>
                          <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right',
                                       fontWeight: W.bold, color: C.warnText }}>
                            {fmtMoney(s.outstanding)}
                          </td>
                          <td style={tdStyle}><StatusBadge status={s.payment_status} /></td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={9} style={{
                              background: C.surfaceAlt, padding: 18,
                              borderBottom: `1px solid ${C.border}`,
                            }}>
                              <SaleDetail saleId={s.id}
                                onChanged={(msg) => { push(msg); load(); }} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
            {rows.length >= 200 && (
              <div style={{ padding: '10px 16px 14px', fontFamily: MONO, fontSize: T.micro, color: C.t6 }}>
                Showing the 200 largest balances. Narrow the filters to see the rest.
              </div>
            )}
          </>
        )}
      </Card>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
