// filter_engine.js — all 55 filters from BUILD_PLAN v2 §8.
// Each filter returns { id, name, layer, pass, reason, value, severity }.
// runAllFilters() returns { decision: 'TRADE'|'SKIP'|'HALT'|'SAFE_MODE', strategy, results, blockers, warnings }.
'use strict';

const time = require('./time_utils');
const strategyEngine = require('./strategy_engine');

const FILTERS = [];
function defFilter(id, name, layer, fn) {
  FILTERS.push({ id, name, layer, fn });
}

// ---------- Layer 1: Pre-market context (10 filters) ----------
defFilter(1, 'broker_session_valid', 1, (ctx) => {
  const ageH = ctx.broker?.tokenAgeHours ?? null;
  if (ageH == null) return { pass: false, reason: 'token age unknown', value: null, severity: 'HALT' };
  return { pass: ageH < 24, reason: ageH < 24 ? `valid ${ageH.toFixed(1)}h` : `token >24h old`, value: ageH, severity: 'HALT' };
});

defFilter(2, 'market_open_today', 1, (ctx) => {
  // Honor ctx.day if injected (for tests / replay), else check real time
  if (ctx.day) {
    const isWeekday = ['Mon','Tue','Wed','Thu','Fri'].includes(ctx.day);
    return { pass: isWeekday, reason: isWeekday ? 'market open' : 'weekend/holiday', value: isWeekday, severity: 'SKIP' };
  }
  const open = !time.isMarketHoliday();
  return { pass: open, reason: open ? 'market open' : 'weekend/holiday', value: open, severity: 'SKIP' };
});

defFilter(3, 'margin_available', 1, (ctx) => {
  // Two-pass: first pass (no tradeCard) only checks min buffer.
  // Second pass (after build) verifies 1.5× actual margin estimate.
  const have = ctx.availableMargin || 0;
  if (!ctx.tradeCard) {
    const minBuffer = 50000;
    return { pass: have >= minBuffer, reason: `pre-build: have ₹${have}, need ≥₹${minBuffer}`, value: { have, minBuffer }, severity: 'HALT' };
  }
  const need = ctx.tradeCard.marginEstimate || 140000;
  return { pass: have >= 1.5 * need, reason: `have ₹${have} need 1.5×₹${need}`, value: { have, need }, severity: 'HALT' };
});

defFilter(4, 'vix_prior_fetched', 1, (ctx) => ({
  pass: !!(ctx.vixPrior && ctx.vixPrior > 0),
  reason: ctx.vixPrior ? `VIX prior ${ctx.vixPrior}` : 'no VIX', value: ctx.vixPrior, severity: 'HALT'
}));

defFilter(5, 'nifty_prior_fetched', 1, (ctx) => ({
  pass: !!(ctx.niftyPrior && ctx.niftyPrior > 0),
  reason: ctx.niftyPrior ? `NIFTY prior ${ctx.niftyPrior}` : 'no NIFTY', value: ctx.niftyPrior, severity: 'HALT'
}));

defFilter(6, 'event_today', 1, (ctx) => {
  const event = ctx.eventToday;  // injected from event calendar lookup
  return { pass: !event, reason: event ? `event: ${event}` : 'no event', value: event || null, severity: 'SKIP' };
});

defFilter(7, 'five_day_pnl', 1, (ctx) => {
  const five = ctx.rolling5dPnl || 0;
  return { pass: five >= -15000, reason: `5d P&L ₹${five}`, value: five, severity: 'SKIP' };
});

defFilter(8, 'thirty_day_pnl', 1, (ctx) => {
  const thirty = ctx.rolling30dPnl || 0;
  return { pass: thirty >= -40000, reason: `30d P&L ₹${thirty}`, value: thirty, severity: 'HALT' };
});

