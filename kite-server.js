/**

- ProTrader — Kite Connect Backend v2
- =====================================
- - Fetches real 5-min candles from Kite every 5 minutes
- - Runs EMA + RSI + BB strategy on real NSE data
- - Saves paper trades to PostgreSQL permanently
- - Live WebSocket price feed
- - TradingView-ready REST API
- 
- Railway env variables needed:
- KITE_API_KEY, KITE_API_SECRET, KITE_ACCESS_TOKEN
- DATABASE_URL  (auto-set by Railway PostgreSQL addon)
  */

require(“dotenv”).config();
const express    = require(“express”);
const cors       = require(“cors”);
const http       = require(“http”);
const WebSocket  = require(“ws”);
const cron       = require(“node-cron”);
const { Pool }   = require(“pg”);

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// ── PostgreSQL ────────────────────────────────────────────────────────────────
const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: process.env.DATABASE_URL?.includes(“railway”) ? { rejectUnauthorized: false } : false,
});

async function initDB() {
try {
await pool.query(`CREATE TABLE IF NOT EXISTS paper_trades ( id           SERIAL PRIMARY KEY, symbol       VARCHAR(20)    NOT NULL, name         VARCHAR(100), type         VARCHAR(4)     NOT NULL, price        DECIMAL(10,2)  NOT NULL, quantity     INTEGER        NOT NULL, capital      DECIMAL(12,2), entry_time   TIMESTAMP      DEFAULT NOW(), exit_time    TIMESTAMP, exit_price   DECIMAL(10,2), pnl          DECIMAL(10,2), pnl_pct      DECIMAL(8,2), stop_loss    DECIMAL(10,2), target       DECIMAL(10,2), signal_score INTEGER, indicators   TEXT, exit_reason  VARCHAR(50), status       VARCHAR(10)    DEFAULT 'OPEN' )`);
await pool.query(`CREATE TABLE IF NOT EXISTS scan_log ( id         SERIAL PRIMARY KEY, scanned_at TIMESTAMP DEFAULT NOW(), stocks     INTEGER, signals    INTEGER, message    TEXT )`);
console.log(“✅ Database tables ready”);
} catch (e) {
console.error(“❌ DB init failed:”, e.message);
}
}

// ── Kite Setup ────────────────────────────────────────────────────────────────
let kite = null;

function initKite(token) {
const { KiteConnect } = require(“kiteconnect”);
kite = new KiteConnect({ api_key: process.env.KITE_API_KEY });
if (token) kite.setAccessToken(token);
return kite;
}

// ── Live Ticker ───────────────────────────────────────────────────────────────
const livePrices  = {};
const subscribers = new Set();
let   tickerOn    = false;

function broadcast(data) {
const msg = JSON.stringify(data);
subscribers.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(msg); });
}

wss.on(“connection”, ws => {
subscribers.add(ws);
ws.send(JSON.stringify({ type: “snapshot”, prices: livePrices, connected: tickerOn }));
ws.on(“close”, () => subscribers.delete(ws));
});

function startTicker(token) {
const { KiteTicker } = require(“kiteconnect”);
const t = new KiteTicker({ api_key: process.env.KITE_API_KEY, access_token: token });
t.connect();
t.on(“connect”, () => {
tickerOn = true;
const tokens = Object.values(INSTRUMENTS);
t.subscribe(tokens);
t.setMode(t.modeFull, tokens);
broadcast({ type: “status”, connected: true });
console.log(“✅ Ticker connected — streaming Nifty 50”);
});
t.on(“ticks”, ticks => {
ticks.forEach(tick => {
const sym = Object.keys(INSTRUMENTS).find(k => INSTRUMENTS[k] === tick.instrument_token);
if (!sym) return;
livePrices[sym] = {
price: tick.last_price, open: tick.ohlc?.open,
high: tick.ohlc?.high, low: tick.ohlc?.low,
volume: tick.volume_traded, change: tick.change,
};
});
broadcast({ type: “tick”, prices: livePrices });
});
t.on(“error”,     () => console.log(“Ticker error”));
t.on(“close”,     () => { tickerOn = false; broadcast({ type: “status”, connected: false }); });
t.on(“reconnect”, n  => console.log(`Ticker reconnecting... attempt ${n}`));
}

