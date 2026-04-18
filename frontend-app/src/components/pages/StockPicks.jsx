import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { apiGet, apiPost, apiPatch } from '../../api/client';
import { useAppStore } from '../../store/useAppStore';

// ══════════════════════════════════════════════════════════════════════
// Sector canonicalization — mirrors kite-server.js canonicalSector()
// Prevents "FMCG" ≠ "Fast Moving Consumer Goods" from evading the cap.
// ══════════════════════════════════════════════════════════════════════
function canonicalSector(raw) {
  if (!raw) return 'Other';
  const s = String(raw).toLowerCase().trim();
  if (/fast moving consumer goods|^fmcg$|consumer staples|packaged foods/i.test(s)) return 'FMCG';
  if (/^auto$|^autos$|automobile|automotive|auto components|tyres/i.test(s)) return 'Auto';
  if (/^it$|information technology|software|tech services|it services/i.test(s)) return 'IT';
  if (/^pharma$|pharmaceutical/i.test(s)) return 'Pharma';
  if (/healthcare|hospital|diagnostic/i.test(s)) return 'Healthcare';
  if (/^bank$|^banks$|private bank|public sector bank|banking/i.test(s)) return 'Banking';
  if (/nbfc|non.banking financ|financial services|financials/i.test(s)) return 'Financial Services';
  if (/^metal$|^metals$|metals.*mining|mining|aluminium|steel|iron.*ore|ferrous|non.?ferrous/i.test(s)) return 'Metals';
  if (/oil.*gas|petroleum|refineries|refinery|natural gas/i.test(s)) return 'Oil & Gas';
  if (/^power$|^electricity$|utilities|power generation|power distribution/i.test(s)) return 'Power';
  if (/cement|building products/i.test(s)) return 'Cement';
  if (/^chemicals?$|specialty chem|commodity chem|fertili[sz]er/i.test(s)) return 'Chemicals';
  if (/capital goods|industrials|electrical equipment|construction/i.test(s)) return 'Capital Goods';
  if (/consumer services|retail|travel|leisure|education|hotels/i.test(s)) return 'Consumer Services';
  if (/infra|ports|airports|logistics|shipping|railways/i.test(s)) return 'Infrastructure';
  if (/realty|real estate/i.test(s)) return 'Realty';
  if (/insurance|reinsurance/i.test(s)) return 'Insurance';
  return String(raw).trim();
}

