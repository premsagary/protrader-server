import React, { useState, useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useStockStore } from '../../store/useStockStore';
import Pill from '../shared/Pill';
import EmptyState from '../shared/EmptyState';
import FilterPills from '../shared/FilterPills';
import { formatCurrency, formatPercent } from '../../utils/formatters';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

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

const RESULT_FILTERS = ['All', 'Wins', 'Losses'];

export default function Trades() {
  const { trades, stats } = useStockStore();
  const [resultFilter, setResultFilter] = useState('All');

  const ns = stats || {};
  const pnl = +(ns.total_pnl || 0);
  const nw = +(ns.wins || 0);
  const nl = +(ns.losses || 0);
  const wr = nw + nl > 0 ? Math.round((nw / (nw + nl)) * 100) : 0;
  const closed = (trades || []).filter((t) => t.status === 'CLOSED');

  const filteredTrades = useMemo(() => {
    const all = trades || [];
    if (resultFilter === 'Wins') return all.filter((t) => t.status === 'CLOSED' && +(t.pnl || 0) >= 0);
    if (resultFilter === 'Losses') return all.filter((t) => t.status === 'CLOSED' && +(t.pnl || 0) < 0);
    return all;
  }, [trades, resultFilter]);

  // P&L bar chart data
  const chartTrades = closed.slice(0, 30).reverse();
  const barData = {
    labels: chartTrades.map((t) => t.symbol),
    datasets: [
      {
        data: chartTrades.map((t) => +(t.pnl || 0)),
        backgroundColor: chartTrades.map((t) =>
          +(t.pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)'
        ),
        borderRadius: 3,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `Rs${ctx.parsed.y}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { font: { size: 9 }, color: 'var(--chart-text)', maxRotation: 45 },
        grid: { display: false },
      },
      y: {
        ticks: {
          callback: (v) => `Rs${v}`,
          font: { size: 10 },
          color: 'var(--chart-text)',
        },
        grid: { color: 'var(--chart-grid)' },
      },
    },
  };

  return (
    <div>
      {/* P&L bar chart */}
      {closed.length > 0 && (
        <div
          style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '12px',
            height: 160,
            marginBottom: 14,
          }}
        >
          <Bar data={barData} options={barOptions} />
        </div>
      )}

      {/* Filter + summary */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <FilterPills options={RESULT_FILTERS} active={resultFilter} onChange={setResultFilter} />
      </div>

      {/* Trade history table */}
      {filteredTrades.length === 0 ? (
        <EmptyState message="No trades yet - bot trades 9:15-15:30 IST" />
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
                  'Stock', 'Qty', 'Entry', 'Exit', 'Entry time', 'Exit time',
                  'P&L', 'Return', 'Strategy', 'Regime', 'Exit reason', 'Result',
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
              {filteredTrades.map((t, i) => (
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
                  <td style={{ padding: '9px 12px', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                    {t.strategy || '--'}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                    {t.regime || '--'}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>
                    {t.exit_reason || '--'}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
                    {t.status === 'OPEN' ? (
                      <Pill variant="amber">Open</Pill>
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
            Net P&L:{' '}
            <b style={{ color: clr(pnl) }}>
              {pnl >= 0 ? '+' : ''}
              {INR(pnl.toFixed(0))}
            </b>
          </span>
          <span>
            Win rate: <b>{wr}%</b>
          </span>
          <span>
            Best:{' '}
            <b style={{ color: 'var(--green)' }}>
              +{INR((+(ns.best_trade || 0)).toFixed(0))}
            </b>
          </span>
          <span>
            Worst:{' '}
            <b style={{ color: 'var(--red)' }}>
              {INR((+(ns.worst_trade || 0)).toFixed(0))}
            </b>
          </span>
        </div>
      )}
    </div>
  );
}
