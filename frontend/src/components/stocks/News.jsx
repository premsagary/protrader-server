import React, { useState, useEffect } from 'react';
import { useStockStore } from '../../store/useStockStore';
import { newsApi } from '../../api/newsApi';
import { NSE_STOCKS } from '../../utils/constants';
import NewsCard from '../shared/NewsCard';
import SentimentBar from '../shared/SentimentBar';
import Pill from '../shared/Pill';
import LoadingSkeleton from '../shared/LoadingSkeleton';
import EmptyState from '../shared/EmptyState';

export default function News() {
  const { newsNseSym, setNewsNseSym } = useStockStore();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);

  const stock = NSE_STOCKS.find((s) => s.sym === newsNseSym);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const data = await newsApi.fetchNews(newsNseSym, stock?.name || newsNseSym);
      setArticles(Array.isArray(data) ? data : data.articles || []);
    } catch {
      setArticles([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await newsApi.fetchNews(newsNseSym, stock?.name || newsNseSym);
        if (!cancelled) setArticles(Array.isArray(data) ? data : data.articles || []);
      } catch {
        if (!cancelled) setArticles([]);
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [newsNseSym, stock?.name]);

  const bullCount = articles.filter((n) => n.sentiment === 'bullish').length;
  const bearCount = articles.filter((n) => n.sentiment === 'bearish').length;
  const neutralCount = articles.filter((n) => n.sentiment === 'neutral').length;
  const total = articles.length || 1;
  const sentScore = (((bullCount - bearCount) / total) * 100).toFixed(0);

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={newsNseSym}
          onChange={(e) => setNewsNseSym(e.target.value)}
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--border2)',
            borderRadius: 'var(--radius)',
            padding: '6px 10px',
            fontSize: 12,
            color: 'var(--text)',
            minWidth: 220,
            fontFamily: 'inherit',
          }}
        >
          {NSE_STOCKS.map((s) => (
            <option key={s.sym} value={s.sym}>
              {s.sym} - {s.name}
            </option>
          ))}
        </select>

        {loading && (
          <span className="text-xs animate-pulse-custom" style={{ color: 'var(--text3)' }}>
            Fetching...
          </span>
        )}

        <div className="flex gap-1.5">
          {bullCount > 0 && <Pill variant="green">{bullCount} bullish</Pill>}
          {bearCount > 0 && <Pill variant="red">{bearCount} bearish</Pill>}
          {neutralCount > 0 && <Pill variant="gray">{neutralCount} neutral</Pill>}
        </div>

        <button
          onClick={fetchNews}
          className="ml-auto text-xs"
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '4px 10px',
            cursor: 'pointer',
            color: 'var(--text2)',
            fontFamily: 'inherit',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Sentiment bar */}
      {!loading && articles.length > 0 && (
        <div
          style={{
            background: 'var(--bg2)',
            borderRadius: 'var(--radius-lg)',
            padding: '10px 12px',
            marginBottom: 10,
            border: '1px solid var(--border)',
          }}
        >
          <div className="text-xs mb-1.5" style={{ color: 'var(--text2)' }}>
            Sentiment for {newsNseSym}
          </div>
          <SentimentBar bullish={bullCount} bearish={bearCount} />
          <div className="flex gap-2.5 mt-1.5 text-xs" style={{ color: 'var(--text3)' }}>
            <span style={{ color: 'var(--green-text)' }}>
              {bullCount} bullish
            </span>
            <span style={{ color: 'var(--red-text)' }}>
              {bearCount} bearish
            </span>
            <span className="ml-auto font-medium" style={{ color: +sentScore >= 0 ? 'var(--green-text)' : 'var(--red-text)' }}>
              {+sentScore >= 0 ? 'Bullish' : 'Bearish'} {Math.abs(+sentScore)}%
            </span>
          </div>
        </div>
      )}

      {/* News list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <LoadingSkeleton key={i} lines={3} height={20} />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <EmptyState message={`No news found for ${newsNseSym}`} />
      ) : (
        articles.map((item, i) => (
          <NewsCard
            key={item.url || item.link || i}
            title={item.headline || item.title}
            source={item.source}
            url={item.link || item.url}
            publishedAt={item.publishedAt || item.date}
            sentiment={item.sentiment}
            impact={item.impact}
          />
        ))
      )}
    </div>
  );
}