// ── Nifty 50 Universe ─────────────────────────────────────────────────────────
const UNIVERSE = [
{sym:“RELIANCE”,  n:“Reliance Industries”,    base:2847},
{sym:“TCS”,       n:“Tata Consultancy Svcs”,  base:3921},
{sym:“HDFCBANK”,  n:“HDFC Bank”,              base:1683},
{sym:“ICICIBANK”, n:“ICICI Bank”,             base:1242},
{sym:“INFY”,      n:“Infosys”,                base:1887},
{sym:“HINDUNILVR”,n:“Hindustan Unilever”,     base:2342},
{sym:“ITC”,       n:“ITC Ltd”,                base:472},
{sym:“SBIN”,      n:“State Bank of India”,    base:812},
{sym:“BHARTIARTL”,n:“Bharti Airtel”,          base:1823},
{sym:“BAJFINANCE”,n:“Bajaj Finance”,          base:7105},
{sym:“KOTAKBANK”, n:“Kotak Mahindra Bank”,    base:1892},
{sym:“LT”,        n:“Larsen & Toubro”,        base:3812},
{sym:“HCLTECH”,   n:“HCL Technologies”,       base:1642},
{sym:“WIPRO”,     n:“Wipro Ltd”,              base:558},
{sym:“AXISBANK”,  n:“Axis Bank”,              base:1124},
{sym:“MARUTI”,    n:“Maruti Suzuki”,          base:12540},
{sym:“SUNPHARMA”, n:“Sun Pharma”,             base:1782},
{sym:“TITAN”,     n:“Titan Company”,          base:3542},
{sym:“TATAMOTORS”,n:“Tata Motors”,            base:1018},
{sym:“ADANIENT”,  n:“Adani Enterprises”,      base:2648},
{sym:“NTPC”,      n:“NTPC Ltd”,               base:382},
{sym:“ONGC”,      n:“ONGC”,                   base:287},
{sym:“TATASTEEL”, n:“Tata Steel”,             base:168},
{sym:“HINDALCO”,  n:“Hindalco Industries”,    base:687},
{sym:“JSWSTEEL”,  n:“JSW Steel”,              base:978},
{sym:“TECHM”,     n:“Tech Mahindra”,          base:1682},
{sym:“DRREDDY”,   n:“Dr Reddy’s Labs”,        base:5842},
{sym:“CIPLA”,     n:“Cipla Ltd”,              base:1542},
{sym:“ASIANPAINT”,n:“Asian Paints”,           base:2342},
{sym:“NESTLEIND”, n:“Nestlé India”,           base:2287},
];

const INSTRUMENTS = {
“RELIANCE”:738561,“TCS”:2953217,“HDFCBANK”:341249,“ICICIBANK”:1270529,
“INFY”:408065,“HINDUNILVR”:356865,“ITC”:424961,“SBIN”:779521,
“BHARTIARTL”:2714625,“BAJFINANCE”:4267265,“KOTAKBANK”:492033,“LT”:2939649,
“HCLTECH”:1850625,“WIPRO”:969473,“AXISBANK”:1510401,“MARUTI”:2815745,
“SUNPHARMA”:857857,“TITAN”:897537,“TATAMOTORS”:884737,“ADANIENT”:6401,
“NTPC”:2977281,“ONGC”:633601,“TATASTEEL”:895745,“HINDALCO”:348929,
“JSWSTEEL”:3001089,“TECHM”:3465729,“DRREDDY”:225537,“CIPLA”:177665,
“ASIANPAINT”:60417,“NESTLEIND”:4598529,
};

