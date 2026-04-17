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
  { k: 'optionRec',     l: 'Option',    w: 130, align: 'left',  fmt: (v) => v ? `${v.type || ''} ${v.strike || ''} (${v.lots || '—'}L)` : '—' },
];

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
  const mounted = useRef(false);

  const fetchPicks = () => {
    apiGet('/api/stocks/picks/daytrade')
      .then((d) => {
        setPicks(d.picks || d.results || d || []);
        setScannedAt(d.scannedAt || null);
        setMarketOpen(d.marketOpen ?? null);
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
              onClick={handleForceScan}
              disabled={forceRunning}
              className="btn btn-primary"
              style={{ height: 36, fontSize: 12, padding: '0 14px', opacity: forceRunning ? 0.6 : 1 }}
            >
              {forceRunning ? '⏳ Running…' : '▶ Force Scan'}
            </button>
          </div>
        </div>
        {forceMsg && (
          <div style={{ marginTop: 10, fontSize: 12, color: forceMsg.startsWith('❌') ? 'var(--red-text)' : 'var(--green-text)' }}>
            {forceMsg}
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
                            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                              {p.whyPicked || 'No explanation available for this pick.'}
                            </div>
                            {Array.isArray(p.scoreGains) && p.scoreGains.length > 0 && (
                              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {p.scoreGains.slice(0, 6).map((g, idx) => (
                                  <span key={idx} className="chip" style={{ background: 'var(--green-bg)', color: 'var(--green-text)', height: 20, fontSize: 10 }}>+{g.pts} {g.reason}</span>
                                ))}
                                {(p.scorePenalties || []).slice(0, 3).map((g, idx) => (
                                  <span key={`p${idx}`} className="chip" style={{ background: 'var(--red-bg)', color: 'var(--red-text)', height: 20, fontSize: 10 }}>−{g.pts} {g.reason}</span>
                                ))}
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
