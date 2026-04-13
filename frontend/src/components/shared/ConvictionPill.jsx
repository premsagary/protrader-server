import React from 'react';

const TIER_STYLES = {
  'strong-buy': {
    bg: 'var(--tier-strong-buy-bg)',
    text: 'var(--tier-strong-buy-text)',
  },
  buy: {
    bg: 'var(--tier-buy-bg)',
    text: 'var(--tier-buy-text)',
  },
  accumulate: {
    bg: 'var(--tier-accumulate-bg)',
    text: 'var(--tier-accumulate-text)',
  },
  watch: {
    bg: 'var(--tier-watch-bg)',
    text: 'var(--tier-watch-text)',
  },
  avoid: {
    bg: 'var(--tier-avoid-bg)',
    text: 'var(--tier-avoid-text)',
  },
};

const TIER_LABELS = {
  'strong-buy': 'Strong Buy',
  buy: 'Buy',
  accumulate: 'Accumulate',
  watch: 'Watch',
  avoid: 'Avoid',
};

function normalizeTier(tier) {
  if (!tier) return 'watch';
  const t = tier.toLowerCase().replace(/[\s_]+/g, '-');
  if (TIER_STYLES[t]) return t;
  if (t === 'hold') return 'watch';
  if (t === 'sell' || t === 'reduce') return 'avoid';
  if (t === 'strongbuy' || t === 'strong-buy') return 'strong-buy';
  return 'watch';
}

/**
 * Conviction tier badge — Apple-style, soft backgrounds, no borders.
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
        borderRadius: 'var(--radius)',
        padding: '3px 10px',
        fontSize: '12px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        letterSpacing: '-0.1px',
        background: style.bg,
        color: style.text,
      }}
    >
      {label}
    </span>
  );
}

ConvictionPill.normalizeTier = normalizeTier;
