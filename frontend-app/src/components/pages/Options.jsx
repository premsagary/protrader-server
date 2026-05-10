// Options.jsx — UI for the autonomous Options Engine (Plan A 28.5% OOS).
// Matches ProTrader design system: .card, .btn, CSS vars, gradient, brand-text.
import React, { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPost } from '../../api/client';

const SUBTABS = [
  { id: 'engine',    label: 'Engine'    },
  { id: 'today',     label: 'Today'     },
  { id: 'positions', label: 'Positions' },
  { id: 'history',   label: 'History'   },
  { id: 'events',    label: 'Events'    },
  { id: 'settings',  label: 'Settings'  },
];

const INR = (n) => `₹${(+n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtT = (ts) => ts ? new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

function StatCard({ label, value, color, sub }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text3)' }}>{label}</div>
      <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text)', marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Dot({ ok }) {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: ok ? 'var(--green)' : 'var(--red)', marginRight: 8, boxShadow: ok ? '0 0 6px var(--green)' : '0 0 6px var(--red)' }} />;
}

function SectionTitle({ children, accent }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', color: accent || 'var(--brand-text)', margin: '24px 0 10px' }}>
      {children}
    </div>
  );
}

function PageHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }} className="gradient-text">{title}</h1>
      {subtitle && <div style={{ fontSize: 13, color: 'var(--text3)' }}>{subtitle}</div>}
    </div>
  );
}

// ─── Engine sub-tab ───────────────────────────────────────────────────
function EngineTab() {
  const [status, setStatus] = useState(null);
  const [risk, setRisk] = useState(null);
  const [events, setEvents] = useState([]);
  const [err, setErr] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [s, r, e] = await Promise.all([
        apiGet('/api/options/engine/status'),
        apiGet('/api/options/risk-status'),
        apiGet('/api/options/event-log?limit=15'),
      ]);
      setStatus(s); setRisk(r); setEvents(e); setErr(null);
    } catch (e) { setErr(e.message); }
  }, []);

  useEffect(() => { refresh(); const id = setInterval(refresh, 10000); return () => clearInterval(id); }, [refresh]);

  if (err) return <div className="card" style={{ padding: 24, color: 'var(--red-text)' }}>Error: {err}</div>;
  if (!status) return <div className="card" style={{ padding: 24, color: 'var(--text3)' }}>Loading…</div>;

  const stateColor =
    status.engine_state === 'MONITOR' ? 'var(--green-text)' :
    status.engine_state === 'SAFE_MODE' ? 'var(--amber-text)' :
    status.engine_state === 'KILLED' ? 'var(--red-text)' : 'var(--text2)';
  const modeColor = status.mode === 'LIVE' ? 'var(--red-text)' : 'var(--brand-text)';
  const h = status.health || {};
  const wsAge = h.ws?.last_tick_age_ms;
  const wsDisp = wsAge != null ? (wsAge < 1000 ? `${wsAge}ms` : `${Math.round(wsAge / 1000)}s`) : 'never';

  const cmd = async (path, body = {}) => {
    try { await apiPost('/api/options/engine/' + path, body); refresh(); }
    catch (e) { alert('Error: ' + e.message); }
  };

  const flatten = async () => {
    if (!confirm('🚨 FLATTEN ALL POSITIONS\nCancel ALL pending + close ALL open + halt engine. Proceed?')) return;
    if (!confirm('Are you ABSOLUTELY SURE?')) return;
    try {
      const r = await apiPost('/api/options/engine/flatten-all', {});
      alert(r.ok ? `Flattened ${r.count || 0}.` : 'Error: ' + r.error);
      refresh();
    } catch (e) { alert('Error: ' + e.message); }
  };

  const killSwitch = async () => {
    const reason = prompt('Kill switch reason:', '');
    if (!reason || reason.length < 4) { alert('Reason required (min 4 chars)'); return; }
    if (!confirm(`⛔ KILL SWITCH\nReason: ${reason}\nProceed?`)) return;
    const verify = prompt('Re-type the reason exactly:', '');
    if (verify !== reason) { alert('Mismatch — aborted.'); return; }
    try { await apiPost('/api/options/engine/kill', { reason }); refresh(); }
    catch (e) { alert('Error: ' + e.message); }
  };

  return (
    <div>
      <PageHeader title="Options Engine" subtitle="Plan A — 28.5% OOS validated · 5 strategies · 55 filters · Day×VIX matrix" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <StatCard label="Engine"          value={status.engine_state || '?'} color={stateColor} />
        <StatCard label="Mode"            value={status.mode}                 color={modeColor} />
        <StatCard label="Enabled"         value={status.engine_enabled ? 'YES' : 'NO'} color={status.engine_enabled ? 'var(--green-text)' : 'var(--text3)'} />
        <StatCard label="Manual approval" value={status.manual_approval ? 'ON' : 'AUTO'} color={status.manual_approval ? 'var(--amber-text)' : 'var(--green-text)'} />
        <StatCard label="Open positions"  value={status.open_positions}       color={status.open_positions > 0 ? 'var(--brand-text)' : 'var(--text3)'} />
        <StatCard label="Last cycle"      value={status.last_cycle ? new Date(status.last_cycle).toLocaleTimeString('en-IN') : 'never'} />
      </div>

      <SectionTitle>Health</SectionTitle>
      <div className="card" style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, fontSize: 13, color: 'var(--text2)' }}>
        <div><Dot ok={h.ws?.ok} /> WebSocket — last tick <strong style={{ color: 'var(--text)' }}>{wsDisp}</strong></div>
        <div><Dot ok={h.broker?.ok} /> Broker (Kite) — fails {h.broker?.consec_fails || 0}, {h.broker?.latency_ms || '?'}ms</div>
        <div><Dot ok={h.db?.ok} /> PostgreSQL</div>
        <div><Dot ok={h.chain?.ok} /> Option chain — {h.chain?.age_ms || '?'}ms old</div>
        <div><Dot ok={h.vix?.ok} /> VIX — {h.vix?.age_sec || '?'}s old</div>
        <div><Dot ok={h.exchange?.ok} /> NSE Exchange</div>
        <div><Dot ok={h.token?.ok} /> Token age {h.token?.age_hours?.toFixed(1) || '?'}h</div>
        <div>{h.healthy
          ? <strong style={{ color: 'var(--green-text)' }}>✓ HEALTHY</strong>
          : <strong style={{ color: 'var(--red-text)' }}>✗ {h.reason}</strong>}</div>
      </div>

      {risk && (
        <>
          <SectionTitle>Risk &amp; Caps</SectionTitle>
          <div className="card" style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, fontSize: 13, color: 'var(--text2)' }}>
            <div>Today P&amp;L: <strong className="tabular-nums" style={{ color: (risk.current?.today_pnl || 0) >= 0 ? 'var(--green-text)' : 'var(--red-text)' }}>{INR(risk.current?.today_pnl || 0)}</strong> / cap {INR(risk.settings?.daily_loss_cap || 0)}</div>
            <div>Drawdown: <span className="tabular-nums">{INR(risk.current?.drawdown || 0)}</span> / {((risk.settings?.max_drawdown_pct || 0) * 100).toFixed(0)}% of {INR(risk.settings?.capital || 0)}</div>
            <div>Open positions: {risk.current?.open_count || 0} / {risk.settings?.max_open_positions || 1}</div>
            <div>Consec losses: {risk.current?.consec_loss_days || 0} / {risk.settings?.max_consec_losses || 2}</div>
            <div>SAFE_MODE: {risk.safe_mode_active
              ? <strong style={{ color: 'var(--amber-text)' }}>ACTIVE — {risk.safe_mode_reason}</strong>
              : <span style={{ color: 'var(--green-text)' }}>OFF</span>}</div>
            <div>Kill: {risk.killed_until
              ? <strong style={{ color: 'var(--red-text)' }}>KILLED — {risk.killed_reason}</strong>
              : <span style={{ color: 'var(--green-text)' }}>CLEAR</span>}</div>
          </div>
        </>
      )}

      <SectionTitle>Controls</SectionTitle>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {status.engine_enabled
          ? <button onClick={() => cmd('stop')} className="btn btn-secondary">⏸ Stop engine</button>
          : <button onClick={() => cmd('start', { confirm: true })} className="btn btn-primary">▶ Start engine</button>}
        {risk?.safe_mode_active
          ? <button onClick={() => cmd('safe-mode/clear')} className="btn btn-secondary">Exit SAFE_MODE</button>
          : <button onClick={() => cmd('safe-mode')} className="btn btn-secondary">Enter SAFE_MODE</button>}
        <button onClick={() => cmd('run-cycle', { dryRun: true })} className="btn btn-secondary">⟲ Dry-run today's cycle</button>
      </div>

      <div className="card" style={{ marginTop: 16, padding: 16, background: 'linear-gradient(145deg, rgba(248,113,113,0.10), rgba(248,113,113,0.05))', borderColor: 'var(--red)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 800, color: 'var(--red-text)', fontSize: 14, letterSpacing: 0.4 }}>EMERGENCY CONTROLS</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Cancel all pending orders, close all open legs, and halt the engine.</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={flatten} className="btn" style={{ background: 'var(--red)', color: '#fff', border: 'none' }}>Flatten all</button>
            <button onClick={killSwitch} className="btn" style={{ background: 'transparent', color: 'var(--red-text)', border: '1px solid var(--red)' }}>Kill switch</button>
          </div>
        </div>
      </div>

      <SectionTitle>Recent engine events</SectionTitle>
      <div className="card" style={{ padding: 12, fontFamily: '"SF Mono","JetBrains Mono",monospace', fontSize: 11, maxHeight: 320, overflowY: 'auto' }}>
        {events.length === 0
          ? <div style={{ color: 'var(--text3)' }}>No events yet.</div>
          : events.map((e, i) => {
              const sev = e.severity === 'CRITICAL' || e.severity === 'ERROR' ? 'var(--red-text)' : e.severity === 'WARN' ? 'var(--amber-text)' : 'var(--text3)';
              return (
                <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text4)' }}>{new Date(e.ts).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short' })}</span>{' '}
                  <span style={{ color: sev, fontWeight: 700 }}>{e.severity}</span>{' '}
                  <span style={{ color: 'var(--text)' }}>{e.event_type}</span>{' '}
                  <span style={{ color: 'var(--text4)' }}>{JSON.stringify(e.ctx).slice(0, 140)}</span>
                </div>
              );
            })}
      </div>
    </div>
  );
}

// ─── Today sub-tab ────────────────────────────────────────────────────
function TodayTab() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    Promise.all([apiGet('/api/options/regime'), apiGet('/api/options/today-decision')])
      .then(([regime, decision]) => setData({ regime, decision }))
      .catch(e => setErr(e.message));
  }, []);

  if (err) return <div className="card" style={{ padding: 24, color: 'var(--red-text)' }}>Error: {err}</div>;
  if (!data) return <div className="card" style={{ padding: 24, color: 'var(--text3)' }}>Running 55-filter check…</div>;

  const { regime, decision } = data;
  const isTrade = decision.decision === 'TRADE_DRY_RUN' || decision.decision === 'TRADE';
  const isSkip = decision.decision === 'SKIP';
  const decColor = isTrade ? 'var(--green)' : isSkip ? 'var(--amber)' : 'var(--red)';
  const decTextColor = isTrade ? 'var(--green-text)' : isSkip ? 'var(--amber-text)' : 'var(--red-text)';
  const results = decision.filterResults || decision.results || [];

  return (
    <div>
      <PageHeader title="Today's Decision" subtitle="Daily 55-filter pre-trade check" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <StatCard label="NIFTY"          value={regime.spot?.toFixed(2) || '—'} />
        <StatCard label="VIX"            value={regime.vix?.toFixed(2) || '—'} color={regime.vix > 22 ? 'var(--red-text)' : regime.vix < 13 ? 'var(--amber-text)' : 'var(--green-text)'} />
        <StatCard label="Day"            value={regime.day_of_week} />
        <StatCard label="VIX band"       value={regime.vix_band || '—'} color="var(--brand-text)" />
        <StatCard label="DTE"            value={regime.dte} />
        <StatCard label="Expiry today"   value={regime.is_expiry_today ? 'YES' : 'no'} color={regime.is_expiry_today ? 'var(--amber-text)' : 'var(--text3)'} />
      </div>

      <SectionTitle accent={decTextColor}>Decision</SectionTitle>
      <div className="card" style={{ padding: 18, borderColor: decColor }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: decTextColor, letterSpacing: '0.5px' }}>{decision.decision}</div>
        <div style={{ marginTop: 6, color: 'var(--text2)', fontSize: 13 }}>{decision.reason || '—'}</div>
        {decision.tradeCard && (
          <div style={{ marginTop: 14, padding: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{decision.tradeCard.strategy} <span style={{ color: 'var(--text3)', fontWeight: 500 }}>· credit ₹{decision.tradeCard.credit}</span></div>
            {(decision.tradeCard.legs || []).map((l, i) => (
              <div key={i} style={{ fontFamily: '"SF Mono",monospace', fontSize: 12, color: l.side === 'SELL' ? 'var(--green-text)' : 'var(--red-text)' }}>
                {l.side} {l.qty} × {l.strike} {l.type} @ ₹{l.premium}
              </div>
            ))}
          </div>
        )}
      </div>

      <SectionTitle>Filter results <span style={{ color: 'var(--text4)', fontWeight: 500 }}>({results.length} of 55)</span></SectionTitle>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ background: 'rgba(255,255,255,0.03)', position: 'sticky', top: 0 }}>
              <tr style={{ color: 'var(--text3)', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' }}>#</th>
                <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' }}>Layer</th>
                <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' }}>Filter</th>
                <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', textAlign: 'center' }}>Pass</th>
                <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' }}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {results.map((f, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 10px', color: 'var(--text4)', fontFamily: 'monospace' }}>#{f.id}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--text3)' }}>L{f.layer}</td>
                  <td style={{ padding: '6px 10px', fontFamily: '"SF Mono",monospace', color: 'var(--text)' }}>{f.name}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>{f.pass
                    ? <span style={{ color: 'var(--green-text)', fontWeight: 700 }}>✓</span>
                    : <span style={{ color: 'var(--red-text)', fontWeight: 700 }}>✗</span>}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--text2)' }}>{f.reason || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Positions sub-tab ────────────────────────────────────────────────
function PositionsTab() {
  const [positions, setPositions] = useState(null);
  const [monitors, setMonitors] = useState([]);
  const [err, setErr] = useState(null);
  const refresh = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([apiGet('/api/options/positions'), apiGet('/api/options/live-monitors').catch(() => [])]);
      setPositions(p); setMonitors(m);
    } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { refresh(); const id = setInterval(refresh, 5000); return () => clearInterval(id); }, [refresh]);

  if (err) return <div className="card" style={{ padding: 24, color: 'var(--red-text)' }}>Error: {err}</div>;
  if (!positions) return <div className="card" style={{ padding: 24, color: 'var(--text3)' }}>Loading…</div>;
  if (positions.length === 0) {
    return (
      <>
        <PageHeader title="Open Positions" subtitle="Live P&L · auto-refresh 5s" />
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>No open positions.</div>
      </>
    );
  }

  const monitorByTrade = Object.fromEntries(monitors.map(m => [m.tradeId, m]));
  const exitTrade = async (id) => {
    if (!confirm('Exit this position now?')) return;
    try { await apiPost('/api/options/exit-trade/' + id, {}); refresh(); }
    catch (e) { alert('Error: ' + e.message); }
  };

  return (
    <div>
      <PageHeader title="Open Positions" subtitle="Live P&L · auto-refresh 5s" />
      {positions.map(p => {
        const mon = monitorByTrade[p.id]; const pnl = mon?.unrealizedPnl ?? 0;
        const distPct = mon?.distance != null ? (mon.distance * 100).toFixed(0) : '—';
        const distColor = mon?.distance < 0.1 ? 'var(--red-text)' : mon?.distance < 0.3 ? 'var(--amber-text)' : 'var(--green-text)';
        return (
          <div key={p.id} className="card" style={{ marginBottom: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{p.strategy}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  <span className="chip" style={{ height: 22, fontSize: 11, marginRight: 6 }}>{p.state}</span>
                  <span className="chip" style={{ height: 22, fontSize: 11, marginRight: 6 }}>{p.mode}</span>
                  Entered {p.entry_time ? fmtT(p.entry_time) : '—'} · {p.day_of_week} × {p.vix_band} · credit ₹{p.credit} · margin ₹{p.margin_used}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, color: pnl >= 0 ? 'var(--green-text)' : 'var(--red-text)' }}>{INR(pnl)}</div>
                {mon && <div style={{ fontSize: 10, color: distColor, marginTop: 2 }}>SL distance {distPct}% · check {mon.checkIntervalMs}ms</div>}
              </div>
            </div>
            <div style={{ marginTop: 12, padding: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: '"SF Mono",monospace', fontSize: 12 }}>
              {(p.legs || []).map((l, i) => {
                const cur = mon?.currentPrices?.[`${l.strike}_${l.type}`];
                return (
                  <span key={i} style={{ color: l.side === 'SELL' ? 'var(--green-text)' : 'var(--red-text)' }}>
                    {l.side} {l.strike}{l.type} @ ₹{l.premium || l.entry_premium}
                    {cur ? <span style={{ color: 'var(--text3)' }}> → ₹{(+cur).toFixed(2)}</span> : null}
                    {i < p.legs.length - 1 ? <span style={{ color: 'var(--text4)' }}>  ·  </span> : null}
                  </span>
                );
              })}
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => exitTrade(p.id)} className="btn" style={{ height: 32, fontSize: 12, padding: '0 14px', background: 'var(--red)', color: '#fff', border: 'none' }}>Exit now</button>
              <span style={{ fontSize: 11, color: 'var(--text4)', marginLeft: 'auto' }}>Force exit at {p.force_exit_time}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── History sub-tab ──────────────────────────────────────────────────
function HistoryTab() {
  const [trades, setTrades] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { apiGet('/api/options/trades?days=90').then(setTrades).catch(e => setErr(e.message)); }, []);

  if (err) return <div className="card" style={{ padding: 24, color: 'var(--red-text)' }}>Error: {err}</div>;
  if (!trades) return <div className="card" style={{ padding: 24, color: 'var(--text3)' }}>Loading…</div>;

  const total = trades.reduce((a, t) => a + (parseFloat(t.realized_pnl) || 0), 0);
  const wins = trades.filter(t => parseFloat(t.realized_pnl) > 0).length;
  const closed = trades.filter(t => t.state === 'CLOSED').length;
  const wr = closed ? Math.round(wins / closed * 100) : 0;

  return (
    <div>
      <PageHeader title="Trade History" subtitle="Last 90 days · click row for detail" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <StatCard label="Trades (90d)" value={trades.length} />
        <StatCard label="Closed"       value={closed} />
        <StatCard label="Win rate"     value={`${wr}%`} color={wr >= 55 ? 'var(--green-text)' : 'var(--amber-text)'} />
        <StatCard label="Total P&L"    value={INR(total)} color={total >= 0 ? 'var(--green-text)' : 'var(--red-text)'} />
      </div>

      <SectionTitle>Trades</SectionTitle>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ maxHeight: 600, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ background: 'rgba(255,255,255,0.03)', position: 'sticky', top: 0 }}>
              <tr style={{ color: 'var(--text3)', textAlign: 'left' }}>
                {['Date','Day','VIX','Strategy','State','Mode','Credit','P&L'].map(h =>
                  <th key={h} style={{ padding: '8px 10px', fontWeight: 700, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {trades.map(t => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 10px', color: 'var(--text2)', fontFamily: 'monospace' }}>{t.trade_date}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--text2)' }}>{t.day_of_week}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--text2)' }}>{t.vix_band || ''}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--text)', fontWeight: 600 }}>{t.strategy}</td>
                  <td style={{ padding: '6px 10px' }}><span className="chip" style={{ height: 20, fontSize: 10 }}>{t.state}</span></td>
                  <td style={{ padding: '6px 10px', color: 'var(--text2)' }}>{t.mode}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--text2)', fontFamily: 'monospace' }}>{t.credit ? '₹' + t.credit : '—'}</td>
                  <td style={{ padding: '6px 10px', color: parseFloat(t.realized_pnl) >= 0 ? 'var(--green-text)' : 'var(--red-text)', fontFamily: 'monospace', fontWeight: 600 }}>
                    {t.realized_pnl ? INR(t.realized_pnl) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Events sub-tab ───────────────────────────────────────────────────
function EventsTab() {
  const [events, setEvents] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { apiGet('/api/options/event-log?limit=200').then(setEvents).catch(e => setErr(e.message)); }, []);
  if (err) return <div className="card" style={{ padding: 24, color: 'var(--red-text)' }}>Error: {err}</div>;
  if (!events) return <div className="card" style={{ padding: 24, color: 'var(--text3)' }}>Loading…</div>;
  return (
    <div>
      <PageHeader title="Engine Events" subtitle="Last 200 entries · state transitions, kill switches, health changes" />
      <div className="card" style={{ padding: 14, fontFamily: '"SF Mono",monospace', fontSize: 11, maxHeight: 720, overflowY: 'auto' }}>
        {events.map((e, i) => {
          const sev = e.severity === 'CRITICAL' || e.severity === 'ERROR' ? 'var(--red-text)' : e.severity === 'WARN' ? 'var(--amber-text)' : 'var(--text3)';
          return (
            <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text4)' }}>{new Date(e.ts).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short' })}</span>{' '}
              <span style={{ color: sev, fontWeight: 700 }}>{e.severity}</span>{' '}
              <span style={{ color: 'var(--text)' }}>{e.event_type}</span>{' '}
              <span style={{ color: 'var(--text4)' }}>{JSON.stringify(e.ctx).slice(0, 200)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Settings sub-tab ─────────────────────────────────────────────────
function SettingsTab() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState(null);
  const [form, setForm] = useState({});
  useEffect(() => { apiGet('/api/options/settings').then(d => { setS(d); setForm({ ...d }); }).catch(e => setErr(e.message)); }, []);

  if (err) return <div className="card" style={{ padding: 24, color: 'var(--red-text)' }}>Error: {err}</div>;
  if (!s) return <div className="card" style={{ padding: 24, color: 'var(--text3)' }}>Loading…</div>;

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    const body = {
      mode: form.mode, manual_approval: form.manual_approval,
      capital: +form.capital, max_lots: +form.max_lots,
      daily_loss_cap: +form.daily_loss_cap, max_drawdown_pct: +form.max_drawdown_pct,
      max_open_positions: +form.max_open_positions, max_consec_losses: +form.max_consec_losses,
      notify_telegram: form.notify_telegram || null, notify_email: form.notify_email || null,
    };
    if (body.mode === 'LIVE') {
      if (!confirm('⚠️ Switching to LIVE mode — REAL MONEY. Confirm?')) return;
      body.confirm = true;
    }
    try { await apiPost('/api/options/settings', body); alert('Saved.'); }
    catch (e) { alert('Error: ' + e.message); }
  };

  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 };
  const inputStyle = { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.04)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, outline: 'none' };

  const Field = ({ label, children }) => (
    <div><label style={labelStyle}>{label}</label>{children}</div>
  );

  return (
    <div style={{ maxWidth: 760 }}>
      <PageHeader title="Engine Settings" subtitle="Defaults are safe (PAPER mode, 1 lot, manual approval). Change with care." />
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Field label="Mode">
            <select style={inputStyle} value={form.mode || 'PAPER'} onChange={e => upd('mode', e.target.value)}>
              <option value="PAPER">PAPER (simulated)</option>
              <option value="LIVE">LIVE (real money)</option>
            </select>
          </Field>
          <Field label="Manual approval">
            <select style={inputStyle} value={form.manual_approval ? 'true' : 'false'} onChange={e => upd('manual_approval', e.target.value === 'true')}>
              <option value="true">YES (operator confirms each trade)</option>
              <option value="false">NO (full autonomous)</option>
            </select>
          </Field>
          <Field label="Capital (₹)"><input style={inputStyle} type="number" value={form.capital || 200000} onChange={e => upd('capital', e.target.value)} /></Field>
          <Field label="Max lots"><input style={inputStyle} type="number" value={form.max_lots || 1} onChange={e => upd('max_lots', e.target.value)} /></Field>
          <Field label="Daily loss cap (₹)"><input style={inputStyle} type="number" value={form.daily_loss_cap || 5000} onChange={e => upd('daily_loss_cap', e.target.value)} /></Field>
          <Field label="Max drawdown %"><input style={inputStyle} type="number" step="0.01" value={form.max_drawdown_pct || 0.15} onChange={e => upd('max_drawdown_pct', e.target.value)} /></Field>
          <Field label="Max open positions"><input style={inputStyle} type="number" value={form.max_open_positions || 1} onChange={e => upd('max_open_positions', e.target.value)} /></Field>
          <Field label="Max consec losses"><input style={inputStyle} type="number" value={form.max_consec_losses || 2} onChange={e => upd('max_consec_losses', e.target.value)} /></Field>
          <Field label="Telegram chat_id"><input style={inputStyle} type="text" value={form.notify_telegram || ''} onChange={e => upd('notify_telegram', e.target.value)} placeholder="-1001234567890" /></Field>
          <Field label="Email"><input style={inputStyle} type="email" value={form.notify_email || ''} onChange={e => upd('notify_email', e.target.value)} placeholder="alerts@example.com" /></Field>
        </div>
        <button onClick={save} className="btn btn-primary" style={{ marginTop: 22 }}>Save settings</button>
      </div>
    </div>
  );
}

// ─── Sub-tab pill nav (matches ProTrader top nav style) ───────────────
function SubTabNav({ current, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: 4,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      width: 'fit-content',
      marginBottom: 24,
    }}>
      {SUBTABS.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: '8px 16px',
            background: current === t.id ? 'rgba(99,102,241,0.18)' : 'transparent',
            color: current === t.id ? 'var(--brand-text)' : 'var(--text3)',
            border: '1px solid ' + (current === t.id ? 'var(--brand-border)' : 'transparent'),
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'inherit',
            transition: 'all 180ms ease',
          }}
          onMouseEnter={e => { if (current !== t.id) e.target.style.color = 'var(--text2)'; }}
          onMouseLeave={e => { if (current !== t.id) e.target.style.color = 'var(--text3)'; }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────
export default function Options() {
  const [sub, setSub] = useState('engine');
  return (
    <div>
      <SubTabNav current={sub} onChange={setSub} />
      {sub === 'engine'    && <EngineTab />}
      {sub === 'today'     && <TodayTab />}
      {sub === 'positions' && <PositionsTab />}
      {sub === 'history'   && <HistoryTab />}
      {sub === 'events'    && <EventsTab />}
      {sub === 'settings'  && <SettingsTab />}
    </div>
  );
}
