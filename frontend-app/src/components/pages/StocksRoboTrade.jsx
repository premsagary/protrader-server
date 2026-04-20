import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { apiGet, apiPost } from '../../api/client';
import { useAppStore } from '../../store/useAppStore';
import GatesActiveBanner from '../common/GatesActiveBanner';

// ══════════════════════════════════════════════════════════════════════
// Stocks RoboTrade — unified page for all stocks/* sub-tabs
// Ported from the monolithic public/app.html renderStocks* functions
// (commit 7e1e050). Each sub-tab is its own React component so that
// switching tabs doesn't re-fetch unrelated data.
//
// Sub-tabs:
//   stocks/overview    — stat grid + cumulative P&L + recent trades
//   stocks/positions   — open/closed paper + live positions with SL/TGT
//   stocks/trades      — full trade history (live + paper) with filters
//   stocks/candidates  — Pass 1.5 structure filter + Pass 2 ranked list
//   stocks/analytics   — multi-panel analytics (by strategy/regime/etc)
//   stocks/market      — live market table with search + group filter
//   stocks/chart       — instrument selector + per-symbol trades list
//   stocks/news        — RSS news + sentiment for selected stock
//   stocks/portfolio   — Zerodha holdings snapshot + cash/P&L
//   stocks/scanlog     — scan log with cleanup / reset actions
// ══════════════════════════════════════════════════════════════════════

const SUB_TABS = [
  { id: 'overview',   label: '◎ Overview' },
  { id: 'positions',  label: '○ Positions' },
  { id: 'trades',     label: '⇅ Trade History' },
  { id: 'candidates', label: '◉ Candidates' },
  { id: 'analytics',  label: '◐ Analytics' },
  { id: 'market',     label: '▦ Live Market' },
  { id: 'chart',      label: '↗ Chart' },
  { id: 'news',       label: '◈ News' },
  { id: 'portfolio',  label: '◻ Portfolio' },
  { id: 'scanlog',    label: '⌾ Scan Log' },
];

const INR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const pc = (n) => `${Number(n || 0) >= 0 ? '+' : ''}${Number(n || 0).toFixed(2)}%`;
const clr = (n) => (Number(n) >= 0 ? 'var(--green-text)' : 'var(--red-text)');
// 2026-04-20 — fixed timestamp display. Postgres TIMESTAMP columns come back
// from `pg` as bare strings like "2026-04-20 09:30:00" WITHOUT a timezone
// suffix. The browser's Date() then interprets them as LOCAL time, so a 9:30
// IST fill on a UTC-server database displayed as "15:00" in IST (server UTC
// treated as local, then "re-converted" to IST). Fix: if the string has no
// explicit tz, assume UTC (server writes are UTC via NOW()) and always
// display in Asia/Kolkata so the user sees IST regardless of browser locale.
const fmtT = (ts) => {
  if (!ts) return '—';
  try {
    let d;
    if (typeof ts === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(ts)) {
      // No tz suffix → treat as UTC (all server writes use NOW() which is UTC).
      d = new Date(ts.replace(' ', 'T') + 'Z');
    } else {
      d = new Date(ts);
    }
    return d.toLocaleString('en-IN', {
      hour: '2-digit', minute: '2-digit', month: 'short', day: '2-digit',
      timeZone: 'Asia/Kolkata',
    });
  } catch { return String(ts); }
};

// ══════════════════════════════════════════════════════════════════════
// Main dispatcher
// ══════════════════════════════════════════════════════════════════════
export default function StocksRoboTrade() {
  const currentTab = useAppStore((s) => s.currentTab);
  const setCurrentTab = useAppStore((s) => s.setCurrentTab);
  const sub = currentTab.startsWith('stocks/') ? currentTab.slice('stocks/'.length) : 'overview';

  return (
    <div className="animate-fadeIn">
      <PageHeader sub={sub} />
      <SubTabNav active={sub} onChange={(id) => setCurrentTab(`stocks/${id}`)} />
      <div style={{ marginTop: 18 }}>
        {sub === 'overview'   && <OverviewTab />}
        {sub === 'positions'  && <PositionsTab />}
        {sub === 'trades'     && <TradesTab />}
        {sub === 'candidates' && <CandidatesTab />}
        {sub === 'analytics'  && <AnalyticsTab />}
        {sub === 'market'     && <MarketTab />}
        {sub === 'chart'      && <ChartTab />}
        {sub === 'news'       && <NewsTab />}
        {sub === 'portfolio'  && <PortfolioTab />}
        {sub === 'scanlog'    && <ScanLogTab />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Header + sub-tab nav
// ══════════════════════════════════════════════════════════════════════
function PageHeader({ sub }) {
  return (
    <div
      className="card-premium"
      style={{
        background: 'linear-gradient(135deg, rgba(52,211,153,0.10) 0%, rgba(99,102,241,0.12) 100%)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        padding: '22px 28px',
        marginBottom: 20,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: -50, right: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(99,102,241,0.08)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="label-xs" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            Paper + Live Trading · NSE Stocks
            <span className="chip" style={{ height: 20, fontSize: 10, fontWeight: 700, background: 'var(--red-bg)', color: 'var(--red-text)' }}>ADMIN</span>
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1, color: 'var(--text)' }}>
            <span className="gradient-fill">Stocks RoboTrade</span>
          </h1>
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text2)' }}>
            Kite Connect · scans every 5 min during 09:15–15:30 IST · {SUB_TABS.find((t) => t.id === sub)?.label || sub}
          </div>
        </div>
      </div>
    </div>
  );
}

function SubTabNav({ active, onChange }) {
  return (
    <div
      className="hide-scrollbar"
      style={{
        display: 'flex',
        gap: 4,
        overflowX: 'auto',
        padding: 4,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border)',
        borderRadius: 12,
      }}
    >
      {SUB_TABS.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              padding: '7px 14px',
              background: isActive ? 'var(--brand-bg-strong)' : 'transparent',
              border: 'none',
              borderRadius: 8,
              color: isActive ? 'var(--brand-text)' : 'var(--text2)',
              fontSize: 12.5,
              fontWeight: isActive ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 180ms ease',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Reusable bits
// ══════════════════════════════════════════════════════════════════════
function StatCard({ l, v, c = 'var(--text)', sub }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>{l}</div>
      <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 800, color: c, letterSpacing: '-0.5px', lineHeight: 1.1 }}>{v}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Chip({ kind = 'neutral', children }) {
  const map = {
    g:       { bg: 'var(--green-bg)',  fg: 'var(--green-text)' },
    r:       { bg: 'var(--red-bg)',    fg: 'var(--red-text)' },
    a:       { bg: 'var(--amber-bg)',  fg: 'var(--amber-text)' },
    b:       { bg: 'var(--brand-bg)',  fg: 'var(--brand-text)' },
    neutral: { bg: 'var(--bg2)',       fg: 'var(--text2)' },
  };
  const c = map[kind] || map.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6,
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.3px',
      background: c.bg, color: c.fg, textTransform: 'uppercase',
    }}>{children}</span>
  );
}

function SectionHeader({ title, meta, live = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>{title}</h3>
        {live && <Chip kind="r">● LIVE</Chip>}
      </div>
      {meta && <div style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 500 }}>{meta}</div>}
    </div>
  );
}