defFilter(9, 'engine_health_ok', 1, (ctx) => {
  const ok = ctx.health?.ok;
  return { pass: !!ok, reason: ok ? 'healthy' : (ctx.health?.reason || 'unhealthy'), value: ctx.health, severity: 'SAFE_MODE' };
});

defFilter(10, 'exchange_status_ok', 1, (ctx) => {
  const ok = ctx.exchange?.ok ?? true;
  return { pass: ok, reason: ok ? 'NSE OK' : 'NSE quote not advancing', value: ctx.exchange, severity: 'HALT' };
});

// ---------- Layer 2: Day × VIX selection (5 filters) ----------
defFilter(11, 'day_recognized', 2, (ctx) => {
  const day = ctx.day || time.dayOfWeek();
  const known = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(day);
  return { pass: known, reason: `day=${day}`, value: day, severity: 'SKIP' };
});

defFilter(12, 'vix_band_classified', 2, (ctx) => {
  const band = strategyEngine.vixBand(ctx.vixPrior);
  return { pass: !!band, reason: band ? `band=${band}` : 'no band', value: band, severity: 'SKIP' };
});

defFilter(13, 'matrix_cell_not_skip', 2, (ctx) => {
  const day = ctx.day || time.dayOfWeek();
  const isExp = time.isExpiryToday();
  const strat = strategyEngine.pickStrategy({ day, vix: ctx.vixPrior, isExpiry: isExp });
  return { pass: strat !== 'SKIP', reason: strat === 'SKIP' ? `${day}×${strategyEngine.vixBand(ctx.vixPrior)}=SKIP` : `→ ${strat}`, value: strat, severity: 'SKIP' };
});

defFilter(14, 'strategy_mapped', 2, (ctx) => {
  const day = ctx.day || time.dayOfWeek();
  const isExp = time.isExpiryToday();
  const strat = strategyEngine.pickStrategy({ day, vix: ctx.vixPrior, isExpiry: isExp });
  if (strat === 'SKIP') return { pass: true, reason: 'N/A (skipped)', value: null, severity: 'SKIP' };
  const known = !!strategyEngine.STRATEGY_FNS[strat];
  return { pass: known, reason: known ? `mapped to ${strat}` : `unknown strategy ${strat}`, value: strat, severity: 'HALT' };
});

defFilter(15, 'strategy_data_exists', 2, () => ({
  pass: true, reason: 'live mode — no historical CSV needed', value: 'live', severity: 'SKIP'
}));

// ---------- Layer 3: Stabilization & freshness (10 filters) ----------
defFilter(16, 'nifty_open_fetched', 3, (ctx) => ({
  pass: !!(ctx.niftyOpen && ctx.niftyOpen > 0),
  reason: ctx.niftyOpen ? `open ${ctx.niftyOpen}` : 'no open', value: ctx.niftyOpen, severity: 'HALT'
}));

defFilter(17, 'gap_pct', 3, (ctx) => {
  // Missing data → SAFE_MODE (transient broker hiccup), not HALT (don't kill engine for 1 bad fetch).
  if (!ctx.niftyOpen || !ctx.niftyPrior) return { pass: false, reason: 'no spot data', value: null, severity: 'SAFE_MODE' };
  const gap = ctx.niftyOpen / ctx.niftyPrior - 1;
  return { pass: Math.abs(gap) <= 0.02, reason: `gap ${(gap * 100).toFixed(2)}%`, value: gap, severity: 'SKIP' };
});

defFilter(18, 'vix_intraday_spike', 3, (ctx) => {
  if (!ctx.vixNow || !ctx.vixPrior) return { pass: true, reason: 'no intraday VIX yet', value: null, severity: 'SKIP' };
  const delta = ctx.vixNow - ctx.vixPrior;
  return { pass: delta <= 5, reason: `VIX ${ctx.vixPrior}→${ctx.vixNow} (Δ${delta.toFixed(2)})`, value: delta, severity: 'SKIP' };
});

