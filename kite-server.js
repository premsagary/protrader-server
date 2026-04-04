/**
 * ProTrader Pro — Kite Connect Backend Server
 * =============================================
 * Handles: Real NSE market data, Order placement, SMS alerts
 *
 * SETUP INSTRUCTIONS:
 * 1. npm install express kite-connect twilio cors ws dotenv
 * 2. Create a .env file with your credentials (see below)
 * 3. node kite-server.js
 * 4. Open http://localhost:3001 in your ProTrader app
 *
 * .env file contents:
 * -------------------
 * KITE_API_KEY=your_api_key_here
 * KITE_API_SECRET=your_api_secret_here
 * KITE_ACCESS_TOKEN=your_daily_access_token
 * TWILIO_ACCOUNT_SID=your_twilio_sid
 * TWILIO_AUTH_TOKEN=your_twilio_token
 * TWILIO_FROM_NUMBER=+1234567890
 * ALERT_PHONE=+919876543210
 * PORT=3001
 */

require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const KiteConnect= require("kiteconnect").KiteConnect;
const WebSocket  = require("ws");
const twilio     = require("twilio");
const http       = require("http");

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// ── Kite Connect setup ────────────────────────────────────────────────────────
const kite = new KiteConnect({ api_key: process.env.KITE_API_KEY });
kite.setAccessToken(process.env.KITE_ACCESS_TOKEN);

// ── Twilio SMS setup ──────────────────────────────────────────────────────────
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function sendSMS(message) {
  try {
    await twilioClient.messages.create({
      body:  `[ProTrader] ${message}`,
      from:  process.env.TWILIO_FROM_NUMBER,
      to:    process.env.ALERT_PHONE,
    });
    console.log("SMS sent:", message);
  } catch (e) {
    console.error("SMS failed:", e.message);
  }
}

// ── In-memory state ───────────────────────────────────────────────────────────
const livePrices = {};   // sym -> latest price
const subscribers= new Set(); // WebSocket clients

// ── Broadcast to all WebSocket clients ───────────────────────────────────────
function broadcast(data) {
  const msg = JSON.stringify(data);
  subscribers.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

// ── WebSocket connections ─────────────────────────────────────────────────────
wss.on("connection", (ws) => {
  subscribers.add(ws);
  console.log("Client connected. Total:", subscribers.size);

  // Send current prices immediately on connect
  ws.send(JSON.stringify({ type: "snapshot", prices: livePrices }));

  ws.on("close", () => {
    subscribers.delete(ws);
    console.log("Client disconnected. Total:", subscribers.size);
  });
});

// ── NIFTY 50 instrument tokens (NSE) ─────────────────────────────────────────
// These are the real Kite instrument tokens for NSE equities.
// You can get the full list from: kite.getInstruments("NSE")
const INSTRUMENTS = {
  "RELIANCE":   738561,
  "TCS":        2953217,
  "HDFCBANK":   341249,
  "ICICIBANK":  1270529,
  "INFY":       408065,
  "HINDUNILVR": 356865,
  "ITC":        424961,
  "SBIN":       779521,
  "BHARTIARTL": 2714625,
  "BAJFINANCE": 4267265,
  "KOTAKBANK":  492033,
  "LT":         2939649,
  "HCLTECH":    1850625,
  "WIPRO":      969473,
  "AXISBANK":   1510401,
  "MARUTI":     2815745,
  "SUNPHARMA":  857857,
  "TITAN":      897537,
  "TATAMOTORS": 884737,
  "ADANIENT":   6401,
  "NTPC":       2977281,
  "ONGC":       633601,
  "POWERGRID":  3834113,
  "TATASTEEL":  895745,
  "HINDALCO":   348929,
  "JSWSTEEL":   3001089,
  "TECHM":      3465729,
  "M&M":        519937,
  "EICHERMOT":  232961,
  "DRREDDY":    225537,
  "CIPLA":      177665,
  "APOLLOHOSP": 157001,
  "DIVISLAB":   2800641,
  "ASIANPAINT": 60417,
  "NESTLEIND":  4598529,
  "BRITANNIA":  140033,
  "TATACONSUM": 878593,
  "COALINDIA":  5215745,
  "HEROMOTOCO": 345089,
  "BPCL":       134657,
  "INDUSINDBK": 1346049,
  "BAJAJFINSV": 4268801,
  "UPL":        2889473,
  "ADANIPORTS": 3861249,
  "ZOMATO":     5215745,
};

// ── Kite Ticker (real-time WebSocket from NSE) ────────────────────────────────
const { KiteTicker } = require("kiteconnect");
const ticker = new KiteTicker({
  api_key:      process.env.KITE_API_KEY,
  access_token: process.env.KITE_ACCESS_TOKEN,
});

ticker.connect();

ticker.on("connect", () => {
  console.log("✅ Kite Ticker connected to NSE");
  const tokens = Object.values(INSTRUMENTS);
  ticker.subscribe(tokens);
  ticker.setMode(ticker.modeFull, tokens);
});

ticker.on("ticks", (ticks) => {
  ticks.forEach(tick => {
    const sym = Object.keys(INSTRUMENTS).find(k => INSTRUMENTS[k] === tick.instrument_token);
    if (!sym) return;
    livePrices[sym] = {
      price:     tick.last_price,
      open:      tick.ohlc?.open,
      high:      tick.ohlc?.high,
      low:       tick.ohlc?.low,
      close:     tick.ohlc?.close,
      volume:    tick.volume_traded,
      change:    tick.change,
      bid:       tick.depth?.buy?.[0]?.price,
      ask:       tick.depth?.sell?.[0]?.price,
      timestamp: tick.timestamp,
    };
  });
  broadcast({ type: "tick", prices: livePrices });
});

ticker.on("error", (err) => console.error("Ticker error:", err));
ticker.on("close", ()   => console.log("Ticker disconnected"));
ticker.on("reconnect", (retries, delay) => console.log(`Reconnecting... attempt ${retries} in ${delay}s`));

// ── REST API ENDPOINTS ────────────────────────────────────────────────────────

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", connected: ticker.connected(), prices: Object.keys(livePrices).length });
});