function Loading({ text = 'Loading…' }) {
  return (
    <div className="card animate-pulse-custom" style={{ padding: 60, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
      {text}
    </div>
  );
}

function ErrorCard({ err }) {
  return (
    <div className="card" style={{ padding: 20, color: 'var(--red-text)', fontSize: 13, border: '1px solid rgba(248,113,113,0.25)' }}>
      Failed to load: {String(err?.message || err || 'unknown error')}
    </div>
  );
}

function EmptyCard({ text }) {
  return (
    <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
      {text}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Shared data hook — fetches multiple endpoints in parallel, returns state
// ══════════════════════════════════════════════════════════════════════
function useFetchAll(endpoints, deps = []) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reload = useCallback(() => {
    setLoading(true); setError(null);
    Promise.all(
      endpoints.map((e) => apiGet(e).then((d) => [e, d]).catch((err) => [e, { __err: err.message }]))
    ).then((pairs) => {
      const out = {};
      for (const [k, v] of pairs) out[k] = v;
      setData(out);
      setLoading(false);
    }).catch((err) => { setError(err); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}

// ══════════════════════════════════════════════════════════════════════
// OVERVIEW — stat grid, cumulative P&L, recent trades
// ══════════════════════════════════════════════════════════════════════
function OverviewTab() {
  const { data, loading, error, reload } = useFetchAll(
    ['/paper-trades/stats', '/paper-trades', '/paper-trades/open', '/live-trades', '/live-trades/stats', '/paper-trades/daily', '/prices'],
    []
  );
  const ns = data['/paper-trades/stats'] || {};
  const trades = Array.isArray(data['/paper-trades']) ? data['/paper-trades'] : [];
  const liveTrades = Array.isArray(data['/live-trades']) ? data['/live-trades'] : [];
  const prices = typeof data['/prices'] === 'object' && data['/prices'] ? data['/prices'] : {};
  const daily = Array.isArray(data['/paper-trades/daily']) ? data['/paper-trades/daily'] : [];

  // Build cumulative equity curve points — must be declared before any early return
  const points = useMemo(() => {
    let cum = 0;
    return [...daily].reverse().map((d) => {
      cum += Number(d?.pnl || 0);
      return { date: d?.date ? String(d.date).slice(5, 10) : '', equity: cum };
    });
  }, [daily]);

  if (loading) return <Loading text="Loading overview…" />;
  if (error) return <ErrorCard err={error} />;

  const open = trades.filter((t) => t?.status === 'OPEN');
  const pnl = +(ns.total_pnl || 0);
  const nw = +(ns.wins || 0);
  const nl = +(ns.losses || 0);
  const wr = nw + nl > 0 ? Math.round((nw / (nw + nl)) * 100) : 0;
  const openPnL = open.reduce((s, t) => {
    const c = prices?.[t.symbol]?.price ?? t.price;
    return s + (c - t.price) * t.quantity;
  }, 0);

  return (
    <div>
      {/* Gates pipeline banner — Varsity + Book-Rules consistency across tabs */}
      <div style={{ marginBottom: 16 }}>
        <GatesActiveBanner
          variant="full"
          accent="indigo"
          title="Stocks RoboTrade — Paper & Live feed from the same 5-layer pipeline"
          subtitle="Every P&L row below originated from a pick that cleared all 5 gates. No manual overrides."
        />
      </div>

      {/* Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 18 }}>
        <StatCard l="Total P&L (closed)" v={`${pnl >= 0 ? '+' : ''}${INR(pnl)}`} c={clr(pnl)} sub={`${trades.filter((t) => t?.status === 'CLOSED').length} closed trades`} />
        <StatCard l="Open P&L (live)"    v={`${openPnL >= 0 ? '+' : ''}${INR(openPnL)}`} c={clr(openPnL)} sub={`${open.length} positions`} />
        <StatCard l="Win rate"           v={`${wr}%`} c={wr >= 55 ? 'var(--green-text)' : wr >= 40 ? 'var(--amber-text)' : 'var(--red-text)'} sub={`${nw}W / ${nl}L`} />
        <StatCard l="Avg win"            v={`+${INR(ns.avg_win || 0)}`} c="var(--green-text)" />
        <StatCard l="Avg loss"           v={INR(ns.avg_loss || 0)} c="var(--red-text)" />
        <StatCard l="Best trade"         v={`+${INR(ns.best_trade || 0)}`} c="var(--green-text)" />
        <StatCard l="Sharpe ratio"       v={ns.sharpe_ratio != null ? Number(ns.sharpe_ratio).toFixed(2) : '—'} c={ns.sharpe_ratio > 1 ? 'var(--green-text)' : ns.sharpe_ratio > 0 ? 'var(--amber-text)' : 'var(--red-text)'} sub="Risk-adj return" />
        <StatCard l="Sortino ratio"      v={ns.sortino_ratio != null ? Number(ns.sortino_ratio).toFixed(2) : '—'} sub="Downside risk" />
        <StatCard l="Max drawdown"       v={ns.max_drawdown != null ? `${Number(ns.max_drawdown).toFixed(1)}%` : '—'} c={ns.max_drawdown < 5 ? 'var(--green-text)' : ns.max_drawdown < 15 ? 'var(--amber-text)' : 'var(--red-text)'} />
        <StatCard l="Profit factor"      v={ns.profit_factor != null ? Number(ns.profit_factor).toFixed(2) : '—'} sub="Gross win ÷ loss" />
        <StatCard l="Kelly %"            v={ns.kelly_pct != null ? `${ns.kelly_pct}%` : '—'} c="var(--brand-text)" sub="Optimal bet size" />
      </div>

      {/* Refresh */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={reload} className="btn btn-secondary" style={{ height: 30, fontSize: 12, padding: '0 12px' }}>↻ Refresh</button>
      </div>

      {/* Equity curve (inline SVG) */}
      {points.length > 1 && <EquitySVG points={points} />}

      {/* Live trades */}
      {liveTrades.length > 0 && (
        <>
          <SectionHeader title="Real Trades (Live)" live meta={`${liveTrades.length} total`} />
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {liveTrades.slice(0, 5).map((t, i) => <TradeRow key={i} t={t} prices={prices} />)}
          </div>
        </>
      )}

      {/* Paper trades */}
      <SectionHeader title="Paper Trades (Simulated)" meta={`${trades.length} total`} />
      {trades.length === 0 ? (
        <EmptyCard text="No trades yet — bot scans every 5 min during 09:15–15:30 IST" />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {trades.slice(0, 8).map((t, i) => <TradeRow key={i} t={t} prices={prices} />)}
        </div>
      )}
    </div>
  );
}

function EquitySVG({ points }) {
  const W = 720, H = 160, mL = 40, mR = 10, mT = 10, mB = 20;
  const cW = W - mL - mR, cH = H - mT - mB;
  const eqs = points.map((p) => p.equity);
  const minEq = Math.min(0, ...eqs);
  const maxEq = Math.max(0, ...eqs);
  const range = (maxEq - minEq) || 1;
  const toX = (i) => mL + (i / Math.max(1, points.length - 1)) * cW;
  const toY = (v) => mT + cH - ((v - minEq) / range) * cH;
  const eqPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.equity).toFixed(1)}`).join(' ');
  const zeroY = toY(0);
  const last = eqs[eqs.length - 1] || 0;
  const stroke = last >= 0 ? '#22c55e' : '#ef4444';

  return (
    <div className="card" style={{ padding: 14, marginBottom: 18 }}>
      <div className="label-xs" style={{ marginBottom: 8 }}>Cumulative P&amp;L · last {points.length} days</div>
      <div style={{ overflowX: 'auto' }}>
        <svg width={W} height={H} style={{ maxWidth: '100%' }}>
          <line x1={mL} y1={zeroY} x2={W - mR} y2={zeroY} stroke="rgba(255,255,255,0.1)" strokeDasharray="3,3" />
          <path d={eqPath} fill="none" stroke={stroke} strokeWidth="1.8" />
          <text x={mL - 4} y={toY(maxEq) + 4} textAnchor="end" fontSize="10" fill="#6e7681">{INR(maxEq)}</text>
          <text x={mL - 4} y={toY(minEq) + 4} textAnchor="end" fontSize="10" fill="#6e7681">{INR(minEq)}</text>
          <text x={mL - 4} y={zeroY + 4}     textAnchor="end" fontSize="10" fill="#6e7681">0</text>
        </svg>
      </div>
    </div>
  );
}

function TradeRow({ t, prices }) {
  const cur = prices?.[t.symbol]?.price ?? t.price;
  const livePnl = (cur - t.price) * t.quantity;
  const isOpen = t?.status === 'OPEN';
  const p = isOpen ? livePnl : Number(t.pnl || 0);
  const pct = isOpen ? ((cur - t.price) / t.price) * 100 : Number(t.pnl_pct || 0);

  return (
    <div
      style={{
        display: 'flex', gap: 12, alignItems: 'center', padding: '12px 18px',
        borderBottom: '1px solid var(--border)', transition: 'background 150ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.05)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ flexShrink: 0 }}>
        {isOpen ? <Chip kind="a">OPEN</Chip> : p >= 0 ? <Chip kind="g">WIN</Chip> : <Chip kind="r">LOSS</Chip>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
          {t.symbol} <span style={{ fontWeight: 500, color: 'var(--text3)', fontSize: 11.5 }}>× {t.quantity}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
          {t.strategy || '—'} · {fmtT(t.entry_time)}
          {t.exit_reason ? ` · ${t.exit_reason}` : ''}
          {t.order_id ? ` · #${t.order_id}` : ''}
        </div>
      </div>
      <div className="tabular-nums" style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: clr(p) }}>
          {p >= 0 ? '+' : ''}{INR(p)}
        </div>
        <div style={{ fontSize: 11, color: clr(pct), fontWeight: 600 }}>
          {isOpen ? 'live · ' : ''}{pc(pct)}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// POSITIONS — open cards + closed table (live + paper)
// ══════════════════════════════════════════════════════════════════════
function PositionsTab() {
  const { data, loading, error, reload } = useFetchAll(['/paper-trades', '/live-trades', '/prices'], []);
  if (loading) return <Loading text="Loading positions…" />;
  if (error) return <ErrorCard err={error} />;

  const paper = Array.isArray(data['/paper-trades']) ? data['/paper-trades'] : [];
  const live = Array.isArray(data['/live-trades']) ? data['/live-trades'] : [];
  const prices = data['/prices'] || {};
  const paperOpen = paper.filter((t) => t?.status === 'OPEN');
  const paperClosed = paper.filter((t) => t?.status === 'CLOSED');
  const liveOpen = live.filter((t) => t?.status === 'OPEN');
  const liveClosed = live.filter((t) => t?.status === 'CLOSED');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={reload} className="btn btn-secondary" style={{ height: 30, fontSize: 12, padding: '0 12px' }}>↻ Refresh</button>
      </div>

      {(liveOpen.length + liveClosed.length) > 0 && (
        <>
          <SectionHeader title="Live Positions" live meta={`${liveOpen.length} open · ${liveClosed.length} closed`} />
          {liveOpen.length === 0 ? <EmptyCard text="No live open positions" /> : (
            <div style={{ display: 'grid', gap: 10 }}>
              {liveOpen.map((p, i) => <PositionCard key={i} pos={p} prices={prices} />)}
            </div>
          )}
          {liveClosed.length > 0 && (
            <>
              <div className="label-xs" style={{ marginTop: 14, marginBottom: 6 }}>Live Closed ({liveClosed.length})</div>
              <ClosedTable rows={liveClosed} />
            </>
          )}
        </>
      )}

      <SectionHeader title="Paper Positions" meta={`${paperOpen.length} open · ${paperClosed.length} closed`} />
      {paperOpen.length === 0 ? <EmptyCard text="No paper open positions" /> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {paperOpen.map((p, i) => <PositionCard key={i} pos={p} prices={prices} />)}
        </div>
      )}
      {paperClosed.length > 0 && (
        <>
          <div className="label-xs" style={{ marginTop: 14, marginBottom: 6 }}>Paper Closed ({paperClosed.length})</div>
          <ClosedTable rows={paperClosed} />
        </>
      )}
    </div>
  );
}

function PositionCard({ pos, prices }) {
  const cmp = prices?.[pos.symbol]?.price ?? pos.price;
  const pnl = +((cmp - pos.price) * pos.quantity).toFixed(2);
  const pct = +(((cmp - pos.price) / pos.price) * 100).toFixed(2);
  const denom = pos.target - pos.stop_loss;
  const prog = denom > 0 ? Math.max(0, Math.min(100, ((cmp - pos.stop_loss) / denom) * 100)) : 0;

  return (
    <div className="card" style={{ padding: 16, borderLeft: `3px solid ${pnl >= 0 ? 'var(--green-text)' : 'var(--red-text)'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Chip kind="g">▲ BUY</Chip>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
            {pos.symbol} <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>× {pos.quantity}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            {pos.name || '—'} · {pos.strategy || '—'}{pos.regime ? ` · ${pos.regime}` : ''} · {fmtT(pos.entry_time)}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }} className="tabular-nums">
          <div style={{ fontWeight: 800, fontSize: 20, color: clr(pnl) }}>{pnl >= 0 ? '+' : ''}{INR(pnl)}</div>
          <div style={{ fontSize: 12, color: clr(pct), fontWeight: 600 }}>{pc(pct)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8, marginTop: 12 }}>
        {[
          ['Entry', INR(pos.price)],
          ['Live CMP', INR(cmp)],
          ['Stop Loss', INR(pos.stop_loss)],
          ['Target', INR(pos.target)],
          ['Capital', INR(pos.capital)],
          ['Score', pos.signal_score ?? '—'],
        ].map(([l, v]) => (
          <div key={l} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.4px', textTransform: 'uppercase', fontWeight: 600 }}>{l}</div>
            <div className="tabular-nums" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Progress bar SL → CMP → TGT */}
      <div style={{ marginTop: 12, height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${prog}%`, height: '100%', background: pnl >= 0 ? 'var(--green-text)' : 'var(--red-text)', borderRadius: 3, transition: 'width 300ms ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
        <span>SL {INR(pos.stop_loss)}</span>
        <span>progress to target</span>
        <span>TGT {INR(pos.target)}</span>
      </div>

      {pos.indicators && (
        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text3)', background: 'var(--bg2)', borderRadius: 6, padding: '6px 10px', wordBreak: 'break-word' }}>
          {pos.indicators}
        </div>
      )}
      {pos.order_id && (
        <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text3)' }}>Order ID: {pos.order_id}</div>
      )}
    </div>
  );
}

function ClosedTable({ rows }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              {['Stock', 'Qty', 'Entry', 'Exit', 'P&L', 'Return', 'Reason', 'Result'].map((h, i) => (
                <th key={h} style={{ ...thStyle, textAlign: i === 0 ? 'left' : i < 6 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)' }}>{t.symbol}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{t.quantity}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{INR(t.price)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{t.exit_price ? INR(t.exit_price) : '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: clr(t.pnl) }} className="tabular-nums">
                  {Number(t.pnl || 0) >= 0 ? '+' : ''}{INR(t.pnl)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', color: clr(t.pnl_pct) }} className="tabular-nums">{pc(t.pnl_pct)}</td>
                <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text3)' }}>{t.exit_reason || '—'}</td>
                <td style={tdStyle}>{Number(t.pnl || 0) >= 0 ? <Chip kind="g">Win</Chip> : <Chip kind="r">Loss</Chip>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TRADES — full trade history with stats footer (paper + live)
// ══════════════════════════════════════════════════════════════════════
function TradesTab() {
  const { data, loading, error, reload } = useFetchAll(['/paper-trades', '/live-trades', '/paper-trades/stats', '/live-trades/stats'], []);
  const [filter, setFilter] = useState('all'); // all | open | closed | wins | losses

  if (loading) return <Loading text="Loading trades…" />;
  if (error) return <ErrorCard err={error} />;

  const paper = Array.isArray(data['/paper-trades']) ? data['/paper-trades'] : [];
  const live = Array.isArray(data['/live-trades']) ? data['/live-trades'] : [];
  const ns = data['/paper-trades/stats'] || {};
  const ls = data['/live-trades/stats'] || {};

  const applyFilter = (rows) => rows.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'open') return t?.status === 'OPEN';
    if (filter === 'closed') return t?.status === 'CLOSED';
    if (filter === 'wins') return Number(t?.pnl || 0) > 0 && t?.status === 'CLOSED';
    if (filter === 'losses') return Number(t?.pnl || 0) < 0 && t?.status === 'CLOSED';
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['all', 'All'], ['open', 'Open'], ['closed', 'Closed'], ['wins', 'Wins'], ['losses', 'Losses']].map(([k, l]) => {
            const active = filter === k;
            return (
              <button key={k} onClick={() => setFilter(k)} style={{
                padding: '6px 12px', borderRadius: 9999, fontSize: 11.5, fontWeight: active ? 700 : 600,
                background: active ? 'var(--brand)' : 'rgba(255,255,255,0.04)',
                color: active ? '#fff' : 'var(--text2)',
                border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{l}</button>
            );
          })}
        </div>
        <button onClick={reload} className="btn btn-secondary" style={{ height: 30, fontSize: 12, padding: '0 12px', marginLeft: 'auto' }}>↻ Refresh</button>
      </div>

      {live.length > 0 && (
        <>
          <SectionHeader title="Live Trades" live meta={`${live.length} trades · ${live.filter((t) => t.status === 'CLOSED').length} closed`} />
          <TradesTable rows={applyFilter(live)} emptyMsg="No live trades yet" />
          <StatsFooter stats={ls} />
        </>
      )}

      <SectionHeader title="Paper Trades" meta={`${paper.length} trades · ${paper.filter((t) => t.status === 'CLOSED').length} closed`} />
      <TradesTable rows={applyFilter(paper)} emptyMsg="No paper trades yet — bot trades 09:15–15:30 IST" />
      <StatsFooter stats={ns} />
    </div>
  );
}

function TradesTable({ rows, emptyMsg }) {
  const cols = [
    { h: 'Stock', align: 'left' },
    { h: 'Qty', align: 'right' },
    { h: 'Entry', align: 'right' },
    { h: 'Exit', align: 'right' },
    { h: 'Entry time', align: 'left' },
    { h: 'Exit time', align: 'left' },
    { h: 'P&L', align: 'right' },
    { h: 'Return', align: 'right' },
    { h: 'Strategy', align: 'left' },
    { h: 'Regime', align: 'left' },
    { h: 'Exit reason', align: 'left' },
    { h: 'Result', align: 'left' },
  ];
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              {cols.map((c) => <th key={c.h} style={{ ...thStyle, textAlign: c.align }}>{c.h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={cols.length} style={{ textAlign: 'center', padding: 28, color: 'var(--text3)' }}>{emptyMsg}</td></tr>
            ) : rows.slice(0, 200).map((t, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)' }}>{t.symbol}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{t.quantity}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{INR(t.price)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{t.exit_price ? INR(t.exit_price) : '—'}</td>
                <td style={{ ...tdStyle, color: 'var(--text3)', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtT(t.entry_time)}</td>
                <td style={{ ...tdStyle, color: 'var(--text3)', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtT(t.exit_time)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: t.status === 'OPEN' ? 'var(--text3)' : clr(t.pnl) }} className="tabular-nums">
                  {t.status === 'OPEN' ? '—' : `${Number(t.pnl || 0) >= 0 ? '+' : ''}${INR(t.pnl)}`}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', color: t.status === 'OPEN' ? 'var(--text3)' : clr(t.pnl_pct) }} className="tabular-nums">
                  {t.status === 'OPEN' ? '—' : pc(t.pnl_pct)}
                </td>
                <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text2)' }}>{t.strategy || '—'}</td>
                <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text2)' }}>{t.regime || '—'}</td>
                <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text3)' }}>{t.exit_reason || '—'}</td>
                <td style={tdStyle}>
                  {t.status === 'OPEN' ? <Chip kind="a">Open</Chip> : Number(t.pnl || 0) >= 0 ? <Chip kind="g">Win</Chip> : <Chip kind="r">Loss</Chip>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatsFooter({ stats }) {
  if (!stats) return null;
  const pnl = Number(stats.total_pnl || 0);
  const nw = Number(stats.wins || 0);
  const nl = Number(stats.losses || 0);
  const wr = nw + nl > 0 ? Math.round((nw / (nw + nl)) * 100) : 0;
  const closed = nw + nl;
  if (!closed) return null;
  return (
    <div style={{ padding: '8px 4px', fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 6 }} className="tabular-nums">
      <span>Closed: <b style={{ color: 'var(--text)' }}>{closed}</b></span>
      <span>Net P&amp;L: <b style={{ color: clr(pnl) }}>{pnl >= 0 ? '+' : ''}{INR(pnl)}</b></span>
      <span>Win rate: <b style={{ color: 'var(--text)' }}>{wr}%</b></span>
      <span>Best: <b style={{ color: 'var(--green-text)' }}>+{INR(stats.best_trade || 0)}</b></span>
      <span>Worst: <b style={{ color: 'var(--red-text)' }}>{INR(stats.worst_trade || 0)}</b></span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// CANDIDATES — Pass 1.5 structure filter + Pass 2 ranked list
// ══════════════════════════════════════════════════════════════════════
function CandidatesTab() {
  const [candData, setCandData] = useState(null);
  const [pass2, setPass2] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scanMsg, setScanMsg] = useState('');

  const reload = useCallback(() => {
    setLoading(true); setError(null);
    Promise.all([
      apiGet('/api/candidates/latest').catch((e) => ({ __err: e.message })),
      apiGet('/api/scan/pass2-debug').catch(() => null),
    ]).then(([c, p]) => {
      if (c?.__err) setError(c.__err); else setCandData(c);
      setPass2(p);
      setLoading(false);
    });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const scanNow = async () => {
    setScanMsg('▶ Scan started… refreshing in 4s');
    try {
      await apiPost('/scan-now', {});
      setTimeout(() => { reload(); setScanMsg(''); }, 4000);
    } catch (e) {
      setScanMsg(`❌ Scan failed: ${e.message}`);
    }
  };

  if (loading) return <Loading text="Loading candidates…" />;
  if (error) return <ErrorCard err={error} />;

  const cands = Array.isArray(candData?.candidates) ? candData.candidates : [];
  const stats = candData?.stats || null;
  const cfg = candData?.config || {};

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <p style={{ fontSize: 12.5, color: 'var(--text2)', flex: 1, margin: 0, lineHeight: 1.5, minWidth: 260 }}>
          Live view of the last scan's BUY candidates after the Structure Filter (pivot zones, VWAP, PDH/PDL) and optional LLM review. Updates every scan (~5 min during market hours).
        </p>
        <button onClick={reload} className="btn btn-secondary" style={{ height: 32, fontSize: 12, padding: '0 12px' }}>↻ Refresh</button>
        <button onClick={scanNow} className="btn btn-primary" style={{ height: 32, fontSize: 12, padding: '0 12px' }}>▶ Scan now</button>
      </div>
      {scanMsg && (
        <div style={{ fontSize: 12, color: scanMsg.startsWith('❌') ? 'var(--red-text)' : 'var(--green-text)', marginBottom: 10 }}>{scanMsg}</div>
      )}

      {/* Stats */}
      {stats && stats.total ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
          <StatCard l="Scanned" v={stats.total} sub="BUY candidates · last pass" />
          <StatCard l="Approved" v={stats.approved} c="var(--green-text)" sub="Passed filter" />
          <StatCard l="Rej · Structure" v={stats.rejectedByStructure} c={stats.rejectedByStructure > 0 ? 'var(--amber-text)' : 'var(--text2)'} />
          <StatCard l="Rej · LLM" v={stats.rejectedByLLM} c={stats.rejectedByLLM > 0 ? 'var(--amber-text)' : 'var(--text2)'} sub={cfg.llmFilterEnabled ? 'LLM enabled' : 'LLM disabled'} />
          <StatCard l="LLM Calls" v={stats.llmCalls || 0} c="var(--brand-text)" sub={`A:${stats.llmApprove || 0} C:${stats.llmCaution || 0} R:${stats.llmReject || 0}`} />
          <StatCard l="Top Reject Reasons" v={Object.entries(stats.rejectReasons || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}×${v}`).join(', ') || '—'} c="var(--text2)" />
        </div>
      ) : (
        <EmptyCard text="No scan data yet. Run a scan, or wait for the next auto-scan during market hours." />
      )}

      {/* Pass 2 ranked table */}
      {pass2 && (pass2.topEntered?.length || pass2.topSkipped?.length) ? (
        <>
          <SectionHeader
            title="Pass 2 · Ranked candidates"
            meta={`entered ${pass2.entered || 0} · skipSlots ${pass2.skippedSlots || 0} · skipCorr ${pass2.skippedCorr || 0} · skipDup ${pass2.skippedDup || 0} · structRej ${pass2.rejectedStructure || 0} · llmRej ${pass2.rejectedLLM || 0}`}
          />
          <Pass2Table entered={pass2.topEntered || []} skipped={pass2.topSkipped || []} />
        </>
      ) : null}

      {/* Candidates table */}
      <SectionHeader title="Candidates · structure + LLM decisions" meta={`${cands.length} candidates`} />
      {cands.length === 0 ? (
        <EmptyCard text="No BUY candidates in the last scan." />
      ) : (
        <CandidatesTable cands={cands} />
      )}

      {/* Config footer */}
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text3)', fontFamily: '"SF Mono","JetBrains Mono",monospace' }}>
        Last scan: {candData?.scannedAt ? new Date(candData.scannedAt).toLocaleString() : 'never'} · Structure filter: {cfg.structureFilterEnabled ? 'ON' : 'OFF'} · LLM filter: {cfg.llmFilterEnabled ? 'ON' : 'OFF'} · Reject if R within {cfg.rejectIfResistanceWithinPct || '?'}% · LLM top {cfg.llmTopCandidatesPerScan || '?'} · LLM min score {cfg.llmMinScoreThreshold || '?'}
      </div>
    </div>
  );
}

function CandidatesTable({ cands }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              {['Symbol', 'Strategy', 'Regime', 'Orig', 'Adj', 'Δ', 'Nearest R', 'Nearest S', 'VWAP', 'Flags', 'LLM', 'Final', 'Reject'].map((h, i) => (
                <th key={h} style={{ ...thStyle, textAlign: [3, 4, 5].includes(i) ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cands.map((c, idx) => {
              const s = c.structure || {};
              const flags = s.flags || {};
              const R = s.nearestResistance;
              const Sp = s.nearestSupport;
              const vwap = s.vwap;
              const llm = c.llmDecision;
              const orig = (+c.originalScore || 0).toFixed(2);
              const adj = (+c.adjustedScore || 0).toFixed(2);
              const delta = (+c.adjustedScore || 0) - (+c.originalScore || 0);
              const deltaCol = delta > 0 ? 'var(--green-text)' : delta < 0 ? 'var(--red-text)' : 'var(--text3)';
              const finalKind = c.finalDecision === 'APPROVED' ? 'g' : c.finalDecision === 'REJECTED' ? 'r' : 'a';
              const flagBits = [];
              if (flags.nearResistance)          flagBits.push(<span key="nR" style={{ color: 'var(--red-text)' }}>nearR</span>);
              if (flags.breakoutAboveResistance) flagBits.push(<span key="bR" style={{ color: 'var(--green-text)' }}>breakout</span>);
              if (flags.breakoutIntoResistance)  flagBits.push(<span key="iR" style={{ color: 'var(--red-text)' }}>intoR</span>);
              if (flags.trappedBetweenZones)     flagBits.push(<span key="tz" style={{ color: 'var(--amber-text)' }}>trapped</span>);
              if (flags.stackedResistance)       flagBits.push(<span key="sR" style={{ color: 'var(--amber-text)' }}>stackedR</span>);
              if (flags.nearSupport)             flagBits.push(<span key="nS" style={{ color: 'var(--green-text)' }}>nearS</span>);
              if (flags.abovePDH)                flagBits.push(<span key="pdh" style={{ color: 'var(--green-text)' }}>&gt;PDH</span>);
              if (flags.nearPDH)                 flagBits.push(<span key="npdh" style={{ color: 'var(--text2)' }}>~PDH</span>);
              if (flags.nearPDL)                 flagBits.push(<span key="npdl" style={{ color: 'var(--text2)' }}>~PDL</span>);

              return (
                <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)' }}>
                    {c.symbol}
                    {c.name && <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400 }}>{c.name}</div>}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text2)' }}>{c.strategy || '—'}</td>
                  <td style={tdStyle}>{c.regime ? <Chip kind="b">{c.regime}</Chip> : '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{orig}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }} className="tabular-nums">{adj}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: deltaCol }} className="tabular-nums">{delta >= 0 ? '+' : ''}{delta.toFixed(2)}</td>
                  <td style={tdStyle}>
                    {R ? (
                      <>
                        <div style={{ fontSize: 11 }}>{INR(R.zoneLow)}–{INR(R.zoneHigh)}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>{R.strengthLabel} · {R.touches}t · {R.distancePct}%</div>
                      </>
                    ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                  <td style={tdStyle}>
                    {Sp ? (
                      <>
                        <div style={{ fontSize: 11 }}>{INR(Sp.zoneLow)}–{INR(Sp.zoneHigh)}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>{Sp.strengthLabel} · {Sp.touches}t · {Sp.distancePct}%</div>
                      </>
                    ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                  <td style={tdStyle}>
                    {vwap ? (
                      <>
                        <div style={{ color: flags.priceAboveVWAP ? 'var(--green-text)' : 'var(--red-text)', fontWeight: 600, fontSize: 11 }}>
                          {flags.priceAboveVWAP ? '▲' : '▼'} {INR(vwap.current)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>{(flags.distanceFromVWAPPct >= 0 ? '+' : '')}{flags.distanceFromVWAPPct}% · {vwap.bias}</div>
                      </>
                    ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 10 }}>
                    {flagBits.length === 0 ? <span style={{ color: 'var(--text3)' }}>—</span> :
                      flagBits.map((b, i) => <React.Fragment key={i}>{i > 0 && ' · '}{b}</React.Fragment>)}
                  </td>
                  <td style={tdStyle}>
                    {llm ? (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>{llm.decision || '—'}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>conf {llm.confidence ?? '—'}</div>
                        {llm.reason && (
                          <div style={{ fontSize: 10, color: 'var(--text3)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={llm.reason}>
                            {llm.reason}
                          </div>
                        )}
                      </>
                    ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                  <td style={tdStyle}><Chip kind={finalKind}>{c.finalDecision || '—'}</Chip></td>
                  <td style={{ ...tdStyle, fontSize: 10, color: c.rejectReason ? 'var(--red-text)' : 'var(--text3)' }}>
                    {c.rejectReason || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pass2Table({ entered, skipped }) {
  const all = [...entered, ...skipped];
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              {[['#', 'right'], ['Symbol', 'left'], ['Strategy', 'left'], ['Regime', 'left'], ['Score', 'right'], ['Adj', 'right'], ['Conf', 'right'], ['Status', 'left'], ['Reason', 'left']].map(([h, a]) => (
                <th key={h} style={{ ...thStyle, textAlign: a }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {all.map((c, idx) => {
              const statKind = c.status === 'ENTERED' ? 'g' : c.status === 'SKIPPED' ? 'a' : c.status === 'REJECTED' ? 'r' : 'neutral';
              return (
                <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text3)' }} className="tabular-nums">{c.rank}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)' }}>{c.symbol}</td>
                  <td style={{ ...tdStyle, color: 'var(--text2)' }}>{c.strategy || '—'}</td>
                  <td style={tdStyle}>{c.regime ? <Chip kind="b">{c.regime}</Chip> : '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{c.score != null ? Number(c.score).toFixed(2) : '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }} className="tabular-nums">{c.adjScore != null ? Number(c.adjScore).toFixed(2) : '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{c.confidence != null ? Number(c.confidence).toFixed(2) : '—'}</td>
                  <td style={tdStyle}><Chip kind={statKind}>{c.status || '—'}</Chip></td>
                  <td style={{ ...tdStyle, fontSize: 10, color: 'var(--text3)' }}>{c.skipReason || c.rejectReason || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ANALYTICS — multi-panel with day-window selector
// ══════════════════════════════════════════════════════════════════════
function AnalyticsTab() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState(null);
  const [rejects, setRejects] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(() => {
    setLoading(true); setError(null);
    apiGet(`/api/analytics?days=${days}`)
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e); setLoading(false); });
    apiGet(`/api/insights?days=${days}`).then(setInsights).catch(() => setInsights({ __err: true }));
    apiGet(`/api/rejected-trades?days=${Math.min(days, 30)}`).then(setRejects).catch(() => setRejects({ __err: true }));
  }, [days]);

  useEffect(() => { reload(); }, [reload]);

  if (loading) return <Loading text={`Loading analytics (${days}d)…`} />;
  if (error) return <ErrorCard err={error} />;

  const a = data || {};
  const q = a.quality || {};

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 12.5, color: 'var(--text2)', flex: 1, margin: 0, lineHeight: 1.5, minWidth: 260 }}>
          Trade analytics from closed paper trades · strategy / regime / exit / time-of-day breakdowns, quality metrics, and Structure Filter insights.
        </p>
        <div style={{ display: 'flex', gap: 4 }}>
          {[7, 30, 90, 365].map((d) => {
            const active = days === d;
            return (
              <button key={d} onClick={() => setDays(d)} style={{
                padding: '6px 12px', borderRadius: 9999, fontSize: 11.5, fontWeight: active ? 700 : 600,
                background: active ? 'var(--brand)' : 'rgba(255,255,255,0.04)',
                color: active ? '#fff' : 'var(--text2)',
                border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{d === 365 ? '1y' : `${d}d`}</button>
            );
          })}
        </div>
        <button onClick={reload} className="btn btn-secondary" style={{ height: 32, fontSize: 12, padding: '0 12px' }}>↻ Refresh</button>
      </div>

      {a.totalClosed ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
          <StatCard l="Closed trades" v={a.totalClosed} sub={`${days}d window`} />
          <StatCard l="Win rate" v={`${(q.winRate || 0).toFixed(1)}%`} c={q.winRate >= 55 ? 'var(--green-text)' : q.winRate >= 45 ? 'var(--amber-text)' : 'var(--red-text)'} sub={`${q.wins || 0}W / ${q.losses || 0}L`} />
          <StatCard l="Profit factor" v={(q.profitFactor || 0).toFixed(2)} c={q.profitFactor >= 1.5 ? 'var(--green-text)' : q.profitFactor >= 1 ? 'var(--amber-text)' : 'var(--red-text)'} sub="gross win / loss" />
          <StatCard l="Expectancy" v={INR(q.expectancy || 0)} c={q.expectancy > 0 ? 'var(--green-text)' : 'var(--red-text)'} sub="per trade" />
          <StatCard l="Sharpe" v={(q.sharpe || 0).toFixed(2)} c={q.sharpe >= 1 ? 'var(--green-text)' : q.sharpe >= 0 ? 'var(--amber-text)' : 'var(--red-text)'} />
          <StatCard l="Sortino" v={(q.sortino || 0).toFixed(2)} sub="downside-adj" />
          <StatCard l="Max drawdown" v={`−${INR(q.maxDrawdown || 0)}`} c="var(--red-text)" />
          <StatCard l="Avg hold" v={`${q.avgHoldMin != null ? Math.round(q.avgHoldMin) : '—'}m`} />
          <StatCard l="Net P&L" v={`${(q.netPnL || 0) >= 0 ? '+' : ''}${INR(q.netPnL || 0)}`} c={clr(q.netPnL)} />
        </div>
      ) : <EmptyCard text={`No closed trades in the last ${days} days.`} />}

      {/* Realistic P&L */}
      {a.realistic && <RealisticPanel r={a.realistic} />}

      {/* Group tables */}
      <GroupTable title="By Strategy" rows={Array.isArray(a.byStrategy) ? a.byStrategy : []} />
      <GroupTable title="By Regime"   rows={Array.isArray(a.byRegime) ? a.byRegime : []} />
      <GroupTable title="By Exit Reason" rows={Array.isArray(a.byExit) ? a.byExit : []} />
      <GroupTable title="By Time of Day" rows={Array.isArray(a.byTimeBucket) ? a.byTimeBucket : []} />

      {Array.isArray(a.confidenceBuckets) && a.confidenceBuckets.length > 0 &&
        <GroupTable title="Confidence calibration · is higher confidence actually better?" rows={a.confidenceBuckets} />}

      {/* Flag A/B */}
      {a.flagCompare && Object.keys(a.flagCompare).length > 0 && (
        <GroupTable title="A/B Filter Comparison · ON vs OFF"
          rows={Object.entries(a.flagCompare).flatMap(([flag, group]) => ([
            { ...(group?.on || {}), key: `${flag} · ON` },
            { ...(group?.off || {}), key: `${flag} · OFF` },
          ]))}
        />
      )}

      {Array.isArray(a.byExperiment) && a.byExperiment.length > 0 &&
        <GroupTable title="By Experiment Group" rows={a.byExperiment} />}

      {/* Duration distribution */}
      {Array.isArray(a.durationDistribution) && a.durationDistribution.some((d) => d.count > 0) && (
        <DurationDist rows={a.durationDistribution} />
      )}

      {/* Equity curve */}
      {Array.isArray(a.dailyEquity) && a.dailyEquity.length > 0 && <AnalyticsEquity points={a.dailyEquity} />}

      {/* Auto insights */}
      <SectionHeader title="Auto insights · deterministic pattern detection" />
      <div className="card" style={{ padding: 14, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6 }}>
        {insights == null ? <span style={{ color: 'var(--text3)' }}>Loading insights…</span> :
          insights.__err ? <span style={{ color: 'var(--red-text)' }}>insights load failed</span> :
          (Array.isArray(insights?.insights) && insights.insights.length > 0) ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {insights.insights.map((s, i) => <li key={i} style={{ margin: '4px 0' }}>{s}</li>)}
            </ul>
          ) : <span style={{ color: 'var(--text3)' }}>No insights yet.</span>}
      </div>

      {/* Walk-forward */}
      {Array.isArray(a.walkForward) && a.walkForward.length > 0 &&
        <GroupTable title="Walk-forward · 7d / 30d / 90d · avoid overfitting" rows={a.walkForward} walkForward />}

      {/* Cost impact by strategy */}
      {Array.isArray(a.costByStrategy) && a.costByStrategy.length > 0 && <CostByStrategy rows={a.costByStrategy} />}

      {/* Stability */}
      {Array.isArray(a.stabilityByStrategy) && a.stabilityByStrategy.length > 0 && <StabilityTable rows={a.stabilityByStrategy} />}

      {/* Cohorts */}
      {Array.isArray(a.cohorts) && a.cohorts.length > 0 &&
        <GroupTable title="Candidate cohorts · performance by structure flags" rows={a.cohorts} />}

      {/* Thresholds */}
      {Array.isArray(a.thresholds) && a.thresholds.length > 0 && (
        <>
          <SectionHeader title="Threshold optimization · performance by actual value" />
          {a.thresholds.map((th, i) => (
            Array.isArray(th.buckets) && th.buckets.length > 0 ? (
              <GroupTable
                key={i}
                title={`Threshold · ${th.name}${th.currentValue != null ? ` (current: ${th.currentValue})` : ''}`}
                rows={th.buckets.map((b) => ({ ...b, key: b.range }))}
              />
            ) : null
          ))}
        </>
      )}

      {/* Sizing sim */}
      {a.sizingSim && <SizingSim sim={a.sizingSim} />}

      {/* Portfolio stats */}
      {a.portfolioStats && (
        <>
          <SectionHeader title={`Ranking engine averages (${a.portfolioStats.samples} trades with ranking data)`} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <StatCard l="Avg ranking score"    v={Number(a.portfolioStats.avgRankingScore).toFixed(3)} />
            <StatCard l="Avg structure quality" v={Number(a.portfolioStats.avgStructureQ).toFixed(3)} />
            <StatCard l="Avg reward/risk"      v={Number(a.portfolioStats.avgRewardRisk).toFixed(3)} />
            <StatCard l="Avg portfolio impact" v={Number(a.portfolioStats.avgPortfolioImpact).toFixed(3)} />
          </div>
        </>
      )}

      {/* Rejected trades */}
      <SectionHeader title="Rejected trade analysis · what happened after rejection" />
      <RejectedTradesBox data={rejects} />

      {/* Filter insights */}
      {a.filterInsights && <FilterInsights fi={a.filterInsights} />}

      <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text3)' }}>
        Analytics window: last {days} days · generated {a.generatedAt ? new Date(a.generatedAt).toLocaleString() : '—'}
      </div>
    </div>
  );
}

function RealisticPanel({ r }) {
  const drag = r?.grossPnL ? ((r.grossPnL - r.netPnL) / Math.abs(r.grossPnL)) * 100 : 0;
  return (
    <>
      <SectionHeader title="Realistic P&L (slippage + brokerage)" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <StatCard l="Gross P&L" v={`${r.grossPnL >= 0 ? '+' : ''}${INR(r.grossPnL)}`} c={clr(r.grossPnL)} sub="before costs" />
        <StatCard l="Net P&L"   v={`${r.netPnL >= 0 ? '+' : ''}${INR(r.netPnL)}`} c={clr(r.netPnL)} sub="after slippage + brokerage" />
        <StatCard l="Total costs" v={INR(r.totalCosts)} c="var(--amber-text)" sub={`avg ${INR(r.avgCostPerTrade)}/trade`} />
        <StatCard l="Drag" v={`${drag.toFixed(1)}%`} sub="cost impact" />
      </div>
    </>
  );
}

function GroupTable({ title, rows, walkForward }) {
  if (!Array.isArray(rows) || rows.length === 0) return (
    <><SectionHeader title={title} /><EmptyCard text="No data" /></>
  );
  const keyCol = walkForward ? 'window' : (rows[0].key != null ? 'key' : rows[0].strategy != null ? 'strategy' : rows[0].regime != null ? 'regime' : rows[0].window != null ? 'window' : 'key');
  const cols = [
    { h: walkForward ? 'Window' : 'Key', k: keyCol },
    { h: 'Trades', k: 'trades', r: true },
    ...(!walkForward ? [{ h: 'Wins', k: 'wins', r: true }, { h: 'Losses', k: 'losses', r: true }] : []),
    { h: 'Win %', k: 'winRate', r: true, fmt: (v) => `${Number(v || 0).toFixed(1)}%`, color: (v) => v >= 55 ? 'var(--green-text)' : v >= 45 ? 'var(--amber-text)' : 'var(--red-text)' },
    { h: 'Net P&L', k: 'netPnL', r: true, fmt: (v) => `${Number(v || 0) >= 0 ? '+' : ''}${INR(v)}`, color: clr },
    ...(!walkForward ? [
      { h: 'Avg win', k: 'avgWin', r: true, fmt: (v) => INR(v) },
      { h: 'Avg loss', k: 'avgLoss', r: true, fmt: (v) => INR(v) },
    ] : []),
    { h: 'PF', k: 'profitFactor', r: true, fmt: (v) => Number(v || 0).toFixed(2) },
    { h: 'Expect', k: 'expectancy', r: true, fmt: (v) => `${Number(v || 0) >= 0 ? '+' : ''}${INR(v)}`, color: clr },
  ];
  return (
    <>
      <SectionHeader title={title} />
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {cols.map((c) => <th key={c.h} style={{ ...thStyle, textAlign: c.r ? 'right' : 'left' }}>{c.h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  {cols.map((c) => {
                    const raw = row[c.k];
                    const v = c.fmt ? c.fmt(raw, row) : raw != null ? raw : '—';
                    const color = c.color ? c.color(raw) : 'var(--text2)';
                    return (
                      <td key={c.k} className={c.r ? 'tabular-nums' : ''} style={{ ...tdStyle, textAlign: c.r ? 'right' : 'left', color }}>{v}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function DurationDist({ rows }) {
  const maxCount = Math.max(...rows.map((d) => d.count));
  return (
    <>
      <SectionHeader title="Hold time distribution" />
      <div className="card" style={{ padding: 14 }}>
        {rows.map((d, i) => {
          const w = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 11 }}>
              <div style={{ width: 60, color: 'var(--text3)' }}>{d.bucket}</div>
              <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 4, height: 14, position: 'relative' }}>
                <div style={{ background: 'var(--brand)', height: '100%', width: `${w}%`, borderRadius: 4 }} />
              </div>
              <div className="tabular-nums" style={{ width: 90, textAlign: 'right', color: 'var(--text2)' }}>{d.count} · {d.pct || 0}%</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function AnalyticsEquity({ points }) {
  return (
    <>
      <SectionHeader title={`Equity curve · ${points.length} days`} />
      <EquitySVG points={points.map((p) => ({ date: p.date, equity: p.equity }))} />
    </>
  );
}

function SizingSim({ sim }) {
  return (
    <>
      <SectionHeader title="Confidence sizing simulation · paper-only what-if" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
        <StatCard l="Real net" v={`${sim.realNet >= 0 ? '+' : ''}${INR(sim.realNet)}`} c={clr(sim.realNet)} sub="uniform sizing" />
        <StatCard l="Sim net" v={`${sim.simNet >= 0 ? '+' : ''}${INR(sim.simNet)}`} c={clr(sim.simNet)} sub="sized by confidence" />
        <StatCard l="Edge" v={`${sim.edge >= 0 ? '+' : ''}${INR(sim.edge)}`} c={clr(sim.edge)} sub={`${sim.edgePct}% vs real`} />
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Band', 'Trades', 'Real P&L', 'Sim P&L', 'Δ'].map((h, i) => (
                  <th key={h} style={{ ...thStyle, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(sim.byBand || {}).map(([band, v]) => (
                <tr key={band} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)' }}>{band}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{v.trades}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: clr(v.pnl) }} className="tabular-nums">{Number(v.pnl || 0) >= 0 ? '+' : ''}{INR(v.pnl)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: clr(v.sim) }} className="tabular-nums">{Number(v.sim || 0) >= 0 ? '+' : ''}{INR(v.sim)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: clr((v.sim || 0) - (v.pnl || 0)) }} className="tabular-nums">{(((v.sim || 0) - (v.pnl || 0)) >= 0 ? '+' : '')}{INR((v.sim || 0) - (v.pnl || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function CostByStrategy({ rows }) {
  return (
    <>
      <SectionHeader title="Cost impact by strategy · flags low-edge strategies" />
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Strategy', 'Trades', 'Gross P&L', 'Net P&L', 'Total cost', 'Avg cost', 'Cost/Gross %', 'Low edge?'].map((h, i) => (
                  <th key={h} style={{ ...thStyle, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const pct = Number(r.costPctOfGross || 0);
                const pctColor = pct >= 30 ? 'var(--red-text)' : pct >= 15 ? 'var(--amber-text)' : 'var(--text2)';
                return (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{r.strategy}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{r.trades}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: clr(r.grossPnL) }} className="tabular-nums">{Number(r.grossPnL || 0) >= 0 ? '+' : ''}{INR(r.grossPnL)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: clr(r.netPnL) }} className="tabular-nums">{Number(r.netPnL || 0) >= 0 ? '+' : ''}{INR(r.netPnL)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{INR(r.totalCost)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{INR(r.avgCost)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: pctColor }} className="tabular-nums">{pct.toFixed(1)}%</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{r.lowEdge ? <Chip kind="a">⚠ LOW</Chip> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function StabilityTable({ rows }) {
  return (
    <>
      <SectionHeader title="Stability per strategy · drawdown + recovery" />
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Strategy', 'Trades', 'Net P&L', 'Max DD', 'Longest L streak', 'Max recovery (trades)'].map((h, i) => (
                  <th key={h} style={{ ...thStyle, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{r.strategy}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{r.trades}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: clr(r.netPnL) }} className="tabular-nums">{Number(r.netPnL || 0) >= 0 ? '+' : ''}{INR(r.netPnL)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--red-text)' }} className="tabular-nums">{INR(r.maxDrawdown)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{r.longestLossStreak}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{r.maxRecoveryBars}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function RejectedTradesBox({ data }) {
  if (data == null) return <div className="card" style={{ padding: 14, color: 'var(--text3)', fontSize: 12 }}>Loading rejected trades…</div>;
  if (data.__err) return <div className="card" style={{ padding: 14, color: 'var(--red-text)', fontSize: 12 }}>rejected-trades load failed</div>;
  const agg = Array.isArray(data.byReason) ? data.byReason : [];
  const recent = Array.isArray(data.recent) ? data.recent.slice(0, 20) : [];
  if (!agg.length && !recent.length) {
    return <EmptyCard text="No rejected candidates tracked yet. Rejections are recorded during live scans." />;
  }
  return (
    <div className="card" style={{ padding: 14 }}>
      {agg.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
            Aggregated by reject reason · positive false-reject score = possible missed trade
          </div>
          <div style={{ overflowX: 'auto', marginBottom: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {['Reject reason', 'Total', 'Settled', 'Avg max upside', 'Avg max downside', 'False-reject score'].map((h, i) => (
                    <th key={h} style={{ ...thStyle, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agg.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={tdStyle}>{r.reason || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{r.total}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{r.settled}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: (r.avgMaxUpside || 0) > 0 ? 'var(--green-text)' : 'var(--text2)' }} className="tabular-nums">
                      {r.avgMaxUpside != null ? `${r.avgMaxUpside >= 0 ? '+' : ''}${r.avgMaxUpside}%` : '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: (r.avgMaxDownside || 0) < 0 ? 'var(--red-text)' : 'var(--text2)' }} className="tabular-nums">
                      {r.avgMaxDownside != null ? `${r.avgMaxDownside >= 0 ? '+' : ''}${r.avgMaxDownside}%` : '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: (r.falseRejectScore || 0) > 0 ? 'var(--green-text)' : 'var(--text2)' }} className="tabular-nums">
                      {r.falseRejectScore != null ? `${r.falseRejectScore >= 0 ? '+' : ''}${r.falseRejectScore}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {recent.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, marginTop: 10 }}>
            Recent rejections (last {recent.length})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {['Symbol', 'Reason', 'Strategy', 'Regime', 'Entry', 'Max up', 'Max down', 'Settled'].map((h, i) => (
                    <th key={h} style={{ ...thStyle, textAlign: [4, 5, 6].includes(i) ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{r.symbol || ''}</td>
                    <td style={{ ...tdStyle, fontSize: 11, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reject_reason || ''}</td>
                    <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text3)' }}>{r.strategy || ''}</td>
                    <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text3)' }}>{r.regime || ''}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{r.entry_price != null ? INR(+r.entry_price) : '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: (r.max_upside_pct || 0) > 0 ? 'var(--green-text)' : 'var(--text2)' }} className="tabular-nums">
                      {r.max_upside_pct != null ? `${(+r.max_upside_pct).toFixed(2)}%` : '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: (r.max_downside_pct || 0) < 0 ? 'var(--red-text)' : 'var(--text2)' }} className="tabular-nums">
                      {r.max_downside_pct != null ? `${(+r.max_downside_pct).toFixed(2)}%` : '—'}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 10 }}>{r.settled ? '✓' : '…'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function FilterInsights({ fi }) {
  const topReasons = fi.topRejectReasons && Object.keys(fi.topRejectReasons).length > 0
    ? Object.entries(fi.topRejectReasons).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}×${v}`).join(' · ')
    : '';
  return (
    <>
      <SectionHeader title="Structure Filter insights" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <StatCard l="Scanned (last pass)" v={fi.total || 0} sub="BUY candidates" />
        <StatCard l="Approved (last pass)" v={fi.approved || 0} c="var(--green-text)" />
        <StatCard l="Rej · Structure" v={fi.rejectedByStructure || 0} c={(fi.rejectedByStructure || 0) > 0 ? 'var(--amber-text)' : 'var(--text2)'} />
        <StatCard l="Rej · LLM" v={fi.rejectedByLLM || 0} c={(fi.rejectedByLLM || 0) > 0 ? 'var(--amber-text)' : 'var(--text2)'} />
        <StatCard l="Pass2 entered" v={fi.pass2Entered || 0} c="var(--green-text)" />
        <StatCard l="Pass2 skipped slots" v={fi.pass2SkippedSlots || 0} />
        <StatCard l="Pass2 skipped corr" v={fi.pass2SkippedCorr || 0} />
        <StatCard l="Pass2 skipped dup" v={fi.pass2SkippedDup || 0} />
      </div>
      {topReasons && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>Top reject reasons: {topReasons}</div>}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MARKET — live price table from /api/universe/list + /prices
// ══════════════════════════════════════════════════════════════════════
function MarketTab() {
  const { data, loading, error, reload } = useFetchAll(['/api/universe/list', '/prices'], []);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  if (loading) return <Loading text="Loading market data…" />;
  if (error) return <ErrorCard err={error} />;

  const uniData = data['/api/universe/list'];
  const universe = Array.isArray(uniData?.stocks) ? uniData.stocks : Array.isArray(uniData) ? uniData : [];
  const prices = data['/prices'] || {};

  const filtered = universe.map((s) => {
    const live = prices?.[s.sym];
    const price = live?.price ?? 0;
    const chg = live && live.open > 0 ? ((price - live.open) / live.open) * 100 : 0;
    return { ...s, price, chg, high: live?.high ?? 0, low: live?.low ?? 0, vol: live?.volume ?? 0, isLive: !!live };
  }).filter((s) => {
    const q = search.trim().toUpperCase();
    if (filter !== 'All' && s.grp !== filter) return false;
    if (!q) return true;
    return (s.sym || '').toUpperCase().includes(q) || (s.name || '').toUpperCase().includes(q);
  });

  const groups = ['All', 'Nifty 50', 'Next 50', 'Midcap'];
  const liveCount = filtered.filter((s) => s.isLive).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search symbol or name…"
          style={{
            height: 36, padding: '0 14px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)',
            fontSize: 13, fontFamily: 'inherit', outline: 'none', minWidth: 220,
          }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {groups.map((g) => {
            const active = filter === g;
            return (
              <button key={g} onClick={() => setFilter(g)} style={{
                padding: '6px 12px', borderRadius: 9999, fontSize: 11.5, fontWeight: active ? 700 : 600,
                background: active ? 'var(--brand)' : 'rgba(255,255,255,0.04)',
                color: active ? '#fff' : 'var(--text2)',
                border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{g}</button>
            );
          })}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
          {liveCount} live · {filtered.length} stocks
        </span>
        <button onClick={reload} className="btn btn-secondary" style={{ height: 32, fontSize: 12, padding: '0 12px' }}>↻ Refresh</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: 620 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Symbol', 'Company', 'Group', 'Price', 'Chg%', 'High', 'Low', 'Volume'].map((h, i) => (
                  <th key={h} style={{ ...thStyle, textAlign: i < 3 ? 'left' : 'right', position: 'sticky', top: 0, background: 'linear-gradient(145deg, rgba(30,30,44,0.98), rgba(18,18,28,0.98))', zIndex: 5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 250).map((s, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)' }}>
                    {s.sym}
                    {s.isLive && <div style={{ fontSize: 9, color: 'var(--green-text)', fontWeight: 700 }}>● LIVE</div>}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11.5, color: 'var(--text2)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || ''}</td>
                  <td style={tdStyle}><span style={{ background: 'var(--bg2)', padding: '2px 7px', borderRadius: 4, fontSize: 10 }}>{s.grp || ''}</span></td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }} className="tabular-nums">{s.price > 0 ? INR(s.price) : '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: s.chg >= 0 ? 'var(--green-text)' : 'var(--red-text)', fontWeight: 600 }} className="tabular-nums">
                    {s.isLive ? pc(s.chg) : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text2)' }} className="tabular-nums">{s.high > 0 ? INR(s.high) : '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text2)' }} className="tabular-nums">{s.low > 0 ? INR(s.low) : '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text2)', fontSize: 11 }} className="tabular-nums">{s.vol > 0 ? s.vol.toLocaleString('en-IN') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 250 && (
          <div style={{ padding: 12, textAlign: 'center', fontSize: 11, color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
            Showing first 250 of {filtered.length}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// CHART — symbol selector + paper trades for symbol + structure summary
// (No embedded candlestick — references public /history endpoint)
// ══════════════════════════════════════════════════════════════════════
function ChartTab() {
  const { data: base, loading: baseLoading } = useFetchAll(['/api/universe/list', '/paper-trades'], []);
  const universe = useMemo(() => {
    const u = base['/api/universe/list'];
    return Array.isArray(u?.stocks) ? u.stocks : Array.isArray(u) ? u : [];
  }, [base]);
  const paper = Array.isArray(base['/paper-trades']) ? base['/paper-trades'] : [];

  const [sym, setSym] = useState('RELIANCE');
  const [tf, setTf] = useState('5m');
  const [candles, setCandles] = useState(null);
  const [structure, setStructure] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!sym) return;
    const intervalMap = { '5m': '5minute', '15m': '15minute', '1h': '60minute', '1D': 'day' };
    const interval = intervalMap[tf] || '5minute';
    setLoading(true); setError(null); setCandles(null); setStructure(null);
    Promise.all([
      apiGet(`/history/${encodeURIComponent(sym)}?interval=${interval}`).catch((e) => ({ __err: e.message })),
      apiGet(`/api/chart/structure/${encodeURIComponent(sym)}?interval=${interval}`).catch(() => null),
    ]).then(([c, s]) => {
      if (c?.__err) setError(c.__err);
      else setCandles(Array.isArray(c) ? c : []);
      setStructure(s || null);
      setLoading(false);
    });
  }, [sym, tf]);

  useEffect(() => { load(); }, [load]);

  const last = Array.isArray(candles) && candles.length > 0 ? candles[candles.length - 1] : null;
  const first = Array.isArray(candles) && candles.length > 0 ? candles[0] : null;
  const chg = last && first ? ((last.close - first.open) / first.open) * 100 : 0;
  const symTrades = paper.filter((t) => t?.symbol === sym).slice(0, 5);

  if (baseLoading) return <Loading text="Loading chart…" />;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <select
          value={sym}
          onChange={(e) => setSym(e.target.value)}
          style={{
            height: 36, padding: '0 12px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)',
            fontSize: 13, fontFamily: 'inherit', outline: 'none', minWidth: 220,
          }}
        >
          {universe.map((s) => (
            <option key={s.sym} value={s.sym}>{s.sym} — {s.name}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {['5m', '15m', '1h', '1D'].map((t) => {
            const active = tf === t;
            return (
              <button key={t} onClick={() => setTf(t)} style={{
                padding: '6px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: active ? 700 : 600,
                background: active ? 'var(--text)' : 'rgba(255,255,255,0.04)',
                color: active ? 'var(--bg)' : 'var(--text2)',
                border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{t}</button>
            );
          })}
        </div>
        {last && (
          <>
            <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{INR(last.close)}</span>
            <span className="tabular-nums" style={{ fontSize: 12, color: clr(chg), fontWeight: 700 }}>{pc(chg)}</span>
          </>
        )}
        <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>Real-time · NSE · Kite</span>
      </div>

      {loading ? <Loading text="Loading candles…" /> :
       error ? <ErrorCard err={error} /> :
       !candles || candles.length === 0 ? <EmptyCard text="No chart data available. Market may be closed or token expired." /> : (
        <>
          {/* Candle summary + mini sparkline */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12, marginBottom: 10 }}>
              <span>O: <b className="tabular-nums">{INR(last.open)}</b></span>
              <span>H: <b className="tabular-nums" style={{ color: 'var(--green-text)' }}>{INR(last.high)}</b></span>
              <span>L: <b className="tabular-nums" style={{ color: 'var(--red-text)' }}>{INR(last.low)}</b></span>
              <span>C: <b className="tabular-nums">{INR(last.close)}</b></span>
              <span>Vol: <b className="tabular-nums">{(last.volume || 0).toLocaleString('en-IN')}</b></span>
              <span style={{ color: 'var(--text3)', marginLeft: 'auto' }}>{candles.length} candles · {tf}</span>
            </div>
            <MiniSparkline candles={candles} />
          </div>

          {/* Structure summary */}
          {structure && (
            <div className="card" style={{ padding: 14, marginTop: 12, fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>
              <div className="label-xs" style={{ marginBottom: 6 }}>Structure overlay</div>
              {structure.zones?.nearestResistance && (
                <div>R {INR(structure.zones.nearestResistance.zoneLow)}–{INR(structure.zones.nearestResistance.zoneHigh)} ({structure.zones.nearestResistance.strengthLabel}, {structure.zones.nearestResistance.distancePct}%)</div>
              )}
              {structure.zones?.nearestSupport && (
                <div>S {INR(structure.zones.nearestSupport.zoneLow)}–{INR(structure.zones.nearestSupport.zoneHigh)} ({structure.zones.nearestSupport.strengthLabel}, {structure.zones.nearestSupport.distancePct}%)</div>
              )}
              {structure.vwap && <div>VWAP {INR(structure.vwap.current)} ({structure.vwap.bias || (structure.flags?.priceAboveVWAP ? 'SUPPORT' : 'RESISTANCE')})</div>}
              {structure.pdLevels && <div>PDH {INR(structure.pdLevels.pdh)} · PDL {INR(structure.pdLevels.pdl)}</div>}
            </div>
          )}

          {/* Paper trades for this symbol */}
          {symTrades.length > 0 && (
            <>
              <SectionHeader title={`Paper trades for ${sym}`} meta={`${symTrades.length} recent`} />
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {symTrades.map((t, i) => <TradeRow key={i} t={t} prices={{}} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function MiniSparkline({ candles }) {
  const W = 720, H = 120, mL = 4, mR = 4, mT = 4, mB = 4;
  const cW = W - mL - mR, cH = H - mT - mB;
  const closes = candles.map((c) => c.close);
  const min = Math.min(...closes), max = Math.max(...closes);
  const range = (max - min) || 1;
  const toX = (i) => mL + (i / Math.max(1, candles.length - 1)) * cW;
  const toY = (v) => mT + cH - ((v - min) / range) * cH;
  const path = candles.map((c, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(c.close).toFixed(1)}`).join(' ');
  const lastChg = candles.length >= 2 ? candles[candles.length - 1].close - candles[0].open : 0;
  const stroke = lastChg >= 0 ? '#22c55e' : '#ef4444';
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={W} height={H} style={{ maxWidth: '100%' }}>
        <path d={path} fill="none" stroke={stroke} strokeWidth="1.8" />
      </svg>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// NEWS — symbol selector → /api/news?sym= → sentiment + article list
// ══════════════════════════════════════════════════════════════════════
function NewsTab() {
  const { data: base, loading: baseLoading } = useFetchAll(['/api/universe/list'], []);
  const universe = useMemo(() => {
    const u = base['/api/universe/list'];
    return Array.isArray(u?.stocks) ? u.stocks : Array.isArray(u) ? u : [];
  }, [base]);
  const [sym, setSym] = useState('RELIANCE');
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!sym) return;
    setLoading(true); setError(null); setItems(null);
    const stock = universe.find((s) => s.sym === sym);
    const name = stock?.name || sym;
    apiGet(`/api/news?sym=${encodeURIComponent(sym)}&name=${encodeURIComponent(name)}`)
      .then((d) => { setItems(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []); setLoading(false); })
      .catch((e) => { setError(e); setLoading(false); });
  }, [sym, universe]);

  useEffect(() => { if (universe.length) load(); }, [load, universe.length]);

  const bull = Array.isArray(items) ? items.filter((n) => n.sentiment === 'bullish').length : 0;
  const bear = Array.isArray(items) ? items.filter((n) => n.sentiment === 'bearish').length : 0;
  const neu = Array.isArray(items) ? items.filter((n) => n.sentiment === 'neutral').length : 0;
  const total = (bull + bear + neu) || 1;
  const score = Math.round(((bull - bear) / total) * 100);

  if (baseLoading) return <Loading text="Loading news…" />;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <select
          value={sym}
          onChange={(e) => setSym(e.target.value)}
          style={{
            height: 36, padding: '0 12px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)',
            fontSize: 13, fontFamily: 'inherit', outline: 'none', minWidth: 220,
          }}
        >
          {universe.map((s) => (
            <option key={s.sym} value={s.sym}>{s.sym} — {s.name}</option>
          ))}
        </select>
        <button onClick={load} className="btn btn-secondary" style={{ height: 32, fontSize: 12, padding: '0 12px', marginLeft: 'auto' }}>↻ Refresh</button>
      </div>

      {loading ? <Loading text={`Fetching news for ${sym}…`} /> :
       error ? <ErrorCard err={error} /> :
       !Array.isArray(items) ? null :
       items.length === 0 ? <EmptyCard text={`No news for ${sym}`} /> : (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 12 }}>
            <div className="label-xs" style={{ marginBottom: 8 }}>Sentiment for {sym}</div>
            <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${Math.max(0, Math.min(100, (bull / total) * 100))}%`, height: '100%', background: 'var(--green-text)', borderRadius: 3 }} />
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5 }}>
              <Chip kind="g">{bull} BULLISH</Chip>
              <Chip kind="r">{bear} BEARISH</Chip>
              <Chip kind="neutral">{neu} NEUTRAL</Chip>
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: score >= 0 ? 'var(--green-text)' : 'var(--red-text)' }}>
                {score >= 0 ? 'Bullish' : 'Bearish'} {Math.abs(score)}%
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((n, i) => (
              <div
                key={i}
                className="card"
                style={{
                  padding: 14,
                  borderLeft: `3px solid ${n.sentiment === 'bullish' ? 'var(--green-text)' : n.sentiment === 'bearish' ? 'var(--red-text)' : 'var(--border)'}`,
                }}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                  <Chip kind={n.sentiment === 'bullish' ? 'g' : n.sentiment === 'bearish' ? 'r' : 'neutral'}>{n.sentiment || 'neutral'}</Chip>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{n.source || ''}{n.timeAgo ? ` · ${n.timeAgo}` : ''}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5, marginBottom: 4, color: 'var(--text)' }}>
                  {n.link ? (
                    <a href={n.link} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{n.headline}</a>
                  ) : n.headline}
                </div>
                {n.impact && <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{n.impact}</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// PORTFOLIO — Zerodha holdings snapshot
// ══════════════════════════════════════════════════════════════════════
function PortfolioTab() {
  const { data, loading, error, reload } = useFetchAll(['/api/holdings', '/margin'], []);
  if (loading) return <Loading text="Loading portfolio…" />;
  if (error) return <ErrorCard err={error} />;

  const holdData = data['/api/holdings'];
  const h = Array.isArray(holdData?.holdings) ? holdData.holdings : Array.isArray(holdData) ? holdData : [];
  const margin = data['/margin'];
  const cash = margin?.equity?.net?.available?.live_balance;
  const holdVal = h.reduce((s, hh) => s + (Number(hh.last_price || hh.average_price || 0) * Number(hh.quantity || 0)), 0);
  const invested = h.reduce((s, hh) => s + (Number(hh.average_price || 0) * Number(hh.quantity || 0)), 0);
  const pnl = holdVal - invested;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
        <StatCard l="Available cash" v={cash != null ? INR(cash) : '—'} sub="Broker margin" />
        <StatCard l="Holdings value" v={INR(holdVal)} sub={`${h.length} stocks`} />
        <StatCard l="Total invested" v={INR(invested)} />
        <StatCard l="Total P&L" v={`${pnl >= 0 ? '+' : ''}${INR(pnl)}`} c={clr(pnl)} sub={invested > 0 ? pc((pnl / invested) * 100) : ''} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={reload} className="btn btn-secondary" style={{ height: 30, fontSize: 12, padding: '0 12px' }}>↻ Refresh</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Symbol', 'Qty', 'Avg price', 'LTP', 'Invested', 'Current', 'P&L', 'Return'].map((head, i) => (
                  <th key={head} style={{ ...thStyle, textAlign: i === 0 ? 'left' : 'right' }}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {h.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>No holdings</td></tr>
              ) : h.map((hh, i) => {
                const qty = Number(hh.quantity || 0);
                const avg = Number(hh.average_price || 0);
                const ltp = Number(hh.last_price || avg);
                const inv = avg * qty;
                const cur = ltp * qty;
                const p = cur - inv;
                const r = inv > 0 ? (p / inv) * 100 : 0;
                return (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)' }}>{hh.tradingsymbol || hh.symbol}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{qty}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{INR(avg)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{INR(ltp)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text3)' }} className="tabular-nums">{INR(inv)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{INR(cur)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: clr(p) }} className="tabular-nums">{p >= 0 ? '+' : ''}{INR(p)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: clr(r) }} className="tabular-nums">{pc(r)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// SCAN LOG — recent scans + cleanup / reset actions
// ══════════════════════════════════════════════════════════════════════
function ScanLogTab() {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMsg, setActionMsg] = useState('');
  const [confirmKey, setConfirmKey] = useState(null); // 'cleanup' | 'reset' | null

  const reload = useCallback(() => {
    setLoading(true);
    apiGet('/scan-log')
      .then((d) => { setLog(Array.isArray(d) ? d : Array.isArray(d?.rows) ? d.rows : []); setLoading(false); })
      .catch((e) => { setError(e); setLoading(false); });
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const runAction = async (kind) => {
    const path = kind === 'cleanup' ? '/cleanup-trades' : '/reset-trades';
    setActionMsg('Running…');
    try {
      const r = await apiPost(path, {});
      setActionMsg(`✓ ${r?.message || 'Done'}`);
      setConfirmKey(null);
      setTimeout(reload, 800);
    } catch (e) {
      setActionMsg(`❌ ${e.message}`);
    }
    setTimeout(() => setActionMsg(''), 6000);
  };

  const regimeKind = (r) => r === 'TRENDING' ? 'g' : r === 'BREAKOUT' ? 'a' : r === 'MOMENTUM' ? 'b' : 'neutral';

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <p style={{ fontSize: 12.5, color: 'var(--text2)', flex: 1, margin: 0, lineHeight: 1.5, minWidth: 220 }}>
          Each row = one scan. Bot scans every 5 min during 09:15–15:30 IST.
        </p>
        <button onClick={reload} className="btn btn-secondary" style={{ height: 32, fontSize: 12, padding: '0 12px' }}>↻ Refresh</button>
        <button
          onClick={() => setConfirmKey('cleanup')}
          style={{
            height: 32, fontSize: 12, padding: '0 12px', borderRadius: 8,
            background: 'transparent', border: '1px solid var(--amber-text)', color: 'var(--amber-text)',
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
          }}
        >🧹 Remove bad trades</button>
        <button
          onClick={() => setConfirmKey('reset')}
          style={{
            height: 32, fontSize: 12, padding: '0 12px', borderRadius: 8,
            background: 'transparent', border: '1px solid var(--red-text)', color: 'var(--red-text)',
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
          }}
        >🗑️ Reset all trades</button>
      </div>

      {confirmKey && (
        <div className="card" style={{ padding: 14, marginBottom: 12, borderLeft: `3px solid ${confirmKey === 'reset' ? 'var(--red-text)' : 'var(--amber-text)'}` }}>
          <div style={{ fontSize: 12.5, color: 'var(--text)', marginBottom: 10, fontWeight: 600 }}>
            {confirmKey === 'reset'
              ? '⚠️  Delete ALL paper trades and start fresh? This cannot be undone.'
              : 'Remove all trades with >100% return (likely bad instrument tokens)?'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => runAction(confirmKey)} className="btn btn-primary" style={{ height: 30, fontSize: 12 }}>Yes, do it</button>
            <button onClick={() => setConfirmKey(null)} className="btn btn-secondary" style={{ height: 30, fontSize: 12 }}>Cancel</button>
          </div>
        </div>
      )}
      {actionMsg && (
        <div style={{ fontSize: 12, color: actionMsg.startsWith('❌') ? 'var(--red-text)' : 'var(--green-text)', marginBottom: 10 }}>{actionMsg}</div>
      )}

      {loading ? <Loading text="Loading scan log…" /> :
       error ? <ErrorCard err={error} /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {['Time', 'Stocks', 'Signals', 'Regime', 'Strategy', 'Message'].map((h, i) => (
                    <th key={h} style={{ ...thStyle, textAlign: [1, 2].includes(i) ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {log.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>No scans yet</td></tr>
                ) : log.map((s, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{fmtT(s.scanned_at)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">{s.stocks}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: s.signals > 0 ? 700 : 500, color: s.signals > 0 ? 'var(--green-text)' : 'var(--text3)' }} className="tabular-nums">{s.signals}</td>
                    <td style={tdStyle}>{s.regime ? <Chip kind={regimeKind(s.regime)}>{s.regime}</Chip> : '—'}</td>
                    <td style={{ ...tdStyle, fontSize: 11 }}>{s.strategy || '—'}</td>
                    <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text3)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.message || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Shared style constants
// ══════════════════════════════════════════════════════════════════════
const thStyle = {
  padding: '10px 12px',
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: 'var(--text3)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
  userSelect: 'none',
};

const tdStyle = {
  padding: '9px 12px',
  fontSize: 12,
  whiteSpace: 'nowrap',
  color: 'var(--text2)',
};
