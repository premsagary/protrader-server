import React, { useEffect, useState, useRef } from 'react';
import { apiGet, apiPost } from '../../api/client';

// ══════════════════════════════════════════════════════════════════════
// Pipeline sync buttons — core data refresh endpoints
// ══════════════════════════════════════════════════════════════════════
const PIPELINE = [
  { key: 'universe',     label: 'Stock Universe',     endpoint: '/api/universe/refresh',     color: 'var(--brand-text)'  },
  { key: 'fundamentals', label: 'Fundamentals',       endpoint: '/api/fundamentals/refresh', color: 'var(--amber-text)'  },
  { key: 'scoring',      label: 'Scoring Engine',     endpoint: '/api/stocks/rescore',       color: 'var(--green-text)'  },
  { key: 'mf',           label: 'MF Recommendations', endpoint: '/api/mf/rebuild-cache',     color: 'var(--purple-text)' },
];

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
  const [msg, setMsg] = useState('');
  const [refreshMsg, setRefreshMsg] = useState('');
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [unifiedRunning, setUnifiedRunning] = useState(false);
  const [unifiedOutput, setUnifiedOutput] = useState('');
  const [llmBudget, setLlmBudget] = useState(null);
  const [uploadMsg, setUploadMsg] = useState('');
  const [forceRefreshMsg, setForceRefreshMsg] = useState('');
  const [logPaused, setLogPaused] = useState(false);
  const logRef = useRef(null);
  const screenerFileRef = useRef(null);
  const tickertapeFilesRef = useRef(null);

  // ── LIVE / PAPER toggle state ──────────────────────────────────────
  const [tradingMode, setTradingMode] = useState(null);      // { live, mode, kiteConnected, accountEquity, configuredCapital, riskPerTrade, maxPositions }
  const [showLiveModal, setShowLiveModal] = useState(false); // confirmation overlay
  const [confirmLiveText, setConfirmLiveText] = useState('');// user types "LIVE"
  const [preflight, setPreflight] = useState(null);          // /api/egress-ip snapshot when modal opens
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [newCapital, setNewCapital] = useState('');          // capital edit input
  const [toggleBusy, setToggleBusy] = useState(false);
  const [toggleMsg, setToggleMsg] = useState('');
  // ── Test-buy (smoke test) state ────────────────────────────────────
  // Fires a REAL 1-share order via POST /api/test-buy. Used Monday
  // mornings to verify the SEBI static-IP proxy + Kite auth end-to-end
  // before letting RoboTrade run. Defaults to YESBANK (cheap, liquid).
  const [testBuySymbol, setTestBuySymbol] = useState('YESBANK');
  const [testBuyQty, setTestBuyQty] = useState(1);
  const [testBuyBusy, setTestBuyBusy] = useState(false);
  const [testBuyMsg, setTestBuyMsg] = useState('');
  // ── 🚀 v2.0 Wave 13 — V2 Control Panel state ──
  // Polls /api/admin/v2/status every 30s for system-wide v2 regime view.
  // Polls /api/admin/setup-sqn separately because it's heavier (DB query
  // over closed trades). Both are admin-gated; failures swallowed silently.
  const [v2Status, setV2Status] = useState(null);   // { v2SetupsMode, premarket, trendDay, initialBalance, tierCounts, watchlist }
  const [v2Sqn, setV2Sqn]       = useState(null);   // { results: [{setup, sqn, tier, ...}], legend }
  const [v2BusyTier, setV2BusyTier] = useState(false);
  const [v2BusyWl, setV2BusyWl]     = useState(false);
  const [v2OpsMsg, setV2OpsMsg]     = useState('');

  useEffect(() => {
    apiGet('/api/admin/users').then((d) => setUsers(Array.isArray(d?.users) ? d.users : Array.isArray(d) ? d : [])).catch(() => {});
    const pollLogs = () => {
      if (logPaused) return;
      apiGet('/api/admin/logs').then((d) => {
        // Server may return { logs: [...] } or { lines: [...] } or raw array — be defensive
        const arr = Array.isArray(d?.logs) ? d.logs
                  : Array.isArray(d?.lines) ? d.lines
                  : Array.isArray(d) ? d : [];
        setLogs(arr);
      }).catch(() => {});
    };
    pollLogs();
    const id = setInterval(pollLogs, 5000);

    // Pipeline status poll (uptime + last run timestamps)
    const pollStatus = () => {
      apiGet('/api/admin/pipeline-status').then(setPipelineStatus).catch(() => {});
      apiGet('/api/admin/llm-budget').then(setLlmBudget).catch(() => {});
      apiGet('/api/trading-mode').then(setTradingMode).catch(() => {});
      // 🚀 v2.0 Wave 13 — v2 systemic state
      apiGet('/api/admin/v2/status').then(setV2Status).catch(() => {});
      apiGet('/api/admin/setup-sqn?window=30&minTrades=5').then(setV2Sqn).catch(() => {});
    };
    pollStatus();
    const id2 = setInterval(pollStatus, 30000);

    return () => { clearInterval(id); clearInterval(id2); };
  }, [logPaused]);

  // ── Trading mode handlers ──────────────────────────────────────────
  const openLiveModal = async () => {
    setToggleMsg('');
    setConfirmLiveText('');
    setShowLiveModal(true);
    setPreflightLoading(true);
    try {
      const ip = await apiGet('/api/egress-ip');
      setPreflight(ip);
    } catch (e) {
      setPreflight({ error: e.message });
    }
    setPreflightLoading(false);
  };
  const handleEnableLive = async () => {
    if (confirmLiveText !== 'LIVE') return;
    setToggleBusy(true);
    try {
      const res = await apiPost('/api/trading-mode', { live: true });
      setTradingMode(res);
      setToggleMsg('🔴 LIVE trading enabled — real orders will fire');
      setShowLiveModal(false);
      setConfirmLiveText('');
    } catch (e) {
      setToggleMsg(`Error: ${e.message}`);
    }
    setToggleBusy(false);
    setTimeout(() => setToggleMsg(''), 6000);
  };
  const handleSwitchToPaper = async () => {
    if (!window.confirm('Switch back to PAPER trading? Open LIVE positions will stay open in Kite — this only stops NEW real orders.')) return;
    setToggleBusy(true);
    try {
      const res = await apiPost('/api/trading-mode', { live: false });
      setTradingMode(res);
      setToggleMsg('📝 Switched to PAPER — no new real orders will fire');
    } catch (e) {
      setToggleMsg(`Error: ${e.message}`);
    }
    setToggleBusy(false);
    setTimeout(() => setToggleMsg(''), 5000);
  };
  const handleSaveCapital = async () => {
    const amount = parseFloat(newCapital);
    if (!(amount > 0)) { setToggleMsg('Enter a valid capital amount'); setTimeout(() => setToggleMsg(''), 3000); return; }
    setToggleBusy(true);
    try {
      const res = await apiPost('/api/trading-mode', { capital: amount });
      setTradingMode(res);
      setNewCapital('');
      setToggleMsg(`💰 Capital set to ₹${amount.toLocaleString()}`);
    } catch (e) {
      setToggleMsg(`Error: ${e.message}`);
    }
    setToggleBusy(false);
    setTimeout(() => setToggleMsg(''), 4000);
  };

  // ── Test-buy handler ───────────────────────────────────────────────
  // Calls POST /api/test-buy which places a REAL limit order via the
  // static-IP proxy. Use ONLY for pre-market smoke-testing the Kite
  // auth + SEBI proxy path. Respects the existing backend default
  // (YESBANK, qty 1) but exposes both fields so we can point it at a
  // different cheap liquid symbol if YESBANK circuit-limits.
  const handleTestBuy = async () => {
    const symbol = (testBuySymbol || 'YESBANK').toUpperCase().trim();
    const qty = Math.max(1, parseInt(testBuyQty, 10) || 1);
    const warn =
      `⚠️  This will place a REAL LIMIT order on Kite:\n\n` +
      `    ${qty} × ${symbol}   (≈ ₹${qty * 25} at current LTP for YESBANK)\n\n` +
      `Routed via the static-IP proxy (68.183.90.72).\n` +
      `Make sure Kite is LOGGED IN and market is open.\n\n` +
      `Continue?`;
    if (!window.confirm(warn)) return;
    setTestBuyBusy(true);
    setTestBuyMsg(`Placing ${qty}× ${symbol}…`);
    try {
      const res = await apiPost('/api/test-buy', { symbol, quantity: qty });
      if (res && res.success) {
        // "Placed" not "Filled" — /api/test-buy returns as soon as Kite accepts
        // the order; it does NOT wait for the fill confirmation. Check
        // /live-trades or Kite dashboard to see actual fill status.
        setTestBuyMsg(
          `✅ Placed ${res.quantity || qty}× ${res.symbol || symbol} ` +
          `@ ₹${res.price ?? '?'}  ·  orderId=${res.orderId || '—'}`
        );
      } else {
        setTestBuyMsg(`❌ ${(res && (res.error || res.message)) || 'Order rejected'}`);
      }
    } catch (e) {
      setTestBuyMsg(`❌ Error: ${e.message}`);
    }
    setTestBuyBusy(false);
    setTimeout(() => setTestBuyMsg(''), 10000);
  };

  useEffect(() => {
    if (!logPaused && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs, logPaused]);

  const handleRefresh = async (ep) => {
    setRefreshMsg('Running…');
    try {
      await apiPost(ep);
      setRefreshMsg('Done');
    } catch (e) { setRefreshMsg(`Error: ${e.message}`); }
    setTimeout(() => setRefreshMsg(''), 3000);
  };

  // ── Force-run Unified Kite Pipeline ────────────────────────────────
  // Critical admin action. Bypasses market-hours check (force=true).
  // User hits this after every Kite token refresh to verify auth works.
  const handleUnifiedPipeline = async () => {
    if (unifiedRunning) return;
    setUnifiedRunning(true);
    setUnifiedOutput('Starting unified pipeline… this takes 3-5 min for 568 symbols');
    try {
      const res = await apiPost('/api/admin/unified-pipeline', { force: true });
      setUnifiedOutput(
        `✅ Complete in ${res.elapsedSec || '?'}s · ` +
        `stockFundamentals=${res.stockFundamentals || res.scoredCount || '?'} · ` +
        `DayTrade cache=${res.dayTradeCache || '?'} · ` +
        `last: ${res.status || 'completed'}`
      );
    } catch (e) {
      setUnifiedOutput(`❌ Error: ${e.message}`);
    } finally {
      setUnifiedRunning(false);
    }
  };

  // ── Force Refresh All caches ────────────────────────────────────────
  const handleForceRefreshAll = async () => {
    setForceRefreshMsg('Clearing all caches…');
    try {
      const res = await apiPost('/api/admin/force-refresh');
      setForceRefreshMsg(`✓ ${res.message || 'Done'}`);
    } catch (e) { setForceRefreshMsg(`Error: ${e.message}`); }
    setTimeout(() => setForceRefreshMsg(''), 4000);
  };

  // 🚀 v2.0 Wave 13 — V2 manual operations
  const handleV2RefreshTiers = async () => {
    setV2BusyTier(true); setV2OpsMsg('');
    try {
      const r = await apiPost('/api/admin/v2/tiers/refresh');
      setV2OpsMsg(`✓ Tiers refreshed: A=${r?.result?.aCount ?? '?'} B=${r?.result?.bCount ?? '?'} SKIP=${r?.result?.skipCount ?? '?'}`);
      apiGet('/api/admin/v2/status').then(setV2Status).catch(() => {});
    } catch (e) { setV2OpsMsg(`❌ ${e.message}`); }
    setV2BusyTier(false);
    setTimeout(() => setV2OpsMsg(''), 5000);
  };
  const handleV2RefreshWatchlist = async () => {
    setV2BusyWl(true); setV2OpsMsg('');
    try {
      const r = await apiPost('/api/admin/v2/watchlist/refresh');
      setV2OpsMsg(`✓ Watchlist rebuilt: ${(r?.watchlist || []).length} symbols`);
      apiGet('/api/admin/v2/status').then(setV2Status).catch(() => {});
    } catch (e) { setV2OpsMsg(`❌ ${e.message}`); }
    setV2BusyWl(false);
    setTimeout(() => setV2OpsMsg(''), 5000);
  };

  // ── Screener CSV upload (single file) ───────────────────────────────
  const handleScreenerUpload = async () => {
    const file = screenerFileRef.current?.files?.[0];
    if (!file) { setUploadMsg('Pick a CSV file first'); return; }
    setUploadMsg(`Uploading ${file.name}…`);
    try {
      const text = await file.text();
      const res = await apiPost('/api/admin/screener-csv', { filename: file.name, text });
      setUploadMsg(`✓ Imported ${res.imported || '?'} rows from ${file.name}`);
      if (screenerFileRef.current) screenerFileRef.current.value = '';
    } catch (e) {
      setUploadMsg(`❌ ${e.message}`);
    }
    setTimeout(() => setUploadMsg(''), 6000);
  };

  // ── Tickertape MF CSV multi-file upload ─────────────────────────────
  // Old app.html supported dropping all 6 Tickertape facet CSVs at once.
  // Server detects each facet, joins on (Name, Sub Category, Plan),
  // TRUNCATEs + bulk-INSERTs into mf_tickertape, rebuilds scored cache.
  const handleTickertapeUpload = async () => {
    const files = tickertapeFilesRef.current?.files;
    if (!files || !files.length) { setUploadMsg('Pick Tickertape CSV files first'); return; }
    setUploadMsg(`Uploading ${files.length} file(s)…`);
    try {
      const payload = [];
      for (const f of files) payload.push({ name: f.name, text: await f.text() });
      const res = await apiPost('/api/mf/import', { files: payload });
      setUploadMsg(`✓ Imported ${res.imported || '?'} MF rows · ${res.skipped || 0} skipped`);
      if (tickertapeFilesRef.current) tickertapeFilesRef.current.value = '';
    } catch (e) {
      setUploadMsg(`❌ ${e.message}`);
    }
    setTimeout(() => setUploadMsg(''), 8000);
  };

  // ── Screener scrape trigger (for stocks missing fundamentals) ───────
  const handleScreenerScrape = async () => {
    setUploadMsg('Starting Screener scrape…');
    try {
      const res = await apiPost('/api/admin/screener-scrape');
      setUploadMsg(`✓ ${res.message || 'Scrape started'}`);
    } catch (e) {
      setUploadMsg(`❌ ${e.message}`);
    }
    setTimeout(() => setUploadMsg(''), 5000);
  };

  // ── External signals admin (news/BSE/analyst cron manual trigger) ──
  const handleExternalSignals = async () => {
    setUploadMsg('Refreshing external signals (news + BSE + analyst)…');
    try {
      await apiPost('/api/admin/refresh-external-signals');
      setUploadMsg('✓ External signals refresh queued');
    } catch (e) { setUploadMsg(`❌ ${e.message}`); }
    setTimeout(() => setUploadMsg(''), 5000);
  };

  // ── Stale-data healthcheck (debug helper) ───────────────────────────
  const handleStaleHealthcheck = async () => {
    setUploadMsg('Running stale-data healthcheck…');
    try {
      await apiPost('/api/admin/stale-healthcheck');
      setUploadMsg('✓ Stale healthcheck ran');
    } catch (e) { setUploadMsg(`❌ ${e.message}`); }
    setTimeout(() => setUploadMsg(''), 5000);
  };

  // ── User management ────────────────────────────────────────────────
  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password) return;
    try {
      await apiPost('/api/admin/users', newUser);
      setMsg('Created'); setNewUser({ username: '', password: '', role: 'user' });
      apiGet('/api/admin/users').then((d) => setUsers(d.users || d || []));
    } catch (e) { setMsg(`Error: ${e.message}`); }
    setTimeout(() => setMsg(''), 3000);
  };

  const handleDeleteUser = async (username) => {
    if (!confirm(`Delete user "${username}"?`)) return;
    try {
      await apiPost(`/api/admin/users/${encodeURIComponent(username)}/delete`);
      apiGet('/api/admin/users').then((d) => setUsers(d.users || d || []));
    } catch (e) { setMsg(`Error: ${e.message}`); }
  };

  const handleResetPassword = async (username) => {
    const newPw = prompt(`Reset password for "${username}". Enter new password:`);
    if (!newPw) return;
    try {
      await apiPost(`/api/admin/users/${encodeURIComponent(username)}/reset-password`, { password: newPw });
      setMsg('Password reset');
    } catch (e) { setMsg(`Error: ${e.message}`); }
    setTimeout(() => setMsg(''), 3000);
  };

  const clearLogs = () => setLogs([]);
  const scrollToBottom = () => {
    setLogPaused(false);
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 50);
  };

  const uptimeStr = pipelineStatus?.uptimeMs
    ? formatDuration(pipelineStatus.uptimeMs)
    : '—';

  return (
    <div>
      {/* ═══ HERO ═══ */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(167,139,250,0.10) 100%)',
        border: '1px solid var(--border)', borderRadius: 18, padding: '28px 32px', marginBottom: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="label-xs" style={{ marginBottom: 8 }}>Admin · Pipeline · Monitoring · Data Ingestion</div>
            <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', color: 'var(--text)' }}>
              <span className="gradient-fill">ProTrader Admin</span>
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="chip" style={{ background: 'var(--green-bg)', color: 'var(--green-text)', border: '1px solid rgba(52,211,153,0.3)' }}>
              Uptime: {uptimeStr}
            </div>
            <button
              onClick={handleForceRefreshAll}
              className="btn btn-secondary"
              style={{ height: 36, fontSize: 12, padding: '0 14px', color: 'var(--red-text)', borderColor: 'rgba(248,113,113,0.35)' }}
            >
              ↻ Force Refresh All
            </button>
          </div>
        </div>
        {forceRefreshMsg && (
          <div style={{ marginTop: 12, fontSize: 13, color: forceRefreshMsg.startsWith('Error') ? 'var(--red-text)' : 'var(--green-text)' }}>
            {forceRefreshMsg}
          </div>
        )}
      </div>

      {/* ═══ PAPER ↔ LIVE TRADING MODE — master kill-switch ═══ */}
      <div
        className="card"
        style={{
          padding: 0,
          marginBottom: 20,
          overflow: 'hidden',
          border: tradingMode?.live ? '2px solid rgba(248,113,113,0.55)' : '1px solid var(--border)',
          boxShadow: tradingMode?.live
            ? '0 0 40px rgba(248,113,113,0.18), 0 10px 30px rgba(0,0,0,0.35)'
            : '0 8px 22px rgba(0,0,0,0.22)',
          transition: 'box-shadow 300ms ease, border-color 300ms ease',
        }}
      >
        <div style={{
          background: tradingMode?.live
            ? 'linear-gradient(135deg, rgba(248,113,113,0.22), rgba(239,68,68,0.14))'
            : 'linear-gradient(135deg, rgba(99,102,241,0.16), rgba(52,211,153,0.08))',
          padding: '22px 26px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:18, flexWrap:'wrap' }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                <span style={{ fontSize:18 }}>{tradingMode?.live ? '🔴' : '📝'}</span>
                <h2 style={{ fontSize:17, fontWeight:800, color:'var(--text)', letterSpacing:'-0.2px' }}>
                  Trading Mode
                </h2>
                <span className="chip" style={{
                  background: tradingMode?.live ? 'var(--red-bg)' : 'var(--brand-bg)',
                  color:      tradingMode?.live ? 'var(--red-text)' : 'var(--brand-text)',
                  border: '1px solid ' + (tradingMode?.live ? 'rgba(248,113,113,0.45)' : 'rgba(99,102,241,0.35)'),
                  fontWeight: 800, letterSpacing: '1px', fontSize: 11,
                }}>
                  {tradingMode ? (tradingMode.live ? '● LIVE · REAL MONEY' : '● PAPER · SIMULATED') : '…'}
                </span>
              </div>
              <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.5, maxWidth:640 }}>
                {tradingMode?.live
                  ? 'RoboTrade is placing REAL ORDERS on Kite. Scans run every 5 min during market hours.'
                  : 'RoboTrade is in PAPER mode — trades are simulated, no real orders fire. Scans still run.'}
              </p>
              <div style={{ display:'flex', gap:16, marginTop:10, flexWrap:'wrap', fontSize:11.5, color:'var(--text3)' }}>
                <span>Kite: <b style={{ color: tradingMode?.kiteConnected ? 'var(--green-text)' : 'var(--red-text)' }}>{tradingMode?.kiteConnected ? 'connected' : 'not connected'}</b></span>
                <span>Capital: <b style={{ color:'var(--text)' }}>₹{(tradingMode?.configuredCapital || 0).toLocaleString('en-IN')}</b></span>
                {tradingMode?.accountEquity != null && Math.abs((tradingMode.accountEquity||0) - (tradingMode.configuredCapital||0)) > 1 && (
                  <span>Live equity: <b style={{ color:'var(--text)' }}>₹{Math.round(tradingMode.accountEquity).toLocaleString('en-IN')}</b></span>
                )}
                <span>Risk/trade: <b style={{ color:'var(--text)' }}>{tradingMode?.riskPerTrade || '—'}</b></span>
                <span>Max positions: <b style={{ color:'var(--text)' }}>{tradingMode?.maxPositions ?? '—'}</b></span>
              </div>
            </div>
            {tradingMode?.live ? (
              <button
                onClick={handleSwitchToPaper}
                disabled={toggleBusy}
                className="btn btn-secondary"
                style={{ height:48, fontSize:14, fontWeight:700, padding:'0 22px', opacity: toggleBusy ? 0.7 : 1 }}
              >
                {toggleBusy ? '…' : '◼ Switch to PAPER'}
              </button>
            ) : (
              <button
                onClick={openLiveModal}
                disabled={toggleBusy || !tradingMode?.kiteConnected}
                className="btn btn-primary"
                style={{
                  height:48, fontSize:14, fontWeight:800, padding:'0 26px',
                  background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                  border: '1px solid rgba(248,113,113,0.5)',
                  opacity: toggleBusy || !tradingMode?.kiteConnected ? 0.55 : 1,
                  cursor: toggleBusy || !tradingMode?.kiteConnected ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.5px',
                }}
                title={!tradingMode?.kiteConnected ? 'Login to Kite first' : 'Enable LIVE trading'}
              >
                ● ENABLE LIVE
              </button>
            )}
          </div>
        </div>

        {/* Capital editor — always visible, takes effect immediately */}
        <div style={{ padding:'16px 26px', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
          <div style={{ fontSize:12, color:'var(--text2)', fontWeight:600 }}>Adjust capital (applies immediately to position sizing):</div>
          <input
            type="number"
            min="1"
            step="1000"
            placeholder={`₹${(tradingMode?.configuredCapital||0).toLocaleString('en-IN')}`}
            value={newCapital}
            onChange={e => setNewCapital(e.target.value)}
            style={{
              height:34, width:150, padding:'0 12px', borderRadius:8,
              border:'1px solid var(--border)', background:'var(--bg-elev)', color:'var(--text)',
              fontSize:13, fontFamily:'inherit',
            }}
          />
          <button
            onClick={handleSaveCapital}
            disabled={toggleBusy || !newCapital}
            className="btn btn-secondary"
            style={{ height:34, fontSize:12, padding:'0 14px' }}
          >
            Save
          </button>
          {toggleMsg && (
            <div style={{
              marginLeft:'auto', fontSize:12.5,
              color: toggleMsg.startsWith('Error') ? 'var(--red-text)' : 'var(--green-text)',
              fontWeight:600,
            }}>
              {toggleMsg}
            </div>
          )}
        </div>

        {/* ── Test-buy (smoke test) ─────────────────────────────────
            Places a REAL 1-share limit order on Kite via the static-IP
            proxy. Use before market open to verify auth + proxy are
            alive. Amber styling signals "real money, small risk". */}
        <div style={{
          padding:'14px 26px 18px',
          borderTop:'1px dashed var(--border)',
          display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))',
        }}>
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            <div style={{ fontSize:12, color:'var(--amber-text)', fontWeight:700, letterSpacing:'0.3px' }}>
              🧪 Kite smoke test
            </div>
            <div style={{ fontSize:11, color:'var(--text3)' }}>
              Places a REAL limit order via the SEBI static-IP proxy.
            </div>
          </div>
          <input
            type="text"
            value={testBuySymbol}
            onChange={e => setTestBuySymbol(e.target.value)}
            placeholder="YESBANK"
            style={{
              height:34, width:120, padding:'0 12px', borderRadius:8,
              border:'1px solid var(--border)', background:'var(--bg-elev)', color:'var(--text)',
              fontSize:13, fontFamily:'inherit', textTransform:'uppercase',
            }}
            title="NSE trading symbol"
          />
          <input
            type="number"
            min="1"
            step="1"
            value={testBuyQty}
            onChange={e => setTestBuyQty(e.target.value)}
            style={{
              height:34, width:70, padding:'0 10px', borderRadius:8,
              border:'1px solid var(--border)', background:'var(--bg-elev)', color:'var(--text)',
              fontSize:13, fontFamily:'inherit',
            }}
            title="Quantity (default 1)"
          />
          <button
            onClick={handleTestBuy}
            disabled={testBuyBusy || !tradingMode?.kiteConnected}
            className="btn"
            style={{
              height:34, fontSize:12.5, fontWeight:700, padding:'0 16px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color:'#1a1207',
              border:'1px solid rgba(245,158,11,0.55)',
              borderRadius:8,
              opacity: testBuyBusy || !tradingMode?.kiteConnected ? 0.55 : 1,
              cursor:  testBuyBusy || !tradingMode?.kiteConnected ? 'not-allowed' : 'pointer',
            }}
            title={!tradingMode?.kiteConnected ? 'Login to Kite first' : 'Place 1-share test order'}
          >
            {testBuyBusy ? '…' : '🧪 Test Buy'}
          </button>
          {testBuyMsg && (
            <div style={{
              marginLeft:'auto', fontSize:12.5, maxWidth:520, textAlign:'right',
              color: testBuyMsg.startsWith('❌') ? 'var(--red-text)'
                   : testBuyMsg.startsWith('✅') ? 'var(--green-text)'
                   : 'var(--text2)',
              fontWeight:600,
            }}>
              {testBuyMsg}
            </div>
          )}
        </div>
      </div>

      {/* ═══ 🚀 V2.0 STRATEGY CONTROL PANEL — Wave 13 ═══ */}
      <V2ControlPanel
        v2Status={v2Status}
        v2Sqn={v2Sqn}
        v2BusyTier={v2BusyTier}
        v2BusyWl={v2BusyWl}
        v2OpsMsg={v2OpsMsg}
        onRefreshTiers={handleV2RefreshTiers}
        onRefreshWatchlist={handleV2RefreshWatchlist}
      />

      {/* ═══ FORCE-RUN UNIFIED PIPELINE — big prominent card ═══ */}
      <div className="card card-premium" style={{ padding: 0, marginBottom: 20, overflow: 'hidden' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(167,139,250,0.14))',
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>🚀</span>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.2px' }}>
                  Force-run Unified Kite Pipeline
                </h2>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, maxWidth: 640 }}>
                Fetches fresh daily + 5-min candles from Kite and rescores all 568 stocks (RSI, MACD, VWAP, DMAs, ADX, DayTrade setups).
                Bypasses the market-hours gate — useful for verifying Kite re-auth worked or warming the cache before market open.
              </p>
              <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
                Expected runtime: 3-5 minutes for full universe. Safe to run anytime.
              </p>
            </div>
            <button
              onClick={handleUnifiedPipeline}
              disabled={unifiedRunning}
              className="btn btn-primary"
              style={{
                height: 48, fontSize: 14, fontWeight: 700, padding: '0 28px',
                opacity: unifiedRunning ? 0.7 : 1,
                cursor: unifiedRunning ? 'not-allowed' : 'pointer',
              }}
            >
              {unifiedRunning ? '⏳ Running…' : '▶ RUN NOW'}
            </button>
          </div>
        </div>
        {unifiedOutput && (
          <div style={{ padding: '14px 24px', fontSize: 13, color: unifiedOutput.startsWith('❌') ? 'var(--red-text)' : 'var(--green-text)', fontFamily: 'inherit', background: 'rgba(0,0,0,0.2)' }}>
            {unifiedOutput}
          </div>
        )}
      </div>

      {/* ═══ PIPELINE SYNC + LLM BUDGET STATUS ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 20 }}>
        {PIPELINE.map((p) => (
          <div key={p.key} className="card" style={{ padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: p.color }}>{p.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>Manual sync</div>
            </div>
            <button onClick={() => handleRefresh(p.endpoint)} className="btn btn-secondary" style={{ height: 30, fontSize: 12, padding: '0 12px' }}>
              Sync
            </button>
          </div>
        ))}
        {llmBudget && (
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-text)' }}>LLM Budget</div>
              <div className={`chip ${llmBudget.cap_hit ? 'chip-red' : 'chip-green'}`} style={{ height: 18, fontSize: 9 }}>
                {llmBudget.cap_hit ? 'CAP HIT' : 'OK'}
              </div>
            </div>
            <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
              ${(llmBudget.spent_usd || 0).toFixed(3)} / ${llmBudget.budget_usd || 1}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
              {llmBudget.classified || 0} classified · {llmBudget.fallbacks || 0} fallbacks
            </div>
          </div>
        )}
      </div>
      {refreshMsg && (
        <div style={{ fontSize: 13, color: refreshMsg.startsWith('Error') ? 'var(--red-text)' : 'var(--brand-text)', marginBottom: 16 }}>
          {refreshMsg}
        </div>
      )}

      {/* ═══ DATA INGESTION — CSV uploads + scrape triggers ═══ */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Data Ingestion</h2>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 18 }}>
          Refresh fundamentals + MF data via CSV upload or on-demand scrape. Cache clears automatically on import.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {/* Screener CSV */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber-text)', marginBottom: 4 }}>📊 Screener Fundamentals</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>
              Single CSV from Screener.in. Replaces the screener_fundamentals table.
            </div>
            <input
              ref={screenerFileRef}
              type="file"
              accept=".csv"
              style={{
                width: '100%', height: 34, padding: '0 10px',
                background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border2)', borderRadius: 8,
                color: 'var(--text2)', fontSize: 12, fontFamily: 'inherit', marginBottom: 10,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleScreenerUpload} className="btn btn-primary" style={{ height: 32, fontSize: 12, padding: '0 14px', flex: 1 }}>
                Upload CSV
              </button>
              <button onClick={handleScreenerScrape} className="btn btn-secondary" style={{ height: 32, fontSize: 12, padding: '0 12px' }}>
                🕷 Apify Scrape
              </button>
            </div>
          </div>

          {/* Tickertape MF CSVs */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--purple-text)', marginBottom: 4 }}>📤 Tickertape MF CSVs</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>
              Drop all 6 facet CSVs. Auto-detect + join on (Name, SubCat, Plan) → mf_tickertape.
            </div>
            <input
              ref={tickertapeFilesRef}
              type="file"
              accept=".csv"
              multiple
              style={{
                width: '100%', height: 34, padding: '0 10px',
                background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border2)', borderRadius: 8,
                color: 'var(--text2)', fontSize: 12, fontFamily: 'inherit', marginBottom: 10,
              }}
            />
            <button onClick={handleTickertapeUpload} className="btn btn-primary" style={{ height: 32, fontSize: 12, padding: '0 14px', width: '100%' }}>
              Upload MF CSVs
            </button>
          </div>

          {/* External signals manual triggers */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-text)', marginBottom: 4 }}>🛰 External Signals</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>
              Manual trigger for news + BSE + analyst scrape. Normally runs on cron.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={handleExternalSignals} className="btn btn-secondary" style={{ height: 32, fontSize: 12 }}>
                Refresh All Signals
              </button>
              <button onClick={handleStaleHealthcheck} className="btn btn-secondary" style={{ height: 32, fontSize: 12 }}>
                Stale-Data Healthcheck
              </button>
            </div>
          </div>
        </div>
        {uploadMsg && (
          <div style={{ marginTop: 14, fontSize: 13, color: uploadMsg.startsWith('❌') ? 'var(--red-text)' : 'var(--green-text)' }}>
            {uploadMsg}
          </div>
        )}
      </div>

      {/* ═══ USER MANAGEMENT ═══ */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>User Management</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <input placeholder="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            style={{ height: 38, padding: '0 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: 160 }}
          />
          <input placeholder="Password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            style={{ height: 38, padding: '0 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: 160 }}
          />
          <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            style={{ height: 38, padding: '0 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={handleAddUser} className="btn btn-primary" style={{ height: 38, fontSize: 13 }}>+ Add User</button>
          {msg && <span style={{ fontSize: 13, color: msg.startsWith('E') ? 'var(--red-text)' : 'var(--green-text)' }}>{msg}</span>}
        </div>
        {users.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>{['Username', 'Role', 'Created', 'Last Login', ''].map((h, i) => (
                <th key={i} style={{ padding: '10px 14px', textAlign: i === 4 ? 'right' : 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{u.username}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span className="chip" style={{
                      height: 20, fontSize: 10, fontWeight: 700,
                      color: u.role === 'admin' ? 'var(--amber-text)' : 'var(--brand-text)',
                      background: u.role === 'admin' ? 'var(--amber-bg)' : 'var(--brand-bg)',
                      border: `1px solid ${u.role === 'admin' ? 'rgba(251,191,36,0.3)' : 'rgba(99,102,241,0.3)'}`,
                    }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{u.last_login ? new Date(u.last_login).toLocaleString() : '—'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleResetPassword(u.username)}
                      className="btn btn-secondary"
                      style={{ height: 26, fontSize: 11, padding: '0 10px', marginRight: 6 }}
                    >
                      Reset PW
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u.username)}
                      className="btn btn-secondary"
                      style={{ height: 26, fontSize: 11, padding: '0 10px', color: 'var(--red-text)', borderColor: 'rgba(248,113,113,0.3)' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ═══ LIVE LOGS ═══ */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Live Server Logs</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="chip chip-brand" style={{ gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: logPaused ? 'var(--amber)' : 'var(--green)', boxShadow: `0 0 6px ${logPaused ? 'var(--amber)' : 'var(--green)'}` }} />
              {logPaused ? 'Paused' : 'Live'}
            </div>
            <button onClick={() => setLogPaused(!logPaused)} className="btn btn-secondary" style={{ height: 28, fontSize: 11, padding: '0 10px' }}>
              {logPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button onClick={scrollToBottom} className="btn btn-secondary" style={{ height: 28, fontSize: 11, padding: '0 10px' }}>
              ↓ Bottom
            </button>
            <button onClick={clearLogs} className="btn btn-secondary" style={{ height: 28, fontSize: 11, padding: '0 10px' }}>
              Clear
            </button>
          </div>
        </div>
        <div ref={logRef} style={{
          background: '#0A0A10', borderRadius: 12, padding: 16, maxHeight: 380, overflowY: 'auto',
          fontFamily: '"SF Mono","JetBrains Mono",monospace', fontSize: 11.5, lineHeight: 1.55, color: 'var(--text2)',
        }}>
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text3)' }}>Waiting for logs…</div>
          ) : (
            logs.slice(-200).map((line, i) => {
              const txt = typeof line === 'string' ? line : JSON.stringify(line);
              const color = /error|failed|❌/i.test(txt) ? 'var(--red-text)'
                          : /warn|⚠/i.test(txt) ? 'var(--amber-text)'
                          : /✓|✅|done|success/i.test(txt) ? 'var(--green-text)'
                          : 'var(--text2)';
              return <div key={i} style={{ color }}>{txt}</div>;
            })
          )}
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text3)' }}>
          Showing last 200 of {logs.length} · polls every 5s · red = errors, amber = warnings, green = success
        </div>
      </div>

      {/* ═══ LIVE TRADING CONFIRMATION MODAL ═══ */}
      {showLiveModal && (
        <div
          onClick={() => { if (!toggleBusy) { setShowLiveModal(false); setConfirmLiveText(''); } }}
          style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,0.72)', backdropFilter:'blur(6px)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999,
            animation:'fadeIn 200ms ease-out',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="card"
            style={{
              maxWidth:560, width:'92%', padding:0, overflow:'hidden',
              border:'2px solid rgba(248,113,113,0.5)',
              boxShadow:'0 20px 60px rgba(0,0,0,0.5), 0 0 60px rgba(248,113,113,0.25)',
              animation:'slideIn 260ms cubic-bezier(0.2,0.8,0.2,1)',
            }}
          >
            <div style={{
              background:'linear-gradient(135deg, rgba(248,113,113,0.22), rgba(239,68,68,0.14))',
              padding:'18px 22px', borderBottom:'1px solid var(--border)',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:22 }}>⚠️</span>
                <h2 style={{ fontSize:17, fontWeight:800, color:'var(--text)' }}>Enable LIVE trading</h2>
              </div>
              <p style={{ fontSize:12.5, color:'var(--text2)', marginTop:6 }}>
                RoboTrade will place REAL orders on Kite using ₹{(tradingMode?.configuredCapital || 0).toLocaleString('en-IN')} capital. Real money is at risk.
              </p>
            </div>

            <div style={{ padding:'18px 22px' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:10, letterSpacing:'0.5px' }}>
                PRE-FLIGHT CHECKS
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                {preflightLoading ? (
                  <div style={{ fontSize:12, color:'var(--text3)' }}>Checking egress IP + whitelist…</div>
                ) : preflight?.error ? (
                  <div style={{ fontSize:12, color:'var(--red-text)' }}>⚠ Pre-flight check failed: {preflight.error}</div>
                ) : preflight && (
                  <>
                    <PreflightRow
                      ok={!!preflight.kiteConnected || !!tradingMode?.kiteConnected}
                      label="Kite connected"
                      detail={tradingMode?.kiteConnected ? 'Access token valid' : 'Login to Kite first — click Sign Out and re-login'}
                    />
                    <PreflightRow
                      ok={preflight.proxyConfigured}
                      label="Static-IP proxy configured"
                      detail={preflight.proxyConfigured ? `Routed via ${preflight.viaProxy}` : 'QUOTAGUARDSTATIC_URL env var not set'}
                    />
                    <PreflightRow
                      ok={preflight.axiosPatched && preflight.wsPatched}
                      label="Kite SDK patched for proxy"
                      detail={preflight.axiosPatched && preflight.wsPatched ? 'All REST + WS calls route through DO proxy' : 'Patches not active — orders may egress from wrong IP'}
                    />
                    <PreflightRow
                      ok={preflight.kiteSdkRoutedIp === preflight.viaProxy}
                      label="Egress IP matches whitelist"
                      detail={`SDK egress: ${preflight.kiteSdkRoutedIp || '—'} · Whitelisted: ${preflight.viaProxy || '—'}`}
                    />
                  </>
                )}
              </div>

              <div style={{ fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:8, letterSpacing:'0.5px' }}>
                CONFIRM
              </div>
              <p style={{ fontSize:13, color:'var(--text)', marginBottom:10 }}>
                Type <b style={{ color:'var(--red-text)', letterSpacing:'1px' }}>LIVE</b> to enable real-money trading:
              </p>
              <input
                autoFocus
                value={confirmLiveText}
                onChange={e => setConfirmLiveText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && confirmLiveText === 'LIVE') handleEnableLive(); }}
                placeholder="LIVE"
                style={{
                  width:'100%', height:42, padding:'0 14px', borderRadius:8,
                  border:'1px solid ' + (confirmLiveText === 'LIVE' ? 'rgba(248,113,113,0.6)' : 'var(--border)'),
                  background:'var(--bg-elev)', color:'var(--text)',
                  fontSize:15, fontWeight:700, letterSpacing:'2px',
                  fontFamily:'inherit', textAlign:'center',
                  transition:'border-color 150ms',
                }}
              />

              <div style={{ display:'flex', gap:10, marginTop:18, justifyContent:'flex-end' }}>
                <button
                  onClick={() => { setShowLiveModal(false); setConfirmLiveText(''); }}
                  disabled={toggleBusy}
                  className="btn btn-secondary"
                  style={{ height:40, padding:'0 18px', fontSize:13 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEnableLive}
                  disabled={toggleBusy || confirmLiveText !== 'LIVE'}
                  className="btn btn-primary"
                  style={{
                    height:40, padding:'0 22px', fontSize:13, fontWeight:800,
                    background: confirmLiveText === 'LIVE' ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'var(--bg-elev)',
                    border: '1px solid ' + (confirmLiveText === 'LIVE' ? 'rgba(248,113,113,0.5)' : 'var(--border)'),
                    opacity: toggleBusy || confirmLiveText !== 'LIVE' ? 0.55 : 1,
                    cursor: toggleBusy || confirmLiveText !== 'LIVE' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {toggleBusy ? '…' : '● ENABLE LIVE'}
                </button>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
            @keyframes slideIn { from { opacity:0; transform:translateY(18px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
          `}</style>
        </div>
      )}
    </div>
  );
}

// Pre-flight check row — small helper component for the confirmation modal
function PreflightRow({ ok, label, detail }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:12.5 }}>
      <span style={{ fontSize:14, color: ok ? 'var(--green-text)' : 'var(--red-text)' }}>{ok ? '✓' : '✗'}</span>
      <span style={{ color:'var(--text)', fontWeight:600, minWidth:160 }}>{label}</span>
      <span style={{ color:'var(--text3)', fontSize:11.5 }}>{detail}</span>
    </div>
  );
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

// ══════════════════════════════════════════════════════════════════════
// 🚀 v2.0 Wave 13 — V2 Control Panel
// Surfaces every v2 strategy module: pre-market context, tier
// classification, daily watchlist, trend-day detection, Initial
// Balance day-type, per-setup SQN tracking. Polls /api/admin/v2/status
// and /api/admin/setup-sqn every 30s. Provides manual refresh buttons
// for tiers + watchlist (otherwise rebuilt by 9:14/11:00/13:30 IST cron).
// ══════════════════════════════════════════════════════════════════════
function V2ControlPanel({ v2Status, v2Sqn, v2BusyTier, v2BusyWl, v2OpsMsg, onRefreshTiers, onRefreshWatchlist }) {
  const enabled = !!v2Status?.v2SetupsMode;
  const pm = v2Status?.premarket;
  const td = v2Status?.trendDay;
  const ib = v2Status?.initialBalance;
  const tc = v2Status?.tierCounts;
  const wl = v2Status?.watchlist;

  // Color helpers
  const dayBiasColor = (tier) => tier === 'BULL' ? '#10b981' : tier === 'BEAR' ? '#ef4444' : '#94a3b8';
  const trendDayColor = (active, dir) => !active ? '#94a3b8' : dir === 'BULL' ? '#10b981' : '#ef4444';
  const ibTypeColor = (t) => t === 'TREND' ? '#10b981' : t === 'BRACKETED' ? '#f59e0b' : '#3b82f6';
  const sqnTierColor = (tier) => ({
    POOR: '#ef4444', AVERAGE: '#f59e0b', GOOD: '#10b981',
    EXCELLENT: '#3b82f6', SUSPECT_OVERFIT: '#a855f7',
  })[tier] || '#94a3b8';

  return (
    <div className="card card-premium" style={{
      padding: 0,
      marginBottom: 20,
      overflow: 'hidden',
      border: enabled ? '1px solid rgba(167,139,250,0.45)' : '1px solid var(--border)',
      boxShadow: enabled ? '0 0 30px rgba(167,139,250,0.10)' : '0 8px 22px rgba(0,0,0,0.22)',
    }}>
      {/* Header */}
      <div style={{
        background: enabled
          ? 'linear-gradient(135deg, rgba(167,139,250,0.18), rgba(99,102,241,0.10))'
          : 'linear-gradient(135deg, rgba(148,163,184,0.10), rgba(100,116,139,0.06))',
        padding: '20px 24px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 20 }}>🚀</span>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.2px' }}>
                V2.0 Strategy Control Panel
              </h2>
              <span className="chip" style={{
                background: enabled ? 'var(--brand-bg)' : 'rgba(148,163,184,0.10)',
                color: enabled ? 'var(--brand-text)' : 'var(--text3)',
                border: '1px solid ' + (enabled ? 'rgba(99,102,241,0.35)' : 'var(--border)'),
                fontWeight: 800, letterSpacing: '0.5px', fontSize: 10,
              }}>
                {enabled ? '● V2 ACTIVE' : '○ V2 DISABLED'}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5, maxWidth: 720 }}>
              Top-trader playbook: pre-market routine, tier classification, daily watchlist, trend-day detection, Initial Balance, per-setup SQN.
              Set env <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 3 }}>V2_SETUPS_MODE=on</code> to activate.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onRefreshTiers}
              disabled={!enabled || v2BusyTier}
              className="btn btn-secondary"
              style={{ height: 32, fontSize: 11, padding: '0 12px', opacity: !enabled || v2BusyTier ? 0.55 : 1 }}
              title="Manually re-run classifyStockTier() over the universe"
            >
              {v2BusyTier ? '⏳' : '↻'} Tiers
            </button>
            <button
              onClick={onRefreshWatchlist}
              disabled={!enabled || v2BusyWl}
              className="btn btn-secondary"
              style={{ height: 32, fontSize: 11, padding: '0 12px', opacity: !enabled || v2BusyWl ? 0.55 : 1 }}
              title="Manually rebuild the daily watchlist from current tier cache"
            >
              {v2BusyWl ? '⏳' : '↻'} Watchlist
            </button>
          </div>
        </div>
        {v2OpsMsg && (
          <div style={{
            marginTop: 10, fontSize: 12,
            color: v2OpsMsg.startsWith('❌') ? 'var(--red-text)' : 'var(--green-text)',
            fontWeight: 600,
          }}>
            {v2OpsMsg}
          </div>
        )}
      </div>

      {!enabled && (
        <div style={{ padding: '32px 24px', fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
          V2 strategy is currently <b>disabled</b>. The bot is running v1 logic. Set <code>V2_SETUPS_MODE=on</code> in environment and restart to activate.
        </div>
      )}

      {enabled && (
        <div style={{ padding: '20px 24px' }}>
          {/* Top row — 4 status cards: Pre-market / Trend Day / Initial Balance / Tier Cache */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
            {/* Pre-market context */}
            <div style={{ padding: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>
                Pre-market · 8:30 IST
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: dayBiasColor(pm?.tier), letterSpacing: '-0.5px' }}>
                  {pm?.tier || '—'}
                </span>
                {pm?.dayBiasScore != null && (
                  <span className="tabular-nums" style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
                    score {pm.dayBiasScore > 0 ? '+' : ''}{pm.dayBiasScore}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
                Gift: <b style={{ color: 'var(--text)' }}>{pm?.giftGapPct != null ? `${(pm.giftGapPct * 100).toFixed(2)}%` : '—'}</b><br />
                VIX Δ: <b style={{ color: 'var(--text)' }}>{pm?.vixDelta != null ? `${(pm.vixDelta * 100).toFixed(2)}%` : '—'}</b><br />
                FII: <b style={{ color: 'var(--text)' }}>{pm?.fiiNet != null ? `₹${pm.fiiNet}cr` : '—'}</b> · DII: <b style={{ color: 'var(--text)' }}>{pm?.diiNet != null ? `₹${pm.diiNet}cr` : '—'}</b>
              </div>
              {pm?.stale && (
                <div style={{ marginTop: 6, fontSize: 10, color: 'var(--amber-text)', fontWeight: 700 }}>
                  ⚠ Stale — premarket cron didn't run
                </div>
              )}
            </div>

            {/* Trend Day */}
            <div style={{ padding: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>
                Trend Day · 9:45 IST
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: trendDayColor(td?.active, td?.direction), letterSpacing: '-0.5px' }}>
                  {td?.active ? `🚀 ${td.direction || 'ACTIVE'}` : td?.evaluated ? 'NORMAL' : 'PENDING'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
                Bull signals: <b style={{ color: 'var(--text)' }}>{td?.bullSignals ?? 0}/4</b><br />
                Bear signals: <b style={{ color: 'var(--text)' }}>{td?.bearSignals ?? 0}/4</b><br />
                A/D ratio: <b style={{ color: 'var(--text)' }}>{td?.adRatio ?? '—'}</b> · Sectors: <b style={{ color: 'var(--text)' }}>{td?.sectorsGreen ?? 0}↑/{td?.sectorsRed ?? 0}↓</b>
              </div>
            </div>

            {/* Initial Balance */}
            <div style={{ padding: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>
                Initial Balance · 10:15 IST
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: ibTypeColor(ib?.dayType), letterSpacing: '-0.5px' }}>
                  {ib?.dayType || (ib?.computed === false ? 'PENDING' : '—')}
                </span>
              </div>
              <div className="tabular-nums" style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
                Range: <b style={{ color: 'var(--text)' }}>{ib?.range != null ? `${ib.iL?.toFixed(0)}–${ib.iH?.toFixed(0)}` : '—'}</b><br />
                Width: <b style={{ color: 'var(--text)' }}>{ib?.range != null ? `${ib.range.toFixed(0)} pts` : '—'}</b><br />
                ADR fraction: <b style={{ color: 'var(--text)' }}>{ib?.fraction != null ? `${(ib.fraction * 100).toFixed(0)}%` : '—'}</b>
              </div>
              {ib?.reason && (
                <div style={{ marginTop: 6, fontSize: 10, color: 'var(--amber-text)' }}>{ib.reason}</div>
              )}
            </div>

            {/* Tier Cache */}
            <div style={{ padding: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>
                Tier Cache · 9:14 / 11:00 / 13:30
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                <div className="tabular-nums">
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#10b981', letterSpacing: '-0.5px' }}>{tc?.A ?? 0}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>A</span>
                </div>
                <div className="tabular-nums">
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#3b82f6', letterSpacing: '-0.5px' }}>{tc?.B ?? 0}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>B</span>
                </div>
                <div className="tabular-nums">
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#94a3b8', letterSpacing: '-0.5px' }}>{tc?.SKIP ?? 0}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>SKIP</span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
                Watchlist built: <b style={{ color: wl?.built ? 'var(--green-text)' : 'var(--amber-text)' }}>{wl?.built ? 'YES' : 'NO'}</b> ({wl?.count ?? 0} sym)<br />
                {wl?.builtAt && (
                  <span>Built at: <b style={{ color: 'var(--text)' }}>{new Date(wl.builtAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST</b></span>
                )}
              </div>
            </div>
          </div>

          {/* Per-Setup SQN table */}
          <div style={{ padding: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
                  Van Tharp · Per-Setup SQN
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                  SQN = (mean_R / stddev_R) × √N · last 30 trades per setup · min 5 trades
                </div>
              </div>
              {v2Sqn?.generatedAt && (
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                  Updated: {new Date(v2Sqn.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
            {v2Sqn?.results?.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="tabular-nums" style={{ width: '100%', fontSize: 11.5, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left',  padding: '6px 10px 8px', color: 'var(--text3)', fontWeight: 600 }}>Setup</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px 8px', color: 'var(--text3)', fontWeight: 600 }}>Trades</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px 8px', color: 'var(--text3)', fontWeight: 600 }}>Win%</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px 8px', color: 'var(--text3)', fontWeight: 600 }}>Avg Win R</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px 8px', color: 'var(--text3)', fontWeight: 600 }}>Avg Loss R</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px 8px', color: 'var(--text3)', fontWeight: 600 }}>Expectancy</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px 8px', color: 'var(--text3)', fontWeight: 600 }}>SQN</th>
                      <th style={{ textAlign: 'left',  padding: '6px 10px 8px', color: 'var(--text3)', fontWeight: 600 }}>Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v2Sqn.results.map((r, i) => {
                      const insufficient = r.status === 'INSUFFICIENT_DATA';
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '6px 10px', color: 'var(--text)', fontWeight: 600 }}>{r.setup}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text2)' }}>{r.trades}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text2)' }}>{insufficient ? '—' : `${r.winRate}%`}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: insufficient ? 'var(--text3)' : 'var(--green-text)' }}>{insufficient ? '—' : `${r.avgWinR}R`}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: insufficient ? 'var(--text3)' : 'var(--red-text)' }}>{insufficient ? '—' : `${r.avgLossR}R`}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: insufficient ? 'var(--text3)' : (r.expectancy > 0 ? 'var(--green-text)' : 'var(--red-text)'), fontWeight: 700 }}>
                            {insufficient ? '—' : `${r.expectancy > 0 ? '+' : ''}${r.expectancy}R`}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: insufficient ? 'var(--text3)' : 'var(--text)', fontWeight: 800 }}>
                            {insufficient ? '—' : r.sqn}
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            {insufficient ? (
                              <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>need {r.minTrades}+</span>
                            ) : (
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                                color: sqnTierColor(r.tier),
                                background: `${sqnTierColor(r.tier)}14`,
                                border: `1px solid ${sqnTierColor(r.tier)}40`,
                                letterSpacing: '0.3px',
                              }} title={r.recommendation}>
                                {r.tier}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '20px 0', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
                No closed v2 trades yet — SQN needs at least 5 closed trades per setup.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
