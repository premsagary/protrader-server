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
          width: '24px',
          height: '24px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: isDanger ? 'var(--red-text)' : 'var(--amber-text)',
          padding: 0,
          borderRadius: 'var(--radius)',
          fontFamily: 'inherit',
          opacity: 0.6,
          transition: 'opacity 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        title="Dismiss"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
