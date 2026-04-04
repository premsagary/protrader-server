/**
 * ProTrader — Smart Multi-Strategy Engine v3
 * ============================================
 * Strategies:
 *   1. EMA Crossover      — trending markets
 *   2. RSI Mean Reversion — ranging/oversold markets
 *   3. Bollinger Squeeze  — low volatility breakouts
 *   4. VWAP Momentum      — intraday institutional flow
 *   5. Supertrend         — strong directional moves
 *   6. Opening Range      — first 30min breakout (9:15–9:45)
 *   7. Volume Spike       — unusual volume = smart money
 *
 * Market Regime Detection:
 *   TRENDING   → uses EMA Crossover + Supertrend
 *   RANGING    → uses RSI Mean Reversion + Bollinger
 *   BREAKOUT   → uses Bollinger Squeeze + Volume Spike
 *   MOMENTUM   → uses VWAP Momentum + Opening Range
 */

require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const http      = require("http");
const WebSocket = require("ws");
const cron      = require("node-cron");
const { Pool }  = require("pg");

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });
app.use(cors());
app.use(express.json());

// ── DB ────────────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway") ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS paper_trades (
        id            SERIAL PRIMARY KEY,
        symbol        VARCHAR(20)   NOT NULL,
        name          VARCHAR(100),
        type          VARCHAR(4)    NOT NULL,
        price         DECIMAL(18,8) NOT NULL,
        quantity      DECIMAL(18,8) NOT NULL,
        capital       DECIMAL(12,2),
        entry_time    TIMESTAMP     DEFAULT NOW(),
        exit_time     TIMESTAMP,
        exit_price    DECIMAL(18,8),
        pnl           DECIMAL(10,2),
        pnl_pct       DECIMAL(8,2),
        stop_loss     DECIMAL(18,8),
        target        DECIMAL(18,8),
        signal_score  INTEGER,
        strategy      VARCHAR(50),
        regime        VARCHAR(20),
        indicators    TEXT,
        exit_reason   VARCHAR(50),
        status        VARCHAR(10)   DEFAULT 'OPEN'
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crypto_trades (
        id            SERIAL PRIMARY KEY,
        symbol        VARCHAR(20)   NOT NULL,
        name          VARCHAR(50),
        type          VARCHAR(4)    NOT NULL,
        price         DECIMAL(18,8) NOT NULL,
        quantity      DECIMAL(18,8) NOT NULL,
        capital       DECIMAL(12,2),
        entry_time    TIMESTAMP     DEFAULT NOW(),
        exit_time     TIMESTAMP,
        exit_price    DECIMAL(18,8),
        pnl           DECIMAL(10,2),
        pnl_pct       DECIMAL(8,2),
        stop_loss     DECIMAL(18,8),
        target        DECIMAL(18,8),
        signal_score  INTEGER,
        strategy      VARCHAR(50),
        regime        VARCHAR(20),
        indicators    TEXT,
        exit_reason   VARCHAR(50),
        status        VARCHAR(10)   DEFAULT 'OPEN'
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scan_log (
        id         SERIAL PRIMARY KEY,
        scanned_at TIMESTAMP DEFAULT NOW(),
        stocks     INTEGER,
        signals    INTEGER,
        regime     VARCHAR(20),
        strategy   VARCHAR(50),
        message    TEXT
      )
    `);
    console.log("✅ DB ready");
  } catch(e) { console.error("DB error:", e.message); }
}

// ── Kite ──────────────────────────────────────────────────────────────────────
let kite = null;
function initKite(token) {
  const { KiteConnect } = require("kiteconnect");
  kite = new KiteConnect({ api_key: process.env.KITE_API_KEY });
  if (token) kite.setAccessToken(token);
  return kite;
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
const livePrices  = {};
const subscribers = new Set();
let   tickerOn    = false;
function broadcast(data) {
  const msg = JSON.stringify(data);
  subscribers.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(msg); });
}
wss.on("connection", ws => {
  subscribers.add(ws);
  ws.send(JSON.stringify({ type:"snapshot", prices:livePrices, connected:tickerOn }));
  ws.on("close", () => subscribers.delete(ws));
});
function startTicker(token) {
  const { KiteTicker } = require("kiteconnect");
  const t = new KiteTicker({ api_key: process.env.KITE_API_KEY, access_token: token });
  t.connect();
  t.on("connect", () => {
    tickerOn = true;
    const tokens = Object.values(INSTRUMENTS);
    t.subscribe(tokens); t.setMode(t.modeFull, tokens);
    broadcast({ type:"status", connected:true });
    console.log("✅ Ticker live");
  });
  t.on("ticks", ticks => {
    ticks.forEach(tick => {
      const sym = Object.keys(INSTRUMENTS).find(k => INSTRUMENTS[k] === tick.instrument_token);
      if (!sym) return;
      livePrices[sym] = { price:tick.last_price, open:tick.ohlc?.open, high:tick.ohlc?.high, low:tick.ohlc?.low, volume:tick.volume_traded, change:tick.change };
    });
    broadcast({ type:"tick", prices:livePrices });
  });
  t.on("error", () => console.log("Ticker error"));
  t.on("close", () => { tickerOn = false; broadcast({ type:"status", connected:false }); });
}

// ── Universe — Nifty 50 + Next 50 + Midcap 150 (250 stocks) ──────────────────
const UNIVERSE = [
  // ── NIFTY 50 ──
  {sym:"RELIANCE",   n:"Reliance Industries",       grp:"NIFTY50"},
  {sym:"TCS",        n:"Tata Consultancy Svcs",     grp:"NIFTY50"},
  {sym:"HDFCBANK",   n:"HDFC Bank",                 grp:"NIFTY50"},
  {sym:"ICICIBANK",  n:"ICICI Bank",                grp:"NIFTY50"},
  {sym:"INFY",       n:"Infosys",                   grp:"NIFTY50"},
  {sym:"HINDUNILVR", n:"Hindustan Unilever",        grp:"NIFTY50"},
  {sym:"ITC",        n:"ITC Ltd",                   grp:"NIFTY50"},
  {sym:"SBIN",       n:"State Bank of India",       grp:"NIFTY50"},
  {sym:"BHARTIARTL", n:"Bharti Airtel",             grp:"NIFTY50"},
  {sym:"BAJFINANCE", n:"Bajaj Finance",             grp:"NIFTY50"},
  {sym:"KOTAKBANK",  n:"Kotak Mahindra Bank",       grp:"NIFTY50"},
  {sym:"LT",         n:"Larsen & Toubro",           grp:"NIFTY50"},
  {sym:"HCLTECH",    n:"HCL Technologies",          grp:"NIFTY50"},
  {sym:"WIPRO",      n:"Wipro Ltd",                 grp:"NIFTY50"},
  {sym:"AXISBANK",   n:"Axis Bank",                 grp:"NIFTY50"},
  {sym:"MARUTI",     n:"Maruti Suzuki",             grp:"NIFTY50"},
  {sym:"SUNPHARMA",  n:"Sun Pharmaceutical",        grp:"NIFTY50"},
  {sym:"TITAN",      n:"Titan Company",             grp:"NIFTY50"},
  {sym:"TATAMOTORS", n:"Tata Motors",               grp:"NIFTY50"},
  {sym:"ADANIENT",   n:"Adani Enterprises",         grp:"NIFTY50"},
  {sym:"NTPC",       n:"NTPC Ltd",                  grp:"NIFTY50"},
  {sym:"ONGC",       n:"ONGC",                      grp:"NIFTY50"},
  {sym:"TATASTEEL",  n:"Tata Steel",                grp:"NIFTY50"},
  {sym:"HINDALCO",   n:"Hindalco Industries",       grp:"NIFTY50"},
  {sym:"JSWSTEEL",   n:"JSW Steel",                 grp:"NIFTY50"},
  {sym:"TECHM",      n:"Tech Mahindra",             grp:"NIFTY50"},
  {sym:"DRREDDY",    n:"Dr Reddy's Labs",           grp:"NIFTY50"},
  {sym:"CIPLA",      n:"Cipla Ltd",                 grp:"NIFTY50"},
  {sym:"ASIANPAINT", n:"Asian Paints",              grp:"NIFTY50"},
  {sym:"NESTLEIND",  n:"Nestlé India",              grp:"NIFTY50"},
  {sym:"POWERGRID",  n:"Power Grid Corp",           grp:"NIFTY50"},
  {sym:"BAJAJFINSV", n:"Bajaj Finserv",             grp:"NIFTY50"},
  {sym:"ULTRACEMCO", n:"UltraTech Cement",          grp:"NIFTY50"},
  {sym:"M&M",        n:"Mahindra & Mahindra",       grp:"NIFTY50"},
  {sym:"COALINDIA",  n:"Coal India",                grp:"NIFTY50"},
  {sym:"GRASIM",     n:"Grasim Industries",         grp:"NIFTY50"},
  {sym:"ADANIPORTS", n:"Adani Ports & SEZ",         grp:"NIFTY50"},
  {sym:"HEROMOTOCO", n:"Hero MotoCorp",             grp:"NIFTY50"},
  {sym:"BPCL",       n:"BPCL Ltd",                  grp:"NIFTY50"},
  {sym:"INDUSINDBK", n:"IndusInd Bank",             grp:"NIFTY50"},
  {sym:"SBILIFE",    n:"SBI Life Insurance",        grp:"NIFTY50"},
  {sym:"HDFCLIFE",   n:"HDFC Life Insurance",       grp:"NIFTY50"},
  {sym:"APOLLOHOSP", n:"Apollo Hospitals",          grp:"NIFTY50"},
  {sym:"DIVISLAB",   n:"Divi's Laboratories",       grp:"NIFTY50"},
  {sym:"BRITANNIA",  n:"Britannia Industries",      grp:"NIFTY50"},
  {sym:"EICHERMOT",  n:"Eicher Motors",             grp:"NIFTY50"},
  {sym:"TATACONSUM", n:"Tata Consumer Products",    grp:"NIFTY50"},
  {sym:"SHRIRAMFIN", n:"Shriram Finance",           grp:"NIFTY50"},
  {sym:"ZOMATO",     n:"Zomato Ltd",                grp:"NIFTY50"},
  {sym:"BAJAJ-AUTO", n:"Bajaj Auto",                grp:"NIFTY50"},
  // ── NIFTY NEXT 50 ──
  {sym:"DMART",       n:"Avenue Supermarts",        grp:"NEXT50"},
  {sym:"PIDILITIND",  n:"Pidilite Industries",      grp:"NEXT50"},
  {sym:"SIEMENS",     n:"Siemens Ltd",              grp:"NEXT50"},
  {sym:"HAVELLS",     n:"Havells India",            grp:"NEXT50"},
  {sym:"DABUR",       n:"Dabur India",              grp:"NEXT50"},
  {sym:"MARICO",      n:"Marico Ltd",               grp:"NEXT50"},
  {sym:"GODREJCP",    n:"Godrej Consumer Products", grp:"NEXT50"},
  {sym:"AMBUJACEM",   n:"Ambuja Cements",           grp:"NEXT50"},
  {sym:"ACC",         n:"ACC Ltd",                  grp:"NEXT50"},
  {sym:"BIOCON",      n:"Biocon Ltd",               grp:"NEXT50"},
  {sym:"BERGEPAINT",  n:"Berger Paints",            grp:"NEXT50"},
  {sym:"MUTHOOTFIN",  n:"Muthoot Finance",          grp:"NEXT50"},
  {sym:"CHOLAFIN",    n:"Cholamandalam Finance",    grp:"NEXT50"},
  {sym:"ICICIPRULI",  n:"ICICI Prudential Life",    grp:"NEXT50"},
  {sym:"SBICARD",     n:"SBI Cards",                grp:"NEXT50"},
  {sym:"TORNTPHARM",  n:"Torrent Pharmaceuticals",  grp:"NEXT50"},
  {sym:"LUPIN",       n:"Lupin Ltd",                grp:"NEXT50"},
  {sym:"AUROPHARMA",  n:"Aurobindo Pharma",         grp:"NEXT50"},
  {sym:"BANKBARODA",  n:"Bank of Baroda",           grp:"NEXT50"},
  {sym:"CANBK",       n:"Canara Bank",              grp:"NEXT50"},
  {sym:"PNB",         n:"Punjab National Bank",     grp:"NEXT50"},
  {sym:"UNIONBANK",   n:"Union Bank of India",      grp:"NEXT50"},
  {sym:"ICICIGI",     n:"ICICI Lombard General",    grp:"NEXT50"},
  {sym:"NAUKRI",      n:"Info Edge (Naukri)",       grp:"NEXT50"},
  {sym:"PERSISTENT",  n:"Persistent Systems",       grp:"NEXT50"},
  {sym:"COFORGE",     n:"Coforge Ltd",              grp:"NEXT50"},
  {sym:"MPHASIS",     n:"Mphasis Ltd",              grp:"NEXT50"},
  {sym:"TATAPOWER",   n:"Tata Power",               grp:"NEXT50"},
  {sym:"ADANIGREEN",  n:"Adani Green Energy",       grp:"NEXT50"},
  {sym:"ADANITRANS",  n:"Adani Transmission",       grp:"NEXT50"},
  {sym:"VEDL",        n:"Vedanta Ltd",              grp:"NEXT50"},
  {sym:"NMDC",        n:"NMDC Ltd",                 grp:"NEXT50"},
  {sym:"SAIL",        n:"Steel Authority of India", grp:"NEXT50"},
  {sym:"HINDPETRO",   n:"Hindustan Petroleum",      grp:"NEXT50"},
  {sym:"IOC",         n:"Indian Oil Corp",          grp:"NEXT50"},
  {sym:"GAIL",        n:"GAIL India",               grp:"NEXT50"},
  {sym:"RECLTD",      n:"REC Ltd",                  grp:"NEXT50"},
  {sym:"PFC",         n:"Power Finance Corp",       grp:"NEXT50"},
  {sym:"IRCTC",       n:"IRCTC Ltd",                grp:"NEXT50"},
  {sym:"CONCOR",      n:"Container Corp of India",  grp:"NEXT50"},
  {sym:"MOTHERSON",   n:"Samvardhana Motherson",    grp:"NEXT50"},
  {sym:"BALKRISIND",  n:"Balkrishna Industries",    grp:"NEXT50"},
  {sym:"MFSL",        n:"Max Financial Services",   grp:"NEXT50"},
  {sym:"INDHOTEL",    n:"Indian Hotels Co",         grp:"NEXT50"},
  {sym:"VOLTAS",      n:"Voltas Ltd",               grp:"NEXT50"},
  {sym:"WHIRLPOOL",   n:"Whirlpool of India",       grp:"NEXT50"},
  {sym:"PAGEIND",     n:"Page Industries",          grp:"NEXT50"},
  {sym:"TRENT",       n:"Trent Ltd",                grp:"NEXT50"},
  {sym:"UNITDSPR",    n:"United Spirits",           grp:"NEXT50"},
  {sym:"JUBLFOOD",    n:"Jubilant Foodworks",       grp:"NEXT50"},

  // ── NIFTY MIDCAP 150 ──
  {sym:"ASTRAL",      n:"Astral Ltd",               grp:"MIDCAP"},
  {sym:"SUPREMEIND",  n:"Supreme Industries",       grp:"MIDCAP"},
  {sym:"ATUL",        n:"Atul Ltd",                 grp:"MIDCAP"},
  {sym:"DEEPAKNTR",   n:"Deepak Nitrite",           grp:"MIDCAP"},
  {sym:"FINEORG",     n:"Fine Organic Industries",  grp:"MIDCAP"},
  {sym:"GALAXYSURF",  n:"Galaxy Surfactants",       grp:"MIDCAP"},
  {sym:"AARTIIND",    n:"Aarti Industries",         grp:"MIDCAP"},
  {sym:"GNFC",        n:"Gujarat Narmada Valley",   grp:"MIDCAP"},
  {sym:"ALKYLAMINE",  n:"Alkyl Amines Chemicals",   grp:"MIDCAP"},
  {sym:"VINATIORGA",  n:"Vinati Organics",          grp:"MIDCAP"},
  {sym:"LAURUSLABS",  n:"Laurus Labs",              grp:"MIDCAP"},
  {sym:"ABBOTINDIA",  n:"Abbott India",             grp:"MIDCAP"},
  {sym:"ALKEM",       n:"Alkem Laboratories",       grp:"MIDCAP"},
  {sym:"IPCALAB",     n:"IPCA Laboratories",        grp:"MIDCAP"},
  {sym:"AJANTPHARM",  n:"Ajanta Pharma",            grp:"MIDCAP"},
  {sym:"NATPHARMA",   n:"Natco Pharma",             grp:"MIDCAP"},
  {sym:"SANOFI",      n:"Sanofi India",             grp:"MIDCAP"},
  {sym:"PFIZER",      n:"Pfizer Ltd",               grp:"MIDCAP"},
  {sym:"GLAXO",       n:"GSK Pharma",               grp:"MIDCAP"},
  {sym:"FORTIS",      n:"Fortis Healthcare",        grp:"MIDCAP"},
  {sym:"MAXHEALTH",   n:"Max Healthcare",           grp:"MIDCAP"},
  {sym:"METROPOLIS",  n:"Metropolis Healthcare",    grp:"MIDCAP"},
  {sym:"THYROCARE",   n:"Thyrocare Technologies",   grp:"MIDCAP"},
  {sym:"KANSAINER",   n:"Kansai Nerolac Paints",    grp:"MIDCAP"},
  {sym:"AKZOINDIA",   n:"Akzo Nobel India",         grp:"MIDCAP"},
  {sym:"SOLARINDS",   n:"Solar Industries",         grp:"MIDCAP"},
  {sym:"KAJARIACER",  n:"Kajaria Ceramics",         grp:"MIDCAP"},
  {sym:"CERA",        n:"Cera Sanitaryware",        grp:"MIDCAP"},
  {sym:"RELAXO",      n:"Relaxo Footwears",         grp:"MIDCAP"},
  {sym:"BATA",        n:"Bata India",               grp:"MIDCAP"},
  {sym:"VMART",       n:"V-Mart Retail",            grp:"MIDCAP"},
  {sym:"MANYAVAR",    n:"Vedant Fashions",          grp:"MIDCAP"},
  {sym:"ABFRL",       n:"Aditya Birla Fashion",     grp:"MIDCAP"},
  {sym:"RAYMOND",     n:"Raymond Ltd",              grp:"MIDCAP"},
  {sym:"ARVIND",      n:"Arvind Ltd",               grp:"MIDCAP"},
  {sym:"WELSPUNIND",  n:"Welspun India",            grp:"MIDCAP"},
  {sym:"TRIDENT",     n:"Trident Ltd",              grp:"MIDCAP"},
  {sym:"KPRMILL",     n:"K.P.R. Mill",              grp:"MIDCAP"},
  {sym:"PAGEIND",     n:"Page Industries",          grp:"MIDCAP"},
  {sym:"IDFCFIRSTB",  n:"IDFC First Bank",          grp:"MIDCAP"},
  {sym:"FEDERALBNK",  n:"Federal Bank",             grp:"MIDCAP"},
  {sym:"KARURVYSYA",  n:"Karur Vysya Bank",         grp:"MIDCAP"},
  {sym:"DCBBANK",     n:"DCB Bank",                 grp:"MIDCAP"},
  {sym:"SOUTHBANK",   n:"South Indian Bank",        grp:"MIDCAP"},
  {sym:"RBLBANK",     n:"RBL Bank",                 grp:"MIDCAP"},
  {sym:"CSBBANK",     n:"CSB Bank",                 grp:"MIDCAP"},
  {sym:"UJJIVANSFB",  n:"Ujjivan Small Finance",    grp:"MIDCAP"},
  {sym:"EQUITASBNK",  n:"Equitas Small Finance",    grp:"MIDCAP"},
  {sym:"SURYODAY",    n:"Suryoday Small Finance",   grp:"MIDCAP"},
  {sym:"FINPIPE",     n:"Finolex Industries",       grp:"MIDCAP"},
  {sym:"APLAPOLLO",   n:"APL Apollo Tubes",         grp:"MIDCAP"},
  {sym:"RATNAMANI",   n:"Ratnamani Metals",         grp:"MIDCAP"},
  {sym:"JINDALSAW",   n:"Jindal Saw",               grp:"MIDCAP"},
  {sym:"WELCORP",     n:"Welspun Corp",             grp:"MIDCAP"},
  {sym:"HSCL",        n:"Himadri Speciality",       grp:"MIDCAP"},
  {sym:"GRAPHITE",    n:"Graphite India",           grp:"MIDCAP"},
  {sym:"HEG",         n:"HEG Ltd",                  grp:"MIDCAP"},
  {sym:"NALCO",       n:"National Aluminium",       grp:"MIDCAP"},
  {sym:"HINDCOPPER",  n:"Hindustan Copper",         grp:"MIDCAP"},
  {sym:"MOIL",        n:"MOIL Ltd",                 grp:"MIDCAP"},
  {sym:"GMRINFRA",    n:"GMR Airports Infra",       grp:"MIDCAP"},
  {sym:"IRB",         n:"IRB Infrastructure",       grp:"MIDCAP"},
  {sym:"SADBHAV",     n:"Sadbhav Engineering",      grp:"MIDCAP"},
  {sym:"KEC",         n:"KEC International",        grp:"MIDCAP"},
  {sym:"KALPATPOWR",  n:"Kalpataru Power",          grp:"MIDCAP"},
  {sym:"CUMMINSIND",  n:"Cummins India",            grp:"MIDCAP"},
  {sym:"THERMAX",     n:"Thermax Ltd",              grp:"MIDCAP"},
  {sym:"BHEL",        n:"Bharat Heavy Electricals", grp:"MIDCAP"},
  {sym:"BEL",         n:"Bharat Electronics",       grp:"MIDCAP"},
  {sym:"HAL",         n:"Hindustan Aeronautics",    grp:"MIDCAP"},
  {sym:"COCHINSHIP",  n:"Cochin Shipyard",          grp:"MIDCAP"},
  {sym:"GRSE",        n:"Garden Reach Shipbuilders",grp:"MIDCAP"},
  {sym:"MAZDOCK",     n:"Mazagon Dock",             grp:"MIDCAP"},
  {sym:"AIAENG",      n:"AIA Engineering",          grp:"MIDCAP"},
  {sym:"ELGIEQUIP",   n:"Elgi Equipments",          grp:"MIDCAP"},
  {sym:"GRINDWELL",   n:"Grindwell Norton",         grp:"MIDCAP"},
  {sym:"SCHAEFFLER",  n:"Schaeffler India",         grp:"MIDCAP"},
  {sym:"SKFINDIA",    n:"SKF India",                grp:"MIDCAP"},
  {sym:"TIMKEN",      n:"Timken India",             grp:"MIDCAP"},
  {sym:"MINDA",       n:"Uno Minda",                grp:"MIDCAP"},
  {sym:"SUNDRMFAST",  n:"Sundram Fasteners",        grp:"MIDCAP"},
  {sym:"BOSCHLTD",    n:"Bosch Ltd",                grp:"MIDCAP"},
  {sym:"EXIDEIND",    n:"Exide Industries",         grp:"MIDCAP"},
  {sym:"AMARAJABAT",  n:"Amara Raja Batteries",     grp:"MIDCAP"},
  {sym:"MRF",         n:"MRF Ltd",                  grp:"MIDCAP"},
  {sym:"APOLLOTYRE",  n:"Apollo Tyres",             grp:"MIDCAP"},
  {sym:"CEATLTD",     n:"CEAT Ltd",                 grp:"MIDCAP"},
  {sym:"JKTYRE",      n:"JK Tyre & Industries",     grp:"MIDCAP"},
  {sym:"ASHOKLEY",    n:"Ashok Leyland",            grp:"MIDCAP"},
  {sym:"SML",         n:"SML Isuzu",                grp:"MIDCAP"},
  {sym:"ESCORTS",     n:"Escorts Kubota",           grp:"MIDCAP"},
  {sym:"VSTTILLERS",  n:"VST Tillers Tractors",     grp:"MIDCAP"},
  {sym:"CROMPTON",    n:"Crompton Greaves",         grp:"MIDCAP"},
  {sym:"ORIENTELEC",  n:"Orient Electric",          grp:"MIDCAP"},
  {sym:"POLYCAB",     n:"Polycab India",            grp:"MIDCAP"},
  {sym:"KEI",         n:"KEI Industries",           grp:"MIDCAP"},
  {sym:"FINOLEX",     n:"Finolex Cables",           grp:"MIDCAP"},
  {sym:"VGUARD",      n:"V-Guard Industries",       grp:"MIDCAP"},
  {sym:"BLUESTARCO",  n:"Blue Star Ltd",            grp:"MIDCAP"},
  {sym:"SYMPHONY",    n:"Symphony Ltd",             grp:"MIDCAP"},
  {sym:"KALYANKJIL",  n:"Kalyan Jewellers",         grp:"MIDCAP"},
  {sym:"TITAN",       n:"Titan Company",            grp:"MIDCAP"},
  {sym:"PCJEWELLER",  n:"PC Jeweller",              grp:"MIDCAP"},
  {sym:"SENCO",       n:"Senco Gold",               grp:"MIDCAP"},
  {sym:"INOXWIND",    n:"Inox Wind",                grp:"MIDCAP"},
  {sym:"SUZLON",      n:"Suzlon Energy",            grp:"MIDCAP"},
  {sym:"CESC",        n:"CESC Ltd",                 grp:"MIDCAP"},
  {sym:"TORNTPOWER",  n:"Torrent Power",            grp:"MIDCAP"},
  {sym:"JSPL",        n:"Jindal Steel & Power",     grp:"MIDCAP"},
  {sym:"NATIONALUM",  n:"National Aluminium",       grp:"MIDCAP"},
  {sym:"NIACL",       n:"New India Assurance",      grp:"MIDCAP"},
  {sym:"GICRE",       n:"General Insurance Corp",   grp:"MIDCAP"},
  {sym:"STARHEALTH",  n:"Star Health Insurance",    grp:"MIDCAP"},
  {sym:"NYKAA",       n:"FSN E-Commerce (Nykaa)",   grp:"MIDCAP"},
  {sym:"CARTRADE",    n:"CarTrade Tech",            grp:"MIDCAP"},
  {sym:"EASEMYTRIP",  n:"Easy Trip Planners",       grp:"MIDCAP"},
  {sym:"IXIGO",       n:"Le Travenues (Ixigo)",     grp:"MIDCAP"},
  {sym:"MAPMYINDIA",  n:"C.E. Info Systems",        grp:"MIDCAP"},
  {sym:"ROUTE",       n:"Route Mobile",             grp:"MIDCAP"},
  {sym:"TANLA",       n:"Tanla Platforms",          grp:"MIDCAP"},
  {sym:"RATEGAIN",    n:"RateGain Travel Tech",     grp:"MIDCAP"},
  {sym:"LATENTVIEW",  n:"LatentView Analytics",     grp:"MIDCAP"},
  {sym:"TATAELXSI",   n:"Tata Elxsi",              grp:"MIDCAP"},
  {sym:"KPITTECH",    n:"KPIT Technologies",        grp:"MIDCAP"},
  {sym:"CYIENT",      n:"Cyient Ltd",               grp:"MIDCAP"},
  {sym:"MASTEK",      n:"Mastek Ltd",               grp:"MIDCAP"},
  {sym:"HAPPSTMNDS",  n:"Happiest Minds",           grp:"MIDCAP"},
  {sym:"NEWGEN",      n:"Newgen Software",          grp:"MIDCAP"},
  {sym:"ZENSAR",      n:"Zensar Technologies",      grp:"MIDCAP"},
  {sym:"LTTS",        n:"L&T Technology Services",  grp:"MIDCAP"},
  {sym:"HEXAWARE",    n:"Hexaware Technologies",    grp:"MIDCAP"},
  {sym:"SONACOMS",    n:"Sona BLW Precision",       grp:"MIDCAP"},
  {sym:"CRAFTSMAN",   n:"Craftsman Automation",     grp:"MIDCAP"},
  {sym:"KIRLOSENG",   n:"Kirloskar Electric",       grp:"MIDCAP"},
  {sym:"HBLPOWER",    n:"HBL Engineering",          grp:"MIDCAP"},
  {sym:"PRAJ",        n:"Praj Industries",          grp:"MIDCAP"},
  {sym:"JYOTICNC",    n:"Jyoti CNC Automation",     grp:"MIDCAP"},
  {sym:"DATAPATTNS",  n:"Data Patterns India",      grp:"MIDCAP"},
  {sym:"IDEAFORGE",   n:"ideaForge Technology",     grp:"MIDCAP"},
  {sym:"PARAS",       n:"Paras Defence",            grp:"MIDCAP"},
  {sym:"MIDHANI",     n:"Mishra Dhatu Nigam",       grp:"MIDCAP"},
  {sym:"MEIL",        n:"Megha Engineering",        grp:"MIDCAP"},
  {sym:"PNBHOUSING",  n:"PNB Housing Finance",      grp:"MIDCAP"},
  {sym:"AAVAS",       n:"Aavas Financiers",         grp:"MIDCAP"},
  {sym:"HOMEFIRST",   n:"Home First Finance",       grp:"MIDCAP"},
  {sym:"APTUS",       n:"Aptus Value Housing",      grp:"MIDCAP"},
  {sym:"CREDITACC",   n:"Credit Access Grameen",    grp:"MIDCAP"},
  {sym:"SPANDANA",    n:"Spandana Sphoorty",        grp:"MIDCAP"},
  {sym:"ARMAN",       n:"Arman Financial Services", grp:"MIDCAP"},
  {sym:"LICI",        n:"Life Insurance Corp",      grp:"MIDCAP"},
  {sym:"ANGELONE",    n:"Angel One Ltd",            grp:"MIDCAP"},
  {sym:"5PAISA",      n:"5paisa Capital",           grp:"MIDCAP"},
  {sym:"CDSL",        n:"CDSL Ltd",                 grp:"MIDCAP"},
  {sym:"BSE",         n:"BSE Ltd",                  grp:"MIDCAP"},
  {sym:"MCX",         n:"MCX India",                grp:"MIDCAP"},
];

const INSTRUMENTS = {
  // Nifty 50
  "RELIANCE":738561,"TCS":2953217,"HDFCBANK":341249,"ICICIBANK":1270529,
  "INFY":408065,"HINDUNILVR":356865,"ITC":424961,"SBIN":779521,
  "BHARTIARTL":2714625,"BAJFINANCE":4267265,"KOTAKBANK":492033,"LT":2939649,
  "HCLTECH":1850625,"WIPRO":969473,"AXISBANK":1510401,"MARUTI":2815745,
  "SUNPHARMA":857857,"TITAN":897537,"TATAMOTORS":884737,"ADANIENT":6401,
  "NTPC":2977281,"ONGC":633601,"TATASTEEL":895745,"HINDALCO":348929,
  "JSWSTEEL":3001089,"TECHM":3465729,"DRREDDY":225537,"CIPLA":177665,
  "ASIANPAINT":60417,"NESTLEIND":4598529,"POWERGRID":3834113,"BAJAJFINSV":4268801,
  "ULTRACEMCO":2952217,"M&M":519937,"COALINDIA":5215745,"GRASIM":315777,
  "ADANIPORTS":3861249,"HEROMOTOCO":345089,"BPCL":134657,"INDUSINDBK":1346049,
  "SBILIFE":5582849,"HDFCLIFE":119233,"APOLLOHOSP":157001,"DIVISLAB":2800641,
  "BRITANNIA":140033,"EICHERMOT":232961,"TATACONSUM":878593,"SHRIRAMFIN":4009537,
  "ZOMATO":2048193,"BAJAJ-AUTO":4268801,
  // Nifty Next 50
  "DMART":4306497,"PIDILITIND":680669,"SIEMENS":784769,"HAVELLS":2513921,
  "DABUR":197633,"MARICO":519425,"GODREJCP":2585409,"AMBUJACEM":1152769,
  "ACC":5492033,"BIOCON":1522177,"BERGEPAINT":107290,"MUTHOOTFIN":1997057,
  "CHOLAFIN":175361,"ICICIPRULI":4010497,"SBICARD":5006849,"TORNTPHARM":900929,
  "LUPIN":2672641,"AUROPHARMA":61441,"BANKBARODA":1195009,"CANBK":2763777,
  "PNB":2730497,"UNIONBANK":2760193,"ICICIGI":3389185,"NAUKRI":3880193,
  "PERSISTENT":3074305,"COFORGE":2955009,"MPHASIS":4641793,"TATAPOWER":877985,
  "ADANIGREEN":2480721,"ADANITRANS":3661009,"VEDL":784977,"NMDC":3526401,
  "SAIL":758529,"HINDPETRO":359937,"IOC":415745,"GAIL":175873,
  "RECLTD":3244289,"PFC":3329793,"IRCTC":3424833,"CONCOR":4029185,
  "MOTHERSON":4285697,"BALKRISIND":85513,"MFSL":3563521,"INDHOTEL":500209,
  "VOLTAS":951809,"PAGEIND":3044737,"TRENT":1964033,"JUBLFOOD":1790529,
  // Midcap (instrument tokens — approximate, verify from Kite instruments API)
  "ASTRAL":2425409,"SUPREMEIND":776961,"DEEPAKNTR":2229761,"LAURUSLABS":4923905,
  "IPCALAB":3737857,"ALKEM":1215745,"TORNTPHARM":900929,"LUPIN":2672641,
  "FEDERALBNK":261889,"IDFCFIRSTB":2863105,"RBLBANK":4708609,"POLYCAB":4000513,
  "KEI":3001345,"HAL":2513537,"BEL":212041,"BHEL":112129,"TATAELXSI":1037057,
  "LTTS":2897793,"KPITTECH":983041,"PERSISTENT":3074305,"ANGELONE":5594497,
  "CDSL":3001089,"MCX":5104513,"BSE":5097217,"LICI":4592641,
  "MRF":225537,"APOLLOTYRE":41729,"CEATLTD":157571,"ASHOKLEY":2920705,
  "ESCORTS":2013185,"MOTHERSON":4285697,"EXIDEIND":232961,"BOSCHLTD":2413697,
  "CROMPTON":3081537,"POLYCAB":4000513,"PRAJ":685569,"SUZLON":3302785,
  "INOXWIND":4592129,"TATAPOWER":877985,"TORNTPOWER":3281409,"CESC":174657,
  "JSPL":3001345,"NYKAA":5065601,"STARHEALTH":3940673,"GICRE":3378433,
  "PNBHOUSING":3984897,"AAVAS":3717377,"CREDITACC":3425281,"HAPPSTMNDS":3825921,
  "MINDAIND":2277377,"SONACOMS":5215233,"SOLARINDS":3240449,"AIAENG":14849,
};



// ═══════════════════════════════════════════════════════════════════════════════
// ── INDICATOR LIBRARY ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function ema(p, n) {
  const k = 2/(n+1); let e = p[0];
  return p.map((v,i) => i ? (e = v*k + e*(1-k)) : v);
}

function rsi(p, n=14) {
  if (p.length < n+1) return p.map(() => 50);
  const out=[]; let ag=0,al=0;
  for (let i=1;i<=n;i++){const d=p[i]-p[i-1];d>0?ag+=d:al-=d;}
  ag/=n;al/=n;
  for (let i=0;i<p.length;i++){
    if(i<n){out.push(50);continue;}
    if(i===n){out.push(+(100-100/(1+ag/(al||.001))).toFixed(2));continue;}
    const d=p[i]-p[i-1];
    ag=(ag*(n-1)+Math.max(d,0))/n; al=(al*(n-1)+Math.max(-d,0))/n;
    out.push(+(100-100/(1+ag/(al||.001))).toFixed(2));
  }
  return out;
}

function bollingerBands(p, n=20, mult=2) {
  return p.map((_,i) => {
    const s = p.slice(Math.max(0,i-n+1),i+1);
    const mid = s.reduce((a,b)=>a+b,0)/s.length;
    const std = Math.sqrt(s.reduce((a,b)=>a+(b-mid)**2,0)/s.length);
    return { mid, up:mid+mult*std, lo:mid-mult*std, bw:(2*mult*std)/mid };
  });
}

function atr(candles, n=14) {
  return candles.map((_,i) => {
    if (i===0) return candles[0].high - candles[0].low;
    const s = candles.slice(Math.max(0,i-n),i+1);
    return s.reduce((a,c,j) => a+(j>0?Math.max(c.high-c.low,Math.abs(c.high-s[j-1].close),Math.abs(c.low-s[j-1].close)):c.high-c.low),0)/s.length;
  });
}

function supertrend(candles, n=10, mult=3) {
  const atrs = atr(candles, n);
  let trend=1, st=candles[0].close;
  return candles.map((c,i) => {
    const ub = (c.high+c.low)/2 + mult*atrs[i];
    const lb = (c.high+c.low)/2 - mult*atrs[i];
    if (c.close > st) { trend=1; st=lb; }
    else              { trend=-1; st=ub; }
    return { trend, line:st };
  });
}

function vwap(candles) {
  let cumPV=0, cumV=0;
  return candles.map(c => {
    const vol = c.volume||1;
    const tp  = (c.high+c.low+c.close)/3;
    cumPV += tp*vol; cumV += vol;
    return cumPV/cumV;
  });
}

function adx(candles, n=14) {
  // Average Directional Index — measures trend strength 0-100
  if (candles.length < n+2) return 25;
  const dms = candles.slice(1).map((c,i) => {
    const prev  = candles[i];
    const upMove   = c.high - prev.high;
    const downMove = prev.low - c.low;
    return {
      pdm: upMove>downMove&&upMove>0?upMove:0,
      ndm: downMove>upMove&&downMove>0?downMove:0,
      tr:  Math.max(c.high-c.low,Math.abs(c.high-prev.close),Math.abs(c.low-prev.close)),
    };
  });
  const last = dms.slice(-n);
  const atrSum = last.reduce((s,d)=>s+d.tr,0);
  const pdi = atrSum>0 ? last.reduce((s,d)=>s+d.pdm,0)/atrSum*100 : 0;
  const ndi = atrSum>0 ? last.reduce((s,d)=>s+d.ndm,0)/atrSum*100 : 0;
  return pdi+ndi>0 ? Math.abs(pdi-ndi)/(pdi+ndi)*100 : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── MARKET REGIME DETECTOR ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function detectRegime(candles) {
  if (candles.length < 30) return { regime:"UNKNOWN", reason:"Not enough data" };

  const closes = candles.map(c => c.close);
  const adxVal = adx(candles, 14);
  const bbs    = bollingerBands(closes, 20);
  const lastBB = bbs[bbs.length-1];
  const vols   = candles.slice(-20).map(c => c.volume||0);
  const avgVol = vols.reduce((a,b)=>a+b,0)/vols.length;
  const lastVol= candles[candles.length-1]?.volume||0;
  const r14    = rsi(closes,14);
  const lastRSI= r14[r14.length-1];

  // Price movement over last 20 candles
  const priceChange = Math.abs(closes[closes.length-1]-closes[closes.length-20])/closes[closes.length-20]*100;

  // Bandwidth squeeze: BB width below 1% = very tight = breakout coming
  const isSqueeze = lastBB.bw < 0.015;
  // High volume spike
  const isVolumeSpike = lastVol > avgVol * 2.5;
  // Strong trend: ADX > 25
  const isTrending = adxVal > 25;
  // Ranging: ADX < 20 and RSI between 35-65
  const isRanging = adxVal < 20 && lastRSI > 35 && lastRSI < 65;
  // Extreme RSI = mean reversion opportunity
  const isExtreme = lastRSI < 28 || lastRSI > 72;

  // Opening range: first 30 minutes (9:15–9:45 IST)
  const ist  = new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
  const h=ist.getHours(), m=ist.getMinutes();
  const isOpeningRange = (h===9&&m>=15) || (h===9&&m<=45);

  let regime, reason, confidence;

  if (isOpeningRange && isVolumeSpike) {
    regime="MOMENTUM"; reason="Opening range + volume spike"; confidence=90;
  } else if (isSqueeze && priceChange > 0.5) {
    regime="BREAKOUT"; reason=`BB squeeze with ${priceChange.toFixed(1)}% move`; confidence=85;
  } else if (isTrending && priceChange > 1) {
    regime="TRENDING"; reason=`ADX ${adxVal.toFixed(0)} — strong trend`; confidence=80;
  } else if (isExtreme) {
    regime="RANGING"; reason=`RSI ${lastRSI.toFixed(0)} — extreme = mean reversion`; confidence=75;
  } else if (isRanging) {
    regime="RANGING"; reason=`ADX ${adxVal.toFixed(0)} — no clear trend`; confidence=65;
  } else if (isVolumeSpike) {
    regime="MOMENTUM"; reason="Unusual volume — smart money moving"; confidence=70;
  } else {
    regime="RANGING"; reason="Low ADX, normal volume"; confidence=50;
  }

  return { regime, reason, confidence, adx:adxVal.toFixed(1), rsi:lastRSI.toFixed(1), bw:(lastBB.bw*100).toFixed(2), volSpike:isVolumeSpike };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── STRATEGY LIBRARY ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// Strategy 1: EMA Crossover — for TRENDING markets
function stratEMACrossover(candles) {
  const closes = candles.map(c=>c.close);
  const e9=ema(closes,9), e21=ema(closes,21), e50=ema(closes,50);
  const n=closes.length-1;
  const [le9,le21,le50,pe9,pe21]=[e9[n],e21[n],e50[n],e9[n-1],e21[n-1]];

  let score=0, detail="";
  // Alignment score
  if(le9>le21&&le21>le50){score+=3;detail+="EMA9>21>50 bullish stack ";}
  else if(le9<le21&&le21<le50){score-=3;detail+="EMA9<21<50 bearish stack ";}
  else if(le9>le21){score+=1;detail+="EMA9>21 ";}
  else{score-=1;detail+="EMA9<21 ";}
  // Fresh crossover
  if(pe9<=pe21&&le9>le21){score+=2;detail+="FRESH BULL CROSS ";}
  if(pe9>=pe21&&le9<le21){score-=2;detail+="FRESH BEAR CROSS ";}

  return { score, signal:score>=3?"BUY":score<=-3?"SELL":"NEUTRAL", detail, strategy:"EMA_CROSSOVER",
           sl:score>=3?closes[n]*0.985:null, tgt:score>=3?closes[n]*1.04:null };
}

// Strategy 2: RSI Mean Reversion — for RANGING markets
function stratRSIMeanReversion(candles) {
  const closes = candles.map(c=>c.close);
  const r=rsi(closes,14), n=closes.length-1;
  const lastRSI=r[n], prevRSI=r[n-1];
  const bbs=bollingerBands(closes,20);
  const lastBB=bbs[n];
  const pricePos=(closes[n]-lastBB.lo)/(lastBB.up-lastBB.lo||1);

  let score=0, detail="";
  // Oversold bounce
  if(lastRSI<25){score+=4;detail+=`RSI ${lastRSI.toFixed(0)} extremely oversold `;}
  else if(lastRSI<32){score+=3;detail+=`RSI ${lastRSI.toFixed(0)} oversold `;}
  else if(lastRSI<40){score+=1;detail+=`RSI ${lastRSI.toFixed(0)} low `;}
  // Overbought
  else if(lastRSI>75){score-=4;detail+=`RSI ${lastRSI.toFixed(0)} extremely overbought `;}
  else if(lastRSI>68){score-=3;detail+=`RSI ${lastRSI.toFixed(0)} overbought `;}
  // RSI turning up from oversold
  if(prevRSI<30&&lastRSI>prevRSI){score+=2;detail+="RSI turning up ";}
  // Near lower BB
  if(pricePos<0.1){score+=2;detail+="Near lower band ";}
  if(pricePos>0.9){score-=2;detail+="Near upper band ";}

  return { score, signal:score>=4?"BUY":score<=-4?"SELL":"NEUTRAL", detail, strategy:"RSI_MEAN_REVERSION",
           sl:score>=4?closes[n]*0.988:null, tgt:score>=4?closes[n]*1.025:null };
}

// Strategy 3: Bollinger Squeeze Breakout — for BREAKOUT regime
function stratBollingerSqueeze(candles) {
  const closes = candles.map(c=>c.close);
  const bbs=bollingerBands(closes,20);
  const n=closes.length-1;
  const curr=bbs[n], prev=bbs[n-1], prev5=bbs[Math.max(0,n-5)];

  // Detect squeeze then expansion
  const wasSqueezed=prev5.bw<0.015;
  const nowExpanding=curr.bw>prev.bw*1.2;
  const breakUp=closes[n]>curr.up;
  const breakDown=closes[n]<curr.lo;

  let score=0, detail="";
  if(wasSqueezed){score+=2;detail+="Prior squeeze ";}
  if(nowExpanding){score+=2;detail+="Bands expanding ";}
  if(breakUp){score+=3;detail+="Price broke upper band ";}
  else if(breakDown){score-=3;detail+="Price broke lower band ";}
  // Price above mid = bullish bias
  if(closes[n]>curr.mid){score+=1;detail+="Above mid ";}
  else{score-=1;detail+="Below mid ";}

  return { score, signal:score>=5?"BUY":score<=-4?"SELL":"NEUTRAL", detail, strategy:"BB_SQUEEZE_BREAKOUT",
           sl:score>=5?closes[n]*0.982:null, tgt:score>=5?closes[n]*1.045:null };
}

// Strategy 4: VWAP Momentum — for MOMENTUM regime
function stratVWAPMomentum(candles) {
  const closes = candles.map(c=>c.close);
  const vwaps=vwap(candles);
  const n=candles.length-1;
  const lastVWAP=vwaps[n], lastClose=closes[n];
  const vols=candles.slice(-10).map(c=>c.volume||0);
  const avgVol10=vols.reduce((a,b)=>a+b,0)/10;
  const lastVol=candles[n].volume||0;
  const volRatio=lastVol/(avgVol10||1);

  // Price vs VWAP
  const pctAbove=(lastClose-lastVWAP)/lastVWAP*100;
  const r=rsi(closes,14), lastRSI=r[n];

  let score=0, detail="";
  if(pctAbove>0.5){score+=3;detail+=`${pctAbove.toFixed(2)}% above VWAP `;}
  else if(pctAbove<-0.5){score-=3;detail+=`${Math.abs(pctAbove).toFixed(2)}% below VWAP `;}
  // Volume confirmation
  if(volRatio>2){score+=3;detail+=`Vol ${volRatio.toFixed(1)}x avg `;}
  else if(volRatio>1.5){score+=2;detail+=`Vol ${volRatio.toFixed(1)}x avg `;}
  // RSI momentum filter
  if(lastRSI>55&&pctAbove>0){score+=1;detail+="RSI confirming ";}
  if(lastRSI<45&&pctAbove<0){score-=1;detail+="RSI confirming down ";}

  return { score, signal:score>=5?"BUY":score<=-4?"SELL":"NEUTRAL", detail, strategy:"VWAP_MOMENTUM",
           sl:score>=5?closes[n]*0.984:null, tgt:score>=5?closes[n]*1.035:null };
}

// Strategy 5: Supertrend — for strong TRENDING markets
function stratSupertrend(candles) {
  const closes=candles.map(c=>c.close);
  const sts=supertrend(candles,10,3);
  const n=candles.length-1;
  const curr=sts[n], prev=sts[n-1];
  const e20=ema(closes,20), lastE20=e20[n];
  const lastClose=closes[n];

  // Fresh trend flip
  const bullFlip=prev.trend===-1&&curr.trend===1;
  const bearFlip=prev.trend===1&&curr.trend===-1;

  let score=0, detail="";
  if(curr.trend===1){score+=3;detail+="Supertrend bullish ";}
  else{score-=3;detail+="Supertrend bearish ";}
  if(bullFlip){score+=3;detail+="FRESH BULL FLIP ";}
  if(bearFlip){score-=3;detail+="FRESH BEAR FLIP ";}
  // Price vs EMA20
  if(lastClose>lastE20){score+=1;detail+="Above EMA20 ";}
  else{score-=1;detail+="Below EMA20 ";}

  return { score, signal:score>=4?"BUY":score<=-4?"SELL":"NEUTRAL", detail, strategy:"SUPERTREND",
           sl:score>=4?curr.line:null, tgt:score>=4?closes[n]*1.04:null };
}

// Strategy 6: Opening Range Breakout — 9:15–9:45 AM only
function stratOpeningRange(candles) {
  // Uses first 6 candles (9:15–9:45 in 5-min bars)
  if (candles.length < 8) return { score:0, signal:"NEUTRAL", detail:"Not enough candles", strategy:"OPENING_RANGE" };
  const first6 = candles.slice(0,6);
  const orHigh = Math.max(...first6.map(c=>c.high));
  const orLow  = Math.min(...first6.map(c=>c.low));
  const lastClose = candles[candles.length-1].close;
  const orSize = (orHigh-orLow)/orLow*100;

  let score=0, detail=`OR: ${orLow.toFixed(0)}–${orHigh.toFixed(0)} `;
  if(orSize<0.5){detail+="(tight OR) ";}
  if(lastClose>orHigh){score+=5;detail+="BROKE ABOVE OR ";}
  else if(lastClose<orLow){score-=5;detail+="BROKE BELOW OR ";}
  else{detail+="inside OR ";}

  return { score, signal:score>=5?"BUY":score<=-5?"SELL":"NEUTRAL", detail, strategy:"OPENING_RANGE",
           sl:score>=5?orLow:null, tgt:score>=5?orHigh+(orHigh-orLow)*1.5:null };
}

// Strategy 7: Volume Spike — smart money detection
function stratVolumeSpike(candles) {
  const closes=candles.map(c=>c.close);
  const vols=candles.map(c=>c.volume||0);
  const n=candles.length-1;
  const avg20=vols.slice(-20).reduce((a,b)=>a+b,0)/20;
  const lastVol=vols[n];
  const ratio=lastVol/(avg20||1);
  const r=rsi(closes,14), lastRSI=r[n];
  const priceChange=(closes[n]-closes[n-1])/closes[n-1]*100;

  let score=0, detail=`Vol ${ratio.toFixed(1)}x avg `;
  if(ratio>3){score+=3;detail+="MASSIVE volume ";}
  else if(ratio>2){score+=2;detail+="High volume ";}
  else if(ratio>1.5){score+=1;detail+="Above avg volume ";}
  // Volume + price direction
  if(priceChange>0.3&&ratio>1.5){score+=3;detail+=`Price up ${priceChange.toFixed(2)}% on volume `;}
  else if(priceChange<-0.3&&ratio>1.5){score-=3;detail+=`Price down ${Math.abs(priceChange).toFixed(2)}% on volume `;}
  // RSI not extreme (avoid buying at top)
  if(score>0&&lastRSI>70){score-=2;detail+="RSI overbought warning ";}
  if(score>0&&lastRSI<50){score+=1;detail+="RSI has room ";}

  return { score, signal:score>=5?"BUY":score<=-4?"SELL":"NEUTRAL", detail, strategy:"VOLUME_SPIKE",
           sl:score>=5?closes[n]*0.986:null, tgt:score>=5?closes[n]*1.03:null };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── STRATEGY SELECTOR (the brain) ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function selectAndRunStrategy(candles) {
  const { regime, reason, confidence } = detectRegime(candles);

  // Map regime to primary + secondary strategies
  const strategyMap = {
    TRENDING:  [stratEMACrossover, stratSupertrend,         stratVWAPMomentum],
    RANGING:   [stratRSIMeanReversion, stratBollingerSqueeze, stratVWAPMomentum],
    BREAKOUT:  [stratBollingerSqueeze, stratVolumeSpike,    stratEMACrossover],
    MOMENTUM:  [stratVWAPMomentum, stratOpeningRange,       stratVolumeSpike],
    UNKNOWN:   [stratEMACrossover, stratRSIMeanReversion,   stratVWAPMomentum],
  };

  const strategies = strategyMap[regime] || strategyMap.UNKNOWN;

  // Run all selected strategies and combine scores
  const results = strategies.map(fn => fn(candles));

  // Weighted combination — primary strategy gets 50%, others 25% each
  const weightedScore =
    results[0].score * 0.50 +
    (results[1]?.score||0) * 0.30 +
    (results[2]?.score||0) * 0.20;

  // Consensus: at least 2 of 3 strategies must agree
  const buyVotes  = results.filter(r => r.signal==="BUY").length;
  const sellVotes = results.filter(r => r.signal==="SELL").length;
  const consensus = buyVotes>=2?"BUY":sellVotes>=2?"SELL":"NEUTRAL";

  const primaryResult = results[0];
  const detail = results.map(r=>`[${r.strategy}: ${r.score>0?"+":""}${r.score.toFixed(1)}]`).join(" ");

  return {
    regime, reason, confidence,
    strategy:     primaryResult.strategy,
    allStrategies:results.map(r=>r.strategy).join("+"),
    score:        +weightedScore.toFixed(2),
    consensus,
    signal:       consensus,
    detail,
    sl:           primaryResult.sl,
    tgt:          primaryResult.tgt,
    buyVotes,
    sellVotes,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── PAPER TRADING ENGINE ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  BUY_SCORE:        2.5,
  SELL_SCORE:      -2.0,
  CONSENSUS_NEEDED: 2,
  CAPITAL_PER_TRADE:7500,
  MAX_POSITIONS:    10,   // increased from 3 to 10
  DEFAULT_SL_PCT:   1.5,
  DEFAULT_TGT_PCT:  3.0,
  SCAN_DELAY_MS:    250,  // faster scan — 250ms between stocks
};

function isMarketOpen() {
  const ist = new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
  const h=ist.getHours(),m=ist.getMinutes();
  return (h>9||(h===9&&m>=15))&&(h<15||(h===15&&m<=30));
}

const delay = ms => new Promise(r=>setTimeout(r,ms));

async function scanAndTrade() {
  if (!process.env.KITE_ACCESS_TOKEN||!kite){console.log("No token");return;}
  if (!isMarketOpen()){console.log("Market closed");return;}

  const scanTime = new Date().toLocaleTimeString("en-IN");
  console.log(`\n⟳ Smart scan at ${scanTime}...`);

  const { rows: openTrades } = await pool.query("SELECT * FROM paper_trades WHERE status='OPEN'");
  let signalCount=0, dominantRegime="UNKNOWN", dominantStrategy="NONE";
  const regimeCounts={};

  for (const stock of UNIVERSE) {
    try {
      const token = validTokens[stock.sym] || INSTRUMENTS[stock.sym];
      if (!token){await delay(200);continue;}

      const today   = new Date().toISOString().split("T")[0];
      const weekAgo = new Date(Date.now()-7*24*60*60*1000).toISOString().split("T")[0];
      const candles = await kite.getHistoricalData(token,"5minute",weekAgo,today);
      if (!candles||candles.length<30){await delay(350);continue;}

      // Update live price cache
      const last = candles[candles.length-1];
      livePrices[stock.sym] = { price:last.close, open:last.open, high:last.high, low:last.low, volume:last.volume };

      // Run smart strategy selection
      const result = selectAndRunStrategy(candles);

      // Track dominant regime across all stocks
      regimeCounts[result.regime]=(regimeCounts[result.regime]||0)+1;

      const openPos = openTrades.find(t=>t.symbol===stock.sym);

      if (openPos) {
        // ── Check exit ──
        const cmp   = last.close;
        const hitSL = cmp <= parseFloat(openPos.stop_loss);
        const hitTgt= cmp >= parseFloat(openPos.target);
        const exitSig= result.signal==="SELL"&&result.buyVotes===0;

        if (hitSL||hitTgt||exitSig) {
          const pnl    = +((cmp-openPos.price)*openPos.quantity).toFixed(2);
          const pnlPct = +((cmp-openPos.price)/openPos.price*100).toFixed(2);
          const reason = hitSL?"Stop Loss":hitTgt?"Target Hit":"Strategy Exit";
          await pool.query(
            `UPDATE paper_trades SET status='CLOSED',exit_price=$1,exit_time=NOW(),pnl=$2,pnl_pct=$3,exit_reason=$4 WHERE id=$5`,
            [cmp,pnl,pnlPct,reason,openPos.id]
          );
          console.log(`  ▼ EXIT ${stock.sym} @ ₹${cmp} | ${reason} | ${pnl>=0?"+":""}₹${pnl} | ${result.regime}`);
          signalCount++;
        }

      } else if (openTrades.filter(t=>t.status==="OPEN").length < CONFIG.MAX_POSITIONS
                 && result.signal==="BUY"
                 && result.buyVotes >= CONFIG.CONSENSUS_NEEDED
                 && result.score >= CONFIG.BUY_SCORE) {

        // ── Check entry ──
        const price  = last.close;
        const qty    = Math.max(1,Math.floor(CONFIG.CAPITAL_PER_TRADE/price));
        const sl     = result.sl || +(price*(1-CONFIG.DEFAULT_SL_PCT/100)).toFixed(2);
        const tgt    = result.tgt|| +(price*(1+CONFIG.DEFAULT_TGT_PCT/100)).toFixed(2);

        await pool.query(
          `INSERT INTO paper_trades (symbol,name,type,price,quantity,capital,entry_time,stop_loss,target,signal_score,strategy,regime,indicators,status)
           VALUES ($1,$2,'BUY',$3,$4,$5,NOW(),$6,$7,$8,$9,$10,$11,'OPEN')`,
          [stock.sym,stock.n,price,qty,+(qty*price).toFixed(2),sl,tgt,
           +(result.score*10).toFixed(0),result.strategy,result.regime,result.detail]
        );
        openTrades.push({symbol:stock.sym,status:"OPEN"});
        dominantStrategy=result.strategy;
        console.log(`  ▲ BUY  ${stock.sym} @ ₹${price} | ${result.regime} | ${result.strategy} | Score:${result.score} | ${result.buyVotes}/3 agree`);
        signalCount++;
      }

      await delay(CONFIG.SCAN_DELAY_MS); // Kite rate limit
    } catch(e) {
      console.error(`  ✗ ${stock.sym}: ${e.message}`);
      await delay(500);
    }
  }

  // Dominant regime across this scan
  dominantRegime = Object.entries(regimeCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||"UNKNOWN";

  broadcast({ type:"tick", prices:livePrices });

  await pool.query(
    "INSERT INTO scan_log (stocks,signals,regime,strategy,message) VALUES ($1,$2,$3,$4,$5)",
    [UNIVERSE.length, signalCount, dominantRegime, dominantStrategy,
     `Market: ${dominantRegime} | ${signalCount} signals | ${Object.entries(regimeCounts).map(([k,v])=>`${k}:${v}`).join(" ")}`]
  );
  console.log(`✓ Scan done | Market regime: ${dominantRegime} | ${signalCount} signals\n`);
}

// ── REST API ──────────────────────────────────────────────────────────────────

const path = require("path");

app.use(express.static(path.join(__dirname,"public")));
app.get("/", (req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

// ── Free News via RSS feeds ───────────────────────────────────────────────────
app.get("/api/news", async(req,res)=>{
  const sym = (req.query.sym||"RELIANCE").toUpperCase();
  const name = req.query.name||sym;

  // Free RSS feeds — no API key needed
  const feeds = [
    {url:"https://economictimes.indiatimes.com/markets/stocks/rss.cms",         source:"Economic Times"},
    {url:"https://www.moneycontrol.com/rss/MCtopnews.xml",                       source:"Moneycontrol"},
    {url:"https://www.business-standard.com/rss/markets-106.rss",               source:"Business Standard"},
    {url:"https://www.livemint.com/rss/markets",                                 source:"Mint"},
    {url:"https://www.nseindia.com/api/cmsContent?url=/Regulations/corporateAction/corporateActionRss",source:"NSE India"},
  ];

  const allItems = [];

  await Promise.allSettled(feeds.map(async({url,source})=>{
    try {
      const r = await fetch(url, {headers:{"User-Agent":"Mozilla/5.0"}});
      if(!r.ok) return;
      const xml = await r.text();
      // Parse RSS items
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      items.forEach(match=>{
        const item = match[1];
        const title   = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]||item.match(/<title>(.*?)<\/title>/)?.[1]||"").trim();
        const link    = (item.match(/<link>(.*?)<\/link>/)?.[1]||"").trim();
        const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]||"").trim();
        const desc    = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1]||item.match(/<description>(.*?)<\/description>/)?.[1]||"").replace(/<[^>]+>/g,"").trim().slice(0,200);

        if(!title) return;

        // Check if relevant to this stock
        const text = (title+" "+desc).toUpperCase();
        const isRelevant = text.includes(sym) || text.includes(name.toUpperCase()) ||
                           ["NIFTY","SENSEX","NSE","BSE","MARKET","STOCK"].some(k=>text.includes(k));
        if(!isRelevant) return;

        // Simple sentiment scoring
        const bull = ["rise","rises","surges","jumps","gains","rallies","up","positive","buy","bullish","growth","profit","strong","record","high","outperform"].some(w=>text.includes(w.toUpperCase()));
        const bear = ["fall","falls","drops","decline","declines","slips","down","negative","sell","bearish","loss","weak","low","underperform","crash","cut"].some(w=>text.includes(w.toUpperCase()));
        const sentiment = bull&&!bear?"bullish":bear&&!bull?"bearish":"neutral";

        // Time ago
        let timeAgo = "recently";
        if(pubDate){
          const mins = Math.round((Date.now()-new Date(pubDate))/60000);
          timeAgo = mins<60?`${mins}m ago`:mins<1440?`${Math.round(mins/60)}h ago`:`${Math.round(mins/1440)}d ago`;
        }

        allItems.push({headline:title, sentiment, impact:desc||"", source, timeAgo, pubDate, link});
      });
    } catch(e){ /* skip failed feed */ }
  }));

  // Sort by date, deduplicate by headline similarity, limit to 15
  const seen = new Set();
  const unique = allItems
    .filter(item=>{ const key=item.headline.slice(0,40); if(seen.has(key))return false; seen.add(key); return true; })
    .sort((a,b)=>new Date(b.pubDate||0)-new Date(a.pubDate||0))
    .slice(0,15);

  // If no stock-specific news found, return general market news
  if(unique.length===0){
    res.json([{headline:`No recent news found for ${sym}. Showing general market news.`,sentiment:"neutral",impact:"Try checking Moneycontrol or Economic Times directly.",source:"ProTrader",timeAgo:""}]);
    return;
  }

  res.json(unique);
});

// ── Fetch and cache valid instrument tokens from Kite ─────────────────────────
let validTokens = {}; // sym -> token, populated from Kite instruments API

async function refreshInstruments() {
  if (!kite || !process.env.KITE_ACCESS_TOKEN) return;
  try {
    console.log("📋 Fetching instrument tokens from Kite...");
    const instruments = await kite.getInstruments("NSE");
    instruments.forEach(inst => {
      if (inst.exchange === "NSE" && inst.instrument_type === "EQ") {
        validTokens[inst.tradingsymbol] = inst.instrument_token;
      }
    });
    console.log(`✅ Loaded ${Object.keys(validTokens).length} NSE instrument tokens`);
  } catch(e) {
    console.error("Could not fetch instruments:", e.message);
    // Fall back to hardcoded tokens
    validTokens = {...INSTRUMENTS};
  }
}

app.get("/api/instruments", (req,res) => res.json(validTokens));

// ═══════════════════════════════════════════════════════════════════════════════
// ── MUTUAL FUND DATA ENGINE ────────────────────────────────────────────────────
// Sources: mfdata.in (ratios, AUM, expense) + mf.captnemo.in (Kuvera metadata)
//          + mfapi.in (NAV history for calculated returns)
// Cached in memory, refreshed daily at 6 AM IST
// ═══════════════════════════════════════════════════════════════════════════════

// Fund universe — AMFI scheme codes (direct growth plans)
// Fund universe — auto-discovered from MFAPI, populated on startup
let MF_UNIVERSE_SERVER = [];

// Known correct codes as seed (verified working)
const MF_SEED = [
  // SMALL CAP
  {code:"147622",name:"Bandhan Small Cap",               amc:"Bandhan",    cat:"smallcap"},
  {code:"118989",name:"Nippon India Small Cap",          amc:"Nippon",     cat:"smallcap"},
  {code:"125497",name:"SBI Small Cap",                   amc:"SBI",        cat:"smallcap"},
  {code:"120505",name:"Kotak Small Cap",                 amc:"Kotak",      cat:"smallcap"},
  {code:"120828",name:"Quant Small Cap",                 amc:"Quant",      cat:"smallcap"},
  {code:"118272",name:"DSP Small Cap",                   amc:"DSP",        cat:"smallcap"},
  {code:"118778",name:"HDFC Small Cap",                  amc:"HDFC",       cat:"smallcap"},
  {code:"125354",name:"Axis Small Cap",                  amc:"Axis",       cat:"smallcap"},
  {code:"135800",name:"Tata Small Cap",                  amc:"Tata",       cat:"smallcap"},
  {code:"100278",name:"Franklin India Smaller Cos",      amc:"Franklin",   cat:"smallcap"},
  {code:"120586",name:"Invesco India Smallcap",          amc:"Invesco",    cat:"smallcap"},
  {code:"120197",name:"ICICI Pru Smallcap",              amc:"ICICI Pru",  cat:"smallcap"},
  {code:"135798",name:"Aditya Birla SL Small Cap",       amc:"ABSL",       cat:"smallcap"},
  {code:"149469",name:"Mirae Asset Small Cap",           amc:"Mirae",      cat:"smallcap"},
  {code:"148931",name:"Mahindra Manulife Small Cap",     amc:"Mahindra",   cat:"smallcap"},
  // MID CAP
  {code:"135803",name:"Motilal Oswal Midcap",            amc:"Motilal",    cat:"midcap"},
  {code:"145552",name:"Edelweiss Mid Cap",                amc:"Edelweiss",  cat:"midcap"},
  {code:"118388",name:"Nippon India Growth",             amc:"Nippon",     cat:"midcap"},
  {code:"118776",name:"HDFC Mid-Cap Opp",                amc:"HDFC",       cat:"midcap"},
  {code:"120503",name:"Kotak Emerging Equity",           amc:"Kotak",      cat:"midcap"},
  {code:"125496",name:"SBI Magnum Midcap",               amc:"SBI",        cat:"midcap"},
  {code:"120847",name:"Axis Midcap",                     amc:"Axis",       cat:"midcap"},
  {code:"118273",name:"DSP Midcap",                      amc:"DSP",        cat:"midcap"},
  {code:"120830",name:"Quant Mid Cap",                   amc:"Quant",      cat:"midcap"},
  {code:"120600",name:"PGIM India Midcap",               amc:"PGIM",       cat:"midcap"},
  {code:"119026",name:"ICICI Pru Midcap",                amc:"ICICI Pru",  cat:"midcap"},
  {code:"100270",name:"Franklin India Prima",            amc:"Franklin",   cat:"midcap"},
  {code:"119247",name:"UTI Mid Cap",                     amc:"UTI",        cat:"midcap"},
  {code:"119061",name:"Sundaram Mid Cap",                amc:"Sundaram",   cat:"midcap"},
  {code:"148910",name:"Mirae Asset Midcap",              amc:"Mirae",      cat:"midcap"},
  // FLEXI CAP
  {code:"122639",name:"Parag Parikh Flexi Cap",          amc:"PPFAS",      cat:"flexicap"},
  {code:"120832",name:"Quant Flexi Cap",                 amc:"Quant",      cat:"flexicap"},
  {code:"118777",name:"HDFC Flexi Cap",                  amc:"HDFC",       cat:"flexicap"},
  {code:"101539",name:"Canara Rob Flexi Cap",            amc:"Canara",     cat:"flexicap"},
  {code:"120716",name:"UTI Flexi Cap",                   amc:"UTI",        cat:"flexicap"},
  {code:"125494",name:"SBI Flexi Cap",                   amc:"SBI",        cat:"flexicap"},
  {code:"120502",name:"Kotak Flexi Cap",                 amc:"Kotak",      cat:"flexicap"},
  {code:"118271",name:"DSP Flexi Cap",                   amc:"DSP",        cat:"flexicap"},
  {code:"125355",name:"Axis Flexi Cap",                  amc:"Axis",       cat:"flexicap"},
  {code:"100277",name:"Franklin Flexi Cap",              amc:"Franklin",   cat:"flexicap"},
  {code:"122639",name:"Parag Parikh Flexi Cap",          amc:"PPFAS",      cat:"flexicap"},
  {code:"148697",name:"Aditya Birla SL Flexi Cap",       amc:"ABSL",       cat:"flexicap"},
  {code:"148462",name:"Mirae Asset Flexi Cap",           amc:"Mirae",      cat:"flexicap"},
  {code:"148514",name:"Tata Flexi Cap",                  amc:"Tata",       cat:"flexicap"},
  {code:"150091",name:"Groww Nifty India Defence ETF FoF",amc:"Groww",     cat:"flexicap"},
];

// Auto-discover all small/mid/flexicap direct growth funds from MFAPI scheme list
async function discoverMFUniverse() {
  try {
    console.log("📋 Discovering MF universe from MFAPI...");
    const r = await fetchT("https://api.mfapi.in/mf", {headers:{"User-Agent":"Mozilla/5.0"}}, 15000);
    if (!r.ok) throw new Error("MFAPI scheme list unavailable");
    const all = await r.json();

    const catKeywords = {
      smallcap: ["small cap","small-cap","smaller companies","smallcap"],
      midcap:   ["mid cap","mid-cap","midcap","growth fund","emerging equity","prima fund"],
      flexicap: ["flexi cap","flexi-cap","flexicap","flexible"],
    };
    // Only direct + growth plans
    const isDirect = (name) => /direct/i.test(name);
    const isGrowth = (name) => /growth/i.test(name) && !/dividend|idcw|bonus/i.test(name);

    const discovered = {smallcap:[], midcap:[], flexicap:[]};
    for (const scheme of all) {
      const name = (scheme.schemeName || "").toLowerCase();
      if (!isDirect(name) || !isGrowth(name)) continue;
      for (const [cat, keywords] of Object.entries(catKeywords)) {
        if (keywords.some(kw => name.includes(kw))) {
          // Dedupe by code
          if (!discovered[cat].find(f => f.code === String(scheme.schemeCode))) {
            discovered[cat].push({
              code: String(scheme.schemeCode),
              name: scheme.schemeName.replace(/ - Direct Plan - Growth/i,"").replace(/ Direct Growth/i,"").replace(/ Direct Plan$/i,"").trim(),
              amc: extractAMC(scheme.schemeName),
              cat,
            });
          }
          break;
        }
      }
    }

    const total = Object.values(discovered).reduce((s,a)=>s+a.length,0);
    console.log(`✅ Discovered ${total} funds: ${discovered.smallcap.length} small + ${discovered.midcap.length} mid + ${discovered.flexicap.length} flexi`);

    // Use discovered if we got reasonable counts, else fall back to seed
    if (discovered.smallcap.length >= 10 && discovered.midcap.length >= 10 && discovered.flexicap.length >= 10) {
      MF_UNIVERSE_SERVER = [...discovered.smallcap, ...discovered.midcap, ...discovered.flexicap];
    } else {
      console.log("⚠️ Discovery returned low counts, using seed list");
      MF_UNIVERSE_SERVER = dedupeSeed();
    }
  } catch(e) {
    console.log("⚠️ Universe discovery failed:", e.message, "— using seed list");
    MF_UNIVERSE_SERVER = dedupeSeed();
  }
}

function dedupeSeed() {
  const seen = new Set();
  return MF_SEED.filter(f => { if(seen.has(f.code)) return false; seen.add(f.code); return true; });
}

function extractAMC(name) {
  const amcMap = [
    ["Aditya Birla","ABSL"],["Axis","Axis"],["Bandhan","Bandhan"],["Baroda","Baroda BNP"],
    ["Canara","Canara"],["DSP","DSP"],["Edelweiss","Edelweiss"],["Franklin","Franklin"],
    ["HDFC","HDFC"],["ICICI","ICICI Pru"],["Invesco","Invesco"],["ITI","ITI"],
    ["JM","JM"],["Kotak","Kotak"],["LIC","LIC"],["Mahindra","Mahindra"],
    ["Mirae","Mirae"],["Motilal","Motilal"],["Navi","Navi"],["Nippon","Nippon"],
    ["PGIM","PGIM"],["PPFAS","PPFAS"],["Parag Parikh","PPFAS"],["Quant","Quant"],
    ["SBI","SBI"],["Sundaram","Sundaram"],["Tata","Tata"],["Union","Union"],
    ["UTI","UTI"],["WhiteOak","WhiteOak"],["360 ONE","360 ONE"],["Groww","Groww"],
  ];
  for (const [key,short] of amcMap) {
    if (name.includes(key)) return short;
  }
  return name.split(" ")[0];
}

// ── Qualitative AMC scores — research-based (updated Apr 2026) ────────────────
const AMC_QUAL = {
  "PPFAS":     {score:10,sebi:"clean",  warning:null,                                                                      note:"Owner-run, Rajeev Thakkar since inception, documented value philosophy, never changed style"},
  "HDFC":      {score:9, sebi:"minor",  warning:"2020 minor front-running fine (settled)",                                 note:"HDFC Ltd + abrdn UK, publicly listed AMC, 40+ analysts, deep bench, strong succession planning"},
  "Nippon":    {score:9, sebi:"clean",  warning:null,                                                                      note:"Nippon Life Japan (world's largest insurer), listed AMC, process-driven, strong governance"},
  "ICICI Pru": {score:8, sebi:"clean",  warning:null,                                                                      note:"ICICI Bank + Prudential UK, listed, largest research team in India, dynamic all-weather approach"},
  "SBI":       {score:8, sebi:"clean",  warning:null,                                                                      note:"SBI + Amundi France, govt backing, R. Srinivasan 15yr on small cap, conservative culture"},
  "Kotak":     {score:8, sebi:"clean",  warning:null,                                                                      note:"Kotak Mahindra Bank, strong risk mgmt, quality-focused, low volatility preference"},
  "DSP":       {score:8, sebi:"clean",  warning:null,                                                                      note:"Hemendra Kothari family, independent, global research partnerships, disciplined"},
  "Mirae":     {score:8, sebi:"clean",  warning:null,                                                                      note:"Mirae Asset Korea (global), growing team, growth-at-reasonable-price philosophy"},
  "UTI":       {score:7, sebi:"clean",  warning:null,                                                                      note:"Govt of India + T Rowe Price USA, institutional backing, steady long-term approach"},
  "Canara":    {score:7, sebi:"clean",  warning:null,                                                                      note:"Canara Bank + Robeco Netherlands, conservative culture, consistent process"},
  "Motilal":   {score:7, sebi:"clean",  warning:"Concentrated bets — high volatility risk",                               note:"Promoter-owned, founder-led, high conviction buy-right-sit-tight philosophy"},
  "Edelweiss": {score:7, sebi:"clean",  warning:null,                                                                      note:"Edelweiss Financial Group, improving processes, quality-growth focus"},
  "Tata":      {score:7, sebi:"clean",  warning:null,                                                                      note:"Tata Sons — India's most trusted conglomerate, stable conservative management"},
  "Invesco":   {score:7, sebi:"clean",  warning:null,                                                                      note:"Invesco USA, global research expertise, disciplined research-driven process"},
  "PGIM":      {score:7, sebi:"clean",  warning:null,                                                                      note:"Prudential Financial USA, international backing, consistent moderate-risk approach"},
  "Sundaram":  {score:7, sebi:"clean",  warning:null,                                                                      note:"Sundaram Finance Group, Chennai-based, quality-growth, experienced team"},
  "Bandhan":   {score:6, sebi:"clean",  warning:"Relatively new AMC, shorter track record",                               note:"Bandhan Bank, small growing team, improving track record"},
  "Franklin":  {score:6, sebi:"minor",  warning:"2020 debt crisis — 6 schemes wound up (equity funds unaffected)",        note:"Franklin Templeton USA, strong global research, value-oriented equity team"},
  "ABSL":      {score:6, sebi:"minor",  warning:"2024 front-running — ₹2.8 Cr fine, 6-month employee debarment",         note:"Aditya Birla Group + Sun Life Canada, large team, process-heavy"},
  "Axis":      {score:5, sebi:"action", warning:"⚠️ 2022 front-running — 21 entities barred, ₹30.5 Cr impounded by SEBI", note:"Axis Bank, rebuilt team post-scandal, style drift, rebuilding investor trust"},
  "Quant":     {score:2, sebi:"probe",  warning:"🔴 SEBI front-running RAID 2024 — investigation ONGOING, no closure yet", note:"Only 4 analysts for 26 schemes, opaque algorithmic strategy, governance concerns"},
};
function getAmcQual(amc){ return AMC_QUAL[amc]||{score:5,sebi:"unknown",warning:null,note:"Limited public information available"}; }

// In-memory cache
let mfCache = {};           // code -> enriched fund object
let mfCacheTime = null;     // last refresh timestamp
const MF_CACHE_TTL = 6*60*60*1000; // 6 hours

// ── Fetch from mfdata.in ──────────────────────────────────────────────────────
async function fetchMFData(code) {
  try {
    const r = await fetchT(`https://mfdata.in/api/v1/schemes/${code}`, {
      headers:{"User-Agent":"Mozilla/5.0","Accept":"application/json"}
    }, 10000);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || d.status === "error") return null;
    return d.data || d;
  } catch(e) { return null; }
}

