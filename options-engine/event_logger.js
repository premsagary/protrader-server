// event_logger.js — persistent event log for the engine.
// Logs every state transition, WS event, kill switch, health change, etc.
'use strict';

const time = require('./time_utils');

let pool = null;  // injected via init()

function init(pgPool) {
  pool = pgPool;
}

const SEVERITIES = { DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4, CRITICAL: 5 };

async function log(eventType, ctx = {}, opts = {}) {
  const severity = opts.severity || 'INFO';
  const tradeId = opts.tradeId || ctx.tradeId || null;
  const line = {
    event_type: eventType,
    severity,
    trade_id: tradeId,
    ctx,
    ts: time.nowUtc(),
  };
  // Always console for live debugging
  const sevTag = severity.padEnd(8);
  console.log(`[options][${sevTag}] ${eventType}`, JSON.stringify(ctx));
  if (!pool) return;  // tests may not have DB; skip silently
  try {
    await pool.query(
      `INSERT INTO options_event_log (event_type, severity, trade_id, ctx, ts)
       VALUES ($1, $2, $3, $4, $5)`,
      [eventType, severity, tradeId, JSON.stringify(ctx), line.ts]
    );
  } catch (e) {
    console.error('[event_logger] DB write failed:', e.message);
  }
  return line;
}

const debug    = (t, c, o = {}) => log(t, c, { ...o, severity: 'DEBUG' });
const info     = (t, c, o = {}) => log(t, c, { ...o, severity: 'INFO' });
const warn     = (t, c, o = {}) => log(t, c, { ...o, severity: 'WARN' });
const error    = (t, c, o = {}) => log(t, c, { ...o, severity: 'ERROR' });
const critical = (t, c, o = {}) => log(t, c, { ...o, severity: 'CRITICAL' });

async function recent({ limit = 100, since, type, severity, tradeId } = {}) {
  if (!pool) return [];
  const conds = [], params = [];
  if (since)    { params.push(since);    conds.push(`ts >= $${params.length}`); }
  if (type)     { params.push(type);     conds.push(`event_type = $${params.length}`); }
  if (severity) { params.push(severity); conds.push(`severity = $${params.length}`); }
  if (tradeId)  { params.push(tradeId);  conds.push(`trade_id = $${params.length}`); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  params.push(limit);
  const { rows } = await pool.query(
    `SELECT * FROM options_event_log ${where} ORDER BY ts DESC LIMIT $${params.length}`,
    params
  );
  return rows;
}

module.exports = { init, log, debug, info, warn, error, critical, recent, SEVERITIES };
