import React, { useState, useMemo } from 'react';

// ══════════════════════════════════════════════════════════════════════
// Architecture — in-app documentation page
// Load-bearing per feedback_architecture_docs.md: any tab/score/column
// change must update this tab in the SAME commit.
// Ground truth: /PICKS_ARCHITECTURE.md (16 sections, current as of
// 2026-04-17, commit 690c904 on `balaji`).
// ══════════════════════════════════════════════════════════════════════

// Section IDs — used for the sticky nav on the left rail
const SECTIONS = [
  { id: 'overview',      label: 'Overview',          icon: '🏛' },
  { id: 'tabs',          label: 'Tab Map',           icon: '🗂' },
  { id: 'scoring',       label: 'Scoring Systems',   icon: '🎯' },
  { id: 'riskflags',     label: 'Risk Flags',        icon: '⚠' },
  { id: 'disqualifiers', label: 'Disqualifiers',     icon: '🚫' },
  { id: 'sectorcap',     label: 'Sector Cap',        icon: '📊' },
  { id: 'external',      label: 'External Signals',  icon: '📡' },
  { id: 'llm',           label: 'LLM Classifier',    icon: '🤖' },
  { id: 'kite',          label: 'Kite Integration',  icon: '🔌' },
  { id: 'mirofish',      label: 'MiroFish AI',       icon: '🐟' },
  { id: 'cron',          label: 'Cron Schedule',     icon: '⏰' },
  { id: 'data',          label: 'Data Sources',      icon: '🗃' },
  { id: 'db',            label: 'Database',          icon: '💾' },
  { id: 'invariants',    label: 'Invariants',        icon: '🛡' },
  { id: 'roadmap',       label: 'Build-Best Roadmap', icon: '🗺' },
  { id: 'stack',         label: 'Stack & Deploy',    icon: '🚀' },
];

// ─────────────────────────────────────────────────────────────
// Reusable building blocks
// ─────────────────────────────────────────────────────────────
function SectionCard({ id, icon, title, subtitle, accent, children }) {
  return (
    <section id={id} className="card animate-fadeIn" style={{
      padding: '26px 28px', marginBottom: 20, scrollMarginTop: 80,
      borderLeft: `3px solid ${accent || 'var(--border2)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: subtitle ? 6 : 18 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, background: 'var(--gradient-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          border: '1px solid var(--border)', flexShrink: 0,
        }}>{icon}</div>
        <h2 style={{
          fontSize: 20, fontWeight: 800, color: 'var(--text)',
          letterSpacing: '-0.4px', margin: 0,
        }}>{title}</h2>
      </div>
      {subtitle && (
        <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.55, margin: '0 0 18px 50px' }}>{subtitle}</p>
      )}
      {children}
    </section>
  );
}

function Chip({ children, color = 'var(--text2)', bg = 'var(--bg3)', border = 'var(--border)' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.2px',
      padding: '3px 9px', borderRadius: 999,
      background: bg, color, border: `1px solid ${border}`,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

function Code({ children }) {
  return (
    <code style={{
      background: 'var(--bg3)', padding: '1px 6px', borderRadius: 5,
      fontSize: 12, color: 'var(--brand-text)', fontFamily: 'ui-monospace, SFMono-Regular, monospace',
    }}>{children}</code>
  );
}

function Pill({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '10px 12px', minWidth: 0,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
    </div>
  );
}

function Table({ headers, rows, colWidths }) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg2)' }}>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg3)' }}>
            {headers.map((h, i) => (
              <th key={i} style={{
                textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 700,
                color: 'var(--text3)', letterSpacing: '0.4px', textTransform: 'uppercase',
                borderBottom: '1px solid var(--border)',
                width: colWidths?.[i],
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: ri === rows.length - 1 ? 'none' : '1px solid var(--border)' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '10px 12px', color: ci === 0 ? 'var(--text)' : 'var(--text2)', fontWeight: ci === 0 ? 600 : 400, verticalAlign: 'top', lineHeight: 1.55 }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PillarBar({ label, value, total, color }) {
  const pct = Math.round((value / total) * 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{value} pts</span>
      </div>
      <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

function Grid({ cols = 2, gap = 12, children }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(${cols === 1 ? '100%' : cols === 2 ? '280px' : '220px'}, 1fr))`,
      gap,
    }}>{children}</div>
  );
}

function FlagRow({ code, severity, penalty, label, triggers }) {
  const sevColor = severity === 'HIGH' ? 'var(--red-text)'
                 : severity === 'MEDIUM' ? 'var(--amber-text)' : '#fbbf24';
  const sevBg = severity === 'HIGH' ? 'var(--red-bg)'
              : severity === 'MEDIUM' ? 'var(--amber-bg)' : 'rgba(251,191,36,0.08)';
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '12px 14px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <Code>{code}</Code>
        <Chip color={sevColor} bg={sevBg} border={sevColor}>{severity}</Chip>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--red-text)' }}>−{penalty}</span>
        <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>{label}</span>
      </div>
      {triggers && <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.55 }}>{triggers}</div>}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Content data — kept at module level so re-renders are cheap
// ═════════════════════════════════════════════════════════════════════

const TAB_MAP = [
  ['Stock Picks',   'Three columns — Rebound / Momentum / Long-Term. Market-cap filter + client-side sector cap + risk-flag badges per card. "AI Buy Plan" panel takes top-10 of each bucket (30 stocks), sends to Claude (Opus 4.7 via OpenRouter when OPENROUTER_API_KEY is set, else direct Anthropic API) for single-model review, drops weak setups, and ranks ONLY the approved ones with entry zone · target · stop · horizon · risk-reward · sell-if triggers — stops sized from daily σ + anchored to real S/R / DMAs / pivots. Retries once on parse failure. Admin-only trigger; persisted per-user in picks_ai_buy_plan and publicly readable so non-admin viewers see the latest ranked plan.', 'var(--brand-text)'],
  ['Day Trade',     '5-min intraday setups. Separate cache + scoring engine via Unified Pipeline.', '#ef4444'],
  ['Stocks RoboTrade', 'Paper + live execution engine. Pass 1.5 Structure Filter + LLM sub-tab.', 'var(--green-text)'],
  ['Crypto RoboTrade', '24×7 crypto scanner + trade execution.', '#f59e0b'],
  ['MF Picks',      'Small / Mid / Flexi Cap. AI panel + top 5 cards. Council ranks top-3 with why_choose/why_not.', '#C4B5FD'],
  ['Holdings',      'Personal portfolio · Live P&L · Holdings AI reviews.', 'var(--green-text)'],
  ['Deep Analyzer', 'Single-stock deep dive via /api/stocks/analyze/:sym/ai.', 'var(--brand-text)'],
  ['Stock Data',    'Full universe table — every stock carries 3 scores.', 'var(--text2)'],
  ['MiroFish Lab',  'Wealth projection — ₹1 Lakh → 7Y/10Y/20Y/30Y/40Y per MF.', '#C4B5FD'],
  ['Admin',         'Pipeline controls, force-refresh buttons, LLM budget, users, logs.', 'var(--amber-text)'],
  ['Architecture',  'This page — load-bearing docs kept current with every code change.', '#f0abfc'],
];

const V2_PILLARS = [
  ['Quality',    40, 'ROE (current + 3Y + 5Y avg), ROCE, ROIC, operating margin, DuPont, Piotroski, Altman Z'],
  ['Growth',     25, 'Revenue 1Y + 5Y CAGR, EPS 1Y + 5Y CAGR. Spike penalty if 1Y >> 5Y (boom/bust)'],
  ['Valuation',  20, 'P/E, P/B, PEG vs sector peers. Penalty if P/E > 1.5× sector (Varsity M13)'],
  ['Business',   15, 'Promoter %, pledged %, FII/DII, dividend consistency, sector-template fit'],
];

const COMPOSITE_FACTORS = [
  ['FA',   35, 'Fundamental quality — same inputs as scoreOneStock (Varsity M3)'],
  ['Val',  15, 'Percentile vs sector peers on P/E, P/B, PEG, EV/EBITDA'],
  ['TA',   20, 'Bullish tech (EMA cross, Ichimoku, Supertrend, RSI 30-70, ADX>20, MACD bull)'],
  ['Mom',  15, 'Price returns 1M/3M/6M/1Y weighted. Recent > distant.'],
  ['Risk', 15, 'Inverse of annual vol, beta, D/E. Higher = safer.'],
];

const FALLEN_PILLARS = [
  ['Quality',           40, 'ROE, ROCE, D/E, margins — can it survive the drawdown?'],
  ['Depth of Fall',     15, 'pctFromHigh — deeper = more mean-reversion opportunity (up to a floor)'],
  ['Oversold',          20, 'RSI-14, stochastic K, supertrend — momentum washed out'],
  ['Valuation',         12, 'P/E vs sector, P/B, PEG — is the pullback an actual discount'],
  ['Recovery Signals',  13, 'RSI bull-div, OBV rising, vol climax, MACD bull, near 200DMA, supertrend flip'],
];

