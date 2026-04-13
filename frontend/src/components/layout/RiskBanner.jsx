import React, { useState, useCallback } from 'react';
import { useStockStore } from '../../store/useStockStore';

export default function RiskBanner() {
  const stats = useStockStore((s) => s.stats);
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  if (dismissed || !stats) return null;

  const drawdown = stats.maxDrawdown || stats.drawdown || 0;
  // Only show if drawdown exceeds -5%
  if (drawdown > -5) return null;

  const isDanger = drawdown <= -10;

  return (
    <div
      className="flex items-center gap-2 flex-shrink-0 text-sm font-semibold"
      style={{
        background: isDanger ? 'var(--red-bg)' : 'var(--amber-bg)',
        color: isDanger ? 'var(--red-text)' : 'var(--amber-text)',
        borderBottom: `1px solid ${isDanger ? 'var(--red)' : 'var(--amber)'}`,
        padding: '6px 16px',
      }}
    >
      <span style={{ flex: 1 }}>
        {isDanger ? 'HIGH RISK' : 'WARNING'}: Portfolio drawdown at{' '}
        <span className="tabular-nums">{drawdown.toFixed(1)}%</span>
        {isDanger
          ? ' -- Consider reducing exposure immediately'
          : ' -- Monitor positions closely'}
      </span>
      <button
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: isDanger ? 'var(--red-text)' : 'var(--amber-text)',
          fontWeight: 600,
          fontSize: '14px',
          lineHeight: 1,
          padding: '2px 6px',
          borderRadius: 'var(--radius)',
          fontFamily: 'inherit',
          opacity: 0.7,
          transition: 'opacity 0.15s',
        }}
        title="Dismiss"
      >
        x
      </button>
    </div>
  );
}
