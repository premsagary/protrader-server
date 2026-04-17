/**
 * risk-flags.js — forward-looking risk detectors that ratio-based screeners
 * inherently miss.
 *
 * The three ProTrader screeners (Rebound / Momentum / Long-Term) all read
 * trailing financial ratios. That makes them blind to events that will move
 * the stock — patent cliffs showing up in the latest Q but buried under
 * strong 5Y history, IPO lock-ins unlocking next week, momentum sustained
 * by speculation while earnings collapse.
 *
 * This module adds three detectors:
 *
 *   1. detectEarningsDeceleration  — catches Revlimid-cliff patterns
 *                                    (NATCO, CIPLA, DRREDDY) by comparing
 *                                    latest Q growth to 1Y/5Y trend.
 *
 *   2. detectPriceEarningsDivergence — catches ADANIPOWER/FORCEMOT-style
 *                                    blow-off tops: stock up >25% 1Y while
 *                                    earnings flat-to-negative.
 *
 *   3. detectLockInExpiry          — catches HYUNDAI/WAAREE-style supply
 *                                    shocks from IPO anchor/non-promoter/
 *                                    promoter lock-in unlocks.
 *
 * Each detector returns { code, severity, label, penalty } or null. Penalty
 * is subtracted from the scorer's output to demote risky picks in the
 * ranking — without hiding them entirely.
 *
 * No external APIs. Operates on the same `f` stockFundamentals object the
 * scorers already consume.
 */

'use strict';

