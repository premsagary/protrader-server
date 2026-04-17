import React, { useState, useEffect, useRef } from 'react';
import { apiGet } from '../../api/client';

export default function DeepAnalyzer() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [universe, setUniverse] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    apiGet('/api/stocks/score')
      .then((d) => {
        const list = (d.stocks || d || []).map((s) => ({
          sym: s.sym || s.symbol,
          name: s.name || '',
          grp: s.grp || s.group || '',
        }));
        setUniverse(list);
      })
      .catch(() => setUniverse([]));
  }, []);

  useEffect(() => {
    if (!universe || !query.trim()) { setSuggestions([]); return; }
    const q = query.trim().toUpperCase();
    setSuggestions(
      universe.filter((s) => s.sym?.toUpperCase().startsWith(q) || s.name?.toUpperCase().includes(q)).slice(0, 8)
    );
  }, [query, universe]);

  const handleAnalyze = async () => {
    const sym = (selected?.sym || query).trim().toUpperCase();
    if (!sym) return;
    setLoading(true); setError(null); setAnalysis(null);
    try {
      setAnalysis(await apiGet(`/api/stocks/analyze/${encodeURIComponent(sym)}`));
    } catch (e) {
      setError(e.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const pickSuggestion = (s) => {
    setSelected(s);
    setQuery(`${s.sym} — ${s.name}`);
    setShowDropdown(false);
  };

  return (
    <div>
      {/* ═══ HERO BANNER — matches landing page quality ═══ */}
      <div
        style={{
          background: 'var(--gradient)',
          borderRadius: 18,
          padding: '36px 40px',
          marginBottom: 28,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-brand)',
        }}
      >
        {/* Decorative orbs */}
        <div style={{ position: 'absolute', top: -80, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -100, left: 40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)', marginBottom: 12 }}>
            Flagship · 14-Point Varsity Checklist
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.05, color: '#fff', marginBottom: 14 }}>
            Deep Stock Analyzer
          </h1>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.85)', maxWidth: 680, lineHeight: 1.55, marginBottom: 0 }}>
            30+ technical indicators, support/resistance mapping, exact buy zones, Fibonacci levels, and live news sentiment — for every NSE stock.
          </p>
        </div>
      </div>

      {/* ═══ SEARCH CARD — glass + premium border ═══ */}
      {/* overflow:visible required so autocomplete dropdown is not clipped
          by card's default overflow:hidden (which is needed for ::before glow) */}
      <div
        className="card card-premium"
        style={{ padding: '20px 24px', marginBottom: 28, overflow: 'visible', position: 'relative', zIndex: 100 }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 280 }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }}>
              <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 12 L15 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelected(null); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 180)}
              onKeyDown={(e) => { if (e.key === 'Enter') { suggestions.length ? pickSuggestion(suggestions[0]) : handleAnalyze(); } }}
              placeholder="Search stock… e.g. RELIANCE, TCS, HDFCBANK"
              style={{
                width: '100%', height: 50, padding: '0 18px 0 44px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)',
                borderRadius: 14, color: 'var(--text)', fontSize: 16, fontFamily: 'inherit', outline: 'none',
                transition: 'border-color 200ms ease, box-shadow 200ms ease',
              }}
              onFocusCapture={(e) => { e.target.style.borderColor = 'var(--brand-border)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.2)'; }}
              onBlurCapture={(e) => { e.target.style.borderColor = 'var(--border2)'; e.target.style.boxShadow = 'none'; }}
            />

            {showDropdown && suggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                background: 'linear-gradient(145deg, #1E1E28, #161620)', border: '1px solid var(--border2)',
                borderRadius: 14, boxShadow: 'var(--shadow-lg)', zIndex: 1000, overflow: 'hidden',
                maxHeight: 320, overflowY: 'auto',
              }}>
                {suggestions.map((s) => (
                  <button
                    key={s.sym}
                    onMouseDown={() => pickSuggestion(s)}
                    style={{
                      display: 'flex', width: '100%', padding: '12px 18px', background: 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left', gap: 14, alignItems: 'center',
                      transition: 'background 150ms ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', minWidth: 100 }}>{s.sym}</span>
                    <span style={{ fontSize: 14, color: 'var(--text3)', flex: 1 }}>{s.name}</span>
                    {s.grp && <span className="chip" style={{ height: 22, fontSize: 10, padding: '0 8px' }}>{s.grp}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading || !query.trim()}
            className="btn btn-primary"
            style={{ height: 50, padding: '0 26px', fontSize: 16, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              <><span className="animate-pulse-custom">Analyzing…</span></>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><path d="M7 1 L2 8 H7 L6 13 L12 6 H7 Z" fill="currentColor" /></svg>
                Analyze
              </>
            )}
          </button>

          <div className="chip" style={{ marginLeft: 'auto' }}>
            <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--brand-text)' }}>
              {universe ? universe.length : 567}
            </span>
            stocks · Candles + fundamentals + news
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '16px 20px', background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 14, color: 'var(--red-text)', fontSize: 15, marginBottom: 24,
        }}>
          <b>Analysis failed:</b> {error}
        </div>
      )}

      {/* Analysis result */}
      {analysis && <AnalysisResult data={analysis} />}

      {/* ═══ EMPTY STATE — dramatic, inviting ═══ */}
      {!analysis && !error && !loading && (
        <div style={{ padding: '80px 24px', textAlign: 'center' }}>
          <div style={{
            width: 80, height: 80, borderRadius: 22,
            background: 'var(--gradient)', boxShadow: 'var(--shadow-brand)',
            margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path d="M4 16 L9 10 L13 13 L20 5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 5 H20 V10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.4px' }}>
            Pick any NSE stock to begin
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text3)', maxWidth: 420, margin: '0 auto', lineHeight: 1.5 }}>
            Type a symbol above — works with 500+ stocks across Nifty 50, Next 50, Midcap, and Smallcap.
          </p>

          {/* Quick-pick chips */}
          <div style={{ marginTop: 28, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ITC'].map((sym) => (
              <button
                key={sym}
                onClick={() => { setQuery(sym); setSelected({ sym }); }}
                className="btn btn-secondary"
                style={{ height: 36, fontSize: 13, padding: '0 16px', borderRadius: 10 }}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Analysis Result — full rendering of /api/stocks/analyze/:sym response
   Ported from renderStockAnalyzerPage() in public/app.html (Apr-2026)
   Sections: hero scorecard · verdict card · checklist · analysis signals
             · support/resistance · when-to-buy · targets · buying plan
             · fundamentals · technical indicators · Fibonacci · Ichimoku
             · news sentiment · AI review (separate endpoint)
   ═══════════════════════════════════════════════════════════════════════ */
function AnalysisResult({ data }) {
  const a = data || {};
  const score = a.pctScore ?? a.score ?? null;
  const verdict = a.verdict || '';
  const verdictIcon = a.verdictIcon || '';
  const action = a.action || '';
  const verdictTimeframe = a.verdictTimeframe || '';
  const tierColor = score >= 75 ? 'var(--green-text)'
                  : score >= 60 ? 'var(--green-text)'
                  : score >= 45 ? 'var(--amber-text)'
                  : score >= 30 ? 'var(--amber-text)'
                  : 'var(--red-text)';
  const tierBg = score >= 60 ? 'var(--green-bg)'
               : score >= 45 ? 'var(--amber-bg)'
               : 'var(--red-bg)';

  const tech = a.tech || {};
  const fund = a.fund || null;
  const checklist = a.checklist || {};
  const analysis = a.analysis || [];
  const targets = a.targets || [];
  const whenToBuy = a.whenToBuy || [];
  const supports = a.supports || [];
  const resistances = a.resistances || [];
  const buyPlan = a.buyPlan || null;
  const news = a.news || [];
  const sentiment = a.sentiment || {};
  const fibs = a.fibs || null;
  const ichimoku = a.ichimoku || tech.ichimoku || null;
  const patterns = a.patterns || [];

  return (
    <div className="animate-fadeIn">
      {/* ═══ HERO SCORECARD ═══ */}
      <div
        style={{
          background: score >= 60
            ? 'linear-gradient(135deg, rgba(52,211,153,0.12) 0%, rgba(99,102,241,0.12) 100%)'
            : score >= 45
              ? 'linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(99,102,241,0.12) 100%)'
              : 'linear-gradient(135deg, rgba(248,113,113,0.12) 0%, rgba(99,102,241,0.12) 100%)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: '32px 36px',
          marginBottom: 18,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 24,
        }}
      >
        <div>
          <div className="label-xs" style={{ marginBottom: 10 }}>
            {a.grp || 'NSE'}{a.sector ? ` · ${a.sector}` : ''}
          </div>
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.8px', color: 'var(--text)', marginBottom: 6, lineHeight: 1.1 }}>
            {a.sym || '—'}
          </h2>
          <div style={{ fontSize: 16, color: 'var(--text2)', marginBottom: 14 }}>
            {a.name || ''}
            {a.price != null && <span className="tabular-nums" style={{ marginLeft: 14, color: 'var(--text)', fontWeight: 700, fontSize: 20 }}>₹{Number(a.price).toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>}
          </div>
          {verdict && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px',
                background: tierBg, color: tierColor,
                borderRadius: 9999, fontSize: 13, fontWeight: 700, letterSpacing: '0.3px',
              }}>
                {verdictIcon} {verdict}
              </span>
              {action && (
                <span className="chip chip-brand" style={{ height: 30, fontSize: 12, fontWeight: 700 }}>{action}</span>
              )}
            </div>
          )}
          {verdictTimeframe && (
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 10, fontStyle: 'italic' }}>{verdictTimeframe}</div>
          )}
        </div>
        {score != null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
              Varsity Score
            </div>
            <div className="tabular-nums gradient-fill" style={{ fontSize: 72, fontWeight: 800, lineHeight: 1, letterSpacing: '-2px' }}>
              {Math.round(score)}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 4, fontWeight: 500 }}>
              / 100 · {a.passCount || 0}/{a.totalChecks || 0} checks pass
            </div>
          </div>
        )}
      </div>

      {/* ═══ AT-A-GLANCE METRICS ═══ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 10,
        marginBottom: 18,
      }}>
        <MetricPill label="RSI-14" value={tech.rsi14} fmt={(v) => Math.round(v)}
          color={(v) => v == null ? 'var(--text4)' : v < 30 ? 'var(--green-text)' : v > 70 ? 'var(--red-text)' : 'var(--text)'} />
        <MetricPill label="ADX" value={tech.adx} fmt={(v) => Math.round(v)} sub={tech.trendStrength} />
        <MetricPill label="R:R" value={a.riskReward || tech.riskReward} fmt={(v) => v ? `${Number(v).toFixed(2)}x` : '—'}
          color={(v) => v >= 2 ? 'var(--green-text)' : v >= 1.5 ? 'var(--amber-text)' : 'var(--red-text)'} />
        <MetricPill label="Upside" value={a.upsidePct || tech.upsidePct} fmt={(v) => v != null ? `${Number(v).toFixed(1)}%` : '—'}
          color={(v) => v > 0 ? 'var(--green-text)' : 'var(--red-text)'} />
        {fund?.roe != null && <MetricPill label="ROE" value={fund.roe} fmt={(v) => `${Number(v).toFixed(1)}%`}
          color={(v) => v >= 15 ? 'var(--green-text)' : v >= 10 ? 'var(--amber-text)' : 'var(--red-text)'} />}
        {fund?.de != null && <MetricPill label="D/E" value={fund.de} fmt={(v) => `${Number(v).toFixed(2)}x`}
          color={(v) => v < 1 ? 'var(--green-text)' : v < 2 ? 'var(--text)' : 'var(--red-text)'} />}
        {fund?.pe != null && <MetricPill label="P/E" value={fund.pe} fmt={(v) => Number(v).toFixed(1)}
          color={(v) => v < 20 ? 'var(--green-text)' : v < 35 ? 'var(--text)' : 'var(--red-text)'} />}
      </div>

      {/* ═══ VARSITY 14-POINT CHECKLIST ═══ */}
      {Object.keys(checklist).length > 0 && (
        <Section title="Varsity 14-Point Checklist" subtitle={`${a.passCount || 0}/${a.totalChecks || 0} criteria pass · ${a.totalPts || 0}/${a.maxPts || 0} points · Varsity Modules 1-17`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
            {Object.entries(checklist).map(([key, c]) => (
              <div key={key} style={{
                padding: 14,
                background: c.pass ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${c.pass ? 'rgba(52,211,153,0.25)' : 'var(--border)'}`,
                borderRadius: 10,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.pass ? 'var(--green-text)' : 'var(--text)', letterSpacing: '-0.1px' }}>
                    {c.pass ? '✓' : '○'} {c.label}
                  </div>
                  <span className="chip tabular-nums" style={{
                    height: 20, fontSize: 10, fontWeight: 700, padding: '0 7px',
                    background: c.pass ? 'var(--green-bg)' : 'rgba(255,255,255,0.04)',
                    color: c.pass ? 'var(--green-text)' : 'var(--text3)',
                  }}>{c.pts}/{c.max}</span>
                </div>
                {c.detail && (
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5 }}>{c.detail}</div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ═══ STAGGERED BUYING PLAN ═══ */}
      {buyPlan && (
        <Section title="Staggered Buying Plan" subtitle="Three-tranche entry + stop-loss + two targets">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {['tranche1', 'tranche2', 'tranche3'].map((k, i) => {
              const t = buyPlan[k];
              if (!t) return null;
              const colors = ['var(--green-text)', 'var(--amber-text)', 'var(--brand-text)'];
              return (
                <div key={k} style={{ padding: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.5px' }}>TRANCHE {i + 1} · {t.pct}%</div>
                  <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 800, color: colors[i], marginTop: 4 }}>₹{t.price}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, lineHeight: 1.4 }}>{t.when}</div>
                </div>
              );
            })}
            {buyPlan.stopLoss && (
              <div style={{ padding: 14, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--red-text)', fontWeight: 700, letterSpacing: '0.5px' }}>STOP LOSS</div>
                <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 800, color: 'var(--red-text)', marginTop: 4 }}>₹{buyPlan.stopLoss}</div>
              </div>
            )}
            {buyPlan.target1 && buyPlan.target1 !== 'N/A' && (
              <div style={{ padding: 14, background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--green-text)', fontWeight: 700, letterSpacing: '0.5px' }}>TARGET 1</div>
                <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 800, color: 'var(--green-text)', marginTop: 4 }}>₹{buyPlan.target1}</div>
              </div>
            )}
            {buyPlan.target2 && buyPlan.target2 !== 'N/A' && (
              <div style={{ padding: 14, background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--green-text)', fontWeight: 700, letterSpacing: '0.5px' }}>TARGET 2</div>
                <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 800, color: 'var(--green-text)', marginTop: 4 }}>₹{buyPlan.target2}</div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ═══ SUPPORT / RESISTANCE / WHEN-TO-BUY ═══ */}
      {(supports.length > 0 || resistances.length > 0 || whenToBuy.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 18 }}>
          {supports.length > 0 && (
            <div className="card" style={{ padding: 18 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-text)', marginBottom: 10, letterSpacing: '-0.1px' }}>
                🛡 Support Zones
              </h3>
              {supports.slice(0, 5).map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', fontSize: 12 }}>
                  <span style={{ color: 'var(--text3)' }}>S{i + 1}</span>
                  <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--text)' }}>₹{Number(s.price).toFixed(1)}</span>
                  {s.strength != null && <span style={{ color: 'var(--text3)', fontSize: 10 }}>× {s.strength}</span>}
                </div>
              ))}
            </div>
          )}
          {resistances.length > 0 && (
            <div className="card" style={{ padding: 18 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--red-text)', marginBottom: 10, letterSpacing: '-0.1px' }}>
                🚧 Resistance Zones
              </h3>
              {resistances.slice(0, 5).map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', fontSize: 12 }}>
                  <span style={{ color: 'var(--text3)' }}>R{i + 1}</span>
                  <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--text)' }}>₹{Number(r.price).toFixed(1)}</span>
                  {r.strength != null && <span style={{ color: 'var(--text3)', fontSize: 10 }}>× {r.strength}</span>}
                </div>
              ))}
            </div>
          )}
          {whenToBuy.length > 0 && (
            <div className="card" style={{ padding: 18 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-text)', marginBottom: 10, letterSpacing: '-0.1px' }}>
                🎯 When to Buy
              </h3>
              {whenToBuy.slice(0, 6).map((w, i) => (
                <div key={i} style={{ padding: '7px 0', borderBottom: i < whenToBuy.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{w.type}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                      background: w.priority === 'HIGH' ? 'var(--green-bg)' : 'var(--amber-bg)',
                      color: w.priority === 'HIGH' ? 'var(--green-text)' : 'var(--amber-text)',
                    }}>{w.priority}</span>
                  </div>
                  <div className="tabular-nums" style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>₹{w.price}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, lineHeight: 1.3 }}>{w.why}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ PRICE TARGETS ═══ */}
      {targets.length > 0 && (
        <Section title="Price Targets" subtitle="Upside to each resistance zone + 52W high">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {targets.map((t, i) => (
              <div key={i} style={{ padding: 14, background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.18)', borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.5px' }}>{t.label}</div>
                <div className="tabular-nums" style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>₹{Number(t.price).toFixed(1)}</div>
                {t.upside != null && <div className="tabular-nums" style={{ fontSize: 12, color: t.upside > 0 ? 'var(--green-text)' : 'var(--red-text)', fontWeight: 700, marginTop: 2 }}>{t.upside > 0 ? '+' : ''}{t.upside}%</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ═══ PLAIN-ENGLISH ANALYSIS ═══ */}
      {analysis.length > 0 && (
        <Section title="Plain-English Analysis" subtitle={`${analysis.length} signals across trend, momentum, valuation, volume, fundamentals`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {analysis.map((sig, i) => {
              const color = sig.signal === 'positive' ? 'var(--green-text)'
                          : sig.signal === 'negative' ? 'var(--red-text)'
                          : sig.signal === 'bullish' ? 'var(--green-text)'
                          : sig.signal === 'bearish' ? 'var(--red-text)'
                          : 'var(--amber-text)';
              const bg = sig.signal === 'positive' || sig.signal === 'bullish' ? 'rgba(52,211,153,0.05)'
                       : sig.signal === 'negative' || sig.signal === 'bearish' ? 'rgba(248,113,113,0.05)'
                       : 'rgba(251,191,36,0.05)';
              return (
                <div key={i} style={{
                  padding: 14, background: bg, border: `1px solid ${color}33`, borderRadius: 10,
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <div style={{ fontSize: 20, flexShrink: 0 }}>{sig.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color }}>{sig.title}</span>
                      <span className="chip" style={{ height: 16, fontSize: 9, padding: '0 5px', fontWeight: 700, background: 'rgba(255,255,255,0.04)', color: 'var(--text3)' }}>{sig.cat}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{sig.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ═══ FUNDAMENTALS ═══ */}
      {fund && (
        <Section title="Fundamentals" subtitle="Varsity Module 3 — Quality + Growth + Valuation">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            {[
              { l: 'ROE',       v: fund.roe,     s: '%', peer: fund.roePeer },
              { l: 'ROA',       v: fund.roa,     s: '%' },
              { l: 'ROCE',      v: fund.roce,    s: '%' },
              { l: 'D/E',       v: fund.de,      s: 'x', peer: fund.dePeer },
              { l: 'P/E',       v: fund.pe,      s: 'x', peer: fund.pePeer },
              { l: 'P/B',       v: fund.pb,      s: 'x' },
              { l: 'PEG',       v: fund.peg,     s: '' },
              { l: 'EV/EBITDA', v: fund.evEbitda, s: 'x' },
              { l: 'EPS Growth',v: fund.epsGr,   s: '%', peer: fund.growthPeer },
              { l: 'Op Margin', v: fund.opMgn,   s: '%' },
              { l: 'Net Margin',v: fund.netMgn,  s: '%' },
              { l: 'Div Yield', v: fund.divYld,  s: '%' },
            ].filter((x) => x.v != null).map((x, i) => (
              <div key={i} style={{ padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.5px' }}>{x.l}</div>
                <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>
                  {Number(x.v).toFixed(x.s === '%' || x.s === 'x' ? 1 : 2)}{x.s}
                </div>
                {x.peer && <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 3 }}>{x.peer}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ═══ TECHNICAL INDICATORS ═══ */}
      {Object.keys(tech).length > 0 && (
        <Section title="Technical Indicators" subtitle="30+ indicators across moving averages, oscillators, trend, volume">
          <TechnicalsGrid t={tech} />
        </Section>
      )}

      {/* ═══ FIBONACCI ═══ */}
      {fibs && (
        <Section title="Fibonacci Retracement" subtitle="Key pullback levels — 23.6 / 38.2 / 50 / 61.8 / 78.6">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
            {[
              { l: '0%',    v: fibs.r0 },
              { l: '23.6%', v: fibs.r236 },
              { l: '38.2%', v: fibs.r382 },
              { l: '50%',   v: fibs.r50 },
              { l: '61.8%', v: fibs.r618, golden: true },
              { l: '78.6%', v: fibs.r786 },
              { l: '100%',  v: fibs.r100 },
            ].filter((x) => x.v != null).map((x, i) => (
              <div key={i} style={{
                padding: 12,
                background: x.golden ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${x.golden ? 'rgba(251,191,36,0.3)' : 'var(--border)'}`,
                borderRadius: 10,
              }}>
                <div style={{ fontSize: 10, color: x.golden ? 'var(--amber-text)' : 'var(--text3)', fontWeight: 700, letterSpacing: '0.5px' }}>
                  {x.l}{x.golden && ' ★'}
                </div>
                <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>₹{Number(x.v).toFixed(1)}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ═══ ICHIMOKU ═══ */}
      {ichimoku && ichimoku.tenkan != null && (
        <Section title="Ichimoku Cloud (Varsity M2 Ch21)" subtitle={ichimoku.bullish ? '☁ Bullish — above cloud + TK cross up' : '⛈ Caution — below or inside cloud'}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            {[
              { l: 'Tenkan (9)',  v: ichimoku.tenkan },
              { l: 'Kijun (26)',  v: ichimoku.kijun },
              { l: 'Senkou A',    v: ichimoku.senkouA },
              { l: 'Senkou B',    v: ichimoku.senkouB },
              { l: 'Chikou',      v: ichimoku.chikou },
            ].filter((x) => x.v != null).map((x, i) => (
              <div key={i} style={{ padding: 12, background: 'rgba(212,160,23,0.06)', border: '1px solid rgba(212,160,23,0.2)', borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: '#d4a017', fontWeight: 700, letterSpacing: '0.5px' }}>{x.l}</div>
                <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>₹{Number(x.v).toFixed(1)}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ═══ CANDLESTICK PATTERNS ═══ */}
      {patterns.length > 0 && (
        <Section title="Candlestick Patterns" subtitle={`${patterns.length} pattern(s) detected`}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {patterns.map((p, i) => (
              <span key={i} className="chip" style={{
                height: 28, fontSize: 12, fontWeight: 700, padding: '0 12px',
                background: p.signal === 'bullish' ? 'var(--green-bg)' : 'var(--red-bg)',
                color: p.signal === 'bullish' ? 'var(--green-text)' : 'var(--red-text)',
                border: `1px solid ${p.signal === 'bullish' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
              }} title={p.desc || ''}>
                🕯 {p.name}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* ═══ NEWS & SENTIMENT ═══ */}
      {news.length > 0 && (
        <Section title="News & Sentiment" subtitle={`${sentiment.bull || 0} bullish · ${sentiment.bear || 0} bearish · ${sentiment.neutral || 0} neutral · last 24-72h`}>
          {/* Sentiment bar */}
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ flex: sentiment.bull || 0, background: 'var(--green)' }} />
            <div style={{ flex: sentiment.neutral || 0.1, background: 'var(--amber)' }} />
            <div style={{ flex: sentiment.bear || 0, background: 'var(--red)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {news.slice(0, 10).map((n, i) => {
              const color = n.sentiment === 'bullish' ? 'var(--green-text)'
                          : n.sentiment === 'bearish' ? 'var(--red-text)'
                          : 'var(--amber-text)';
              return (
                <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" style={{
                  display: 'block', padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none',
                  transition: 'background 150ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1, minWidth: 0 }}>{n.title}</span>
                    <span style={{ fontSize: 10, color, fontWeight: 700, textTransform: 'uppercase' }}>{n.sentiment}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{n.src} · {n.timeAgo}</div>
                </a>
              );
            })}
          </div>
        </Section>
      )}

      {/* ═══ AI REVIEW LAUNCHER ═══ */}
      <AIReviewSection sym={a.sym} />

      {/* Disclaimer */}
      <div style={{ marginTop: 28, padding: 16, background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, fontSize: 11, color: 'var(--text3)', lineHeight: 1.55 }}>
        ⚠ <b>Disclaimer:</b> ProTrader is not SEBI-registered and does not provide financial advice. All data, scores, and AI outputs are for educational purposes only. Data may be delayed. You are responsible for your own investment decisions.
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════
function Section({ title, subtitle, children }) {
  return (
    <div className="card" style={{ padding: 22, marginBottom: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.2px', marginBottom: subtitle ? 4 : 0 }}>
          {title}
        </h3>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function MetricPill({ label, value, fmt, color, sub }) {
  if (value == null || (typeof value === 'number' && !isFinite(value))) return null;
  const col = typeof color === 'function' ? color(value) : (color || 'var(--text)');
  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase' }}>{label}</div>
      <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 800, color: col, marginTop: 4, letterSpacing: '-0.4px' }}>
        {fmt ? fmt(value) : value}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function TechnicalsGrid({ t }) {
  const groups = [
    {
      name: 'Moving Averages', icon: '📉', color: 'var(--red-text)',
      items: [
        ['9-EMA',   t.ema9],   ['20-EMA',  t.ema20],
        ['50-EMA',  t.ema50],  ['200-EMA', t.ema200],
        ['9-DMA',   t.dma9],   ['20-DMA',  t.dma20],
        ['50-DMA',  t.dma50],  ['100-DMA', t.dma100],
        ['150-DMA', t.dma150], ['200-DMA', t.dma200],
      ],
      fmt: (v) => v != null ? `₹${Number(v).toFixed(1)}` : '—',
    },
    {
      name: 'Oscillators', icon: '🌀', color: 'var(--amber-text)',
      items: [
        ['RSI-7',  t.rsi7],  ['RSI-14', t.rsi14], ['RSI-21', t.rsi21],
        ['Stoch-K', t.stochK], ['Stoch-D', t.stochD],
        ['MACD',    t.macd || t.macdVal], ['MACD Hist', t.macdHist],
        ['Williams %R', t.willR], ['CCI', t.cci],
      ],
      fmt: (v) => v != null ? Number(v).toFixed(1) : '—',
    },
    {
      name: 'Trend & Volatility', icon: '📊', color: 'var(--brand-text)',
      items: [
        ['ADX',       t.adx],    ['+DI', t.adxPlus], ['-DI', t.adxMinus],
        ['ATR-14',    t.atr14],  ['ATR %', t.atrPct],
        ['BB Upper',  t.bbUpper], ['BB Lower', t.bbLower],
        ['BB Width',  t.bbWidth], ['BB %',     t.bbPct],
        ['Supertrend', t.supertrendVal], ['SAR', t.sar],
      ],
      fmt: (v) => v != null ? Number(v).toFixed(2) : '—',
    },
    {
      name: 'Volume & Accumulation', icon: '📈', color: 'var(--green-text)',
      items: [
        ['Vol Ratio',  t.volRatio],
        ['OBV',        t.obv],
        ['Accum/Dist', t.accumDist],
        ['Bullish Div', t.bullishDiv ? 'Yes' : 'No'],
        ['Bearish Div', t.bearishDiv ? 'Yes' : 'No'],
      ],
      fmt: (v) => v == null ? '—' : typeof v === 'number' ? Number(v).toFixed(2) : String(v),
    },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
      {groups.map((g) => {
        const visible = g.items.filter(([, v]) => v != null && v !== '—');
        if (visible.length === 0) return null;
        return (
          <div key={g.name} style={{ padding: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: g.color, marginBottom: 10, letterSpacing: '-0.1px' }}>
              {g.icon} {g.name}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
              {visible.map(([label, val], i) => (
                <React.Fragment key={i}>
                  <span style={{ color: 'var(--text3)' }}>{label}</span>
                  <span className="tabular-nums" style={{ color: 'var(--text)', textAlign: 'right', fontWeight: 500 }}>
                    {g.fmt(val)}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// AI Review — launches the 5-model Council + Judge via /ai endpoint
// ══════════════════════════════════════════════════════════════════════
function AIReviewSection({ sym }) {
  const [state, setState] = useState('idle'); // 'idle' | 'running' | 'done' | 'error'
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);

  const runReview = async () => {
    if (!sym) return;
    setState('running'); setErr(null); setResult(null);
    try {
      const res = await apiGet(`/api/stocks/analyze/${encodeURIComponent(sym)}/ai`);
      setResult(res);
      setState('done');
    } catch (e) {
      setErr(e.message || 'Failed');
      setState('error');
    }
  };

  const judge = result?.judge || result?.final || null;
  const council = result?.council || result?.models || [];
  const verdictColor = judge?.verdict === 'BUY' || judge?.verdict === 'STRONG_BUY' ? 'var(--green-text)'
                     : judge?.verdict === 'HOLD' || judge?.verdict === 'ACCUMULATE' ? 'var(--amber-text)'
                     : judge?.verdict === 'SELL' || judge?.verdict === 'AVOID' ? 'var(--red-text)'
                     : 'var(--brand-text)';

  return (
    <Section title="🧠 Deep AI Review" subtitle="5-model Council (Groq Llama 3.3 70B · GPT-4.1 · DeepSeek V3 · Gemini 2.5 Flash · Qwen 3 Max) + Claude Sonnet 4.6 Judge">
      {state === 'idle' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55, marginBottom: 14 }}>
            Sends the full feature bundle (fundamentals, TA, news, sector context, Varsity modules) to 5 LLMs in parallel. Judge synthesises into a single ordered verdict with why_choose, why_not, confidence.
          </p>
          <button onClick={runReview} className="btn btn-primary" style={{ height: 40, fontSize: 13 }}>
            ▶ Run AI Review
          </button>
        </div>
      )}
      {state === 'running' && (
        <div className="animate-pulse-custom" style={{ padding: 28, textAlign: 'center', fontSize: 14, color: 'var(--text2)' }}>
          Running 5-model council + judge… (20-40s)
        </div>
      )}
      {state === 'error' && (
        <div style={{ padding: 16, background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, color: 'var(--red-text)', fontSize: 13 }}>
          ❌ {err}
          <button onClick={runReview} className="btn btn-secondary" style={{ height: 30, fontSize: 11, marginLeft: 10 }}>
            Retry
          </button>
        </div>
      )}
      {state === 'done' && (
        <div>
          {/* Judge verdict */}
          {judge && (
            <div style={{
              padding: 18, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 12, marginBottom: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span className="chip" style={{ height: 22, fontSize: 10, fontWeight: 700, background: 'var(--brand-bg)', color: 'var(--brand-text)' }}>
                  ⚖ JUDGE · Claude Sonnet 4.6
                </span>
                {judge.confidence != null && (
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>Confidence: <b style={{ color: 'var(--text)' }}>{judge.confidence}/10</b></span>
                )}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: verdictColor, marginBottom: 8, letterSpacing: '-0.4px' }}>
                {judge.verdict || '—'}
              </div>
              {judge.why_choose && (
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 6 }}>
                  <b style={{ color: 'var(--green-text)' }}>Why buy:</b> {judge.why_choose}
                </div>
              )}
              {judge.why_not && (
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                  <b style={{ color: 'var(--red-text)' }}>Why not:</b> {judge.why_not}
                </div>
              )}
            </div>
          )}
          {/* Council breakdown */}
          {council.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 10 }}>
                Council · {council.length} models
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                {council.map((m, i) => {
                  const v = m.verdict || m.recommendation;
                  const vCol = v === 'BUY' || v === 'STRONG_BUY' ? 'var(--green-text)'
                             : v === 'HOLD' || v === 'ACCUMULATE' ? 'var(--amber-text)'
                             : v === 'SELL' || v === 'AVOID' ? 'var(--red-text)' : 'var(--text2)';
                  return (
                    <div key={i} style={{ padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {m.name || m.id || `Model ${i + 1}`}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: vCol, whiteSpace: 'nowrap', marginLeft: 6 }}>{v || '—'}</span>
                      </div>
                      {m.confidence != null && (
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>Confidence: {m.confidence}/10</div>
                      )}
                      {m.reasoning && (
                        <div style={{ fontSize: 10.5, color: 'var(--text3)', lineHeight: 1.45, marginTop: 6, maxHeight: 64, overflow: 'hidden' }}>
                          {m.reasoning}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
