import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../api/client';

export default function MiroFishLab() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState({});   // { sym: {status: 'running'|'done'|'error', data, err} }
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    // Server returns scoreV2 (not investment_score). Requires ?scoreVersion=2.
    // Also apply Long-Term gate: roe ≥ 8 AND debtToEq ≤ 3 AND not disqualified.
    apiGet('/api/stocks/score?scoreVersion=2')
      .then((d) => {
        const all = (d.stocks || d || [])
          .filter((s) => {
            if (s.disqualified) return false;
            if ((s.scoreV2 || 0) < 60) return false;
            if (s.roe != null && s.roe < 8) return false;
            if (s.debtToEq != null && s.debtToEq > 3) return false;
            return true;
          })
          .sort((a, b) => (b.scoreV2 || 0) - (a.scoreV2 || 0))
          .slice(0, 25);
        setStocks(all);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Run MiroFish simulation for one stock ───────────────────────────
  const runSim = async (sym) => {
    setResults((r) => ({ ...r, [sym]: { status: 'running' } }));
    try {
      const res = await apiPost('/api/mirofish/predict', { symbol: sym });
      setResults((r) => ({ ...r, [sym]: { status: 'done', data: res } }));
      setExpanded(sym);
    } catch (e) {
      setResults((r) => ({ ...r, [sym]: { status: 'error', err: e.message } }));
    }
  };

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
          Top 25 long-term investment picks (scoreV2 ≥ 60, ROE ≥ 8%, D/E ≤ 3). Run each through MiroFish — an OASIS-based simulator that spawns 56 investor personas and reports sentiment on buy/hold/avoid.
        </p>
        <div style={{
          marginTop: 14, padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)', borderRadius: 10, fontSize: 11, color: 'var(--text3)',
          lineHeight: 1.5,
        }}>
          ⚙ Configure via env: <code style={{ color: 'var(--brand-text)' }}>MIROFISH_BASE_URL</code>,
          {' '}<code style={{ color: 'var(--brand-text)' }}>MIROFISH_API_PATH</code>,
          {' '}<code style={{ color: 'var(--brand-text)' }}>MIROFISH_API_KEY</code>. Without these set,
          the server returns a fallback heuristic output.
        </div>
      </div>

      {/* Stock list */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            {loading ? 'Loading…' : `${stocks.length} long-term picks`}
          </h2>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            sorted by Investment Score desc
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }} className="animate-pulse-custom">
            Loading scored universe…
          </div>
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
                {stocks.map((s, i) => {
                  const r = results[s.sym];
                  const isOpen = expanded === s.sym;
                  return (
                    <React.Fragment key={s.sym}>
                      <tr style={{ transition: 'background 150ms ease' }}
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
                          <button
                            onClick={() => {
                              if (r?.status === 'done') setExpanded(isOpen ? null : s.sym);
                              else runSim(s.sym);
                            }}
                            disabled={r?.status === 'running'}
                            className={r?.status === 'done' ? 'btn btn-secondary' : 'btn btn-primary'}
                            style={{
                              height: 32, fontSize: 12, padding: '0 14px',
                              opacity: r?.status === 'running' ? 0.6 : 1,
                            }}
                          >
                            {r?.status === 'running' ? '⏳ Running…'
                             : r?.status === 'error' ? '↻ Retry'
                             : r?.status === 'done' ? (isOpen ? '▲ Hide' : '▼ View')
                             : '▶ Run Sim'}
                          </button>
                        </td>
                      </tr>
                      {isOpen && r?.status === 'done' && (
                        <tr>
                          <td colSpan={5} style={{ padding: 0, background: 'rgba(167,139,250,0.04)', borderBottom: '1px solid var(--border)' }}>
                            <MiroFishResultPanel data={r.data} />
                          </td>
                        </tr>
                      )}
                      {r?.status === 'error' && (
                        <tr>
                          <td colSpan={5} style={{ padding: '10px 18px', background: 'rgba(248,113,113,0.05)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--red-text)' }}>
                            ❌ {r.err}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MiroFish result panel — renders the 56-persona sentiment breakdown ──
function MiroFishResultPanel({ data }) {
  if (!data) return null;
  const sentiment = data.sentiment || data.result || {};
  const buy = sentiment.buy ?? sentiment.BUY ?? 0;
  const hold = sentiment.hold ?? sentiment.HOLD ?? 0;
  const sell = sentiment.sell ?? sentiment.SELL ?? sentiment.avoid ?? 0;
  const total = buy + hold + sell || 1;
  const personas = data.personas || [];

  return (
    <div style={{ padding: '18px 24px' }}>
      {/* Sentiment bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ width: `${buy / total * 100}%`, background: 'var(--green)' }} />
          <div style={{ width: `${hold / total * 100}%`, background: 'var(--amber)' }} />
          <div style={{ width: `${sell / total * 100}%`, background: 'var(--red)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)' }}>
          <span><span style={{ color: 'var(--green-text)', fontWeight: 700 }}>{buy}</span> Buy</span>
          <span><span style={{ color: 'var(--amber-text)', fontWeight: 700 }}>{hold}</span> Hold</span>
          <span><span style={{ color: 'var(--red-text)', fontWeight: 700 }}>{sell}</span> Sell/Avoid</span>
        </div>
      </div>
      {data.summary && (
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55, marginBottom: 12 }}>
          {data.summary}
        </div>
      )}
      {personas.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
          {personas.length} personas simulated
          {data.elapsedMs && <> · {(data.elapsedMs / 1000).toFixed(1)}s</>}
          {data.source && <> · via {data.source}</>}
        </div>
      )}
    </div>
  );
}
