import React from 'react';

/**
 * Horizontal progress bar with positive/negative coloring.
 *
 * Props:
 *   value     - current value (default 0)
 *   max       - maximum value (default 100)
 *   showLabel - show value/max text (default false)
 *   label     - optional custom label text (overrides auto-generated)
 *   color     - optional color override (CSS color string)
 *   height    - bar height in pixels (default 3)
 *   className - optional extra class names
 */
export default function ProgressBar({
  value = 0,
  max = 100,
  showLabel = false,
  label,
  color,
  height = 3,
  className = '',
}) {
  const maxSafe = max || 1; // avoid division by zero
  const pct = Math.min(Math.abs(value / maxSafe) * 100, 100);
  const isPositive = value >= 0;
  const barColor = color || (isPositive ? 'var(--green)' : 'var(--red)');

  return (
    <div className={className}>
      <div
        style={{
          height: `${height}px`,
          background: 'var(--bg4)',
          borderRadius: `${height / 2}px`,
          overflow: 'hidden',
          margin: '8px 0 3px',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: `${height / 2}px`,
            width: `${pct}%`,
            background: barColor,
            transition: 'width 0.6s',
          }}
        />
      </div>
      {showLabel && (
        <div
          className="text-2xs tabular-nums"
          style={{ color: 'var(--text3)' }}
        >
          {label || `${value.toFixed(1)} / ${max}`}
        </div>
      )}
    </div>
  );
}
