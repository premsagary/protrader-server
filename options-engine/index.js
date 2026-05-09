// index.js — main entry point. Wires all engines and exposes to host (kite-server.js).
'use strict';

const time = require('./time_utils');
const eventLogger = require('./event_logger');
const stateEngine = require('./state_engine');
const strategyEngine = require('./strategy_engine');
const filterEngine = require('./filter_engine');
const healthEngine = require('./health_engine');
const riskEngine = require('./risk_engine');
const paperSim = require('./paper_simulator');
const executionEngine = require('./execution_engine');
const monitorEngine = require('./monitor_engine');
const recoveryEngine = require('./recovery_engine');
const lifecycleEngine = require('./lifecycle_engine');
const scheduler = require('./scheduler');
const notificationEngine = require('./notification_engine');

let initialized = false;

async function bootEngine({ pgPool, kiteClient = null, startScheduler = true }) {
  if (initialized) return;
  eventLogger.init(pgPool);
  stateEngine.init(pgPool);
  riskEngine.init(pgPool);
  notificationEngine.init(pgPool);
  executionEngine.init({ pgPool, kiteClient });
  monitorEngine.init({ executionEngine });
  recoveryEngine.init({ pgPool, kiteClient, monitor: monitorEngine });
  lifecycleEngine.init({ pgPool, kiteClient });
  scheduler.init({ kiteClient });

  // Wire notification into scheduler + monitor
  scheduler.init({ kiteClient, pgPool, notification: notificationEngine });
  monitorEngine.init({ executionEngine, notification: notificationEngine });

  await eventLogger.info('engine_boot', { kc: !!kiteClient, scheduler: startScheduler });
  try {
    await recoveryEngine.runStartupRecovery();
  } catch (e) {
    await eventLogger.error('startup_recovery_failed', { error: e.message });
  }

  if (startScheduler) scheduler.startAll();
  initialized = true;
}

module.exports = {
  bootEngine,
  // Re-export all engines so kite-server.js can mount endpoints
  time, eventLogger, stateEngine, strategyEngine, filterEngine,
  healthEngine, riskEngine, paperSim, executionEngine, monitorEngine,
  recoveryEngine, lifecycleEngine, scheduler, notificationEngine,
};
