import React, { useEffect, useRef, useState } from 'react';
import { useStockStore } from '../../store/useStockStore';
import { NSE_STOCKS } from '../../utils/constants';
import Pill from '../shared/Pill';
import LoadingSkeleton from '../shared/LoadingSkeleton';
import EmptyState from '../shared/EmptyState';
import { formatPercent } from '../../utils/formatters';

function INR(n) {
  return `Rs${(+n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function clr(n) {
  return +n >= 0 ? 'var(--green)' : 'var(--red)';
}

function fmtT(ts) {
  if (!ts) return '--';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const TIMEFRAMES = [
  { label: '5m', value: '5minute' },
  { label: '15m', value: '15minute' },
  { label: '1h', value: '60minute' },
  { label: '1D', value: 'day' },
];

export default function Chart() {
  const { chartSym, setChartSym, fetchHistory, trades, prices } = useStockStore();
  const [interval, setInterval_] = useState('5minute');
  const [loading, setLoading] = useState(false);
  const [candles, setCandles] = useState(null);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  // Fetch data when symbol/interval changes
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchHistory(chartSym, interval);
        if (!cancelled) {
          if (!data || (Array.isArray(data) && data.length < 2)) {
            setError('No data available');
            setCandles(null);
          } else {
            setCandles(data);
          }
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Could not load chart data');
          setCandles(null);
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [chartSym, interval, fetchHistory]);

  // Render lightweight-charts
  useEffect(() => {
    if (!candles || !containerRef.current) return;

    let chart;
    import('lightweight-charts').then((mod) => {
      const { createChart } = mod;
      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';

      const isDark = document.documentElement.classList.contains('dark');
      chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 400,
        layout: {
          background: { color: isDark ? '#161b22' : '#FFFFFF' },
          textColor: isDark ? '#8b949e' : '#6B7280',
          fontSize: 11,
        },
        grid: {
          vertLines: { color: isDark ? '#21262d' : '#F0F1F3' },
          horzLines: { color: isDark ? '#21262d' : '#F0F1F3' },
        },
        timeScale: {
          timeVisible: true,
          borderColor: isDark ? '#30363d' : '#E5E7EB',
        },
        rightPriceScale: {
          borderColor: isDark ? '#30363d' : '#E5E7EB',
        },
      });

      // Candlestick series
      const candlestickSeries = chart.addCandlestickSeries({
        upColor: isDark ? '#3fb950' : '#16A34A',
        downColor: isDark ? '#f85149' : '#DC2626',
        borderUpColor: isDark ? '#3fb950' : '#16A34A',
        borderDownColor: isDark ? '#f85149' : '#DC2626',
        wickUpColor: isDark ? '#3fb950' : '#16A34A',
        wickDownColor: isDark ? '#f85149' : '#DC2626',
      });

      const formatted = (Array.isArray(candles) ? candles : [])
        .map((c) => ({
          time: Math.floor(new Date(c.date || c.timestamp).getTime() / 1000),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
        .sort((a, b) => a.time - b.time);

      if (formatted.length > 0) {
        candlestickSeries.setData(formatted);

        // Volume series
        const volumeSeries = chart.addHistogramSeries({
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        });

        chart.priceScale('volume').applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });

        const volData = (Array.isArray(candles) ? candles : [])
          .map((c) => ({
            time: Math.floor(new Date(c.date || c.timestamp).getTime() / 1000),
            value: c.volume || 0,
            color: c.close >= c.open
              ? (isDark ? 'rgba(63,185,80,0.2)' : 'rgba(22,163,74,0.2)')
              : (isDark ? 'rgba(248,81,73,0.2)' : 'rgba(220,38,38,0.2)'),
          }))
          .sort((a, b) => a.time - b.time);

        volumeSeries.setData(volData);

        // EMA 9 and EMA 21 overlays
        const closes = formatted.map((c) => c.close);

        function calcEMA(data, period) {
          const k = 2 / (period + 1);
          let ema = data[0];
          return data.map((val, i) => {
            if (i === 0) return val;
            ema = val * k + ema * (1 - k);
            return ema;
          });
        }

        const ema9vals = calcEMA(closes, 9);
        const ema21vals = calcEMA(closes, 21);

        const ema9Series = chart.addLineSeries({
          color: isDark ? '#58a6ff' : '#2563EB',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });

        const ema21Series = chart.addLineSeries({
          color: isDark ? '#d29922' : '#D97706',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });

        ema9Series.setData(
          formatted.map((c, i) => ({ time: c.time, value: ema9vals[i] }))
        );
        ema21Series.setData(
          formatted.map((c, i) => ({ time: c.time, value: ema21vals[i] }))
        );

        chart.timeScale().fitContent();
      }

      chartRef.current = chart;
    });

    // Handle resize
    const handleResize = () => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candles]);

  // Price info for header
  const lastCandle = Array.isArray(candles) && candles.length > 0 ? candles[candles.length - 1] : null;
  const firstCandle = Array.isArray(candles) && candles.length > 0 ? candles[0] : null;
  const chg = lastCandle && firstCandle
    ? ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100
    : 0;

  // Paper trades for this symbol
  const symbolTrades = (trades || []).filter((t) => t.symbol === chartSym).slice(0, 5);

  const tfLabel = TIMEFRAMES.find((t) => t.value === interval)?.label || interval;

  return (
    <div>
      {/* Controls row */}
      <div className="flex items-center gap-3 mb-2.5 flex-wrap">
        <select
          value={chartSym}
          onChange={(e) => setChartSym(e.target.value)}
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--border2)',
            borderRadius: 'var(--radius)',
            padding: '6px 10px',
            fontSize: 12,
            color: 'var(--text)',
            minWidth: 200,
            fontFamily: 'inherit',
          }}
        >
          {NSE_STOCKS.map((s) => (
            <option key={s.sym} value={s.sym}>
              {s.sym} - {s.name}
            </option>
          ))}
        </select>

        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setInterval_(tf.value)}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                borderRadius: 'var(--radius)',
                border: `1px solid ${interval === tf.value ? 'var(--text)' : 'var(--border)'}`,
                background: interval === tf.value ? 'var(--text)' : 'var(--bg2)',
                color: interval === tf.value ? 'var(--bg)' : 'var(--text)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {lastCandle && (
          <>
            <span className="font-semibold tabular-nums" style={{ fontSize: 15 }}>
              {INR(lastCandle.close)}
            </span>
            <span className="tabular-nums" style={{ fontSize: 12, color: clr(chg) }}>
              {chg >= 0 ? '+' : ''}
              {chg.toFixed(2)}%
            </span>
          </>
        )}

        <span className="ml-auto text-xs" style={{ color: 'var(--text3)' }}>
          Real-time / Kite Connect
        </span>
      </div>

      {/* Chart container */}
      <div
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 12,
          minHeight: 420,
          position: 'relative',
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center" style={{ height: 400 }}>
            <LoadingSkeleton lines={5} height={20} />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center" style={{ height: 400 }}>
            <div className="text-center">
              <div className="text-sm mb-2" style={{ color: 'var(--red)' }}>
                {error}
              </div>
              <div className="text-xs" style={{ color: 'var(--text3)' }}>
                Market may be closed or token expired
              </div>
            </div>
          </div>
        ) : (
          <div ref={containerRef} style={{ width: '100%', height: 400 }} />
        )}
      </div>

      {/* OHLCV info bar */}
      {lastCandle && (
        <div
          className="flex gap-4 flex-wrap tabular-nums"
          style={{ padding: '8px 0', fontSize: 12, color: 'var(--text2)' }}
        >
          <span>
            O: <b>{INR(lastCandle.open)}</b>
          </span>
          <span>
            H: <b style={{ color: 'var(--green)' }}>{INR(lastCandle.high)}</b>
          </span>
          <span>
            L: <b style={{ color: 'var(--red)' }}>{INR(lastCandle.low)}</b>
          </span>
          <span>
            C: <b>{INR(lastCandle.close)}</b>
          </span>
          <span>
            Vol: <b>{(lastCandle.volume || 0).toLocaleString('en-IN')}</b>
          </span>
          <span style={{ color: 'var(--text3)' }}>
            {(Array.isArray(candles) ? candles : []).length} candles / {tfLabel} / Kite
          </span>
        </div>
      )}

      {/* Paper trades for this symbol */}
      {symbolTrades.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--text2)' }}>
            Paper trades for {chartSym}
          </div>
          {symbolTrades.map((t, i) => (
            <div
              key={t.id || i}
              className="flex gap-2.5 items-center flex-wrap"
              style={{
                padding: '8px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              {t.status === 'OPEN' ? (
                <Pill variant="amber">Open</Pill>
              ) : +(t.pnl || 0) >= 0 ? (
                <Pill variant="green">Win</Pill>
              ) : (
                <Pill variant="red">Loss</Pill>
              )}
              <span className="text-xs" style={{ color: 'var(--text2)' }}>
                {fmtT(t.entry_time)} -&gt; {fmtT(t.exit_time)}
              </span>
              <span className="text-xs tabular-nums">Entry {INR(t.price)}</span>
              {t.exit_price && (
                <span className="text-xs tabular-nums">Exit {INR(t.exit_price)}</span>
              )}
              <span
                className="ml-auto font-medium tabular-nums"
                style={{
                  color: t.status === 'OPEN' ? 'var(--text2)' : clr(t.pnl),
                }}
              >
                {t.status === 'OPEN'
                  ? 'Open'
                  : `${+(t.pnl || 0) >= 0 ? '+' : ''}${INR(t.pnl)}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
