/**
 * paper-fill-engine.js — armed candidate registry + paper entry fills.
 *
 * Lifecycle:
 *   1. constraint.validate() approves a proposal
 *   2. execution.place() in paper mode calls arm(decisionId, proposal)
 *      → candidate enters in-memory _armed map, logs ARMED_CANDIDATE to console
 *   3. On each agent cycle, evaluateArmed() runs:
 *        → fetches live price via deps.getPrice(sym)
 *        → if trigger hit → writes agent_trades row, emits ORDER_FILLED event,
 *          removes from _armed
 *        → if armed > ARMED_EXPIRY_MINS → expires (logs, removes from _armed)
 *
 * In-memory only — armed state is short-lived (15 min). A restart loses
 * pending arms, which is acceptable; the next cycle will re-arm if the
 * proposal still qualifies. This keeps the module simple and keeps the DB
 * schema clean (agent_trades only gets a row once a fill actually happened).
 *
 * Slippage model: BUY fills at trigger_price + SLIPPAGE_BPS (5 bps = 0.05%).
 * SELL fills at trigger_price - SLIPPAGE_BPS. Matches the armed candidate
 * confirmation offset used in trade-agent.computeTriggerPrice.
 *
 * Concurrency: only one evaluate() at a time per process (_evaluating guard).
 */

'use strict';

const { FILTERS } = require('./agent-config');
const audit = require('./agent-audit');

const SLIPPAGE_BPS = 5;  // 0.05% — same magnitude as the arm-confirmation buffer

// Armed candidates. Key = agent_decision_id (from audit layer).
// Value = { decisionId, proposal, armedAt, runId }
const _armed = new Map();
let _evaluating = false;

function armedCount() { return _armed.size; }
function _minsSince(ms) { return (Date.now() - ms) / 60000; }

// ── arm() ───────────────────────────────────────────────────────────────────
// Called by execution-engine in paper mode once a proposal is approved.
// No DB write here — armed state lives in memory. Phase 2.2 can add a
// persistence layer if armed windows ever need to survive restart.
function arm(decisionId, proposal, runId) {
  if (!decisionId || !proposal || !proposal.sym) {
    throw new Error('paper-fill-engine.arm: decisionId + proposal required');
  }
  if (_armed.has(decisionId)) return { armed: false, reason: 'already_armed' };

  _armed.set(decisionId, {
    decisionId,
    proposal: Object.freeze({ ...proposal }),
    armedAt: Date.now(),
    runId,
  });
  console.log(
    `🎯 agent: armed ${proposal.sym} side=${proposal.side} `
    + `trigger=${proposal.trigger_price} SL=${proposal.stop_loss} TGT=${proposal.target} `
    + `qty=${proposal.quantity} (decision ${decisionId})`
  );
  return { armed: true, decisionId, armedAt: Date.now() };
}

// ── shouldTrigger() ─────────────────────────────────────────────────────────
// BUY: fire when current price breaks above trigger_price.
// SELL: fire when current price breaks below trigger_price.
function shouldTrigger(proposal, currentPrice) {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return false;
  const trigger = Number(proposal.trigger_price);
  if (!Number.isFinite(trigger) || trigger <= 0) return false;
  return proposal.side === 'BUY' ? currentPrice >= trigger : currentPrice <= trigger;
}

// ── computeFillPrice() ──────────────────────────────────────────────────────
// Slippage model: BUY fills slightly above trigger, SELL slightly below.
// Uses bps of the trigger price so the hit is proportional to the price level.
function computeFillPrice(proposal) {
  const t = Number(proposal.trigger_price);
  const slip = t * (SLIPPAGE_BPS / 10000);
  return +(proposal.side === 'BUY' ? t + slip : t - slip).toFixed(2);
}

