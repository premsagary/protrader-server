// risk_engine.js — engine-level caps and SAFE_MODE management.
'use strict';

const eventLogger = require('./event_logger');

let pool = null;
function init(pgPool) { pool = pgPool; }

const DEFAULTS = {
  daily_loss_cap:      5000,
  max_open_positions:  1,
  max_consec_losses:   2,
  max_drawdown_pct:    0.15,
  max_vix:             35,
  max_spread_pct:      0.02,
};

async function loadSettings() {
  if (!pool) return { ...DEFAULTS, capital: 200000 };
  const { rows } = await pool.query(`SELECT * FROM options_settings ORDER BY id LIMIT 1`);
  if (!rows.length) {
    await pool.query(`INSERT INTO options_settings DEFAULT VALUES`);
    return loadSettings();
  }
  return rows[0];
}

async function checkAllCaps(ctx) {
  const settings = await loadSettings();
  const violations = [];

  // Daily loss
  if (ctx.todayPnl != null && ctx.todayPnl <= -settings.daily_loss_cap) {
    violations.push({ cap: 'daily_loss', value: ctx.todayPnl, threshold: -settings.daily_loss_cap });
  }
  // Drawdown
  if (ctx.drawdown != null && ctx.drawdown / settings.capital > settings.max_drawdown_pct) {
    violations.push({ cap: 'drawdown', value: ctx.drawdown, threshold: settings.capital * settings.max_drawdown_pct });
  }
  // Consec losses
  if (ctx.consecLossDays >= settings.max_consec_losses) {
    violations.push({ cap: 'consec_losses', value: ctx.consecLossDays, threshold: settings.max_consec_losses });
  }
  // Open positions
  if (ctx.openCount >= settings.max_open_positions) {
    violations.push({ cap: 'max_open_positions', value: ctx.openCount, threshold: settings.max_open_positions });
  }
  // VIX
  if (ctx.vix > settings.max_vix) {
    violations.push({ cap: 'max_vix', value: ctx.vix, threshold: settings.max_vix });
  }

  return { settings, violations, blocked: violations.length > 0 };
}

async function enterSafeMode(reason) {
  if (!pool) return;
  await pool.query(
    `UPDATE options_settings SET safe_mode_active = TRUE, safe_mode_reason = $1, safe_mode_entered = NOW() WHERE id = (SELECT id FROM options_settings ORDER BY id LIMIT 1)`,
    [reason]
  );
  await eventLogger.warn('safe_mode_enter', { reason });
}

async function exitSafeMode() {
  if (!pool) return;
  await pool.query(
    `UPDATE options_settings SET safe_mode_active = FALSE, safe_mode_reason = NULL, safe_mode_entered = NULL WHERE id = (SELECT id FROM options_settings ORDER BY id LIMIT 1)`
  );
  await eventLogger.info('safe_mode_exit', {});
}

async function activateKill(reason, durationDays = null) {
  if (!pool) return;
  const until = durationDays ? new Date(Date.now() + durationDays * 86400000) : null;
  await pool.query(
    `UPDATE options_settings SET killed_until = $1, killed_reason = $2 WHERE id = (SELECT id FROM options_settings ORDER BY id LIMIT 1)`,
    [until, reason]
  );
  await eventLogger.critical('kill_switch_activated', { reason, until });
}

async function clearKill() {
  if (!pool) return;
  await pool.query(
    `UPDATE options_settings SET killed_until = NULL, killed_reason = NULL WHERE id = (SELECT id FROM options_settings ORDER BY id LIMIT 1)`
  );
  await eventLogger.info('kill_switch_cleared', {});
}

async function getRiskStatus(ctx = {}) {
  const settings = await loadSettings();
  return {
    settings: {
      daily_loss_cap: settings.daily_loss_cap,
      max_drawdown_pct: settings.max_drawdown_pct,
      max_consec_losses: settings.max_consec_losses,
      max_open_positions: settings.max_open_positions,
      capital: settings.capital,
    },
    current: {
      today_pnl: ctx.todayPnl || 0,
      drawdown: ctx.drawdown || 0,
      consec_loss_days: ctx.consecLossDays || 0,
      open_count: ctx.openCount || 0,
    },
    safe_mode_active: settings.safe_mode_active,
    safe_mode_reason: settings.safe_mode_reason,
    killed_until: settings.killed_until,
    killed_reason: settings.killed_reason,
  };
}

module.exports = {
  init, DEFAULTS, loadSettings, checkAllCaps,
  enterSafeMode, exitSafeMode,
  activateKill, clearKill, getRiskStatus,
};