const RISK_FLAGS = [
  {
    code: 'EARNINGS_CLIFF', severity: 'HIGH', penalty: 15,
    label: 'Earnings Cliff — 5Y growth but latest quarter collapsing',
    triggers: 'patQtrYoy ≤ −20 AND epsGr5y ≥ 10 · Natco Revlimid cliff, Cipla US-generics pressure',
  },
  {
    code: 'EARNINGS_DROP_SEVERE', severity: 'HIGH', penalty: 12,
    label: 'PAT Drop Severe', triggers: 'patQtrYoy ≤ −30 (even without 5Y context)',
  },
  {
    code: 'PRICE_PAT_DIVERGENCE_BEARISH', severity: 'HIGH', penalty: 12,
    label: 'Price/PAT Divergence — rally without earnings support',
    triggers: 'price1y > 40% AND epsGr1y < 0 · ADANIPOWER / FORCEMOT blow-off tops',
  },
  {
    code: 'LOCKIN_IMMINENT', severity: 'HIGH', penalty: 12,
    label: 'IPO Lock-in Imminent',
    triggers: 'Promoter/non-promoter unlock within ±1 to +7 days · e.g. HYUNDAI 18m unlock 2026-04-20 (₹62,000cr)',
  },
  {
    code: 'DRAWDOWN_STILL_FALLING', severity: 'HIGH', penalty: 12,
    label: 'Falling Knife — still in downtrend',
    triggers: 'pctFromHigh ≤ −20 AND change3m ≤ −10 · Dow Theory Phase 1-2, not capitulation',
  },
  {
    code: 'REBOUND_NO_CONFIRMATION', severity: 'HIGH', penalty: 10,
    label: 'No Bottom Signal — deep drop, zero recovery signals',
    triggers: 'pctFromHigh ≤ −25 AND no (bullDiv / OBV / accum / MACD bull / supertrend flip / near 200DMA / weekly up)',
  },
  {
    code: 'EARNINGS_QUALITY_DIVERGENT', severity: 'HIGH', penalty: 10,
    label: 'FCF Weak vs PAT — accrual red flag',
    triggers: 'epsGr1y ≥ 20 AND fcfGr1y ≤ 0 · Varsity M3 Ch10: cash flow > earnings',
  },
  {
    code: 'CYCLICAL_PEAK_PROFITABILITY', severity: 'HIGH', penalty: 10,
    label: 'Cyclical Peak — metals/cement/chem/auto at margin peak',
    triggers: 'max(ROE ratio, margin ratio vs 5Y avg) ≥ 1.75× · Varsity M3 Ch8',
  },
  {
    code: 'ANALYST_SELL', severity: 'HIGH', penalty: 10,
    label: 'Broker Consensus SELL/REDUCE',
    triggers: 'Screener.in consensus rating = SELL or REDUCE',
  },
  {
    code: 'NEWS_DISQUALIFY', severity: 'HIGH', penalty: 20,
    label: 'AI: Severe News — triggers auto-exclusion',
    triggers: 'LLM classifier flags should_disqualify=true (fraud, regulatory action, merger)',
  },
  {
    code: 'NEWS_NEGATIVE_HIGH', severity: 'HIGH', penalty: 18,
    label: 'AI: High-Severity Negative News',
    triggers: 'Haiku 4.5 classifier returns HIGH · demote_score scaled 10-18',
  },
  {
    code: 'BSE_EVENT_IMMINENT', severity: 'HIGH', penalty: 8,
    label: 'BSE Board Meeting / Earnings within 3 days',
    triggers: 'Corp action JSON shows results/earnings/AGM/board-meeting in ≤3d',
  },
  {
    code: 'EARNINGS_DECELERATING', severity: 'MEDIUM', penalty: 7,
    label: 'Earnings turning down', triggers: 'patQtrYoy < 0 AND epsGr1y > 5',
  },
  {
    code: 'PRICE_EARNINGS_EXTENDED', severity: 'MEDIUM', penalty: 6,
    label: 'Price Extended vs Fundamentals', triggers: 'price1y > 50% AND epsGr1y < 10',
  },
  {
    code: 'MOMENTUM_CYCLICAL_PEAK', severity: 'MEDIUM', penalty: 5,
    label: 'Momentum Cyclical Peak', triggers: 'price1y > 100%',
  },
  {
    code: 'CYCLICAL_ELEVATED_MARGINS', severity: 'MEDIUM', penalty: 6,
    label: 'Late-Cycle Elevated Margins', triggers: 'Cyclical sector, ratio ≥ 1.5× vs 5Y avg',
  },
  {
    code: 'DRAWDOWN_IMMATURE', severity: 'MEDIUM', penalty: 5,
    label: 'Drawdown not bottomed yet', triggers: 'pctFromHigh ≤ −20 AND change3m < 0',
  },
  {
    code: 'SECTOR_LAGGARD', severity: 'MEDIUM', penalty: 6,
    label: 'Underperforming Sector',
    triggers: 'change52w ≥ 20 AND (stock_return − sector_median) ≤ −10',
  },
  {
    code: 'EARNINGS_QUALITY_WEAK', severity: 'MEDIUM', penalty: 5,
    label: 'FCF Lagging PAT', triggers: 'epsGr1y ≥ 15 AND 0 < fcfGr1y < 5',
  },
  {
    code: 'BSE_EVENT_SOON', severity: 'MEDIUM', penalty: 4,
    label: 'BSE Event in 4-7 days', triggers: 'Corp action scheduled in 4-7d',
  },
  {
    code: 'NEWS_NEGATIVE_MEDIUM', severity: 'MEDIUM', penalty: 10,
    label: 'AI: Moderate Negative News',
    triggers: 'Haiku classifier returns MEDIUM (operational / legal / governance)',
  },
  {
    code: 'ANALYST_TP_BELOW', severity: 'MEDIUM', penalty: 6,
    label: 'Target Price Below Spot', triggers: 'impliedReturn ≤ −15%',
  },
  {
    code: 'MOMENTUM_CONSENSUS_CONFLICT', severity: 'MEDIUM', penalty: 5,
    label: 'High Score, TP Below Spot',
    triggers: 'max(composite, scoreV2, fallenScore) ≥ 70 AND impliedReturn < 0 AND |.| ≥ 5%',
  },
  {
    code: 'EARNINGS_SLOWING', severity: 'LOW', penalty: 3,
    label: 'Earnings slowing vs 5Y history', triggers: 'patQtrYoy < 5% AND epsGr5y ≥ 15',
  },
  {
    code: 'DRAWDOWN_ACCELERATING', severity: 'LOW', penalty: 3,
    label: 'Fall Deepening', triggers: 'pctFromHigh ≤ −25 AND change1m < −5',
  },
  {
    code: 'SECTOR_UNDERPERFORMER', severity: 'LOW', penalty: 3,
    label: 'Sector Underperformer (weak)', triggers: 'change52w ≥ 10 AND rs ≤ −15',
  },
  {
    code: 'LOCKIN_RECENT', severity: 'LOW', penalty: 5,
    label: 'Lock-in Recent — still digesting supply', triggers: 'Unlock event 2-21 days ago',
  },
  {
    code: 'LOCKIN_UPCOMING', severity: 'LOW', penalty: 2,
    label: 'Lock-in Upcoming', triggers: 'Unlock event 7-30 days away',
  },
  {
    code: 'ANALYST_CAUTIOUS', severity: 'LOW', penalty: 2,
    label: 'Analysts Cautious', triggers: 'Rating HOLD AND impliedReturn < 0',
  },
  {
    code: 'MOMENTUM_CONSENSUS_CAUTIOUS', severity: 'LOW', penalty: 2,
    label: 'Weak Consensus', triggers: '0 < |impliedReturn| < 5 AND high score',
  },
];

const DISQUALIFIERS = [
  ['CORPORATE_ACTION',  'Merger/amalgamation announcement (ACC → Ambuja). Dynamic + hardcoded.', '#f0abfc'],
  ['PLEDGE_EXTREME',    'pledged ≥ 75% — margin-call cascade risk.', 'var(--red-text)'],
  ['LEVERAGE_EXTREME',  'debtToEq ≥ 5 on non-financials (banks/NBFC/insurance exempt).', 'var(--red-text)'],
  ['AUDITOR_FLAG',      'auditorResigned OR auditorQualified — governance breakdown.', 'var(--red-text)'],
  ['REGULATORY_ACTION', 'sebiAction OR regulatoryBan.', 'var(--red-text)'],
  ['PERSISTENT_LOSSES', 'operatingMargin ≤ −5 AND 5Y-avg ≤ 0 — structural, not turnaround.', 'var(--amber-text)'],
  ['INSUFFICIENT_DATA', 'dataCompleteness < 0.30 — cannot score confidently.', 'var(--text3)'],
];

const SECTORS = [
  ['FMCG',               'Fast Moving Consumer Goods, Consumer Staples, Packaged Foods'],
  ['Auto',               'Automobile, Auto Components, Tyres'],
  ['IT',                 'Information Technology, Software, Tech Services'],
  ['Pharma',             'Pharmaceuticals (kept separate from Healthcare)'],
  ['Healthcare',         'Hospitals, Diagnostics'],
  ['Banking',            'Private Bank, Public Sector Bank'],
  ['Financial Services', 'NBFC, Financials'],
  ['Metals',             'Metals & Mining, Aluminium, Steel, Iron Ore, Ferrous'],
  ['Oil & Gas',          'Petroleum, Refineries, Natural Gas'],
  ['Power',              'Electricity, Utilities, Power Generation'],
  ['Cement',             'Building Products'],
  ['Chemicals',          'Specialty Chemicals, Commodity Chemicals, Fertilizers'],
  ['Capital Goods',      'Industrials, Electrical Equipment, Construction'],
  ['Consumer Services',  'Retail, Travel, Leisure, Education, Hotels'],
  ['Infrastructure',     'Ports, Airports, Logistics, Shipping, Railways'],
  ['Realty',             'Real Estate'],
  ['Insurance',          'Insurance, Reinsurance'],
];

