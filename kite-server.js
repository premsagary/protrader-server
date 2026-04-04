/**
 * ProTrader Pro — Kite Connect Backend (Fixed)
 * - Starts cleanly without access token
 * - Ticker only connects after /auth/login
 * - REST API always works
 */

require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const http      = require("http");
const WebSocket = require("ws");

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

const livePrices  = {};
const subscribers = new Set();
let tickerActive  = false;
let kite          = null;

const INSTRUMENTS = {
  "RELIANCE":738561,"TCS":2953217,"HDFCBANK":341249,"ICICIBANK":1270529,
  "INFY":408065,"HINDUNILVR":356865,"ITC":424961,"SBIN":779521,
  "BHARTIARTL":2714625,"BAJFINANCE":4267265,"KOTAKBANK":492033,"LT":2939649,
  "HCLTECH":1850625,"WIPRO":969473,"AXISBANK":1510401,"MARUTI":2815745,
  "SUNPHARMA":857857,"TITAN":897537,"TATAMOTORS":884737,"ADANIENT":6401,
  "NTPC":2977281,"ONGC":633601,"POWERGRID":3834113,"TATASTEEL":895745,
  "HINDALCO":348929,"JSWSTEEL":3001089,"TECHM":3465729,"M&M":519937,
  "EICHERMOT":232961,"DRREDDY":225537,"CIPLA":177665,"APOLLOHOSP":157001,
  "DIVISLAB":2800641,"ASIANPAINT":60417,"NESTLEIND":4598529,"BRITANNIA":140033,
  "TATACONSUM":878593,"COALINDIA":5215745,"HEROMOTOCO":345089,"BPCL":134657,
  "INDUSINDBK":1346049,"BAJAJFINSV":4268801,"UPL":2889473,"ADANIPORTS":3861249,
  "ZOMATO":2048193,"HDFCLIFE":119233,"SBILIFE":5582849,
};

function broadcast(data) {
  const msg = JSON.stringify(data);
  subscribers.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(msg); });
}

wss.on("connection", ws => {
  subscribers.add(ws);
  ws.send(JSON.stringify({ type:"snapshot", prices:livePrices, connected:tickerActive }));
  ws.on("close", () => subscribers.delete(ws));
});

function initKite(token) {
  const { KiteConnect } = require("kiteconnect");
  kite = new KiteConnect({ api_key: process.env.KITE_API_KEY });
  if (token) kite.setAccessToken(token);
  return kite;
}

