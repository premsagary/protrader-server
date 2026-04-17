import React, { useEffect, useState } from 'react';
import { apiGet } from '../../api/client';

export default function CryptoRoboTrade() {
  const [stats, setStats] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiGet('/crypto/trades/stats').catch(() => null),
      apiGet('/crypto/trades').catch(() => []),
    ]).then(([s, t]) => {
      setStats(s); setTrades(t?.trades || t || []); setLoading(false);
    });
  }, []);

  const cs = stats || {};
  const pnl = +(cs.total_pnl || 0);
  const cw = +(cs.wins || 0), cl = +(cs.losses || 0);
  const wr = cw + cl > 0 ? Math.round((cw / (cw + cl)) * 100) : 0;
  const INR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const pnlColor = pnl >= 0 ? '#fff' : '#fff';

  return (
    <div>
      {/* Hero — violet gradient for crypto */}
      <div style={{
        background: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)',
        borderRadius: 18, padding: '28px 32px', marginBottom: 24,
        color: '#fff', boxShadow: 'var(--shadow-brand)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', opacity: 0.85, marginBottom: 8 }}>Crypto Paper Trading · 24/7 · Binance</div>
            <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1, marginBottom: 12 }}>
              Crypto RoboTrade
            </h1>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 14, opacity: 0.9 }}>
              <span>Win rate <b>{wr}%</b></span>
              <span><b>{cw}W</b> / <b>{cl}L</b></span>
              <span>20 pairs · scanning every 15 min</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="tabular-nums" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1, letterSpacing: '-1.5px', color: pnlColor }}>
              {pnl >= 0 ? '+' : ''}{INR(pnl)}
            </div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>Total P&L</div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { l: 'Avg Win', v: `+${INR(cs.avg_win || 0)}`, c: 'var(--green-text)' },
          { l: 'Avg Loss', v: INR(cs.avg_loss || 0), c: 'var(--red-text)' },
          { l: 'Best Trade', v: `+${INR(cs.best_trade || 0)}`, c: 'var(--green-text)' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>{s.l}</div>
            <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, color: s.c, letterSpacing: '-0.5px' }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Recent trades */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Recent Crypto Trades</h2>
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>{trades.length} total</span>
        </div>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }} className="animate-pulse-custom">Loading…</div>
        ) : trades.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>No crypto trades yet — scanner runs 24/7.</div>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {trades.slice(0, 20).map((t, i) => {
              const tPnl = t.pnl || 0;
              const tc = tPnl >= 0 ? 'var(--green-text)' : 'var(--red-text)';
              return (
                <div key={i} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 150ms ease' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t.symbol} <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 12 }}>x{t.quantity}</span></div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t.created_at ? new Date(t.created_at).toLocaleString() : ''}</div>
                  </div>
                  <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 700, color: tc }}>{tPnl >= 0 ? '+' : ''}{INR(tPnl)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
