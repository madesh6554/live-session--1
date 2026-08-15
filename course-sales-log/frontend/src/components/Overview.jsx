import { Fragment, useEffect, useState, useCallback, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { LineChart, Trophy, GraduationCap, Wallet, CircleCheckBig,
         Megaphone, Briefcase } from 'lucide-react';
import { apiGet } from '../utils/api';
import { Card, StatCard, Spinner, EmptyState, ErrorMsg, HBar, Meter, StackedBar,
         StatusBadge, TableScroll, tableStyle, thStyle, tdStyle } from './ui';
import { C, FONT, MONO, T, W, LH, STATUS, magnitudeColor, hasActiveFilters,
         fmtMoney, fmtMoneyShort, fmtNum, fmtDate, buildQuery, initials } from '../constants';
import { useTheme } from '../theme';
import { cssVar } from '../utils/chartSetup';
import { useIsNarrow } from '../utils/useMediaQuery';

export default function Overview({ filters }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await apiGet(`/api/dashboard/summary${buildQuery({ ...filters, page: undefined })}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const k = data?.kpis;

  return (
    <div>
      <ErrorMsg onRetry={load}>{error}</ErrorMsg>

      <HeadlineRow k={k} loading={loading && !data} />

      {loading && !data ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: '80px 0' }}>
          <Spinner size={28} />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
          <TrendCard trend={data?.trend || []} />

          <LeaderboardCard rows={data?.leaderboard || []} filters={filters}
            openId={openId} setOpenId={setOpenId} />

          <div style={{ display: 'grid', gap: 16,
                        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))' }}>
            <ProductCard rows={data?.by_product || []} />
            <ModeCard rows={data?.by_mode || []} />
          </div>

          <div style={{ display: 'grid', gap: 16,
                        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))' }}>
            <SourceCard rows={data?.by_source || []} />
            <ProfessionCard rows={data?.by_profession || []} genders={data?.by_gender || []} />
          </div>

          <OutstandingCard rows={data?.top_outstanding || []} total={k?.outstanding}
            openCount={Number(k?.partial_count || 0) + Number(k?.unpaid_count || 0)} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Headline row ------------------------------ */

/**
 * Collected is the number this page exists to report, so it gets a hero figure
 * and a meter against Expected — a single ratio against a limit, which is a
 * meter's exact job rather than a two-slice pie.
 *
 * The remaining four are a KPI row beside it. The old layout gave all five equal
 * weight and wrapped 3-then-2, which said "these are equally important" while
 * looking like a mistake.
 */
function HeadlineRow({ k, loading }) {
  const narrow = useIsNarrow();
  const collected = Number(k?.collected || 0);
  const expected = Number(k?.expected || 0);
  const rate = expected > 0 ? Math.round((collected / expected) * 100) : 0;

  const statuses = [
    { key: 'paid',    label: 'Paid',    value: Number(k?.paid_count || 0) },
    { key: 'partial', label: 'Partial', value: Number(k?.partial_count || 0) },
    { key: 'unpaid',  label: 'Unpaid',  value: Number(k?.unpaid_count || 0) },
  ];

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))' }}>
      {/* Flex column so the card fills the row height gracefully: the status
          split is pushed to the bottom edge rather than leaving a dead band
          under it when the tile grid beside it is taller. */}
      <div style={{
        background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: 18, position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                      background: C.successText }} />
        <div style={{ fontFamily: MONO, fontSize: T.label, color: C.t5,
                      textTransform: 'uppercase', letterSpacing: '.08em' }}>
          Collected
        </div>

        {loading ? (
          <div style={{ height: 44, width: 180, borderRadius: 6, background: C.surfaceMuted,
                        margin: '10px 0' }} />
        ) : (
          <div style={{
            fontFamily: MONO, fontSize: narrow ? 34 : 44, fontWeight: W.heavy, lineHeight: 1.05,
            color: C.successText, letterSpacing: '-.02em', margin: '6px 0 14px',
          }}>{fmtMoneyShort(collected)}</div>
        )}

        <div style={{ marginBottom: 'auto' }}>
          <Meter value={collected} max={expected} color={C.successText}
            label={`${rate}% of ${fmtMoneyShort(expected)} expected · ${fmtMoneyShort(Math.max(expected - collected, 0))} still out`} />
        </div>

        {/* Part-to-whole over three states — the one place on this page where
            colour carries meaning rather than decorating a length. Status
            colours are reserved for exactly this and ship with labels. */}
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.divider}` }}>
          <StackedBar segments={statuses.map((s) => ({
            label: s.label, value: s.value, color: STATUS[s.key].text,
          }))} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 9 }}>
            {statuses.map((s) => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, flexShrink: 0,
                               background: STATUS[s.key].text }} />
                <span style={{ fontFamily: FONT, fontSize: T.micro, color: C.t5 }}>
                  {s.label}
                </span>
                <span style={{ fontFamily: MONO, fontSize: T.micro, fontWeight: W.bold, color: C.t2 }}>
                  {fmtNum(s.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    alignContent: 'start' }}>
        <StatCard label="Expected" accent="purple" loading={loading}
          value={fmtMoneyShort(k?.expected)} sub={`${fmtNum(k?.sale_count)} sales`} />
        <StatCard label="Outstanding" accent="amber" loading={loading}
          value={fmtMoneyShort(k?.outstanding)}
          sub={`${fmtNum(Number(k?.partial_count || 0) + Number(k?.unpaid_count || 0))} open`} />
        <StatCard label="Sales" accent="blue" loading={loading}
          value={fmtNum(k?.sale_count)} sub={`${fmtNum(k?.paid_count)} fully paid`} />
        <StatCard label="Avg ticket" accent="orange" loading={loading}
          value={fmtMoneyShort(k?.avg_ticket)} sub="per sale" />
      </div>
    </div>
  );
}