// ── Fetch from mf.captnemo.in (Kuvera metadata) ───────────────────────────────
async function fetchKuveraData(isin) {
  try {
    const r = await fetchT(`https://mf.captnemo.in/kuvera/${isin}`, {
      headers:{"User-Agent":"Mozilla/5.0","Accept":"application/json"}
    }, 10000);
    if (!r.ok) return null;
    const d = await r.json();
    return d || null;
  } catch(e) { return null; }
}

// ── Fetch NAV history from mfapi.in ──────────────────────────────────────────
async function fetchMFNavHistory(code) {
  try {
    const r = await fetchT(`https://api.mfapi.in/mf/${code}`, {
      headers:{"User-Agent":"Mozilla/5.0"}
    }, 12000);
    if (!r.ok) return null;
    const d = await r.json();
    const raw = (d.data || []).slice().reverse(); // oldest first
    if (raw.length < 50) return null;
    const navs = raw.map(x => +x.nav).filter(n => n > 0);
    return navs;
  } catch(e) { return null; }
}

// ── Calculate metrics from NAV history ───────────────────────────────────────
function calcNavMetrics(navs) {
  const N = navs.length;
  const last = navs[N-1];
  function idx(days) { return Math.max(0, N-1-Math.round(days)); }
  function ann(old, yrs) { return old && old>0 ? +((Math.pow(last/old,1/yrs)-1)*100).toFixed(1) : null; }
  function ret(old) { return old && old>0 ? +((last-old)/old*100).toFixed(1) : null; }

  const last3y = navs.slice(idx(365*3));
  const dailyRet = [];
  for (let i=1; i<last3y.length; i++) dailyRet.push((last3y[i]-last3y[i-1])/last3y[i-1]);

  const mean = dailyRet.reduce((a,b)=>a+b,0)/dailyRet.length;
  const variance = dailyRet.reduce((a,b)=>a+Math.pow(b-mean,2),0)/dailyRet.length;
  const stdDev = +(Math.sqrt(variance)*Math.sqrt(252)*100).toFixed(2);

  const downRet = dailyRet.filter(r=>r<0);
  const downVariance = downRet.reduce((a,b)=>a+b*b,0)/dailyRet.length;
  const downDev = +(Math.sqrt(downVariance)*Math.sqrt(252)*100).toFixed(2);

  let peak = last3y[0], maxDD = 0;
  for (const n of last3y) {
    if (n>peak) peak=n;
    const dd=(n-peak)/peak*100;
    if (dd<maxDD) maxDD=dd;
  }

  const annRet3y = ann(navs[idx(365*3)], 3) || 0;
  const rf = 6.5; // RBI repo rate proxy
  const sharpe = stdDev>0 ? +((annRet3y-rf)/stdDev).toFixed(2) : null;
  const sortino = downDev>0 ? +((annRet3y-rf)/downDev).toFixed(2) : null;
  const calmar = maxDD<0 ? +(annRet3y/Math.abs(maxDD)).toFixed(2) : null;

  // Rolling 1Y consistency — % of 1Y rolling windows with positive return
  let posWindows=0, totalWindows=0;
  for (let i=252; i<navs.length; i++) {
    totalWindows++;
    if (navs[i] > navs[i-252]) posWindows++;
  }
  const rollConsistency = totalWindows>0 ? Math.round(posWindows/totalWindows*100) : null;

  return {
    nav: last,
    navFormatted: "₹"+last.toFixed(2),
    ret1m:  ret(navs[idx(30)]),
    ret3m:  ret(navs[idx(91)]),
    ret6m:  ret(navs[idx(182)]),
    ret1y:  ret(navs[idx(365)]),
    cagr2y: ann(navs[idx(365*2)], 2),
    cagr3y: ann(navs[idx(365*3)], 3),
    cagr5y: ann(navs[idx(365*5)], 5),
    cagr7y: N>365*7  ? ann(navs[idx(365*7)],  7) : null,
    cagr10y:N>365*10 ? ann(navs[idx(365*10)],10) : null,
    cagrInception: ann(navs[0], N/365.25),
    stdDev, maxDD: +maxDD.toFixed(1), sharpe, sortino, calmar,
    rollConsistency, dataPoints: N,
  };
}

