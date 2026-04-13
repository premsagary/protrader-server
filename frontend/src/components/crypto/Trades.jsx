import React from 'react';
import { useCryptoStore } from '../../store/useCryptoStore';
import Pill from '../shared/Pill';
import EmptyState from '../shared/EmptyState';
import { formatPercent } from '../../utils/formatters';

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

export default function Trades() {
  const { trades, stats } = useCryptoStore();

  const cs = stats || {};
  const pnl = +(cs.total_pnl || 0);
  const cw = +(cs.wins || 0);
  const cl = +(cs.losses || 0);
  const wr = cw + cl > 0 ? Math.round((cw / (cw + cl)) * 100) : 0;
  const closed = (trades || []).filter((t) => t.status === 'CLOSED');

  return (
    <div>
      {/* Crypto trade history table */}
      {(trades || []).length === 0 ? (
        <EmptyState message="No crypto trades yet" />
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
                {[
                  'Coin', 'Qty', 'Entry $', 'Exit $', 'Entry time', 'Exit time',
                  'P&L', 'Return', 'Exit reason', 'Result',
                ].map((h) => (
                  <th
                    key={h}
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
              {(trades || []).map((t, i) => (
                <tr key={t.id || i}>
                  <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 500, borderBottom: '1px solid var(--border)' }}>
                    {t.symbol}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 11, borderBottom: '1px solid var(--border)' }} className="tabular-nums">
                    {parseFloat(t.quantity).toFixed(6)}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }} className="tabular-nums">
                    ${parseFloat(t.price).toFixed(4)}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }} className="tabular-nums">
                    {t.exit_price ? `$${parseFloat(t.exit_price).toFixed(4)}` : '--'}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>
                    {fmtT(t.entry_time)}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>
                    {fmtT(t.exit_time)}
                  </td>
                  <td
                    style={{
                      padding: '9px 12px',
                      fontSize: 12,
                      fontWeight: 500,
                      color: t.status === 'OPEN' ? 'var(--text2)' : clr(t.pnl),
                      borderBottom: '1px solid var(--border)',
                    }}
                    className="tabular-nums"
                  >
                    {t.status === 'OPEN' ? '--' : `${+(t.pnl || 0) >= 0 ? '+' : ''}${INR(t.pnl)}`}
                  </td>
                  <td
                    style={{
                      padding: '9px 12px',
                      fontSize: 12,
                      color: t.status === 'OPEN' ? 'var(--text2)' : clr(t.pnl_pct),
                      borderBottom: '1px solid var(--border)',
                    }}
                    className="tabular-nums"
                  >
                    {t.status === 'OPEN' ? '--' : formatPercent(t.pnl_pct)}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>
                    {t.exit_reason || '--'}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
                    {t.status === 'OPEN' ? (
                      <Pill variant="purple">Open</Pill>
                    ) : +(t.pnl || 0) >= 0 ? (
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
      )}

      {/* Summary footer */}
      {closed.length > 0 && (
        <div
          className="flex gap-4 flex-wrap tabular-nums"
          style={{
            padding: '8px 0',
            fontSize: 12,
            color: 'var(--text2)',
            borderTop: '1px solid var(--border)',
            marginTop: 4,
          }}
        >
          <span>
            Closed: <b>{closed.length}</b>
          </span>
          <span>
            P&L:{' '}
            <b style={{ color: clr(pnl) }}>
              {pnl >= 0 ? '+' : ''}
              {INR(pnl.toFixed(0))}
            </b>
          </span>
          <span>
            Win rate: <b>{wr}%</b>
          </span>
        </div>
      )}
    </div>
  );
}
