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
  const [highlightIdx, setHighlightIdx] = useState(-1); // keyboard-nav highlight
  const inputRef = useRef(null);

  useEffect(() => {
    apiGet('/api/stocks/score')
      .then((d) => {
        const raw = Array.isArray(d?.stocks) ? d.stocks : (Array.isArray(d) ? d : []);
        const list = raw.map((s) => ({
          sym: s.sym || s.symbol,
          name: s.name || '',
          grp: s.grp || s.group || '',
        }));
        setUniverse(list);
      })
      .catch(() => setUniverse([]));
  }, []);

  useEffect(() => {
    if (!universe || !query.trim()) { setSuggestions([]); setHighlightIdx(-1); return; }
    const q = query.trim().toUpperCase();
    const arr = Array.isArray(universe) ? universe : [];
    setSuggestions(
      arr.filter((s) => s.sym?.toUpperCase().startsWith(q) || s.name?.toUpperCase().includes(q)).slice(0, 8)
    );
    setHighlightIdx(-1);
  }, [query, universe]);

  const runAnalyze = async (symRaw) => {
    const sym = (symRaw || '').trim().toUpperCase().split(/\s+/)[0].replace(/[^A-Z0-9&]/g, '');
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

  const handleAnalyze = () => {
    const sym = selected?.sym || query;
    runAnalyze(sym);
  };

  const pickSuggestion = (s) => {
    setSelected(s);
    setQuery(`${s.sym} — ${s.name}`);
    setShowDropdown(false);
    runAnalyze(s.sym);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === 'Enter') { handleAnalyze(); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && suggestions[highlightIdx]) {
        pickSuggestion(suggestions[highlightIdx]);
      } else if (suggestions[0]) {
        pickSuggestion(suggestions[0]);
      } else {
        handleAnalyze();
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
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
              onKeyDown={handleKeyDown}
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
                {suggestions.map((s, i) => (
                  <button
                    key={s.sym}
                    onMouseDown={() => pickSuggestion(s)}
                    onMouseEnter={() => setHighlightIdx(i)}
                    style={{
                      display: 'flex', width: '100%', padding: '12px 18px',
                      background: i === highlightIdx ? 'rgba(99,102,241,0.12)' : 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left', gap: 14, alignItems: 'center',
                      transition: 'background 150ms ease',
                      borderLeft: i === highlightIdx ? '3px solid var(--brand)' : '3px solid transparent',
                    }}
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
                onClick={() => { setQuery(sym); setSelected({ sym }); runAnalyze(sym); }}
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
  const analysis = Array.isArray(a.analysis) ? a.analysis : [];
  const targets = Array.isArray(a.targets) ? a.targets : [];
  const whenToBuy = Array.isArray(a.whenToBuy) ? a.whenToBuy : [];
  const supports = Array.isArray(a.supports) ? a.supports : [];
  const resistances = Array.isArray(a.resistances) ? a.resistances : [];
  const buyPlan = a.buyPlan || null;
  const news = Array.isArray(a.news) ? a.news : [];
  const sentiment = a.sentiment || {};
  const fibs = a.fibs || null;
  const ichimoku = a.ichimoku || tech.ichimoku || null;
  const patterns = Array.isArray(a.patterns) ? a.patterns : [];
  const dataAvail = a.dataAvailable || {};
  const currentPrice = a.price != null ? Number(a.price) : null;

  // -- Score countup animation (ported from app.html ~line 7232) -----------
  const [countupScore, setCountupScore] = useState(0);
  useEffect(() => {
    if (score == null) return;
    const target = Math.round(score);
    const step = Math.max(1, Math.round(target / 40));
    let cur = 0;
    const iv = setInterval(() => {
      cur += step;
      if (cur >= target) { cur = target; clearInterval(iv); }
      setCountupScore(cur);
    }, 25);
    return () => clearInterval(iv);
  }, [score]);

  // -- Price-chart timeframe state (UI only; canvas chart skipped) ---------
  const [chartTf, setChartTf] = useState('1Y');

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
              {countupScore}
            </div>
            {/* Progress bar under the score */}
            <div style={{ height: 6, width: 160, marginLeft: 'auto', marginTop: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${countupScore}%`, background: tierColor, borderRadius: 3, transition: 'width 200ms ease' }} />
            </div>
            <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 4, fontWeight: 500 }}>
              / 100 · {a.passCount || 0}/{a.totalChecks || 0} checks pass
            </div>
          </div>
        )}
      </div>

      {/* ═══ DATA AVAILABILITY CHIPS ═══ */}
      {Object.keys(dataAvail).length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {[
            ['Daily ' + (dataAvail.candlesUsed || dataAvail.kite1y ? (dataAvail.candlesUsed || 'Y') : ''), !!(dataAvail.candlesUsed || dataAvail.kite1y)],
            ['1Y', !!dataAvail.kite1y],
            ['3Y', !!dataAvail.kite3y],
            ['10Y', !!dataAvail.kite10w],
            ['MAX ' + (dataAvail.maxCandles ? dataAvail.maxCandles + 'mo' : ''), !!dataAvail.kiteMax],
            ['Hourly', !!dataAvail.kite1h],
            ['News', !!dataAvail.news],
            ['Fundamentals ✓', !!dataAvail.fundamentals],
          ].map(([label, ok], i) => (
            <span key={i} className={ok ? 'chip chip-green' : 'chip'} style={{
              height: 22, fontSize: 10, padding: '0 10px', fontWeight: 600,
              opacity: ok ? 1 : 0.5,
            }}>
              {label}
            </span>
          ))}
        </div>
      )}

      {/* ═══ PRICE CHART (placeholder — canvas rendering deferred) ═══ */}
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.1px', margin: 0 }}>
              Price Chart — Full History
            </h3>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, letterSpacing: '0.2px' }}>
              Support · Resistance · Buy Zone · 50DMA · 200DMA · Fibonacci overlay
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {['3M', '1Y', '3Y', '10Y', 'MAX'].map((tf) => {
              const active = tf === chartTf;
              return (
                <button
                  key={tf}
                  onClick={() => setChartTf(tf)}
                  style={{
                    padding: '4px 11px', borderRadius: 6,
                    border: `1px solid ${active ? 'var(--brand)' : 'var(--border2)'}`,
                    background: active ? 'var(--brand-bg)' : 'transparent',
                    color: active ? 'var(--brand-text)' : 'var(--text3)',
                    fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                    fontWeight: active ? 700 : 500, letterSpacing: '0.3px',
                    transition: 'all 150ms ease',
                  }}
                >
                  {tf}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{
          position: 'relative', height: 260, width: '100%',
          background: 'linear-gradient(180deg, rgba(99,102,241,0.04) 0%, rgba(99,102,241,0.01) 100%)',
          border: '1px dashed var(--border2)', borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8,
        }}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.35 }}>
            <path d="M3 17 L8 11 L12 14 L16 8 L21 12" stroke="var(--brand-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="8" cy="11" r="1.5" fill="var(--brand-text)" />
            <circle cx="12" cy="14" r="1.5" fill="var(--brand-text)" />
            <circle cx="16" cy="8" r="1.5" fill="var(--brand-text)" />
          </svg>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>
            Price chart rendering — coming in next update
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', maxWidth: 400, lineHeight: 1.5 }}>
            Viewing <b style={{ color: 'var(--brand-text)' }}>{chartTf}</b> timeframe · canvas chart with S/R lines, buy-zone box, DMA overlays & Fib retracements will be wired up in a follow-up pass.
          </div>
        </div>
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
              {supports.slice(0, 5).map((s, i) => {
                const p = Number(s.price);
                const dist = currentPrice && p ? ((currentPrice - p) / currentPrice * 100) : null;
                const strong = (s.strength || 0) >= 4;
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', fontSize: 12, gap: 8 }}>
                    <span style={{ color: 'var(--text3)', minWidth: 28 }}>S{i + 1}</span>
                    <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--green-text)' }}>₹{p.toFixed(1)}</span>
                    <span className="tabular-nums" style={{ color: 'var(--text3)', fontSize: 10, flex: 1, textAlign: 'right' }}>
                      {dist != null && `${dist.toFixed(1)}% below`}
                    </span>
                    {s.strength != null && (
                      <span style={{
                        color: strong ? 'var(--green-text)' : 'var(--text3)', fontSize: 10,
                        fontWeight: strong ? 700 : 500, letterSpacing: '0.4px',
                      }}>
                        {'×'.repeat(Math.min(5, Math.max(1, Math.round(s.strength))))}{strong && ' ◆'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {resistances.length > 0 && (
            <div className="card" style={{ padding: 18 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--red-text)', marginBottom: 10, letterSpacing: '-0.1px' }}>
                🚧 Resistance Zones
              </h3>
              {resistances.slice(0, 5).map((r, i) => {
                const p = Number(r.price);
                const dist = currentPrice && p ? ((p - currentPrice) / currentPrice * 100) : null;
                const strong = (r.strength || 0) >= 4;
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', fontSize: 12, gap: 8 }}>
                    <span style={{ color: 'var(--text3)', minWidth: 28 }}>R{i + 1}</span>
                    <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--red-text)' }}>₹{p.toFixed(1)}</span>
                    <span className="tabular-nums" style={{ color: 'var(--text3)', fontSize: 10, flex: 1, textAlign: 'right' }}>
                      {dist != null && `+${dist.toFixed(1)}% above`}
                    </span>
                    {r.strength != null && (
                      <span style={{
                        color: strong ? 'var(--red-text)' : 'var(--text3)', fontSize: 10,
                        fontWeight: strong ? 700 : 500, letterSpacing: '0.4px',
                      }}>
                        {'×'.repeat(Math.min(5, Math.max(1, Math.round(r.strength))))}{strong && ' ◆'}
                      </span>
                    )}
                  </div>
                );
              })}
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
            {targets.map((t, i) => {
              const u = t.upside != null ? Number(t.upside) : null;
              // Highlight the single highest upside target
              const maxUpside = Math.max(...targets.map((x) => x.upside != null ? Number(x.upside) : -Infinity));
              const isBest = u != null && u === maxUpside && u > 0;
              return (
                <div key={i} style={{
                  padding: 14,
                  background: isBest ? 'rgba(52,211,153,0.14)' : 'rgba(52,211,153,0.06)',
                  border: `1px solid ${isBest ? 'rgba(52,211,153,0.45)' : 'rgba(52,211,153,0.18)'}`,
                  borderRadius: 10,
                  boxShadow: isBest ? '0 0 0 3px rgba(52,211,153,0.08)' : 'none',
                  position: 'relative',
                }}>
                  {isBest && (
                    <span className="chip chip-green" style={{
                      position: 'absolute', top: -8, right: 8, height: 18, fontSize: 9, padding: '0 7px', fontWeight: 800,
                    }}>★ BEST</span>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.5px' }}>{t.label}</div>
                  <div className="tabular-nums" style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>₹{Number(t.price).toFixed(1)}</div>
                  {u != null && <div className="tabular-nums" style={{ fontSize: 12, color: u > 0 ? 'var(--green-text)' : 'var(--red-text)', fontWeight: 700, marginTop: 2 }}>{u > 0 ? '+' : ''}{u}%</div>}
                </div>
              );
            })}
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
              { l: '50%',   v: fibs.r50 ?? fibs.r500 },
              { l: '61.8%', v: fibs.r618, golden: true },
              { l: '78.6%', v: fibs.r786 },
              { l: '100%',  v: fibs.r100 ?? fibs.r1000 },
            ].filter((x) => x.v != null).map((x, i) => {
              const near = currentPrice && Math.abs(currentPrice - Number(x.v)) / currentPrice < 0.03;
              return (
                <div key={i} style={{
                  padding: 12,
                  background: near ? 'rgba(99,102,241,0.12)' : x.golden ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${near ? 'var(--brand)' : x.golden ? 'rgba(251,191,36,0.3)' : 'var(--border)'}`,
                  borderRadius: 10,
                  position: 'relative',
                }}>
                  <div style={{ fontSize: 10, color: near ? 'var(--brand-text)' : x.golden ? 'var(--amber-text)' : 'var(--text3)', fontWeight: 700, letterSpacing: '0.5px' }}>
                    {x.l}{x.golden && ' ★'}
                  </div>
                  <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>₹{Number(x.v).toFixed(1)}</div>
                  {near && <div style={{ fontSize: 9, color: 'var(--brand-text)', fontWeight: 700, marginTop: 2 }}>◆ NEAR PRICE</div>}
                </div>
              );
            })}
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
// Compact per-lens vote bar — shows e.g. "Varsity lens: 3 BUY · 1 HOLD · 1 AVOID"
function LensTallyBar({ label, tally, consensus, vStyle }) {
  const order = ['BUY', 'ACCUMULATE', 'HOLD', 'AVOID', 'SELL'];
  const colors = {
    BUY: 'var(--green-text)', ACCUMULATE: 'var(--green-text)',
    HOLD: 'var(--amber-text)', AVOID: 'var(--amber-text)', SELL: 'var(--red-text)',
  };
  const total = order.reduce((a, v) => a + (tally[v] || 0), 0);
  const cStyle = vStyle(consensus);
  return (
    <div className="card" style={{ padding: '12px 14px', borderLeft: `3px solid ${cStyle.color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 6 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text2)', letterSpacing: '0.3px' }}>{label}</div>
        <span className="chip" style={{
          height: 20, fontSize: 10, fontWeight: 800, padding: '0 8px',
          background: cStyle.bg, color: cStyle.color,
        }}>
          {consensus || 'N/A'}
        </span>
      </div>
      {total > 0 ? (
        <>
          <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 1, marginBottom: 6 }}>
            {order.map((v) => tally[v] ? (
              <div key={v} style={{ flex: tally[v], background: colors[v], borderRadius: 2 }} title={`${v}: ${tally[v]}`} />
            ) : null)}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 9.5 }}>
            {order.map((v) => tally[v] ? (
              <span key={v} className="tabular-nums" style={{ color: colors[v], fontWeight: 700 }}>
                {tally[v]} {v}
              </span>
            ) : null)}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 10, color: 'var(--text4)' }}>No votes</div>
      )}
    </div>
  );
}

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

  const judge = result?.judge_verdict || result?.judge || result?.final || null;
  const council = Array.isArray(result?.models)
    ? result.models
    : Array.isArray(result?.council) ? result.council : [];
  const countsVarsity = result?.counts_varsity || {};
  const countsPure = result?.counts_pure || {};
  const varsityConsensus = result?.varsity_consensus || '';
  const pureConsensus = result?.pure_consensus || '';
  const respondedCount = result?.respondedCount ?? 0;
  const totalModels = result?.totalModels ?? council.length ?? 5;
  const avgConfidence = result?.avgConfidence ?? null;

  const verdictStyle = (v) => {
    const vv = String(v || '').toUpperCase();
    if (vv === 'BUY' || vv === 'STRONG_BUY') return { color: 'var(--green-text)', bg: 'var(--green-bg)', icon: '🟢' };
    if (vv === 'ACCUMULATE') return { color: 'var(--green-text)', bg: 'var(--green-bg)', icon: '📈' };
    if (vv === 'HOLD') return { color: 'var(--amber-text)', bg: 'var(--amber-bg)', icon: '🟡' };
    if (vv === 'AVOID') return { color: 'var(--amber-text)', bg: 'var(--amber-bg)', icon: '🟠' };
    if (vv === 'SELL') return { color: 'var(--red-text)', bg: 'var(--red-bg)', icon: '🔴' };
    return { color: 'var(--brand-text)', bg: 'var(--brand-bg)', icon: '⚪' };
  };
  const jStyle = verdictStyle(judge?.verdict);
  const [showJudgeReasoning, setShowJudgeReasoning] = useState(false);

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
          {/* Judge verdict — hero card with action, score, target/stop, reasoning */}
          {judge && judge.verdict && (
            <div style={{
              padding: '20px 22px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(99,102,241,0.04) 100%)',
              border: `2px solid ${jStyle.color}`,
              borderRadius: 14, marginBottom: 14, textAlign: 'center',
              boxShadow: `0 4px 20px rgba(99,102,241,0.12)`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
                <span className="chip chip-brand" style={{ height: 22, fontSize: 10, fontWeight: 700 }}>
                  ⚖ JUDGE · CLAUDE SONNET 4.6
                </span>
                {judge.council_agreement && (
                  <span className="chip" style={{
                    height: 20, fontSize: 9, fontWeight: 700, padding: '0 8px',
                    background: judge.council_agreement === 'UNANIMOUS' ? 'var(--green-bg)' :
                               judge.council_agreement === 'MAJORITY' ? 'var(--amber-bg)' : 'var(--red-bg)',
                    color: judge.council_agreement === 'UNANIMOUS' ? 'var(--green-text)' :
                          judge.council_agreement === 'MAJORITY' ? 'var(--amber-text)' : 'var(--red-text)',
                  }}>
                    {String(judge.council_agreement).toUpperCase()}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 32, marginBottom: 2 }}>{jStyle.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: jStyle.color, letterSpacing: '-0.3px' }}>
                {judge.verdict}
              </div>
              {(judge.tagline || judge.final_reasoning) && (
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, lineHeight: 1.5, maxWidth: 540, margin: '6px auto 0' }}>
                  {judge.tagline || judge.final_reasoning}
                </div>
              )}
              {judge.score != null && (
                <div className="tabular-nums" style={{ marginTop: 14 }}>
                  <span style={{ fontSize: 40, fontWeight: 800, color: jStyle.color }}>{Math.round(judge.score)}</span>
                  <span style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 600 }}>/100</span>
                </div>
              )}
              {judge.criteria_total > 0 && (
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                  {judge.criteria_passed || 0}/{judge.criteria_total} criteria passed
                </div>
              )}
              {judge.score != null && (
                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginTop: 10, maxWidth: 260, marginLeft: 'auto', marginRight: 'auto' }}>
                  <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, judge.score))}%`, background: jStyle.color, borderRadius: 3, transition: 'width 400ms ease' }} />
                </div>
              )}
              {judge.action_line && (
                <div style={{
                  marginTop: 12, display: 'inline-block', padding: '8px 18px',
                  background: jStyle.bg, color: jStyle.color, borderRadius: 8,
                  fontWeight: 800, fontSize: 12, letterSpacing: '0.3px',
                  border: `1px solid ${jStyle.color}`,
                }}>
                  {judge.action_line}
                </div>
              )}
              {/* Target / stop / timeframe */}
              {(judge.target_price || judge.stop_loss || judge.timeframe) && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 12, fontSize: 10.5, flexWrap: 'wrap' }}>
                  {judge.target_price && <span style={{ color: 'var(--green-text)', fontWeight: 700 }}>🎯 Target: ₹{judge.target_price}</span>}
                  {judge.stop_loss && <span style={{ color: 'var(--red-text)', fontWeight: 700 }}>🛑 Stop: ₹{judge.stop_loss}</span>}
                  {judge.timeframe && <span style={{ color: 'var(--text3)' }}>⏳ {judge.timeframe}</span>}
                </div>
              )}
              {/* Legacy why_choose / why_not fallback */}
              {!judge.final_reasoning && judge.why_choose && (
                <div style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.55, marginTop: 10, textAlign: 'left', maxWidth: 520, margin: '10px auto 0' }}>
                  <b style={{ color: 'var(--green-text)' }}>Why buy:</b> {judge.why_choose}
                </div>
              )}
              {!judge.final_reasoning && judge.why_not && (
                <div style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.55, marginTop: 4, textAlign: 'left', maxWidth: 520, margin: '4px auto 0' }}>
                  <b style={{ color: 'var(--red-text)' }}>Why not:</b> {judge.why_not}
                </div>
              )}
              {/* Expandable reasoning */}
              {(judge.varsity_reasoning || judge.pure_reasoning || judge.risk_flag) && (
                <div style={{ marginTop: 12 }}>
                  <button
                    onClick={() => setShowJudgeReasoning((v) => !v)}
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      color: 'var(--brand-text)', fontSize: 11, fontWeight: 700,
                    }}
                  >
                    {showJudgeReasoning ? '▼' : '▶'} Judge reasoning
                  </button>
                  {showJudgeReasoning && (
                    <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6, textAlign: 'left', maxWidth: 540, margin: '8px auto 0' }}>
                      {judge.varsity_reasoning && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ color: 'var(--brand-text)', fontWeight: 700, marginBottom: 2 }}>📚 Varsity lens:</div>
                          <div style={{ color: 'var(--text3)' }}>{judge.varsity_reasoning}</div>
                        </div>
                      )}
                      {judge.pure_reasoning && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ color: 'var(--brand-text)', fontWeight: 700, marginBottom: 2 }}>🧭 Pure first-principles:</div>
                          <div style={{ color: 'var(--text3)' }}>{judge.pure_reasoning}</div>
                        </div>
                      )}
                      {judge.risk_flag && (
                        <div style={{ color: 'var(--red-text)', fontWeight: 700, marginTop: 6 }}>
                          ⚠ Risk flag: <span style={{ color: 'var(--text3)', fontWeight: 500 }}>{judge.risk_flag}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Dual-lens tally bars (Varsity vs Pure consensus) */}
          {(Object.keys(countsVarsity).length > 0 || Object.keys(countsPure).length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginBottom: 12 }}>
              <LensTallyBar label="📚 Varsity-grounded lens" tally={countsVarsity} consensus={varsityConsensus} vStyle={verdictStyle} />
              <LensTallyBar label="🧭 Pure first-principles lens" tally={countsPure} consensus={pureConsensus} vStyle={verdictStyle} />
            </div>
          )}

          {/* Response summary */}
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 10 }}>
            {respondedCount}/{totalModels} council models responded
            {avgConfidence != null && <> · Avg confidence: <b style={{ color: 'var(--text)' }}>{avgConfidence}%</b></>}
          </div>

          {/* Council breakdown */}
          {council.length > 0 && (
            <div>
              <div className="label-xs" style={{ marginBottom: 8 }}>
                🧠 Per-Model Dual Opinions · {council.length} models
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                {council.map((m, i) => {
                  if (m.error || m.skipped) {
                    return (
                      <div key={i} style={{ padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10, opacity: 0.55 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>{m.name || m.id || `Model ${i + 1}`}</div>
                        <div style={{ fontSize: 10, color: 'var(--text4)' }}>⏭ {m.error || 'Skipped'}</div>
                      </div>
                    );
                  }
                  const v = m.verdict || m.recommendation || m.varsity_verdict;
                  const vStyle = verdictStyle(v);
                  const pv = m.pure_verdict;
                  const pStyle = pv ? verdictStyle(pv) : null;
                  return (
                    <div key={i} style={{ padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {m.name || m.id || `Model ${i + 1}`}
                        </div>
                        {m.confidence != null && (
                          <span style={{ fontSize: 9, color: 'var(--text3)' }}>{m.confidence}/10</span>
                        )}
                      </div>
                      {/* Dual verdict badges */}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                        {v && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                            background: vStyle.bg, color: vStyle.color, letterSpacing: '0.3px',
                          }}>📚 {v}</span>
                        )}
                        {pv && pStyle && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                            background: pStyle.bg, color: pStyle.color, letterSpacing: '0.3px',
                          }}>🧭 {pv}</span>
                        )}
                      </div>
                      {m.reasoning && (
                        <div style={{ fontSize: 10.5, color: 'var(--text3)', lineHeight: 1.45, maxHeight: 64, overflow: 'hidden' }}>
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
