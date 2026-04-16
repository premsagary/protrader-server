import React, { useEffect, useState } from 'react';
import { apiGet } from '../../api/client';

export default function StockPicks() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    setLoading(true);
    apiGet('/api/stocks/score')
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || 'Failed');
        setLoading(false);
      });
  }, []);

  const stocks = (data?.stocks || data || []).filter(Boolean);

  const counts = {
    total: stocks.length,
    rebound: stocks.filter((s) => (s.rebound_score || 0) > 0).length,
    momentum: stocks.filter((s) => (s.momentum_score || 0) > 0).length,
    investment: stocks.filter((s) => (s.investment_score || 0) > 0).length,
    nifty50: stocks.filter((s) => (s.grp || '').toLowerCase().includes('nifty')).length,
    midcap: stocks.filter((s) => (s.grp || '').toLowerCase().includes('midcap')).length,
    smallcap: stocks.filter((s) => (s.grp || '').toLowerCase().includes('smallcap')).length,
  };

  // Sort by investment score for top long-term picks
  const topPicks = [...stocks]
    .filter((s) => (s.investment_score || 0) > 0)
    .sort((a, b) => (b.investment_score || 0) - (a.investment_score || 0))
    .slice(0, 12);

  const filterPills = ['ALL', 'NIFTY50', 'NEXT50', 'MIDCAP', 'SMALLCAP'];
  const filtered = filter === 'ALL' ? topPicks : topPicks.filter((s) => (s.grp || '').toUpperCase().includes(filter));

  return (
    <div>
      {/* ═══ HERO BANNER — gradient like landing ═══ */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(52,211,153,0.10) 50%, rgba(251,191,36,0.10) 100%)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: '32px 36px',
          marginBottom: 28,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(99,102,241,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div className="label-xs" style={{ marginBottom: 10 }}>Daily picks · Updated automatically</div>
            <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-1.2px', lineHeight: 1.05, color: 'var(--text)', marginBottom: 10 }}>
              <span className="gradient-fill">Stock Picks</span>
            </h1>
            <p style={{ fontSize: 16, color: 'var(--text2)', maxWidth: 620, lineHeight: 1.5 }}>
              Three daily strategies ranked from {counts.total || 567} NSE stocks. Rebound, Momentum, Long-Term. Fully transparent scoring.
            </p>
          </div>
          {counts.total > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div className="tabular-nums gradient-fill" style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, letterSpacing: '-2px' }}>
                {counts.total}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6, fontWeight: 500 }}>stocks scored</div>
            </div>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[
          { l: 'Total', v: counts.total, c: 'var(--text)' },
          { l: 'Rebound', v: counts.rebound, c: 'var(--amber-text)' },
          { l: 'Momentum', v: counts.momentum, c: 'var(--green-text)' },
          { l: 'Long-Term', v: counts.investment, c: 'var(--brand-text)' },
          { l: 'Midcap', v: counts.midcap, c: 'var(--purple-text)' },
          { l: 'Smallcap', v: counts.smallcap, c: 'var(--red-text)' },
        ].map((s, i) => (
          <div
            key={i}
            className="card"
            style={{ padding: '18px 20px', cursor: 'default' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>
              {s.l}
            </div>
            <div className="tabular-nums" style={{ fontSize: 28, fontWeight: 800, color: s.c, letterSpacing: '-0.8px', lineHeight: 1 }}>
              {loading ? '—' : s.v}
            </div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {filterPills.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px',
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 600,
              background: filter === f ? 'var(--brand)' : 'rgba(255,255,255,0.04)',
              color: filter === f ? '#fff' : 'var(--text2)',
              border: `1px solid ${filter === f ? 'var(--brand)' : 'var(--border)'}`,
              cursor: 'pointer',
              transition: 'all 180ms ease',
              fontFamily: 'inherit',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="card" style={{ padding: 24, color: 'var(--red-text)' }}>
          Failed to load picks: {error}
        </div>
      )}

      {/* Top picks grid */}
      {!loading && !error && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 14, letterSpacing: '-0.2px' }}>
            Top long-term picks {filter !== 'ALL' && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· {filter}</span>}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 14,
            }}
          >
            {filtered.map((s, i) => (
              <StockCard key={s.sym} stock={s} rank={i + 1} featured={i < 3} />
            ))}
          </div>
          {filtered.length === 0 && (
            <div
              style={{
                padding: 48,
                textAlign: 'center',
                color: 'var(--text3)',
                border: '1px dashed var(--border2)',
                borderRadius: 14,
              }}
            >
              No picks match {filter}.
            </div>
          )}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card" style={{ padding: 18, opacity: 0.5 }}>
              <div style={{ height: 20, background: 'var(--bg3)', borderRadius: 6, marginBottom: 12, width: '60%' }} />
              <div style={{ height: 14, background: 'var(--bg3)', borderRadius: 6, marginBottom: 8, width: '80%' }} />
              <div style={{ height: 14, background: 'var(--bg3)', borderRadius: 6, width: '40%' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StockCard({ stock, rank, featured }) {
  const s = stock;
  const score = Math.round(s.investment_score || s.momentum_score || s.rebound_score || 0);
  const price = s.price ? `₹${Number(s.price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—';
  const change = s.change_pct || s.change;
  const changeColor = change > 0 ? 'var(--green-text)' : change < 0 ? 'var(--red-text)' : 'var(--text3)';

  return (
    <div
      className={`card ${featured ? 'card-premium' : ''}`}
      style={{ padding: 18, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.8px',
                color: 'var(--brand-text)',
              }}
            >
              #{rank}
            </span>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>
              {s.sym}
            </span>
            {s.grp && (
              <span
                className="chip"
                style={{ height: 20, fontSize: 10, padding: '0 7px', fontWeight: 600 }}
              >
                {s.grp}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.4 }}>{s.name || ''}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="tabular-nums gradient-fill" style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.8px' }}>
            {score}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>/ 100</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text2)' }}>
        <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--text)' }}>{price}</span>
        {change != null && (
          <span className="tabular-nums" style={{ color: changeColor, fontWeight: 600 }}>
            {change > 0 ? '+' : ''}{Number(change).toFixed(2)}%
          </span>
        )}
      </div>

      {/* Mini score bars */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        {[
          { label: 'Reb', v: s.rebound_score, color: 'var(--amber)' },
          { label: 'Mom', v: s.momentum_score, color: 'var(--green)' },
          { label: 'Inv', v: s.investment_score, color: 'var(--brand-light)' },
        ].map((m, i) => (
          <div key={i} style={{ flex: 1 }}>
            <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
              <div
                style={{
                  width: `${Math.min(100, m.v || 0)}%`,
                  height: '100%',
                  background: m.color,
                  borderRadius: 2,
                }}
              />
            </div>
            <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between' }}>
              <span>{m.label}</span>
              <span className="tabular-nums">{m.v ? Math.round(m.v) : '—'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
