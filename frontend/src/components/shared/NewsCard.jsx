import React from 'react';
import { timeAgo } from '../../utils/formatters';

/**
 * News article card — Apple-style with soft sentiment indicator.
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
      : 'var(--border2)';

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

  const cardStyle = {
    background: 'var(--bg2)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px 18px',
    marginBottom: '8px',
    borderLeft: `3px solid ${borderLeftColor}`,
    boxShadow: 'var(--shadow-sm)',
    transition: 'all 0.2s',
  };

  const content = (
    <>
      <div
        style={{
          fontSize: '14px',
          fontWeight: 500,
          color: 'var(--text)',
          lineHeight: 1.45,
          marginBottom: summary ? '6px' : '8px',
        }}
      >
        {title}
      </div>

      {(summary || impact) && (
        <div
          style={{
            fontSize: '13px',
            color: 'var(--text3)',
            marginBottom: '8px',
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {summary || impact}
        </div>
      )}

      <div
        className="flex items-center gap-3"
        style={{ fontSize: '12px', color: 'var(--text3)' }}
      >
        {source && <span style={{ fontWeight: 500 }}>{source}</span>}
        {publishedAt && <span>{timeAgo(publishedAt)}</span>}
        {sentimentLabel && (
          <span
            style={{
              color: sentimentColor,
              fontWeight: 600,
              letterSpacing: '0.2px',
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
        className={`block ${className}`}
        style={{ ...cardStyle, textDecoration: 'none' }}
      >
        {content}
      </a>
    );
  }

  return (
    <div className={className} style={cardStyle}>
      {content}
    </div>
  );
}