const DATA_SOURCES = [
  ['Kite Connect',     'Live quotes, historical candles, WebSocket ticks, account equity', '3 req/sec (420ms spaced)'],
  ['Screener.in',      'Fundamentals (~70 fields), analyst consensus', 'Premium session, daily'],
  ['BSE Public API',   'Corporate actions — board meetings, dividends, AGMs, splits', 'Hourly'],
  ['Google News RSS',  'Headlines via dual-query (company + ticker)', 'Every 30 min'],
  ['Yahoo Finance',    'Nifty 50 benchmark for relative-strength', 'On boot'],
  ['OpenRouter',       'Multi-model LLM gateway (Haiku 4.5, Council models, Judge)', 'Per-call'],
  ['Tickertape CSV',   'Mutual fund dataset', 'Uploaded snapshots'],
  ['NSE Index CSVs',   'Nifty 50 / Next 50 / Midcap / Smallcap universe lists', 'Daily 8 AM IST'],
];

const CRON_MARKET = [
  ['*/5 9-15 * * 1-5',    'Unified Kite Pipeline', 'Daily + 5-min candles per symbol. Populates stockFundamentals, _fiveMinCandlesCache, _dayTradeCache. Runs DayTrade scoring.'],
  ['*/3.75 9-15 * * 1-5', 'Smart Scan (RoboTrade)', 'Reads 5-min candles from Unified cache (50% Kite call reduction). Exit mgmt + buy collection.'],
  ['*/30 8-16 * * 1-5',   'Fundamentals refresh',   'refreshMissingFundamentals + refreshAllFundamentals'],
  ['*/30 8-16 * * 1-5',   'News cron',              'Google News RSS → Haiku classifier → external_signals_cache'],
  ['5 8-16 * * 1-5',      'BSE corp actions',       'Hourly at :05 — api.bseindia.com JSON per symbol'],
  ['7,22,37,52 8-16',     'Stale healthcheck',      'Every 15 min — refetch top 30 stalest (fetchedAt > 90 min)'],
  ['45 15 * * 1-5',       'EOD snapshot',           'savePortfolioSnapshot at 3:45 PM IST after market close'],
];

const CRON_DAILY = [
  ['30 6 * * 1-5',  'Morning boot',           'Pre-market warmup'],
  ['0 8 * * *',     'Universe refresh',       'NSE index CSVs → stock_universe table'],
  ['0 9 * * 1-5',   'Instrument tokens',      'Kite symbol → token map'],
  ['30 19 * * 1-5', 'Analyst consensus',      'Screener.in full-universe scrape (daily is enough)'],
  ['0 22 * * *',    'Daily market context',   'Nifty + regime snapshot'],
  ['30 22 * * *',   'MF cache persist',       'Tickertape score cache → DB'],
  ['0 23 * * *',    'DB cleanup',             'Archival + pruning'],
];

const CRON_ALWAYS = [
  ['*/5 * * * *',   'Outcome engine',         'MFE/MAE + forward returns for features_snapshot rows older than 31 min'],
  ['*/15 * * * *',  'Crypto scan',            '24×7 crypto scanner'],
  ['setInterval 60s', 'Crypto price poll',    'Crypto ticker polling'],
];

const DB_TABLES = [
  ['Core data', [
    ['stock_universe',        'NSE universe + cap group'],
    ['stock_instruments',     'Kite instrument tokens'],
    ['screener_fundamentals', 'Scraped Screener data (~70 fields)'],
    ['stock_scores',          'Periodic score snapshots'],
    ['stock_score_snapshots', 'Detailed V2 breakdown per scan'],
    ['candles_1m / candles_5m', 'OHLCV + VWAP for ML ground truth'],
    ['daily_market_context',  'Nifty + regime snapshots'],
  ]],
  ['Picks pipeline', [
    ['external_signals_cache',    'BSE + news + analyst JSONB'],
    ['news_classification_cache', 'LLM verdicts by headline hash'],
    ['llm_budget_daily',          'Daily LLM spend tracking'],
    ['picks_ai_reviews',          'Deep AI Review council verdicts (per-category council + judge)'],
    ['picks_ai_buy_plan',         'AI Buy Plan runs: ranked LLM picks + exit plans (entry/target/stop/sell-if) from top-30 candidates'],
    ['features_snapshot',         '~100-column ML feature row per scan'],
    ['outcome_metrics',           'Forward MFE/MAE metrics'],
    ['writer_dead_letter',        'DLQ for failed DB writes'],
  ]],
  ['Trading', [
    ['paper_trades',       'Simulated trades'],
    ['live_trades',        'Live Kite orders'],
    ['rejected_candidates','Pass-1.5 rejections + forward tracking'],
    ['portfolio_positions','User holdings'],
    ['portfolio_signals',  'Buy/sell/rebalance'],
    ['portfolio_snapshots','EOD snapshots'],
    ['crypto_trades',      'Crypto trades'],
  ]],
  ['AI', [
    ['ai_stock_reviews',     'Deep Stock Analyzer outputs'],
    ['ai_disagree_log',      'Judge vs council divergence'],
    ['fallen_angel_ai_cache','Rebound AI verdict cache'],
    ['holdings_ai_reviews',  'Holdings-specific AI reviews'],
    ['mf_ai_reviews / mf_ai_rankings', 'MF per-fund + ordered ranking'],
  ]],
];

const ADMIN_ENDPOINTS = [
  ['POST', '/api/admin/refresh-external-signals', 'Force-refresh BSE + news + analyst · not market-gated'],
  ['POST', '/api/admin/stale-healthcheck',        'Force-run stale-data healthcheck · bypasses market hours'],
  ['GET',  '/api/admin/debug-stock/:sym',         'Full pipeline state for one stock'],
  ['GET',  '/api/admin/llm-budget',               'LLM classifier budget status'],
  ['POST', '/api/admin/force-run-pipeline',       'Force Unified Kite Pipeline · force=true'],
  ['POST', '/api/picks/ai-review?category=…',     'Trigger Deep AI Review (council + judge) — ADMIN-ONLY; GET of same path is public'],
  ['POST', '/api/ai-picks/run',                   'Trigger AI Buy Plan (single-model Opus 4.7) — ADMIN-ONLY; GET /latest + /history are public'],
];

