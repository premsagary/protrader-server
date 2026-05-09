// state_engine.js — trade state machine. All transitions validated.
// Recovery walks from current state back to a sane terminal.
'use strict';

const eventLogger = require('./event_logger');

const VALID_TRANSITIONS = {
  'PROPOSED':    ['BUILDING', 'REJECTED', 'EXPIRED', 'HALTED'],
  'BUILDING':    ['VALIDATING', 'REJECTED', 'HALTED'],
  'VALIDATING':  ['PLACING', 'REJECTED', 'HALTED'],
  'PLACING':     ['OPEN', 'PARTIAL', 'FAILED', 'HALTED'],
  'OPEN':        ['EXITING', 'HALTED'],
  'PARTIAL':     ['EXITING', 'FAILED', 'HALTED'],
  'EXITING':     ['RECONCILING', 'HALTED'],
  'RECONCILING': ['CLOSED', 'HALTED'],
  'CLOSED':      [],
  'FAILED':      [],
  'REJECTED':    [],
  'EXPIRED':     [],
  'HALTED':      ['REJECTED', 'EXITING', 'RECONCILING', 'FAILED', 'CLOSED'],
};

const TERMINAL_STATES = ['CLOSED', 'FAILED', 'REJECTED', 'EXPIRED'];

function isValidTransition(fromState, toState) {
  return (VALID_TRANSITIONS[fromState] || []).includes(toState);
}

function isTerminal(state) {
  return TERMINAL_STATES.includes(state);
}

let pool = null;
function init(pgPool) { pool = pgPool; }

async function create(tradeData) {
  if (!pool) throw new Error('state_engine: pool not initialized');
  const {
    trade_date, strategy, mode, day_of_week, vix_band, vix_prior, nifty_prior,
    legs, lot_size, num_lots, credit, margin_used,
    sl_per_leg_multiplier = 1.25, sl_combined_loss_pct = 1.00, force_exit_time = '14:30',
    filter_results = null, created_by = 'auto', notes = '',
  } = tradeData;
  const { rows } = await pool.query(
    `INSERT INTO options_trades
       (trade_date, state, mode, strategy, day_of_week, vix_band, vix_prior, nifty_prior,
        legs, lot_size, num_lots, credit, margin_used,
        sl_per_leg_multiplier, sl_combined_loss_pct, force_exit_time,
        filter_results, created_by, notes)
     VALUES ($1, 'PROPOSED', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     RETURNING id`,
    [trade_date, mode, strategy, day_of_week, vix_band, vix_prior, nifty_prior,
     JSON.stringify(legs), lot_size, num_lots, credit, margin_used,
     sl_per_leg_multiplier, sl_combined_loss_pct, force_exit_time,
     filter_results ? JSON.stringify(filter_results) : null, created_by, notes]
  );
  const tradeId = rows[0].id;
  await eventLogger.info('trade_created', { tradeId, strategy, mode, credit });
  return tradeId;
}

async function transition(tradeId, toState, ctx = {}) {
  if (!pool) throw new Error('state_engine: pool not initialized');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT state FROM options_trades WHERE id = $1 FOR UPDATE`, [tradeId]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      throw new Error(`Trade ${tradeId} not found`);
    }
    const fromState = rows[0].state;
    if (!isValidTransition(fromState, toState)) {
      await client.query('ROLLBACK');
      throw new Error(`Invalid transition for trade ${tradeId}: ${fromState} → ${toState}`);
    }

    // Build parameterized UPDATE — no string interpolation of ctx values
    const params = [toState];
    const sets = ['state = $1', 'state_updated_at = NOW()'];
    if (toState === 'OPEN')   sets.push('entry_time = NOW()');
    if (toState === 'CLOSED') sets.push('exit_time = NOW()');
    if (toState === 'CLOSED' && ctx.exit_reason !== undefined) {
      params.push(String(ctx.exit_reason).slice(0, 30));
      sets.push(`exit_reason = $${params.length}`);
    }
    if (toState === 'CLOSED' && ctx.realized_pnl !== undefined) {
      params.push(Number(ctx.realized_pnl));
      sets.push(`realized_pnl = $${params.length}`);
    }
    params.push(tradeId);
    await client.query(
      `UPDATE options_trades SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params
    );
    await client.query(
      `INSERT INTO options_state_log (trade_id, from_state, to_state, ctx, ts)
       VALUES ($1, $2, $3, $4, NOW())`,
      [tradeId, fromState, toState, JSON.stringify(ctx)]
    );
    await client.query('COMMIT');
    await eventLogger.info('state_transition', { tradeId, from: fromState, to: toState, ...ctx });
    return { tradeId, fromState, toState };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function get(tradeId) {
  const { rows } = await pool.query(`SELECT * FROM options_trades WHERE id = $1`, [tradeId]);
  return rows[0] || null;
}

async function findActive() {
  const { rows } = await pool.query(
    `SELECT * FROM options_trades
     WHERE state IN ('PLACING','OPEN','PARTIAL','EXITING','RECONCILING')
     ORDER BY proposed_at DESC`
  );
  return rows;
}

async function findToday(tradeDate) {
  const { rows } = await pool.query(
    `SELECT * FROM options_trades WHERE trade_date = $1 ORDER BY proposed_at DESC`, [tradeDate]);
  return rows;
}

async function getStateHistory(tradeId) {
  const { rows } = await pool.query(
    `SELECT * FROM options_state_log WHERE trade_id = $1 ORDER BY ts ASC`, [tradeId]);
  return rows;
}

// Recovery from HALTED state — picks correct next state based on history
async function recoverFromHalted(tradeId) {
  const history = await getStateHistory(tradeId);
  const lastNonHalted = [...history].reverse().find(h => h.from_state !== 'HALTED' && h.from_state !== null)?.from_state;
  if (!lastNonHalted) return await transition(tradeId, 'REJECTED', { reason: 'no history' });

  if (['PROPOSED', 'BUILDING', 'VALIDATING'].includes(lastNonHalted)) {
    return await transition(tradeId, 'REJECTED', { reason: 'halted before placement' });
  }
  if (lastNonHalted === 'PLACING') {
    return await transition(tradeId, 'EXITING', { reason: 'flatten — halted mid-place' });
  }
  return await transition(tradeId, 'RECONCILING', { reason: 'resume after halt' });
}

module.exports = {
  init, create, transition, get, findActive, findToday, getStateHistory,
  isValidTransition, isTerminal, recoverFromHalted,
  VALID_TRANSITIONS, TERMINAL_STATES,
};