/* ---------------------------- Collections trend --------------------------- */

/**
 * The API returns only days that HAD a payment. Plotting those rows straight
 * onto a category axis draws a quiet fortnight and a busy fortnight at the same
 * width, so the line lies about when money arrived. Fill every missing day with
 * zero so the x axis is proportional to time.
 */
function fillDayGaps(trend) {
  if (trend.length < 2) return trend.map((t) => ({ ...t, collected: Number(t.collected) }));
  const byDate = new Map(trend.map((t) => [String(t.date).slice(0, 10), Number(t.collected)]));
  const out = [];
  const cur = new Date(`${String(trend[0].date).slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${String(trend[trend.length - 1].date).slice(0, 10)}T00:00:00Z`);
  // Guard against a bad range spinning forever on a malformed date.
  for (let i = 0; cur <= end && i < 2000; i++) {
    const iso = cur.toISOString().slice(0, 10);
    out.push({ date: iso, collected: byDate.get(iso) ?? 0 });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function TrendCard({ trend }) {
  const { effective } = useTheme();
  const series = useMemo(() => fillDayGaps(trend), [trend]);

  const chart = useMemo(() => {
    if (!series.length) return null;
    const line = cssVar('--c-successBright', '#1D9E75');
    return {
      labels: series.map((t) => fmtDate(t.date)),
      datasets: [{
        data: series.map((t) => t.collected),
        borderColor: line,
        backgroundColor: (ctx) => {
          const { chart } = ctx;
          if (!chart.chartArea) return 'transparent';
          const g = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom);
          g.addColorStop(0, hexA(line, effective === 'dark' ? 0.26 : 0.22));
          g.addColorStop(1, hexA(line, 0));
          return g;
        },
        borderWidth: 2,          // thin mark
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 5,     // >= 8px hit target
        pointHoverBorderWidth: 2,
        pointHoverBorderColor: cssVar('--c-cardBg', '#ffffff'),
        pointHoverBackgroundColor: line,
      }],
    };
  }, [series, effective]);

  const total = series.reduce((s, t) => s + t.collected, 0);
  const peak = series.reduce((a, b) => (b.collected > (a?.collected ?? -1) ? b : a), null);
  const days = series.length;
  const avg = days ? total / days : 0;

  return (
    <Card title="Collections over time" tag={fmtMoney(total)}>
      {!chart ? (
        <EmptyState Icon={LineChart} title="No payments in this range" />
      ) : (
        <>
          {/* Selective direct labels: the two values worth reading off the plot,
              stated once here instead of a number on every point. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 14 }}>
            <Figure label="Best day"
              value={fmtMoney(peak?.collected)} sub={fmtDate(peak?.date)} />
            <Figure label="Daily average" value={fmtMoney(avg)} sub={`over ${days} days`} />
          </div>
          <div style={{ height: 250 }}>
            <Line key={effective} data={chart} options={{
              scales: {
                x: {
                  grid: { display: false },
                  ticks: { maxTicksLimit: 8, font: { size: 11 }, maxRotation: 0, autoSkip: true },
                },
                y: {
                  border: { display: false },
                  grid: { color: cssVar('--c-divider', '#F0F0EA'), drawTicks: false },
                  ticks: { callback: (v) => fmtMoneyShort(v), font: { size: 11 }, padding: 8 },
                  beginAtZero: true,
                },
              },
              plugins: {
                tooltip: {
                  callbacks: { label: (c) => `Collected ${fmtMoney(c.parsed.y)}` },
                },
              },
              // Crosshair-style read: hovering anywhere in the column reports
              // that day, rather than demanding a hit on the 2px line.
              interaction: { mode: 'index', intersect: false },
            }} />
          </div>
        </>
      )}
    </Card>
  );
}

function Figure({ label, value, sub }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6,
                    textTransform: 'uppercase', letterSpacing: '.07em' }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: T.lead, fontWeight: W.bold, color: C.t1,
                    lineHeight: LH.tight, marginTop: 2 }}>{value}</div>
      <div style={{ fontFamily: FONT, fontSize: T.micro, color: C.t6 }}>{sub}</div>
    </div>
  );
}

/** #rrggbb + alpha -> rgba(). Chart gradients need a real colour, not a token. */
function hexA(hex, a) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16));
  return `rgba(${r},${g},${b},${a})`;
}

/* ------------------------------ Leaderboard ------------------------------- */

function LeaderboardCard({ rows, filters, openId, setOpenId }) {
  const { effective } = useTheme();
  const bar = magnitudeColor(effective);
  const max = Math.max(...rows.map((r) => Number(r.collected)), 1);

  return (
    <Card title="Salesperson leaderboard" tag={String(rows.length)} pad={0}>
      {!rows.length ? (
        <EmptyState Icon={Trophy}
          title={hasActiveFilters(filters) ? 'No sales match these filters' : 'No sales recorded yet'}
          hint={hasActiveFilters(filters)
            ? 'Try widening the date range, or clear the filters.'
            : 'The leaderboard fills in as sales are recorded.'} />
      ) : (
        <TableScroll>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 48, textAlign: 'center' }}>#</th>
                <th style={thStyle}>Salesperson</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Sales</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Expected</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Collected</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Outstanding</th>
                <th style={{ ...thStyle, width: 160 }}>Share of collections</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const open = openId === r.salesperson_id;
                return (
                  <Fragment key={r.salesperson_id}>
                    <tr
                      onClick={() => setOpenId(open ? null : r.salesperson_id)}
                      style={{ cursor: 'pointer', background: open ? C.selectedTint : 'transparent' }}
                      onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = C.hover; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = open ? C.selectedTint : 'transparent'; }}
                    >
                      <td style={{ ...tdStyle, fontFamily: MONO, color: C.t6, textAlign: 'center' }}>
                        {i + 1}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          {/* Neutral, NOT a series colour. White initials on a
                              categorical hue fails contrast on the lighter slots,
                              and colour here would only repeat what the name
                              beside it already says. */}
                          <span style={{
                            display: 'grid', placeItems: 'center',
                            width: 28, height: 28, borderRadius: 999, flexShrink: 0,
                            fontFamily: MONO, fontSize: T.micro, fontWeight: W.bold,
                            background: C.surfaceMuted,
                            border: `1px solid ${C.borderSubtle}`,
                            color: C.t3,
                          }}>{initials(r.salesperson_name)}</span>
                          <span style={{ fontSize: T.body, fontWeight: W.medium, color: C.t1 }}>
                            {r.salesperson_name}
                          </span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right' }}>{fmtNum(r.sale_count)}</td>
                      <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right', color: C.t5 }}>{fmtMoney(r.expected)}</td>
                      <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right', fontWeight: W.bold, color: C.successText }}>
                        {fmtMoney(r.collected)}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right',
                                   color: Number(r.outstanding) > 0 ? C.warnText : C.t7 }}>
                        {fmtMoney(r.outstanding)}
                      </td>
                      <td style={tdStyle}>
                        <HBar value={Number(r.collected)} max={max} color={bar} />
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={7} style={{
                          background: C.surfaceAlt, padding: 18,
                          borderBottom: `1px solid ${C.border}`,
                        }}>
                          <SalespersonDetail id={r.salesperson_id} filters={filters} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      )}
    </Card>
  );
}

