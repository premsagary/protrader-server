import React, { useEffect, useState, useCallback, useRef } from 'react';
import { apiGet, apiPost } from '../../api/client';
import GatesActiveBanner from '../common/GatesActiveBanner';

// ══════════════════════════════════════════════════════════════════════
// Agent — rule-based auto-trading control panel (React v2)
//
// Mirrors the legacy renderAgentPage / _renderAgentPanel flow:
//   • Polls /api/agent/status every 10s while mounted
//   • Mode selector (off / dry_run / paper / live) with inline confirm
//   • Auto-schedule toggle (9:15 IST start, 15:30 IST stop) + target mode
//   • Force-run cycle button
//   • Stats cards + rejection breakdown
//   • Paper PnL summary, armed candidates, open trades, closed trades
//   • Recent decisions (last 20) table
// ══════════════════════════════════════════════════════════════════════

const MODE_COLORS = {
  off:   { c: '#64748b', bg: 'rgba(100,116,139,0.12)', bd: 'rgba(100,116,139,0.4)' },
  paper: { c: '#eab308', bg: 'rgba(234,179,8,0.14)',   bd: 'rgba(234,179,8,0.42)' },
  live:  { c: '#ef4444', bg: 'rgba(239,68,68,0.14)',   bd: 'rgba(239,68,68,0.42)' },
};

function ModeBadge({ mode }) {
  const m = MODE_COLORS[mode] || MODE_COLORS.off;
  return (
    <span style={{
      background: m.bg, color: m.c, border: `1px solid ${m.bd}`,
      padding: '4px 12px', borderRadius: 9999, fontSize: 11, fontWeight: 800, letterSpacing: 0.6,
    }}>
      {String(mode || 'off').toUpperCase()}
    </span>
  );
}

function fmtINR(v) {
  const n = Number(v || 0);
  return '₹' + Math.round(n).toLocaleString('en-IN');
}
function fmtNum(v, dec = 2) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(dec) : '—';
}
function fmtTime(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch { return String(ts); }
}
function fmtHM(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return String(ts); }
}