// ── Strategy Math ─────────────────────────────────────────────────────────────
function calcEMA(p, n) {
const k = 2 / (n + 1); let e = p[0];
return p.map((v, i) => i ? (e = v * k + e * (1 - k)) : v);
}

function calcRSI(p, n = 14) {
if (p.length < n + 1) return p.map(() => 50);
const out = []; let ag = 0, al = 0;
for (let i = 1; i <= n; i++) { const d = p[i] - p[i-1]; d > 0 ? ag += d : al -= d; }
ag /= n; al /= n;
for (let i = 0; i < p.length; i++) {
if (i < n) { out.push(50); continue; }
if (i === n) { out.push(+(100 - 100 / (1 + ag / (al || .001))).toFixed(2)); continue; }
const d = p[i] - p[i-1];
ag = (ag * (n-1) + Math.max(d, 0)) / n;
al = (al * (n-1) + Math.max(-d, 0)) / n;
out.push(+(100 - 100 / (1 + ag / (al || .001))).toFixed(2));
}
return out;
}

function calcBB(p, n = 20) {
return p.map((_, i) => {
const s   = p.slice(Math.max(0, i - n + 1), i + 1);
const mid = s.reduce((a, b) => a + b, 0) / s.length;
const std = Math.sqrt(s.reduce((a, b) => a + (b - mid) ** 2, 0) / s.length);
return { mid, up: mid + 2 * std, lo: mid - 2 * std };
});
}

function scoreStock(closes) {
if (closes.length < 30) return { total: 0, bd: {} };
const n = closes.length - 1;
const e9 = calcEMA(closes, 9), e21 = calcEMA(closes, 21), e50 = calcEMA(closes, 50);
const r   = calcRSI(closes, 14);
const bbs = calcBB(closes, 20);
const [le9, le21, le50, pe9, pe21] = [e9[n], e21[n], e50[n], e9[n-1], e21[n-1]];
const [lp, lr, lbb] = [closes[n], r[n], bbs[n]];
const pvwap = closes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, closes.length);
const bd = {}; let total = 0;

// EMA
let ema = le9 > le21 && le21 > le50 ? 2 : le9 > le21 ? 1 : le9 < le21 && le21 < le50 ? -2 : le9 < le21 ? -1 : 0;
if (pe9 <= pe21 && le9 > le21) ema = Math.max(ema, 2);
if (pe9 >= pe21 && le9 < le21) ema = Math.min(ema, -2);
bd.ema = ema; total += ema;

// RSI
const rsiS = lr < 28 ? 2 : lr < 45 ? 1 : lr > 72 ? -2 : lr > 58 ? -1 : 0;
bd.rsi = rsiS; total += rsiS;

// Bollinger
const range = lbb.up - lbb.lo;
if (range > 0) {
const pos = (lp - lbb.lo) / range;
const bbS = pos < .12 ? 2 : pos < .3 ? 1 : pos > .88 ? -2 : pos > .7 ? -1 : 0;
bd.bb = bbS; total += bbS;
}

// VWAP
const vwapS = lp > pvwap * 1.005 ? 1 : lp < pvwap * .995 ? -1 : 0;
bd.vwap = vwapS; total += vwapS;

return { total, bd, rsi: lr, price: lp };
}

// ── Paper Trading Engine ──────────────────────────────────────────────────────
const BUY_THRESHOLD  = 5;
const SELL_THRESHOLD = -4;
const CAPITAL_PER_TRADE = 7500;
const STOP_LOSS_PCT  = 1.5;
const TARGET_PCT     = 3.0;
const MAX_POSITIONS  = 3;

function isMarketOpen() {
const ist = new Date(new Date().toLocaleString(“en-US”, { timeZone: “Asia/Kolkata” }));
const h = ist.getHours(), m = ist.getMinutes();
return (h > 9 || (h === 9 && m >= 15)) && (h < 15 || (h === 15 && m <= 30));
}

