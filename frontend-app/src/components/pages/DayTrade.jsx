import React, { useEffect, useState, useMemo, useRef } from 'react';
import { apiGet, apiPost } from '../../api/client';

// ══════════════════════════════════════════════════════════════════════
// Setup type config — mirrors scoreDayTrade() output in kite-server.js
// ══════════════════════════════════════════════════════════════════════
const SETUPS = [
  {
    type: 'VWAP_RECLAIM',
    label: 'VWAP Reclaim',
    icon: '🎯',
    color: 'var(--brand-text)',
    bg: 'var(--brand-bg)',
    desc: 'Price reclaiming VWAP from below with volume — institutional buy zone. Best odds during first 90 min.',
  },
  {
    type: 'GAP_AND_GO',
    label: 'Gap & Go',
    icon: '🚀',
    color: 'var(--amber-text)',
    bg: 'var(--amber-bg)',
    desc: 'Gap open 1–6% with follow-through above opening range + volume surge. Strong-momentum continuation.',
  },
  {
    type: 'BREAKOUT',
    label: 'Breakout',
    icon: '📈',
    color: 'var(--green-text)',
    bg: 'var(--green-bg)',
    desc: 'Price at day high / above opening range with volume surge + ADX > 20 (trending, not ranging).',
  },
  {
    type: 'OVERSOLD_BOUNCE',
    label: 'Oversold Bounce',
    icon: '💎',
    color: 'var(--purple-text)',
    bg: 'var(--purple-bg)',
    desc: '5-min RSI < 35 + below lower Bollinger Band. Mean-reversion play — use tight stop.',
  },
];

const SETUP_FILTER_PILLS = [
  { id: 'ALL',             label: 'All Setups' },
  { id: 'VWAP_RECLAIM',    label: 'VWAP' },
  { id: 'GAP_AND_GO',      label: 'Gap' },
  { id: 'BREAKOUT',        label: 'Breakout' },
  { id: 'OVERSOLD_BOUNCE', label: 'Oversold' },
];

// Column definitions for the main sortable table
const COLS = [
  { k: 'sym',           l: 'Stock',     w: 110, align: 'left',   sticky: true, bold: true },
  { k: 'grp',           l: 'Grp',       w: 75,  align: 'left' },
  { k: 'dayTradeScore', l: 'Score',     w: 80,  align: 'right', fmt: (v) => v != null ? Math.round(v) : '—' },
  { k: 'bestSetup',     l: 'Setup',     w: 115, align: 'left',  fmt: (v, s) => v ? `${s.bestSetupEmoji || ''} ${String(v).replace(/_/g, ' ')}` : '—' },
  { k: 'price',         l: 'Price',     w: 80,  align: 'right', fmt: (v) => v != null ? `₹${Number(v).toFixed(1)}` : '—' },
  { k: 'rsi',           l: 'RSI',       w: 60,  align: 'right', fmt: (v) => v != null ? Math.round(v) : '—' },
  { k: 'vwapDist',      l: 'VWAP %',    w: 75,  align: 'right', fmt: (v) => v != null ? `${Number(v).toFixed(2)}%` : '—' },
  { k: 'volRatio',      l: 'Vol',       w: 60,  align: 'right', fmt: (v) => v != null ? `${Number(v).toFixed(1)}x` : '—' },
  { k: 'gapPct',        l: 'Gap%',      w: 70,  align: 'right', fmt: (v) => v != null ? `${Number(v).toFixed(1)}%` : '—' },
  { k: 'sl',            l: 'SL',        w: 75,  align: 'right', fmt: (v) => v != null ? `₹${Number(v).toFixed(1)}` : '—' },
  { k: 'tgt',           l: 'Target',    w: 75,  align: 'right', fmt: (v) => v != null ? `₹${Number(v).toFixed(1)}` : '—' },
  { k: 'rrRatio',       l: 'R:R',       w: 60,  align: 'right', fmt: (v) => v != null ? `${Number(v).toFixed(2)}` : '—' },
  { k: 'optionRec',     l: 'Option',    w: 160, align: 'left',  fmt: (v) => formatOption(v) },
];

