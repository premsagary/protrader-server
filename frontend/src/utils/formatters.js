/**
 * Format a number as Indian Rupee currency.
 * e.g. 12345.67 -> "12,345.67" (with optional rupee symbol)
 */
export function formatCurrency(value, { symbol = 'Rs', decimals = 2 } = {}) {
  if (value == null || isNaN(value)) return '--';
  const num = Number(value);
  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return symbol ? `${symbol}${formatted}` : formatted;
}

/**
 * Format a number as percentage.
 * e.g. 12.345 -> "+12.35%" or "-3.20%"
 */
export function formatPercent(value, { decimals = 2, showSign = true } = {}) {
  if (value == null || isNaN(value)) return '--';
  const num = Number(value);
  const sign = showSign && num > 0 ? '+' : '';
  return `${sign}${num.toFixed(decimals)}%`;
}

/**
 * Format a number with commas.
 * e.g. 1234567 -> "12,34,567" (Indian numbering)
 */
export function formatNumber(value, { decimals = 0 } = {}) {
  if (value == null || isNaN(value)) return '--';
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a date string or timestamp.
 * e.g. "2026-04-09T10:30:00" -> "09 Apr 2026"
 */
export function formatDate(value) {
  if (!value) return '--';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a time string.
 * e.g. "2026-04-09T10:30:00" -> "10:30 AM"
 */
export function formatTime(value) {
  if (!value) return '--';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Relative time ago string.
 * e.g. Date.now() - 3600000 -> "1 hour ago"
 */
export function timeAgo(value) {
  if (!value) return '--';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '--';

  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/**
 * Abbreviate large numbers.
 * e.g. 1234567 -> "12.3L", 12345678 -> "1.2Cr"
 */
export function abbreviateNumber(value) {
  if (value == null || isNaN(value)) return '--';
  const num = Number(value);
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 1e7) return `${sign}${(abs / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${sign}${(abs / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}
