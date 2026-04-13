import React from 'react';

const PILL_VARIANTS = {
  green: {
    bg: 'var(--green-bg)',
    text: 'var(--green-text)',
  },
  red: {
    bg: 'var(--red-bg)',
    text: 'var(--red-text)',
  },
  amber: {
    bg: 'var(--amber-bg)',
    text: 'var(--amber-text)',
  },
  blue: {
    bg: 'var(--blue-bg)',
    text: 'var(--blue-text)',
  },
  purple: {
    bg: 'var(--purple-bg)',
    text: 'var(--purple-text)',
  },
  gray: {
    bg: 'var(--bg3)',
    text: 'var(--text2)',
  },
};

/**
 * Generic colored badge pill — Apple-style, borderless, soft backgrounds.
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
        borderRadius: 'var(--radius)',
        padding: '3px 10px',
        fontSize: '12px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        letterSpacing: '-0.1px',
        background: v.bg,
        color: v.text,
        ...extraStyle,
      }}
    >
      {children}
    </span>
  );
}