function applySectorCap(sortedList, maxPerSector = 2) {
  const out = [];
  const counts = {};
  for (const s of sortedList) {
    const sec = canonicalSector(s.sector);
    if ((counts[sec] || 0) >= maxPerSector) continue;
    counts[sec] = (counts[sec] || 0) + 1;
    out.push(s);
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════════
// Risk flag badge labels — mirrors public/app.html badge section
// ══════════════════════════════════════════════════════════════════════
const FLAG_LABELS = {
  EARNINGS_CLIFF:                  '⚠ Earnings Cliff',
  EARNINGS_DROP_SEVERE:            '⚠ PAT Drop',
  EARNINGS_DECELERATING:           '↓ Earnings Turn',
  EARNINGS_SLOWING:                '→ Earnings Slowing',
  PRICE_PAT_DIVERGENCE_BEARISH:    '⚡ Price/PAT Divergent',
  PRICE_EARNINGS_EXTENDED:         '↑ Price Extended',
  MOMENTUM_CYCLICAL_PEAK:          '📈 Cyclical Peak',
  LOCKIN_IMMINENT:                 '🔓 Lock-in Imminent',
  LOCKIN_RECENT:                   '🔓 Lock-in Recent',
  LOCKIN_UPCOMING:                 '🔓 Lock-in Upcoming',
  EARNINGS_QUALITY_DIVERGENT:      '💧 FCF Weak vs PAT',
  EARNINGS_QUALITY_WEAK:           '💧 FCF Lagging',
  CYCLICAL_PEAK_PROFITABILITY:     '🔝 Cyclical Peak',
  CYCLICAL_ELEVATED_MARGINS:       '🔝 Late-Cycle',
  DRAWDOWN_STILL_FALLING:          '🗡 Falling Knife',
  DRAWDOWN_IMMATURE:               '⏳ No Recovery',
  DRAWDOWN_ACCELERATING:           '↓↓ Fall Deepening',
  SECTOR_LAGGARD:                  '🐌 Sector Laggard',
  SECTOR_UNDERPERFORMER:           '🐌 Underperforming',
  REBOUND_NO_CONFIRMATION:         '🗡 No Bottom Signal',
  REBOUND_WEAK_CONFIRMATION:       '⏳ Weak Bottom',
  BSE_EVENT_IMMINENT:              '📅 BSE Imminent',
  BSE_EVENT_SOON:                  '📅 BSE Soon',
  NEWS_NEGATIVE_RECENT:            '📰 Negative News',
  NEWS_NEGATIVE_MODERATE:          '📰 News Caution',
  ANALYST_SELL:                    '👎 Analyst SELL',
  ANALYST_TP_BELOW:                '👎 TP Below Spot',
  ANALYST_CAUTIOUS:                '👎 Analysts Cautious',
  MOMENTUM_CONSENSUS_CONFLICT:     '⚡ High Score, TP Below',
  MOMENTUM_CONSENSUS_CAUTIOUS:     '⚡ Weak Consensus',
  NEWS_DISQUALIFY:                 '🚨 AI: Severe News',
  NEWS_NEGATIVE_HIGH:              '🤖 AI: High-Severity',
  NEWS_NEGATIVE_MEDIUM:            '🤖 AI: Moderate',
  NEWS_NEGATIVE_LOW:               '🤖 AI: Minor',
  // New flags (2026-04-18 detector expansion)
  REG_PROBE:                        '⚖ Regulatory Probe',
  REVENUE_PAT_BOTH_DECLINING:       '🚨 Demand Shock',
  REVENUE_PAT_BOTH_SOFT:            '↓ Both Softening',
  STALE_ANALYST_DATA:               '🕒 Stale Consensus',
  STALE_ANALYST_DATA_OLD:           '🕒 Old Consensus',
  ANALYST_TP_BELOW_SEVERE:          '👎 Severe Overshoot',
  ANALYST_TP_BELOW_MILD:            '👎 Mild Overshoot',
};

// ══════════════════════════════════════════════════════════════════════
// FLAG_EXPLANATIONS — plain-English 1-2 sentence description per code.
// Shown in soft grey UNDER each flag so a non-expert can understand
// WHY the score was penalised without needing internal jargon.
// ══════════════════════════════════════════════════════════════════════
const FLAG_EXPLANATIONS = {
  EARNINGS_CLIFF:
    "The latest quarter's profit dropped sharply (>20% vs the same quarter last year) even though the long-term track record was strong. Something may have broken structurally — patent cliff, lost customer, new competition — so we stay cautious until the next quarter confirms a recovery.",
  EARNINGS_DROP_SEVERE:
    "Most recent quarter's profit fell heavily year-on-year. It could be a one-off (raw material spike, forex, one-time charge) or the start of a trend — either way we discount the score until it stabilises.",
  EARNINGS_DECELERATING:
    "Profit growth is slowing down quarter-by-quarter. The stock may still look good on paper, but the earnings engine is losing steam — which usually leads to a de-rating if it continues.",
  EARNINGS_SLOWING:
    "The pace of earnings growth is flattening. Not a red flag on its own, but a high P/E multiple is hard to defend without growth to back it up.",
  PRICE_PAT_DIVERGENCE_BEARISH:
    "The share price is sitting near highs while profits are actually falling. Markets eventually reprice to match earnings reality, so this kind of divergence often precedes a correction.",
  PRICE_EARNINGS_EXTENDED:
    "The share price has run much faster than earnings over the past year. The valuation looks stretched relative to what the business is actually delivering.",
  MOMENTUM_CYCLICAL_PEAK:
    "Strong recent price momentum combined with cyclical-industry peak margins. Cyclical businesses rarely hold peak margins for long — mean reversion is the base case, not continued upside.",
  LOCKIN_IMMINENT:
    "A large block of shares (pre-IPO, promoter, or anchor) will unlock for sale within the next ~30 days. Supply overhang tends to cap upside and often triggers a short-term drop.",
  LOCKIN_RECENT:
    "A lock-in expired within the past few weeks and some of that supply may still be hitting the market. Price action can stay choppy while insiders trim positions.",
  LOCKIN_UPCOMING:
    "A share lock-in expiry is scheduled in the next few months. Not urgent, but a known future supply event that may weigh on price as the date approaches.",
  EARNINGS_QUALITY_DIVERGENT:
    "Reported profit is growing but free cash flow isn't keeping up. Profits that don't turn into actual cash are a classic early-warning sign of aggressive accounting.",
  EARNINGS_QUALITY_WEAK:
    "Free cash flow is lagging reported earnings. The business looks healthy on the P&L but isn't generating the cash to match, which makes the earnings lower-quality.",
  CYCLICAL_PEAK_PROFITABILITY:
    "This is a cyclical business (metals, autos, chemicals, etc.) running at historically peak margins. When the cycle turns, margins can halve very fast — so a high multiple at peak earnings is dangerous.",
  CYCLICAL_ELEVATED_MARGINS:
    "Margins are well above the long-run average for this industry. Usually a sign the cycle is mature — limited upside, full cycle-reversion downside.",
  DRAWDOWN_STILL_FALLING:
    "The stock has fallen a lot from its high, but the 3-month trend is still heading down. Classic falling-knife setup — better to wait for price to stop making new lows before buying.",
  DRAWDOWN_IMMATURE:
    "This stock fell only recently. There hasn't been enough time to tell if the worst is over — typically the first relief rally fails, so early buyers get shaken out.",
  DRAWDOWN_ACCELERATING:
    "The rate of decline is speeding up. Price is falling faster each month, which means sellers are still winning and there is no sign of a bottom yet.",
  SECTOR_LAGGARD:
    "The stock's sector is underperforming the broader market. Even a good company in a weak sector struggles to re-rate until the whole group turns.",
  SECTOR_UNDERPERFORMER:
    "This sector has trailed the index meaningfully. Capital usually flows to leading sectors first, so this pick is fighting a macro headwind.",
  REBOUND_NO_CONFIRMATION:
    "The stock has fallen a lot but there's still no sign of a bottom — the 3-month return is flat or negative and there's no reclaim of key levels. Better to wait for a clear bounce before buying.",
  REBOUND_WEAK_CONFIRMATION:
    "There's a tentative bounce but nothing decisive — no breakout of a swing high, no volume confirmation. Could easily roll over again, so size carefully.",
  BSE_EVENT_IMMINENT:
    "A corporate-action event (merger, buyback, rights issue, results, board meeting) is within a few trading days. Stocks tend to be volatile into these events — binary outcomes are not a great setup for a medium-term buy.",
  BSE_EVENT_SOON:
    "A corporate-action event is coming up in the next couple of weeks. Possible binary move — treat this pick as event-driven, not clean buy-and-hold.",
  NEWS_DISQUALIFY:
    "Recent news screened by AI is severe enough (fraud, regulatory ban, promoter exit, criminal case) that we avoid the stock entirely. No safe entry exists yet.",
  NEWS_NEGATIVE_HIGH:
    "AI screening found multiple high-severity negative news items recently. Material risk to fundamentals — avoid until the situation clears.",
  NEWS_NEGATIVE_MEDIUM:
    "AI screening found moderate-severity negative news. Manageable but keeps the risk-reward skew to the downside for now.",
  NEWS_NEGATIVE_LOW:
    "A few minor negative headlines were flagged by AI. Not disqualifying, but a small penalty to keep us honest about the optics.",
  NEWS_NEGATIVE_RECENT:
    "Negative news items have hit very recently (past few days). Markets often overshoot on fresh bad news — wait for the dust to settle.",
  NEWS_NEGATIVE_MODERATE:
    "A moderate amount of negative news has surfaced lately. Not a dealbreaker, but worth accounting for in position sizing.",
  ANALYST_SELL:
    "One or more sell-side analysts have an outright SELL rating. Institutional money tends to follow analyst guidance, so a SELL rating is a real headwind.",
  ANALYST_TP_BELOW:
    "The average analyst price target sits BELOW the current share price. According to consensus, the upside is already behind us.",
  ANALYST_CAUTIOUS:
    "Most analysts covering this stock are cautious (Hold/Reduce rather than Buy). Consensus doesn't see a clear path to upside.",
  MOMENTUM_CONSENSUS_CONFLICT:
    "Our momentum score is high but the analyst target price is below current levels. Technicals and fundamentals are disagreeing — one side is usually wrong.",
  MOMENTUM_CONSENSUS_CAUTIOUS:
    "Price momentum is strong but analyst consensus is only lukewarm. Buying into strength without fundamental conviction is riskier than it looks.",
  REG_PROBE:
    "The company is under investigation or has a regulatory/legal overhang (SEBI, CBI, ED, SFIO, tax raid, foreign regulator probe, forensic audit, etc.). Until the probe resolves, the stock is effectively un-investable — outcomes are binary and timelines are unpredictable.",
  REVENUE_PAT_BOTH_DECLINING:
    "BOTH sales and profit are falling year-on-year in the latest quarter. When both top line and bottom line go the wrong way together, it's a demand shock — not a one-off margin compression — and the business has a structural problem to work through.",
  REVENUE_PAT_BOTH_SOFT:
    "Sales and profit are both flat-to-negative in the latest quarter. Less severe than a full demand shock, but the dual weakness means margin tricks can't hide the softness — watch the next quarter closely.",
  STALE_ANALYST_DATA:
    "The analyst consensus data we have is more than two weeks old. Signals based on consensus (price target, rating) may no longer reflect current reality — take them with a grain of salt until the refresh runs.",
  STALE_ANALYST_DATA_OLD:
    "The analyst consensus data is more than a month old. Treat any consensus-derived signals as unreliable — the market has almost certainly repriced the stock since analysts last updated.",
  ANALYST_TP_BELOW_SEVERE:
    "The current share price is more than 20% ABOVE the average analyst price target. In other words, the consensus thinks the stock is already worth far less than it's trading at — that's a very meaningful valuation headwind.",
  ANALYST_TP_BELOW_MILD:
    "The current share price is 5-10% above the average analyst price target. A mild valuation overshoot — not a dealbreaker, but the upside analysts see is already behind us.",
};

function severityColors(severity) {
  if (severity === 'HIGH')   return { fg: 'var(--red-text)',    bg: 'var(--red-bg)',    border: 'rgba(248,113,113,0.35)' };
  if (severity === 'MEDIUM') return { fg: 'var(--amber-text)',  bg: 'var(--amber-bg)',  border: 'rgba(251,191,36,0.35)'   };
  return { fg: '#fbbf24', fg2: 'var(--text3)', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.25)' };
}

// Score tier → card accent colour
function scoreColor(score, kind) {
  // kind: 'rebound' | 'momentum' | 'long'
  const s = Number(score) || 0;
  if (kind === 'rebound') {
    if (s >= 82) return 'var(--green-text)';
    if (s >= 67) return 'var(--green-text)';
    if (s >= 52) return 'var(--amber-text)';
    if (s >= 37) return 'var(--amber-text)';
    return 'var(--red-text)';
  }
  if (s >= 80) return 'var(--green-text)';
  if (s >= 65) return 'var(--green-text)';
  if (s >= 50) return 'var(--amber-text)';
  return 'var(--red-text)';
}

// ══════════════════════════════════════════════════════════════════════
// Three-tab config
// ══════════════════════════════════════════════════════════════════════
const TABS = [
  {
    id: 'rebound',
    label: 'Rebound Picks',
    desc: 'Quality stocks down ≥20% from 52W high · RSI ≤50 · D/E ≤2',
    scoreField: 'fallenScore',
    scoreRaw:   'fallenScoreRaw',
    scoreFlags: 'fallenRiskFlags',
    scoreLabel: 'REBOUND SCORE',
    accent: 'var(--amber-text)',
    accentSoft: 'rgba(251,191,36,0.10)',
    accentBorder: 'rgba(251,191,36,0.30)',
    filter: (s) => s.isFallenAngel === true && !s.disqualified,
  },
  {
    id: 'momentum',
    label: 'Momentum Picks',
    desc: 'Momentum Score ≥55 · FA 35% + Val 15% + TA 20% + Mom 15% + Risk 15%',
    scoreField: 'composite',
    scoreRaw:   'compositeRaw',
    scoreFlags: 'compositeRiskFlags',
    scoreLabel: 'MOMENTUM SCORE',
    accent: 'var(--green-text)',
    accentSoft: 'var(--green-bg)',
    accentBorder: 'rgba(52,211,153,0.30)',
    filter: (s) => s.composite != null && s.composite >= 55 && !s.disqualified,
  },
  {
    id: 'longterm',
    label: 'Long-Term Investments',
    desc: 'Investment Score ≥60 · ROE ≥12% · D/E ≤2 · Non-negative EPS growth',
    scoreField: 'scoreV2',
    scoreRaw:   'scoreV2Raw',
    scoreFlags: 'riskFlags',
    scoreLabel: 'INVESTMENT SCORE',
    accent: 'var(--brand-text)',
    accentSoft: 'var(--brand-bg)',
    accentBorder: 'rgba(99,102,241,0.30)',
    filter: (s) => {
      if (s.disqualified) return false;
      const roeOk = s.roe == null || s.roe >= 12;
      const deOk  = s.debtToEq == null || s.debtToEq <= 2;
      const grOk  = s.earGrowth == null || s.earGrowth >= 0;
      const notCollapsing = s.pctFromHigh == null || s.pctFromHigh >= -35;
      return (s.scoreV2 || 0) >= 60 && roeOk && deOk && grOk && notCollapsing;
    },
  },
];

// ══════════════════════════════════════════════════════════════════════
// buildBucketReason — short server-style string explaining why this stock
// cleared the tab's filter. Mirrors the strings the server produces on its
// own picksRebound/Momentum/LongTerm lists; we rebuild client-side because
// this page derives its picks directly from /api/stocks/score's flat
// `stocks` array rather than the server's per-bucket lists.
// ══════════════════════════════════════════════════════════════════════
function buildBucketReason(s, tabId) {
  const parts = [];
  if (s.scoreV2 != null) parts.push(`Q${Math.round(s.scoreV2)}`);
  if (tabId === 'rebound') {
    if (s.pctFromHigh != null) parts.push(`${Math.round(s.pctFromHigh)}% from 52w hi`);
    if (s.rsi != null) parts.push(`RSI ${Math.round(s.rsi)}`);
    if (s.debtToEq != null && s.debtToEq <= 2) parts.push(`D/E ${Number(s.debtToEq).toFixed(1)}`);
  } else if (tabId === 'momentum') {
    if (s.composite != null) parts.push(`comp ${Math.round(s.composite)}`);
    if (s.rsi != null) parts.push(`RSI ${Math.round(s.rsi)}`);
    if (s.macdBull) parts.push('MACD+');
    if (s.obvRising) parts.push('OBV↑');
  } else if (tabId === 'longterm') {
    if (s.roe != null) parts.push(`ROE ${Math.round(s.roe)}`);
    if (s.debtToEq != null) parts.push(`D/E ${Number(s.debtToEq).toFixed(1)}`);
    if (s.earGrowth != null) parts.push(`EPS g ${Math.round(s.earGrowth)}%`);
  }
  return parts.join(' · ');
}

// ══════════════════════════════════════════════════════════════════════
// Sort helper — null-safe, respects asc/desc, strings fall to locale compare
// ══════════════════════════════════════════════════════════════════════
function sortBy(arr, key, dir) {
  const mult = dir === 'asc' ? 1 : -1;
  return [...arr].sort((a, b) => {
    let av = a[key], bv = b[key];
    const aNull = (av == null), bNull = (bv == null);
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    if (typeof av === 'string' || typeof bv === 'string') {
      av = String(av).toUpperCase(); bv = String(bv).toUpperCase();
      if (av < bv) return -1 * mult;
      if (av > bv) return  1 * mult;
      return 0;
    }
    return (av - bv) * mult;
  });
}

// ══════════════════════════════════════════════════════════════════════
// Main component
// ══════════════════════════════════════════════════════════════════════
export default function StockPicks() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [marketCapFilter, setMarketCapFilter] = useState('ALL');

  // Per-tab sort state — {key, dir} tuple per tab id
  const [sorts, setSorts] = useState({
    rebound:  { key: 'fallenScore', dir: 'desc' },
    momentum: { key: 'composite',   dir: 'desc' },
    longterm: { key: 'scoreV2',     dir: 'desc' },
  });

  // AI review state per category
  const [aiReviews, setAiReviews] = useState({}); // { category: { sym: [reviews...] } }
  const [aiLoading, setAiLoading] = useState({}); // { category: bool }
  const [aiRunning, setAiRunning] = useState({}); // { category: bool }
  const [aiExpanded, setAiExpanded] = useState({}); // { "category:sym": true }

  // ═══ Phase 0C — behavioral guardrail: 24h journal / hold ═══
  // `journal` = raw entries from /api/picks-journal (user's own decisions).
  // `journalMap` = quick lookup keyed by `${bucket}:${sym}` → most-recent entry,
  //  so PickRow can render its state without scanning the list on every render.
  const [journal, setJournal] = useState([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalAuthed, setJournalAuthed] = useState(true); // assume true; if 401 → false

  const fetchJournal = useCallback(async () => {
    setJournalLoading(true);
    try {
      const d = await apiGet('/api/picks-journal');
      setJournal(Array.isArray(d?.entries) ? d.entries : []);
      setJournalAuthed(true);
    } catch (e) {
      // Gracefully degrade: if user isn't logged in, we just don't show the
      // journal UI (buttons stay hidden, TrackerPanel still works).
      if (String(e?.message || '').includes('401')) setJournalAuthed(false);
      setJournal([]);
    } finally {
      setJournalLoading(false);
    }
  }, []);
  useEffect(() => { fetchJournal(); }, [fetchJournal]);

  // Tick a counter every 30s so countdown chips update without a manual reload.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNowTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const journalMap = useMemo(() => {
    const m = {};
    for (const e of journal) {
      const k = `${e.bucket}:${e.sym}`;
      // keep most-recent entry per (bucket,sym); entries come back desc already
      if (!m[k]) m[k] = e;
    }
    return m;
  }, [journal]);

  const logInterest = useCallback(async (sym, bucket, reason) => {
    try {
      await apiPost('/api/picks-journal', { sym, bucket, reason: reason || '' });
      await fetchJournal();
    } catch (e) {
      if (String(e?.message || '').includes('401')) {
        alert('Please log in to use the 24h hold guardrail.');
        setJournalAuthed(false);
      } else {
        alert('Could not log interest: ' + (e.message || 'unknown error'));
      }
    }
  }, [fetchJournal]);

  const markActed = useCallback(async (journalId, outcome) => {
    try {
      await apiPatch(`/api/picks-journal/${journalId}`, { outcome });
      await fetchJournal();
    } catch (e) {
      alert('Could not update journal entry: ' + (e.message || 'unknown error'));
    }
  }, [fetchJournal]);

  useEffect(() => {
    setLoading(true);
    apiGet('/api/stocks/score')
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message || 'Failed to load picks'); setLoading(false); });
  }, []);

  // Load cached AI reviews for all 3 categories on first render
  useEffect(() => {
    ['rebound', 'momentum', 'longterm'].forEach((cat) => {
      setAiLoading((p) => ({ ...p, [cat]: true }));
      apiGet(`/api/picks/ai-review?category=${cat}`)
        .then((d) => {
          setAiReviews((p) => ({ ...p, [cat]: d.reviews || {} }));
        })
        .catch(() => {
          setAiReviews((p) => ({ ...p, [cat]: {} }));
        })
        .finally(() => {
          setAiLoading((p) => ({ ...p, [cat]: false }));
        });
    });
  }, []);

  const runDeepReview = useCallback(async (category) => {
    if (aiRunning[category]) return;
    setAiRunning((p) => ({ ...p, [category]: true }));
    try {
      const d = await apiPost(`/api/picks/ai-review?category=${category}`, {});
      if (d && d.error) {
        alert('Deep AI Review failed: ' + d.error);
      }
      // Reload cached reviews
      const fresh = await apiGet(`/api/picks/ai-review?category=${category}`);
      setAiReviews((p) => ({ ...p, [category]: fresh.reviews || {} }));
    } catch (e) {
      alert('Deep AI Review failed: ' + (e.message || 'Unknown error'));
    } finally {
      setAiRunning((p) => ({ ...p, [category]: false }));
    }
  }, [aiRunning]);

  const toggleExpand = useCallback((category, sym) => {
    const k = `${category}:${sym}`;
    setAiExpanded((p) => {
      const copy = { ...p };
      if (copy[k]) delete copy[k];
      else copy[k] = true;
      return copy;
    });
  }, []);

  const setSort = useCallback((tabId, key) => {
    setSorts((p) => {
      const cur = p[tabId];
      if (cur.key === key) {
        return { ...p, [tabId]: { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } };
      }
      return { ...p, [tabId]: { key, dir: 'desc' } };
    });
  }, []);

  const stocks = Array.isArray(data?.stocks) ? data.stocks.filter(Boolean) : [];

  // Market-cap filter
  const filteredByGrp = useMemo(() => {
    if (marketCapFilter === 'ALL') return stocks;
    return stocks.filter((s) => (s.grp || '').toUpperCase().includes(marketCapFilter));
  }, [stocks, marketCapFilter]);

  // Build each tab's list: filter → sort → sector cap → top 25
  const tabPicks = useMemo(() => {
    const out = {};
    for (const tab of TABS) {
      const filtered = filteredByGrp.filter(tab.filter);
      const sortCfg = sorts[tab.id] || { key: tab.scoreField, dir: 'desc' };
      const sorted  = sortBy(filtered, sortCfg.key, sortCfg.dir);
      const capped  = applySectorCap(sorted, 2);
      // Inject bucket-fit reason client-side. The server attaches this to
      // its own `picksRebound/Momentum/LongTerm` arrays, but we re-derive
      // from the flat `stocks` array, so we also build the reason here.
      // Tab-specific: Rebound cites depth+RSI, Momentum cites tech signals,
      // Long-Term cites compounder fundamentals.
      out[tab.id] = capped.slice(0, 25).map((s) => ({
        ...s,
        pickBucketReason: buildBucketReason(s, tab.id),
      }));
    }
    return out;
  }, [filteredByGrp, sorts]);

  // Header stat counts (before cap)
  const counts = useMemo(() => ({
    total: stocks.length,
    rebound: stocks.filter((s) => s.isFallenAngel === true).length,
    momentum: stocks.filter((s) => s.composite != null && s.composite >= 55).length,
    longTerm: stocks.filter((s) => (s.scoreV2 || 0) >= 60).length,
    disqualified: stocks.filter((s) => s.disqualified).length,
    highRoe: stocks.filter((s) => s.roe != null && s.roe >= 15).length,
    goldenCross: stocks.filter((s) => s.goldenCross).length,
    nifty50: stocks.filter((s) => s.grp === 'NIFTY50').length,
    next50:  stocks.filter((s) => s.grp === 'NEXT50').length,
    midcap:  stocks.filter((s) => s.grp === 'MIDCAP').length,
    smallcap: stocks.filter((s) => s.grp === 'SMALLCAP').length,
  }), [stocks]);

  const filterPills = ['ALL', 'NIFTY50', 'NEXT50', 'MIDCAP', 'SMALLCAP'];
  const scopeLbl = marketCapFilter === 'ALL' ? 'All Stocks' : marketCapFilter;

  return (
    <div>
      {/* ═══ HERO BANNER ═══ */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(52,211,153,0.10) 50%, rgba(251,191,36,0.10) 100%)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: '32px 36px',
          marginBottom: 28,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(99,102,241,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div className="label-xs" style={{ marginBottom: 10 }}>Daily picks · Three strategies · Updated automatically</div>
            <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-1.2px', lineHeight: 1.05, color: 'var(--text)', marginBottom: 10 }}>
              <span className="gradient-fill">Stock Picks</span>
            </h1>
            <p style={{ fontSize: 16, color: 'var(--text2)', maxWidth: 720, lineHeight: 1.5 }}>
              {counts.total || 567} NSE stocks scored on three independent frameworks. Each carries 12 forward-looking risk flags, 7 hard disqualifiers, and max 2 per canonical sector. Full transparency.
            </p>
          </div>
          {counts.total > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div className="tabular-nums gradient-fill" style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, letterSpacing: '-2px' }}>
                {counts.total}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6, fontWeight: 500 }}>stocks scored</div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ STATS STRIP (extended: ROE, Golden Cross, market-cap splits) ═══ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 10,
          marginBottom: 20,
        }}
      >
        {[
          { l: 'Total',        v: counts.total,        c: 'var(--text)' },
          { l: 'Rebound',      v: counts.rebound,      c: 'var(--amber-text)' },
          { l: 'Momentum',     v: counts.momentum,     c: 'var(--green-text)' },
          { l: 'Long-Term',    v: counts.longTerm,     c: 'var(--brand-text)' },
          { l: 'ROE ≥15%',     v: counts.highRoe,      c: 'var(--green-text)', tip: 'Companies with ROE ≥ 15% — compounder candidates' },
          { l: 'Golden Cross', v: counts.goldenCross,  c: 'var(--amber-text)', tip: '50 DMA crossed above 200 DMA — bullish trend signal' },
          { l: 'Nifty50',      v: counts.nifty50,      c: 'var(--brand-text)' },
          { l: 'Next50',       v: counts.next50,       c: 'var(--text2)' },
          { l: 'Midcap',       v: counts.midcap,       c: 'var(--amber-text)' },
          { l: 'Smallcap',     v: counts.smallcap,     c: 'var(--green-text)' },
          { l: 'Disqualified', v: counts.disqualified, c: 'var(--red-text)', tip: 'Hard-disqualified (pledge >75%, D/E >5 non-fin, auditor red flag, SEBI, persistent losses, data <30%)' },
        ].map((s, i) => (
          <div
            key={i}
            className="card"
            style={{ padding: '14px 16px', cursor: s.tip ? 'help' : 'default' }}
            title={s.tip || ''}
          >
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
              {s.l}
            </div>
            <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, color: s.c, letterSpacing: '-0.6px', lineHeight: 1 }}>
              {loading ? '—' : s.v}
            </div>
          </div>
        ))}
      </div>

      {/* ═══ MARKET-CAP FILTER PILLS ═══ */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {filterPills.map((f) => (
          <button
            key={f}
            onClick={() => setMarketCapFilter(f)}
            style={{
              padding: '6px 14px',
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 600,
              background: marketCapFilter === f ? 'var(--brand)' : 'rgba(255,255,255,0.04)',
              color: marketCapFilter === f ? '#fff' : 'var(--text2)',
              border: `1px solid ${marketCapFilter === f ? 'var(--brand)' : 'var(--border)'}`,
              cursor: 'pointer',
              transition: 'all 180ms ease',
              fontFamily: 'inherit',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* ═══ SCORE LEGEND — how to read the three scores ═══ */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: 18,
          fontSize: 11,
        }}
      >
        <div style={{
          fontWeight: 700,
          color: 'var(--text)',
          fontSize: 11,
          letterSpacing: '0.8px',
          marginBottom: 10,
          textTransform: 'uppercase',
        }}>
          How to Read the Scores
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '140px 1fr',
          rowGap: 8,
          columnGap: 14,
          alignItems: 'center',
        }}>
          <span className="chip chip-amber" style={{ justifyContent: 'center', fontWeight: 700 }}>REBOUND</span>
          <span style={{ color: 'var(--text2)', lineHeight: 1.5, fontSize: 12 }}>
            Quality business pulled back ≥20% with RSI ≤52 — tradeable pullback setup
          </span>
          <span className="chip chip-green" style={{ justifyContent: 'center', fontWeight: 700 }}>MOMENTUM</span>
          <span style={{ color: 'var(--text2)', lineHeight: 1.5, fontSize: 12 }}>
            5-factor blend (FA 35 + Val 15 + TA 20 + Mom 15 + Risk 15) — high-conviction 1–3M trade
          </span>
          <span className="chip chip-brand" style={{ justifyContent: 'center', fontWeight: 700 }}>INVESTMENT</span>
          <span style={{ color: 'var(--text2)', lineHeight: 1.5, fontSize: 12 }}>
            Varsity 4-pillar (Quality 40 + Growth 25 + Val 20 + Business 15) — fundamentals only, 12M hold
          </span>
        </div>
      </div>

      {/* ═══ QUICK-START BARS — one-click top picks → Deep Analyzer ═══ */}
      {!loading && !error && (
        <QuickStartBars tabPicks={tabPicks} />
      )}

      {/* ═══ ERROR ═══ */}
      {error && (
        <div className="card" style={{ padding: 24, color: 'var(--red-text)' }}>
          Failed to load picks: {error}
        </div>
      )}

      {/* ═══ LOADING SKELETONS (3-COLUMN) ═══ */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          {[...Array(3)].map((_, colIdx) => (
            <div key={colIdx} className="card" style={{ padding: 20, opacity: 0.5 }}>
              <div style={{ height: 22, background: 'var(--bg3)', borderRadius: 6, marginBottom: 16, width: '60%' }} />
              {[...Array(8)].map((__, rowIdx) => (
                <div key={rowIdx} style={{ height: 44, background: 'var(--bg3)', borderRadius: 8, marginBottom: 8, opacity: 0.7 - rowIdx * 0.05 }} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ═══ THREE-COLUMN PICKS ═══ */}
      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
          {TABS.map((tab) => {
            const picks = tabPicks[tab.id] || [];
            const totalBeforeCap = filteredByGrp.filter(tab.filter).length;
            return (
              <PicksColumn
                key={tab.id}
                tab={tab}
                picks={picks}
                totalAvailable={totalBeforeCap}
                scopeLbl={scopeLbl}
                sort={sorts[tab.id]}
                onSort={(k) => setSort(tab.id, k)}
                aiReviews={aiReviews[tab.id] || {}}
                aiLoading={!!aiLoading[tab.id]}
                aiRunning={!!aiRunning[tab.id]}
                onRunReview={() => runDeepReview(tab.id)}
                aiExpanded={aiExpanded}
                onToggleExpand={toggleExpand}
                journalMap={journalMap}
                journalAuthed={journalAuthed}
                onLogInterest={logInterest}
                onMarkActed={markActed}
              />
            );
          })}
        </div>
      )}

      {/* ═══ PICKS PERFORMANCE TRACKER (Phase 0) ═══ */}
      {!loading && !error && (
        <TrackerPanel />
      )}

      {/* ═══ MY JOURNAL — 24h behavioral-hold log (Phase 0C) ═══
          Surfaces every "Log interest" click the user has made, with its
          countdown state (cooling / ready) and an outcome stamp once they
          act. Renders for logged-in users only; cleanly hidden for guest
          views so the page doesn't scream LOGIN at casual browsers. */}
      {!loading && !error && journalAuthed && (
        <JournalPanel
          journal={journal}
          journalLoading={journalLoading}
          onMarkActed={markActed}
          onRefresh={fetchJournal}
        />
      )}

      {/* ═══ SCORING METHODOLOGY ═══ */}
      {!loading && !error && (
        <div className="card" style={{ padding: 16, marginTop: 18 }}>
          <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13, marginBottom: 10 }}>
            Scoring Methodology · 100 Points
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { name: 'Quality',   pts: 25, c: 'var(--amber-text)', factors: 'ROE · ROA/ROCE · Debt/Equity · Operating Margin · Percentile vs sector peers' },
              { name: 'Value',     pts: 20, c: 'var(--green-text)', factors: 'P/E ratio · P/B ratio · PEG (growth-adj value) · Dividend Yield · NSE Value 50 methodology' },
              { name: 'Momentum',  pts: 20, c: 'var(--brand-text)', factors: '52-week price return · % from 52w high · Beta · NSE Momentum index methodology' },
              { name: 'Growth',    pts: 20, c: 'var(--purple-text)', factors: 'Revenue growth YoY · EPS growth YoY · Analyst consensus (NSE + Screener.in)' },
              { name: 'Technical', pts: 15, c: 'var(--red-text)', factors: 'Price vs 50 DMA · Price vs 200 DMA · Golden/Death Cross · Volume accumulation' },
            ].map((p) => (
              <div
                key={p.name}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  flex: 1,
                  minWidth: 180,
                }}
              >
                <div style={{ color: p.c, fontWeight: 700, fontSize: 11, letterSpacing: '0.3px' }}>
                  {p.name} <span style={{ opacity: 0.7 }}>{p.pts} pts</span>
                </div>
                <div style={{ color: 'var(--text3)', fontSize: 10, marginTop: 4, lineHeight: 1.5 }}>
                  {p.factors}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text4)' }}>
            Data: NSE + Screener.in v11 fundamentals · All scores percentile-ranked within sector · Refreshed daily 7AM IST · Source: NSE Quality/Value/Momentum index methodology
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Column component — renders one of the three tabs
// ══════════════════════════════════════════════════════════════════════
function PicksColumn({
  tab, picks, totalAvailable, scopeLbl,
  sort, onSort,
  aiReviews, aiLoading, aiRunning, onRunReview,
  aiExpanded, onToggleExpand,
  journalMap, journalAuthed, onLogInterest, onMarkActed,
}) {
  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: 'hidden',
        border: `1px solid ${tab.accentBorder}`,
      }}
    >
      {/* Column header */}
      <div style={{
        padding: '18px 20px 14px',
        borderBottom: '1px solid var(--border)',
        background: tab.accentSoft,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: tab.accent, letterSpacing: '-0.1px' }}>
            {tab.label}
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, marginLeft: 6 }}>
              · {scopeLbl}
            </span>
          </h3>
          <span className="chip" style={{
            fontSize: 10,
            height: 20,
            padding: '0 7px',
            fontWeight: 700,
            background: tab.accentSoft,
            color: tab.accent,
            border: `1px solid ${tab.accentBorder}`,
          }}>
            {picks.length}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.45, marginBottom: 10 }}>
          {tab.desc}
        </div>

        {/* Deep AI Review button */}
        <button
          onClick={onRunReview}
          disabled={aiRunning}
          title={`Run Deep AI Review on the top 10 ${tab.label} across all 5 AI models (full Varsity payload per stock).`}
          style={{
            background: aiRunning
              ? 'rgba(124,58,237,0.25)'
              : `linear-gradient(135deg, #8B5CF6, ${tab.accent})`,
            color: '#fff',
            border: 'none',
            borderRadius: 9999,
            padding: '6px 14px',
            fontSize: 11.5,
            fontWeight: 700,
            cursor: aiRunning ? 'wait' : 'pointer',
            opacity: aiRunning ? 0.7 : 1,
            boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
            fontFamily: 'inherit',
            transition: 'all 180ms ease',
          }}
        >
          {aiRunning ? '🧠 Running…' : '🧠 Deep AI Review'}
        </button>
      </div>

      {/* Sortable header row */}
      {picks.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '24px 1fr 80px 72px',
            gap: 6,
            padding: '10px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.02)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: 'var(--text3)',
          }}
        >
          <span>#</span>
          <SortHeader label="Stock" sortKey="sym" sort={sort} onSort={onSort} align="left" />
          <SortHeader label="Score" sortKey={tab.scoreField} sort={sort} onSort={onSort} align="right" />
          <SortHeader label="Price" sortKey="price" sort={sort} onSort={onSort} align="right" />
        </div>
      )}

      {/* Column body */}
      {picks.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          No stocks clear all gates right now.
        </div>
      )}
      {picks.map((s, idx) => (
        <PickRow
          key={s.sym}
          stock={s}
          rank={idx + 1}
          tab={tab}
          aiReviews={aiReviews[s.sym]}
          aiLoading={aiLoading}
          expanded={!!aiExpanded[`${tab.id}:${s.sym}`]}
          onToggle={() => onToggleExpand(tab.id, s.sym)}
          journalEntry={journalMap ? journalMap[`${tab.id}:${s.sym}`] : null}
          journalAuthed={journalAuthed}
          onLogInterest={onLogInterest}
          onMarkActed={onMarkActed}
        />
      ))}

      {/* Top-N-of-M overflow indicator */}
      {totalAvailable > picks.length && picks.length >= 25 && (
        <div style={{
          textAlign: 'center',
          padding: 10,
          fontSize: 10,
          color: 'var(--text4)',
          borderTop: '1px solid var(--border)',
        }}>
          Showing top {picks.length} of {totalAvailable} · see full data in <b style={{ color: 'var(--text3)' }}>Stock Data</b> tab
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Sortable header cell
// ══════════════════════════════════════════════════════════════════════
function SortHeader({ label, sortKey, sort, onSort, align }) {
  const active = sort && sort.key === sortKey;
  const arrow = active ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅';
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onSort(sortKey); }}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        color: active ? 'var(--brand-text)' : 'var(--text3)',
        textAlign: align || 'right',
        padding: 0,
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}{' '}
      <span style={{ opacity: active ? 1 : 0.4, fontSize: 9, marginLeft: 2 }}>
        {arrow}
      </span>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Per-stock row — compact with expand-on-click to see AI reviews + flags
