import React, { useEffect, useState, useMemo, useRef } from 'react';
import { apiGet, apiPost } from '../../api/client';

// Fetch wrapper for DELETE since api/client.js only exposes GET/POST.
// Server uses DELETE /api/holdings/:symbol (see kite-server.js ~22228).
async function apiDelete(path) {
  const token = localStorage.getItem('pt_token');
  const res = await fetch(path, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Field-name normaliser ─────────────────────────────────────────
// Server returns `quantity` + `avg_price`; older clients / legacy rows
// use `qty` + `avg_buy`. Accept either so we don't render NaN.
function normQty(h)  { return Number(h?.quantity ?? h?.qty ?? 0); }
function normAvg(h)  { return Number(h?.avg_price ?? h?.avg_buy ?? 0); }
function normCmp(h)  { return Number(h?.cmp ?? h?.ltp ?? normAvg(h) ?? 0); }
function normSym(h)  { return h?.symbol || h?.sym || '—'; }

export default function Holdings() {
  const [holdings, setHoldings] = useState([]);
  const [totals, setTotals] = useState(null);       // server-supplied totals, if any
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ sym: '', qty: '', avgBuy: '' });
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');
  // Apr-2026: autocomplete dropdown state (hzBuild-style) + AI-review state.
  const [universe, setUniverse] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const symInputRef = useRef(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiMsg, setAiMsg] = useState('');
  // Expanded AI review panels — keyed by symbol (mirror of legacy
  // _holdingsExpandedAI in app.html ~10602).
  const [expandedAI, setExpandedAI] = useState({});
  const [cmpRefreshing, setCmpRefreshing] = useState(false);

  const fetchHoldings = () => {
    setLoading(true);
    apiGet('/api/holdings')
      .then((d) => {
        const list = Array.isArray(d?.holdings) ? d.holdings : (Array.isArray(d) ? d : []);
        setHoldings(list);
        setTotals(d && typeof d.totals === 'object' ? d.totals : null);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  };

  useEffect(() => {
    fetchHoldings();
    // Load universe for autocomplete + cap-wise tagging.
    apiGet('/api/universe/list')
      .then((d) => {
        const list = Array.isArray(d?.stocks) ? d.stocks : (Array.isArray(d) ? d : []);
        setUniverse(list);
      })
      .catch(() => {});
  }, []);

  // ── Universe lookup map for cap-tag + sector enrichment ─────────
  const universeMap = useMemo(() => {
    const m = {};
    if (!Array.isArray(universe)) return m;
    universe.forEach((u) => { if (u?.sym) m[u.sym] = u; });
    return m;
  }, [universe]);

  // ── Client-side totals (fallback when server totals absent) ─────
  const clientTotals = useMemo(() => {
    const inv = holdings.reduce((s, h) => s + normAvg(h) * normQty(h), 0);
    const cur = holdings.reduce((s, h) => s + normCmp(h) * normQty(h), 0);
    const pnl = cur - inv;
    const pct = inv > 0 ? (pnl / inv) * 100 : 0;
    return { count: holdings.length, invested: inv, current: cur, pnl, pnl_pct: pct };
  }, [holdings]);

  const T = totals || clientTotals;           // prefer server, fall back to client
  const totalInvested = Number(T?.invested || 0);
  const totalCurrent  = Number(T?.current  || 0);
  const totalPnl      = Number(T?.pnl != null ? T.pnl : (totalCurrent - totalInvested));
  const pnlPct        = Number(T?.pnl_pct != null ? T.pnl_pct : (totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0));

  // ── Cap-wise allocation (Nifty50 / MidCap / SmallCap / Other) ───
  const capBreakdown = useMemo(() => {
    const buckets = { LARGECAP: 0, MIDCAP: 0, SMALLCAP: 0, OTHER: 0 };
    holdings.forEach((h) => {
      const sym = normSym(h);
      const cur = normCmp(h) * normQty(h);
      const grp = (universeMap[sym]?.grp || h.cap_tag || 'OTHER').toUpperCase();
      if (grp === 'LARGECAP' || grp === 'NIFTY50' || grp === 'NIFTYNEXT50') buckets.LARGECAP += cur;
      else if (grp === 'MIDCAP') buckets.MIDCAP += cur;
      else if (grp === 'SMALLCAP') buckets.SMALLCAP += cur;
      else buckets.OTHER += cur;
    });
    return buckets;
  }, [holdings, universeMap]);

  // ── Sector allocation (top 5) ──────────────────────────────────
  const sectorBreakdown = useMemo(() => {
    const m = {};
    holdings.forEach((h) => {
      const sym = normSym(h);
      const sec = h.sector || universeMap[sym]?.sector || 'Unknown';
      const cur = normCmp(h) * normQty(h);
      m[sec] = (m[sec] || 0) + cur;
    });
    const arr = Object.entries(m).map(([k, v]) => ({ sector: k, value: v }));
    arr.sort((a, b) => b.value - a.value);
    return arr.slice(0, 5);
  }, [holdings, universeMap]);

  const handleAdd = async () => {
    if (!form.sym.trim() || !form.qty) return;
    setAdding(true); setMsg('');
    try {
      // Server expects `quantity` + `avg_price` (kite-server.js ~22201).
      await apiPost('/api/holdings', {
        symbol: form.sym.trim().toUpperCase(),
        quantity: Number(form.qty),
        avg_price: Number(form.avgBuy) || 0,
      });
      setForm({ sym: '', qty: '', avgBuy: '' });
      setMsg('Added');
      fetchHoldings();
    } catch (e) { setMsg(`Error: ${e.message}`); }
    finally { setAdding(false); setTimeout(() => setMsg(''), 3000); }
  };

  // ── Delete holding — uses DELETE verb (kite-server.js ~22228) ───
  const handleDelete = async (sym) => {
    if (!window.confirm(`Remove ${sym} from holdings?`)) return;
    try {
      await apiDelete(`/api/holdings/${encodeURIComponent(sym)}`);
      fetchHoldings();
    } catch (e) { setMsg(`Error: ${e.message}`); }
  };

  // ── Refresh CMP — tries dedicated endpoint, falls back to /api/holdings ──
  const refreshCmp = async () => {
    if (cmpRefreshing) return;
    setCmpRefreshing(true);
    try {
      // Best-effort: endpoint may not exist on server yet — silently fall back
      // to re-fetching /api/holdings which re-reads livePrices server-side.
      try { await apiPost('/api/holdings/refresh-cmp'); } catch {}
      fetchHoldings();
    } finally { setCmpRefreshing(false); }
  };

  // ── Deep AI Review (council + judge) ────────────────────────────
  const runAIReview = async () => {
    if (aiRunning) return;
    setAiRunning(true);
    setAiMsg('Running 5-model council + judge across all holdings… (30-60s)');
    try {
      const res = await apiPost('/api/holdings/ai-review');
      const n = Array.isArray(res?.reviews)  ? res.reviews.length
              : Array.isArray(res?.holdings) ? res.holdings.length
              : 0;
      setAiMsg(`Reviewed ${n} holdings`);
      fetchHoldings();   // server now has ai_reviews joined in
    } catch (e) { setAiMsg(`Error: ${e.message}`); }
    finally { setAiRunning(false); setTimeout(() => setAiMsg(''), 6000); }
  };

  const toggleExpand = (sym) => {
    setExpandedAI((prev) => ({ ...prev, [sym]: !prev[sym] }));
  };

  // ── Autocomplete suggestions ────────────────────────────────────
  const suggestions = useMemo(() => {
    if (!Array.isArray(universe)) return [];
    if (!form.sym.trim()) return universe.slice(0, 20);
    const q = form.sym.trim().toUpperCase();
    return universe.filter((s) =>
      (s?.sym || '').toUpperCase().includes(q) || (s?.n || s?.name || '').toUpperCase().includes(q)
    ).slice(0, 20);
  }, [universe, form.sym]);

  const pickSuggestion = (s) => {
    setForm({ ...form, sym: s.sym });
    setShowSuggest(false);
    setTimeout(() => document.getElementById('holdings-qty')?.focus(), 50);
  };

  const handleSymKey = (e) => {
    if (!showSuggest) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && suggestions[selectedIdx]) { e.preventDefault(); pickSuggestion(suggestions[selectedIdx]); }
    else if (e.key === 'Escape') { setShowSuggest(false); }
  };

  const INR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const pnlColor = totalPnl >= 0 ? 'var(--green-text)' : 'var(--red-text)';

  // ── Verdict colour helper (shared with expand panel) ────────────
  const verdictColor = (v) => {
    const u = (v || '').toUpperCase();
    if (u === 'AGREE' || u === 'BUY' || u === 'ACCUMULATE') return 'var(--green-text)';
    if (u === 'DISAGREE' || u === 'SELL' || u === 'AVOID')  return 'var(--red-text)';
    if (u === 'CAUTION' || u === 'HOLD')                    return 'var(--amber-text)';
    return 'var(--text4)';
  };
  const verdictIcon = (v) => {
    const u = (v || '').toUpperCase();
    if (u === 'AGREE') return '✓';
    if (u === 'CAUTION') return '⚠';
    if (u === 'DISAGREE') return '✗';
    return '—';
  };

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div style={{
        background: totalPnl >= 0
          ? 'linear-gradient(135deg, rgba(52,211,153,0.12) 0%, rgba(99,102,241,0.12) 100%)'
          : 'linear-gradient(135deg, rgba(248,113,113,0.12) 0%, rgba(99,102,241,0.12) 100%)',
        border: '1px solid var(--border)', borderRadius: 18, padding: '28px 32px', marginBottom: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -50, right: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(99,102,241,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div className="label-xs" style={{ marginBottom: 8 }}>Your Portfolio · Live CMP + P&L</div>
            <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1, color: 'var(--text)', marginBottom: 12 }}>
              <span className="gradient-fill">Holdings</span>
            </h1>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 14, color: 'var(--text2)' }}>
              <span><b style={{ color: 'var(--text)' }}>{holdings.length}</b> stocks</span>
              <span>Invested <b className="tabular-nums" style={{ color: 'var(--text)' }}>{INR(totalInvested)}</b></span>
              <span>Current <b className="tabular-nums" style={{ color: 'var(--text)' }}>{INR(totalCurrent)}</b></span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div className="tabular-nums" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1, letterSpacing: '-1.5px', color: pnlColor }}>
                {totalPnl >= 0 ? '+' : ''}{INR(totalPnl)}
              </div>
              <div className="tabular-nums" style={{ fontSize: 15, color: pnlColor, marginTop: 6, fontWeight: 600 }}>
                {pnlPct >= 0 ? '+' : ''}{Number(pnlPct).toFixed(2)}%
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button onClick={refreshCmp} disabled={cmpRefreshing} className="btn btn-secondary" style={{ height: 32, fontSize: 12, padding: '0 12px' }}>
                {cmpRefreshing ? '…' : '$ CMP'}
              </button>
              <button onClick={fetchHoldings} className="btn btn-secondary" style={{ height: 32, fontSize: 12, padding: '0 12px' }}>
                Refresh
              </button>
              <button onClick={runAIReview} disabled={aiRunning || holdings.length === 0} className="btn btn-primary" style={{ height: 32, fontSize: 12, padding: '0 12px' }}>
                {aiRunning ? 'Reviewing…' : 'Deep AI Review'}
              </button>
            </div>
          </div>
        </div>
        {aiMsg && (
          <div style={{ marginTop: 10, fontSize: 12, color: aiMsg.startsWith('Error') ? 'var(--red-text)' : 'var(--green-text)' }}>
            {aiMsg}
          </div>
        )}
      </div>

      {/* ── Cap-wise mini-stat cards ────────────────────────────── */}
      {holdings.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
          {[
            { label: 'Large Cap', val: capBreakdown.LARGECAP, chip: 'chip-brand' },
            { label: 'Mid Cap',   val: capBreakdown.MIDCAP,   chip: 'chip-amber' },
            { label: 'Small Cap', val: capBreakdown.SMALLCAP, chip: 'chip-green' },
            ...(capBreakdown.OTHER > 0 ? [{ label: 'Other', val: capBreakdown.OTHER, chip: 'chip' }] : []),
          ].map((c) => {
            const pct = totalCurrent > 0 ? (c.val / totalCurrent) * 100 : 0;
            return (
              <div key={c.label} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="label-xs" style={{ color: 'var(--text3)' }}>{c.label}</span>
                  <span className={`chip ${c.chip}`} style={{ height: 18, fontSize: 9, padding: '0 6px', fontWeight: 700 }}>
                    {pct.toFixed(1)}%
                  </span>
                </div>
                <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                  {INR(c.val)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Sector allocation bar (top 5) ───────────────────────── */}
      {sectorBreakdown.length > 0 && totalCurrent > 0 && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span className="label-xs" style={{ color: 'var(--text3)' }}>Top Sectors</span>
            <span style={{ fontSize: 10, color: 'var(--text4)' }}>{sectorBreakdown.length} sectors</span>
          </div>
          {/* Stacked horizontal bar */}
          <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 10 }}>
            {sectorBreakdown.map((s, i) => {
              const pct = (s.value / totalCurrent) * 100;
              const colors = ['var(--brand-text)', 'var(--green-text)', 'var(--amber-text)', 'var(--red-text)', 'var(--text3)'];
              return (
                <div key={s.sector} title={`${s.sector} ${pct.toFixed(1)}%`}
                  style={{ width: `${pct}%`, background: colors[i % colors.length], transition: 'width 400ms ease' }} />
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11 }}>
            {sectorBreakdown.map((s, i) => {
              const pct = (s.value / totalCurrent) * 100;
              const colors = ['var(--brand-text)', 'var(--green-text)', 'var(--amber-text)', 'var(--red-text)', 'var(--text3)'];
              return (
                <div key={s.sector} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length] }} />
                  <span style={{ color: 'var(--text2)' }}>{s.sector}</span>
                  <span className="tabular-nums" style={{ color: 'var(--text4)' }}>{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Add / Update form ───────────────────────────────────── */}
      <div className="card card-premium" style={{ padding: '18px 22px', marginBottom: 24, overflow: 'visible', position: 'relative', zIndex: 100 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 12 }}>
          Add / Update Holding
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 2, minWidth: 220 }}>
            <input
              ref={symInputRef}
              placeholder="Stock symbol… e.g. RELIANCE"
              value={form.sym}
              onChange={(e) => { setForm({ ...form, sym: e.target.value.toUpperCase() }); setShowSuggest(true); setSelectedIdx(0); }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => setTimeout(() => setShowSuggest(false), 200)}
              onKeyDown={handleSymKey}
              style={{ ...inputStyle, width: '100%' }}
              autoComplete="off"
            />
            {showSuggest && Array.isArray(suggestions) && suggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                background: 'rgba(14,20,35,0.98)', backdropFilter: 'blur(20px)',
                border: '1px solid var(--border2)', borderRadius: 10, maxHeight: 300, overflowY: 'auto',
                zIndex: 999, boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
              }}>
                {suggestions.map((s, i) => (
                  <div
                    key={s.sym}
                    onMouseDown={() => pickSuggestion(s)}
                    onMouseEnter={() => setSelectedIdx(i)}
                    style={{
                      padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                      background: selectedIdx === i ? 'rgba(99,102,241,0.15)' : 'transparent',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text)' }}>{s.sym}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>{s.n || s.name}</div>
                    </div>
                    {s.grp && (
                      <span className="chip" style={{ height: 18, fontSize: 9, padding: '0 6px', fontWeight: 700 }}>
                        {s.grp}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <input id="holdings-qty" placeholder="Qty" type="number"
            value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })}
            style={{ ...inputStyle, width: 80 }} />
          <input placeholder="Avg Buy ₹" type="number"
            value={form.avgBuy} onChange={(e) => setForm({ ...form, avgBuy: e.target.value })}
            style={{ ...inputStyle, width: 120 }} />
          <button onClick={handleAdd} disabled={adding} className="btn btn-primary" style={{ height: 42 }}>
            {adding ? 'Adding…' : '+ Add'}
          </button>
          {msg && <span style={{ fontSize: 13, color: msg.startsWith('Error') ? 'var(--red-text)' : 'var(--green-text)' }}>{msg}</span>}
        </div>
      </div>

      {/* ── Holdings table ──────────────────────────────────────── */}
      {loading ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>
          <div className="animate-pulse-custom">Loading holdings…</div>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: 24, color: 'var(--red-text)' }}>Failed: {error}</div>
      ) : holdings.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, background: 'var(--brand-bg)', border: '1px solid var(--brand-border)',
            margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="8" width="18" height="13" rx="2" stroke="var(--brand-text)" strokeWidth="2" />
              <path d="M7 8 V6 C7 4.9 7.9 4 9 4 H15 C16.1 4 17 4.9 17 6 V8" stroke="var(--brand-text)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No holdings yet</div>
          <div style={{ fontSize: 14, color: 'var(--text3)' }}>Add a stock from the form above to start tracking your portfolio.</div>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  {['#', 'Stock', 'Qty', 'Avg Buy', 'CMP', 'Invested', 'Current', 'P&L', 'P&L %', 'AI', ''].map((h, i) => (
                    <th key={i} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text3)', borderBottom: '1px solid var(--border)', textAlign: i <= 1 ? 'left' : 'right', whiteSpace: 'nowrap', background: 'linear-gradient(145deg, rgba(30,30,44,0.95), rgba(18,18,28,0.95))' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holdings.map((h, i) => {
                  const sym = normSym(h);
                  const qty = normQty(h);
                  const avg = normAvg(h);
                  const cmp = normCmp(h);
                  // Prefer server-supplied invested/current/pnl so rounding matches.
                  const inv = Number(h.invested != null ? h.invested : (avg * qty));
                  const cur = Number(h.current  != null ? h.current  : (cmp * qty));
                  const pnl = Number(h.pnl      != null ? h.pnl      : (cur - inv));
                  const pct = Number(h.pnl_pct  != null ? h.pnl_pct  : (inv > 0 ? (pnl / inv) * 100 : 0));
                  const pc  = pnl >= 0 ? 'var(--green-text)' : 'var(--red-text)';

                  // AI review: could be a single object `ai_review` or an
                  // array `ai_reviews` (server emits the array form — see
                  // kite-server.js line 22174). Normalise both.
                  const reviews = Array.isArray(h.ai_reviews) ? h.ai_reviews : [];
                  const judge   = reviews.find((r) => r?.model_id === 'ai-judge');
                  const council = reviews.filter((r) => r?.model_id !== 'ai-judge');
                  const topVerdict = judge?.verdict || council[0]?.verdict || h.ai_review?.verdict || null;
                  const vCol = verdictColor(topVerdict);
                  const hasReview = reviews.length > 0 || !!h.ai_review;
                  const isOpen = !!expandedAI[sym];

                  return (
                    <React.Fragment key={sym}>
                      <tr style={{ transition: 'background 150ms ease', cursor: hasReview ? 'pointer' : 'default' }}
                        onClick={() => hasReview && toggleExpand(sym)}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={cellStyle}>{i + 1}</td>
                        <td style={{ ...cellStyle, fontWeight: 700 }}>
                          <div>{sym}</div>
                          {(h.name || h.sector) && (
                            <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 500, marginTop: 2 }}>
                              {h.name}{h.name && h.sector ? ' · ' : ''}{h.sector}
                            </div>
                          )}
                        </td>
                        <td className="tabular-nums" style={{ ...cellStyle, textAlign: 'right' }}>{qty}</td>
                        <td className="tabular-nums" style={{ ...cellStyle, textAlign: 'right' }}>{INR(avg)}</td>
                        <td className="tabular-nums" style={{ ...cellStyle, textAlign: 'right', fontWeight: 600 }}>{INR(cmp)}</td>
                        <td className="tabular-nums" style={{ ...cellStyle, textAlign: 'right' }}>{INR(inv)}</td>
                        <td className="tabular-nums" style={{ ...cellStyle, textAlign: 'right' }}>{INR(cur)}</td>
                        <td className="tabular-nums" style={{ ...cellStyle, textAlign: 'right', color: pc, fontWeight: 700 }}>{pnl >= 0 ? '+' : ''}{INR(pnl)}</td>
                        <td className="tabular-nums" style={{ ...cellStyle, textAlign: 'right', color: pc, fontWeight: 600 }}>{pct >= 0 ? '+' : ''}{Number(pct).toFixed(2)}%</td>
                        <td style={{ ...cellStyle, textAlign: 'right' }}>
                          {topVerdict ? (
                            <span className="chip" title={judge?.recommendation || council[0]?.recommendation || ''} style={{
                              height: 20, fontSize: 10, fontWeight: 700,
                              color: vCol, background: `${vCol}22`, border: `1px solid ${vCol}44`,
                            }}>
                              {isOpen ? '▾ ' : '▸ '}{verdictIcon(topVerdict)} {topVerdict}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text4)', fontSize: 11 }}>—</span>
                          )}
                        </td>
                        <td style={{ ...cellStyle, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleDelete(sym)}
                            className="btn btn-secondary"
                            style={{ height: 24, fontSize: 10, padding: '0 8px', color: 'var(--red-text)', borderColor: 'rgba(248,113,113,0.3)' }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                      {/* ── Expanded AI panel (mirrors _holdingsAIExpandedPanel) ── */}
                      {isOpen && hasReview && (
                        <tr className="animate-fadeIn">
                          <td colSpan={11} style={{ padding: '14px 18px', background: 'rgba(99,102,241,0.04)', borderBottom: '1px solid var(--border)' }}>
                            <div className="label-xs" style={{ color: 'var(--text3)', marginBottom: 10 }}>
                              Council Verdicts · {sym}
                              <span style={{ color: 'var(--text4)', fontWeight: 500, textTransform: 'none', marginLeft: 6 }}>
                                (each AI returns Varsity-grounded + pure financial opinions)
                              </span>
                            </div>
                            {/* Council grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8, marginBottom: 12 }}>
                              {council.map((rv, idx) => {
                                const vC = verdictColor(rv.verdict);
                                return (
                                  <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${vC}33`, borderLeft: `3px solid ${vC}`, borderRadius: 8, padding: '10px 12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                      <span style={{ color: vC, fontWeight: 800, fontSize: 12 }}>{verdictIcon(rv.verdict)} {(rv.verdict || '').toUpperCase()}</span>
                                      <span style={{ color: 'var(--text4)', fontSize: 10 }}>· {rv.model_name || rv.model_id}</span>
                                      {rv.confidence != null && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text3)' }}>{rv.confidence}%</span>}
                                    </div>
                                    {/* Varsity lens */}
                                    {(rv.varsity_reasoning || rv.varsity_verdict) && (
                                      <div style={{ background: 'rgba(99,102,241,0.05)', borderRadius: 5, padding: '6px 8px', marginBottom: 5 }}>
                                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--brand-text)', letterSpacing: '0.5px', marginBottom: 3 }}>
                                          WITH VARSITY {rv.varsity_verdict && <span style={{ color: verdictColor(rv.varsity_verdict) }}>· {verdictIcon(rv.varsity_verdict)} {rv.varsity_verdict}</span>}
                                        </div>
                                        {rv.varsity_module && <div style={{ fontSize: 10, color: 'var(--brand-text)', marginBottom: 2 }}>{rv.varsity_module}</div>}
                                        {rv.varsity_reasoning && <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>{rv.varsity_reasoning}</div>}
                                      </div>
                                    )}
                                    {/* Pure lens */}
                                    {(rv.pure_reasoning || rv.pure_verdict) && (
                                      <div style={{ background: 'rgba(167,139,250,0.05)', borderRadius: 5, padding: '6px 8px', marginBottom: 5 }}>
                                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--amber-text)', letterSpacing: '0.5px', marginBottom: 3 }}>
                                          PURE FINANCIAL {rv.pure_verdict && <span style={{ color: verdictColor(rv.pure_verdict) }}>· {verdictIcon(rv.pure_verdict)} {rv.pure_verdict}</span>}
                                        </div>
                                        {rv.pure_reasoning && <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>{rv.pure_reasoning}</div>}
                                      </div>
                                    )}
                                    {rv.recommendation && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}><b style={{ color: 'var(--text2)' }}>Rec:</b> {rv.recommendation}</div>}
                                    {rv.risk_flag && <div style={{ marginTop: 4, display: 'inline-block' }}><span className="chip chip-red" style={{ height: 16, fontSize: 9, padding: '0 6px', fontWeight: 700 }}>{rv.risk_flag}</span></div>}
                                  </div>
                                );
                              })}
                            </div>
                            {/* Judge card */}
                            {judge && judge.verdict && (
                              <div style={{
                                background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(34,211,238,0.08))',
                                border: `1px solid ${verdictColor(judge.verdict)}55`,
                                borderLeft: `3px solid ${verdictColor(judge.verdict)}`,
                                borderRadius: 8, padding: '12px 14px',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                  <span className="gradient-fill" style={{ fontWeight: 900, fontSize: 12, letterSpacing: 1 }}>AI JUDGE · FINAL</span>
                                  <span style={{ color: 'var(--text4)', fontSize: 10 }}>· {judge.model_name || 'Claude'}</span>
                                  <span style={{ color: verdictColor(judge.verdict), fontWeight: 800, fontSize: 13, marginLeft: 'auto' }}>
                                    {verdictIcon(judge.verdict)} {judge.verdict}
                                  </span>
                                  {judge.confidence != null && <span style={{ fontSize: 10, color: 'var(--text3)' }}>{judge.confidence}%</span>}
                                </div>
                                {judge.varsity_reasoning && (
                                  <div style={{ background: 'rgba(99,102,241,0.07)', borderRadius: 5, padding: '7px 10px', marginBottom: 5 }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--brand-text)', letterSpacing: '0.5px', marginBottom: 3 }}>SYNTHESIS WITH VARSITY</div>
                                    <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>{judge.varsity_reasoning}</div>
                                  </div>
                                )}
                                {judge.pure_reasoning && (
                                  <div style={{ background: 'rgba(167,139,250,0.07)', borderRadius: 5, padding: '7px 10px', marginBottom: 5 }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--amber-text)', letterSpacing: '0.5px', marginBottom: 3 }}>SYNTHESIS WITHOUT VARSITY</div>
                                    <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>{judge.pure_reasoning}</div>
                                  </div>
                                )}
                                {judge.recommendation && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}><b style={{ color: 'var(--text2)' }}>Judge Recommendation:</b> {judge.recommendation}</div>}
                                {(judge.why_choose || judge.why_not) && (
                                  <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                                    {judge.why_choose && <div style={{ flex: 1, minWidth: 200, background: 'var(--green-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: 'var(--text2)' }}><b style={{ color: 'var(--green-text)' }}>Why hold:</b> {judge.why_choose}</div>}
                                    {judge.why_not && <div style={{ flex: 1, minWidth: 200, background: 'var(--red-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: 'var(--text2)' }}><b style={{ color: 'var(--red-text)' }}>Why not:</b> {judge.why_not}</div>}
                                  </div>
                                )}
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
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  height: 42, padding: '0 14px',
  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)',
  borderRadius: 12, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
};

const cellStyle = {
  padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 14,
};
