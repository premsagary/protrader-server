/**
 * constraint-engine.js — validation layer. OVERRIDES the agent.
 *
 * Every proposal must pass every hard constraint. On first fail, return a
 * structured rejection with an enum code (no free text). Constraints are
 * evaluated in order of "cheapness" → cheap-state checks before anything
 * that would touch capital math.
 *
 * Stateful constraints (e.g., sector taken by an earlier proposal in the
 * same cycle) use `runningLedger` — an in-memory accumulator that tracks
 * what *this cycle* has already approved. This is what prevents double-
 * booking the same sector when three proposals pass individually.
 */

'use strict';

const { CONSTRAINTS, PAPER_CAPITAL_RUPEES } = require('./agent-config');

const REJECT_CODES = Object.freeze({
  NO_QTY:                'CONSTRAINT_ZERO_QUANTITY',
  RR_BELOW_MIN:          'CONSTRAINT_RR_BELOW_MIN',
  RISK_ABOVE_CAP:        'CONSTRAINT_RISK_ABOVE_CAP',
  POSITION_TOO_LARGE:    'CONSTRAINT_POSITION_TOO_LARGE',
  DAILY_TRADE_LIMIT:     'CONSTRAINT_DAILY_TRADE_LIMIT',
  CONCURRENT_LIMIT:      'CONSTRAINT_CONCURRENT_LIMIT',
  DUPE_SYMBOL:           'CONSTRAINT_DUPLICATE_SYMBOL',
  DUPE_SECTOR:           'CONSTRAINT_DUPLICATE_SECTOR',
  AFTER_CUTOFF:          'CONSTRAINT_AFTER_ENTRY_CUTOFF',
  INVALID_PROPOSAL:      'CONSTRAINT_INVALID_PROPOSAL',
});

// ── Running ledger — one instance per cycle ─────────────────────────────────
function newLedger(state) {
  // Seed with symbols/sectors already traded today so we never duplicate them
  // even across cycles.
  const approvedSyms     = new Set(state.tradedSymsToday || []);
  const approvedSectors  = new Set((state.tradedSectorsToday || []).map(s => (s || '').toUpperCase()));
  return {
    approvedSyms,
    approvedSectors,
    approvedCount: state.tradesTodayCount || 0,
    concurrent:    (state.openPositions || []).length,
  };
}

// ── Size adjustment — halve size if near daily-loss cap ─────────────────────
function adjustSizeForRisk(proposal, state) {
  const lossPct = (state.realizedPnlToday / (state.capital || PAPER_CAPITAL_RUPEES)) * 100;
  if (lossPct <= -CONSTRAINTS.HALVE_SIZE_AT_DAILY_LOSS_PCT) {
    return {
      quantity:  Math.floor(proposal.quantity / 2),
      adjusted:  true,
      reason:    `near_daily_loss_cap:${lossPct.toFixed(2)}%`,
    };
  }
  return { quantity: proposal.quantity, adjusted: false, reason: null };
}

