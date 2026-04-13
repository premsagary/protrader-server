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

export default function Positions() {
  const { trades, prices } = useCryptoStore();
  const openTrades = (trades || []).filter((t) => t.status === 'OPEN');

  if (openTrades.length === 0) {
    return <EmptyState message="No open crypto positions right now" />;
  }

  return (
    <div>
      <div
        className="text-xs font-semibold uppercase mb-3"
        style={{ color: 'var(--text2)', letterSpacing: '0.5px' }}
      >
        Open Crypto Positions ({openTrades.length})
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {openTrades.map((pos, i) => {
          const cmp = prices[pos.symbol]?.price ?? pos.price;
          const pnl = +((cmp - pos.price) * pos.quantity).toFixed(2);
          const pct = +((cmp - pos.price) / pos.price * 100).toFixed(2);
          const prog = Math.max(
            0,
            Math.min(100, ((cmp - pos.stop_loss) / (pos.target - pos.stop_loss)) * 100)
          );

          return (
            <div
              key={pos.id || i}
              style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: 14,
                borderLeft: `4px solid ${pnl >= 0 ? 'var(--green)' : 'var(--red)'}`,
              }}
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Pill variant="purple">BUY</Pill>
                <div>
                  <div className="font-medium" style={{ fontSize: 15 }}>
                    {pos.symbol}{' '}
                    <span className="text-xs" style={{ color: 'var(--text2)', fontWeight: 400 }}>
                      x {parseFloat(pos.quantity).toFixed(6)}
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text2)' }}>
                    {pos.name || ''} {fmtT(pos.entry_time) !== '--' ? `\u00B7 ${fmtT(pos.entry_time)}` : ''}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div
                    className="font-semibold tabular-nums"
                    style={{ fontSize: 20, color: clr(pnl) }}
                  >
                    {pnl >= 0 ? '+' : ''}
                    {INR(pnl.toFixed(0))}
                  </div>
                  <div className="text-xs tabular-nums" style={{ color: clr(pct) }}>
                    {formatPercent(pct)}
                  </div>
                </div>
              </div>

              {/* Mini metric grid */}
              <div className="grid gap-1.5 mb-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {[
                  ['Entry', `$${parseFloat(pos.price).toFixed(4)}`],
                  ['Live', `$${cmp.toFixed(4)}`],
                  ['Stop Loss', `$${parseFloat(pos.stop_loss).toFixed(4)}`],
                  ['Target', `$${parseFloat(pos.target).toFixed(4)}`],
                  ['Capital', INR(pos.capital)],
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
              <div className="flex justify-between text-2xs" style={{ color: 'var(--text3)' }}>
                <span>SL</span>
                <span>progress to target</span>
                <span>TGT</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
