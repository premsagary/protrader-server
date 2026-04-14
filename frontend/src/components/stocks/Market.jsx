import React, { useMemo } from 'react';
import { useStockStore } from '../../store/useStockStore';
import { useAppStore } from '../../store/useAppStore';
import FilterPills from '../shared/FilterPills';
import EmptyState from '../shared/EmptyState';
import { NSE_STOCKS } from '../../utils/constants';

function INR(n) {
  return `₹${(+n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

const FILTERS = ['All', 'Nifty 50', 'Next 50', 'Midcap'];

export default function Market() {
  const { prices, filter, search, setFilter, setSearch, setChartSym, setNewsNseSym } = useStockStore();
  const setStocksTab = useAppStore((s) => s.setStocksTab);

  const rows = useMemo(() => {
    const searchUpper = (search || '').toUpperCase();
    const seen = new Set();
    return NSE_STOCKS
      .map((s) => {
        const live = prices[s.sym];
        const price = live?.price ?? 0;
        const chg = live && live.open > 0 ? ((price - live.open) / live.open) * 100 : 0;
        return {
          ...s,
          price,
          chg,
          high: live?.high ?? 0,
          low: live?.low ?? 0,
          vol: live?.volume ?? 0,
          isLive: !!live,
        };
      })
      .filter((s) => {
        if (filter !== 'All' && s.grp !== filter) return false;
        if (searchUpper && !s.sym.includes(searchUpper) && !s.name.toUpperCase().includes(searchUpper))
          return false;
        if (seen.has(s.sym)) return false;
        seen.add(s.sym);
        return true;
      });
  }, [prices, filter, search]);

  const liveCount = rows.filter((s) => s.isLive).length;

  return (
    <div>
      {/* Search + filter row */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <input
          type="text"
          placeholder="Search symbol or name..."
          value={search || ''}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--border2)',
            borderRadius: 'var(--radius)',
            padding: '6px 10px',
            fontSize: 12,
            color: 'var(--text)',
            outline: 'none',
            minWidth: 200,
            fontFamily: 'inherit',
          }}
        />
        <FilterPills options={FILTERS} active={filter} onChange={setFilter} />
        <span className="ml-auto text-xs" style={{ color: 'var(--text3)' }}>
          {liveCount} live / {rows.length} stocks
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No stocks match your filter" />
      ) : (
        <div
          style={{
            overflowX: 'auto',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            maxHeight: '600px',
            overflowY: 'auto',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg2)' }}>
            <thead style={{ background: 'var(--bg3)' }}>
              <tr>
                {['Symbol', 'Company', 'Group', 'Price', 'Chg%', 'High', 'Low', 'Volume', ''].map((h) => (
                  <th
                    key={h || 'actions'}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text3)',
                      borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.4px',
                      textTransform: 'uppercase',
                      position: 'sticky',
                      top: 0,
                      zIndex: 10,
                      background: 'var(--bg3)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.sym}>
                  <td style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
                    <div className="font-medium">{s.sym}</div>
                    {s.isLive && (
                      <div className="text-2xs" style={{ color: 'var(--green)' }}>
                        ● live
                      </div>
                    )}
                  </td>
                  <td
                    style={{
                      padding: '9px 12px',
                      fontSize: 12,
                      color: 'var(--text2)',
                      maxWidth: 140,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {s.name}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
                    <span
                      style={{
                        background: 'var(--bg3)',
                        borderRadius: 4,
                        padding: '1px 6px',
                        fontSize: 10,
                        color: 'var(--text2)',
                      }}
                    >
                      {s.grp}
                    </span>
                  </td>
                  <td
                    style={{ padding: '9px 12px', fontSize: 12, fontWeight: 500, borderBottom: '1px solid var(--border)' }}
                    className="tabular-nums"
                  >
                    {s.price > 0 ? INR(s.price) : '--'}
                  </td>
                  <td
                    style={{
                      padding: '9px 12px',
                      fontSize: 12,
                      color: s.chg >= 0 ? 'var(--green)' : 'var(--red)',
                      fontWeight: 500,
                      borderBottom: '1px solid var(--border)',
                    }}
                    className="tabular-nums"
                  >
                    {s.isLive ? `${s.chg >= 0 ? '+' : ''}${s.chg.toFixed(2)}%` : '--'}
                  </td>
                  <td
                    style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}
                    className="tabular-nums"
                  >
                    {s.high > 0 ? INR(s.high) : '--'}
                  </td>
                  <td
                    style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}
                    className="tabular-nums"
                  >
                    {s.low > 0 ? INR(s.low) : '--'}
                  </td>
                  <td
                    style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}
                    className="tabular-nums"
                  >
                    {s.vol > 0 ? s.vol.toLocaleString('en-IN') : '--'}
                  </td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setChartSym(s.sym);
                          setStocksTab('chart');
                        }}
                        style={{
                          background: 'var(--bg3)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          padding: '3px 8px',
                          fontSize: 11,
                          cursor: 'pointer',
                          color: 'var(--text2)',
                          fontFamily: 'inherit',
                        }}
                      >
                        Chart
                      </button>
                      <button
                        onClick={() => {
                          setNewsNseSym(s.sym);
                          setStocksTab('news');
                        }}
                        style={{
                          background: 'var(--bg3)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          padding: '3px 8px',
                          fontSize: 11,
                          cursor: 'pointer',
                          color: 'var(--text2)',
                          fontFamily: 'inherit',
                        }}
                      >
                        News
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
