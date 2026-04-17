import React, { useEffect, useState } from 'react';
import { apiGet } from '../../api/client';

const CAT_CONFIG = {
  smallcap: { label: 'Small Cap', color: '#8B5CF6', bg: 'var(--purple-bg)' },
  midcap: { label: 'Mid Cap', color: '#6366F1', bg: 'var(--brand-bg)' },
  largecap: { label: 'Large Cap', color: '#60A5FA', bg: 'rgba(96,165,250,0.14)' },
  flexicap: { label: 'Flexi Cap', color: '#34D399', bg: 'var(--green-bg)' },
};

export default function MFPicks() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet('/api/mf/funds')
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const funds = data?.funds || [];
  const total = data?.total || funds.length;
  const eligible = funds.filter((f) => f.eligible !== false && !(f.dni && f.dni.level === 'red'));
  const dniFunds = funds.filter((f) => f.dni);

  const grouped = {};
  eligible.forEach((f) => {
    const cat = f.cat || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(f);
  });
  Object.keys(grouped).forEach((k) => grouped[k].sort((a, b) => (b.score || 0) - (a.score || 0)));

  const topPick = eligible[0];

  const INR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  return (
    <div>
      {/* Hero */}
      <div style={{
        background: 'var(--gradient)', borderRadius: 18, padding: '32px 36px', marginBottom: 28,
        color: '#fff', boxShadow: 'var(--shadow-brand)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -70, right: -50, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', opacity: 0.85, marginBottom: 10 }}>
              Mutual Fund Intelligence · 100-Point Scoring
            </div>
            <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-1.2px', lineHeight: 1.05, marginBottom: 10 }}>
              {topPick ? topPick.name : 'Mutual Fund Picks'}
            </h1>
            <p style={{ fontSize: 16, opacity: 0.9, lineHeight: 1.5, maxWidth: 600 }}>
              {topPick
                ? `Top-ranked across ${eligible.length} eligible funds. Tickertape data · SEBI-flagged filtering.`
                : `${total} funds scored with 100-point framework across 4 categories.`}
            </p>
          </div>
          {topPick && (
            <div style={{ textAlign: 'right' }}>
              <div className="tabular-nums" style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, letterSpacing: '-2px' }}>
                {Math.round(topPick.score || 0)}
              </div>
              <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>/ 100 score</div>
            </div>
          )}
        </div>
        <div style={{ position: 'relative', marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, opacity: 0.85 }}>
          <span><b>{total}</b> funds scored</span>
          <span><b>{eligible.length}</b> eligible</span>
          <span><b>{dniFunds.length}</b> flagged</span>
        </div>
      </div>

      {loading && (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>
          <div className="animate-pulse-custom" style={{ fontSize: 15 }}>Loading fund data…</div>
        </div>
      )}

      {error && (
        <div className="card" style={{ padding: 24, color: 'var(--red-text)', marginBottom: 20 }}>
          Failed to load: {error}
        </div>
      )}

      {/* DNI Warning */}
      {dniFunds.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', marginBottom: 28, border: '1px solid rgba(248,113,113,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', background: 'var(--red-bg)', borderBottom: '1px solid rgba(248,113,113,0.2)' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--red)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>!</div>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--red-text)' }}>Do Not Invest</span>
            <span className="chip" style={{ background: 'var(--red-bg)', color: 'var(--red-text)', borderColor: 'rgba(248,113,113,0.3)' }}>{dniFunds.length} flagged</span>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {dniFunds.slice(0, 8).map((f, i) => (
              <div key={i} style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 14 }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{f.name}</span>
                <span style={{ color: 'var(--red-text)', fontSize: 13, flex: 1, textAlign: 'right' }}>{f.dni?.reason || 'Flagged'}</span>
                <span className="tabular-nums" style={{ fontWeight: 800, color: 'var(--red-text)', fontSize: 16, minWidth: 40, textAlign: 'right' }}>{Math.round(f.score || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category sections */}
      {!loading && !error && Object.entries(grouped).map(([cat, catFunds]) => {
        const cfg = CAT_CONFIG[cat] || { label: cat, color: 'var(--brand-text)', bg: 'var(--brand-bg)' };
        const top5 = catFunds.slice(0, 5);
        return (
          <div key={cat} style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 4, height: 22, background: cfg.color, borderRadius: 2 }} />
              <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.4px', color: 'var(--text)' }}>{cfg.label} Funds</h2>
              <span style={{ fontSize: 13, color: 'var(--text2)', marginLeft: 'auto' }}>
                <b style={{ color: cfg.color }}>{catFunds.length}</b> rated
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {top5.map((f, i) => (
                <FundCard key={f.name} fund={f} rank={i + 1} cfg={cfg} featured={i === 0} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FundCard({ fund, rank, cfg, featured }) {
  const f = fund;
  const score = Math.round(f.score || 0);
  const rankLabel = rank === 1 ? 'Top pick' : rank === 2 ? 'Runner up' : `#${rank}`;

  return (
    <div className={`card ${featured ? 'card-premium' : ''}`} style={{ padding: 20 }}>
      {/* Rank + SEBI status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
          borderRadius: 9999, fontSize: 12, fontWeight: 700,
          background: featured ? 'var(--gradient)' : 'var(--brand-bg)',
          color: featured ? '#fff' : 'var(--brand-text)',
        }}>
          #{rank} · {rankLabel}
        </span>
        {f.amc_sebi !== 'probe' && f.amc_sebi !== 'action' && (
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--green-text)', background: 'var(--green-bg)', padding: '3px 8px', borderRadius: 6 }}>
            SEBI Clean
          </span>
        )}
      </div>

      {/* Name + Score */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.25, marginBottom: 4 }}>{f.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {f.amc || ''}{f.aum_cr ? ` · ₹${Math.round(f.aum_cr)} Cr` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="tabular-nums gradient-fill" style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.8px' }}>{score}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>/ 100</div>
        </div>
      </div>

      {/* Returns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
        {[['1Y', f.ret_1y], ['3Y', f.cagr_3y], ['5Y', f.cagr_5y], ['10Y', f.cagr_10y]].map(([label, val]) => {
          const n = parseFloat(val);
          const ok = val != null && !isNaN(n);
          return (
            <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '7px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2, fontWeight: 600 }}>{label}</div>
              <div className="tabular-nums" style={{ fontSize: 13, fontWeight: 700, color: ok ? (n >= 0 ? 'var(--green-text)' : 'var(--red-text)') : 'var(--text4)' }}>
                {ok ? `${n >= 0 ? '+' : ''}${n.toFixed(1)}%` : '—'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {[
          ['Sharpe', f.sharpe, (v) => v > 0 ? 'var(--green-text)' : 'var(--red-text)'],
          ['Expense', f.expense_ratio, (v) => v < 0.5 ? 'var(--green-text)' : v > 1 ? 'var(--red-text)' : 'var(--text)'],
          ['Max DD', f.maxDD || f.max_drawdown, () => 'var(--red-text)'],
        ].map(([label, val, colorFn]) => {
          const n = parseFloat(val);
          const ok = !isNaN(n);
          return (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: 11 }}>
              <span style={{ color: 'var(--text3)', fontWeight: 500 }}>{label}</span>
              <span className="tabular-nums" style={{ fontWeight: 700, color: ok ? colorFn(n) : 'var(--text4)' }}>
                {ok ? (label === 'Expense' ? `${n.toFixed(2)}%` : n.toFixed(2)) : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
