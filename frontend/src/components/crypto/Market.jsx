import React, { useMemo } from 'react';
import { useCryptoStore } from '../../store/useCryptoStore';
import { useAppStore } from '../../store/useAppStore';
import { CRYPTO_LIST } from '../../utils/constants';
import EmptyState from '../shared/EmptyState';
import { formatPercent } from '../../utils/formatters';

export default function Market() {
  const { prices, trades, search, setSearch, setChartSym, setNewsSym } = useCryptoStore();
  const setCryptoTab = useAppStore((s) => s.setCryptoTab);

  const filtered = useMemo(() => {
    if (!search) return CRYPTO_LIST;
    const q = search.toLowerCase();
    return CRYPTO_LIST.filter(
      (c) =>
        c.sym.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.base.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div>
      {/* Info banner */}
      <div className="mb-2.5 text-xs" style={{ color: 'var(--text3)' }}>
        Live prices from Binance / Updates every 30 seconds / No account needed
      </div>

      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          placeholder="Search crypto..."
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
            width: 200,
            fontFamily: 'inherit',
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No crypto matches" />
      ) : (
        <div
          style={{
            overflowX: 'auto',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg2)' }}>
            <thead style={{ background: 'var(--bg3)' }}>
              <tr>
                {['Coin', 'Name', 'Price (USDT)', '24h Change', '24h High', '24h Low', 'Volume (USD)', ''].map(
                  (h) => (
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
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const p = prices[c.sym];
                const chg = p?.change24h ?? 0;
                const hasPosition = (trades || []).some(
                  (t) => t.symbol === c.sym && t.status === 'OPEN'
                );

                return (
                  <tr key={c.sym}>
                    <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 500, borderBottom: '1px solid var(--border)' }}>
                      {c.base}
                      {hasPosition && (
                        <div className="text-2xs" style={{ color: 'var(--purple)' }}>
                          ● in position
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>
                      {c.name}
                    </td>
                    <td
                      style={{ padding: '9px 12px', fontSize: 12, fontWeight: 500, borderBottom: '1px solid var(--border)' }}
                      className="tabular-nums"
                    >
                      {p
                        ? `$${p.price.toLocaleString('en-US', { maximumFractionDigits: 4 })}`
                        : '--'}
                    </td>
                    <td
                      style={{
                        padding: '9px 12px',
                        fontSize: 12,
                        color: chg >= 0 ? 'var(--green)' : 'var(--red)',
                        fontWeight: 500,
                        borderBottom: '1px solid var(--border)',
                      }}
                      className="tabular-nums"
                    >
                      {p ? `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` : '--'}
                    </td>
                    <td
                      style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}
                      className="tabular-nums"
                    >
                      {p ? `$${p.high.toFixed(4)}` : '--'}
                    </td>
                    <td
                      style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}
                      className="tabular-nums"
                    >
                      {p ? `$${p.low.toFixed(4)}` : '--'}
                    </td>
                    <td
                      style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}
                      className="tabular-nums"
                    >
                      {p ? `$${Math.round(p.quoteVolume / 1e6)}M` : '--'}
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setChartSym(c.sym);
                            setCryptoTab('chart');
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
                            setNewsSym(c.sym);
                            setCryptoTab('news');
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
