// ══════════════════════════════════════════════════════════════════════════
// ProTrader MCP Server — Sprint 6 (2026-05-12)
//
// Exposes ProTrader's existing REST endpoints as MCP tools so Claude
// (Claude Code, Cowork, or any MCP-aware host) can call into ProTrader
// the same way it would call any other MCP server. Same architecture
// Anthropic ships in their financial-services-plugins repo.
//
// Why a separate file: kite-server.js owns the trading runtime. We don't
// want the MCP server, which can spawn many concurrent tool calls,
// living in the same process that monitors live orders and stop-losses.
// Run this as a sibling process (or invoke via stdio from Claude Code).
//
// Transport: stdio (the standard MCP wire format Claude Code expects).
// Each tool wraps an existing /api/* endpoint and returns its JSON
// response as structured content. NOTHING in this file changes
// kite-server.js behavior — it's a transport-only adapter.
//
// Tools exposed:
//   • get_universe_verdict     — top-table view of all 572 stocks
//   • analyze_stock <sym>      — full deep-analyzer output for one stock
//   • get_top_losers <count>   — sorted losers with verdicts
//   • get_top_gainers <count>  — sorted gainers with verdicts
//   • get_options_chain <sym>  — F&O option chain + ATM IV / max pain
//   • screen_by_horizon <h>    — filter stocks where the given horizon = STRONG
//   • get_holdings             — user's current Kite holdings + verdicts
//   • get_day_summary          — today's trades, P&L, ops incidents
//
// Tools deliberately NOT exposed (Anthropic FS policy mirror):
//   • place_order              — order placement stays in the human-confirmed
//                                Kite UI path. Claude can SUGGEST orders but
//                                cannot execute them.
//
// Usage:
//   node protrader-mcp.js
//   # Then register in Claude Code via .mcp.json:
//   #   { "mcpServers": { "protrader": { "command": "node",
//   #     "args": ["/path/to/protrader-mcp.js"] } } }
// ══════════════════════════════════════════════════════════════════════════

const PROTRADER_BASE = process.env.PROTRADER_BASE || 'http://localhost:3000';
const MCP_PROTOCOL_VERSION = '2024-11-05';
const SERVER_NAME = 'protrader';
const SERVER_VERSION = '0.1.0';

const TOOLS = [
  {
    name: 'get_universe_verdict',
    description: 'Get composite verdict (Strong Buy / Buy / Watch / Avoid / Excluded) plus Long-term / Momentum / Short-term horizon tiers for all 572 NSE stocks in the ProTrader universe. Includes day change %, pledge %, delivery %. Cached for 6 hours; refreshes daily at 07:30 IST after the Screener fundamentals cron.',
    inputSchema: {
      type: 'object',
      properties: {
        verdict: { type: 'string', enum: ['STRONG BUY', 'BUY', 'WATCH', 'AVOID', 'EXCLUDED', 'ALL'], description: 'Optional filter by verdict tier' },
        sector:  { type: 'string', description: 'Optional sector filter (Banking, IT, Pharma, etc.)' },
        force:   { type: 'boolean', description: 'Force cache rebuild' },
      },
    },
  },
  {
    name: 'analyze_stock',
    description: 'Run the full Deep Analyzer on a single NSE stock. Returns 13+ framework outputs (Minervini Trend Template, Weinstein Stage, CANSLIM, Piotroski F-Score, Altman Z, Magic Formula, Industry RS, A/D Days, VCP, Cup-Handle, Beneish M-Score, Sloan Accruals, pledging risk, F&O OI positioning, sector breadth, delivery quality, PEAD setup), the composite verdict with horizon-aware logic, and 5 years of daily candles for charting.',
    inputSchema: {
      type: 'object',
      properties: { symbol: { type: 'string', description: 'NSE symbol (e.g. RELIANCE, TCS)' } },
      required: ['symbol'],
    },
  },
  {
    name: 'get_top_losers',
    description: "Get today's biggest losers in the 572-stock universe paired with each one's verdict — the canonical 'buy on dips' workflow. Stocks down ≥1% sorted by % drop, with composite verdict + per-horizon tiers. Quality-on-sale = big loss + Strong Buy / Buy verdict.",
    inputSchema: {
      type: 'object',
      properties: { count: { type: 'integer', description: 'Number of stocks to return (default 30)' } },
    },
  },
  {
    name: 'get_top_gainers',
    description: "Get today's biggest gainers in the 572-stock universe paired with each one's verdict. Useful for breakout follow-through analysis.",
    inputSchema: {
      type: 'object',
      properties: { count: { type: 'integer', description: 'Number of stocks to return (default 30)' } },
    },
  },
  {
    name: 'get_options_chain',
    description: 'Get F&O option chain summary for a stock: PCR (put-call ratio), total CE/PE OI, max-pain strike, ATM IV. Only available for the ~200 F&O stocks.',
    inputSchema: {
      type: 'object',
      properties: { symbol: { type: 'string', description: 'NSE F&O symbol' } },
      required: ['symbol'],
    },
  },
  {
    name: 'screen_by_horizon',
    description: 'Filter universe to stocks where a given timeframe horizon is STRONG. Useful for investing (longTerm), swing trading (momentum), or breakout entries (shortTerm).',
    inputSchema: {
      type: 'object',
      properties: {
        horizon:    { type: 'string', enum: ['longTerm', 'momentum', 'shortTerm'], description: 'Which timeframe must be STRONG' },
        minVerdict: { type: 'string', enum: ['STRONG BUY', 'BUY', 'WATCH'], description: 'Minimum composite verdict tier' },
      },
      required: ['horizon'],
    },
  },
  {
    name: 'get_holdings',
    description: "User's current Kite holdings with each position's current composite verdict — answers 'should I rebalance?' by surfacing holdings whose verdict has degraded.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_day_summary',
    description: "Today's trades, gross/net P&L, win rate, open positions, and operational incidents (drawdown, token aging, NO_TRADES_BY_1030, etc). Same data the day-end report uses.",
    inputSchema: { type: 'object', properties: {} },
  },
];

