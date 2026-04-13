/**
 * TradingView widget helpers for embedding charts.
 */

const TV_WIDGET_URL = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';

/**
 * Load and render a TradingView widget into the given container element.
 * Returns a cleanup function that removes the script.
 */
export function loadTradingViewWidget(container, options = {}) {
  if (!container) return () => {};

  const {
    symbol = 'BINANCE:BTCUSDT',
    interval = 'D',
    theme = 'dark',
    height = 400,
    width = '100%',
    hide_side_toolbar = true,
    allow_symbol_change = true,
  } = options;

  // Clear existing content
  container.innerHTML = '';

  const widgetConfig = {
    autosize: false,
    symbol,
    interval,
    timezone: 'Asia/Kolkata',
    theme,
    style: '1',
    locale: 'en',
    toolbar_bg: 'var(--bg2)',
    enable_publishing: false,
    hide_side_toolbar,
    allow_symbol_change,
    height,
    width,
    container_id: container.id,
  };

  const script = document.createElement('script');
  script.src = TV_WIDGET_URL;
  script.type = 'text/javascript';
  script.async = true;
  script.innerHTML = JSON.stringify(widgetConfig);

  const wrapper = document.createElement('div');
  wrapper.className = 'tradingview-widget-container';
  wrapper.style.height = `${height}px`;
  wrapper.style.borderRadius = 'var(--radius-lg)';
  wrapper.style.overflow = 'hidden';
  wrapper.style.border = '1px solid var(--border)';

  const widgetDiv = document.createElement('div');
  widgetDiv.className = 'tradingview-widget-container__widget';
  wrapper.appendChild(widgetDiv);
  wrapper.appendChild(script);

  container.appendChild(wrapper);

  return () => {
    container.innerHTML = '';
  };
}

/**
 * Get the TradingView symbol for a crypto pair.
 * e.g. "BTCUSDT" -> "BINANCE:BTCUSDT"
 */
export function getCryptoTVSymbol(sym) {
  return `BINANCE:${sym}`;
}

/**
 * Get the TradingView symbol for an NSE stock.
 * e.g. "RELIANCE" -> "NSE:RELIANCE"
 */
export function getNSETVSymbol(sym) {
  return `NSE:${sym}`;
}
