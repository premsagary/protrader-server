/**
 * ProTrader - Smart Multi-Strategy Engine v3
 * ============================================
 * Strategies:
 *   1. EMA Crossover      - trending markets
 *   2. RSI Mean Reversion - ranging/oversold markets
 *   3. Bollinger Squeeze  - low volatility breakouts
 *   4. VWAP Momentum      - intraday institutional flow
 *   5. Supertrend         - strong directional moves
 *   6. Opening Range      - first 30min breakout (9:15-9:45)
 *   7. Volume Spike       - unusual volume = smart money
 *
 * Market Regime Detection:
 *   TRENDING   -> uses EMA Crossover + Supertrend
 *   RANGING    -> uses RSI Mean Reversion + Bollinger
 *   BREAKOUT   -> uses Bollinger Squeeze + Volume Spike
 *   MOMENTUM   -> uses VWAP Momentum + Opening Range
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

// -- DB ------------------------------------------------------------------------
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
      CREATE TABLE IF NOT EXISTS app_config (
        key   VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
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

// -- Kite ----------------------------------------------------------------------
let kite = null;
function initKite(token) {
  const { KiteConnect } = require("kiteconnect");
  kite = new KiteConnect({ api_key: process.env.KITE_API_KEY });
  if (token) kite.setAccessToken(token);
  return kite;
}

// -- Persist config in DB (survives Railway restarts) -------------------------
async function dbGet(key) {
  try {
    const { rows } = await pool.query('SELECT value FROM app_config WHERE key=$1', [key]);
    return rows[0]?.value || null;
  } catch(e) { return null; }
}
async function dbSet(key, value) {
  try {
    await pool.query(
      `INSERT INTO app_config(key,value,updated_at) VALUES($1,$2,NOW())
       ON CONFLICT(key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [key, value]
    );
    return true;
  } catch(e) { return false; }
}

// -- WebSocket -----------------------------------------------------------------
const livePrices  = {};
const subscribers = new Set();
let   tickerOn    = false;
let   tokenValid  = false; // set true when ticker connects, false when error/disconnect
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
    tokenValid = true;
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
  t.on("error", () => { console.log("Ticker error"); tokenValid = false; });
  t.on("close", () => { tickerOn = false; broadcast({ type:"status", connected:false }); });
}

// -- Universe - Nifty 50 + Next 50 + Midcap 150 (250 stocks) ------------------
const UNIVERSE = [
  // -- NIFTY 50 --
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
  // -- NIFTY NEXT 50 --
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

  // -- NIFTY MIDCAP 150 --
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
  // Midcap (instrument tokens - approximate, verify from Kite instruments API)
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



// ===============================================================================
// -- INDICATOR LIBRARY ---------------------------------------------------------
// ===============================================================================

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
  // Average Directional Index - measures trend strength 0-100
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

// ===============================================================================
// -- MARKET REGIME DETECTOR ----------------------------------------------------
// ===============================================================================

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

  // Opening range: first 30 minutes (9:15-9:45 IST)
  const ist  = new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
  const h=ist.getHours(), m=ist.getMinutes();
  const isOpeningRange = (h===9&&m>=15) || (h===9&&m<=45);

  let regime, reason, confidence;

  if (isOpeningRange && isVolumeSpike) {
    regime="MOMENTUM"; reason="Opening range + volume spike"; confidence=90;
  } else if (isSqueeze && priceChange > 0.5) {
    regime="BREAKOUT"; reason=`BB squeeze with ${priceChange.toFixed(1)}% move`; confidence=85;
  } else if (isTrending && priceChange > 1) {
    regime="TRENDING"; reason=`ADX ${adxVal.toFixed(0)} - strong trend`; confidence=80;
  } else if (isExtreme) {
    regime="RANGING"; reason=`RSI ${lastRSI.toFixed(0)} - extreme = mean reversion`; confidence=75;
  } else if (isRanging) {
    regime="RANGING"; reason=`ADX ${adxVal.toFixed(0)} - no clear trend`; confidence=65;
  } else if (isVolumeSpike) {
    regime="MOMENTUM"; reason="Unusual volume - smart money moving"; confidence=70;
  } else {
    regime="RANGING"; reason="Low ADX, normal volume"; confidence=50;
  }

  return { regime, reason, confidence, adx:adxVal.toFixed(1), rsi:lastRSI.toFixed(1), bw:(lastBB.bw*100).toFixed(2), volSpike:isVolumeSpike };
}

// ===============================================================================
// -- STRATEGY LIBRARY ----------------------------------------------------------
// ===============================================================================

// Strategy 1: EMA Crossover - for TRENDING markets
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

// Strategy 2: RSI Mean Reversion - for RANGING markets
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

// Strategy 3: Bollinger Squeeze Breakout - for BREAKOUT regime
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

// Strategy 4: VWAP Momentum - for MOMENTUM regime
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

// Strategy 5: Supertrend - for strong TRENDING markets
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

// Strategy 6: Opening Range Breakout - 9:15-9:45 AM only
function stratOpeningRange(candles) {
  // Uses first 6 candles (9:15-9:45 in 5-min bars)
  if (candles.length < 8) return { score:0, signal:"NEUTRAL", detail:"Not enough candles", strategy:"OPENING_RANGE" };
  const first6 = candles.slice(0,6);
  const orHigh = Math.max(...first6.map(c=>c.high));
  const orLow  = Math.min(...first6.map(c=>c.low));
  const lastClose = candles[candles.length-1].close;
  const orSize = (orHigh-orLow)/orLow*100;

  let score=0, detail=`OR: ${orLow.toFixed(0)}-${orHigh.toFixed(0)} `;
  if(orSize<0.5){detail+="(tight OR) ";}
  if(lastClose>orHigh){score+=5;detail+="BROKE ABOVE OR ";}
  else if(lastClose<orLow){score-=5;detail+="BROKE BELOW OR ";}
  else{detail+="inside OR ";}

  return { score, signal:score>=5?"BUY":score<=-5?"SELL":"NEUTRAL", detail, strategy:"OPENING_RANGE",
           sl:score>=5?orLow:null, tgt:score>=5?orHigh+(orHigh-orLow)*1.5:null };
}

// Strategy 7: Volume Spike - smart money detection
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

// ===============================================================================
// -- STRATEGY SELECTOR (the brain) ---------------------------------------------
// ===============================================================================

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

  // Weighted combination - primary strategy gets 50%, others 25% each
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

// ===============================================================================
// -- PAPER TRADING ENGINE ------------------------------------------------------
// ===============================================================================

const CONFIG = {
  BUY_SCORE:        2.5,
  SELL_SCORE:      -2.0,
  CONSENSUS_NEEDED: 2,
  CAPITAL_PER_TRADE:7500,
  MAX_POSITIONS:    10,   // increased from 3 to 10
  DEFAULT_SL_PCT:   1.5,
  DEFAULT_TGT_PCT:  3.0,
  SCAN_DELAY_MS:    250,  // faster scan - 250ms between stocks
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
        // -- Check exit --
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

        // -- Check entry --
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
      if (e.message && e.message.includes('api_key')) tokenValid = false;
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

// -- REST API ------------------------------------------------------------------

const path = require("path");

app.use(express.static(path.join(__dirname,"public")));
app.get("/", (req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

// -- Free News via RSS feeds ---------------------------------------------------
app.get("/api/news", async(req,res)=>{
  const sym = (req.query.sym||"RELIANCE").toUpperCase();
  const name = req.query.name||sym;

  // Free RSS feeds - no API key needed
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

// -- Fetch and cache valid instrument tokens from Kite -------------------------
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

// ===============================================================================
// -- MUTUAL FUND DATA ENGINE ----------------------------------------------------
// Sources: mfdata.in (ratios, AUM, expense) + mf.captnemo.in (Kuvera metadata)
//          + mfapi.in (NAV history for calculated returns)
// Cached in memory, refreshed daily at 6 AM IST
// ===============================================================================

// Fund universe - AMFI scheme codes (direct growth plans)
// Fund universe - auto-discovered from MFAPI, populated on startup
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
    console.log("⚠️ Universe discovery failed:", e.message, "- using seed list");
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

// -- Qualitative AMC scores - research-based (updated Apr 2026) ----------------
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

// -- AMC quality scores (Morningstar Stewardship Pillar) ----------
// -- DO NOT INVEST flags - research-based professional overlays -------
// Funds that pass eligibility filters but have specific disqualifying
// characteristics. Shown in red on cards with reason.
const DO_NOT_INVEST = {
  // 🔴 SEBI ACTIVE INVESTIGATIONS - capital at risk
  "Quant Small Cap Fund":      { level:"red",   short:"SEBI Investigation",         reason:"SEBI raided Quant AMC in 2024 for front-running. Active probe ongoing. Do not invest until resolved." },
  "Quant Mid Cap Fund":        { level:"red",   short:"SEBI Investigation",         reason:"SEBI raided Quant AMC in 2024 for front-running. Active probe ongoing. Do not invest until resolved." },
  "Quant Flexi Cap Fund":      { level:"red",   short:"SEBI Investigation",         reason:"SEBI raided Quant AMC in 2024 for front-running. Active probe ongoing. Do not invest until resolved." },
  // 🔴 EXTREME UNDERPERFORMERS
  "UTI Flexi Cap Fund":        { level:"red",   short:"Consistent Underperformer",  reason:"3Y CAGR only 8.5%, 5Y only 5.9%. Dead last among eligible flexi cap funds. No reason to hold when peers deliver 16-22%." },
  "LIC MF Flexi Cap Fund":     { level:"red",   short:"Worst Performer + Expensive",reason:"3Y CAGR 12.6%, 5Y 10%, 10Y 10.4% - worst long-term returns in flexi cap. Expense 1.59% is expensive for consistently poor results." },
  "SBI Small Cap Fund":        { level:"red",   short:"Too Large + Underperformer", reason:"AUM ₹35,000 Cr - far too large for small cap. Fund is forced to hold mid/large cap to deploy capital. 3Y CAGR 12.6%, ranked last among eligible small caps." },
  // ⚠️ SEBI ENFORCEMENT ACTIONS
  "Axis Flexi Cap Fund":       { level:"amber", short:"SEBI Enforcement Action",    reason:"Axis AMC had 21 entities barred by SEBI in 2022 - most serious action among eligible funds. 3Y CAGR only 13.6%, ranked #19 of 21 flexi caps." },
  "Axis Midcap Fund":          { level:"amber", short:"SEBI Enforcement Action",    reason:"Axis AMC 2022 enforcement action. Score already reduced 15%. Better mid cap alternatives exist at similar price." },
  "Axis Small Cap Fund":       { level:"amber", short:"SEBI Enforcement Action",    reason:"Axis AMC 2022 enforcement action. Despite decent 10Y numbers, governance concern remains. Better alternatives available." },
  "Aditya Birla SL Flexi Cap Fund":  { level:"amber", short:"SEBI Fine + Below Average",  reason:"SEBI minor fine on record. 3Y CAGR 16.6% is mediocre for the AMC's resources. Ranked #7 of 21 flexi caps." },
  "Aditya Birla SL Midcap Fund":     { level:"amber", short:"SEBI Fine + Underperformance",reason:"SEBI minor fine 2024. Sharpe -0.13, ranked #22 of 23 mid caps. Worst drawdown in mid cap at 45.1%." },
  "Aditya Birla SL Small Cap Fund":  { level:"amber", short:"SEBI Fine + Worst Drawdown",  reason:"SEBI fine on record. Maximum drawdown 57.4% - worst in eligible small cap universe. High risk, mediocre returns." },
  "Franklin India Flexi Cap Fund":   { level:"amber", short:"Reputation Risk + SEBI History",reason:"Franklin India's 2020 debt fund closure shook investor trust. SEBI fine on record. 3Y CAGR 16%, ranked #14 of 21. Choose peers instead." },
  "Franklin India Mid Cap Fund":     { level:"amber", short:"SEBI History + Below Average",  reason:"Franklin AMC SEBI history. 3Y CAGR 19.1% but ranked #17 of 23 mid caps. Multiple better alternatives exist." },
  "Franklin India Small Cap Fund":   { level:"amber", short:"SEBI History + Below Average",  reason:"Franklin AMC SEBI history. 3Y CAGR 16.8%, ranked #13 of 21 small caps. Better small cap options available." },
  // ⚠️ AUM TOO LARGE FOR CATEGORY
  "HDFC Small Cap Fund":       { level:"amber", short:"AUM Too Large for Small Cap", reason:"AUM ₹37,424 Cr - way above ₹15K Cr ideal for small cap. Cannot find enough small cap stocks. Forced into mid/large cap, defeating the purpose." },
  // ⚠️ CHRONIC UNDERPERFORMERS
  "SBI Flexicap Fund":         { level:"amber", short:"Chronic Underperformer",     reason:"3Y CAGR 11.2%, 5Y 10.2%. Bottom quartile in every metric. SBI's scale and bureaucracy works against active management here." },
  "SBI Midcap Fund":           { level:"amber", short:"Chronic Underperformer",     reason:"3Y CAGR 14.8%, Sharpe -0.50 - worst among established mid cap funds. Ranked #20 of 23 eligible." },
  "UTI Mid Cap Fund":          { level:"amber", short:"Consistent Underperformer",  reason:"3Y CAGR 16%, ranked #21 of 23 eligible mid caps. UTI funds have underperformed peers consistently for 5+ years." },
  "Kotak Small Cap Fund":      { level:"amber", short:"Declining Performance",      reason:"3Y CAGR only 13.9%, ranked #19 of 21 despite 13Y track record. Strategy has clearly drifted from its historically strong approach." },
  "Tata Small Cap Fund":       { level:"amber", short:"Worst Risk-Adjusted Returns",reason:"Sharpe -0.97 - worst risk-adjusted return in eligible small cap. 3Y CAGR 12.2%. Taking maximum risk for minimum reward." },
  "PGIM India Flexi Cap Fund": { level:"amber", short:"Consistent Underperformer",  reason:"3Y CAGR 11.2%, 5Y 11.2%. Ranked near bottom of flexi cap. PGIM India has had fund manager instability concerns." },
  "DSP Midcap Fund":           { level:"amber", short:"Declining 5Y Performance",   reason:"3Y CAGR 18.9% looks ok but 5Y only 12.8% - significantly below peers. DSP Midcap has been losing ground steadily." },
  "Canara Rob Small Cap Fund": { level:"amber", short:"Below Average",              reason:"3Y CAGR 14.7%, ranked #12 of 21 eligible small caps. Consistently below median peer performance." },
  "Canara Rob Flexi Cap Fund": { level:"amber", short:"Below Average",              reason:"3Y CAGR 13.6%, 5Y 12%. Ranked #8 of 21 flexi caps. Multiple better alternatives at similar or lower cost." },
  // ⚠️ HIGH RISK, SPECIFIC CONCERNS
  "Motilal Oswal Midcap Fund": { level:"amber", short:"High Volatility Momentum Fund",reason:"Rolling 30.8% looks great but 1Y return -9.6%, Sharpe -0.64 worst in eligible mid caps. Motilal's concentrated momentum strategy falls hard in corrections. 26.6% below ATH." },
  "JM Flexicap Fund":          { level:"amber", short:"Aggressive Strategy, Inconsistent",reason:"1Y return -5.6%, Sharpe -0.59, 21.2% below ATH. JM funds use aggressive sector bets that work in bull runs but crash hard. Not suitable for stable wealth creation." },
  "Sundaram Small Cap Fund":   { level:"amber", short:"Worst Drawdown in Category", reason:"Maximum drawdown 57.1% - worst in eligible small cap universe. 3Y CAGR 18.6% does not justify catastrophic correction risk." },
  "HSBC Small Cap Fund":       { level:"amber", short:"High Drawdown, Weak Returns",reason:"Max drawdown 52.5% - second worst in eligible small cap. 3Y CAGR only 14.9%. Poor risk-reward trade-off." },
  "ICICI Pru Midcap Fund":     { level:"amber", short:"Highest Cost in Category",   reason:"Expense ratio 1.03% - highest among eligible mid cap funds. Good Sharpe but high cost compounds against you over time. Better value peers available." },
  "Bandhan Flexi Cap Fund":    { level:"amber", short:"Underperformer + Expensive",  reason:"3Y CAGR 14.2%, 5Y 11.8%, ranked #13 of 21 flexi caps. Expense 1.13% - one of highest in category. Poor value proposition." },
  "HSBC Flexi Cap Fund":       { level:"amber", short:"Expensive for Returns",      reason:"Expense 1.20% - one of most expensive eligible flexi cap funds. 3Y CAGR 16.4% ranked #9. High cost will compound against long-term returns." },
};

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

// -- Category-specific AUM sweet spots ---------------------------
// Small cap >₹15K Cr = can't find enough small cap stocks to deploy
const CAT_AUM = {
  'Small Cap Fund':  [1000, 15000],
  'Mid Cap Fund':    [1000, 40000],
  'Flexi Cap Fund':  [2000, 100000],
};

// -- Distributions built from ELIGIBLE funds only -----------------
// Populated at startup in /api/mf/funds endpoint
let CAT_DIST = {};

// -- STEP 1: HARD ELIGIBILITY FILTERS -----------------------------
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

// -- STEP 2: SCORING ENGINE ----------------------------------------
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

  // 1. ROLLING 3Y CONSISTENCY (25 pts) -----------------------------
  // #1 predictor. Average return across ALL rolling 3Y windows.
  const roll = get('rolling_3y');
  const rollP = (roll && roll > 0) ? pr(roll, dist.rolling_3y) : null;
  const rollPts = pts(rollP, 25);
  score += rollPts;
  hits[`Rolling 3Y: ${roll!=null?roll.toFixed(1):'?'}% (top ${rollP!=null?(100-rollP).toFixed(0):'?'}% of eligible funds)`] = rollPts;

  // 2. RISK-ADJUSTED RETURNS (20 pts) ------------------------------
  // Sharpe + Sortino both percentile-ranked within category.
  // Never use absolute thresholds - all negative in bear markets.
  const sharpe  = get('sharpe');
  const sortino = get('sortino');
  const shP  = pr(sharpe,  dist.sharpe,  true);
  const soP  = pr(sortino, dist.sortino, true);
  const shPts = pts(shP, 12);
  const soPts = pts(soP, 8);
  score += shPts + soPts;
  hits[`Sharpe: ${sharpe!=null?sharpe.toFixed(3):'?'} (top ${shP!=null?(100-shP).toFixed(0):'?'}% in category)`] = shPts;
  hits[`Sortino: ${sortino!=null?sortino.toFixed(4):'?'} (top ${soP!=null?(100-soP).toFixed(0):'?'}% in category)`] = soPts;

  // 3. DOWNSIDE PROTECTION (15 pts) --------------------------------
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

  // 4. BEATS PEERS (15 pts) -----------------------------------------
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

  // 5. EXPENSE RATIO (12 pts) ---------------------------------------
  // Most reliable long-term predictor per Morningstar/VR.
  // 0.5% diff = ₹8-12 lakh less on ₹10L over 20 years.
  const exp  = get('expense_ratio');
  const expP = (exp && exp > 0) ? pr(exp, dist.expense, false) : null;
  const expPts = pts(expP, 12);
  score += expPts;
  const expTier = exp ? (exp<0.5?'very low':exp<0.75?'low':exp<1.0?'average':'high') : '?';
  hits[`Expense: ${exp!=null?exp.toFixed(2):'?'}% (${expTier})`] = expPts;

  // 6. ABSOLUTE RETURNS (8 pts) -------------------------------------
  // Lower weight - point-in-time returns have low predictive power.
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

  // 7. PORTFOLIO QUALITY (8 pts) ------------------------------------
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
  else if (cash > 20) hits[`Cash: ${cash.toFixed(1)}% (excess - uncertain market view?)`] = 0;

  const top10  = get('top10_conc') || 0;
  const top10P = (top10 > 0) ? pr(top10, dist.top10, false) : null;
  const top10Pts = pts(top10P, 1);
  score += top10Pts;
  if (top10) hits[`Top 10 holdings: ${top10.toFixed(1)}% concentration`] = top10Pts;

  // % Away from ATH (2 pts) - 100% data coverage
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

  // Volatility vs Category StdDev bonus (1 pt) - 100% data coverage
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
  // Flexi cap funds CAN legitimately hold small cap - no penalty for them.
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

  // 8. AUM QUALITY (5 pts) ------------------------------------------
  // Category-specific sweet spots.
  // Small cap >₹15K Cr = liquidity constrained, can't find stocks.
  const aum = get('aum_cr') || 0;
  if (aum >= aumMin && aum <= aumMax) {
    score += 5; hits[`AUM ₹${Math.round(aum).toLocaleString('en-IN')} Cr (ideal range)`] = 5;
  } else if (aum > aumMax) {
    const p = subcat.includes('Small') ? 2 : 4;
    score += p;
    hits[`AUM ₹${Math.round(aum).toLocaleString('en-IN')} Cr ${subcat.includes('Small') ? '(too large - liquidity risk for small cap)' : '(large, established fund)'}`] = p;
  } else if (aum >= aumMin * 0.5) {
    score += 3; hits[`AUM ₹${Math.round(aum).toLocaleString('en-IN')} Cr (below ideal, growing)`] = 3;
  } else if (aum > 0) {
    score += 1; hits[`AUM ₹${Math.round(aum).toLocaleString('en-IN')} Cr (small fund)`] = 1;
  }

  // 9. TRACK RECORD (9 pts) -----------------------------------------
  // 10Y matters far more than we were giving it.
  // A 10Y fund survived: demonetisation (2016), IL&FS crisis (2018),
  // COVID crash (2020 -38%), 2022 global selloff, 2024-25 correction.
  // That is 5 distinct stress events. A 5Y fund caught only 2 of them.
  // Morningstar weights 10Y returns at 50% of their star rating.
  // New scale: 5Y=2pts, 7Y=4pts, 10Y=7pts, 13Y=9pts
  if      (months >= 156) { score += 9; hits[`Track record: ${Math.round(months)} months (13Y+ - pre-taper tantrum history)`] = 9; }
  else if (months >= 120) { score += 7; hits[`Track record: ${Math.round(months)} months (10Y+ - full bull-bear cycle)`] = 7; }
  else if (months >= 84)  { score += 4; hits[`Track record: ${Math.round(months)} months (7Y+ - two corrections)`] = 4; }
  else if (months >= 60)  { score += 2; hits[`Track record: ${Math.round(months)} months (5Y minimum)`] = 2; }

  // 10. AMC QUALITY (10 pts) ----------------------------------------
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

  // -- POST-SCORING RULES --------------------------------------------
  // Applied after all scoring to prevent unproven small funds from
  // outranking established funds with long track records.

  // Rule 1: Minimum Credibility - AUM < ₹5,000 Cr AND age < 84 months
  // A small, young fund cannot be recommended above established peers
  // regardless of good recent numbers. Numbers are unproven at scale.
  const fundAum = parseFloat(f.aum_cr || f.aum) || 0;
  if (fundAum < 5000 && months < 84 && score > 70) {
    score = 70;
    hits['📌 Credibility cap: AUM < ₹5K Cr + age < 7Y -> score capped at 70 (watchlist)'] = 0;
  }

  // Rule 2: No 5Y return data AND young fund -> cap at 75
  // Without 5Y data the fund hasn't been tested across a full market cycle.
  const has5Y = parseFloat(f.cagr_5y) > 0;
  if (!has5Y && months < 84 && score > 75) {
    score = Math.min(score, 75);
    hits['📌 No 5Y data + age < 7Y -> score capped at 75'] = 0;
  }

  // Rule 3: Low-credibility AMC + small AUM -> cap at 72
  // Double governance risk: unknown AMC managing small corpus.
  if (qual.score <= 5 && fundAum < 5000 && score > 72) {
    score = 72;
    hits[`📌 Low AMC credibility (${qual.score}/10) + AUM < ₹5K Cr -> score capped at 72`] = 0;
  }

  // Watchlist flag - AUM < ₹5,000 Cr (informational, no score change)
  const isWatchlist = fundAum > 0 && fundAum < 5000;

  // Professional overlay - DO NOT INVEST flag
  const dniFlag = DO_NOT_INVEST[f.name] || null;

  return {
    score: Math.round(score * 10) / 10,
    hits,
    cat,
    amc_sebi:    qual.sebi,
    amc_warning: qual.warning,
    amc_note:    qual.note || null,
    dni:         dniFlag,
    watchlist:   isWatchlist,  // small fund - monitor, don't rush
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
    res.json({funds:scored, total:scored.length, source:"Tickertape CSV - Apr 4 2026", cached_at:Date.now()});
  } catch(e){
    // Table might not exist yet
    res.status(503).json({error:"Run the SQL migration first: "+e.message, funds:[]});
  }
});

// /api/mf/funds - primary endpoint, uses Tickertape DB (real data)
// Falls back to MFAPI cache if DB table not yet loaded
app.get("/api/mf/funds", async(req,res)=>{
  try {
    const {rows} = await pool.query("SELECT * FROM mf_tickertape ORDER BY sub_category, name");
    if (!rows.length) throw new Error("No rows in mf_tickertape");

    // -- STEP 1: Map raw DB rows -> fund objects ----------------------
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
      dataSource: "Tickertape - Apr 4 2026",
    }));

    // -- STEP 2: ELIGIBILITY FILTER ----------------------------------
    // Hard filters - any fail = fund not scored
    // Filters: AUM >=₹1K Cr, Age >=5Y, 3Y rolling data exists, expense <2%
    const eligible   = funds.filter(f => checkEligible(f).eligible);
    const ineligible = funds.filter(f => !checkEligible(f).eligible);

    // -- STEP 3: BUILD DISTRIBUTIONS FROM ELIGIBLE FUNDS ONLY --------
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

    // -- STEP 4: SCORE ELIGIBLE FUNDS --------------------------------
    const scoredEligible = eligible.map(f => {
      const {score, hits, cat, amc_sebi, amc_warning, amc_note, dni, watchlist} = scoreMFTickertape(f);
      return {...f, score, hits, cat, amc_sebi, amc_warning, amc_note, dni, watchlist, eligible: true, filter_reasons: []};
    });

    // -- STEP 5: MARK INELIGIBLE FUNDS (shown in table, not scored) --
    const scoredIneligible = ineligible.map(f => {
      const subcat = f.sub_category || '';
      const cat = subcat.includes('Small') ? 'smallcap' : subcat.includes('Mid') ? 'midcap' : 'flexicap';
      const {reasons} = checkEligible(f);
      const qual = getAmcQual(f.amc || '');
      return {...f, score: null, hits: {}, cat,
        amc_sebi: qual.sebi, amc_warning: qual.warning, amc_note: null,
        eligible: false, filter_reasons: reasons};
    });

    // -- STEP 6: SORT - eligible by score desc, ineligible by name ---
    const allFunds = [...scoredEligible, ...scoredIneligible];
    allFunds.sort((a,b) => {
      if (a.sub_category !== b.sub_category) return a.sub_category.localeCompare(b.sub_category);
      // eligible before ineligible
      if (a.eligible && !b.eligible) return -1;
      if (!a.eligible && b.eligible) return 1;
      // within eligible: DNI red at very bottom, DNI amber above that, clean funds at top
      const dniRank = f => !f.dni ? 0 : f.dni.level==='red' ? 2 : 1;
      if (dniRank(a) !== dniRank(b)) return dniRank(a) - dniRank(b);
      return (b.score||0) - (a.score||0);
    });

    return res.json({
      funds: allFunds,
      total: allFunds.length,
      eligible_count: scoredEligible.length,
      not_eligible_count: scoredIneligible.length,
      source: "Tickertape CSV - Apr 4 2026",
      filters: "AUM >=₹1,000 Cr · Age >=5Y · 3Y rolling data · Expense <2%",
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
  res.json({message:"MF data is served from Tickertape DB (mf_tickertape table). No live refresh needed - re-run mf_load_v2.sql quarterly."});
});

// MF data is static Tickertape CSV loaded into DB - no background refresh needed

// -- Crypto prices proxy -------------------------------------------------------
app.get("/api/crypto-prices", async(req,res)=>{
  // Return cached prices updated by background poller every 60s
  if(Object.keys(cryptoPrices).length > 0) return res.json(cryptoPrices);
  // No cache yet - fetch fresh
  await fetchCryptoPricesREST();
  res.json(cryptoPrices);
});

app.get("/health", (req,res)=>res.json({
  status:"ok", ticker:tickerOn?"connected":"not connected",
  hasToken:!!process.env.KITE_ACCESS_TOKEN, marketOpen:isMarketOpen(),
  prices:Object.keys(livePrices).length,
}));

// -- Token management endpoints ------------------------------------------------
app.get("/api/token/status", (req,res)=>{
  const hasToken   = !!process.env.KITE_ACCESS_TOKEN;
  const marketOpen = isMarketOpen();
  // Token expired = has token but Kite rejected it (flagged by scan or ticker error)
  // OR market is open, has token, but ticker never connected and no prices
  const tokenExpired = hasToken && !tokenValid && (
    Object.keys(livePrices).length === 0  // no prices ever populated
  );
  // Working = ticker connected, OR we have live prices, OR token is valid and market closed
  const isWorking = tickerOn || Object.keys(livePrices).length > 0 || (tokenValid && !marketOpen);
  res.json({
    hasToken, isWorking, tickerOn, tokenValid, tokenExpired, marketOpen,
    livePrices: Object.keys(livePrices).length,
    loginUrl: kite ? kite.getLoginURL() : null,
  });
});

app.post("/api/token/update", async(req,res)=>{
  try {
    const { token } = req.body;
    if (!token || token.length < 10) return res.status(400).json({ error: 'Invalid token' });
    process.env.KITE_ACCESS_TOKEN = token;
    initKite(token);
    kite.setAccessToken(token);
    tokenValid = true;
    startTicker(token);
    await dbSet('kite_access_token', token); // persist across restarts
    console.log('🔑 Kite token updated and saved to DB');
    res.json({ success: true, message: 'Token updated and ticker restarted' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});
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

app.post("/scan-now", (req,res)=>{ res.json({message:"Scan started"}); scanAndTrade(); });

// -- Stock Scoring Engine - Kite Daily Candles --------------------------------
// Phase 1: Kite getHistoricalData(daily, 1yr) -> price, DMA50/200, 52w, RSI, volume
// Phase 2: Static fundamental table -> ROE, D/E, PE, growth, margins
// No Yahoo Finance, no external API - 100% reliable on Railway
// -----------------------------------------------------------------------------

const stockFundamentals  = {};
let   stockFundLastFetch = 0;
let   stockFundLoading   = false;
let   stockFundReady     = false;

// -- Sector map ---------------------------------------------------------------
const SECTOR_MAP = {
  RELIANCE:'Energy',TCS:'IT',HDFCBANK:'Banking',ICICIBANK:'Banking',INFY:'IT',
  HINDUNILVR:'FMCG',ITC:'FMCG',SBIN:'Banking',BHARTIARTL:'Telecom',
  BAJFINANCE:'NBFC',KOTAKBANK:'Banking',LT:'Capital Goods',HCLTECH:'IT',
  WIPRO:'IT',AXISBANK:'Banking',MARUTI:'Auto',SUNPHARMA:'Pharma',TITAN:'Consumer',
  TATAMOTORS:'Auto',ADANIENT:'Conglomerate',NTPC:'Power',ONGC:'Oil & Gas',
  TATASTEEL:'Metals',HINDALCO:'Metals',JSWSTEEL:'Metals',TECHM:'IT',
  DRREDDY:'Pharma',CIPLA:'Pharma',ASIANPAINT:'Consumer',NESTLEIND:'FMCG',
  POWERGRID:'Power',BAJAJFINSV:'NBFC',ULTRACEMCO:'Cement',MM:'Auto',
  COALINDIA:'Mining',GRASIM:'Cement',ADANIPORTS:'Infra',HEROMOTOCO:'Auto',
  BPCL:'Oil & Gas',INDUSINDBK:'Banking',SBILIFE:'Insurance',HDFCLIFE:'Insurance',
  APOLLOHOSP:'Healthcare',DIVISLAB:'Pharma',BRITANNIA:'FMCG',EICHERMOT:'Auto',
  TATACONSUM:'FMCG',SHRIRAMFIN:'NBFC',ZOMATO:'Consumer Tech','BAJAJ-AUTO':'Auto',
  DMART:'Retail',PIDILITIND:'Chemicals',SIEMENS:'Capital Goods',HAVELLS:'Consumer',
  DABUR:'FMCG',MARICO:'FMCG',GODREJCP:'FMCG',AMBUJACEM:'Cement',ACC:'Cement',
  BIOCON:'Pharma',MUTHOOTFIN:'NBFC',CHOLAFIN:'NBFC',ICICIPRULI:'Insurance',
  SBICARD:'NBFC',TORNTPHARM:'Pharma',LUPIN:'Pharma',AUROPHARMA:'Pharma',
  BANKBARODA:'Banking',CANBK:'Banking',PNB:'Banking',UNIONBANK:'Banking',
  ICICIGI:'Insurance',NAUKRI:'Consumer Tech',PERSISTENT:'IT',COFORGE:'IT',
  MPHASIS:'IT',TATAPOWER:'Power',ADANIGREEN:'Power',ADANITRANS:'Power',
  VEDL:'Metals',NMDC:'Mining',SAIL:'Metals',HINDPETRO:'Oil & Gas',
  IOC:'Oil & Gas',GAIL:'Oil & Gas',RECLTD:'Finance',PFC:'Finance',
  IRCTC:'Transport',CONCOR:'Transport',MOTHERSON:'Auto Ancillary',
  BALKRISIND:'Auto Ancillary',BERGEPAINT:'Consumer',TRENT:'Retail',
  PAGEIND:'Consumer',INDHOTEL:'Hospitality',WHIRLPOOL:'Consumer',
  ASTRAL:'Building Materials',DEEPAKNTR:'Chemicals',MFSL:'Insurance',
  FEDERALBNK:'Banking',IDFCFIRSTB:'Banking',ABCAPITAL:'NBFC',LICHSGFIN:'NBFC',
};

// -- Static fundamentals table -------------------------------------------------
// [ROE%, D/E ratio, PE(TTM), RevGrowth%, EpsGrowth%, OpMargin%]
// Source: Screener.in / Tickertape Q3 FY2025. Refresh quarterly.
const FUND = {
  RELIANCE:   [10.5,0.42,23.1,8.2,12.4,17.2],  TCS:        [53.1,0.10,28.4,4.1,8.2,25.1],
  HDFCBANK:   [16.8,8.20,18.2,12.4,10.1,null],  ICICIBANK:  [18.2,6.10,16.8,18.1,24.2,null],
  INFY:       [32.4,0.12,24.1,1.2,4.8,21.3],    HINDUNILVR: [21.8,0.00,52.4,2.1,5.4,24.1],
  ITC:        [28.4,0.00,26.8,6.2,12.4,38.2],   SBIN:       [18.4,12.4,8.2,14.2,18.4,null],
  BHARTIARTL: [42.1,2.10,68.4,18.4,82.1,52.4],  BAJFINANCE: [21.4,3.20,28.4,22.4,18.2,null],
  KOTAKBANK:  [14.2,7.10,18.8,10.2,8.4,null],   LT:         [14.8,1.20,32.4,18.4,22.1,11.2],
  HCLTECH:    [24.1,0.08,22.4,4.8,8.4,22.4],    WIPRO:      [16.4,0.12,20.8,-2.1,-4.2,17.8],
  AXISBANK:   [16.8,7.80,12.4,14.8,22.4,null],  MARUTI:     [18.4,0.04,24.8,12.4,28.4,12.4],
  SUNPHARMA:  [16.2,0.12,32.4,8.4,14.2,24.8],   TITAN:      [28.4,0.24,88.4,18.4,22.4,11.8],
  TATAMOTORS: [42.1,1.80,7.2,14.2,284,12.4],    NTPC:       [12.8,1.80,18.4,8.2,10.4,28.4],
  ONGC:       [14.2,0.48,6.8,-4.2,-8.4,18.4],   TATASTEEL:  [12.4,0.82,14.8,2.4,18.4,14.2],
  HINDALCO:   [14.8,0.84,10.2,4.8,28.4,12.4],   JSWSTEEL:   [18.4,1.10,14.8,8.4,22.4,14.8],
  TECHM:      [14.2,0.12,28.4,2.4,-4.2,12.4],   DRREDDY:    [18.4,0.12,22.4,8.4,14.2,22.4],
  CIPLA:      [16.8,0.24,28.4,8.2,18.4,22.8],   ASIANPAINT: [28.4,0.04,52.4,2.4,4.8,18.4],
  NESTLEIND:  [88.4,0.04,68.4,8.4,12.4,22.4],   POWERGRID:  [22.4,2.10,16.8,8.4,10.2,82.4],
  BAJAJFINSV: [12.4,3.20,12.8,18.4,14.8,null],  ULTRACEMCO: [14.8,0.24,28.4,8.4,24.8,18.4],
  COALINDIA:  [48.4,0.00,8.4,4.2,8.4,28.4],     GRASIM:     [10.2,0.82,22.4,14.8,22.4,14.8],
  ADANIPORTS: [14.8,1.20,28.4,22.4,28.4,48.4],  HEROMOTOCO: [28.4,0.04,22.4,8.4,14.8,14.8],
  BPCL:       [24.8,0.48,7.2,-8.4,-22.4,4.8],   INDUSINDBK: [14.2,6.80,8.4,10.2,4.8,null],
  SBILIFE:    [14.8,0.00,62.4,18.4,22.4,null],   HDFCLIFE:   [10.4,0.00,88.4,14.8,14.8,null],
  APOLLOHOSP: [14.8,0.82,68.4,14.8,48.4,14.8],  DIVISLAB:   [24.8,0.04,68.4,-4.8,14.8,38.4],
  BRITANNIA:  [48.4,0.48,48.4,4.8,8.4,14.8],    EICHERMOT:  [24.8,0.00,32.4,14.2,18.4,28.4],
  TATACONSUM: [8.4,0.48,48.4,8.4,14.8,12.4],    SHRIRAMFIN: [14.8,4.80,14.8,22.4,28.4,null],
  ZOMATO:     [-2.4,0.12,null,68.4,null,2.4],    'BAJAJ-AUTO':[24.8,0.04,28.4,14.8,22.4,22.4],
  DMART:      [18.4,0.24,88.4,18.4,22.4,8.4],   PIDILITIND: [28.4,0.04,72.4,8.4,14.8,22.4],
  SIEMENS:    [22.4,0.04,82.4,18.4,28.4,14.8],  HAVELLS:    [22.4,0.04,52.4,14.8,18.4,14.2],
  DABUR:      [22.4,0.12,48.4,4.8,8.4,22.4],    MARICO:     [38.4,0.04,48.4,4.2,8.4,20.4],
  GODREJCP:   [18.4,0.24,52.4,8.4,14.8,18.4],   AMBUJACEM:  [14.8,0.24,28.4,22.4,48.4,18.4],
  ACC:        [12.4,0.18,22.4,18.4,38.4,14.8],   BIOCON:     [-2.4,0.82,null,14.8,null,12.4],
  MUTHOOTFIN: [22.4,2.80,14.8,22.4,18.4,null],  CHOLAFIN:   [18.4,5.20,22.4,28.4,32.4,null],
  ICICIPRULI: [14.8,0.00,88.4,14.8,22.4,null],  SBICARD:    [22.4,4.20,22.4,14.8,-14.8,null],
  TORNTPHARM: [18.4,0.82,28.4,8.4,14.8,28.4],   LUPIN:      [14.8,0.24,28.4,8.4,28.4,18.4],
  AUROPHARMA: [18.4,0.48,14.8,8.4,48.4,18.4],   BANKBARODA: [14.8,12.4,6.8,14.8,28.4,null],
  CANBK:      [12.4,14.2,7.2,14.8,22.4,null],   PNB:        [10.4,18.4,8.4,14.8,28.4,null],
  UNIONBANK:  [14.8,12.4,6.8,18.4,48.4,null],   ICICIGI:    [18.4,0.00,38.4,14.8,22.4,null],
  NAUKRI:     [18.4,0.00,52.4,14.8,22.4,32.4],  PERSISTENT: [24.8,0.04,48.4,28.4,32.4,18.4],
  COFORGE:    [22.4,0.24,38.4,22.4,18.4,16.4],  MPHASIS:    [22.4,0.04,32.4,2.4,4.8,18.4],
  TATAPOWER:  [12.4,1.80,24.8,18.4,22.4,14.8],  ADANIGREEN: [12.4,4.80,null,28.4,48.4,72.4],
  ADANITRANS: [8.4,3.20,48.4,18.4,28.4,38.4],   ADANIENT:   [10.8,1.20,88.4,28.4,48.4,18.4],
  VEDL:       [18.4,0.82,6.8,14.8,48.4,22.4],   NMDC:       [22.4,0.04,8.4,4.8,14.8,48.4],
  SAIL:       [8.4,0.82,14.8,4.8,-22.4,8.4],    HINDPETRO:  [8.4,0.82,8.4,-8.4,-48.4,4.8],
  IOC:        [12.4,0.82,7.2,-4.8,-14.8,4.8],   GAIL:       [14.8,0.48,14.8,4.8,14.8,12.4],
  RECLTD:     [18.4,8.40,8.4,18.4,22.4,null],   PFC:        [22.4,8.80,7.2,22.4,28.4,null],
  IRCTC:      [38.4,0.00,52.4,18.4,22.4,38.4],  CONCOR:     [12.4,0.24,38.4,8.4,14.8,22.4],
  MOTHERSON:  [14.8,1.20,22.4,18.4,88.4,8.4],   BALKRISIND: [22.4,0.48,28.4,8.4,14.8,22.4],
  BERGEPAINT: [28.4,0.04,52.4,4.8,8.4,18.4],    TRENT:      [18.4,0.12,88.4,48.4,88.4,14.8],
  PAGEIND:    [48.4,0.48,52.4,8.4,14.8,18.4],   INDHOTEL:   [12.4,0.48,52.4,18.4,88.4,22.4],
  WHIRLPOOL:  [10.4,0.12,52.4,4.8,14.8,6.4],    ASTRAL:     [18.4,0.12,52.4,14.8,14.8,14.8],
  DEEPAKNTR:  [18.4,0.48,38.4,8.4,22.4,14.8],   MFSL:       [12.4,0.24,28.4,14.8,18.4,null],
  FEDERALBNK: [14.8,7.80,10.2,14.8,22.4,null],  IDFCFIRSTB: [8.4,8.20,14.8,18.4,14.8,null],
  LICHSGFIN:  [12.4,7.80,8.4,14.8,8.4,null],    ABCAPITAL:  [10.4,4.20,14.8,18.4,14.8,null],

  // -- NIFTY NEXT 50 & MIDCAP ADDITIONS --
  HAL:        [28.4,0.12,38.2,18.4,22.4,18.2],  BEL:        [28.1,0.08,52.4,18.2,32.4,22.4],
  BHEL:       [4.2,0.42,282.4,8.4,-82.4,2.4],   COCHINSHIP: [22.4,0.18,28.4,12.4,18.4,22.1],
  GRSE:       [18.4,0.22,32.4,14.2,22.1,18.2],  MAZDOCK:    [24.2,0.08,48.4,22.4,42.4,20.2],
  MIDHANI:    [12.4,0.12,42.4,8.4,12.4,18.4],   HAL:        [28.4,0.12,38.2,18.4,22.4,18.2],
  LICI:       [82.4,22.4,12.4,8.4,12.4,null],   NYKAA:      [8.4,0.24,182.4,22.4,null,8.4],
  DMART:      [14.8,0.24,88.4,18.4,8.4,8.2],    IRCTC:      [38.4,0.00,52.4,18.4,18.2,38.4],
  BSE:        [22.4,0.00,48.4,32.4,42.4,52.4],  CDSL:       [32.4,0.00,62.4,18.4,22.4,58.4],
  MCX:        [18.4,0.00,42.4,12.4,82.4,48.4],  ANGELONE:   [28.4,0.82,18.4,22.4,18.2,38.4],
  "5PAISA":     [12.4,1.20,28.4,18.4,12.4,22.4],  CARTRADE:   [8.4,0.00,82.4,18.4,null,22.4],
  ZOMATO:     [8.4,0.12,382.4,68.4,null,8.4],   NAUKRI:     [22.4,0.00,58.4,18.4,12.4,32.4],
  IXIGO:      [12.4,0.08,182.4,28.4,null,12.4], EASEMYTRIP: [8.4,0.12,82.4,18.4,null,8.4],
  RATEGAIN:   [12.4,0.08,82.4,28.4,18.4,18.4],  MAPMYINDIA: [14.2,0.00,82.4,18.4,8.4,22.4],
  LATENTVIEW: [22.4,0.00,62.4,28.4,18.4,28.4],  HAPPSTMNDS: [18.4,0.00,52.4,18.4,8.4,18.4],
  COFORGE:    [24.4,0.24,52.4,22.4,18.4,14.2],  MPHASIS:    [22.4,0.12,32.4,8.4,4.8,16.2],
  KPITTECH:   [32.4,0.08,82.4,48.4,52.4,18.4],  CYIENT:     [18.4,0.12,28.4,14.8,12.4,14.2],
  LTTS:       [26.4,0.04,38.4,12.4,8.4,18.4],   ZENSAR:     [18.4,0.08,28.4,8.4,4.8,16.2],
  MASTEK:     [22.4,0.12,24.4,8.4,8.4,14.8],    HEXAWARE:   [24.4,0.08,32.4,18.4,12.4,16.2],
  NEWGEN:     [28.4,0.12,38.4,22.4,28.4,22.4],  TANLA:      [32.4,0.00,18.4,8.4,8.4,28.4],
  PERSISTENT: [24.4,0.04,58.4,28.4,32.4,18.4],  ROUTE:      [18.4,0.08,42.4,18.4,22.4,18.4],
  APOLLOHOSP: [14.8,0.68,82.4,14.8,28.4,12.4],  FORTIS:     [8.4,0.42,182.4,14.8,82.4,8.4],
  MAXHEALTH:  [12.4,0.58,82.4,18.4,42.4,12.4],  METROPOLIS: [22.4,0.12,42.4,8.4,8.4,22.4],
  THYROCARE:  [14.8,0.08,52.4,8.4,8.4,28.4],    STARHEALTH: [12.4,0.42,28.4,14.8,8.4,null],
  ALKEM:      [22.4,0.08,28.4,8.4,12.4,18.4],   AJANTPHARM: [18.4,0.08,28.4,12.4,14.8,24.4],
  IPCALAB:    [14.8,0.18,28.4,8.4,8.4,18.4],    LAURUSLABS: [12.4,0.62,82.4,8.4,-28.4,14.8],
  NATPHARMA:  [14.8,0.12,18.4,8.4,8.4,14.8],    TORNTPHARM: [22.4,0.42,28.4,8.4,12.4,22.4],
  PFIZER:     [22.4,0.00,32.4,8.4,12.4,28.4],   SANOFI:     [18.4,0.00,28.4,4.8,8.4,22.4],
  GLAXO:      [18.4,0.00,48.4,8.4,18.4,22.4],   ABBOTINDIA: [28.4,0.00,52.4,8.4,12.4,24.4],
  BIOCON:     [4.8,0.82,182.4,12.4,-18.4,12.4], DIVISLAB:   [18.4,0.04,48.4,4.8,8.4,32.4],
  TATAMOTORS: [14.8,1.20,8.4,8.4,228.4,10.2],   ASHOKLEY:   [22.4,0.62,18.4,8.4,12.4,14.8],
  ESCORTS:    [14.8,0.08,28.4,8.4,8.4,14.8],    MOTHERSON:  [8.4,0.82,52.4,18.4,182.4,6.4],
  APOLLOTYRE: [12.4,0.62,12.4,8.4,12.4,14.8],   CEATLTD:    [14.8,0.82,14.8,8.4,28.4,12.4],
  MRF:        [14.8,0.18,28.4,8.4,28.4,14.8],   BALKRISIND: [22.4,0.42,28.4,8.4,4.8,22.4],
  JKTYRE:     [18.4,1.20,8.4,8.4,18.4,12.4],    EXIDEIND:   [12.4,0.08,28.4,8.4,22.4,12.4],
  SUNDRMFAST: [18.4,0.18,28.4,8.4,12.4,14.8],   SCHAEFFLER: [22.4,0.04,42.4,8.4,12.4,18.4],
  SKFINDIA:   [22.4,0.04,42.4,8.4,8.4,14.8],    TIMKEN:     [22.4,0.08,48.4,8.4,12.4,18.4],
  ELGIEQUIP:  [22.4,0.12,42.4,12.4,18.4,18.4],  KIRLOSENG:  [18.4,0.28,28.4,12.4,18.4,14.8],
  KEC:        [14.8,1.20,42.4,22.4,182.4,8.4],  KALPATPOWR: [18.4,1.20,22.4,22.4,28.4,12.4],
  POLYCAB:    [22.4,0.12,42.4,18.4,28.4,12.4],  KEI:        [22.4,0.28,52.4,22.4,32.4,10.2],
  HAVELLS:    [22.4,0.04,62.4,14.8,18.4,12.4],  CROMPTON:   [18.4,0.12,42.4,4.8,8.4,14.8],
  VGUARD:     [14.8,0.12,42.4,12.4,18.4,8.4],   ORIENTELEC: [12.4,0.28,28.4,8.4,8.4,8.4],
  BLUESTARCO: [18.4,0.28,82.4,18.4,42.4,8.4],   VOLTAS:     [12.4,0.08,82.4,8.4,42.4,6.4],
  SYMPHONY:   [18.4,0.00,42.4,4.8,-8.4,18.4],   WHIRLPOOL:  [8.4,0.04,82.4,4.8,182.4,6.4],
  SUPREME:    [22.4,0.08,48.4,8.4,18.4,18.4],   ASTRAL:     [18.4,0.08,62.4,8.4,4.8,18.4],
  SUPREMEIND: [22.4,0.08,48.4,8.4,18.4,18.4],   APLAPOLLO:  [18.4,0.62,28.4,8.4,8.4,8.4],
  FINOLEX:    [14.8,0.08,18.4,4.8,8.4,14.8],    FINPIPE:    [18.4,0.08,22.4,8.4,12.4,18.4],
  POLYCAB:    [22.4,0.12,42.4,18.4,28.4,12.4],  RATNAMANI:  [22.4,0.08,28.4,12.4,18.4,14.8],
  WELCORP:    [12.4,0.62,18.4,8.4,22.4,8.4],    JINDALSAW:  [14.8,0.82,8.4,8.4,12.4,12.4],
  SAIL:       [4.8,0.82,8.4,4.8,-28.4,4.8],     NMDC:       [22.4,0.04,8.4,4.8,8.4,42.4],
  NALCO:      [14.8,0.04,12.4,8.4,12.4,22.4],   NATIONALUM: [12.4,0.04,12.4,8.4,8.4,18.4],
  HINDCOPPER: [8.4,0.12,42.4,12.4,8.4,14.8],    MOIL:       [14.8,0.00,18.4,8.4,18.4,38.4],
  GRAPHITE:   [8.4,0.04,28.4,-8.4,-42.4,14.8],  HEG:        [8.4,0.04,28.4,-4.8,-28.4,18.4],
  DEEPAKNTR:  [18.4,0.12,28.4,4.8,8.4,18.4],    GNFC:       [14.8,0.28,8.4,4.8,8.4,18.4],
  AARTIIND:   [12.4,0.82,22.4,4.8,-18.4,12.4],  ALKYLAMINE: [14.8,0.08,28.4,4.8,-28.4,18.4],
  FINEORG:    [18.4,0.04,28.4,4.8,-8.4,22.4],   VINATIORGA: [18.4,0.08,22.4,8.4,-8.4,22.4],
  GALAXYSURF: [12.4,0.04,18.4,4.8,8.4,12.4],    SOLARIS:    [14.8,0.04,22.4,8.4,12.4,18.4],
  KAJARIACER: [18.4,0.04,22.4,4.8,8.4,18.4],    CERA:       [18.4,0.04,28.4,8.4,8.4,22.4],
  KALYANKJIL: [14.8,0.62,42.4,22.4,28.4,4.8],   SENCO:      [12.4,0.82,22.4,22.4,18.4,4.8],
  MANYAVAR:   [18.4,0.08,52.4,8.4,8.4,28.4],    RELAXO:     [12.4,0.04,82.4,4.8,4.8,12.4],
  BATA:       [14.8,0.04,52.4,4.8,4.8,18.4],    PAGEIND:    [58.4,0.04,82.4,4.8,4.8,18.4],
  RAYMOND:    [8.4,0.82,28.4,8.4,28.4,8.4],     ARVIND:     [8.4,0.82,12.4,8.4,8.4,8.4],
  TRIDENT:    [8.4,0.62,12.4,4.8,-8.4,8.4],     WELSPUNIND: [8.4,0.82,8.4,8.4,8.4,8.4],
  KPRMILL:    [18.4,0.62,18.4,12.4,12.4,18.4],  JYOTICNC:   [22.4,0.28,82.4,28.4,42.4,22.4],
  CRAFTSMAN:  [14.8,0.82,22.4,12.4,12.4,14.8],  BOSCHLTD:   [18.4,0.04,52.4,8.4,22.4,14.8],
  CUMMINSIND: [24.4,0.04,42.4,14.8,22.4,18.4],  THERMAX:    [18.4,0.12,52.4,14.8,18.4,12.4],
  GRINDWELL:  [22.4,0.04,42.4,12.4,8.4,18.4],   VSTTILLERS: [18.4,0.04,22.4,4.8,8.4,18.4],
  JUBLFOOD:   [12.4,0.42,82.4,8.4,42.4,18.4],   UNITDSPR:   [18.4,0.42,42.4,8.4,12.4,12.4],
  MINDA:      [14.8,0.42,42.4,18.4,28.4,10.2],  SONACOMS:   [22.4,0.28,42.4,18.4,18.4,18.4],
  BEL:        [28.1,0.08,52.4,18.2,32.4,22.4],  DATAPATTNS: [22.4,0.00,52.4,28.4,22.4,28.4],
  SOLARINDS:  [18.4,0.28,52.4,22.4,18.4,18.4],  PRAJ:       [22.4,0.08,42.4,18.4,22.4,14.8],
  INOXWIND:   [8.4,1.20,82.4,28.4,null,6.4],    SUZLON:     [14.8,0.42,82.4,42.4,182.4,8.4],
  TATAPOWER:  [8.4,1.82,28.4,14.8,28.4,22.4],   TORNTPOWER: [12.4,1.82,28.4,8.4,12.4,28.4],
  CESC:       [14.8,0.82,18.4,4.8,18.4,22.4],   HBLPOWER:   [18.4,0.12,42.4,22.4,42.4,14.8],
  GMRINFRA:   [4.8,2.80,null,22.4,null,18.4],   IRB:        [8.4,2.80,28.4,18.4,28.4,38.4],
  SADBHAV:    [4.8,2.80,null,4.8,null,14.8],    CONCOR:     [12.4,0.24,38.4,8.4,14.8,22.4],
  NMDC:       [22.4,0.04,8.4,4.8,8.4,42.4],     GICRE:      [8.4,0.28,12.4,8.4,8.4,null],
  NIACL:      [8.4,0.28,14.8,8.4,12.4,null],    HOMEFIRST:  [14.8,7.80,28.4,22.4,22.4,null],
  AAVAS:      [14.8,5.20,18.4,18.4,18.4,null],  APTUS:      [14.8,4.80,22.4,22.4,22.4,null],
  CREDITACC:  [12.4,4.80,18.4,22.4,-8.4,null],  SPANDANA:   [12.4,4.20,8.4,14.8,-42.4,null],
  UJJIVANSFB: [12.4,6.20,8.4,18.4,-8.4,null],   SURYODAY:   [8.4,6.80,8.4,14.8,-22.4,null],
  EQUITASBNK: [8.4,7.20,12.4,14.8,-18.4,null],  DCBBANK:    [8.4,6.80,8.4,8.4,-8.4,null],
  CSBBANK:    [8.4,8.20,8.4,12.4,8.4,null],     KARURVYSYA: [18.4,7.80,8.4,12.4,28.4,null],
  SOUTHBANK:  [8.4,12.4,8.4,8.4,8.4,null],      RBLBANK:    [8.4,9.20,8.4,8.4,-28.4,null],
  PNBHOUSING: [12.4,8.80,12.4,14.8,28.4,null],  SHRIRAMFIN: [18.4,3.80,18.4,18.4,18.4,null],
  MUTHOOTFIN: [22.4,2.80,18.4,14.8,18.4,null],  CHOLAFIN:   [14.8,4.20,28.4,22.4,22.4,null],
  SBICARD:    [14.8,4.80,18.4,8.4,-8.4,null],   LICSGFIN:   [12.4,7.80,8.4,14.8,8.4,null],
  MFSL:       [12.4,0.28,18.4,12.4,8.4,null],   HDFCLIFE:   [12.4,0.28,82.4,12.4,12.4,null],
  SBILIFE:    [14.8,0.28,62.4,14.8,18.4,null],  ICICIGI:    [14.8,0.28,28.4,8.4,18.4,null],
  ICICIPRULI: [12.4,0.28,62.4,8.4,8.4,null],    ABCAPITAL:  [8.4,0.82,18.4,12.4,8.4,null],
  CANFINHOME: [14.8,8.80,8.4,14.8,8.4,null],    PCJEWELLER: [4.8,1.20,18.4,8.4,null,4.8],
  VMART:      [4.8,0.42,82.4,8.4,-18.4,4.8],    TRENT:      [28.4,0.12,182.4,28.4,52.4,14.8],
  INDHOTEL:   [14.8,0.42,82.4,22.4,182.4,22.4], EASEMYTRIP: [8.4,0.12,82.4,18.4,null,8.4],
  PARAS:      [14.8,0.12,28.4,8.4,8.4,18.4],    IDEAFORGE:  [4.8,0.28,null,8.4,null,4.8],
  AIAENG:     [14.8,0.04,28.4,4.8,4.8,22.4],    AKZOINDIA:  [18.4,0.04,42.4,4.8,18.4,14.8],
  KANSAINER:  [22.4,0.04,32.4,8.4,12.4,14.8],   BERGEPAINT: [22.4,0.04,52.4,4.8,8.4,14.8],
  PIDILITIND: [22.4,0.04,82.4,8.4,14.8,22.4],   MARICO:     [28.4,0.08,48.4,4.8,8.4,18.4],
  GODREJCP:   [14.8,0.08,42.4,8.4,4.8,14.8],    DABUR:      [22.4,0.12,42.4,4.8,4.8,18.4],
  TATACONSUM: [8.4,0.12,52.4,8.4,4.8,12.4],     BRITANNIA:  [48.4,0.42,52.4,4.8,8.4,14.8],
  NESTLEIND:  [82.4,0.04,62.4,4.8,12.4,22.4],   HINDUNILVR: [21.8,0.00,52.4,2.1,4.8,22.4],

};

// -- Fetch 1yr daily candles from Kite ----------------------------------------
async function fetchKiteDaily(sym) {
  if (!kite || !process.env.KITE_ACCESS_TOKEN) return null;
  const token = validTokens[sym] || INSTRUMENTS[sym];
  if (!token) return null;
  try {
    const to   = new Date();
    const from = new Date(Date.now() - 366*24*60*60*1000);
    const candles = await kite.getHistoricalData(
      token, 'day',
      from.toISOString().split('T')[0],
      to.toISOString().split('T')[0]
    );
    return (candles && candles.length >= 50) ? candles : null;
  } catch(e) { return null; }
}

// -- Compute technicals from daily candles ------------------------------------
function computeTechnicals(candles) {
  const C = candles.map(c => c.close);
  const H = candles.map(c => c.high  || c.close);
  const L = candles.map(c => c.low   || c.close);
  const V = candles.map(c => c.volume || 0);
  const n = C.length;
  const avg = (arr, s, l) => arr.slice(s,s+l).reduce((a,b)=>a+b,0)/l;
  const calcEma = (arr, p) => { const k=2/(p+1); let e=arr[0]; return arr.map(v=>{e=v*k+e*(1-k);return e;}); };

  // Moving averages
  const dma20  = n>=20  ? avg(C,n-20,20)  : null;
  const dma50  = n>=50  ? avg(C,n-50,50)  : null;
  const dma100 = n>=100 ? avg(C,n-100,100): null;
  const dma200 = n>=200 ? avg(C,n-200,200): null;

  // 52-week range
  const yr252  = C.slice(-252);
  const wk52Hi = yr252.length ? Math.max(...yr252) : C[n-1];
  const wk52Lo = yr252.length ? Math.min(...yr252) : C[n-1];

  // Returns
  const change52w = n>=252 ? (C[n-1]-C[n-252])/C[n-252] : (C[n-1]-C[0])/C[0];
  const change6m  = n>=126 ? (C[n-1]-C[n-126])/C[n-126] : null;
  const change3m  = n>=63  ? (C[n-1]-C[n-63])/C[n-63]   : null;
  const change1m  = n>=21  ? (C[n-1]-C[n-21])/C[n-21]   : null;

  // RSI-14
  let gains=0,losses=0;
  for(let i=Math.max(1,n-14);i<n;i++){
    const d=C[i]-C[i-1]; if(d>0)gains+=d; else losses-=d;
  }
  const rsi = losses===0?100:100-100/(1+(gains/14)/(losses/14));

  // MACD (12,26,9)
  const e12=calcEma(C,12), e26=calcEma(C,26);
  const macdLine=e12.map((v,i)=>v-e26[i]);
  const signalLine=calcEma(macdLine,9);
  const macd=macdLine[n-1], macdSig=signalLine[n-1];
  const macdBull=macd>macdSig;
  const macdHist=+(macd-macdSig).toFixed(2);

  // Bollinger Bands (20,2)
  const bbMid=dma20||C[n-1];
  const bbStd=n>=20?Math.sqrt(C.slice(n-20).reduce((a,v)=>a+(v-bbMid)**2,0)/20):0;
  const bbUpper=+(bbMid+2*bbStd).toFixed(2);
  const bbLower=+(bbMid-2*bbStd).toFixed(2);
  const bbPct=bbUpper>bbLower?(C[n-1]-bbLower)/(bbUpper-bbLower):0.5;

  // Stochastic %K (14,3)
  let stochK=50;
  if(n>=14){
    const lo14=Math.min(...L.slice(n-14)), hi14=Math.max(...H.slice(n-14));
    stochK=hi14===lo14?50:(C[n-1]-lo14)/(hi14-lo14)*100;
  }

  // ADX (14) simplified
  let adx=20;
  if(n>=15){
    let pdm=0,ndm=0,tr14=0;
    for(let i=Math.max(1,n-14);i<n;i++){
      const um=H[i]-H[i-1],dm=L[i-1]-L[i];
      if(um>dm&&um>0)pdm+=um; if(dm>um&&dm>0)ndm+=dm;
      tr14+=Math.max(H[i]-L[i],Math.abs(H[i]-C[i-1]),Math.abs(L[i]-C[i-1]));
    }
    adx=pdm+ndm>0?Math.abs(pdm-ndm)/(pdm+ndm)*100:20;
  }

  // Supertrend (10,3)
  let supertrendSig='neutral', supertrend=null;
  try{
    const atrArr=candles.slice(1).map((c,i)=>Math.max(c.high-c.low,Math.abs(c.high-candles[i].close),Math.abs(c.low-candles[i].close)));
    const atr14=atrArr.slice(-14).reduce((a,b)=>a+b,0)/14;
    let st=C[0],trend=1;
    for(let i=1;i<n;i++){
      const atri=atrArr[i-1]||atr14, mid=(H[i]+L[i])/2;
      const up=mid+3*atri, dn=mid-3*atri;
      if(trend===1)st=Math.max(st,dn); else st=Math.min(st,up);
      if(C[i]<st&&trend===1){trend=-1;st=up;} else if(C[i]>st&&trend===-1){trend=1;st=dn;}
    }
    supertrend=+st.toFixed(2); supertrendSig=trend===1?'bullish':'bearish';
  }catch(e){}

  // Volume analysis
  const vol10 = V.slice(-10).reduce((a,b)=>a+b,0)/10;
  const vol20 = V.slice(-20).reduce((a,b)=>a+b,0)/20;
  const vol60 = n>=60?V.slice(-60).reduce((a,b)=>a+b,0)/60:vol20;
  const volRatio = vol60>0 ? vol10/vol60 : 1;
  const volTrend = volRatio>1.3?'Accumulation':volRatio>1.1?'Rising':volRatio<0.7?'Distribution':'Normal';

  // OBV trend
  let obv=0;
  for(let i=1;i<n;i++) obv+=C[i]>C[i-1]?V[i]:C[i]<C[i-1]?-V[i]:0;
  const obv20ago = (()=>{ let o=0; for(let i=1;i<n-20;i++) o+=C[i]>C[i-1]?V[i]:C[i]<C[i-1]?-V[i]:0; return o; })();
  const obvRising = obv>obv20ago;

  // Accumulation/Distribution
  const upVol=V.slice(-20).filter((_,i)=>C[Math.max(0,n-20+i)]>(i>0?C[n-20+i-1]:C[n-21])).reduce((a,b)=>a+b,0);
  const dnVol=V.slice(-20).filter((_,i)=>C[Math.max(0,n-20+i)]<(i>0?C[n-20+i-1]:C[n-21])).reduce((a,b)=>a+b,0);
  const accumDist=upVol>dnVol?'Accumulation':'Distribution';

  // Beta
  const rets = C.slice(-252).map((c,i,a)=>i===0?0:(c-a[i-1])/a[i-1]).slice(1);
  const std  = rets.length?Math.sqrt(rets.reduce((a,b)=>a+b*b,0)/rets.length):0.013;
  const beta = +Math.min(Math.max(std/0.013,0.3),2.5).toFixed(2);
  const annualVol = +(std*Math.sqrt(252)*100).toFixed(1);

  // 200DMA trend
  const dma200_30ago = n>=230 ? avg(C,n-230,200) : null;
  const dma200Trend = dma200&&dma200_30ago?(dma200>dma200_30ago?'rising':'falling'):null;

  // Weekly higher highs/lows
  const recent=C.slice(-20);
  const fMax=Math.max(...recent.slice(0,10)), sMax=Math.max(...recent.slice(10));
  const fMin=Math.min(...recent.slice(0,10)), sMin=Math.min(...recent.slice(10));
  const weeklyTrend=sMax>fMax&&sMin>fMin?'uptrend':sMax<fMax&&sMin<fMin?'downtrend':'sideways';

  return {
    price:C[n-1],
    dma20, dma50, dma100, dma200,
    wk52Hi, wk52Lo, change52w, change6m, change3m, change1m,
    rsi:+rsi.toFixed(1),
    macd:+macd.toFixed(2), macdSig:+macdSig.toFixed(2), macdBull, macdHist,
    bbUpper, bbLower, bbMid:+bbMid.toFixed(2), bbPct:+bbPct.toFixed(2),
    stochK:+stochK.toFixed(1),
    adx:+adx.toFixed(1),
    supertrend, supertrendSig,
    volRatio:+volRatio.toFixed(2), volTrend, obvRising, accumDist,
    beta, annualVol,
    dma200Trend, weeklyTrend,
    goldenCross: (dma50&&dma200) ? dma50>dma200 : null,
    pctFromHigh: wk52Hi>0 ? +((C[n-1]-wk52Hi)/wk52Hi*100).toFixed(1) : null,
    pctAbove200: dma200>0 ? +((C[n-1]-dma200)/dma200*100).toFixed(1) : null,
    pctAbove50:  dma50>0  ? +((C[n-1]-dma50)/dma50*100).toFixed(1)   : null,
  };
}

// -- Main refresh --------------------------------------------------------------
async function refreshAllFundamentals() {
  if (stockFundLoading) return;
  if (!kite || !process.env.KITE_ACCESS_TOKEN) {
    console.log('📊 Kite not ready - skipping stock refresh'); return;
  }
  stockFundLoading = true;
  console.log('📊 Stock scoring: fetching Kite daily candles...');
  const delay = ms => new Promise(r=>setTimeout(r,ms));
  let ok=0, fail=0;

  for (const stock of UNIVERSE) {
    try {
      const candles = await fetchKiteDaily(stock.sym);
      if (!candles) { fail++; await delay(300); continue; }

      const tech = computeTechnicals(candles);
      const f    = FUND[stock.sym] || null; // [ROE,D/E,PE,RevGr,EpsGr,OpMargin]

      stockFundamentals[stock.sym] = {
        sym:stock.sym, name:stock.n, grp:stock.grp,
        sector: SECTOR_MAP[stock.sym] || 'Other',
        // Technical (Kite) - full set
        price:tech.price,
        dma20:tech.dma20,       dma50:tech.dma50,     dma100:tech.dma100,   dma200:tech.dma200,
        wk52Hi:tech.wk52Hi,     wk52Lo:tech.wk52Lo,
        change52w:tech.change52w, change6m:tech.change6m, change3m:tech.change3m, change1m:tech.change1m,
        rsi:tech.rsi,
        macd:tech.macd,         macdBull:tech.macdBull, macdHist:tech.macdHist,
        bbPct:tech.bbPct,       bbUpper:tech.bbUpper,   bbLower:tech.bbLower,
        stochK:tech.stochK,     adx:tech.adx,
        supertrend:tech.supertrend, supertrendSig:tech.supertrendSig,
        volRatio:tech.volRatio, volTrend:tech.volTrend, obvRising:tech.obvRising, accumDist:tech.accumDist,
        beta:tech.beta,         annualVol:tech.annualVol,
        dma200Trend:tech.dma200Trend, weeklyTrend:tech.weeklyTrend,
        goldenCross:tech.goldenCross,
        pctFromHigh:tech.pctFromHigh, pctAbove200:tech.pctAbove200, pctAbove50:tech.pctAbove50,
        // Fundamental (static table) [ROE,D/E,PE,RevGr,EpsGr,OpMargin]
        roe:      f?f[0]:null,  debtToEq: f?f[1]:null,
        pe:       f?f[2]:null,  revGrowth:f?f[3]:null,
        earGrowth:f?f[4]:null,  opMargin: f?f[5]:null,
        peg:      f&&f[2]&&f[4]&&f[4]>0 ? +(f[2]/f[4]).toFixed(2) : null,
        fetchedAt:Date.now(),
      };
      ok++;
    } catch(e) { fail++; }
    await delay(250);
  }

  stockFundLastFetch = Date.now();
  stockFundLoading   = false;
  stockFundReady     = ok > 10;
  console.log(`📊 Stock scoring done: ${ok} OK, ${fail} failed`);
}

// -- Percentile rank within sector peers --------------------------------------
function pctRankStk(val, arr, hb=true) {
  if (val==null||!arr.length) return 50;
  const valid=arr.filter(v=>v!=null&&isFinite(v));
  if (!valid.length) return 50;
  return Math.round(valid.filter(v=>hb?v<val:v>val).length/valid.length*100);
}

// -- 100-point Master Checklist Scoring (same logic as Deep Analyzer) ----------
function scoreOneStock(f, peers) {
  let s=0; const hits={};
  const na = v => v!=null&&isFinite(v);
  const pr = (val,key,hb=true) => pctRankStk(val, peers.map(p=>p[key]).filter(v=>v!=null&&isFinite(v)), hb);
  const px = f.price || livePrices[f.sym]?.price;

  // -- TREND (25 pts) --------------------------------------------------------
  // Above 200 DMA (8pts)
  if(na(px)&&na(f.dma200)){
    const above=px>f.dma200;
    const pp=above?8:0; s+=pp;
    hits[`200DMA: ${above?'Above':'Below'} (${f.dma200?.toFixed(0)})`]=pp;
  }
  // Golden Cross (7pts)
  if(f.goldenCross!=null){
    const pp=f.goldenCross?7:0; s+=pp;
    hits[f.goldenCross?'Golden Cross':'Death Cross']=pp;
  }
  // vs 50DMA (5pts)
  if(na(px)&&na(f.dma50)){
    const a50=px>f.dma50;
    const pp=a50?5:0; s+=pp;
    hits[`50DMA: ${a50?'Above':'Below'}`]=pp;
  }
  // Not overextended from 200DMA (5pts)
  if(na(px)&&na(f.dma200)){
    const pct200=(px-f.dma200)/f.dma200*100;
    const pp=pct200>0&&pct200<=25?5:pct200>25?2:1; s+=pp;
    hits[`vs 200DMA: ${pct200>=0?'+':''}${pct200.toFixed(1)}%`]=pp;
  }

  // -- MOMENTUM (20 pts) -----------------------------------------------------
  // RSI zone (6pts)
  if(na(f.rsi)){
    const pp=f.rsi>=40&&f.rsi<=65?6:f.rsi>=35&&f.rsi<=70?4:f.rsi<35?3:0;
    s+=pp; hits[`RSI: ${f.rsi.toFixed(0)}`]=pp;
  }
  // 52W return percentile (7pts)
  if(na(f.change52w)){
    const pp=Math.round(pr(f.change52w*100,'_chg52')/100*7*10)/10; s+=pp;
    hits[`52W: ${(f.change52w*100).toFixed(1)}%`]=pp;
  }
  // 6M return (4pts)
  if(na(f.change6m)){
    const pp=Math.round(pr(f.change6m*100,'_chg6m')/100*4*10)/10; s+=pp;
    hits[`6M: ${(f.change6m*100).toFixed(1)}%`]=pp;
  }
  // Volume accumulation (3pts)
  if(na(f.volRatio)){
    const pp=f.volRatio>1.3?3:f.volRatio>1.1?2:f.volRatio>0.9?1:0;
    s+=pp; hits[`Vol: ${f.volRatio.toFixed(2)}x`]=pp;
  }

  // -- QUALITY / FUNDAMENTALS (35 pts) ----------------------------------------
  // ROE (10pts)
  if(na(f.roe)){
    const pp=f.roe>=20?10:f.roe>=15?8:f.roe>=12?5:f.roe>=8?2:0; s+=pp;
    hits[`ROE: ${f.roe.toFixed(1)}%`]=pp;
  }
  // D/E (8pts)
  if(na(f.debtToEq)){
    const pp=f.debtToEq<=0.3?8:f.debtToEq<=0.7?6:f.debtToEq<=1.5?3:f.debtToEq<=3?1:0; s+=pp;
    hits[`D/E: ${f.debtToEq.toFixed(2)}x`]=pp;
  }
  // EPS Growth (10pts)
  if(na(f.earGrowth)&&f.earGrowth<500){
    const pp=f.earGrowth>=25?10:f.earGrowth>=15?8:f.earGrowth>=8?5:f.earGrowth>=0?2:0; s+=pp;
    hits[`EPS Gr: ${f.earGrowth.toFixed(1)}%`]=pp;
  }
  // PE valuation (5pts)
  if(na(f.pe)&&f.pe>0&&f.pe<400){
    const pp=f.pe<15?5:f.pe<25?4:f.pe<40?2:0; s+=pp;
    hits[`P/E: ${f.pe.toFixed(1)}x`]=pp;
  }
  // Op Margin (4pts) - sector relative
  if(na(f.opMargin)){
    const pp=Math.round(pr(f.opMargin,'opMargin')/100*4*10)/10; s+=pp;
    hits[`Op Mgn: ${f.opMargin.toFixed(1)}%`]=pp;
  }
  // PEG (bonus - up to 3pts)
  if(na(f.pe)&&na(f.earGrowth)&&f.earGrowth>0){
    const peg=f.pe/f.earGrowth;
    const pp=peg<1?3:peg<2?2:peg<3?1:0; s+=pp;
    hits[`PEG: ${peg.toFixed(2)}`]=pp;
  }

  // -- VALUE (discount) (10 pts) ----------------------------------------------
  if(na(f.pctFromHigh)){
    const d=Math.abs(f.pctFromHigh);
    const pp=d>=30?4:d>=20?3:d>=10?2:d>=5?1:0;
    if(pp>0){s+=pp;hits[`Discount: ${f.pctFromHigh?.toFixed(1)}% from 52wHi`]=pp;}
  }
  if(na(f.pe)&&f.pe>0&&na(f.roe)&&f.roe>0){
    // PE/ROE ratio - lower is better quality at price
    const perRoe=f.pe/f.roe;
    const pp=perRoe<1?4:perRoe<2?3:perRoe<3?2:0; s+=pp;
    if(pp>0)hits[`PE/ROE: ${perRoe.toFixed(2)}`]=pp;
  }

  return { score:Math.min(Math.round(s*10)/10, 100), hits };
}



// -- Fallen Angel Score (0-100) ------------------------------------------------
// Different logic: rewards quality + how oversold + recovery signals - debt risk
function scoreFallenAngel(f) {
  let s=0; const hits={};
  const na = v => v!=null&&isFinite(v);
  const px = f.price || livePrices[f.sym]?.price;

  // 1. BUSINESS QUALITY (40 pts) - must be a good business to be worth buying
  if(na(f.roe)){
    const pp=f.roe>=25?14:f.roe>=20?12:f.roe>=15?9:f.roe>=10?5:0;
    s+=pp; hits[`ROE ${f.roe.toFixed(1)}%`]=pp;
  }
  if(na(f.debtToEq)){
    const pp=f.debtToEq<=0.3?12:f.debtToEq<=0.7?10:f.debtToEq<=1.5?6:f.debtToEq<=3?2:0;
    s+=pp; hits[`D/E ${f.debtToEq.toFixed(2)}x`]=pp;
  }
  if(na(f.earGrowth)&&f.earGrowth<400){
    const pp=f.earGrowth>=20?10:f.earGrowth>=10?7:f.earGrowth>=0?3:0; // declining EPS = trap
    s+=pp; hits[`EPS Gr ${f.earGrowth.toFixed(1)}%`]=pp;
  }
  if(na(f.opMargin)){
    const pp=f.opMargin>=20?4:f.opMargin>=10?2:0;
    s+=pp; hits[`Op Mgn ${f.opMargin.toFixed(1)}%`]=pp;
  }

  // 2. HOW DEEP IS THE DIP (20 pts) - deeper fall = bigger opportunity IF quality intact
  if(na(f.pctFromHigh)){
    const d=Math.abs(f.pctFromHigh);
    const pp=d>=50?20:d>=40?18:d>=30?15:d>=20?10:0;
    s+=pp; hits[`Fallen ${d.toFixed(0)}% from peak`]=pp;
  }

  // 3. HOW OVERSOLD (20 pts) - more oversold = better entry timing
  if(na(f.rsi)){
    const pp=f.rsi<=25?20:f.rsi<=30?17:f.rsi<=35?14:f.rsi<=40?10:f.rsi<=45?6:f.rsi<=50?3:0;
    s+=pp; hits[`RSI ${f.rsi.toFixed(0)}`]=pp;
  }

  // 4. VALUATION NOW CHEAP (15 pts) - fallen enough to be attractive
  if(na(f.pe)&&f.pe>0&&f.pe<300){
    const pp=f.pe<12?15:f.pe<18?12:f.pe<25?8:f.pe<35?4:0;
    s+=pp; hits[`P/E ${f.pe.toFixed(1)}x`]=pp;
  }

  // 5. RECOVERY SIGNALS (15 pts) - early signs of reversal
  if(f.macdBull!=null){
    const pp=f.macdBull?8:0; // MACD turning bullish = recovery starting
    s+=pp; if(pp) hits['MACD turning bullish']=pp;
  }
  if(f.accumDist){
    const pp=f.accumDist==='Accumulation'?7:0;
    s+=pp; if(pp) hits['Volume: Accumulation']=pp;
  }
  if(f.obvRising!=null){
    const pp=f.obvRising?5:0;
    if(pp){s+=pp; hits['OBV rising']=pp;}
  }
  if(na(f.pctAbove200)&&f.pctAbove200!=null){
    // Near 200DMA is a recovery zone
    const pct=f.pctAbove200;
    if(pct>=-10&&pct<=5){s+=5; hits['Near 200DMA (recovery zone)']=5;}
  }

  // PENALTIES (subtract) - signs this is a value trap not a dip
  if(na(f.earGrowth)&&f.earGrowth<-20){ s-=10; hits['EPS collapse (trap signal)']=-10; }
  if(na(f.debtToEq)&&f.debtToEq>3)   { s-=8;  hits['Dangerous debt (trap risk)']=-8; }
  if(na(f.revGrowth)&&f.revGrowth<-10){ s-=5;  hits['Revenue declining']=-5; }

  const finalScore = Math.min(100, Math.max(0, Math.round(s)));

  // Fallen angel verdict
  let verdict, verdictColor, verdictIcon;
  if(finalScore>=75)     {verdict='Strong Dip Buy';   verdictColor='#22c55e'; verdictIcon='🚀';}
  else if(finalScore>=60){verdict='Good Dip Buy';     verdictColor='#86efac'; verdictIcon='✅';}
  else if(finalScore>=45){verdict='Accumulate Slowly';verdictColor='#f59e0b'; verdictIcon='📈';}
  else if(finalScore>=30){verdict='Watch & Wait';     verdictColor='#f97316'; verdictIcon='⏳';}
  else                   {verdict='Possible Trap';    verdictColor='#ef4444'; verdictIcon='⚠️';}

  return {fallenScore:finalScore, fallenHits:hits, fallenVerdict:verdict, fallenColor:verdictColor, fallenIcon:verdictIcon};
}

app.get('/api/stocks/score', async(req,res)=>{
  try {
    const empty = Object.keys(stockFundamentals).length === 0;
    const stale = Date.now()-stockFundLastFetch > 23*3600*1000;

    if (empty && !stockFundLoading) {
      refreshAllFundamentals(); // trigger background, return loading immediately
      return res.json({stocks:[],loading:true,loadingMsg:'Fetching Kite daily candles for 252 stocks... (~60s)'});
    }
    if (empty && stockFundLoading) {
      return res.json({stocks:[],loading:true,loadingMsg:'Loading Kite candles... please wait'});
    }
    if (stale && !stockFundLoading) refreshAllFundamentals(); // background refresh

    const all = Object.values(stockFundamentals);

    // Pre-compute derived fields for peer percentile ranking
    all.forEach(f=>{
      f._chg52 = f.change52w!=null ? f.change52w*100 : null;
      f._chg6m = f.change6m!=null  ? f.change6m*100  : null;
    });

    // Group by sector
    const bySector={};
    all.forEach(f=>{ const s=f.sector||'Other'; bySector[s]=bySector[s]||[]; bySector[s].push(f); });

    const scored = all.map(f=>{
      const peers = bySector[f.sector||'Other'] || all;
      const {score,hits} = scoreOneStock(f, peers);
      const px = f.price || livePrices[f.sym]?.price || null;
      const isFa = score>=50 && (f.pctFromHigh||0)<=-20 && (f.rsi||50)<=50 && (f.debtToEq||0)<=2 && (f.earGrowth||0)>-20;
      const faData = isFa ? scoreFallenAngel(f) : {};
      return {
        sym:f.sym, name:f.name, grp:f.grp, sector:f.sector, score, hits,
        // Fallen Angel
        ...faData, isFallenAngel:isFa,
        // Fundamentals
        roe:f.roe!=null?+f.roe.toFixed(1):null,
        debtToEq:f.debtToEq!=null?+f.debtToEq.toFixed(2):null,
        opMargin:f.opMargin!=null?+f.opMargin.toFixed(1):null,
        pe:f.pe!=null?+f.pe.toFixed(1):null,
        peg:f.peg!=null?+f.peg.toFixed(2):null,
        revGrowth:f.revGrowth!=null?+f.revGrowth.toFixed(1):null,
        earGrowth:f.earGrowth!=null?+f.earGrowth.toFixed(1):null,
        // Technical - full set
        price:px,
        dma20:f.dma20, dma50:f.dma50, dma100:f.dma100, dma200:f.dma200,
        wk52Hi:f.wk52Hi, wk52Lo:f.wk52Lo,
        wk52Change:f.change52w!=null?+(f.change52w*100).toFixed(1):null,
        change6m:f.change6m!=null?+(f.change6m*100).toFixed(1):null,
        change3m:f.change3m!=null?+(f.change3m*100).toFixed(1):null,
        change1m:f.change1m!=null?+(f.change1m*100).toFixed(1):null,
        rsi:f.rsi!=null?+f.rsi.toFixed(0):null,
        macd:f.macd!=null?+f.macd.toFixed(2):null,
        macdBull:f.macdBull, macdHist:f.macdHist,
        bbPct:f.bbPct!=null?+f.bbPct.toFixed(2):null,
        stochK:f.stochK!=null?+f.stochK.toFixed(1):null,
        adx:f.adx!=null?+f.adx.toFixed(1):null,
        supertrend:f.supertrend, supertrendSig:f.supertrendSig,
        volRatio:f.volRatio!=null?+f.volRatio.toFixed(2):null,
        volTrend:f.volTrend, obvRising:f.obvRising, accumDist:f.accumDist,
        beta:f.beta!=null?+f.beta.toFixed(2):null, annualVol:f.annualVol,
        goldenCross:f.goldenCross,
        pctFromHigh:f.pctFromHigh!=null?+f.pctFromHigh.toFixed(1):null,
        pctAbove200:f.pctAbove200!=null?+f.pctAbove200.toFixed(1):null,
        pctAbove50:f.pctAbove50!=null?+f.pctAbove50.toFixed(1):null,
        dma200Trend:f.dma200Trend, weeklyTrend:f.weeklyTrend,
        fetchedAt:f.fetchedAt,
      };
    });

    scored.sort((a,b)=>b.score-a.score);
    scored.forEach((s,i)=>{s.rank=i+1;});

    res.json({
      stocks:scored, total:scored.length,
      loading:stockFundLoading,
      loadingMsg:stockFundLoading?'Refreshing in background...':null,
      last_refresh: stockFundLastFetch
        ? new Date(stockFundLastFetch).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})
        : 'Never',
      market_open: isMarketOpen(),
      data_source: 'Kite historical daily candles + static fundamentals (Screener.in Q3FY25)',
    });
  } catch(e){ res.status(500).json({error:e.message,stocks:[]}); }
});

// Daily refresh 7AM IST (market opens 9:15 - get fresh data early)
cron.schedule('0 7 * * *', ()=>{ refreshAllFundamentals(); },{timezone:'Asia/Kolkata'});
// First fetch 90s after server start
setTimeout(()=>{ refreshAllFundamentals(); }, 90000);


// First fetch 90s after server start
setTimeout(()=>{ refreshAllFundamentals(); }, 90000);

// -- Deep Single-Stock Analysis endpoint ---------------------------------------
// Gathers: candles, technicals, fundamentals, news sentiment, and AI recommendation
app.get('/api/stocks/analyze/:sym', async(req,res)=>{
  const sym = req.params.sym.toUpperCase().trim();
  try {
    const meta   = UNIVERSE.find(u=>u.sym===sym)||{sym,n:sym,grp:'NSE'};
    const fund   = FUND[sym]||null;
    const sector = SECTOR_MAP[sym]||'Other';
    const token  = validTokens[sym]||INSTRUMENTS[sym];

    // ALL DATA IN PARALLEL
    const [r1y,r3y,r10w,rMax,r1h,rNews] = await Promise.allSettled([
      (async()=>{ if(!kite||!token)return null;
        const t=new Date(),f=new Date(Date.now()-366*864e5);
        return kite.getHistoricalData(token,'day',f.toISOString().split('T')[0],t.toISOString().split('T')[0]);
      })(),
      (async()=>{ if(!kite||!token)return null;
        const t=new Date(),f=new Date(Date.now()-3*366*864e5);
        return kite.getHistoricalData(token,'day',f.toISOString().split('T')[0],t.toISOString().split('T')[0]);
      })(),
      (async()=>{ if(!kite||!token)return null;
        const t=new Date(),f=new Date(Date.now()-10*366*864e5);
        return kite.getHistoricalData(token,'week',f.toISOString().split('T')[0],t.toISOString().split('T')[0]);
      })(),
      (async()=>{ if(!kite||!token)return null;
        return kite.getHistoricalData(token,'month','1994-01-01',new Date().toISOString().split('T')[0]);
      })(),
      (async()=>{ if(!kite||!token)return null;
        const t=new Date(),f=new Date(Date.now()-180*864e5);
        return kite.getHistoricalData(token,'60minute',f.toISOString().split('T')[0],t.toISOString().split('T')[0]);
      })(),
      (async()=>{
        const feeds=[
          {url:'https://economictimes.indiatimes.com/markets/stocks/rss.cms',src:'ET Markets'},
          {url:'https://www.moneycontrol.com/rss/MCtopnews.xml',src:'Moneycontrol'},
          {url:'https://www.business-standard.com/rss/markets-106.rss',src:'Business Standard'},
          {url:'https://www.livemint.com/rss/markets',src:'Mint'},
        ];
        const items=[];
        await Promise.allSettled(feeds.map(async({url,src})=>{
          try{
            const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(6000)});
            if(!r.ok)return;
            const xml=await r.text();
            [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].forEach(m=>{
              const it=m[1];
              const title=(it.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]||it.match(/<title>(.*?)<\/title>/)?.[1]||'').trim();
              const desc=(it.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1]||'').replace(/<[^>]+>/g,'').trim().slice(0,300);
              const link=(it.match(/<link>(.*?)<\/link>/)?.[1]||'').trim();
              const pub=(it.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]||'').trim();
              if(!title)return;
              const txt=(title+' '+desc).toUpperCase();
              const nm=meta.n.toUpperCase();
              const nameWords=nm.split(/\s+/).filter(w=>w.length>=4);
              if(!txt.includes(sym)&&!nameWords.some(w=>txt.includes(w))&&!txt.includes(nm.slice(0,5)))return;
              const bull=['RISE','SURGE','JUMP','GAIN','RALLY','BUY','BULLISH','PROFIT','GROWTH','RECORD','OUTPERFORM','UPGRADE','TARGET RAISED','STRONG','BEAT','EXPAND','WIN','ACQUIRE','ORDER','CONTRACT'].some(w=>txt.includes(w));
              const bear=['FALL','DROP','DECLINE','SLIP','SELL','BEARISH','LOSS','WEAK','UNDERPERFORM','DOWNGRADE','TARGET CUT','CRASH','MISS','FRAUD','PROBE','PENALTY','WARN','CONCERN','DEBT'].some(w=>txt.includes(w));
              const sentiment=bull&&!bear?'bullish':bear&&!bull?'bearish':'neutral';
              const mins=pub?Math.round((Date.now()-new Date(pub))/60000):9999;
              const timeAgo=mins<60?`${mins}m ago`:mins<1440?`${Math.round(mins/60)}h ago`:`${Math.round(mins/1440)}d ago`;
              items.push({title,desc,link,src,sentiment,timeAgo,mins,pub});
            });
          }catch(e){}
        }));
        const seen=new Set();
        return items.filter(i=>{const k=i.title.slice(0,40);if(seen.has(k))return false;seen.add(k);return true;})
          .sort((a,b)=>a.mins-b.mins).slice(0,15);
      })(),
    ]);

    const c1y  = r1y.status==='fulfilled'  && r1y.value  ? r1y.value  : [];
    const c3y  = r3y.status==='fulfilled'  && r3y.value  ? r3y.value  : [];
    const c10w = r10w.status==='fulfilled' && r10w.value ? r10w.value : [];
    const cMax = rMax.status==='fulfilled' && rMax.value ? rMax.value : [];
    const c1h  = r1h.status==='fulfilled'  && r1h.value  ? r1h.value  : [];
    const news = rNews.status==='fulfilled'&& rNews.value? rNews.value: [];

    const candles = c3y.length>=50?c3y : c1y.length>=50?c1y : c10w.length>=30?c10w : cMax.length>=12?cMax:[];
    const px = candles.length?candles[candles.length-1].close : livePrices[sym]?.price||null;

    // FULL TECHNICAL ENGINE
    function fullTech(cans){
      if(!cans||cans.length<20) return {};
      const C=cans.map(c=>c.close), H=cans.map(c=>c.high), L=cans.map(c=>c.low), V=cans.map(c=>c.volume||0);
      const n=C.length;
      const avgArr=(arr,s,l)=>arr.slice(s,s+l).reduce((a,b)=>a+b,0)/l;
      const calcEma=(arr,p)=>{const k=2/(p+1);let e=arr[0];return arr.map(v=>{e=v*k+e*(1-k);return e;});};
      const sma=(p)=>n>=p?avgArr(C,n-p,p):null;

      const dma9=sma(9),dma20=sma(20),dma50=sma(50),dma100=sma(100),dma150=sma(150),dma200=sma(200);
      const e9=calcEma(C,9),e12=calcEma(C,12),e20=calcEma(C,20),e21=calcEma(C,21);
      const e26=calcEma(C,26),e50=calcEma(C,50),e200=calcEma(C,200);
      const ema9=e9[n-1],ema20=e20[n-1],ema21=e21[n-1],ema50=e50[n-1],ema200=e200[n-1];

      const macdLine=e12.map((v,i)=>v-e26[i]);
      const signalLine=calcEma(macdLine,9);
      const macdVal=macdLine[n-1],sigVal=signalLine[n-1],macdHist=+(macdVal-sigVal).toFixed(2);
      const macdBull=macdVal>sigVal;
      const macdMomentum=Math.abs(macdHist)>Math.abs(macdLine[n-2]-signalLine[n-2])?'expanding':'shrinking';

      const calcRSI=(c,p)=>{if(c.length<p+1)return 50;let g=0,ls=0;for(let i=c.length-p;i<c.length;i++){const d=c[i]-c[i-1];if(d>0)g+=d;else ls-=d;}return ls===0?100:100-100/(1+g/p/(ls/p));};
      const rsi7=calcRSI(C,7),rsi14=calcRSI(C,14),rsi21=calcRSI(C,21);

      const stochRSI=(()=>{if(n<28)return{k:50,d:50};
        const ra=[];for(let i=14;i<n;i++){let g=0,ls=0;for(let j=i-13;j<=i;j++){const d=C[j]-C[j-1];if(d>0)g+=d;else ls-=d;}ra.push(ls===0?100:100-100/(1+g/14/(ls/14)));}
        const r=ra.slice(-14),lo=Math.min(...r),hi=Math.max(...r);
        const k=hi===lo?50:(r[r.length-1]-lo)/(hi-lo)*100;return{k:+k.toFixed(1),d:+k.toFixed(1)};
      })();

      let stochK=50,stochD=50;
      if(n>=14){
        const lo14=Math.min(...L.slice(n-14)),hi14=Math.max(...H.slice(n-14));
        stochK=hi14===lo14?50:(C[n-1]-lo14)/(hi14-lo14)*100;
        const kArr=[];
        for(let i=Math.max(14,n-16);i<n;i++){
          const lo=Math.min(...L.slice(Math.max(0,i-13),i+1));
          const hi=Math.max(...H.slice(Math.max(0,i-13),i+1));
          kArr.push(hi===lo?50:(C[i]-lo)/(hi-lo)*100);
        }
        stochD=kArr.slice(-3).reduce((a,b)=>a+b,0)/Math.min(3,kArr.length);
      }

      const bbMid=dma20||C[n-1];
      const bbStd=n>=20?Math.sqrt(C.slice(n-20).reduce((a,v)=>a+(v-bbMid)**2,0)/20):0;
      const bbUpper=+(bbMid+2*bbStd).toFixed(2),bbLower=+(bbMid-2*bbStd).toFixed(2);
      const bbWidth=bbMid>0?+((bbUpper-bbLower)/bbMid*100).toFixed(1):0;
      const bbPct=bbUpper>bbLower?+((C[n-1]-bbLower)/(bbUpper-bbLower)).toFixed(3):0.5;
      const bbSqueeze=bbWidth<2.5;

      const atrArr=n>=2?cans.slice(1).map((c,i)=>Math.max(c.high-c.low,Math.abs(c.high-cans[i].close),Math.abs(c.low-cans[i].close))):[];
      const atr14=atrArr.length>=14?atrArr.slice(-14).reduce((a,b)=>a+b,0)/14:0;
      const kcUpper=+(bbMid+2*atr14).toFixed(2),kcLower=+(bbMid-2*atr14).toFixed(2);
      const sqzMomentum=bbLower>kcLower&&bbUpper<kcUpper;
      const atrPct=C[n-1]>0?+(atr14/C[n-1]*100).toFixed(2):0;

      let willR=-50;
      if(n>=14){const hi14=Math.max(...H.slice(n-14)),lo14=Math.min(...L.slice(n-14));willR=hi14===lo14?-50:(hi14-C[n-1])/(hi14-lo14)*-100;}

      let cci=0;
      if(n>=20){const tp=cans.slice(n-20).map(c=>(c.high+c.low+c.close)/3);const tm=tp.reduce((a,b)=>a+b,0)/20;const md=tp.reduce((a,v)=>a+Math.abs(v-tm),0)/20;cci=md>0?(tp[19]-tm)/(0.015*md):0;}

      let adx=25,adxPlus=0,adxMinus=0;
      if(n>=15){
        let pdm=0,ndm=0,tr14=0;
        for(let i=Math.max(1,n-14);i<n;i++){
          const um=H[i]-H[i-1],dm=L[i-1]-L[i];
          if(um>dm&&um>0)pdm+=um;if(dm>um&&dm>0)ndm+=dm;
          tr14+=Math.max(H[i]-L[i],Math.abs(H[i]-C[i-1]),Math.abs(L[i]-C[i-1]));
        }
        adxPlus=tr14>0?pdm/tr14*100:0;adxMinus=tr14>0?ndm/tr14*100:0;
        adx=adxPlus+adxMinus>0?Math.abs(adxPlus-adxMinus)/(adxPlus+adxMinus)*100:25;
      }
      const trendStrength=adx>35?'Very Strong':adx>25?'Strong':adx>20?'Moderate':'Weak/Sideways';

      let supertrendVal=null,supertrendSig='neutral';
      try{
        let st=C[0],trend=1;
        for(let i=1;i<n;i++){
          const atri=atrArr[i-1]||atr14;const mid=(H[i]+L[i])/2;
          const up=mid+3*atri,dn=mid-3*atri;
          if(trend===1){st=Math.max(st,dn);}else{st=Math.min(st,up);}
          if(C[i]<st&&trend===1){trend=-1;st=up;}else if(C[i]>st&&trend===-1){trend=1;st=dn;}
        }
        supertrendVal=+st.toFixed(2);supertrendSig=trend===1?'bullish':'bearish';
      }catch(e){}

      let sar=L[0],sarBull=true;
      try{
        let af=0.02,ep=H[0];
        for(let i=1;i<n;i++){
          sar=sar+af*(ep-sar);
          if(sarBull){if(C[i]>ep){ep=C[i];af=Math.min(af+0.02,0.2);}if(L[i]<sar){sarBull=false;sar=ep;ep=L[i];af=0.02;}}
          else{if(C[i]<ep){ep=C[i];af=Math.min(af+0.02,0.2);}if(H[i]>sar){sarBull=true;sar=ep;ep=H[i];af=0.02;}}
        }
      }catch(e){}

      let ichimoku={};
      if(n>=52){
        const tenkan=(Math.max(...H.slice(n-9))+Math.min(...L.slice(n-9)))/2;
        const kijun=(Math.max(...H.slice(n-26))+Math.min(...L.slice(n-26)))/2;
        const senkouA=(tenkan+kijun)/2;
        const senkouB=(Math.max(...H.slice(n-52))+Math.min(...L.slice(n-52)))/2;
        ichimoku={tenkan:+tenkan.toFixed(2),kijun:+kijun.toFixed(2),senkouA:+senkouA.toFixed(2),senkouB:+senkouB.toFixed(2),
          aboveCloud:C[n-1]>Math.max(senkouA,senkouB),tenkanAboveKijun:tenkan>kijun,
          bullish:C[n-1]>Math.max(senkouA,senkouB)&&tenkan>kijun};
      }

      const yr=C.slice(-252);
      const wk52Hi=yr.length?Math.max(...yr):C[n-1],wk52Lo=yr.length?Math.min(...yr):C[n-1];
      const fibRange=wk52Hi-wk52Lo;
      const fibs={r236:+(wk52Lo+0.236*fibRange).toFixed(2),r382:+(wk52Lo+0.382*fibRange).toFixed(2),r500:+(wk52Lo+0.500*fibRange).toFixed(2),r618:+(wk52Lo+0.618*fibRange).toFixed(2),r786:+(wk52Lo+0.786*fibRange).toFixed(2),r1000:+wk52Hi.toFixed(2)};

      const vol10=V.slice(-10).reduce((a,b)=>a+b,0)/10;
      const vol20=V.slice(-20).reduce((a,b)=>a+b,0)/20;
      const vol50=n>=50?V.slice(-50).reduce((a,b)=>a+b,0)/50:vol20;
      const volRatio20=vol20>0?+(vol10/vol20).toFixed(2):1;
      const volTrend=volRatio20>1.3?'Accumulation':volRatio20>1.1?'Rising':volRatio20<0.7?'Distribution':volRatio20<0.9?'Declining':'Normal';

      let obv=0;const obvArr=[0];
      for(let i=1;i<n;i++){obv+=C[i]>C[i-1]?V[i]:C[i]<C[i-1]?-V[i]:0;obvArr.push(obv);}
      const obvTrend=obvArr[n-1]>obvArr[Math.max(0,n-20)]?'Rising (bullish)':'Falling (bearish)';

      const vwapArr=cans.slice(-20).map((_,i,a)=>{const cumTP=a.slice(0,i+1).reduce((s,x)=>s+(x.high+x.low+x.close)/3*(x.volume||1),0);const cumV=a.slice(0,i+1).reduce((s,x)=>s+(x.volume||1),0);return cumV>0?cumTP/cumV:(a[i].high+a[i].low+a[i].close)/3;});
      const vwap=vwapArr[vwapArr.length-1];

      const roc10=n>=11?+((C[n-1]-C[n-11])/C[n-11]*100).toFixed(2):null;
      const roc20=n>=21?+((C[n-1]-C[n-21])/C[n-21]*100).toFixed(2):null;

      let mfi=50;
      if(n>=15){let pf=0,nf=0;for(let i=n-14;i<n;i++){const tp=(H[i]+L[i]+C[i])/3,tp0=(H[i-1]+L[i-1]+C[i-1])/3,mv=tp*V[i];if(tp>tp0)pf+=mv;else if(tp<tp0)nf+=mv;}mfi=nf===0?100:100-100/(1+pf/nf);}

      // Weekly higher highs/lows check (last 20 candles)
      let weeklyTrend='sideways';
      if(n>=20){
        const recent=C.slice(-20);
        const firstHalf=recent.slice(0,10),secondHalf=recent.slice(10);
        const fMax=Math.max(...firstHalf),sMax=Math.max(...secondHalf);
        const fMin=Math.min(...firstHalf),sMin=Math.min(...secondHalf);
        if(sMax>fMax&&sMin>fMin) weeklyTrend='uptrend';
        else if(sMax<fMax&&sMin<fMin) weeklyTrend='downtrend';
      }

      // 200 DMA trending up or down
      const dma200_30ago=n>=230?avgArr(C,n-230,200):null;
      const dma200Trend=dma200&&dma200_30ago?(dma200>dma200_30ago?'rising':'falling'):null;

      // Accumulation/Distribution pattern
      const upDays=V.slice(-20).filter((_,i)=>C[Math.max(0,n-20+i)]>(i>0?C[n-20+i-1]:C[n-20]));
      const downDays=V.slice(-20).filter((_,i)=>C[Math.max(0,n-20+i)]<(i>0?C[n-20+i-1]:C[n-20]));
      const accumDist=upDays.reduce((a,b)=>a+b,0)>downDays.reduce((a,b)=>a+b,0)?'Accumulation':'Distribution';

      const ret1m=n>=21?+((C[n-1]-C[n-21])/C[n-21]*100).toFixed(1):null;
      const ret3m=n>=63?+((C[n-1]-C[n-63])/C[n-63]*100).toFixed(1):null;
      const ret6m=n>=126?+((C[n-1]-C[n-126])/C[n-126]*100).toFixed(1):null;
      const ret1y=yr.length>1?+((C[n-1]-yr[0])/yr[0]*100).toFixed(1):null;
      const ret3y=n>=756?+((C[n-1]-C[n-756])/C[n-756]*100).toFixed(1):null;
      const pctFromHigh=wk52Hi>0?+((C[n-1]-wk52Hi)/wk52Hi*100).toFixed(1):0;
      const pctFromLow=wk52Lo>0?+((C[n-1]-wk52Lo)/wk52Lo*100).toFixed(1):0;
      const pctAbove200=dma200?+((C[n-1]-dma200)/dma200*100).toFixed(1):null;

      const dailyRets=C.slice(-252).map((c,i,a)=>i===0?0:(c-a[i-1])/a[i-1]).slice(1);
      const stdDev=dailyRets.length?Math.sqrt(dailyRets.reduce((a,b)=>a+b*b,0)/dailyRets.length):0.013;
      const beta=+Math.min(Math.max(stdDev/0.013,0.3),3.0).toFixed(2);
      const annualVol=+(stdDev*Math.sqrt(252)*100).toFixed(1);

      // Overextension check
      const overextended=pctAbove200!=null&&pctAbove200>30;

      // Support & Resistance
      const pivots=[];
      const data=cans.slice(-500);const dn=data.length;
      for(let i=5;i<dn-5;i++){
        const win=data.slice(i-5,i+6);if(win.length<6)continue;
        const isHi=data[i].high>=Math.max(...win.map(c=>c.high));
        const isLo=data[i].low<=Math.min(...win.map(c=>c.low));
        if(isHi)pivots.push({price:data[i].high,type:'resistance',strength:0});
        if(isLo)pivots.push({price:data[i].low,type:'support',strength:0});
      }
      pivots.sort((a,b)=>a.price-b.price);
      const levels=[];const used=new Set();
      for(let i=0;i<pivots.length;i++){
        if(used.has(i))continue;
        const cluster=[pivots[i]];
        for(let j=i+1;j<pivots.length;j++){if(used.has(j))continue;if(Math.abs(pivots[j].price-pivots[i].price)/pivots[i].price<0.015){cluster.push(pivots[j]);used.add(j);}}
        used.add(i);
        const avgP=cluster.reduce((a,c)=>a+c.price,0)/cluster.length;
        levels.push({price:+avgP.toFixed(2),strength:cluster.length,type:avgP<C[n-1]?'support':'resistance'});
      }
      const supports=levels.filter(l=>l.type==='support').sort((a,b)=>b.price-a.price).slice(0,6);
      const resistances=levels.filter(l=>l.type==='resistance').sort((a,b)=>a.price-b.price).slice(0,6);

      const strongSup=supports[0]?.price||null;
      const nextRes=resistances[0]?.price||null;
      const buyZoneLow=strongSup?+(strongSup*0.99).toFixed(2):null;
      const buyZoneHigh=strongSup?+(strongSup*1.02).toFixed(2):null;
      const dma50BuyZone=dma50?{low:+(dma50*0.98).toFixed(2),high:+(dma50*1.01).toFixed(2)}:null;
      const dma200BuyZone=dma200?{low:+(dma200*0.97).toFixed(2),high:+(dma200*1.01).toFixed(2)}:null;
      const upsidePct=nextRes&&C[n-1]?+((nextRes-C[n-1])/C[n-1]*100).toFixed(1):null;
      const riskReward=strongSup&&nextRes&&C[n-1]&&C[n-1]>strongSup?+((nextRes-C[n-1])/(C[n-1]-strongSup)).toFixed(2):null;

      // Candlestick patterns
      const patterns=[];
      if(n>=3){
        const [c3,c2,c1]=[cans[n-3],cans[n-2],cans[n-1]];
        const body1=Math.abs(c1.close-c1.open),range1=c1.high-c1.low;
        const body2=Math.abs(c2.close-c2.open);
        if(range1>0&&body1/range1<0.1) patterns.push({name:'Doji',signal:'neutral',desc:'Indecision - market at crossroads'});
        if(c1.close>c1.open&&(c1.open-c1.low)>2*body1&&(c1.high-c1.close)<body1) patterns.push({name:'Hammer',signal:'bullish',desc:'Buyers stepped in at lows - potential reversal'});
        if(c2.close<c2.open&&c1.close>c1.open&&c1.close>c2.open&&c1.open<c2.close) patterns.push({name:'Bullish Engulfing',signal:'bullish',desc:'Strong reversal - bulls took full control'});
        if(c2.close>c2.open&&c1.close<c1.open&&c1.close<c2.open&&c1.open>c2.close) patterns.push({name:'Bearish Engulfing',signal:'bearish',desc:'Strong reversal - bears took full control'});
        if(c3.close<c3.open&&body2<Math.abs(c3.close-c3.open)*0.3&&c1.close>c1.open&&c1.close>(c3.open+c3.close)/2) patterns.push({name:'Morning Star',signal:'bullish',desc:'3-candle bottom reversal pattern'});
      }

      return {
        price:C[n-1],
        dma9,dma20,dma50,dma100,dma150,dma200,
        ema9,ema20,ema21,ema50,ema200,
        goldenCross:dma50&&dma200?dma50>dma200:null,
        above20:dma20?C[n-1]>dma20:null,
        above50:dma50?C[n-1]>dma50:null,
        above200:dma200?C[n-1]>dma200:null,
        dma200Trend,pctAbove200,overextended,weeklyTrend,accumDist,
        macd:+macdVal.toFixed(2),macdSignal:+sigVal.toFixed(2),macdHist,macdBull,macdMomentum,
        rsi7:+rsi7.toFixed(1),rsi14:+rsi14.toFixed(1),rsi21:+rsi21.toFixed(1),
        stochRsiK:stochRSI.k,stochRsiD:stochRSI.d,
        stochK:+stochK.toFixed(1),stochD:+stochD.toFixed(1),
        bbUpper,bbLower,bbMid:+(bbMid||0).toFixed(2),bbWidth,bbPct,bbSqueeze,sqzMomentum,
        kcUpper,kcLower,
        adx:+adx.toFixed(1),adxPlus:+adxPlus.toFixed(1),adxMinus:+adxMinus.toFixed(1),trendStrength,
        supertrend:supertrendVal,supertrendSig,
        sarSignal:sarBull?'bullish':'bearish',sar:+sar.toFixed(2),
        ichimoku,fibs,
        cci:+cci.toFixed(1),cciSignal:cci>100?'overbought':cci<-100?'oversold':'neutral',
        willR:+willR.toFixed(1),roc10,roc20,
        mfi:+mfi.toFixed(1),
        volRatio20,volTrend,obvTrend,vwap:+vwap.toFixed(2),
        atr:+atr14.toFixed(2),atrPct,annualVol,beta,
        wk52Hi,wk52Lo,
        ret1m,ret3m,ret6m,ret1y,ret3y,
        pctFromHigh,pctFromLow,
        supports,resistances,
        buyZoneLow,buyZoneHigh,idealBuy:strongSup?+strongSup.toFixed(2):null,
        dma50BuyZone,dma200BuyZone,upsidePct,riskReward,patterns,
        candles:cans.slice(-365).map(c=>({t:new Date(c.date).getTime(),o:+c.open.toFixed(2),h:+c.high.toFixed(2),l:+c.low.toFixed(2),c:+c.close.toFixed(2),v:c.volume||0})),
      };
    }

    const safeCompute=(cans)=>{try{return fullTech(cans);}catch(e){console.error(`tech err ${sym}:`,e.message);return {};}};
    const techCandles=c3y.length>=50?c3y:c1y.length>=50?c1y:c10w.length>=30?c10w:candles;
    const t  = safeCompute(techCandles);
    const tw = safeCompute(c10w.length>30?c10w:null);
    const tm = safeCompute(cMax.length>12?cMax:null);
    const th = safeCompute(c1h.length>20?c1h:null);

    const charts={
      '3M': c1h.slice(-500).map(c=>({t:new Date(c.date).getTime(),o:+c.open.toFixed(2),h:+c.high.toFixed(2),l:+c.low.toFixed(2),c:+c.close.toFixed(2),v:c.volume||0})),
      '1Y': c1y.slice(-365).map(c=>({t:new Date(c.date).getTime(),o:+c.open.toFixed(2),h:+c.high.toFixed(2),l:+c.low.toFixed(2),c:+c.close.toFixed(2),v:c.volume||0})),
      '3Y': c3y.map(c=>({t:new Date(c.date).getTime(),o:+c.open.toFixed(2),h:+c.high.toFixed(2),l:+c.low.toFixed(2),c:+c.close.toFixed(2),v:c.volume||0})),
      '10Y':c10w.map(c=>({t:new Date(c.date).getTime(),o:+c.open.toFixed(2),h:+c.high.toFixed(2),l:+c.low.toFixed(2),c:+c.close.toFixed(2),v:c.volume||0})),
      'MAX':cMax.map(c=>({t:new Date(c.date).getTime(),o:+c.open.toFixed(2),h:+c.high.toFixed(2),l:+c.low.toFixed(2),c:+c.close.toFixed(2),v:c.volume||0})),
    };

    // FUNDAMENTALS
    const f=fund?{
      roe:fund[0],de:fund[1],pe:fund[2],revGr:fund[3],epsGr:fund[4],opMgn:fund[5],
      peg:fund[2]&&fund[4]&&fund[4]>0?+(fund[2]/fund[4]).toFixed(2):null,
      roePeer:fund[0]>=20?'Excellent (>20%)':fund[0]>=15?'Good (15-20%)':fund[0]>=10?'Average (10-15%)':'Weak (<10%)',
      dePeer:fund[1]<=0.3?'Near debt-free':fund[1]<=0.7?'Very low debt':fund[1]<=1.5?'Manageable':fund[1]<=3?'High debt':'Dangerous',
      pePeer:fund[2]<15?'Cheap (<15x)':fund[2]<25?'Fair (15-25x)':fund[2]<40?'Premium (25-40x)':'Expensive (>40x)',
      growthPeer:fund[3]>=25?'Hypergrowth (>25%)':fund[3]>=15?'Strong (15-25%)':fund[3]>=8?'Moderate (8-15%)':fund[3]>=0?'Slow (<8%)':'Declining',
    }:null;

    // NEWS SENTIMENT
    const bull=news.filter(n=>n.sentiment==='bullish').length;
    const bear=news.filter(n=>n.sentiment==='bearish').length;
    const neut=news.filter(n=>n.sentiment==='neutral').length;
    const sentScore=news.length?Math.round((bull-bear)/news.length*100):0;

    // ================================================================
    // MASTER CHECKLIST SCORING (based on the 23-point framework)
    // ================================================================
    const checklist={};

    // 1. TREND (Critical) - 25 pts
    checklist.abv200     ={pass:t.above200===true,   pts:t.above200===true?8:0,  max:8,  label:'Price above 200 DMA',      detail:t.above200===true?`Yes - trading above DMA200 (${t.dma200?.toFixed(0)})`:`No - below DMA200 (${t.dma200?.toFixed(0)}). Risk zone.`};
    checklist.dma200up   ={pass:t.dma200Trend==='rising',pts:t.dma200Trend==='rising'?6:0,max:6,label:'200 DMA trending up',detail:t.dma200Trend==='rising'?'Yes - long-term trend is up':'No - 200DMA is falling. Downtrend.'};
    checklist.goldenX    ={pass:t.goldenCross===true, pts:t.goldenCross===true?6:0,max:6, label:'Golden Cross (50>200 DMA)', detail:t.goldenCross===true?'Yes - 50DMA above 200DMA. Long-term bullish.':'No - Death Cross. Bears in control.'};
    checklist.weeklyHL   ={pass:t.weeklyTrend==='uptrend',pts:t.weeklyTrend==='uptrend'?5:0,max:5,label:'Weekly higher highs/lows',detail:t.weeklyTrend==='uptrend'?'Yes - price making higher highs and higher lows':t.weeklyTrend==='downtrend'?'No - lower highs, lower lows (downtrend)':'Sideways - no clear direction'};

    // 2. MOMENTUM
    checklist.rsiZone    ={pass:t.rsi14>=40&&t.rsi14<=65,pts:t.rsi14>=40&&t.rsi14<=65?4:t.rsi14<40?3:0,max:4,label:`RSI-14 at ${t.rsi14?.toFixed(0)}`,detail:t.rsi14<35?'Oversold - potential buy zone (RSI<35)':t.rsi14>=40&&t.rsi14<=65?'Healthy zone (40-65) - good for entry':t.rsi14>70?'Overbought (>70) - avoid chasing':'Near accumulation zone'};
    checklist.macdBull   ={pass:t.macdBull===true,pts:t.macdBull?3:0,max:3,label:'MACD bullish',detail:t.macdBull?`MACD (${t.macd}) above signal - momentum positive`:`MACD bearish - momentum weak`};
    checklist.superT     ={pass:t.supertrendSig==='bullish',pts:t.supertrendSig==='bullish'?3:0,max:3,label:'Supertrend bullish',detail:t.supertrendSig==='bullish'?`Price above Supertrend (${t.supertrend}) - trend confirmed`:`Below Supertrend (${t.supertrend}) - sell signal`};

    // 3. VOLUME
    checklist.volAccum   ={pass:t.accumDist==='Accumulation',pts:t.accumDist==='Accumulation'?3:0,max:3,label:'Volume: Accumulation',detail:t.accumDist==='Accumulation'?'More volume on up days - institutions buying':'More volume on down days - distribution/selling'};
    checklist.obvRising  ={pass:t.obvTrend?.includes('Rising'),pts:t.obvTrend?.includes('Rising')?2:0,max:2,label:'OBV rising',detail:t.obvTrend||'N/A'};

    // 4. OVEREXTENSION CHECK
    const overExt=t.overextended;
    checklist.overext    ={pass:!overExt,pts:!overExt?3:0,max:3,label:'Not overextended',detail:overExt?`Caution: ${t.pctAbove200}% above 200DMA - wait for pullback`:`Price is ${t.pctAbove200}% from 200DMA - not overextended`};

    // 5. SUPPORT/BUY ZONE
    const nearSupport=t.buyZoneLow&&px&&px>=t.buyZoneLow*0.98&&px<=t.buyZoneHigh*1.02;
    const nearDma200=t.dma200&&px&&Math.abs(px-t.dma200)/t.dma200<0.05;
    const nearDma50=t.dma50&&px&&Math.abs(px-t.dma50)/t.dma50<0.03;
    checklist.nearBuy    ={pass:nearSupport||nearDma200||nearDma50,pts:nearSupport||nearDma200||nearDma50?4:0,max:4,label:'Near support/buy zone',detail:nearDma200?`Near 200DMA (${t.dma200?.toFixed(0)}) - institutional buy zone`:nearDma50?`Near 50DMA (${t.dma50?.toFixed(0)}) - momentum buy zone`:nearSupport?`Near support zone (${t.buyZoneLow}-${t.buyZoneHigh})`:`Not near key support. Current: ${px?.toFixed(0)}, nearest support: ${t.supports?.[0]?.price||'N/A'}`};

    // 6. RISK:REWARD
    checklist.rrRatio    ={pass:t.riskReward>=2,pts:t.riskReward>=2?3:t.riskReward>=1?1:0,max:3,label:`R:R ratio ${t.riskReward||'N/A'}x`,detail:t.riskReward>=2?`Good R:R of ${t.riskReward}x - risk ${px&&t.supports?.[0]?.price?(px-t.supports[0].price).toFixed(0):'?'}, target ${t.resistances?.[0]?.price||'?'}`:t.riskReward?`R:R of ${t.riskReward}x - minimum 2x preferred`:'Cannot calculate R:R'};

    // 7. FUNDAMENTALS (from static data)
    checklist.roeCheck   ={pass:f&&f.roe>=15,pts:f?f.roe>=20?8:f.roe>=15?6:f.roe>=10?3:0:0,max:8,label:`ROE: ${f?f.roe+'%':'N/A'}`,detail:f?`${f.roePeer}. ${f.roe>=15?'Management creating shareholder value.':'Below 15% threshold - weak returns on equity.'}`:'No fundamental data'};
    checklist.debtCheck  ={pass:f&&f.de<=1,pts:f?f.de<=0.3?6:f.de<=0.7?5:f.de<=1?3:0:0,max:6,label:`Debt/Equity: ${f?f.de+'x':'N/A'}`,detail:f?`${f.dePeer}. ${f.de<=1?'Healthy balance sheet.':'High leverage increases risk.'}`:'N/A'};
    checklist.peCheck    ={pass:f&&f.pe<40,pts:f?f.pe<15?5:f.pe<25?4:f.pe<40?2:0:0,max:5,label:`P/E: ${f?f.pe+'x':'N/A'}`,detail:f?`${f.pePeer} vs market`:'N/A'};
    checklist.growthCheck={pass:f&&f.epsGr>=10,pts:f&&f.epsGr<400?f.epsGr>=25?6:f.epsGr>=15?5:f.epsGr>=10?3:f.epsGr>=0?1:0:0,max:6,label:`EPS Growth: ${f?f.epsGr+'%':'N/A'}`,detail:f?`${f.epsGr>=15?'Strong earnings growth - key long-term driver':f.epsGr>=0?'Modest growth':'Earnings declining - red flag'}`:'N/A'};
    checklist.marginCheck={pass:f&&f.opMgn>=15,pts:f?f.opMgn>=20?3:f.opMgn>=15?2:f.opMgn>=10?1:0:0,max:3,label:`Op Margin: ${f?f.opMgn+'%':'N/A'}`,detail:f?`${f.opMgn>=20?'High margin business - pricing power':'${f.opMgn>=10?"Reasonable margins":"Thin margins - vulnerable to cost pressure"}'}`:'N/A'};

    // 8. SENTIMENT
    checklist.newsCheck  ={pass:sentScore>=0,pts:sentScore>30?3:sentScore>0?2:sentScore===0?1:0,max:3,label:`News: ${bull}B/${bear}Be/${neut}N`,detail:news.length>0?`${sentScore>0?'Positive':'Negative'} news flow. ${bull} bullish, ${bear} bearish articles found.`:'No recent news found in feeds'};

    // TOTAL SCORE
    const totalPts=Object.values(checklist).reduce((a,c)=>a+c.pts,0);
    const maxPts=Object.values(checklist).reduce((a,c)=>a+c.max,0);
    const pctScore=Math.round(totalPts/maxPts*100);
    const passCount=Object.values(checklist).filter(c=>c.pass).length;
    const totalChecks=Object.keys(checklist).length;

    // VERDICT
    let verdict,verdictColor,verdictIcon,action,timeframe;
    if(pctScore>=75)     {verdict='Strong Buy';    verdictColor='#22c55e';verdictIcon='🚀';action='BUY NOW';timeframe='Excellent setup - all major criteria met';}
    else if(pctScore>=60){verdict='Buy';           verdictColor='#86efac';verdictIcon='✅';action='BUY';timeframe='Good long-term opportunity, accumulate';}
    else if(pctScore>=45){verdict='Accumulate';    verdictColor='#f59e0b';verdictIcon='📈';action='ACCUMULATE ON DIPS';timeframe='Mixed signals - buy in parts near support';}
    else if(pctScore>=30){verdict='Hold / Watch';  verdictColor='#f97316';verdictIcon='⏳';action='WAIT';timeframe='Wait for better entry or trend reversal';}
    else if(pctScore>=15){verdict='Avoid for Now'; verdictColor='#ef4444';verdictIcon='⚠️';action='AVOID';timeframe='Too many red flags - protect capital';}
    else                 {verdict='Do Not Buy';    verdictColor='#dc2626';verdictIcon='🚫';action='DO NOT BUY';timeframe='Multiple critical failures - stay away';}

    // STAGGERED BUYING PLAN
    let buyPlan=null;
    if(pctScore>=45&&px&&t.supports?.length){
      const s1=t.supports[0]?.price,s2=t.supports[1]?.price;
      buyPlan={
        tranche1:{pct:30,price:`${px?.toFixed(0)} (current)`,when:'First buy - current price if near support'},
        tranche2:{pct:30,price:s1?s1.toFixed(0):'5% below current',when:'On dip to support'},
        tranche3:{pct:40,price:s2?s2.toFixed(0):'10% below current',when:'Deeper correction - best value'},
        stopLoss:s2?(s2*0.95).toFixed(0):`${(px*0.88).toFixed(0)}`,
        target1:t.resistances?.[0]?.price?.toFixed(0)||'N/A',
        target2:t.resistances?.[1]?.price?.toFixed(0)||'N/A',
      };
    }

    // PLAIN ENGLISH ANALYSIS - all 23 points
    const analysis=[];

    // Trend
    if(t.above200===true) analysis.push({cat:'Trend',icon:'📈',signal:'positive',title:'Above 200-Day Moving Average',text:`The stock is trading at ${px?.toFixed(0)}, which is ABOVE its 200-day average of ${t.dma200?.toFixed(0)}. This is the most important long-term health signal. Being above the 200 DMA means the stock is in a long-term uptrend. Most big institutions like mutual funds won't even look at stocks below this level.`});
    else if(t.above200===false) analysis.push({cat:'Trend',icon:'📉',signal:'negative',title:'Below 200-Day Moving Average - Warning',text:`The stock is at ${px?.toFixed(0)}, BELOW its 200-day average of ${t.dma200?.toFixed(0)}. This is a major red flag. The long-term trend is down. Most professional investors avoid buying stocks in this condition. Wait for the price to recover above ${t.dma200?.toFixed(0)} before considering entry.`});
    if(t.dma200Trend) analysis.push({cat:'Trend',icon:t.dma200Trend==='rising'?'📈':'📉',signal:t.dma200Trend==='rising'?'positive':'negative',title:`200 DMA is ${t.dma200Trend==='rising'?'rising':'falling'}`,text:t.dma200Trend==='rising'?'The 200-day moving average itself is trending upward. This means the long-term trend is strengthening over time - a very bullish sign for patient investors.':'The 200-day average is trending downward. Even if price bounces, the underlying trend is still negative. This is not a good time for long-term buying.'});
    if(t.goldenCross===true) analysis.push({cat:'Trend',icon:'⭐',signal:'positive',title:'Golden Cross - Major Buy Signal',text:`The 50-day average (${t.dma50?.toFixed(0)}) has crossed ABOVE the 200-day average (${t.dma200?.toFixed(0)}). This is called a "Golden Cross" - one of the most reliable long-term buy signals in technical analysis. When this happens, major institutions often start accumulating. Historically, stocks in Golden Cross tend to outperform over the next 6-12 months.`});
    else if(t.goldenCross===false) analysis.push({cat:'Trend',icon:'💀',signal:'negative',title:'Death Cross - Major Warning',text:`The 50-day average (${t.dma50?.toFixed(0)}) is BELOW the 200-day average (${t.dma200?.toFixed(0)}). This is called a "Death Cross" - a confirmed long-term downtrend. This is NOT a time to buy. Wait for the Golden Cross to form before entering.`});

    // RSI
    if(t.rsi14!=null){
      if(t.rsi14<35) analysis.push({cat:'Momentum',icon:'🟢',signal:'positive',title:`RSI at ${t.rsi14?.toFixed(0)} - Oversold (Buy Zone)`,text:`RSI of ${t.rsi14?.toFixed(0)} means the stock has been beaten down too much. Like a rubber band stretched too far, it tends to snap back. This is historically one of the better times to buy - when fear is high and RSI is below 35. Not a guarantee, but the odds improve.`});
      else if(t.rsi14>70) analysis.push({cat:'Momentum',icon:'🔴',signal:'negative',title:`RSI at ${t.rsi14?.toFixed(0)} - Overbought (Avoid)`,text:`RSI of ${t.rsi14?.toFixed(0)} means the stock has run up too fast. Buying now means you're chasing. Wait for RSI to cool down below 60 before entering. Stocks with RSI above 70 often correct 10-20% before resuming.`});
      else analysis.push({cat:'Momentum',icon:'⚖️',signal:'neutral',title:`RSI at ${t.rsi14?.toFixed(0)} - Neutral Zone`,text:`RSI of ${t.rsi14?.toFixed(0)} is in the neutral zone (40-65). Momentum is balanced - not overbought or oversold. This is a healthy condition for a stock in an uptrend. Entry is reasonable if other signals are positive.`});
    }

    // Volume & Accumulation
    analysis.push({cat:'Volume',icon:t.accumDist==='Accumulation'?'🏦':'📤',signal:t.accumDist==='Accumulation'?'positive':'negative',title:`Volume Pattern: ${t.accumDist}`,text:t.accumDist==='Accumulation'?`More shares are being bought on up-days than sold on down-days. This is the classic sign of institutional accumulation - big money is quietly building positions. When smart money buys silently like this, retail investors often don't notice until the stock moves up sharply.`:`More shares are being sold on down-days than bought on up-days. This is distribution - someone big is offloading. When smart money is selling, retail investors are often buying. Be careful.`});

    // Overextension
    if(overExt) analysis.push({cat:'Valuation Risk',icon:'⚠️',signal:'negative',title:`Overextended - ${t.pctAbove200}% Above 200 DMA`,text:`The stock is ${t.pctAbove200}% above its 200-day average. When stocks run this far above their long-term average, they almost always pull back. Don't chase. Wait for a correction back toward the 200 DMA (${t.dma200?.toFixed(0)}) before buying. Patience is rewarded here.`});

    // Near support
    if(nearDma200) analysis.push({cat:'Entry Timing',icon:'🎯',signal:'positive',title:'Near 200 DMA - Institutional Buy Zone',text:`Price is very close to its 200-day moving average of ${t.dma200?.toFixed(0)}. This is where long-term investors and institutions typically step in to buy. Historically, stocks that bounce off the 200 DMA in an uptrend go on to make new highs. If other signals are positive, this is a strong buy area.`});
    else if(nearDma50) analysis.push({cat:'Entry Timing',icon:'🎯',signal:'positive',title:'Near 50 DMA - Continuation Buy Zone',text:`Price is near its 50-day average of ${t.dma50?.toFixed(0)}, which is a classic "dip buy" zone in an uptrend. Stocks in uptrends regularly dip to their 50 DMA and then resume higher.`});
    else if(nearSupport) analysis.push({cat:'Entry Timing',icon:'🎯',signal:'positive',title:`Near Key Support (${t.buyZoneLow}-${t.buyZoneHigh})`,text:`Price is near a strong historical support zone. This is where buyers have repeatedly stepped in over months/years. The more times a support level holds, the stronger it becomes.`});

    // Fundamentals
    if(f){
      if(f.roe>=15) analysis.push({cat:'Quality',icon:'💰',signal:'positive',title:`ROE ${f.roe}% - ${f.roePeer}`,text:`Return on Equity of ${f.roe}% means for every ₹100 of your money in the company, it generates ₹${f.roe} of profit. Above 15% is the threshold for a quality business. Compare: Infosys has ~30%, HDFC Bank ~16%. This shows management can put capital to work efficiently.`});
      else analysis.push({cat:'Quality',icon:'⚠️',signal:'negative',title:`ROE ${f.roe}% - ${f.roePeer}`,text:`ROE of ${f.roe}% is below the 15% threshold. The company isn't generating strong returns on shareholder capital. Look for improvement trend before investing.`});

      if(f.de<=0.7) analysis.push({cat:'Balance Sheet',icon:'💪',signal:'positive',title:`Low Debt (D/E: ${f.de}x) - ${f.dePeer}`,text:`Debt-to-equity of ${f.de}x is excellent. A company with low debt can survive recessions, doesn't need to keep paying interest, and can invest in growth opportunities. During market downturns, low-debt companies suffer much less than highly leveraged ones.`});
      else if(f.de>2) analysis.push({cat:'Balance Sheet',icon:'🚨',signal:'negative',title:`High Debt (D/E: ${f.de}x) - Risky`,text:`Debt-to-equity of ${f.de}x is dangerous. When interest rates rise or business slows, high-debt companies can spiral quickly. This is a serious risk factor, especially in uncertain times.`});

      if(f.epsGr!=null&&f.epsGr<400){
        if(f.epsGr>=15) analysis.push({cat:'Growth',icon:'🚀',signal:'positive',title:`EPS Growing ${f.epsGr}% - ${f.growthPeer}`,text:`Earnings per share growing at ${f.epsGr}% is strong. A stock price ultimately follows earnings over time. If a company compounds earnings at ${f.epsGr}% annually, the stock will likely follow. This is the engine of long-term wealth creation.`});
        else if(f.epsGr<0) analysis.push({cat:'Growth',icon:'📉',signal:'negative',title:`EPS Declining ${f.epsGr}% - Red Flag`,text:`Earnings are shrinking. Stock prices eventually follow earnings. If the company keeps earning less, the stock price will likely fall over time. This needs to reverse before long-term investing makes sense.`});
      }

      if(f.pe<25) analysis.push({cat:'Valuation',icon:'🏷️',signal:'positive',title:`P/E ${f.pe}x - ${f.pePeer}`,text:`You're paying ₹${f.pe} for every ₹1 of annual earnings. At this P/E, the stock isn't expensive. ${f.peg!=null?`PEG ratio of ${f.peg} (P/E divided by growth) - ${f.peg<1?'below 1.0 suggests undervalued relative to growth':'above 1.0 - fair to slightly expensive for growth rate'}.`:''}`});
      else if(f.pe>40) analysis.push({cat:'Valuation',icon:'💸',signal:'negative',title:`P/E ${f.pe}x - ${f.pePeer}`,text:`You're paying ₹${f.pe} for every ₹1 of earnings. This is expensive. High P/E stocks can fall sharply on any earnings disappointment. Make sure the growth rate justifies this premium.`});
    }

    // Ichimoku
    if(t.ichimoku?.tenkan){
      const ich=t.ichimoku;
      analysis.push({cat:'Advanced',icon:ich.bullish?'☁️':'⛈️',signal:ich.bullish?'positive':'negative',title:ich.bullish?'Ichimoku: Fully Bullish':'Ichimoku: Bearish Cloud',text:ich.bullish?`Price is above the Ichimoku Cloud (${ich.senkouA?.toFixed(0)}-${ich.senkouB?.toFixed(0)}) and the fast signal (Tenkan ${ich.tenkan?.toFixed(0)}) is above the slow signal (Kijun ${ich.kijun?.toFixed(0)}). Japanese institutions use this as a complete bullish confirmation.`:`Price is ${ich.aboveCloud?'above':'inside or below'} the Ichimoku cloud. The signals are mixed or bearish. Japanese traders treat being below the cloud as a full sell signal.`});
    }

    // Candlestick patterns
    if(t.patterns?.length){
      t.patterns.forEach(p=>analysis.push({cat:'Pattern',icon:p.signal==='bullish'?'🕯️':'🕯️',signal:p.signal,title:`Candlestick: ${p.name}`,text:p.desc}));
    }

    // Sentiment
    if(news.length>0) analysis.push({cat:'News',icon:sentScore>0?'📰':'📰',signal:sentScore>0?'positive':sentScore<0?'negative':'neutral',title:`News Sentiment: ${sentScore>0?'Positive':'Negative'} (${bull}B/${bear}Be)`,text:sentScore>20?`News flow is positive - ${bull} bullish vs ${bear} bearish articles recently. Positive analyst coverage and news usually precedes institutional buying.`:`News flow is mixed/negative - ${bear} bearish articles recently. Monitor for any fundamental changes before investing.`});

    // Risk:Reward
    if(t.riskReward) analysis.push({cat:'Risk',icon:t.riskReward>=2?'✅':'⚠️',signal:t.riskReward>=2?'positive':'neutral',title:`Risk:Reward = ${t.riskReward}x`,text:t.riskReward>=2?`For every ₹1 you risk, you stand to gain ₹${t.riskReward}. Entry around ${px?.toFixed(0)}, stop loss at ${t.supports?.[0]?.price?.toFixed(0)||'support'}, target at ${t.resistances?.[0]?.price?.toFixed(0)||'resistance'}. A ratio above 2x is the minimum institutional traders require.`:`Risk:Reward of ${t.riskReward}x is below the preferred 2x minimum. The potential gain doesn't adequately compensate for the risk.`});

    // Buy targets
    const targets=[];
    (t.resistances||[]).slice(0,5).forEach((r,i)=>targets.push({label:`T${i+1}`,price:r.price,upside:px?+((r.price-px)/px*100).toFixed(1):null,strength:r.strength}));
    if(t.wk52Hi) targets.push({label:'52W High',price:t.wk52Hi,upside:px?+((t.wk52Hi-px)/px*100).toFixed(1):null,strength:0});

    const whenToBuy=[];
    if(t.buyZoneLow&&t.buyZoneHigh) whenToBuy.push({type:'Support Zone',priority:'HIGH',price:`${t.buyZoneLow}-${t.buyZoneHigh}`,why:'Strongest historical support'});
    if(t.dma50BuyZone) whenToBuy.push({type:'50-DMA Zone',priority:'HIGH',price:`${t.dma50BuyZone.low}-${t.dma50BuyZone.high}`,why:'Institutional momentum buy zone'});
    if(t.dma200BuyZone) whenToBuy.push({type:'200-DMA Zone',priority:'MEDIUM',price:`${t.dma200BuyZone.low}-${t.dma200BuyZone.high}`,why:'Long-term value buy zone'});
    if(t.fibs) whenToBuy.push({type:'Fibonacci 61.8%',priority:'MEDIUM',price:`${t.fibs.r618}`,why:'Golden ratio support'});
    if(t.rsi14<35) whenToBuy.push({type:'NOW - RSI Oversold',priority:'HIGH',price:`${px?.toFixed(0)} (current)`,why:`RSI ${t.rsi14} in oversold territory`});

    res.json({
      sym,name:meta.n,grp:meta.grp,sector,price:px,
      tech:t,techWeek:tw,techMax:tm,
      charts,fund:f,
      news,sentiment:{bull,bear,neutral:neut,score:sentScore},
      supports:t.supports||[],resistances:t.resistances||[],
      whenToBuy,targets,
      buyZone:{low:t.buyZoneLow,high:t.buyZoneHigh},
      idealBuy:t.supports?.[0]?.price||null,
      upsidePct:t.upsidePct,riskReward:t.riskReward,
      fibs:t.fibs,ichimoku:t.ichimoku,patterns:t.patterns||[],
      checklist,totalPts,maxPts,pctScore,passCount,totalChecks,
      verdict,verdictColor,verdictIcon,action,verdictTimeframe:timeframe,
      analysis,buyPlan,
      dataAvailable:{
        kite1y:c1y.length>0,kite3y:c3y.length>0,kite10w:c10w.length>0,
        kiteMax:cMax.length>0,maxCandles:cMax.length,
        kite1h:c1h.length>0,news:news.length>0,fundamentals:!!fund,
        candlesUsed:techCandles.length,
      },
    });
  } catch(e){
    console.error(`Analyze error ${sym}:`,e.message);
    res.status(500).json({error:e.message});
  }
});





// Aggregates paper trade signals + live prices into a ranked recommendation list
app.get("/api/stocks/recommendations", async(req,res)=>{
  try {
    // Get recent signals - last 7 days of BUY signals with score >= 3
    const {rows: signals} = await pool.query(`
      SELECT DISTINCT ON (symbol)
        symbol, name, type, price as entry_price, signal_score, strategy, regime,
        indicators, entry_time, stop_loss, target, status, pnl, pnl_pct, exit_reason
      FROM paper_trades
      WHERE type = 'BUY'
        AND entry_time >= NOW() - INTERVAL '7 days'
        AND signal_score >= 3
      ORDER BY symbol, entry_time DESC
    `);

    // Get all open positions
    const {rows: open} = await pool.query(
      "SELECT symbol, price as entry_price, stop_loss, target, signal_score, strategy, pnl, pnl_pct, entry_time FROM paper_trades WHERE status='OPEN'"
    );

    // Get scan log for last regime
    const {rows: scanLog} = await pool.query(
      "SELECT * FROM scan_log ORDER BY scanned_at DESC LIMIT 5"
    );

    // Get last scan stats
    const lastScan = scanLog[0] || null;

    // Build stock universe metadata
    const universe = {};
    UNIVERSE.forEach(s => { universe[s.sym] = { name: s.n, grp: s.grp }; });

    // Enrich signals with live prices
    const enriched = signals.map(s => {
      const live = livePrices[s.symbol] || {};
      const meta = universe[s.symbol] || { name: s.name, grp: 'NSE' };
      const livePrice = live.price || null;
      const change = live.change || null;
      const changePct = livePrice && s.entry_price
        ? ((livePrice - s.entry_price) / s.entry_price * 100).toFixed(2)
        : null;
      const isOpen = open.find(o => o.symbol === s.symbol);
      return {
        symbol:       s.symbol,
        name:         meta.name || s.name,
        group:        meta.grp,
        entry_price:  parseFloat(s.entry_price),
        live_price:   livePrice,
        change:       change,
        change_pct:   changePct ? parseFloat(changePct) : null,
        signal_score: s.signal_score,
        strategy:     s.strategy,
        regime:       s.regime,
        indicators:   s.indicators,
        stop_loss:    parseFloat(s.stop_loss),
        target:       parseFloat(s.target),
        status:       isOpen ? 'OPEN' : s.status,
        pnl:          isOpen ? parseFloat(isOpen.pnl || 0) : parseFloat(s.pnl || 0),
        pnl_pct:      isOpen ? parseFloat(isOpen.pnl_pct || 0) : parseFloat(s.pnl_pct || 0),
        signal_time:  s.entry_time,
        risk_reward:  s.stop_loss && s.target && s.entry_price
          ? ((s.target - s.entry_price) / (s.entry_price - s.stop_loss)).toFixed(1)
          : null,
      };
    });

    // Sort: open first, then by signal_score desc
    enriched.sort((a,b) => {
      if(a.status==='OPEN' && b.status!=='OPEN') return -1;
      if(a.status!=='OPEN' && b.status==='OPEN') return 1;
      return b.signal_score - a.signal_score;
    });

    res.json({
      recommendations: enriched,
      open_count:      open.length,
      signal_count:    enriched.length,
      live_prices:     Object.keys(livePrices).length,
      market_open:     isMarketOpen(),
      last_scan:       lastScan,
      universe_size:   UNIVERSE.length,
    });
  } catch(e) {
    res.status(500).json({ error: e.message, recommendations: [] });
  }
});

// -- Reset all paper trades (clean slate) --------------------------------------
app.post("/reset-trades", async(req,res)=>{
  try {
    await pool.query("DELETE FROM paper_trades");
    await pool.query("DELETE FROM scan_log");
    res.json({message:"All paper trades and scan log cleared. Fresh start!"});
    console.log("🗑️  Paper trades reset by user");
  } catch(e){ res.status(500).json({error:e.message}); }
});

// -- Remove suspicious trades (P&L > 100% return = likely bad token) ----------
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
    if(!token)return res.status(404).json({error:"Symbol not found - token not loaded yet"});
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
    tokenValid = true;
    await dbSet('kite_access_token', token); // persist across restarts
    startTicker(token);
    res.send(`<!DOCTYPE html><html><body style="background:#060b14;color:#e2e8f0;font-family:monospace;padding:40px;text-align:center">
      <h2 style="color:#22c55e">✅ Connected! Token saved to DB - survives restarts.</h2>
      <p>Token: <code style="background:#1e293b;padding:8px 16px;border-radius:6px;display:block;margin:12px auto;max-width:600px;word-break:break-all;color:#38bdf8">${token}</code></p>
      <p style="color:#22c55e">✅ Auto-saved to database - no need to set Railway env variable manually</p>
      <p style="color:#64748b">7 strategies · auto regime detection · scans every 5 min · 9:15-15:30 IST</p>
      <br/><a href="/" style="color:#0ea5e9">Back to Dashboard -></a>
    </body></html>`);
  } catch(e){
    res.status(500).send(`<html><body style="background:#060b14;color:#fca5a5;font-family:monospace;padding:40px">
      <h2>❌ Auth failed</h2><pre>${e.message}</pre><a href="/auth/login" style="color:#0ea5e9">Try again</a>
    </body></html>`);
  }
});

// ===============================================================================
// -- Timeout-safe fetch (compatible with Node 18) -----------------------------
const cryptoPrices  = {};
const cryptoCandles = {};
let   cryptoWSActive = false;

function fetchT(url, opts={}, ms=8000) {
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), ms);
  return fetch(url, {...opts, signal:ctrl.signal}).finally(()=>clearTimeout(t));
}

// -- CRYPTO ENGINE - Binance Public API (no account needed) --------------------
// ===============================================================================

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

// Fetch candles - try multiple endpoints
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

// Fetch live prices - try multiple Binance endpoints
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
      console.log(`₿ Prices updated - ${data.length} pairs`);
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

// Crypto strategy - same logic but wider thresholds (crypto is volatile)
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

  // EMA - wider for crypto
  let emaS = le9>le21?2:le9<le21?-2:0;
  if(pe9<=pe21&&le9>le21) emaS=3;
  if(pe9>=pe21&&le9<le21) emaS=-3;
  bd.ema=emaS; total+=emaS;

  // RSI - wider thresholds for crypto
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
  BUY_SCORE:        3,      // lowered from 4 - easier to trigger
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
           VALUES ($1,$2,'BUY',$3,$4,$5,NOW(),$6,$7,$8,'CRYPTO_MULTI','CRYPTO',$9,$10)`,
          [coin.sym,coin.name,price,qty,CRYPTO_CONFIG.CAPITAL_PER_TRADE,sl,target,total,indStr,'OPEN']
        );
        openTrades.push({symbol:coin.sym,status:"OPEN"});
        console.log(`  ₿ BUY  ${coin.sym} @ $${price} | Score:${total} | SL:$${sl} | TGT:$${target}`);
        signals++;
      }
    } catch(e) { console.error(`  ₿ ${coin.sym}: ${e.message}`); skipped++; }
  }
  console.log(`₿ Done - scanned:${scanned} skipped:${skipped} signals:${signals}\n`);
}

// -- Crypto API endpoints -------------------------------------------------------
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

// -- Start ---------------------------------------------------------------------
async function start() {
  await initDB();

  // Load token: env var takes priority, then DB (persisted from last session)
  let token = process.env.KITE_ACCESS_TOKEN || await dbGet('kite_access_token');
  if (token) process.env.KITE_ACCESS_TOKEN = token;

  initKite(token||null);
  if (token) {
    tokenValid = true; // assume valid - will be set false if Kite rejects it
    console.log("✅ Token loaded (from "+(process.env.KITE_ACCESS_TOKEN===token&&!await dbGet('kite_access_token')?'env':'DB')+") - starting smart engine...");
    startTicker(token);
    await refreshInstruments();  // fetch real tokens from Kite
    setTimeout(scanAndTrade, 5000);
  } else {
    console.log("⚠️  No token - visit /auth/login or paste token in dashboard");
  }
  // NSE: every 3 min during market hours Mon-Fri
  cron.schedule("*/3 9-15 * * 1-5", ()=>scanAndTrade(), {timezone:"Asia/Kolkata"});
  cron.schedule("15 9 * * 1-5",     ()=>scanAndTrade(), {timezone:"Asia/Kolkata"});
  // Refresh instrument tokens daily at 9:00 AM
  cron.schedule("0 9 * * 1-5", ()=>refreshInstruments(), {timezone:"Asia/Kolkata"});

  // Crypto: start immediately, run 24/7 every 15 minutes
  console.log("₿ Starting crypto engine - 24/7...");
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
