import React from 'react';

/**
 * Empty content placeholder — Apple-style with subtle icon.
 */
export default function EmptyState({
  message = 'No data available',
  action,
  className = '',
}) {
  return (
    <div
      className={`text-center animate-fadeIn ${className}`}
      style={{
        padding: '64px 0',
        color: 'var(--text3)',
        fontSize: '14px',
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: 'var(--bg3)',
          margin: '0 auto 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="7" stroke="var(--text4)" strokeWidth="1.5" />
          <line x1="5.5" y1="9" x2="12.5" y2="9" stroke="var(--text4)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ fontWeight: 500 }}>{message}</div>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: '16px',
            padding: '8px 20px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.2s',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
