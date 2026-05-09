// health_engine.js — track WS/API/DB health, quote freshness, exchange status.
'use strict';

const time = require('./time_utils');
const eventLogger = require('./event_logger');

const state = {
  wsLastTickAt:        null,
  brokerConsecFails:   0,
  brokerLastOk:        null,
  apiLatencyMs:        null,
  dbOk:                true,
  chainAgeMs:          null,
  vixAgeSec:           null,
  exchangeOk:          true,
  tokenAgeHours:       null,
  reconcileDriftCount: 0,
};

function update(partial) {
  Object.assign(state, partial);
}

function recordTick() {
  state.wsLastTickAt = Date.now();
}

// Called from kite-server.js when token is set/refreshed (token_iat = unix seconds)
function recordTokenIssued(iatSeconds) {
  state.tokenIssuedAt = iatSeconds ? iatSeconds * 1000 : Date.now();
  recomputeTokenAge();
}

function recomputeTokenAge() {
  if (state.tokenIssuedAt) {
    state.tokenAgeHours = (Date.now() - state.tokenIssuedAt) / (1000 * 3600);
  }
  return state.tokenAgeHours;
}

function recordBrokerSuccess(latencyMs) {
  state.brokerConsecFails = 0;
  state.brokerLastOk = Date.now();
  if (latencyMs != null) state.apiLatencyMs = latencyMs;
}

function recordBrokerFailure(err) {
  state.brokerConsecFails += 1;
  if (state.brokerConsecFails >= 3) {
    eventLogger.error('broker_outage', { fails: state.brokerConsecFails, err: err?.message || String(err) });
  }
}

function isHealthy() {
  return !degradationReason();
}

function degradationReason() {
  if (state.brokerConsecFails >= 3) return `broker_outage (${state.brokerConsecFails} consec fails)`;
  const wsAge = state.wsLastTickAt ? Date.now() - state.wsLastTickAt : Infinity;
  if (wsAge > 60000) return `ws_disconnected (${Math.round(wsAge / 1000)}s)`;
  if (!state.dbOk) return 'db_down';
  if (!state.exchangeOk) return 'exchange_unstable';
  if (state.tokenAgeHours != null && state.tokenAgeHours > 23) return `token_expiring (${state.tokenAgeHours.toFixed(1)}h)`;
  return null;
}

function snapshot() {
  recomputeTokenAge();
  const wsAge = state.wsLastTickAt ? Date.now() - state.wsLastTickAt : null;
  return {
    healthy:           isHealthy(),
    reason:            degradationReason(),
    ws: { ok: wsAge != null && wsAge < 15000, last_tick_age_ms: wsAge },
    broker: { ok: state.brokerConsecFails < 3, consec_fails: state.brokerConsecFails, last_ok: state.brokerLastOk, latency_ms: state.apiLatencyMs },
    db: { ok: state.dbOk },
    chain: { age_ms: state.chainAgeMs, ok: (state.chainAgeMs ?? 99999) < 10000 },
    vix: { age_sec: state.vixAgeSec, ok: (state.vixAgeSec ?? 99999) < 30 },
    exchange: { ok: state.exchangeOk },
    token: { age_hours: state.tokenAgeHours, ok: (state.tokenAgeHours ?? 99) < 23 },
    timestamp: time.nowUtc(),
  };
}

module.exports = {
  update, recordTick, recordBrokerSuccess, recordBrokerFailure,
  recordTokenIssued, recomputeTokenAge,
  isHealthy, degradationReason, snapshot,
};