async function scanAndTrade() {
if (!process.env.KITE_ACCESS_TOKEN || !kite) { console.log(“No token — skipping scan”); return; }
if (!isMarketOpen()) { console.log(“Market closed — skipping scan”); return; }

console.log(`\n⟳ Scanning ${UNIVERSE.length} stocks at ${new Date().toLocaleTimeString("en-IN")}...`);
let signalCount = 0;

try {
// Get currently open positions (max check)
const { rows: openTrades } = await pool.query(“SELECT * FROM paper_trades WHERE status = ‘OPEN’”);

```
for (const stock of UNIVERSE) {
  try {
    const token = INSTRUMENTS[stock.sym];
    if (!token) continue;

    // Fetch real 5-min candles from Kite
    const today    = new Date().toISOString().split("T")[0];
    const weekAgo  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const candles  = await kite.getHistoricalData(token, "5minute", weekAgo, today);

    if (!candles || candles.length < 30) { await delay(350); continue; }

    const closes    = candles.map(c => c.close);
    const { total, bd, rsi, price: lastPrice } = scoreStock(closes);

    // Update live price cache
    livePrices[stock.sym] = {
      price:  lastPrice,
      open:   candles[candles.length - 1]?.open,
      high:   candles[candles.length - 1]?.high,
      low:    candles[candles.length - 1]?.low,
      volume: candles[candles.length - 1]?.volume,
    };

    // Check if we have an open position for this stock
    const openPos = openTrades.find(t => t.symbol === stock.sym);

    if (openPos) {
      // ── Check exit conditions ──
      const currentPnL   = (lastPrice - openPos.price) * openPos.quantity;
      const hitSL        = lastPrice <= parseFloat(openPos.stop_loss);
      const hitTarget    = lastPrice >= parseFloat(openPos.target);
      const sellSignal   = total <= SELL_THRESHOLD;

      if (hitSL || hitTarget || sellSignal) {
        const pnl    = +((lastPrice - openPos.price) * openPos.quantity).toFixed(2);
        const pnlPct = +((lastPrice - openPos.price) / openPos.price * 100).toFixed(2);
        const reason = hitSL ? "Stop Loss" : hitTarget ? "Target Hit" : "Sell Signal";
        await pool.query(
          `UPDATE paper_trades SET status='CLOSED', exit_price=$1, exit_time=NOW(), pnl=$2, pnl_pct=$3, exit_reason=$4 WHERE id=$5`,
          [lastPrice, pnl, pnlPct, reason, openPos.id]
        );
        console.log(`  ▼ EXIT ${stock.sym} @ ₹${lastPrice} | ${reason} | P&L: ${pnl >= 0 ? "+" : ""}₹${pnl}`);
        signalCount++;
      }

    } else if (openTrades.length < MAX_POSITIONS && total >= BUY_THRESHOLD) {
      // ── Check entry conditions ──
      const qty    = Math.max(1, Math.floor(CAPITAL_PER_TRADE / lastPrice));
      const sl     = +(lastPrice * (1 - STOP_LOSS_PCT / 100)).toFixed(2);
      const target = +(lastPrice * (1 + TARGET_PCT / 100)).toFixed(2);
      const indStr = Object.entries(bd).map(([k, v]) => `${k}:${v >= 0 ? "+" : ""}${v}`).join(" ");

      await pool.query(
        `INSERT INTO paper_trades (symbol, name, type, price, quantity, capital, entry_time, stop_loss, target, signal_score, indicators, status)
         VALUES ($1, $2, 'BUY', $3, $4, $5, NOW(), $6, $7, $8, $9, 'OPEN')`,
        [stock.sym, stock.n, lastPrice, qty, +(qty * lastPrice).toFixed(2), sl, target, total, indStr]
      );
      openTrades.push({ symbol: stock.sym }); // prevent double-entry in same scan
      console.log(`  ▲ BUY  ${stock.sym} @ ₹${lastPrice} | Score: ${total} | ${indStr}`);
      signalCount++;
    }

    // Kite rate limit: max 3 req/sec for historical data
    await delay(400);

  } catch (e) {
    console.error(`  ✗ ${stock.sym}: ${e.message}`);
    await delay(500);
  }
}

// Broadcast updated prices
broadcast({ type: "tick", prices: livePrices });

// Log scan
await pool.query(
  "INSERT INTO scan_log (stocks, signals, message) VALUES ($1, $2, $3)",
  [UNIVERSE.length, signalCount, `Scan complete — ${signalCount} signals`]
);
console.log(`✓ Scan done — ${signalCount} signals\n`);
```

} catch (e) {
console.error(“Scan error:”, e.message);
}
}

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── REST API ──────────────────────────────────────────────────────────────────