// ── executeFill() ───────────────────────────────────────────────────────────
// Writes to agent_trades + emits ORDER_FILLED event. Returns the trade id
// so the caller can log it.
async function executeFill({ pool, decisionId, proposal, fillPrice, runId }) {
  const tradeId = await audit.writeTrade(pool, {
    agentDecisionId: decisionId,
    runId,
    mode: 'paper',
    proposal,
    entryOrderId: `paper-entry-${decisionId}`,
    slOrderId:    `paper-sl-${decisionId}`,
    targetOrderId: `paper-tgt-${decisionId}`,
  });

  // Mark the trade as filled immediately (paper = synchronous fill).
  await pool.query(
    `UPDATE agent_trades
        SET filled_at = NOW(), fill_price = $1
      WHERE id = $2`,
    [fillPrice, tradeId]
  );

  await audit.writeTradeEvent(pool, {
    agentTradeId: tradeId,
    runId,
    eventType: 'ORDER_FILLED',
    payload: {
      mode: 'paper',
      fillPrice,
      plannedEntry: proposal.entry_price,
      plannedTrigger: proposal.trigger_price,
      slippageBps: SLIPPAGE_BPS,
      quantity: proposal.quantity,
    },
  });

  console.log(
    `💰 agent: paper-filled ${proposal.sym} ${proposal.side} `
    + `qty=${proposal.quantity} @ ₹${fillPrice} `
    + `(trigger was ₹${proposal.trigger_price}) trade_id=${tradeId}`
  );

  return tradeId;
}

// ── evaluateArmed() ─────────────────────────────────────────────────────────
// Runs on every agent cycle. Two actions per armed candidate:
//   1. If current price triggers → fill (writes to agent_trades).
//   2. If armed > FILTERS.ARMED_EXPIRY_MINS → expire (console only).
//
// Deps injected by the orchestrator:
//   pool       — pg.Pool
//   getPrices  — async (syms[]) => { [sym]: price | null }
//   runId      — current agent run id (for event correlation)
async function evaluateArmed({ pool, getPrices, runId }) {
  if (_evaluating) return { skipped: 'already_evaluating' };
  if (_armed.size === 0) return { filled: [], expired: [], armed: 0 };

  _evaluating = true;
  const filled = [];
  const expired = [];

  try {
    const expiryMins = FILTERS.ARMED_EXPIRY_MINS || 15;

    // Expire first (cheap, no price lookup needed)
    for (const [decisionId, candidate] of _armed) {
      if (_minsSince(candidate.armedAt) > expiryMins) {
        _armed.delete(decisionId);
        expired.push({ decisionId, sym: candidate.proposal.sym });
        console.log(
          `⏱  agent: armed candidate expired — ${candidate.proposal.sym} `
          + `(${_minsSince(candidate.armedAt).toFixed(1)}m, decision ${decisionId})`
        );
      }
    }

    // Nothing left to trigger-check
    if (_armed.size === 0) return { filled, expired, armed: 0 };

    // Fetch prices in one batch
    const syms = [...new Set([..._armed.values()].map(c => c.proposal.sym))];
    const prices = await getPrices(syms);

    for (const [decisionId, candidate] of _armed) {
      const px = prices[candidate.proposal.sym];
      if (px == null) continue;  // no price available this tick — skip, try next cycle

      if (shouldTrigger(candidate.proposal, px)) {
        const fillPrice = computeFillPrice(candidate.proposal);
        try {
          const tradeId = await executeFill({
            pool, decisionId, proposal: candidate.proposal, fillPrice, runId,
          });
          _armed.delete(decisionId);
          filled.push({ decisionId, tradeId, sym: candidate.proposal.sym, fillPrice });
        } catch (e) {
          console.error(`✖  agent: paper fill failed for ${candidate.proposal.sym}: ${e.message}`);
        }
      }
    }

    return { filled, expired, armed: _armed.size };
  } finally {
    _evaluating = false;
  }
}

// ── snapshotArmed() ─────────────────────────────────────────────────────────
// For the UI status endpoint — returns a safe snapshot of the armed map.
function snapshotArmed() {
  const out = [];
  for (const [decisionId, c] of _armed) {
    out.push({
      decisionId,
      sym: c.proposal.sym,
      side: c.proposal.side,
      trigger_price: c.proposal.trigger_price,
      stop_loss: c.proposal.stop_loss,
      target: c.proposal.target,
      quantity: c.proposal.quantity,
      armedAt: new Date(c.armedAt).toISOString(),
      ageMins: +_minsSince(c.armedAt).toFixed(2),
    });
  }
  return out;
}

// ── clearArmed() ────────────────────────────────────────────────────────────
// For tests + admin endpoint ("cancel all armed").
function clearArmed() { const n = _armed.size; _armed.clear(); return { cleared: n }; }

module.exports = {
  arm,
  evaluateArmed,
  snapshotArmed,
  clearArmed,
  armedCount,
  SLIPPAGE_BPS,
  // exposed for unit tests
  _internal: { shouldTrigger, computeFillPrice, _armed },
};