// Get live prices snapshot
app.get("/prices", (req, res) => {
  res.json(livePrices);
});

// Get quote for specific symbol
app.get("/quote/:symbol", async (req, res) => {
  try {
    const quote = await kite.getQuote([`NSE:${req.params.symbol}`]);
    res.json(quote);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get historical OHLC data
app.get("/history/:symbol", async (req, res) => {
  try {
    const { interval = "5minute", from, to } = req.query;
    const now   = new Date();
    const fromDate = from || new Date(now - 7*24*60*60*1000).toISOString().split("T")[0];
    const toDate   = to   || now.toISOString().split("T")[0];
    const token = INSTRUMENTS[req.params.symbol];
    if (!token) return res.status(404).json({ error: "Symbol not found" });
    const data = await kite.getHistoricalData(token, interval, fromDate, toDate);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Place BUY order
app.post("/order/buy", async (req, res) => {
  try {
    const { symbol, quantity, orderType = "MARKET", price = 0 } = req.body;
    if (!symbol || !quantity) return res.status(400).json({ error: "symbol and quantity required" });

    // Validate market hours (9:15 AM to 3:30 PM IST)
    const now  = new Date();
    const ist  = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const hour = ist.getHours(), min = ist.getMinutes();
    const isMarketOpen = (hour > 9 || (hour === 9 && min >= 15)) && (hour < 15 || (hour === 15 && min <= 30));
    if (!isMarketOpen) return res.status(400).json({ error: "Market is closed. NSE hours: 9:15–15:30 IST" });

    const orderId = await kite.placeOrder("regular", {
      exchange:         "NSE",
      tradingsymbol:    symbol,
      transaction_type: "BUY",
      quantity:         parseInt(quantity),
      order_type:       orderType,
      product:          "MIS",   // MIS = intraday, CNC = delivery
      price:            orderType === "LIMIT" ? parseFloat(price) : 0,
      validity:         "DAY",
      tag:              "ProTrader",
    });

    const msg = `▲ BUY ${quantity}x ${symbol} | Order ID: ${orderId}`;
    await sendSMS(msg);
    console.log(msg);
    res.json({ success: true, orderId, message: msg });
  } catch (e) {
    console.error("Order error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Place SELL order
app.post("/order/sell", async (req, res) => {
  try {
    const { symbol, quantity, orderType = "MARKET", price = 0 } = req.body;

    const orderId = await kite.placeOrder("regular", {
      exchange:         "NSE",
      tradingsymbol:    symbol,
      transaction_type: "SELL",
      quantity:         parseInt(quantity),
      order_type:       orderType,
      product:          "MIS",
      price:            orderType === "LIMIT" ? parseFloat(price) : 0,
      validity:         "DAY",
      tag:              "ProTrader",
    });

    const msg = `▼ SELL ${quantity}x ${symbol} | Order ID: ${orderId}`;
    await sendSMS(msg);
    console.log(msg);
    res.json({ success: true, orderId, message: msg });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Place bracket/cover order with SL and target
app.post("/order/bracket", async (req, res) => {
  try {
    const { symbol, quantity, entryPrice, slPrice, targetPrice } = req.body;
    const slPoints     = Math.abs(entryPrice - slPrice);
    const targetPoints = Math.abs(targetPrice - entryPrice);

    const orderId = await kite.placeOrder("bo", {
      exchange:           "NSE",
      tradingsymbol:      symbol,
      transaction_type:   "BUY",
      quantity:           parseInt(quantity),
      order_type:         "MARKET",
      product:            "MIS",
      validity:           "DAY",
      stoploss:           slPoints.toFixed(2),
      squareoff:          targetPoints.toFixed(2),
      trailing_stoploss:  0,
      tag:                "ProTrader-BO",
    });

    const msg = `⚡ BRACKET ${quantity}x ${symbol} | SL:₹${slPrice} TGT:₹${targetPrice}`;
    await sendSMS(msg);
    res.json({ success: true, orderId, message: msg });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Cancel order
app.delete("/order/:orderId", async (req, res) => {
  try {
    await kite.cancelOrder("regular", req.params.orderId);
    res.json({ success: true, message: `Order ${req.params.orderId} cancelled` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get all orders for today
app.get("/orders", async (req, res) => {
  try {
    const orders = await kite.getOrders();
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get positions
app.get("/positions", async (req, res) => {
  try {
    const positions = await kite.getPositions();
    res.json(positions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get portfolio (holdings)
app.get("/holdings", async (req, res) => {
  try {
    const holdings = await kite.getHoldings();
    res.json(holdings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get margin / funds
app.get("/margin", async (req, res) => {
  try {
    const margin = await kite.getMargins();
    res.json(margin);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Send custom SMS alert
app.post("/alert/sms", async (req, res) => {
  try {
    const { message } = req.body;
    await sendSMS(message);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Kite OAuth login flow (for getting fresh access token daily)
app.get("/auth/login", (req, res) => {
  const loginUrl = kite.getLoginURL();
  res.redirect(loginUrl);
});

app.get("/auth/callback", async (req, res) => {
  try {
    const { request_token } = req.query;
    const session = await kite.generateSession(request_token, process.env.KITE_API_SECRET);
    kite.setAccessToken(session.access_token);
    console.log("✅ New access token:", session.access_token);
    res.json({ 
      success: true, 
      access_token: session.access_token,
      message: "Copy this token into your .env file as KITE_ACCESS_TOKEN and restart the server"
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log("\n========================================");
  console.log("  ProTrader Pro — Kite Backend Server");
  console.log("========================================");
  console.log(`  REST API:  http://localhost:${PORT}`);
  console.log(`  WebSocket: ws://localhost:${PORT}`);
  console.log(`  Auth:      http://localhost:${PORT}/auth/login`);
  console.log("========================================");
  console.log("\n📋 API Endpoints:");
  console.log("  GET  /health         — Server status");
  console.log("  GET  /prices         — All live prices");
  console.log("  GET  /quote/:symbol  — Quote for symbol");
  console.log("  GET  /history/:symbol?interval=5minute");
  console.log("  POST /order/buy      — Place buy order");
  console.log("  POST /order/sell     — Place sell order");
  console.log("  POST /order/bracket  — Bracket order with SL+TGT");
  console.log("  GET  /orders         — Today's orders");
  console.log("  GET  /positions      — Open positions");
  console.log("  GET  /holdings       — Portfolio");
  console.log("  GET  /margin         — Available funds");
  console.log("  POST /alert/sms      — Send SMS alert");
  console.log("\n⚠️  Daily: Visit http://localhost:3001/auth/login to get fresh access token");
  console.log("========================================\n");
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on("SIGINT", async () => {
  console.log("\n⚠️  Shutting down — squaring off all intraday positions...");
  try {
    const positions = await kite.getPositions();
    const intraday  = positions.net.filter(p => p.product === "MIS" && p.quantity !== 0);
    for (const pos of intraday) {
      await kite.placeOrder("regular", {
        exchange:         "NSE",
        tradingsymbol:    pos.tradingsymbol,
        transaction_type: pos.quantity > 0 ? "SELL" : "BUY",
        quantity:         Math.abs(pos.quantity),
        order_type:       "MARKET",
        product:          "MIS",
        validity:         "DAY",
        tag:              "ProTrader-EOD",
      });
      console.log(`Squared off: ${pos.tradingsymbol}`);
    }
    await sendSMS(`ProTrader shutdown. Squared off ${intraday.length} positions.`);
  } catch (e) {
    console.error("Squareoff error:", e.message);
  }
  server.close(() => process.exit(0));
});
