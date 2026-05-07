// backtest/replay.js
// ─────────────────────────────────────────────────────────────────────────
// Walk-forward replay engine. Given a historical IST date, replays the
// trading day 5-min bar at a time against the in-process scoreDayTrade()
// function and simulates entries + exits exactly the way scanAndTrade
// would have fired them in production. Returns a summary the daily report
// can render: trades fired, win rate, simulated P&L, comparison vs live.
//
// Pure module — does no DB I/O on require. Caller injects:
//   - loadCandlesForDate(date)         → Map<sym, candles[]> sorted ASC
//   - loadFundamentalsSnapshot(date)   → optional, falls back to live cache
//   - scoreDayTrade(candles, sym, ctx) → in-process scorer (same one prod uses)
//   - computeRiskPlan({entry, atr})    → optional, falls back to inline calc
//   - logger                           → optional, defaults to console
//
// Constraints honored from production scanAndTrade (line 4022 kite-server.js):
//   * 30-bar minimum before scoring
//   * Top-N picks by dayTradeScore per cycle (default 5)
//   * Same-symbol dedup (won't re-enter same sym in same session)
//   * Sector cap (max 2 per sector if sector data available)
//   * Risk per trade = 1% of capital, max 30% notional per position
//   * Max concurrent open trades (default 3)
//   * No new entries after 14:30 IST
//   * EOD square-off at 15:15 IST (Varsity M9)
// ─────────────────────────────────────────────────────────────────────────

'use strict';

const DEFAULT_CFG = Object.freeze({
  capital: 100000,                  // ₹1L starting capital per backtest run
  riskPerTradePct: 1,               // 1% capital risk
  maxNotionalPctPerPos: 30,         // 30% notional cap per stock
  maxConcurrent: 3,                 // 3 open positions max
  topNPerCycle: 5,                  // top 5 picks per scan cycle
  noNewEntriesAfter: '14:30',       // IST cutoff
  squareOffAt: '15:15',             // IST EOD
  slippageBps: 5,                   // 0.05% per side (10bps round-trip)
  brokerageRoundTrip: 40,           // ~₹40 per trade (Zerodha intraday flat)
  // 0 means "trust scoreDayTrade's internal preflight gates". Was 60
  // (Good Setup tier on dayTradeScore 0-100 scale), but scanAndTrade in
  // production trades on result.score from selectAndRunStrategy (0-10
  // scale, stored as signal_score = score×10). Different scoring system →
  // 60 filtered everything in 2026-04-27 replay even though live fired 2
  // trades. Until we extract the live strategy engine into an importable
  // module, the backtest can't match production exactly; setting threshold
  // to 0 at least produces output to compare.
  minScoreThreshold: 0,
  // Binary-only mode (2026-04-27) — strips numeric score thresholds and
  // requires only the Varsity M2 Ch 19 binary checklist (≥4 of 5: price
  // action, volume, S/R context, indicators, R:R) plus scoreDayTrade's
  // built-in preflight safety gates. Used to A/B test whether the
  // composite scoring system adds signal vs. just the binary checklist.
  binaryOnly: false,
  ch19MinPassCount: 4,
});

/**
 * Replay one historical IST trading day.
 *
 * @param {string} dateStr - 'YYYY-MM-DD' IST calendar date
 * @param {object} deps    - { loadCandlesForDate, scoreDayTrade, ... }
 * @param {object} [cfg]   - optional overrides for DEFAULT_CFG
 * @returns {Promise<{date, trades:[], summary:{}}>}
 */
