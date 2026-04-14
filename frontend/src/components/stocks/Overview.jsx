import React, { useEffect, useRef } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useStockStore } from '../../store/useStockStore';
import { useAppStore } from '../../store/useAppStore';
import StatCard from '../shared/StatCard';
import Pill from '../shared/Pill';
import EmptyState from '../shared/EmptyState';
import { formatCurrency, formatPercent, formatNumber } from '../../utils/formatters';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

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

function INR(n) {
  return `₹${(+n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export default function Overview() {
  const { stats, trades, daily, prices, holdings, margin } = useStockStore();
  const setStocksTab = useAppStore((s) => s.setStocksTab);

  const ns = stats || {};
  const open = (trades || []).filter((t) => t.status === 'OPEN');
  const pnl = +(ns.total_pnl || 0);
  const nw = +(ns.wins || 0);
  const nl = +(ns.losses || 0);
  const wr = nw + nl > 0 ? Math.round((nw / (nw + nl)) * 100) : 0;
  const openPnL = open.reduce((s, t) => {
    const c = prices[t.symbol]?.price ?? t.price;
    return s + (c - t.price) * t.quantity;
  }, 0);

  // Build equity curve data
  const reversed = (daily || []).slice().reverse();
  let cum = 0;
  const eLabels = [];
  const eData = [];
  reversed.forEach((d) => {
    cum += +(+d.pnl);
    eLabels.push(d.date?.slice(5, 10));
    eData.push(+cum.toFixed(0));
  });

  const holdingsValue = (holdings || []).reduce(
    (s, h) => s + (h.last_price || h.average_price || 0) * h.quantity,
    0
  );

  const closedCount = (trades || []).filter((t) => t.status === 'CLOSED').length;

  const equityChartData = {
    labels: eLabels,
    datasets: [
      {
        label: 'Cumulative P&L',
        data: eData,
        borderColor: pnl >= 0 ? 'var(--green)' : 'var(--red)',
        backgroundColor: pnl >= 0 ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 1.5,
      },
    ],
  };

  const equityChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `₹${ctx.parsed.y}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { font: { size: 10 }, color: 'var(--chart-text)' },
        grid: { color: 'var(--chart-grid)' },
      },
      y: {
        ticks: {
          callback: (v) => `₹${v}`,
          font: { size: 10 },
          color: 'var(--chart-text)',
        },
        grid: { color: 'var(--chart-grid)' },
      },
    },
  };

  const recentTrades = (trades || []).slice(0, 8);

  const totalPnlSign = pnl >= 0 ? '+' : '';
  const weekChange = eData.length >= 2 ? eData[eData.length - 1] - eData[Math.max(0, eData.length - 7)] : 0;

  return (
    <div>
      {/* HERO — big P&L headline */}
      <div style={{
        background: pnl >= 0 ? 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(99,102,241,0.08) 100%)' : 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(99,102,241,0.08) 100%)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '24px 28px',
        marginBottom: 24,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div className="label-xs" style={{ marginBottom: 8 }}>Stocks RoboTrade · Total P&L</div>
            <div style={{
              fontSize: 56, fontWeight: 800, lineHeight: 1, letterSpacing: '-2px',
              color: pnl >= 0 ? 'var(--green-text)' : 'var(--red-text)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {totalPnlSign}{INR(Math.abs(pnl).toFixed(0))}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 500 }}>
                <b style={{ color: 'var(--text)' }}>{closedCount}</b> closed · <b style={{ color: 'var(--text)' }}>{open.length}</b> open
              </span>
              <span style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 500 }}>
                Win rate <b style={{ color: wr >= 55 ? 'var(--green-text)' : wr >= 40 ? 'var(--amber-text)' : 'var(--red-text)' }}>{wr}%</b>
              </span>
              <span style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 500 }}>
                Week {weekChange >= 0 ? '+' : ''}{INR(weekChange.toFixed(0))}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="label-xs" style={{ marginBottom: 8 }}>Holdings Value</div>
            <div style={{
              fontSize: 28, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.6px',
              color: 'var(--text)',
              fontVariantNumeric: 'tabular-nums',
            }}>{INR(holdingsValue.toFixed(0))}</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>{(holdings || []).length} stocks</div>
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div
        className="grid gap-3 mb-6"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
      >
        <StatCard
          label="Open P&L (live)"
          value={`${openPnL >= 0 ? '+' : ''}${INR(openPnL.toFixed(0))}`}
          valueColor={clr(openPnL)}
          subtitle={`${open.length} positions`}
        />
        <StatCard
          label="Avg win"
          value={`+${INR((+(ns.avg_win || 0)).toFixed(0))}`}
          valueColor="var(--green)"
        />
        <StatCard
          label="Avg loss"
          value={INR((+(ns.avg_loss || 0)).toFixed(0))}
          valueColor="var(--red)"
        />
        <StatCard
          label="Best trade"
          value={`+${INR((+(ns.best_trade || 0)).toFixed(0))}`}
          valueColor="var(--green)"
        />
        <StatCard
          label="Sharpe ratio"
          value={ns.sharpe_ratio != null ? Number(ns.sharpe_ratio).toFixed(2) : '--'}
          valueColor={
            ns.sharpe_ratio > 1
              ? 'var(--green)'
              : ns.sharpe_ratio > 0
              ? 'var(--amber)'
              : 'var(--red)'
          }
          subtitle="Risk-adj return"
        />
        <StatCard
          label="Sortino ratio"
          value={ns.sortino_ratio != null ? Number(ns.sortino_ratio).toFixed(2) : '--'}
          valueColor={
            ns.sortino_ratio > 1.5
              ? 'var(--green)'
              : ns.sortino_ratio > 0
              ? 'var(--amber)'
              : 'var(--red)'
          }
          subtitle="Downside risk"
        />
        <StatCard
          label="Max drawdown"
          value={ns.max_drawdown != null ? Number(ns.max_drawdown).toFixed(1) + '%' : '--'}
          valueColor={
            ns.max_drawdown < 5
              ? 'var(--green)'
              : ns.max_drawdown < 15
              ? 'var(--amber)'
              : 'var(--red)'
          }
        />
        <StatCard
          label="Profit factor"
          value={ns.profit_factor != null ? Number(ns.profit_factor).toFixed(2) : '--'}
          valueColor={
            ns.profit_factor > 1.5
              ? 'var(--green)'
              : ns.profit_factor > 1
              ? 'var(--amber)'
              : 'var(--red)'
          }
          subtitle="W/L ratio"
        />
        <StatCard
          label="Kelly %"
          value={ns.kelly_pct != null ? ns.kelly_pct + '%' : '--'}
          valueColor="var(--blue)"
          subtitle="Optimal bet size"
        />
        <StatCard
          label="Available cash"
          value={
            margin?.equity?.net?.available?.live_balance != null
              ? INR(margin.equity.net.available.live_balance.toFixed(0))
              : '--'
          }
          valueColor="var(--text)"
          subtitle="Kite margin"
        />
      </div>

      {/* Equity curve */}
      <div
        className="text-xs font-semibold uppercase mb-2"
        style={{ color: 'var(--text2)', letterSpacing: '0.5px' }}
      >
        Cumulative P&L
      </div>
      <div
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px',
          height: '220px',
          marginBottom: '16px',
        }}
      >
        {eLabels.length > 0 ? (
          <Line data={equityChartData} options={equityChartOptions} />
        ) : (
          <div
            className="flex items-center justify-center h-full text-sm"
            style={{ color: 'var(--text3)' }}
          >
            No daily P&L data yet
          </div>
        )}
      </div>

      {/* Recent trades */}
      <div
        className="text-xs font-semibold uppercase mb-2"
        style={{ color: 'var(--text2)', letterSpacing: '0.5px' }}
      >
        Recent trades
      </div>
      {recentTrades.length === 0 ? (
        <EmptyState message="No trades yet - bot scans every 3 min during 9:15-15:30 IST" />
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
                        ? 'var(--amber-bg)'
                        : +(t.pnl || 0) >= 0
                        ? 'var(--green-bg)'
                        : 'var(--red-bg)',
                    fontSize: 13,
                    color:
                      t.status === 'OPEN'
                        ? 'var(--amber-text)'
                        : +(t.pnl || 0) >= 0
                        ? 'var(--green-text)'
                        : 'var(--red-text)',
                  }}
                >
                  {t.status === 'OPEN' ? 'O' : +(t.pnl || 0) >= 0 ? 'W' : 'L'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    {t.symbol}{' '}
                    <span
                      className="text-xs"
                      style={{ color: 'var(--text2)', fontWeight: 400 }}
                    >
                      x{t.quantity} {t.strategy ? `\u00B7 ${t.strategy}` : ''}
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
                      <div
                        className="text-xs"
                        style={{ color: clr(t.pnl_pct) }}
                      >
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
              onClick={() => setStocksTab('trades')}
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
