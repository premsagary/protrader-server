import React from 'react';
import { useStockStore } from '../../store/useStockStore';
import StatCard from '../shared/StatCard';
import EmptyState from '../shared/EmptyState';
import { formatCurrency, formatPercent } from '../../utils/formatters';

function INR(n) {
  return `₹${(+n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function clr(n) {
  return +n >= 0 ? 'var(--green)' : 'var(--red)';
}

export default function Portfolio() {
  const { holdings, margin } = useStockStore();

  const h = holdings || [];
  const cash = margin?.equity?.net?.available?.live_balance;
  const holdVal = h.reduce((s, hh) => s + (hh.last_price || hh.average_price || 0) * hh.quantity, 0);
  const invested = h.reduce((s, hh) => s + hh.average_price * hh.quantity, 0);
  const pnl = holdVal - invested;

  return (
    <div>
      {/* Summary stat cards */}
      <div
        className="grid gap-2 mb-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
      >
        <StatCard
          label="Available cash"
          value={cash != null ? INR(cash.toFixed(0)) : '--'}
          valueColor="var(--text)"
          subtitle="Kite margin"
        />
        <StatCard
          label="Holdings value"
          value={INR(holdVal.toFixed(0))}
          valueColor="var(--text)"
          subtitle={`${h.length} stocks`}
        />
        <StatCard
          label="Total invested"
          value={INR(invested.toFixed(0))}
        />
        <StatCard
          label="Total P&L"
          value={`${pnl >= 0 ? '+' : ''}${INR(pnl.toFixed(0))}`}
          valueColor={clr(pnl)}
        />
      </div>

      {/* Holdings table */}
      {h.length === 0 ? (
        <EmptyState message="No holdings -- connect Kite to view" />
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
                {['Symbol', 'Qty', 'Avg price', 'LTP', 'Invested', 'Current', 'P&L', 'Return'].map(
                  (label) => (
                    <th
                      key={label}
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
                      {label}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {h.map((hh, i) => {
                const inv = hh.average_price * hh.quantity;
                const cur = (hh.last_price || hh.average_price) * hh.quantity;
                const p = cur - inv;
                const r = inv > 0 ? (p / inv) * 100 : 0;
                return (
                  <tr key={hh.tradingsymbol || i}>
                    <td
                      style={{
                        padding: '9px 12px',
                        fontSize: 12,
                        fontWeight: 500,
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {hh.tradingsymbol}
                    </td>
                    <td
                      style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }}
                      className="tabular-nums"
                    >
                      {hh.quantity}
                    </td>
                    <td
                      style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }}
                      className="tabular-nums"
                    >
                      {INR(hh.average_price)}
                    </td>
                    <td
                      style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }}
                      className="tabular-nums"
                    >
                      {INR(hh.last_price || hh.average_price)}
                    </td>
                    <td
                      style={{
                        padding: '9px 12px',
                        fontSize: 12,
                        color: 'var(--text2)',
                        borderBottom: '1px solid var(--border)',
                      }}
                      className="tabular-nums"
                    >
                      {INR(inv.toFixed(0))}
                    </td>
                    <td
                      style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }}
                      className="tabular-nums"
                    >
                      {INR(cur.toFixed(0))}
                    </td>
                    <td
                      style={{
                        padding: '9px 12px',
                        fontSize: 12,
                        fontWeight: 500,
                        color: clr(p),
                        borderBottom: '1px solid var(--border)',
                      }}
                      className="tabular-nums"
                    >
                      {p >= 0 ? '+' : ''}
                      {INR(p.toFixed(0))}
                    </td>
                    <td
                      style={{
                        padding: '9px 12px',
                        fontSize: 12,
                        color: clr(r),
                        borderBottom: '1px solid var(--border)',
                      }}
                      className="tabular-nums"
                    >
                      {formatPercent(r)}
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
