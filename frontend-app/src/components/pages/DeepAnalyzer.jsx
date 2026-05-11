import React, { useState, useEffect, useRef } from 'react';
import { apiGet } from '../../api/client';
import { useAppStore } from '../../store/useAppStore';

export default function DeepAnalyzer() {
  // Check if we were sent here from Stock Picks quick-start
  const pendingSym = useAppStore((s) => s.pendingAnalyzeSymbol);
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

  // Auto-analyze if navigated from Stock Picks quick-start
  useEffect(() => {
    if (pendingSym) {
      setQuery(pendingSym);
      setSelected({ sym: pendingSym });
      useAppStore.setState({ pendingAnalyzeSymbol: null });
      setTimeout(() => runAnalyze(pendingSym), 100);
    }
  }, [pendingSym]);

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

  // -- Price-chart timeframe state ----------------------------------------
  // Kite historical API only goes back ~3Y for daily candles, so we expose
  // 3M / 1Y / 3Y only. 10Y and MAX removed 2026-04-18 — they were always
  // empty placeholders. Default picks the richest available.
  const charts = a.charts || {};
  const initialTf = (() => {
    if (dataAvail.kite3y && charts['3Y'] && charts['3Y'].length > 50) return '3Y';
    if (dataAvail.kite1y && charts['1Y'] && charts['1Y'].length > 50) return '1Y';
    return '1Y';
  })();
  const [chartTf, setChartTf] = useState(initialTf);

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
        <div style={{ flex: 1, minWidth: 240 }}>
          {/* Sector + Group chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {a.sector && (
              <span className="chip" style={{ height: 22, fontSize: 10, padding: '0 10px', fontWeight: 600 }}>
                {a.sector}
              </span>
            )}
            {a.grp && (
              <span className="chip" style={{ height: 22, fontSize: 10, padding: '0 10px', fontWeight: 600 }}>
                {a.grp}
              </span>
            )}
            {a.industry && (
              <span className="chip" style={{ height: 22, fontSize: 10, padding: '0 10px', fontWeight: 600 }}>
                {a.industry}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.8px', color: 'var(--text)', lineHeight: 1.1, margin: 0 }}>
              {a.sym || '—'}
            </h2>
            {a.name && (
              <span style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 500 }}>{a.name}</span>
            )}
          </div>
          {a.price != null && (
            <div className="tabular-nums" style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.6px', marginBottom: 6 }}>
              ₹{Number(a.price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              {a.priceChange != null && (
                <span style={{
                  fontSize: 14, fontWeight: 700, marginLeft: 10,
                  color: a.priceChange > 0 ? 'var(--green-text)' : a.priceChange < 0 ? 'var(--red-text)' : 'var(--text3)',
                }}>
                  {a.priceChange > 0 ? '+' : ''}{Number(a.priceChange).toFixed(2)}
                  {a.priceChangePct != null && ` (${a.priceChangePct > 0 ? '+' : ''}${Number(a.priceChangePct).toFixed(2)}%)`}
                </span>
              )}
            </div>
          )}
          {/* Compact market-cap / volume line */}
          {(a.marketCap || a.volume || fund?.marketCap) && (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
              {(a.marketCap || fund?.marketCap) && (
                <span>Mkt Cap: <span className="tabular-nums" style={{ color: 'var(--text2)', fontWeight: 600 }}>
                  {typeof (a.marketCap || fund?.marketCap) === 'string'
                    ? (a.marketCap || fund?.marketCap)
                    : `₹${Number(a.marketCap || fund?.marketCap).toLocaleString('en-IN')} Cr`}
                </span></span>
              )}
              {a.volume && (
                <span>Volume: <span className="tabular-nums" style={{ color: 'var(--text2)', fontWeight: 600 }}>{Number(a.volume).toLocaleString('en-IN')}</span></span>
              )}
              {tech.wk52Hi && tech.wk52Lo && (
                <span>52W: <span className="tabular-nums" style={{ color: 'var(--text2)', fontWeight: 600 }}>₹{tech.wk52Lo} – ₹{tech.wk52Hi}</span></span>
              )}
            </div>
          )}
        </div>
        {score != null && (
          <div style={{
            textAlign: 'center',
            padding: '18px 22px',
            background: 'rgba(10,14,24,0.6)',
            border: `1px solid ${tierColor}44`,
            borderRadius: 14,
            minWidth: 220,
            boxShadow: `0 0 28px ${tierColor}22`,
          }}>
            {verdictIcon && <div style={{ fontSize: 28, marginBottom: 6 }}>{verdictIcon}</div>}
            {verdict && (
              <div style={{ fontSize: 16, fontWeight: 700, color: tierColor, letterSpacing: '0.3px', marginBottom: 4 }}>
                {verdict}
              </div>
            )}
            {verdictTimeframe && (
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 10, fontWeight: 500 }}>
                {verdictTimeframe}
              </div>
            )}
            <div className="tabular-nums" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 4 }}>
              Varsity Score
            </div>
            <div className="tabular-nums" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1, letterSpacing: '-1.5px', color: tierColor }}>
              {countupScore}
              <span style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 500, marginLeft: 2 }}>/ 100</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, fontWeight: 500 }}>
              {a.passCount || 0}/{a.totalChecks || 0} criteria passed
            </div>
            {/* Progress bar under the score */}
            <div style={{ height: 5, width: '100%', marginTop: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${countupScore}%`, background: tierColor, borderRadius: 3, transition: 'width 200ms ease' }} />
            </div>
            {action && (
              <div style={{
                marginTop: 12, padding: '7px 14px', borderRadius: 9,
                background: 'rgba(255,255,255,0.04)', color: tierColor,
                border: `1px solid ${tierColor}44`,
                fontWeight: 700, fontSize: 12, letterSpacing: '0.3px',
              }}>
                {action}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ DATA AVAILABILITY CHIPS — what candles/feeds drove this analysis ═══ */}
      {Object.keys(dataAvail).length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {[
            ['1Y', !!dataAvail.kite1y],
            ['3Y', !!dataAvail.kite3y],
            ['Hourly', !!dataAvail.kite1h],
            ['News', !!dataAvail.news],
            ['Fundamentals', !!dataAvail.fundamentals],
            ['Candles: ' + (dataAvail.candlesUsed || 0), (dataAvail.candlesUsed || 0) > 100],
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

      {/* ═══ AI SECOND OPINION — top of analyzer (matches 7e1e050 layout) ═══ */}
      <AIReviewSection sym={a.sym} />

      {/* ═══ PRICE CHART (canvas — S/R + DMA + Buy Zone + Fibs) ═══ */}
      <PriceChart
        charts={charts}
        tf={chartTf}
        setTf={setChartTf}
        supports={supports}
        resistances={resistances}
        buyZone={a.buyZone}
        tech={tech}
        fibs={fibs}
        currentPrice={currentPrice}
        dataAvail={dataAvail}
      />

      {/* ═══ AT-A-GLANCE METRICS — matches old `az-fade-up` summary bar ═══ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
        gap: 8,
        marginBottom: 18,
      }}>
        {tech.dma200Trend && (
          <MetricPill label="Trend"
            value={tech.dma200Trend === 'rising' ? '▲ Rising' : '▼ Falling'}
            color={tech.dma200Trend === 'rising' ? 'var(--green-text)' : 'var(--red-text)'} />
        )}
        <MetricPill label="RSI-14" value={tech.rsi14} fmt={(v) => Math.round(v)}
          color={(v) => v == null ? 'var(--text4)' : v < 40 ? 'var(--green-text)' : v > 65 ? 'var(--red-text)' : 'var(--amber-text)'} />
        <MetricPill label="ADX" value={tech.adx} fmt={(v) => Math.round(v)} sub={tech.trendStrength} />
        <MetricPill label="R:R" value={a.riskReward || tech.riskReward} fmt={(v) => v ? `${Number(v).toFixed(2)}x` : '—'}
          color={(v) => v >= 2 ? 'var(--green-text)' : v >= 1.5 ? 'var(--amber-text)' : 'var(--red-text)'} />
        <MetricPill label="Upside" value={a.upsidePct || tech.upsidePct} fmt={(v) => v != null ? `${Number(v).toFixed(1)}%` : '—'}
          color={(v) => v > 0 ? 'var(--green-text)' : 'var(--red-text)'} />
        {fund?.roe != null && <MetricPill label="ROE" value={fund.roe} fmt={(v) => `${Number(v).toFixed(1)}%`}
          color={(v) => v >= 20 ? 'var(--green-text)' : v >= 12 ? 'var(--amber-text)' : 'var(--red-text)'} />}
        {fund?.de != null && <MetricPill label="D/E" value={fund.de} fmt={(v) => `${Number(v).toFixed(2)}x`}
          color={(v) => v <= 0.5 ? 'var(--green-text)' : v <= 1.5 ? 'var(--amber-text)' : 'var(--red-text)'} />}
        {fund?.pe != null && <MetricPill label="P/E" value={fund.pe} fmt={(v) => Number(v).toFixed(1)}
          color={(v) => v < 20 ? 'var(--green-text)' : v < 40 ? 'var(--amber-text)' : 'var(--red-text)'} />}
      </div>

      {/* 🚀 v2.0 Wave 12 — Top-Trader Playbook Section
           (Minervini Trend Template + Weinstein Stage + CANSLIM + VCP + Cup-Handle) */}
      {a.playbook && !a.playbook.error && <DeepAnalyzerPlaybook playbook={a.playbook} />}

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
              const defaultPcts = [30, 30, 40];
              const pct = t.pct != null ? t.pct : defaultPcts[i];
              const labelPrefix = ['1st Buy', '2nd Buy', '3rd Buy'][i];
              return (
                <div key={k} style={{ padding: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--green-text)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{labelPrefix} ({pct}%)</div>
                  <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 800, color: colors[i], marginTop: 4 }}>₹{t.price}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6, lineHeight: 1.4 }}>{t.when}</div>
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
          {/* Verdict header strip — matches old buildUI "Our Verdict: ..." line */}
          {verdict && (
            <div style={{
              marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.2px' }}>
                {verdictIcon} Our Verdict: <span style={{ color: tierColor }}>{verdict}</span>
              </div>
              {verdictTimeframe && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, fontWeight: 500 }}>
                  {verdictTimeframe}
                </div>
              )}
            </div>
          )}
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

      {/* ═══ FUNDAMENTALS ═══
          Uses SigBox signal-cells with peer comparison notes (roePeer, dePeer,
          pePeer, growthPeer) — matches old buildUI Fundamental Analysis block. */}
      {fund && (
        <Section title="Fundamental Analysis" subtitle="Varsity Module 3 — Quality + Growth + Valuation · peer-relative where available">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {fund.roe != null && (
              <SigBox label="ROE" value={`${fund.roe}%`}
                signal={fund.roe>=20?'bullish':fund.roe>=12?'neutral':'bearish'}
                detail={fund.roePeer || (fund.roe>=20?'High quality':fund.roe>=12?'Decent':'Weak return')} />
            )}
            {fund.roa != null && (
              <SigBox label="ROA" value={`${fund.roa}%`}
                signal={fund.roa>=10?'bullish':fund.roa>=5?'neutral':'bearish'}
                detail="Return on assets" />
            )}
            {fund.roce != null && (
              <SigBox label="ROCE" value={`${fund.roce}%`}
                signal={fund.roce>=20?'bullish':fund.roce>=12?'neutral':'bearish'}
                detail="Return on capital" />
            )}
            {fund.de != null && (
              <SigBox label="Debt/Equity" value={`${fund.de}x`}
                signal={fund.de<=0.5?'bullish':fund.de<=1.5?'neutral':'bearish'}
                detail={fund.dePeer || (fund.de<=0.5?'Low leverage':fund.de<=1.5?'Moderate':'High leverage')} />
            )}
            {fund.pe != null && (
              <SigBox label="P/E Ratio" value={`${fund.pe}x`}
                signal={fund.pe<20?'bullish':fund.pe<40?'neutral':'bearish'}
                detail={fund.pePeer || (fund.pe<20?'Cheap':fund.pe<40?'Fair':'Expensive')} />
            )}
            {fund.pb != null && (
              <SigBox label="P/B Ratio" value={`${fund.pb}x`}
                signal={fund.pb<2?'bullish':fund.pb<4?'neutral':'bearish'}
                detail="Price to book" />
            )}
            {fund.peg != null && (
              <SigBox label="PEG Ratio" value={String(fund.peg)}
                signal={fund.peg<1?'bullish':fund.peg<2?'neutral':'bearish'}
                detail={fund.peg<1?'Undervalued':fund.peg<2?'Fair':'Expensive'} />
            )}
            {fund.evEbitda != null && (
              <SigBox label="EV/EBITDA" value={`${fund.evEbitda}x`}
                signal={fund.evEbitda<12?'bullish':fund.evEbitda<20?'neutral':'bearish'}
                detail="Enterprise value" />
            )}
            {fund.revGr != null && (
              <SigBox label="Revenue Growth" value={`${fund.revGr}%`}
                signal={fund.revGr>=15?'bullish':fund.revGr>=5?'neutral':'bearish'}
                detail={fund.growthPeer || (fund.revGr>=15?'Fast-growing':fund.revGr>=5?'Growing':'Slow')} />
            )}
            {fund.epsGr != null && (
              <SigBox label="EPS Growth" value={`${fund.epsGr}%`}
                signal={fund.epsGr>=15?'bullish':fund.epsGr>=5?'neutral':'bearish'}
                detail={fund.epsGr>=25?'Hypergrowth':fund.epsGr>=0?'Growing':'Declining'} />
            )}
            {fund.opMgn != null && (
              <SigBox label="Op Margin" value={`${fund.opMgn}%`}
                signal={fund.opMgn>=20?'bullish':fund.opMgn>=10?'neutral':'bearish'}
                detail={fund.opMgn>=20?'High margin':'Moderate'} />
            )}
            {fund.netMgn != null && (
              <SigBox label="Net Margin" value={`${fund.netMgn}%`}
                signal={fund.netMgn>=15?'bullish':fund.netMgn>=5?'neutral':'bearish'}
                detail="Bottom line" />
            )}
            {fund.divYld != null && (
              <SigBox label="Div Yield" value={`${fund.divYld}%`}
                signal={fund.divYld>=3?'bullish':fund.divYld>=1?'neutral':'bearish'}
                detail="Dividend yield" />
            )}
            {fund.interestCoverage != null && (
              <SigBox label="Int. Coverage" value={`${fund.interestCoverage}x`}
                signal={fund.interestCoverage>=5?'bullish':fund.interestCoverage>=2?'neutral':'bearish'}
                detail={fund.interestCoverage>=5?'Very safe':fund.interestCoverage>=2?'Safe':'At risk'} />
            )}
            {fund.currentRatio != null && (
              <SigBox label="Current Ratio" value={`${fund.currentRatio}x`}
                signal={fund.currentRatio>=1.5?'bullish':fund.currentRatio>=1?'neutral':'bearish'}
                detail="Liquidity" />
            )}
            {fund.cfoQuality != null && (
              <SigBox label="CFO Quality" value={String(fund.cfoQuality)}
                signal={String(fund.cfoQuality).toLowerCase().includes('high')||String(fund.cfoQuality).toLowerCase().includes('good')?'bullish':'neutral'}
                detail="Cash flow quality" />
            )}
            {fund.marketCap != null && (
              <SigBox label="Market Cap" value={typeof fund.marketCap === 'string' ? fund.marketCap : `₹${Number(fund.marketCap).toLocaleString('en-IN')} Cr`}
                signal="neutral" detail={fund.marketCapTier || 'Size'} />
            )}
          </div>
        </Section>
      )}

      {/* ═══ PRICE PERFORMANCE · 52W HI/LO · RETURNS ═══ */}
      {(tech.ret1m != null || tech.ret3m != null || tech.ret6m != null || tech.ret1y != null
        || tech.ret3y != null || tech.wk52Hi != null || tech.wk52Lo != null || tech.weeklyTrend) && (
        <Section title="Price Performance" subtitle="Rolling returns + 52-week high/low + weekly trend">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            {[
              { l: '1M Return', v: tech.ret1m, s: '%', signed: true },
              { l: '3M Return', v: tech.ret3m, s: '%', signed: true },
              { l: '6M Return', v: tech.ret6m, s: '%', signed: true },
              { l: '1Y Return', v: tech.ret1y, s: '%', signed: true },
              { l: '3Y Return', v: tech.ret3y, s: '%', signed: true },
              { l: '52W High', v: tech.wk52Hi, s: '₹', rupee: true,
                sub: tech.pctFromHigh != null ? `${tech.pctFromHigh}% away` : null },
              { l: '52W Low',  v: tech.wk52Lo, s: '₹', rupee: true,
                sub: tech.pctFromLow != null ? `+${tech.pctFromLow}% above` : null },
            ].filter((x) => x.v != null).map((x, i) => {
              const n = Number(x.v);
              const col = x.signed
                ? (n > 0 ? 'var(--green-text)' : n < 0 ? 'var(--red-text)' : 'var(--text)')
                : 'var(--text)';
              const display = x.rupee
                ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 1 })}`
                : `${n > 0 && x.signed ? '+' : ''}${n.toFixed(1)}${x.s}`;
              return (
                <div key={i} style={{ padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.5px' }}>{x.l}</div>
                  <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 800, color: col, marginTop: 4 }}>
                    {display}
                  </div>
                  {x.sub && <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 3 }}>{x.sub}</div>}
                </div>
              );
            })}
            {tech.weeklyTrend && (
              <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.5px' }}>Weekly Trend</div>
                <div style={{
                  fontSize: 14, fontWeight: 800, marginTop: 4,
                  color: tech.weeklyTrend === 'uptrend' ? 'var(--green-text)'
                       : tech.weeklyTrend === 'downtrend' ? 'var(--red-text)'
                       : 'var(--amber-text)',
                  textTransform: 'capitalize',
                }}>
                  {tech.weeklyTrend === 'uptrend' ? '▲ Uptrend'
                    : tech.weeklyTrend === 'downtrend' ? '▼ Downtrend'
                    : '◇ Sideways'}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 3 }}>Higher highs/lows check</div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ═══ COMPLETE TECHNICAL ANALYSIS ═══
          One card, grouped subsections: MA · Oscillators · Trend & Vol ·
          Volume & Accum · Ichimoku · Performance · Candle Patterns
          (mirrors old buildUI `Complete Technical Analysis` block) */}
      {Object.keys(tech).length > 0 && (
        <Section title="Complete Technical Analysis" subtitle="30+ indicators across moving averages, oscillators, trend & volatility, volume, Ichimoku and price performance">
          <TechnicalsGrid t={tech} px={currentPrice} ichimoku={ichimoku} patterns={patterns} />
        </Section>
      )}

      {/* ═══ FIBONACCI ═══ */}
      {fibs && (
        <Section title="Fibonacci Retracement (52W)" subtitle="Key pullback levels — 23.6 / 38.2 / 50 / 61.8 / 78.6">
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

      {/* Ichimoku and candlestick patterns are rendered as subsections inside
          Complete Technical Analysis (above), matching the old layout.      */}

      {/* ═══ NEWS & SENTIMENT ═══
          Always rendered so the user sees sentiment bar; when no news matched
          we show ET Markets / Moneycontrol fallback links (matches old). */}
      <Section title="News & Sentiment" subtitle={news.length
        ? `${sentiment.bull || 0} bullish · ${sentiment.bear || 0} bearish · ${sentiment.neutral || 0} neutral · last 24-72h`
        : 'No recent news matched — check the sources below'}>
        {/* Sentiment header strip with tally glyphs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, fontWeight: 600 }}>
            <span style={{ color: 'var(--green-text)' }}>▲ {sentiment.bull || 0}</span>
            <span style={{ color: 'var(--red-text)' }}>▼ {sentiment.bear || 0}</span>
            <span style={{ color: 'var(--text3)' }}>● {sentiment.neutral || 0}</span>
          </div>
        </div>
        {/* Sentiment bar */}
        {(sentiment.bull || sentiment.bear || sentiment.neutral) ? (
          <div style={{ display: 'flex', height: 6, borderRadius: 4, overflow: 'hidden', marginBottom: 14, background: 'rgba(255,255,255,0.04)' }}>
            {sentiment.bull ? <div style={{ flex: sentiment.bull, background: 'var(--green)' }} /> : null}
            {sentiment.neutral ? <div style={{ flex: sentiment.neutral, background: 'rgba(255,255,255,0.12)' }} /> : null}
            {sentiment.bear ? <div style={{ flex: sentiment.bear, background: 'var(--red)' }} /> : null}
          </div>
        ) : null}
        {news.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6, padding: '6px 0' }}>
            No recent news matched this ticker. Check external sources:{' '}
            <a href={`https://economictimes.indiatimes.com/topic/${encodeURIComponent(a.sym || '')}`} target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--brand-text)', fontWeight: 600 }}>ET Markets</a>
            {' · '}
            <a href={`https://www.moneycontrol.com/stocks/cptmarket/compsearchnew.php?search_data=${encodeURIComponent(a.sym || '')}`} target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--brand-text)', fontWeight: 600 }}>Moneycontrol</a>
            {' · '}
            <a href={`https://www.google.com/finance/quote/${encodeURIComponent((a.sym || '') + ':NSE')}`} target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--brand-text)', fontWeight: 600 }}>Google Finance</a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {news.slice(0, 12).map((n, i) => {
              const color = n.sentiment === 'bullish' ? 'var(--green-text)'
                          : n.sentiment === 'bearish' ? 'var(--red-text)'
                          : 'var(--text3)';
              const glyph = n.sentiment === 'bullish' ? '▲' : n.sentiment === 'bearish' ? '▼' : '●';
              return (
                <a key={i} href={n.link || '#'} target="_blank" rel="noopener noreferrer" style={{
                  display: 'flex', padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none',
                  transition: 'background 150ms ease', gap: 10, alignItems: 'flex-start',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                >
                  <span style={{ color, fontSize: 12, flexShrink: 0, marginTop: 1 }}>{glyph}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1, minWidth: 0 }}>{n.title}</span>
                      {n.sentiment && <span style={{ fontSize: 9, color, fontWeight: 700, textTransform: 'uppercase' }}>{n.sentiment}</span>}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{n.src}{n.timeAgo ? ` · ${n.timeAgo}` : ''}</div>
                    {n.desc && (
                      <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 3, lineHeight: 1.5 }}>
                        {String(n.desc).slice(0, 180)}{String(n.desc).length > 180 ? '…' : ''}
                      </div>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </Section>

      {/* Disclaimer */}
      <div style={{ marginTop: 28, padding: 16, background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, fontSize: 11, color: 'var(--text3)', lineHeight: 1.55 }}>
        ⚠ <b>Disclaimer:</b> ProTrader is not SEBI-registered and does not provide financial advice. All data, scores, and AI outputs are for educational purposes only. Data may be delayed. You are responsible for your own investment decisions.
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// 🚀 v2.0 Wave 12 — Top-Trader Playbook Section
// Detailed display of Minervini Trend Template, Weinstein Stage,
// CANSLIM rubric, VCP, and Cup-with-Handle — full deep-dive depth
// (compact PlaybookBadge lives in StockPicks.jsx; this is the expanded view)
// ══════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════
// 🛡 v2.1 Sprint 4B (2026-05-11) — Deep Analyzer redesign.
//
// Replaces the prior ~30-block dense layout with a three-tier progressive
// disclosure:
//   Tier 1 (always visible): single Verdict card + 1-line plain-English
//   reason + Trade Plan card (Entry / Stop / Target / R:R).
//   Tier 2 (always visible, but compact): 10-check scoreboard. Each
//   framework is one row with check icon + plain-English label + 1-line
//   reason. FAILED checks sort to top — those drive the decision.
//   Tier 3 (collapsible): per-framework drill-downs.
//
// AVOID-state verdicts render WITHOUT the Trade Plan (no point showing
// entry/stop/target for a stock the user shouldn't trade).
// ══════════════════════════════════════════════════════════════════════

const FRAMEWORK_LABELS = {
  minervini:       { title: 'Trend is strong',           deep: 'Mark Minervini · 8-criterion Trend Template' },
  weinstein:       { title: 'In an uptrend stage',       deep: 'Stan Weinstein · 4-Stage Analysis' },
  canslim:         { title: 'Earnings + market fit',     deep: 'William O\'Neil · CANSLIM Rubric (7 letters)' },
  vcp:             { title: 'Tightening pattern',        deep: 'Volatility Contraction Pattern (Minervini)' },
  cupHandle:       { title: 'Cup-with-Handle base',      deep: 'Cup-with-Handle pattern (O\'Neil)' },
  piotroski:       { title: 'Strong balance sheet',      deep: 'Piotroski F-Score (9 financial-quality checks)' },
  altman:          { title: 'Safe from bankruptcy',      deep: 'Altman Z-Score (bankruptcy prediction)' },
  industryRS:      { title: 'Leader in its sector',      deep: 'Industry Relative Strength (O\'Neil 3-level RS)' },
  magicFormula:    { title: 'Cheap by quality',          deep: 'Greenblatt Magic Formula (EY × ROC)' },
  accumulation:    { title: 'Institutions accumulating', deep: '50-Day Accumulation/Distribution Days' },
};

function _statusFromCheck(pb, key) {
  const x = pb[key];
  if (!x) return { state: 'unknown', metric: 'no data' };
  if (x.error) return { state: 'unknown', metric: 'no data' };
  switch (key) {
    case 'minervini':
      if (x.qualifies) return { state: 'pass', metric: `${x.passed}/${x.total}` };
      if ((x.passed || 0) >= 6) return { state: 'partial', metric: `${x.passed}/${x.total}` };
      return { state: 'fail', metric: `${x.passed || 0}/${x.total || 8}` };
    case 'weinstein': {
      const s = x.stage;
      if (s === 'STAGE_4') return { state: 'fail', metric: 'Stage 4' };
      if (s === 'STAGE_3') return { state: 'fail', metric: 'Stage 3' };
      if (s === 'STAGE_2') return { state: 'pass', metric: x.subStage ? `Stage 2 ${x.subStage}` : 'Stage 2' };
      if (s === 'STAGE_2_PROVISIONAL') return { state: 'partial', metric: 'Stage 2 (prov)' };
      if (s === 'STAGE_2_TRANSITIONAL') return { state: 'partial', metric: 'Transitional' };
      if (s === 'STAGE_1') return { state: 'partial', metric: 'Stage 1 base' };
      return { state: 'unknown', metric: s };
    }
    case 'canslim':
      if (x.qualifies) return { state: 'pass', metric: `${x.passingLetters}/7` };
      if ((x.score || 0) >= 60) return { state: 'partial', metric: `${x.passingLetters || 0}/7` };
      return { state: 'fail', metric: `${x.passingLetters || 0}/7` };
    case 'vcp':
    case 'cupHandle':
      return x.detected ? { state: 'pass', metric: `${x.confidence}%` } : { state: 'fail', metric: 'no' };
    case 'piotroski':
      if (x.qualifies) return { state: 'pass', metric: `${x.passed}/9` };
      if ((x.passed || 0) >= 5) return { state: 'partial', metric: `${x.passed}/9` };
      return { state: 'fail', metric: `${x.passed || 0}/9` };
    case 'altman':
      if (x.zone === 'SAFE') return { state: 'pass', metric: `Z=${x.z}` };
      if (x.zone === 'GREY') return { state: 'partial', metric: `Z=${x.z}` };
      if (x.zone === 'DISTRESS') return { state: 'fail', metric: `Z=${x.z}` };
      return { state: 'unknown', metric: '—' };
    case 'industryRS':
      if (x.qualifies) return { state: 'pass', metric: `${x.stockPercentileInSector}th %ile` };
      if ((x.stockPercentileInSector || 0) >= 50) return { state: 'partial', metric: `${x.stockPercentileInSector}th` };
      return { state: 'fail', metric: x.stockPercentileInSector != null ? `${x.stockPercentileInSector}th` : 'no data' };
    case 'magicFormula':
      if (x.qualifies) return { state: 'pass', metric: `${x.percentile}th %ile` };
      if ((x.percentile || 0) >= 50) return { state: 'partial', metric: `${x.percentile}th` };
      return { state: 'fail', metric: x.percentile != null ? `${x.percentile}th` : 'no data' };
    case 'accumulation':
      if (x.skipped) return { state: 'unknown', metric: 'no candles' };
      if (x.qualifies) return { state: 'pass', metric: `${x.net >= 0 ? '+' : ''}${x.net}` };
      if (x.net != null && x.net >= 0) return { state: 'partial', metric: `${x.net >= 0 ? '+' : ''}${x.net}` };
      return { state: 'fail', metric: `${x.net}` };
    default: return { state: 'unknown', metric: '—' };
  }
}

function _plainReason(pb, key) {
  const x = pb[key];
  if (!x || x.error) return 'data not available';
  switch (key) {
    case 'minervini': return `${x.passed || 0} of 8 trend criteria passing${x.confidence ? ` · ${x.confidence} confidence` : ''}`;
    case 'weinstein': return x.reason || x.stage;
    case 'canslim':   return `${x.passingLetters || 0} of 7 letters strong · score ${x.score}/100`;
    case 'vcp':       return x.reason || 'no progressive contractions detected';
    case 'cupHandle': return x.reason || 'no cup-with-handle pattern';
    case 'piotroski': return `${x.passed || 0} of 9 fundamental quality checks${x.confidence ? ` · ${x.confidence} confidence` : ''}`;
    case 'altman':    return x.interpretation || 'no Altman data';
    case 'industryRS':return x.label || (x.sectorPercentile != null ? `sector ${x.sectorPercentile}th %ile · stock ${x.stockPercentileInSector}th in sector` : 'no sector data');
    case 'magicFormula': return x.label || 'no Magic Formula rank';
    case 'accumulation': return x.skipped ? 'needs daily candles' : (x.verdict || 'no A/D data');
    default: return '';
  }
}

const STATE_STYLE = {
  pass:    { bg: 'rgba(16,185,129,0.08)',  fg: '#10b981',         icon: '✓', symbol: 'pass' },
  partial: { bg: 'rgba(245,158,11,0.08)',  fg: '#f59e0b',         icon: '○', symbol: 'partial' },
  fail:    { bg: 'rgba(239,68,68,0.06)',   fg: '#ef4444',         icon: '✕', symbol: 'fail' },
  unknown: { bg: 'rgba(148,163,184,0.06)', fg: 'var(--text4)',    icon: '–', symbol: 'no data' },
};

function DeepAnalyzerPlaybook({ playbook }) {
  if (!playbook) return null;
  const pb = playbook;
  const composite = pb.composite || {};
  const isHardExclude = !!pb.hardExclude;
  const isStage3 = pb.stage?.stage === 'STAGE_3';
  const v = composite.verdict || pb.verdict || 'NEUTRAL';
  const isAvoid = isHardExclude || pb.stage?.stage === 'STAGE_4' || v.includes('AVOID');
  const isStrongBuy = v.includes('STRONG BUY');
  const isBuy = !isStrongBuy && v.includes('BUY');
  const isWatch = v.includes('WATCH');

  // Build 10 framework checks
  const checks = [
    'minervini', 'weinstein', 'canslim', 'vcp', 'cupHandle',
    'piotroski', 'altman', 'industryRS', 'magicFormula', 'accumulation',
  ].map(key => ({
    key,
    label: FRAMEWORK_LABELS[key].title,
    deepLabel: FRAMEWORK_LABELS[key].deep,
    status: _statusFromCheck(pb, key),
    reason: _plainReason(pb, key),
    raw: pb[key],
  }));
  // Sort fails first → partial → pass → unknown (fails drive the decision)
  const order = { fail: 0, partial: 1, pass: 2, unknown: 3 };
  const sortedChecks = [...checks].sort((a, b) => order[a.status.state] - order[b.status.state]);

  const passCount = composite.passCount ?? 0;
  const total = composite.total ?? checks.filter(c => c.status.state !== 'unknown').length;
  const headerBg =
    isHardExclude ? 'rgba(239,68,68,0.10)'
    : isAvoid     ? 'rgba(148,163,184,0.08)'
    : isStage3    ? 'rgba(245,158,11,0.10)'
    : isStrongBuy ? 'rgba(16,185,129,0.12)'
    : isBuy       ? 'rgba(34,197,94,0.10)'
    : isWatch     ? 'rgba(59,130,246,0.08)'
                  : 'rgba(148,163,184,0.06)';
  const headerFg =
    isHardExclude ? '#ef4444'
    : isAvoid     ? '#94a3b8'
    : isStage3    ? '#f59e0b'
    : isStrongBuy ? '#10b981'
    : isBuy       ? '#22c55e'
    : isWatch     ? '#3b82f6'
                  : 'var(--text3)';
  const plainVerdict =
    isHardExclude ? 'AVOID'
    : isAvoid     ? 'AVOID'
    : isStage3    ? 'Take profits'
    : isStrongBuy ? 'Strong Buy'
    : isBuy       ? 'Buy'
    : isWatch     ? 'Watch'
                  : 'Neutral';

  // Trade plan (skip for AVOID + Stage 3)
  const showTradePlan = !isAvoid && !isStage3;
  const entry = pb.vcp?.pivot ?? pb.cupHandle?.pivot ?? null;
  const stop = pb.vcp?.stop ?? pb.cupHandle?.stop ?? null;
  const target = entry != null ? +(Number(entry) * 1.20).toFixed(2) : null;
  const riskReward = (entry && stop && target)
    ? +((target - entry) / Math.max(entry - stop, 0.01)).toFixed(1)
    : null;

  // 🛡 v2.1 Sprint 4C (2026-05-11) — Build the plain-English reason from the
  // VERDICT, not from whatever stage.recommendation happens to exist. Audit
  // bug: an AVOID-verdict stock that happens to be Stage 1 was showing
  // "WATCH for Stage 2 breakout" as the reason — directly contradicting the
  // AVOID label two lines above it. Now: reason is verdict-aware.
  let plainReason;
  if (isHardExclude) {
    plainReason = composite.reason || 'Excluded — bankruptcy risk or downtrend stage';
  } else if (isAvoid) {
    const topFails = sortedChecks.filter(c => c.status.state === 'fail').slice(0, 3).map(c => c.label.toLowerCase());
    plainReason = topFails.length
      ? `Mostly failing checks. Biggest gaps: ${topFails.join(', ')}.`
      : 'Too few framework checks pass for a buy thesis.';
  } else if (isStage3) {
    plainReason = pb.stage?.warning || 'Distribution phase — take profits on existing positions, no new entries.';
  } else if (isStrongBuy || isBuy) {
    plainReason = pb.stage?.recommendation || pb.stage?.reason || 'Multiple frameworks aligned for entry.';
  } else if (isWatch) {
    // Watch — explain what's missing
    const closeMisses = sortedChecks.filter(c => c.status.state === 'partial').slice(0, 2).map(c => c.label.toLowerCase());
    plainReason = closeMisses.length
      ? `Not yet a buy. Watching for: ${closeMisses.join(', ')}.`
      : (pb.stage?.recommendation || 'Wait for setup to develop.');
  } else {
    plainReason = pb.stage?.reason || 'Analysis complete.';
  }

  // Count of checks that had no data (for the honest "0 of 8 · 2 no data" display)
  const noDataCount = checks.filter(c => c.status.state === 'unknown').length;

  return (
    <div className="card" style={{ padding: 20, marginBottom: 16 }}>
      {/* ═══ VERDICT CARD ═══ */}
      <div style={{
        padding: '18px 18px 16px', background: headerBg,
        border: `1px solid ${headerFg}40`, borderRadius: 12, marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              Verdict
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: headerFg, letterSpacing: '-0.6px', lineHeight: 1.1 }}>
              {plainVerdict}
            </div>
          </div>
          {total > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                Confidence
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'flex-end' }}>
                <span className="tabular-nums" style={{ fontSize: 24, fontWeight: 800, color: headerFg }}>{passCount}</span>
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>of {total} checks pass</span>
              </div>
              {noDataCount > 0 && (
                <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 2 }}>
                  {noDataCount} {noDataCount === 1 ? 'check' : 'checks'} had no data
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(0,0,0,0.18)', borderRadius: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>
            {plainReason}
          </div>
        </div>
        {composite.rsDoubleCountFlag && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--amber-text)' }}>
            ⓘ Industry RS and CANSLIM L both signal market-relative strength — confidence reflects one signal counted twice.
          </div>
        )}
      </div>

      {/* ═══ TRADE PLAN — only when not AVOID ═══ */}
      {showTradePlan && (entry || stop || target) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
          {entry != null && (
            <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Buy near</div>
              <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 700 }}>₹{Number(entry).toFixed(2)}</div>
              <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 2 }}>Breakout pivot</div>
            </div>
          )}
          {stop != null && (
            <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Stop loss</div>
              <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 700, color: 'var(--red-text)' }}>₹{Number(stop).toFixed(2)}</div>
              <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 2 }}>−7% · Minervini rule</div>
            </div>
          )}
          {target != null && (
            <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Target</div>
              <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 700, color: 'var(--green-text)' }}>₹{Number(target).toFixed(2)}</div>
              <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 2 }}>+20% from pivot</div>
            </div>
          )}
          {riskReward != null && (
            <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Risk : Reward</div>
              <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 700, color: riskReward >= 2 ? 'var(--green-text)' : 'var(--amber-text)' }}>
                1 : {riskReward}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 2 }}>≥ 2 preferred</div>
            </div>
          )}
        </div>
      )}

      {/* ═══ 10-CHECK SCOREBOARD ═══ */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>What the checks say</div>
          <div style={{ fontSize: 10, color: 'var(--text4)' }}>Failing first</div>
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {sortedChecks.map(c => {
            const s = STATE_STYLE[c.status.state];
            return (
              <div key={c.key} style={{
                display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 12, alignItems: 'center',
                padding: '8px 10px', background: s.bg, border: `1px solid ${s.fg}25`, borderRadius: 8,
              }}>
                <span aria-label={s.symbol} title={s.symbol} style={{
                  fontSize: 14, fontWeight: 800, color: s.fg, textAlign: 'center',
                }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: s.fg === 'var(--text4)' ? 'var(--text3)' : 'var(--text)' }}>
                    {c.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4, marginTop: 1 }}>{c.reason}</div>
                </div>
                <span className="tabular-nums" style={{ fontSize: 11, fontWeight: 700, color: s.fg }}>{c.status.metric || ''}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ TIER 3 — collapsible drill-downs ═══ */}
      <details style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
        <summary style={{ padding: 12, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text)', listStyle: 'none' }}>
          ▸ Per-framework breakdown
          <span style={{ fontSize: 10, color: 'var(--text4)', fontWeight: 500, marginLeft: 8 }}>(criteria, sub-scores, raw numbers)</span>
        </summary>
        <div style={{ padding: '0 12px 12px', display: 'grid', gap: 4 }}>
          {checks.map(c => (
            <FrameworkDrillDown key={c.key} title={c.deepLabel} item={c.raw} kind={c.key} />
          ))}
        </div>
      </details>

      <details style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <summary style={{ padding: 12, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text)', listStyle: 'none' }}>
          ▸ How the verdict was calculated
        </summary>
        <div style={{ padding: '0 12px 12px', fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
          <p>The verdict starts from <b>hard excludes</b>: an Altman-Z DISTRESS or Weinstein Stage 4 stock is excluded regardless of any other check. Otherwise, the framework checks are tallied. If the stock is in a <b>clean Stage 2 uptrend</b>: 7+ passes → Strong Buy, 5+ → Buy, 3+ → Watch. If the stock is NOT in a clean Stage 2, the bar is higher: 8+ → Strong Buy, 6+ → Watch, below → Avoid.</p>
          <p style={{ marginTop: 6 }}>{passCount} of {total} checks passed in this evaluation.</p>
          {pb.playbookScore != null && (
            <p style={{ marginTop: 6 }}>Legacy composite score (stage-weighted): <b>{pb.playbookScore}</b> · stage multiplier ×{pb.stageMultiplier?.toFixed(1)}</p>
          )}
        </div>
      </details>
    </div>
  );
}

function FrameworkDrillDown({ title, item, kind }) {
  if (!item || item.error) {
    return (
      <details style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
        <summary style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer', listStyle: 'none' }}>
          ▸ {title} <span style={{ color: 'var(--text4)' }}>— no data</span>
        </summary>
      </details>
    );
  }
  return (
    <details style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
      <summary style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', cursor: 'pointer', listStyle: 'none' }}>
        ▸ {title}
      </summary>
      <div style={{ paddingTop: 8, fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
        {kind === 'minervini' && Array.isArray(item.criteria) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
            {item.criteria.map((c, i) => (
              <div key={i} style={{ padding: 8, background: c.pass ? 'rgba(16,185,129,0.06)' : 'rgba(148,163,184,0.04)', borderRadius: 6 }}>
                <div style={{ fontWeight: 600, color: c.pass ? 'var(--green-text)' : 'var(--text)' }}>{c.pass ? '✓' : '○'} {c.name}</div>
                {c.detail && <div style={{ marginTop: 2, color: 'var(--text3)', fontSize: 10 }}>{c.detail}</div>}
              </div>
            ))}
          </div>
        )}
        {kind === 'weinstein' && (
          <div>
            <div><b>Stage:</b> {item.stage}{item.subStage ? ` (${item.subStage})` : ''}</div>
            {item.reason && <div style={{ marginTop: 4 }}>{item.reason}</div>}
            {item.maturity && <div style={{ marginTop: 4 }}><b>{item.maturity.sub}:</b> {item.maturity.note}</div>}
            {item.recommendation && <div style={{ marginTop: 4, color: 'var(--green-text)' }}>→ {item.recommendation}</div>}
            {item.warning && <div style={{ marginTop: 4, color: 'var(--amber-text)' }}>⚠ {item.warning}</div>}
          </div>
        )}
        {kind === 'canslim' && item.letters && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
            {Object.entries(item.letters).map(([letter, l]) => (
              <div key={letter} style={{ padding: 8, background: 'rgba(148,163,184,0.05)', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><b style={{ fontSize: 13 }}>{letter}</b> · {l.name}</span>
                  <span className="tabular-nums" style={{ color: l.score >= 70 ? 'var(--green-text)' : l.score >= 50 ? 'var(--amber-text)' : 'var(--red-text)' }}>
                    {l.score ?? '—'}
                  </span>
                </div>
                {l.detail && <div style={{ marginTop: 2, color: 'var(--text3)', fontSize: 10 }}>{l.detail}</div>}
                {l.flag && <div style={{ marginTop: 2, color: 'var(--amber-text)', fontSize: 10 }}>⚠ {l.flag}</div>}
              </div>
            ))}
          </div>
        )}
        {kind === 'vcp' && (
          <div>
            <div><b>Detected:</b> {item.detected ? 'yes' : 'no'} <span style={{ color: 'var(--text4)' }}>({item.method || ''})</span></div>
            <div style={{ marginTop: 4 }}>{item.reason}</div>
            {Array.isArray(item.contractions) && item.contractions.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <b>Contractions:</b> {item.contractions.map(c => `${c.dropPct}%`).join(' → ')}
                {item.volDryUp != null && <span> · volume {item.volDryUp ? 'drying up ✓' : 'not drying ✗'}</span>}
              </div>
            )}
            {item.pivot != null && <div style={{ marginTop: 4 }}><b>Pivot:</b> ₹{item.pivot} · <b>Stop:</b> ₹{item.stop}</div>}
          </div>
        )}
        {kind === 'cupHandle' && (
          <div>
            <div><b>Detected:</b> {item.detected ? 'yes' : 'no'}</div>
            <div style={{ marginTop: 4 }}>{item.reason}</div>
            {item.pivot != null && <div style={{ marginTop: 4 }}><b>Pivot:</b> ₹{item.pivot} · <b>Stop:</b> ₹{item.stop}</div>}
          </div>
        )}
        {kind === 'piotroski' && Array.isArray(item.criteria) && (
          <div>
            <div style={{ marginBottom: 6 }}><b>F-Score:</b> {item.passed}/9 · {item.tier} · {item.confidence}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 4 }}>
              {item.criteria.map((c, i) => (
                <div key={i} style={{ padding: 6, background: c.pass ? 'rgba(16,185,129,0.06)' : 'rgba(148,163,184,0.04)', borderRadius: 6 }}>
                  <div>{c.pass ? '✓' : '○'} {c.name}</div>
                  {c.detail && <div style={{ color: 'var(--text4)', fontSize: 10, marginTop: 2 }}>{c.detail}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        {kind === 'altman' && (
          <div>
            <div><b>Z = {item.z}</b> · zone: {item.zone} · model: {item.model}</div>
            <div style={{ marginTop: 4 }}>{item.interpretation}</div>
            {item.thresholds && (
              <div style={{ marginTop: 4, color: 'var(--text4)', fontSize: 10 }}>
                Safe ≥ {item.thresholds.safe} · Distress &lt; {item.thresholds.distress}
              </div>
            )}
          </div>
        )}
        {kind === 'industryRS' && (
          <div>
            <div><b>Sector:</b> {item.sector}</div>
            <div style={{ marginTop: 4 }}>Sector rank: {item.sectorRank}/{item.totalSectors} ({item.sectorPercentile}th %ile)</div>
            <div>Stock in sector: {item.stockRankInSector}/{item.sectorPeerCount} ({item.stockPercentileInSector}th %ile)</div>
            <div style={{ marginTop: 4, color: 'var(--text)' }}>{item.label}</div>
          </div>
        )}
        {kind === 'magicFormula' && (
          <div>
            <div><b>EY:</b> {item.earningsYield}% · <b>ROC:</b> {item.returnOnCapital}%</div>
            <div style={{ marginTop: 4 }}>Combined rank: {item.combinedRank} of {item.universeSize}</div>
            <div style={{ marginTop: 4 }}>{item.label}</div>
          </div>
        )}
        {kind === 'accumulation' && !item.skipped && (
          <div>
            <div><b>50-day window:</b> +{item.accDays} accumulation days · −{item.distDays} distribution days · net {item.net >= 0 ? '+' : ''}{item.net}</div>
            <div style={{ marginTop: 4 }}>{item.verdict}</div>
          </div>
        )}
        {kind === 'accumulation' && item.skipped && (
          <div style={{ color: 'var(--text4)' }}>Needs daily candles — not available here.</div>
        )}
      </div>
    </details>
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
    <div style={{
      padding: '10px 12px', background: 'rgba(18,24,40,0.92)',
      border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center',
    }}>
      <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 700, color: col, letterSpacing: '-0.3px' }}>
        {fmt ? fmt(value) : value}
      </div>
      {sub && <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// PriceChart — canvas-based price chart with S/R + Buy Zone + DMA + Fibs
// Ported from drawChart() in public/app.html ~line 7945, formerly Chart.js.
// We draw directly to <canvas> via useEffect + getContext('2d') so we
// don't have to ship a chart library.
// ══════════════════════════════════════════════════════════════════════
function PriceChart({ charts, tf, setTf, supports, resistances, buyZone, tech, fibs, currentPrice, dataAvail }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null); // { x, y, price, date } | null

  const data = Array.isArray(charts?.[tf]) ? charts[tf] : [];

  // Which timeframes actually have data — disable others so clicks don't dead-end.
  // Kite daily history caps ~3Y, so we only offer 3M / 1Y / 3Y.
  const tfAvail = {
    '3M': !!dataAvail?.kite3m || (Array.isArray(charts['3M']) && charts['3M'].length > 0),
    '1Y': !!dataAvail?.kite1y || (Array.isArray(charts['1Y']) && charts['1Y'].length > 0),
    '3Y': !!dataAvail?.kite3y || (Array.isArray(charts['3Y']) && charts['3Y'].length > 0),
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || data.length === 0) return;

    // Support DPR so the chart looks crisp on Retina/Hi-DPI displays.
    const dpr = window.devicePixelRatio || 1;
    const cssW = wrap.clientWidth;
    const cssH = 300;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    // Padding so labels/axis don't overlap the line
    const padL = 8, padR = 48, padT = 12, padB = 24;
    const plotW = cssW - padL - padR;
    const plotH = cssH - padT - padB;

    // Price range — include overlay values so they fit on screen.
    const closes = data.map((p) => p.c);
    let pMin = Math.min(...closes);
    let pMax = Math.max(...closes);
    const includeVals = [];
    (Array.isArray(supports) ? supports : []).slice(0, 4).forEach((s) => s?.price != null && includeVals.push(Number(s.price)));
    (Array.isArray(resistances) ? resistances : []).slice(0, 4).forEach((r) => r?.price != null && includeVals.push(Number(r.price)));
    if (buyZone?.low)  includeVals.push(Number(buyZone.low));
    if (buyZone?.high) includeVals.push(Number(buyZone.high));
    if (tech?.dma50  && (tf === '1Y' || tf === '3Y')) includeVals.push(Number(tech.dma50));
    if (tech?.dma200 && tf !== '3M')                  includeVals.push(Number(tech.dma200));
    if (fibs && (tf === '1Y' || tf === '3Y')) {
      if (fibs.r618) includeVals.push(Number(fibs.r618));
      if (fibs.r382) includeVals.push(Number(fibs.r382));
    }
    includeVals.filter((v) => Number.isFinite(v)).forEach((v) => {
      if (v < pMin) pMin = v;
      if (v > pMax) pMax = v;
    });
    // 3% padding top/bottom like the old Chart.js config
    const pad = Math.max(1, (pMax - pMin) * 0.03);
    pMin -= pad;
    pMax += pad;
    const pRange = pMax - pMin || 1;

    const xOf = (i) => padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
    const yOf = (p) => padT + plotH - ((p - pMin) / pRange) * plotH;

    // Grid lines — 4 horizontal bands, 5 vertical bands
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = padT + (plotH / 5) * i;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
    }
    for (let i = 1; i <= 4; i++) {
      const x = padL + (plotW / 5) * i;
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
    }

    // Buy-zone box (drawn behind the price line)
    if (buyZone?.low && buyZone?.high && Number.isFinite(+buyZone.low) && Number.isFinite(+buyZone.high)) {
      const yHi = yOf(Number(buyZone.high));
      const yLo = yOf(Number(buyZone.low));
      ctx.fillStyle = 'rgba(99,102,241,0.10)';
      ctx.strokeStyle = 'rgba(99,102,241,0.35)';
      ctx.lineWidth = 1;
      ctx.fillRect(padL, yHi, plotW, yLo - yHi);
      ctx.strokeRect(padL, yHi, plotW, yLo - yHi);
      ctx.fillStyle = 'rgba(99,102,241,0.85)';
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('BUY ZONE', padL + 6, yHi + 12);
    }

    // Support levels (up to 4)
    (Array.isArray(supports) ? supports : []).slice(0, 4).forEach((s) => {
      if (s?.price == null) return;
      const y = yOf(Number(s.price));
      ctx.strokeStyle = 'rgba(52,211,153,0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(52,211,153,0.9)';
      ctx.font = '600 9px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`S ₹${Number(s.price).toFixed(0)}`, padL + 4, y - 3);
    });

    // Resistance levels (up to 4)
    (Array.isArray(resistances) ? resistances : []).slice(0, 4).forEach((r) => {
      if (r?.price == null) return;
      const y = yOf(Number(r.price));
      ctx.strokeStyle = 'rgba(248,113,113,0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(248,113,113,0.9)';
      ctx.font = '600 9px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`R ₹${Number(r.price).toFixed(0)}`, padL + plotW - 4, y - 3);
    });

    // 50-DMA (shown on 1Y / 3Y)
    if (tech?.dma50 && (tf === '1Y' || tf === '3Y') && Number.isFinite(+tech.dma50)) {
      const y = yOf(Number(tech.dma50));
      ctx.strokeStyle = 'rgba(251,191,36,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
      ctx.fillStyle = 'rgba(251,191,36,1)';
      ctx.font = '600 9px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('50DMA', padL + 4, y + 10);
    }

    // 200-DMA (shown on all timeframes except 3M)
    if (tech?.dma200 && tf !== '3M' && Number.isFinite(+tech.dma200)) {
      const y = yOf(Number(tech.dma200));
      ctx.strokeStyle = 'rgba(99,102,241,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
      ctx.fillStyle = 'rgba(99,102,241,1)';
      ctx.font = '600 9px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('200DMA', padL + 4, y + 10);
    }

    // Fibonacci 38.2% / 61.8% (on 1Y / 3Y)
    if (fibs && (tf === '1Y' || tf === '3Y')) {
      [['61.8%', fibs.r618], ['38.2%', fibs.r382]].forEach(([lbl, v]) => {
        if (v == null || !Number.isFinite(+v)) return;
        const y = yOf(Number(v));
        ctx.strokeStyle = 'rgba(99,102,241,0.45)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(99,102,241,0.9)';
        ctx.font = '600 9px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`Fib ${lbl}`, padL + plotW - 4, y + 10);
      });
    }

    // Price line (green if up on the window, red if down) — matches old behaviour
    const up = closes[closes.length - 1] >= closes[0];
    const lineCol = up ? '#22c55e' : '#ef4444';
    // Gradient fill under the line
    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, up ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    data.forEach((p, i) => {
      const x = xOf(i), y = yOf(p.c);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    // Close the path for fill
    ctx.lineTo(xOf(data.length - 1), padT + plotH);
    ctx.lineTo(xOf(0), padT + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Stroke the price line cleanly (re-trace without the fill-closing segments)
    ctx.beginPath();
    data.forEach((p, i) => {
      const x = xOf(i), y = yOf(p.c);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = lineCol;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Y-axis price labels (right gutter) — 5 ticks
    ctx.fillStyle = 'rgba(155,163,176,0.85)';
    ctx.font = '500 9px system-ui, sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i <= 5; i++) {
      const price = pMin + (pRange * (5 - i)) / 5;
      const y = padT + (plotH / 5) * i;
      ctx.fillText(`₹${price.toFixed(0)}`, padL + plotW + 4, y + 3);
    }

    // X-axis date labels — ~5 evenly spaced ticks
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(155,163,176,0.75)';
    const tickCount = Math.min(5, data.length);
    for (let i = 0; i < tickCount; i++) {
      const idx = Math.floor(((data.length - 1) * i) / (tickCount - 1 || 1));
      const t = data[idx]?.t;
      if (!t) continue;
      const d2 = new Date(t);
      const lbl = tf === '3Y'
        ? d2.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
        : d2.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      ctx.fillText(lbl, xOf(idx), cssH - 6);
    }

    // Hover crosshair + tooltip
    if (hover) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(hover.x, padT); ctx.lineTo(hover.x, padT + plotH); ctx.stroke();
      ctx.setLineDash([]);
      // Dot
      ctx.fillStyle = lineCol;
      ctx.beginPath(); ctx.arc(hover.x, hover.y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }, [data, tf, supports, resistances, buyZone, tech, fibs, hover]);

  const onMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padL = 8, padR = 48, padT = 12, padB = 24;
    const plotW = rect.width - padL - padR;
    const plotH = 300 - padT - padB;
    const closes = data.map((p) => p.c);
    let pMin = Math.min(...closes), pMax = Math.max(...closes);
    const includeVals = [];
    (Array.isArray(supports) ? supports : []).slice(0, 4).forEach((s) => s?.price != null && includeVals.push(Number(s.price)));
    (Array.isArray(resistances) ? resistances : []).slice(0, 4).forEach((r) => r?.price != null && includeVals.push(Number(r.price)));
    if (buyZone?.low)  includeVals.push(Number(buyZone.low));
    if (buyZone?.high) includeVals.push(Number(buyZone.high));
    includeVals.filter(Number.isFinite).forEach((v) => {
      if (v < pMin) pMin = v;
      if (v > pMax) pMax = v;
    });
    const pad = Math.max(1, (pMax - pMin) * 0.03);
    pMin -= pad; pMax += pad;
    const pRange = pMax - pMin || 1;

    // Find nearest candle
    const frac = Math.max(0, Math.min(1, (x - padL) / plotW));
    const idx = Math.round(frac * (data.length - 1));
    const pt = data[idx];
    if (!pt) { setHover(null); return; }
    const px = padL + (data.length === 1 ? plotW / 2 : (idx / (data.length - 1)) * plotW);
    const py = padT + plotH - ((pt.c - pMin) / pRange) * plotH;
    setHover({ x: px, y: py, price: pt.c, date: pt.t, o: pt.o, h: pt.h, l: pt.l, v: pt.v });
  };

  const onMouseLeave = () => setHover(null);

  const hoverDateStr = hover?.date
    ? new Date(hover.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  return (
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
          {['3M', '1Y', '3Y'].map((t) => {
            const active = t === tf;
            const disabled = !tfAvail[t];
            return (
              <button
                key={t}
                onClick={() => !disabled && setTf(t)}
                disabled={disabled}
                title={disabled ? `${t} data not available` : `Show ${t} chart`}
                style={{
                  padding: '4px 11px', borderRadius: 6,
                  border: `1px solid ${active ? 'var(--brand)' : 'var(--border2)'}`,
                  background: active ? 'var(--brand-bg)' : 'transparent',
                  color: active ? 'var(--brand-text)' : disabled ? 'var(--text4)' : 'var(--text3)',
                  fontSize: 10, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  fontWeight: active ? 700 : 500, letterSpacing: '0.3px',
                  opacity: disabled ? 0.4 : 1,
                  transition: 'all 150ms ease',
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={wrapRef} style={{ position: 'relative', height: 300, width: '100%' }}>
        {data.length === 0 ? (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(99,102,241,0.04) 0%, rgba(99,102,241,0.01) 100%)',
            border: '1px dashed var(--border2)', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>
              No {tf} candles available for this stock
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              Try a shorter timeframe or another symbol.
            </div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            style={{ display: 'block', width: '100%', height: 300 }}
          />
        )}

        {hover && (
          <div style={{
            position: 'absolute',
            top: 8,
            left: Math.min(Math.max(hover.x + 10, 8), (wrapRef.current?.clientWidth || 500) - 180),
            pointerEvents: 'none',
            background: 'rgba(14,16,22,0.95)',
            border: '1px solid var(--border2)',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 11,
            color: 'var(--text)',
            minWidth: 140,
            boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
            zIndex: 2,
          }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>{hoverDateStr}</div>
            <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 700 }}>
              ₹{Number(hover.price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            {hover.o != null && (
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3, display: 'grid', gridTemplateColumns: 'auto auto', gap: '1px 10px' }}>
                <span>O</span><span className="tabular-nums">₹{Number(hover.o).toFixed(2)}</span>
                <span>H</span><span className="tabular-nums" style={{ color: 'var(--green-text)' }}>₹{Number(hover.h).toFixed(2)}</span>
                <span>L</span><span className="tabular-nums" style={{ color: 'var(--red-text)' }}>₹{Number(hover.l).toFixed(2)}</span>
                {hover.v ? (<><span>V</span><span className="tabular-nums">{Number(hover.v).toLocaleString('en-IN')}</span></>) : null}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, fontSize: 10, color: 'var(--text3)' }}>
        <LegendSwatch color="#22c55e" label="Support" dashed />
        <LegendSwatch color="#ef4444" label="Resistance" dashed />
        <LegendSwatch color="rgba(99,102,241,0.5)" label="Buy Zone" box />
        <LegendSwatch color="#fbbf24" label="50-DMA" />
        <LegendSwatch color="#6366f1" label="200-DMA" />
        {fibs && (tf === '1Y' || tf === '3Y') && <LegendSwatch color="#6366f1" label="Fib 38.2 / 61.8" dashed />}
        {currentPrice != null && (
          <span className="tabular-nums" style={{ marginLeft: 'auto', color: 'var(--text2)' }}>
            Spot ₹{Number(currentPrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
        )}
      </div>
    </div>
  );
}

function LegendSwatch({ color, label, dashed, box }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {box ? (
        <span style={{ display: 'inline-block', width: 14, height: 10, background: color, border: `1px solid ${color}`, borderRadius: 2 }} />
      ) : (
        <span style={{
          display: 'inline-block', width: 16, height: 0,
          borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
        }} />
      )}
      <span>{label}</span>
    </span>
  );
}

// SigBox — signal cell matching old `sigBox(label,val,signal,detail)` helper
// used throughout the Complete Technical Analysis section. Renders a tinted
// value with directional ▲/▼/● glyph and optional context line beneath.
function SigBox({ label, value, signal, detail }) {
  const color = signal === 'bullish' ? 'var(--green-text)'
              : signal === 'bearish' ? 'var(--red-text)'
              : 'var(--amber-text)';
  const icon = signal === 'bullish' ? '▲' : signal === 'bearish' ? '▼' : '●';
  const bg   = signal === 'bullish' ? 'rgba(34,197,94,0.06)'
             : signal === 'bearish' ? 'rgba(239,68,68,0.06)'
             : 'rgba(255,255,255,0.03)';
  return (
    <div style={{
      padding: '10px 12px', background: bg, border: '1px solid var(--border)',
      borderRadius: 10, minWidth: 0,
    }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div className="tabular-nums" style={{
        fontSize: 13, fontWeight: 700, color, marginTop: 4,
        display: 'flex', alignItems: 'baseline', gap: 5, lineHeight: 1.2,
      }}>
        <span style={{ fontSize: 10 }}>{icon}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
      </div>
      {detail && (
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3, lineHeight: 1.4 }}>
          {detail}
        </div>
      )}
    </div>
  );
}

// -- Grouped tech subsection wrapper (matches old `techSection` helper) ------
function TechSubsection({ title, boxes }) {
  const visible = boxes.filter(Boolean);
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--brand-text)',
        marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        {title}
      </div>
      {visible.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {visible}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: 'var(--text3)', padding: 4 }}>Need more data</div>
      )}
    </div>
  );
}

// Complete Technical Analysis grid — ported line-for-line from old buildUI()
// Moving Averages · Oscillators · Trend & Volatility · Volume & Accumulation
// · Ichimoku · Price Performance — each as a sigBox cell.
function TechnicalsGrid({ t, px, ichimoku, patterns }) {
  const n = (v, d = 1) => v != null && Number.isFinite(+v) ? (+v).toFixed(d) : '—';

  // ─── MOVING AVERAGES ──────────────────────────────────────────────────
  const maBoxes = [
    px != null && t.dma9  != null  && <SigBox key="dma9"  label="DMA 9"   value={`₹${n(t.dma9,1)}`}   signal={px>t.dma9?'bullish':'bearish'}  detail={px>t.dma9?'Above':'Below'} />,
    px != null && t.dma20 != null  && <SigBox key="dma20" label="DMA 20"  value={`₹${n(t.dma20,1)}`}  signal={px>t.dma20?'bullish':'bearish'} detail={px>t.dma20?'Above':'Below'} />,
    px != null && t.dma50 != null  && <SigBox key="dma50" label="DMA 50"  value={`₹${n(t.dma50,1)}`}  signal={px>t.dma50?'bullish':'bearish'} detail={px>t.dma50?'Inst. support':'Below support'} />,
    px != null && t.dma100!= null  && <SigBox key="dma100"label="DMA 100" value={`₹${n(t.dma100,1)}`} signal={px>t.dma100?'bullish':'bearish'} detail="" />,
    px != null && t.dma150!= null  && <SigBox key="dma150"label="DMA 150" value={`₹${n(t.dma150,1)}`} signal={px>t.dma150?'bullish':'bearish'} detail="" />,
    px != null && t.dma200!= null  && <SigBox key="dma200"label="DMA 200" value={`₹${n(t.dma200,1)}`} signal={px>t.dma200?'bullish':'bearish'} detail={px>t.dma200?'Long-term up':'Downtrend'} />,
    (t.dma50 != null && t.dma200 != null) && <SigBox key="macross" label="MA Cross" value={t.goldenCross?'Golden':'Death'} signal={t.goldenCross?'bullish':'bearish'} detail={t.goldenCross?'50 > 200 bullish':'50 < 200 bearish'} />,
    t.dma200Trend && <SigBox key="dma200tr" label="200DMA Trend" value={t.dma200Trend==='rising'?'Rising':'Falling'} signal={t.dma200Trend==='rising'?'bullish':'bearish'} detail="Long-term direction" />,
    px != null && t.ema20 != null  && <SigBox key="ema20" label="EMA 20"  value={`₹${n(t.ema20,1)}`}  signal={px>t.ema20?'bullish':'bearish'} detail="Dynamic S/R" />,
    px != null && t.ema50 != null  && <SigBox key="ema50" label="EMA 50"  value={`₹${n(t.ema50,1)}`}  signal={px>t.ema50?'bullish':'bearish'} detail="" />,
    px != null && t.ema200!= null  && <SigBox key="ema200"label="EMA 200" value={`₹${n(t.ema200,1)}`} signal={px>t.ema200?'bullish':'bearish'} detail="Long-term EMA" />,
  ];

  // ─── OSCILLATORS ──────────────────────────────────────────────────────
  const oscBoxes = [
    t.rsi7 != null && <SigBox key="rsi7" label="RSI-7" value={n(t.rsi7,1)} signal={t.rsi7<35?'bullish':t.rsi7>70?'bearish':'neutral'} detail={t.rsi7<35?'Oversold':t.rsi7>70?'Overbought':'Neutral'} />,
    t.rsi14!= null && <SigBox key="rsi14" label="RSI-14" value={n(t.rsi14,1)} signal={t.rsi14<40?'bullish':t.rsi14>65?'bearish':'neutral'} detail={t.rsi14<40?'Oversold':t.rsi14>65?'Overbought':'Neutral'} />,
    t.rsi21!= null && <SigBox key="rsi21" label="RSI-21" value={n(t.rsi21,1)} signal={t.rsi21<40?'bullish':t.rsi21>65?'bearish':'neutral'} detail="Slow RSI" />,
    t.stochRsiK != null && <SigBox key="stochrsi" label="StochRSI" value={`${n(t.stochRsiK,0)}%`} signal={t.stochRsiK<20?'bullish':t.stochRsiK>80?'bearish':'neutral'} detail="RSI of RSI" />,
    t.stochK != null && <SigBox key="stoch" label="Stoch %K" value={`%K:${n(t.stochK,0)} %D:${n(t.stochD,1)}`} signal={t.stochK<25?'bullish':t.stochK>75?'bearish':'neutral'} detail="Stochastic osc" />,
    (t.macd != null || t.macdVal != null) && <SigBox key="macd" label="MACD" value={n(t.macd ?? t.macdVal, 2)} signal={t.macdBull?'bullish':'bearish'} detail={`Hist: ${t.macdHist ?? '—'}${t.macdMomentum ? ' · ' + t.macdMomentum : ''}`} />,
    t.cci != null && <SigBox key="cci" label="CCI-20" value={n(t.cci,0)} signal={t.cciSignal==='oversold'?'bullish':t.cciSignal==='overbought'?'bearish':'neutral'} detail={t.cciSignal||'Neutral'} />,
    t.willR != null && <SigBox key="willr" label="Williams %R" value={`${n(t.willR,0)}%`} signal={t.willR<-80?'bullish':t.willR>-20?'bearish':'neutral'} detail={t.willR<-80?'Oversold':t.willR>-20?'Overbought':'Neutral'} />,
    t.roc10 != null && <SigBox key="roc10" label="ROC-10" value={`${t.roc10>0?'+':''}${n(t.roc10,1)}%`} signal={t.roc10>0?'bullish':'bearish'} detail="Rate of change" />,
    t.mfi != null && <SigBox key="mfi" label="MFI-14" value={n(t.mfi,0)} signal={t.mfi<30?'bullish':t.mfi>70?'bearish':'neutral'} detail="Vol-weighted RSI" />,
  ];

  // ─── TREND & VOLATILITY ───────────────────────────────────────────────
  const trendBoxes = [
    t.adx != null && <SigBox key="adx" label="ADX" value={n(t.adx,1)} signal={t.adx>25?'bullish':'neutral'} detail={t.trendStrength||'Trend strength'} />,
    t.adxPlus  != null && <SigBox key="adxp" label="+DI" value={n(t.adxPlus,1)} signal={t.adxMinus!=null && t.adxPlus>t.adxMinus?'bullish':'neutral'} detail="Bullish directional" />,
    t.adxMinus != null && <SigBox key="adxm" label="-DI" value={n(t.adxMinus,1)} signal={t.adxPlus!=null && t.adxMinus>t.adxPlus?'bearish':'neutral'} detail="Bearish directional" />,
    t.supertrendSig && <SigBox key="st" label="Supertrend" value={`₹${n(t.supertrend,1)}`} signal={t.supertrendSig} detail={t.supertrendSig==='bullish'?'Above ST':'Below ST'} />,
    t.sarSignal && <SigBox key="sar" label="Parabolic SAR" value={`₹${n(t.sar,1)}`} signal={t.sarSignal} detail={t.sarSignal==='bullish'?'SAR below':'SAR above'} />,
    t.bbUpper != null && <SigBox key="bbu" label="BB Upper" value={`₹${n(t.bbUpper,1)}`} signal="neutral" detail="Upper band" />,
    t.bbLower != null && <SigBox key="bbl" label="BB Lower" value={`₹${n(t.bbLower,1)}`} signal="neutral" detail="Lower band" />,
    t.bbPct != null && <SigBox key="bbpct" label="BB %B" value={`${n(t.bbPct*100,0)}%`} signal={t.bbPct<0.2?'bullish':t.bbPct>0.8?'bearish':'neutral'} detail={t.bbWidth!=null?`Width: ${t.bbWidth}%`:'Band position'} />,
    t.bbSqueeze != null && <SigBox key="bbsq" label="BB Squeeze" value={t.bbSqueeze?'Active':'No'} signal="neutral" detail="Precedes big move" />,
    t.sqzMomentum != null && <SigBox key="sqzmom" label="Sqz Momentum" value={t.sqzMomentum?'Squeeze':'Normal'} signal="neutral" detail="Volatility" />,
    t.atr14 != null && <SigBox key="atr14" label="ATR-14" value={n(t.atr14,2)} signal="neutral" detail="Avg true range" />,
    t.atrPct != null && <SigBox key="atrpct" label="ATR%" value={`${t.atrPct}%`} signal="neutral" detail="Daily volatility" />,
    t.annualVol != null && <SigBox key="avol" label="Annual Vol" value={`${t.annualVol}%`} signal={t.annualVol<25?'bullish':t.annualVol>50?'bearish':'neutral'} detail="Yearly volatility" />,
    t.beta != null && <SigBox key="beta" label="Beta" value={String(t.beta)} signal={Math.abs(t.beta-1)<0.4?'bullish':'neutral'} detail={t.beta<0.8?'Low risk':t.beta>1.5?'High risk':'Market-like'} />,
    t.pctAbove200 != null && <SigBox key="vs200" label="vs 200DMA" value={`${t.pctAbove200>0?'+':''}${t.pctAbove200}%`} signal={t.pctAbove200>0&&t.pctAbove200<20?'bullish':t.pctAbove200>30?'neutral':'bearish'} detail={t.overextended?'OVEREXTENDED':'Normal range'} />,
  ];

  // ─── VOLUME & ACCUMULATION ────────────────────────────────────────────
  const volBoxes = [
    (t.volRatio20 != null || t.volRatio != null) && <SigBox key="volr" label="Vol / 20D Avg" value={`${n(t.volRatio20 ?? t.volRatio,2)}x`} signal={(t.volRatio20 ?? t.volRatio)>1.2?'bullish':(t.volRatio20 ?? t.volRatio)<0.8?'bearish':'neutral'} detail={t.volTrend||'Activity vs average'} />,
    t.accumDist && <SigBox key="ad" label="Accum/Dist" value={String(t.accumDist)} signal={String(t.accumDist).toLowerCase().includes('accum')?'bullish':'bearish'} detail="Volume pattern" />,
    t.obvTrend && <SigBox key="obvtr" label="OBV" value={String(t.obvTrend).split('(')[0].trim()} signal={String(t.obvTrend).toLowerCase().includes('rising')?'bullish':'bearish'} detail="On-balance volume" />,
    t.obv != null && !t.obvTrend && <SigBox key="obv" label="OBV" value={n(t.obv,0)} signal="neutral" detail="On-balance volume" />,
    px != null && t.vwap != null && <SigBox key="vwap" label="VWAP" value={`₹${n(t.vwap,1)}`} signal={px>t.vwap?'bullish':'bearish'} detail={px>t.vwap?'Above VWAP':'Below VWAP'} />,
    t.mfi != null && <SigBox key="mfif" label="MFI Flow" value={n(t.mfi,0)} signal={t.mfi>60?'bullish':t.mfi<40?'bearish':'neutral'} detail="Money flow" />,
    t.bullishDiv && <SigBox key="bulldiv" label="Bullish Div" value="Yes" signal="bullish" detail="Price↓ OBV↑" />,
    t.bearishDiv && <SigBox key="beardiv" label="Bearish Div" value="Yes" signal="bearish" detail="Price↑ OBV↓" />,
  ];

  // ─── ICHIMOKU CLOUD ───────────────────────────────────────────────────
  const ich = ichimoku || {};
  const ichBoxes = ich.tenkan != null ? [
    ich.tenkan  != null && <SigBox key="ten" label="Tenkan (9)"  value={`₹${n(ich.tenkan,1)}`}  signal={ich.tenkanAboveKijun?'bullish':'bearish'} detail="Fast line" />,
    ich.kijun   != null && <SigBox key="kij" label="Kijun (26)"  value={`₹${n(ich.kijun,1)}`}   signal={ich.tenkanAboveKijun?'bullish':'bearish'} detail="Slow line" />,
    ich.senkouA != null && <SigBox key="sa"  label="Senkou A"    value={`₹${n(ich.senkouA,1)}`} signal="neutral" detail="Cloud edge 1" />,
    ich.senkouB != null && <SigBox key="sb"  label="Senkou B"    value={`₹${n(ich.senkouB,1)}`} signal="neutral" detail="Cloud edge 2" />,
    ich.chikou  != null && <SigBox key="ch"  label="Chikou"      value={`₹${n(ich.chikou,1)}`}  signal="neutral" detail="Lagging span" />,
    ich.aboveCloud != null && <SigBox key="clvs" label="Cloud" value={ich.aboveCloud?'Above':'Below'} signal={ich.aboveCloud?'bullish':'bearish'} detail="vs Ichimoku cloud" />,
    ich.bullish != null && <SigBox key="ichov" label="Overall" value={ich.bullish?'Bullish':'Bearish'} signal={ich.bullish?'bullish':'bearish'} detail="All signals" />,
  ] : [];

  // ─── PRICE PERFORMANCE ────────────────────────────────────────────────
  const perfBoxes = [
    t.ret1m != null && <SigBox key="r1m" label="1M Return" value={`${t.ret1m>0?'+':''}${t.ret1m}%`} signal={t.ret1m>0?'bullish':'bearish'} detail="" />,
    t.ret3m != null && <SigBox key="r3m" label="3M Return" value={`${t.ret3m>0?'+':''}${t.ret3m}%`} signal={t.ret3m>0?'bullish':'bearish'} detail="" />,
    t.ret6m != null && <SigBox key="r6m" label="6M Return" value={`${t.ret6m>0?'+':''}${t.ret6m}%`} signal={t.ret6m>0?'bullish':'bearish'} detail="" />,
    t.ret1y != null && <SigBox key="r1y" label="1Y Return" value={`${t.ret1y>0?'+':''}${t.ret1y}%`} signal={t.ret1y>0?'bullish':'bearish'} detail="" />,
    t.ret3y != null && <SigBox key="r3y" label="3Y Return" value={`${t.ret3y>0?'+':''}${t.ret3y}%`} signal={t.ret3y>0?'bullish':'bearish'} detail="" />,
    t.wk52Hi != null && <SigBox key="hi" label="52W High" value={`₹${t.wk52Hi}`} signal="neutral" detail={t.pctFromHigh!=null?`${t.pctFromHigh}% away`:''} />,
    t.wk52Lo != null && <SigBox key="lo" label="52W Low" value={`₹${t.wk52Lo}`} signal="neutral" detail={t.pctFromLow!=null?`+${t.pctFromLow}% above`:''} />,
    t.weeklyTrend && <SigBox key="wtr" label="Weekly Trend" value={String(t.weeklyTrend).charAt(0).toUpperCase()+String(t.weeklyTrend).slice(1)} signal={t.weeklyTrend==='uptrend'?'bullish':t.weeklyTrend==='downtrend'?'bearish':'neutral'} detail="Higher highs/lows" />,
  ];

  return (
    <div>
      <TechSubsection title="Moving Averages" boxes={maBoxes} />
      <TechSubsection title="Oscillators" boxes={oscBoxes} />
      <TechSubsection title="Trend & Volatility" boxes={trendBoxes} />
      <TechSubsection title="Volume & Accumulation" boxes={volBoxes} />
      {ichBoxes.length > 0 && <TechSubsection title="Ichimoku Cloud" boxes={ichBoxes} />}
      <TechSubsection title="Price Performance" boxes={perfBoxes} />

      {/* Candlestick patterns — as signal-badges, matching old layout */}
      {Array.isArray(patterns) && patterns.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--brand-text)',
            marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Candlestick Patterns
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {patterns.map((p, i) => {
              const col = p.signal === 'bullish' ? 'var(--green-text)'
                        : p.signal === 'bearish' ? 'var(--red-text)'
                        : 'var(--amber-text)';
              const bg  = p.signal === 'bullish' ? 'var(--green-bg)'
                        : p.signal === 'bearish' ? 'var(--red-bg)'
                        : 'var(--amber-bg)';
              return (
                <div key={i} style={{
                  background: bg, border: `1px solid ${col}33`, borderRadius: 8,
                  padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: col }}>🕯 {p.name}</div>
                  {p.desc && <div style={{ fontSize: 9, color: 'var(--text3)' }}>{p.desc}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
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
  // 2026-04-30 — admin gate. Backend 403s for non-admin (51e6e0c) but the
  // button visibility was leaking. 5-model fan-out is expensive.
  const isAdmin = useAppStore((s) => s.user?.role === 'admin');
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
          <button
            onClick={isAdmin ? runReview : undefined}
            disabled={!isAdmin}
            className="btn btn-primary"
            style={{ height: 40, fontSize: 13, opacity: isAdmin ? 1 : 0.5 }}
            title={isAdmin ? 'Run 5-council + judge AI review on this stock' : 'AI Review — admin only (5-model fan-out is expensive)'}
          >
            {isAdmin ? '▶ Run AI Review' : '▶ Run AI Review — Admin Only'}
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
