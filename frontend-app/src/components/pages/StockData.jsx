import React, { useEffect, useState, useMemo } from 'react';
import { apiGet } from '../../api/client';

// ══════════════════════════════════════════════════════════════════════
// Sub-tab configurations — restored from old app.html TAB_DEFS/TAB_COLS
// 9 specialized column views on the same stock universe.
// ══════════════════════════════════════════════════════════════════════
const SUB_TABS = [
  { id: 'overview',   label: 'Overview',   icon: '📊' },
  { id: 'quality',    label: 'Quality',    icon: '⭐' },
  { id: 'value',      label: 'Value',      icon: '💰' },
  { id: 'momentum',   label: 'Momentum',   icon: '🚀' },
  { id: 'growth',     label: 'Growth',     icon: '📈' },
  { id: 'technical',  label: 'Technical',  icon: '🔧' },
  { id: 'financials', label: 'Financials', icon: '🏦' },
  { id: 'ownership',  label: 'Ownership',  icon: '👥' },
  { id: 'signals',    label: 'Signals',    icon: '⚡' },
];

// ── Formatters (reusable cell renderers) ──────────────────────────────
const FMT = {
  pct:    (v) => v == null ? '—' : `${Number(v).toFixed(1)}%`,
  num:    (v, d = 1) => v == null ? '—' : Number(v).toFixed(d),
  num0:   (v) => v == null ? '—' : Math.round(Number(v)),
  ratio:  (v) => v == null ? '—' : Number(v).toFixed(2),
  de:     (v) => v == null ? '—' : `${Number(v).toFixed(2)}x`,
  price:  (v) => v == null ? '—' : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 1 })}`,
  crore:  (v) => {
    if (v == null) return '—';
    const n = Number(v);
    if (Math.abs(n) >= 100000) return `${(n / 100000).toFixed(1)}L Cr`;
    if (Math.abs(n) >= 100) return `${n.toFixed(0)} Cr`;
    return n.toFixed(1);
  },
  bool:   (v, y = 'Yes', n = 'No') => v == null ? '—' : v ? y : n,
  yesNo:  (v) => v == null ? '—' : v ? '✓' : '—',
  trend:  (v) => v == null ? '—' : String(v),
  rsi:    (v) => v == null ? '—' : Math.round(v),
  dma:    (v) => v == null ? '—' : Number(v).toFixed(1),
};

// ── Color rules by field value ────────────────────────────────────────
const COLORS = {
  pe: (v) => v == null ? 'var(--text4)' : v < 15 ? 'var(--green-text)' : v < 25 ? 'var(--text)' : v < 40 ? 'var(--amber-text)' : 'var(--red-text)',
  roe: (v) => v == null ? 'var(--text4)' : v >= 20 ? 'var(--green-text)' : v >= 15 ? 'var(--amber-text)' : v >= 10 ? 'var(--text)' : 'var(--red-text)',
  de: (v) => v == null ? 'var(--text4)' : v < 1 ? 'var(--green-text)' : v < 2 ? 'var(--text)' : 'var(--red-text)',
  pctPos: (v) => v == null ? 'var(--text4)' : v > 0 ? 'var(--green-text)' : v < 0 ? 'var(--red-text)' : 'var(--text)',
  fromHigh: (v) => v == null ? 'var(--text4)' : v > -10 ? 'var(--green-text)' : v > -20 ? 'var(--amber-text)' : 'var(--red-text)',
  pledged: (v) => v == null ? 'var(--text4)' : v < 10 ? 'var(--green-text)' : v < 30 ? 'var(--amber-text)' : 'var(--red-text)',
  rsi: (v) => v == null ? 'var(--text4)' : v >= 45 && v <= 65 ? 'var(--green-text)' : v > 75 ? 'var(--red-text)' : 'var(--amber-text)',
  volRatio: (v) => v == null ? 'var(--text4)' : v > 1.2 ? 'var(--green-text)' : v > 0.8 ? 'var(--text)' : 'var(--red-text)',
  goldenCross: (v) => v == null ? 'var(--text4)' : v ? 'var(--amber-text)' : 'var(--red-text)',
  peg: (v) => v == null ? 'var(--text4)' : v < 1 ? 'var(--green-text)' : v < 2 ? 'var(--text)' : 'var(--red-text)',
  sharpe: (v) => v == null ? 'var(--text4)' : v > 1 ? 'var(--green-text)' : v > 0 ? 'var(--text)' : 'var(--red-text)',
};

// ── DMA cell — compares price to DMA for bull/bear color ──────────────
function dmaColor(price, dma) {
  if (price == null || dma == null) return 'var(--text4)';
  return price > dma ? 'var(--green-text)' : 'var(--red-text)';
}

// ══════════════════════════════════════════════════════════════════════
// Column definitions per sub-tab — header color + cell renderer
// ══════════════════════════════════════════════════════════════════════
const TAB_COLS = {
  overview: [
    { k: 'roe',          l: 'ROE%',   hc: 'var(--amber-text)', fmt: FMT.num, color: COLORS.roe },
    { k: 'debtToEq',     l: 'D/E',    hc: 'var(--amber-text)', fmt: FMT.de, color: COLORS.de },
    { k: 'opMargin',     l: 'OpMgn%', hc: 'var(--amber-text)', fmt: FMT.pct },
    { k: 'pe',           l: 'P/E',    hc: 'var(--green-text)', fmt: FMT.num, color: COLORS.pe },
    { k: 'peg',          l: 'PEG',    hc: 'var(--green-text)', fmt: FMT.ratio, color: COLORS.peg, derive: (s) => (s.pe != null && s.earGrowth > 0) ? s.pe / s.earGrowth : null },
    { k: 'pctFromHigh',  l: 'FrHi%',  hc: 'var(--green-text)', fmt: FMT.pct, color: COLORS.fromHigh },
    { k: 'wk52Change',   l: '52W%',   hc: 'var(--brand-text)', fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'change6m',     l: '6M%',    hc: 'var(--brand-text)', fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'rsi',          l: 'RSI',    hc: 'var(--brand-text)', fmt: FMT.rsi, color: COLORS.rsi },
    { k: 'beta',         l: 'Beta',   hc: 'var(--brand-text)', fmt: FMT.ratio },
    { k: 'revGrowth',    l: 'RevGr%', hc: 'var(--purple-text)', fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'earGrowth',    l: 'EpsGr%', hc: 'var(--purple-text)', fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'dma50',        l: '50DMA',  hc: 'var(--red-text)',   fmt: FMT.dma, color: (v, s) => dmaColor(s.price, v) },
    { k: 'dma200',       l: '200DMA', hc: 'var(--red-text)',   fmt: FMT.dma, color: (v, s) => dmaColor(s.price, v) },
    { k: 'goldenCross',  l: 'GldCrs', hc: 'var(--red-text)',   fmt: (v) => FMT.yesNo(v), color: COLORS.goldenCross },
    { k: 'target',       l: 'Target', hc: 'var(--text3)',      fmt: FMT.price },
    { k: 'rewardPct',    l: 'Upside', hc: 'var(--text3)',      fmt: FMT.pct, color: COLORS.pctPos },
  ],
  quality: [
    { k: 'roe',          l: 'ROE%',   hc: 'var(--amber-text)', fmt: FMT.num, color: COLORS.roe },
    { k: 'roa',          l: 'ROA%',   hc: 'var(--amber-text)', fmt: FMT.num, color: COLORS.roe },
    { k: 'roce',         l: 'ROCE%',  hc: 'var(--amber-text)', fmt: FMT.num, color: COLORS.roe },
    { k: 'roe3yAvg',     l: 'ROE 3Y', hc: 'var(--amber-text)', fmt: FMT.num, color: COLORS.roe },
    { k: 'roe5yAvg',     l: 'ROE 5Y', hc: 'var(--amber-text)', fmt: FMT.num, color: COLORS.roe },
    { k: 'debtToEq',     l: 'D/E',    hc: 'var(--amber-text)', fmt: FMT.de, color: COLORS.de },
    { k: 'opMargin',     l: 'OpMgn%', hc: 'var(--amber-text)', fmt: FMT.pct },
    { k: 'grossMgn',     l: 'GrsMgn%',hc: 'var(--amber-text)', fmt: FMT.pct },
    { k: 'profMgn',      l: 'PrfMgn%',hc: 'var(--amber-text)', fmt: FMT.pct },
    { k: 'intCov',       l: 'IntCov', hc: 'var(--text)',       fmt: FMT.ratio },
    { k: 'currentRatio', l: 'CurRat', hc: 'var(--text)',       fmt: FMT.ratio },
    { k: 'quickRatio',   l: 'QuickR', hc: 'var(--text)',       fmt: FMT.ratio },
    { k: 'dupontNetMargin',     l: 'DP NM%',  hc: 'var(--green-text)', fmt: FMT.pct },
    { k: 'dupontAssetTurnover', l: 'DP AT',   hc: 'var(--green-text)', fmt: FMT.ratio },
    { k: 'dupontEquityMultiplier', l: 'DP EM', hc: 'var(--green-text)', fmt: FMT.ratio },
    { k: 'dupontROE',    l: 'DP ROE%',hc: 'var(--green-text)', fmt: FMT.num, color: COLORS.roe },
    { k: 'sharpeRatio',  l: 'Sharpe', hc: 'var(--brand-text)', fmt: FMT.ratio, color: COLORS.sharpe },
    { k: 'cashConversionCycle', l: 'CCC Days', hc: 'var(--brand-text)', fmt: FMT.num0 },
    { k: 'workingCapitalHealth', l: 'WC Health', hc: 'var(--brand-text)', fmt: FMT.trend },
  ],
  value: [
    { k: 'pe',           l: 'P/E',       hc: 'var(--green-text)', fmt: FMT.num, color: COLORS.pe },
    { k: 'pb',           l: 'P/B',       hc: 'var(--green-text)', fmt: FMT.ratio, color: (v) => v == null ? 'var(--text4)' : v < 3 ? 'var(--green-text)' : 'var(--red-text)' },
    { k: 'fwdPE',        l: 'FwdPE',     hc: 'var(--green-text)', fmt: FMT.num, color: COLORS.pe },
    { k: 'peg',          l: 'PEG',       hc: 'var(--green-text)', fmt: FMT.ratio, color: COLORS.peg, derive: (s) => (s.pe != null && s.earGrowth > 0) ? s.pe / s.earGrowth : null },
    { k: 'evEbitda',     l: 'EV/EBITDA', hc: 'var(--green-text)', fmt: FMT.num, color: COLORS.pe },
    { k: 'earningsYield',l: 'EarnYld%',  hc: 'var(--green-text)', fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'priceToFCF',   l: 'P/FCF',     hc: 'var(--green-text)', fmt: FMT.num, color: COLORS.pe },
    { k: 'priceToSales', l: 'P/Sales',   hc: 'var(--green-text)', fmt: FMT.ratio },
    { k: 'divYield',     l: 'DivYld%',   hc: 'var(--text)',       fmt: FMT.pct },
    { k: 'industryPE',   l: 'IndPE',     hc: 'var(--text)',       fmt: FMT.num },
    { k: 'pctFromHigh',  l: 'FrHi%',     hc: 'var(--text)',       fmt: FMT.pct, color: COLORS.fromHigh },
  ],
  momentum: [
    { k: 'wk52Change',   l: '52W%',    hc: 'var(--brand-text)', fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'change6m',     l: '6M%',     hc: 'var(--brand-text)', fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'change3m',     l: '3M%',     hc: 'var(--brand-text)', fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'change1m',     l: '1M%',     hc: 'var(--brand-text)', fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'pctFromHigh',  l: 'FrHi%',   hc: 'var(--purple-text)',fmt: FMT.pct, color: COLORS.fromHigh },
    { k: 'pctAbove50',   l: 'Ab50%',   hc: 'var(--purple-text)',fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'pctAbove200',  l: 'Ab200%',  hc: 'var(--purple-text)',fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'rsi',          l: 'RSI',     hc: 'var(--amber-text)', fmt: FMT.rsi, color: COLORS.rsi },
    { k: 'beta',         l: 'Beta',    hc: 'var(--amber-text)', fmt: FMT.ratio },
    { k: 'annualVol',    l: 'AnnVol%', hc: 'var(--amber-text)', fmt: FMT.pct },
    { k: 'wk52Hi',       l: '52W Hi',  hc: 'var(--text)',       fmt: FMT.price },
    { k: 'wk52Lo',       l: '52W Lo',  hc: 'var(--text)',       fmt: FMT.price },
  ],
  growth: [
    { k: 'revGrowth',    l: 'RevGr%',    hc: 'var(--purple-text)', fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'earGrowth',    l: 'EpsGr%',    hc: 'var(--purple-text)', fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'salesGr1y',    l: 'Sales1Y%',  hc: 'var(--purple-text)', fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'salesGr5y',    l: 'Sales5Y%',  hc: 'var(--purple-text)', fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'epsGr1y',      l: 'EPS1Y%',    hc: 'var(--green-text)',  fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'epsGr5y',      l: 'EPS5Y%',    hc: 'var(--green-text)',  fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'ret1y',        l: 'Ret1Y%',    hc: 'var(--brand-text)',  fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'ret3y',        l: 'Ret3Y%',    hc: 'var(--brand-text)',  fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'ret5y',        l: 'Ret5Y%',    hc: 'var(--brand-text)',  fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'ret6m',        l: 'Ret6M%',    hc: 'var(--brand-text)',  fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'ret3m',        l: 'Ret3M%',    hc: 'var(--brand-text)',  fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'patQtrYoy',    l: 'PAT QoQ%',  hc: 'var(--text)',        fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'salesQtrYoy',  l: 'Sales QoQ%',hc: 'var(--text)',        fmt: FMT.pct, color: COLORS.pctPos },
  ],
  technical: [
    { k: 'dma20',        l: '20DMA',    hc: 'var(--red-text)',   fmt: FMT.dma, color: (v, s) => dmaColor(s.price, v) },
    { k: 'dma50',        l: '50DMA',    hc: 'var(--red-text)',   fmt: FMT.dma, color: (v, s) => dmaColor(s.price, v) },
    { k: 'dma100',       l: '100DMA',   hc: 'var(--red-text)',   fmt: FMT.dma, color: (v, s) => dmaColor(s.price, v) },
    { k: 'dma200',       l: '200DMA',   hc: 'var(--red-text)',   fmt: FMT.dma, color: (v, s) => dmaColor(s.price, v) },
    { k: 'goldenCross',  l: 'GldCrs',   hc: 'var(--amber-text)', fmt: (v) => FMT.yesNo(v), color: COLORS.goldenCross },
    { k: 'supertrend',   l: 'STrend',   hc: 'var(--amber-text)', fmt: FMT.ratio },
    { k: 'bbPct',        l: 'BB%',      hc: 'var(--amber-text)', fmt: FMT.ratio },
    { k: 'macd',         l: 'MACD',     hc: 'var(--brand-text)', fmt: FMT.ratio },
    { k: 'macdBull',     l: 'MACDBull', hc: 'var(--brand-text)', fmt: (v) => v == null ? '—' : v ? 'Bull' : 'Bear', color: (v) => v == null ? 'var(--text4)' : v ? 'var(--green-text)' : 'var(--red-text)' },
    { k: 'stochK',       l: 'StochK',   hc: 'var(--brand-text)', fmt: FMT.num },
    { k: 'adx',          l: 'ADX',      hc: 'var(--brand-text)', fmt: FMT.num },
    { k: 'volRatio',     l: 'VolRat',   hc: 'var(--text)',       fmt: (v) => v == null ? '—' : `${Number(v).toFixed(2)}x`, color: COLORS.volRatio },
    { k: 'support',      l: 'Support',  hc: 'var(--green-text)', fmt: FMT.price },
    { k: 'resistance',   l: 'Resist',   hc: 'var(--red-text)',   fmt: FMT.price },
    { k: 'ichimokuSignal', l: 'Ichi',   hc: '#d4a017', fmt: (v) => {
        if (!v) return '—';
        return v === 'above_cloud' ? '☁️ Above' : v === 'below_cloud' ? '☁️ Below' : '☁️ Inside';
    }, color: (v) => v == null ? 'var(--text4)' : v === 'above_cloud' ? 'var(--green-text)' : v === 'below_cloud' ? 'var(--red-text)' : 'var(--amber-text)' },
    { k: 'ichimokuTenkan', l: 'Tenkan', hc: '#d4a017', fmt: FMT.dma, color: (v, s) => dmaColor(s.price, v) },
    { k: 'ichimokuKijun',  l: 'Kijun',  hc: '#d4a017', fmt: FMT.dma, color: (v, s) => dmaColor(s.price, v) },
  ],
  financials: [
    { k: 'mktCap',       l: 'MktCap Cr', hc: 'var(--text)',       fmt: FMT.crore },
    { k: 'eps',          l: 'EPS',       hc: 'var(--text)',       fmt: (v) => v == null ? '—' : Number(v).toFixed(2) },
    { k: 'bookValue',    l: 'BookVal',   hc: 'var(--text)',       fmt: (v) => v == null ? '—' : Number(v).toFixed(2) },
    { k: 'debt',         l: 'Debt Cr',   hc: 'var(--text)',       fmt: FMT.crore },
    { k: 'fcf',          l: 'FCF Cr',    hc: 'var(--green-text)', fmt: FMT.crore },
    { k: 'patQtr',       l: 'PAT Qtr',   hc: 'var(--green-text)', fmt: FMT.crore },
    { k: 'salesQtr',     l: 'Sales Qtr', hc: 'var(--green-text)', fmt: FMT.crore },
    { k: 'patAnnual',    l: 'PAT Ann',   hc: 'var(--brand-text)', fmt: FMT.crore },
    { k: 'salesAnnual',  l: 'Sales Ann', hc: 'var(--brand-text)', fmt: FMT.crore },
    { k: 'grossMgn',     l: 'GrsMgn%',   hc: 'var(--text3)',      fmt: FMT.pct },
    { k: 'profMgn',      l: 'PrfMgn%',   hc: 'var(--text3)',      fmt: FMT.pct },
  ],
  ownership: [
    { k: 'promoter',     l: 'Promoter%', hc: 'var(--amber-text)', fmt: FMT.pct },
    { k: 'promoterChg',  l: 'PromChg%',  hc: 'var(--amber-text)', fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'pledged',      l: 'Pledged%',  hc: 'var(--amber-text)', fmt: FMT.pct, color: COLORS.pledged },
    { k: 'fiiHolding',   l: 'FII%',      hc: 'var(--brand-text)', fmt: FMT.pct },
    { k: 'diiHolding',   l: 'DII%',      hc: 'var(--brand-text)', fmt: FMT.pct },
    { k: 'instHeld',     l: 'Inst%',     hc: 'var(--brand-text)', fmt: FMT.pct },
    { k: 'numShareholders', l: '#Holders', hc: 'var(--text)', fmt: (v) => v == null ? '—' : Number(v).toLocaleString() },
  ],
  signals: [
    { k: 'target',       l: 'Target',    hc: 'var(--green-text)', fmt: FMT.price },
    { k: 'stopLoss',     l: 'StopLoss',  hc: 'var(--red-text)',   fmt: FMT.price },
    { k: 'rewardPct',    l: 'Upside%',   hc: 'var(--green-text)', fmt: FMT.pct, color: COLORS.pctPos },
    { k: 'riskPct',      l: 'Risk%',     hc: 'var(--red-text)',   fmt: FMT.pct },
    { k: 'rrRatio',      l: 'R:R',       hc: 'var(--text)',       fmt: FMT.ratio },
    { k: 'isFallenAngel',l: 'Rebound',   hc: 'var(--amber-text)', fmt: (v) => v ? '🔥 Yes' : '—', color: (v) => v ? 'var(--amber-text)' : 'var(--text4)' },
    { k: 'fallenScore',  l: 'Reb Score', hc: 'var(--amber-text)', fmt: FMT.num0 },
    { k: 'rsiTrend',     l: 'RSI Trend', hc: 'var(--brand-text)', fmt: FMT.trend },
    { k: 'bullishDiv',   l: 'BullDiv',   hc: 'var(--green-text)', fmt: (v) => FMT.yesNo(v), color: (v) => v ? 'var(--green-text)' : 'var(--text4)' },
  ],
};

// Always-visible leading columns (shown before the per-tab specialized ones)
const CORE_COLS = [
  { k: 'sym',         l: 'Stock',       align: 'left',  sticky: true,  w: 120, color: 'var(--text)' },
  { k: 'grp',         l: 'Grp',         align: 'left',  sticky: false, w: 80 },
  { k: 'composite',   l: 'Mom Score',   align: 'right', sticky: false, w: 100, color: 'var(--green-text)', fmt: FMT.num },
  { k: 'fallenScore', l: 'Reb Score',   align: 'right', sticky: false, w: 100, color: 'var(--amber-text)', fmt: FMT.num },
  { k: 'scoreV2',     l: 'Inv Score',   align: 'right', sticky: false, w: 100, color: 'var(--brand-text)', fmt: FMT.num },
  { k: 'price',       l: 'Price',       align: 'right', sticky: false, w: 100, fmt: FMT.price },
];

const MARKET_CAP_FILTERS = ['ALL', 'NIFTY50', 'NEXT50', 'MIDCAP', 'SMALLCAP'];

// ══════════════════════════════════════════════════════════════════════
// Main component
// ══════════════════════════════════════════════════════════════════════
export default function StockData() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mcFilter, setMcFilter] = useState('ALL');
  const [subTab, setSubTab] = useState('overview');
  const [sortKey, setSortKey] = useState('scoreV2');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');

  const fetchStocks = () => {
    setLoading(true);
    apiGet('/api/stocks/score')
      .then((d) => { setStocks(d.stocks || d || []); setLoading(false); })
      .catch((e) => { setError(e.message || 'Failed'); setLoading(false); });
  };

  useEffect(() => { fetchStocks(); }, []);

  // Active columns = core + specialized for current sub-tab
  const activeCols = useMemo(() => [
    ...CORE_COLS,
    ...(TAB_COLS[subTab] || TAB_COLS.overview),
  ], [subTab]);

  const filtered = useMemo(() => {
    let list = stocks;
    if (mcFilter !== 'ALL') list = list.filter((s) => (s.grp || '').toUpperCase().includes(mcFilter));
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      list = list.filter((s) =>
        (s.sym || '').toUpperCase().includes(q)
        || (s.name || '').toUpperCase().includes(q)
        || (s.sector || '').toUpperCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const col = activeCols.find((c) => c.k === sortKey);
      const getVal = (x) => col?.derive ? col.derive(x) : x[sortKey];
      const av = getVal(a), bv = getVal(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [stocks, mcFilter, search, sortKey, sortDir, activeCols]);

  const handleSort = (k) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('desc'); }
  };

  const subTabColCounts = useMemo(() => {
    const out = {};
    for (const t of SUB_TABS) out[t.id] = (TAB_COLS[t.id] || []).length;
    return out;
  }, []);

  return (
    <div>
      {/* ═══ HERO ═══ */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(167,139,250,0.10) 100%)',
        border: '1px solid var(--border)', borderRadius: 18, padding: '28px 32px', marginBottom: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -50, right: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(99,102,241,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="label-xs" style={{ marginBottom: 8 }}>Full Universe · 9 specialized column views · Sortable · Searchable</div>
            <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1, color: 'var(--text)' }}>
              <span className="gradient-fill">Stock Data</span>
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={fetchStocks} className="btn btn-secondary" style={{ height: 36, fontSize: 12, padding: '0 14px' }}>
              ↻ Refresh
            </button>
            {stocks.length > 0 && (
              <div style={{ textAlign: 'right', marginLeft: 12 }}>
                <div className="tabular-nums gradient-fill" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, letterSpacing: '-1.5px' }}>{stocks.length}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, fontWeight: 500 }}>stocks</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ SEARCH + MARKET-CAP PILLS ═══ */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search stock symbol, name or sector…"
          style={{
            height: 40, padding: '0 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)',
            borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', flex: 1, minWidth: 240,
          }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {MARKET_CAP_FILTERS.map((f) => (
            <button key={f} onClick={() => setMcFilter(f)} style={{
              padding: '6px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 600,
              background: mcFilter === f ? 'var(--brand)' : 'rgba(255,255,255,0.04)',
              color: mcFilter === f ? '#fff' : 'var(--text2)',
              border: `1px solid ${mcFilter === f ? 'var(--brand)' : 'var(--border)'}`,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 180ms ease',
            }}>{f}</button>
          ))}
        </div>
      </div>

      {/* ═══ SUB-TAB BAR — 9 specialized column views ═══ */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {SUB_TABS.map((t) => {
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              style={{
                padding: '7px 14px',
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: active ? 700 : 600,
                background: active ? 'var(--brand)' : 'rgba(255,255,255,0.04)',
                color: active ? '#fff' : 'var(--text2)',
                border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 180ms ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              <span style={{
                fontSize: 9,
                opacity: active ? 0.8 : 0.55,
                fontWeight: 600,
                background: active ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.05)',
                padding: '1px 6px',
                borderRadius: 6,
              }}>
                {subTabColCounts[t.id]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ═══ COUNT STRIP ═══ */}
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
        Showing <b style={{ color: 'var(--text)' }}>{filtered.length}</b> of {stocks.length} stocks
        {search && <> · matching "<b style={{ color: 'var(--text)' }}>{search}</b>"</>}
        {mcFilter !== 'ALL' && <> · <b style={{ color: 'var(--brand-text)' }}>{mcFilter}</b></>}
        {' '}· sorted by <b style={{ color: 'var(--brand-text)' }}>{sortKey}</b> ({sortDir})
      </div>

      {/* ═══ TABLE ═══ */}
      {loading ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>
          <div className="animate-pulse-custom" style={{ fontSize: 14 }}>Loading stock data…</div>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: 24, color: 'var(--red-text)' }}>Failed to load: {error}</div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', maxHeight: 650 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 40, textAlign: 'center' }}>#</th>
                  {activeCols.map((c) => (
                    <th
                      key={c.k}
                      onClick={() => handleSort(c.k)}
                      style={{
                        ...thStyle,
                        width: c.w || 80,
                        textAlign: c.align === 'left' ? 'left' : 'right',
                        color: sortKey === c.k ? 'var(--brand-text)' : c.hc || 'var(--text3)',
                        cursor: 'pointer',
                        ...(c.sticky ? { position: 'sticky', left: 40, zIndex: 6, background: 'linear-gradient(145deg, rgba(30,30,44,0.98), rgba(18,18,28,0.98))' } : {}),
                      }}
                    >
                      {c.l}
                      <span style={{ marginLeft: 4, fontSize: 10, opacity: sortKey === c.k ? 1 : 0.35 }}>
                        {sortKey === c.k ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((s, i) => (
                  <tr
                    key={s.sym}
                    style={{ transition: 'background 150ms ease' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...tdStyle, color: 'var(--text3)', textAlign: 'center' }}>{i + 1}</td>
                    {activeCols.map((c) => {
                      const raw = c.derive ? c.derive(s) : s[c.k];
                      const val = c.fmt ? c.fmt(raw, s) : raw != null ? String(raw) : '—';
                      const color = typeof c.color === 'function' ? c.color(raw, s) : c.color;
                      return (
                        <td
                          key={c.k}
                          className={c.align !== 'left' ? 'tabular-nums' : ''}
                          style={{
                            ...tdStyle,
                            textAlign: c.align === 'left' ? 'left' : 'right',
                            fontWeight: c.k === 'sym' ? 700 : 500,
                            color: color || (c.k === 'sym' ? 'var(--text)' : 'var(--text2)'),
                            ...(c.sticky ? { position: 'sticky', left: 40, background: 'rgba(12,14,20,0.95)', zIndex: 4 } : {}),
                          }}
                        >
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 100 && (
            <div style={{ padding: 14, textAlign: 'center', fontSize: 12, color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
              Showing first 100 of {filtered.length} — refine search or filter to narrow
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: '10px 12px',
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--border)',
  position: 'sticky',
  top: 0,
  background: 'linear-gradient(145deg, rgba(30,30,44,0.98), rgba(18,18,28,0.98))',
  zIndex: 5,
  whiteSpace: 'nowrap',
  userSelect: 'none',
};

const tdStyle = {
  padding: '9px 12px',
  borderBottom: '1px solid var(--border)',
  fontSize: 12,
  whiteSpace: 'nowrap',
};