const subHeading = {
  fontFamily: MONO, fontSize: T.label, color: C.t5,
  textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10,
};

function SalespersonDetail({ id, filters }) {
  const { effective } = useTheme();
  const bar = magnitudeColor(effective);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiGet(`/api/dashboard/salesperson/${id}${buildQuery({ ...filters, page: undefined })}`)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [id, filters]);

  if (error) return <ErrorMsg>{error}</ErrorMsg>;
  if (!detail) return <div style={{ display: 'grid', placeItems: 'center', padding: 24 }}><Spinner /></div>;

  const maxProduct = Math.max(...detail.by_product.map((p) => Number(p.collected)), 1);

  return (
    <div style={{ display: 'grid', gap: 22, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
      <div>
        <div style={subHeading}>Products sold</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {detail.by_product.map((p) => (
            <div key={p.product_name}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                            gap: 8, marginBottom: 5 }}>
                <span style={{ fontFamily: FONT, fontSize: T.body, color: C.t2,
                               overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.product_name}
                </span>
                <span style={{ fontFamily: MONO, fontSize: T.micro, color: C.t5, flexShrink: 0 }}>
                  {fmtNum(p.sale_count)} · {fmtMoney(p.collected)}
                </span>
              </div>
              <HBar value={Number(p.collected)} max={maxProduct} color={bar} />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {detail.by_status.map((s) => (
            <div key={s.payment_status} style={{
              flex: 1, borderRadius: 9, border: `1px solid ${C.border}`,
              background: C.cardBg, padding: '9px 10px',
            }}>
              <StatusBadge status={s.payment_status} />
              <div style={{ fontFamily: MONO, fontSize: T.body, fontWeight: W.bold, color: C.t1, marginTop: 6 }}>
                {fmtNum(s.sale_count)}
              </div>
              {Number(s.outstanding) > 0 && (
                <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.warnText }}>
                  {fmtMoney(s.outstanding)} due
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={subHeading}>Recent sales</div>
        {!detail.recent.length ? (
          <p style={{ fontFamily: FONT, fontSize: T.body, color: C.t6, margin: 0 }}>
            No sales in this range.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {detail.recent.map((s) => (
                <tr key={s.id}>
                  <td style={{ ...tdStyle, fontFamily: MONO, fontSize: T.micro, color: C.t6, padding: '7px 0' }}>
                    {fmtDate(s.sale_date)}
                  </td>
                  <td style={{ ...tdStyle, padding: '7px 8px', maxWidth: 150, overflow: 'hidden',
                               textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.customer_name}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right', padding: '7px 8px' }}>
                    {fmtMoney(s.sale_price)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', padding: '7px 0' }}>
                    <StatusBadge status={s.payment_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* --------------------------- Magnitude breakdowns ------------------------- */

/**
 * One shared row for both breakdowns — same job (compare magnitude across
 * nominal categories), so the same form, and no chance of the two drifting.
 */
function BreakdownRow({ name, value, max, color, meta, format = fmtMoney }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                    gap: 10, marginBottom: 5 }}>
        <span style={{ fontFamily: FONT, fontSize: T.body, color: C.t2, minWidth: 0,
                       overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
        <span style={{ fontFamily: MONO, fontSize: T.body, fontWeight: W.bold,
                       color: C.t1, flexShrink: 0 }}>
          {format(value)}
        </span>
      </div>
      <HBar value={value} max={max} color={color} />
      {meta && (
        <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6, marginTop: 5 }}>{meta}</div>
      )}
    </div>
  );
}

function ProductCard({ rows }) {
  const { effective } = useTheme();
  const bar = magnitudeColor(effective);
  const max = Math.max(...rows.map((r) => Number(r.collected)), 1);

  return (
    <Card title="By product" tag={String(rows.length)}>
      {!rows.length ? (
        <EmptyState Icon={GraduationCap} title="Nothing to show" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rows.map((r, i) => (
            <BreakdownRow key={r.product_id ?? i}
              name={r.product_name} value={Number(r.collected)} max={max} color={bar}
              meta={<>
                {fmtNum(r.sale_count)} sales · {fmtMoney(r.expected)} expected
                {Number(r.outstanding) > 0 && (
                  <span style={{ color: C.warnText }}> · {fmtMoney(r.outstanding)} due</span>
                )}
              </>} />
          ))}
        </div>
      )}
    </Card>
  );
}

/**
 * Was a doughnut. Eight payment modes with several close values is precisely
 * what a doughnut cannot do — comparing arc lengths around a ring is far harder
 * than comparing bar lengths against a shared baseline, and eight slices blows
 * past the ~6-segment ceiling for part-to-whole at a glance. Same data, bars.
 */
function ModeCard({ rows }) {
  const { effective } = useTheme();
  const bar = magnitudeColor(effective);
  const total = rows.reduce((s, r) => s + Number(r.collected), 0);
  const max = Math.max(...rows.map((r) => Number(r.collected)), 1);

  return (
    <Card title="By payment mode" tag={fmtMoney(total)}>
      {!rows.length ? (
        <EmptyState Icon={Wallet} title="No payments yet" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rows.map((r) => (
            <BreakdownRow key={r.mode}
              name={r.mode} value={Number(r.collected)} max={max} color={bar}
              meta={`${fmtNum(r.payment_count)} payments · ${total > 0 ? Math.round((Number(r.collected) / total) * 100) : 0}% of collections`} />
          ))}
        </div>
      )}
    </Card>
  );
}

/* ------------------------- Student profile panels ------------------------- */

/**
 * "Not recorded" is rendered as a real bucket, deliberately.
 *
 * These fields are optional on the entry form, so coverage is part of the
 * answer: a channel breakdown that quietly drops unanswered sales reports a
 * clean split of whatever happened to be filled in, and every share below it is
 * inflated by exactly the amount you cannot see.
 */
function CoverageNote({ rows, noun }) {
  const total = rows.reduce((s, r) => s + Number(r.sale_count), 0);
  const missing = Number(rows.find((r) => r.isMissing)?.sale_count || 0);
  if (!total || !missing) return null;
  const pct = Math.round((missing / total) * 100);
  return (
    <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6, marginTop: 12,
                  paddingTop: 11, borderTop: `1px solid ${C.divider}` }}>
      {pct}% of sales have no {noun} recorded — shares below are of all sales, not
      only the answered ones.
    </div>
  );
}

const MISSING = 'Not recorded';

function SourceCard({ rows }) {
  const { effective } = useTheme();
  const bar = magnitudeColor(effective);
  const marked = rows.map((r) => ({ ...r, isMissing: r.source === MISSING }));
  const max = Math.max(...marked.map((r) => Number(r.collected)), 1);
  const totalSales = marked.reduce((s, r) => s + Number(r.sale_count), 0);

  return (
    <Card title="How they found us" tag={String(marked.length)}>
      {!marked.length ? (
        <EmptyState Icon={Megaphone} title="No sales in this range" />
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {marked.map((r) => (
              <BreakdownRow key={r.source}
                name={r.source} value={Number(r.collected)} max={max}
                // The unanswered bucket is drawn recessive: it is context for
                // the others, not a channel competing with them.
                color={r.isMissing ? C.t8 : bar}
                meta={`${fmtNum(r.sale_count)} sales · ${totalSales ? Math.round((r.sale_count / totalSales) * 100) : 0}% of all`} />
            ))}
          </div>
          <CoverageNote rows={marked} noun="source" />
        </>
      )}
    </Card>
  );
}

function ProfessionCard({ rows, genders }) {
  const { effective } = useTheme();
  const bar = magnitudeColor(effective);
  const marked = rows.map((r) => ({ ...r, isMissing: r.profession === MISSING }));
  const max = Math.max(...marked.map((r) => Number(r.sale_count)), 1);
  const known = genders.filter((g) => g.gender !== MISSING);
  const avgAge = known.find((g) => g.avg_age != null)?.avg_age;

  return (
    <Card title="Who they are" tag={String(marked.length)}>
      {!marked.length ? (
        <EmptyState Icon={Briefcase} title="No sales in this range" />
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {marked.map((r) => (
              <BreakdownRow key={r.profession}
                name={r.profession} value={Number(r.sale_count)} max={max}
                color={r.isMissing ? C.t8 : bar}
                format={fmtNum}
                meta={`${fmtMoney(r.collected)} collected`} />
            ))}
          </div>

          {known.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 14,
                          paddingTop: 12, borderTop: `1px solid ${C.divider}` }}>
              {known.map((g) => (
                <div key={g.gender} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: FONT, fontSize: T.micro, color: C.t5 }}>{g.gender}</span>
                  <span style={{ fontFamily: MONO, fontSize: T.meta, fontWeight: W.bold, color: C.t1 }}>
                    {fmtNum(g.sale_count)}
                  </span>
                </div>
              ))}
              {avgAge != null && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: FONT, fontSize: T.micro, color: C.t5 }}>Avg age</span>
                  <span style={{ fontFamily: MONO, fontSize: T.meta, fontWeight: W.bold, color: C.t1 }}>
                    {avgAge}
                  </span>
                </div>
              )}
            </div>
          )}
          <CoverageNote rows={marked} noun="profession" />
        </>
      )}
    </Card>
  );
}

/* --------------------- Outstanding-balance worklist ----------------------- */

/**
 * The API caps this at the 10 largest balances, but the card's tag reports the
 * FULL outstanding total — so without the note below, ten rows read as "this is
 * all of it" while claiming a number they do not add up to.
 */
function OutstandingCard({ rows, total, openCount = 0 }) {
  const capped = openCount > rows.length;
  return (
    <Card title="Chase these first" tag={fmtMoney(total)} pad={0}>
      {!rows.length ? (
        <EmptyState Icon={CircleCheckBig} title="Nothing outstanding"
          hint="Every sale in this range is fully paid." />
      ) : (
        <TableScroll>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>Product</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Price</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Collected</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Outstanding</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={tdStyle}>
                    <div style={{ fontSize: T.body, color: C.t1, fontWeight: W.medium, lineHeight: LH.tight }}>
                      {s.customer_name}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: T.micro, color: C.t6 }}>{s.customer_phone}</div>
                  </td>
                  <td style={{ ...tdStyle, color: C.t4 }}>{s.product_name}</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right' }}>{fmtMoney(s.sale_price)}</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right', color: C.successText }}>
                    {fmtMoney(s.collected)}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: 'right', fontWeight: W.bold, color: C.warnText }}>
                    {fmtMoney(s.outstanding)}
                  </td>
                  <td style={tdStyle}><StatusBadge status={s.payment_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
      {capped && (
        <div style={{
          padding: '11px 12px', borderTop: `1px solid ${C.divider}`,
          fontFamily: MONO, fontSize: T.micro, color: C.t6,
        }}>
          Showing the {rows.length} largest of {fmtNum(openCount)} open balances — open
          Outstanding for the full list.
        </div>
      )}
    </Card>
  );
}
