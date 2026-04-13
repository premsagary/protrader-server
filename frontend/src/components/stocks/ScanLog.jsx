import React, { useState } from 'react';
import { useStockStore } from '../../store/useStockStore';
import Pill from '../shared/Pill';
import EmptyState from '../shared/EmptyState';

function fmtT(ts) {
  if (!ts) return '--';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function regimeVariant(regime) {
  if (regime === 'TRENDING') return 'green';
  if (regime === 'BREAKOUT') return 'amber';
  if (regime === 'MOMENTUM') return 'blue';
  return 'gray';
}

export default function ScanLog() {
  const { scanLog, cleanupTrades, resetTrades } = useStockStore();
  const [actionLoading, setActionLoading] = useState(null);

  const handleCleanup = async () => {
    if (!window.confirm('Remove all trades with >100% return (bad instrument tokens)?')) return;
    setActionLoading('cleanup');
    try {
      await cleanupTrades();
    } catch {
      // handled in store
    }
    setActionLoading(null);
  };

  const handleReset = async () => {
    if (!window.confirm('Delete ALL paper trades and start fresh? This cannot be undone.')) return;
    setActionLoading('reset');
    try {
      await resetTrades();
    } catch {
      // handled in store
    }
    setActionLoading(null);
  };

  const logs = scanLog || [];

  return (
    <div>
      {/* Header with actions */}
      <div className="flex gap-2 mb-3.5 flex-wrap items-center">
        <p className="flex-1 text-sm" style={{ color: 'var(--text2)' }}>
          Each row = one scan. Bot scans every 3 min during 9:15-15:30 IST.
        </p>
        <button
          onClick={handleCleanup}
          disabled={actionLoading === 'cleanup'}
          style={{
            background: 'transparent',
            border: '1px solid var(--amber)',
            borderRadius: 'var(--radius)',
            padding: '4px 10px',
            fontSize: 11,
            cursor: 'pointer',
            color: 'var(--amber)',
            fontFamily: 'inherit',
            opacity: actionLoading === 'cleanup' ? 0.5 : 1,
          }}
        >
          Remove bad trades (&gt;100% return)
        </button>
        <button
          onClick={handleReset}
          disabled={actionLoading === 'reset'}
          style={{
            background: 'transparent',
            border: '1px solid var(--red)',
            borderRadius: 'var(--radius)',
            padding: '4px 10px',
            fontSize: 11,
            cursor: 'pointer',
            color: 'var(--red)',
            fontFamily: 'inherit',
            opacity: actionLoading === 'reset' ? 0.5 : 1,
          }}
        >
          Reset all trades
        </button>
      </div>

      {/* Scan log table */}
      {logs.length === 0 ? (
        <EmptyState message="No scans yet" />
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
                {['Time', 'Stocks', 'Signals', 'Regime', 'Strategy', 'Message'].map((h) => (
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
              {logs.map((s, i) => (
                <tr key={s.id || i}>
                  <td
                    style={{
                      padding: '9px 12px',
                      fontSize: 11,
                      color: 'var(--text2)',
                      whiteSpace: 'nowrap',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {fmtT(s.scanned_at)}
                  </td>
                  <td
                    style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }}
                    className="tabular-nums"
                  >
                    {s.stocks}
                  </td>
                  <td
                    style={{
                      padding: '9px 12px',
                      fontSize: 12,
                      fontWeight: s.signals > 0 ? 600 : 400,
                      color: s.signals > 0 ? 'var(--green)' : 'var(--text2)',
                      borderBottom: '1px solid var(--border)',
                    }}
                    className="tabular-nums"
                  >
                    {s.signals}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
                    {s.regime ? (
                      <Pill variant={regimeVariant(s.regime)}>{s.regime}</Pill>
                    ) : (
                      '--'
                    )}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                    {s.strategy || '--'}
                  </td>
                  <td
                    style={{
                      padding: '9px 12px',
                      fontSize: 11,
                      color: 'var(--text2)',
                      maxWidth: 260,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {s.message || ''}
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
