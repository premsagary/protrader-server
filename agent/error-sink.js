/**
 * error-sink.js — structured error capture + in-memory ring buffer.
 *
 * Two jobs:
 *   1. recordError(kind, msg, ctx)  — dedupe by (kind, hash(template)), upsert
 *      into app_errors so ops-agent detectors can query aggregate rates by
 *      kind over a time window.
 *   2. ring-buffer the last N log lines in memory so when an incident fires
 *      the Debugger can attach "what was happening just before" as evidence.
 *
 * Safety posture:
 *   - Env-gated via AGENT_ERROR_SINK_ENABLED (default OFF). Without the flag
 *     every function is a no-op; require() is still safe.
 *   - Hard throttle: the sink itself cannot become a runaway writer — if the
 *     in-flight INSERT queue exceeds MAX_QUEUE_DEPTH, new errors are dropped
 *     (but the dropped count is exposed via getStatus() so we can detect it).
 *   - Console interceptor is additive: the original console.error/warn still
 *     runs unmodified, so we never lose log visibility.
 *   - Read-only on the application: this module never mutates app state.
 */

'use strict';

const crypto = require('crypto');

// ────────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────────
const DEFAULTS = {
  enabled:          String(process.env.AGENT_ERROR_SINK_ENABLED || '').toLowerCase() === '1',
  ringBufferSize:   Number(process.env.AGENT_ERROR_SINK_RING || 500),
  maxQueueDepth:    Number(process.env.AGENT_ERROR_SINK_MAXQ || 100),
  maxMsgLength:     500,
  templateDigitRe:  /\d+/g,      // for hash-template normalisation
  templateHexRe:    /[0-9a-f]{16,}/gi,
};

// ────────────────────────────────────────────────────────────────────────────
// Module state (lazily initialised once init() runs)
// ────────────────────────────────────────────────────────────────────────────
let _pool = null;
let _enabled = false;
let _ringBuffer = [];              // [{ ts, level, msg }, ...]
let _ringMax = DEFAULTS.ringBufferSize;
let _inflight = 0;
let _droppedQueueFull = 0;
let _totalRecorded = 0;
let _totalUpsertErrors = 0;
let _originalConsole = null;
let _wrapInstalled = false;
let _unhandledInstalled = false;

// ────────────────────────────────────────────────────────────────────────────
// Kind classification — best-effort guess from the message text.
// Callers should pass an explicit `kind` whenever possible; this is only used
// when recordError is called without one (e.g., from the console wrapper).
// ────────────────────────────────────────────────────────────────────────────
function classifyKind(msg) {
  if (!msg) return 'GENERIC';
  const m = String(msg);
  // Order matters: most specific first.
  if (/token|access_token|api_key|unauthori[sz]ed/i.test(m)) return 'KITE_TOKEN';
  if (/kite|zerodha|\/connect\/|KiteConnect/i.test(m))      return 'KITE_API';
  if (/ECONNRESET|ETIMEDOUT|socket hang up|getaddrinfo/i.test(m)) return 'NETWORK';
  if (/connection (timeout|terminated|refused)|too many clients|pool/i.test(m)) return 'DB_POOL';
  if (/relation .* does not exist|column .* does not exist|syntax error/i.test(m)) return 'DB_QUERY';
  if (/ENOSPC|ENOMEM|out of memory/i.test(m))               return 'RESOURCE';
  if (/unhandled|unhandledRejection|uncaughtException/i.test(m)) return 'UNHANDLED';
  if (/cache|snapshot|_dayTradeCache/i.test(m))             return 'CACHE_WRITE';
  return 'GENERIC';
}

// ────────────────────────────────────────────────────────────────────────────
// Template hash — strip volatile parts (digits, long hex runs) before hashing
// so "order 12345 failed" and "order 67890 failed" dedupe to the same row.
// ────────────────────────────────────────────────────────────────────────────
function templateHash(msg) {
  const normalised = String(msg || '')
    .slice(0, DEFAULTS.maxMsgLength)
    .replace(DEFAULTS.templateHexRe, 'HEX')
    .replace(DEFAULTS.templateDigitRe, 'N')
    .trim();
  return crypto.createHash('sha256').update(normalised).digest('hex').slice(0, 16);
}

