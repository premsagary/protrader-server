import React, { useEffect, useState, useMemo } from 'react';
import { apiGet } from '../../api/client';

const FILTERS = ['ALL', 'NIFTY50', 'NEXT50', 'MIDCAP', 'SMALLCAP'];
const COLS = [
  { k: 'sym', l: 'Stock', w: 120, sticky: true },
  { k: 'grp', l: 'Grp', w: 90 },
  { k: 'investment_score', l: 'Inv Score', w: 90, num: true, color: 'var(--brand-text)' },
  { k: 'momentum_score', l: 'Mom Score', w: 90, num: true, color: 'var(--green-text)' },
  { k: 'rebound_score', l: 'Reb Score', w: 90, num: true, color: 'var(--amber-text)' },
  { k: 'price', l: 'Price', w: 90, num: true, fmt: (v) => v ? `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 1 })}` : '—' },
  { k: 'roe', l: 'ROE%', w: 70, num: true },
  { k: 'debtToEq', l: 'D/E', w: 70, num: true },
  { k: 'pe', l: 'P/E', w: 70, num: true },
  { k: 'rsi', l: 'RSI', w: 60, num: true },
  { k: 'beta', l: 'Beta', w: 70, num: true },
  { k: 'revGrowth', l: 'RevGr%', w: 80, num: true },
  { k: 'earGrowth', l: 'EpsGr%', w: 80, num: true },
];

export default function StockData() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [sortKey, setSortKey] = useState('investment_score');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiGet('/api/stocks/score')
      .then((d) => { setStocks(d.stocks || d || []); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    let list = stocks;
    if (filter !== 'ALL') list = list.filter((s) => (s.grp || '').toUpperCase().includes(filter));
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      list = list.filter((s) => (s.sym || '').toUpperCase().includes(q) || (s.name || '').toUpperCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null) return 1; if (bv == null) return -1;
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [stocks, filter, search, sortKey, sortDir]);

  const handleSort = (k) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('desc'); }
  };

  return (
    <div>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(167,139,250,0.10) 100%)',
        border: '1px solid var(--border)', borderRadius: 18, padding: '28px 32px', marginBottom: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -50, right: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(99,102,241,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="label-xs" style={{ marginBottom: 8 }}>Full Universe · Sortable · Searchable</div>
            <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1, color: 'var(--text)' }}>
              <span className="gradient-fill">Stock Data</span>
            </h1>
          </div>
          {stocks.length > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div className="tabular-nums gradient-fill" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1, letterSpacing: '-1.5px' }}>{stocks.length}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, fontWeight: 500 }}>NSE stocks</div>
            </div>
          )}
        </div>
      </div>

      {/* Search + filters */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search stock symbol, name or sector…"
          style={{
            height: 42, padding: '0 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)',
            borderRadius: 12, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', flex: 1, minWidth: 240,
          }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '7px 14px', borderRadius: 9999, fontSize: 13, fontWeight: 600,
              background: filter === f ? 'var(--brand)' : 'rgba(255,255,255,0.04)',
              color: filter === f ? '#fff' : 'var(--text2)', border: `1px solid ${filter === f ? 'var(--brand)' : 'var(--border)'}`,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 180ms ease',
            }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>
        Showing <b style={{ color: 'var(--text)' }}>{filtered.length}</b> of {stocks.length} stocks · sorted by <b style={{ color: 'var(--brand-text)' }}>{sortKey.toUpperCase()}</b> ({sortDir})
      </div>

      {/* Table */}
      {loading ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>
          <div className="animate-pulse-custom" style={{ fontSize: 15 }}>Loading stock data…</div>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: 24, color: 'var(--red-text)' }}>Failed to load: {error}</div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', maxHeight: 600 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 40 }}>#</th>
                  {COLS.map((c) => (
                    <th
                      key={c.k}
                      onClick={() => handleSort(c.k)}
                      style={{
                        ...thStyle,
                        width: c.w,
                        textAlign: c.num ? 'right' : 'left',
                        color: sortKey === c.k ? 'var(--brand-text)' : 'var(--text3)',
                        cursor: 'pointer',
                      }}
                    >
                      {c.l}
                      {sortKey === c.k && <span style={{ marginLeft: 4, fontSize: 10 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((s, i) => (
                  <tr
                    key={s.sym}
                    style={{ transition: 'background 150ms ease' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...tdStyle, color: 'var(--text3)', textAlign: 'center' }}>{i + 1}</td>
                    {COLS.map((c) => {
                      const raw = s[c.k];
                      const val = c.fmt ? c.fmt(raw) : raw != null ? (typeof raw === 'number' ? raw.toFixed(c.k === 'beta' ? 2 : 1) : raw) : '—';
                      return (
                        <td key={c.k} className={c.num ? 'tabular-nums' : ''} style={{
                          ...tdStyle,
                          textAlign: c.num ? 'right' : 'left',
                          fontWeight: c.k === 'sym' ? 700 : 500,
                          color: c.color && raw != null ? c.color : c.k === 'sym' ? 'var(--text)' : 'var(--text2)',
                        }}>
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 100 && (
            <div style={{ padding: 14, textAlign: 'center', fontSize: 13, color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
              Showing 100 of {filtered.length} — refine your search to see more
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: '10px 14px',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: 'var(--text3)',
  borderBottom: '1px solid var(--border)',
  position: 'sticky',
  top: 0,
  background: 'linear-gradient(145deg, rgba(30,30,44,0.95), rgba(18,18,28,0.95))',
  zIndex: 5,
  whiteSpace: 'nowrap',
  userSelect: 'none',
};

const tdStyle = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--border)',
  fontSize: 13,
  whiteSpace: 'nowrap',
};
