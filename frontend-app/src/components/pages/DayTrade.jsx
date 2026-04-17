import React, { useEffect, useState } from 'react';
import { apiGet } from '../../api/client';

const SETUPS = [
  { type: 'vwap_reclaim', label: 'VWAP Reclaim', color: 'var(--brand-text)', desc: 'Price reclaiming VWAP from below with volume — institutional buy zone.' },
  { type: 'gap_and_go', label: 'Gap & Go', color: 'var(--amber-text)', desc: 'Gap open 1–6% with follow-through above opening range + volume surge.' },
  { type: 'breakout', label: 'Breakout', color: 'var(--green-text)', desc: 'Price at day high / above opening range with volume surge — ADX trending.' },
  { type: 'oversold_bounce', label: 'Oversold Bounce', color: 'var(--purple-text)', desc: '5-min RSI < 35 + below lower Bollinger Band — mean reversion play.' },
];

export default function DayTrade() {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/api/stocks/picks/daytrade')
      .then((d) => { setPicks(d.picks || d || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(248,113,113,0.14) 0%, rgba(99,102,241,0.12) 100%)',
        border: '1px solid var(--border)', borderRadius: 18, padding: '28px 32px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div className="label-xs">Intraday Scanner · Varsity Module 2</div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'var(--red-bg)', color: 'var(--red-text)', letterSpacing: '0.5px' }}>ADMIN ONLY</span>
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', color: 'var(--text)' }}>
          <span className="gradient-fill">DayTrade Scanner</span>
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text2)', marginTop: 10 }}>
          5-min candles · VWAP + Gap + Breakout + Oversold Bounce · scored in real-time during market hours.
        </p>
      </div>

      {/* Setup types */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 28 }}>
        {SETUPS.map((s) => {
          const setupPicks = picks.filter((p) => (p.setup_type || '').toLowerCase().replace(/\s+/g, '_') === s.type);
          return (
            <div key={s.type} className="card" style={{ padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.label}</h3>
                <span className="chip" style={{ height: 24, fontSize: 11, padding: '0 8px', fontWeight: 700, color: s.color, background: 'rgba(255,255,255,0.04)' }}>
                  {setupPicks.length}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.5, marginBottom: 14 }}>{s.desc}</p>
              {setupPicks.length > 0 ? (
                <div style={{ display: 'grid', gap: 6 }}>
                  {setupPicks.slice(0, 5).map((p, i) => (
                    <div key={i} style={{
                      padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{p.symbol}</span>
                      <span className="tabular-nums" style={{ color: s.color, fontWeight: 700, fontSize: 13 }}>
                        {p.score ? `${Math.round(p.score)}/100` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text4)', fontSize: 13 }}>
                  No setups found right now.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