app.get(”/”, (req, res) => res.redirect(”/health”));

app.get(”/health”, (req, res) => res.json({
status:    “ok”,
ticker:    tickerOn ? “connected” : “not connected”,
hasToken:  !!process.env.KITE_ACCESS_TOKEN,
marketOpen: isMarketOpen(),
prices:    Object.keys(livePrices).length,
message:   process.env.KITE_ACCESS_TOKEN ? “Live” : “Visit /auth/login”,
}));

app.get(”/prices”, (req, res) => res.json(livePrices));

// ── Paper Trade Endpoints ─────────────────────────────────────────────────────

app.get(”/paper-trades”, async (req, res) => {
try {
const { rows } = await pool.query(
“SELECT * FROM paper_trades ORDER BY entry_time DESC LIMIT 500”
);
res.json(rows);
} catch (e) { res.status(500).json({ error: e.message }); }
});

app.get(”/paper-trades/open”, async (req, res) => {
try {
const { rows } = await pool.query(
“SELECT * FROM paper_trades WHERE status = ‘OPEN’ ORDER BY entry_time DESC”
);
res.json(rows);
} catch (e) { res.status(500).json({ error: e.message }); }
});

app.get(”/paper-trades/stats”, async (req, res) => {
try {
const { rows } = await pool.query(`SELECT COUNT(*)                                                            AS total_trades, COUNT(CASE WHEN status='CLOSED' AND pnl > 0  THEN 1 END)           AS wins, COUNT(CASE WHEN status='CLOSED' AND pnl <= 0 THEN 1 END)           AS losses, COUNT(CASE WHEN status='OPEN' THEN 1 END)                          AS open_trades, COALESCE(SUM(CASE WHEN status='CLOSED' THEN pnl END), 0)           AS total_pnl, COALESCE(AVG(CASE WHEN status='CLOSED' AND pnl > 0  THEN pnl END), 0) AS avg_win, COALESCE(AVG(CASE WHEN status='CLOSED' AND pnl <= 0 THEN pnl END), 0) AS avg_loss, COALESCE(MAX(CASE WHEN status='CLOSED' THEN pnl END), 0)           AS best_trade, COALESCE(MIN(CASE WHEN status='CLOSED' THEN pnl END), 0)           AS worst_trade FROM paper_trades`);
res.json(rows[0]);
} catch (e) { res.status(500).json({ error: e.message }); }
});

app.get(”/paper-trades/daily”, async (req, res) => {
try {
const { rows } = await pool.query(`SELECT DATE(entry_time)            AS date, COUNT(*)                    AS trades, SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) AS wins, COALESCE(SUM(pnl), 0)      AS pnl FROM paper_trades WHERE status = 'CLOSED' GROUP BY DATE(entry_time) ORDER BY date DESC LIMIT 30`);
res.json(rows);
} catch (e) { res.status(500).json({ error: e.message }); }
});

app.get(”/scan-log”, async (req, res) => {
try {
const { rows } = await pool.query(“SELECT * FROM scan_log ORDER BY scanned_at DESC LIMIT 50”);
res.json(rows);
} catch (e) { res.status(500).json({ error: e.message }); }
});

// Manually trigger a scan (for testing)
app.post(”/scan-now”, async (req, res) => {
res.json({ message: “Scan started” });
scanAndTrade();
});

// ── Real Kite Endpoints ───────────────────────────────────────────────────────

