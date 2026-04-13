import React, { useEffect, useRef } from 'react';
import { useCryptoStore } from '../../store/useCryptoStore';
import { CRYPTO_LIST } from '../../utils/constants';
import { loadTradingViewWidget, getCryptoTVSymbol } from '../../utils/tradingView';
import Pill from '../shared/Pill';

function clr(n) {
  return +n >= 0 ? 'var(--green)' : 'var(--red)';
}

function INR(n) {
  return `Rs${(+n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
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

export default function Chart() {
  const { chartSym, setChartSym, prices, trades } = useCryptoStore();
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = document.documentElement.classList.contains('dark');
    const cleanup = loadTradingViewWidget(containerRef.current, {
      symbol: getCryptoTVSymbol(chartSym),
      interval: '60',
      theme: isDark ? 'dark' : 'light',
      height: 480,
      hide_side_toolbar: false,
      allow_symbol_change: true,
    });

    return cleanup;
  }, [chartSym]);

  const currentPrice = prices[chartSym];
  const symbolTrades = (trades || []).filter((t) => t.symbol === chartSym).slice(0, 5);

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
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
            minWidth: 180,
            fontFamily: 'inherit',
          }}
        >
          {CRYPTO_LIST.map((c) => (
            <option key={c.sym} value={c.sym}>
              {c.base} - {c.name}
            </option>
          ))}
        </select>

        {currentPrice && (
          <span className="font-semibold tabular-nums" style={{ fontSize: 15 }}>
            ${currentPrice.price.toFixed(4)}
          </span>
        )}

        <span className="text-xs" style={{ color: 'var(--text2)' }}>
          1h / TradingView / Binance
        </span>
      </div>

      {/* TradingView widget container */}
      <div
        style={{
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
      >
        <div
          id="tv-crypto-container"
          ref={containerRef}
          style={{ height: 480 }}
        />
      </div>

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
                <Pill variant="purple">Open</Pill>
              ) : +(t.pnl || 0) >= 0 ? (
                <Pill variant="green">Win</Pill>
              ) : (
                <Pill variant="red">Loss</Pill>
              )}
              <span className="text-xs" style={{ color: 'var(--text2)' }}>
                {fmtT(t.entry_time)} -&gt; {fmtT(t.exit_time)}
              </span>
              <span className="text-xs tabular-nums">
                Entry ${parseFloat(t.price).toFixed(4)}
              </span>
              {t.exit_price && (
                <span className="text-xs tabular-nums">
                  Exit ${parseFloat(t.exit_price).toFixed(4)}
                </span>
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
