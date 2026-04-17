/**
 * news-classifier.js - LLM-powered news headline classification
 *
 * Replaces the hand-maintained NEGATIVE_KEYWORDS regex blacklist with a
 * per-headline LLM classification call. Default model: Claude Haiku 4.5
 * via OpenRouter. Caches verdicts by SHA-256 headline hash in DB so the
 * same headline never re-classifies across cron runs.
 *
 * Budget: $1/day cap. When exhausted, falls back to a reduced keyword
 * matcher so the news cron never halts completely.
 */

'use strict';

const crypto = require('crypto');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const CLASSIFIER_MODEL = process.env.NEWS_CLASSIFIER_MODEL || 'anthropic/claude-haiku-4.5';
const DAILY_BUDGET_USD = Number(process.env.NEWS_CLASSIFIER_DAILY_BUDGET_USD || '1.0');

const MODEL_COST_RATES = {
  'anthropic/claude-haiku-4.5':         { input: 1.00, output: 5.00 },
  'anthropic/claude-haiku-4-5-20251001':{ input: 1.00, output: 5.00 },
  'meta-llama/llama-3.3-70b-instruct':  { input: 0.05, output: 0.25 },
  'openai/gpt-4.1-mini':                { input: 0.15, output: 0.60 },
  'google/gemini-2.5-flash':            { input: 0.075, output: 0.30 },
};

function estCostForCall(usage) {
  const rates = MODEL_COST_RATES[CLASSIFIER_MODEL] || { input: 1.00, output: 5.00 };
  const inT = usage && usage.prompt_tokens ? usage.prompt_tokens : 150;
  const outT = usage && usage.completion_tokens ? usage.completion_tokens : 80;
  return (inT * rates.input / 1000000) + (outT * rates.output / 1000000);
}

let _pool = null;
function setPool(pool) { _pool = pool; }

let _todayKey = null;
let _spentUsd = 0;
let _classifiedCount = 0;
let _fallbackCount = 0;

function istTodayKey() {
  const now = new Date(Date.now() + 5.5 * 3600 * 1000);
  return now.toISOString().slice(0, 10);
}

async function loadBudgetFromDb() {
  const today = istTodayKey();
  if (!_pool) return { today: today, spent: 0, classified: 0, fallbacks: 0 };
  try {
    const r = await _pool.query('SELECT spent_usd, classified, fallbacks FROM llm_budget_daily WHERE day = $1', [today]);
    if (r.rows[0]) {
      return {
        today: today,
        spent: Number(r.rows[0].spent_usd) || 0,
        classified: r.rows[0].classified || 0,
        fallbacks: r.rows[0].fallbacks || 0,
      };
    }
  } catch (_) {}
  return { today: today, spent: 0, classified: 0, fallbacks: 0 };
}

async function ensureBudgetLoaded() {
  const today = istTodayKey();
  if (_todayKey === today) return;
  const loaded = await loadBudgetFromDb();
  _todayKey = today;
  _spentUsd = loaded.spent || 0;
  _classifiedCount = loaded.classified || 0;
  _fallbackCount = loaded.fallbacks || 0;
}

async function incrementBudget(costUsd, fellBack) {
  await ensureBudgetLoaded();
  _spentUsd += costUsd;
  if (fellBack) _fallbackCount++;
  else _classifiedCount++;
  if (!_pool) return;
  try {
    await _pool.query(
      'INSERT INTO llm_budget_daily (day, spent_usd, classified, fallbacks) ' +
      'VALUES ($1, $2, $3, $4) ' +
      'ON CONFLICT (day) DO UPDATE SET ' +
      '  spent_usd = llm_budget_daily.spent_usd + EXCLUDED.spent_usd, ' +
      '  classified = llm_budget_daily.classified + $5, ' +
      '  fallbacks = llm_budget_daily.fallbacks + $6',
      [_todayKey, costUsd, fellBack ? 0 : 1, fellBack ? 1 : 0, fellBack ? 0 : 1, fellBack ? 1 : 0]
    );
  } catch (_) {}
}

function hashTitle(title) {
  return crypto.createHash('sha256').update(String(title)).digest('hex');
}

async function getCachedVerdict(h) {
  if (!_pool) return null;
  try {
    const r = await _pool.query('SELECT verdict FROM news_classification_cache WHERE headline_hash = $1', [h]);
    return (r.rows[0] && r.rows[0].verdict) || null;
  } catch (_) { return null; }
}

async function cacheVerdict(h, title, verdict, costUsd) {
  if (!_pool) return;
  try {
    await _pool.query(
      'INSERT INTO news_classification_cache (headline_hash, title, verdict, cost_usd, classified_at) ' +
      'VALUES ($1, $2, $3::jsonb, $4, NOW()) ' +
      'ON CONFLICT (headline_hash) DO NOTHING',
      [h, String(title).slice(0, 500), verdict, costUsd]
    );
  } catch (_) {}
}

const SYSTEM_PROMPT = 'You are a financial risk analyst reviewing news headlines for Indian stocks. Classify each headline impact on the stock. Respond with JSON only, no prose.';

