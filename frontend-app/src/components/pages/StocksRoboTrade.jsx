import React, { useEffect, useState } from 'react';
import { apiGet } from '../../api/client';

export default function StocksRoboTrade() {
  const [stats, setStats] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiGet('/api/paper-trades/stats').catch(() => null),
      apiGet('/api/paper-trades').catch(() => []),
    ]).then(([s, t]) => {
      setStats(s); setTrades(t?.trades || t || []); setLoading(false);
    });
  }, []);

  const ns = stats || {};
  const pnl = +(ns.total_pnl || 0);
  const nw = +(ns.wins || 0), nl = +(ns.losses || 0);
  const wr = nw + nl > 0 ? Math.round((nw / (nw + nl)) * 100) : 0;
  const INR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const pnlColor = pnl >= 0 ? 'var(--green-text)' : 'var(--red-text)';

  return (
    <div>
      {/* Hero */}
      <div style={{
        background: pnl >= 0
          ? 'linear-gradient(135deg, rgba(52,211,153,0.12) 0%, rgba(99,102,241,0.12) 100%)'
          : 'linear-gradient(135deg, rgba(248,113,113,0.12) 0%, rgba(99,102,241,0.12) 100%)',
        border: '1px solid var(--border)', borderRadius: 18, padding: '28px 32px', marginBottom: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -50, right: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(99,102,241,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div className="label-xs" style={{ marginBottom: 8 }}>Paper Trading · NSE Stocks</div>
            <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1, color: 'var(--text)' }}>
              <span className="gradient-fill">Stocks RoboTrade</span>
            </h1>
            <div style={{ marginTop: 12, display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 14, color: 'var(--text2)' }}>
              <span>Win rate <b style={{ color: wr >= 55 ? 'var(--green-text)' : 'var(--amber-text)' }}>{wr}%</b></span>
              <span><b>{nw}W</b> / <b>{nl}L</b></span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="tabular-nums" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1, letterSpacing: '-1.5px', color: pnlColor }}>
              {pnl >= 0 ? '+' : ''}{INR(pnl)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6, fontWeight: 500 }}>Total P&L</div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { l: 'Avg Win', v: `+${INR(ns.avg_win || 0)}`, c: 'var(--green-text)' },
          { l: 'Avg Loss', v: INR(ns.avg_loss || 0), c: 'var(--red-text)' },
          { l: 'Best Trade', v: `+${INR(ns.best_trade || 0)}`, c: 'var(--green-text)' },
          { l: 'Sharpe', v: ns.sharpe_ratio != null ? Number(ns.sharpe_ratio).toFixed(2) : '—', c: 'var(--brand-text)' },
          { l: 'Max Drawdown', v: ns.max_drawdown != null ? `${Number(ns.max_drawdown).toFixed(1)}%` : '—', c: 'var(--red-text)' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>{s.l}</div>
            <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, color: s.c, letterSpacing: '-0.5px' }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Recent trades */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Recent Trades</h2>
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>{trades.length} total</span>
        </div>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }} className="animate-pulse-custom">Loading trades…</div>
        ) : trades.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>No trades yet — bot scans every 5 min during 9:15–15:30 IST</div>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {trades.slice(0, 20).map((t, i) => {
              const tPnl = t.pnl || 0;
              const tc = tPnl >= 0 ? 'var(--green-text)' : 'var(--red-text)';
              return (
                <div key={i} style={{
                  padding: '12px 20px', borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  transition: 'background 150ms ease',
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t.symbol} <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 12 }}>x{t.quantity}</span></div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t.strategy} · {t.created_at ? new Date(t.created_at).toLocaleString() : ''}</div>
                  </div>
                  <div className="tabular-nums" style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: tc }}>{tPnl >= 0 ? '+' : ''}{INR(tPnl)}</div>
                    {t.status && <div style={{ fontSize: 11, color: t.status === 'OPEN' ? 'var(--brand-text)' : 'var(--text3)' }}>{t.status}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
