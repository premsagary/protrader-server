import React from 'react';

/**
 * Horizontal bar showing bullish/bearish sentiment split.
 *
 * Props:
 *   bullish   - bullish count or percentage (default 0)
 *   bearish   - bearish count or percentage (default 0)
 *   height    - bar height in pixels (default 4)
 *   showLabels - show percentage labels (default true)
 *   className - optional extra class names
 */
export default function SentimentBar({
  bullish = 0,
  bearish = 0,
  height = 4,
  showLabels = true,
  className = '',
}) {
  const total = bullish + bearish;
  if (total === 0) return null;

  const bullPct = ((bullish / total) * 100).toFixed(0);
  const bearPct = ((bearish / total) * 100).toFixed(0);

  return (
    <div className={className}>
      {showLabels && (
        <div className="flex justify-between text-2xs mb-1">
          <span className="tabular-nums" style={{ color: 'var(--green-text)' }}>
            Bullish {bullPct}%
          </span>
          <span className="tabular-nums" style={{ color: 'var(--red-text)' }}>
            Bearish {bearPct}%
          </span>
        </div>
      )}
      <div
        className="flex overflow-hidden"
        style={{
          height: `${height}px`,
          borderRadius: `${height / 2}px`,
          background: 'var(--bg4)',
        }}
      >
        <div
          style={{
            width: `${bullPct}%`,
            background: 'var(--green)',
            transition: 'width 0.4s',
          }}
        />
        <div
          style={{
            width: `${bearPct}%`,
            background: 'var(--red)',
            transition: 'width 0.4s',
          }}
        />
      </div>
    </div>
  );
}
