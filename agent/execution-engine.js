/**
 * execution-engine.js — order placement adapter.
 *
 * Phase 2 wires the `paper` mode: proposal arrives, we arm it in the
 * paper-fill-engine. The actual fill happens on a later agent cycle when
 * the trigger price is hit. This asynchronous arm-then-fill design is what
 * makes paper trading honest — it respects the "wait for candle confirmation
 * above the breakout" contract that trade-agent builds into trigger_price.
 *
 * paper — arm candidate via paper-fill-engine. Fill is emitted later.
 * live  — hard refusal (Phase 3, not built).
 *
 * (dry_run was removed 2026-04-17 — paper already produces the same audit
 * trail without adding a second mode to think about.)
 *
 * Dependencies required by paper mode:
 *   deps.decisionId — agent_decisions.id for this proposal (injected by
 *                     orchestrator after audit writes the row).
 *   deps.runId      — current agent cycle run id (for event correlation).
 */

'use strict';

const { getMode } = require('./agent-config');
const paper = require('./paper-fill-engine');

// ────────────────────────────────────────────────────────────────────────────
// Paper adapter — arm the candidate; evaluateArmed() in the next cycle will
// flip it into a filled agent_trades row when the trigger price is hit.
// ────────────────────────────────────────────────────────────────────────────
async function placePaper(proposal, deps) {
  if (!deps || !deps.decisionId) {
    return { ok: false, error: 'paper: decisionId missing from deps' };
  }
  const r = paper.arm(deps.decisionId, proposal, deps.runId || null);
  return {
    ok: true,
    mode: 'paper',
    armed: r.armed,
    decisionId: deps.decisionId,
    triggerPrice: proposal.trigger_price,
    note: r.armed ? 'paper: armed, fill pending trigger' : `paper: ${r.reason}`,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Live adapter — Phase 3. Guard with a hard refusal for now.
// ────────────────────────────────────────────────────────────────────────────
async function placeLive(proposal, deps) {
  throw new Error('execution-engine.placeLive: live mode is disabled (Phase 3 not yet built)');
}

// ────────────────────────────────────────────────────────────────────────────
// Public dispatcher
// ────────────────────────────────────────────────────────────────────────────
async function place(proposal, deps) {
  const mode = getMode();
  switch (mode) {
    case 'paper': return placePaper(proposal, deps);
    case 'live':  return placeLive(proposal, deps);
    default:      return { ok: false, error: `disabled:mode=${mode}` };
  }
}

module.exports = { place };