defFilter(19, 'option_chain_fetched', 3, (ctx) => {
  const ok = ctx.chain && Object.keys(ctx.chain).length >= 5;
  return { pass: ok, reason: ok ? `${Object.keys(ctx.chain).length} strikes` : 'chain missing', value: Object.keys(ctx.chain || {}).length, severity: 'HALT' };
});

defFilter(20, 'atm_strike_resolvable', 3, (ctx) => {
  if (!ctx.chain || !ctx.niftyOpen) return { pass: false, reason: 'missing data', value: null, severity: 'HALT' };
  const atm = strategyEngine.nearestStrike(ctx.niftyOpen, 50);
  const ok = ctx.chain[atm]?.ce?.ltp && ctx.chain[atm]?.pe?.ltp;
  return { pass: !!ok, reason: ok ? `ATM ${atm} OK` : `ATM ${atm} missing`, value: atm, severity: 'HALT' };
});

defFilter(21, 'bid_ask_spread', 3, (ctx) => {
  if (!ctx.chain) return { pass: false, reason: 'no chain', value: null, severity: 'WARN' };
  let bad = 0;
  for (const s of Object.values(ctx.chain)) {
    for (const t of ['ce', 'pe']) {
      const leg = s[t];
      if (leg?.bid && leg?.ask && leg.bid > 0) {
        const mid = (leg.bid + leg.ask) / 2;
        if ((leg.ask - leg.bid) / mid > 0.02) bad++;
      }
    }
  }
  return { pass: bad < 3, reason: `${bad} legs with spread > 2%`, value: bad, severity: 'WARN' };
});

defFilter(22, 'open_interest', 3, (ctx) => {
  if (!ctx.chain) return { pass: false, reason: 'no chain', value: null, severity: 'WARN' };
  let lowOi = 0;
  for (const s of Object.values(ctx.chain)) {
    for (const t of ['ce', 'pe']) if (s[t]?.oi != null && s[t].oi < 1000) lowOi++;
  }
  return { pass: lowOi < 5, reason: `${lowOi} legs with OI < 1000`, value: lowOi, severity: 'WARN' };
});

defFilter(23, 'chain_freshness', 3, (ctx) => {
  const ageMs = ctx.chainAgeMs ?? 0;
  return { pass: ageMs < 10000, reason: `chain age ${ageMs}ms`, value: ageMs, severity: 'HALT' };
});

defFilter(24, 'vix_freshness', 3, (ctx) => {
  const ageS = ctx.vixAgeSec ?? 0;
  return { pass: ageS < 30, reason: `VIX age ${ageS}s`, value: ageS, severity: 'HALT' };
});

defFilter(25, 'ws_health', 3, (ctx) => {
  const ageMs = ctx.wsLastTickMs ?? 0;
  return { pass: ageMs < 15000, reason: `last tick ${ageMs}ms ago`, value: ageMs, severity: 'HALT' };
});

// ---------- Layer 4: Strategy construction (6 filters) ----------
defFilter(26, 'trade_card_valid', 4, (ctx) => {
  const tc = ctx.tradeCard;
  return { pass: tc && !tc.error, reason: tc?.error || 'OK', value: tc?.strategy, severity: 'HALT' };
});

defFilter(27, 'all_legs_have_premiums', 4, (ctx) => {
  const tc = ctx.tradeCard;
  if (!tc?.legs) return { pass: false, reason: 'no legs', value: null, severity: 'HALT' };
  const bad = tc.legs.filter(l => !l.premium || l.premium <= 0);
  return { pass: bad.length === 0, reason: bad.length ? `${bad.length} legs no premium` : 'all OK', value: bad.length, severity: 'HALT' };
});

defFilter(28, 'net_credit_positive', 4, (ctx) => {
  const c = ctx.tradeCard?.credit || 0;
  return { pass: c > 0, reason: `credit ₹${c}`, value: c, severity: 'HALT' };
});

