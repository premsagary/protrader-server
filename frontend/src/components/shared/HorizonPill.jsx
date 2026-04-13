import React from 'react';

const HORIZON_STYLES = {
  intraday: {
    bg: 'var(--purple-bg)',
    color: 'var(--purple-text)',
  },
  swing: {
    bg: 'var(--blue-bg)',
    color: 'var(--blue-text)',
  },
  positional: {
    bg: 'var(--green-bg)',
    color: 'var(--green-text)',
  },
};

const HORIZON_LABELS = {
  intraday: 'Intraday',
  swing: 'Swing',
  positional: 'Positional',
};

/**
 * Investment horizon badge — Apple-style, soft background.
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
        borderRadius: '6px',
        padding: '2px 8px',
        fontSize: '11px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        background: style.bg,
        color: style.color,
      }}
    >
      {label}
    </span>
  );
}
