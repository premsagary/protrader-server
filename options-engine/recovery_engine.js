// recovery_engine.js — startup recovery + periodic reconciliation.
// CRITICAL: server restart with no recovery = naked unmanaged positions.
'use strict';

const eventLogger = require('./event_logger');
const stateEngine = require('./state_engine');

let pool = null;
let kc = null;
let monitorEngine = null;
function init({ pgPool, kiteClient, monitor }) {
  pool = pgPool;
  kc = kiteClient || null;
  monitorEngine = monitor;
}

// Compare DB open trades against broker positions, repair drift.
// Even non-comprehensive runs now flag drift; after 3 consecutive drift detections, escalate.
let _driftConsecutive = 0;
async function reconcileNow({ comprehensive = false } = {}) {
  const drift = { db_only: [], broker_only: [], reconciled: 0 };
  const dbActive = await stateEngine.findActive();

  let brokerPositions = [];
  if (kc) {
    try {
      const pos = await kc.getPositions();
      brokerPositions = (pos?.net || []).filter(p => Math.abs(p.quantity) > 0 && p.exchange === 'NFO');
    } catch (e) {
      await eventLogger.error('reconcile_broker_fetch_failed', { error: e.message });
    }
  }

  for (const trade of dbActive) {
    const legs = typeof trade.legs === 'string' ? JSON.parse(trade.legs) : trade.legs;
    let allMatched = true;
    for (const leg of legs) {
      const symbol = leg.instrument?.replace('NFO:', '') || `NIFTY${leg.strike}${leg.type}`;
      const matched = brokerPositions.find(p => p.tradingsymbol === symbol);
      if (!matched) { allMatched = false; break; }
    }
    if (allMatched) {
      drift.reconciled++;
      // Restore monitor if not already
      if (monitorEngine && !monitorEngine.getMonitorStatus(trade.id)) {
        await monitorEngine.startMonitoring(trade);
      }
    } else {
      drift.db_only.push({ trade_id: trade.id, strategy: trade.strategy });
      // DB says open but broker has nothing → likely manual close. Mark FAILED with note.
      if (comprehensive) {
        await stateEngine.transition(trade.id, 'FAILED', { reason: 'no broker position on reconcile' }).catch(() => {});
      }
    }
  }

  // Find broker positions with no DB record
  if (kc) {
    for (const p of brokerPositions) {
      const matched = dbActive.find(t => {
        const legs = typeof t.legs === 'string' ? JSON.parse(t.legs) : t.legs;
        return legs.some(l => (l.instrument?.replace('NFO:', '') || `NIFTY${l.strike}${l.type}`) === p.tradingsymbol);
      });
      if (!matched) {
        drift.broker_only.push({ symbol: p.tradingsymbol, qty: p.quantity });
        await eventLogger.warn('orphan_broker_position', { symbol: p.tradingsymbol, qty: p.quantity });
      }
    }
  }

  if (drift.db_only.length > 0 || drift.broker_only.length > 0) {
    _driftConsecutive++;
    await eventLogger.warn('reconcile_drift_detected', { ...drift, consecutive: _driftConsecutive });
    if (_driftConsecutive >= 3) {
      // Escalate: enter SAFE_MODE
      try {
        const riskEngine = require('./risk_engine');
        await riskEngine.enterSafeMode(`reconcile drift x${_driftConsecutive}`);
      } catch (e) {}
    }
  } else {
    _driftConsecutive = 0;
  }
  return drift;
}

// Run on every server boot
async function runStartupRecovery() {
  await eventLogger.info('startup_recovery_begin', {});
  const dbActive = await stateEngine.findActive();
  await eventLogger.info('startup_recovery_db_state', { active_count: dbActive.length });

  // Resolve any HALTED trades first
  const halted = dbActive.filter(t => t.state === 'HALTED');
  for (const t of halted) {
    try {
      await stateEngine.recoverFromHalted(t.id);
    } catch (e) {
      await eventLogger.error('halted_recovery_failed', { trade_id: t.id, error: e.message });
    }
  }

  // Then reconcile
  const drift = await reconcileNow({ comprehensive: false });
  await eventLogger.info('startup_recovery_complete', { drift });
  return { active: dbActive.length, drift };
}

async function detectOrphans() {
  return reconcileNow({ comprehensive: false });
}

module.exports = { init, runStartupRecovery, reconcileNow, detectOrphans };