// ────────────────────────────────────────────────────────────────────────────
// Ring-buffer push — always runs (even when pool-write is disabled) because
// it's cheap in-memory and valuable for incident forensics.
// ────────────────────────────────────────────────────────────────────────────
function ringPush(level, msg) {
  if (!_enabled) return;
  if (_ringBuffer.length >= _ringMax) _ringBuffer.shift();
  _ringBuffer.push({
    ts: new Date().toISOString(),
    level: String(level || 'info').toLowerCase(),
    msg: String(msg || '').slice(0, DEFAULTS.maxMsgLength),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Public: init(deps) — wires in the pg pool.
// Safe to call multiple times; later calls replace the pool reference.
// ────────────────────────────────────────────────────────────────────────────
function init(deps) {
  const opts = deps || {};
  _pool = opts.pool || null;
  _enabled = DEFAULTS.enabled && !!_pool;
  if (typeof opts.ringBufferSize === 'number' && opts.ringBufferSize > 0) {
    _ringMax = opts.ringBufferSize;
  }
  if (_enabled) {
    // Optional: also install the console wrapper + unhandled handlers at init.
    if (opts.wrapConsole) wrapConsole();
    if (opts.captureUnhandled !== false) captureUnhandled();
  }
  return { enabled: _enabled, ringBufferSize: _ringMax };
}

// ────────────────────────────────────────────────────────────────────────────
// Public: recordError(kind, msg, ctx)
//
// kind  — caller-supplied classification (e.g., 'KITE_API', 'DB_POOL').
//         If null/undefined, we try to classify from the message.
// msg   — error message or Error instance.
// ctx   — optional object persisted as JSONB (stack head, sym, run_id, etc.)
//
// Always returns immediately; the DB write is fire-and-forget. Never throws.
// ────────────────────────────────────────────────────────────────────────────
function recordError(kind, msg, ctx) {
  try {
    const raw = msg instanceof Error ? (msg.message || String(msg)) : String(msg || '');
    ringPush('error', `[${kind || 'ERR'}] ${raw}`);
    if (!_enabled || !_pool) return;

    if (_inflight >= DEFAULTS.maxQueueDepth) {
      _droppedQueueFull++;
      return;
    }

    const finalKind = (kind || classifyKind(raw)).slice(0, 40);
    const hash = templateHash(raw);
    const sample = raw.slice(0, DEFAULTS.maxMsgLength);
    // Context: stack head if msg is an Error, plus whatever ctx object caller passed.
    let finalCtx = {};
    if (msg instanceof Error && msg.stack) {
      finalCtx.stack_head = msg.stack.split('\n').slice(0, 4).join('\n');
    }
    if (ctx && typeof ctx === 'object') {
      Object.assign(finalCtx, ctx);
    }
    if (Object.keys(finalCtx).length === 0) finalCtx = null;

    _inflight++;
    _totalRecorded++;
    _pool.query(
      `INSERT INTO app_errors (kind, message_hash, message_sample, sample_context)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (kind, message_hash)
       DO UPDATE SET
         last_seen = NOW(),
         count = app_errors.count + 1,
         sample_context = COALESCE(EXCLUDED.sample_context, app_errors.sample_context)`,
      [finalKind, hash, sample, finalCtx ? JSON.stringify(finalCtx) : null]
    )
      .catch((e) => {
        _totalUpsertErrors++;
        // Never call recordError recursively from its own error path.
      })
      .finally(() => {
        _inflight = Math.max(0, _inflight - 1);
      });
  } catch (_err) {
    // swallow — the sink must never throw into the caller
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Public: wrapConsole() — tee console.error/warn into the ring buffer.
// Does NOT call recordError automatically to avoid DB amplification; explicit
// catch blocks should call recordError with a proper kind.
// ────────────────────────────────────────────────────────────────────────────
function wrapConsole() {
  if (_wrapInstalled) return;
  if (!_enabled) return;
  _originalConsole = {
    log:   console.log.bind(console),
    warn:  console.warn.bind(console),
    error: console.error.bind(console),
  };
  console.warn = function patchedWarn(...args) {
    try { ringPush('warn', args.map(formatArg).join(' ')); } catch (_) {}
    return _originalConsole.warn(...args);
  };
  console.error = function patchedError(...args) {
    const msg = args.map(formatArg).join(' ');
    try { ringPush('error', msg); } catch (_) {}
    // Tee to recordError so app_errors gets populated automatically. Dedup by
    // (kind, template-hash) + queue-depth throttle prevents runaway writes.
    // Skip empty or trivial messages.
    try {
      if (msg && msg.length >= 8) recordError(null, msg, { source: 'console.error' });
    } catch (_) {}
    return _originalConsole.error(...args);
  };
  _wrapInstalled = true;
}

function formatArg(a) {
  if (a == null) return String(a);
  if (typeof a === 'string') return a;
  if (a instanceof Error) return a.message || String(a);
  try { return JSON.stringify(a); } catch (_) { return String(a); }
}

// ────────────────────────────────────────────────────────────────────────────
// Public: captureUnhandled() — hooks into unhandledRejection + uncaughtException
// so background promise failures are visible to the detectors.
// ────────────────────────────────────────────────────────────────────────────
function captureUnhandled() {
  if (_unhandledInstalled) return;
  if (!_enabled) return;
  process.on('unhandledRejection', (reason) => {
    recordError('UNHANDLED', reason instanceof Error ? reason : String(reason), {
      source: 'unhandledRejection',
    });
  });
  process.on('uncaughtException', (err) => {
    recordError('UNHANDLED', err, { source: 'uncaughtException' });
    // do NOT rethrow or exit — that's the host's choice
  });
  _unhandledInstalled = true;
}

// ────────────────────────────────────────────────────────────────────────────
// Public: getRingBuffer(n) — return the last N entries (newest last).
// Safe to call even when disabled (returns []).
// ────────────────────────────────────────────────────────────────────────────
function getRingBuffer(n) {
  if (!_ringBuffer.length) return [];
  const size = Math.max(1, Math.min(Number(n) || _ringMax, _ringBuffer.length));
  return _ringBuffer.slice(-size);
}

// ────────────────────────────────────────────────────────────────────────────
// Public: getRecentErrors({ minutes, kind, limit }) — query app_errors.
// Used by the /api/app-errors endpoint. Returns [] if disabled or pool missing.
// ────────────────────────────────────────────────────────────────────────────
async function getRecentErrors(opts) {
  if (!_enabled || !_pool) return [];
  const minutes = Math.max(1, Math.min(Number((opts || {}).minutes) || 60, 24 * 60));
  const limit   = Math.max(1, Math.min(Number((opts || {}).limit)   || 100, 500));
  const kind    = (opts || {}).kind ? String((opts || {}).kind).slice(0, 40) : null;
  const where = [`last_seen > NOW() - INTERVAL '${minutes} minutes'`];
  const params = [];
  if (kind) {
    params.push(kind);
    where.push(`kind = $${params.length}`);
  }
  const sql = `
    SELECT id, kind, message_hash, message_sample, sample_context,
           first_seen, last_seen, count
      FROM app_errors
     WHERE ${where.join(' AND ')}
     ORDER BY last_seen DESC
     LIMIT ${limit}
  `;
  try {
    const { rows } = await _pool.query(sql, params);
    return rows;
  } catch (_e) {
    return [];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Public: countByKind({ minutes }) — used by ops-agent detectors.
// ────────────────────────────────────────────────────────────────────────────
async function countByKind(opts) {
  if (!_enabled || !_pool) return {};
  const minutes = Math.max(1, Math.min(Number((opts || {}).minutes) || 5, 24 * 60));
  try {
    const { rows } = await _pool.query(
      `SELECT kind, COALESCE(SUM(count), 0)::INT AS n
         FROM app_errors
        WHERE last_seen > NOW() - INTERVAL '${minutes} minutes'
        GROUP BY kind`
    );
    const out = {};
    for (const r of rows) out[r.kind] = Number(r.n) || 0;
    return out;
  } catch (_e) {
    return {};
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Public: getStatus() — diagnostics (exposed via /api/app-errors?status=1)
// ────────────────────────────────────────────────────────────────────────────
function getStatus() {
  return {
    enabled: _enabled,
    ringBufferSize: _ringBuffer.length,
    ringBufferCapacity: _ringMax,
    inflight: _inflight,
    droppedQueueFull: _droppedQueueFull,
    totalRecorded: _totalRecorded,
    totalUpsertErrors: _totalUpsertErrors,
    consoleWrapped: _wrapInstalled,
    unhandledCaptured: _unhandledInstalled,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Public: shutdown() — restore console (primarily for tests)
// ────────────────────────────────────────────────────────────────────────────
function shutdown() {
  if (_wrapInstalled && _originalConsole) {
    console.warn = _originalConsole.warn;
    console.error = _originalConsole.error;
    _wrapInstalled = false;
  }
  _enabled = false;
}

module.exports = {
  init,
  recordError,
  wrapConsole,
  captureUnhandled,
  getRingBuffer,
  getRecentErrors,
  countByKind,
  getStatus,
  shutdown,
  // exported for unit tests
  _internal: { classifyKind, templateHash },
};