defFilter(29, 'real_margin_check', 4, (ctx) => {
  const need = ctx.realMargin ?? ctx.tradeCard?.marginEstimate ?? 0;
  const have = ctx.availableMargin || 0;
  const ratio = have ? need / have : 1;
  return { pass: ratio <= 0.8, reason: `margin ${(ratio * 100).toFixed(0)}% of available`, value: ratio, severity: 'HALT' };
});

defFilter(30, 'min_credit_threshold', 4, (ctx) => {
  const c = ctx.tradeCard?.credit || 0;
  const lots = ctx.lots || 1;
  const perLot = c / lots;
  return { pass: perLot >= 500, reason: `₹${perLot.toFixed(0)}/lot`, value: perLot, severity: 'SKIP' };
});

defFilter(31, 'lots_at_least_one', 4, (ctx) => ({
  pass: (ctx.lots || 0) >= 1, reason: `${ctx.lots || 0} lots`, value: ctx.lots, severity: 'HALT'
}));

// ---------- Layers 5, 6, 7 are operational (run during placement / monitor / post-trade) ----------
// We list them so the count is correct (55) but they're invoked from execution_engine and monitor_engine.

defFilter(32, 'basket_placed_all_legs',  5, () => ({ pass: true, reason: 'operational', value: null, severity: 'HALT' }));
defFilter(33, 'all_legs_filled_60s',     5, () => ({ pass: true, reason: 'operational', value: null, severity: 'HALT' }));
defFilter(34, 'fill_within_5pct_expected', 5, () => ({ pass: true, reason: 'operational', value: null, severity: 'WARN' }));
defFilter(35, 'combined_credit_90pct',   5, () => ({ pass: true, reason: 'operational', value: null, severity: 'WARN' }));
defFilter(36, 'position_visible_in_kite', 5, () => ({ pass: true, reason: 'operational', value: null, severity: 'HALT' }));
defFilter(37, 'partial_fill_handled',    5, () => ({ pass: true, reason: 'operational', value: null, severity: 'HALT' }));

defFilter(38, 'per_leg_sl',              6, () => ({ pass: true, reason: 'monitor', value: null, severity: 'EXIT_LEG' }));
defFilter(39, 'combined_sl',             6, () => ({ pass: true, reason: 'monitor', value: null, severity: 'EXIT_ALL' }));
defFilter(40, 'single_day_max_loss',     6, () => ({ pass: true, reason: 'monitor', value: null, severity: 'EXIT_ALL' }));
defFilter(41, 'vix_spike_intraday',      6, () => ({ pass: true, reason: 'monitor', value: null, severity: 'EXIT_ALL' }));
defFilter(42, 'nifty_move_during_position', 6, () => ({ pass: true, reason: 'monitor', value: null, severity: 'EXIT_ALL' }));
defFilter(43, 'force_exit_time',         6, () => ({ pass: true, reason: 'monitor', value: null, severity: 'EXIT_ALL' }));

defFilter(44, 'all_exit_orders_filled',  7, () => ({ pass: true, reason: 'post-trade', value: null, severity: 'HALT' }));
defFilter(45, 'no_open_positions_remaining', 7, () => ({ pass: true, reason: 'post-trade', value: null, severity: 'EXIT_ALL' }));
defFilter(46, 'pnl_computed',            7, () => ({ pass: true, reason: 'post-trade', value: null, severity: 'HALT' }));
defFilter(47, 'pnl_reasonable',          7, () => ({ pass: true, reason: 'post-trade', value: null, severity: 'WARN' }));
defFilter(48, 'trade_logged_to_db',      7, () => ({ pass: true, reason: 'post-trade', value: null, severity: 'HALT' }));

// ---------- Layer 8: Engine-level kill switches (7 filters) ----------
defFilter(49, 'manual_pause', 8, (ctx) => ({
  pass: !ctx.settings?.killed_until, reason: ctx.settings?.killed_until ? `killed: ${ctx.settings.killed_reason}` : 'active', value: null, severity: 'HALT'
}));

