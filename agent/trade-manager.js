/**
 * trade-manager.js — position poller + trailing-SL + time-based exits.
 *
 * Phase 1: STUB. No trades are live in dry run, so there's nothing to manage.
 * This file exists now so Phase 2 wiring knows exactly what hook points it
 * needs (poll interval, exit reasons, reconciliation).
 *
 * Phase 2 design:
 *   - cron.schedule('*\/15 * * * * *', pollOpenTrades)   -- every 15 sec
 *   - For each open agent_trade row:
 *       * fetch latest LTP (paper: from kite.getLTP, live: same)
 *       * if price <= SL → mark exit SL_HIT, write event, update row
 *       * if price >= TGT → mark exit TARGET_HIT
 *       * if time >= 15:15 IST → mark exit TIME_EXIT
 *       * if unrealized >= 1R → move SL to breakeven (via Kite.modifyOrder in live)
 *       * if unrealized >= 2R → trail SL by 0.75 * ATR
 *       * reconcile: if Kite shows position closed but we don't → RECONCILE_DRIFT
 */

'use strict';

async function pollOpenTrades(deps) {
  // Intentionally no-op in Phase 1 dry run
  return { ok: true, polled: 0, note: 'trade-manager stub (Phase 1 dry run)' };
}

function startPoller(deps) {
  // Phase 2: cron.schedule(...)
  return { started: false, note: 'trade-manager poller disabled in Phase 1' };
}

module.exports = { pollOpenTrades, startPoller };
