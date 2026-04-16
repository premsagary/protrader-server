/**
 * execution-engine.js — order placement adapter.
 *
 * Phase 1 (this file): DRY RUN ONLY. The `dryRun` adapter is the only path
 * that's live. It returns a synthetic order id so the audit chain can be
 * exercised end-to-end without touching Kite.
 *
 * Paper (Phase 2) and Live (Phase 3) adapters are stubbed with clear throws
 * so an accidental env flip doesn't place orders.
 *
 * Shape of place() return:
 *   { ok: boolean, entryOrderId, slOrderId, targetOrderId, error? }
 */

'use strict';

const crypto = require('crypto');
const { getMode } = require('./agent-config');

function _syntheticId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Dry-run adapter — no broker touch, no DB write beyond what audit already did
// ────────────────────────────────────────────────────────────────────────────
async function placeDryRun(proposal) {
  return {
    ok: true,
    mode: 'dry_run',
    entryOrderId:  _syntheticId('dry-entry'),
    slOrderId:     _syntheticId('dry-sl'),
    targetOrderId: _syntheticId('dry-tgt'),
    note: 'dry_run: no order was placed',
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Paper adapter — Phase 2. Simulates fills at live quote + slippage.
// Intentionally stubbed here so Phase 2 can wire pricing without surprises.
// ────────────────────────────────────────────────────────────────────────────
async function placePaper(proposal, deps) {
  throw new Error('execution-engine.placePaper: not yet implemented (Phase 2)');
}

// ────────────────────────────────────────────────────────────────────────────
// Live adapter — Phase 3. Guard with a hard refusal in Phase 1.
// ────────────────────────────────────────────────────────────────────────────
async function placeLive(proposal, deps) {
  throw new Error('execution-engine.placeLive: live mode is disabled in Phase 1 scaffolding');
}

// ────────────────────────────────────────────────────────────────────────────
// Public dispatcher — routes by AGENT_MODE
// ────────────────────────────────────────────────────────────────────────────
async function place(proposal, deps) {
  const mode = getMode();
  switch (mode) {
    case 'dry_run': return placeDryRun(proposal);
    case 'paper':   return placePaper(proposal, deps);
    case 'live':    return placeLive(proposal, deps);
    default:        return { ok: false, error: `disabled:mode=${mode}` };
  }
}

module.exports = { place };
