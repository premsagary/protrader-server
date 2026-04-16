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
    apiGet('/api/stocks/scored')
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
      <div
        className="card card-premium"
        style={{ padding: '20px 24px', marginBottom: 28 }}
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
                borderRadius: 14, boxShadow: 'var(--shadow-lg)', zIndex: 10, overflow: 'hidden',
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

/* ─────────────────────────────────────────────────────────
   Analysis Result — hero scorecard + data
   ───────────────────────────────────────────────────────── */
function AnalysisResult({ data }) {
  const a = data || {};
  const score = a.score ?? a.compositeScore ?? null;
  const tier = (a.tier || a.conviction || '').toLowerCase();
  const tierColor = { 'strong buy': 'var(--green-text)', buy: 'var(--green-text)', accumulate: 'var(--amber-text)', hold: 'var(--amber-text)', watch: 'var(--text2)', avoid: 'var(--red-text)', sell: 'var(--red-text)' }[tier] || 'var(--text)';
  const tierBg = { 'strong buy': 'var(--green-bg)', buy: 'var(--green-bg)', accumulate: 'var(--amber-bg)', hold: 'var(--amber-bg)', watch: 'rgba(148,163,184,0.14)', avoid: 'var(--red-bg)', sell: 'var(--red-bg)' }[tier] || 'var(--brand-bg)';

  return (
    <div className="animate-fadeIn">
      {/* Hero scorecard — gradient banner like landing */}
      <div
        style={{
          background: score >= 60
            ? 'linear-gradient(135deg, rgba(52,211,153,0.12) 0%, rgba(99,102,241,0.12) 100%)'
            : score >= 40
              ? 'linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(99,102,241,0.12) 100%)'
              : 'linear-gradient(135deg, rgba(248,113,113,0.12) 0%, rgba(99,102,241,0.12) 100%)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: '32px 36px',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 24,
        }}
      >
        <div>
          <div className="label-xs" style={{ marginBottom: 10 }}>{a.group || a.grp || 'NSE'}</div>
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.8px', color: 'var(--text)', marginBottom: 6, lineHeight: 1.1 }}>
            {a.sym || a.symbol || '—'}
          </h2>
          <div style={{ fontSize: 16, color: 'var(--text2)', marginBottom: 14 }}>
            {a.name || ''}
            {a.price && <span className="tabular-nums" style={{ marginLeft: 14, color: 'var(--text)', fontWeight: 700, fontSize: 20 }}>₹{Number(a.price).toLocaleString('en-IN')}</span>}
          </div>
          {tier && (
            <span style={{
              display: 'inline-block', padding: '7px 16px', background: tierBg, color: tierColor,
              borderRadius: 9999, fontSize: 13, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase',
            }}>
              {tier}
            </span>
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
            <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 4, fontWeight: 500 }}>/ 100</div>
          </div>
        )}
      </div>

      {/* Raw JSON fallback */}
      <div className="card" style={{ padding: 24 }}>
        <div className="label-xs" style={{ marginBottom: 12 }}>Full analysis response</div>
        <pre style={{
          fontSize: 13, lineHeight: 1.6, color: 'var(--text2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          fontFamily: '"SF Mono","JetBrains Mono",monospace', maxHeight: 500, overflow: 'auto',
          background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 20,
        }}>
          {JSON.stringify(a, null, 2)}
        </pre>
        <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text3)' }}>
          Rich renders for checklist, support/resistance, Fibonacci, news — coming in Phase 2.
        </p>
      </div>
    </div>
  );
}