// ── Per-proposal validator ───────────────────────────────────────────────────
function validateOne(proposal, state, ledger) {
  const capital = state.capital || PAPER_CAPITAL_RUPEES;

  // Shape sanity
  if (!proposal || !proposal.sym || !proposal.stop_loss || !proposal.target) {
    return { approved: false, code: REJECT_CODES.INVALID_PROPOSAL, detail: 'missing_required_fields' };
  }

  // Time cutoff (redundant with agent filter + state kill-switch, but belt+braces)
  if (state.minsSinceOpen >= CONSTRAINTS.NO_ENTRIES_AFTER_MINS) {
    return { approved: false, code: REJECT_CODES.AFTER_CUTOFF,
             detail: `minsSinceOpen=${state.minsSinceOpen}` };
  }

  // RR check
  if (proposal.rr_ratio != null && proposal.rr_ratio < CONSTRAINTS.MIN_RR_RATIO) {
    return { approved: false, code: REJECT_CODES.RR_BELOW_MIN,
             detail: `rr=${proposal.rr_ratio} < ${CONSTRAINTS.MIN_RR_RATIO}` };
  }

  // Size adjustment (cooldown near daily loss cap)
  const adj = adjustSizeForRisk(proposal, state);
  const qty = adj.quantity;

  if (qty <= 0) {
    return { approved: false, code: REJECT_CODES.NO_QTY,
             detail: adj.adjusted ? `halved_to_zero:${adj.reason}` : 'risk_per_share_gt_budget' };
  }

  // Risk-per-trade cap
  const riskPerShare   = Number(proposal.entry_price) - Number(proposal.stop_loss);
  const totalRisk      = qty * riskPerShare;
  const riskCapRupees  = capital * (CONSTRAINTS.MAX_RISK_PER_TRADE_PCT / 100);
  if (totalRisk > riskCapRupees * 1.01) { // 1% tolerance for float
    return { approved: false, code: REJECT_CODES.RISK_ABOVE_CAP,
             detail: `risk=${totalRisk.toFixed(0)} > cap=${riskCapRupees.toFixed(0)}` };
  }

  // Concentration
  const notional = qty * Number(proposal.entry_price);
  const concCap  = capital * (CONSTRAINTS.MAX_POSITION_PCT_OF_CAPITAL / 100);
  if (notional > concCap * 1.01) {
    return { approved: false, code: REJECT_CODES.POSITION_TOO_LARGE,
             detail: `notional=${notional.toFixed(0)} > cap=${concCap.toFixed(0)}` };
  }

  // Daily count
  if (ledger.approvedCount >= CONSTRAINTS.MAX_TRADES_PER_DAY) {
    return { approved: false, code: REJECT_CODES.DAILY_TRADE_LIMIT,
             detail: `count=${ledger.approvedCount}` };
  }

  // Concurrent
  if (ledger.concurrent >= CONSTRAINTS.MAX_CONCURRENT_TRADES) {
    return { approved: false, code: REJECT_CODES.CONCURRENT_LIMIT,
             detail: `concurrent=${ledger.concurrent}` };
  }

  // Dupe symbol
  if (CONSTRAINTS.NO_DUPE_SYMBOL && ledger.approvedSyms.has(proposal.sym)) {
    return { approved: false, code: REJECT_CODES.DUPE_SYMBOL,
             detail: `already_traded_today:${proposal.sym}` };
  }

  // Dupe sector
  const sec = (proposal.sector || '').toUpperCase();
  if (CONSTRAINTS.NO_DUPE_SECTOR && sec && ledger.approvedSectors.has(sec)) {
    return { approved: false, code: REJECT_CODES.DUPE_SECTOR,
             detail: `sector_already_used:${sec}` };
  }

  return {
    approved: true,
    code: null,
    adjusted_quantity: qty,
    size_adjustment: adj.adjusted ? adj.reason : null,
  };
}

// ── Batch entry point ────────────────────────────────────────────────────────
function validate(proposals, state) {
  const ledger   = newLedger(state);
  const approved = [];
  const rejected = [];

  for (const p of proposals) {
    const r = validateOne(p, state, ledger);
    if (r.approved) {
      const finalP = { ...p, quantity: r.adjusted_quantity };
      if (r.size_adjustment) finalP.size_adjustment = r.size_adjustment;
      approved.push(finalP);
      // Update ledger so subsequent proposals in this cycle see the commitment
      ledger.approvedSyms.add(p.sym);
      if (p.sector) ledger.approvedSectors.add(p.sector.toUpperCase());
      ledger.approvedCount += 1;
      ledger.concurrent    += 1;
    } else {
      rejected.push({ ...p, rejection_code: r.code, rejection_detail: r.detail });
    }
  }

  return { approved, rejected };
}

module.exports = {
  validate,
  REJECT_CODES,
  _internal: { validateOne, newLedger, adjustSizeForRisk },
};
