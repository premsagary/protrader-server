import React, { useMemo } from 'react';

/**
 * Renders an inline SVG sparkline from a values array.
 *
 * Props:
 *   values  - array of numbers (min 2 for rendering)
 *   width   - SVG width in pixels (default 60)
 *   height  - SVG height in pixels (default 20)
 *   color   - optional CSS color override (auto-detects green/red from trend)
 *   showDot - whether to show a dot on the last point (default true)
 */
export default function MiniSparkline({
  values = [],
  width = 60,
  height = 20,
  color,
  showDot = true,
}) {
  const { points, lastX, lastY, lineColor } = useMemo(() => {
    if (!values || values.length < 2) {
      return { points: '', lastX: 0, lastY: 0, lineColor: 'var(--text3)' };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padY = 2; // vertical padding to avoid clipping at edges
    const step = width / (values.length - 1);

    const pts = values.map((v, i) => {
      const x = i * step;
      const y = height - padY - ((v - min) / range) * (height - 2 * padY);
      return { x, y };
    });

    const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const last = pts[pts.length - 1];
    const trend = values[values.length - 1] >= values[0] ? 'var(--green)' : 'var(--red)';

    return {
      points: polyline,
      lastX: last.x,
      lastY: last.y,
      lineColor: color || trend,
    };
  }, [values, width, height, color]);

  if (!values || values.length < 2) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDot && (
        <circle
          cx={lastX}
          cy={lastY}
          r="2"
          fill={lineColor}
        />
      )}
    </svg>
  );
}