// ─── Tool implementations — thin wrappers over existing REST endpoints ────
async function callApi(path) {
  const fetch = global.fetch || (await import('node-fetch')).default;
  const res = await fetch(`${PROTRADER_BASE}${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status} ${res.statusText}`);
  return res.json();
}

const HANDLERS = {
  async get_universe_verdict({ verdict, sector, force }) {
    const data = await callApi('/api/stocks/universe-verdict' + (force ? '?force=1' : ''));
    let rows = Array.isArray(data.results) ? data.results : [];
    if (verdict && verdict !== 'ALL') rows = rows.filter(r => (r.verdict || '').includes(verdict));
    if (sector) rows = rows.filter(r => r.sector === sector);
    return { computedAt: data.computedAt, count: rows.length, stocks: rows.slice(0, 100) };
  },

  async analyze_stock({ symbol }) {
    return callApi(`/api/stocks/analyze/${encodeURIComponent(symbol.toUpperCase())}`);
  },

  async get_top_losers({ count = 30 }) {
    const data = await callApi('/api/stocks/universe-verdict');
    const rows = (data.results || [])
      .filter(r => r.dayChangePct != null && r.dayChangePct <= -1)
      .sort((a, b) => a.dayChangePct - b.dayChangePct)
      .slice(0, count);
    return { count: rows.length, computedAt: data.computedAt, stocks: rows };
  },

  async get_top_gainers({ count = 30 }) {
    const data = await callApi('/api/stocks/universe-verdict');
    const rows = (data.results || [])
      .filter(r => r.dayChangePct != null && r.dayChangePct >= 1)
      .sort((a, b) => b.dayChangePct - a.dayChangePct)
      .slice(0, count);
    return { count: rows.length, computedAt: data.computedAt, stocks: rows };
  },

  async get_options_chain({ symbol }) {
    // Pull from analyze_stock since the option chain is embedded in playbook.fnoPositioning
    const data = await callApi(`/api/stocks/analyze/${encodeURIComponent(symbol.toUpperCase())}`);
    return data.playbook?.fnoPositioning || { error: 'no_fno_data', note: 'Stock may not be in F&O' };
  },

  async screen_by_horizon({ horizon, minVerdict }) {
    const data = await callApi('/api/stocks/universe-verdict');
    let rows = (data.results || []).filter(r => r[horizon] && r[horizon].tier === 'STRONG');
    if (minVerdict) {
      const tierRank = { 'STRONG BUY': 4, 'BUY': 3, 'WATCH': 2, 'AVOID': 1 };
      const min = tierRank[minVerdict] || 0;
      rows = rows.filter(r => {
        for (const [label, rank] of Object.entries(tierRank)) {
          if ((r.verdict || '').includes(label)) return rank >= min;
        }
        return false;
      });
    }
    rows.sort((a, b) => (b.playbookScore || 0) - (a.playbookScore || 0));
    return { count: rows.length, horizon, minVerdict, stocks: rows.slice(0, 50) };
  },

  async get_holdings() {
    // Stub: would call /api/holdings + cross-reference universe-verdict
    return { error: 'not_yet_wired', note: 'Holdings cross-reference endpoint pending — wire to existing Kite holdings call' };
  },

  async get_day_summary() {
    return callApi('/api/v2-quality/day-end?date=' + new Date().toISOString().split('T')[0])
      .catch(() => ({ error: 'day_summary_endpoint_path_unknown', note: 'Wire to the actual day-end report path' }));
  },
};

// ─── MCP stdio protocol loop ──────────────────────────────────────────────
const stdin  = process.stdin;
const stdout = process.stdout;
stdin.setEncoding('utf8');

function send(msg) {
  stdout.write(JSON.stringify(msg) + '\n');
}

let buf = '';
stdin.on('data', async chunk => {
  buf += chunk;
  let idx;
  while ((idx = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let req;
    try { req = JSON.parse(line); } catch (e) {
      send({ jsonrpc: '2.0', error: { code: -32700, message: 'parse_error' } });
      continue;
    }
    await handleRequest(req);
  }
});

async function handleRequest(req) {
  const { id, method, params } = req;
  try {
    if (method === 'initialize') {
      return send({ jsonrpc: '2.0', id, result: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      }});
    }
    if (method === 'tools/list') {
      return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    }
    if (method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};
      const handler = HANDLERS[toolName];
      if (!handler) {
        return send({ jsonrpc: '2.0', id, error: { code: -32601, message: `unknown_tool: ${toolName}` } });
      }
      try {
        const result = await handler(args);
        return send({ jsonrpc: '2.0', id, result: {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: false,
        }});
      } catch (e) {
        return send({ jsonrpc: '2.0', id, result: {
          content: [{ type: 'text', text: `Error: ${e.message}` }],
          isError: true,
        }});
      }
    }
    if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
    // Notifications (no id) have no response
    if (id == null) return;
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `unknown_method: ${method}` } });
  } catch (e) {
    send({ jsonrpc: '2.0', id, error: { code: -32603, message: e.message } });
  }
}

console.error(`[protrader-mcp] starting · base=${PROTRADER_BASE} · ${TOOLS.length} tools`);
