import React from 'react';
import { timeAgo } from '../../utils/formatters';

/**
 * News article card with sentiment indicator.
 *
 * Props:
 *   title       - article headline
 *   source      - news source name
 *   url         - link to full article
 *   publishedAt - date/time string or timestamp
 *   sentiment   - 'bullish'|'bull'|'bearish'|'bear'|'neutral' (optional)
 *   summary     - optional article summary text
 *   className   - optional extra class names
 */
export default function NewsCard({
  title,
  source,
  url,
  publishedAt,
  sentiment,
  summary,
  impact,
  className = '',
}) {
  const isBullish = sentiment === 'bullish' || sentiment === 'bull';
  const isBearish = sentiment === 'bearish' || sentiment === 'bear';

  const borderLeftColor = isBullish
    ? 'var(--green)'
    : isBearish
      ? 'var(--red)'
      : 'var(--border)';

  const sentimentColor = isBullish
    ? 'var(--green-text)'
    : isBearish
      ? 'var(--red-text)'
      : 'var(--text3)';

  const sentimentLabel = isBullish
    ? 'Bullish'
    : isBearish
      ? 'Bearish'
      : sentiment
        ? 'Neutral'
        : null;

  const content = (
    <>
      {/* Title */}
      <div
        className="font-medium text-sm"
        style={{
          color: 'var(--text)',
          lineHeight: 1.4,
          marginBottom: summary ? '4px' : '6px',
        }}
      >
        {title}
      </div>

      {/* Summary / Impact */}
      {(summary || impact) && (
        <div
          className="text-2xs"
          style={{
            color: 'var(--text3)',
            marginBottom: '6px',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {summary || impact}
        </div>
      )}

      {/* Meta row */}
      <div
        className="flex items-center gap-3 text-2xs"
        style={{ color: 'var(--text3)' }}
      >
        {source && <span>{source}</span>}
        {publishedAt && <span>{timeAgo(publishedAt)}</span>}
        {sentimentLabel && (
          <span
            style={{
              color: sentimentColor,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {sentimentLabel}
          </span>
        )}
      </div>
    </>
  );

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`block no-underline transition-colors ${className}`}
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px',
          marginBottom: '8px',
          borderLeft: `3px solid ${borderLeftColor}`,
          textDecoration: 'none',
        }}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      className={`transition-colors ${className}`}
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px',
        marginBottom: '8px',
        borderLeft: `3px solid ${borderLeftColor}`,
      }}
    >
      {content}
    </div>
  );
}
