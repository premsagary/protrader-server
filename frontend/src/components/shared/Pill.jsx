import React from 'react';

const PILL_VARIANTS = {
  green: {
    bg: 'var(--green-bg)',
    text: 'var(--green-text)',
    border: 'var(--tier-strong-buy-border)',
  },
  red: {
    bg: 'var(--red-bg)',
    text: 'var(--red-text)',
    border: 'var(--tier-avoid-border)',
  },
  amber: {
    bg: 'var(--amber-bg)',
    text: 'var(--amber-text)',
    border: 'var(--tier-accumulate-border)',
  },
  blue: {
    bg: 'var(--blue-bg)',
    text: 'var(--blue-text)',
    border: 'var(--tier-buy-border)',
  },
  purple: {
    bg: 'var(--purple-bg)',
    text: 'var(--purple-text)',
    border: 'var(--tier-watch-border)',
  },
  gray: {
    bg: 'var(--bg3)',
    text: 'var(--text2)',
    border: 'var(--border)',
  },
};

/**
 * Generic colored badge pill.
 *
 * Props:
 *   children  - content to display
 *   variant   - one of: green, red, amber, blue, purple, gray (default)
 *   className - optional extra class names
 *   style     - optional additional inline styles
 */
export default function Pill({
  children,
  variant = 'gray',
  className = '',
  style: extraStyle,
}) {
  const v = PILL_VARIANTS[variant] || PILL_VARIANTS.gray;

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '4px',
        padding: '2px 8px',
        fontSize: '11px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        letterSpacing: '0.1px',
        background: v.bg,
        color: v.text,
        border: `1px solid ${v.border}`,
        ...extraStyle,
      }}
    >
      {children}
    </span>
  );
}
