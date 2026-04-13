import React from 'react';

const HORIZON_STYLES = {
  intraday: {
    color: 'var(--purple)',
    borderColor: 'var(--purple-bg)',
  },
  swing: {
    color: 'var(--blue)',
    borderColor: 'var(--blue-bg)',
  },
  positional: {
    color: 'var(--green)',
    borderColor: 'var(--green-bg)',
  },
};

const HORIZON_LABELS = {
  intraday: 'Intraday',
  swing: 'Swing',
  positional: 'Positional',
};

/**
 * Investment horizon badge.
 *
 * Props:
 *   horizon   - one of "Intraday", "Swing", "Positional" (case-insensitive)
 *   className - optional extra class names
 */
export default function HorizonPill({ horizon, className = '' }) {
  const h = (horizon || 'swing').toLowerCase();
  const style = HORIZON_STYLES[h] || HORIZON_STYLES.swing;
  const label = HORIZON_LABELS[h] || horizon || 'Swing';

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '3px',
        padding: '1px 6px',
        fontSize: '10px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        background: 'var(--bg4)',
        color: style.color,
        border: `1px solid ${style.borderColor}`,
      }}
    >
      {label}
    </span>
  );
}
