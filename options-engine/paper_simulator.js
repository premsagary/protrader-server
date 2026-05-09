// paper_simulator.js — realistic paper-trading fills with bid/ask + slippage + spread widening.
// Critical: paper convergence is the gate before LIVE deployment.
'use strict';

const SLIPPAGE_PCT_BASE     = 0.005;   // 0.5% base
const SLIPPAGE_PCT_STRESS   = 0.012;   // 1.2% during VIX spike
const SLIPPAGE_PCT_OPEN     = 0.010;   // first 5 minutes of session
const SPREAD_WIDEN_FACTOR_STRESS = 2.5; // spread × 2.5 in stress

function fillPriceForSell(quote, slippagePct = SLIPPAGE_PCT_BASE) {
  const bid = quote.bid || quote.ltp * 0.995;
  return Math.max(0.05, bid * (1 - slippagePct));
}

function fillPriceForBuy(quote, slippagePct = SLIPPAGE_PCT_BASE) {
  const ask = quote.ask || quote.ltp * 1.005;
  return ask * (1 + slippagePct);
}

function widenedQuote(quote, factor) {
  const mid = (quote.bid + quote.ask) / 2;
  const halfSpread = (quote.ask - quote.bid) / 2;
  return { ...quote, bid: mid - halfSpread * factor, ask: mid + halfSpread * factor };
}

function simulateEntryFills(legs, chain, opts = {}) {
  const { vixSpike = false, marketOpen = false } = (typeof opts === 'object' ? opts : { vixSpike: opts });
  const slip = vixSpike ? SLIPPAGE_PCT_STRESS : (marketOpen ? SLIPPAGE_PCT_OPEN : SLIPPAGE_PCT_BASE);
  const spreadFactor = vixSpike ? SPREAD_WIDEN_FACTOR_STRESS : 1;
  return legs.map(leg => {
    let quote = chain[leg.strike]?.[leg.type.toLowerCase()] || { ltp: leg.premium, bid: leg.premium*0.99, ask: leg.premium*1.01 };
    if (spreadFactor > 1 && quote.bid && quote.ask) quote = widenedQuote(quote, spreadFactor);
    const fill = leg.side === 'SELL' ? fillPriceForSell(quote, slip) : fillPriceForBuy(quote, slip);
    return {
      ...leg,
      entry_premium: +fill.toFixed(2),
      bid_at_entry: quote.bid,
      ask_at_entry: quote.ask,
      ltp_at_entry: quote.ltp,
      slippage_pct: slip,
      spread_pct: quote.bid && quote.ask ? (quote.ask - quote.bid) / ((quote.bid + quote.ask) / 2) : null,
    };
  });
}

function simulateExitFills(legs, chain, vixSpike = false) {
  const slip = vixSpike ? SLIPPAGE_PCT_STRESS : SLIPPAGE_PCT_BASE;
  return legs.map(leg => {
    const quote = chain[leg.strike]?.[leg.type.toLowerCase()] || { ltp: leg.current_premium || leg.entry_premium };
    // To exit: SELLER buys back (worse price = ASK + slippage), BUYER sells (BID - slippage)
    const fill = leg.side === 'SELL' ? fillPriceForBuy(quote, slip) : fillPriceForSell(quote, slip);
    return { ...leg, exit_premium: +fill.toFixed(2) };
  });
}

function computeRealizedPnl(legsWithExits, lotSize) {
  return Math.round(legsWithExits.reduce((acc, l) => {
    const sellSide = l.side === 'SELL' ? 1 : -1;
    return acc + (l.entry_premium - l.exit_premium) * sellSide * l.qty * lotSize;
  }, 0));
}

module.exports = {
  simulateEntryFills, simulateExitFills, computeRealizedPnl,
  SLIPPAGE_PCT_BASE, SLIPPAGE_PCT_STRESS,
};
