import React from 'react';

/**
 * Empty content placeholder.
 *
 * Props:
 *   message    - display message (default "No data available")
 *   action     - optional action button config { label, onClick }
 *   className  - optional extra class names
 */
export default function EmptyState({
  message = 'No data available',
  action,
  className = '',
}) {
  return (
    <div
      className={`text-center ${className}`}
      style={{
        padding: '48px 0',
        color: 'var(--text3)',
        fontSize: '13px',
      }}
    >
      {/* Dash icon */}
      <div
        style={{
          fontSize: '32px',
          marginBottom: '8px',
          color: 'var(--border2)',
          lineHeight: 1,
        }}
      >
        --
      </div>
      <div>{message}</div>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: '12px',
            padding: '6px 16px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'opacity 0.15s',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
