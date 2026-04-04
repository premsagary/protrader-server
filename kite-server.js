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
function pctRank(val, arr, higher=true) {
  if (val==null || !arr || !arr.length) return null;
  const below = arr.filter(v => v < val).length;
  const r = below / arr.length * 100;
  return higher ? r : 100 - r;
}
function pts(pct, mx) {
  if (pct==null) return 0;
  return Math.round(pct/100*mx*10)/10;
}

// ── AMC quality scores (Morningstar Stewardship Pillar) ──────────
const AMC_QUAL = {
  "PPFAS":10,"HDFC":9,"Nippon":9,"ICICI":8,"SBI":8,"Kotak":8,
  "DSP":8,"Mirae":8,"UTI":7,"Canara":7,"Motilal":7,"Edelweiss":7,
  "Tata":7,"Invesco":7,"PGIM":7,"Sundaram":7,"Bandhan":6,
  "Franklin":6,"Aditya Birla":6,"Axis":5,"Quant":2,"WhiteOak":7,
  "JM":6,"360 ONE":6,"ITI":5,"HSBC":7,"Baroda":6,"LIC":5,
  "Mahindra":6,"Bank of India":5,"Old Bridge":6,"Navi":4,
  "NJ":5,"Samco":4,"Union":6,"Helios":5,"Trust":5,"Bajaj":5,
  "Abakkus":5,"Capitalmind":6,"Unifi":5,"WOC":7,"iSIF":3,"Qsif":3,
  "Shriram":4,"Taurus":3,"Jio":5,"Wealth":3,"Quantum":6,
  "Groww":4,"TRUSTMF":5,
};
const AMC_SEBI = {
  "Quant":"probe","Axis":"action","Aditya Birla":"minor",
  "HDFC":"minor","Franklin":"minor","Qsif":"probe"
};
function getAmcQual(amcFull) {
  const up = (amcFull||'').toUpperCase();
  const key = Object.keys(AMC_QUAL).find(k => up.includes(k.toUpperCase())) || '';
  const score = key ? AMC_QUAL[key] : 5;
  const sebiKey = Object.keys(AMC_SEBI).find(k => up.includes(k.toUpperCase())) || '';
  const sebi = sebiKey ? AMC_SEBI[sebiKey] : 'clean';
  const warnings = {
    "probe": "Active SEBI investigation (2024)",
    "action": "Past SEBI enforcement action (2022)",
    "minor": "Minor SEBI fine on record",
  };
  return { key, score, sebi, warning: warnings[sebi]||null };
}

// ── Category-specific AUM sweet spots ───────────────────────────
// Small cap >₹15K Cr = can't find enough small cap stocks to deploy
const CAT_AUM = {
  'Small Cap Fund':  [1000, 15000],
  'Mid Cap Fund':    [1000, 40000],
  'Flexi Cap Fund':  [2000, 100000],
};

// ── Distributions built from ELIGIBLE funds only ─────────────────
// Populated at startup in /api/mf/funds endpoint
let CAT_DIST = {};

// ── STEP 1: HARD ELIGIBILITY FILTERS ─────────────────────────────
// Any fund failing ANY filter = not scored (shown in table as Not Eligible)
function checkEligible(f) {
  const reasons = [];
  const aum     = parseFloat(f.aum)     || 0;
  const months  = parseFloat(f.months_inception) || 0;
  const roll    = parseFloat(f.rolling_3y) || 0;
  const exp     = parseFloat(f.expense_ratio) || 0;
  const r3      = parseFloat(f.cagr_3y) || 0;

  if (aum < 1000)    reasons.push(`AUM ₹${Math.round(aum)} Cr < ₹1,000 Cr minimum`);
  if (months < 60)   reasons.push(`Only ${Math.round(months)} months old (need 5Y minimum)`);
  if (!roll)         reasons.push('No 3Y rolling return data (insufficient history)');
  if (!r3)           reasons.push('No 3Y return data');
  if (exp >= 2.0)    reasons.push(`Expense ratio ${exp.toFixed(2)}% >= 2% (too expensive)`);

  return { eligible: reasons.length === 0, reasons };
}