// ═════════════════════════════════════════════════════════════════════
// Build-Best Roadmap — the approved 8-phase plan (Phase 0 → Phase 8).
// Keep in sync with the commit log. Phase 0 shipped 2026-04-18 (cb229ec);
// subsequent phases execute in order, gated by evidence from Phase 0's
// tracker data — don't commit Phase N+1 until Phase N's hit-rate shows
// the spend is earning its keep.
// ═════════════════════════════════════════════════════════════════════
const ROADMAP_PHASES = [
  {
    id: 0,
    title: 'AI Buy Plan (single-model LLM curation)',
    status: 'shipped',
    when: 'Week 1 · shipped 2026-04-18 (balaji) · superseded Phase 0 paper-tracker',
    cost: '~₹5-8/run (Opus 4.7 via OpenRouter default; falls back to Anthropic direct · 16k max output · one retry on parse failure)',
    goal: 'Single-model Claude review of the merged top-30 (10 per bucket) that drops weak setups and ranks ONLY the keepers with full exit plans: entry zone · target · stop · horizon · risk-reward · sell-if triggers.',
    includes: [
      'picks_ai_buy_plan — persisted per-user LLM plan history (top30_input + ranked plan + skipped)',
      'POST /api/ai-picks/run — ADMIN-ONLY manual trigger; body carries top-10 per bucket + market meta',
      'GET /api/ai-picks/latest — PUBLIC-readable cached plan; defaults to most recent run with picks_count>0 so a fresh rejection run does not blank the buy plan (strict=1 forces absolute latest). Attaches latest_attempt when latest approved plan is older than most recent run.',
      'AIReviewPanel UI — ranked cards with rank/sym/bucket/confidence/rationale, expandable exit plan, collapsible rejected list',
      'Strict JSON normalisation (stop < entryLo ≤ entryHi < target; auto re-rank; auto-skip unknowns)',
      'Filter-then-rank flow: AI approves genuine picks first, THEN ranks only the approved ones (no artificial cap)',
    ],
    why: 'Real-money reliability matters more than evidence collection. Paper-tracking (picks_history/outcomes/journal) churned data without producing actionable signal — the AI Buy Plan tells you what to buy and when to sell, right now.',
  },
  {
    id: 1,
    title: 'Point-in-Time Fundamentals Data',
    status: 'next',
    when: 'Week 2',
    cost: '₹4,000–12,000/mo ($50–150/mo)',
    goal: 'Replace the current Screener snapshot (lookahead-contaminated) with a PIT fundamentals feed so we can walk-forward backtest any past date.',
    includes: [
      'Subscribe to Trendlyne Pro, Tijori, or Tikr (or OFB PIT-FA via NSE EOD)',
      'Walk-forward harness: replay the full pipeline on any historical date',
      'Backfill pick history back 1-2 years for immediate backtest evidence',
      'Drop from a 90-day wait to a same-week verdict on every tweak',
    ],
    why: 'Highest-leverage spend in the whole plan — turns Phase 0\'s 90-day evidence wait into a hours-long backtest loop.',
  },
  {
    id: 2,
    title: 'Daily LLM Judge',
    status: 'pending',
    when: 'Week 2',
    cost: '₹500–2,500/mo ($5–30/mo)',
    goal: 'Claude Sonnet pass after the rule-based scan. Top-30 per bucket in, top-10 per bucket out, with structured reasoning citing specific flags.',
    includes: [
      'Hard constraint: can only REJECT — never promote a disqualified stock',
      'Structured output (verdict + cited flags + 1-line reason)',
      'Kill-switch gated by Phase 0 hit-rate (auto-disable if underperforming)',
      'Per-bucket prompt tuned to Rebound / Momentum / LongTerm theses',
    ],
    why: 'Tier-1 judgment layer, but evidence-guarded — if the LLM isn\'t beating the rule engine on tracker data, we switch it off.',
  },
  {
    id: 3,
    title: 'Professional Signal Feeds',
    status: 'pending',
    when: 'Week 3–4',
    cost: '₹8,000–16,000/mo ($100–200/mo)',
    goal: 'Where retail screens stop and pro screens start. The information edge that separates smart money from the herd.',
    includes: [
      'FII/DII per-stock flows (NSE paid endpoint or Sensibull)',
      'Bulk / block deals feed with counterparty names',
      'Insider filings (SEBI PIT disclosure stream)',
      'Corporate-action calendar (splits, bonuses, AGM, ex-dates)',
      'Derivatives OI + PCR + max-pain per symbol',
    ],
    why: 'These are the signals that inform actual institutional positioning — ex-ante instead of ex-post.',
  },
  {
    id: 4,
    title: 'Deep Thesis per Top Pick',
    status: 'pending',
    when: 'Week 4–5',
    cost: '₹4,000–8,000/mo ($50–100/mo)',
    goal: 'For the top-3 per bucket (9 stocks/day) Claude reads last 4 earnings-call transcripts + 90 days of news + annual-report MD&A, and writes a 250-word thesis.',
    includes: [
      'Earnings-call transcript ingest (AlphaStreet / Screener)',
      'Annual report MD&A + notes-to-accounts NLP extraction',
      'Explicit thesis-breakers list (what would invalidate the pick)',
      '1-5 confidence score with calibration feedback loop',
      'Thesis rendered as expandable deep-dive under each top pick',
    ],
    why: 'Moves from "this stock has good numbers" to "here\'s the specific causal story and here\'s what kills it" — the kind of research that actually compounds.',
  },
  {
    id: 5,
    title: 'ML Refinement Layer',
    status: 'pending',
    when: 'Week 5–8',
    cost: '₹0 (local compute)',
    goal: 'Enabled by Phase 1 PIT data — a learned layer on top of the rule-based stack, not replacing it.',
    includes: [
      'Forward-return regression using PIT features (learned scoreV2)',
      'Cash-flow anomaly detector (Benford-ish + working-capital divergence)',
      'Regime classifier replacing the simple VIX tilt (4-6 states)',
      'Stack order: disqualifiers (hard gate) → scoreV2 (quality floor) → ML (refine) → LLM (final rerank)',
    ],
    why: 'ML earns its place only after everything above it has been evidence-validated. Order matters: rules first, ML last.',
  },
  {
    id: 6,
    title: 'Portfolio-Aware Picks',
    status: 'pending',
    when: 'Week 8+',
    cost: '₹0',
    goal: 'The step that turns a "picks list" into a "personal portfolio plan."',
    includes: [
      'Pull Kite holdings · cross-check every pick against current book',
      'De-prioritize picks correlated with existing overweights',
      'Prefer picks that improve portfolio Sharpe / diversify sectors',
      'Cash-aware position sizing (uses live funds + margin snapshot)',
    ],
    why: 'Generic picks are a commodity. Picks tuned to your current holdings and cash are the difference between a screener and an assistant.',
  },
  {
    id: 7,
    title: 'Risk Layer',
    status: 'pending',
    when: 'Week 9+',
    cost: '₹0',
    goal: 'Per-pick entry plan + aggregate portfolio risk monitoring.',
    includes: [
      'ATR-based stop-loss suggestion per pick',
      'Position size auto-calculated at 1–2% portfolio risk',
      'Expected holding period + trim/add levels',
      'Portfolio heat map · rolling max-drawdown alert',
      'Sector concentration cap across entire book (not just picks tab)',
    ],
    why: 'A pick without a stop and size is a meme. The risk layer is what makes a pick actionable.',
  },
  {
    id: 8,
    title: 'Self-Tuning Loop',
    status: 'pending',
    when: 'Ongoing',
    cost: '₹0',
    goal: 'Weekly cron reads Phase 0 outcomes and proposes penalty / threshold adjustments with significance scores.',
    includes: [
      'Per-flag outcome delta — flags that no longer predict alpha get demoted',
      'Per-bucket score-band recalibration',
      'Proposed tuning diffs rendered in an approve/reject UI',
      '6-month target: pipeline self-tunes to what actually works for your universe',
    ],
    why: 'Every retail setup is different. Over 6 months of outcomes, the system earns its own thresholds instead of inheriting somebody else\'s.',
  },
];

const ROADMAP_STATUS_STYLE = {
  shipped: { label: 'SHIPPED',  fg: 'var(--green-text)', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.4)' },
  next:    { label: 'NEXT UP',  fg: 'var(--brand-text)', bg: 'var(--brand-bg)',      border: 'rgba(99,102,241,0.4)' },
  pending: { label: 'PENDING',  fg: 'var(--text3)',      bg: 'rgba(255,255,255,0.04)', border: 'var(--border)' },
};

