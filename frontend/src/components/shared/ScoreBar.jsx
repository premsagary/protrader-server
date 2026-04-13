import React, { useState, useCallback } from 'react';

const SEGMENTS = [
  { key: 'fa', label: 'Fundamental', color: 'var(--blue)' },
  { key: 'ta', label: 'Technical', color: 'var(--green)' },
  { key: 'momentum', label: 'Momentum', color: 'var(--amber)' },
  { key: 'risk', label: 'Risk', color: 'var(--purple)' },
];

/**
 * 4-segment horizontal composite score bar.
 * Shows FA (blue) + TA (green) + Momentum (amber) + Risk (purple)
 * with proportional widths.
 *
 * Props:
 *   fa       - fundamental score (default 0)
 *   ta       - technical score (default 0)
 *   momentum - momentum score (default 0)
 *   risk     - risk score (default 0)
 *   showLabel - whether to show total score label (default false)
 *   height   - bar height in pixels (default 6)
 *   className - optional extra class names
 */
export default function ScoreBar({
  fa = 0,
  ta = 0,
  momentum = 0,
  risk = 0,
  showLabel = false,
  height = 6,
  className = '',
}) {
  const [tooltip, setTooltip] = useState(null);
  const values = { fa, ta, momentum, risk };
  const total = fa + ta + momentum + risk;

  const handleMouseEnter = useCallback((seg) => {
    setTooltip(seg);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  if (total === 0) return null;

  const pct = (v) => `${((v / total) * 100).toFixed(1)}%`;

  return (
    <div className={className} style={{ position: 'relative' }}>
      <div
        className="flex overflow-hidden"
        style={{
          height: `${height}px`,
          borderRadius: `${height / 2}px`,
          background: 'var(--bg4)',
          gap: '1px',
        }}
      >
        {SEGMENTS.map((seg) => {
          const v = values[seg.key];
          if (v <= 0) return null;
          return (
            <div
              key={seg.key}
              onMouseEnter={() => handleMouseEnter(seg)}
              onMouseLeave={handleMouseLeave}
              style={{
                width: pct(v),
                height: '100%',
                background: seg.color,
                transition: 'width 0.4s',
                cursor: 'default',
              }}
            />
          );
        })}
      </div>

      {/* Total score label */}
      {showLabel && (
        <div
          className="text-2xs tabular-nums font-medium"
          style={{
            color: 'var(--text2)',
            marginTop: '3px',
          }}
        >
          Score: {total.toFixed(0)}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            bottom: `${height + 6}px`,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '4px 8px',
            fontSize: '10px',
            color: tooltip.color,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow)',
            zIndex: 20,
            pointerEvents: 'none',
          }}
        >
          {tooltip.label}: {values[tooltip.key].toFixed(1)}
        </div>
      )}
    </div>
  );
}
