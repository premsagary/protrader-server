import React from 'react';
import { useStockStore } from '../../store/useStockStore';
import Pill from '../shared/Pill';
import EmptyState from '../shared/EmptyState';
import { formatCurrency, formatPercent } from '../../utils/formatters';

function INR(n) {
  return `Rs${(+n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function clr(n) {
  return +n >= 0 ? 'var(--green)' : 'var(--red)';
}

function fmtT(ts) {
  if (!ts) return '--';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Positions() {
  const { trades, prices } = useStockStore();

  const openTrades = (trades || []).filter((t) => t.status === 'OPEN');
  const closedTrades = (trades || []).filter((t) => t.status === 'CLOSED');

  return (
    <div>
      {/* Open positions as cards */}
      {openTrades.length === 0 ? (
        <EmptyState message="No open positions right now" />
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          {openTrades.map((pos, i) => {
            const cmp = prices[pos.symbol]?.price ?? pos.price;
            const pnl = +((cmp - pos.price) * pos.quantity).toFixed(2);
            const pct = +((cmp - pos.price) / pos.price * 100).toFixed(2);
            const prog = Math.max(0, Math.min(100, ((cmp - pos.stop_loss) / (pos.target - pos.stop_loss)) * 100));

            return (
              <div
                key={pos.id || i}
                style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '14px',
                  borderLeft: `4px solid ${pnl >= 0 ? 'var(--green)' : 'var(--red)'}`,
                }}
              >
                {/* Header */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Pill variant="green">BUY</Pill>
                  <div>
                    <div className="font-medium" style={{ fontSize: 15 }}>
                      {pos.symbol}{' '}
                      <span className="text-xs" style={{ color: 'var(--text2)', fontWeight: 400 }}>
                        x {pos.quantity}
                      </span>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text2)' }}>
                      {pos.name || ''} {pos.strategy ? `\u00B7 ${pos.strategy}` : ''}{' '}
                      {pos.regime ? `\u00B7 ${pos.regime}` : ''} {`\u00B7 ${fmtT(pos.entry_time)}`}
                    </div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="font-semibold tabular-nums" style={{ fontSize: 20, color: clr(pnl) }}>
                      {pnl >= 0 ? '+' : ''}{INR(pnl.toFixed(0))}
                    </div>
                    <div className="text-xs tabular-nums" style={{ color: clr(pct) }}>
                      {formatPercent(pct)}
                    </div>
                  </div>
                </div>

                {/* Mini metric grid */}
                <div
                  className="grid gap-1.5 mb-2"
                  style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
                >
                  {[
                    ['Entry', INR(pos.price)],
                    ['Live CMP', INR(cmp)],
                    ['Stop Loss', INR(pos.stop_loss)],
                    ['Target', INR(pos.target)],
                    ['Capital', INR(pos.capital)],
                    ['Score', pos.signal_score || '--'],
                  ].map(([label, val]) => (
                    <div
                      key={label}
                      style={{
                        background: 'var(--bg3)',
                        borderRadius: 'var(--radius)',
                        padding: '6px 8px',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div
                        className="text-2xs uppercase font-semibold"
                        style={{ color: 'var(--text3)', letterSpacing: '0.3px', marginBottom: 2 }}
                      >
                        {label}
                      </div>
                      <div className="font-semibold text-xs tabular-nums" style={{ color: 'var(--text)' }}>
                        {val}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: 3,
                    background: 'var(--bg4)',
                    borderRadius: 2,
                    overflow: 'hidden',
                    margin: '8px 0 3px',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 2,
                      width: `${prog}%`,
                      background: pnl >= 0 ? 'var(--green)' : 'var(--red)',
                      transition: 'width 0.6s',
                    }}
                  />
                </div>
                <div
                  className="flex justify-between text-2xs"
                  style={{ color: 'var(--text3)' }}
                >
                  <span>SL {INR(pos.stop_loss)}</span>
                  <span>progress to target</span>
                  <span>TGT {INR(pos.target)}</span>
                </div>

                {/* Indicators */}
                {pos.indicators && (
                  <div
                    className="text-2xs mt-1.5"
                    style={{
                      color: 'var(--text3)',
                      background: 'var(--bg)',
                      borderRadius: 5,
                      padding: '5px 9px',
                      overflowWrap: 'break-word',
                    }}
                  >
                    {pos.indicators}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Closed trades table */}
      {closedTrades.length > 0 && (
        <>
          <div
            className="text-xs font-medium mt-4 mb-2"
            style={{ color: 'var(--text2)' }}
          >
            Closed today ({closedTrades.length})
          </div>
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
                  {['Stock', 'Qty', 'Entry', 'Exit', 'P&L', 'Return', 'Reason', 'Result'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '8px 12px',
                        textAlign: 'left',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text3)',
                        borderBottom: '1px solid var(--border)',
                        letterSpacing: '0.4px',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {closedTrades.map((t, i) => (
                  <tr key={t.id || i}>
                    <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 500, borderBottom: '1px solid var(--border)' }}>
                      {t.symbol}
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }} className="tabular-nums">
                      {t.quantity}
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }} className="tabular-nums">
                      {INR(t.price)}
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }} className="tabular-nums">
                      {t.exit_price ? INR(t.exit_price) : '--'}
                    </td>
                    <td
                      style={{
                        padding: '9px 12px',
                        fontSize: 12,
                        fontWeight: 500,
                        color: clr(t.pnl),
                        borderBottom: '1px solid var(--border)',
                      }}
                      className="tabular-nums"
                    >
                      {+(t.pnl || 0) >= 0 ? '+' : ''}
                      {INR(t.pnl)}
                    </td>
                    <td
                      style={{
                        padding: '9px 12px',
                        fontSize: 12,
                        color: clr(t.pnl_pct),
                        borderBottom: '1px solid var(--border)',
                      }}
                      className="tabular-nums"
                    >
                      {formatPercent(t.pnl_pct)}
                    </td>
                    <td
                      style={{
                        padding: '9px 12px',
                        fontSize: 11,
                        color: 'var(--text2)',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {t.exit_reason || '--'}
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
                      {+(t.pnl || 0) >= 0 ? (
                        <Pill variant="green">Win</Pill>
                      ) : (
                        <Pill variant="red">Loss</Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