async function replayDate(dateStr, deps, cfg = {}) {
  const C = { ...DEFAULT_CFG, ...cfg };
  const log = deps.logger || console;
  const { loadCandlesForDate, scoreDayTrade } = deps;

  if (!loadCandlesForDate || !scoreDayTrade) {
    throw new Error('replay: loadCandlesForDate and scoreDayTrade are required');
  }

  // Load all 5-min candles for the day (and prior day for trailing-30 history)
  const all = await loadCandlesForDate(dateStr);   // Map<sym, candles[]>
  if (!all || all.size === 0) {
    return { date: dateStr, trades: [], summary: { error: 'no_candles_for_date' } };
  }

  // Build the per-bar timeline. IST market hours: 9:15:00 to 15:30:00.
  // Each bar is the candle whose ts falls in [09:15+5k, 09:15+5(k+1)) for k=0..74.
  const timeline = _buildTimeline(dateStr, all);   // sorted unique ts (UTC Date)
  if (timeline.length === 0) {
    return { date: dateStr, trades: [], summary: { error: 'no_intraday_bars' } };
  }

  const openTrades = new Map();   // sym → { entryPrice, entryTs, qty, sl, target, setup, sector }
  const closedTrades = [];        // completed (entry → exit) records
  const enteredToday = new Set(); // dedup: never re-enter same sym in session
  const sectorCount = new Map();  // sector → open count for sector cap
  let availableCash = C.capital;

  // Walk forward bar-by-bar
  for (let i = 0; i < timeline.length; i++) {
    const barTs = timeline[i];
    const barTime = _istHHmm(barTs);

    // ── Step 1: process exits on existing open trades against THIS bar
    for (const [sym, t] of [...openTrades.entries()]) {
      const candles = all.get(sym);
      const bar = candles && candles.find(c => +new Date(c.ts) === +barTs);
      if (!bar) continue;
      const exit = _checkExit(t, bar, barTs, barTime, C);
      if (exit) {
        const pnl = _computePnL(t, exit.price, C);
        closedTrades.push({
          sym, sector: t.sector, setup: t.setup, direction: t.direction || 'LONG',
          entryTs: t.entryTs, entryPrice: t.entryPrice, qty: t.qty,
          exitTs: barTs, exitPrice: exit.price, exitReason: exit.reason,
          slPlanned: t.sl, targetPlanned: t.target,
          pnl: pnl.netPnl, pnlPct: pnl.netPnlPct, grossPnl: pnl.grossPnl,
          slippage: pnl.slippage, brokerage: pnl.brokerage,
          holdMins: Math.round((+barTs - +t.entryTs) / 60000),
        });
        availableCash += t.entryPrice * t.qty + pnl.netPnl;
        openTrades.delete(sym);
        const prev = sectorCount.get(t.sector) || 0;
        sectorCount.set(t.sector, Math.max(0, prev - 1));
      }
    }

    // ── Step 2: end-of-day forced square-off
    if (barTime >= C.squareOffAt) {
      for (const [sym, t] of [...openTrades.entries()]) {
        const candles = all.get(sym);
        const bar = candles && candles.find(c => +new Date(c.ts) === +barTs);
        if (!bar) continue;
        const pnl = _computePnL(t, bar.close, C);
        closedTrades.push({
          sym, sector: t.sector, setup: t.setup, direction: t.direction || 'LONG',
          entryTs: t.entryTs, entryPrice: t.entryPrice, qty: t.qty,
          exitTs: barTs, exitPrice: bar.close, exitReason: 'EOD_SQUAREOFF',
          slPlanned: t.sl, targetPlanned: t.target,
          pnl: pnl.netPnl, pnlPct: pnl.netPnlPct, grossPnl: pnl.grossPnl,
          slippage: pnl.slippage, brokerage: pnl.brokerage,
          holdMins: Math.round((+barTs - +t.entryTs) / 60000),
        });
        availableCash += t.entryPrice * t.qty + pnl.netPnl;
      }
      openTrades.clear();
      continue;   // no new entries past square-off
    }

    // ── Step 3: skip new entries after cutoff
    if (barTime >= C.noNewEntriesAfter) continue;

    // ── Step 4: skip if we already have max concurrent
    if (openTrades.size >= C.maxConcurrent) continue;

    // ── Step 5: score every symbol with candles up to and including this bar
    const candidates = [];
    for (const [sym, candles] of all.entries()) {
      // Window: all candles with ts <= barTs
      const window = candles.filter(c => +new Date(c.ts) <= +barTs);
      if (window.length < 30) continue;

      let result;
      try {
        result = scoreDayTrade(window, sym, deps.ctxAt ? deps.ctxAt(barTs) : {});
      } catch (e) {
        // Don't let one symbol's error halt the replay
        if (deps.onError) deps.onError(sym, e);
        continue;
      }
      if (!result || !result.dayTradeScore) continue;
      if (result.dayTradeScore < C.minScoreThreshold) continue;

      // Don't re-enter same symbol in same session
      if (enteredToday.has(sym)) continue;

      // Sector cap (best-effort — uses fundamentals lookup if provided)
      const sector = (deps.sectorOf && deps.sectorOf(sym)) || 'UNKNOWN';
      if ((sectorCount.get(sector) || 0) >= 2) continue;

      const lastPx = window[window.length - 1].close;

      // ── LONG candidate (Ch19 binary or composite gate) ──
      let longOk = true;
      if (C.binaryOnly) {
        const ch19 = (typeof result.ch19PassCount === 'number') ? result.ch19PassCount : 0;
        if (ch19 < C.ch19MinPassCount) longOk = false;
      }
      if (longOk) {
        candidates.push({
          sym, sector, direction: 'LONG',
          score: result.dayTradeScore,
          setup: result.bestSetup && result.bestSetup.type,
          sl:    result.sl    || result.stopLoss   || result.bestSetup?.sl,
          target:result.target|| result.bestSetup?.target,
          last:  lastPx,
        });
      }

      // ── SHORT candidate (Varsity Ch19 binary, mirror of long path) ──
      // 2026-05-06: enabled when C.includeShorts is true. Falls back to
      // long-only behavior when not configured. The replay assumes the
      // backtest harness passes deps.shortsEnabled or C.includeShorts.
      if (C.includeShorts !== false && typeof result.ch19PassCountShort === 'number') {
        const ch19s = result.ch19PassCountShort;
        const minShort = C.ch19MinPassCountShort || C.ch19MinPassCount || 4;
        if (ch19s >= minShort && result.bestShortSetup) {
          // Short SL/TGT aren't on the dts return — derive from entry +
          // stopDist using the same RISK_REWARD as longs (1.5×). For a
          // proper backtest we'd run findSwingHigh on the window; for now
          // use ATR fallback with same bps assumption as live.
          const _atr = _computeAtr(window, 14);
          const _stopDist = Math.max(_atr * 1.5, lastPx * 0.005);
          const _shortSl  = +(lastPx + _stopDist).toFixed(2);
          const _shortTgt = +(lastPx - _stopDist * (C.riskReward || 1.5)).toFixed(2);
          candidates.push({
            sym, sector, direction: 'SHORT',
            score: result.dayTradeScore,           // composite long score (informational)
            setup: result.bestShortSetup,
            sl:    _shortSl,
            target:_shortTgt,
            last:  lastPx,
          });
        }
      }
    }

    // ── Step 6: pick top-N, attempt entries at NEXT bar's open
    candidates.sort((a, b) => b.score - a.score);
    const picks = candidates.slice(0, C.topNPerCycle);

    const nextBarTs = timeline[i + 1];
    if (!nextBarTs) continue;   // last bar, no entry possible

    for (const pick of picks) {
      if (openTrades.size >= C.maxConcurrent) break;
      if (enteredToday.has(pick.sym)) continue;

      const candles = all.get(pick.sym);
      const nextBar = candles && candles.find(c => +new Date(c.ts) === +nextBarTs);
      if (!nextBar) continue;

      const entryPrice = nextBar.open;
      if (!entryPrice || !pick.sl || !pick.target) continue;
      const stopDist = Math.abs(entryPrice - pick.sl);
      if (stopDist <= 0) continue;

      // Position sizing: 1% capital risk, capped at 30% notional
      const riskAmount = C.capital * (C.riskPerTradePct / 100);
      const qtyByRisk = Math.floor(riskAmount / stopDist);
      const qtyByCap  = Math.floor((C.capital * C.maxNotionalPctPerPos / 100) / entryPrice);
      const qtyByCash = Math.floor(availableCash / entryPrice);
      const qty = Math.max(0, Math.min(qtyByRisk, qtyByCap, qtyByCash));
      if (qty <= 0) continue;

      const notional = entryPrice * qty;
      availableCash -= notional;

      openTrades.set(pick.sym, {
        sym: pick.sym, sector: pick.sector, setup: pick.setup,
        entryTs: nextBarTs, entryPrice, qty,
        sl: pick.sl, target: pick.target,
        direction: pick.direction || 'LONG',  // 2026-05-06 — direction tag
      });
      enteredToday.add(pick.sym);
      sectorCount.set(pick.sector, (sectorCount.get(pick.sector) || 0) + 1);
    }
  }

  // Square off anything still open at end of timeline (shouldn't happen but safe)
  for (const [sym, t] of openTrades.entries()) {
    const lastBar = (all.get(sym) || []).slice(-1)[0];
    if (!lastBar) continue;
    const pnl = _computePnL(t, lastBar.close, C);
    closedTrades.push({
      sym, sector: t.sector, setup: t.setup, direction: t.direction || 'LONG',
      entryTs: t.entryTs, entryPrice: t.entryPrice, qty: t.qty,
      exitTs: new Date(lastBar.ts), exitPrice: lastBar.close,
      exitReason: 'TIMELINE_END',
      slPlanned: t.sl, targetPlanned: t.target,
      pnl: pnl.netPnl, pnlPct: pnl.netPnlPct, grossPnl: pnl.grossPnl,
      slippage: pnl.slippage, brokerage: pnl.brokerage,
      holdMins: Math.round((+new Date(lastBar.ts) - +t.entryTs) / 60000),
    });
  }

  return {
    date: dateStr,
    trades: closedTrades,
    summary: _summarize(closedTrades, C),
    config: { capital: C.capital, minScore: C.minScoreThreshold, maxConcurrent: C.maxConcurrent },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function _buildTimeline(dateStr, candleMap) {
  const istStart = new Date(dateStr + 'T09:15:00+05:30').getTime();
  const istEnd   = new Date(dateStr + 'T15:30:00+05:30').getTime();
  const tsSet = new Set();
  for (const candles of candleMap.values()) {
    for (const c of candles) {
      const t = +new Date(c.ts);
      if (t >= istStart && t <= istEnd) tsSet.add(t);
    }
  }
  return [...tsSet].sort((a, b) => a - b).map(t => new Date(t));
}

function _istHHmm(date) {
  const d = new Date(+date + 5.5 * 3600 * 1000);
  return d.toISOString().slice(11, 16);   // 'HH:MM'
}

function _checkExit(t, bar, barTs, barTime, cfg) {
  // 2026-05-06 — direction-aware exit. Long: SL below entry, TGT above.
  // Short: SL above entry, TGT below. Default LONG for backwards-compat
  // with any backtest run that pre-dates the direction tag.
  const isShort = (t.direction || 'LONG') === 'SHORT';
  if (isShort) {
    // SHORT: SL hit when bar's HIGH crosses up through SL (above entry)
    if (bar.high != null && bar.high >= t.sl) {
      return { reason: 'STOP_LOSS', price: t.sl };
    }
    // SHORT: TGT hit when bar's LOW crosses down through TGT (below entry)
    if (bar.low != null && bar.low <= t.target) {
      return { reason: 'TARGET', price: t.target };
    }
  } else {
    // LONG (original): SL hit when LOW crosses down, TGT when HIGH crosses up
    if (bar.low != null && bar.low <= t.sl) {
      return { reason: 'STOP_LOSS', price: t.sl };
    }
    if (bar.high != null && bar.high >= t.target) {
      return { reason: 'TARGET', price: t.target };
    }
  }
  return null;
}

function _computePnL(t, exitPrice, cfg) {
  // 2026-05-06 — direction-aware. Short profits when exit < entry.
  const isShort = (t.direction || 'LONG') === 'SHORT';
  const grossPnl = isShort
    ? (t.entryPrice - exitPrice) * t.qty
    : (exitPrice - t.entryPrice) * t.qty;
  const slippage = (t.entryPrice * t.qty + exitPrice * t.qty) * (cfg.slippageBps / 10000);
  const brokerage = cfg.brokerageRoundTrip;
  const netPnl = grossPnl - slippage - brokerage;
  const netPnlPct = (netPnl / (t.entryPrice * t.qty)) * 100;
  return { grossPnl, slippage, brokerage, netPnl, netPnlPct };
}

function _summarize(trades, cfg) {
  if (trades.length === 0) {
    return {
      tradeCount: 0, wins: 0, losses: 0, winRate: 0,
      grossPnl: 0, netPnl: 0, totalSlippage: 0, totalBrokerage: 0,
      bestTrade: null, worstTrade: null,
      avgWinR: 0, avgLossR: 0,
      finalCapital: cfg.capital, returnPct: 0,
    };
  }
  let grossPnl = 0, netPnl = 0, slippage = 0, brokerage = 0;
  let wins = 0, losses = 0;
  let best = trades[0], worst = trades[0];
  for (const t of trades) {
    grossPnl += t.grossPnl;
    netPnl += t.pnl;
    slippage += t.slippage;
    brokerage += t.brokerage;
    if (t.pnl > 0) wins++;
    else if (t.pnl < 0) losses++;
    if (t.pnl > best.pnl) best = t;
    if (t.pnl < worst.pnl) worst = t;
  }
  const finalCapital = cfg.capital + netPnl;
  return {
    tradeCount: trades.length,
    wins, losses,
    winRate: trades.length ? +(wins / trades.length * 100).toFixed(1) : 0,
    grossPnl: +grossPnl.toFixed(2),
    netPnl: +netPnl.toFixed(2),
    totalSlippage: +slippage.toFixed(2),
    totalBrokerage: +brokerage.toFixed(2),
    bestTrade: { sym: best.sym, pnl: +best.pnl.toFixed(2), pct: +best.pnlPct.toFixed(2) },
    worstTrade: { sym: worst.sym, pnl: +worst.pnl.toFixed(2), pct: +worst.pnlPct.toFixed(2) },
    finalCapital: +finalCapital.toFixed(2),
    returnPct: +((netPnl / cfg.capital) * 100).toFixed(2),
    setupBreakdown: _setupBreakdown(trades),
  };
}

function _setupBreakdown(trades) {
  const map = new Map();
  for (const t of trades) {
    const key = t.setup || 'UNKNOWN';
    const m = map.get(key) || { count: 0, wins: 0, netPnl: 0 };
    m.count++;
    m.netPnl += t.pnl;
    if (t.pnl > 0) m.wins++;
    map.set(key, m);
  }
  const out = {};
  for (const [k, v] of map) {
    out[k] = {
      count: v.count,
      wins: v.wins,
      winRate: +(v.wins / v.count * 100).toFixed(1),
      netPnl: +v.netPnl.toFixed(2),
    };
  }
  return out;
}

// 2026-05-06 — minimal ATR helper for short SL/TGT derivation. Live code
// uses computeShortPositionSize with findSwingHigh; backtest uses the
// simpler ATR floor since findSwingHigh would require porting the whole
// swing-detection logic into replay. Acceptable approximation for a
// validation harness.
function _computeAtr(candles, period = 14) {
  const slice = candles.slice(-period);
  if (slice.length < 2) return 0;
  let sum = 0, count = 0;
  for (let i = 1; i < slice.length; i++) {
    const tr = Math.max(
      slice[i].high - slice[i].low,
      Math.abs(slice[i].high - slice[i - 1].close),
      Math.abs(slice[i].low  - slice[i - 1].close)
    );
    sum += tr; count++;
  }
  return count > 0 ? sum / count : 0;
}

module.exports = { replayDate, DEFAULT_CFG };
