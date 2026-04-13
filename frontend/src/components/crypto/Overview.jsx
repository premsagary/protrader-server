import React from 'react';
import { useCryptoStore } from '../../store/useCryptoStore';
import { useAppStore } from '../../store/useAppStore';
import { CRYPTO_LIST } from '../../utils/constants';
import StatCard from '../shared/StatCard';
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

export default function Overview() {
  const { stats, trades, prices } = useCryptoStore();
  const setCryptoTab = useAppStore((s) => s.setCryptoTab);

  const cs = stats || {};
  const open = (trades || []).filter((t) => t.status === 'OPEN');
  const pnl = +(cs.total_pnl || 0);
  const cw = +(cs.wins || 0);
  const cl = +(cs.losses || 0);
  const wr = cw + cl > 0 ? Math.round((cw / (cw + cl)) * 100) : 0;
  const openPnL = open.reduce((s, t) => {
    const c = prices[t.symbol]?.price ?? t.price;
    return s + (c - t.price) * t.quantity;
  }, 0);
  const closedCount = (trades || []).filter((t) => t.status === 'CLOSED').length;

  const recentTrades = (trades || []).slice(0, 8);

  return (
    <div>
      {/* Crypto header banner */}
      <div
        className="flex items-center gap-2 mb-3.5"
        style={{
          background: 'var(--purple-bg)',
          borderRadius: 'var(--radius-lg)',
          padding: '10px 16px',
          border: '1px solid var(--border)',
        }}
      >
        <span className="font-bold" style={{ fontSize: 18, color: 'var(--purple-text)' }}>
          B
        </span>
        <div>
          <div className="font-medium" style={{ color: 'var(--purple-text)' }}>
            Crypto Paper Trading / 24/7
          </div>
          <div className="text-xs" style={{ color: 'var(--purple-text)', opacity: 0.8 }}>
            Powered by Binance public API / No account needed / Scans every 15 minutes
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div
        className="grid gap-2 mb-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
      >
        <StatCard
          label="Total P&L (closed)"
          value={`${pnl >= 0 ? '+' : ''}${INR(pnl.toFixed(0))}`}
          valueColor={clr(pnl)}
          subtitle={`${closedCount} closed`}
        />
        <StatCard
          label="Open P&L (live)"
          value={`${openPnL >= 0 ? '+' : ''}${INR(openPnL.toFixed(0))}`}
          valueColor={clr(openPnL)}
          subtitle={`${open.length} positions`}
        />
        <StatCard
          label="Win rate"
          value={`${wr}%`}
          valueColor={wr >= 55 ? 'var(--green)' : wr >= 40 ? 'var(--amber)' : 'var(--red)'}
          subtitle={`${cw}W / ${cl}L`}
        />
        <StatCard
          label="Avg win"
          value={`+${INR((+(cs.avg_win || 0)).toFixed(0))}`}
          valueColor="var(--green)"
        />
        <StatCard
          label="Avg loss"
          value={INR((+(cs.avg_loss || 0)).toFixed(0))}
          valueColor="var(--red)"
        />
        <StatCard
          label="Best trade"
          value={`+${INR((+(cs.best_trade || 0)).toFixed(0))}`}
          valueColor="var(--green)"
        />
        <StatCard
          label="Pairs scanning"
          value={String(CRYPTO_LIST.length)}
          valueColor="var(--purple)"
          subtitle="Binance / 24/7 / free"
        />
        <StatCard
          label="Scan interval"
          value="15 min"
          valueColor="var(--purple)"
          subtitle="always running"
        />
      </div>

      {/* Recent crypto trades */}
      <div
        className="text-xs font-semibold uppercase mb-2"
        style={{ color: 'var(--text2)', letterSpacing: '0.5px' }}
      >
        Recent crypto trades
      </div>
      {recentTrades.length === 0 ? (
        <EmptyState message="No crypto trades yet - engine runs 24/7" />
      ) : (
        <div>
          {recentTrades.map((t, i) => {
            const cmp = prices[t.symbol]?.price ?? t.price;
            const lp = (cmp - t.price) * t.quantity;
            return (
              <div
                key={t.id || i}
                className="flex items-center gap-2.5"
                style={{
                  padding: '9px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 7,
                    background:
                      t.status === 'OPEN'
                        ? 'var(--purple-bg)'
                        : +(t.pnl || 0) >= 0
                        ? 'var(--green-bg)'
                        : 'var(--red-bg)',
                    fontSize: 13,
                    color:
                      t.status === 'OPEN'
                        ? 'var(--purple-text)'
                        : +(t.pnl || 0) >= 0
                        ? 'var(--green-text)'
                        : 'var(--red-text)',
                    fontWeight: 600,
                  }}
                >
                  {t.status === 'OPEN' ? 'B' : +(t.pnl || 0) >= 0 ? 'W' : 'L'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    {t.symbol}{' '}
                    <span className="text-xs" style={{ color: 'var(--text2)', fontWeight: 400 }}>
                      x{parseFloat(t.quantity).toFixed(6)}
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text2)' }}>
                    {fmtT(t.entry_time)}
                    {t.exit_reason ? ` \u00B7 ${t.exit_reason}` : ''}
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  {t.status === 'OPEN' ? (
                    <>
                      <div className="font-medium" style={{ color: clr(lp) }}>
                        {lp >= 0 ? '+' : ''}
                        {INR(lp.toFixed(0))}
                      </div>
                      <div className="text-2xs" style={{ color: 'var(--text3)' }}>
                        live
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-medium" style={{ color: clr(t.pnl) }}>
                        {+(t.pnl || 0) >= 0 ? '+' : ''}
                        {INR(t.pnl)}
                      </div>
                      <div className="text-xs" style={{ color: clr(t.pnl_pct) }}>
                        {formatPercent(t.pnl_pct)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {(trades || []).length > 8 && (
            <button
              onClick={() => setCryptoTab('trades')}
              className="text-xs font-medium mt-2.5"
              style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '5px 12px',
                cursor: 'pointer',
                color: 'var(--text2)',
                fontFamily: 'inherit',
              }}
            >
              View all {(trades || []).length} trades
            </button>
          )}
        </div>
      )}
    </div>
  );
}