// ── STEP 2: SCORING ENGINE ────────────────────────────────────────
// Only runs on funds that passed eligibility
// Max ~120 pts (percentile-based within category, eligible funds only)
function scoreMFTickertape(f) {
  const subcat  = f.sub_category || '';
  const cat     = subcat.includes('Small') ? 'smallcap' : subcat.includes('Mid') ? 'midcap' : 'flexicap';
  const dist    = CAT_DIST[subcat] || {};
  const months  = parseFloat(f.months_inception) || 0;
  const [aumMin, aumMax] = CAT_AUM[subcat] || [1000, 50000];
  let score = 0;
  const hits = {};

  function get(col) {
    const v = f[col]; if (v==null) return null;
    const n = parseFloat(v); return isNaN(n) ? null : n;
  }
  function pr(val, arr, higher=true) { return pctRank(val, arr, higher); }

  // 1. ROLLING 3Y CONSISTENCY (25 pts) ─────────────────────────────
  // #1 predictor. Average return across ALL rolling 3Y windows.
  const roll = get('rolling_3y');
  const rollP = (roll && roll > 0) ? pr(roll, dist.rolling_3y) : null;
  const rollPts = pts(rollP, 25);
  score += rollPts;
  hits[`Rolling 3Y: ${roll!=null?roll.toFixed(1):'?'}% (top ${rollP!=null?(100-rollP).toFixed(0):'?'}% of eligible funds)`] = rollPts;

  // 2. RISK-ADJUSTED RETURNS (20 pts) ──────────────────────────────
  // Sharpe + Sortino both percentile-ranked within category.
  // Never use absolute thresholds — all negative in bear markets.
  const sharpe  = get('sharpe');
  const sortino = get('sortino');
  const shP  = pr(sharpe,  dist.sharpe,  true);
  const soP  = pr(sortino, dist.sortino, true);
  const shPts = pts(shP, 12);
  const soPts = pts(soP, 8);
  score += shPts + soPts;
  hits[`Sharpe: ${sharpe!=null?sharpe.toFixed(3):'?'} (top ${shP!=null?(100-shP).toFixed(0):'?'}% in category)`] = shPts;
  hits[`Sortino: ${sortino!=null?sortino.toFixed(4):'?'} (top ${soP!=null?(100-soP).toFixed(0):'?'}% in category)`] = soPts;

  // 3. DOWNSIDE PROTECTION (15 pts) ────────────────────────────────
  // Max drawdown = worst single crash fall. Volatility = daily swing.
  // Both lower-is-better, percentile vs eligible peers.
  const mdd    = get('max_drawdown');
  const vol    = get('volatility');
  const catVol = get('category_stddev') || 16;
  const mddP   = pr(mdd, dist.max_drawdown, false);
  const volP   = pr(vol, dist.volatility,   false);
  const mddPts = pts(mddP, 9);
  const volPts = pts(volP, 6);
  score += mddPts + volPts;
  hits[`Max drawdown: ${mdd!=null?mdd.toFixed(1):'?'}% (top ${mddP!=null?(100-mddP).toFixed(0):'?'}% protected)`] = mddPts;
  hits[`Volatility: ${vol!=null?vol.toFixed(1):'?'}% vs category avg ${catVol.toFixed(1)}%`] = volPts;

  // 4. BEATS PEERS (15 pts) ─────────────────────────────────────────
  // vs_cat_3Y/5Y/10Y are RATIOS (>1.0 = beats median peer).
  // Purest measure of manager skill. vs_cat_1Y excluded (wrong scale).
  const vc3  = get('vs_cat_3y');
  const vc5  = get('vs_cat_5y');
  const vc10 = get('vs_cat_10y');
  const vc3P  = (vc3  && vc3  > 0) ? pr(vc3,  dist.vs_cat_3y)  : null;
  const vc5P  = (vc5  && vc5  > 0) ? pr(vc5,  dist.vs_cat_5y  || dist.vs_cat_3y)  : null;
  const vc10P = (vc10 && vc10 > 0) ? pr(vc10, dist.vs_cat_10y || dist.vs_cat_5y) : null;
  const vc3Pts  = pts(vc3P,  8);
  const vc5Pts  = pts(vc5P,  5);
  const vc10Pts = pts(vc10P, 2);
  score += vc3Pts + vc5Pts + vc10Pts;
  hits[vc3  ? `Beats peers 3Y: ${vc3.toFixed(2)}x (${vc3>1?'above':'below'} median)` : 'Beats peers 3Y: no data'] = vc3Pts;
  hits[vc5  ? `Beats peers 5Y: ${vc5.toFixed(2)}x` : 'Beats peers 5Y: no data'] = vc5Pts;
  if (vc10 && vc10 > 0) hits[`Beats peers 10Y: ${vc10.toFixed(2)}x`] = vc10Pts;

  // 5. EXPENSE RATIO (12 pts) ───────────────────────────────────────
  // Most reliable long-term predictor per Morningstar/VR.
  // 0.5% diff = ₹8-12 lakh less on ₹10L over 20 years.
  const exp  = get('expense_ratio');
  const expP = (exp && exp > 0) ? pr(exp, dist.expense, false) : null;
  const expPts = pts(expP, 12);
  score += expPts;
  const expTier = exp ? (exp<0.5?'very low':exp<0.75?'low':exp<1.0?'average':'high') : '?';
  hits[`Expense: ${exp!=null?exp.toFixed(2):'?'}% (${expTier})`] = expPts;

  // 6. ABSOLUTE RETURNS (8 pts) ─────────────────────────────────────
  // Lower weight — point-in-time returns have low predictive power.
  const r3  = get('cagr_3y');
  const r5  = get('cagr_5y');
  const r10 = get('cagr_10y');
  const r3P  = (r3  && r3  > 0) ? pr(r3,  dist.cagr_3y)  : null;
  const r5P  = (r5  && r5  > 0) ? pr(r5,  dist.cagr_5y  || dist.cagr_3y) : null;
  const r10P = (r10 && r10 > 0) ? pr(r10, dist.cagr_10y || dist.cagr_5y) : null;
  const r3Pts  = pts(r3P,  4);
  const r5Pts  = pts(r5P,  3);
  const r10Pts = pts(r10P, 1);
  score += r3Pts + r5Pts + r10Pts;
  hits[r3  ? `3Y CAGR: ${r3.toFixed(1)}%`  : '3Y CAGR: no data']  = r3Pts;
  hits[r5  ? `5Y CAGR: ${r5.toFixed(1)}%`  : '5Y CAGR: no data']  = r5Pts;
  if (r10 && r10 > 0) hits[`10Y CAGR: ${r10.toFixed(1)}%`] = r10Pts;

  // 7. PORTFOLIO QUALITY (8 pts) ────────────────────────────────────
  // PE vs category: lower = better value. Cash 3-10%: healthy buffer.
  // Top10 concentration: lower = less single-stock risk.
  // ATH recovery: closer to all-time high = stronger fund momentum.
  const pe    = get('pe_ratio');
  const catPE = get('category_pe') || 30;
  const peP   = (pe && pe > 0) ? pr(pe, dist.pe, false) : null;
  const pePts = pts(peP, 2);
  score += pePts;
  if (pe) hits[`Portfolio PE: ${pe.toFixed(1)} vs category ${catPE.toFixed(1)}`] = pePts;

  const cash = get('pct_cash') || 0;
  if (cash >= 3 && cash <= 10) { score += 2; hits[`Cash: ${cash.toFixed(1)}% (healthy buffer)`] = 2; }
  else if (cash > 0 && cash < 3) { score += 1; hits[`Cash: ${cash.toFixed(1)}%`] = 1; }
  else if (cash > 20) hits[`Cash: ${cash.toFixed(1)}% (excess — uncertain market view?)`] = 0;

  const top10  = get('top10_conc') || 0;
  const top10P = (top10 > 0) ? pr(top10, dist.top10, false) : null;
  const top10Pts = pts(top10P, 1);
  score += top10Pts;
  if (top10) hits[`Top 10 holdings: ${top10.toFixed(1)}% concentration`] = top10Pts;

  // % Away from ATH (2 pts) — 100% data coverage
  // Measures how much the fund has recovered vs its own all-time high.
  // Lower = better (0% = at ATH, 28% = 28% below peak).
  // Rewards funds that have held up or recovered well in the 2024-25 correction.
  const ath = get('pct_from_ath');
  if (ath != null) {
    const athP = pr(ath, dist.pct_from_ath, false); // lower ATH gap = better
    const athPts = pts(athP, 2);
    score += athPts;
    const athLabel = ath <= 5 ? 'near ATH' : ath <= 15 ? 'moderate recovery' : 'significant drawdown';
    hits[`From ATH: ${ath.toFixed(1)}% below peak (${athLabel})`] = athPts;
  }

  // Volatility vs Category StdDev bonus (1 pt) — 100% data coverage
  // Funds that deliver lower volatility than category average are
  // demonstrating better risk management, not just riding the beta.
  const vol2    = get('volatility');
  const catVol2 = get('category_stddev');
  if (vol2 && catVol2 && vol2 < catVol2) {
    const outperformance = catVol2 - vol2;
    const volBonusPts = outperformance > 2 ? 1 : 0.5;
    score += volBonusPts;
    hits[`Volatility below category avg: ${vol2.toFixed(1)}% vs ${catVol2.toFixed(1)}% (better risk control)`] = volBonusPts;
  }

  // Style drift penalty for Mid Cap funds only (up to -2 pts)
  // Mid cap funds holding >25% small cap are taking hidden risk beyond mandate.
  // Flexi cap funds CAN legitimately hold small cap — no penalty for them.
  if (subcat.includes('Mid')) {
    const smallCapPct = get('pct_smallcap') || 0;
    if (smallCapPct > 27) {
      score -= 2;
      hits[`Style drift: ${smallCapPct.toFixed(1)}% in small cap for a mid cap fund (mandate breach)`] = -2;
    } else if (smallCapPct > 20) {
      score -= 1;
      hits[`Style drift: ${smallCapPct.toFixed(1)}% in small cap (elevated for mid cap fund)`] = -1;
    }
  }

  // 8. AUM QUALITY (5 pts) ──────────────────────────────────────────
  // Category-specific sweet spots.
  // Small cap >₹15K Cr = liquidity constrained, can't find stocks.
  const aum = get('aum_cr') || 0;
  if (aum >= aumMin && aum <= aumMax) {
    score += 5; hits[`AUM ₹${Math.round(aum).toLocaleString('en-IN')} Cr (ideal range)`] = 5;
  } else if (aum > aumMax) {
    const p = subcat.includes('Small') ? 2 : 4;
    score += p;
    hits[`AUM ₹${Math.round(aum).toLocaleString('en-IN')} Cr ${subcat.includes('Small') ? '(too large — liquidity risk for small cap)' : '(large, established fund)'}`] = p;
  } else if (aum >= aumMin * 0.5) {
    score += 3; hits[`AUM ₹${Math.round(aum).toLocaleString('en-IN')} Cr (below ideal, growing)`] = 3;
  } else if (aum > 0) {
    score += 1; hits[`AUM ₹${Math.round(aum).toLocaleString('en-IN')} Cr (small fund)`] = 1;
  }

  // 9. TRACK RECORD (5 pts) ─────────────────────────────────────────
  // All eligible funds are 5Y+ (filter ensures this).
  // 10Y = full bull+bear cycle including 2020 crash + 2024-25 correction.
  if      (months >= 120) { score += 5; hits[`Track record: ${Math.round(months)} months (10Y+ full cycle)`] = 5; }
  else if (months >= 84)  { score += 4; hits[`Track record: ${Math.round(months)} months (7Y+)`] = 4; }
  else if (months >= 60)  { score += 3; hits[`Track record: ${Math.round(months)} months (5Y minimum)`] = 3; }

  // 10. AMC QUALITY (10 pts) ────────────────────────────────────────
  // Morningstar Stewardship Pillar: governance, team depth, SEBI record.
  const qual = getAmcQual(f.amc || '');
  const amcPts = Math.round(qual.score / 10 * 10 * 10) / 10;
  score += amcPts;
  hits[`AMC ${qual.key||'?'}: ${qual.score}/10 (governance & stewardship)`] = amcPts;
  if (qual.warning) hits[`Flagged: ${qual.warning}`] = 0;

  // SEBI penalties applied to final score
  if      (qual.sebi === 'probe')  { score = Math.min(score, 15); hits['DISQUALIFIED: Active SEBI investigation (capped at 15)'] = 0; }
  else if (qual.sebi === 'action') { score = Math.round(score * 0.85 * 10)/10; hits['Past SEBI enforcement action: -15% score penalty'] = 0; }
  else if (qual.sebi === 'minor')  { score = Math.round(score * 0.95 * 10)/10; hits['Minor SEBI fine on record: -5% score penalty'] = 0; }

  return {
    score: Math.round(score * 10) / 10,
    hits,
    cat,
    amc_sebi:    qual.sebi,
    amc_warning: qual.warning,
    amc_note:    qual.note || null,
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
    const {rows} = await pool.query("SELECT * FROM mf_tickertape ORDER BY sub_category, name");
    if (!rows.length) throw new Error("No rows in mf_tickertape");

    // ── STEP 1: Map raw DB rows → fund objects ──────────────────────
    const pf = (v) => v!=null ? parseFloat(v) : null;
    const funds = rows.map(f => ({
      // identity
      name: f.name, sub_category: f.sub_category, amc: f.amc,
      benchmark: f.benchmark, fund_manager: f.fund_manager,
      sip_allowed: f.sip_allowed, sebi_risk: f.sebi_risk,
      // pricing
      nav: pf(f.nav), navFormatted: f.nav ? "₹"+parseFloat(f.nav).toFixed(2) : null,
      aum_cr: pf(f.aum), aum: pf(f.aum),
      // cost
      expense_ratio: pf(f.expense_ratio), min_lumpsum: pf(f.min_lumpsum),
      min_sip: pf(f.min_sip), exit_load: pf(f.exit_load),
      months_inception: pf(f.months_inception),
      // returns
      ret_1y: pf(f.ret_1y), ret_3m: pf(f.ret_3m), ret_6m: pf(f.ret_6m),
      cagr_3y: pf(f.cagr_3y), cagr_5y: pf(f.cagr_5y), cagr_10y: pf(f.cagr_10y),
      rolling_3y: pf(f.rolling_3y),
      // vs category (3Y/5Y/10Y are ratios, 1Y is absolute %)
      vs_cat_1y: pf(f.vs_cat_1y), vs_cat_3y: pf(f.vs_cat_3y),
      vs_cat_5y: pf(f.vs_cat_5y), vs_cat_10y: pf(f.vs_cat_10y),
      // risk
      sharpe: pf(f.sharpe), sortino: pf(f.sortino),
      volatility: pf(f.volatility), stdDev: pf(f.volatility),
      category_stddev: pf(f.category_stddev),
      max_drawdown: pf(f.max_drawdown), maxDD: pf(f.max_drawdown),
      pct_from_ath: pf(f.pct_from_ath), tracking_error: pf(f.tracking_error),
      // portfolio
      pe_ratio: pf(f.pe_ratio), category_pe: pf(f.category_pe),
      pct_equity: pf(f.pct_equity), pct_largecap: pf(f.pct_largecap),
      pct_midcap: pf(f.pct_midcap), pct_smallcap: pf(f.pct_smallcap),
      pct_cash: pf(f.pct_cash), pct_debt: pf(f.pct_debt),
      pct_a_bonds: pf(f.pct_a_bonds), pct_b_bonds: pf(f.pct_b_bonds),
      pct_corp_debt: pf(f.pct_corp_debt), pct_sovereign: pf(f.pct_sovereign),
      // concentration
      top3_conc: pf(f.top3_conc), top5_conc: pf(f.top5_conc), top10_conc: pf(f.top10_conc),
      dataSource: "Tickertape — Apr 4 2026",
    }));

    // ── STEP 2: ELIGIBILITY FILTER ──────────────────────────────────
    // Hard filters — any fail = fund not scored
    // Filters: AUM ≥₹1K Cr, Age ≥5Y, 3Y rolling data exists, expense <2%
    const eligible   = funds.filter(f => checkEligible(f).eligible);
    const ineligible = funds.filter(f => !checkEligible(f).eligible);

    // ── STEP 3: BUILD DISTRIBUTIONS FROM ELIGIBLE FUNDS ONLY ────────
    // Critical: distributions must NOT include unproven small/new funds
    CAT_DIST = {};
    const distCols = {
      rolling_3y:    f => f.rolling_3y  && f.rolling_3y  > 0 ? f.rolling_3y  : null,
      sharpe:        f => f.sharpe  != null ? f.sharpe  : null,
      sortino:       f => f.sortino != null ? f.sortino : null,
      volatility:    f => f.volatility   && f.volatility   > 0 ? f.volatility   : null,
      max_drawdown:  f => f.max_drawdown && f.max_drawdown > 0 ? f.max_drawdown : null,
      cagr_3y:       f => f.cagr_3y  && f.cagr_3y  > 0 ? f.cagr_3y  : null,
      cagr_5y:       f => f.cagr_5y  && f.cagr_5y  > 0 ? f.cagr_5y  : null,
      cagr_10y:      f => f.cagr_10y && f.cagr_10y > 0 ? f.cagr_10y : null,
      vs_cat_3y:     f => f.vs_cat_3y  && f.vs_cat_3y  > 0 ? f.vs_cat_3y  : null,
      vs_cat_5y:     f => f.vs_cat_5y  && f.vs_cat_5y  > 0 ? f.vs_cat_5y  : null,
      vs_cat_10y:    f => f.vs_cat_10y && f.vs_cat_10y > 0 ? f.vs_cat_10y : null,
      expense:       f => f.expense_ratio && f.expense_ratio > 0 ? f.expense_ratio : null,
      pe:            f => f.pe_ratio && f.pe_ratio > 0 ? f.pe_ratio : null,
      top10:         f => f.top10_conc && f.top10_conc > 0 ? f.top10_conc : null,
      pct_from_ath:  f => f.pct_from_ath != null ? f.pct_from_ath : null,
    };
    eligible.forEach(f => {
      const subcat = f.sub_category;
      if (!CAT_DIST[subcat]) CAT_DIST[subcat] = Object.fromEntries(Object.keys(distCols).map(k=>[k,[]]));
      Object.entries(distCols).forEach(([col, fn]) => {
        const v = fn(f); if (v != null) CAT_DIST[subcat][col].push(v);
      });
    });

    // ── STEP 4: SCORE ELIGIBLE FUNDS ────────────────────────────────
    const scoredEligible = eligible.map(f => {
      const {score, hits, cat, amc_sebi, amc_warning, amc_note} = scoreMFTickertape(f);
      return {...f, score, hits, cat, amc_sebi, amc_warning, amc_note, eligible: true, filter_reasons: []};
    });

    // ── STEP 5: MARK INELIGIBLE FUNDS (shown in table, not scored) ──
    const scoredIneligible = ineligible.map(f => {
      const subcat = f.sub_category || '';
      const cat = subcat.includes('Small') ? 'smallcap' : subcat.includes('Mid') ? 'midcap' : 'flexicap';
      const {reasons} = checkEligible(f);
      const qual = getAmcQual(f.amc || '');
      return {...f, score: null, hits: {}, cat,
        amc_sebi: qual.sebi, amc_warning: qual.warning, amc_note: null,
        eligible: false, filter_reasons: reasons};
    });

    // ── STEP 6: SORT — eligible by score desc, ineligible by name ───
    const allFunds = [...scoredEligible, ...scoredIneligible];
    allFunds.sort((a,b) => {
      if (a.sub_category !== b.sub_category) return a.sub_category.localeCompare(b.sub_category);
      if (a.eligible && !b.eligible) return -1;
      if (!a.eligible && b.eligible) return 1;
      return (b.score||0) - (a.score||0);
    });

    return res.json({
      funds: allFunds,
      total: allFunds.length,
      eligible_count: scoredEligible.length,
      not_eligible_count: scoredIneligible.length,
      source: "Tickertape CSV — Apr 4 2026",
      filters: "AUM ≥₹1,000 Cr · Age ≥5Y · 3Y rolling data · Expense <2%",
      cached_at: Date.now()
    });

  } catch(e) {
    console.log("Tickertape DB not ready:", e.message);
    const funds = Object.values(mfCache);
    if (funds.length > 0) return res.json({funds, total:funds.length, source:"MFAPI (fallback)", cached_at:mfCacheTime});
    res.status(503).json({error:"No MF data. Run mf_load_v2.sql in Railway PostgreSQL.", funds:[], total:0});
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