export default function Agent({ embedded = false } = {}) {
  const [status, setStatus] = useState(null);
  const [closed, setClosed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [pendingMode, setPendingMode] = useState(null);
  const [runningNow, setRunningNow] = useState(false);
  const [armedConfirmOpen, setArmedConfirmOpen] = useState(false);
  const pollRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const d = await apiGet('/api/agent/status');
      setStatus(d || {});
      setErr(null);
      // Lazy-pull trades if paper mode and we don't have them yet
      if (d && d.mode === 'paper') {
        try {
          const t = await apiGet('/api/agent/trades');
          setClosed(Array.isArray(t?.closed) ? t.closed : []);
        } catch {}
      }
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchStatus]);

  const setMode = async (m) => {
    setPendingMode(null);
    try {
      const d = await apiPost('/api/agent/mode', { mode: m });
      if (!d?.ok) throw new Error(d?.error || 'Mode switch failed');
      fetchStatus();
    } catch (e) { alert('Mode switch failed: ' + e.message); }
  };

  const setAutoSchedule = async (enabled, targetMode) => {
    try {
      const d = await apiPost('/api/agent/auto-schedule', { enabled: !!enabled, targetMode });
      if (!d?.ok) throw new Error(d?.error || 'Auto-schedule update failed');
      fetchStatus();
    } catch (e) { alert('Auto-schedule update failed: ' + e.message); }
  };

  const runNow = async () => {
    setRunningNow(true);
    try {
      await apiPost('/api/agent/run-now', {});
      setTimeout(fetchStatus, 1200);
    } catch (e) { alert('run-now failed: ' + e.message); }
    finally { setTimeout(() => setRunningNow(false), 1500); }
  };

  const clearArmed = async () => {
    setArmedConfirmOpen(false);
    try {
      await apiPost('/api/agent/clear-armed', {});
      fetchStatus();
    } catch (e) { alert('clear-armed failed: ' + e.message); }
  };

  if (loading && !status) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
        Loading agent status…
      </div>
    );
  }
  if (err && !status) {
    return (
      <div className="card" style={{ padding: 32, maxWidth: 720 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red-text)', letterSpacing: 1.2, marginBottom: 8 }}>
          AGENT API UNREACHABLE
        </div>
        <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 12 }}>{err}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.55 }}>
          Make sure <code style={{ background: 'var(--bg2)', padding: '1px 6px', borderRadius: 4 }}>agent/migrations/001_agent_tables.sql</code> has been run and that the agent bootstrap block is present in <code style={{ background: 'var(--bg2)', padding: '1px 6px', borderRadius: 4 }}>kite-server.js</code>.
        </div>
        <button className="btn btn-primary" style={{ marginTop: 14, height: 36 }} onClick={fetchStatus}>↻ Retry</button>
      </div>
    );
  }

  const d = status || {};
  const stats = d.stats || { total: 0, approved: 0, rejected: 0, rejection_breakdown: {} };
  const recent = Array.isArray(d.recent) ? d.recent : [];
  const validModes = Array.isArray(d.validModes) ? d.validModes : ['off', 'paper', 'live'];
  const tablesMissing = !!stats.tablesMissing;
  const paper = d.paper || { total: 0, open_count: 0, closed_count: 0, wins: 0, losses: 0, realized_pnl: 0, best_trade: 0, worst_trade: 0 };
  const armed = Array.isArray(d.armed) ? d.armed : [];
  const openTrades = Array.isArray(d.openTrades) ? d.openTrades : [];
  const winRate = paper.closed_count > 0 ? Math.round((paper.wins / paper.closed_count) * 100) : null;
  const realized = Number(paper.realized_pnl || 0);
  const pnlColor = realized > 0 ? 'var(--green-text)' : realized < 0 ? 'var(--red-text)' : 'var(--text2)';
  const showPaperSections = d.mode === 'paper' || paper.total > 0 || armed.length > 0 || openTrades.length > 0;

  const rejBreak = stats.rejection_breakdown && typeof stats.rejection_breakdown === 'object'
    ? Object.entries(stats.rejection_breakdown)
        .filter(([k]) => k && k !== 'null')
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    : [];

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Hero — hidden when this component is embedded inside the Trade tab */}
      {!embedded && (
      <div className="card card-premium" style={{ padding: '22px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 280, height: 280,
          background: 'radial-gradient(circle, rgba(139,92,246,0.15), transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
          <div className="gradient-fill" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>
            Agent — Auto-Trader
          </div>
          <ModeBadge mode={d.mode || 'off'} />
          {d.cycleRunning && (
            <span className="animate-pulse-custom" style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
              padding: '3px 10px', borderRadius: 9999,
              background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.4)',
            }}>
              ⟳ CYCLE RUNNING
            </span>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
            env fallback: <b style={{ color: 'var(--text2)' }}>{d.envFallback || 'off'}</b> · config <b style={{ color: 'var(--text2)' }}>{d.configVersion || '?'}</b>
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55, maxWidth: 920, marginBottom: 12 }}>
          Rule-based intraday agent. Reads picks from the DayTrade scanner every minute, applies filters + hard constraints,
          writes every decision to <code style={{ background: 'var(--bg2)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>agent_decisions</code>.
          {' '}Paper capital: <b style={{ color: 'var(--text)' }}>{fmtINR(d.paperCapital || 0)}</b>.
          {' '}Cycle auto-skips when mode is <code style={{ background: 'var(--bg2)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>off</code>.
        </div>
        {/* Health row — cron / poller / armed */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <HealthChip on={d.cronActive} label="cycle cron" />
          <HealthChip on={d.autoSchedule?.openCronActive} label="9:15 auto-open" />
          <HealthChip on={d.autoSchedule?.closeCronActive} label="15:30 auto-close" />
          <HealthChip on={d.trader?.running} label={`broker poller${d.trader?.tickCount ? ` · ${d.trader.tickCount} ticks` : ''}`} />
          {typeof d.armedCount === 'number' && (
            <span className="chip" style={{
              fontSize: 10, padding: '3px 9px', borderRadius: 9999,
              background: d.armedCount > 0 ? 'rgba(168,85,247,0.12)' : 'var(--bg2)',
              color: d.armedCount > 0 ? '#c084fc' : 'var(--text3)',
              border: `1px solid ${d.armedCount > 0 ? 'rgba(168,85,247,0.3)' : 'var(--border)'}`,
            }}>
              {d.armedCount} armed
            </span>
          )}
        </div>
      </div>
      )}

      {/* Gates pipeline banner — only shown when rendered standalone; Trade tab has its own */}
      {!embedded && (
        <GatesActiveBanner
          variant="full"
          accent="indigo"
          title="Agent — operates on the same 5-layer gate pipeline"
          subtitle="Each minute, the agent re-evaluates DayTrade picks through these gates before emitting a BUY. Decisions are logged to agent_decisions."
        />
      )}

      {/* Mode + actions row */}
      <div className="card" style={{ padding: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {validModes.map((m) => {
          const active = d.mode === m;
          const col = (MODE_COLORS[m] || MODE_COLORS.off).c;
          return (
            <button
              key={m}
              onClick={() => setPendingMode(m)}
              style={{
                padding: '9px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 12, letterSpacing: 0.5,
                border: `2px solid ${active ? col : 'var(--border)'}`,
                background: active ? col + '22' : 'transparent',
                color: active ? col : 'var(--text3)',
                transition: 'all 0.18s',
              }}
            >
              {active ? '● ' : ''}{m.toUpperCase()}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-secondary"
          disabled={runningNow}
          onClick={runNow}
          style={{ height: 36, opacity: runningNow ? 0.6 : 1 }}
        >
          {runningNow ? '⟳ Running…' : '▶ Force-run cycle'}
        </button>
        <button className="btn btn-secondary" onClick={fetchStatus} style={{ height: 36 }}>
          ↻ Refresh
        </button>
      </div>

      {/* Inline mode-switch confirm */}
      {pendingMode && (
        <div className="card" style={{ padding: 16, border: `1px solid ${(MODE_COLORS[pendingMode] || MODE_COLORS.off).bd}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Switch agent to <ModeBadge mode={pendingMode} /> ?
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.55, marginBottom: 12 }}>
            {pendingMode === 'off'   && 'Agent will do nothing. Cron continues to tick but bails immediately.'}
            {pendingMode === 'paper' && 'Agent will read picks from the DayTrade scanner every minute and simulate fills against live Kite quotes. Paper PnL will be tracked in agent_trades.'}
            {pendingMode === 'live'  && '⚠ LIVE mode places REAL Zerodha MIS orders. Not built in Phase 1 — proceed only if explicitly implemented.'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ height: 34 }} onClick={() => setMode(pendingMode)}>
              Yes, switch to {pendingMode.toUpperCase()}
            </button>
            <button className="btn btn-secondary" style={{ height: 34 }} onClick={() => setPendingMode(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Auto-schedule bar */}
      <AutoScheduleBar schedule={d.autoSchedule} onChange={setAutoSchedule} />

      {/* Stats */}
      {tablesMissing ? (
        <div className="card" style={{ padding: 20, border: '1px dashed var(--amber-text)', color: 'var(--amber-text)', background: 'rgba(251,191,36,0.05)' }}>
          Agent audit tables not found. Run <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>agent/migrations/001_agent_tables.sql</code> against your DB.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <StatCard label="Proposals today" value={stats.total || 0} />
          <StatCard label="Approved" value={stats.approved || 0} color="var(--green-text)" accent="rgba(94,204,138,0.35)" bg="rgba(94,204,138,0.06)" />
          <StatCard label="Rejected" value={stats.rejected || 0} color="var(--red-text)" accent="rgba(239,68,68,0.35)" bg="rgba(239,68,68,0.06)" />
        </div>
      )}

      {rejBreak.length > 0 && (
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>
            Rejection reasons
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {rejBreak.map(([reason, count]) => (
              <span key={reason} style={{
                fontFamily: '"SF Mono","JetBrains Mono",monospace', fontSize: 11,
                padding: '3px 9px', borderRadius: 6,
                background: 'rgba(239,68,68,0.08)', color: 'var(--red-text)',
              }}>
                {reason} × {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Paper sections */}
      {showPaperSections && (
        <>
          {/* Paper PnL card */}
          <div className="card" style={{ padding: 18, background: 'linear-gradient(180deg, rgba(168,85,247,0.04), rgba(168,85,247,0.01))', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.2 }}>Paper PnL · today</div>
              <span className="chip" style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)', fontSize: 10 }}>PHASE 2</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
              <PnlCell label="Realized" value={fmtINR(realized)} color={pnlColor} />
              <PnlCell label="Open"     value={paper.open_count || 0} />
              <PnlCell label="Closed"   value={paper.closed_count || 0} color="var(--text2)" />
              <PnlCell label="Win rate" value={winRate == null ? '—' : winRate + '%'} color={winRate == null ? 'var(--text3)' : winRate >= 50 ? 'var(--green-text)' : 'var(--red-text)'} />
              <PnlCell label="Best"     value={fmtINR(paper.best_trade || 0)}  color="var(--green-text)" />
              <PnlCell label="Worst"    value={fmtINR(paper.worst_trade || 0)} color="var(--red-text)" />
            </div>
          </div>

          {/* Armed candidates */}
          {armed.length > 0 && (
            <div className="card" style={{ padding: 14, border: '1px dashed #a855f7', background: 'rgba(168,85,247,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#c084fc', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                  🎯 Armed · waiting for trigger ({armed.length})
                </div>
                <div style={{ flex: 1 }} />
                {!armedConfirmOpen ? (
                  <button className="btn btn-secondary" style={{ height: 28, fontSize: 10 }} onClick={() => setArmedConfirmOpen(true)}>
                    Cancel all
                  </button>
                ) : (
                  <>
                    <button className="btn btn-primary" style={{ height: 28, fontSize: 10, background: 'var(--red-bg)', borderColor: 'rgba(239,68,68,0.3)', color: 'var(--red-text)' }} onClick={clearArmed}>
                      Yes, cancel all
                    </button>
                    <button className="btn btn-secondary" style={{ height: 28, fontSize: 10 }} onClick={() => setArmedConfirmOpen(false)}>
                      Keep
                    </button>
                  </>
                )}
              </div>
              <TradeTable
                columns={['Sym', 'Side', 'Trigger', 'SL', 'Target', 'Qty', 'Age']}
                rows={armed.map((a) => [
                  <b key="s">{a.sym}</b>,
                  <span key="si" style={{ color: a.side === 'BUY' ? 'var(--green-text)' : 'var(--red-text)', fontWeight: 700 }}>{a.side}</span>,
                  '₹' + fmtNum(a.trigger_price),
                  <span key="sl" style={{ color: 'var(--red-text)' }}>₹{fmtNum(a.stop_loss)}</span>,
                  <span key="tg" style={{ color: 'var(--green-text)' }}>₹{fmtNum(a.target)}</span>,
                  a.quantity,
                  <span key="age" style={{ color: 'var(--text3)' }}>{(a.ageMins | 0)}m</span>,
                ])}
                rightAlignFrom={2}
              />
            </div>
          )}

          {/* Open paper trades */}
          {openTrades.length > 0 && (
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>
                📂 Open paper positions ({openTrades.length})
              </div>
              <TradeTable
                columns={['Filled', 'Sym', 'Side', 'Qty', 'Entry', 'SL', 'Tgt']}
                rows={openTrades.map((r) => [
                  fmtHM(r.filled_at),
                  <b key="s">{r.sym}</b>,
                  <span key="si" style={{ color: r.side === 'BUY' ? 'var(--green-text)' : 'var(--red-text)', fontWeight: 600 }}>{r.side}</span>,
                  r.quantity,
                  '₹' + fmtNum(r.fill_price ?? r.planned_entry),
                  <span key="sl" style={{ color: 'var(--red-text)' }}>₹{fmtNum(r.planned_stop_loss)}</span>,
                  <span key="tg" style={{ color: 'var(--green-text)' }}>₹{fmtNum(r.planned_target)}</span>,
                ])}
                rightAlignFrom={3}
              />
            </div>
          )}

          {/* Closed paper trades today */}
          {closed.length > 0 && (
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>
                🏁 Closed paper trades today ({closed.length})
              </div>
              <TradeTable
                columns={['Exit', 'Sym', 'Qty', 'Entry', 'Exit', 'Reason', 'PnL', '%']}
                rows={closed.map((r) => {
                  const pnlR = Number(r.pnl_rupees || 0);
                  const pnlP = Number(r.pnl_pct || 0);
                  const col = pnlR > 0 ? 'var(--green-text)' : pnlR < 0 ? 'var(--red-text)' : 'var(--text3)';
                  const reasonCol = r.exit_reason === 'TARGET_HIT' ? 'var(--green-text)' : r.exit_reason === 'SL_HIT' ? 'var(--red-text)' : 'var(--text3)';
                  return [
                    fmtHM(r.exit_at),
                    <b key="s">{r.sym}</b>,
                    r.quantity,
                    '₹' + fmtNum(r.fill_price ?? r.planned_entry),
                    <span key="ex" style={{ color: 'var(--text)', fontWeight: 600 }}>₹{fmtNum(r.exit_price ?? 0)}</span>,
                    <span key="rsn" style={{ fontFamily: '"SF Mono","JetBrains Mono",monospace', fontSize: 11, color: reasonCol }}>{r.exit_reason || '?'}</span>,
                    <span key="pnl" style={{ fontWeight: 700, color: col }}>{pnlR >= 0 ? '+' : ''}₹{Math.round(pnlR).toLocaleString('en-IN')}</span>,
                    <span key="pct" style={{ color: col }}>{pnlP >= 0 ? '+' : ''}{pnlP.toFixed(2)}%</span>,
                  ];
                })}
                rightAlignFrom={2}
              />
            </div>
          )}
        </>
      )}

      {/* Recent decisions */}
      {!tablesMissing && (
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>
            Recent decisions (last 20)
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5, marginBottom: 10, fontStyle: 'italic' }}>
            Decisions below originated from candidates that already passed all 5 gates (Preflight → Varsity → Book-Rules → Constraints → Management). Rejections happen earlier in the pipeline and are not listed here — see the Scan tab for intraday gate-reject counts.
          </div>
          {recent.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', border: '1px dashed var(--border)', borderRadius: 10, fontSize: 12 }}>
              No decisions yet today. Cycle runs every minute during market hours when mode ≠ off.
            </div>
          ) : (
            <TradeTable
              columns={['Time', 'Mode', 'Sym', 'Sector', 'Setup', 'Side', 'Score', 'Qty', 'Entry', 'SL', 'Tgt', 'RR', 'Result']}
              rows={recent.map((r) => [
                <span key="t" style={{ color: 'var(--text3)', fontFamily: '"SF Mono","JetBrains Mono",monospace' }}>{fmtTime(r.decided_at)}</span>,
                <ModeBadge key="mo" mode={r.agent_mode || 'off'} />,
                <b key="s">{r.sym}</b>,
                <span key="sec" style={{ color: 'var(--text3)', fontSize: 11 }}>{r.sector || '—'}</span>,
                <span key="st" style={{ color: 'var(--text2)' }}>{r.best_setup || '—'}</span>,
                <span key="si" style={{ color: r.side === 'BUY' ? 'var(--green-text)' : r.side === 'SELL' ? 'var(--red-text)' : 'var(--text3)', fontWeight: 600, fontSize: 11 }}>{r.side || '—'}</span>,
                <span key="sc" style={{ color: 'var(--text2)' }}>{r.day_trade_score ?? '—'}</span>,
                r.quantity ?? '—',
                r.entry_price ?? '—',
                <span key="sl" style={{ color: 'var(--red-text)' }}>{r.stop_loss ?? '—'}</span>,
                <span key="tg" style={{ color: 'var(--green-text)' }}>{r.target ?? '—'}</span>,
                r.rr_ratio ?? '—',
                r.approved
                  ? <span key="res" style={{ color: 'var(--green-text)', fontWeight: 700 }}>APPROVED</span>
                  : <span key="res" title={r.rejection_detail || ''} style={{ color: 'var(--red-text)', fontFamily: '"SF Mono","JetBrains Mono",monospace', fontSize: 11 }}>
                      {r.failed_filter || r.rejection_reason || '?'}
                    </span>,
              ])}
              rightAlignFrom={6}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-schedule bar
// ─────────────────────────────────────────────────────────────────────────────
function AutoScheduleBar({ schedule, onChange }) {
  const a = schedule || { enabled: false, targetMode: 'paper', validTargets: ['paper'] };
  const targetColor = (MODE_COLORS[a.targetMode] || MODE_COLORS.paper).c;

  // Tri-state: "what will happen next"
  const nowUtc = new Date();
  const ist = new Date(nowUtc.getTime() + 330 * 60000);
  const istMinsSinceOpen = (ist.getUTCHours() - 9) * 60 + ist.getUTCMinutes() - 15;
  const isMarketHours = istMinsSinceOpen >= 0 && istMinsSinceOpen <= 375 && ist.getUTCDay() >= 1 && ist.getUTCDay() <= 5;
  const nextLabel = a.enabled
    ? (isMarketHours ? 'Will auto-stop at 15:30 IST' : 'Will auto-start next trading day at 9:15 IST')
    : 'Disabled — use the mode buttons above to run manually';

  return (
    <div className="card" style={{
      padding: '12px 16px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap',
      border: a.enabled ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border)',
      background: a.enabled ? 'rgba(34,197,94,0.04)' : 'transparent',
    }}>
      <button
        onClick={() => onChange(!a.enabled, a.targetMode)}
        style={{
          padding: '8px 14px', borderRadius: 8, fontWeight: 800, fontSize: 12, letterSpacing: 0.6, cursor: 'pointer',
          border: `2px solid ${a.enabled ? '#22c55e' : 'var(--text3)'}`,
          background: a.enabled ? 'rgba(34,197,94,0.15)' : 'transparent',
          color: a.enabled ? '#4ade80' : 'var(--text3)',
        }}
      >
        {a.enabled ? '● AUTO · ON' : '○ AUTO · OFF'}
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>Auto-start at 9:15 IST, auto-stop at 15:30 IST</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{nextLabel}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text3)', marginRight: 6, letterSpacing: 0.4, textTransform: 'uppercase' }}>Target</span>
        {(Array.isArray(a.validTargets) ? a.validTargets : ['paper']).map((t) => {
          const sel = a.targetMode === t;
          const col = (MODE_COLORS[t] || MODE_COLORS.paper).c;
          return (
            <button
              key={t}
              onClick={() => onChange(a.enabled, t)}
              style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${sel ? col : 'var(--border)'}`,
                background: sel ? col + '22' : 'transparent',
                color: sel ? col : 'var(--text3)',
                marginRight: 4,
              }}
            >
              {t.toUpperCase()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small building blocks
// ─────────────────────────────────────────────────────────────────────────────
function HealthChip({ on, label }) {
  const onCol = '#22c55e';
  const offCol = 'var(--text4, var(--text3))';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10, padding: '3px 9px', borderRadius: 9999,
      background: on ? 'rgba(34,197,94,0.10)' : 'var(--bg2)',
      color: on ? '#4ade80' : 'var(--text3)',
      border: `1px solid ${on ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
      letterSpacing: 0.3, fontWeight: 600,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: 9999,
        background: on ? onCol : offCol, display: 'inline-block',
      }} />
      {label}
    </span>
  );
}

function StatCard({ label, value, color = 'var(--text)', accent = 'var(--border)', bg = 'rgba(255,255,255,0.02)' }) {
  return (
    <div style={{
      padding: 16, border: `1px solid ${accent}`, borderRadius: 12, background: bg,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div className="tabular-nums" style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color }}>{value}</div>
    </div>
  );
}

function PnlCell({ label, value, color = 'var(--text)' }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 800, marginTop: 3, color }}>{value}</div>
    </div>
  );
}

function TradeTable({ columns, rows, rightAlignFrom = 99 }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--text3)', fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
            {columns.map((c, i) => (
              <th key={i} style={{ padding: '8px 10px', textAlign: i >= rightAlignFrom ? 'right' : 'left', fontWeight: 700 }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              {row.map((cell, ci) => (
                <td key={ci} className="tabular-nums" style={{ padding: '7px 10px', textAlign: ci >= rightAlignFrom ? 'right' : 'left' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