// ═════════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════════
export default function Architecture() {
  const [active, setActive] = useState('overview');

  const scrollTo = (id) => {
    setActive(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Sum penalties + flag counts for quick-facts pill row
  const flagStats = useMemo(() => {
    const high = RISK_FLAGS.filter(f => f.severity === 'HIGH').length;
    const med  = RISK_FLAGS.filter(f => f.severity === 'MEDIUM').length;
    const low  = RISK_FLAGS.filter(f => f.severity === 'LOW').length;
    return { high, med, low, total: RISK_FLAGS.length };
  }, []);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* ════════════ HERO ════════════ */}
      <div className="animate-fadeIn" style={{
        background: 'linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(99,102,241,0.10) 60%, rgba(236,72,153,0.08) 100%)',
        border: '1px solid var(--border)', borderRadius: 18, padding: '32px 36px', marginBottom: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 260, height: 260,
          background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)',
          filter: 'blur(40px)', pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative' }}>
          <div className="label-xs" style={{
            color: 'var(--brand-text)', fontSize: 11, fontWeight: 700,
            letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 10,
          }}>
            Open Architecture · Load-Bearing Docs · Current {new Date().toISOString().slice(0, 10)}
          </div>
          <h1 style={{
            fontSize: 42, fontWeight: 800, letterSpacing: '-1.2px',
            margin: '0 0 12px 0', lineHeight: 1.05,
          }}>
            <span className="gradient-fill">ProTrader Architecture</span>
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.6, maxWidth: 760, margin: 0 }}>
            Every pillar of the ProTrader system — from Kite candles to the 3 scoring engines, 30 risk-flag detectors,
            7 hard-reject disqualifiers, sector cap, external-signals cron, Haiku 4.5 LLM classifier, and the MiroFish AI council.
            Grounded in <Code>kite-server.js</Code> (~12.7K lines) and <Code>PICKS_ARCHITECTURE.md</Code>.
          </p>

          {/* quick-fact pill strip */}
          <div style={{
            display: 'grid', gap: 10, marginTop: 22,
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          }}>
            <Pill label="Universe"        value="~568 stocks"         color="var(--brand-text)" />
            <Pill label="Scoring engines" value="3 independent"       color="var(--green-text)" />
            <Pill label="Risk detectors"  value={`${flagStats.total} (${flagStats.high}H · ${flagStats.med}M · ${flagStats.low}L)`} color="var(--amber-text)" />
            <Pill label="Disqualifiers"   value="7 hard-reject"       color="var(--red-text)" />
            <Pill label="Sector cap"      value="Max 2 per sector"    color="var(--purple-text)" />
            <Pill label="Kite spacing"    value="420ms serial"        color="var(--text2)" />
          </div>
        </div>
      </div>

      {/* ════════════ LAYOUT: sticky left nav + right content ════════════ */}
      <div style={{
        display: 'grid', gap: 24,
        gridTemplateColumns: 'minmax(0, 200px) minmax(0, 1fr)',
      }}>
        {/* ── Sticky nav ── */}
        <nav style={{
          position: 'sticky', top: 16, alignSelf: 'start',
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 10,
          maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'var(--text3)',
            letterSpacing: '1px', textTransform: 'uppercase',
            padding: '6px 10px 10px', borderBottom: '1px solid var(--border)',
            marginBottom: 6,
          }}>On this page</div>
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => scrollTo(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '8px 10px', borderRadius: 8, marginBottom: 2,
                background: active === s.id ? 'var(--brand-bg)' : 'transparent',
                border: '1px solid transparent',
                borderColor: active === s.id ? 'var(--brand-border, rgba(99,102,241,0.3))' : 'transparent',
                color: active === s.id ? 'var(--brand-text)' : 'var(--text2)',
                fontSize: 12, fontWeight: active === s.id ? 700 : 500,
                textAlign: 'left', cursor: 'pointer',
                transition: 'all 160ms ease',
              }}
              onMouseEnter={(e) => { if (active !== s.id) e.currentTarget.style.background = 'var(--bg3)'; }}
              onMouseLeave={(e) => { if (active !== s.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 13 }}>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </nav>

        {/* ── Content column ── */}
        <div>
          {/* ═══════════ OVERVIEW ═══════════ */}
          <SectionCard id="overview" icon="🏛" title="Overview"
            subtitle="End-to-end: what ProTrader is, what it does, and how the pieces fit. High-level data flow from Kite/Screener/news sources through the three scoring engines to the UI."
            accent="var(--brand-text)">
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 16 }}>
              ProTrader is a monolithic Node.js trading system running on Railway. It scores ~568 NSE stocks against{' '}
              <b>three independent strategies</b> simultaneously (Rebound, Momentum, Long-Term) and surfaces top-10 picks per tab
              with risk-flag badges, sector caps, and disqualifier filters. A Deep AI Review layer (5-model council + Claude Sonnet 4.6 judge)
              validates picks on demand; a MiroFish AI council handles mutual-fund ranking.
            </p>

            <div style={{
              background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
              padding: 18, fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontSize: 11, color: 'var(--text2)', lineHeight: 1.7, overflowX: 'auto',
            }}>
{`  ┌──────────────────────────────────────────────────────────────────────┐
  │ EXTERNAL DATA: Kite · Screener · BSE · Google News · Yahoo · Tickertape │
  └──────────────────────────────────────────────────────────────────────┘
                                    │
                        420ms serial queue (Kite)
                                    ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │   IN-MEMORY CACHES                                                    │
  │   stockFundamentals · _externalSignalsCache · _fiveMinCandlesCache    │
  └──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │   SCORING PIPELINE (per stock — runs 3 engines in parallel)           │
  │                                                                        │
  │   scoreOneStockV2 ─────▶  scoreV2Raw  ──┐                              │
  │   scoreStockForPortfolio ▶  compositeRaw ─┼─▶ applyRiskFlagPenalty     │
  │   scoreFallenAngel ────▶  fallenScoreRaw─┘      (computeRiskFlags)     │
  │                                                        │               │
  │                                                        ▼               │
  │                                    scoreV2 · composite · fallenScore   │
  └──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │   PICKS ASSEMBLY                                                       │
  │   1. checkDisqualifiers → disqualified flag                            │
  │   2. Tab-specific filter (isFallenAngel / composite≥55 / scoreV2≥60)   │
  │   3. sort by score desc                                                │
  │   4. applySectorCap(maxPerSector=2)                                    │
  │   5. slice(0, 10)                                                      │
  └──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │   REACT v2 UI (Vite build, served by Express at /)                    │
  │   Stock Picks · Day Trade · RoboTrade · MF Picks · Holdings · Deep    │
  │   Analyzer · Stock Data · MiroFish Lab · Admin · Architecture         │
  └──────────────────────────────────────────────────────────────────────┘`}
            </div>

            <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.65, marginTop: 16 }}>
              <b style={{ color: 'var(--text2)' }}>Key principle:</b> the full universe is always scored and returned.
              The picks tabs are <i>views</i> on top — filtering + sorting + capping. Any stock not in top-10 of any tab is still
              present in the full <Code>stocks[]</Code> array for search and ad-hoc screening.
            </p>
          </SectionCard>

          {/* ═══════════ TAB MAP ═══════════ */}
          <SectionCard id="tabs" icon="🗂" title="Tab Map"
            subtitle="Every user-facing tab and what it does. Load-bearing per feedback_architecture_docs.md — tab/column changes must update this section in the same commit."
            accent="var(--purple-text)">
            <Table
              headers={['Tab', 'Purpose']}
              colWidths={['160px', null]}
              rows={TAB_MAP.map(([tab, desc, color]) => [
                <span style={{ color, fontWeight: 700 }}>{tab}</span>,
                <span>{desc}</span>,
              ])}
            />
          </SectionCard>

          {/* ═══════════ SCORING SYSTEMS ═══════════ */}
          <SectionCard id="scoring" icon="🎯" title="Scoring Systems"
            subtitle="Three independent engines — scoreV2 (Long-Term Varsity 4-pillar), composite (Momentum 5-factor), fallenScore (Rebound quality-on-sale). Every stock carries all three simultaneously; tabs are views on the unified universe."
            accent="var(--green-text)">

            {/* V2 */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--brand-text)', margin: 0 }}>
                  scoreV2 — Long-Term Investments
                </h3>
                <Chip color="var(--brand-text)" bg="var(--brand-bg)" border="var(--brand-text)">Varsity M3</Chip>
                <Chip>FA only · TA excluded</Chip>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 12 }}>
                Varsity Module 3/11 fundamentals-first buy-and-hold. <b>FA/TA separation is load-bearing</b> — tests in{' '}
                <Code>/test/v2-invariants.js</Code> enforce that no technicals contribute to scoreV2.
                Timing indicators (Ichimoku, % above 200DMA, golden cross) live in a separate <Code>timingOverlay</Code> object.
              </p>
              {V2_PILLARS.map(([name, max, desc]) => (
                <PillarBar key={name} label={`${name} — ${desc}`} value={max} total={100} color="var(--brand-text)" />
              ))}
              <div style={{
                marginTop: 10, padding: '10px 12px', background: 'var(--bg2)',
                border: '1px solid var(--border)', borderRadius: 8, fontSize: 11,
                color: 'var(--text3)', lineHeight: 1.6,
              }}>
                <b style={{ color: 'var(--text2)' }}>Eligibility gate (Long-Term picks):</b>{' '}
                scoreV2 ≥ 60 AND ROE ≥ 12 AND D/E ≤ 2 AND earnings growth ≥ 0 AND pctFromHigh ≥ −35 AND not disqualified.
                <br />
                <b style={{ color: 'var(--text2)' }}>Business ceiling:</b>{' '}
                if pledged ≥ 80% → businessScore capped at 3 (20% max); ≥ 50% → capped at 6 (40% max).
              </div>
            </div>

            {/* Composite */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--green-text)', margin: 0 }}>
                  composite — Momentum Picks
                </h3>
                <Chip color="var(--green-text)" bg="var(--green-bg)" border="var(--green-text)">Varsity M10</Chip>
                <Chip>5-factor blend</Chip>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 12 }}>
                1-3 month swing candidates combining fundamentals + technicals + momentum + risk.
                <Code>scoreStockForPortfolio(f)</Code> returns a single 0-100 score; buy-tier floor is 55.
              </p>
              {COMPOSITE_FACTORS.map(([name, max, desc]) => (
                <PillarBar key={name} label={`${name} · ${max}% — ${desc}`} value={max} total={40} color="var(--green-text)" />
              ))}
              <div style={{
                marginTop: 10, padding: '10px 12px', background: 'var(--bg2)',
                border: '1px solid var(--border)', borderRadius: 8, fontSize: 11,
                color: 'var(--text3)', lineHeight: 1.6,
              }}>
                <b style={{ color: 'var(--text2)' }}>Conviction tiers:</b> ≥70 Strong Buy · ≥60 Buy · ≥50 Accumulate · ≥40 Watch · else Avoid.{' '}
                <b style={{ color: 'var(--text2)' }}>Eligibility:</b> composite ≥ 55 AND not disqualified.
              </div>
            </div>

            {/* Fallen angel */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--amber-text)', margin: 0 }}>
                  fallenScore — Rebound Picks
                </h3>
                <Chip color="var(--amber-text)" bg="var(--amber-bg)" border="var(--amber-text)">Varsity M2 Ch12</Chip>
                <Chip>Fallen Angel</Chip>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 12 }}>
                Quality businesses temporarily on sale. Targets stocks ≥ 20% down from 52W high with RSI ≤ 52, D/E ≤ 2,
                and FA ≥ 50 — the classic "buy the dip on good businesses" setup.
              </p>
              {FALLEN_PILLARS.map(([name, max, desc]) => (
                <PillarBar key={name} label={`${name} — ${desc}`} value={max} total={40} color="var(--amber-text)" />
              ))}
              <div style={{
                marginTop: 10, padding: '10px 12px', background: 'var(--bg2)',
                border: '1px solid var(--border)', borderRadius: 8, fontSize: 11,
                color: 'var(--text3)', lineHeight: 1.6,
              }}>
                <b style={{ color: 'var(--text2)' }}>Verdicts:</b> ≥82 🚀 Strong Dip Buy · ≥67 ✅ Good Dip · ≥52 📈 Accumulate · ≥37 ⏳ Watch · else ⚠ Value Trap.{' '}
                <b style={{ color: 'var(--text2)' }}>Penalties:</b> EPS collapse &gt;30% −15 · revenue decline &gt;20% −10 · extreme debt (D/E &gt; 2) −10 · RSI bearish divergence −4.{' '}
                <b style={{ color: 'var(--text2)' }}>Size-aware eligibility:</b> smaller caps need stricter quality + deeper fall.
              </div>
            </div>
          </SectionCard>

          {/* ═══════════ RISK FLAGS ═══════════ */}
          <SectionCard id="riskflags" icon="⚠" title="Risk-Flag Pipeline"
            subtitle={`${flagStats.total} detectors · ${flagStats.high} HIGH · ${flagStats.med} MEDIUM · ${flagStats.low} LOW. All pure functions in /risk-flags.js. Subtract penalty from any of the 3 scores via applyRiskFlagPenalty; bottom-capped at 0. Raw pre-penalty score always preserved as scoreV2Raw / compositeRaw / fallenScoreRaw.`}
            accent="var(--amber-text)">
            <div style={{
              padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 10, fontSize: 11, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 14,
            }}>
              <b style={{ color: 'var(--text2)' }}>Design principle:</b> detectors are pure functions reading ONLY fields
              already on <Code>stockFundamentals[sym]</Code> (no external IO). Network fetches happen upstream in the cron layer —
              detectors run cheap and deterministic at scoring time.
            </div>
            {RISK_FLAGS.map((flag) => <FlagRow key={flag.code} {...flag} />)}
          </SectionCard>

          {/* ═══════════ DISQUALIFIERS ═══════════ */}
          <SectionCard id="disqualifiers" icon="🚫" title="Hard-Reject Disqualifiers"
            subtitle="7 codes that pull a stock entirely out of picks (unlike risk-flags which only penalize). Disqualified stocks remain in stocks[] for search transparency but are filtered from picksRebound / picksMomentum / picksLongTerm with a red EXCLUDED banner in the UI."
            accent="var(--red-text)">
            <Table
              headers={['Code', 'Condition']}
              colWidths={['200px', null]}
              rows={DISQUALIFIERS.map(([code, desc, color]) => [
                <span style={{ color, fontWeight: 700, fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11 }}>{code}</span>,
                <span>{desc}</span>,
              ])}
            />
            <div style={{
              marginTop: 14, padding: '10px 12px', background: 'var(--red-bg)',
              border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8,
              fontSize: 11, color: 'var(--text3)', lineHeight: 1.6,
            }}>
              <b style={{ color: 'var(--red-text)' }}>Application flow:</b>{' '}
              <Code>checkDisqualifiers(f)</Code> runs per stock pre-picks assembly. Hit → <Code>row.disqualified = true</Code> + <Code>row.disqualifier = {'{code, reason, severity}'}</Code>.
              Picks filters use <Code>{'const notDQ = s => !s.disqualified;'}</Code>.
            </div>
          </SectionCard>

          {/* ═══════════ SECTOR CAP ═══════════ */}
          <SectionCard id="sectorcap" icon="📊" title="Sector Cap + Canonicalization"
            subtitle="Prevents top-10 from being dominated by one sector. Raw NSE labels are messy (FMCG vs Fast Moving Consumer Goods) so canonicalSector() collapses to 17 buckets before the cap."
            accent="var(--purple-text)">

            <div style={{
              padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 10, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 14,
            }}>
              <b style={{ color: 'var(--text)' }}>applySectorCap(sortedPicks, maxPerSector = 2)</b> —
              walks sorted list in order, accepts each stock unless its canonical sector already has 2.
              Applied <b>both server-side</b> (builds picksRebound / picksMomentum / picksLongTerm arrays)
              and <b>client-side</b> (StockPicks.jsx mirrors the logic) so the market-cap user-filter is honored.
              No sector ever exceeds 2 in any top-10.
            </div>

            <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', margin: '8px 0 10px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              17 Canonical Buckets
            </h4>
            <div style={{
              display: 'grid', gap: 8,
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            }}>
              {SECTORS.map(([canonical, matches]) => (
                <div key={canonical} style={{
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 12px',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--purple-text)', marginBottom: 3 }}>{canonical}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>{matches}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 12, lineHeight: 1.6 }}>
              Pharma and Healthcare are intentionally kept <i>separate</i> (different business models, different valuation multiples).
              Two instances of the canonicalization logic exist (server + client) — mirrored by hand; future work extracts to a shared JS module.
            </p>
          </SectionCard>

          {/* ═══════════ EXTERNAL SIGNALS ═══════════ */}
          <SectionCard id="external" icon="📡" title="External Signals Pipeline"
            subtitle="BSE corporate actions + Google News headlines + Screener analyst consensus. Fetched on split-cadence crons matching each source's update frequency. Cached in external_signals_cache JSONB with 8h staleness gate; attached to stocks pre-scoring so detectors never do network IO."
            accent="#f59e0b">

            <Table
              headers={['Source', 'Cadence', 'Concurrency', 'Daily calls (568)']}
              rows={[
                ['News (Google RSS)',       <>every 30 min <Chip>market hrs</Chip></>, '6 workers', '~10,200'],
                ['BSE (api.bseindia.com)',  <>hourly at :05 <Chip>market hrs</Chip></>, '4 workers', '~5,100'],
                ['Analyst (Screener.in)',   <>once daily 19:30 IST</>, '3 workers', '~568'],
              ]}
            />

            <div style={{
              marginTop: 14, display: 'grid', gap: 10,
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            }}>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-text)', marginBottom: 6, letterSpacing: '0.4px', textTransform: 'uppercase' }}>Module</div>
                <Code>external-signals.js</Code>
                <p style={{ fontSize: 11, color: 'var(--text3)', margin: '8px 0 0', lineHeight: 1.6 }}>
                  Three graceful fetchers (return null on failure, never throw) + batch runner with bounded concurrency + news-classifier setter.
                </p>
              </div>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-text)', marginBottom: 6, letterSpacing: '0.4px', textTransform: 'uppercase' }}>Cache strategy</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                  Partial-merge per source: news cron writes ONLY <Code>newsNegative</Code>; BSE writes ONLY <Code>bseEvents</Code>; analyst ONLY <Code>analystConsensus</Code>.
                  Prevents source-independence clobbering.
                </div>
              </div>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-text)', marginBottom: 6, letterSpacing: '0.4px', textTransform: 'uppercase' }}>Stale gate</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                  <Code>EXT_SIGNALS_MAX_AGE_MS = 8h</Code>. Stale cache treated as absent so detectors don't act on 24h-old news.
                </div>
              </div>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-text)', marginBottom: 6, letterSpacing: '0.4px', textTransform: 'uppercase' }}>Dual-query news</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                  <Code>"Company" India</Code> + <Code>SYMBOL stock</Code> in parallel, deduped by first 80 chars of title. Catches Indian finance news referencing the ticker.
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ═══════════ LLM CLASSIFIER ═══════════ */}
          <SectionCard id="llm" icon="🤖" title="LLM News Classifier (Tier 1 AI)"
            subtitle="Replaced the hand-maintained 83-entry keyword blacklist with Claude Haiku 4.5 via OpenRouter. Each headline returns {severity, category, reason, demote_score, should_disqualify}. Three-tier fallback: cache → LLM → keyword."
            accent="#C4B5FD">

            <div style={{
              display: 'grid', gap: 10, marginBottom: 14,
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            }}>
              <Pill label="Default model"    value="Claude Haiku 4.5" color="#C4B5FD" />
              <Pill label="Gateway"          value="OpenRouter"       color="var(--text)" />
              <Pill label="Budget cap"       value="$1 / day"         color="var(--amber-text)" />
              <Pill label="Typical spend"    value="$0.02-0.03 / day" color="var(--green-text)" />
              <Pill label="Per-call cost"    value="~$0.00055"        color="var(--text2)" />
              <Pill label="Cache hit rate"   value="high (SHA-256)"   color="var(--text2)" />
            </div>

            <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', margin: '14px 0 8px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              Three-tier fallback
            </h4>
            <Table
              headers={['Tier', 'Condition', 'Behavior']}
              colWidths={['80px', '260px', null]}
              rows={[
                [<Chip color="var(--green-text)" bg="var(--green-bg)">1 Cache</Chip>, 'SHA-256 of title hits news_classification_cache', 'Return immediately, zero cost'],
                [<Chip color="var(--brand-text)" bg="var(--brand-bg)">2 LLM</Chip>,   'Budget remaining AND OpenRouter key present',    'Classify → persist to cache + llm_budget_daily'],
                [<Chip color="var(--amber-text)" bg="var(--amber-bg)">3 Keyword</Chip>, 'Budget exhausted OR LLM errors',                 'Reduced keyword regex fallback'],
              ]}
            />

            <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', margin: '18px 0 8px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              Alternative models (env: NEWS_CLASSIFIER_MODEL)
            </h4>
            <Table
              headers={['Model', 'Cost/call (~150in + 80out)', '$1/day capacity']}
              rows={[
                ['Claude Haiku 4.5 (default)', '$0.00055', '~1,800 calls'],
                ['GPT-4.1-mini',               '$0.00008', '~12,500 calls'],
                ['Gemini 2.5 Flash',           '$0.00004', '~25,000 calls'],
                ['Groq Llama 3.3 70B',         '$0.00003', '~33,000 calls'],
              ]}
            />

            <div style={{
              marginTop: 14, padding: '10px 12px', background: 'var(--bg2)',
              border: '1px solid var(--border)', borderRadius: 8,
              fontSize: 11, color: 'var(--text3)', lineHeight: 1.6,
            }}>
              <b style={{ color: 'var(--text2)' }}>Risk-flag consumption (detector 6.10):</b>{' '}
              <code>disqualify=true</code> → NEWS_DISQUALIFY (−20); maxSeverity HIGH → NEWS_NEGATIVE_HIGH (−10 to −18 scaled by demoteTotal);
              MEDIUM → −5 to −10; LOW → −2 to −5. Day bucketed by IST calendar.
            </div>
          </SectionCard>

          {/* ═══════════ KITE INTEGRATION ═══════════ */}
          <SectionCard id="kite" icon="🔌" title="Kite Integration"
            subtitle="Zerodha's broker API — the price/candle backbone. Hardcoded 3 req/sec ceiling on the historical-data endpoint. Without rate limiting, the 568-stock universe × multiple crons → HTTP 429 storms."
            accent="var(--green-text)">

            <div style={{
              display: 'grid', gap: 10, marginBottom: 14,
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            }}>
              <Pill label="Min spacing"   value="420 ms"  color="var(--green-text)" />
              <Pill label="Rate"          value="2.38 req/sec" color="var(--text2)" />
              <Pill label="Kite ceiling"  value="3 req/sec" color="var(--amber-text)" />
              <Pill label="Headroom"      value="20% under" color="var(--text2)" />
              <Pill label="Queue retries" value="1 on 429" color="var(--text2)" />
              <Pill label="Caller retries"value="3 attempts exp" color="var(--text2)" />
            </div>

            <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', margin: '14px 0 8px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              Endpoints in use
            </h4>
            <Table
              headers={['Endpoint', 'Purpose', 'Rate limit']}
              rows={[
                ['getHistoricalData(day)',     'Daily candles, 5-year history',   '3/sec (critical)'],
                ['getHistoricalData(5minute)', '5-min intraday candles',          '3/sec'],
                ['getHistoricalData(minute)',  '1-min Nifty50 ingest for ML',     '3/sec'],
                ['getLTP([NSE:sym])',          'Live price spot-check',           '10/sec'],
                ['getMargins(equity)',         'Account equity (5-min cached)',   '10/sec'],
                ['KiteTicker WebSocket',       'Live tick stream during market',  'Unlimited push'],
              ]}
            />

            <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', margin: '18px 0 8px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              Architecture
            </h4>
            <ol style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, margin: 0, paddingLeft: 20 }}>
              <li><b>Serial queue</b> — <Code>_withKiteHistoricalLimit()</Code> chains a Promise with 420ms minimum spacing.</li>
              <li><b>Queue-level 429 retry</b> — on "Too many requests", wait 1s and retry once before propagating.</li>
              <li><b>Monkey-patch on initKite</b> — every caller (Smart Scan, DayTrade, chart-data, Unified Pipeline) routes through the same queue automatically. No per-caller changes.</li>
              <li><b>Caller-level exponential backoff</b> — <Code>fetchKiteDaily</Code> adds 3-attempt retry (0s → 2s → 4s). Combined with queue retry, tolerates ~4 transient failures.</li>
              <li><b>5-min candle cache</b> — <Code>_fiveMinCandlesCache</Code> (6-min TTL) populated by Unified Pipeline, read by Smart Scan. Saves ~58K duplicate Kite calls/day (~50% reduction).</li>
              <li><b>Scan concurrency guard</b> — <Code>_scanAndTradeRunning</Code> flag + 10-min watchdog force-release prevent overlap stackup.</li>
              <li><b>Stale self-healing</b> — every 15 min at :07/:22/:37/:52, refetch top-30 stalest (fetchedAt &gt; 90 min). <Code>/api/admin/stale-healthcheck</Code> bypasses market guard.</li>
              <li><b>Token handling</b> — stored in <Code>app_config</Code> DB table. Auto-recovered on container restart. Daily 8 AM IST re-auth cron.</li>
            </ol>
          </SectionCard>

          {/* ═══════════ MIROFISH AI ═══════════ */}
          <SectionCard id="mirofish" icon="🐟" title="MiroFish AI — Multi-Model Council + Judge"
            subtitle="Deep AI Review layer used on Stock Picks (Rebound / Momentum / Long-Term), Holdings, and MF Picks top-5 per category. Dual-opinion per row: WITH Varsity + PURE first-principles. For MF Picks, each council member ALSO returns its own ordered 1..5 ranking; judge synthesises a final_ranking with why_choose / why_not / council_divergence per fund."
            accent="#8B5CF6">

            <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', margin: '0 0 10px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              5-Model Council
            </h4>
            <div style={{
              display: 'grid', gap: 10, marginBottom: 16,
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            }}>
              {[
                ['Groq Llama 3.3 70B', 'meta (open)', '#14b8a6'],
                ['GPT-4.1',            'openai',       '#10a37f'],
                ['DeepSeek V3',        'deepseek',     '#60a5fa'],
                ['Gemini 2.5 Flash',   'google',       '#fbbf24'],
                ['Qwen 3 Max',         'alibaba',      '#f472b6'],
              ].map(([model, vendor, color]) => (
                <div key={model} style={{
                  background: 'var(--bg2)', border: `1px solid ${color}40`,
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{model}</div>
                  <div style={{ fontSize: 10, color, fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase' }}>{vendor}</div>
                </div>
              ))}
            </div>

            <div style={{
              padding: '16px 18px',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(99,102,241,0.08) 100%)',
              border: '1px solid rgba(139,92,246,0.4)', borderRadius: 12,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#C4B5FD', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 4 }}>Final Judge</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
                ⚖ Claude Sonnet 4.6
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                Synthesises the 5 council opinions into a final verdict. For MF Picks, produces an ordered <Code>final_ranking</Code> with per-fund <Code>why_choose</Code>,{' '}
                <Code>why_not</Code>, and <Code>council_ranking_divergence</Code> (per <b>project_mf_ranking.md</b> memory — ordered top-3 is the contract).
              </div>
            </div>

            <div style={{
              marginTop: 14, padding: '10px 12px', background: 'var(--bg2)',
              border: '1px solid var(--border)', borderRadius: 8,
              fontSize: 11, color: 'var(--text3)', lineHeight: 1.6,
            }}>
              <b style={{ color: 'var(--text2)' }}>Persistence:</b>{' '}
              <Code>picks_ai_reviews</Code> (category, fund_or_sym, model_id),{' '}
              <Code>mf_ai_reviews</Code> (per-fund verdicts),{' '}
              <Code>mf_ai_rankings</Code> (per-model ordered rankings),{' '}
              <Code>holdings_ai_reviews</Code>,{' '}
              <Code>ai_disagree_log</Code> (judge vs council divergence audit).
            </div>
          </SectionCard>

          {/* ═══════════ CRON ═══════════ */}
          <SectionCard id="cron" icon="⏰" title="Daily Cron Orchestration"
            subtitle="All crons use Asia/Kolkata timezone. Market-hours crons short-circuit via isMarketOpen() outside Mon-Fri 9:15-3:30 IST; admin endpoints accept force=true to bypass."
            accent="var(--amber-text)">

            <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-text)', margin: '0 0 8px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              Market-hours (Mon-Fri 9:15-15:30 IST)
            </h4>
            <Table
              headers={['Cron', 'Job', 'Purpose']}
              colWidths={['200px', '200px', null]}
              rows={CRON_MARKET.map(([cron, job, purpose]) => [<Code>{cron}</Code>, <b>{job}</b>, purpose])}
            />

            <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-text)', margin: '18px 0 8px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              Once-daily
            </h4>
            <Table
              headers={['Cron', 'Job', 'Purpose']}
              colWidths={['150px', '200px', null]}
              rows={CRON_DAILY.map(([cron, job, purpose]) => [<Code>{cron}</Code>, <b>{job}</b>, purpose])}
            />

            <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber-text)', margin: '18px 0 8px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              24×7
            </h4>
            <Table
              headers={['Cron', 'Job', 'Purpose']}
              colWidths={['150px', '200px', null]}
              rows={CRON_ALWAYS.map(([cron, job, purpose]) => [<Code>{cron}</Code>, <b>{job}</b>, purpose])}
            />

            <div style={{
              marginTop: 14, padding: '10px 12px', background: 'var(--bg2)',
              border: '1px solid var(--border)', borderRadius: 8,
              fontSize: 11, color: 'var(--text3)', lineHeight: 1.6,
            }}>
              <b style={{ color: 'var(--text2)' }}>Off-hours behavior:</b> between Friday 3:30 PM IST and Monday 9:15 AM IST,
              nothing market-gated runs. WebSocket disconnects. Outcome-engine still processes already-captured snapshots. Crypto crons run normally.
            </div>
          </SectionCard>

          {/* ═══════════ DATA SOURCES ═══════════ */}
          <SectionCard id="data" icon="🗃" title="Data Sources"
            subtitle="All upstream inputs feeding the pipeline. Rate-limit-aware, cached aggressively, graceful-fail on transient errors."
            accent="var(--text2)">
            <Table
              headers={['Source', 'Purpose', 'Cadence / Limit']}
              colWidths={['180px', null, '200px']}
              rows={DATA_SOURCES.map(([name, desc, cadence]) => [
                <b style={{ color: 'var(--brand-text)' }}>{name}</b>, desc, <Code>{cadence}</Code>,
              ])}
            />
          </SectionCard>

          {/* ═══════════ DATABASE ═══════════ */}
          <SectionCard id="db" icon="💾" title="Database Schema"
            subtitle="Single Railway Postgres instance. All tables created via CREATE TABLE IF NOT EXISTS in initDb() at server boot."
            accent="var(--brand-text)">
            {DB_TABLES.map(([group, tables]) => (
              <div key={group} style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-text)', margin: '0 0 8px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>{group}</h4>
                <Table
                  headers={['Table', 'Purpose']}
                  colWidths={['240px', null]}
                  rows={tables.map(([tbl, purpose]) => [<Code>{tbl}</Code>, purpose])}
                />
              </div>
            ))}

            <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber-text)', margin: '18px 0 8px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              Admin Endpoints
            </h4>
            <Table
              headers={['Method', 'Endpoint', 'Purpose']}
              colWidths={['80px', '280px', null]}
              rows={ADMIN_ENDPOINTS.map(([method, ep, desc]) => [
                <Chip color="var(--amber-text)" bg="var(--amber-bg)">{method}</Chip>,
                <Code>{ep}</Code>, desc,
              ])}
            />
          </SectionCard>

          {/* ═══════════ INVARIANTS ═══════════ */}
          <SectionCard id="invariants" icon="🛡" title="Key Invariants"
            subtitle="Non-negotiable contracts enforced by tests in /test/v2-invariants.js and feedback memory files. Violating any breaks the system's thesis."
            accent="#f0abfc">
            {[
              ['FA/TA separation',
               'scoreV2 must contain zero technical-analysis contribution. Tests in /test/v2-invariants.js enforce that quality/growth/valuation/business pillars read no RSI/MACD/Ichimoku fields. Technicals live only in timingOverlay. Violating breaks Varsity M3 fundamentals-first thesis.'],
              ['Architecture tab stays current',
               'Per feedback_architecture_docs.md: any tab/score/column change must update this Architecture tab in the SAME commit. This page is load-bearing docs, not decoration.'],
              ['No mock DB in integration tests',
               'Per feedback_test_hook_pattern.md: integration tests hit the real DB. Env-gated V2_TEST_HOOKS=1 reveals invariant-verification endpoints; never leave on in prod.'],
              ['3D animations in UI',
               'Per feedback_3d_animations.md: ProTrader UI always uses 3D effects, smooth transitions, animated backgrounds.'],
              ['MF ranking contract',
               'Per project_mf_ranking.md: council + judge return ordered top-3 ranking with why_choose / why_not, not just per-fund verdicts.'],
              ['Raw score preserved on every detector',
               'scoreV2Raw, compositeRaw, fallenScoreRaw always carry the pre-penalty score for audit. "Why did this pick move?" answerable by diffing raw vs adjusted.'],
            ].map(([title, desc], i) => (
              <div key={i} style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderLeft: '3px solid #f0abfc', borderRadius: 8,
                padding: '12px 14px', marginBottom: 10,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </SectionCard>

          {/* ═══════════ STACK ═══════════ */}
          {/* ═══════════ BUILD-BEST ROADMAP ═══════════ */}
          <SectionCard id="roadmap" icon="🗺" title="Build-Best Roadmap"
            subtitle="The approved 8-phase plan to turn ProTrader Stock Picks into a real-money edge. Phase 0 (AI Buy Plan) is shipped — manual LLM curation of the top-30; later phases layer PIT data, professional signal feeds, deep thesis, ML, and portfolio-aware refinement on top. Full cost envelope: ₹16k–40k/mo at steady state."
            accent="var(--purple-text)">

            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 14 }}>
              This is the load-bearing plan behind every commit to the picks pipeline.
              <b style={{ color: 'var(--text)' }}> Build order is deliberate:</b> each phase
              exists because the phase before it makes it possible (PIT data unlocks
              walk-forward backtests; tracker data unlocks LLM kill-switch; ML sits on top
              of PIT features; self-tuning needs months of outcomes). Skipping ahead is how
              retail setups fail — you end up with an ML model trained on lookahead-biased
              data that nobody can audit.
            </p>

            <div style={{
              marginBottom: 16, padding: '12px 14px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(139,92,246,0.08) 100%)',
              border: '1px solid var(--border)', borderRadius: 10,
              fontSize: 12, color: 'var(--text2)', lineHeight: 1.65,
            }}>
              <b style={{ color: 'var(--brand-text)' }}>Cost envelope:</b>{' '}
              Phase 0 free · Phases 1–4 ramp to <Code>~₹16k–40k/mo</Code> steady state ·
              Phases 5–8 add zero incremental spend. Gating rule: no phase is committed to
              until the previous phase's tracker data shows the spend is earning its keep.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ROADMAP_PHASES.map((p) => {
                const s = ROADMAP_STATUS_STYLE[p.status] || ROADMAP_STATUS_STYLE.pending;
                return (
                  <div key={p.id} style={{
                    background: 'var(--bg2)',
                    border: `1px solid ${s.border}`,
                    borderLeft: `3px solid ${s.fg}`,
                    borderRadius: 10,
                    padding: 16,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: s.bg, border: `1px solid ${s.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 14, color: s.fg, flexShrink: 0,
                      }}>{p.id}</div>
                      <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.2px' }}>
                        Phase {p.id} — {p.title}
                      </h3>
                      <Chip color={s.fg} bg={s.bg} border={s.border}>{s.label}</Chip>
                      <Chip>{p.when}</Chip>
                      <Chip color="var(--amber-text)" bg="var(--amber-bg)" border="rgba(251,191,36,0.35)">{p.cost}</Chip>
                    </div>
                    <p style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.65, margin: '6px 0 10px' }}>
                      <b style={{ color: 'var(--text)' }}>Goal:</b> {p.goal}
                    </p>
                    <div style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      marginBottom: 10,
                    }}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, color: 'var(--text3)',
                        letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 6,
                      }}>What it includes</div>
                      <ul style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.65, margin: 0, paddingLeft: 18 }}>
                        {p.includes.map((it, i) => (<li key={i}>{it}</li>))}
                      </ul>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.6, fontStyle: 'italic' }}>
                      <b style={{ color: 'var(--text2)', fontStyle: 'normal' }}>Why:</b> {p.why}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{
              marginTop: 18, padding: '12px 14px',
              background: 'linear-gradient(135deg, rgba(34,197,94,0.10) 0%, rgba(99,102,241,0.08) 100%)',
              border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10,
              fontSize: 12, color: 'var(--text2)', lineHeight: 1.65,
            }}>
              <b style={{ color: 'var(--green-text)' }}>North-star rule:</b>{' '}
              Build Phases 0 + 1 and stop — you're already in the top 5% of retail setups because everyone else is flying blind.
              Phases 2–4 add an institutional-grade information edge. Phases 5–8 add compounding self-improvement.
              Explicitly NOT in scope: satellite imagery, crypto sentiment correlation, global macro signals — low signal for an Indian equity workbook.
            </div>
          </SectionCard>

          <SectionCard id="stack" icon="🚀" title="Stack & Deploy"
            subtitle="What runs where, deploy path, and operational runbook links."
            accent="var(--green-text)">
            <Grid cols={2} gap={12}>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-text)', marginBottom: 8, letterSpacing: '0.4px', textTransform: 'uppercase' }}>Backend</div>
                <ul style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
                  <li>Node.js monolith (<Code>kite-server.js</Code> ~12.7K LOC)</li>
                  <li>Express HTTP + WebSocket</li>
                  <li>node-cron for all scheduled jobs</li>
                  <li>pg (node-postgres) for DB</li>
                  <li>kiteconnect SDK for Kite</li>
                </ul>
              </div>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green-text)', marginBottom: 8, letterSpacing: '0.4px', textTransform: 'uppercase' }}>Frontend</div>
                <ul style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
                  <li>React v2 (Vite build)</li>
                  <li>11 pages migrated per commit c7e4ef8</li>
                  <li>Served as static by Express at <Code>/</Code></li>
                  <li>3D animations + smooth transitions</li>
                  <li>No localStorage/sessionStorage (auth via cookies)</li>
                </ul>
              </div>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber-text)', marginBottom: 8, letterSpacing: '0.4px', textTransform: 'uppercase' }}>Deploy</div>
                <ul style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
                  <li>Railway (proprod environment)</li>
                  <li>Auto-deploy on push to <Code>balaji</Code></li>
                  <li>Single process, single Postgres instance</li>
                  <li>Env vars: OPENROUTER_API_KEY, KITE_*, DATABASE_URL</li>
                  <li>Real-money reliability target</li>
                </ul>
              </div>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#C4B5FD', marginBottom: 8, letterSpacing: '0.4px', textTransform: 'uppercase' }}>AI Services</div>
                <ul style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
                  <li>OpenRouter (multi-model gateway)</li>
                  <li>Haiku 4.5 for news classification</li>
                  <li>5-model council + Sonnet 4.6 judge for Deep AI</li>
                  <li>Fallback keys: ANTHROPIC / OPENAI / GROQ direct</li>
                  <li>Budget tracked in <Code>llm_budget_daily</Code></li>
                </ul>
              </div>
            </Grid>

            <div style={{
              marginTop: 16, padding: '12px 14px',
              background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(99,102,241,0.08) 100%)',
              border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10,
              fontSize: 12, color: 'var(--text2)', lineHeight: 1.65,
            }}>
              <b style={{ color: 'var(--green-text)' }}>Health-check runbook:</b>{' '}
              (1) Page reload — Stock Picks loads in &lt;2s with 3 populated tabs.{' '}
              (2) <Code>GET /api/admin/debug-stock/HDFCBANK</Code> — <Code>fundamentals_age_hours</Code> &lt; 1 during market.{' '}
              (3) <Code>GET /api/admin/llm-budget</Code> — <Code>spent_usd &lt; budget_usd</Code>, <Code>cap_hit === false</Code>.{' '}
              (4) <Code>POST /api/admin/refresh-external-signals</Code> bypasses market hours.{' '}
              (5) Admin → "Force-run Unified Pipeline" completes in 3-5 min, stockFundamentals=568, DayTrade cache=200-400.
            </div>

            <div style={{
              marginTop: 14, textAlign: 'center', fontSize: 11, color: 'var(--text3)',
              padding: '14px 0 4px', borderTop: '1px solid var(--border)',
            }}>
              End of architecture reference. Ground truth:{' '}
              <Code>/PICKS_ARCHITECTURE.md</Code> · Tests: <Code>/test/v2-invariants.js</Code> · Code: <Code>kite-server.js</Code>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