app.get(”/orders”,    async (req, res) => { try { res.json(await kite.getOrders()); }    catch(e) { res.status(500).json({error:e.message}); } });
app.get(”/positions”, async (req, res) => { try { res.json(await kite.getPositions()); } catch(e) { res.status(500).json({error:e.message}); } });
app.get(”/holdings”,  async (req, res) => { try { res.json(await kite.getHoldings()); }  catch(e) { res.status(500).json({error:e.message}); } });
app.get(”/margin”,    async (req, res) => { try { res.json(await kite.getMargins()); }   catch(e) { res.status(500).json({error:e.message}); } });

app.get(”/history/:symbol”, async (req, res) => {
try {
const { interval = “5minute” } = req.query;
const token = INSTRUMENTS[req.params.symbol];
if (!token) return res.status(404).json({ error: “Symbol not found” });
const today   = new Date().toISOString().split(“T”)[0];
const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split(“T”)[0];
const data = await kite.getHistoricalData(token, interval, weekAgo, today);
res.json(data);
} catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Auth ──────────────────────────────────────────────────────────────────────

app.get(”/auth/login”, (req, res) => {
initKite(null);
res.redirect(kite.getLoginURL());
});

app.get(”/auth/callback”, async (req, res) => {
try {
initKite(null);
const session = await kite.generateSession(req.query.request_token, process.env.KITE_API_SECRET);
const token   = session.access_token;
process.env.KITE_ACCESS_TOKEN = token;
kite.setAccessToken(token);
startTicker(token);
res.send(`<!DOCTYPE html><html> <body style="background:#060b14;color:#e2e8f0;font-family:monospace;padding:40px;text-align:center"> <h2 style="color:#22c55e">✅ Connected! Paper trading engine is now live.</h2> <p>Your access token:</p> <code style="background:#1e293b;padding:12px 20px;border-radius:8px;display:block;margin:16px auto;max-width:600px;word-break:break-all;color:#38bdf8">${token}</code> <p style="color:#fbbf24">⚠️ Save in Railway → Variables → KITE_ACCESS_TOKEN</p> <p style="color:#64748b">Bot will scan every 5 minutes during market hours (9:15–15:30 IST)</p> <br/><a href="/health" style="color:#0ea5e9">Check status →</a> </body></html>`);
} catch(e) {
res.status(500).send(`<html><body style="background:#060b14;color:#fca5a5;font-family:monospace;padding:40px"> <h2>❌ Auth failed</h2><pre>${e.message}</pre> <a href="/auth/login" style="color:#0ea5e9">Try again</a> </body></html>`);
}
});

// ── Start ─────────────────────────────────────────────────────────────────────

async function start() {
await initDB();
initKite(process.env.KITE_ACCESS_TOKEN || null);

if (process.env.KITE_ACCESS_TOKEN) {
console.log(“✅ Token found — starting ticker and scanner…”);
startTicker(process.env.KITE_ACCESS_TOKEN);
// Run once immediately on startup
setTimeout(scanAndTrade, 5000);
} else {
console.log(“⚠️  No KITE_ACCESS_TOKEN — visit /auth/login”);
}

// Cron: every 5 minutes during market hours
cron.schedule(”*/5 9-15 * * 1-5”, () => {
console.log(“⏰ Cron triggered scan”);
scanAndTrade();
}, { timezone: “Asia/Kolkata” });

// Also run at market open
cron.schedule(“15 9 * * 1-5”, () => {
console.log(“🔔 Market open — starting first scan”);
scanAndTrade();
}, { timezone: “Asia/Kolkata” });

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
console.log(`\n✅ ProTrader v2 running on port ${PORT}`);
console.log(`   /health          — status`);
console.log(`   /auth/login      — connect Kite (daily)`);
console.log(`   /paper-trades    — full trade history`);
console.log(`   /paper-trades/stats — P&L summary`);
console.log(`   /scan-now        — trigger manual scan\n`);
});
}

start();
