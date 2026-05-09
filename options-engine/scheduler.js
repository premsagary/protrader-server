// scheduler.js — all cron schedules in one place.
'use strict';

let cron;
try { cron = require('node-cron'); } catch (e) { cron = null; }

const time = require('./time_utils');
const lifecycleEngine = require('./lifecycle_engine');
const monitorEngine = require('./monitor_engine');
const recoveryEngine = require('./recovery_engine');
const eventLogger = require('./event_logger');

let kc = null;
let pool = null;
let notificationEngine = null;
const tasks = [];
function init({ kiteClient, pgPool, notification }) {
  kc = kiteClient || null;
  pool = pgPool || null;
  notificationEngine = notification || null;
}

async function buildAndSendDailySummary() {
  if (!pool) return;
  try {
    const { rows: trades } = await pool.query(
      `SELECT strategy, state, mode, credit, realized_pnl, exit_reason
       FROM options_trades WHERE trade_date = CURRENT_DATE ORDER BY proposed_at`);
    const { rows: skips } = await pool.query(
      `SELECT reason, COUNT(*)::int AS n FROM options_skip_log
       WHERE trade_date = CURRENT_DATE GROUP BY reason`);
    const totalPnl = trades.reduce((a, t) => a + (parseFloat(t.realized_pnl) || 0), 0);
    const wins = trades.filter(t => parseFloat(t.realized_pnl) > 0).length;
    const summary = {
      date: time.istDateString(),
      trades: trades.length,
      closed: trades.filter(t => t.state === 'CLOSED').length,
      wins, total_pnl: totalPnl,
      strategies: trades.map(t => `${t.strategy}:₹${t.realized_pnl||0}`),
      skips: skips.map(s => `${s.reason}(${s.n})`),
    };
    await eventLogger.info('daily_summary', summary);
    if (notificationEngine) await notificationEngine.dailySummary({ trades: trades.length, pnl: totalPnl, ...summary });
    return summary;
  } catch (e) {
    await eventLogger.error('daily_summary_failed', { error: e.message });
  }
}

function startAll() {
  if (!cron) {
    console.warn('[scheduler] node-cron not available; schedules disabled');
    return;
  }
  // Pull in dependencies once started
  if (!notificationEngine) {
    try { notificationEngine = require('./notification_engine'); } catch (e) {}
  }

  // Daily cycle at 09:22 IST (03:52 UTC) Mon-Fri
  tasks.push(cron.schedule('0 52 3 * * 1-5', async () => {
    try {
      await lifecycleEngine.runDailyCycle({ kc });
    } catch (e) {
      await eventLogger.error('daily_cycle_failed', { error: e.message, stack: e.stack });
    }
  }, { timezone: 'UTC' }));

  // Force exit check every 30s during market hours
  tasks.push(cron.schedule('*/30 * * * * *', async () => {
    if (!time.isMarketOpen()) return;
    try {
      await monitorEngine.checkForceExits();
    } catch (e) {
      await eventLogger.error('force_exit_check_failed', { error: e.message });
    }
  }, { timezone: 'UTC' }));

  // Reconciliation every 60s during market hours
  tasks.push(cron.schedule('0 * * * * *', async () => {
    if (!time.isMarketOpen()) return;
    try {
      await recoveryEngine.reconcileNow();
    } catch (e) {
      await eventLogger.error('reconcile_failed', { error: e.message });
    }
  }, { timezone: 'UTC' }));

  // EOD at 15:30 IST (10:00 UTC)
  tasks.push(cron.schedule('0 0 10 * * 1-5', async () => {
    try {
      await recoveryEngine.reconcileNow({ comprehensive: true });
      await buildAndSendDailySummary();
    } catch (e) {
      await eventLogger.error('eod_failed', { error: e.message });
    }
  }, { timezone: 'UTC' }));

  // Token age recompute every 5 min
  tasks.push(cron.schedule('0 */5 * * * *', () => {
    try { require('./health_engine').recomputeTokenAge(); } catch (e) {}
  }, { timezone: 'UTC' }));

  console.log(`[scheduler] ${tasks.length} cron tasks started`);
}

function stopAll() {
  for (const t of tasks) try { t.stop(); } catch (e) {}
  tasks.length = 0;
}

module.exports = { init, startAll, stopAll, buildAndSendDailySummary };