// ── Score a fund with all available data ─────────────────────────────────────
function scoreMFComplete(fund) {
  const d = fund;
  let score = 0;
  const hits = {};

  // ── RETURNS (25 pts) ─────────────────────────────────────────────
  const catBM = {smallcap:{r1:15,r3:20,r5:18},midcap:{r1:12,r3:17,r5:15},flexicap:{r1:10,r3:14,r5:12}};
  const bm = catBM[fund.cat] || catBM.flexicap;

  if (d.ret1y > bm.r1+12) { score+=4;   hits["1Y >"+(bm.r1+12)+"%"]=4; }
  else if (d.ret1y > bm.r1+5) { score+=2.5; hits["1Y >"+(bm.r1+5)+"%"]=2.5; }
  else if (d.ret1y > bm.r1)   { score+=1;   hits["1Y >benchmark"]=1; }

  if (d.cagr3y > bm.r3+8) { score+=5;   hits["3Y >"+(bm.r3+8)+"%"]=5; }
  else if (d.cagr3y > bm.r3+4) { score+=3; hits["3Y >"+(bm.r3+4)+"%"]=3; }
  else if (d.cagr3y > bm.r3)   { score+=1.5; hits["3Y >benchmark"]=1.5; }

  if (d.cagr5y > bm.r5+8) { score+=5;   hits["5Y >"+(bm.r5+8)+"%"]=5; }
  else if (d.cagr5y > bm.r5+4) { score+=3; hits["5Y >"+(bm.r5+4)+"%"]=3; }
  else if (d.cagr5y > bm.r5)   { score+=1.5; hits["5Y >benchmark"]=1.5; }

  if (d.cagr10y > bm.r5)    { score+=4;   hits["10Y >benchmark"]=4; }
  if (d.cagrInception > bm.r5){ score+=3; hits["Inception >benchmark"]=3; }
  if (d.ret6m > 0)           { score+=1;   hits["6M positive"]=1; }
  if (d.ret3m > 0)           { score+=0.5; hits["3M positive"]=0.5; }

  // ── RISK-ADJUSTED (20 pts) ───────────────────────────────────────
  if (d.sharpe > 1.0)      { score+=6; hits["Sharpe >1.0"]=6; }
  else if (d.sharpe > 0.5) { score+=4; hits["Sharpe >0.5"]=4; }
  else if (d.sharpe > 0)   { score+=2; hits["Sharpe positive"]=2; }

  if (d.sortino > 1.5)     { score+=4; hits["Sortino >1.5"]=4; }
  else if (d.sortino > 0.8){ score+=2.5; hits["Sortino >0.8"]=2.5; }
  else if (d.sortino > 0)  { score+=1; hits["Sortino positive"]=1; }

  if (d.calmar > 1.0)      { score+=3; hits["Calmar >1.0"]=3; }
  else if (d.calmar > 0.5) { score+=1.5; hits["Calmar >0.5"]=1.5; }

  if (d.rollConsistency > 85){ score+=4; hits["Rolling 1Y >85% positive"]=4; }
  else if (d.rollConsistency > 70){ score+=2.5; hits["Rolling 1Y >70% positive"]=2.5; }
  else if (d.rollConsistency > 55){ score+=1; hits["Rolling 1Y >55% positive"]=1; }

  if (d.maxDD > -20)       { score+=3; hits["Max drawdown <20%"]=3; }
  else if (d.maxDD > -30)  { score+=2; hits["Max drawdown <30%"]=2; }
  else if (d.maxDD > -40)  { score+=1; hits["Max drawdown <40%"]=1; }

  // ── RISK METRICS (15 pts) ────────────────────────────────────────
  const catAvgVol = {smallcap:22,midcap:20,flexicap:16};
  const avgVol = catAvgVol[fund.cat]||18;
  if (d.stdDev && d.stdDev < avgVol-4)  { score+=4; hits["Volatility well below avg"]=4; }
  else if (d.stdDev && d.stdDev < avgVol){ score+=2; hits["Volatility below avg"]=2; }

  if (d.beta && d.beta < 0.8)  { score+=4; hits["Beta <0.8 (low market risk)"]=4; }
  else if (d.beta && d.beta < 0.95){ score+=2; hits["Beta <0.95"]=2; }

  if (d.alpha && d.alpha > 5)   { score+=4; hits["Alpha >5% (strong manager skill)"]=4; }
  else if (d.alpha && d.alpha > 3){ score+=2.5; hits["Alpha >3%"]=2.5; }
  else if (d.alpha && d.alpha > 0){ score+=1; hits["Alpha positive"]=1; }

  if (d.pe && d.pe < 22)        { score+=2; hits["Portfolio P/E <22"]=2; }
  if (d.pb && d.pb < 3.5)       { score+=1; hits["Portfolio P/B <3.5"]=1; }

  // ── COST (10 pts) ────────────────────────────────────────────────
  if (d.expense_ratio < 0.3)      { score+=4; hits["Expense <0.3% (very low)"]=4; }
  else if (d.expense_ratio < 0.5) { score+=3; hits["Expense <0.5%"]=3; }
  else if (d.expense_ratio < 0.75){ score+=2; hits["Expense <0.75%"]=2; }
  else if (d.expense_ratio < 1.0) { score+=1; hits["Expense <1.0%"]=1; }

  if (d.exit_load_pct && +d.exit_load_pct < 1) { score+=2; hits["Low exit load <1%"]=2; }
  else if (!d.exit_load_pct || +d.exit_load_pct <= 1){ score+=1; hits["Standard exit load"]=1; }

  if (d.min_lumpsum <= 100)      { score+=2; hits["Min ₹100 (most accessible)"]=2; }
  else if (d.min_lumpsum <= 500) { score+=1.5; hits["Min ≤₹500"]=1.5; }
  else if (d.min_lumpsum <= 1000){ score+=1; hits["Min ≤₹1,000"]=1; }

  if (d.sip_min <= 100)          { score+=1; hits["SIP from ₹100"]=1; }
  else if (d.sip_min <= 500)     { score+=0.5; hits["SIP ≤₹500"]=0.5; }

  // ── AUM & FLOWS (10 pts) ─────────────────────────────────────────
  const aum = d.aum_cr || d.aum;
  if (aum >= 2000 && aum <= 25000) { score+=4; hits["AUM sweet spot ₹2K-25K Cr"]=4; }
  else if (aum >= 500 && aum < 2000){ score+=2; hits["AUM ₹500-2K Cr (growing)"]=2; }
  else if (aum >= 25000)           { score+=2; hits["Large fund >₹25K Cr"]=2; }
  if (aum >= 1000)                 { score+=2; hits["AUM >₹1,000 Cr (established)"]=2; }
  if (aum >= 5000)                 { score+=1; hits["AUM >₹5,000 Cr"]=1; }
  if (d.lumpsum_open)              { score+=3; hits["Lumpsum open to investors"]=3; }

  // ── FUND QUALITY (10 pts) ────────────────────────────────────────
  if (d.morningstar >= 5)         { score+=4; hits["5-star Morningstar rated"]=4; }
  else if (d.morningstar >= 4)    { score+=2.5; hits["4-star Morningstar rated"]=2.5; }
  else if (d.morningstar >= 3)    { score+=1; hits["3-star Morningstar rated"]=1; }

  if (d.crisil_rating)            { score+=2; hits["CRISIL rated"]=2; }

  if (d.dataPoints > 3000)        { score+=2; hits["10+ year history"]=2; }
  else if (d.dataPoints > 1500)   { score+=1; hits["5+ year history"]=1; }

  if (d.fund_manager && d.manager_tenure_yrs >= 5){ score+=2; hits["Fund manager 5+ year tenure"]=2; }
  else if (d.manager_tenure_yrs >= 3){ score+=1; hits["Fund manager 3+ year tenure"]=1; }

  // ── GOVERNANCE (10 pts) ──────────────────────────────────────────
  if (d.sebi_clean !== false)     { score+=3; hits["Clean SEBI record"]=3; }
  if (d.direct)                   { score+=2; hits["Direct plan available"]=2; }
  if (d.fund_type === "Open Ended"||d.maturity_type==="Open Ended"){ score+=2; hits["Open-ended fund"]=2; }
  if (d.instant_redemption)       { score+=1; hits["Instant redemption available"]=1; }
  if (d.portfolio_turnover && d.portfolio_turnover < 50){ score+=2; hits["Low portfolio turnover <50%"]=2; }

  // ── AMC QUALITATIVE (10 pts — research-based) ────────────────────
  const qual = getAmcQual(fund.amc);
  const qualScore = Math.round((qual.score/10)*10); // 0-10 pts
  score += qualScore;
  if (qual.score >= 9)  hits["Top-tier AMC (governance, stability, team)"] = qualScore;
  else if (qual.score >= 7) hits["Established AMC (good governance)"] = qualScore;
  else if (qual.score >= 5) hits["Mid-tier AMC (minor concerns)"] = qualScore;
  else hits["AMC concerns (regulatory/governance issues)"] = qualScore;
  if (qual.warning) hits["⚠️ "+qual.warning] = 0; // flag warning, zero pts
  // Auto-disqualify if active SEBI probe
  if (qual.sebi === "probe") {
    score = Math.min(score, 15); // cap score at 15 if under active investigation
    hits["🔴 DISQUALIFIED: Active SEBI investigation"] = 0;
  }

  return { score:+score.toFixed(1), hits, maxPossible:100 };
}

