/**
 * external-signals.js — pulls data from outside stockFundamentals and
 * caches it for risk-flag consumption.
 *
 * Three sources:
 *   1. BSE corporate events       — https://api.bseindia.com/ public JSON
 *   2. News triggers              — Google News RSS (no API key, free)
 *   3. Analyst consensus          — Screener.in scrape (uses existing cookies
 *                                   from screener-scraper.js if logged in)
 *
 * Design contract:
 *   - Every fetcher MUST degrade gracefully — if the external source
 *     times out / errors / returns junk, return null (never throw).
 *     The main scoring pipeline must never fail because an external
 *     signal source is down.
 *   - Every fetcher is bounded: max 8s per call, max N parallel.
 *   - Results are cached in a JSONB PG table for N hours.
 *   - The risk-flag detectors in risk-flags.js read the cached fields
 *     (f._bseEvents, f._newsNegative, f._analystConsensus) — network IO
 *     never happens inside scoring.
 */

'use strict';

const https = require('https');
const { URL } = require('url');

// ── Shared HTTP helper with timeout + error tolerance ──────────────────────
function safeHttpGet(url, opts = {}) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/html, application/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        ...(opts.headers || {}),
      };
      const req = https.request({
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'GET',
        headers,
        timeout: opts.timeout || 8000,
      }, (res) => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
      });
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.on('error', () => resolve(null));
      req.end();
    } catch (e) {
      resolve(null);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. BSE CORPORATE EVENTS
// ═══════════════════════════════════════════════════════════════════════════
// api.bseindia.com exposes undocumented-but-public JSON endpoints used by
// bseindia.com's own UI. Two useful ones:
//   - Corporate announcements: /BseIndiaAPI/api/AnnGetData/w
//   - Corporate actions:       /BseIndiaAPI/api/CorporateAct/w
// Both require a realistic User-Agent + Referer.

async function fetchBSEEventsForSymbol(bseCode, now = Date.now()) {
  if (!bseCode) return null;
  const from = new Date(now - 7 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const to   = new Date(now + 60 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');

  // Corporate Actions (board meetings, dividend ex-dates, AGM, splits)
  const caUrl = `https://api.bseindia.com/BseIndiaAPI/api/CorporateAct/w?scripcode=${bseCode}&Fdate=${from}&TDate=${to}`;
  const resp = await safeHttpGet(caUrl, {
    headers: { 'Referer': 'https://www.bseindia.com/corporates/corporate_act.html' },
    timeout: 8000,
  });
  if (!resp || resp.status !== 200) return [];

  let rows;
  try { rows = JSON.parse(resp.body); } catch (_) { return []; }
  if (!Array.isArray(rows)) return [];

  const events = [];
  for (const r of rows) {
    // BSE returns various key shapes; be defensive.
    const rawDate = r.BOARD_MEETING_DATE || r.RECORD_DATE || r.EX_DATE || r.XDt || r.Date;
    const label   = r.Purpose || r.PURPOSE_NM || r.PurposeDesc || r.RecordDesc || r.Type || r.AGENDA;
    if (!rawDate) continue;
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) continue;
    events.push({
      type: _classifyBSEEvent(label),
      label: String(label || '').slice(0, 120),
      date: d.toISOString().slice(0, 10),
      daysAway: Math.ceil((d.getTime() - now) / 86400000),
    });
  }
  return events;
}

function _classifyBSEEvent(label) {
  const s = String(label || '').toLowerCase();
  if (s.includes('board meeting') && /(result|earning|financial)/i.test(s)) return 'board_results';
  if (s.includes('board meeting')) return 'board_meeting';
  if (s.includes('dividend')) return 'dividend';
  if (s.includes('agm')) return 'agm';
  if (s.includes('record')) return 'record_date';
  if (s.includes('split') || s.includes('sub-division')) return 'split';
  if (s.includes('bonus')) return 'bonus';
  if (s.includes('rights')) return 'rights';
  return 'other';
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. NEWS TRIGGERS — Google News RSS
// ═══════════════════════════════════════════════════════════════════════════
// Public RSS feed, no API key. Returns last ~100 articles matching a query.
// We filter to Indian sources + last 7 days, then keyword-match for negative
// sentiment triggers. Intentionally crude keyword matching — too many false
// positives from an LLM pass, too fragile vs a trained sentiment model.

const NEGATIVE_KEYWORDS = [
  // Regulatory
  'sebi fine', 'sebi penalty', 'sebi notice', 'sebi order', 'sebi probe',
  'enforcement', 'raid', 'search seizure',
  // Governance
  'auditor resign', 'independent director resign', 'resignation of director',
  'related party', 'promoter pledge', 'insider trading',
  // Fraud / criminal
  'fraud', 'embezzle', 'siphon', 'shell compan', 'money launder',
  // Financial distress
  'default', 'bankruptcy', 'insolvency', 'nclt', 'one-time settlement',
  'credit rating downgrade', 'rating cut', 'negative outlook',
  // Operational
  'factory shutdown', 'plant closure', 'strike', 'labour unrest',
  'recall', 'drug recall', 'import ban', 'fda warning', 'fda 483',
  // Legal
  'lawsuit', 'sued', 'arrested', 'fir', 'charge sheet',
];

async function fetchNewsSignalsForSymbol(symbol, companyName) {
  if (!symbol && !companyName) return null;
  const q = encodeURIComponent(`"${companyName || symbol}" India`);
  const url = `https://news.google.com/rss/search?q=${q}+when:7d&hl=en-IN&gl=IN&ceid=IN:en`;
  const resp = await safeHttpGet(url, { timeout: 6000 });
  if (!resp || resp.status !== 200 || !resp.body) return null;

  // Crude XML parse — avoid pulling in a parser dep. Just extract <title> + <pubDate>.
  const items = resp.body.split(/<item>/).slice(1);
  const parsed = items.map(it => {
    const titleM = it.match(/<title>\s*(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?\s*<\/title>/);
    const dateM  = it.match(/<pubDate>([^<]+)<\/pubDate>/);
    const linkM  = it.match(/<link>([^<]+)<\/link>/);
    return {
      title: titleM ? titleM[1].trim() : '',
      pubDate: dateM ? dateM[1] : null,
      link: linkM ? linkM[1] : null,
    };
  }).filter(x => x.title);

  // Match negative keywords — each match counts 1, cap headlines returned.
  const hits = [];
  for (const item of parsed) {
    const t = item.title.toLowerCase();
    for (const kw of NEGATIVE_KEYWORDS) {
      if (t.includes(kw)) {
        hits.push({ title: item.title, keyword: kw, pubDate: item.pubDate, link: item.link });
        break; // one keyword per headline
      }
    }
  }

  if (!hits.length) return { count: 0, score: 0, headlines: [], asOf: new Date().toISOString() };

  // Score = number of hits; cap at 5 for signal strength
  return {
    count: hits.length,
    score: Math.min(5, hits.length),
    headlines: hits.slice(0, 5).map(h => h.title),
    keywords: [...new Set(hits.map(h => h.keyword))],
    asOf: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. ANALYST CONSENSUS — Screener.in scrape
// ═══════════════════════════════════════════════════════════════════════════
// Screener displays broker targets when aggregated from reports. The raw
// HTML contains:
//   - Target price (₹X,YYY) in the "Analyst Estimates" or "Consensus" card
//   - Rating distribution (BUY / HOLD / SELL counts)
// We pull the company page HTML and regex-extract what we can. Graceful
// degradation: if the card isn't present on a page, return null.

async function fetchAnalystConsensusForSymbol(symbol, currentPrice) {
  if (!symbol) return null;
  const url = `https://www.screener.in/company/${encodeURIComponent(symbol)}/consolidated/`;
  const resp = await safeHttpGet(url, {
    timeout: 8000,
    headers: { 'Accept': 'text/html,application/xhtml+xml' },
  });
  if (!resp || resp.status !== 200 || !resp.body) return null;

  const html = resp.body;
  let targetPrice = null;
  let rating = null;
  const buyCount  = (html.match(/\bbuy\b/gi) || []).length;
  const holdCount = (html.match(/\bhold\b/gi) || []).length;
  const sellCount = (html.match(/\bsell\b/gi) || []).length;

  // Consensus target price is often rendered like "Target Price: ₹ 2,345"
  const tpMatch = html.match(/Target\s+Price[^₹<]*₹\s*([\d,]+(?:\.\d+)?)/i)
               || html.match(/Analyst\s+Target[^₹<]*₹\s*([\d,]+(?:\.\d+)?)/i);
  if (tpMatch) {
    const v = Number(tpMatch[1].replace(/,/g, ''));
    if (Number.isFinite(v) && v > 0) targetPrice = v;
  }

  // Naive rating derivation: whichever keyword appears most often in the
  // Analyst section dominates. We only trust this if target price is present
  // (otherwise the counts are meaningless — "buy" appears anywhere on page).
  if (targetPrice != null) {
    if (buyCount > holdCount && buyCount > sellCount) rating = 'BUY';
    else if (sellCount > holdCount && sellCount > buyCount) rating = 'SELL';
    else rating = 'HOLD';
  }

  if (targetPrice == null && rating == null) return null;

  const impliedReturn = (Number.isFinite(currentPrice) && Number.isFinite(targetPrice) && currentPrice > 0)
    ? ((targetPrice - currentPrice) / currentPrice) * 100
    : null;

  return {
    rating,
    targetPrice,
    impliedReturn,
    asOf: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BATCH REFRESH — used by the cron job
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Refresh external signals for a list of symbols, with concurrency limit.
 * Returns { symbol: { bseEvents, newsNegative, analystConsensus } }.
 * Never throws — per-symbol failures just produce null fields.
 *
 * `sources` controls which fetchers run. Pass a subset to avoid hammering
 * any one provider:
 *   - ['news']    — Google News RSS only  (30-min cron during market hours)
 *   - ['bse']     — BSE corp actions only (hourly cron during market hours)
 *   - ['analyst'] — Screener scrape only  (daily @ 19:30 IST after close)
 *   - undefined   — all three (default, for manual refresh endpoint)
 */
async function refreshExternalSignals(stocks, opts = {}) {
  const { concurrency = 3, sources } = opts;
  const wantNews    = !sources || sources.includes('news');
  const wantBse     = !sources || sources.includes('bse');
  const wantAnalyst = !sources || sources.includes('analyst');

  const out = {};
  const queue = [...stocks];

  async function worker() {
    while (queue.length) {
      const s = queue.shift();
      if (!s) break;
      try {
        const [bse, news, analyst] = await Promise.all([
          wantBse && s.bseCode ? fetchBSEEventsForSymbol(s.bseCode) : Promise.resolve(undefined),
          wantNews ? fetchNewsSignalsForSymbol(s.symbol, s.companyName) : Promise.resolve(undefined),
          wantAnalyst ? fetchAnalystConsensusForSymbol(s.symbol, s.price) : Promise.resolve(undefined),
        ]);
        // `undefined` = skipped (not fetched), preserve prior cache.
        // `null`      = attempted but failed/empty, overwrite.
        out[s.symbol] = {
          _sources: { news: wantNews, bse: wantBse, analyst: wantAnalyst },
          ...(bse !== undefined     ? { bseEvents: bse }             : {}),
          ...(news !== undefined    ? { newsNegative: news }         : {}),
          ...(analyst !== undefined ? { analystConsensus: analyst }  : {}),
          asOf: new Date().toISOString(),
        };
      } catch (e) {
        out[s.symbol] = { asOf: new Date().toISOString(), error: String(e.message || e) };
      }
    }
  }
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return out;
}

module.exports = {
  fetchBSEEventsForSymbol,
  fetchNewsSignalsForSymbol,
  fetchAnalystConsensusForSymbol,
  refreshExternalSignals,
  _internal: {
    NEGATIVE_KEYWORDS,
    _classifyBSEEvent,
    safeHttpGet,
  },
};
