import React, { useState, useEffect, useRef } from 'react';
import { apiGet } from '../../api/client';

const DEFAULT_UNIVERSE = 567;

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

  // Fetch universe on mount for search
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

  // Search-as-you-type
  useEffect(() => {
    if (!universe || !query.trim()) {
      setSuggestions([]);
      return;
    }
    const q = query.trim().toUpperCase();
    const matches = universe
      .filter((s) => s.sym?.toUpperCase().startsWith(q) || s.name?.toUpperCase().includes(q))
      .slice(0, 8);
    setSuggestions(matches);
  }, [query, universe]);

  const handleAnalyze = async () => {
    const sym = (selected?.sym || query).trim().toUpperCase();
    if (!sym) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const data = await apiGet(`/api/stocks/analyze/${encodeURIComponent(sym)}`);
      setAnalysis(data);
    } catch (e) {
      setError(e.message || 'Failed to fetch analysis');
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
      {/* Hero */}
      <div style={{ marginBottom: 28 }}>
        <div className="label-xs" style={{ marginBottom: 10 }}>Flagship · 14-point Varsity checklist</div>
        <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1, color: 'var(--text)', marginBottom: 10 }}>
          <span className="gradient-fill">Deep</span> Stock Analyzer
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text2)', maxWidth: 720, lineHeight: 1.5 }}>
          14-point Varsity checklist, 30+ technical indicators, support/resistance mapping, buy zones, Fibonacci levels, and live news sentiment — for every NSE stock.
        </p>
      </div>

      {/* Search card */}
      <div
        className="card card-premium"
        style={{
          padding: 24,
          marginBottom: 28,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 280 }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }}
            >
              <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 12 L15 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 180)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (suggestions.length) pickSuggestion(suggestions[0]);
                  else handleAnalyze();
                }
              }}
              placeholder="Search stock… e.g. RELIANCE, TCS"
              style={{
                width: '100%',
                height: 46,
                padding: '0 16px 0 40px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border2)',
                borderRadius: 12,
                color: 'var(--text)',
                fontSize: 15,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />

            {/* Suggestions dropdown */}
            {showDropdown && suggestions.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  background: '#1A1A22',
                  border: '1px solid var(--border2)',
                  borderRadius: 12,
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 10,
                  overflow: 'hidden',
                }}
              >
                {suggestions.map((s) => (
                  <button
                    key={s.sym}
                    onMouseDown={() => pickSuggestion(s)}
                    style={{
                      display: 'flex',
                      width: '100%',
                      padding: '10px 16px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      gap: 12,
                      alignItems: 'center',
                      transition: 'background 150ms ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', minWidth: 90 }}>
                      {s.sym}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text3)', flex: 1 }}>{s.name}</span>
                    {s.grp && (
                      <span className="chip" style={{ height: 22, fontSize: 10, padding: '0 8px' }}>
                        {s.grp}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading || !query.trim()}
            className="btn btn-primary"
            style={{ height: 46, padding: '0 22px', fontSize: 15, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="animate-pulse-custom">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
                  <path d="M7 2 A5 5 0 0 1 12 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Analyzing…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1 L2 8 H7 L6 13 L12 6 H7 Z" fill="currentColor" />
                </svg>
                Analyze
              </>
            )}
          </button>

          <div className="chip" style={{ marginLeft: 'auto' }}>
            {universe ? universe.length : DEFAULT_UNIVERSE} stocks
            <span style={{ color: 'var(--text4)', margin: '0 4px' }}>·</span>
            Candles + fundamentals + news
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '14px 18px',
            background: 'var(--red-bg)',
            border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: 12,
            color: 'var(--red-text)',
            fontSize: 14,
            marginBottom: 20,
          }}
        >
          <b>Analysis failed:</b> {error}
        </div>
      )}

      {/* Analysis result */}
      {analysis && <AnalysisResult data={analysis} />}

      {/* Empty hint */}
      {!analysis && !error && !loading && (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            color: 'var(--text3)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--brand-bg)',
              border: '1px solid var(--brand-border)',
              margin: '0 auto 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M4 16 L9 10 L13 13 L20 5" stroke="var(--brand-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 5 H20 V10" stroke="var(--brand-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Pick any NSE stock to begin</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Works with 500+ stocks across Nifty 50, Next 50, Midcap, and Smallcap.</div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Analysis result renderer
   ───────────────────────────────────────────────────────── */
function AnalysisResult({ data }) {
  const a = data || {};
  const score = a.score ?? a.compositeScore ?? null;
  const tier = (a.tier || a.conviction || '').toLowerCase();
  const tierColor = {
    'strong buy': 'var(--green-text)',
    buy: 'var(--green-text)',
    accumulate: 'var(--amber-text)',
    hold: 'var(--amber-text)',
    watch: 'var(--text2)',
    avoid: 'var(--red-text)',
    sell: 'var(--red-text)',
  }[tier] || 'var(--text)';
  const tierBg = {
    'strong buy': 'var(--green-bg)',
    buy: 'var(--green-bg)',
    accumulate: 'var(--amber-bg)',
    hold: 'var(--amber-bg)',
    watch: 'rgba(148,163,184,0.14)',
    avoid: 'var(--red-bg)',
    sell: 'var(--red-bg)',
  }[tier] || 'var(--brand-bg)';

  return (
    <div>
      {/* Hero scorecard */}
      <div
        className="card card-premium"
        style={{
          padding: 28,
          marginBottom: 20,
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 24,
          alignItems: 'center',
        }}
      >
        <div>
          <div className="label-xs" style={{ marginBottom: 8 }}>{a.group || a.grp || 'NSE'}</div>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)', marginBottom: 6 }}>
            {a.sym || a.symbol || '—'}
          </h2>
          <div style={{ fontSize: 15, color: 'var(--text2)' }}>
            {a.name || ''}
            {a.price && <span className="tabular-nums" style={{ marginLeft: 12, color: 'var(--text)', fontWeight: 600 }}>₹{Number(a.price).toLocaleString('en-IN')}</span>}
          </div>
          {tier && (
            <div style={{ marginTop: 14 }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '6px 14px',
                  background: tierBg,
                  color: tierColor,
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                }}
              >
                {tier}
              </span>
            </div>
          )}
        </div>
        {score != null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 4 }}>
              Varsity Score
            </div>
            <div className="tabular-nums gradient-fill" style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, letterSpacing: '-2px' }}>
              {Math.round(score)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>/ 100</div>
          </div>
        )}
      </div>

      {/* Raw JSON fallback for fields we haven't built pretty renderers for yet */}
      <div className="card" style={{ padding: 20 }}>
        <div className="label-xs" style={{ marginBottom: 10 }}>Full response</div>
        <pre
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--text2)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: '"SF Mono","JetBrains Mono",monospace',
            maxHeight: 500,
            overflow: 'auto',
          }}
        >
          {JSON.stringify(a, null, 2)}
        </pre>
        <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text3)' }}>
          Rich render for checklist, support/resistance, Fibonacci, news — coming in Phase 2.
        </div>
      </div>
    </div>
  );
}