// ── Enrich one fund from all 3 sources ───────────────────────────────────────
async function enrichFund(f) {
  try {
    // Fetch all 3 sources in parallel
    const [mfd, kuv, navs] = await Promise.allSettled([
      fetchMFData(f.code),
      fetchKuveraData(f.isin),
      fetchMFNavHistory(f.code),
    ]);

    const mfData  = mfd.status==="fulfilled"  ? mfd.value  : null;
    const kuvData = kuv.status==="fulfilled"  ? kuv.value  : null;
    const navArr  = navs.status==="fulfilled" ? navs.value : null;

    // Merge all data sources — mfdata.in is primary
    const merged = {
      code: f.code, isin: f.isin,
      name: f.name, amc: f.amc, cat: f.cat,
      sebi_clean: true,
      // from mfdata.in
      nav:          mfData?.nav || mfData?.last_nav?.nav,
      navFormatted: mfData?.nav ? "₹"+parseFloat(mfData.nav).toFixed(2) : null,
      aum_cr:       mfData?.aum_cr || mfData?.aum,
      expense_ratio:parseFloat(mfData?.expense_ratio || 0),
      morningstar:  mfData?.morningstar || mfData?.fund_rating,
      category:     mfData?.category,
      fund_type:    mfData?.fund_type || mfData?.maturity_type,
      pe:           mfData?.pe_ratio,
      pb:           mfData?.pb_ratio,
      sharpe:       mfData?.sharpe,
      beta:         mfData?.beta,
      alpha:        mfData?.alpha,
      sortino:      mfData?.sortino,
      stdDev_api:   mfData?.standard_deviation,
      ret1y_api:    mfData?.returns?.["1y"] || mfData?.returns?.["1Y"],
      ret3y_api:    mfData?.returns?.["3y"] || mfData?.returns?.["3Y"],
      ret5y_api:    mfData?.returns?.["5y"] || mfData?.returns?.["5Y"],
      holdings:     mfData?.holdings || [],
      sectors:      mfData?.sector_allocation || {},
      fund_manager: mfData?.fund_manager,
      // from kuvera
      crisil_rating:   kuvData?.crisil_rating,
      lumpsum_open:    kuvData?.lump_available === "Y",
      min_lumpsum:     kuvData?.lump_min || kuvData?.min_lumpsum,
      sip_min:         kuvData?.sip_min_amount || kuvData?.min_sip,
      exit_load_pct:   kuvData?.exit_load,
      direct:          kuvData?.direct === "Y",
      fund_rating:     kuvData?.fund_rating,
      instant_redemption: kuvData?.instant === "Y",
      manager_tenure_yrs: null, // derived below
    };

    // Calculate from NAV history (more accurate than API-provided)
    if (navArr && navArr.length > 50) {
      const calc = calcNavMetrics(navArr);
      Object.assign(merged, calc);
      // Use API-provided Sharpe/Beta/Alpha if available, otherwise calculated
      if (!merged.sharpe && calc.sharpe) merged.sharpe = calc.sharpe;
      if (!merged.sortino && calc.sortino) merged.sortino = calc.sortino;
    }

    // Final fallbacks
    if (!merged.navFormatted && merged.nav) merged.navFormatted = "₹"+parseFloat(merged.nav).toFixed(2);
    if (!merged.aum_cr) merged.aum_cr = merged.aum;

    const qual = getAmcQual(f.amc);
    merged.amc_qual_score = qual.score;
    merged.amc_sebi = qual.sebi;
    merged.amc_warning = qual.warning;
    merged.amc_note = qual.note;

    const {score, hits} = scoreMFComplete(merged);
    merged.score = score;
    merged.hits  = hits;
    merged.dataSource = [
      mfData?"mfdata.in":"",
      kuvData?"kuvera":"",
      navArr?"mfapi.in":""
    ].filter(Boolean).join(" + ");

    return merged;
  } catch(e) {
    console.error(`MF enrich error ${f.code}:`, e.message);
    return null;
  }
}