// ══════════════════════════════════════════════════════════════════════
function PickRow({
  stock: s, rank, tab, aiReviews, aiLoading, expanded, onToggle,
  journalEntry, journalAuthed, onLogInterest, onMarkActed,
}) {
  const rawScore = s[tab.scoreField];
  const score = rawScore != null ? Math.round(rawScore * 10) / 10 : null;
  const rawOrig = s[tab.scoreRaw];
  const priceStr = s.price != null ? `₹${Number(s.price).toLocaleString('en-IN', { maximumFractionDigits: 1 })}` : '—';

  // ═══ Phase 0C — 24h behavioral hold ═══
  // journalEntry, if present, represents the user's most-recent "log interest"
  // for this (sym,bucket). Compute the countdown against its decided_at.
  const nowMs = Date.now();
  let journalState = 'none';    // 'none' | 'cooling' | 'ready' | 'acted'
  let holdSecondsLeft = 0;
  let holdReadyAtMs = null;
  if (journalEntry) {
    if (journalEntry.acted_outcome) {
      journalState = 'acted';
    } else {
      const decidedMs = new Date(journalEntry.decided_at).getTime();
      const readyMs = decidedMs + 24 * 3600 * 1000;
      holdReadyAtMs = readyMs;
      if (nowMs >= readyMs) journalState = 'ready';
      else { journalState = 'cooling'; holdSecondsLeft = Math.max(0, Math.floor((readyMs - nowMs) / 1000)); }
    }
  }
  const fmtCountdown = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h >= 1) return `${h}h ${m}m`;
    return `${m}m`;
  };
  // Risk flags live on different fields per bucket:
  //   Rebound  → fallenRiskFlags
  //   Momentum → compositeRiskFlags
  //   LongTerm → riskFlags
  // Fall back to s.riskFlags if tab.scoreFlags isn't set (defensive).
  const flagsField = tab.scoreFlags || 'riskFlags';
  const flags = Array.isArray(s[flagsField]) ? s[flagsField] : (Array.isArray(s.riskFlags) ? s.riskFlags : []);
  const disq = s.disqualifier;
  const penaltyDelta = (rawOrig != null && rawScore != null) ? +(rawOrig - rawScore).toFixed(1) : 0;
  const wasPenalised = penaltyDelta > 0;

  // AI review badges (top 10 only — match old server scoping)
  const showAiBadges = rank <= 10;
  const council = Array.isArray(aiReviews) ? aiReviews.filter((r) => r.model_id !== 'ai-judge') : [];
  const judge = Array.isArray(aiReviews) ? aiReviews.find((r) => r.model_id === 'ai-judge') : null;
  const aiCounts = { AGREE: 0, CAUTION: 0, DISAGREE: 0, NO_REVIEW: 0 };
  council.forEach((r) => {
    const v = (r.verdict || 'NO_REVIEW').toUpperCase();
    if (aiCounts[v] != null) aiCounts[v]++;
    else aiCounts.CAUTION++;
  });
  const hasReviews = council.length > 0;

  return (
    <div
      style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      onClick={onToggle}
    >
      {/* Top row — mirrors the column-header grid (24px rank · 1fr stock · 80px score · 72px price)
          so each sub-number aligns under its header. Previously this was a flex row with a single
          right-aligned div that collapsed score + quality + price under the PRICE column, leaving
          SCORE visually empty. */}
      <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 80px 72px', gap: 6, alignItems: 'start' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'right', paddingTop: 2 }}>
          {rank}.
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.2px' }}>
              {s.sym}
            </span>
            {s.grp && (
              <span className="chip" style={{ height: 18, fontSize: 9, padding: '0 6px', fontWeight: 700, letterSpacing: '0.4px' }}>
                {s.grp}
              </span>
            )}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text3)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.sector || s.name || '—'}
          </div>
          {/* pickBucketReason — short string explaining why this stock cleared
              the bucket's gate. Italic sub-line so the bucket fit is never opaque. */}
          {s.pickBucketReason && (
            <div
              style={{
                fontSize: 10,
                color: 'var(--brand-text)',
                marginTop: 3,
                fontStyle: 'italic',
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title="Bucket-fit reason"
            >
              {s.pickBucketReason}
            </div>
          )}
        </div>
        {/* SCORE column — main bucket-rank number, labeled, with Quality sub-score
            (non-longterm) or expected-return hint (longterm). */}
        <div style={{ textAlign: 'right' }}>
          <div
            className="tabular-nums"
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: scoreColor(score, tab.id),
              letterSpacing: '-0.4px',
              lineHeight: 1,
            }}
          >
            {score != null ? score : '—'}
          </div>
          <div
            title={
              tab.id === 'rebound' ? 'FallenScore — depth-of-fall from 52w high × preserved fundamentals'
              : tab.id === 'momentum' ? 'Composite — fundamentals 35% + valuation 15% + technicals 20% + momentum 15% + risk 15%'
              : 'Quality Score — Varsity 4-pillar (ROE/growth/D-E/moat/mgmt)'
            }
            style={{
              fontSize: 8.5,
              color: 'var(--text4)',
              marginTop: 2,
              fontWeight: 600,
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
            }}
          >
            {tab.id === 'rebound' ? 'Fallen Score'
             : tab.id === 'momentum' ? 'Momentum'
             : 'Quality'}
          </div>
          {tab.id !== 'longterm' && s.scoreV2 != null && (
            <div
              className="tabular-nums"
              title={`Quality gate (scoreV2 ≥ ${tab.id === 'rebound' ? '55' : '50'} required to appear in this bucket). Varsity 4-pillar fundamental score 0-100.`}
              style={{
                fontSize: 9.5,
                color:
                  s.scoreV2 >= 70 ? 'var(--green-text)'
                  : s.scoreV2 >= (tab.id === 'rebound' ? 55 : 50) ? 'var(--amber-text)'
                  : 'var(--red-text)',
                marginTop: 4,
                fontWeight: 700,
              }}
            >
              Quality {Math.round(s.scoreV2)}
            </div>
          )}
          {tab.id === 'longterm' && s.expectedReturn != null && (
            <div
              className="tabular-nums"
              title={`Calibrated 6M expected return from bucket-stats history${
                s.expectedReturnNudge != null && s.expectedReturnNudge !== 0
                  ? ` (incl. ${s.expectedReturnNudge >= 0 ? '+' : ''}${s.expectedReturnNudge}pp ext. signals)`
                  : ''
              }`}
              style={{ fontSize: 9.5, color: 'var(--brand-text)', marginTop: 2, fontWeight: 600 }}
            >
              ≈{s.expectedReturn >= 0 ? '+' : ''}{Number(s.expectedReturn).toFixed(1)}% / 6M
            </div>
          )}
        </div>
        {/* PRICE column */}
        <div style={{ textAlign: 'right' }}>
          <div className="tabular-nums" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
            {priceStr}
          </div>
        </div>
      </div>

      {/* Disqualifier banner (rare, bold red) */}
      {disq && (
        <div style={{
          marginTop: 8,
          padding: '6px 10px',
          background: 'rgba(239,68,68,0.12)',
          border: '1.5px solid var(--red)',
          borderRadius: 6,
          fontSize: 10,
          fontWeight: 800,
          color: 'var(--red-text)',
          letterSpacing: '0.4px',
        }}
        title={disq.reason || ''}
        >
          🚫 EXCLUDED — {String(disq.code || '').replace(/_/g, ' ')}
        </div>
      )}

      {/* AI Review badges (council tally + judge verdict) */}
      {showAiBadges && hasReviews && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          {aiCounts.AGREE > 0 && (
            <span className="chip chip-green" style={{ fontSize: 9.5, height: 18, padding: '0 6px', fontWeight: 700 }}>
              {aiCounts.AGREE} AI ✓
            </span>
          )}
          {aiCounts.CAUTION > 0 && (
            <span className="chip chip-amber" style={{ fontSize: 9.5, height: 18, padding: '0 6px', fontWeight: 700 }}>
              {aiCounts.CAUTION} AI ⚠
            </span>
          )}
          {aiCounts.DISAGREE > 0 && (
            <span className="chip chip-red" style={{ fontSize: 9.5, height: 18, padding: '0 6px', fontWeight: 700 }}>
              {aiCounts.DISAGREE} AI ✗
            </span>
          )}
          {judge && judge.verdict && (() => {
            const jv = String(judge.verdict || '').toUpperCase();
            const cls = jv === 'AGREE' ? 'chip-green' : jv === 'CAUTION' ? 'chip-amber' : jv === 'DISAGREE' ? 'chip-red' : '';
            const jl = jv === 'AGREE' ? '✓ BUY' : jv === 'CAUTION' ? '⚠ HOLD' : jv === 'DISAGREE' ? '✗ AVOID' : '— N/A';
            return (
              <span
                className={`chip ${cls}`}
                title="Claude Sonnet 4.6 final synthesis"
                style={{ fontSize: 9.5, height: 18, padding: '0 8px', fontWeight: 700, letterSpacing: '0.3px' }}
              >
                ⚖ JUDGE {jl}
                {judge.confidence != null && (
                  <span style={{ marginLeft: 4, opacity: 0.75 }}>{Math.round(judge.confidence)}%</span>
                )}
              </span>
            );
          })()}
        </div>
      )}
      {showAiBadges && !hasReviews && !aiLoading && (
        <div style={{ marginTop: 6, fontSize: 9.5, color: 'var(--text4)', fontStyle: 'italic' }}>
          No AI review yet — click "Deep AI Review" above
        </div>
      )}

      {/* Risk flag badges — compact short-code chips (always visible) */}
      {flags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {flags.map((fl, i) => {
            const c = severityColors(fl.severity);
            const short = FLAG_LABELS[fl.code] || fl.code;
            return (
              <span
                key={i}
                title={fl.label || ''}
                style={{
                  background: c.bg,
                  color: c.fg,
                  border: `1px solid ${c.border}`,
                  borderRadius: 4,
                  padding: '1px 6px',
                  fontSize: 9.5,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {short}
              </span>
            );
          })}
        </div>
      )}

      {/* ═══ Penalty explainer — ALWAYS visible when score was penalised ═══
          Previously this block only rendered inside `{expanded && ...}` which
          confused users: they saw a "FALLEN SCORE 39" with no obvious reason.
          Rendered inline (not expand-gated) so the WHY sits right under the
          stock's sub-metrics row. */}
      {wasPenalised && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px dashed var(--border)',
            fontSize: 11,
            color: 'var(--text2)',
            lineHeight: 1.55,
          }}
        >
          <div style={{ marginBottom: flags.length > 0 ? 6 : 0, color: 'var(--text3)' }}>
            Raw score:{' '}
            <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--text)' }}>
              {Math.round((rawOrig ?? 0) * 10) / 10}
            </span>
            <span style={{ margin: '0 6px', color: 'var(--text4)' }}>→</span>
            Penalised:{' '}
            <span className="tabular-nums" style={{ fontWeight: 700, color: tab.accent }}>
              {score}
            </span>
            <span style={{ marginLeft: 6, color: 'var(--red-text)', fontWeight: 700 }}>
              (−{penaltyDelta})
            </span>
          </div>
          {flags.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {flags.slice(0, 4).map((fl, i) => {
                const plainEnglish = FLAG_EXPLANATIONS[fl.code];
                return (
                  <div key={i}>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: plainEnglish ? 3 : 0 }}>
                      <span style={{ color: severityColors(fl.severity).fg, fontWeight: 700 }}>
                        [{fl.severity}]
                      </span>{' '}
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{fl.label}</span>{' '}
                      <span style={{ color: 'var(--text3)' }}>(−{fl.penalty})</span>
                    </div>
                    {plainEnglish && (
                      <div style={{
                        fontSize: 11,
                        color: 'var(--text3)',
                        lineHeight: 1.55,
                        paddingLeft: 10,
                        borderLeft: `2px solid ${severityColors(fl.severity).border || 'var(--border2)'}`,
                        fontStyle: 'italic',
                      }}>
                        {plainEnglish}
                      </div>
                    )}
                  </div>
                );
              })}
              {flags.length > 4 && (
                <div style={{ fontSize: 10.5, color: 'var(--text4)', fontStyle: 'italic', marginTop: 2 }}>
                  + {flags.length - 4} more flag{flags.length - 4 === 1 ? '' : 's'} not shown.
                </div>
              )}
            </div>
          )}
          {flags.length === 0 && (
            <div style={{ color: 'var(--text3)', fontSize: 11, lineHeight: 1.55 }}>
              <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 3 }}>
                Score adjusted by an upstream filter
              </div>
              <div style={{ fontStyle: 'italic', color: 'var(--text4)' }}>
                No single risk flag fired on this stock, but an upstream gate trimmed the score —
                likely one of: sector cap (too many picks from the same sector already qualified),
                VIX regime tilt (market-wide volatility dampens ranks), or an external-signals
                nudge (news / analyst consensus). See the Architecture tab for the full list.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Clean signal card — renders when a pick made the cut cleanly (no
          penalty at all). Gives every row a human-readable bottom line so
          Momentum / LongTerm picks — which rarely trigger risk flags — stop
          looking eerily blank underneath. */}
      {!wasPenalised && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px dashed var(--border)',
            fontSize: 11,
            color: 'var(--text2)',
            lineHeight: 1.55,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{
              fontSize: 13,
              color: 'var(--green-text)',
              fontWeight: 700,
              lineHeight: 1,
              marginTop: 1,
            }}>
              ✓
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--green-text)', marginBottom: 2 }}>
                Clean signal — no risk flags firing
              </div>
              <div style={{ color: 'var(--text3)', fontStyle: 'italic', fontSize: 10.5 }}>
                {tab.id === 'rebound'
                  ? 'Passed all 6 disqualifiers, 11 risk-flag detectors, scoreV2 ≥ 55 quality gate, and rebound confirmation checks. No penalty applied.'
                  : tab.id === 'momentum'
                  ? 'Passed scoreV2 ≥ 50 quality gate, all disqualifiers, all risk-flag detectors, sector cap, and VIX regime tilt. Score is this stock on its own merits.'
                  : 'Passed Varsity 4-pillar Investment Score ≥ 60 + ROE ≥ 12% + D/E ≤ 2 + non-negative EPS growth + no severe drawdown. Score is this stock on its own merits.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Phase 0C — 24h Hold Guardrail (journal) ═══
          Always-visible strip at the bottom of every pick card so the
          behavioral layer is discoverable without digging into tabs. States:
          • none    → "🗒 Log interest (24h hold)" button → logs intent to DB
          • cooling → shows cooldown pill with live countdown
          • ready   → shows green "Ready to act" + Bought/Passed/Watching
          • acted   → shows frozen stamp, e.g. "✓ Acted: BOUGHT"
          Click on any button is stopPropagation'd so the row's expand toggle
          isn't accidentally fired. */}
      {journalAuthed && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px dashed var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {journalState === 'none' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (typeof onLogInterest === 'function') {
                  const reason = window.prompt(
                    `Why are you interested in ${s.sym} (${tab.label})?\n\nStart a 24h hold — you can act after the cooldown.`,
                    ''
                  );
                  if (reason === null) return; // user cancelled
                  onLogInterest(s.sym, tab.id, reason);
                }
              }}
              title="Start a 24h behavioral hold before acting — retail alpha boost per research"
              style={{
                background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(124,58,237,0.12))',
                color: 'var(--text)',
                border: '1px solid var(--border2)',
                borderRadius: 9999,
                padding: '4px 12px',
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.3px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 150ms ease',
              }}
            >
              🗒 Log interest <span style={{ color: 'var(--text3)', fontWeight: 500 }}>· 24h hold</span>
            </button>
          )}

          {journalState === 'cooling' && (
            <>
              <span
                className="chip"
                title={`You logged interest at ${new Date(journalEntry.decided_at).toLocaleString()}. Action unlocks after 24h.`}
                style={{
                  fontSize: 10.5,
                  height: 22,
                  padding: '0 10px',
                  fontWeight: 700,
                  background: 'rgba(251,191,36,0.14)',
                  color: 'var(--amber-text)',
                  border: '1px solid rgba(251,191,36,0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                ⏳ Cooling down · {fmtCountdown(holdSecondsLeft)}
              </span>
              <span style={{ fontSize: 9.5, color: 'var(--text4)', fontStyle: 'italic' }}>
                Logged at {new Date(journalEntry.decided_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </>
          )}

          {journalState === 'ready' && (
            <>
              <span
                className="chip"
                title="24h hold cleared — ready to act with a cooler head"
                style={{
                  fontSize: 10.5,
                  height: 22,
                  padding: '0 10px',
                  fontWeight: 800,
                  background: 'rgba(34,197,94,0.16)',
                  color: 'var(--green-text)',
                  border: '1px solid rgba(34,197,94,0.4)',
                  letterSpacing: '0.3px',
                }}
              >
                ✓ READY TO ACT
              </span>
              <JournalActionButton label="Bought"   color="var(--green-text)" onClick={() => onMarkActed && onMarkActed(journalEntry.journal_id, 'bought')} />
              <JournalActionButton label="Passed"   color="var(--red-text)"   onClick={() => onMarkActed && onMarkActed(journalEntry.journal_id, 'passed')} />
              <JournalActionButton label="Watching" color="var(--amber-text)" onClick={() => onMarkActed && onMarkActed(journalEntry.journal_id, 'watching')} />
            </>
          )}

          {journalState === 'acted' && (
            <span
              className="chip"
              title={`Decision recorded on ${new Date(journalEntry.acted_at || journalEntry.decided_at).toLocaleString()}`}
              style={{
                fontSize: 10.5,
                height: 22,
                padding: '0 10px',
                fontWeight: 700,
                background: journalEntry.acted_outcome === 'bought'   ? 'rgba(34,197,94,0.14)'
                          : journalEntry.acted_outcome === 'passed'   ? 'rgba(239,68,68,0.12)'
                          : 'rgba(251,191,36,0.12)',
                color:      journalEntry.acted_outcome === 'bought'   ? 'var(--green-text)'
                          : journalEntry.acted_outcome === 'passed'   ? 'var(--red-text)'
                          : 'var(--amber-text)',
                border:  '1px solid var(--border2)',
                letterSpacing: '0.3px',
              }}
            >
              ✓ Acted: {String(journalEntry.acted_outcome || '').toUpperCase()}
            </span>
          )}
        </div>
      )}

      {/* Expanded detail — AI council verdicts only (penalty block is now inline above) */}
      {expanded && showAiBadges && hasReviews && (
        <div style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px solid var(--border)',
          fontSize: 11,
          color: 'var(--text2)',
          lineHeight: 1.55,
        }}>
          <ExpandedAIReview council={council} judge={judge} sym={s.sym} />
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Expanded AI council + judge panel
// ══════════════════════════════════════════════════════════════════════
function ExpandedAIReview({ council, judge, sym }) {
  function verdictColor(v) {
    const u = String(v || 'NO_REVIEW').toUpperCase();
    if (u === 'AGREE')    return 'var(--green-text)';
    if (u === 'CAUTION')  return 'var(--amber-text)';
    if (u === 'DISAGREE') return 'var(--red-text)';
    return 'var(--text3)';
  }
  function verdictIcon(v) {
    const u = String(v || 'NO_REVIEW').toUpperCase();
    if (u === 'AGREE')    return '✓';
    if (u === 'CAUTION')  return '⚠';
    if (u === 'DISAGREE') return '✗';
    return '‼';
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--text3)',
        marginBottom: 6,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
      }}>
        AI Council · {sym}{' '}
        <span style={{ color: 'var(--text4)', fontWeight: 500, textTransform: 'none' }}>
          (5 models vote · judge synthesises)
        </span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 6,
        marginBottom: judge ? 10 : 0,
      }}>
        {council.map((rv, i) => {
          const v = String(rv.verdict || 'NO_REVIEW').toUpperCase();
          const vCol = verdictColor(v);
          return (
            <div
              key={i}
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${vCol}`,
                borderRadius: 6,
                padding: '8px 10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <span style={{ color: vCol, fontWeight: 800, fontSize: 11 }}>
                  {verdictIcon(v)} {v}
                </span>
                <span style={{ color: 'var(--text4)', fontSize: 9 }}>
                  · {rv.model_name || rv.model_id}
                </span>
                {rv.confidence != null && (
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text3)' }}>
                    {rv.confidence}%
                  </span>
                )}
              </div>
              {rv.varsity_reasoning && (
                <div style={{ fontSize: 10, color: 'var(--text2)', lineHeight: 1.4, marginBottom: 4 }}>
                  <span style={{ color: 'var(--brand-text)', fontWeight: 700, fontSize: 8, letterSpacing: '0.5px' }}>
                    📘 VARSITY
                  </span>
                  {' '}
                  {rv.varsity_reasoning}
                </div>
              )}
              {rv.pure_reasoning && (
                <div style={{ fontSize: 10, color: 'var(--text2)', lineHeight: 1.4 }}>
                  <span style={{ color: 'var(--purple-text)', fontWeight: 700, fontSize: 8, letterSpacing: '0.5px' }}>
                    🧠 PURE
                  </span>
                  {' '}
                  {rv.pure_reasoning}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {judge && judge.verdict && (() => {
        const jv = String(judge.verdict || '').toUpperCase();
        const jCol = verdictColor(jv);
        return (
          <div style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(34,211,238,0.08))',
            border: `1px solid ${jCol}`,
            borderLeft: `3px solid ${jCol}`,
            borderRadius: 6,
            padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span className="gradient-fill" style={{ fontWeight: 900, fontSize: 11, letterSpacing: '1px' }}>
                ⚖ AI JUDGE · FINAL
              </span>
              <span style={{ color: 'var(--text4)', fontSize: 9 }}>
                · {judge.model_name || 'Claude Sonnet 4.6'}
              </span>
              <span style={{ color: jCol, fontWeight: 800, fontSize: 12, marginLeft: 'auto' }}>
                {verdictIcon(jv)} {jv}
              </span>
              {judge.confidence != null && (
                <span style={{ fontSize: 9, color: 'var(--text3)' }}>{judge.confidence}%</span>
              )}
            </div>
            {judge.varsity_reasoning && (
              <div style={{ fontSize: 10.5, color: 'var(--text2)', lineHeight: 1.45, marginBottom: 4 }}>
                {judge.varsity_reasoning}
              </div>
            )}
            {judge.recommendation && (
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                <b style={{ color: 'var(--text2)' }}>Rec:</b> {judge.recommendation}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Quick-start bars — top 5 per strategy as one-click tiles → Deep Analyzer
// ══════════════════════════════════════════════════════════════════════
// NOTE: ids MUST match TABS[].id ('rebound' | 'momentum' | 'longterm').
// Using 'investment' here — the pre-unification tab name — silently returns
// no picks because tabPicks is keyed by tab.id, so QuickStartBars renders
// null for Long-Term. Fixed to use 'longterm' to match TABS.
const QS_STRATEGIES = [
  { id: 'rebound', label: 'Rebound', color: 'var(--amber-text)', bg: 'var(--amber-bg)', icon: '🔄' },
  { id: 'momentum', label: 'Momentum', color: 'var(--green-text)', bg: 'var(--green-bg)', icon: '⚡' },
  { id: 'longterm', label: 'Long-Term', color: 'var(--brand-text)', bg: 'var(--brand-bg)', icon: '🏛' },
];

function QuickStartBars({ tabPicks }) {
  const analyzeStock = useAppStore((s) => s.analyzeStock);

  return (
    <div style={{ marginBottom: 20 }}>
      {QS_STRATEGIES.map((strat) => {
        const picks = (tabPicks[strat.id] || []).slice(0, 5);
        if (!picks.length) return null;
        return (
          <div
            key={strat.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              marginBottom: 8,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border)',
              borderLeft: `3px solid ${strat.color.replace('var(', '').replace(')', '')}`,
              borderLeftColor: strat.color,
              borderRadius: 12,
            }}
          >
            <span style={{
              fontSize: 13, fontWeight: 700, color: strat.color,
              minWidth: 110, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {strat.icon} {strat.label} →
            </span>
            {picks.map((s) => (
              <button
                key={s.sym}
                onClick={() => analyzeStock(s.sym)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 180ms ease',
                  color: 'var(--text)',
                  fontSize: 13,
                  fontWeight: 600,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = strat.color;
                  e.currentTarget.style.background = strat.bg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }}
              >
                {s.sym}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TRACKER PANEL — Phase 0 paper-tracker UI
// Collapsed by default. When expanded, fetches /api/picks-tracker/stats and
// renders per-bucket hit-rate vs NIFTY, rolling alpha, flag attribution,
// conviction attribution, winners/losers. Horizon selector: T+5, T+20, T+60.
// This is the evidence layer — how we know whether the picks system actually
// adds alpha versus just indexing NIFTY.
// ══════════════════════════════════════════════════════════════════════
const BUCKET_ACCENT = {
  rebound:  { color: 'var(--amber-text)', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.25)'  },
  momentum: { color: 'var(--green-text)', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.25)'  },
  longterm: { color: 'var(--brand-text)', bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.25)'  },
};
const BUCKET_LABEL = { rebound: 'Rebound', momentum: 'Momentum', longterm: 'Long-Term' };

function fmtPct(v, digits = 2) {
  if (v == null || !Number.isFinite(+v)) return '—';
  return (v >= 0 ? '+' : '') + (+v).toFixed(digits) + '%';
}
function alphaColor(v) {
  if (v == null) return 'var(--text3)';
  if (v > 2) return 'var(--green-text)';
  if (v > 0) return 'var(--amber-text)';
  return 'var(--red-text)';
}

function TrackerPanel() {
  // Default-open so users see the tracker immediately — Phase 0 is meant
  // to be loud and visible. If the panel is in cold-start, the prominent
  // "recording in progress" card makes clear what's happening.
  const [open, setOpen] = useState(true);
  const [horizon, setHorizon] = useState('t20');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const fetchStats = useCallback(async (h) => {
    setLoading(true);
    setErr(null);
    try {
      const r = await apiGet(`/api/picks-tracker/stats?horizon=${h}`);
      if (r && r.ok) setData(r);
      else { setErr(r && r.error ? r.error : 'no data'); setData(null); }
    } catch (e) {
      setErr(e.message || 'fetch failed');
      setData(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (open) fetchStats(horizon);
  }, [open, horizon, fetchStats]);

  const meta = data?.meta || {};
  const coldStart = !data || (meta.total_outcomes || 0) === 0;

  return (
    <div className="card" style={{ marginTop: 18, padding: 0, overflow: 'hidden' }}>
      {/* Collapsible header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', textAlign: 'left',
          padding: '14px 18px',
          background: open ? 'rgba(99,102,241,0.08)' : 'transparent',
          border: 'none',
          borderBottom: open ? '1px solid var(--border)' : 'none',
          color: 'var(--text)',
          fontFamily: 'inherit',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'background 220ms ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📊</span>
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            Picks Performance Tracker
          </span>
          <span className="label-xs" style={{ color: 'var(--text3)' }}>
            · Alpha vs NIFTY · Evidence over opinion
          </span>
        </div>
        <span style={{
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 220ms ease',
          color: 'var(--text3)', fontSize: 14,
        }}>▾</span>
      </button>

      {open && (
        <div style={{ padding: 18 }}>
          {/* Horizon selector */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <span className="label-xs" style={{ marginRight: 4 }}>Horizon:</span>
            {[
              { id: 't5',  label: 'T+5 days',  desc: '5 calendar days — short-term setups' },
              { id: 't20', label: 'T+20 days', desc: '20 calendar days — swing horizon' },
              { id: 't60', label: 'T+60 days', desc: '60 calendar days — position trade' },
            ].map(h => (
              <button
                key={h.id}
                onClick={() => setHorizon(h.id)}
                title={h.desc}
                style={{
                  padding: '5px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  background: horizon === h.id ? 'var(--brand)' : 'rgba(255,255,255,0.04)',
                  color: horizon === h.id ? '#fff' : 'var(--text2)',
                  border: `1px solid ${horizon === h.id ? 'var(--brand)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 180ms ease',
                }}
              >
                {h.label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            {data && (
              <span className="label-xs" style={{ color: 'var(--text3)' }}>
                {meta.total_picks || 0} picks tracked · {meta.total_outcomes || 0} outcomes at {horizon.toUpperCase()} · {meta.days_tracked || 0} days
              </span>
            )}
          </div>

          {/* Loading / error / cold-start */}
          {loading && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>Loading tracker data…</div>
          )}
          {!loading && err && (
            <div style={{ padding: 16, color: 'var(--red-text)', fontSize: 13 }}>
              Tracker unavailable: {err}
            </div>
          )}
          {!loading && !err && coldStart && (
            <div style={{
              padding: '20px 16px',
              background: 'rgba(99,102,241,0.06)',
              border: '1px dashed rgba(99,102,241,0.30)',
              borderRadius: 10,
              fontSize: 13,
              color: 'var(--text2)',
              lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 700, color: 'var(--brand-text)', marginBottom: 6 }}>
                Cold start — no outcomes yet
              </div>
              Picks shown on this page are now being recorded every time the scan runs. Outcomes fill
              automatically at T+5, T+20, and T+60 after each pick's snapshot date. Come back in a
              few days to see whether the panels are beating NIFTY.
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>
                {meta.total_picks ? `${meta.total_picks} picks already captured, waiting for ${horizon.toUpperCase()} to elapse.` : 'First snapshot will land on the next scan.'}
              </div>
            </div>
          )}

          {/* Stats grid */}
          {!loading && !err && !coldStart && data && (
            <>
              {/* Per-bucket cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
                marginBottom: 18,
              }}>
                {data.byBucket.map(b => {
                  const acc = BUCKET_ACCENT[b.bucket] || BUCKET_ACCENT.longterm;
                  return (
                    <div key={b.bucket} style={{
                      padding: '14px 16px',
                      background: acc.bg,
                      border: `1px solid ${acc.border}`,
                      borderRadius: 10,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: acc.color, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 8 }}>
                        {BUCKET_LABEL[b.bucket] || b.bucket}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                        <span className="tabular-nums" style={{
                          fontSize: 26, fontWeight: 800, letterSpacing: '-0.6px',
                          color: alphaColor(b.avg_alpha_pct),
                        }}>
                          {fmtPct(b.avg_alpha_pct)}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>avg alpha</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.55 }}>
                        <div>Hit rate vs NIFTY: <strong style={{ color: 'var(--text)' }}>{b.hit_rate_vs_nifty != null ? b.hit_rate_vs_nifty.toFixed(0) + '%' : '—'}</strong></div>
                        <div>Avg return: {fmtPct(b.avg_return_pct)} · NIFTY: {fmtPct(b.avg_nifty_pct)}</div>
                        <div style={{ color: 'var(--text3)', marginTop: 4 }}>n = {b.n}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Rolling alpha 30d/60d/90d */}
              {data.rolling && data.rolling.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div className="label-xs" style={{ marginBottom: 8 }}>Rolling Alpha by Window</div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto repeat(4, 1fr)',
                    gap: 6,
                    fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 700, color: 'var(--text3)', padding: '6px 8px' }}>Bucket</div>
                    {['30d', '60d', '90d', 'older'].map(w => (
                      <div key={w} style={{ fontWeight: 700, color: 'var(--text3)', padding: '6px 8px', textAlign: 'right' }}>{w}</div>
                    ))}
                    {['rebound', 'momentum', 'longterm'].map(bucket => (
                      <React.Fragment key={bucket}>
                        <div style={{ padding: '6px 8px', color: (BUCKET_ACCENT[bucket] || {}).color, fontWeight: 600 }}>
                          {BUCKET_LABEL[bucket] || bucket}
                        </div>
                        {['30d', '60d', '90d', 'older'].map(w => {
                          const r = data.rolling.find(x => x.bucket === bucket && x.window === w);
                          return (
                            <div key={w} className="tabular-nums" style={{
                              padding: '6px 8px', textAlign: 'right',
                              color: alphaColor(r?.avg_alpha_pct),
                              fontWeight: 600,
                            }}>
                              {r ? `${fmtPct(r.avg_alpha_pct)} (${r.n})` : '—'}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* Clean vs flagged */}
              {data.cleanSignal && data.cleanSignal.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div className="label-xs" style={{ marginBottom: 8 }}>Clean Signal (no risk flags firing)</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {data.cleanSignal.map(c => (
                      <div key={c.bucket} style={{
                        padding: '10px 14px',
                        background: 'rgba(52,211,153,0.06)',
                        border: '1px solid rgba(52,211,153,0.25)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}>
                        <span style={{ fontWeight: 700, color: (BUCKET_ACCENT[c.bucket] || {}).color }}>
                          {BUCKET_LABEL[c.bucket] || c.bucket}
                        </span>
                        <span style={{ color: 'var(--text2)', marginLeft: 8 }}>
                          {fmtPct(c.avg_alpha_pct)} alpha · {c.hit_rate != null ? c.hit_rate.toFixed(0) + '%' : '—'} hit · n={c.n}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conviction attribution */}
              {data.byConviction && data.byConviction.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div className="label-xs" style={{ marginBottom: 8 }}>Conviction (buckets qualified)</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {data.byConviction.map(c => (
                      <div key={c.conviction} style={{
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}>
                        <strong style={{ color: 'var(--text)' }}>{c.conviction}-bucket</strong>
                        <span style={{ color: alphaColor(c.avg_alpha_pct), marginLeft: 8, fontWeight: 600 }}>
                          {fmtPct(c.avg_alpha_pct)}
                        </span>
                        <span style={{ color: 'var(--text3)', marginLeft: 8 }}>
                          {c.hit_rate != null ? c.hit_rate.toFixed(0) + '%' : '—'} · n={c.n}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Per-flag attribution */}
              {data.byFlag && data.byFlag.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div className="label-xs" style={{ marginBottom: 8 }}>
                    Risk-Flag Attribution · sorted worst → best alpha (helpful flags should be at the top with negative alpha; noisy flags cluster near zero)
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto auto',
                    gap: 4,
                    fontSize: 11,
                    maxHeight: 280,
                    overflowY: 'auto',
                  }}>
                    <div style={{ fontWeight: 700, color: 'var(--text3)', padding: '6px 8px' }}>Flag</div>
                    <div style={{ fontWeight: 700, color: 'var(--text3)', padding: '6px 8px', textAlign: 'right' }}>Alpha</div>
                    <div style={{ fontWeight: 700, color: 'var(--text3)', padding: '6px 8px', textAlign: 'right' }}>Hit %</div>
                    <div style={{ fontWeight: 700, color: 'var(--text3)', padding: '6px 8px', textAlign: 'right' }}>n</div>
                    {data.byFlag.map(f => (
                      <React.Fragment key={f.code}>
                        <div style={{ padding: '6px 8px', color: 'var(--text2)', fontFamily: 'ui-monospace, monospace' }}>{f.code}</div>
                        <div className="tabular-nums" style={{ padding: '6px 8px', textAlign: 'right', color: alphaColor(f.avg_alpha_pct), fontWeight: 600 }}>
                          {fmtPct(f.avg_alpha_pct)}
                        </div>
                        <div className="tabular-nums" style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text2)' }}>
                          {f.hit_rate != null ? f.hit_rate.toFixed(0) + '%' : '—'}
                        </div>
                        <div className="tabular-nums" style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text3)' }}>{f.n}</div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* Winners / losers side-by-side */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
                <div>
                  <div className="label-xs" style={{ marginBottom: 8, color: 'var(--green-text)' }}>Top Winners (last 120d)</div>
                  <WinnerLoserTable rows={data.winners} />
                </div>
                <div>
                  <div className="label-xs" style={{ marginBottom: 8, color: 'var(--red-text)' }}>Top Losers (last 120d)</div>
                  <WinnerLoserTable rows={data.losers} />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function WinnerLoserTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <div style={{ padding: 12, color: 'var(--text3)', fontSize: 12 }}>No data yet</div>;
  }
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'auto auto 1fr auto',
      gap: 4,
      fontSize: 12,
    }}>
      {rows.map((r, idx) => (
        <React.Fragment key={`${r.sym}-${r.snapshot_date}-${idx}`}>
          <div style={{ padding: '5px 8px', fontFamily: 'ui-monospace, monospace', color: 'var(--text)', fontWeight: 600 }}>{r.sym}</div>
          <div style={{ padding: '5px 8px', color: (BUCKET_ACCENT[r.bucket] || {}).color, fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {BUCKET_LABEL[r.bucket] || r.bucket}
          </div>
          <div className="tabular-nums" style={{ padding: '5px 8px', textAlign: 'right', color: alphaColor(r.alpha_pct), fontWeight: 700 }}>
            {fmtPct(r.alpha_pct)}
          </div>
          <div className="tabular-nums" style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--text3)', fontSize: 11 }}>
            {r.snapshot_date}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Phase 0C · Journal action button — compact pill used on ready-to-act state
// ══════════════════════════════════════════════════════════════════════
function JournalActionButton({ label, color, onClick }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
      style={{
        background: 'transparent',
        border: `1px solid ${color}`,
        color,
        borderRadius: 9999,
        padding: '2px 10px',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.3px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 150ms ease',
      }}
    >
      {label}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Phase 0C · Journal Panel — the user's own decision log with cooldown state
// and outcome stamps. Gives a single place to audit your own discipline:
// how often do you follow through after the 24h hold, and on what.
// ══════════════════════════════════════════════════════════════════════
function JournalPanel({ journal, journalLoading, onMarkActed, onRefresh }) {
  const [open, setOpen] = useState(true);
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNowTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const nowMs = Date.now();
  const stats = useMemo(() => {
    const total = journal.length;
    const acted = journal.filter((j) => !!j.acted_outcome).length;
    const bought = journal.filter((j) => j.acted_outcome === 'bought').length;
    const passed = journal.filter((j) => j.acted_outcome === 'passed').length;
    const watching = journal.filter((j) => j.acted_outcome === 'watching').length;
    const cooling = journal.filter((j) => {
      if (j.acted_outcome) return false;
      return nowMs < new Date(j.decided_at).getTime() + 24 * 3600 * 1000;
    }).length;
    const ready = journal.filter((j) => {
      if (j.acted_outcome) return false;
      return nowMs >= new Date(j.decided_at).getTime() + 24 * 3600 * 1000;
    }).length;
    return { total, acted, bought, passed, watching, cooling, ready };
  }, [journal, nowMs]);

  return (
    <div className="card" style={{ padding: 16, marginTop: 18, border: '1px solid var(--border)' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800, color: 'var(--text)', fontSize: 14, letterSpacing: '-0.2px' }}>
            🗒 My Journal
            <span style={{ fontSize: 10, color: 'var(--text4)', fontWeight: 500, marginLeft: 8, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              24h Behavioral Hold
            </span>
          </div>
          <span className="chip" style={{ fontSize: 9.5, height: 18, padding: '0 7px', fontWeight: 700 }}>
            {stats.total} total
          </span>
          {stats.cooling > 0 && (
            <span className="chip chip-amber" style={{ fontSize: 9.5, height: 18, padding: '0 7px', fontWeight: 700 }}>
              ⏳ {stats.cooling} cooling
            </span>
          )}
          {stats.ready > 0 && (
            <span className="chip chip-green" style={{ fontSize: 9.5, height: 18, padding: '0 7px', fontWeight: 700 }}>
              ✓ {stats.ready} ready
            </span>
          )}
          {stats.acted > 0 && (
            <span className="chip" style={{ fontSize: 9.5, height: 18, padding: '0 7px', fontWeight: 700 }}>
              {stats.acted} acted · {stats.bought}B/{stats.passed}P/{stats.watching}W
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onRefresh && onRefresh(); }}
            title="Refresh"
            style={{
              background: 'transparent',
              border: '1px solid var(--border2)',
              color: 'var(--text3)',
              borderRadius: 6,
              padding: '3px 8px',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {journalLoading ? '…' : '↻'}
          </button>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>{open ? '▾' : '▸'}</span>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          {journal.length === 0 && (
            <div style={{
              padding: 16,
              textAlign: 'center',
              color: 'var(--text3)',
              fontSize: 12,
              lineHeight: 1.55,
              background: 'rgba(255,255,255,0.02)',
              border: '1px dashed var(--border)',
              borderRadius: 8,
              fontStyle: 'italic',
            }}>
              No journal entries yet. Click <b>🗒 Log interest</b> on any pick above
              to start a 24h behavioral hold before acting — research shows this
              boosts retail alpha by cutting impulsive decisions.
            </div>
          )}
          {journal.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'auto auto 1fr auto auto',
              gap: 0,
              fontSize: 12,
              border: '1px solid var(--border)',
              borderRadius: 8,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', fontSize: 9.5, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Stock</div>
              <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', fontSize: 9.5, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Bucket</div>
              <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', fontSize: 9.5, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Reason</div>
              <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', fontSize: 9.5, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.5px', textTransform: 'uppercase', textAlign: 'right' }}>Status</div>
              <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', fontSize: 9.5, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.5px', textTransform: 'uppercase', textAlign: 'right' }}>Decided</div>
              {journal.slice(0, 25).map((j, idx) => {
                const acc = BUCKET_ACCENT[j.bucket] || BUCKET_ACCENT.longterm;
                const decidedMs = new Date(j.decided_at).getTime();
                const readyMs = decidedMs + 24 * 3600 * 1000;
                const isCooling = !j.acted_outcome && nowMs < readyMs;
                const isReady = !j.acted_outcome && nowMs >= readyMs;
                const secLeft = Math.max(0, Math.floor((readyMs - nowMs) / 1000));
                const hLeft = Math.floor(secLeft / 3600);
                const mLeft = Math.floor((secLeft % 3600) / 60);
                const countdown = hLeft >= 1 ? `${hLeft}h ${mLeft}m` : `${mLeft}m`;
                const zebra = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)';
                return (
                  <React.Fragment key={j.journal_id}>
                    <div style={{ padding: '7px 10px', background: zebra, fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: 'var(--text)' }}>
                      {j.sym}
                    </div>
                    <div style={{ padding: '7px 10px', background: zebra, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, color: acc.color }}>
                      {BUCKET_LABEL[j.bucket] || j.bucket}
                    </div>
                    <div style={{ padding: '7px 10px', background: zebra, color: 'var(--text3)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={j.reason || ''}>
                      {j.reason || <span style={{ fontStyle: 'italic', color: 'var(--text4)' }}>— no note —</span>}
                    </div>
                    <div style={{ padding: '7px 10px', background: zebra, textAlign: 'right', display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                      {isCooling && (
                        <span style={{ color: 'var(--amber-text)', fontWeight: 700, fontSize: 10 }}>⏳ {countdown}</span>
                      )}
                      {isReady && (
                        <>
                          <span style={{ color: 'var(--green-text)', fontWeight: 800, fontSize: 10, marginRight: 4 }}>✓ READY</span>
                          <JournalActionButton label="Bought"   color="var(--green-text)" onClick={() => onMarkActed && onMarkActed(j.journal_id, 'bought')} />
                          <JournalActionButton label="Passed"   color="var(--red-text)"   onClick={() => onMarkActed && onMarkActed(j.journal_id, 'passed')} />
                          <JournalActionButton label="Watching" color="var(--amber-text)" onClick={() => onMarkActed && onMarkActed(j.journal_id, 'watching')} />
                        </>
                      )}
                      {j.acted_outcome && (
                        <span style={{
                          color: j.acted_outcome === 'bought' ? 'var(--green-text)'
                               : j.acted_outcome === 'passed' ? 'var(--red-text)'
                               : 'var(--amber-text)',
                          fontWeight: 800,
                          fontSize: 10,
                          letterSpacing: '0.3px',
                        }}>
                          ✓ {String(j.acted_outcome).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div style={{ padding: '7px 10px', background: zebra, textAlign: 'right', color: 'var(--text4)', fontSize: 10.5 }}>
                      {new Date(j.decided_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
          {journal.length > 25 && (
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text4)', textAlign: 'center', fontStyle: 'italic' }}>
              Showing 25 most-recent of {journal.length} entries.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
