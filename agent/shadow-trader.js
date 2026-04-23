/**
 * shadow-trader.js — LLM-based shadow decision layer.
 *
 * Observational ONLY. This module does not place orders, arm candidates, or
 * interact with execution-engine in any way. It consumes the same inputs as
 * trade-agent.propose() — { picks, state } — and for each pick produces:
 *
 *   1. A shadow (LLM) BUY/SKIP decision with an exit plan.
 *   2. The rule-based BUY/REJECT decision on the same pick (via trade-agent).
 *   3. An "agreement" label for A/B evaluation.
 *
 * Both rows land in `agent_shadow_trades`. Outcomes (WIN/LOSS/EXPIRED) are
 * backfilled by evaluateOutcomes() on a slower cadence.
 *
 * Design rules:
 *   - Never mutates state. Never touches execution.
 *   - Deterministic when no LLM dep is provided (falls back to rules-mirror).
 *   - LLM call budget is bounded by MAX_SHADOW_CALLS_PER_CYCLE (default 5).
 *     Picks beyond that budget get a rules-mirror shadow row (agreement = NA).
 *   - Every LLM call is wrapped in a timeout; timeouts produce a 'SKIP'
 *     shadow decision with agreement = ERROR.
 * ────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { FILTERS, CONSTRAINTS, PAPER_CAPITAL_RUPEES } = require('./agent-config');
const tradeAgent = require('./trade-agent');

const MAX_SHADOW_CALLS_PER_CYCLE = 5;
const LLM_TIMEOUT_MS = 15000;
const DEFAULT_MODEL_LABEL = 'no-llm-dep';

const AGREEMENT = Object.freeze({
  AGREE_BUY:              'AGREE_BUY',
  AGREE_SKIP:             'AGREE_SKIP',
  DISAGREE_SHADOW_BUY:    'DISAGREE_SHADOW_BUY',   // shadow BUY, rules REJECT
  DISAGREE_RULES_BUY:     'DISAGREE_RULES_BUY',    // shadow SKIP, rules BUY
  ERROR:                  'ERROR',
  NA:                     'NA',                     // budget exceeded, no LLM call
});

const SHADOW_DECISION = Object.freeze({
  BUY:   'BUY',
  SKIP:  'SKIP',
  ERROR: 'ERROR',
});

// ────────────────────────────────────────────────────────────────────────────
// Build the prompt that the shadow LLM sees. Structured, no natural-language
// storytelling — we want a deterministic JSON reply.
// ────────────────────────────────────────────────────────────────────────────
function buildShadowPrompt(pick, state, rulesOutcome) {
  const payload = {
    task: 'intraday_shadow_decision',
    instructions: [
      'You are a shadow trader for Indian intraday equities (NSE).',
      'You see the same pick + state as the rule-based engine.',
      'Return JSON only. Do not add prose outside the JSON.',
      'Decision must be "BUY" or "SKIP". No shorts. No averaging down.',
      'If you BUY: provide entry, stop_loss, target, quantity, confidence (0-100).',
      'Entry must be above price * 1.0005 (candle-confirm buffer).',
      'RR (target-entry)/(entry-stop_loss) must be >= 1.5.',
      'Risk per trade must be <= 1% of capital (rs ' + (state.capital || PAPER_CAPITAL_RUPEES) + ').',
      'Max position notional <= 30% of capital.',
      'Be honest about conviction — low-confidence BUYs should be SKIP.',
    ],
    pick: {
      sym: pick.sym,
      sector: pick.sector || null,
      price: Number(pick.price || 0),
      day_trade_score: Number(pick.dayTradeScore || 0),
      best_setup: pick.bestSetup || null,
      vwap: Number(pick.vwap || 0),
      ema9: Number(pick.ema9 || 0),
      ema20: Number(pick.ema20 || 0),
      atrPct: Number(pick.atrPct || 0),
      volRatio: Number(pick.volRatio || 0),
      pdHigh: Number(pick.pdHigh || 0),
      pdLow:  Number(pick.pdLow  || 0),
      orHigh: Number(pick.orHigh || 0),
      orLow:  Number(pick.orLow  || 0),
      roundNumber: Number(pick.roundNumber || 0),
      rule_sl: Number(pick.sl || 0),
      rule_tgt: Number(pick.tgt || 0),
      rule_rr: Number(pick.rrRatio || 0),
    },
    state: {
      minsSinceOpen: state.minsSinceOpen,
      niftyChangePct: state.niftyChangePct,
      vixLevel: state.vixLevel,
      capital: state.capital || PAPER_CAPITAL_RUPEES,
      tradesTodayCount: state.tradesTodayCount || 0,
      realizedPnlToday: state.realizedPnlToday || 0,
    },
    rule_engine_verdict: {
      accepted: rulesOutcome.accepted,
      failed_filter: rulesOutcome.failedAt,
      detail: rulesOutcome.detail,
      passed_filters: rulesOutcome.passed,
    },
    output_schema: {
      decision: 'BUY | SKIP',
      side: 'BUY (if decision=BUY)',
      entry: 'number (BUY only)',
      stop_loss: 'number (BUY only)',
      target: 'number (BUY only)',
      quantity: 'integer (BUY only)',
      rr_ratio: 'number (BUY only)',
      confidence: 'integer 0-100',
      reason: 'short justification (<= 200 chars)',
    },
    constraints_reminder: {
      MAX_RISK_PER_TRADE_PCT: CONSTRAINTS.MAX_RISK_PER_TRADE_PCT,
      MIN_RR_RATIO: CONSTRAINTS.MIN_RR_RATIO,
      MAX_POSITION_PCT_OF_CAPITAL: CONSTRAINTS.MAX_POSITION_PCT_OF_CAPITAL,
      CANDLE_CONFIRM_BPS: FILTERS.CANDLE_CONFIRM_BPS,
    },
  };
  return payload;
}

// ────────────────────────────────────────────────────────────────────────────
// Parse + validate the LLM JSON reply. Returns normalized {decision,...} or
// null if the reply failed validation.
// ────────────────────────────────────────────────────────────────────────────
function parseShadowReply(raw) {
  let parsed = raw;
  if (typeof raw === 'string') {
    // Tolerate markdown code fences
    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    try { parsed = JSON.parse(stripped); }
    catch (e) { return { ok: false, reason: `json_parse_error: ${e.message}` }; }
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'reply_not_object' };
  const d = String(parsed.decision || '').toUpperCase();
  if (d !== SHADOW_DECISION.BUY && d !== SHADOW_DECISION.SKIP) {
    return { ok: false, reason: `bad_decision:${d}` };
  }
  if (d === SHADOW_DECISION.BUY) {
    const entry = Number(parsed.entry);
    const sl    = Number(parsed.stop_loss);
    const tgt   = Number(parsed.target);
    const qty   = parseInt(parsed.quantity, 10);
    if (!entry || !sl || !tgt || !qty || entry <= sl || tgt <= entry) {
      return { ok: false, reason: 'bad_buy_levels' };
    }
  }
  const conf = Math.max(0, Math.min(100, parseInt(parsed.confidence || 0, 10) || 0));
  return {
    ok: true,
    decision: d,
    side: d === SHADOW_DECISION.BUY ? 'BUY' : null,
    entry: d === SHADOW_DECISION.BUY ? Number(parsed.entry) : null,
    stop_loss: d === SHADOW_DECISION.BUY ? Number(parsed.stop_loss) : null,
    target: d === SHADOW_DECISION.BUY ? Number(parsed.target) : null,
    quantity: d === SHADOW_DECISION.BUY ? parseInt(parsed.quantity, 10) : null,
    rr_ratio: d === SHADOW_DECISION.BUY
      ? +((Number(parsed.target) - Number(parsed.entry)) / (Number(parsed.entry) - Number(parsed.stop_loss))).toFixed(2)
      : null,
    confidence: conf,
    reason: String(parsed.reason || '').slice(0, 500),
  };
}

// Wrap a promise with a timeout (failure returns {ok:false, reason:'timeout'})
function _withTimeout(p, ms) {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      resolve({ ok: false, reason: `timeout:${ms}ms` });
    }, ms);
    Promise.resolve(p).then(
      (v) => { if (done) return; done = true; clearTimeout(t); resolve({ ok: true, value: v }); },
      (e) => { if (done) return; done = true; clearTimeout(t); resolve({ ok: false, reason: `error:${e.message}` }); }
    );
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Core: run the LLM (via injected dep) for one pick
// ────────────────────────────────────────────────────────────────────────────
async function _askShadow(deps, prompt) {
  if (typeof deps.askLLM !== 'function') {
    return { ok: false, reason: 'no_llm_dep', model: DEFAULT_MODEL_LABEL, latency_ms: 0 };
  }
  const t0 = Date.now();
  const wrapped = await _withTimeout(deps.askLLM(prompt), LLM_TIMEOUT_MS);
  const latency_ms = Date.now() - t0;
  if (!wrapped.ok) {
    return { ok: false, reason: wrapped.reason, model: DEFAULT_MODEL_LABEL, latency_ms };
  }
  const rawReply = wrapped.value;
  const reply = (rawReply && typeof rawReply === 'object' && rawReply.content)
    ? rawReply.content
    : rawReply;
  const parsed = parseShadowReply(reply);
  if (!parsed.ok) {
    return { ok: false, reason: parsed.reason, model: (rawReply && rawReply.model) || DEFAULT_MODEL_LABEL, latency_ms };
  }
  return {
    ok: true,
    decision: parsed,
    model: (rawReply && rawReply.model) || DEFAULT_MODEL_LABEL,
    latency_ms,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Determine the rule-based verdict for a single pick (mirror of trade-agent.propose)
// ────────────────────────────────────────────────────────────────────────────
function _ruleVerdictFor(pick, state) {
  const chain = tradeAgent._internal.runFilterChain(pick, state);
  if (!chain.accepted) {
    return {
      accepted: false,
      failedAt: chain.failedAt,
      detail: chain.detail,
      passed: chain.passed,
      entry: null, sl: null, target: null, qty: 0, rr: null,
    };
  }
  const trigger = tradeAgent._internal.computeTriggerPrice(pick);
  const qty     = tradeAgent._internal.computeQuantity(pick, state);
  return {
    accepted: true,
    failedAt: null,
    detail: null,
    passed: chain.passed,
    entry: trigger,
    sl: Number(pick.sl || 0),
    target: Number(pick.tgt || 0),
    qty,
    rr: Number(pick.rrRatio || 0),
  };
}

function _agreementLabel(shadowDecision, rulesAccepted) {
  if (shadowDecision === SHADOW_DECISION.ERROR) return AGREEMENT.ERROR;
  const shadowBuys = shadowDecision === SHADOW_DECISION.BUY;
  if (shadowBuys && rulesAccepted)   return AGREEMENT.AGREE_BUY;
  if (!shadowBuys && !rulesAccepted) return AGREEMENT.AGREE_SKIP;
  if (shadowBuys && !rulesAccepted)  return AGREEMENT.DISAGREE_SHADOW_BUY;
  return AGREEMENT.DISAGREE_RULES_BUY;
}

// ────────────────────────────────────────────────────────────────────────────
// Persistence — one row per pick evaluated
// ────────────────────────────────────────────────────────────────────────────
async function _writeShadowRow(pool, runId, pick, shadow, rules) {
  await pool.query(
    `INSERT INTO agent_shadow_trades (
       run_id, sym, sector, day_trade_score, best_setup, price,
       shadow_decision, shadow_side, shadow_entry, shadow_stop_loss,
       shadow_target, shadow_quantity, shadow_rr_ratio, shadow_confidence,
       shadow_reason, shadow_model, shadow_latency_ms,
       rules_decision, rules_failed_filter, rules_entry, rules_stop_loss,
       rules_target, rules_quantity, rules_rr_ratio,
       agreement, outcome
     ) VALUES (
       $1,$2,$3,$4,$5,$6,
       $7,$8,$9,$10,
       $11,$12,$13,$14,
       $15,$16,$17,
       $18,$19,$20,$21,
       $22,$23,$24,
       $25,$26
     )`,
    [
      runId, pick.sym, pick.sector || null,
      Number(pick.dayTradeScore || 0), pick.bestSetup || null, Number(pick.price || 0),
      shadow.decision, shadow.side, shadow.entry, shadow.stop_loss,
      shadow.target, shadow.quantity, shadow.rr_ratio, shadow.confidence,
      shadow.reason, shadow.model, shadow.latency_ms,
      rules.accepted ? 'BUY' : 'REJECT', rules.failedAt,
      rules.entry, rules.sl, rules.target, rules.qty, rules.rr,
      _agreementLabel(shadow.decision, rules.accepted),
      'PENDING',
    ]
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Public entry point: run one evaluation cycle
// ────────────────────────────────────────────────────────────────────────────
async function runCycle({ picks, state, deps }) {
  if (!deps || !deps.pool) throw new Error('shadow-trader.runCycle: deps.pool required');
  if (!Array.isArray(picks) || picks.length === 0) {
    return { evaluated: 0, buys: 0, skips: 0, errors: 0, disagreements: 0 };
  }

  const runId = `shadow-${Date.now().toString(36)}`;
  const limit = Math.min(picks.length, (deps.maxCallsPerCycle || MAX_SHADOW_CALLS_PER_CYCLE));

  // Sort by score desc so highest-quality picks get the LLM review.
  const sorted = [...picks]
    .filter(p => p && p.sym)
    .sort((a, b) => Number(b.dayTradeScore || 0) - Number(a.dayTradeScore || 0));

  const stats = { evaluated: 0, buys: 0, skips: 0, errors: 0, disagreements: 0 };

  for (let i = 0; i < sorted.length; i++) {
    const pick = sorted[i];
    const rules = _ruleVerdictFor(pick, state);

    let shadow;
    if (i >= limit) {
      // Budget exceeded — mirror the rules decision with NA agreement.
      shadow = {
        decision: rules.accepted ? SHADOW_DECISION.BUY : SHADOW_DECISION.SKIP,
        side: rules.accepted ? 'BUY' : null,
        entry: rules.entry, stop_loss: rules.sl, target: rules.target,
        quantity: rules.qty, rr_ratio: rules.rr,
        confidence: 0,
        reason: 'budget_exceeded_rules_mirror',
        model: 'rules-mirror',
        latency_ms: 0,
      };
    } else {
      const prompt = buildShadowPrompt(pick, state, {
        accepted: rules.accepted,
        failedAt: rules.failedAt,
        detail: rules.detail,
        passed: rules.passed,
      });
      const ask = await _askShadow(deps, prompt);
      if (!ask.ok) {
        shadow = {
          decision: SHADOW_DECISION.ERROR,
          side: null, entry: null, stop_loss: null, target: null,
          quantity: null, rr_ratio: null,
          confidence: 0,
          reason: ask.reason,
          model: ask.model || DEFAULT_MODEL_LABEL,
          latency_ms: ask.latency_ms || 0,
        };
        stats.errors++;
      } else {
        shadow = {
          decision: ask.decision.decision,
          side: ask.decision.side,
          entry: ask.decision.entry,
          stop_loss: ask.decision.stop_loss,
          target: ask.decision.target,
          quantity: ask.decision.quantity,
          rr_ratio: ask.decision.rr_ratio,
          confidence: ask.decision.confidence,
          reason: ask.decision.reason,
          model: ask.model,
          latency_ms: ask.latency_ms,
        };
      }
    }

    try {
      await _writeShadowRow(deps.pool, runId, pick, shadow, rules);
    } catch (e) {
      if (/relation .* does not exist/i.test(String(e.message))) {
        console.warn(`shadow-trader: agent_shadow_trades table missing — run migrations/002_ops_and_shadow_tables.sql`);
        return { ...stats, tablesMissing: true };
      }
      console.error(`✖  shadow-trader: row write failed for ${pick.sym} — ${e.message}`);
      continue;
    }

    // Track outcomes for A/B reporting
    stats.evaluated++;
    if (shadow.decision === SHADOW_DECISION.BUY) stats.buys++;
    else if (shadow.decision === SHADOW_DECISION.SKIP) stats.skips++;
    const agr = _agreementLabel(shadow.decision, rules.accepted);
    if (agr === AGREEMENT.DISAGREE_SHADOW_BUY || agr === AGREEMENT.DISAGREE_RULES_BUY) {
      stats.disagreements++;
      console.log(`🔀 shadow-trader: ${pick.sym} DISAGREE (${agr}) — shadow=${shadow.decision} rules=${rules.accepted ? 'BUY' : 'REJECT(' + rules.failedAt + ')'}`);
    }
  }

  return stats;
}

// ────────────────────────────────────────────────────────────────────────────
// Outcome evaluator — called on a slower cadence (e.g., every 5 min + at EOD)
// Updates PENDING rows to WIN / LOSS / EXPIRED based on shadow BUY levels vs
// observed prices. Rules-side outcome is already captured in agent_trades for
// trades that executed; this is purely for shadow-vs-rules A/B.
// ────────────────────────────────────────────────────────────────────────────
async function evaluateOutcomes(deps) {
  if (!deps || !deps.pool) return { updated: 0, skipped: 'no_pool' };
  if (typeof deps.getPrices !== 'function') return { updated: 0, skipped: 'no_getPrices' };

  const { rows } = await deps.pool.query(`
    SELECT id, sym, shadow_decision, shadow_entry, shadow_stop_loss, shadow_target,
           decided_at
      FROM agent_shadow_trades
     WHERE outcome = 'PENDING'
       AND decided_at::date = CURRENT_DATE
       AND shadow_decision = 'BUY'
  `).catch((e) => {
    if (/relation .* does not exist/i.test(String(e.message))) return { rows: [] };
    throw e;
  });

  if (!rows.length) return { updated: 0 };

  const syms = [...new Set(rows.map(r => r.sym))];
  const prices = await deps.getPrices(syms);
  let updated = 0;

  for (const r of rows) {
    const px = Number(prices[r.sym]);
    if (!Number.isFinite(px) || px <= 0) continue;

    const entry = Number(r.shadow_entry);
    const sl    = Number(r.shadow_stop_loss);
    const tgt   = Number(r.shadow_target);
    if (!(entry > 0 && sl > 0 && tgt > 0)) continue;

    let outcome = null;
    if (px >= tgt) outcome = 'WIN';
    else if (px <= sl) outcome = 'LOSS';
    // No EXPIRED handling here — caller should run a final pass at EOD that
    // marks all remaining PENDING BUYs as EXPIRED with outcome_price = last LTP.

    if (outcome) {
      const pnlPct = +(((px - entry) / entry) * 100).toFixed(2);
      await deps.pool.query(
        `UPDATE agent_shadow_trades
            SET outcome = $1, outcome_price = $2, outcome_at = NOW(), shadow_pnl_pct = $3
          WHERE id = $4 AND outcome = 'PENDING'`,
        [outcome, px, pnlPct, r.id]
      );
      updated++;
    }
  }

  return { updated, scanned: rows.length };
}

// EOD close-out pass — mark remaining PENDING rows as EXPIRED at last price.
async function expirePending(deps) {
  if (!deps || !deps.pool) return { expired: 0 };
  if (typeof deps.getPrices !== 'function') return { expired: 0, skipped: 'no_getPrices' };

  const { rows } = await deps.pool.query(`
    SELECT id, sym, shadow_entry, shadow_decision
      FROM agent_shadow_trades
     WHERE outcome = 'PENDING'
       AND decided_at::date = CURRENT_DATE
  `).catch((e) => {
    if (/relation .* does not exist/i.test(String(e.message))) return { rows: [] };
    throw e;
  });

  if (!rows.length) return { expired: 0 };
  const syms = [...new Set(rows.map(r => r.sym))];
  const prices = await deps.getPrices(syms);

  let expired = 0;
  for (const r of rows) {
    const px = Number(prices[r.sym]);
    const entry = Number(r.shadow_entry);
    const pnlPct = (Number.isFinite(px) && entry > 0)
      ? +(((px - entry) / entry) * 100).toFixed(2)
      : null;
    const finalOutcome = r.shadow_decision === 'BUY' ? 'EXPIRED' : 'NA';
    await deps.pool.query(
      `UPDATE agent_shadow_trades
          SET outcome = $1, outcome_price = $2, outcome_at = NOW(), shadow_pnl_pct = $3
        WHERE id = $4 AND outcome = 'PENDING'`,
      [finalOutcome, Number.isFinite(px) ? px : null, pnlPct, r.id]
    );
    expired++;
  }
  return { expired };
}

// ────────────────────────────────────────────────────────────────────────────
// Read helpers
// ────────────────────────────────────────────────────────────────────────────
async function getTodayStats(pool) {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::INT                                                AS total,
        COUNT(*) FILTER (WHERE shadow_decision = 'BUY')::INT         AS shadow_buys,
        COUNT(*) FILTER (WHERE shadow_decision = 'SKIP')::INT        AS shadow_skips,
        COUNT(*) FILTER (WHERE shadow_decision = 'ERROR')::INT       AS shadow_errors,
        COUNT(*) FILTER (WHERE rules_decision = 'BUY')::INT          AS rules_buys,
        COUNT(*) FILTER (WHERE rules_decision = 'REJECT')::INT       AS rules_rejects,
        COUNT(*) FILTER (WHERE agreement = 'AGREE_BUY')::INT         AS agree_buy,
        COUNT(*) FILTER (WHERE agreement = 'AGREE_SKIP')::INT        AS agree_skip,
        COUNT(*) FILTER (WHERE agreement = 'DISAGREE_SHADOW_BUY')::INT AS disagree_shadow_buy,
        COUNT(*) FILTER (WHERE agreement = 'DISAGREE_RULES_BUY')::INT  AS disagree_rules_buy,
        COUNT(*) FILTER (WHERE outcome = 'WIN')::INT                 AS wins,
        COUNT(*) FILTER (WHERE outcome = 'LOSS')::INT                AS losses,
        COUNT(*) FILTER (WHERE outcome = 'EXPIRED')::INT             AS expired,
        COUNT(*) FILTER (WHERE outcome = 'PENDING')::INT             AS pending,
        COALESCE(AVG(shadow_pnl_pct) FILTER (WHERE outcome = 'WIN'),  0) AS avg_win_pct,
        COALESCE(AVG(shadow_pnl_pct) FILTER (WHERE outcome = 'LOSS'), 0) AS avg_loss_pct
      FROM agent_shadow_trades
      WHERE decided_at::date = CURRENT_DATE
    `);
    return rows[0] || {};
  } catch (e) {
    if (/relation .* does not exist/i.test(String(e.message))) return { tablesMissing: true };
    throw e;
  }
}

async function getRecentDecisions(pool, limit = 50) {
  try {
    const { rows } = await pool.query(
      `SELECT id, decided_at, sym, sector, best_setup, day_trade_score,
              shadow_decision, shadow_confidence, shadow_entry, shadow_stop_loss,
              shadow_target, shadow_rr_ratio, shadow_reason, shadow_model,
              rules_decision, rules_failed_filter,
              agreement, outcome, shadow_pnl_pct
         FROM agent_shadow_trades
        WHERE decided_at::date = CURRENT_DATE
        ORDER BY decided_at DESC
        LIMIT $1`,
      [Math.max(1, Math.min(500, limit))]
    );
    return rows;
  } catch (e) {
    if (/relation .* does not exist/i.test(String(e.message))) return [];
    throw e;
  }
}

module.exports = {
  runCycle,
  evaluateOutcomes,
  expirePending,
  getTodayStats,
  getRecentDecisions,
  AGREEMENT,
  SHADOW_DECISION,
  _internal: { buildShadowPrompt, parseShadowReply, _ruleVerdictFor, _agreementLabel },
};
