import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../api/client';

export default function Holdings() {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ sym: '', qty: '', avgBuy: '' });
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchHoldings = () => {
    setLoading(true);
    apiGet('/api/holdings')
      .then((d) => { setHoldings(d.holdings || d || []); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { fetchHoldings(); }, []);

  const totalInvested = holdings.reduce((s, h) => s + (h.avg_buy || 0) * (h.qty || 0), 0);
  const totalCurrent = holdings.reduce((s, h) => s + (h.cmp || h.avg_buy || 0) * (h.qty || 0), 0);
  const totalPnl = totalCurrent - totalInvested;
  const pnlPct = totalInvested > 0 ? ((totalPnl / totalInvested) * 100) : 0;

  const handleAdd = async () => {
    if (!form.sym.trim() || !form.qty) return;
    setAdding(true); setMsg('');
    try {
      await apiPost('/api/holdings', { symbol: form.sym.trim().toUpperCase(), qty: Number(form.qty), avg_buy: Number(form.avgBuy) || 0 });
      setForm({ sym: '', qty: '', avgBuy: '' });
      setMsg('Added');
      fetchHoldings();
    } catch (e) { setMsg(`Error: ${e.message}`); }
    finally { setAdding(false); }
  };

  const INR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const pnlColor = totalPnl >= 0 ? 'var(--green-text)' : 'var(--red-text)';

  return (
    <div>
      {/* Hero */}
      <div style={{
        background: totalPnl >= 0
          ? 'linear-gradient(135deg, rgba(52,211,153,0.12) 0%, rgba(99,102,241,0.12) 100%)'
          : 'linear-gradient(135deg, rgba(248,113,113,0.12) 0%, rgba(99,102,241,0.12) 100%)',
        border: '1px solid var(--border)', borderRadius: 18, padding: '28px 32px', marginBottom: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -50, right: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(99,102,241,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div className="label-xs" style={{ marginBottom: 8 }}>Your Portfolio · Live CMP + P&L</div>
            <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1, color: 'var(--text)', marginBottom: 12 }}>
              <span className="gradient-fill">Holdings</span>
            </h1>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 14, color: 'var(--text2)' }}>
              <span><b style={{ color: 'var(--text)' }}>{holdings.length}</b> stocks</span>
              <span>Invested <b className="tabular-nums" style={{ color: 'var(--text)' }}>{INR(totalInvested)}</b></span>
              <span>Current <b className="tabular-nums" style={{ color: 'var(--text)' }}>{INR(totalCurrent)}</b></span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="tabular-nums" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1, letterSpacing: '-1.5px', color: pnlColor }}>
              {totalPnl >= 0 ? '+' : ''}{INR(totalPnl)}
            </div>
            <div className="tabular-nums" style={{ fontSize: 15, color: pnlColor, marginTop: 6, fontWeight: 600 }}>
              {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Add holding form */}
      <div className="card card-premium" style={{ padding: '18px 22px', marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 12 }}>
          Add / Update Holding
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="Stock symbol… e.g. RELIANCE"
            value={form.sym} onChange={(e) => setForm({ ...form, sym: e.target.value })}
            style={{ ...inputStyle, flex: 2, minWidth: 200 }}
          />
          <input
            placeholder="Qty" type="number"
            value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })}
            style={{ ...inputStyle, width: 80 }}
          />
          <input
            placeholder="Avg Buy ₹" type="number"
            value={form.avgBuy} onChange={(e) => setForm({ ...form, avgBuy: e.target.value })}
            style={{ ...inputStyle, width: 120 }}
          />
          <button onClick={handleAdd} disabled={adding} className="btn btn-primary" style={{ height: 42 }}>
            {adding ? 'Adding…' : '+ Add'}
          </button>
          {msg && <span style={{ fontSize: 13, color: msg.startsWith('E') ? 'var(--red-text)' : 'var(--green-text)' }}>{msg}</span>}
        </div>
      </div>

      {/* Holdings table */}
      {loading ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>
          <div className="animate-pulse-custom">Loading holdings…</div>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: 24, color: 'var(--red-text)' }}>Failed: {error}</div>
      ) : holdings.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, background: 'var(--brand-bg)', border: '1px solid var(--brand-border)',
            margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="8" width="18" height="13" rx="2" stroke="var(--brand-text)" strokeWidth="2" />
              <path d="M7 8 V6 C7 4.9 7.9 4 9 4 H15 C16.1 4 17 4.9 17 6 V8" stroke="var(--brand-text)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No holdings yet</div>
          <div style={{ fontSize: 14, color: 'var(--text3)' }}>Add a stock from the form above to start tracking your portfolio.</div>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  {['#', 'Stock', 'Qty', 'Avg Buy', 'CMP', 'Invested', 'Current', 'P&L', 'P&L %'].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text3)', borderBottom: '1px solid var(--border)', textAlign: h === '#' || h === 'Stock' ? 'left' : 'right', whiteSpace: 'nowrap', background: 'linear-gradient(145deg, rgba(30,30,44,0.95), rgba(18,18,28,0.95))' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holdings.map((h, i) => {
                  const inv = (h.avg_buy || 0) * (h.qty || 0);
                  const cur = (h.cmp || h.avg_buy || 0) * (h.qty || 0);
                  const pnl = cur - inv;
                  const pct = inv > 0 ? ((pnl / inv) * 100) : 0;
                  const pc = pnl >= 0 ? 'var(--green-text)' : 'var(--red-text)';
                  return (
                    <tr key={h.symbol || i} style={{ transition: 'background 150ms ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ ...cellStyle }}>{i + 1}</td>
                      <td style={{ ...cellStyle, fontWeight: 700 }}>{h.symbol || h.sym || '—'}</td>
                      <td className="tabular-nums" style={{ ...cellStyle, textAlign: 'right' }}>{h.qty}</td>
                      <td className="tabular-nums" style={{ ...cellStyle, textAlign: 'right' }}>{INR(h.avg_buy)}</td>
                      <td className="tabular-nums" style={{ ...cellStyle, textAlign: 'right', fontWeight: 600 }}>{INR(h.cmp || h.avg_buy)}</td>
                      <td className="tabular-nums" style={{ ...cellStyle, textAlign: 'right' }}>{INR(inv)}</td>
                      <td className="tabular-nums" style={{ ...cellStyle, textAlign: 'right' }}>{INR(cur)}</td>
                      <td className="tabular-nums" style={{ ...cellStyle, textAlign: 'right', color: pc, fontWeight: 700 }}>{pnl >= 0 ? '+' : ''}{INR(pnl)}</td>
                      <td className="tabular-nums" style={{ ...cellStyle, textAlign: 'right', color: pc, fontWeight: 600 }}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  height: 42, padding: '0 14px',
  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)',
  borderRadius: 12, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
};

const cellStyle = {
  padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 14,
};
