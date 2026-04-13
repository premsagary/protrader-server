import React from 'react';

/**
 * Key metric stat card — Apple-style with shadow depth.
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
      className={`animate-fadeIn ${className}`}
      onClick={onClick}
      style={{
        background: 'var(--bg2)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 18px',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: 'var(--shadow)',
        transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        border: '1px solid var(--border)',
      }}
      onMouseEnter={(e) => {
        if (onClick) e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={(e) => {
        if (onClick) e.currentTarget.style.boxShadow = 'var(--shadow)';
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text3)',
          marginBottom: '8px',
          letterSpacing: '0.3px',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        className="tabular-nums"
        style={{
          fontSize: '22px',
          fontWeight: 700,
          color: valueColor || 'var(--text)',
          letterSpacing: '-0.5px',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span>{value}</span>
        {trend === 'up' && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2L12 8H2L7 2Z" fill="var(--green)" />
          </svg>
        )}
        {trend === 'down' && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 12L2 6H12L7 12Z" fill="var(--red)" />
          </svg>
        )}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: '12px',
            color: 'var(--text3)',
            marginTop: '6px',
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