// ────────────────────────────────────────────────────────────────────────────
// 1. Earnings deceleration (patent cliff, demand shock, competitive pressure)
// ────────────────────────────────────────────────────────────────────────────
// Uses three inputs:
//   f.patQtrYoy / f.salesQtrYoy  — latest quarter YoY growth
//   f.epsGr1y                    — last full-year EPS growth
//   f.epsGr5y                    — 5-year EPS CAGR
//
// Pattern to detect: "Great historical growth + latest Q collapsing" =
// something broke structurally and ratios haven't caught up yet.
function detectEarningsDeceleration(f) {
  if (!f) return null;
  const qPat = Number(f.patQtrYoy);
  const g1   = Number(f.epsGr1y);
  const g5   = Number(f.epsGr5y);

  // Need at least latest Q data
  if (!Number.isFinite(qPat)) return null;

  // HIGH severity: latest Q -20% or worse AND 5Y was healthy double-digit
  // Example: Natco Q3 FY26 PAT collapsed vs 5Y CAGR >15% → classic patent cliff
  if (qPat <= -20 && Number.isFinite(g5) && g5 >= 10) {
    return {
      code: 'EARNINGS_CLIFF',
      severity: 'HIGH',
      label: `PAT ${qPat.toFixed(0)}% YoY vs 5Y avg +${g5.toFixed(0)}% — structural decline`,
      penalty: 15,
    };
  }

  // HIGH severity: latest Q -30% even if 5Y data missing
  if (qPat <= -30) {
    return {
      code: 'EARNINGS_DROP_SEVERE',
      severity: 'HIGH',
      label: `Latest quarter PAT ${qPat.toFixed(0)}% YoY — severe decline`,
      penalty: 12,
    };
  }

  // MEDIUM: Q negative while 1Y was positive — sequential turn
  if (qPat < 0 && Number.isFinite(g1) && g1 > 5) {
    return {
      code: 'EARNINGS_DECELERATING',
      severity: 'MEDIUM',
      label: `Latest Q PAT ${qPat.toFixed(0)}% — 1Y trend was +${g1.toFixed(0)}%`,
      penalty: 7,
    };
  }

  // LOW: Q growth <5% while 5Y was robust — watch
  if (qPat < 5 && Number.isFinite(g5) && g5 >= 15) {
    return {
      code: 'EARNINGS_SLOWING',
      severity: 'LOW',
      label: `Q growth ${qPat.toFixed(0)}% vs 5Y +${g5.toFixed(0)}% — slowing`,
      penalty: 3,
    };
  }

  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Price-earnings divergence (momentum trap)
// ────────────────────────────────────────────────────────────────────────────
// Uses:
//   f.ret1y / f.change52w / change1y (normalized to %)  — 1Y price return
//   f.epsGr1y                                          — 1Y EPS growth
//
// Pattern to detect: stock is flying, earnings aren't — pure multiple
// expansion, speculative.
function detectPriceEarningsDivergence(f) {
  if (!f) return null;

  // Normalize price return — can arrive as decimal (0.25) or percent (25)
  let price1y = [f.ret1y, f.change1y, f.change52w, f.ret_1y]
    .map(v => Number(v)).find(v => Number.isFinite(v));
  if (price1y == null) return null;
  if (Math.abs(price1y) < 5 && Math.abs(price1y) > 0) price1y *= 100; // decimal → %

  const eps1y = Number(f.epsGr1y);
  if (!Number.isFinite(eps1y)) return null;

  // HIGH: stock up >40% while earnings shrinking
  if (price1y > 40 && eps1y < 0) {
    return {
      code: 'PRICE_PAT_DIVERGENCE_BEARISH',
      severity: 'HIGH',
      label: `Stock +${price1y.toFixed(0)}% 1Y but EPS ${eps1y.toFixed(0)}% — pure multiple expansion`,
      penalty: 12,
    };
  }

  // MEDIUM: stock up >50% while earnings growth <10% (much less than price)
  if (price1y > 50 && eps1y < 10) {
    return {
      code: 'PRICE_EARNINGS_EXTENDED',
      severity: 'MEDIUM',
      label: `Stock +${price1y.toFixed(0)}% 1Y vs EPS +${eps1y.toFixed(0)}% — extended`,
      penalty: 6,
    };
  }

  // MEDIUM: classic cyclical peak — stock up >100% 1Y
  if (price1y > 100) {
    return {
      code: 'MOMENTUM_CYCLICAL_PEAK',
      severity: 'MEDIUM',
      label: `Stock +${price1y.toFixed(0)}% 1Y — cyclical peak risk`,
      penalty: 5,
    };
  }

  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. IPO lock-in expiry calendar
// ────────────────────────────────────────────────────────────────────────────
// SEBI rules for mainboard IPOs (post-2022):
//   Anchor investors        : 50% locked for 30 days, 50% for 90 days
//   Non-promoter shareholders: 6 months from listing
//   Promoters               : 18 months for 50% of min contribution,
//                             36 months for the remaining 50%
//
// Lock-in expiries typically cause 5-15% drops as supply hits the tape.
// Hard-coded list below covers major recent IPOs. Add new listings here
// as they happen. Retrieved from NSE + prospectus filings.
const IPO_LOCK_IN_CALENDAR = Object.freeze([
  // 2024 IPOs with significant lock-ins still live in 2026
  {
    sym: 'HYUNDAI', listing: '2024-10-22',
    events: [
      { type: 'anchor_30d',  date: '2024-11-21', label: '30-day anchor unlock' },
      { type: 'anchor_90d',  date: '2025-01-20', label: '90-day anchor unlock' },
      { type: 'nonpromo_6m', date: '2025-04-22', label: '6-month non-promoter unlock' },
      { type: 'promo_18m',   date: '2026-04-20', label: '18-month promoter 50% unlock (₹62,000cr)' },
      { type: 'promo_36m',   date: '2027-10-22', label: '36-month promoter remaining unlock' },
    ],
  },
  {
    sym: 'WAAREEENER', listing: '2024-10-28',
    events: [
      { type: 'anchor_30d',  date: '2024-11-27' },
      { type: 'anchor_90d',  date: '2025-01-26' },
      { type: 'nonpromo_6m', date: '2025-04-28' },
      { type: 'promo_18m',   date: '2026-04-28', label: '18-month promoter 50% unlock' },
      { type: 'promo_36m',   date: '2027-10-28' },
    ],
  },
  {
    sym: 'PREMIERENE', listing: '2024-09-03',
    events: [
      { type: 'anchor_30d',  date: '2024-10-03' },
      { type: 'anchor_90d',  date: '2024-12-02' },
      { type: 'nonpromo_6m', date: '2025-03-03' },
      { type: 'promo_18m',   date: '2026-03-03', label: '18-month promoter 50% unlock' },
      { type: 'promo_36m',   date: '2027-09-03' },
    ],
  },
  {
    sym: 'INDGN', listing: '2024-05-13',
    events: [
      { type: 'nonpromo_6m', date: '2024-11-13' },
      { type: 'promo_18m',   date: '2025-11-13' },
      { type: 'promo_36m',   date: '2027-05-13' },
    ],
  },
  {
    sym: 'TRAVELFOOD', listing: '2025-07-14',
    events: [
      { type: 'anchor_30d',  date: '2025-08-13' },
      { type: 'anchor_90d',  date: '2025-10-12' },
      { type: 'nonpromo_6m', date: '2026-01-14', label: '6-month non-promoter unlock' },
      { type: 'promo_18m',   date: '2027-01-14' },
    ],
  },
  // Add more IPOs here as you notice them showing up in picks screens.
]);

function detectLockInExpiry(f, now) {
  if (!f) return null;
  const sym = (f.sym || f.symbol || '').toUpperCase();
  if (!sym) return null;
  const record = IPO_LOCK_IN_CALENDAR.find(r => r.sym === sym);
  if (!record) return null;

  const nowMs = now != null ? now : Date.now();

  // Scan all events; flag the most imminent one
  let bestFlag = null;
  for (const ev of record.events || []) {
    const t = new Date(ev.date + 'T00:00:00Z').getTime();
    if (!Number.isFinite(t)) continue;
    const daysAway = (t - nowMs) / 86400000;

    let flag = null;
    // Imminent — within next 7 days
    if (daysAway >= -1 && daysAway <= 7) {
      flag = {
        code: 'LOCKIN_IMMINENT',
        severity: 'HIGH',
        label: `${ev.label || ev.type} ${daysAway < 0.5
          ? 'today' : `in ${Math.max(0, Math.ceil(daysAway))}d`} — supply shock risk`,
        penalty: 12,
      };
    } else if (daysAway >= -21 && daysAway < -1) {
      // Recent (past 3 weeks) — overhang still digesting
      flag = {
        code: 'LOCKIN_RECENT',
        severity: 'MEDIUM',
        label: `${ev.label || ev.type} ${Math.abs(daysAway).toFixed(0)}d ago — supply still digesting`,
        penalty: 5,
      };
    } else if (daysAway >= 7 && daysAway <= 30) {
      // Coming — watch but not urgent
      flag = {
        code: 'LOCKIN_UPCOMING',
        severity: 'LOW',
        label: `${ev.label || ev.type} in ${Math.ceil(daysAway)}d`,
        penalty: 2,
      };
    }

    // Keep the most severe (lowest absolute daysAway wins)
    if (flag && (!bestFlag || Math.abs(daysAway) < Math.abs(bestFlag._days))) {
      flag._days = daysAway;
      bestFlag = flag;
    }
  }
  if (bestFlag) delete bestFlag._days;
  return bestFlag;
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Earnings-quality divergence (PAT grows, FCF doesn't)
// ────────────────────────────────────────────────────────────────────────────
// Classic accrual-accounting red flag: reported PAT is up but cash flow
// from operations isn't. Usually means receivables buildup, channel stuffing,
// or one-time accounting gains. Varsity M3 Ch10: "cash flow > earnings".
function detectEarningsQualityDivergence(f) {
  if (!f) return null;
  const epsGr = Number(f.epsGr1y);
  // FCF growth isn't always present. Use multiple fallbacks:
  // f.fcfGr1y if available; else infer from f.fcf / f.fcfLastYear / salesGr1y trend
  let fcfGr = Number(f.fcfGr1y);
  if (!Number.isFinite(fcfGr) && Number.isFinite(f.fcf) && Number.isFinite(f.fcfPrev)) {
    fcfGr = f.fcfPrev !== 0 ? ((f.fcf - f.fcfPrev) / Math.abs(f.fcfPrev)) * 100 : null;
  }
  // Without FCF growth data, we cannot diverge-check.
  if (!Number.isFinite(epsGr) || !Number.isFinite(fcfGr)) return null;

  // HIGH: PAT up >20% while FCF shrinking — strong accrual smell
  if (epsGr >= 20 && fcfGr <= 0) {
    return {
      code: 'EARNINGS_QUALITY_DIVERGENT',
      severity: 'HIGH',
      label: `EPS +${epsGr.toFixed(0)}% but FCF ${fcfGr.toFixed(0)}% — accrual quality concern`,
      penalty: 10,
    };
  }
  // MEDIUM: PAT >15% but FCF <5% (growing slower than earnings)
  if (epsGr >= 15 && fcfGr < 5 && fcfGr > 0) {
    return {
      code: 'EARNINGS_QUALITY_WEAK',
      severity: 'MEDIUM',
      label: `EPS +${epsGr.toFixed(0)}% vs FCF +${fcfGr.toFixed(0)}% — earnings not cash-backed`,
      penalty: 5,
    };
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Cyclical-peak detection (Long-Term trap)
// ────────────────────────────────────────────────────────────────────────────
// Commodities / cyclicals look most attractive at the TOP of their cycle
// (high ROE, fat margins, record earnings) — exactly when you should NOT buy
// them for long-term. Varsity M3 Ch8 warning. Detect via:
//   - sector in the cyclical set
//   - current ROE or margin > 1.5x the 5Y average = we're at a peak
const CYCLICAL_SECTORS = new Set([
  'Metals', 'Metal', 'Metals & Mining', 'Mining', 'Mining & Minerals',
  'Commodity Chemicals', 'Specialty Chemicals', 'Chemicals',
  'Oil & Gas', 'Energy', 'Oil Exploration', 'Refineries',
  'Cement', 'Cement & Cement Products',
  'Fertilizers', 'Sugar', 'Paper', 'Textiles',
  'Realty', 'Real Estate',
  'Auto', 'Automobile', 'Automobiles', 'Tyres',
  'Shipping', 'Airlines',
]);
function _isCyclical(sector) {
  if (!sector) return false;
  if (CYCLICAL_SECTORS.has(sector)) return true;
  const s = String(sector).toLowerCase();
  return ['metal','mining','chemical','oil','gas','cement','fertili',
          'sugar','paper','textile','realty','auto','tyre','shipping','airline']
    .some(k => s.includes(k));
}
function detectCyclicalPeak(f) {
  if (!f) return null;
  if (!_isCyclical(f.sector)) return null;

  const roeNow = Number(f.roe);
  const roe5y  = Number(f.roe5yAvg);
  const marNow = Number(f.operatingMargin);
  const mar5y  = Number(f.operatingMargin5yAvg);

  // Either ROE or margin peaking >1.5x 5Y = late-cycle
  const roeRatio = (Number.isFinite(roeNow) && Number.isFinite(roe5y) && roe5y > 0)
    ? roeNow / roe5y : null;
  const marRatio = (Number.isFinite(marNow) && Number.isFinite(mar5y) && mar5y > 0)
    ? marNow / mar5y : null;
  const peakRatio = Math.max(roeRatio || 0, marRatio || 0);

  if (peakRatio >= 1.75) {
    return {
      code: 'CYCLICAL_PEAK_PROFITABILITY',
      severity: 'HIGH',
      label: `Cyclical at peak profitability (${peakRatio.toFixed(1)}x 5Y avg) — reverts with cycle`,
      penalty: 10,
    };
  }
  if (peakRatio >= 1.5) {
    return {
      code: 'CYCLICAL_ELEVATED_MARGINS',
      severity: 'MEDIUM',
      label: `Cyclical margins ${peakRatio.toFixed(1)}x 5Y avg — late-cycle risk`,
      penalty: 6,
    };
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Drawdown immaturity (Rebound falling-knife filter)
// ────────────────────────────────────────────────────────────────────────────
// A stock at -20% from high that was still -15% in the last 3 months is
// probably in Phase 1/2 of the decline (Varsity M2 Ch3 Dow Theory). A stock
// at -20% from high that is +5% in the last 3 months is already bottoming.
// Only the second is a real rebound setup.
function detectDrawdownImmaturity(f) {
  if (!f) return null;
  const pfh = Number(f.pctFromHigh);
  const c3m = Number(f.change3m);
  const c1m = Number(f.change1m);
  if (!Number.isFinite(pfh) || pfh > -15) return null; // Only relevant for fallen setups

  // HIGH: still falling hard — pctFromHigh <= -20 AND 3M still < -10%
  if (pfh <= -20 && Number.isFinite(c3m) && c3m <= -10) {
    return {
      code: 'DRAWDOWN_STILL_FALLING',
      severity: 'HIGH',
      label: `Down ${pfh.toFixed(0)}% from high AND ${c3m.toFixed(0)}% in 3M — falling knife`,
      penalty: 12,
    };
  }
  // MEDIUM: stabilising but not yet rebounding — 3M flat-to-negative
  if (pfh <= -20 && Number.isFinite(c3m) && c3m < 0) {
    return {
      code: 'DRAWDOWN_IMMATURE',
      severity: 'MEDIUM',
      label: `Down ${pfh.toFixed(0)}% from high, 3M still ${c3m.toFixed(0)}% — no recovery yet`,
      penalty: 5,
    };
  }
  // LOW: recent weakness adding to older drawdown
  if (pfh <= -25 && Number.isFinite(c1m) && c1m < -5) {
    return {
      code: 'DRAWDOWN_ACCELERATING',
      severity: 'LOW',
      label: `Fall deepening — ${c1m.toFixed(0)}% in last month`,
      penalty: 3,
    };
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// 7. Sector laggard (Momentum quality filter)
// ────────────────────────────────────────────────────────────────────────────
// A stock up 40% when its sector is up 55% is UNDERPERFORMING, not
// outperforming. Requires caller to set f._sectorMedian52w upstream (done in
// /api/stocks/score preprocessing — see kite-server.js).
function detectSectorLaggard(f) {
  if (!f) return null;
  const stock52 = Number(f.change52w);
  const sec52   = Number(f._sectorMedian52w);
  if (!Number.isFinite(stock52) || !Number.isFinite(sec52)) return null;

  const rs = stock52 - sec52; // positive = outperforming sector
  // Only flag when stock appears momentum-strong absolutely but lags sector
  if (stock52 >= 20 && rs <= -10) {
    return {
      code: 'SECTOR_LAGGARD',
      severity: 'MEDIUM',
      label: `+${stock52.toFixed(0)}% 1Y but sector +${sec52.toFixed(0)}% — relative laggard`,
      penalty: 6,
    };
  }
  if (stock52 >= 10 && rs <= -15) {
    return {
      code: 'SECTOR_UNDERPERFORMER',
      severity: 'LOW',
      label: `Underperforming sector by ${Math.abs(rs).toFixed(0)}%`,
      penalty: 3,
    };
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Public entry point — returns an array of flags (0-6 items typical)
// ────────────────────────────────────────────────────────────────────────────
function computeRiskFlags(f, now) {
  const out = [];
  const a = detectEarningsDeceleration(f);         if (a) out.push(a);
  const b = detectPriceEarningsDivergence(f);       if (b) out.push(b);
  const c = detectLockInExpiry(f, now);             if (c) out.push(c);
  const d = detectEarningsQualityDivergence(f);     if (d) out.push(d);
  const e = detectCyclicalPeak(f);                  if (e) out.push(e);
  const g = detectDrawdownImmaturity(f);            if (g) out.push(g);
  const h = detectSectorLaggard(f);                 if (h) out.push(h);
  return out;
}

function applyRiskFlagPenalty(score, flags) {
  if (!flags || !flags.length) return score;
  const total = flags.reduce((s, fl) => s + (fl.penalty || 0), 0);
  return Math.max(0, +(score - total).toFixed(1));
}

// Highest severity wins for a single-badge summary
function summarizeSeverity(flags) {
  if (!flags || !flags.length) return null;
  const order = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  let top = flags[0];
  for (const fl of flags) {
    if ((order[fl.severity] || 0) > (order[top.severity] || 0)) top = fl;
  }
  return top.severity;
}

module.exports = {
  computeRiskFlags,
  applyRiskFlagPenalty,
  summarizeSeverity,
  // exposed for tests + admin view
  _internal: {
    detectEarningsDeceleration,
    detectPriceEarningsDivergence,
    detectLockInExpiry,
    IPO_LOCK_IN_CALENDAR,
  },
};
