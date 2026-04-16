/**
 * agent-audit.js — writes to agent_decisions / agent_trades / agent_trade_events.
 *
 * Append-only. Every call inserts a row; nothing gets updated by the audit
 * writer except the exit fields on agent_trades (filled by trade-manager in
 * Phase 2, not Phase 1).
 *
 * Design rule: the caller passes the exact run_id for the cycle, so every row
 * across the three tables is correlated.
 */

'use strict';

const crypto = require('crypto');

function newRunId() {
  // Phase 1 runs ~60/day. 8 hex chars is plenty while staying human-scannable.
  return `agent-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

async function ensureTablesExist(pool) {
  const { rows } = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'agent_decisions'
    ) AS present
  `);
  return Boolean(rows[0] && rows[0].present);
}

// ────────────────────────────────────────────────────────────────────────────
// writeDecision — one row per proposal (approved OR rejected)
// ────────────────────────────────────────────────────────────────────────────
async function writeDecision(pool, { runId, mode, proposal, approved, rejection, state }) {
  const stateSnap = {
    minsSinceOpen: state.minsSinceOpen,
    capital: state.capital,
    realizedPnlToday: state.realizedPnlToday,
    tradesTodayCount: state.tradesTodayCount,
    niftyChangePct: state.niftyChangePct,
    consecutiveLossesToday: state.consecutiveLossesToday,
    fetchedAt: state.fetchedAt,
  };
  const res = await pool.query(
    `INSERT INTO agent_decisions (
       run_id, agent_mode, sym, sector,
       day_trade_score, best_setup, price,
       side, entry_type, trigger_price, entry_price, quantity,
       stop_loss, target, rr_ratio, confidence_score,
       passed_filters, failed_filter, approved,
       rejection_reason, rejection_detail, state_snapshot
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7,
       $8, $9, $10, $11, $12,
       $13, $14, $15, $16,
       $17, $18, $19,
       $20, $21, $22
     ) RETURNING id`,
    [
      runId, mode, proposal.sym, proposal.sector,
      proposal.day_trade_score ?? proposal.confidence_score ?? null,
      proposal.best_setup,
      proposal.entry_price,
      proposal.side, proposal.entry_type, proposal.trigger_price,
      proposal.entry_price, proposal.quantity,
      proposal.stop_loss, proposal.target, proposal.rr_ratio, proposal.confidence_score,
      JSON.stringify(proposal.passed_filters || []),
      proposal.failed_filter || null,
      Boolean(approved),
      approved ? null : (rejection && rejection.code) || (proposal.rejection_code || null),
      approved ? null : (rejection && rejection.detail) || (proposal.rejection_detail || null),
      JSON.stringify(stateSnap),
    ]
  );
  return res.rows[0].id;
}

async function writeDecisionsBatch(pool, { runId, mode, approved, rejected, state }) {
  const ids = { approved: [], rejected: [] };
  for (const p of approved) {
    const id = await writeDecision(pool, { runId, mode, proposal: p, approved: true, rejection: null, state });
    ids.approved.push({ id, sym: p.sym });
  }
  for (const p of rejected) {
    const rej = { code: p.rejection_code || p.failed_filter, detail: p.rejection_detail || null };
    const id = await writeDecision(pool, { runId, mode, proposal: p, approved: false, rejection: rej, state });
    ids.rejected.push({ id, sym: p.sym, code: rej.code });
  }
  return ids;
}

// ────────────────────────────────────────────────────────────────────────────
// writeTrade + writeTradeEvent — used by execution + trade-manager (Phase 2+)
// ────────────────────────────────────────────────────────────────────────────
async function writeTrade(pool, { agentDecisionId, runId, mode, proposal, entryOrderId, slOrderId, targetOrderId }) {
  const res = await pool.query(
    `INSERT INTO agent_trades (
       agent_decision_id, run_id, agent_mode, sym, side,
       entry_order_id, sl_order_id, target_order_id,
       planned_entry, planned_stop_loss, planned_target, quantity
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id`,
    [
      agentDecisionId, runId, mode, proposal.sym, proposal.side,
      entryOrderId || null, slOrderId || null, targetOrderId || null,
      proposal.entry_price, proposal.stop_loss, proposal.target, proposal.quantity,
    ]
  );
  return res.rows[0].id;
}

async function writeTradeEvent(pool, { agentTradeId, runId, eventType, payload }) {
  await pool.query(
    `INSERT INTO agent_trade_events (agent_trade_id, run_id, event_type, payload)
     VALUES ($1, $2, $3, $4)`,
    [agentTradeId, runId, eventType, JSON.stringify(payload || {})]
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Read helpers for the UI / admin status panel
// ────────────────────────────────────────────────────────────────────────────
async function getTodayStats(pool) {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::INT                                            AS total,
        COUNT(*) FILTER (WHERE approved)::INT                    AS approved,
        COUNT(*) FILTER (WHERE NOT approved)::INT                AS rejected,
        COALESCE(
          json_object_agg(reason_code, reason_count)
          FILTER (WHERE reason_code IS NOT NULL), '{}'::json
        ) AS rejection_breakdown
      FROM (
        SELECT approved,
               COALESCE(failed_filter, rejection_reason) AS reason_code,
               COUNT(*) OVER (
                 PARTITION BY COALESCE(failed_filter, rejection_reason)
               ) AS reason_count
          FROM agent_decisions
         WHERE decided_at::date = CURRENT_DATE
      ) q
    `);
    return rows[0] || { total: 0, approved: 0, rejected: 0, rejection_breakdown: {} };
  } catch (e) {
    if (/relation .* does not exist/i.test(String(e.message))) {
      return { total: 0, approved: 0, rejected: 0, rejection_breakdown: {}, tablesMissing: true };
    }
    throw e;
  }
}

async function getRecentDecisions(pool, limit = 30) {
  try {
    const { rows } = await pool.query(`
      SELECT id, decided_at, agent_mode, sym, sector, best_setup, day_trade_score,
             side, quantity, entry_price, stop_loss, target, rr_ratio,
             approved, failed_filter, rejection_reason, rejection_detail
        FROM agent_decisions
       WHERE decided_at::date = CURRENT_DATE
       ORDER BY decided_at DESC
       LIMIT $1
    `, [Math.max(1, Math.min(200, limit))]);
    return rows;
  } catch (e) {
    if (/relation .* does not exist/i.test(String(e.message))) return [];
    throw e;
  }
}

module.exports = {
  newRunId,
  ensureTablesExist,
  writeDecision,
  writeDecisionsBatch,
  writeTrade,
  writeTradeEvent,
  getTodayStats,
  getRecentDecisions,
};