// Rich option formatter: "NIFTY 24000 CE 24-Oct (Lot 50)"
function formatOption(v) {
  if (!v || typeof v !== 'object') return '—';
  const parts = [];
  if (v.type) parts.push(String(v.type).toUpperCase());
  if (v.strike != null) parts.push(String(v.strike));
  if (v.expiry) {
    // Accept "2026-10-24" or "24-Oct" or Date
    try {
      const d = new Date(v.expiry);
      if (!isNaN(d)) {
        const mo = d.toLocaleString('en-US', { month: 'short' });
        parts.push(`${d.getDate()}-${mo}`);
      } else { parts.push(String(v.expiry)); }
    } catch { parts.push(String(v.expiry)); }
  }
  let out = parts.join(' ');
  const tail = [];
  if (v.lots != null) tail.push(`Lot ${v.lots}`);
  if (v.iv != null) tail.push(`IV ${Number(v.iv).toFixed(0)}%`);
  if (tail.length) out += ` (${tail.join(' · ')})`;
  return out || '—';
}

// ══════════════════════════════════════════════════════════════════════
// Main component
// ══════════════════════════════════════════════════════════════════════
export default function DayTrade() {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scannedAt, setScannedAt] = useState(null);
  const [marketOpen, setMarketOpen] = useState(null);
  const [setupFilter, setSetupFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('dayTradeScore');
  const [sortDir, setSortDir] = useState('desc');
  const [expanded, setExpanded] = useState(null);
  const [forceRunning, setForceRunning] = useState(false);
  const [forceMsg, setForceMsg] = useState('');
  const [totalScanned, setTotalScanned] = useState(null);
  const [copyMsg, setCopyMsg] = useState('');
  const mounted = useRef(false);

  const fetchPicks = () => {
    apiGet('/api/stocks/picks/daytrade')
      .then((d) => {
        // Server returns { stocks, total, lastScannedAt, marketOpen }
        // Be defensive — array in any of stocks/picks/results/d itself, else [].
        const arr = Array.isArray(d?.stocks) ? d.stocks
                  : Array.isArray(d?.picks) ? d.picks
                  : Array.isArray(d?.results) ? d.results
                  : Array.isArray(d) ? d : [];
        setPicks(arr);
        setScannedAt(d?.lastScannedAt || d?.scannedAt || null);
        setMarketOpen(d?.marketOpen ?? null);
        setTotalScanned(typeof d?.total === 'number' ? d.total : null);
        setLoading(false);
      })
      .catch((e) => { setError(e.message || 'Failed'); setLoading(false); });
  };

  useEffect(() => {
    fetchPicks();
    mounted.current = true;
    // Auto-refresh every 5s while mounted (matches old app.html behavior).
    // The endpoint is read-only so this doesn't trigger a new scan.
    const id = setInterval(() => { if (mounted.current) fetchPicks(); }, 5000);
    return () => { mounted.current = false; clearInterval(id); };
  }, []);

  const handleForceScan = async () => {
    if (forceRunning) return;
    setForceRunning(true);
    setForceMsg('Force-scanning 568 stocks on 5-min candles… (~3 min)');
    try {
      await apiPost('/api/admin/unified-pipeline', { force: true });
      setForceMsg('✓ Pipeline triggered — results will auto-refresh');
      setTimeout(fetchPicks, 3000);
    } catch (e) { setForceMsg(`❌ ${e.message}`); }
    setForceRunning(false);
    setTimeout(() => setForceMsg(''), 6000);
  };

  const handleExportCSV = async () => {
    try {
      const header = ['Rank', 'Symbol', 'Group', 'Sector', 'Score', 'Setup', 'Price', 'RSI', 'VWAP%', 'Vol', 'Gap%', 'SL', 'Target', 'R:R', 'Option'];
      const rows = (Array.isArray(filtered) ? filtered : []).map((p, i) => [
        i + 1,
        p.sym || '',
        p.grp || '',
        p.sector || '',
        p.dayTradeScore != null ? Math.round(p.dayTradeScore) : '',
        p.bestSetup || '',
        p.price != null ? Number(p.price).toFixed(2) : '',
        p.rsi != null ? Math.round(p.rsi) : '',
        p.vwapDist != null ? Number(p.vwapDist).toFixed(2) : '',
        p.volRatio != null ? Number(p.volRatio).toFixed(2) : '',
        p.gapPct != null ? Number(p.gapPct).toFixed(2) : '',
        p.sl != null ? Number(p.sl).toFixed(2) : '',
        p.tgt != null ? Number(p.tgt).toFixed(2) : '',
        p.rrRatio != null ? Number(p.rrRatio).toFixed(2) : '',
        formatOption(p.optionRec),
      ]);
      const csv = [header, ...rows]
        .map((r) => r.map((c) => {
          const s = String(c == null ? '' : c);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(','))
        .join('\n');
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(csv);
        setCopyMsg(`✓ Copied ${rows.length} rows to clipboard`);
      } else {
        setCopyMsg('❌ Clipboard unavailable');
      }
    } catch (e) {
      setCopyMsg(`❌ ${e.message || 'Copy failed'}`);
    }
    setTimeout(() => setCopyMsg(''), 4000);
  };

  // ── Summary counts per setup type (pre-filter) ────────────────────
  const counts = useMemo(() => {
    const o = { total: picks.length, strong: 0 };
    for (const st of SETUPS) o[st.type] = 0;
    for (const p of picks) {
      const setup = String(p.bestSetup || '').toUpperCase();
      if (o[setup] != null) o[setup]++;
      if ((p.dayTradeScore || 0) >= 70) o.strong++;
    }
    return o;
  }, [picks]);

  // ── Filter + sort ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = picks;
    if (setupFilter !== 'ALL') list = list.filter((p) => String(p.bestSetup || '').toUpperCase() === setupFilter);
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      list = list.filter((p) => (p.sym || '').toUpperCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [picks, setupFilter, search, sortKey, sortDir]);

  const handleSort = (k) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('desc'); }
  };

  const scannedAgo = scannedAt ? formatAgo(Date.now() - new Date(scannedAt).getTime()) : '—';

  return (
    <div>
      {/* ═══ HERO ═══ */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(248,113,113,0.14) 0%, rgba(99,102,241,0.12) 100%)',
        border: '1px solid var(--border)', borderRadius: 18, padding: '28px 32px', marginBottom: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div className="label-xs">Intraday Scanner · Varsity M2 · 5-min candles</div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'var(--red-bg)', color: 'var(--red-text)', letterSpacing: '0.5px' }}>ADMIN</span>
              {marketOpen != null && (
                <span className={`chip ${marketOpen ? 'chip-green' : 'chip-amber'}`} style={{ height: 20, fontSize: 10, fontWeight: 700 }}>
                  {marketOpen ? '● LIVE' : 'FROM LAST SESSION'}
                </span>
              )}
            </div>
            <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', color: 'var(--text)' }}>
              <span className="gradient-fill">DayTrade Scanner</span>
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text2)', marginTop: 8, lineHeight: 1.5, maxWidth: 680 }}>
              VWAP Reclaim + Gap & Go + Breakout + Oversold Bounce, scored in real-time.
              Auto-refreshes every 5s. Last scanned: <b style={{ color: 'var(--text)' }}>{scannedAgo}</b>.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={fetchPicks} className="btn btn-secondary" style={{ height: 36, fontSize: 12, padding: '0 14px' }}>
              ↻ Refresh
            </button>
            <button
              onClick={handleExportCSV}
              className="btn btn-secondary"
              disabled={!filtered.length}
              style={{ height: 36, fontSize: 12, padding: '0 14px', opacity: filtered.length ? 1 : 0.5 }}
              title="Copy current filtered picks to clipboard as CSV"
            >
              ⎘ Export CSV
            </button>
            <button
              onClick={handleForceScan}
              disabled={forceRunning}
              className="btn btn-primary"
              style={{ height: 36, fontSize: 12, padding: '0 14px', opacity: forceRunning ? 0.6 : 1 }}
            >
              {forceRunning ? '⏳ Running…' : '▶ Force Scan'}
            </button>
          </div>
        </div>
        {/* ── Scan diagnostics ── */}
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11, color: 'var(--text3)' }}>
          {scannedAt && (
            <span className="chip" style={{ height: 22, fontSize: 10.5 }}>
              🕒 Scanned {scannedAgo}
            </span>
          )}
          {totalScanned != null && (
            <span className="chip" style={{ height: 22, fontSize: 10.5 }}>
              📊 {picks.length} picks / {totalScanned} scanned
              {totalScanned > 0 && <> · {((picks.length / totalScanned) * 100).toFixed(1)}%</>}
            </span>
          )}
          {marketOpen === false && (
            <span className="chip chip-amber" style={{ height: 22, fontSize: 10.5, fontWeight: 700 }}>
              ⚠ FROM LAST SESSION — data not live
            </span>
          )}
        </div>
        {forceMsg && (
          <div style={{ marginTop: 8, fontSize: 12, color: forceMsg.startsWith('❌') ? 'var(--red-text)' : 'var(--green-text)' }}>
            {forceMsg}
          </div>
        )}
        {copyMsg && (
          <div style={{ marginTop: 8, fontSize: 12, color: copyMsg.startsWith('❌') ? 'var(--red-text)' : 'var(--green-text)' }}>
            {copyMsg}
          </div>
        )}
      </div>

      {/* ═══ SUMMARY PILLS ═══ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 10,
        marginBottom: 20,
      }}>
        <StatCard l="Total" v={counts.total} c="var(--text)" />
        <StatCard l="Strong (≥70)" v={counts.strong} c="var(--green-text)" />
        {SETUPS.map((s) => (
          <StatCard key={s.type} l={s.label} v={counts[s.type] || 0} c={s.color} icon={s.icon} />
        ))}
      </div>

      {/* ═══ PER-SETUP MINI-TABLES (top 10 per setup) ═══ */}
      {!loading && !error && picks.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div className="label-xs" style={{ marginBottom: 10 }}>Top picks by setup type</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14 }}>
            {SETUPS.map((s) => (
              <SetupMiniTable
                key={s.type}
                setup={s}
                rows={(Array.isArray(picks) ? picks : [])
                  .filter((p) => String(p.bestSetup || '').toUpperCase() === s.type)
                  .sort((a, b) => (b.dayTradeScore || 0) - (a.dayTradeScore || 0))
                  .slice(0, 10)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ═══ SETUP FILTER + SEARCH ═══ */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search symbol…"
          style={{
            height: 38, padding: '0 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)',
            borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', minWidth: 200,
          }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SETUP_FILTER_PILLS.map((f) => {
            const active = setupFilter === f.id;
            return (
              <button key={f.id} onClick={() => setSetupFilter(f.id)} style={{
                padding: '6px 14px', borderRadius: 9999, fontSize: 12, fontWeight: active ? 700 : 600,
                background: active ? 'var(--brand)' : 'rgba(255,255,255,0.04)',
                color: active ? '#fff' : 'var(--text2)',
                border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 180ms ease',
              }}>{f.label}</button>
            );
          })}
        </div>
      </div>

      {/* ═══ SETUP LEGEND CARDS (collapsible) ═══ */}
      <details style={{ marginBottom: 16 }}>
        <summary style={{
          cursor: 'pointer',
          padding: '10px 14px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          fontSize: 12,
          color: 'var(--text3)',
          fontWeight: 600,
          listStyle: 'none',
        }}>
          📖 Setup legend — click to expand
        </summary>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 12 }}>
          {SETUPS.map((s) => (
            <div key={s.type} style={{
              padding: 14,
              background: s.bg,
              border: `1px solid ${s.color}33`,
              borderRadius: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>{s.icon}</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.label}</div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </details>

      {/* ═══ COUNT STRIP ═══ */}
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
        Showing <b style={{ color: 'var(--text)' }}>{filtered.length}</b> of {picks.length} picks
        {search && <> · matching "<b style={{ color: 'var(--text)' }}>{search}</b>"</>}
        {setupFilter !== 'ALL' && <> · <b style={{ color: 'var(--brand-text)' }}>{setupFilter.replace(/_/g, ' ')}</b></>}
      </div>

      {/* ═══ MAIN SORTABLE TABLE ═══ */}
      {loading ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>
          <div className="animate-pulse-custom">Loading DayTrade picks…</div>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: 24, color: 'var(--red-text)' }}>Failed to load: {error}</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
          No DayTrade picks right now{setupFilter !== 'ALL' && ` for ${setupFilter.replace(/_/g, ' ')}`}.
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', maxHeight: 650 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 34, textAlign: 'center' }}>#</th>
                  {COLS.map((c) => (
                    <th key={c.k} onClick={() => handleSort(c.k)} style={{
                      ...thStyle,
                      width: c.w,
                      textAlign: c.align === 'left' ? 'left' : 'right',
                      color: sortKey === c.k ? 'var(--brand-text)' : 'var(--text3)',
                      cursor: 'pointer',
                      ...(c.sticky ? { position: 'sticky', left: 34, zIndex: 6 } : {}),
                    }}>
                      {c.l}
                      <span style={{ marginLeft: 4, fontSize: 10, opacity: sortKey === c.k ? 1 : 0.35 }}>
                        {sortKey === c.k ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 80).map((p, i) => {
                  const isOpen = expanded === p.sym;
                  const setup = SETUPS.find((s) => s.type === String(p.bestSetup || '').toUpperCase());
                  return (
                    <React.Fragment key={p.sym}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : p.sym)}
                        style={{
                          transition: 'background 150ms ease',
                          cursor: 'pointer',
                          background: isOpen ? 'rgba(99,102,241,0.08)' : 'transparent',
                        }}
                        onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = 'rgba(99,102,241,0.05)'; }}
                        onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td style={{ ...tdStyle, color: 'var(--text3)', textAlign: 'center' }}>{i + 1}</td>
                        {COLS.map((c) => {
                          const raw = p[c.k];
                          const val = c.fmt ? c.fmt(raw, p) : raw != null ? String(raw) : '—';
                          let color = c.k === 'sym' ? 'var(--text)' : 'var(--text2)';
                          if (c.k === 'dayTradeScore' && raw != null) {
                            color = raw >= 70 ? 'var(--green-text)' : raw >= 50 ? 'var(--amber-text)' : 'var(--text2)';
                          }
                          if (c.k === 'bestSetup' && setup) color = setup.color;
                          if (c.k === 'rrRatio' && raw != null) {
                            color = raw >= 2 ? 'var(--green-text)' : raw >= 1.5 ? 'var(--text)' : 'var(--red-text)';
                          }
                          if (c.k === 'gapPct' && raw != null) {
                            color = raw > 0 ? 'var(--green-text)' : raw < 0 ? 'var(--red-text)' : 'var(--text2)';
                          }
                          return (
                            <td
                              key={c.k}
                              className={c.align !== 'left' ? 'tabular-nums' : ''}
                              style={{
                                ...tdStyle,
                                textAlign: c.align === 'left' ? 'left' : 'right',
                                fontWeight: c.bold ? 700 : c.k === 'dayTradeScore' ? 700 : 500,
                                color,
                                ...(c.sticky ? { position: 'sticky', left: 34, background: 'rgba(12,14,20,0.95)', zIndex: 4 } : {}),
                              }}
                            >
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={COLS.length + 1} style={{
                            background: 'rgba(99,102,241,0.04)',
                            borderBottom: '1px solid var(--border)',
                            padding: '12px 18px',
                          }}>
                            <ColorizedWhy text={p.whyPicked} />
                            {(Array.isArray(p.scoreGains) && p.scoreGains.length > 0) || (Array.isArray(p.scorePenalties) && p.scorePenalties.length > 0) ? (
                              <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {(Array.isArray(p.scoreGains) ? p.scoreGains : []).slice(0, 8).map((g, idx) => (
                                  <span key={idx} className="chip chip-green" style={{ height: 22, fontSize: 10.5, fontWeight: 600 }}>
                                    +{g.pts} {g.reason}
                                  </span>
                                ))}
                                {(Array.isArray(p.scorePenalties) ? p.scorePenalties : []).slice(0, 6).map((g, idx) => (
                                  <span key={`p${idx}`} className="chip chip-red" style={{ height: 22, fontSize: 10.5, fontWeight: 600 }}>
                                    −{g.pts} {g.reason}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {p.optionRec && (
                              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)' }}>
                                <b style={{ color: 'var(--brand-text)' }}>Options:</b> {formatOption(p.optionRec)}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 80 && (
            <div style={{ padding: 14, textAlign: 'center', fontSize: 12, color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
              Showing first 80 of {filtered.length}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Per-setup mini-table (top 10 by score for a given setup type)
// ══════════════════════════════════════════════════════════════════════
function SetupMiniTable({ setup, rows }) {
  const list = Array.isArray(rows) ? rows : [];
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', border: `1px solid ${setup.color}22` }}>
      <div style={{
        padding: '10px 14px',
        background: setup.bg,
        borderBottom: `1px solid ${setup.color}22`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{setup.icon}</span>
          <div style={{ fontSize: 12, fontWeight: 700, color: setup.color, letterSpacing: '0.3px' }}>
            {setup.label}
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600 }}>
          {list.length} {list.length === 1 ? 'pick' : 'picks'}
        </div>
      </div>
      {list.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: 'var(--text3)' }}>
          No {setup.label} picks right now.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                <th style={miniTh}>Stock</th>
                <th style={{ ...miniTh, textAlign: 'right' }}>Score</th>
                <th style={{ ...miniTh, textAlign: 'right' }}>Price</th>
                <th style={{ ...miniTh, textAlign: 'right' }}>SL</th>
                <th style={{ ...miniTh, textAlign: 'right' }}>TGT</th>
                <th style={{ ...miniTh, textAlign: 'right' }}>R:R</th>
                <th style={{ ...miniTh, textAlign: 'left' }}>Option</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.sym} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...miniTd, fontWeight: 700, color: 'var(--text)' }}>{p.sym}</td>
                  <td className="tabular-nums" style={{
                    ...miniTd, textAlign: 'right', fontWeight: 700,
                    color: (p.dayTradeScore || 0) >= 70 ? 'var(--green-text)' : (p.dayTradeScore || 0) >= 50 ? 'var(--amber-text)' : 'var(--text2)',
                  }}>
                    {p.dayTradeScore != null ? Math.round(p.dayTradeScore) : '—'}
                  </td>
                  <td className="tabular-nums" style={{ ...miniTd, textAlign: 'right', color: 'var(--text2)' }}>
                    {p.price != null ? `₹${Number(p.price).toFixed(1)}` : '—'}
                  </td>
                  <td className="tabular-nums" style={{ ...miniTd, textAlign: 'right', color: 'var(--red-text)' }}>
                    {p.sl != null ? `₹${Number(p.sl).toFixed(1)}` : '—'}
                  </td>
                  <td className="tabular-nums" style={{ ...miniTd, textAlign: 'right', color: 'var(--green-text)' }}>
                    {p.tgt != null ? `₹${Number(p.tgt).toFixed(1)}` : '—'}
                  </td>
                  <td className="tabular-nums" style={{
                    ...miniTd, textAlign: 'right',
                    color: (p.rrRatio || 0) >= 2 ? 'var(--green-text)' : (p.rrRatio || 0) >= 1.5 ? 'var(--text)' : 'var(--red-text)',
                  }}>
                    {p.rrRatio != null ? Number(p.rrRatio).toFixed(2) : '—'}
                  </td>
                  <td style={{ ...miniTd, color: 'var(--text3)', fontSize: 10.5 }}>
                    {formatOption(p.optionRec)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Colorized whyPicked — parses prose and tags +N / −N fragments with color
// ══════════════════════════════════════════════════════════════════════
function ColorizedWhy({ text }) {
  if (!text) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>
        No explanation available for this pick.
      </div>
    );
  }
  // Split on sentence-like boundaries; color fragments that contain + or − numbers
  const parts = String(text).split(/(?<=[.;])\s+|\s+\|\s+|\s*·\s*/);
  return (
    <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {parts.filter(Boolean).map((frag, i) => {
        const hasPlus = /(^|\s)\+\d/.test(frag);
        const hasMinus = /(^|\s)[−-]\d/.test(frag);
        let color = 'var(--text2)';
        let bg = 'transparent';
        if (hasPlus && !hasMinus) { color = 'var(--green-text)'; bg = 'var(--green-bg)'; }
        else if (hasMinus && !hasPlus) { color = 'var(--red-text)'; bg = 'var(--red-bg)'; }
        return (
          <span key={i} style={{
            padding: bg === 'transparent' ? 0 : '2px 8px',
            borderRadius: bg === 'transparent' ? 0 : 6,
            background: bg,
            color,
            fontSize: 11.5,
          }}>
            {frag}
          </span>
        );
      })}
    </div>
  );
}

function StatCard({ l, v, c, icon }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
        {icon && <span style={{ marginRight: 4 }}>{icon}</span>}
        {l}
      </div>
      <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, color: c, letterSpacing: '-0.6px', lineHeight: 1 }}>{v}</div>
    </div>
  );
}

function formatAgo(ms) {
  if (!ms || ms < 0) return 'now';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

const thStyle = {
  padding: '10px 12px',
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--border)',
  position: 'sticky',
  top: 0,
  background: 'linear-gradient(145deg, rgba(30,30,44,0.98), rgba(18,18,28,0.98))',
  zIndex: 5,
  whiteSpace: 'nowrap',
  userSelect: 'none',
};

const tdStyle = {
  padding: '9px 12px',
  borderBottom: '1px solid var(--border)',
  fontSize: 12,
  whiteSpace: 'nowrap',
};

const miniTh = {
  padding: '7px 10px',
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: 'var(--text3)',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const miniTd = {
  padding: '7px 10px',
  fontSize: 11,
  whiteSpace: 'nowrap',
};
