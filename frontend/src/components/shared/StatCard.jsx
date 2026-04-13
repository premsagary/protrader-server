import React from 'react';

/**
 * Key metric stat card.
 *
 * Props:
 *   label      - uppercase label text (e.g. "Total P&L")
 *   value      - formatted display value (string or number)
 *   subtitle   - optional secondary text below value
 *   valueColor - optional CSS color for value (defaults to --text)
 *   trend      - optional 'up' | 'down' for trend arrow
 *   className  - optional extra class names
 *   onClick    - optional click handler
 */
export default function StatCard({
  label,
  value,
  subtitle,
  valueColor,
  trend,
  className = '',
  onClick,
}) {
  return (
    <div
      className={`transition-colors ${className}`}
      onClick={onClick}
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 14px',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div
        className="text-2xs font-medium uppercase"
        style={{
          color: 'var(--text2)',
          marginBottom: '5px',
          letterSpacing: '0.6px',
        }}
      >
        {label}
      </div>
      <div
        className="font-bold tabular-nums"
        style={{
          fontSize: '18px',
          color: valueColor || 'var(--text)',
          letterSpacing: '-0.5px',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <span>{value}</span>
        {trend === 'up' && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 2L10 7H2L6 2Z" fill="var(--green)" />
          </svg>
        )}
        {trend === 'down' && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 10L2 5H10L6 10Z" fill="var(--red)" />
          </svg>
        )}
      </div>
      {subtitle && (
        <div
          className="text-2xs"
          style={{
            color: 'var(--text3)',
            marginTop: '4px',
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