// ── Refresh all fund data ─────────────────────────────────────────────────────
let mfRefreshing = false;
async function refreshMFData() {
  if (mfRefreshing) return;
  mfRefreshing = true;
  console.log("📊 Refreshing MF data from mfdata.in + kuvera + mfapi...");
  const start = Date.now();
  // Fetch in batches of 5 to avoid rate limiting
  const BATCH = 5;
  const results = {};
  for (let i=0; i<MF_UNIVERSE_SERVER.length; i+=BATCH) {
    const batch = MF_UNIVERSE_SERVER.slice(i, i+BATCH);
    const enriched = await Promise.all(batch.map(f => enrichFund(f)));
    enriched.forEach((f,j) => { if(f) results[batch[j].code] = f; });
    if (i+BATCH < MF_UNIVERSE_SERVER.length) await new Promise(r=>setTimeout(r,1000)); // 1s between batches
  }
  mfCache = results;
  mfCacheTime = Date.now();
  const ok = Object.keys(results).length;
  console.log(`✅ MF data refreshed — ${ok}/${MF_UNIVERSE_SERVER.length} funds in ${((Date.now()-start)/1000).toFixed(1)}s`);
  mfRefreshing = false;
}

// ── MF API endpoints ──────────────────────────────────────────────────────────
// ── MF Tickertape endpoints — uses real Tickertape data from PostgreSQL ────────

