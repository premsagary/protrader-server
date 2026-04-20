import React, { useEffect, useState, useRef } from 'react';
import { apiGet, apiPost } from '../../api/client';
import GatesActiveBanner from '../common/GatesActiveBanner';

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

  // Trading Mode state + Test Buy state moved to Trade > Agent sub-tab
  // 2026-04-20 (see components/common/TradingModeCard.jsx).
  // Admin only polls trading-mode when the paper-soak tools below need it.

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

    // Pipeline status poll (uptime + last run timestamps).
    // Trading Mode poll moved to TradingModeCard component.
    const pollStatus = () => {
      apiGet('/api/admin/pipeline-status').then(setPipelineStatus).catch(() => {});
      apiGet('/api/admin/llm-budget').then(setLlmBudget).catch(() => {});
    };
    pollStatus();
    const id2 = setInterval(pollStatus, 30000);

    return () => { clearInterval(id); clearInterval(id2); };
  }, [logPaused]);

  // Trading-mode + Test-buy handlers moved to TradingModeCard 2026-04-20.

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

      {/* ═══ GATES PIPELINE — shared Varsity + Book-Rules banner across tabs ═══ */}
      <div style={{ marginBottom: 20 }}>
        <GatesActiveBanner
          variant="full"
          accent="slate"
          title="Admin — Operational view of the 5-layer gate pipeline"
          subtitle="Flipping modes, running pipelines, or firing test buys does NOT bypass these gates. Every order passes through them."
        />
      </div>

      {/* Trading Mode master kill-switch + Capital editor + Kite Test Buy
          were moved to Trade > Agent sub-tab on 2026-04-20. See
          components/common/TradingModeCard.jsx. */}


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

      {/*
        NOTE (2026-04-20 tab consolidation):
        The PAPER↔LIVE master kill-switch, capital editor, Kite test-buy smoke
        test, and ENABLE LIVE confirmation modal (with PreflightRow helper) all
        moved to `components/common/TradingModeCard.jsx` and now live in the
        Trade tab's Agent sub-tab. Admin is strictly read-only ops/diagnostics.
      */}
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
