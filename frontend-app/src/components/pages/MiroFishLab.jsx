import React, { useEffect, useState } from 'react';
import { apiGet } from '../../api/client';

export default function MiroFishLab() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Server returns scoreV2 (not investment_score). Requires ?scoreVersion=2.
    apiGet('/api/stocks/score?scoreVersion=2')
      .then((d) => {
        const all = (d.stocks || d || [])
          .filter((s) => (s.scoreV2 || 0) >= 60 && !s.disqualified)
          .sort((a, b) => (b.scoreV2 || 0) - (a.scoreV2 || 0))
          .slice(0, 25);
        setStocks(all);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(167,139,250,0.14) 0%, rgba(99,102,241,0.12) 100%)',
        border: '1px solid var(--border)', borderRadius: 18, padding: '28px 32px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div className="label-xs">Experiment · OASIS Multi-Agent Simulator</div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'var(--purple-bg)', color: 'var(--purple-text)', letterSpacing: '0.5px' }}>LAB</span>
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', color: 'var(--text)' }}>
          <span className="gradient-fill">MiroFish Lab</span>
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text2)', marginTop: 10, maxWidth: 700, lineHeight: 1.5 }}>
          Top 25 long-term investment picks (scoreV2 ≥ 60). Run each through MiroFish — an OASIS-based simulator that spawns 56 investor personas and reports sentiment.
        </p>
      </div>

      {/* Stock list */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            25 long-term picks · sorted by Investment Score
          </h2>
        </div>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }} className="animate-pulse-custom">Loading scored universe…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  {['#', 'Stock', 'Investment Score', 'Price', 'MiroFish'].map((h) => (
                    <th key={h} style={{
                      padding: '12px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
                      color: 'var(--text3)', borderBottom: '1px solid var(--border)', textAlign: h === '#' || h === 'Stock' ? 'left' : 'center',
                      background: 'linear-gradient(145deg, rgba(30,30,44,0.95), rgba(18,18,28,0.95))',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stocks.map((s, i) => (
                  <tr key={s.sym}
                    style={{ transition: 'background 150ms ease' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', color: 'var(--text3)' }}>{i + 1}</td>
                    <td style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)' }}>{s.sym}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{s.name} · {s.grp}</div>
                    </td>
                    <td className="tabular-nums" style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', textAlign: 'center', fontWeight: 700, color: 'var(--brand-text)', fontSize: 16 }}>
                      {Math.round(s.scoreV2 || 0)}
                    </td>
                    <td className="tabular-nums" style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', textAlign: 'center', color: 'var(--text2)' }}>
                      {s.price ? `₹${Number(s.price).toLocaleString('en-IN', { maximumFractionDigits: 1 })}` : '—'}
                    </td>
                    <td style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                      <button className="btn btn-secondary" style={{ height: 32, fontSize: 12, padding: '0 14px' }}>
                        Run Sim
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