// Score a fund using real Tickertape data (all 55 fields)
// ── Per-category value distributions (computed from Tickertape Apr 2026 data)
// Used for percentile-based scoring — so funds are ranked relative to peers, not absolute thresholds
const CAT_DIST = {
  "Flexi Cap Fund": {
    rolling_3y: [5.7698,12.3292,15.0669,15.2152,15.3106,15.8228,15.9575,16.7316,16.9639,17.6144,17.7589,17.8976,17.9022,18.459,18.5537,18.7907,19.1356,19.5943,19.7419,19.876,19.9503,21.1851,21.5155,21.6913,21.8923,22.1144,22.5608,22.7729,23.9026,24.4229,25.3622,25.5812,25.8541,26.5318],
    sharpe: [-1.6922,-1.6128,-1.5827,-1.443,-0.9636,-0.8826,-0.7826,-0.5921,-0.5683,-0.562,-0.481,-0.4461,-0.4413,-0.4127,-0.3921,-0.3492,-0.3365,-0.327,-0.2905,-0.2826,-0.2826,-0.2778,-0.2746,-0.273,-0.2683,-0.2492,-0.2381,-0.2207,-0.2127,-0.181,-0.1699,-0.1699,-0.1492,-0.1429,-0.081,-0.027,-0.0238,-0.0127,0.0381,0.0619,0.0762,0.0794,0.0889,0.0984,0.1254],
    sortino: [-0.157,-0.1478,-0.1438,-0.136,-0.0897,-0.0789,-0.0787,-0.0579,-0.0578,-0.0547,-0.0477,-0.043,-0.043,-0.0409,-0.0386,-0.0338,-0.0335,-0.0318,-0.0294,-0.0283,-0.0278,-0.0276,-0.0272,-0.0267,-0.0261,-0.0259,-0.0241,-0.0216,-0.0205,-0.0176,-0.0171,-0.017,-0.0148,-0.0144,-0.008,-0.0026,-0.0023,-0.0013,0.0037,0.0062,0.0077,0.0077,0.0088,0.0101,0.0121],
    volatility: [7.6214,9.0564,11.69,12.2631,12.3456,12.5948,12.9663,13.0044,13.2632,13.4267,13.6378,13.66,13.6616,13.7822,13.814,13.8854,13.941,14.0029,14.1394,14.1585,14.2251,14.2712,14.2744,14.2902,14.3855,14.4125,14.5204,14.6458,14.8157,14.9093,15.0125,15.2633,15.5126,15.7697,15.7904,15.8507,16.0015,16.0809,16.0904,16.2618,16.2904,16.4111,17.0238,17.6191,18.8097],
    max_drawdown: [1.6949,9.2469,10.6821,13.1819,14.2857,15.5891,15.6629,16.1057,16.1102,17.2352,17.5253,18.1193,18.2302,18.8755,19.4023,19.7101,19.7955,20.3958,21.4428,23.7292,26.7357,29.8701,30.1587,31.2021,32.1026,33.2387,33.4906,33.859,34.2035,34.9506,35.3594,35.7143,35.8001,36.1022,36.445,36.8934,37.0959,37.3063,37.7152,37.8936,38.5915,39.7875,40.9866,41.2847,41.8394],
    cagr_3y: [1.6755,8.4773,10.0397,11.1916,11.2268,12.5059,12.5944,12.9239,13.4249,13.6377,13.6495,13.7829,14.2231,14.3984,14.4142,14.7376,14.8184,14.9809,15.1596,15.2665,16.0024,16.2401,16.431,16.6323,17.2254,17.2756,17.7083,17.7697,18.0641,18.1219,18.8982,19.7348,20.1148,21.4916],
    cagr_5y: [5.9228,9.3527,9.7345,9.9723,10.0091,10.1825,11.1654,11.3404,11.5409,11.7519,11.837,11.9905,12.3526,12.3912,12.407,13.1034,13.7636,14.5072,14.9237,15.8971,16.4541,18.5443,18.5955,18.7136],
    cagr_10y: [9.4336,10.3825,11.5788,11.7721,12.8254,13.1671,13.4673,13.5766,14.0439,14.5727,14.7214,14.8049,14.8105,15.0116,15.7965,16.8681,16.9431,17.6495,19.3645],
    vs_cat_3y: [0.1394,0.7053,0.8353,0.9311,0.9341,1.0405,1.0479,1.0753,1.117,1.1347,1.1356,1.1467,1.1834,1.198,1.1993,1.2262,1.2329,1.2464,1.2613,1.2702,1.3314,1.3512,1.3671,1.3838,1.4332,1.4373,1.4733,1.4784,1.5029,1.5078,1.5723,1.6419,1.6736,1.7881],
    vs_cat_5y: [0.6085,0.9608,1.0001,1.0245,1.0283,1.0461,1.1471,1.165,1.1856,1.2073,1.2161,1.2318,1.269,1.273,1.2746,1.3462,1.414,1.4904,1.5332,1.6332,1.6904,1.9051,1.9104,1.9225],
    vs_cat_10y: [0.9374,1.0317,1.1505,1.1697,1.2744,1.3084,1.3382,1.349,1.3955,1.448,1.4628,1.4711,1.4716,1.4916,1.5696,1.6761,1.6836,1.7538,1.9242],
    expense: [0.36,0.39,0.41,0.43,0.44,0.45,0.46,0.47,0.48,0.49,0.49,0.49,0.5,0.52,0.52,0.54,0.55,0.56,0.56,0.57,0.59,0.61,0.63,0.66,0.69,0.7,0.7,0.72,0.74,0.78,0.81,0.82,0.85,0.89,0.91,0.93,0.94,1.01,1.05,1.08,1.13,1.2,1.59,2.56],
    pe: [17.5137,17.5428,18.9311,19.8134,21.0629,22.4463,23.454,23.7514,24.0123,24.2245,24.5747,24.9162,24.9547,25.0815,25.166,25.55,25.7922,26.0349,26.1543,26.2255,26.3676,26.3681,26.5308,26.8288,26.8764,26.9006,26.9758,27.3443,27.4499,28.3972,28.5961,29.0875,29.1779,30.2201,30.2641,30.8572,31.1247,31.2109,31.2494,34.5601,35.3888,35.8169,37.6163,41.1],
    top10: [27.9739,30.2487,32.0386,32.2447,32.7117,34.6961,34.9976,35.0235,35.0495,35.4445,35.5034,35.5917,36.0531,36.0943,36.6463,37.0902,37.2104,37.2161,37.2921,37.9014,38.1968,38.3177,38.4362,38.5614,40.0403,40.063,40.0726,41.9375,42.0923,42.5657,42.9325,43.4739,43.5917,44.248,45.0638,45.9256,47.1019,49.2644,49.4092,49.7495,50.6378,53.9922,68.5773,73.8369],
  },
  "Mid Cap Fund": {
    rolling_3y: [16.2351,19.6578,19.6742,19.8851,21.8736,22.1017,22.2437,22.5604,22.7051,22.8331,23.3004,23.6661,24.4105,24.66,24.9474,25.4554,25.5909,25.5947,27.1101,27.5026,28.3214,28.3943,28.7385,28.7405,29.0161,29.9107,29.9984,30.0637,30.7543],
    sharpe: [-3.5622,-3.286,-3.259,-2.678,-1.2493,-0.6413,-0.6334,-0.4969,-0.354,-0.3159,-0.2508,-0.2476,-0.1778,-0.1318,-0.0492,0.0825,0.0857,0.1,0.1191,0.1254,0.1365,0.154,0.1651,0.1699,0.1794,0.2095,0.2159,0.2429,0.2619,0.2762,0.281,0.2905,0.4096,0.4889,0.6191],
    sortino: [-0.3258,-0.3105,-0.3045,-0.2509,-0.1175,-0.065,-0.0631,-0.0465,-0.0339,-0.0301,-0.0248,-0.0245,-0.0177,-0.0126,-0.0048,0.0082,0.0085,0.0097,0.0118,0.0124,0.0128,0.0152,0.0164,0.017,0.0176,0.0208,0.0218,0.0233,0.026,0.0267,0.0276,0.0282,0.0413,0.0499,0.0617],
    volatility: [13.2505,13.7013,13.9775,14.4363,14.622,14.822,14.9601,15.0141,15.0316,15.1967,15.584,15.6189,15.6253,15.6777,15.7316,15.8316,15.9507,15.9555,16.0872,16.1888,16.3984,16.4047,16.4825,16.4825,16.6889,16.7841,17.1191,17.1318,17.327,17.3921,17.4016,17.6048,17.6112,18.2287,25.5119],
    max_drawdown: [2.2931,10.427,12.4877,13.0306,14.1946,16.7424,19.3299,21.2404,21.2625,22.5384,22.6601,22.7126,29.3625,32.7156,32.8046,33.0995,33.4299,34.0946,35.0964,35.3231,35.5517,35.9712,36.4256,36.5917,37.232,37.3778,39.2055,39.5132,39.8177,40.7467,42.8137,43.0512,44.0389,44.3083,45.0828],
    cagr_3y: [12.2096,14.5053,14.7862,15.8229,15.966,18.5837,18.6424,18.8834,18.9059,18.9522,19.1021,19.2726,19.506,19.9331,20.1735,20.206,20.3238,20.4155,22.2749,22.915,23.1737,23.2335,23.548,23.7402,23.8449,23.9555,24.0335,24.6976,25.5007],
    cagr_5y: [11.997,12.8302,13.4802,13.8024,13.9398,14.8868,14.9178,15.1635,15.7937,16.7519,16.7896,16.8209,17.1563,17.3325,17.3542,17.8097,18.3494,18.9041,19.044,19.6196,19.7902,20.275,20.519,20.6071,21.7365],
    cagr_10y: [14.1164,14.6555,14.7937,14.7995,15.1066,15.3871,15.5955,16.5765,16.906,16.9182,17.0222,17.2444,17.2497,17.343,17.6106,18.4358,18.7302,19.08,19.1461,19.2611],
    vs_cat_3y: [0.7423,0.8819,0.899,0.962,0.9707,1.1298,1.1334,1.148,1.1494,1.1522,1.1613,1.1717,1.1859,1.2119,1.2265,1.2285,1.2356,1.2412,1.3542,1.3932,1.4089,1.4125,1.4316,1.4433,1.4497,1.4564,1.4612,1.5015,1.5504],
    vs_cat_5y: [0.9167,0.9803,1.03,1.0546,1.0651,1.1375,1.1399,1.1586,1.2068,1.28,1.2829,1.2853,1.3109,1.3244,1.326,1.3608,1.4021,1.4444,1.4551,1.4991,1.5122,1.5492,1.5678,1.5746,1.6609],
    vs_cat_10y: [1.1618,1.2062,1.2176,1.218,1.2433,1.2664,1.2835,1.3643,1.3914,1.3924,1.401,1.4193,1.4197,1.4274,1.4494,1.5173,1.5415,1.5703,1.5758,1.5852],
    expense: [0.28,0.38,0.46,0.51,0.53,0.54,0.54,0.55,0.56,0.58,0.59,0.62,0.64,0.65,0.65,0.7,0.72,0.73,0.76,0.78,0.8,0.82,0.82,0.85,0.86,0.86,0.89,0.92,0.99,1.02,1.03,1.12,1.44,1.92],
    pe: [16.8002,19.7914,24.5081,25.5244,26.9496,29.0669,29.5527,29.9441,30.035,30.4099,30.5312,30.8027,31.4668,31.4738,31.5591,32.2579,32.3324,33.023,34.7139,34.8647,35.1473,35.7087,35.9237,37.8823,38.3074,38.5947,38.7225,38.8707,39.1355,39.3501,46.5612,46.6273,46.6843,48.1434],
    top10: [20.806,21.6984,22.8795,23.1062,24.451,24.4604,25.5343,26.5031,27.5147,27.5202,27.762,28.7562,28.8108,28.812,29.1325,29.2327,29.8185,29.9017,31.01,32.5852,33.333,33.7605,34.3074,37.43,38.087,39.5064,39.9377,42.2618,43.821,44.2147,47.4115,53.6006,61.1297,75.9024],
  },
  "Small Cap Fund": {
    rolling_3y: [16.6116,18.1346,19.1034,19.4308,20.2386,20.9095,20.9842,21.1539,21.7263,21.8699,22.5951,23.0348,23.1127,23.5268,24.0189,24.2413,24.8255,25.7536,26.4331,27.6143,28.8394,29.5281,30.9707,35.3825],
    sharpe: [-2.2304,-2.0669,-1.4922,-1.3509,-1.3017,-0.9683,-0.5032,-0.5,-0.454,-0.3953,-0.3778,-0.3223,-0.2969,-0.2778,-0.2175,-0.2127,-0.1841,-0.181,-0.1333,-0.1286,-0.1254,-0.1048,-0.0952,-0.0698,-0.0619,-0.0095,0.0127,0.019,0.0238,0.0571,0.0778,0.1111,0.2143,0.2302,0.3016,0.308],
    sortino: [-0.2217,-0.1704,-0.1462,-0.1305,-0.1285,-0.0977,-0.066,-0.0507,-0.0445,-0.039,-0.0375,-0.0323,-0.0297,-0.0287,-0.0217,-0.0212,-0.0185,-0.0181,-0.0134,-0.0127,-0.0124,-0.0104,-0.0097,-0.0068,-0.0061,-0.0009,0.0013,0.0019,0.0025,0.0059,0.0079,0.0115,0.0216,0.0233,0.0292,0.0308],
    volatility: [12.5028,13.5711,14.2013,14.314,15.2459,15.2967,15.4919,15.5396,15.6015,15.6078,15.63,15.8618,15.8666,15.9094,16.0174,16.1587,16.5984,16.6412,16.7127,16.8635,16.9429,17.0762,17.1048,17.2429,17.3048,17.5001,18.0049,18.0842,18.1128,18.4398,18.5525,18.5859,18.9224,20.3511,20.8289,22.3005],
    max_drawdown: [0.001,1.7049,9.8732,11.8343,15.1065,16.2189,16.8986,18.2099,22.3368,23.6939,24.0218,24.3363,24.36,24.5915,24.9983,25.9964,32.3671,34.6386,36.1836,36.6051,37.0863,37.6592,39.882,40.2601,40.6113,44.7141,45.1177,46.0222,46.7065,48.2557,48.5837,49.0585,49.9177,52.4548,57.0556,57.4091],
    cagr_3y: [12.2033,12.6182,13.8857,14.0455,14.7122,14.8564,14.864,16.3568,16.7156,16.7507,16.782,16.9918,17.584,18.5178,18.6229,19.1511,19.2082,19.3115,19.5007,19.7503,22.6607,23.3329,23.3358,29.4751],
    cagr_5y: [13.7,14.4602,14.5795,16.9582,17.0415,17.3414,17.4323,17.6518,17.6832,17.9524,18.0781,18.3056,18.6368,18.706,18.748,18.9531,19.0978,19.4725,20.934,21.2006,22.6045,23.0943],
    cagr_10y: [13.6225,14.9495,15.6678,16.0893,16.427,16.9244,17.3008,18.2175,18.2709,18.423,18.4894,18.9284,21.041],
    vs_cat_3y: [0.8687,0.8982,0.9885,0.9998,1.0473,1.0576,1.0581,1.1644,1.1899,1.1924,1.1946,1.2096,1.2517,1.3182,1.3257,1.3633,1.3673,1.3747,1.3882,1.4059,1.6131,1.661,1.6612,2.0982],
    vs_cat_5y: [0.9453,0.9978,1.006,1.1701,1.1759,1.1966,1.2029,1.218,1.2202,1.2388,1.2474,1.2631,1.286,1.2908,1.2937,1.3078,1.3178,1.3436,1.4445,1.4629,1.5598,1.5936],
    vs_cat_10y: [1.0543,1.157,1.2126,1.2453,1.2714,1.3099,1.339,1.41,1.4141,1.4259,1.431,1.465,1.6285],
    expense: [0.39,0.39,0.4,0.41,0.45,0.47,0.49,0.51,0.52,0.54,0.55,0.55,0.55,0.58,0.6,0.65,0.65,0.7,0.7,0.7,0.73,0.75,0.76,0.79,0.79,0.79,0.83,0.83,0.85,0.91,0.94,0.95,1.03,1.03],
    pe: [18.0689,23.2341,23.2863,24.8709,25.6128,27.6369,28.0361,28.1584,28.1639,28.5628,28.7717,29.3791,29.5052,29.9367,30.1877,30.7799,30.9907,31.5056,31.5749,31.6424,31.8458,33.4791,33.6694,33.9306,34.147,34.1604,34.5502,35.4183,36.261,38.5287,38.8827,39.5856,43.2638,44.9065],
    top10: [16.4118,19.2898,21.743,24.3209,25.18,25.2219,25.2691,26.3348,26.5243,26.8432,27.0384,27.8623,29.0392,29.1425,29.495,29.6396,29.663,30.2836,30.7801,31.0368,32.474,32.9663,33.0568,33.6842,33.7205,33.8103,34.068,36.4558,37.2865,37.3984,38.2571,38.6701,43.0407,64.9013],
  },
};
function pctRank(val, arr, higherBetter=true) {
  if (!arr || arr.length === 0) return 50;
  const below = arr.filter(v => v < val).length;
  const rank = below / arr.length * 100;
  return higherBetter ? rank : 100 - rank;
}