function startTicker(token) {
  if (!token) return;
  const { KiteTicker } = require("kiteconnect");
  const t = new KiteTicker({ api_key: process.env.KITE_API_KEY, access_token: token });
  t.connect();
  t.on("connect", () => {
    console.log("✅ Kite Ticker connected");
    tickerActive = true;
    const tokens = Object.values(INSTRUMENTS);
    t.subscribe(tokens);
    t.setMode(t.modeFull, tokens);
    broadcast({ type:"status", connected:true });
  });
  t.on("ticks", ticks => {
    ticks.forEach(tick => {
      const sym = Object.keys(INSTRUMENTS).find(k => INSTRUMENTS[k] === tick.instrument_token);
      if (!sym) return;
      livePrices[sym] = {
        price: tick.last_price, open: tick.ohlc?.open,
        high: tick.ohlc?.high,  low:  tick.ohlc?.low,
        volume: tick.volume_traded, change: tick.change,
      };
    });
    broadcast({ type:"tick", prices:livePrices });
  });
  t.on("error", () => console.log("Ticker error"));
  t.on("close", () => { tickerActive = false; broadcast({ type:"status", connected:false }); });
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/", (req, res) => res.redirect("/health"));

app.get("/health", (req, res) => res.json({
  status:   "ok",
  ticker:   tickerActive ? "connected" : "not connected",
  prices:   Object.keys(livePrices).length,
  hasToken: !!process.env.KITE_ACCESS_TOKEN,
  message:  process.env.KITE_ACCESS_TOKEN
            ? "Live data active"
            : "No token yet — visit /auth/login every morning",
}));

app.get("/prices",    (req, res) => res.json(livePrices));

app.get("/orders",    async (req, res) => {
  try { res.json(await kite.getOrders()); } catch(e) { res.status(500).json({error:e.message}); }
});
app.get("/positions", async (req, res) => {
  try { res.json(await kite.getPositions()); } catch(e) { res.status(500).json({error:e.message}); }
});
app.get("/holdings",  async (req, res) => {
  try { res.json(await kite.getHoldings()); } catch(e) { res.status(500).json({error:e.message}); }
});
app.get("/margin",    async (req, res) => {
  try { res.json(await kite.getMargins()); } catch(e) { res.status(500).json({error:e.message}); }
});

app.post("/order/buy", async (req, res) => {
  try {
    const { symbol, quantity, orderType="MARKET", price=0 } = req.body;
    const orderId = await kite.placeOrder("regular", {
      exchange:"NSE", tradingsymbol:symbol, transaction_type:"BUY",
      quantity:parseInt(quantity), order_type:orderType, product:"MIS",
      price:orderType==="LIMIT"?parseFloat(price):0, validity:"DAY", tag:"ProTrader",
    });
    res.json({ success:true, orderId });
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post("/order/sell", async (req, res) => {
  try {
    const { symbol, quantity, orderType="MARKET", price=0 } = req.body;
    const orderId = await kite.placeOrder("regular", {
      exchange:"NSE", tradingsymbol:symbol, transaction_type:"SELL",
      quantity:parseInt(quantity), order_type:orderType, product:"MIS",
      price:orderType==="LIMIT"?parseFloat(price):0, validity:"DAY", tag:"ProTrader",
    });
    res.json({ success:true, orderId });
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get("/auth/login", (req, res) => {
  initKite(null);
  res.redirect(kite.getLoginURL());
});

app.get("/auth/callback", async (req, res) => {
  try {
    initKite(null);
    const session = await kite.generateSession(req.query.request_token, process.env.KITE_API_SECRET);
    const token   = session.access_token;
    process.env.KITE_ACCESS_TOKEN = token;
    kite.setAccessToken(token);
    startTicker(token);
    res.send(`<!DOCTYPE html><html>
    <body style="background:#060b14;color:#e2e8f0;font-family:monospace;padding:40px;text-align:center">
      <h2 style="color:#22c55e">✅ Connected to NSE Live Data!</h2>
      <p>Your access token:</p>
      <code style="background:#1e293b;padding:12px 20px;border-radius:8px;display:block;margin:16px auto;max-width:600px;word-break:break-all;color:#38bdf8;font-size:13px">${token}</code>
      <p style="color:#fbbf24;margin-top:20px">⚠️ Save this in Railway → Variables → KITE_ACCESS_TOKEN (so it persists after restart)</p>
      <p style="color:#64748b;margin-top:10px">Token expires at midnight. Do /auth/login again tomorrow morning before 9:15 AM.</p>
      <br/>
      <a href="/health" style="color:#0ea5e9;text-decoration:none;font-size:14px">Check server status →</a>
    </body></html>`);
  } catch(e) {
    res.status(500).send(`<html><body style="background:#060b14;color:#fca5a5;font-family:monospace;padding:40px">
      <h2>❌ Login failed</h2><pre>${e.message}</pre>
      <a href="/auth/login" style="color:#0ea5e9">Try again</a>
    </body></html>`);
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
initKite(process.env.KITE_ACCESS_TOKEN || null);

if (process.env.KITE_ACCESS_TOKEN) {
  console.log("✅ Access token found — starting live ticker...");
  startTicker(process.env.KITE_ACCESS_TOKEN);
} else {
  console.log("⚠️  No KITE_ACCESS_TOKEN yet — server running in REST-only mode");
  console.log("   Visit /auth/login to connect NSE live data");
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n✅ ProTrader server running on port ${PORT}`);
  console.log(`   /health      — status check`);
  console.log(`   /auth/login  — connect NSE (do this every morning)\n`);
});
