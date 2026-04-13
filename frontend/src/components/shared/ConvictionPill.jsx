import React from 'react';

const TIER_STYLES = {
  'strong-buy': {
    bg: 'var(--tier-strong-buy-bg)',
    text: 'var(--tier-strong-buy-text)',
    border: 'var(--tier-strong-buy-border)',
  },
  buy: {
    bg: 'var(--tier-buy-bg)',
    text: 'var(--tier-buy-text)',
    border: 'var(--tier-buy-border)',
  },
  accumulate: {
    bg: 'var(--tier-accumulate-bg)',
    text: 'var(--tier-accumulate-text)',
    border: 'var(--tier-accumulate-border)',
  },
  watch: {
    bg: 'var(--tier-watch-bg)',
    text: 'var(--tier-watch-text)',
    border: 'var(--tier-watch-border)',
  },
  avoid: {
    bg: 'var(--tier-avoid-bg)',
    text: 'var(--tier-avoid-text)',
    border: 'var(--tier-avoid-border)',
  },
};

const TIER_LABELS = {
  'strong-buy': 'Strong Buy',
  buy: 'Buy',
  accumulate: 'Accumulate',
  watch: 'Watch',
  avoid: 'Avoid',
};

/**
 * Normalize a conviction string to a recognized tier ID.
 */
function normalizeTier(tier) {
  if (!tier) return 'watch';
  const t = tier.toLowerCase().replace(/[\s_]+/g, '-');
  if (TIER_STYLES[t]) return t;
  // Common aliases
  if (t === 'hold') return 'watch';
  if (t === 'sell' || t === 'reduce') return 'avoid';
  if (t === 'strongbuy' || t === 'strong-buy') return 'strong-buy';
  return 'watch';
}

/**
 * Conviction tier badge.
 *
 * Props:
 *   tier      - conviction string (e.g. "Strong Buy", "buy", "Accumulate", "Watch", "Avoid")
 *   className - optional extra class names
 */
export default function ConvictionPill({ tier, className = '' }) {
  const normalized = normalizeTier(tier);
  const style = TIER_STYLES[normalized];
  const label = TIER_LABELS[normalized];

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '4px',
        padding: '2px 10px',
        fontSize: '11px',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        letterSpacing: '0.1px',
        textTransform: 'uppercase',
        background: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
      }}
    >
      {label}
    </span>
  );
}

// Export for external use
ConvictionPill.normalizeTier = normalizeTier;