function scoreMFTickertape(f) {
  let score = 0;
  const hits = {};
  const subcat = f.sub_category || "";
  const cat = subcat.includes("Small") ? "smallcap"
             : subcat.includes("Mid")   ? "midcap"
             : "flexicap";
  const dist = CAT_DIST[subcat] || CAT_DIST["Flexi Cap Fund"];

  function pr(val, arr, higherBetter=true) {
    return pctRank(+val||0, arr, higherBetter);
  }
  function pts(pct, max) { return Math.round(pct / 100 * max * 10) / 10; }

  // ── 1. ROLLING 3Y RETURN (20 pts) — best consistency signal
  const roll = +f.rolling_3y || 0;
  const rollPct = pr(roll, dist.rolling_3y);
  const rollPts = pts(rollPct, 20);
  score += rollPts;
  hits[`Rolling 3Y return: ${roll.toFixed(1)}% (top ${(100-rollPct).toFixed(0)}% in category)`] = rollPts;

  // ── 2. RETURNS vs SUB-CATEGORY (20 pts) — beating peers matters most
  const vc3 = +f.vs_cat_3y || 0, vc5 = +f.vs_cat_5y || 0, vc10 = +f.vs_cat_10y || 0;
  const vc3Pct = pr(vc3, dist.vs_cat_3y);
  const vc5Pct = pr(vc5, dist.vs_cat_5y||dist.vs_cat_3y);
  const vc10Pct = pr(vc10, dist.vs_cat_10y||dist.vs_cat_5y||dist.vs_cat_3y);
  const vc3Pts = pts(vc3Pct, 10);
  const vc5Pts = pts(vc5Pct, 7);
  const vc10Pts = vc10 > 0 ? pts(vc10Pct, 3) : 0;
  score += vc3Pts + vc5Pts + vc10Pts;
  hits[`Beats category 3Y: ${vc3.toFixed(2)}x (${vc3>1?'above':'below'} median)`] = vc3Pts;
  hits[`Beats category 5Y: ${vc5.toFixed(2)}x`] = vc5Pts;
  if (vc10 > 0) hits[`Beats category 10Y: ${vc10.toFixed(2)}x`] = vc10Pts;

  // ── 3. SHARPE & SORTINO RELATIVE (15 pts) — both percentile ranked
  const sharpe = +f.sharpe || 0;
  const sharpePct = pr(sharpe, dist.sharpe);
  const sharpePts = pts(sharpePct, 10);
  const sortino = +f.sortino || 0;
  const sortinoPct = pr(sortino, dist.sortino);
  const sortinoPts = pts(sortinoPct, 5);
  score += sharpePts + sortinoPts;
  hits[`Sharpe: ${sharpe.toFixed(3)} (top ${(100-sharpePct).toFixed(0)}% in category)`] = sharpePts;
  hits[`Sortino: ${sortino.toFixed(4)} (top ${(100-sortinoPct).toFixed(0)}% in category)`] = sortinoPts;

  // ── 4. DOWNSIDE PROTECTION (15 pts)
  const mdd = +f.max_drawdown || 0;
  const mddPct = pr(mdd, dist.max_drawdown, false);
  const mddPts = pts(mddPct, 8);
  const vol = +f.volatility || 0;
  const volPct = pr(vol, dist.volatility, false);
  const volPts = pts(volPct, 7);
  score += mddPts + volPts;
  hits[`Max Drawdown: ${mdd.toFixed(1)}% (top ${(100-mddPct).toFixed(0)}% protection)`] = mddPts;
  hits[`Volatility: ${vol.toFixed(1)}% (top ${(100-volPct).toFixed(0)}% stable)`] = volPts;

  // ── 5. ABSOLUTE RETURNS (10 pts)
  const r3 = +f.cagr_3y || 0, r5 = +f.cagr_5y || 0, r10 = +f.cagr_10y || 0;
  const r3Pct = pr(r3, dist.cagr_3y);
  const r5Pct = pr(r5, dist.cagr_5y||dist.cagr_3y);
  const r10Pct = pr(r10, dist.cagr_10y||dist.cagr_5y);
  const r3Pts = pts(r3Pct, 5);
  const r5Pts = pts(r5Pct, 3);
  const r10Pts = r10 > 0 ? pts(r10Pct, 2) : 0;
  score += r3Pts + r5Pts + r10Pts;
  hits[`3Y CAGR: ${r3.toFixed(1)}%`] = r3Pts;
  hits[`5Y CAGR: ${r5.toFixed(1)}%`] = r5Pts;
  if (r10 > 0) hits[`10Y CAGR: ${r10.toFixed(1)}%`] = r10Pts;

  // ── 6. PORTFOLIO QUALITY (8 pts) — all percentile-based
  const pe = +f.pe_ratio || 0, catPE = +f.category_pe || 30;
  if (pe > 0 && dist.pe && dist.pe.length > 0) {
    const pePct = pr(pe, dist.pe, false); // lower PE = better
    const pePts = pts(pePct, 4);
    score += pePts;
    hits[`PE: ${pe.toFixed(1)} vs Category: ${catPE.toFixed(1)} (top ${(100-pePct).toFixed(0)}% cheapest)`] = pePts;
  }
  const cash = +f.pct_cash || 0;
  const cashPts = (cash >= 3 && cash <= 10) ? 2 : (cash > 0 && cash < 3) ? 1 : 0;
  if (cashPts) { score += cashPts; hits[`Cash: ${cash.toFixed(1)}% (healthy buffer)`] = cashPts; }
  const top10 = +f.top10_conc || 0;
  if (top10 > 0 && dist.top10 && dist.top10.length > 0) {
    const top10Pct = pr(top10, dist.top10, false);
    const top10Pts = pts(top10Pct, 2);
    score += top10Pts;
    hits[`Top 10 concentration: ${top10.toFixed(1)}% (top ${(100-top10Pct).toFixed(0)}% diversified)`] = top10Pts;
  }

  // ── 7. COST (7 pts)
  const exp = +f.expense_ratio || 0;
  const expPct = pr(exp, dist.expense, false);
  const expPts = pts(expPct, 5);
  score += expPts;
  hits[`Expense ratio: ${exp.toFixed(2)}% (top ${(100-expPct).toFixed(0)}% cheapest)`] = expPts;
  const lump = +f.min_lumpsum || 0;
  const lumpPts = lump <= 100 ? 1.5 : lump <= 1000 ? 1 : lump <= 5000 ? 0.5 : 0;
  if (lumpPts) { score += lumpPts; hits[`Min lumpsum: ₹${lump}`] = lumpPts; }
  const sip = +f.min_sip || 0;
  const sipPts = sip > 0 && sip <= 500 ? 0.5 : 0;
  if (sipPts) { score += sipPts; hits[`Min SIP: ₹${sip}`] = sipPts; }

  // ── 8. AUM QUALITY (5 pts) — sweet spot 2K-30K Cr
  const aum = +f.aum_cr || 0;
  const aumPts = (aum>=2000&&aum<=30000) ? 5 : (aum>=500&&aum<2000) ? 3 : aum>30000 ? 3 : aum>100 ? 1 : 0;
  score += aumPts;
  hits[`AUM: ₹${Math.round(aum).toLocaleString('en-IN')} Cr`] = aumPts;

  // ── 9. TRACK RECORD (3 pts)
  const months = +f.months_inception || 0;
  const trPts = months >= 120 ? 3 : months >= 60 ? 2 : months >= 36 ? 1 : 0;
  if (trPts) { score += trPts; hits[`Track record: ${months.toFixed(0)} months`] = trPts; }

  // ── 10. AMC QUALITATIVE (10 pts — research-based, updated Apr 2026)
  const amcFull = f.amc || "";
  const amcKey = Object.keys(AMC_QUAL).find(k => amcFull.toUpperCase().includes(k.toUpperCase())) || "";
  const qual = getAmcQual(amcKey);
  score += qual.score;
  hits[`AMC: ${amcKey||amcFull.split(" ")[0]} — governance score ${qual.score}/10`] = qual.score;
  if (qual.warning) hits[`⚠️ ${qual.warning}`] = 0;
  if (qual.sebi === "probe") {
    score = Math.min(score, 15);
    hits["🔴 DISQUALIFIED: Active SEBI investigation — capped"] = 0;
  }

  return {
    score: Math.round(score * 10) / 10,
    hits,
    cat,
    amc_sebi: qual.sebi,
    amc_warning: qual.warning,
    amc_note: qual.note,
  };
}

app.get("/api/mf/tickertape", async(req,res)=>{
  try {
    const {rows} = await pool.query("SELECT * FROM mf_tickertape ORDER BY sub_category, name");
    // Score all funds
    const scored = rows.map(f=>{
      const {score,hits,cat,amc_sebi,amc_warning,amc_note} = scoreMFTickertape(f);
      return {...f, score, hits, cat, amc_sebi, amc_warning, amc_note,
              navFormatted: f.nav ? "₹"+parseFloat(f.nav).toFixed(2) : null,
              aum_cr: f.aum,
              expense_ratio: f.expense_ratio,
              ret_1y: f.ret_1y, cagr_3y: f.cagr_3y, cagr_5y: f.cagr_5y, cagr_10y: f.cagr_10y,
              sharpe: f.sharpe, sortino: f.sortino, stdDev: f.volatility,
              maxDD: f.max_drawdown, rollConsistency: null,
              fund_manager: f.fund_manager,
              dataSource: "Tickertape (Apr 2026)"};
    });
    res.json({funds:scored, total:scored.length, source:"Tickertape CSV — Apr 4 2026", cached_at:Date.now()});
  } catch(e){
    // Table might not exist yet
    res.status(503).json({error:"Run the SQL migration first: "+e.message, funds:[]});
  }
});

// /api/mf/funds — primary endpoint, uses Tickertape DB (real data)
// Falls back to MFAPI cache if DB table not yet loaded
app.get("/api/mf/funds", async(req,res)=>{
  try {
    // Try Tickertape DB first
    const {rows} = await pool.query("SELECT * FROM mf_tickertape ORDER BY sub_category, name");
    if (rows.length > 0) {
      const scored = rows.map(f => {
        const {score,hits,cat,amc_sebi,amc_warning,amc_note} = scoreMFTickertape(f);
        return {
          // Identity
          name:          f.name,
          sub_category:  f.sub_category,
          cat,
          amc:           f.amc,
          benchmark:     f.benchmark,
          fund_manager:  f.fund_manager,
          sip_allowed:   f.sip_allowed,
          sebi_risk:     f.sebi_risk,
          // Pricing
          nav:           f.nav!=null ? parseFloat(f.nav) : null,
          navFormatted:  f.nav ? "₹"+parseFloat(f.nav).toFixed(2) : null,
          aum_cr:        f.aum!=null ? parseFloat(f.aum) : null,
          // Cost
          expense_ratio: f.expense_ratio!=null ? parseFloat(f.expense_ratio) : null,
          min_lumpsum:   f.min_lumpsum!=null ? parseFloat(f.min_lumpsum) : null,
          min_sip:       f.min_sip!=null ? parseFloat(f.min_sip) : null,
          exit_load:     f.exit_load!=null ? parseFloat(f.exit_load) : null,
          lock_in:       f.lock_in!=null ? parseFloat(f.lock_in) : null,
          months_inception: f.months_inception!=null ? parseFloat(f.months_inception) : null,
          // Returns — null=no data, 0=valid flat return
          ret_1y:        f.ret_1y!=null ? parseFloat(f.ret_1y) : null,
          ret_3m:        f.ret_3m!=null ? parseFloat(f.ret_3m) : null,
          ret_6m:        f.ret_6m!=null ? parseFloat(f.ret_6m) : null,
          cagr_3y:       f.cagr_3y!=null ? parseFloat(f.cagr_3y) : null,
          cagr_5y:       f.cagr_5y!=null ? parseFloat(f.cagr_5y) : null,
          cagr_10y:      f.cagr_10y!=null ? parseFloat(f.cagr_10y) : null,
          rolling_3y:    f.rolling_3y!=null ? parseFloat(f.rolling_3y) : null,
          // vs Category
          vs_cat_1y:     f.vs_cat_1y!=null ? parseFloat(f.vs_cat_1y) : null,
          vs_cat_3y:     f.vs_cat_3y!=null ? parseFloat(f.vs_cat_3y) : null,
          vs_cat_5y:     f.vs_cat_5y!=null ? parseFloat(f.vs_cat_5y) : null,
          vs_cat_10y:    f.vs_cat_10y!=null ? parseFloat(f.vs_cat_10y) : null,
          // Risk
          sharpe:        f.sharpe!=null ? parseFloat(f.sharpe) : null,
          sortino:       f.sortino!=null ? parseFloat(f.sortino) : null,
          volatility:    f.volatility!=null ? parseFloat(f.volatility) : null,
          stdDev:        f.volatility!=null ? parseFloat(f.volatility) : null,
          category_stddev: f.category_stddev!=null ? parseFloat(f.category_stddev) : null,
          max_drawdown:  f.max_drawdown!=null ? parseFloat(f.max_drawdown) : null,
          maxDD:         f.max_drawdown!=null ? parseFloat(f.max_drawdown) : null,
          pct_from_ath:  f.pct_from_ath!=null ? parseFloat(f.pct_from_ath) : null,
          tracking_error:f.tracking_error!=null ? parseFloat(f.tracking_error) : null,
          // Portfolio
          pe_ratio:      f.pe_ratio!=null ? parseFloat(f.pe_ratio) : null,
          category_pe:   f.category_pe!=null ? parseFloat(f.category_pe) : null,
          pct_equity:    f.pct_equity!=null ? parseFloat(f.pct_equity) : null,
          pct_largecap:  f.pct_largecap!=null ? parseFloat(f.pct_largecap) : null,
          pct_midcap:    f.pct_midcap!=null ? parseFloat(f.pct_midcap) : null,
          pct_smallcap:  f.pct_smallcap!=null ? parseFloat(f.pct_smallcap) : null,
          pct_cash:      f.pct_cash!=null ? parseFloat(f.pct_cash) : null,
          pct_debt:      f.pct_debt!=null ? parseFloat(f.pct_debt) : null,
          pct_a_bonds:   f.pct_a_bonds!=null ? parseFloat(f.pct_a_bonds) : null,
          pct_b_bonds:   f.pct_b_bonds!=null ? parseFloat(f.pct_b_bonds) : null,
          pct_corp_debt: f.pct_corp_debt!=null ? parseFloat(f.pct_corp_debt) : null,
          pct_sovereign: f.pct_sovereign!=null ? parseFloat(f.pct_sovereign) : null,
          // Concentration
          top3_conc:     f.top3_conc!=null ? parseFloat(f.top3_conc) : null,
          top5_conc:     f.top5_conc!=null ? parseFloat(f.top5_conc) : null,
          top10_conc:    f.top10_conc!=null ? parseFloat(f.top10_conc) : null,
          // AMC qualitative
          score, hits, amc_sebi, amc_warning, amc_note,
          dataSource: "Tickertape — Apr 4 2026",
        };
      });
      return res.json({funds:scored, total:scored.length, source:"Tickertape CSV (real data)", cached_at:Date.now()});
    }
    throw new Error("No rows in mf_tickertape");
  } catch(e) {
    // Fallback to MFAPI cache
    console.log("Tickertape DB not ready, using MFAPI cache:", e.message);
    const funds = Object.values(mfCache);
    if (funds.length > 0) {
      return res.json({funds, total:funds.length, source:"MFAPI (fallback — run mf_load.sql to use real data)", cached_at:mfCacheTime});
    }
    res.status(503).json({error:"No MF data available. Run mf_load.sql in Railway PostgreSQL.", funds:[], total:0});
  }
});

app.post("/api/mf/refresh", async(req,res) => {
  res.json({message:"MF refresh started (MFAPI background fetch)"});
  discoverMFUniverse().then(()=>refreshMFData());
});

// Background MFAPI refresh — runs daily at 6AM as secondary source
cron.schedule("0 6 * * *", async()=>{ await discoverMFUniverse(); refreshMFData(); }, {timezone:"Asia/Kolkata"});
setTimeout(async()=>{ await discoverMFUniverse(); refreshMFData(); }, 30000);

// ── Crypto prices proxy ───────────────────────────────────────────────────────
app.get("/api/crypto-prices", async(req,res)=>{
  // Return cached prices updated by background poller every 60s
  if(Object.keys(cryptoPrices).length > 0) return res.json(cryptoPrices);
  // No cache yet — fetch fresh
  await fetchCryptoPricesREST();
  res.json(cryptoPrices);
});

app.get("/health", (req,res)=>res.json({
  status:"ok", ticker:tickerOn?"connected":"not connected",
  hasToken:!!process.env.KITE_ACCESS_TOKEN, marketOpen:isMarketOpen(),
  prices:Object.keys(livePrices).length,
}));
app.get("/prices", (req,res)=>res.json(livePrices));

app.get("/paper-trades",       async(req,res)=>{try{const{rows}=await pool.query("SELECT * FROM paper_trades ORDER BY entry_time DESC LIMIT 500");res.json(rows);}catch(e){res.status(500).json({error:e.message});}});
app.get("/paper-trades/open",  async(req,res)=>{try{const{rows}=await pool.query("SELECT * FROM paper_trades WHERE status='OPEN' ORDER BY entry_time DESC");res.json(rows);}catch(e){res.status(500).json({error:e.message});}});

app.get("/paper-trades/stats", async(req,res)=>{
  try {
    const{rows}=await pool.query(`
      SELECT
        COUNT(*)                                                              AS total_trades,
        COUNT(CASE WHEN status='CLOSED' AND pnl>0  THEN 1 END)              AS wins,
        COUNT(CASE WHEN status='CLOSED' AND pnl<=0 THEN 1 END)              AS losses,
        COUNT(CASE WHEN status='OPEN'              THEN 1 END)              AS open_trades,
        COALESCE(SUM(CASE WHEN status='CLOSED' THEN pnl END),0)             AS total_pnl,
        COALESCE(AVG(CASE WHEN status='CLOSED' AND pnl>0  THEN pnl END),0)  AS avg_win,
        COALESCE(AVG(CASE WHEN status='CLOSED' AND pnl<=0 THEN pnl END),0)  AS avg_loss,
        COALESCE(MAX(CASE WHEN status='CLOSED' THEN pnl END),0)             AS best_trade,
        COALESCE(MIN(CASE WHEN status='CLOSED' THEN pnl END),0)             AS worst_trade
      FROM paper_trades`);
    // Strategy breakdown
    const{rows:strats}=await pool.query(`
      SELECT strategy, COUNT(*) as trades,
             SUM(CASE WHEN pnl>0 THEN 1 ELSE 0 END) as wins,
             COALESCE(SUM(pnl),0) as pnl
      FROM paper_trades WHERE status='CLOSED'
      GROUP BY strategy ORDER BY pnl DESC`);
    // Regime breakdown
    const{rows:regimes}=await pool.query(`
      SELECT regime, COUNT(*) as trades,
             COALESCE(SUM(pnl),0) as pnl
      FROM paper_trades WHERE status='CLOSED'
      GROUP BY regime ORDER BY pnl DESC`);
    res.json({...rows[0], strategies:strats, regimes});
  } catch(e){res.status(500).json({error:e.message});}
});

app.get("/paper-trades/daily", async(req,res)=>{
  try {
    const{rows}=await pool.query(`
      SELECT DATE(entry_time) as date, COUNT(*) as trades,
             SUM(CASE WHEN pnl>0 THEN 1 ELSE 0 END) as wins,
             COALESCE(SUM(pnl),0) as pnl
      FROM paper_trades WHERE status='CLOSED'
      GROUP BY DATE(entry_time) ORDER BY date DESC LIMIT 30`);
    res.json(rows);
  } catch(e){res.status(500).json({error:e.message});}
});

app.get("/scan-log", async(req,res)=>{
  try{const{rows}=await pool.query("SELECT * FROM scan_log ORDER BY scanned_at DESC LIMIT 50");res.json(rows);}
  catch(e){res.status(500).json({error:e.message});}
});

app.get("/regime", (req,res)=>{
  // Current market regime snapshot across all cached prices
  res.json({ message:"Check scan-log for latest regime", prices:Object.keys(livePrices).length });
});

app.post("/scan-now", (req,res)=>{ res.json({message:"Scan started"}); scanAndTrade(); });

// ── Reset all paper trades (clean slate) ──────────────────────────────────────
app.post("/reset-trades", async(req,res)=>{
  try {
    await pool.query("DELETE FROM paper_trades");
    await pool.query("DELETE FROM scan_log");
    res.json({message:"All paper trades and scan log cleared. Fresh start!"});
    console.log("🗑️  Paper trades reset by user");
  } catch(e){ res.status(500).json({error:e.message}); }
});