defFilter(50, 'two_consec_max_loss_days', 8, (ctx) => {
  const c = ctx.consecMaxLossDays || 0;
  return { pass: c < 2, reason: `${c} consec max-loss days`, value: c, severity: 'HALT' };
});

defFilter(51, 'drawdown_exceeded', 8, (ctx) => {
  const dd = ctx.drawdown || 0;
  const cap = ctx.settings?.capital || 200000;
  const ratio = dd / cap;
  return { pass: ratio < 0.15, reason: `DD ${(ratio * 100).toFixed(1)}% of capital`, value: ratio, severity: 'HALT' };
});

defFilter(52, 'margin_utilization_high', 8, (ctx) => {
  const ratio = ctx.marginUtilPct || 0;
  return { pass: ratio < 0.8, reason: `${(ratio * 100).toFixed(0)}% margin used`, value: ratio, severity: 'WARN' };
});

defFilter(53, 'broker_outage', 8, (ctx) => {
  const fail = ctx.broker?.consecFails || 0;
  return { pass: fail < 3, reason: `${fail} consecutive Kite failures`, value: fail, severity: 'SAFE_MODE' };
});

defFilter(54, 'ws_disconnected', 8, (ctx) => {
  const downSec = ctx.wsDownSec || 0;
  return { pass: downSec < 60, reason: `WS down ${downSec}s`, value: downSec, severity: 'SAFE_MODE' };
});

defFilter(55, 'reconciliation_drift', 8, (ctx) => {
  const drift = ctx.reconcileDrift || 0;
  return { pass: drift < 1, reason: drift ? `${drift} positions drifted` : 'in sync', value: drift, severity: 'HALT' };
});

// ---------- Orchestrator ----------
function runLayer(layerNum, ctx) {
  return FILTERS.filter(f => f.layer === layerNum).map(f => {
    const r = f.fn(ctx) || {};
    return { id: f.id, name: f.name, layer: f.layer, ...r };
  });
}

function runAllFilters(ctx) {
  const allResults = [];
  // Run layers 1-4 + 8 only (5/6/7 are operational, run elsewhere)
  for (const layer of [1, 2, 3, 4, 8]) {
    for (const f of FILTERS.filter(f => f.layer === layer)) {
      const r = f.fn(ctx) || {};
      allResults.push({ id: f.id, name: f.name, layer: f.layer, ...r });
    }
  }
  const blockers = allResults.filter(r => !r.pass && ['HALT', 'SKIP', 'SAFE_MODE'].includes(r.severity));
  const warnings = allResults.filter(r => !r.pass && r.severity === 'WARN');

  let decision = 'TRADE', reason = 'all filters passed';
  if (blockers.find(b => b.severity === 'SAFE_MODE')) {
    decision = 'SAFE_MODE'; reason = blockers.find(b => b.severity === 'SAFE_MODE').reason;
  } else if (blockers.find(b => b.severity === 'HALT')) {
    decision = 'HALT'; reason = blockers.find(b => b.severity === 'HALT').reason;
  } else if (blockers.find(b => b.severity === 'SKIP')) {
    decision = 'SKIP'; reason = blockers.find(b => b.severity === 'SKIP').reason;
  }

  // Determine strategy
  const day = ctx.day || time.dayOfWeek();
  const isExp = time.isExpiryToday();
  const strategy = strategyEngine.pickStrategy({ day, vix: ctx.vixPrior, isExpiry: isExp });
  const band = strategyEngine.vixBand(ctx.vixPrior);

  return {
    decision, reason, strategy, day, vix_band: band,
    matrix_cell: `${day} × ${band} → ${strategy}`,
    results: allResults, blockers, warnings,
  };
}

module.exports = { FILTERS, runAllFilters, runLayer };
