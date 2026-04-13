import React from 'react';

/**
 * Shimmer loading skeleton placeholder.
 *
 * Props:
 *   variant   - 'text' (default), 'card', 'table-row'
 *   lines     - number of skeleton lines for text variant (default 3)
 *   height    - pixel height of each skeleton bar (default 14 for text, varies by variant)
 *   width     - optional explicit width (CSS string, e.g. "200px" or "50%")
 *   className - optional extra class names
 *   count     - for card/table-row variant, number of items (default 1)
 */
export default function LoadingSkeleton({
  variant = 'text',
  lines = 3,
  height,
  width,
  className = '',
  count = 1,
}) {
  if (variant === 'card') {
    return (
      <div className={`${className}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="animate-shimmer"
            style={{
              background: 'var(--bg3)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              padding: '16px',
              marginBottom: i < count - 1 ? '8px' : 0,
              height: height || '100px',
              width: width || '100%',
            }}
          >
            <div
              style={{
                background: 'var(--bg4)',
                borderRadius: 'var(--radius)',
                height: '10px',
                width: '40%',
                marginBottom: '12px',
              }}
            />
            <div
              style={{
                background: 'var(--bg4)',
                borderRadius: 'var(--radius)',
                height: '20px',
                width: '60%',
                marginBottom: '8px',
              }}
            />
            <div
              style={{
                background: 'var(--bg4)',
                borderRadius: 'var(--radius)',
                height: '10px',
                width: '30%',
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table-row') {
    return (
      <div className={className}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="animate-shimmer flex gap-3 items-center"
            style={{
              padding: '9px 12px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                background: 'var(--bg3)',
                borderRadius: 'var(--radius)',
                height: height || '12px',
                width: '20%',
              }}
            />
            <div
              style={{
                background: 'var(--bg3)',
                borderRadius: 'var(--radius)',
                height: height || '12px',
                width: '30%',
              }}
            />
            <div
              style={{
                background: 'var(--bg3)',
                borderRadius: 'var(--radius)',
                height: height || '12px',
                width: '15%',
                marginLeft: 'auto',
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  // Default: text variant
  const barHeight = height || 14;
  return (
    <div className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="animate-shimmer"
          style={{
            height: `${barHeight}px`,
            borderRadius: 'var(--radius)',
            background: 'var(--bg3)',
            marginBottom: i < lines - 1 ? '8px' : 0,
            width: width || (i === lines - 1 ? '60%' : '100%'),
          }}
        />
      ))}
    </div>
  );
}