// ── Remove suspicious trades (P&L > 100% return = likely bad token) ──────────
app.post("/cleanup-trades", async(req,res)=>{
  try {
    const{rowCount}=await pool.query(
      "DELETE FROM paper_trades WHERE ABS(pnl_pct) > 100 OR (status='CLOSED' AND ABS(exit_price - price)/price > 1)"
    );
    res.json({message:`Removed ${rowCount} suspicious trades with >100% return`});
    console.log(`🧹 Cleaned ${rowCount} bad trades`);
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.get("/orders",    async(req,res)=>{try{res.json(await kite.getOrders());}   catch(e){res.status(500).json({error:e.message});}});
app.get("/positions", async(req,res)=>{try{res.json(await kite.getPositions());}catch(e){res.status(500).json({error:e.message});}});
app.get("/holdings",  async(req,res)=>{try{res.json(await kite.getHoldings());} catch(e){res.status(500).json({error:e.message});}});
app.get("/margin",    async(req,res)=>{try{res.json(await kite.getMargins());}  catch(e){res.status(500).json({error:e.message});}});

app.get("/history/:symbol", async(req,res)=>{
  try {
    const{interval="5minute"}=req.query;
    // Use validTokens (from Kite API) with fallback to hardcoded INSTRUMENTS
    const token=validTokens[req.params.symbol]||INSTRUMENTS[req.params.symbol];
    if(!token)return res.status(404).json({error:"Symbol not found — token not loaded yet"});
    const today=new Date().toISOString().split("T")[0];
    const weekAgo=new Date(Date.now()-7*24*60*60*1000).toISOString().split("T")[0];
    res.json(await kite.getHistoricalData(token,interval,weekAgo,today));
  }catch(e){res.status(500).json({error:e.message});}
});

app.get("/auth/login", (req,res)=>{ initKite(null); res.redirect(kite.getLoginURL()); });

app.get("/auth/callback", async(req,res)=>{
  try {
    initKite(null);
    const session=await kite.generateSession(req.query.request_token,process.env.KITE_API_SECRET);
    const token=session.access_token;
    process.env.KITE_ACCESS_TOKEN=token; kite.setAccessToken(token);
    startTicker(token);
    res.send(`<!DOCTYPE html><html><body style="background:#060b14;color:#e2e8f0;font-family:monospace;padding:40px;text-align:center">
      <h2 style="color:#22c55e">✅ Connected! Smart multi-strategy engine is live.</h2>
      <p>Token: <code style="background:#1e293b;padding:8px 16px;border-radius:6px;display:block;margin:12px auto;max-width:600px;word-break:break-all;color:#38bdf8">${token}</code></p>
      <p style="color:#fbbf24">Save in Railway → Variables → KITE_ACCESS_TOKEN</p>
      <p style="color:#64748b">7 strategies · auto regime detection · scans every 5 min · 9:15–15:30 IST</p>
      <br/><a href="/health" style="color:#0ea5e9">Check status →</a>
    </body></html>`);
  } catch(e){
    res.status(500).send(`<html><body style="background:#060b14;color:#fca5a5;font-family:monospace;padding:40px">
      <h2>❌ Auth failed</h2><pre>${e.message}</pre><a href="/auth/login" style="color:#0ea5e9">Try again</a>
    </body></html>`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── Timeout-safe fetch (compatible with Node 18) ─────────────────────────────
const cryptoPrices  = {};
const cryptoCandles = {};
let   cryptoWSActive = false;

function fetchT(url, opts={}, ms=8000) {
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), ms);
  return fetch(url, {...opts, signal:ctrl.signal}).finally(()=>clearTimeout(t));
}

// ── CRYPTO ENGINE — Binance Public API (no account needed) ────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const CRYPTO_UNIVERSE = [
  {sym:"BTCUSDT",  name:"Bitcoin",        base:"BTC"},
  {sym:"ETHUSDT",  name:"Ethereum",       base:"ETH"},
  {sym:"BNBUSDT",  name:"BNB",            base:"BNB"},
  {sym:"SOLUSDT",  name:"Solana",         base:"SOL"},
  {sym:"XRPUSDT",  name:"XRP",            base:"XRP"},
  {sym:"ADAUSDT",  name:"Cardano",        base:"ADA"},
  {sym:"DOGEUSDT", name:"Dogecoin",       base:"DOGE"},
  {sym:"AVAXUSDT", name:"Avalanche",      base:"AVAX"},
  {sym:"MATICUSDT",name:"Polygon",        base:"MATIC"},
  {sym:"DOTUSDT",  name:"Polkadot",       base:"DOT"},
  {sym:"LINKUSDT", name:"Chainlink",      base:"LINK"},
  {sym:"UNIUSDT",  name:"Uniswap",        base:"UNI"},
  {sym:"ATOMUSDT", name:"Cosmos",         base:"ATOM"},
  {sym:"LTCUSDT",  name:"Litecoin",       base:"LTC"},
  {sym:"NEARUSDT", name:"NEAR Protocol",  base:"NEAR"},
  {sym:"APTUSDT",  name:"Aptos",          base:"APT"},
  {sym:"ARBUSDT",  name:"Arbitrum",       base:"ARB"},
  {sym:"OPUSDT",   name:"Optimism",       base:"OP"},
  {sym:"INJUSDT",  name:"Injective",      base:"INJ"},
  {sym:"SUIUSDT",  name:"Sui",            base:"SUI"},
];

// Fetch candles — try multiple endpoints
async function fetchCryptoCandles(sym) {
  const endpoints = [
    `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1h&limit=100`,
    `https://api1.binance.com/api/v3/klines?symbol=${sym}&interval=1h&limit=100`,
    `https://api2.binance.com/api/v3/klines?symbol=${sym}&interval=1h&limit=100`,
    `https://api3.binance.com/api/v3/klines?symbol=${sym}&interval=1h&limit=100`,
  ];
  for (const url of endpoints) {
    try {
      const r = await fetchT(url, {headers:{"User-Agent":"Mozilla/5.0"}});
      if (!r.ok) continue;
      const data = await r.json();
      if (!Array.isArray(data) || data.length < 30) continue;
      cryptoCandles[sym] = data.map(c=>({open:+c[1],high:+c[2],low:+c[3],close:+c[4],volume:+c[5]}));
      return true;
    } catch(e) { continue; }
  }
  // Last resort: use CoinGecko (free, no restrictions)
  try {
    const coinMap = {
      BTCUSDT:"bitcoin",ETHUSDT:"ethereum",BNBUSDT:"binancecoin",SOLUSDT:"solana",
      XRPUSDT:"ripple",ADAUSDT:"cardano",DOGEUSDT:"dogecoin",AVAXUSDT:"avalanche-2",
      MATICUSDT:"matic-network",DOTUSDT:"polkadot",LINKUSDT:"chainlink",UNIUSDT:"uniswap",
      ATOMUSDT:"cosmos",LTCUSDT:"litecoin",NEARUSDT:"near",APTUSDT:"aptos",
      ARBUSDT:"arbitrum",OPUSDT:"optimism",INJUSDT:"injective-protocol",SUIUSDT:"sui"
    };
    const id = coinMap[sym];
    if (!id) return false;
    const r = await fetchT(`https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=7`, {headers:{"User-Agent":"ProTrader/1.0"}}, 10000);
    if (!r.ok) return false;
    const data = await r.json();
    if (!Array.isArray(data) || data.length < 30) return false;
    cryptoCandles[sym] = data.map(c=>({
      open:+c[1], high:+c[2], low:+c[3], close:+c[4], volume:0
    }));
    console.log(`  ₿ ${sym}: using CoinGecko data (${data.length} candles)`);
    return true;
  } catch(e) { return false; }
}

// Fetch live prices — try multiple Binance endpoints
async function fetchCryptoPricesREST() {
  const syms = JSON.stringify(CRYPTO_UNIVERSE.map(c=>c.sym));
  const endpoints = [
    `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(syms)}`,
    `https://api1.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(syms)}`,
    `https://api2.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(syms)}`,
    `https://api3.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(syms)}`,
  ];
  for (const url of endpoints) {
    try {
      const r = await fetchT(url, {headers:{"User-Agent":"Mozilla/5.0"}});
      if (!r.ok) continue;
      const data = await r.json();
      if (!Array.isArray(data)) continue;
      data.forEach(t=>{
        cryptoPrices[t.symbol]={
          price:+t.lastPrice, change24h:+t.priceChangePercent,
          high:+t.highPrice, low:+t.lowPrice,
          volume:+t.volume, quoteVolume:+t.quoteVolume
        };
        if(cryptoCandles[t.symbol]?.length)
          cryptoCandles[t.symbol][cryptoCandles[t.symbol].length-1].close=+t.lastPrice;
      });
      cryptoWSActive = true;
      broadcast({type:"crypto_tick", prices:cryptoPrices});
      console.log(`₿ Prices updated — ${data.length} pairs`);
      return;
    } catch(e) { continue; }
  }
  // CoinGecko fallback for prices
  try {
    const ids="bitcoin,ethereum,binancecoin,solana,ripple,cardano,dogecoin,avalanche-2,matic-network,polkadot,chainlink,uniswap,cosmos,litecoin,near,aptos,arbitrum,optimism,injective-protocol,sui";
    const r=await fetchT(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`, {headers:{"User-Agent":"ProTrader/1.0"}}, 10000);
    if(!r.ok) return;
    const data=await r.json();
    const symToId={BTCUSDT:"bitcoin",ETHUSDT:"ethereum",BNBUSDT:"binancecoin",SOLUSDT:"solana",
      XRPUSDT:"ripple",ADAUSDT:"cardano",DOGEUSDT:"dogecoin",AVAXUSDT:"avalanche-2",
      MATICUSDT:"matic-network",DOTUSDT:"polkadot",LINKUSDT:"chainlink",UNIUSDT:"uniswap",
      ATOMUSDT:"cosmos",LTCUSDT:"litecoin",NEARUSDT:"near",APTUSDT:"aptos",
      ARBUSDT:"arbitrum",OPUSDT:"optimism",INJUSDT:"injective-protocol",SUIUSDT:"sui"};
    Object.entries(symToId).forEach(([sym,id])=>{
      if(data[id]) cryptoPrices[sym]={
        price:data[id].usd, change24h:data[id].usd_24h_change||0,
        high:data[id].usd, low:data[id].usd, volume:0, quoteVolume:0
      };
    });
    cryptoWSActive=true;
    broadcast({type:"crypto_tick",prices:cryptoPrices});
    console.log("₿ Prices from CoinGecko fallback");
  } catch(e){ console.log("₿ All price sources failed:", e.message); }
}

function startCryptoTicker() {
  console.log("₿ Starting crypto price polling (60s interval)...");
  fetchCryptoPricesREST();
  setInterval(fetchCryptoPricesREST, 60000);
}

// Crypto strategy — same logic but wider thresholds (crypto is volatile)
function scoreCrypto(closes) {
  if (closes.length < 30) return { total: 0, bd: {} };
  const n = closes.length - 1;
  const e9  = ema(closes, 9),  e21 = ema(closes, 21);
  const r   = rsi(closes, 14);
  const bbs = bollingerBands(closes, 20);
  const [le9, le21, pe9, pe21] = [e9[n], e21[n], e9[n-1], e21[n-1]];
  const [lp, lr, lbb] = [closes[n], r[n], bbs[n]];
  const vwapVal = closes.slice(-20).reduce((a,b)=>a+b,0)/Math.min(20,closes.length);
  const bd = {}; let total = 0;

  // EMA — wider for crypto
  let emaS = le9>le21?2:le9<le21?-2:0;
  if(pe9<=pe21&&le9>le21) emaS=3;
  if(pe9>=pe21&&le9<le21) emaS=-3;
  bd.ema=emaS; total+=emaS;

  // RSI — wider thresholds for crypto
  const rsiS=lr<25?3:lr<35?2:lr<45?1:lr>75?-3:lr>65?-2:lr>55?-1:0;
  bd.rsi=rsiS; total+=rsiS;

  // BB
  const range=lbb.up-lbb.lo;
  const pos=range>0?(lp-lbb.lo)/range:.5;
  const bbS=pos<.1?2:pos<.25?1:pos>.9?-2:pos>.75?-1:0;
  bd.bb=bbS; total+=bbS;

  // VWAP
  const vwapS=lp>vwapVal*1.01?1:lp<vwapVal*.99?-1:0;
  bd.vwap=vwapS; total+=vwapS;

  return {total, bd, rsi:lr, price:lp};
}

const CRYPTO_CONFIG = {
  BUY_SCORE:        3,      // lowered from 4 — easier to trigger
  SELL_SCORE:      -2,
  MAX_POSITIONS:    5,
  CAPITAL_PER_TRADE:5000,
  SL_PCT:           3.0,
  TGT_PCT:          6.0,
};

async function scanCrypto() {
  console.log(`\n₿ Crypto scan at ${new Date().toLocaleTimeString("en-IN")}...`);
  let signals = 0, scanned = 0, skipped = 0;

  // Refresh all prices first
  await fetchCryptoPricesREST();

  const { rows: openTrades } = await pool.query("SELECT * FROM crypto_trades WHERE status='OPEN'");

  for (const coin of CRYPTO_UNIVERSE) {
    try {
      // Fetch/refresh candles
      if (!cryptoCandles[coin.sym] || cryptoCandles[coin.sym].length < 30) {
        const ok = await fetchCryptoCandles(coin.sym);
        if (!ok) { skipped++; await delay(300); continue; }
        await delay(200);
      }
      const closes = cryptoCandles[coin.sym]?.map(c=>c.close) || [];
      if (closes.length < 30) { skipped++; continue; }
      scanned++;

      const price = cryptoPrices[coin.sym]?.price || closes[closes.length-1];
      if (!price || price<=0) { skipped++; continue; }

      const {total, bd} = scoreCrypto(closes);
      const openPos = openTrades.find(t=>t.symbol===coin.sym);

      console.log(`  ₿ ${coin.base}: $${price.toFixed(4)} | score:${total} | ${Object.entries(bd).map(([k,v])=>`${k}:${v>=0?"+":""}${v}`).join(" ")}`);

      if (openPos) {
        const cmp    = price;
        const hitSL  = cmp <= parseFloat(openPos.stop_loss);
        const hitTgt = cmp >= parseFloat(openPos.target);
        const sellSig= total <= CRYPTO_CONFIG.SELL_SCORE;
        if (hitSL || hitTgt || sellSig) {
          const pnl    = +((cmp-openPos.price)*openPos.quantity).toFixed(2);
          const pnlPct = +((cmp-openPos.price)/openPos.price*100).toFixed(2);
          const reason = hitSL?"Stop Loss":hitTgt?"Target Hit":"Sell Signal";
          await pool.query(
            `UPDATE crypto_trades SET status='CLOSED',exit_price=$1,exit_time=NOW(),pnl=$2,pnl_pct=$3,exit_reason=$4 WHERE id=$5`,
            [cmp,pnl,pnlPct,reason,openPos.id]
          );
          console.log(`  ₿ EXIT ${coin.sym} @ $${cmp} | ${reason} | ${pnl>=0?"+":""}$${pnl.toFixed(2)}`);
          // Remove from openTrades array
          const idx=openTrades.findIndex(t=>t.symbol===coin.sym);
          if(idx>-1) openTrades.splice(idx,1);
          signals++;
        }
      } else if (openTrades.filter(t=>t.status==="OPEN").length < CRYPTO_CONFIG.MAX_POSITIONS
                 && total >= CRYPTO_CONFIG.BUY_SCORE) {
        const qty    = +(CRYPTO_CONFIG.CAPITAL_PER_TRADE/price).toFixed(6);
        const sl     = +(price*(1-CRYPTO_CONFIG.SL_PCT/100)).toFixed(8);
        const target = +(price*(1+CRYPTO_CONFIG.TGT_PCT/100)).toFixed(8);
        const indStr = Object.entries(bd).map(([k,v])=>`${k}:${v>=0?"+":""}${v}`).join(" ");
        await pool.query(
          `INSERT INTO crypto_trades (symbol,name,type,price,quantity,capital,entry_time,stop_loss,target,signal_score,strategy,regime,indicators,status)
           VALUES ($1,$2,'BUY',$3,$4,$5,NOW(),$6,$7,$8,$9,'CRYPTO_MULTI','CRYPTO',$10,'OPEN')`,
          [coin.sym,coin.name,price,qty,CRYPTO_CONFIG.CAPITAL_PER_TRADE,sl,target,total,indStr]
        );
        openTrades.push({symbol:coin.sym,status:"OPEN"});
        console.log(`  ₿ BUY  ${coin.sym} @ $${price} | Score:${total} | SL:$${sl} | TGT:$${target}`);
        signals++;
      }
    } catch(e) { console.error(`  ₿ ${coin.sym}: ${e.message}`); skipped++; }
  }
  console.log(`₿ Done — scanned:${scanned} skipped:${skipped} signals:${signals}\n`);
}

// ── Crypto API endpoints ───────────────────────────────────────────────────────
app.get("/crypto/prices", (req,res) => res.json(cryptoPrices));
app.get("/crypto/universe",(req,res) => res.json(CRYPTO_UNIVERSE));

app.get("/crypto/trades", async(req,res) => {
  try { const{rows}=await pool.query("SELECT * FROM crypto_trades ORDER BY entry_time DESC LIMIT 200"); res.json(rows); }
  catch(e) { res.status(500).json({error:e.message}); }
});

app.get("/crypto/trades/stats", async(req,res) => {
  try {
    const{rows}=await pool.query(`
      SELECT
        COUNT(*) AS total_trades,
        COUNT(CASE WHEN status='CLOSED' AND pnl>0 THEN 1 END) AS wins,
        COUNT(CASE WHEN status='CLOSED' AND pnl<=0 THEN 1 END) AS losses,
        COUNT(CASE WHEN status='OPEN' THEN 1 END) AS open_trades,
        COALESCE(SUM(CASE WHEN status='CLOSED' THEN pnl END),0) AS total_pnl,
        COALESCE(AVG(CASE WHEN status='CLOSED' AND pnl>0 THEN pnl END),0) AS avg_win,
        COALESCE(AVG(CASE WHEN status='CLOSED' AND pnl<=0 THEN pnl END),0) AS avg_loss,
        COALESCE(MAX(CASE WHEN status='CLOSED' THEN pnl END),0) AS best_trade,
        COALESCE(MIN(CASE WHEN status='CLOSED' THEN pnl END),0) AS worst_trade
      FROM crypto_trades`);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post("/crypto/scan-now", (req,res) => { res.json({message:"Crypto scan started"}); scanCrypto(); });

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  await initDB();
  initKite(process.env.KITE_ACCESS_TOKEN||null);
  if (process.env.KITE_ACCESS_TOKEN) {
    console.log("✅ Token found — starting smart engine...");
    startTicker(process.env.KITE_ACCESS_TOKEN);
    await refreshInstruments();  // fetch real tokens from Kite
    setTimeout(scanAndTrade, 5000);
  } else {
    console.log("⚠️  No token — visit /auth/login");
  }
  // NSE: every 3 min during market hours Mon–Fri
  cron.schedule("*/3 9-15 * * 1-5", ()=>scanAndTrade(), {timezone:"Asia/Kolkata"});
  cron.schedule("15 9 * * 1-5",     ()=>scanAndTrade(), {timezone:"Asia/Kolkata"});
  // Refresh instrument tokens daily at 9:00 AM
  cron.schedule("0 9 * * 1-5", ()=>refreshInstruments(), {timezone:"Asia/Kolkata"});

  // Crypto: start immediately, run 24/7 every 15 minutes
  console.log("₿ Starting crypto engine — 24/7...");
  startCryptoTicker(); // REST polling every 60s
  setTimeout(scanCrypto, 10000); // first scan after 10s
  cron.schedule("*/15 * * * *", ()=>scanCrypto());

  const PORT=process.env.PORT||3001;
  server.listen(PORT, ()=>{
    console.log(`\n✅ ProTrader running on port ${PORT}`);
    console.log(`   📊 NSE: ${UNIVERSE.length} stocks (Nifty50 + Next50 + Midcap)`);
    console.log(`   ₿  Crypto: ${CRYPTO_UNIVERSE.length} pairs (Binance, 24/7, free)`);
    console.log(`   🔄 NSE: every 3 min | Crypto: every 15 min`);
    console.log(`   📈 Max: ${CONFIG.MAX_POSITIONS} NSE + ${CRYPTO_CONFIG.MAX_POSITIONS} crypto\n`);
  });
}

start();