function buildUserPrompt(title, stockSym, sector) {
  const parts = [];
  parts.push('Headline: ' + title);
  parts.push('Stock: ' + (stockSym || 'unknown') + (sector ? ' (' + sector + ')' : ''));
  parts.push('');
  parts.push('Output JSON matching this schema:');
  parts.push('{');
  parts.push('  "severity": one of HIGH | MEDIUM | LOW | NONE');
  parts.push('  "category": one of regulatory | fraud | merger | operational | financial_distress | governance | product_recall | legal | benign | bullish');
  parts.push('  "reason": one-sentence explanation, max 20 words');
  parts.push('  "demote_score": 0 to 20 integer');
  parts.push('  "should_disqualify": true or false');
  parts.push('}');
  parts.push('');
  parts.push('Rules:');
  parts.push('- severity NONE + category benign or bullish for positive or neutral news');
  parts.push('- severity HIGH + demote_score 10-20 for: active regulatory enforcement, fraud allegations, default, auditor resignation, major FDA action');
  parts.push('- should_disqualify true ONLY for extreme cases: foreign-govt asset seizures, SEBI bans, confirmed fraud, bankruptcy filing');
  parts.push('- Soft negative news (mild downgrade, minor miss) becomes severity LOW + demote_score 1-5');
  parts.push('- Analyst downgrades alone are severity LOW unless target cut implies more than -15% downside');
  parts.push('Output JSON only.');
  return parts.join('\n');
}

function fallbackKeywordVerdict(title) {
  const t = String(title).toLowerCase();
  const extreme = /sebi\s+ban|bankruptcy|insolvency|fraud|auditor\s+resign|trading\s+suspended|nclt/i;
  const high = /fda\s+warning|recall|raid|default|downgrade|under investigation|probe|show.cause/i;
  const medium = /lawsuit|sued|rating\s+cut|plant\s+closure|strike/i;
  if (extreme.test(t)) return { severity: 'HIGH',   category: 'regulatory', reason: 'keyword-fallback extreme', demote_score: 15, should_disqualify: true,  _fallback: true };
  if (high.test(t))    return { severity: 'HIGH',   category: 'regulatory', reason: 'keyword-fallback high',    demote_score: 10, should_disqualify: false, _fallback: true };
  if (medium.test(t))  return { severity: 'MEDIUM', category: 'legal',      reason: 'keyword-fallback medium',  demote_score: 5,  should_disqualify: false, _fallback: true };
  return { severity: 'NONE', category: 'benign', reason: 'keyword-fallback no match', demote_score: 0, should_disqualify: false, _fallback: true };
}

async function classifyHeadline(title, opts) {
  if (!title || typeof title !== 'string') return null;
  opts = opts || {};
  await ensureBudgetLoaded();

  const h = hashTitle(title);

  const cached = await getCachedVerdict(h);
  if (cached) return Object.assign({}, cached, { _source: 'cache' });

  if (_spentUsd >= DAILY_BUDGET_USD || !OPENROUTER_API_KEY) {
    const v = fallbackKeywordVerdict(title);
    await incrementBudget(0, true);
    v._source = _spentUsd >= DAILY_BUDGET_USD ? 'fallback-budget-exhausted' : 'fallback-no-api-key';
    return v;
  }

  try {
    const body = {
      model: CLASSIFIER_MODEL,
      max_tokens: 200,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: buildUserPrompt(title, opts.stockSym, opts.stockSector) },
      ],
    };
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + OPENROUTER_API_KEY,
        'HTTP-Referer':  process.env.OPENROUTER_REFERER || 'https://protrader-server.up.railway.app',
        'X-Title':       'ProTrader News Classifier',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) {
      const v = fallbackKeywordVerdict(title);
      await incrementBudget(0, true);
      v._source = 'fallback-llm-error';
      v._error = 'openrouter ' + resp.status;
      return v;
    }
    const json = await resp.json();
    const content = (json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || '{}';
    let parsed;
    try { parsed = JSON.parse(content); }
    catch (_) {
      const v = fallbackKeywordVerdict(title);
      await incrementBudget(0, true);
      v._source = 'fallback-llm-parse-error';
      return v;
    }

    const out = {
      severity: ['HIGH','MEDIUM','LOW','NONE'].includes(parsed.severity) ? parsed.severity : 'NONE',
      category: String(parsed.category || 'benign').slice(0, 40),
      reason:   String(parsed.reason || '').slice(0, 200),
      demote_score: Math.min(20, Math.max(0, Math.round(Number(parsed.demote_score) || 0))),
      should_disqualify: parsed.should_disqualify === true,
    };

    const costUsd = estCostForCall((json && json.usage) || {});
    await cacheVerdict(h, title, out, costUsd);
    await incrementBudget(costUsd, false);
    return Object.assign({}, out, { _source: 'llm', _cost_usd: costUsd });
  } catch (e) {
    const v = fallbackKeywordVerdict(title);
    await incrementBudget(0, true);
    v._source = 'fallback-exception';
    v._error = String(e.message || e).slice(0, 100);
    return v;
  }
}

async function getBudgetStatus() {
  await ensureBudgetLoaded();
  return {
    day: _todayKey,
    spent_usd: +_spentUsd.toFixed(6),
    remaining_usd: +(DAILY_BUDGET_USD - _spentUsd).toFixed(4),
    budget_usd: DAILY_BUDGET_USD,
    classified: _classifiedCount,
    fallbacks: _fallbackCount,
    cap_hit: _spentUsd >= DAILY_BUDGET_USD,
    model: CLASSIFIER_MODEL,
  };
}

module.exports = {
  classifyHeadline: classifyHeadline,
  getBudgetStatus: getBudgetStatus,
  setPool: setPool,
};
