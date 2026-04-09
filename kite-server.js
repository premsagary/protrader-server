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

// ── In-memory log buffer (last 500 lines, visible in Admin panel) ─────────────
const LOG_BUFFER = [];
const _origLog = console.log.bind(console);
const _origErr = console.error.bind(console);
function _capture(level, args) {
  const line = { t: Date.now(), level, msg: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') };
  LOG_BUFFER.push(line);
  if (LOG_BUFFER.length > 500) LOG_BUFFER.shift();
}
console.log   = (...a) => { _origLog(...a);   _capture('info',  a); };
console.error = (...a) => { _origErr(...a);   _capture('error', a); };
// ─────────────────────────────────────────────────────────────────────────────
const cors      = require("cors");
const http      = require("http");
const WebSocket = require("ws");
const cron      = require("node-cron");
const { Pool, types: pgTypes }  = require("pg");

// PostgreSQL 'numeric' type (OID 1700) is returned as strings by default.
// Convert to JS floats so .toFixed() and arithmetic work everywhere.
pgTypes.setTypeParser(1700, val => parseFloat(val));

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });
app.use(cors());
app.use(express.json());

// -- DB ------------------------------------------------------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway") ? { rejectUnauthorized: false } : false,
  max: 5,                        // Railway free tier allows ~5 concurrent connections
  idleTimeoutMillis: 30000,      // close idle connections after 30s
  connectionTimeoutMillis: 5000, // fail fast if DB unreachable
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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_universe (
        sym          VARCHAR(20) PRIMARY KEY,
        name         VARCHAR(200) NOT NULL,
        grp          VARCHAR(20) NOT NULL,
        industry     VARCHAR(100),
        isin         VARCHAR(20),
        series       VARCHAR(5),
        updated_at   TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_instruments (
        sym          VARCHAR(20) PRIMARY KEY,
        kite_token   BIGINT,
        exchange     VARCHAR(10) DEFAULT 'NSE',
        updated_at   TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_scores (
        sym          VARCHAR(20) PRIMARY KEY,
        score        DECIMAL(6,2),
        score_hits   TEXT,
        fa_score     DECIMAL(6,2),
        fa_verdict   VARCHAR(50),
        fa_color     VARCHAR(20),
        fa_icon      VARCHAR(10),
        is_fallen    BOOLEAN DEFAULT FALSE,
        technicals   TEXT,
        updated_at   TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS screener_fundamentals (
        sym                   VARCHAR(20) PRIMARY KEY,
        name                  VARCHAR(150),
        nse_code              VARCHAR(20),
        bse_code              VARCHAR(20),
        industry              VARCHAR(100),
        industry_group        VARCHAR(100),
        roe                   DECIMAL(10,2),
        de                    DECIMAL(10,2),
        pe                    DECIMAL(10,2),
        rev_gr_3y             DECIMAL(10,2),
        eps_gr_3y             DECIMAL(10,2),
        opm                   DECIMAL(10,2),
        roa                   DECIMAL(10,2),
        pb                    DECIMAL(10,2),
        peg                   DECIMAL(10,2),
        int_cov               DECIMAL(10,2),
        promoter_holding      DECIMAL(10,2),
        pledged_pct           DECIMAL(10,2),
        promoter_chg          DECIMAL(10,2),
        mkt_cap               DECIMAL(18,2),
        current_price         DECIMAL(18,2),
        eps                   DECIMAL(10,2),
        debt                  DECIMAL(18,2),
        current_ratio         DECIMAL(10,2),
        div_yield             DECIMAL(10,2),
        sales_gr_1y           DECIMAL(10,2),
        sales_gr_5y           DECIMAL(10,2),
        eps_gr_1y             DECIMAL(10,2),
        eps_gr_5y             DECIMAL(10,2),
        roe_3y_avg            DECIMAL(10,2),
        roe_5y_avg            DECIMAL(10,2),
        ret_1y                DECIMAL(10,2),
        ret_3y                DECIMAL(10,2),
        ret_5y                DECIMAL(10,2),
        ret_6m                DECIMAL(10,2),
        ret_3m                DECIMAL(10,2),
        ev_ebitda             DECIMAL(10,2),
        industry_pe           DECIMAL(10,2),
        pat_qtr               DECIMAL(18,2),
        sales_qtr             DECIMAL(18,2),
        pat_annual            DECIMAL(18,2),
        sales_annual          DECIMAL(18,2),
        pat_qtr_yoy           DECIMAL(10,2),
        sales_qtr_yoy         DECIMAL(10,2),
        imported_at           TIMESTAMP DEFAULT NOW()
      )
    `);
    // Add new columns for Apify bonus fields (safe — IF NOT EXISTS)
    await pool.query(`ALTER TABLE screener_fundamentals ADD COLUMN IF NOT EXISTS roce DECIMAL(10,2)`).catch(()=>{});
    await pool.query(`ALTER TABLE screener_fundamentals ADD COLUMN IF NOT EXISTS earnings_yield DECIMAL(10,2)`).catch(()=>{});
    await pool.query(`ALTER TABLE screener_fundamentals ADD COLUMN IF NOT EXISTS price_to_fcf DECIMAL(10,2)`).catch(()=>{});
    await pool.query(`ALTER TABLE screener_fundamentals ADD COLUMN IF NOT EXISTS price_to_sales DECIMAL(10,2)`).catch(()=>{});
    // Shareholding columns (from getstockdetails mode)
    await pool.query(`ALTER TABLE screener_fundamentals ADD COLUMN IF NOT EXISTS fii_holding DECIMAL(10,2)`).catch(()=>{});
    await pool.query(`ALTER TABLE screener_fundamentals ADD COLUMN IF NOT EXISTS dii_holding DECIMAL(10,2)`).catch(()=>{});
    await pool.query(`ALTER TABLE screener_fundamentals ADD COLUMN IF NOT EXISTS num_shareholders DECIMAL(18,0)`).catch(()=>{});

    // ── Portfolio Manager tables ──────────────────────────────────────────────
    // Tracks user's actual held positions (what they bought from suggestions)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS portfolio_positions (
        id             SERIAL PRIMARY KEY,
        sym            VARCHAR(20) NOT NULL,
        name           VARCHAR(150),
        sector         VARCHAR(100),
        grp            VARCHAR(20),
        qty            INTEGER NOT NULL DEFAULT 0,
        avg_price      DECIMAL(18,2) NOT NULL,
        invested_amt   DECIMAL(18,2) NOT NULL,
        buy_date       TIMESTAMP DEFAULT NOW(),
        status         VARCHAR(10) DEFAULT 'ACTIVE',
        stop_loss      DECIMAL(18,2),
        trailing_stop  DECIMAL(18,2),
        target         DECIMAL(18,2),
        conviction     VARCHAR(20),
        quality_score  DECIMAL(6,2),
        buy_reason     TEXT,
        sell_date      TIMESTAMP,
        sell_price     DECIMAL(18,2),
        sell_reason    TEXT,
        realised_pnl   DECIMAL(18,2),
        realised_pct   DECIMAL(8,2)
      )
    `);

    // Signal history — every signal the system generates
    await pool.query(`
      CREATE TABLE IF NOT EXISTS portfolio_signals (
        id             SERIAL PRIMARY KEY,
        sym            VARCHAR(20) NOT NULL,
        signal_type    VARCHAR(20) NOT NULL,
        urgency        VARCHAR(10) DEFAULT 'NORMAL',
        reason         TEXT,
        price_at       DECIMAL(18,2),
        stop_at        DECIMAL(18,2),
        target_at      DECIMAL(18,2),
        created_at     TIMESTAMP DEFAULT NOW(),
        acted          BOOLEAN DEFAULT FALSE,
        acted_at       TIMESTAMP
      )
    `);

    // Daily snapshots for equity curve + performance tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS portfolio_snapshots (
        id              SERIAL PRIMARY KEY,
        snap_date       DATE NOT NULL DEFAULT CURRENT_DATE,
        total_invested  DECIMAL(18,2),
        current_value   DECIMAL(18,2),
        cash_balance    DECIMAL(18,2),
        total_pnl       DECIMAL(18,2),
        total_pnl_pct   DECIMAL(8,2),
        num_positions   INTEGER,
        portfolio_beta  DECIMAL(6,2),
        nifty_value     DECIMAL(18,2),
        max_drawdown    DECIMAL(8,2),
        UNIQUE(snap_date)
      )
    `);

    console.log("✅ DB ready (screener_fundamentals + portfolio tables included)");
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

// -- Auto-update UNIVERSE from NSE official CSVs --------------------------------
// NSE publishes index constituents daily. We fetch and update UNIVERSE in memory.
// Falls back to hardcoded list if NSE unreachable.
let universeLastUpdate = null;
let universeUpdateStatus = 'never';

async function refreshUniverseFromNSE() {
  const urls = {
    NIFTY50:  'https://nsearchives.nseindia.com/content/indices/ind_nifty50list.csv',
    NEXT50:   'https://nsearchives.nseindia.com/content/indices/ind_niftynext50list.csv',
    MIDCAP:   'https://nsearchives.nseindia.com/content/indices/ind_niftymidcap150list.csv',
    SMALLCAP: 'https://nsearchives.nseindia.com/content/indices/ind_niftysmallcap250list.csv',
  };

  const headers = {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer':         'https://www.nseindia.com/',
    'Connection':      'keep-alive',
  };

  const newStocks = [];
  let successCount = 0;

  for (const [grp, url] of Object.entries(urls)) {
    try {
      const resp = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
      if (!resp.ok) { console.log(`NSE ${grp}: HTTP ${resp.status}`); continue; }
      const text = await resp.text();
      const lines = text.trim().split('\n');
      // NSE CSV: Company Name, Industry, Symbol, Series, ISIN
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g,''));
        if (cols.length < 3) continue;
        const name = cols[0], industry = cols[1]||'', sym = cols[2], series = cols[3]||'EQ', isin = cols[4]||'';
        if (!sym || sym.length < 2) continue;
        newStocks.push({ sym, n: name, grp, industry, isin, series });
      }
      successCount++;
      console.log(`NSE ${grp}: ${lines.length - 1} stocks loaded`);
    } catch(e) {
      trackError("nse_universe", e); console.log(`NSE ${grp} fetch failed: ${e.message}`);
    }
  }

  if (successCount === 0) {
    console.log('NSE update: all fetches failed - keeping existing UNIVERSE');
    universeUpdateStatus = `failed at ${new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}`;
    return false;
  }
  if (newStocks.length < 100) {
    console.log(`NSE update: only ${newStocks.length} stocks - too few, keeping existing`);
    return false;
  }

  // Deduplicate (MIDCAP occasionally overlaps with NEXT50)
  const seen = new Set();
  const deduped = newStocks.filter(s => {
    if (seen.has(s.sym)) return false;
    seen.add(s.sym); return true;
  });

  // Persist to stock_universe DB table — authoritative source of truth
  let dbSaved = 0, dbErrors = 0;
  for (const s of deduped) {
    try {
      await pool.query(
        `INSERT INTO stock_universe (sym,name,grp,industry,isin,series,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW())
         ON CONFLICT (sym) DO UPDATE SET
           name=EXCLUDED.name, grp=EXCLUDED.grp, industry=EXCLUDED.industry,
           isin=EXCLUDED.isin, series=EXCLUDED.series, updated_at=NOW()`,
        [s.sym, s.n, s.grp, s.industry||'', s.isin||'', s.series||'EQ']
      );
      dbSaved++;
    } catch(e) {
      dbErrors++;
      if (dbErrors <= 2) console.log(`Universe DB save error ${s.sym}:`, e.message);
    }
  }
  console.log(`NSE universe: ${dbSaved} saved, ${dbErrors} errors to stock_universe table`);

  // Update in-memory UNIVERSE
  const nseSyms = new Set(deduped.map(s => s.sym));
  const preserved = UNIVERSE.filter(s => !nseSyms.has(s.sym));
  UNIVERSE = [...deduped, ...preserved];

  universeLastUpdate = Date.now();
  universeUpdateStatus = `updated ${new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} - ${deduped.length} stocks`;
  await dbSet('universe_cache', JSON.stringify(deduped));
  await dbSet('universe_updated_at', Date.now().toString());
  await dbSet('universe_missing_fund', JSON.stringify(deduped.filter(s=>!FUND[s.sym]&&s.sym!=='M&M').map(s=>s.sym)));

  console.log(`NSE universe updated: ${UNIVERSE.length} total (${deduped.length} from NSE + ${preserved.length} custom)`);
  return true;
}

async function loadUniverseFromDB() {
  // Try stock_universe table first (most reliable), then kv cache fallback
  try {
    const { rows } = await pool.query('SELECT sym, name, grp, industry, isin FROM stock_universe ORDER BY grp, sym');
    if (rows.length > 100) {
      const nseSyms = new Set(rows.map(r => r.sym));
      const extras  = UNIVERSE.filter(s => !nseSyms.has(s.sym));
      UNIVERSE = [...rows.map(r => ({ sym: r.sym, n: r.name, grp: r.grp, industry: r.industry })), ...extras];
      universeUpdateStatus = `from DB table (${rows.length} stocks)`;
      console.log(`NSE universe loaded from stock_universe table: ${rows.length} stocks`);
      return true;
    }
  } catch(e) {
    // Table may not exist yet on first boot — fall through to kv cache
    if (!e.message.includes('does not exist')) console.log('Universe table load failed:', e.message);
  }

  // Fallback: kv cache
  try {
    const cached    = await dbGet('universe_cache');
    const updatedAt = await dbGet('universe_updated_at');
    if (!cached) return false;
    const parsed = JSON.parse(cached);
    if (parsed.length < 100) return false;
    const ageHours = (Date.now() - parseInt(updatedAt||'0')) / 3600000;
    const nseSyms = new Set(parsed.map(s => s.sym));
    const extras  = UNIVERSE.filter(s => !nseSyms.has(s.sym));
    UNIVERSE = [...parsed, ...extras];
    universeLastUpdate = parseInt(updatedAt||'0');
    universeUpdateStatus = `from kv cache (${ageHours.toFixed(0)}h ago)`;
    console.log(`NSE universe loaded from kv cache: ${parsed.length} stocks (${ageHours.toFixed(0)}h ago)`);
    return true;
  } catch(e) {
    console.log('Universe cache load failed:', e.message);
    return false;
  }
}

// -- WebSocket -----------------------------------------------------------------
const livePrices  = {};
const subscribers = new Set();
let   tickerOn      = false;
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
let UNIVERSE = [
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
  {sym:"INDIGO",     n:"InterGlobe Aviation",        grp:"NIFTY50"},
  {sym:"EICHERMOT",  n:"Eicher Motors",             grp:"NIFTY50"},
  {sym:"TATACONSUM", n:"Tata Consumer Products",    grp:"NIFTY50"},
  {sym:"SHRIRAMFIN", n:"Shriram Finance",           grp:"NIFTY50"},
  {sym:"ETERNAL",    n:"Eternal Ltd (Zomato)",       grp:"NIFTY50"},
  // -- NIFTY NEXT 50 --
  {sym:"DMART",       n:"Avenue Supermarts",        grp:"NEXT50"},
  {sym:"PIDILITIND",  n:"Pidilite Industries",      grp:"NEXT50"},
  {sym:"SIEMENS",     n:"Siemens Ltd",              grp:"NEXT50"},
  {sym:"ABB",         n:"ABB India",                grp:"NEXT50"},
  {sym:"BAJAJAUTO",  n:"Bajaj Auto",               grp:"NEXT50"},
  {sym:"TVSMOTOR",   n:"TVS Motor Company",        grp:"NEXT50"},
  {sym:"VARUNBEV",   n:"Varun Beverages",          grp:"NEXT50"},
  {sym:"HAVELLS",     n:"Havells India",            grp:"NEXT50"},
  {sym:"DABUR",       n:"Dabur India",              grp:"NEXT50"},
  {sym:"MARICO",      n:"Marico Ltd",               grp:"NEXT50"},
  {sym:"GODREJCP",    n:"Godrej Consumer Products", grp:"NEXT50"},
  {sym:"AMBUJACEM",   n:"Ambuja Cements",           grp:"NEXT50"},
  {sym:"ACC",         n:"ACC Ltd",                  grp:"MIDCAP"},
  {sym:"BIOCON",      n:"Biocon Ltd",               grp:"MIDCAP"},
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
  {sym:"COFORGE",     n:"Coforge Ltd",              grp:"MIDCAP"},
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
  {sym:"BALKRISIND",  n:"Balkrishna Industries",    grp:"MIDCAP"},
  {sym:"MFSL",        n:"Max Financial Services",   grp:"NEXT50"},
  {sym:"INDHOTEL",    n:"Indian Hotels Co",         grp:"NEXT50"},
  {sym:"VOLTAS",      n:"Voltas Ltd",               grp:"NEXT50"},
  {sym:"WHIRLPOOL",   n:"Whirlpool of India",       grp:"MIDCAP"},
  {sym:"PAGEIND",     n:"Page Industries",          grp:"NEXT50"},
  {sym:"TRENT",       n:"Trent Ltd",                grp:"NEXT50"},
  {sym:"UNITDSPR",    n:"United Spirits",           grp:"MIDCAP"},
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
  {sym:"JIOFIN",     n:"Jio Financial Services",    grp:"NIFTY50"},
  {sym:"BEL",         n:"Bharat Electronics Ltd",   grp:"NIFTY50"},
  {sym:"HAL",         n:"Hindustan Aeronautics Ltd",grp:"NEXT50"},
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
  {sym:"LICI",        n:"LIC of India",             grp:"NEXT50"},
  {sym:"ANGELONE",    n:"Angel One Ltd",            grp:"MIDCAP"},
  {sym:"5PAISA",      n:"5paisa Capital",           grp:"MIDCAP"},
  {sym:"CDSL",        n:"CDSL Ltd",                 grp:"MIDCAP"},
  {sym:"BSE",         n:"BSE Ltd",                  grp:"MIDCAP"},
  {sym:"MCX",         n:"MCX India",                grp:"MIDCAP"}
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
// PHASE 1: ENHANCED TECHNICAL INDICATORS (Varsity Module 2)
// ===============================================================================

// Fibonacci retracement levels — Varsity M2 Ch 16
function fibonacci(high, low) {
  const range = high - low;
  return {
    r0:    high,
    r236:  +(high - range * 0.236).toFixed(2),
    r382:  +(high - range * 0.382).toFixed(2),
    r500:  +(high - range * 0.500).toFixed(2),
    r618:  +(high - range * 0.618).toFixed(2),
    r786:  +(high - range * 0.786).toFixed(2),
    r1:    low,
    // Extension levels
    e1272: +(low  - range * 0.272).toFixed(2),
    e1618: +(low  - range * 0.618).toFixed(2),
  };
}

// ADX with +DI and -DI lines — Varsity M2 Ch 21
function adxFull(candles, n=14) {
  if (candles.length < n+2) return { adx:20, pdi:15, ndi:15, trending:false };
  const dms = candles.slice(1).map((c,i) => {
    const prev = candles[i];
    const um = c.high - prev.high, dm = prev.low - c.low;
    return {
      pdm: um>dm&&um>0?um:0,
      ndm: dm>um&&dm>0?dm:0,
      tr:  Math.max(c.high-c.low,Math.abs(c.high-prev.close),Math.abs(c.low-prev.close)),
    };
  });
  const last = dms.slice(-n);
  const atrSum = last.reduce((s,d)=>s+d.tr,0);
  const pdi = atrSum>0 ? last.reduce((s,d)=>s+d.pdm,0)/atrSum*100 : 0;
  const ndi = atrSum>0 ? last.reduce((s,d)=>s+d.ndm,0)/atrSum*100 : 0;
  const adxVal = pdi+ndi>0 ? Math.abs(pdi-ndi)/(pdi+ndi)*100 : 0;
  return {
    adx:     +adxVal.toFixed(1),
    pdi:     +pdi.toFixed(1),
    ndi:     +ndi.toFixed(1),
    trending: adxVal > 25,
    bullTrend: pdi > ndi && adxVal > 20,  // +DI > -DI = bullish trend
    bearTrend: ndi > pdi && adxVal > 20,
    diCross:   Math.abs(pdi - ndi) < 3,   // crossover zone
  };
}

// Ichimoku Cloud — Varsity M2 Ch 21
function ichimoku(candles) {
  if (candles.length < 52) return null;
  const n = candles.length;
  const midpoint = (period) => {
    const sl = candles.slice(n-period);
    return (Math.max(...sl.map(c=>c.high)) + Math.min(...sl.map(c=>c.low))) / 2;
  };
  const tenkan  = midpoint(9);   // Conversion line
  const kijun   = midpoint(26);  // Base line
  const senkouA = (tenkan + kijun) / 2;
  const senkouB = midpoint(52);
  const chikou  = candles[n-1].close;
  const price   = candles[n-1].close;
  const aboveCloud = price > Math.max(senkouA, senkouB);
  const belowCloud = price < Math.min(senkouA, senkouB);
  const tkCross  = tenkan > kijun;  // TK cross bullish
  return {
    tenkan: +tenkan.toFixed(2), kijun: +kijun.toFixed(2),
    senkouA: +senkouA.toFixed(2), senkouB: +senkouB.toFixed(2),
    chikou: +chikou.toFixed(2),
    aboveCloud, belowCloud, tkCross,
    signal: aboveCloud && tkCross ? 'bullish' : belowCloud && !tkCross ? 'bearish' : 'neutral',
  };
}

// Candlestick Pattern Recognition — Varsity M2 Ch 5-11
function detectCandlePatterns(candles) {
  const patterns = [];
  const n = candles.length;
  if (n < 3) return patterns;

  const isGreen = c => c.close > c.open;
  const isRed   = c => c.close < c.open;
  const body    = c => Math.abs(c.close - c.open);
  const range   = c => c.high - c.low;
  const upper   = c => c.high - Math.max(c.open, c.close);
  const lower   = c => Math.min(c.open, c.close) - c.low;
  const mid     = c => (c.open + c.close) / 2;

  const c1 = candles[n-1]; // latest
  const c2 = candles[n-2];
  const c3 = candles[n-3];

  // --- SINGLE CANDLE PATTERNS ---

  // Marubozu — Varsity: "full body, no shadows = strong conviction"
  if (body(c1) > range(c1)*0.9 && range(c1) > 0) {
    patterns.push({ pattern: isGreen(c1)?'Bullish Marubozu':'Bearish Marubozu', type: isGreen(c1)?'bullish':'bearish', reliability: 2 });
  }

  // Doji — Varsity: "indecision, direction depends on prior trend"
  if (body(c1) < range(c1)*0.1 && range(c1) > 0) {
    patterns.push({ pattern: 'Doji', type: 'neutral', reliability: 1 });
  }

  // Hammer / Hanging Man — Varsity M2 Ch 7: "lower shadow >= 2x body, tiny upper shadow"
  if (lower(c1) >= body(c1)*2 && upper(c1) < body(c1)*0.3 && body(c1) > 0) {
    const prevTrend = c2.close < c3.close; // prior downtrend
    patterns.push({
      pattern: prevTrend ? 'Hammer' : 'Hanging Man',
      type:    prevTrend ? 'bullish' : 'bearish',
      reliability: 2,
    });
  }

  // Inverted Hammer / Shooting Star
  if (upper(c1) >= body(c1)*2 && lower(c1) < body(c1)*0.3 && body(c1) > 0) {
    const prevTrend = c2.close < c3.close;
    patterns.push({
      pattern: prevTrend ? 'Inverted Hammer' : 'Shooting Star',
      type:    prevTrend ? 'bullish' : 'bearish',
      reliability: 2,
    });
  }

  // Spinning Top — small body, long shadows both sides
  if (body(c1) < range(c1)*0.3 && upper(c1) > body(c1) && lower(c1) > body(c1) && range(c1) > 0) {
    patterns.push({ pattern: 'Spinning Top', type: 'neutral', reliability: 1 });
  }

  // --- DOUBLE CANDLE PATTERNS ---

  // Bullish Engulfing — Varsity M2 Ch 8: "green candle engulfs prior red candle"
  if (isRed(c2) && isGreen(c1) && c1.open < c2.close && c1.close > c2.open && body(c1) > body(c2)) {
    patterns.push({ pattern: 'Bullish Engulfing', type: 'bullish', reliability: 3 });
  }

  // Bearish Engulfing
  if (isGreen(c2) && isRed(c1) && c1.open > c2.close && c1.close < c2.open && body(c1) > body(c2)) {
    patterns.push({ pattern: 'Bearish Engulfing', type: 'bearish', reliability: 3 });
  }

  // Piercing Pattern — Varsity M2 Ch 8
  if (isRed(c2) && isGreen(c1) && c1.open < c2.low && c1.close > mid(c2) && c1.close < c2.open) {
    patterns.push({ pattern: 'Piercing Pattern', type: 'bullish', reliability: 2 });
  }

  // Dark Cloud Cover
  if (isGreen(c2) && isRed(c1) && c1.open > c2.high && c1.close < mid(c2) && c1.close > c2.open) {
    patterns.push({ pattern: 'Dark Cloud Cover', type: 'bearish', reliability: 2 });
  }

  // Bullish Harami — small candle inside prior large candle
  if (isRed(c2) && isGreen(c1) && c1.open > c2.close && c1.close < c2.open && body(c1) < body(c2)*0.5) {
    patterns.push({ pattern: 'Bullish Harami', type: 'bullish', reliability: 1 });
  }

  // Bearish Harami
  if (isGreen(c2) && isRed(c1) && c1.open < c2.close && c1.close > c2.open && body(c1) < body(c2)*0.5) {
    patterns.push({ pattern: 'Bearish Harami', type: 'bearish', reliability: 1 });
  }

  // --- TRIPLE CANDLE PATTERNS ---

  // Morning Star — Varsity M2 Ch 9: strongest bullish reversal
  if (isRed(c3) && body(c2)<body(c3)*0.3 && isGreen(c1) && c1.close>mid(c3) && body(c3)>0) {
    patterns.push({ pattern: 'Morning Star', type: 'bullish', reliability: 3 });
  }

  // Evening Star
  if (isGreen(c3) && body(c2)<body(c3)*0.3 && isRed(c1) && c1.close<mid(c3) && body(c3)>0) {
    patterns.push({ pattern: 'Evening Star', type: 'bearish', reliability: 3 });
  }

  // Three White Soldiers — three consecutive green candles, each closing higher
  if (isGreen(c1)&&isGreen(c2)&&isGreen(c3) && c1.close>c2.close&&c2.close>c3.close && c1.open>c2.open&&c2.open>c3.open) {
    patterns.push({ pattern: 'Three White Soldiers', type: 'bullish', reliability: 3 });
  }

  // Three Black Crows
  if (isRed(c1)&&isRed(c2)&&isRed(c3) && c1.close<c2.close&&c2.close<c3.close && c1.open<c2.open&&c2.open<c3.open) {
    patterns.push({ pattern: 'Three Black Crows', type: 'bearish', reliability: 3 });
  }

  return patterns;
}

// Multi-timeframe trend check — Varsity M2 Ch 18
// Returns whether daily trend confirms intraday signal
function dailyTrendBullish(dailyCandles) {
  if (!dailyCandles || dailyCandles.length < 50) return null;
  const C   = dailyCandles.map(c=>c.close);
  const n   = C.length;
  const avg = (arr,s,l) => arr.slice(s,s+l).reduce((a,b)=>a+b,0)/l;
  const dma50  = avg(C,n-50,50);
  const dma200 = n>=200 ? avg(C,n-200,200) : null;
  const price  = C[n-1];
  const above200 = dma200 ? price > dma200 : null;
  const above50  = price > dma50;
  const golden   = dma200 ? dma50 > dma200 : null;
  return above200 !== false && above50 && (golden !== false);
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

// Strategy 8: MACD Crossover — Varsity M2 Ch 15
// Signal line crossover + histogram reversal + zero-line confirmation
function stratMACDCrossover(candles) {
  const closes = candles.map(c=>c.close);
  const n = closes.length-1;
  if (n < 35) return { score:0, signal:'NEUTRAL', detail:'Not enough data', strategy:'MACD_CROSSOVER' };

  const calcEma = (arr, p) => { const k=2/(p+1); let e=arr[0]; return arr.map(v=>{e=v*k+e*(1-k);return e;}); };
  const e12 = calcEma(closes, 12), e26 = calcEma(closes, 26);
  const macdLine   = e12.map((v,i)=>v-e26[i]);
  const sigLine    = calcEma(macdLine, 9);
  const hist       = macdLine.map((v,i)=>v-sigLine[i]);

  const macdNow  = macdLine[n], sigNow  = sigLine[n], histNow  = hist[n];
  const macdPrev = macdLine[n-1], sigPrev = sigLine[n-1], histPrev = hist[n-1];

  // Bullish crossover: MACD crossed above signal
  const bullCross = macdPrev < sigPrev && macdNow > sigNow;
  // Bearish crossover
  const bearCross = macdPrev > sigPrev && macdNow < sigNow;
  // Histogram reversal (momentum shift)
  const histBullRev = histPrev < histNow && histNow < 0; // histogram rising from negative
  const histBearRev = histPrev > histNow && histNow > 0;
  // Zero-line cross (trend confirmation)
  const aboveZero = macdNow > 0;

  let score=0, detail=`MACD: ${macdNow.toFixed(2)} Sig: ${sigNow.toFixed(2)} `;
  if (bullCross)    { score+=4; detail+='BULLISH CROSSOVER '; }
  if (bearCross)    { score-=4; detail+='BEARISH CROSSOVER '; }
  if (histBullRev)  { score+=2; detail+='Histogram reversing up '; }
  if (histBearRev)  { score-=2; detail+='Histogram reversing down '; }
  if (aboveZero)    { score+=1; detail+='Above zero (bullish trend) '; }
  else              { score-=1; detail+='Below zero (bearish trend) '; }

  const rsiArr = rsi(closes, 14);
  if (score>0 && rsiArr[n]>70) { score-=2; detail+='RSI overbought caution '; }

  const sl  = score>=4 ? closes[n]*0.985 : null;
  const tgt = score>=4 ? closes[n]*1.03  : null;
  return { score, signal:score>=4?'BUY':score<=-4?'SELL':'NEUTRAL', detail, strategy:'MACD_CROSSOVER', sl, tgt };
}

// ===============================================================================
// -- STRATEGY SELECTOR (the brain) — with multi-timeframe confirmation ----------
// Varsity M2 Ch 18: intraday signal + daily trend = higher conviction
// ===============================================================================

function selectAndRunStrategy(candles, dailyCandles=null) {
  const { regime, reason, confidence } = detectRegime(candles);

  // Map regime to primary + secondary strategies — MACD added to TRENDING
  const strategyMap = {
    TRENDING:  [stratEMACrossover, stratMACDCrossover,        stratSupertrend],
    RANGING:   [stratRSIMeanReversion, stratBollingerSqueeze, stratVWAPMomentum],
    BREAKOUT:  [stratBollingerSqueeze, stratVolumeSpike,      stratEMACrossover],
    MOMENTUM:  [stratVWAPMomentum, stratOpeningRange,         stratMACDCrossover],
    UNKNOWN:   [stratEMACrossover, stratRSIMeanReversion,     stratVWAPMomentum],
  };

  const strategies = strategyMap[regime] || strategyMap.UNKNOWN;

  // Run all selected strategies and combine scores
  const results = strategies.map(fn => fn(candles));

  // Weighted combination - primary strategy gets 50%, others 25% each
  let weightedScore =
    results[0].score * 0.50 +
    (results[1]?.score||0) * 0.30 +
    (results[2]?.score||0) * 0.20;

  // Multi-timeframe confirmation — Varsity M2 Ch 18
  // Daily trend bullish + intraday BUY = higher conviction (+30%)
  // Daily trend bearish + intraday BUY = lower conviction (-30%)
  let mtfConfirmation = null;
  if (dailyCandles) {
    const dailyBull = dailyTrendBullish(dailyCandles);
    if (dailyBull === true)  { weightedScore *= 1.3; mtfConfirmation = 'daily_bullish'; }
    if (dailyBull === false) { weightedScore *= 0.7; mtfConfirmation = 'daily_bearish'; }
  }

  // Consensus: at least 2 of 3 strategies must agree
  const buyVotes  = results.filter(r => r.signal==="BUY").length;
  const sellVotes = results.filter(r => r.signal==="SELL").length;
  const consensus = buyVotes>=2?"BUY":sellVotes>=2?"SELL":"NEUTRAL";

  const primaryResult = results[0];
  const detail = results.map(r=>`[${r.strategy}: ${r.score>0?"+":""}${r.score.toFixed(1)}]`).join(" ");

  return {
    regime, reason, confidence,
    strategy:         primaryResult.strategy,
    allStrategies:    results.map(r=>r.strategy).join("+"),
    score:            +weightedScore.toFixed(2),
    consensus,
    signal:           consensus,
    detail,
    sl:               primaryResult.sl,
    tgt:              primaryResult.tgt,
    buyVotes,
    sellVotes,
    mtfConfirmation,
  };
}

// ===============================================================================
// -- PAPER TRADING ENGINE ------------------------------------------------------
// ===============================================================================

const CONFIG = {
  BUY_SCORE:          2.5,
  SELL_SCORE:        -2.0,
  CONSENSUS_NEEDED:   2,
  // Varsity M9: volatility-based position sizing replaces fixed amount
  ACCOUNT_SIZE:       100000,  // ₹1 lakh paper trading account
  RISK_PCT_PER_TRADE: 0.02,    // 2% max risk per trade (Varsity M9 Ch 11)
  MIN_RISK_PCT:       0.005,   // 0.5% floor
  MAX_RISK_PCT:       0.03,    // 3% ceiling (half-Kelly floor)
  MAX_POSITIONS:      10,
  // ATR-based stops — Varsity M9 Ch 11
  ATR_MULT: { TRENDING:2.5, RANGING:1.5, BREAKOUT:2.0, MOMENTUM:2.0, UNKNOWN:2.0 },
  RISK_REWARD:        2.0,     // Varsity: minimum acceptable R:R
  // Portfolio risk limits
  MAX_SECTOR_POSITIONS: 3,     // Varsity M9 Ch 8: concentration limit
  MAX_CORRELATION:    0.7,     // Varsity M9 Ch 4: skip if >70% correlated with existing
  MAX_PORTFOLIO_BETA: 1.5,
  // Drawdown circuit breaker — Varsity M9 Ch 6
  DD_REDUCE_PCT:  0.10,  // reduce size 50% at 10% drawdown
  DD_PAUSE_PCT:   0.15,  // pause new entries at 15%
  DD_HALT_PCT:    0.20,  // halt all trading at 20%
  SCAN_DELAY_MS:  250,
};

function isMarketOpen() {
  const ist = new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
  const h=ist.getHours(),m=ist.getMinutes();
  return (h>9||(h===9&&m>=15))&&(h<15||(h===15&&m<=30));
}

const delay = ms => new Promise(r=>setTimeout(r,ms));

// ===============================================================================
// PHASE 3: RISK MANAGEMENT — Varsity Module 9
// ===============================================================================

// ATR-based position sizing — Varsity M9 Ch 11-13
// Position Size = (Account × Risk%) / (ATR × ATR_multiplier)
function computePositionSize(entryPrice, atrValue, regime, accountEquity=null, kellyRisk=null) {
  const equity   = accountEquity || CONFIG.ACCOUNT_SIZE;
  const riskPct  = kellyRisk || CONFIG.RISK_PCT_PER_TRADE;
  const riskAmt  = equity * Math.min(Math.max(riskPct, CONFIG.MIN_RISK_PCT), CONFIG.MAX_RISK_PCT);
  const mult     = CONFIG.ATR_MULT[regime] || CONFIG.ATR_MULT.UNKNOWN;
  const stopDist = Math.max(atrValue * mult, entryPrice * 0.005); // min 0.5% stop
  const stopLoss = entryPrice - stopDist;
  const target   = entryPrice + stopDist * CONFIG.RISK_REWARD;
  const shares   = Math.max(1, Math.floor(riskAmt / stopDist));
  const capital  = shares * entryPrice;
  return {
    shares,
    capital:  +capital.toFixed(0),
    stopLoss: +stopLoss.toFixed(2),
    target:   +target.toFixed(2),
    atrStop:  +stopDist.toFixed(2),
    riskAmt:  +riskAmt.toFixed(0),
    riskPct:  CONFIG.RISK_PCT_PER_TRADE * 100,
  };
}

// Kelly Criterion from paper trade history — Varsity M9 Ch 13
async function computeKelly() {
  try {
    const { rows } = await pool.query(`
      SELECT pnl FROM paper_trades
      WHERE status='CLOSED' AND pnl IS NOT NULL
      ORDER BY exit_time DESC LIMIT 50
    `);
    if (rows.length < 10) return null;
    const wins   = rows.filter(r=>parseFloat(r.pnl)>0);
    const losses = rows.filter(r=>parseFloat(r.pnl)<=0);
    const winRate = wins.length / rows.length;
    const avgWin  = wins.reduce((s,r)=>s+parseFloat(r.pnl),0) / (wins.length||1);
    const avgLoss = Math.abs(losses.reduce((s,r)=>s+parseFloat(r.pnl),0) / (losses.length||1));
    if (avgLoss === 0) return null;
    const kelly = winRate - ((1-winRate) / (avgWin/avgLoss));
    return Math.min(Math.max(kelly * 0.5, CONFIG.MIN_RISK_PCT), CONFIG.MAX_RISK_PCT); // half-Kelly, clamped
  } catch(e) { return null; }
}

// Correlation guard — Varsity M9 Ch 4-5
// Returns true if new stock is too correlated with existing positions
async function isTooCorrelated(sym, openPositions) {
  if (!openPositions || openPositions.length === 0) return false;
  try {
    const newCandles = stockFundamentals[sym];
    if (!newCandles) return false;
    for (const pos of openPositions) {
      const posF = stockFundamentals[pos.symbol];
      if (!posF) continue;
      // Same sector = likely correlated — simple proxy
      if ((newCandles.sector||'') === (posF.sector||'') && newCandles.sector) {
        const sectorCount = openPositions.filter(p=>stockFundamentals[p.symbol]?.sector===newCandles.sector).length;
        if (sectorCount >= CONFIG.MAX_SECTOR_POSITIONS) return true;
      }
    }
    return false;
  } catch(e) { return false; }
}

// Drawdown circuit breaker — Varsity M9 Ch 6
let _peakEquity = CONFIG.ACCOUNT_SIZE;
let _ddPaused   = false;
async function checkDrawdownCircuitBreaker() {
  try {
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(pnl),0) as total_pnl FROM paper_trades WHERE status='CLOSED'
    `);
    const totalPnl  = parseFloat(rows[0]?.total_pnl || 0);
    const equity    = CONFIG.ACCOUNT_SIZE + totalPnl;
    _peakEquity     = Math.max(_peakEquity, equity);
    const drawdown  = (_peakEquity - equity) / _peakEquity;

    if (drawdown >= CONFIG.DD_HALT_PCT) {
      console.log(`🛑 Drawdown ${(drawdown*100).toFixed(1)}% — HALTING all trading`);
      _ddPaused = true;
      return { action:'HALT', drawdown, equity };
    }
    if (drawdown >= CONFIG.DD_PAUSE_PCT) {
      console.log(`⚠ Drawdown ${(drawdown*100).toFixed(1)}% — pausing new entries`);
      _ddPaused = true;
      return { action:'PAUSE', drawdown, equity };
    }
    if (drawdown >= CONFIG.DD_REDUCE_PCT) {
      _ddPaused = false;
      return { action:'REDUCE_SIZE', drawdown, equity, sizeMult:0.5 };
    }
    _ddPaused = false;
    return { action:'NORMAL', drawdown, equity, sizeMult:1.0 };
  } catch(e) { return { action:'NORMAL', drawdown:0, equity:CONFIG.ACCOUNT_SIZE, sizeMult:1.0 }; }
}

// Portfolio Sharpe/Sortino/Stats — Varsity M9 Ch 10
async function computePortfolioStats() {
  try {
    const { rows } = await pool.query(`
      SELECT pnl, pnl_pct, entry_time, exit_time FROM paper_trades
      WHERE status='CLOSED' AND pnl IS NOT NULL ORDER BY exit_time
    `);
    if (rows.length < 5) return null;
    const returns = rows.map(r=>parseFloat(r.pnl_pct||0)/100);
    const n = returns.length;
    const avg = returns.reduce((a,b)=>a+b,0)/n;
    const rfr = 0.065/252; // 6.5% annual risk-free rate, daily
    const excess = returns.map(r=>r-rfr);
    const std = Math.sqrt(excess.reduce((a,r)=>a+(r-avg)**2,0)/n);
    const downside = Math.sqrt(excess.filter(r=>r<0).reduce((a,r)=>a+r**2,0)/n);
    const wins = returns.filter(r=>r>0);
    const losses = returns.filter(r=>r<=0);
    const grossWins = wins.reduce((a,b)=>a+b,0);
    const grossLoss = Math.abs(losses.reduce((a,b)=>a+b,0));
    // Max drawdown
    let peak=0, maxDD=0, running=0;
    for(const r of returns){ running+=r; peak=Math.max(peak,running); maxDD=Math.max(maxDD,peak-running); }
    return {
      trades:       n,
      winRate:      +(wins.length/n*100).toFixed(1),
      avgReturn:    +(avg*100).toFixed(2),
      sharpe:       std>0 ? +(avg/std*Math.sqrt(252)).toFixed(2) : 0,
      sortino:      downside>0 ? +(avg/downside*Math.sqrt(252)).toFixed(2) : 0,
      maxDrawdown:  +(maxDD*100).toFixed(1),
      profitFactor: grossLoss>0 ? +(grossWins/grossLoss).toFixed(2) : null,
      avgWin:       wins.length ? +(wins.reduce((a,b)=>a+b,0)/wins.length*100).toFixed(2) : 0,
      avgLoss:      losses.length ? +(losses.reduce((a,b)=>a+b,0)/losses.length*100).toFixed(2) : 0,
      expectancy:   +((avg)*100).toFixed(2),
    };
  } catch(e) { return null; }
}

async function scanAndTrade() {
  if (!process.env.KITE_ACCESS_TOKEN||!kite){console.log("No token");return;}
  if (!isMarketOpen()){console.log("Market closed");return;}

  const scanTime = new Date().toLocaleTimeString("en-IN");
  console.log(`\n⟳ Smart scan at ${scanTime}...`);

  const { rows: openTrades } = await pool.query("SELECT * FROM paper_trades WHERE status='OPEN'");
  let signalCount=0, dominantRegime="UNKNOWN", dominantStrategy="NONE";
  const regimeCounts={};

  // Phase 3: Check drawdown circuit breaker before scanning
  const ddStatus = await checkDrawdownCircuitBreaker();
  if (ddStatus.action === 'HALT') {
    console.log(`🛑 Trading halted — drawdown ${(ddStatus.drawdown*100).toFixed(1)}% exceeds ${CONFIG.DD_HALT_PCT*100}% limit`);
    return;
  }
  const sizeMult = ddStatus.action === 'REDUCE_SIZE' ? 0.5 : 1.0;
  const canEnterNew = ddStatus.action !== 'PAUSE' && ddStatus.action !== 'HALT';

  // Phase 3: Kelly-based risk sizing
  const kellyRisk = await computeKelly();

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

      // Daily candles for multi-timeframe confirmation
      const dailyF = stockFundamentals[stock.sym];
      const dailyTrend = dailyF ? (last.close > (dailyF.dma200||0) ? 'bullish' : 'bearish') : 'unknown';

      // Run smart strategy selection
      const result = selectAndRunStrategy(candles);

      // Multi-timeframe conviction adjustment — Varsity M2 Ch 18
      if (dailyTrend === 'bearish' && result.signal === 'BUY') {
        result.score = result.score * 0.7; // reduce conviction by 30% when daily trend opposes
        result.detail = (result.detail||'') + ' [MTF: bearish daily trend reduces conviction]';
      }

      // Track dominant regime across all stocks
      regimeCounts[result.regime]=(regimeCounts[result.regime]||0)+1;

      const openPos = openTrades.find(t=>t.symbol===stock.sym&&t.status==='OPEN');

      if (openPos) {
        const cmp = last.close;
        const sl  = parseFloat(openPos.stop_loss);
        const tgt = parseFloat(openPos.target);
        const entryPrice = parseFloat(openPos.price);

        // Phase 3: Trailing stop — once 1 ATR in profit, trail at 1.5 ATR from high
        const highs = candles.slice(-14).map(c=>c.high);
        const lows  = candles.slice(-14).map(c=>c.low);
        const trs   = highs.map((h,i)=>h-lows[i]);
        const atr   = trs.reduce((a,b)=>a+b,0)/trs.length;
        const atrMult = CONFIG.ATR_MULT[result.regime]||2.0;
        const profit = cmp - entryPrice;
        let trailSL = sl;
        if (profit > atr) { // trade is 1 ATR in profit — activate trailing stop
          const trailLevel = cmp - (atr * 1.5);
          if (trailLevel > sl) {
            trailSL = +trailLevel.toFixed(2);
            await pool.query('UPDATE paper_trades SET stop_loss=$1 WHERE id=$2', [trailSL, openPos.id]);
          }
        }

        const hitSL  = cmp <= Math.max(sl, trailSL);
        const hitTgt = cmp >= tgt;
        const exitSig= result.signal==="SELL"&&result.buyVotes===0;

        if (hitSL||hitTgt||exitSig) {
          const pnl    = +((cmp-entryPrice)*openPos.quantity).toFixed(2);
          const pnlPct = +((cmp-entryPrice)/entryPrice*100).toFixed(2);
          const reason = hitSL?"Stop Loss (trailing)":hitTgt?"Target Hit":"Strategy Exit";
          // Track MAE/MFE for Phase 6 accuracy tracking
          await pool.query(
            `UPDATE paper_trades SET status='CLOSED',exit_price=$1,exit_time=NOW(),pnl=$2,pnl_pct=$3,exit_reason=$4 WHERE id=$5`,
            [cmp,pnl,pnlPct,reason,openPos.id]
          );
          console.log(`  ▼ EXIT ${stock.sym} @ ₹${cmp} | ${reason} | ${pnl>=0?"+":""}₹${pnl} | ${result.regime}`);
          signalCount++;
        }

      } else if (canEnterNew
                 && openTrades.filter(t=>t.status==="OPEN").length < CONFIG.MAX_POSITIONS
                 && result.signal==="BUY"
                 && result.buyVotes >= CONFIG.CONSENSUS_NEEDED
                 && result.score >= CONFIG.BUY_SCORE) {

        // Phase 3: Correlation guard — skip if too correlated with existing positions
        const tooCorrrelated = await isTooCorrelated(stock.sym, openTrades.filter(t=>t.status==='OPEN'));
        if (tooCorrrelated) {
          console.log(`  ⊘ SKIP ${stock.sym} — sector concentration limit reached`);
          continue;
        }

        // Phase 3: ATR-based position sizing + Kelly
        const price   = last.close;
        const highs14 = candles.slice(-14).map(c=>c.high);
        const lows14  = candles.slice(-14).map(c=>c.low);
        const atrVal  = highs14.map((h,i)=>h-lows14[i]).reduce((a,b)=>a+b,0)/14;
        const { shares, stopLoss, target, capital } = computePositionSize(
          price, atrVal, result.regime,
          ddStatus.equity * sizeMult,
          kellyRisk
        );
        const sl  = result.sl  || stopLoss;
        const tgt = result.tgt || target;
        const qty = shares;

        await pool.query(
          `INSERT INTO paper_trades (symbol,name,type,price,quantity,capital,entry_time,stop_loss,target,signal_score,strategy,regime,indicators,status)
           VALUES ($1,$2,'BUY',$3,$4,$5,NOW(),$6,$7,$8,$9,$10,$11,'OPEN')`,
          [stock.sym,stock.n,price,qty,+(qty*price).toFixed(2),+sl.toFixed(2),+tgt.toFixed(2),
           +(result.score*10).toFixed(0),result.strategy,result.regime,result.detail]
        );
        openTrades.push({symbol:stock.sym,status:"OPEN"});
        dominantStrategy=result.strategy;
        console.log(`  ▲ BUY  ${stock.sym} @ ₹${price} | ${result.regime} | ${result.strategy} | Score:${result.score} | SL:${sl.toFixed(0)} | TGT:${tgt.toFixed(0)} | Qty:${qty}`);
        signalCount++;
      }

      await delay(CONFIG.SCAN_DELAY_MS);
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
    {url:"https://www.nseindia.com/api/cmsContent?url=/Regulations/corporateAction/corporateActionRss",source:"NSE India"}
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

    // Persist to stock_instruments table for all UNIVERSE stocks
    for (const s of UNIVERSE) {
      const tok = validTokens[s.sym];
      if (!tok) continue;
      try {
        await pool.query(
          `INSERT INTO stock_instruments (sym, kite_token, exchange, updated_at)
           VALUES ($1, $2, 'NSE', NOW())
           ON CONFLICT (sym) DO UPDATE SET kite_token=EXCLUDED.kite_token, updated_at=NOW()`,
          [s.sym, tok]
        );
      } catch(e) { /* ignore individual errors */ }
    }
    console.log(`📋 Instrument tokens saved to DB`);
  } catch(e) {
    console.error("Could not fetch instruments:", e.message);
    validTokens = {...INSTRUMENTS};
  }
}

app.get("/api/instruments", (req,res) => res.json(validTokens));

// -- DEBUG: Check FUND_EXT contents for a stock --
app.get("/api/debug/fund-ext/:sym", (req, res) => {
  const sym = req.params.sym.toUpperCase();
  res.json({
    sym,
    fund: FUND[sym] || null,
    fund_ext: global.FUND_EXT?.[sym] || null,
    scored_keys: stockFundamentals[sym] ? Object.keys(stockFundamentals[sym]).filter(k => stockFundamentals[sym][k] != null) : [],
  });
});

// -- DEBUG: Test candle fetch for a single stock, returns error details -----------
app.get("/api/debug/candles/:sym", async (req, res) => {
  const sym = req.params.sym.toUpperCase();
  const token = validTokens[sym] || INSTRUMENTS[sym];
  const result = { sym, token, kiteReady: !!kite, hasAccessToken: !!process.env.KITE_ACCESS_TOKEN };
  if (!kite || !token) return res.json({ ...result, error: 'kite or token missing' });
  const to = new Date();
  const from5y = new Date(Date.now() - 5*365*864e5);
  const from1y = new Date(Date.now() - 365*864e5);
  const from60d = new Date(Date.now() - 60*864e5);
  // Try multiple date ranges and intervals
  const tests = [
    { label: 'day_5y', interval: 'day', from: from5y },
    { label: 'day_1y', interval: 'day', from: from1y },
    { label: 'day_60d', interval: 'day', from: from60d },
    { label: '60min_60d', interval: '60minute', from: from60d },
  ];
  for (const t of tests) {
    try {
      const candles = await kite.getHistoricalData(
        token, t.interval,
        t.from.toISOString().split('T')[0],
        to.toISOString().split('T')[0]
      );
      result[t.label] = { ok: true, count: candles?.length || 0, sample: candles?.[0] };
    } catch (e) {
      result[t.label] = { ok: false, error: e.message, status: e.status, code: e.error_type };
    }
  }
  res.json(result);
});

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
  {code:"150091",name:"Groww Nifty India Defence ETF FoF",amc:"Groww",     cat:"flexicap"}
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
    ["UTI","UTI"],["WhiteOak","WhiteOak"],["360 ONE","360 ONE"],["Groww","Groww"]
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
  // =============================================================================
  // MF SCORING — Varsity Module 11 derived framework
  // "Rolling Returns > Point-to-Point" (Ch19), "Sortino > Sharpe for SIP investors" (Ch23)
  // "Expense ratio compounding is brutal over 30 years" (Ch20)
  // "Alpha = fund manager adding value above risk taken" (Ch22)
  //
  // PILLARS (120 pts total, normalised to 100):
  //   A. Rolling 3Y Consistency  (25 pts) — Varsity: #1 predictor, removes date bias
  //   B. Risk-Adjusted Returns   (20 pts) — Sortino weighted more than Sharpe (downside only)
  //   C. Beats Peers Consistently(20 pts) — Varsity: beat benchmark 7/10 years = skill
  //   D. Downside Protection     (15 pts) — Varsity: max drawdown + volatility vs peers
  //   E. Expense Ratio           (12 pts) — Varsity: "guaranteed drag on compounding"
  //   F. Absolute Returns        ( 8 pts) — Low weight: point-in-time, low predictive power
  //   G. Portfolio Quality       ( 8 pts) — PE vs category, concentration, cash
  //   H. AUM + Track Record      (12 pts) — size matters for small/mid cap; age = stress tests
  //   I. AMC Quality             (10 pts) — governance, SEBI record, fund manager tenure
  // =============================================================================
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

  // -- PILLAR A: ROLLING 3Y CONSISTENCY (25 pts) --------------------------------
  // Varsity Ch19: "Rolling return is the most honest measure — removes start/end date bias"
  // This is the SINGLE best predictor of future fund performance per Morningstar research
  const roll  = get('rolling_3y');
  const rollP = (roll && roll > 0) ? pr(roll, dist.rolling_3y) : null;
  const rollPts = pts(rollP, 25);
  score += rollPts;
  hits[`Rolling 3Y: ${roll!=null?roll.toFixed(1):'?'}% (top ${rollP!=null?(100-rollP).toFixed(0):'?'}% of eligible funds)`] = rollPts;

  // -- PILLAR B: RISK-ADJUSTED RETURNS (20 pts) ---------------------------------
  // Varsity Ch22+23: Sortino more relevant than Sharpe for long-term SIP investors
  // "Sharpe penalises upside volatility — we only care about downside risk"
  // NEW: Sortino gets 13 pts, Sharpe gets 7 pts (was 12/8 before)
  const sharpe  = get('sharpe');
  const sortino = get('sortino');
  const shP  = pr(sharpe,  dist.sharpe,  true);
  const soP  = pr(sortino, dist.sortino, true);
  const shPts = pts(shP, 7);   // REDUCED: Sharpe includes upside vol = less relevant
  const soPts = pts(soP, 13);  // INCREASED: Sortino = downside-only risk = SIP investor's true risk
  score += shPts + soPts;
  hits[`Sharpe: ${sharpe!=null?sharpe.toFixed(3):'?'} (top ${shP!=null?(100-shP).toFixed(0):'?'}% — risk-adjusted return)`] = shPts;
  hits[`Sortino: ${sortino!=null?sortino.toFixed(4):'?'} (top ${soP!=null?(100-soP).toFixed(0):'?'}% — downside risk quality)`] = soPts;

  // -- PILLAR C: BEATS PEERS CONSISTENTLY (20 pts) ------------------------------
  // Varsity Ch21: "Beat benchmark in 7/10 years = manager skill, not luck"
  // vs_cat ratios: >1.0 = beats median peer over that period
  const vc3  = get('vs_cat_3y');
  const vc5  = get('vs_cat_5y');
  const vc10 = get('vs_cat_10y');
  const vc3P  = (vc3  && vc3  > 0) ? pr(vc3,  dist.vs_cat_3y)  : null;
  const vc5P  = (vc5  && vc5  > 0) ? pr(vc5,  dist.vs_cat_5y  || dist.vs_cat_3y)  : null;
  const vc10P = (vc10 && vc10 > 0) ? pr(vc10, dist.vs_cat_10y || dist.vs_cat_5y) : null;
  const vc3Pts  = pts(vc3P,  8);   // 3Y peer beat
  const vc5Pts  = pts(vc5P,  8);   // INCREASED to 8: 5Y is the key period for investor cycles
  const vc10Pts = pts(vc10P, 4);   // 10Y: highest conviction if available
  score += vc3Pts + vc5Pts + vc10Pts;
  hits[vc3  ? `Beats peers 3Y: ${vc3.toFixed(2)}x (${vc3>1?'outperforms':'underperforms'} median)` : 'Beats peers 3Y: no data'] = vc3Pts;
  hits[vc5  ? `Beats peers 5Y: ${vc5.toFixed(2)}x (${vc5>1?'outperforms':'underperforms'} median)` : 'Beats peers 5Y: no data'] = vc5Pts;
  if(vc10 && vc10 > 0) hits[`Beats peers 10Y: ${vc10.toFixed(2)}x — decade-long consistency`] = vc10Pts;

  // Alpha bonus — Varsity: "Alpha>0 = manager adding value above risk taken"
  // If fund consistently beats category, reward that with bonus
  const vc1 = get('vs_cat_1y');
  const beatingOnMultipleTimeframes = (vc3&&vc3>1.1) && (vc5&&vc5>1.1);
  if(beatingOnMultipleTimeframes){
    score += 2;
    hits['Alpha: Consistent outperformer across 3Y+5Y — manager skill confirmed'] = 2;
  }

  // -- PILLAR D: DOWNSIDE PROTECTION (15 pts) ------------------------------------
  // Varsity: "Max Drawdown matters most — a fund that falls 50% needs 100% to recover"
  // Capital preservation during crashes = wealth compounding advantage
  const mdd    = get('max_drawdown');
  const vol    = get('volatility');
  const catVol = get('category_stddev') || 16;
  const mddP   = pr(mdd, dist.max_drawdown, false); // lower drawdown = better rank
  const volP   = pr(vol, dist.volatility,   false);
  const mddPts = pts(mddP, 10);  // INCREASED: drawdown is the capital destruction metric
  const volPts = pts(volP, 5);
  score += mddPts + volPts;
  hits[`Max Drawdown: ${mdd!=null?mdd.toFixed(1):'?'}% (top ${mddP!=null?(100-mddP).toFixed(0):'?'}% protected)`] = mddPts;
  hits[`Volatility: ${vol!=null?vol.toFixed(1):'?'}% vs category avg ${catVol.toFixed(1)}%`] = volPts;

  // Volatility vs category bonus — fund that delivers lower vol than category
  const vol2    = get('volatility');
  const catVol2 = get('category_stddev');
  if(vol2 && catVol2 && vol2 < catVol2){
    const diff = catVol2 - vol2;
    const vb = diff > 2 ? 1 : 0.5;
    score += vb;
    hits[`Vol below category avg: ${vol2.toFixed(1)}% vs ${catVol2.toFixed(1)}% (better risk control)`] = vb;
  }

  // -- PILLAR E: EXPENSE RATIO (12 pts) -----------------------------------------
  // Varsity Ch20: "1% extra TER over 30 years = ~25% less corpus. Most reliable predictor."
  // Morningstar: expense ratio is the single best predictor of future fund returns
  const exp  = get('expense_ratio');
  const expP = (exp && exp > 0) ? pr(exp, dist.expense, false) : null;
  const expPts = pts(expP, 12);
  score += expPts;
  const expTier = exp ? (exp<0.4?'exceptional':exp<0.65?'very low':exp<0.85?'low':exp<1.1?'average':'high') : '?';
  hits[`Expense Ratio: ${exp!=null?exp.toFixed(2):'?'}% (${expTier}) — ₹${exp?Math.round((exp/100)*100000).toLocaleString('en-IN'):'?'} annual cost on ₹1L`] = expPts;

  // -- PILLAR F: ABSOLUTE RETURNS (8 pts) ---------------------------------------
  // Varsity Ch19: "Point-to-point CAGR has low predictive power — use rolling returns instead"
  // Kept for user expectation setting but weighted LOW
  const r3  = get('cagr_3y');
  const r5  = get('cagr_5y');
  const r10 = get('cagr_10y');
  const r3P  = (r3  && r3  > 0) ? pr(r3,  dist.cagr_3y)  : null;
  const r5P  = (r5  && r5  > 0) ? pr(r5,  dist.cagr_5y  || dist.cagr_3y) : null;
  const r10P = (r10 && r10 > 0) ? pr(r10, dist.cagr_10y || dist.cagr_5y) : null;
  score += pts(r3P, 3) + pts(r5P, 3) + pts(r10P, 2);
  hits[r3  ? `3Y CAGR: ${r3.toFixed(1)}%`  : '3Y CAGR: no data']  = pts(r3P, 3);
  hits[r5  ? `5Y CAGR: ${r5.toFixed(1)}%`  : '5Y CAGR: no data']  = pts(r5P, 3);
  if(r10 && r10 > 0) hits[`10Y CAGR: ${r10.toFixed(1)}%`] = pts(r10P, 2);

  // -- PILLAR G: PORTFOLIO QUALITY (8 pts) --------------------------------------
  // Varsity Ch24: "Portfolio PE vs benchmark PE = is manager buying cheap or expensive?"
  // Concentration: Varsity: "Top 10 > 40% = single-stock risk"
  const pe    = get('pe_ratio');
  const catPE = get('category_pe') || 30;
  const peP   = (pe && pe > 0) ? pr(pe, dist.pe, false) : null;
  const pePts = pts(peP, 3);
  score += pePts;
  if(pe) hits[`Portfolio PE: ${pe.toFixed(1)} vs category ${catPE.toFixed(1)} (${pe<catPE?'cheap':'premium'} vs peers)`] = pePts;

  // Cash allocation — Varsity: 3-10% = healthy buffer for opportunities
  const cash = get('pct_cash') || 0;
  if(cash>=3&&cash<=10)      { score+=2; hits[`Cash: ${cash.toFixed(1)}% (optimal buffer)`]=2; }
  else if(cash>0&&cash<3)    { score+=1; hits[`Cash: ${cash.toFixed(1)}% (minimal)`]=1; }
  else if(cash>20)           { hits[`Cash: ${cash.toFixed(1)}% (excess — uncertain market view)`]=0; }

  // Top10 Concentration — Varsity: lower = less single-stock risk (3 pts)
  const top10  = get('top10_conc') || 0;
  const top10P = (top10 > 0) ? pr(top10, dist.top10, false) : null;
  const top10Pts = pts(top10P, 3);
  score += top10Pts;
  if(top10) hits[`Top 10 holdings: ${top10.toFixed(1)}% (${top10<35?'well diversified':top10<45?'moderate':' concentrated'})`] = top10Pts;

  // % from ATH (recovery signal)
  const ath = get('pct_from_ath');
  if(ath != null){
    const athP = pr(ath, dist.pct_from_ath, false);
    const athPts = pts(athP, 2);
    score += athPts;
    hits[`From ATH: ${ath.toFixed(1)}% below peak`] = athPts;
  }

  // -- PILLAR J: CAPTURE RATIOS (6 pts) ----------------------------------------
  // Varsity Ch22: "Ideal fund: UCR>100 AND DCR<100 = captures more upside, less downside"
  // UCR/DCR is the purest test of asymmetric skill — beat market in bull, protect in bear
  const ucr = get('upside_capture') || get('upside_capture_ratio') || null;
  const dcr  = get('downside_capture') || get('downside_capture_ratio') || null;
  if (ucr != null && dcr != null && ucr > 0 && dcr > 0) {
    let ucrPts = 0;
    if      (ucr > 110 && dcr < 85)   { ucrPts=6; hits[`Capture: UCR ${ucr.toFixed(0)} / DCR ${dcr.toFixed(0)} — captures more up, falls less down (ideal)`]=6; }
    else if (ucr > 100 && dcr < 95)   { ucrPts=4; hits[`Capture: UCR ${ucr.toFixed(0)} / DCR ${dcr.toFixed(0)} — good asymmetry`]=4; }
    else if (ucr > 100 && dcr < 105)  { ucrPts=2; hits[`Capture: UCR ${ucr.toFixed(0)} / DCR ${dcr.toFixed(0)} — captures upside but limited downside protection`]=2; }
    else if (ucr < 100 && dcr > 100)  { ucrPts=0; hits[`⚠ Capture: UCR ${ucr.toFixed(0)} / DCR ${dcr.toFixed(0)} — underperforms on both sides`]=0; score-=1; }
    else                               { ucrPts=1; hits[`Capture: UCR ${ucr.toFixed(0)} / DCR ${dcr.toFixed(0)} — mixed`]=1; }
    score += ucrPts;
    // Bonus: UCR/DCR ratio > 1.2 = strong asymmetric alpha
    const ratio = ucr / dcr;
    if (ratio > 1.25) { score+=1; hits[`UCR/DCR ratio ${ratio.toFixed(2)}x — strong asymmetric alpha generation`]=1; }
  }

  // -- PILLAR K: ROLLING RETURN FLOOR (3 pts) -----------------------------------
  // Varsity Ch19: "High average AND low variance = consistently good fund"
  // A fund that never gives negative 3Y rolling returns = far superior to one with high avg + crashes
  const rollMin = get('rolling_3y_min') || get('min_rolling_3y') || null;
  if (rollMin != null) {
    const minPts = rollMin >= 12 ? 3
                 : rollMin >= 6  ? 2
                 : rollMin >= 0  ? 1 : 0;
    score += minPts;
    hits[`Rolling 3Y floor: ${rollMin.toFixed(1)}% min ${rollMin>=0?'(never negative on 3Y roll — consistency)':'(went negative)'}`] = minPts;
    if (rollMin < -3) { score -= 1; hits[`⚠ Rolling 3Y went deeply negative (${rollMin.toFixed(1)}%) in at least one period`] = -1; }
  }

  // -- PILLAR L: TRACKING ERROR + CLOSET INDEXER DETECTION (4 pts) ----------------
  // Varsity Ch16/Ch29: "For index funds, tracking error IS the metric. For active funds,
  // high alpha + high tracking error = active management; low alpha + low tracking error = closet indexer"
  const te = get('tracking_error');
  if (te != null && te > 0) {
    // Active fund with high expense but acting like index fund = closet indexer
    const isActive = exp && exp > 0.5; // expense >0.5% = active fund
    const alpha3y = vc3 ? vc3 - 1.0 : null; // vs_cat_3y >1 = positive alpha
    if (isActive && alpha3y != null) {
      if (te < 3 && alpha3y < 0.05) {
        // Low TE + near-zero alpha = closet indexer paying active fees
        score -= 3;
        hits[`⚠ Closet indexer: TE ${te.toFixed(1)}% + alpha ${(alpha3y*100).toFixed(1)}% — paying active fees for index returns`] = -3;
      } else if (te > 4 && alpha3y > 0.1) {
        // High TE + positive alpha = genuine active management (reward)
        score += 3;
        hits[`Active manager: TE ${te.toFixed(1)}% + alpha ${(alpha3y*100).toFixed(1)}% — genuine stock-picking skill`] = 3;
      } else if (te > 3 && alpha3y > 0) {
        score += 1;
        hits[`Active management: TE ${te.toFixed(1)}% with positive alpha`] = 1;
      }
    }
    // For all funds: penalize very high tracking error (>8%) = erratic management
    if (te > 8) { score -= 2; hits[`⚠ Erratic: TE ${te.toFixed(1)}% — very high deviation from benchmark`] = -2; }
  }

  // -- DRAWDOWN RECOVERY CHECK (Varsity Ch11 Ch14: "fund that falls 50% needs 100% to recover") --
  // If max drawdown is deep AND fund is still far from ATH, recovery ability is poor
  if (mdd != null && ath != null) {
    const deepDraw = mdd < -30; // fell >30%
    const stillFar = ath < -15; // still >15% below ATH
    if (deepDraw && stillFar) {
      score -= 2;
      hits[`⚠ Poor recovery: fell ${mdd.toFixed(0)}%, still ${ath.toFixed(0)}% below ATH`] = -2;
    } else if (mdd < -25 && ath > -5) {
      // Deep drawdown BUT recovered near ATH = resilient
      score += 2;
      hits[`Resilient: fell ${Math.abs(mdd).toFixed(0)}% but recovered to ${ath.toFixed(0)}% from ATH`] = 2;
    }
  }

  // -- 1Y RETURNS MOMENTUM CHECK (Varsity Ch18: recent momentum matters for entry timing) --
  const r1y = get('ret_1y');
  if (r1y != null) {
    // Severe recent underperformance vs category = something may have changed
    if (vc1 != null && vc1 < 0.8 && r1y < 0) {
      score -= 2;
      hits[`⚠ Recent trouble: 1Y return ${r1y.toFixed(1)}%, ${((1-vc1)*100).toFixed(0)}% below category median`] = -2;
    }
    // Strong recent momentum after long-term consistency = entry signal
    if (vc1 != null && vc1 > 1.15 && vc3 != null && vc3 > 1.05) {
      score += 1;
      hits[`Momentum: 1Y ${r1y.toFixed(1)}% outperforming category + 3Y consistent`] = 1;
    }
  }

  // -- STYLE DRIFT PENALTIES (Varsity sector analysis) --------------------------
  // Varsity: "A fund's mandate defines its risk profile. Drift = hidden risk investors didn't sign up for"
  if (subcat.includes('Small')) {
    // Small cap fund should be ≥65% small cap — less = it's not really a small cap fund
    const scPct = get('pct_smallcap') || 0;
    if (scPct > 0 && scPct < 50) { score-=2; hits[`Style drift: only ${scPct.toFixed(1)}% small cap in small cap fund — mandate breach`]=-2; }
  }
  if (subcat.includes('Mid')) {
    const smallCapPct = get('pct_smallcap') || 0;
    if      (smallCapPct > 27) { score-=2; hits[`Style drift: ${smallCapPct.toFixed(1)}% small cap in mid cap fund — mandate breach`]=-2; }
    else if (smallCapPct > 20) { score-=1; hits[`Style drift: ${smallCapPct.toFixed(1)}% small cap in mid cap (elevated risk)`]=-1; }
  }
  if (subcat.includes('Large')) {
    const scPct2 = get('pct_smallcap') || 0;
    const mcPct2 = get('pct_midcap')   || 0;
    if      (scPct2 > 15)          { score-=2; hits[`Style drift: ${scPct2.toFixed(1)}% small cap in large cap fund — mandate breach`]=-2; }
    else if (scPct2 > 8||mcPct2>40){ score-=1; hits[`Style drift: elevated mid/small in large cap fund`]=-1; }
  }
  if (subcat.includes('Flexi')) {
    // Flexi cap concentrated >70% in one segment = effectively not flexi
    const lc = get('pct_largecap') || 0;
    const mc = get('pct_midcap')   || 0;
    const sc = get('pct_smallcap') || 0;
    const maxSeg = Math.max(lc, mc, sc);
    if (maxSeg > 72) { score-=1; hits[`Flexi cap concentrated: ${maxSeg.toFixed(0)}% in one segment — not truly diversified`]=-1; }
  }

  // -- PILLAR H: AUM + TRACK RECORD (12 pts) ------------------------------------
  // Varsity: "A 10Y fund survived: demonetisation, IL&FS, COVID, 2022 selloff, 2024-25 correction"
  // AUM: too small = liquidity risk; too large (for small cap) = performance drag

  // Track record (max 9 pts)
  if      (months >= 156) { score+=9; hits[`Track record: ${Math.round(months/12)}Y (13Y+ — 5 stress events survived)`]=9; }
  else if (months >= 120) { score+=7; hits[`Track record: ${Math.round(months/12)}Y (10Y+ — full bull-bear cycle)`]=7; }
  else if (months >= 84)  { score+=4; hits[`Track record: ${Math.round(months/12)}Y (7Y+ — two corrections)`]=4; }
  else if (months >= 60)  { score+=2; hits[`Track record: ${Math.round(months/12)}Y (5Y minimum)`]=2; }

  // AUM quality (max 3 pts within this pillar — was 5 pts standalone)
  const aum = get('aum_cr') || 0;
  if(aum >= aumMin && aum <= aumMax)       { score+=3; hits[`AUM: ₹${Math.round(aum).toLocaleString('en-IN')} Cr (sweet spot)`]=3; }
  else if(aum > aumMax){
    const p = subcat.includes('Small') ? 1 : 3;
    score+=p; hits[`AUM: ₹${Math.round(aum).toLocaleString('en-IN')} Cr ${subcat.includes('Small')?'(too large for small cap)':'(large established fund)'}`]=p;
  } else if(aum >= aumMin*0.5){ score+=2; hits[`AUM: ₹${Math.round(aum).toLocaleString('en-IN')} Cr (growing)`]=2; }
  else if(aum > 0)             { score+=1; hits[`AUM: ₹${Math.round(aum).toLocaleString('en-IN')} Cr (small fund)`]=1; }

  // -- PILLAR I: AMC QUALITY (10 pts) -------------------------------------------
  // Varsity: "Governance and SEBI record = Morningstar Stewardship Pillar"
  // Bad governance = Franklin saga (investors locked out for 2 years)
  const qual = getAmcQual(f.amc || '');
  const amcPts = Math.round(qual.score / 10 * 10 * 10) / 10;
  score += amcPts;
  hits[`AMC ${qual.key||'?'}: ${qual.score}/10 (governance & stewardship)`] = amcPts;
  if(qual.warning) hits[`Flagged: ${qual.warning}`] = 0;

  // SEBI penalties — non-negotiable (Varsity: "Drop the fund if SEBI probe ongoing")
  if(qual.sebi==='probe')  { score=Math.min(score,15); hits['DISQUALIFIED: Active SEBI investigation (capped at 15)']=0; }
  else if(qual.sebi==='action'){ score=Math.round(score*0.85*10)/10; hits['Past SEBI enforcement action: -15% score penalty']=0; }
  else if(qual.sebi==='minor') { score=Math.round(score*0.95*10)/10; hits['Minor SEBI fine on record: -5% score penalty']=0; }

  // -- POST-SCORING CREDIBILITY RULES -------------------------------------------
  // Varsity: "A young fund with good recent numbers = luck, not skill"
  // Small + young funds cannot beat established funds regardless of recent numbers
  const fundAum = parseFloat(f.aum_cr||f.aum)||0;
  if(fundAum < 5000 && months < 84 && score > 70){
    score=70; hits['📌 Credibility cap: AUM<₹5K Cr + age<7Y → capped at 70']=0;
  }
  const has5Y = parseFloat(f.cagr_5y) > 0;
  if(!has5Y && months < 84 && score > 75){
    score=Math.min(score,75); hits['📌 No 5Y data + age<7Y → capped at 75']=0;
  }
  if(qual.score<=5 && fundAum<5000 && score>72){
    score=72; hits[`📌 Low AMC credibility (${qual.score}/10) + small AUM → capped at 72`]=0;
  }

  const isWatchlist = fundAum > 0 && fundAum < 5000;
  const dniFlag = DO_NOT_INVEST[f.name] || null;

  return {
    score: Math.round(score * 10) / 10,
    hits, cat,
    amc_sebi:    qual.sebi,
    amc_warning: qual.warning,
    amc_note:    qual.note || null,
    dni:         dniFlag,
    watchlist:   isWatchlist,
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
    // Serve from pre-scored in-memory cache (built on startup — instant, fully scored)
    if (mfScoreCache && mfScoreCache.length > 0) {
      const eligible_count   = mfScoreCache.filter(f=>f.eligible).length;
      const ineligible_count = mfScoreCache.filter(f=>!f.eligible).length;
      return res.json({
        funds: mfScoreCache,
        total: mfScoreCache.length,
        eligible_count, not_eligible_count: ineligible_count,
        source: 'Tickertape CSV - Apr 4 2026',
        filters: 'AUM >=₹1,000 Cr · Age >=5Y · 3Y rolling data · Expense <2%',
        cached_at: mfScoreCachedAt,
      });
    }

    // Cache not ready — build it now (blocks until done, first request only)
    await buildMFCache();

    if (mfScoreCache && mfScoreCache.length > 0) {
      const eligible_count   = mfScoreCache.filter(f=>f.eligible).length;
      const ineligible_count = mfScoreCache.filter(f=>!f.eligible).length;
      return res.json({
        funds: mfScoreCache,
        total: mfScoreCache.length,
        eligible_count, not_eligible_count: ineligible_count,
        source: 'Tickertape CSV - Apr 4 2026',
        filters: 'AUM >=₹1,000 Cr · Age >=5Y · 3Y rolling data · Expense <2%',
        cached_at: mfScoreCachedAt,
      });
    }

    throw new Error('No MF data in cache or DB');


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

// -- MF scored cache (pre-computed so tab loads in <1s) -----------------------
let mfScoreCache = null;
let mfScoreCachedAt = null;

async function buildMFCache() {
  try {
    const {rows} = await pool.query("SELECT * FROM mf_tickertape ORDER BY sub_category, name");
    if (!rows.length) { console.log('buildMFCache: no rows in mf_tickertape'); return; }

    const pf = (v) => v!=null ? parseFloat(v) : null;
    const funds = rows.map(f => ({
      name:f.name, sub_category:f.sub_category, amc:f.amc,
      benchmark:f.benchmark, fund_manager:f.fund_manager,
      sip_allowed:f.sip_allowed, sebi_risk:f.sebi_risk,
      nav:pf(f.nav), navFormatted:f.nav?'₹'+parseFloat(f.nav).toFixed(2):null,
      aum_cr:pf(f.aum), aum:pf(f.aum),
      expense_ratio:pf(f.expense_ratio), min_lumpsum:pf(f.min_lumpsum),
      min_sip:pf(f.min_sip), exit_load:pf(f.exit_load),
      months_inception:pf(f.months_inception),
      ret_1y:pf(f.ret_1y), ret_3m:pf(f.ret_3m), ret_6m:pf(f.ret_6m),
      cagr_3y:pf(f.cagr_3y), cagr_5y:pf(f.cagr_5y), cagr_10y:pf(f.cagr_10y),
      rolling_3y:pf(f.rolling_3y),
      vs_cat_1y:pf(f.vs_cat_1y), vs_cat_3y:pf(f.vs_cat_3y),
      vs_cat_5y:pf(f.vs_cat_5y), vs_cat_10y:pf(f.vs_cat_10y),
      sharpe:pf(f.sharpe), sortino:pf(f.sortino),
      volatility:pf(f.volatility), stdDev:pf(f.volatility),
      category_stddev:pf(f.category_stddev),
      max_drawdown:pf(f.max_drawdown), maxDD:pf(f.max_drawdown),
      pct_from_ath:pf(f.pct_from_ath), tracking_error:pf(f.tracking_error),
      pe_ratio:pf(f.pe_ratio), category_pe:pf(f.category_pe),
      pct_equity:pf(f.pct_equity), pct_largecap:pf(f.pct_largecap),
      pct_midcap:pf(f.pct_midcap), pct_smallcap:pf(f.pct_smallcap),
      pct_cash:pf(f.pct_cash), pct_debt:pf(f.pct_debt),
      top3_conc:pf(f.top3_conc), top5_conc:pf(f.top5_conc), top10_conc:pf(f.top10_conc),
      dataSource:'Tickertape - Apr 4 2026',
    }));

    // Run the FULL scoring pipeline (same as /api/mf/funds)
    const eligible   = funds.filter(f => checkEligible(f).eligible);
    const ineligible = funds.filter(f => !checkEligible(f).eligible);

    // Build per-subcategory distributions from eligible funds only
    CAT_DIST = {};
    const distCols = {
      rolling_3y:   f => f.rolling_3y  && f.rolling_3y  > 0 ? f.rolling_3y  : null,
      sharpe:       f => f.sharpe  != null ? f.sharpe  : null,
      sortino:      f => f.sortino != null ? f.sortino : null,
      volatility:   f => f.volatility   && f.volatility   > 0 ? f.volatility   : null,
      max_drawdown: f => f.max_drawdown && f.max_drawdown > 0 ? f.max_drawdown : null,
      cagr_3y:      f => f.cagr_3y  && f.cagr_3y  > 0 ? f.cagr_3y  : null,
      cagr_5y:      f => f.cagr_5y  && f.cagr_5y  > 0 ? f.cagr_5y  : null,
      cagr_10y:     f => f.cagr_10y && f.cagr_10y > 0 ? f.cagr_10y : null,
      vs_cat_3y:    f => f.vs_cat_3y  && f.vs_cat_3y  > 0 ? f.vs_cat_3y  : null,
      vs_cat_5y:    f => f.vs_cat_5y  && f.vs_cat_5y  > 0 ? f.vs_cat_5y  : null,
      vs_cat_10y:   f => f.vs_cat_10y && f.vs_cat_10y > 0 ? f.vs_cat_10y : null,
      expense:      f => f.expense_ratio && f.expense_ratio > 0 ? f.expense_ratio : null,
      pe:           f => f.pe_ratio && f.pe_ratio > 0 ? f.pe_ratio : null,
      top10:        f => f.top10_conc && f.top10_conc > 0 ? f.top10_conc : null,
      pct_from_ath: f => f.pct_from_ath != null ? f.pct_from_ath : null,
    };
    eligible.forEach(f => {
      const subcat = f.sub_category;
      if (!CAT_DIST[subcat]) CAT_DIST[subcat] = Object.fromEntries(Object.keys(distCols).map(k=>[k,[]]));
      Object.entries(distCols).forEach(([col, fn]) => { const v=fn(f); if(v!=null) CAT_DIST[subcat][col].push(v); });
    });

    // Score eligible funds
    const scoredEligible = eligible.map(f => {
      const {score,hits,cat,amc_sebi,amc_warning,amc_note,dni,watchlist} = scoreMFTickertape(f);
      return {...f, score, hits, cat, amc_sebi, amc_warning, amc_note, dni, watchlist, eligible:true, filter_reasons:[]};
    });

    // Mark ineligible (no score, but keep for display)
    const scoredIneligible = ineligible.map(f => {
      const subcat = f.sub_category || '';
      const cat = subcat.includes('Small')?'smallcap':subcat.includes('Mid')?'midcap':'flexicap';
      const {reasons} = checkEligible(f);
      const qual = getAmcQual(f.amc||'');
      return {...f, score:null, hits:{}, cat, amc_sebi:qual.sebi, amc_warning:qual.warning,
        amc_note:null, eligible:false, filter_reasons:reasons};
    });

    // Sort: sub_category → eligible before ineligible → DNI level → score desc
    const allFunds = [...scoredEligible, ...scoredIneligible];
    allFunds.sort((a,b)=>{
      if(a.sub_category!==b.sub_category) return (a.sub_category||'').localeCompare(b.sub_category||'');
      if(a.eligible && !b.eligible) return -1;
      if(!a.eligible && b.eligible) return 1;
      const dniRank = f=>!f.dni?0:f.dni.level==='red'?2:1;
      if(dniRank(a)!==dniRank(b)) return dniRank(a)-dniRank(b);
      return (b.score||0)-(a.score||0);
    });

    mfScoreCache = allFunds;
    mfScoreCachedAt = Date.now();
    console.log(`MF cache built: ${allFunds.length} funds (${scoredEligible.length} eligible, ${scoredIneligible.length} ineligible)`);
  } catch(e) { console.log('buildMFCache error:', e.message); }
}
// Build MF cache immediately on startup and every 6h
buildMFCache();
cron.schedule('0 */6 * * *', buildMFCache);



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
  universe:{ total:UNIVERSE.length, nifty50:UNIVERSE.filter(s=>s.grp==='NIFTY50').length,
    next50:UNIVERSE.filter(s=>s.grp==='NEXT50').length, midcap:UNIVERSE.filter(s=>s.grp==='MIDCAP').length,
    lastUpdate:universeUpdateStatus },
}));

// Universe status endpoint
// =============================================================================
// SCREENER.IN FUNDAMENTALS IMPORT
// CSV columns: Name,BSE Code,NSE Code,ISIN Code,Industry Group,Industry,
//   Current Price,Price to Earning,Market Capitalization,Dividend yield,
//   Net Profit latest quarter,YOY Quarterly profit growth,Sales latest quarter,
//   YOY Quarterly sales growth,Return on capital employed,Return over 6months,
//   Return over 3months,PEG Ratio,Interest Coverage Ratio,Current ratio,
//   Enterprise Value,EVEBITDA,Price to Free Cash Flow,Price to Sales,
//   Profit growth,Sales growth,Industry PE,Pledged percentage,Earnings yield,
//   Change in promoter holding,Promoter holding,Debt,EPS,Return on equity,
//   Debt to equity,Return on assets,Price to book value,Profit after tax latest quarter,
//   Profit after tax,OPM,Sales,Sales growth 3Years,Sales growth 5Years,
//   Profit growth 3Years,Profit growth 5Years,Average return on equity 5Years,
//   Average return on equity 3Years,Return over 1year,Return over 3years,Return over 5years
// =============================================================================

function parseCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
}

function parseNum(v) {
  if (v === null || v === undefined || v === '' || v === 'N/A') return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

async function importScreenerCSV(csvText) {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV too short');

  // Parse header
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const col = (name) => headers.indexOf(name.toLowerCase());

  // Column indices
  const C = {
    name:          col('name'),
    nse:           col('nse code'),
    bse:           col('bse code'),
    industry:      col('industry'),
    indGroup:      col('industry group'),
    price:         col('current price'),
    pe:            col('price to earning'),
    mktCap:        col('market capitalization'),
    divYield:      col('dividend yield'),
    patQtr:        col('net profit latest quarter'),
    patQtrYoy:     col('yoy quarterly profit growth'),
    salesQtr:      col('sales latest quarter'),
    salesQtrYoy:   col('yoy quarterly sales growth'),
    peg:           col('peg ratio'),
    intCov:        col('interest coverage ratio'),
    currentRatio:  col('current ratio'),
    evEbitda:      col('evebitda'),
    salesGr1y:     col('sales growth'),
    epsGr1y:       col('profit growth'),
    indPE:         col('industry pe'),
    pledged:       col('pledged percentage'),
    promoterChg:   col('change in promoter holding'),
    promoter:      col('promoter holding'),
    debt:          col('debt'),
    eps:           col('eps'),
    roe:           col('return on equity'),
    de:            col('debt to equity'),
    roa:           col('return on assets'),
    pb:            col('price to book value'),
    patAnnual:     col('profit after tax'),
    patLatest:     col('profit after tax latest quarter'),
    opm:           col('opm'),
    sales:         col('sales'),
    salesGr3y:     col('sales growth 3years'),
    salesGr5y:     col('sales growth 5years'),
    epsGr3y:       col('profit growth 3years'),
    epsGr5y:       col('profit growth 5years'),
    roe5yAvg:      col('average return on equity 5years'),
    roe3yAvg:      col('average return on equity 3years'),
    ret1y:         col('return over 1year'),
    ret3y:         col('return over 3years'),
    ret5y:         col('return over 5years'),
    ret6m:         col('return over 6months'),
    ret3m:         col('return over 3months'),
  };

  let imported = 0, skipped = 0;
  const get = (row, idx) => idx >= 0 ? parseNum(row[idx]) : null;
  const str = (row, idx) => idx >= 0 ? (row[idx]||'').replace(/"/g,'').trim() : '';

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < 5) continue;

    const sym = str(row, C.nse) || str(row, C.bse);
    if (!sym) { skipped++; continue; }

    const data = {
      sym,
      name:             str(row, C.name),
      nse_code:         str(row, C.nse),
      bse_code:         str(row, C.bse),
      industry:         str(row, C.industry),
      industry_group:   str(row, C.indGroup),
      roe:              get(row, C.roe),
      de:               get(row, C.de),
      pe:               get(row, C.pe),
      rev_gr_3y:        get(row, C.salesGr3y),
      eps_gr_3y:        get(row, C.epsGr3y),
      opm:              get(row, C.opm),
      roa:              get(row, C.roa),
      pb:               get(row, C.pb),
      peg:              get(row, C.peg),
      int_cov:          get(row, C.intCov),
      promoter_holding: get(row, C.promoter),
      pledged_pct:      get(row, C.pledged),
      promoter_chg:     get(row, C.promoterChg),
      mkt_cap:          get(row, C.mktCap),
      current_price:    get(row, C.price),
      eps:              get(row, C.eps),
      debt:             get(row, C.debt),
      current_ratio:    get(row, C.currentRatio),
      div_yield:        get(row, C.divYield),
      sales_gr_1y:      get(row, C.salesGr1y),
      sales_gr_5y:      get(row, C.salesGr5y),
      eps_gr_1y:        get(row, C.epsGr1y),
      eps_gr_5y:        get(row, C.epsGr5y),
      roe_3y_avg:       get(row, C.roe3yAvg),
      roe_5y_avg:       get(row, C.roe5yAvg),
      ret_1y:           get(row, C.ret1y),
      ret_3y:           get(row, C.ret3y),
      ret_5y:           get(row, C.ret5y),
      ret_6m:           get(row, C.ret6m),
      ret_3m:           get(row, C.ret3m),
      ev_ebitda:        get(row, C.evEbitda),
      industry_pe:      get(row, C.indPE),
      pat_qtr:          get(row, C.patQtr),
      sales_qtr:        get(row, C.salesQtr),
      pat_annual:       get(row, C.patAnnual),
      sales_annual:     get(row, C.sales),
      pat_qtr_yoy:      get(row, C.patQtrYoy),
      sales_qtr_yoy:    get(row, C.salesQtrYoy),
    };

    try {
      await pool.query(`
        INSERT INTO screener_fundamentals
          (sym,name,nse_code,bse_code,industry,industry_group,
           roe,de,pe,rev_gr_3y,eps_gr_3y,opm,roa,pb,peg,int_cov,
           promoter_holding,pledged_pct,promoter_chg,mkt_cap,current_price,
           eps,debt,current_ratio,div_yield,sales_gr_1y,sales_gr_5y,
           eps_gr_1y,eps_gr_5y,roe_3y_avg,roe_5y_avg,ret_1y,ret_3y,ret_5y,
           ret_6m,ret_3m,ev_ebitda,industry_pe,pat_qtr,sales_qtr,
           pat_annual,sales_annual,pat_qtr_yoy,sales_qtr_yoy,imported_at)
        VALUES
          ($1,$2,$3,$4,$5,$6,
           $7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
           $17,$18,$19,$20,$21,
           $22,$23,$24,$25,$26,$27,
           $28,$29,$30,$31,$32,$33,$34,
           $35,$36,$37,$38,$39,$40,
           $41,$42,$43,$44,NOW())
        ON CONFLICT (sym) DO UPDATE SET
          name=EXCLUDED.name, industry=EXCLUDED.industry,
          roe=EXCLUDED.roe, de=EXCLUDED.de, pe=EXCLUDED.pe,
          rev_gr_3y=EXCLUDED.rev_gr_3y, eps_gr_3y=EXCLUDED.eps_gr_3y, opm=EXCLUDED.opm,
          roa=EXCLUDED.roa, pb=EXCLUDED.pb, peg=EXCLUDED.peg, int_cov=EXCLUDED.int_cov,
          promoter_holding=EXCLUDED.promoter_holding, pledged_pct=EXCLUDED.pledged_pct,
          promoter_chg=EXCLUDED.promoter_chg, mkt_cap=EXCLUDED.mkt_cap,
          current_price=EXCLUDED.current_price, eps=EXCLUDED.eps, debt=EXCLUDED.debt,
          current_ratio=EXCLUDED.current_ratio, div_yield=EXCLUDED.div_yield,
          sales_gr_1y=EXCLUDED.sales_gr_1y, sales_gr_5y=EXCLUDED.sales_gr_5y,
          eps_gr_1y=EXCLUDED.eps_gr_1y, eps_gr_5y=EXCLUDED.eps_gr_5y,
          roe_3y_avg=EXCLUDED.roe_3y_avg, roe_5y_avg=EXCLUDED.roe_5y_avg,
          ret_1y=EXCLUDED.ret_1y, ret_3y=EXCLUDED.ret_3y, ret_5y=EXCLUDED.ret_5y,
          ret_6m=EXCLUDED.ret_6m, ret_3m=EXCLUDED.ret_3m,
          ev_ebitda=EXCLUDED.ev_ebitda, industry_pe=EXCLUDED.industry_pe,
          pat_qtr=EXCLUDED.pat_qtr, sales_qtr=EXCLUDED.sales_qtr,
          pat_annual=EXCLUDED.pat_annual, sales_annual=EXCLUDED.sales_annual,
          pat_qtr_yoy=EXCLUDED.pat_qtr_yoy, sales_qtr_yoy=EXCLUDED.sales_qtr_yoy,
          imported_at=NOW()
      `, [
        data.sym, data.name, data.nse_code, data.bse_code, data.industry, data.industry_group,
        data.roe, data.de, data.pe, data.rev_gr_3y, data.eps_gr_3y, data.opm,
        data.roa, data.pb, data.peg, data.int_cov,
        data.promoter_holding, data.pledged_pct, data.promoter_chg, data.mkt_cap, data.current_price,
        data.eps, data.debt, data.current_ratio, data.div_yield, data.sales_gr_1y, data.sales_gr_5y,
        data.eps_gr_1y, data.eps_gr_5y, data.roe_3y_avg, data.roe_5y_avg,
        data.ret_1y, data.ret_3y, data.ret_5y, data.ret_6m, data.ret_3m,
        data.ev_ebitda, data.industry_pe, data.pat_qtr, data.sales_qtr,
        data.pat_annual, data.sales_annual, data.pat_qtr_yoy, data.sales_qtr_yoy,
      ]);

      // Immediately patch into live FUND + FUND_EXT memory
      patchScreenerIntoFUND(sym, data);
      imported++;
    } catch(e) {
      console.log(`Screener import error ${sym}:`, e.message);
      skipped++;
    }
  }

  console.log(`✅ Screener import: ${imported} stocks imported, ${skipped} skipped`);
  return { imported, skipped, total: lines.length - 1 };
}

// Patch one stock from screener data into FUND + FUND_EXT memory (live update)
// Helper: safely convert DB values (may be strings from PG numeric) to JS numbers
const _num = v => v == null ? null : (typeof v === 'number' ? v : (isNaN(+v) ? null : +v));
function patchScreenerIntoFUND(sym, d) {
  if (!global.FUND_EXT) global.FUND_EXT = {};
  // Ensure all numeric fields are actual JS numbers (PG numeric returns strings)
  for (const k of Object.keys(d)) {
    if (k === 'sym' || k === 'name' || k === 'nse_code' || k === 'bse_code' || k === 'industry' || k === 'industry_group' || k === 'imported_at') continue;
    if (d[k] != null) d[k] = _num(d[k]);
  }

  // Update FUND core array — [ROE, D/E, PE, RevGr, EpsGr, OpMargin]
  // Use screener as primary source (real data), override hardcoded stale values
  FUND[sym] = [
    d.roe     ?? FUND[sym]?.[0] ?? null,
    d.de      ?? FUND[sym]?.[1] ?? null,
    d.pe      ?? FUND[sym]?.[2] ?? null,
    d.rev_gr_3y ?? FUND[sym]?.[3] ?? null,
    d.eps_gr_3y ?? FUND[sym]?.[4] ?? null,
    d.opm     ?? FUND[sym]?.[5] ?? null,
  ];

  // Update FUND_EXT with all extended fields
  global.FUND_EXT[sym] = {
    ...(global.FUND_EXT[sym] || {}),
    roe:          d.roe,
    de:           d.de,
    pe:           d.pe,
    revGr:        d.rev_gr_3y,
    epsGr:        d.eps_gr_3y,
    opMgn:        d.opm,
    roa:          d.roa,
    pb:           d.pb,
    peg:          d.peg,
    intCov:       d.int_cov,
    promoter:     d.promoter_holding,
    pledged:      d.pledged_pct,
    promoterChg:  d.promoter_chg,
    mktCap:       d.mkt_cap,
    price:        d.current_price,
    eps:          d.eps,
    debt:         d.debt,
    currentRatio: d.current_ratio,
    divYield:     d.div_yield,
    salesGr1y:    d.sales_gr_1y,
    salesGr5y:    d.sales_gr_5y,
    epsGr1y:      d.eps_gr_1y,
    epsGr5y:      d.eps_gr_5y,
    roe3yAvg:     d.roe_3y_avg,
    roe5yAvg:     d.roe_5y_avg,
    ret1y:        d.ret_1y,
    ret3y:        d.ret_3y,
    ret5y:        d.ret_5y,
    ret6m:        d.ret_6m,
    ret3m:        d.ret_3m,
    evEbitda:     d.ev_ebitda,
    industryPE:   d.industry_pe,
    patQtr:       d.pat_qtr,
    salesQtr:     d.sales_qtr,
    patAnnual:    d.pat_annual,
    salesAnnual:  d.sales_annual,
    patQtrYoy:    d.pat_qtr_yoy,
    salesQtrYoy:  d.sales_qtr_yoy,
    industry:     d.industry,
    // Bonus fields (ROCE, earnings yield, price/FCF, price/sales)
    roce:         d.roce        ?? null,
    earningsYield:d.earnings_yield ?? null,
    priceToFCF:   d.price_to_fcf ?? null,
    priceToSales: d.price_to_sales ?? null,
    // Shareholding extras
    fiiHolding:   d.fii_holding ?? null,
    diiHolding:   d.dii_holding ?? null,
    numShareholders: d.num_shareholders ?? null,
    source:       'Screener.in',
    fetchedAt:    Date.now(),
  };
}

// Load screener data from DB into memory on startup
async function loadScreenerFundamentals() {
  try {
    const { rows } = await pool.query('SELECT * FROM screener_fundamentals');
    if (!rows.length) return 0;
    rows.forEach(row => patchScreenerIntoFUND(row.sym, {
      roe: row.roe, de: row.de, pe: row.pe,
      rev_gr_3y: row.rev_gr_3y, eps_gr_3y: row.eps_gr_3y, opm: row.opm,
      roa: row.roa, pb: row.pb, peg: row.peg, int_cov: row.int_cov,
      promoter_holding: row.promoter_holding, pledged_pct: row.pledged_pct,
      promoter_chg: row.promoter_chg, mkt_cap: row.mkt_cap,
      current_price: row.current_price, eps: row.eps, debt: row.debt,
      current_ratio: row.current_ratio, div_yield: row.div_yield,
      sales_gr_1y: row.sales_gr_1y, sales_gr_5y: row.sales_gr_5y,
      eps_gr_1y: row.eps_gr_1y, eps_gr_5y: row.eps_gr_5y,
      roe_3y_avg: row.roe_3y_avg, roe_5y_avg: row.roe_5y_avg,
      ret_1y: row.ret_1y, ret_3y: row.ret_3y, ret_5y: row.ret_5y,
      ret_6m: row.ret_6m, ret_3m: row.ret_3m,
      ev_ebitda: row.ev_ebitda, industry_pe: row.industry_pe,
      pat_qtr: row.pat_qtr, sales_qtr: row.sales_qtr,
      pat_annual: row.pat_annual, sales_annual: row.sales_annual,
      pat_qtr_yoy: row.pat_qtr_yoy, sales_qtr_yoy: row.sales_qtr_yoy,
      industry: row.industry,
      roce: row.roce, earnings_yield: row.earnings_yield,
      price_to_fcf: row.price_to_fcf, price_to_sales: row.price_to_sales,
      fii_holding: row.fii_holding, dii_holding: row.dii_holding,
      num_shareholders: row.num_shareholders,
    }));
    console.log(`📊 Loaded ${rows.length} stocks from screener_fundamentals table`);
    return rows.length;
  } catch(e) {
    // Table may not exist yet on first boot — that's fine
    if (!e.message.includes('does not exist')) console.log('Screener load error:', e.message);
    return 0;
  }
}

// POST /api/fundamentals/import — accepts raw CSV text in body
// Usage: curl -X POST https://your-app.railway.app/api/fundamentals/import \
//   -H "Content-Type: text/plain" --data-binary @screener_export.csv
app.post('/api/fundamentals/import', async (req, res) => {
  try {
    let csv = '';
    // Accept text/plain or application/json {csv: "..."}
    if (typeof req.body === 'string') {
      csv = req.body;
    } else if (req.body?.csv) {
      csv = req.body.csv;
    } else {
      return res.status(400).json({ error: 'Send CSV as text/plain body or JSON {csv: "..."}' });
    }
    if (!csv || csv.length < 100) return res.status(400).json({ error: 'CSV too short or empty' });

    const result = await importScreenerCSV(csv);

    // Re-score all stocks with new fundamental data
    console.log('📊 Screener import done — re-scoring all stocks...');
    refreshAllFundamentals(); // background, non-blocking

    res.json({
      success: true,
      imported: result.imported,
      skipped:  result.skipped,
      total:    result.total,
      message:  `${result.imported} stocks imported. Re-scoring started in background.`,
    });
  } catch(e) {
    console.error('Screener import error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/fundamentals/screener-status — how many stocks have screener data
app.get('/api/fundamentals/screener-status', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT COUNT(*) as total,
             MAX(imported_at) as last_import,
             COUNT(CASE WHEN roe IS NOT NULL THEN 1 END) as has_roe,
             COUNT(CASE WHEN pe  IS NOT NULL THEN 1 END) as has_pe,
             COUNT(CASE WHEN promoter_holding IS NOT NULL THEN 1 END) as has_promoter
      FROM screener_fundamentals
    `);
    const r = rows[0];
    res.json({
      total:        parseInt(r.total),
      last_import:  r.last_import,
      has_roe:      parseInt(r.has_roe),
      has_pe:       parseInt(r.has_pe),
      has_promoter: parseInt(r.has_promoter),
      in_memory:    Object.keys(global.FUND_EXT || {}).filter(s => global.FUND_EXT[s]?.source === 'Screener.in').length,
    });
  } catch(e) {
    res.json({ total: 0, error: e.message });
  }
});

// Lightweight list of all stocks for analyzer dropdown
app.get("/api/universe/list", (req,res)=>{
  const scored = Object.values(stockFundamentals);
  // Merge UNIVERSE (has all 337) with scored data (has scores + sector)
  const scoredMap = {};
  scored.forEach(s => { scoredMap[s.sym] = s; });
  const list = UNIVERSE.map(s => {
    const sc = scoredMap[s.sym];
    return {
      sym:    s.sym,
      name:   s.n || sc?.name || s.sym,
      grp:    s.grp,
      sector: sc?.sector || '',
      score:  sc?.score  || 0,
    };
  }).sort((a,b) => b.score - a.score);
  res.json({ stocks: list, total: list.length });
});

app.get("/api/universe/status", async(req,res)=>{
  const n50  = UNIVERSE.filter(s=>s.grp==='NIFTY50');
  const nx50 = UNIVERSE.filter(s=>s.grp==='NEXT50');
  const mc   = UNIVERSE.filter(s=>s.grp==='MIDCAP');
  const sc   = UNIVERSE.filter(s=>s.grp==='SMALLCAP');
  const missingFund = await dbGet('universe_missing_fund').catch(()=>null);
  res.json({
    total:UNIVERSE.length,
    nifty50: {count:n50.length,  stocks:n50.map(s=>s.sym)},
    next50:  {count:nx50.length, stocks:nx50.map(s=>s.sym)},
    midcap:  {count:mc.length,   stocks:mc.map(s=>s.sym)},
    smallcap:{count:sc.length,   stocks:sc.map(s=>s.sym)},
    lastUpdate:universeLastUpdate?new Date(universeLastUpdate).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}):null,
    status:universeUpdateStatus,
    missingFundData: missingFund ? JSON.parse(missingFund) : [],
    source:'NSE official index CSV files (auto-updated daily 8AM IST)',
  });
});

// Force refresh universe (admin endpoint)
app.post("/api/universe/refresh", async(req,res)=>{
  res.json({message:'Universe refresh started...'});
  const ok = await refreshUniverseFromNSE();
  if(ok) setTimeout(()=>{ refreshMissingFundamentals(); }, 3000);
  console.log(`Manual universe refresh: ${ok?'success':'failed'}`);
});

// Force refresh missing fundamentals
app.post("/api/fundamentals/refresh", async(req,res)=>{
  const forceAll = req.query.all === 'true';
  const missing = forceAll
    ? UNIVERSE.filter(s=>!s.sym.includes('USDT')).map(s=>s.sym)
    : UNIVERSE.map(s=>s.sym).filter(s=>!FUND[s]&&s!=='M&M'&&!s.includes('USDT'));
  res.json({message:`Scraping real fundamentals for ${missing.length} stocks (Yahoo Finance + NSE)...`, total:missing.length, sample:missing.slice(0,10)});
  refreshMissingFundamentals(forceAll);
});

// Fund status endpoint
app.get("/api/fundamentals/status", (req,res)=>{
  const universe = UNIVERSE.filter(s=>!s.sym.includes('USDT'));
  const total    = universe.length;
  const withData = universe.filter(s=>FUND[s.sym]||s.sym==='M&M').length;
  const realData = universe.filter(s=>global.FUND_EXT?.[s.sym]?.source).length;
  const missing  = universe.filter(s=>!FUND[s.sym]&&s.sym!=='M&M').map(s=>s.sym);
  res.json({
    total, withData, realData,
    missing: missing.length, missingList: missing,
    coverage: `${Math.round(withData/total*100)}%`,
    realCoverage: `${Math.round(realData/total*100)}% from live sources`,
    fetchStats: fundFetchStats,
    lastAutoFetch: fundAutoLastRun
      ? new Date(fundAutoLastRun).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})
      : 'never',
    loading: fundAutoLoading,
    sources: ['Yahoo Finance v10 (primary)', 'NSE India API (fallback)'],
  });
});


app.get("/api/token/status", (req,res)=>{
  const hasToken = !!process.env.KITE_ACCESS_TOKEN;
  const isWorking = tickerOn || Object.keys(livePrices).length > 0 || (tokenValid && !isMarketOpen());
  res.json({
    hasToken, isWorking, tickerOn, tokenValid,
    marketOpen: isMarketOpen(),
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
    tokenValid    = true;
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

// -- Stock Scoring Engine - Kite Daily Candles --------------------------------
// Phase 1: Kite getHistoricalData(daily, 1yr) -> price, DMA50/200, 52w, RSI, volume
// Phase 2: Static fundamental table -> ROE, D/E, PE, growth, margins
// No Yahoo Finance, no external API - 100% reliable on Railway
// -----------------------------------------------------------------------------

const stockFundamentals  = {};
let   stockFundLastFetch = 0;
let   stockFundLoading   = false;
let   stockFundReady     = false;
let   niftyBenchmark     = { '52w':0, '6m':0, '3m':0, '1m':0 }; // Varsity: benchmark for relative strength

// -- Sector map ---------------------------------------------------------------
const SECTOR_MAP = {
  JIOFIN:"Financial Services",
  INDIGO:"Aviation",
  ETERNAL:"Consumer",
  TMPV:"Auto",

  "M&M": "Auto",
  ABB: "Capital Goods",
  BAJAJAUTO: "Auto",
  TVSMOTOR: "Auto",
  VARUNBEV: "Consumer",

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
let FUND = {
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


  // -- NEW NIFTY50 ADDITIONS (auto-updated from NSE) --
  JIOFIN:     [4.8,0.12,182.4,null,null,88.4],   // Jio Financial - new listing, high P/E, no hist EPS
  INDIGO:     [38.4,1.82,18.4,18.4,null,14.8],   // IndiGo - high ROE airline, high debt
  ETERNAL:    [8.4,0.12,382.4,68.4,null,8.4],    // Zomato/Eternal - high growth, not yet profitable
  TMPV:       [14.8,1.20,8.4,8.4,228.4,10.2],    // Tata Motors PV - same as TATAMOTORS

  ABB:        [26.4,0.08,52.4,14.8,22.4,14.8],
  BAJAJAUTO:  [24.2,0.04,32.4,8.4,18.4,18.4],
  TVSMOTOR:   [26.4,0.62,42.4,22.4,28.4,8.4],
  VARUNBEV:   [24.2,0.62,52.4,28.4,28.4,12.4],
  ATUL:       [12.4,0.08,42.4,4.8,-8.4,18.4],
  ABFRL:      [4.8,2.80,null,8.4,-18.4,4.8],
  HSCL:       [8.4,0.28,18.4,8.4,8.4,12.4],
  AMARAJABAT: [12.4,0.12,28.4,8.4,18.4,14.8],
  SML:        [8.4,0.42,28.4,8.4,8.4,10.2],
  JSPL:       [12.4,1.20,8.4,14.8,42.4,18.4],
  TATAELXSI:  [28.4,0.04,52.4,8.4,-8.4,32.4],
  MEIL:       [8.4,1.80,null,28.4,null,8.4],
  ARMAN:      [18.4,6.20,12.4,22.4,22.4,null],
  "5PAISA":   [12.4,1.20,28.4,18.4,12.4,22.4],

};

// -- Fetch MAX daily candles from Kite (full history) --------------------------
async function fetchKiteDaily(sym) {
  if (!kite || !process.env.KITE_ACCESS_TOKEN) { return null; }
  const token = validTokens[sym] || INSTRUMENTS[sym];
  if (!token) { return null; }
  try {
    const to   = new Date();
    const from = new Date(Date.now() - 5*365*24*60*60*1000); // 5 years back (safe range)
    const toStr = to.toISOString().split('T')[0];
    const fromStr = from.toISOString().split('T')[0];
    const candles = await Promise.race([
      kite.getHistoricalData(token,'day',fromStr,toStr),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),15000))
    ]);
    if (sym === 'RELIANCE' || sym === 'TCS' || sym === 'HDFCBANK') {
      console.log(`📈 fetchKiteDaily(${sym}): token=${token}, range=${fromStr}→${toStr}, got ${candles?.length||0} candles`);
    }
    return (candles && candles.length >= 50) ? candles : null;
  } catch(e) {
    // Log first few failures to diagnose
    if (!fetchKiteDaily._logCount) fetchKiteDaily._logCount = 0;
    if (fetchKiteDaily._logCount < 5) {
      console.error(`❌ fetchKiteDaily(${sym}) FAILED: ${e.message}`);
      fetchKiteDaily._logCount++;
    }
    return null;
  }
}

// -- Compute technicals from daily candles ------------------------------------
function computeRSIDivergence(C, period=20) {
  const n = C.length;
  if (n < period + 14) return { rsiTrend: null, bullishDiv: false, bearishDiv: false };
  // Compute RSI series (simplified, last 'period' values)
  const rsiSeries = [];
  for (let i = n - period; i < n; i++) {
    let g=0, l=0;
    for (let j=i-13; j<i; j++) { const d=C[j+1]-C[j]; if(d>0)g+=d; else l-=d; }
    rsiSeries.push(l===0 ? 100 : 100 - 100/(1+(g/13)/(l/13)));
  }
  const priceNow  = C[n-1], priceBack  = C[n-period];
  const rsiNow    = rsiSeries[rsiSeries.length-1];
  const rsiBack   = rsiSeries[0];
  const rsiTrend  = rsiNow > rsiBack ? 'rising' : 'falling';
  // Bullish div: price lower but RSI higher (hidden strength)
  const bullishDiv = priceNow < priceBack && rsiNow > rsiBack && rsiNow < 50;
  // Bearish div: price higher but RSI lower (hidden weakness)
  const bearishDiv = priceNow > priceBack && rsiNow < rsiBack && rsiNow > 50;
  return { rsiTrend, bullishDiv, bearishDiv };
}

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

  // RSI-14 — Wilder's smoothed RSI (Varsity M2 Ch14: proper smoothing, not simple average)
  let rsi = 50;
  if (n >= 15) {
    let avgG=0, avgL=0;
    // Seed: simple average of first 14 periods
    for(let i=1;i<=14;i++){ const d=C[i]-C[i-1]; if(d>0)avgG+=d; else avgL-=d; }
    avgG/=14; avgL/=14;
    // Wilder smoothing for remaining bars
    for(let i=15;i<n;i++){
      const d=C[i]-C[i-1];
      avgG=(avgG*13+(d>0?d:0))/14;
      avgL=(avgL*13+(d>0?0:-d))/14;
    }
    rsi = avgL===0 ? 100 : 100 - 100/(1+avgG/avgL);
  }

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

  // ADX (14) — Wilder smoothed (Varsity M2 Ch20: ADX>25=trending, +DI>-DI=bullish)
  let adx=20, adxPdi=0, adxNdi=0;
  if(n>=28){
    // Seed first 14 bars
    let sPdm=0,sNdm=0,sTr=0;
    for(let i=1;i<=14;i++){
      const um=H[i]-H[i-1],dm=L[i-1]-L[i];
      if(um>dm&&um>0)sPdm+=um; if(dm>um&&dm>0)sNdm+=dm;
      sTr+=Math.max(H[i]-L[i],Math.abs(H[i]-C[i-1]),Math.abs(L[i]-C[i-1]));
    }
    // Wilder smooth +DM, -DM, TR over remaining bars
    for(let i=15;i<n;i++){
      const um=H[i]-H[i-1],dm=L[i-1]-L[i];
      const curPdm=(um>dm&&um>0)?um:0, curNdm=(dm>um&&dm>0)?dm:0;
      sPdm=(sPdm*13+curPdm)/14; sNdm=(sNdm*13+curNdm)/14;
      sTr=(sTr*13+Math.max(H[i]-L[i],Math.abs(H[i]-C[i-1]),Math.abs(L[i]-C[i-1])))/14;
    }
    adxPdi = sTr>0 ? (sPdm/sTr)*100 : 0;
    adxNdi = sTr>0 ? (sNdm/sTr)*100 : 0;
    const dx = (adxPdi+adxNdi)>0 ? Math.abs(adxPdi-adxNdi)/(adxPdi+adxNdi)*100 : 0;
    adx = dx; // First DX value; ideally smoothed over 14 periods but single pass is reasonable
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

  // EMA 50/200 for crossover signals — Varsity M2 Ch13: "EMA is more responsive, preferred for signals"
  const ema50  = n>=50  ? calcEma(C,50)[n-1]  : null;
  const ema200 = n>=200 ? calcEma(C,200)[n-1] : null;
  const emaGoldenCross = (ema50&&ema200) ? ema50>ema200 : null;

  // 200DMA trend
  const dma200_30ago = n>=230 ? avg(C,n-230,200) : null;
  const dma200Trend = dma200&&dma200_30ago?(dma200>dma200_30ago?'rising':'falling'):null;

  // Weekly higher highs/lows
  const recent=C.slice(-20);
  const fMax=Math.max(...recent.slice(0,10)), sMax=Math.max(...recent.slice(10));
  const fMin=Math.min(...recent.slice(0,10)), sMin=Math.min(...recent.slice(10));
  const weeklyTrend=sMax>fMax&&sMin>fMin?'uptrend':sMax<fMax&&sMin<fMin?'downtrend':'sideways';

  // RSI Divergence (Arjun: Quant signal — high quality reversal indicator)
  const rsiDiv = n >= 34 ? computeRSIDivergence(C, 20) : { rsiTrend:null, bullishDiv:false, bearishDiv:false };

  return {
    price:C[n-1],
    dma20, dma50, dma100, dma200,
    wk52Hi, wk52Lo, change52w, change6m, change3m, change1m,
    rsi:+rsi.toFixed(1),
    macd:+macd.toFixed(2), macdSig:+macdSig.toFixed(2), macdBull, macdHist,
    bbUpper, bbLower, bbMid:+bbMid.toFixed(2), bbPct:+bbPct.toFixed(2),
    stochK:+stochK.toFixed(1),
    adx:+adx.toFixed(1), adxPdi:+adxPdi.toFixed(1), adxNdi:+adxNdi.toFixed(1),
    supertrend, supertrendSig,
    volRatio:+volRatio.toFixed(2), volTrend, obvRising, accumDist,
    beta, annualVol,
    dma200Trend, weeklyTrend,
    ema50: ema50?+ema50.toFixed(2):null, ema200: ema200?+ema200.toFixed(2):null,
    goldenCross: emaGoldenCross ?? ((dma50&&dma200) ? dma50>dma200 : null), // prefer EMA cross
    pctFromHigh: wk52Hi>0 ? +((C[n-1]-wk52Hi)/wk52Hi*100).toFixed(1) : null,
    pctAbove200: dma200>0 ? +((C[n-1]-dma200)/dma200*100).toFixed(1) : null,
    pctAbove50:  dma50>0  ? +((C[n-1]-dma50)/dma50*100).toFixed(1)   : null,
    // RSI divergence signals
    rsiTrend: rsiDiv.rsiTrend,
    bullishDiv: rsiDiv.bullishDiv,
    bearishDiv: rsiDiv.bearishDiv,
  };
}

// -- Main refresh --------------------------------------------------------------
async function refreshAllFundamentals() {
  if (stockFundLoading) return;
  if (!kite || !process.env.KITE_ACCESS_TOKEN) {
    console.log('📊 Kite not ready - skipping stock refresh'); return;
  }
  stockFundLoading = true;
  console.log('📊 Stock scoring: fetching Kite daily candles in parallel batches...');
  let ok=0, fail=0;

  // Fetch Nifty 50 benchmark for relative strength — Varsity M9: "compare stock return vs market"
  try {
    const niftyCandles = await fetchKiteDaily('NIFTY 50');
    if (niftyCandles && niftyCandles.length > 0) {
      const NC = niftyCandles.map(c => c.close);
      const nn = NC.length;
      niftyBenchmark['52w'] = nn>=252 ? (NC[nn-1]-NC[nn-252])/NC[nn-252] : 0;
      niftyBenchmark['6m']  = nn>=126 ? (NC[nn-1]-NC[nn-126])/NC[nn-126] : 0;
      niftyBenchmark['3m']  = nn>=63  ? (NC[nn-1]-NC[nn-63])/NC[nn-63]   : 0;
      niftyBenchmark['1m']  = nn>=21  ? (NC[nn-1]-NC[nn-21])/NC[nn-21]   : 0;
      console.log(`📊 Nifty 50 benchmark: 52W=${(niftyBenchmark['52w']*100).toFixed(1)}%, 6M=${(niftyBenchmark['6m']*100).toFixed(1)}%`);
    }
  } catch(e) { console.log('📊 Nifty benchmark fetch failed (non-critical):', e.message); }

  // Fetch in parallel batches of 10 — Kite allows ~10 req/s
  // Each call has a 12s timeout so a hanging stock never blocks the batch
  const BATCH = 10;
  const stocks = [...UNIVERSE];

  for (let i = 0; i < stocks.length; i += BATCH) {
    const batch = stocks.slice(i, i + BATCH);
    await Promise.all(batch.map(async stock => {
      try {
        const candles = await fetchKiteDaily(stock.sym);
        const tech = candles ? computeTechnicals(candles) : {};
        if (!candles) fail++; else ok++;
        const f    = FUND[stock.sym] || null;
        const ext = global.FUND_EXT?.[stock.sym];
        // Always create entry — show fundamentals even without candle data
        stockFundamentals[stock.sym] = {
          sym:stock.sym, name:stock.n, grp:stock.grp,
          sector: SECTOR_MAP[stock.sym] || ext?.industry || 'Other',
          price:tech.price??livePrices[stock.sym]?.price??stockFundamentals[stock.sym]?.price??ext?.price??null,
          dma20:tech.dma20??null, dma50:tech.dma50??null, dma100:tech.dma100??null, dma200:tech.dma200??null,
          wk52Hi:tech.wk52Hi??null, wk52Lo:tech.wk52Lo??null,
          change52w:tech.change52w??null, change6m:tech.change6m??null, change3m:tech.change3m??null, change1m:tech.change1m??null,
          rsi:tech.rsi??null,
          macd:tech.macd??null, macdBull:tech.macdBull??null, macdHist:tech.macdHist??null,
          bbPct:tech.bbPct??null, bbUpper:tech.bbUpper??null, bbLower:tech.bbLower??null,
          stochK:tech.stochK??null, adx:tech.adx??null, adxPdi:tech.adxPdi??null, adxNdi:tech.adxNdi??null,
          supertrend:tech.supertrend??null, supertrendSig:tech.supertrendSig??null,
          volRatio:tech.volRatio??null, volTrend:tech.volTrend??null, obvRising:tech.obvRising??null, accumDist:tech.accumDist??null,
          beta:tech.beta??null, annualVol:tech.annualVol??null,
          dma200Trend:tech.dma200Trend??null, weeklyTrend:tech.weeklyTrend??null,
          ema50:tech.ema50??null, ema200:tech.ema200??null,
          goldenCross:tech.goldenCross??null,
          pctFromHigh:tech.pctFromHigh??null, pctAbove200:tech.pctAbove200??null, pctAbove50:tech.pctAbove50??null,
          rsiTrend:tech.rsiTrend??null, bullishDiv:tech.bullishDiv??null, bearishDiv:tech.bearishDiv??null,
          // Core fundamentals — screener overrides hardcoded FUND
          roe:      f?f[0]:null, debtToEq:f?f[1]:null, pe:f?f[2]:null,
          revGrowth:f?f[3]:null, earGrowth:f?f[4]:null, opMargin:f?f[5]:null,
          peg:      ext?.peg ?? (f&&f[2]&&f[4]&&f[4]>0 ? +(f[2]/f[4]).toFixed(2) : null),
          // Extended from Screener.in
          roa:          ext?.roa          ?? null,
          pb:           ext?.pb           ?? (ext?.bookValue > 0 && (tech.price||livePrices[stock.sym]?.price) ? +((tech.price||livePrices[stock.sym]?.price)/ext.bookValue).toFixed(2) : null),
          intCov:       ext?.intCov       ?? null,
          promoter:     ext?.promoter     ?? null,
          pledged:      ext?.pledged      ?? null,
          promoterChg:  ext?.promoterChg  ?? null,
          mktCap:       ext?.mktCap       ?? null,
          divYield:     ext?.divYield     ?? null,
          eps:          ext?.eps          ?? null,
          debt:         ext?.debt         ?? null,
          currentRatio: ext?.currentRatio ?? null,
          salesGr1y:    ext?.salesGr1y    ?? null,
          salesGr5y:    ext?.salesGr5y    ?? null,
          epsGr1y:      ext?.epsGr1y      ?? null,
          epsGr5y:      ext?.epsGr5y      ?? null,
          roe3yAvg:     ext?.roe3yAvg     ?? null,
          roe5yAvg:     ext?.roe5yAvg     ?? null,
          ret1y:        ext?.ret1y        ?? null,
          ret3y:        ext?.ret3y        ?? null,
          ret5y:        ext?.ret5y        ?? null,
          ret6m:        ext?.ret6m        ?? (tech.change6m != null ? +(tech.change6m*100).toFixed(1) : null),
          ret3m:        ext?.ret3m        ?? (tech.change3m != null ? +(tech.change3m*100).toFixed(1) : null),
          evEbitda:     ext?.evEbitda     ?? null,
          industryPE:   ext?.industryPE   ?? null,
          earningsYield:ext?.earningsYield ?? ((f&&f[2]&&f[2]>0) ? +(100/f[2]).toFixed(2) : null),
          priceToFCF:   ext?.priceToFCF   ?? null,
          priceToSales: ext?.priceToSales ?? (ext?.mktCap > 0 && ext?.salesAnnual > 0 ? +((ext.mktCap / 10000000) / ext.salesAnnual).toFixed(2) : null),
          roce:         ext?.roce         ?? null,
          patQtr:       ext?.patQtr       ?? null,
          salesQtr:     ext?.salesQtr     ?? null,
          patAnnual:    ext?.patAnnual    ?? null,
          salesAnnual:  ext?.salesAnnual  ?? null,
          patQtrYoy:    ext?.patQtrYoy    ?? null,
          salesQtrYoy:  ext?.salesQtrYoy  ?? null,
          // Yahoo Finance exclusive fields
          fwdPE:        ext?.fwdPE        ?? null,
          grossMgn:     ext?.grossMgn     ?? null,
          profMgn:      ext?.profMgn      ?? null,
          quickRatio:   ext?.quickRatio   ?? null,
          fcf:          ext?.fcf          ?? null,
          instHeld:     ext?.instHeld     ?? null,
          bookValue:    ext?.bookValue    ?? null,
          fiiHolding:   ext?.fiiHolding   ?? null,
          diiHolding:   ext?.diiHolding   ?? null,
          numShareholders: ext?.numShareholders ?? null,
          dataSource:   ext?.source       ?? 'Hardcoded',
          fetchedAt:Date.now(),
        };

        // ── Computed fallbacks for fields that data sources didn't return ──
        const sf = stockFundamentals[stock.sym];
        const _px = sf.price;
        const _pat = sf.patAnnual;
        const _eps = sf.eps;
        const _sales = sf.salesAnnual;

        // mktCap: price * shares, where shares ≈ patAnnual / eps (in Cr)
        if (sf.mktCap == null && _px && _pat && _eps && _eps > 0) {
          sf.mktCap = +(_px * _pat / _eps).toFixed(0);
        }
        // mktCap fallback: price * salesAnnual / priceToSales (if priceToSales from ext)
        if (sf.mktCap == null && _px && _sales > 0 && ext?.priceToSales > 0) {
          sf.mktCap = +(_sales * ext.priceToSales).toFixed(0);
        }
        // mktCap fallback 2: from PE * patAnnual (if PE available)
        if (sf.mktCap == null && sf.pe > 0 && _pat && _pat > 0) {
          sf.mktCap = +(sf.pe * _pat).toFixed(0);
        }

        // priceToSales: mktCap / salesAnnual
        if (sf.priceToSales == null && sf.mktCap > 0 && _sales > 0) {
          sf.priceToSales = +(sf.mktCap / _sales).toFixed(2);
        }

        // priceToFCF: mktCap / fcf
        if (sf.priceToFCF == null && sf.mktCap > 0 && sf.fcf > 0) {
          sf.priceToFCF = +(sf.mktCap / sf.fcf).toFixed(1);
        }

        // evEbitda: (mktCap + debt) / EBITDA, where EBITDA ≈ sales * opMargin / 100
        if (sf.evEbitda == null && sf.mktCap > 0 && _sales > 0 && sf.opMargin > 0) {
          const ebitda = _sales * sf.opMargin / 100;
          const ev = sf.mktCap + (sf.debt || 0);
          if (ebitda > 0) sf.evEbitda = +(ev / ebitda).toFixed(1);
        }

        // divYield: dividendPayout% * eps / price (approx)
        if (sf.divYield == null && _px > 0 && _eps > 0 && ext?.divYield > 0) {
          // ext.divYield from screener might be payout %, convert to yield
          sf.divYield = +(ext.divYield * _eps / _px).toFixed(2);
        }

        // currentRatio: try from Yahoo via ext, already mapped above
        // No additional fallback available

      } catch(e) { fail++; }
    }));
    // Small pause between batches to respect Kite rate limits
    if (i + BATCH < stocks.length) await new Promise(r=>setTimeout(r,200));
  }

  // ── Post-loop: compute industryPE as median PE per sector ──
  const sectorPEs = {};
  Object.values(stockFundamentals).forEach(f => {
    if (f.pe > 0 && f.sector) {
      if (!sectorPEs[f.sector]) sectorPEs[f.sector] = [];
      sectorPEs[f.sector].push(f.pe);
    }
  });
  // Compute all-stock median as fallback for small sectors
  const allPEs = Object.values(sectorPEs).flat().sort((a,b) => a - b);
  const allMedianPE = allPEs.length ? +allPEs[Math.floor(allPEs.length / 2)].toFixed(1) : null;
  Object.values(stockFundamentals).forEach(f => {
    if (f.industryPE == null && f.sector) {
      const pes = sectorPEs[f.sector];
      if (pes && pes.length >= 2) {
        const sorted = [...pes].sort((a,b) => a - b);
        f.industryPE = +sorted[Math.floor(sorted.length / 2)].toFixed(1);
      } else if (allMedianPE) {
        f.industryPE = allMedianPE; // fallback to market median
      }
    }
  });

  stockFundLastFetch = Date.now();
  stockFundLoading   = false;
  stockFundReady     = ok > 10;
  console.log(`📊 Stock scoring done: ${ok} OK, ${fail} failed`);

  // Persist to stock_scores table AND kv cache
  if (ok > 10) {
    // Save to kv cache (fast startup restore)
    try {
      await dbSet('scored_stocks_cache', JSON.stringify({
        stocks: stockFundamentals,
        fetchedAt: stockFundLastFetch,
      }));
    } catch(e) {}

    // Save individual scores to stock_scores table (queryable, durable)
    let saved = 0;
    for (const [sym, f] of Object.entries(stockFundamentals)) {
      try {
        await pool.query(`
          INSERT INTO stock_scores (sym, score, score_hits, fa_score, fa_verdict, fa_color, fa_icon, is_fallen, technicals, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
          ON CONFLICT (sym) DO UPDATE SET
            score=EXCLUDED.score, score_hits=EXCLUDED.score_hits,
            fa_score=EXCLUDED.fa_score, fa_verdict=EXCLUDED.fa_verdict,
            fa_color=EXCLUDED.fa_color, fa_icon=EXCLUDED.fa_icon,
            is_fallen=EXCLUDED.is_fallen, technicals=EXCLUDED.technicals,
            updated_at=NOW()
        `, [
          sym,
          f.score || null,
          f.hits ? JSON.stringify(f.hits) : null,
          f.fallenScore || null,
          f.fallenVerdict || null,
          f.fallenColor || null,
          f.fallenIcon || null,
          f.isFallenAngel || false,
          JSON.stringify({
            price: f.price, rsi: f.rsi, dma200: f.dma200, dma50: f.dma50,
            goldenCross: f.goldenCross, macdBull: f.macdBull, obvRising: f.obvRising,
            pctFromHigh: f.pctFromHigh, wk52Hi: f.wk52Hi, wk52Lo: f.wk52Lo,
            stochK: f.stochK, bbPct: f.bbPct, adx: f.adx, beta: f.beta,
            volRatio: f.volRatio, bullishDiv: f.bullishDiv, supertrend: f.supertrend,
            supertrendSig: f.supertrendSig, change52w: f.change52w,
          }),
        ]);
        saved++;
      } catch(e) {}
    }
    console.log(`📊 ${saved} stock scores saved to DB`);
  }
}

// -- Patch fundamentals into existing stockFundamentals without re-fetching candles --
// Called after Yahoo scraper fills FUND, so stocks already scored get updated data
function patchFundamentalsIntoScored() {
  let patched = 0;
  for (const sym of Object.keys(stockFundamentals)) {
    const f = FUND[sym];
    if (!f) continue;
    const s = stockFundamentals[sym];
    // Only patch if current data is null (don't overwrite existing)
    if (s.roe == null)      { s.roe       = f[0]; patched++; }
    if (s.debtToEq == null) { s.debtToEq  = f[1]; }
    if (s.pe == null)       { s.pe        = f[2]; }
    if (s.revGrowth == null){ s.revGrowth = f[3]; }
    if (s.earGrowth == null){ s.earGrowth = f[4]; }
    if (s.opMargin == null) { s.opMargin  = f[5]; }
    if (s.pe && s.earGrowth && s.earGrowth > 0) {
      s.peg = +(s.pe / s.earGrowth).toFixed(2);
    }
  }
  if (patched > 0) console.log(`📊 Patched fundamentals into ${patched} scored stocks`);
  return patched;
}

// -- Real Fundamentals Scraper ------------------------------------------------
// Sources tried in order:
// 1. Yahoo Finance v10 API (free, real data, no auth) - primary
// 2. NSE India quote API (free, P/E + 52w data) - fallback
// All data cached in PostgreSQL, refreshed weekly

let fundAutoLoading = false;
let fundAutoLastRun = null;
let fundFetchStats  = { success:0, failed:0, total:0, lastRun:null };

// Yahoo Finance crumb/cookie cache — shared across all requests
let yahooCrumb = null;
let yahooCookies = null;
let yahooCrumbFetched = 0;

async function refreshYahooCrumb() {
  const CRUMB_TTL = 3600000; // 1 hour
  if (yahooCrumb && yahooCookies && (Date.now() - yahooCrumbFetched) < CRUMB_TTL) return;
  try {
    // Step 1: Get cookies from Yahoo
    const cookieResp = await fetch('https://fc.yahoo.com/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0' },
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    });
    const setCookie = cookieResp.headers.get('set-cookie') || '';
    yahooCookies = setCookie.split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
    if (!yahooCookies) throw new Error('No cookies from Yahoo');

    // Step 2: Get crumb using cookies
    const crumbResp = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
        'Cookie': yahooCookies,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!crumbResp.ok) throw new Error(`Crumb fetch failed: ${crumbResp.status}`);
    yahooCrumb = await crumbResp.text();
    yahooCrumbFetched = Date.now();
    console.log('📊 Yahoo Finance crumb refreshed');
  } catch(e) {
    console.error('Yahoo crumb error:', e.message);
    yahooCrumb = null; yahooCookies = null;
  }
}

async function fetchFromYahoo(sym) {
  // Yahoo Finance v10 - returns comprehensive fundamentals
  // NSE stocks use .NS suffix (BSE use .BO)
  const nseSymMap = {
    'M&M': 'M-M.NS',       // special char
    'BAJAJ-AUTO': 'BAJAJ-AUTO.NS',
  };
  const yahooSym = nseSymMap[sym] || `${sym}.NS`;

  // Refresh crumb if needed
  await refreshYahooCrumb();
  if (!yahooCrumb || !yahooCookies) return null;

  const modules = [
    'financialData',          // ROE, margins, revenue growth, EPS growth
    'defaultKeyStatistics',   // P/E, PEG, beta, 52w change
    'summaryDetail',          // trailing P/E, forward P/E, dividend
    'incomeStatementHistory', // revenue history for growth calc
    'balanceSheetHistory',    // debt for D/E calc
  ].join(',');

  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${yahooSym}?modules=${modules}&crumb=${encodeURIComponent(yahooCrumb)}`;

  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cookie': yahooCookies,
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!resp.ok) {
    // If unauthorized, invalidate crumb so next request refreshes
    if (resp.status === 401 || resp.status === 403) { yahooCrumb = null; yahooCookies = null; }
    return null;
  }
  const data = await resp.json();
  const result = data?.quoteSummary?.result?.[0];
  if (!result) return null;

  const fin  = result.financialData        || {};
  const stat = result.defaultKeyStatistics || {};
  const summ = result.summaryDetail        || {};
  const inc  = result.incomeStatementHistory?.incomeStatementHistory || [];
  const bal  = result.balanceSheetHistory?.balanceSheetHistory       || [];

  // -- ROE: Net Income / Shareholder Equity
  const roe = fin.returnOnEquity?.raw != null
    ? +(fin.returnOnEquity.raw * 100).toFixed(1)
    : null;

  // -- D/E: Total Debt / Shareholder Equity
  // Yahoo gives debtToEquity as percentage (e.g. 45.2 means 0.452x)
  const de = fin.debtToEquity?.raw != null
    ? +(fin.debtToEquity.raw / 100).toFixed(2)
    : null;

  // -- P/E: trailing twelve months
  const pe = summ.trailingPE?.raw != null
    ? +summ.trailingPE.raw.toFixed(1)
    : (stat.forwardPE?.raw != null ? +stat.forwardPE.raw.toFixed(1) : null);

  // -- Revenue Growth: YoY (from financialData or income statement)
  let revGr = fin.revenueGrowth?.raw != null
    ? +(fin.revenueGrowth.raw * 100).toFixed(1)
    : null;

  // Calculate from income history if not available
  if (revGr == null && inc.length >= 2) {
    const r1 = inc[0]?.totalRevenue?.raw;
    const r2 = inc[1]?.totalRevenue?.raw;
    if (r1 && r2 && r2 !== 0) revGr = +((r1 - r2) / Math.abs(r2) * 100).toFixed(1);
  }

  // -- EPS Growth: YoY
  let epsGr = fin.earningsGrowth?.raw != null
    ? +(fin.earningsGrowth.raw * 100).toFixed(1)
    : null;

  if (epsGr == null && inc.length >= 2) {
    const e1 = inc[0]?.netIncome?.raw;
    const e2 = inc[1]?.netIncome?.raw;
    if (e1 && e2 && e2 !== 0) epsGr = +((e1 - e2) / Math.abs(e2) * 100).toFixed(1);
  }

  // -- Operating Margin
  const opMgn = fin.operatingMargins?.raw != null
    ? +(fin.operatingMargins.raw * 100).toFixed(1)
    : null;

  // -- Profit Margin (supplement)
  const profMgn = fin.profitMargins?.raw != null
    ? +(fin.profitMargins.raw * 100).toFixed(1)
    : null;

  // -- Return on Assets
  const roa = fin.returnOnAssets?.raw != null
    ? +(fin.returnOnAssets.raw * 100).toFixed(1)
    : null;

  // -- Current Ratio (liquidity)
  const currentRatio = fin.currentRatio?.raw != null
    ? +fin.currentRatio.raw.toFixed(2)
    : null;

  // -- Quick Ratio
  const quickRatio = fin.quickRatio?.raw != null
    ? +fin.quickRatio.raw.toFixed(2)
    : null;

  // -- Revenue TTM (for context)
  const revenueTTM = fin.totalRevenue?.raw || null;

  // -- Free Cash Flow
  const fcf = fin.freeCashflow?.raw || null;

  // -- Gross Margin
  const grossMgn = fin.grossMargins?.raw != null
    ? +(fin.grossMargins.raw * 100).toFixed(1)
    : null;

  // -- Beta
  const beta = stat.beta?.raw != null ? +stat.beta.raw.toFixed(2) : null;

  // -- Market Cap
  const mktCap = stat.marketCap?.raw || summ.marketCap?.raw || null;

  // -- Forward PE
  const fwdPE = stat.forwardPE?.raw != null ? +stat.forwardPE.raw.toFixed(1) : null;

  // -- PEG
  const peg = stat.pegRatio?.raw != null ? +stat.pegRatio.raw.toFixed(2) : null;

  // -- Dividend Yield
  const divYield = summ.dividendYield?.raw != null
    ? +(summ.dividendYield.raw * 100).toFixed(2)
    : null;

  // -- Book Value per Share
  const bookValue = stat.bookValue?.raw != null ? +stat.bookValue.raw.toFixed(2) : null;

  // -- Price to Book
  const pb = stat.priceToBook?.raw != null ? +stat.priceToBook.raw.toFixed(2) : null;

  // -- EV/EBITDA
  const evEbitda = stat.enterpriseToEbitda?.raw != null
    ? +stat.enterpriseToEbitda.raw.toFixed(1)
    : null;

  // -- Held by institutions
  const instHeld = stat.heldPercentInstitutions?.raw != null
    ? +(stat.heldPercentInstitutions.raw * 100).toFixed(1)
    : null;

  // -- Held by insiders (promoters)
  const insiderHeld = stat.heldPercentInsiders?.raw != null
    ? +(stat.heldPercentInsiders.raw * 100).toFixed(1)
    : null;

  // -- 52W price change
  const change52w = stat.fiftyTwoWeekChange?.raw != null
    ? +(stat.fiftyTwoWeekChange.raw * 100).toFixed(1)
    : null;

  // Validate - only return if we got meaningful data
  if (!pe && !roe && !de && !revGr) return null;

  return {
    // Core FUND array: [ROE, D/E, PE, RevGr, EpsGr, OpMargin] - backward compat
    core: [roe, de, pe, revGr, epsGr, opMgn],
    // Extended data
    ext: {
      roe, de, pe, fwdPE, peg, revGr, epsGr,
      opMgn, grossMgn, profMgn, roa,
      currentRatio, quickRatio,
      beta,
      mktCap: mktCap ? Math.round(mktCap / 10000000) : null, // INR → Cr
      divYield, bookValue, pb, evEbitda,
      instHeld, insiderHeld, change52w,
      fcf: fcf ? Math.round(fcf / 10000000) : null, // INR → Cr
      source: 'Yahoo Finance',
      fetchedAt: Date.now(),
    },
  };
}

async function fetchFromNSE(sym) {
  // NSE India has a public quote API that includes P/E
  // GET https://www.nseindia.com/api/quote-equity?symbol=RELIANCE
  // Requires session cookies - complex. Use as last resort.
  try {
    // First get session
    const sessionResp = await fetch('https://www.nseindia.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(8000),
    });
    const cookies = sessionResp.headers.get('set-cookie') || '';

    const resp = await fetch(`https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(sym)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.nseindia.com/',
        'Cookie': cookies,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) return null;
    const data = await resp.json();

    // NSE returns priceInfo, industryInfo, metadata, securityInfo
    const meta  = data.metadata     || {};
    const price = data.priceInfo    || {};
    const indus = data.industryInfo || {};

    const pe  = meta.pdSymbolPe  ? +parseFloat(meta.pdSymbolPe).toFixed(1)  : null;
    const eps = meta.eps          ? +parseFloat(meta.eps).toFixed(2)         : null;
    const pb  = meta.pdSectorPe   ? null : null; // sector PE not PB

    if (!pe) return null;

    return {
      core: [null, null, pe, null, null, null],
      ext: { pe, eps, source: 'NSE India', fetchedAt: Date.now() },
    };
  } catch(e) {
    return null;
  }
}

async function autoFetchFundamentals(syms) {
  if (!syms || syms.length === 0) return 0;
  console.log(`Scraping real fundamentals for ${syms.length} stocks...`);
  fundFetchStats = { success:0, failed:0, total:syms.length, lastRun:null };

  for (const sym of syms) {
    try {
      let result = null;

      // Source 1: Yahoo Finance (best coverage)
      result = await fetchFromYahoo(sym);

      // Source 2: NSE India (fallback for PE at least)
      if (!result) {
        await new Promise(r => setTimeout(r, 500));
        result = await fetchFromNSE(sym);
      }

      if (result) {
        // Store core array for backward compat
        FUND[sym] = result.core;

        // Store merged extended data in DB (preserves screener fields)
        await dbSet(`fund_${sym}`, JSON.stringify({
          core: result.core,
          ext:  global.FUND_EXT[sym],  // save the merged version
        }));

        // Merge extended into memory — Yahoo fills gaps, doesn't replace screener data
        if (!global.FUND_EXT) global.FUND_EXT = {};
        const existing = global.FUND_EXT[sym] || {};
        // Yahoo values fill nulls in existing data (screener takes priority)
        const merged = { ...existing };
        for (const [k, v] of Object.entries(result.ext)) {
          if (v != null && (merged[k] == null || k === 'fetchedAt')) merged[k] = v;
        }
        global.FUND_EXT[sym] = merged;

        fundFetchStats.success++;
        console.log(`  ${sym}: PE=${result.core[2]} ROE=${result.core[0]} D/E=${result.core[1]} RevGr=${result.core[3]}% EpsGr=${result.core[4]}% OpMgn=${result.core[5]}%`);
      } else {
        fundFetchStats.failed++;
        console.log(`  ${sym}: no data from any source`);
      }

      // Respectful rate limit: 1.5s between requests
      await new Promise(r => setTimeout(r, 1500));

    } catch(e) {
      fundFetchStats.failed++;
      trackError("yahoo_scraper", e); console.log(`  ${sym} error: ${e.message}`);
      await new Promise(r => setTimeout(r, 800));
    }
  }

  fundFetchStats.lastRun = Date.now();
  fundAutoLastRun = Date.now();
  console.log(`Fundamentals scrape done: ${fundFetchStats.success} success, ${fundFetchStats.failed} failed out of ${syms.length}`);
  return fundFetchStats.success;
}

async function loadCachedFundamentals() {
  // Load previously scraped fundamentals from DB (both core + extended)
  try {
    if (!global.FUND_EXT) global.FUND_EXT = {};
    // Load ALL stocks - not just missing ones (refresh may have better data)
    const allSyms = UNIVERSE.map(s => s.sym).filter(s => s !== 'M&M');
    let loaded = 0;
    for (const sym of allSyms) {
      try {
        const cached = await dbGet(`fund_${sym}`);
        if (!cached) continue;
        const parsed = JSON.parse(cached);

        // New format: {core: [...], ext: {...}}
        if (parsed.core && Array.isArray(parsed.core) && parsed.core.length === 6) {
          // Only update if we don't have hardcoded data (prefer hardcoded - it's curated)
          if (!FUND[sym]) {
            FUND[sym] = parsed.core;
          } else {
            // Merge: fill nulls in hardcoded with scraped values
            for (let i = 0; i < 6; i++) {
              if (FUND[sym][i] == null && parsed.core[i] != null) {
                FUND[sym][i] = parsed.core[i];
              }
            }
          }
          if (parsed.ext) global.FUND_EXT[sym] = parsed.ext;
          loaded++;
        }
        // Old format: plain array
        else if (Array.isArray(parsed) && parsed.length === 6) {
          if (!FUND[sym]) FUND[sym] = parsed;
          loaded++;
        }
      } catch(e) {}
    }
    if (loaded > 0) console.log(`Loaded ${loaded} fundamentals from DB cache (real scraped data)`);
    return loaded;
  } catch(e) {
    console.log('loadCachedFundamentals error:', e.message);
    return 0;
  }
}

async function refreshMissingFundamentals(forceAll=false) {
  if (fundAutoLoading) return;
  fundAutoLoading = true;
  try {
    const WEEK_MS = 7 * 24 * 3600 * 1000;
    const now = Date.now();

    let toFetch;
    if (forceAll) {
      toFetch = UNIVERSE.map(s => s.sym).filter(s => !['M&M','BTCUSDT','ETHUSDT'].includes(s) && !s.includes('USDT'));
      console.log(`Force refreshing ALL ${toFetch.length} stocks fundamentals`);
    } else {
      toFetch = UNIVERSE
        .map(s => s.sym)
        .filter(s => !['M&M','BTCUSDT','ETHUSDT'].includes(s) && !s.includes('USDT'))
        .filter(sym => {
          if (!FUND[sym]) return true; // missing
          const ext = global.FUND_EXT?.[sym];
          if (!ext?.fetchedAt) return true; // no timestamp = old hardcoded
          return (now - ext.fetchedAt) > WEEK_MS; // stale
        });
      console.log(`Fetching fundamentals: ${toFetch.length} stocks (missing or stale >7d)`);
    }

    if (toFetch.length === 0) {
      console.log('All fundamentals up to date');
      return;
    }

    await autoFetchFundamentals(toFetch);

    // KEY STEP: immediately patch scraped data into already-scored stocks
    // This updates Fallen Angels WITHOUT needing a full Kite candle re-fetch
    const patched = patchFundamentalsIntoScored();
    if (patched > 0) {
      console.log(`📊 ${patched} stocks now have real fundamentals - Fallen Angels updated`);
      // Mark scored data as updated so clients get fresh results
      stockFundLastFetch = Date.now();
    }

  } finally {
    fundAutoLoading = false;
  }
}

// =============================================================================
// NEW FEATURES — from multi-agent analysis (MiroFish-style simulation)
// Agents: Retail Investor, Quant Trader, Portfolio Manager, Engineer, PM, Risk Analyst
// =============================================================================

// -- Error tracking (Sneha: Engineer) -----------------------------------------
const recentErrors = [];
function trackError(context, error) {
  const entry = { context, message: error.message, stack: error.stack?.split('\n')[1]?.trim(), ts: Date.now() };
  recentErrors.unshift(entry);
  if (recentErrors.length > 50) recentErrors.pop();
  console.error(`[${context}] ${error.message}`);
  dbSet(`error_last_${context}`, JSON.stringify(entry)).catch(()=>{});
}
app.get("/api/errors", (req,res) => res.json({ errors: recentErrors, count: recentErrors.length }));

// -- Alert tracking (no external push — detected in scoring) ----------------
let lastAlertedFallen = new Set();
async function checkAndSendAlerts(scoredStocks) {
  const newFallen = scoredStocks.filter(s => s.isFallenAngel && !lastAlertedFallen.has(s.sym));
  if (newFallen.length > 0) {
    newFallen.forEach(s => lastAlertedFallen.add(s.sym));
    console.log();
  }
}

// -- Stop Loss + R:R calculator (Meera: Risk Analyst) -------------------------
function computeStopAndTarget(s) {
  // ============================================================================
  // STOP LOSS + TARGET — Varsity Module 2 (S&R + Risk Management)
  //
  // Varsity: "Stop loss = the price at which you accept you were wrong"
  // Stop candidates (Varsity-ranked by reliability):
  //   1. Just below 200DMA (Varsity: "institutional buy zone; breach = trend change")
  //   2. Just below 52W Low (maximum fear level = hard support)
  //   3. Just below Fib 61.8% retracement (Varsity: "most respected Fibonacci level")
  //   4. 1.5× ATR-proxy below entry (volatility-adjusted stop)
  //   5. Simple 7% stop (fallback)
  //
  // Target candidates:
  //   1. Fib 38.2% retracement from fall (first resistance)
  //   2. Fib 50% retracement (mid-point)
  //   3. 200DMA (if below, acts as first target)
  //   4. 52W High (full recovery target)
  //
  // R:R >= 2.0 = Varsity minimum for a worthwhile trade
  // ============================================================================

  const px = s.price;
  if (!px || px <= 0) return null;

  // -- STOP LOSS candidates ---------------------------------------------------
  const stops = [];

  // Candidate 1: 2% below 200DMA — Varsity: "200DMA breach = primary trend change"
  if (s.dma200 && s.dma200 > 0) {
    const stop200 = s.dma200 * 0.98;
    // Only use if stop is below current price and not too far (within 20%)
    if (stop200 < px && stop200 > px * 0.80) {
      stops.push({ val: stop200, reason: '200DMA support (Varsity: line of truth)' });
    }
  }

  // Candidate 2: 1% below 52W Low — "maximum pessimism level = hard floor support"
  if (s.wk52Lo && s.wk52Lo > 0 && s.wk52Lo < px) {
    const stopLow = s.wk52Lo * 0.99;
    if (stopLow > px * 0.65) { // not too far — must be realistic
      stops.push({ val: stopLow, reason: '52W Low support' });
    }
  }

  // Candidate 3: Fibonacci 61.8% retracement — Varsity: "golden ratio, most respected level"
  // Retracement from 52W high to current (fall range)
  if (s.wk52Hi && s.wk52Hi > px && s.wk52Lo && s.wk52Lo < px) {
    const fibRange = s.wk52Hi - s.wk52Lo;
    const fib382 = s.wk52Hi - 0.382 * fibRange; // 38.2% retracement from high
    const fib618 = s.wk52Hi - 0.618 * fibRange; // 61.8% retracement from high
    // Stop just below the relevant fib level below current price
    if (fib618 < px && fib618 > px * 0.75) {
      stops.push({ val: fib618 * 0.99, reason: 'Fib 61.8% support (golden ratio)' });
    }
  }

  // Candidate 4: ATR-proxy stop — Varsity M9: volatility-adjusted stop prevents noise-out
  // ATR ≈ price × daily volatility (one day's true range); use 2× ATR for swing stop
  if (s.annualVol && s.annualVol > 0) {
    const dailyVol = (s.annualVol / 100) / Math.sqrt(252);
    const atrProxy = px * dailyVol; // single day ATR proxy
    const stopATR  = px - (2.0 * atrProxy); // 2× daily ATR below entry (Varsity: allows normal noise)
    if (stopATR > 0 && stopATR > px * 0.75) {
      stops.push({ val: stopATR, reason: '2× ATR stop (volatility-adjusted)' });
    }
  }

  // Fallback: tight 7% stop (Varsity: "never risk more than 2% of portfolio per trade")
  stops.push({ val: px * 0.93, reason: '7% trailing stop (fallback)' });

  // Choose the TIGHTEST stop that still gives >= 2:1 R:R
  // Varsity: "Tighter stop = smaller loss if wrong; bigger stop needed only if wider S&R"
  stops.sort((a, b) => b.val - a.val); // highest = tightest stop

  // -- TARGET candidates -------------------------------------------------------
  const targets = [];

  // Target 1: 200DMA (if price is below it — first resistance to reclaim)
  if (s.dma200 && s.dma200 > px) {
    targets.push({ val: s.dma200, reason: '200DMA reclaim (primary resistance)' });
  }

  // Target 2: Fib 38.2% retracement = first meaningful recovery target
  if (s.wk52Hi && s.wk52Hi > px && s.wk52Lo) {
    const fibRange = s.wk52Hi - s.wk52Lo;
    const fib382target = s.wk52Lo + 0.618 * fibRange; // Fib 61.8% up from low = 38.2% down from high
    if (fib382target > px * 1.05) {
      targets.push({ val: fib382target, reason: 'Fib 38.2% retracement recovery' });
    }
  }

  // Target 3: 52W High = full mean reversion (Fallen Angel thesis: price returns to peak)
  if (s.wk52Hi && s.wk52Hi > px * 1.08) {
    // Cap at 50% upside for conservatism — if 52W high implies >50%, use 50%
    const cappedHigh = Math.min(s.wk52Hi, px * 1.50);
    targets.push({ val: cappedHigh, reason: '52W High recovery (Fallen Angel mean reversion)' });
  }

  // Fallback: +15% minimum target
  targets.push({ val: px * 1.15, reason: '15% recovery target (minimum)' });

  // Pick best target: first one that gives >= 2:1 R:R with best stop
  // Use tightest stop first, find target that clears 2:1
  let finalStop   = stops[stops.length - 1]; // fallback 7%
  let finalTarget = targets[targets.length - 1];
  let finalRR     = null;

  for (const st of stops) {
    const risk = px - st.val;
    if (risk <= 0) continue;
    for (const tgt of targets.sort((a,b) => a.val - b.val)) {
      const reward = tgt.val - px;
      const rr = reward / risk;
      if (rr >= 2.0) {
        finalStop   = st;
        finalTarget = tgt;
        finalRR     = rr;
        break;
      }
    }
    if (finalRR) break;
  }

  // If no 2:1 found, use tightest stop + best target anyway (let UI show bad R:R)
  if (!finalRR) {
    finalStop   = stops[0];
    finalTarget = targets.sort((a,b) => b.val - a.val)[0];
    const risk   = px - finalStop.val;
    finalRR      = risk > 0 ? (finalTarget.val - px) / risk : null;
  }

  const risk      = px - finalStop.val;
  const reward    = finalTarget.val - px;
  const rrRatio   = risk > 0 ? +(reward / risk).toFixed(1) : null;

  return {
    stopLoss:    +finalStop.val.toFixed(1),
    stopReason:  finalStop.reason,
    target:      +finalTarget.val.toFixed(1),
    targetReason: finalTarget.reason,
    riskPct:     +((risk / px) * 100).toFixed(1),
    rewardPct:   +((reward / px) * 100).toFixed(1),
    rrRatio,
    acceptable:  rrRatio != null && rrRatio >= 2.0, // Varsity: 2:1 minimum
  };
}

// -- RSI Divergence detection (Arjun: Quant) ----------------------------------
// Bullish divergence: price makes lower low but RSI makes higher low = reversal signal

// -- Portfolio sector concentration (Vikram: Portfolio Manager) ---------------
function computePortfolioStats(stocks) {
  const sectors = {};
  stocks.forEach(s => { sectors[s.sector||'Other'] = (sectors[s.sector||'Other']||0)+1; });
  const total = stocks.length || 1;
  const concentration = Object.entries(sectors)
    .map(([sector,count]) => ({ sector, count, pct: Math.round(count/total*100) }))
    .sort((a,b) => b.count - a.count);
  // Herfindahl index (0=perfect diversification, 1=single sector)
  const hhi = +concentration.reduce((sum,s) => sum + (s.pct/100)**2, 0).toFixed(2);
  return {
    concentration,
    hhi,
    diversified: hhi < 0.20,
    warning: hhi > 0.35 ? `Concentrated: top sector is ${concentration[0]?.sector} (${concentration[0]?.pct}%)` : null,
  };
}

// -- Holdings overlay (Priya: Retail Investor) --------------------------------
// Returns set of symbols user already owns in Zerodha
async function getHeldSymbols() {
  if (!kite || !process.env.KITE_ACCESS_TOKEN) return new Set();
  try {
    const holdings = await kite.getHoldings();
    return new Set(holdings.map(h => h.tradingsymbol));
  } catch(e) { return new Set(); }
}

// Endpoint: get portfolio stats for current top picks
app.get("/api/portfolio/stats", async(req,res) => {
  try {
    const topN = parseInt(req.query.n||'20');
    const all  = Object.values(stockFundamentals);
    if (!all.length) return res.json({ error: 'No scored stocks yet' });
    const top  = all.sort((a,b) => (b.score||0)-(a.score||0)).slice(0, topN);
    const held = await getHeldSymbols();
    const stats = computePortfolioStats(top);
    res.json({
      ...stats,
      topStocks: top.map(s => ({
        sym: s.sym, name: s.name, sector: s.sector||'Other',
        score: s.score, alreadyOwn: held.has(s.sym),
        isFallenAngel: s.isFallenAngel||false,
      })),
      heldCount: top.filter(s => held.has(s.sym)).length,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// -- Percentile rank within sector peers --------------------------------------
// =============================================================================
// STOCK SCORING — Varsity-derived 100-point framework
// Sources: Zerodha Varsity Module 2 (TA) + Module 3 (FA) + Module 15 (Sector)
//
// PILLARS:
//   Quality/Fundamentals (35 pts) — Varsity: ROE>15% = good, CFO>PAT = earnings quality
//   Trend (25 pts)                — Varsity: 200DMA is the line of truth
//   Momentum (10 pts)             — Price performance across timeframes
//   Value (20 pts)                — Varsity: sector-relative PE, PEG, PE/ROE
//   Growth (10 pts)               — Varsity: EPS + Revenue CAGR, operating leverage
//
// KEY IMPROVEMENTS FROM VARSITY:
//   1. P/E now sector-percentile ranked (not absolute) — Varsity: compare to peers
//   2. Interest Coverage added (Varsity: <1.5x = danger zone)
//   3. CFO quality proxy via Operating Margin consistency (data available)
//   4. RSI Divergence adds to score — Varsity: strongest reversal signal
//   5. Revenue Growth separate from EPS (Varsity: operating leverage check)
//   6. PEG via sector percentile, not just absolute
// =============================================================================
function pctRankStk(val, arr, hb=true) {
  if (val==null||!arr.length) return 50;
  const valid=arr.filter(v=>v!=null&&isFinite(v));
  if (!valid.length) return 50;
  return Math.round(valid.filter(v=>hb?v<val:v>val).length/valid.length*100);
}

function scoreOneStock(f, peers) {
  let s=0; const hits={};
  const na = v => v!=null&&isFinite(v);
  const pr = (val,key,hb=true) => pctRankStk(val, peers.map(p=>p[key]).filter(v=>v!=null&&isFinite(v)), hb);
  const px = f.price || livePrices[f.sym]?.price;

  // Detect banking/NBFC sector — different valuation metrics apply
  const isBanking = /bank|nbfc|finance|financi/i.test(f.sector||'');
  const isIT      = /software|it |information tech|tech mahindra|infosys|wipro|hcl|tcs/i.test((f.sector||'')+(f.name||''));
  const isCement  = /cement/i.test(f.sector||'');

  // -- PILLAR 1: BUSINESS QUALITY (35 pts) -------------------------------------
  // Varsity M3: ROE is #1 quality signal. ROCE = capital efficiency.

  // ROE — Varsity: >15% = good, >20% = excellent (8 pts)
  if(na(f.roe)){
    const pp = f.roe>=20?8 : f.roe>=15?6 : f.roe>=12?4 : f.roe>=8?2 : 0;
    s+=pp; hits[`ROE: ${f.roe.toFixed(1)}%`]=pp;
  }

  // ROCE — Varsity M3 Ch 8: "#1 capital efficiency metric, >15% = generating real returns"
  // Estimated from available data if direct value not present
  const roce = f.roce ?? (na(f.roe) && na(f.debtToEq) ? f.roe * (1 + f.debtToEq) : null);
  if(na(roce)){
    const pp = roce>=20?6 : roce>=15?4 : roce>=10?2 : 0;
    s+=pp; hits[`ROCE: ${roce.toFixed(1)}% (capital efficiency)`]=pp;
  }

  // DuPont ROE Decomposition — Varsity M3 Ch 8
  // ROE = Net Margin × Asset Turnover × Equity Multiplier
  // Leverage-led ROE (D/E>2) is fragile — penalise
  if(na(f.roe) && f.roe>15 && na(f.debtToEq) && f.debtToEq>2) {
    const penalty = -3;
    s+=penalty; hits[`⚠ ROE is leverage-led (D/E ${f.debtToEq.toFixed(1)}x) — fragile quality`]=penalty;
  }

  // D/E Ratio — Varsity: <0.5=safe, >2=concern (8 pts)
  if(na(f.debtToEq)){
    const pp = isBanking ? 0 // Banks use leverage by design — skip D/E for them
      : f.debtToEq<=0.3?8 : f.debtToEq<=0.7?6 : f.debtToEq<=1.5?3 : f.debtToEq<=3?1 : 0;
    if(!isBanking){ s+=pp; hits[`D/E: ${f.debtToEq.toFixed(2)}x`]=pp; }
  }

  // Operating Margin — sector-relative percentile (5 pts)
  if(na(f.opMargin)){
    const peerPct = pr(f.opMargin,'opMargin',true);
    const pp = peerPct>=80?5 : peerPct>=60?4 : peerPct>=40?2 : peerPct>=20?1 : 0;
    s+=pp; hits[`Op Margin: ${f.opMargin.toFixed(1)}% (top ${(100-peerPct).toFixed(0)}% in sector)`]=pp;
  }

  // EPS Growth — multi-year consistency (Varsity M3 Ch 13) (7 pts)
  if(na(f.earGrowth) && f.earGrowth<500){
    const pp = f.earGrowth>=25?5 : f.earGrowth>=15?4 : f.earGrowth>=8?2 : f.earGrowth>=0?1 : 0;
    s+=pp; hits[`EPS Growth 1Y: ${f.earGrowth.toFixed(1)}%`]=pp;

    // Growth consistency bonus — both 1Y and 5Y strong = compounding quality
    if(na(f.epsGr5y) && f.epsGr5y>10 && f.earGrowth>10){
      s+=3; hits[`Growth consistency: 1Y ${f.earGrowth.toFixed(0)}% + 5Y ${f.epsGr5y.toFixed(0)}% both strong`]=3;
    }
    // Cyclical spike penalty — 1Y looks great but 5Y poor = one-time, not structural
    if(na(f.epsGr5y) && f.earGrowth>30 && f.epsGr5y<5){
      s-=2; hits[`⚠ Cyclical spike: 1Y ${f.earGrowth.toFixed(0)}% but 5Y only ${f.epsGr5y.toFixed(0)}%`]=-2;
    }
  }

  // ROE consistency — improving trend is best (Varsity M3 Ch 13) (3 pts)
  if(na(f.roe) && na(f.roe3yAvg)){
    if(f.roe > f.roe3yAvg + 2) { s+=2; hits[`ROE improving: ${f.roe3yAvg.toFixed(0)}% → ${f.roe.toFixed(0)}%`]=2; }
    if(f.roe5yAvg && f.roe > f.roe5yAvg + 3) { s+=1; hits[`ROE 5Y improving trend`]=1; }
    if(f.roe < f.roe3yAvg - 3) { s-=2; hits[`⚠ ROE deteriorating: ${f.roe3yAvg.toFixed(0)}% → ${f.roe.toFixed(0)}%`]=-2; }
  }

  // Revenue Growth (3 pts)
  if(na(f.revGrowth) && f.revGrowth<300){
    const pp = f.revGrowth>=20?3 : f.revGrowth>=12?2 : f.revGrowth>=6?1 : f.revGrowth>=0?0 : 0;
    if(pp>0){ s+=pp; hits[`Revenue Growth: ${f.revGrowth.toFixed(1)}%`]=pp; }
    // Operating leverage
    if(na(f.earGrowth) && f.earGrowth > f.revGrowth+5){ s+=2; hits['Operating leverage: EPS > Revenue growth']=2; }
  }

  // Sector-specific KPI — Varsity Module 15
  if(isBanking){
    // NIM proxy: ROA > 1% = healthy bank
    if(na(f.roa)){
      const pp = f.roa>=2?4 : f.roa>=1?3 : f.roa>=0.5?1 : 0;
      s+=pp; hits[`ROA (bank proxy): ${f.roa.toFixed(2)}% ${f.roa<0.5?'⚠ poor':''}` ]=pp;
    }
    // P/BV replaces P/E for banking valuation
    if(na(f.pb)){
      const peerPct = pr(f.pb,'pb',false);
      const pp = peerPct>=70?4 : peerPct>=50?2 : 0;
      if(pp){ s+=pp; hits[`P/BV: ${f.pb.toFixed(2)}x (banking — cheaper than ${peerPct.toFixed(0)}% peers)`]=pp; }
    }
  }

  // -- PILLAR 2: TREND (25 pts) -------------------------------------------------
  // Varsity: "200 DMA is the line of truth"

  // Above 200 DMA (8 pts)
  if(na(px)&&na(f.dma200)){
    const pct200=((px-f.dma200)/f.dma200*100);
    const above=px>f.dma200;
    const pp = !above?0 : pct200<=25?8 : 4;
    s+=pp; hits[`200DMA: ${above?'Above':'Below'} (${pct200>=0?'+':''}${pct200.toFixed(1)}%)`]=pp;
  }

  // Golden Cross / Death Cross (7 pts)
  if(f.goldenCross!=null){
    const pp=f.goldenCross?7:0; s+=pp;
    hits[f.goldenCross?'Golden Cross (50>200 DMA)':'Death Cross (50<200 DMA)']=pp;
  }

  // Above 50 DMA (4 pts)
  if(na(px)&&na(f.dma50)){
    const pp=px>f.dma50?4:0; s+=pp;
    hits[`50DMA: ${px>f.dma50?'Above':'Below'}`]=pp;
  }

  // Supertrend (3 pts)
  if(f.supertrendSig){
    const pp=f.supertrendSig==='bullish'?3:0; s+=pp;
    if(pp||f.supertrendSig==='bearish') hits[`Supertrend: ${f.supertrendSig}`]=pp;
  }

  // RSI Divergence (3 pts)
  if(f.bullishDiv){ s+=3; hits['RSI Bullish Divergence (strongest reversal signal)']=3; }

  // Candlestick patterns — add confirmation bonus (Varsity M2: patterns need context)
  if(f.candlePatterns && f.candlePatterns.length>0){
    const bullPatterns = f.candlePatterns.filter(p=>p.type==='bullish');
    const bearPatterns = f.candlePatterns.filter(p=>p.type==='bearish');
    const maxRel = bullPatterns.length ? Math.max(...bullPatterns.map(p=>p.reliability)) : 0;
    if(maxRel>=3){ s+=2; hits[`${bullPatterns[0].pattern} (reliability: ${maxRel}/3)`]=2; }
    if(maxRel===2){ s+=1; hits[`${bullPatterns[0].pattern} (reliability: ${maxRel}/3)`]=1; }
    if(bearPatterns.length && Math.max(...bearPatterns.map(p=>p.reliability))>=3){ s-=2; hits[`Bearish: ${bearPatterns[0].pattern}`]=-2; }
  }

  // -- PILLAR 3: MOMENTUM (10 pts) ---------------------------------------------

  // RSI zone (4 pts)
  if(na(f.rsi)){
    const pp = f.rsi>=40&&f.rsi<=65?4 : f.rsi>=35&&f.rsi<=70?3 : f.rsi<35?2 : 0;
    s+=pp; hits[`RSI: ${f.rsi.toFixed(0)} ${f.rsi<30?'(oversold)':f.rsi>70?'(overbought)':''}`]=pp;
  }

  // Volume / OBV (3 pts)
  if(f.obvRising!=null){ const pp=f.obvRising?2:0; if(pp){s+=pp; hits[`OBV: Rising (accumulation)`]=pp;} }
  if(na(f.volRatio)&&f.volRatio>1.5){ s+=1; hits[`Volume spike: ${f.volRatio.toFixed(2)}x avg`]=1; }

  // MACD (3 pts)
  if(f.macdBull!=null){ const pp=f.macdBull?3:0; s+=pp; hits[`MACD: ${f.macdBull?'Bullish':'Bearish'}`]=pp; }

  // ADX trend strength — Varsity M2 Ch 21: +DI > -DI = bullish trend direction (2 pts bonus)
  if(na(f.adxPdi) && na(f.adxNdi)){
    if(f.adxPdi>f.adxNdi && f.adx>25){ s+=2; hits[`ADX: +DI(${f.adxPdi.toFixed(0)}) > -DI(${f.adxNdi.toFixed(0)}) trending bullish`]=2; }
    if(f.adxNdi>f.adxPdi && f.adx>25){ s-=1; hits[`ADX: -DI(${f.adxNdi.toFixed(0)}) > +DI(${f.adxPdi.toFixed(0)}) bearish trend`]=-1; }
  }

  // -- PILLAR 4: VALUATION (20 pts) --------------------------------------------

  // P/E — sector-percentile ranked (8 pts) — skip for banking (use P/BV above)
  if(!isBanking && na(f.pe)&&f.pe>0&&f.pe<400){
    const peerPct = pr(f.pe,'pe',false);
    const pp = peerPct>=80?8 : peerPct>=60?6 : peerPct>=40?4 : peerPct>=20?2 : 0;
    s+=pp; hits[`P/E: ${f.pe.toFixed(1)}x (cheaper than ${peerPct.toFixed(0)}% of sector)`]=pp;
  }

  // PEG (5 pts)
  if(na(f.pe)&&na(f.earGrowth)&&f.earGrowth>0){
    const peg=f.pe/f.earGrowth;
    const pp = peg<0.5?5 : peg<1?4 : peg<2?2 : peg<3?1 : 0;
    s+=pp; hits[`PEG: ${peg.toFixed(2)} (${peg<1?'growth underpriced':'fairly/overpriced'})`]=pp;
  }

  // Intrinsic Value — Varsity M3 / M13: PEG-based fair value estimate (5 pts)
  // Fair PE = EPS Growth × 1.5 (modified PEG), Intrinsic Value = Fair PE × EPS
  if(na(f.pe) && na(f.earGrowth) && f.earGrowth>0 && na(f.eps) && f.eps>0){
    const fairPE = f.earGrowth * 1.5;
    const intrinsic = fairPE * f.eps;
    const mos = px ? (intrinsic - px) / intrinsic * 100 : null; // Margin of Safety
    if(na(mos)){
      if(mos>25)     { s+=5; hits[`MoS: ${mos.toFixed(0)}% below intrinsic value ₹${intrinsic.toFixed(0)}`]=5; }
      else if(mos>10){ s+=2; hits[`MoS: ${mos.toFixed(0)}% — modest discount to intrinsic`]=2; }
      else if(mos<-30){ s-=3; hits[`⚠ Overvalued: ${Math.abs(mos).toFixed(0)}% above intrinsic value ₹${intrinsic.toFixed(0)}`]=-3; }
    }
  }

  // PE/ROE quality-adjusted valuation (3 pts)
  if(na(f.pe)&&f.pe>0&&na(f.roe)&&f.roe>0){
    const perRoe=f.pe/f.roe;
    const pp = perRoe<1?3 : perRoe<2?2 : 0;
    if(pp>0){ s+=pp; hits[`PE/ROE: ${perRoe.toFixed(2)} (quality-adjusted value)`]=pp; }
  }

  // Discount from 52W high (3 pts)
  if(na(f.pctFromHigh)){
    const d=Math.abs(f.pctFromHigh);
    const pp = d>=30?3 : d>=20?2 : d>=10?1 : 0;
    if(pp>0){ s+=pp; hits[`Discount from peak: ${f.pctFromHigh?.toFixed(1)}%`]=pp; }
  }

  // -- HARD DISQUALIFIERS (Varsity M3 Ch 12 red flags) --------

  // Interest Coverage (Screener data)
  if(na(f.intCov)){
    if(f.intCov>=5)      { s+=4; hits[`Interest Coverage: ${f.intCov.toFixed(1)}x (comfortable)`]=4; }
    else if(f.intCov>=3) { s+=3; hits[`Interest Coverage: ${f.intCov.toFixed(1)}x (adequate)`]=3; }
    else if(f.intCov>=1.5){ s+=1; hits[`Interest Coverage: ${f.intCov.toFixed(1)}x (thin)`]=1; }
    else { s-=5; hits[`⚠ Interest Coverage: ${f.intCov.toFixed(1)}x (DANGER — Varsity red flag)`]=-5; }
  }

  // Promoter data
  if(na(f.promoter)){
    const pp = f.promoter>=60?3 : f.promoter>=50?2 : f.promoter>=40?1 : 0;
    if(pp){ s+=pp; hits[`Promoter holding: ${f.promoter.toFixed(1)}%`]=pp; }
  }
  if(na(f.pledged)&&f.pledged>30){ s-=5; hits[`⚠ Promoter pledged ${f.pledged.toFixed(1)}% (red flag)`]=-5; }
  if(na(f.promoterChg)&&f.promoterChg<-2){ s-=2; hits[`⚠ Promoter selling: ${f.promoterChg.toFixed(1)}%`]=-2; }

  // P/BV
  if(na(f.pb)&&f.pb>0){
    const peerPct = pr(f.pb,'pb',false);
    const pp = peerPct>=80?3 : peerPct>=60?2 : peerPct>=40?1 : 0;
    if(pp){ s+=pp; hits[`P/BV: ${f.pb.toFixed(2)}x (cheaper than ${peerPct.toFixed(0)}% of peers)`]=pp; }
  }

  // EPS / Revenue collapse penalties
  if(na(f.earGrowth)&&f.earGrowth<-20){ s-=10; hits['⚠ EPS collapse (value trap signal)']=-10; }
  if(na(f.revGrowth)&&f.revGrowth<-15){ s-=8;  hits['⚠ Revenue declining sharply']=-8; }
  if(na(f.debtToEq)&&f.debtToEq>4)   { s-=5;  hits['⚠ Extreme leverage (D/E > 4x)']=-5; }

  return { score: Math.min(Math.round(s*10)/10, 100), hits };
}




// =============================================================================
// FALLEN ANGEL SCORING — Varsity-derived framework
// Sources: Module 2 (TA reversal signals) + Module 3 (FA quality screen)
//
// Varsity principle: "Maximum pessimism = maximum opportunity — IF the business
// is fundamentally sound." A stock down 50% with ROE>15% and D/E<1 = Fallen Angel.
// A stock down 50% with collapsing EPS = value trap. The difference is everything.
//
// PILLARS:
//   Business Quality (40 pts) — Varsity checklist: ROE, debt, earnings, margins
//   Depth of Fall    (20 pts) — Deeper = bigger opportunity (if quality intact)
//   Oversold Signal  (20 pts) — Varsity: RSI<30 = oversold, <25 = extreme oversold
//   Valuation        (15 pts) — Varsity: fallen stock should now be cheap on P/E, PE/ROE
//   Recovery Signals (15 pts) — Varsity: RSI divergence + OBV accumulation = reversal starting
//   Penalties               — Varsity Ch12 red flags: EPS collapse, extreme debt, revenue fall
// =============================================================================
function scoreFallenAngel(f) {
  // ==========================================================================
  // FALLEN ANGEL SCORING — 100 points
  // Built entirely from Zerodha Varsity Modules 2 (TA) + 3 (FA) + 15 (Sector)
  //
  // Size-aware: Varsity says smaller caps need stricter quality but reward
  // deeper falls more — higher volatility = bigger overshoot = bigger opportunity
  //
  // Framework:
  //   PILLAR 1: Business Quality  (40 pts) — Varsity M3: ROE, D/E, margins, EPS
  //   PILLAR 2: Depth of Fall     (15 pts) — deeper fall + intact business = more fear = more opportunity
  //   PILLAR 3: Oversold Signals  (20 pts) — Varsity M2: RSI, Stochastic, BB, ADX
  //   PILLAR 4: Valuation         (12 pts) — Varsity M3: PE/ROE, PEG, 52W low proximity
  //   PILLAR 5: Recovery Signals  (13 pts) — Varsity M2: RSI Div, OBV, MACD, Volume, Supertrend
  //   PENALTIES                   (-30 max) — Varsity Ch12 red flags
  // ==========================================================================

  let s = 0;
  const hits = {};
  const na = v => v != null && isFinite(v);
  const px = f.price || livePrices[f.sym]?.price;

  // Cap size context — affects scoring weights
  const isSmall = f.grp === 'SMALLCAP';
  const isMid   = f.grp === 'MIDCAP';
  const capLabel = isSmall ? 'SmallCap' : isMid ? 'MidCap' : 'LargeCap';

  // ==========================================================================
  // PILLAR 1: BUSINESS QUALITY (40 pts)
  // Varsity: "Only invest in Fallen Angels where business quality is unquestionably intact"
  // This separates RECOVERY from VALUE TRAP. A fallen stock needs a standing business.
  // ==========================================================================

  // ROE — Varsity: single most important profitability ratio
  // "ROE > 15% consistently = excellent quality; < 10% = poor use of capital"
  // Higher weight here because fallen stock with high ROE = most likely to recover
  if (na(f.roe)) {
    const pp = f.roe >= 25 ? 14
             : f.roe >= 20 ? 11
             : f.roe >= 15 ? 8
             : f.roe >= 12 ? 4
             : f.roe >= 8  ? 1 : 0;
    s += pp;
    hits[`ROE: ${f.roe.toFixed(1)}% ${f.roe >= 15 ? '(quality)' : f.roe >= 10 ? '(average)' : '(weak)'}`] = pp;
  }

  // D/E Ratio — Varsity: "High debt during a fall amplifies bankruptcy risk"
  // During falls, companies need balance sheet strength to survive + recover
  // Varsity: D/E < 0.5 = safe, > 2 = risky, > 4 = danger zone
  if (na(f.debtToEq)) {
    const pp = f.debtToEq <= 0.2 ? 12
             : f.debtToEq <= 0.5 ? 10
             : f.debtToEq <= 1.0 ? 7
             : f.debtToEq <= 1.5 ? 4
             : f.debtToEq <= 2.5 ? 1 : 0;
    s += pp;
    hits[`D/E: ${f.debtToEq.toFixed(2)}x ${f.debtToEq <= 1 ? '(manageable)' : f.debtToEq <= 2 ? '(elevated)' : '(risky)'}`] = pp;
  }

  // Operating Margin — Varsity: "Increasing margin = management efficiency improving"
  // Tracks whether core business profitability is intact through the fall
  if (na(f.opMargin)) {
    const pp = f.opMargin >= 25 ? 7
             : f.opMargin >= 18 ? 6
             : f.opMargin >= 12 ? 4
             : f.opMargin >= 6  ? 2
             : f.opMargin >= 0  ? 1 : 0;
    s += pp;
    hits[`Op Margin: ${f.opMargin.toFixed(1)}%`] = pp;
  }

  // EPS Growth — Varsity: "Declining EPS during a fall = business is broken, not just cheap"
  // Positive EPS growth during a fall = market overreacting = ideal Fallen Angel
  if (na(f.earGrowth) && f.earGrowth < 400) {
    const pp = f.earGrowth >= 25 ? 7
             : f.earGrowth >= 15 ? 5
             : f.earGrowth >= 5  ? 3
             : f.earGrowth >= 0  ? 1 : 0;
    s += pp;
    hits[`EPS Growth: ${f.earGrowth.toFixed(1)}% ${f.earGrowth >= 0 ? '' : '(⚠ declining)'}`] = pp;
  }

  // ==========================================================================
  // PILLAR 2: DEPTH OF FALL (15 pts)
  // Varsity Dow Theory: "Bear Market Phase 3 = maximum fear = maximum opportunity"
  // Deeper fall on an intact business = more margin of safety = better Fallen Angel
  // Varsity on smallcap: "Market overshoots more on smaller names — deeper falls are
  // more likely to be temporary rather than structural"
  // ==========================================================================
  if (na(f.pctFromHigh)) {
    const d = Math.abs(f.pctFromHigh);
    // Smallcaps get extra points for deep falls — market overshoots more
    const bonus = isSmall ? 2 : isMid ? 1 : 0;
    const pp = Math.min(15, (d >= 55 ? 15 : d >= 45 ? 13 : d >= 35 ? 11 : d >= 25 ? 8 : d >= 20 ? 5 : 0) + bonus);
    s += pp;
    hits[`${capLabel} fallen ${d.toFixed(0)}% from peak${bonus ? ` (+${bonus} smallcap overshoot bonus)` : ''}`] = pp;
  }

  // Proximity to 52W Low — Varsity: near 52W low = maximum pessimism zone
  // Stocks near their 52W low have maximum selling pressure already absorbed
  if (na(f.pctFromHigh) && na(f.wk52Lo) && na(px) && px > 0 && f.wk52Lo > 0) {
    const pctAboveLow = ((px - f.wk52Lo) / f.wk52Lo) * 100;
    if (pctAboveLow <= 5) {
      s += 3; hits['Near 52W low — maximum pessimism zone'] = 3;
    } else if (pctAboveLow <= 12) {
      s += 1; hits['Close to 52W low — high fear zone'] = 1;
    }
  }

  // ==========================================================================
  // PILLAR 3: OVERSOLD SIGNALS (20 pts)
  // Varsity M2: "RSI < 30 = oversold; RSI < 25 = extreme oversold — highest probability reversal"
  // Multiple oversold indicators confirming = strongest entry signal
  // ==========================================================================

  // RSI — Primary oversold signal (Varsity: most important oscillator for Fallen Angels)
  if (na(f.rsi)) {
    const pp = f.rsi <= 20 ? 10  // extreme oversold — historical base rate: 78% bounce within 30 days
             : f.rsi <= 25 ? 9
             : f.rsi <= 30 ? 7
             : f.rsi <= 35 ? 5
             : f.rsi <= 40 ? 3
             : f.rsi <= 45 ? 1 : 0;
    s += pp;
    hits[`RSI: ${f.rsi.toFixed(0)} ${f.rsi <= 30 ? '(extreme oversold)' : f.rsi <= 40 ? '(oversold)' : ''}`] = pp;
  }

  // Stochastic < 20 — Varsity: second oscillator confirmation
  // Stoch and RSI both oversold = double confirmation = stronger signal
  if (na(f.stochK)) {
    const pp = f.stochK <= 10 ? 5
             : f.stochK <= 20 ? 3
             : f.stochK <= 30 ? 1 : 0;
    s += pp;
    if (pp) hits[`Stochastic: ${f.stochK.toFixed(0)} (${f.stochK <= 20 ? 'oversold confirmation' : 'near oversold'})`] = pp;
  }

  // Bollinger Bands %B — Varsity: "%B < 0 = price below lower band = extreme oversold"
  // Price below lower BB = 2 std devs below mean = statistically rare = mean reversion likely
  if (na(f.bbPct)) {
    const pp = f.bbPct <= 0   ? 5  // below lower band — statistically extreme
             : f.bbPct <= 0.1 ? 3  // at lower band
             : f.bbPct <= 0.2 ? 1 : 0;
    s += pp;
    if (pp) hits[`BB %B: ${f.bbPct.toFixed(2)} ${f.bbPct <= 0 ? '(below lower band — extreme)' : '(at lower band)'}`] = pp;
  }

  // ==========================================================================
  // PILLAR 4: VALUATION (12 pts)
  // Varsity: "After a fall, the stock should now be CHEAP on valuation"
  // Margin of safety = intrinsic value significantly above market price
  // ==========================================================================

  // PE Ratio — cheap after the fall?
  if (na(f.pe) && f.pe > 0 && f.pe < 200) {
    const pp = f.pe < 8  ? 5
             : f.pe < 12 ? 4
             : f.pe < 18 ? 3
             : f.pe < 25 ? 1 : 0;
    s += pp;
    if (pp) hits[`P/E: ${f.pe.toFixed(1)}x ${f.pe < 15 ? '(cheap post-fall)' : '(still elevated)'}`] = pp;
  }

  // PE/ROE — Varsity: "Quality-adjusted value ratio"
  // PE/ROE < 1 = paying less than the return on equity justifies = clear value
  // Peter Lynch: PEG < 1 = growth at a discount; PE/ROE < 1 = value at quality
  if (na(f.pe) && f.pe > 0 && na(f.roe) && f.roe > 0) {
    const perRoe = f.pe / f.roe;
    const pp = perRoe < 0.5 ? 5
             : perRoe < 0.8 ? 4
             : perRoe < 1.2 ? 3
             : perRoe < 2.0 ? 1 : 0;
    s += pp;
    if (pp) hits[`PE/ROE: ${perRoe.toFixed(2)} ${perRoe < 1 ? '(paying < ROE = value)' : ''}`] = pp;
  }

  // PEG — Varsity: "PEG < 1 = growth available at a discount; PEG > 2 = overvalued growth"
  if (na(f.pe) && f.pe > 0 && na(f.earGrowth) && f.earGrowth > 0) {
    const peg = f.pe / f.earGrowth;
    const pp = peg < 0.5 ? 2
             : peg < 1.0 ? 1 : 0;
    s += pp;
    if (pp) hits[`PEG: ${peg.toFixed(2)} (growth at discount)`] = pp;
  }

  // ==========================================================================
  // PILLAR 5: RECOVERY SIGNALS (13 pts)
  // Varsity: "Best entry combines oversold RSI + volume accumulation + reversal pattern"
  // These signals indicate the TURNING POINT is approaching or has begun
  // ==========================================================================

  // RSI Bullish Divergence — Varsity: "STRONGEST reversal signal for Fallen Angels"
  // Price makes lower low BUT RSI makes higher low = selling pressure exhausted
  // Varsity explicitly calls this the #1 signal to watch on oversold quality stocks
  if (f.bullishDiv) {
    s += 6;
    hits['RSI Bullish Divergence — selling exhaustion (Varsity: #1 reversal signal)'] = 6;
  }

  // OBV Rising — Varsity: "Rising OBV with flat/falling price = institutional accumulation in stealth"
  // Smart money buys quietly. OBV rising while price flat/falling = distribution ending
  if (f.obvRising != null) {
    const pp = f.obvRising ? 3 : 0;
    if (pp) { s += pp; hits['OBV Rising — institutional accumulation (stealth buying)'] = pp; }
  }

  // Volume Climax — Varsity: "Climax volume at extremes = exhaustion signal = potential reversal"
  // High volume on down days near support = sellers running out = accumulation beginning
  if (na(f.volRatio)) {
    if (f.volRatio >= 2.5) {
      s += 2; hits[`Volume climax: ${f.volRatio.toFixed(1)}x avg — exhaustion/capitulation likely`] = 2;
    } else if (f.volRatio >= 1.5) {
      s += 1; hits[`Elevated volume: ${f.volRatio.toFixed(1)}x avg`] = 1;
    }
  }

  // MACD Bullish Crossover — Varsity: "MACD crosses above Signal = momentum beginning to reverse"
  if (f.macdBull != null) {
    const pp = f.macdBull ? 2 : 0;
    if (pp) { s += pp; hits['MACD turning bullish — momentum reversing'] = pp; }
  }

  // Near 200DMA — Varsity: "200DMA = line of truth. Price near 200DMA = institutional buy zone"
  // Institutions use 200DMA as primary accumulation reference
  if (na(f.pctAbove200)) {
    const pct = f.pctAbove200;
    if (pct >= -5 && pct <= 5) {
      s += 2; hits['Price at 200DMA — institutional buy zone (Varsity: line of truth)'] = 2;
    } else if (pct >= -12 && pct < -5) {
      s += 1; hits['Approaching 200DMA support zone'] = 1;
    }
  }

  // Supertrend bullish flip — price reclaimed supertrend = trend change confirmation
  if (f.supertrendSig === 'bullish') {
    s += 1; hits['Supertrend flipped bullish — trend change signal'] = 1;
  }

  // RSI Bearish Divergence penalty — Varsity: opposite of bullish div = further downside likely
  if (f.bearishDiv) {
    s -= 4;
    hits['⚠ RSI Bearish Divergence — further downside possible'] = -4;
  }

  // ==========================================================================
  // PENALTIES — Varsity Chapter 12: Red Flags
  // Varsity: "Red flags override attractive numbers. Drop the stock. Full stop."
  // These are deal-breakers that turn Fallen Angels into value traps
  // ==========================================================================

  // EPS Collapse — Varsity: "Declining EPS during a fall = business is broken, not just cheap"
  if (na(f.earGrowth)) {
    if (f.earGrowth < -30)      { s -= 15; hits['⚠ EPS collapse >30% (severe business deterioration)'] = -15; }
    else if (f.earGrowth < -20) { s -= 10; hits['⚠ EPS collapse >20% — value trap signal'] = -10; }
    else if (f.earGrowth < -10) { s -= 5;  hits['⚠ EPS declining >10% — caution'] = -5; }
  }

  // Revenue Decline — Varsity: "Revenue decline = structural problem; no top line = no future"
  if (na(f.revGrowth)) {
    if (f.revGrowth < -20)      { s -= 10; hits['⚠ Revenue collapsing >20% — structural concern'] = -10; }
    else if (f.revGrowth < -10) { s -= 6;  hits['⚠ Revenue declining >10%'] = -6; }
    else if (f.revGrowth < -5)  { s -= 3;  hits['⚠ Revenue shrinking'] = -3; }
  }

  // Extreme Debt — Varsity: "D/E > 2 is risky; high debt during a fall = greater risk of default"
  if (na(f.debtToEq)) {
    if (f.debtToEq > 5)        { s -= 12; hits['⚠ Extreme leverage D/E>5x — near-insolvency risk'] = -12; }
    else if (f.debtToEq > 3.5) { s -= 7;  hits['⚠ Very high leverage D/E>3.5x — distress risk'] = -7; }
    else if (f.debtToEq > 2.5) { s -= 3;  hits['⚠ High leverage D/E>2.5x — elevated risk'] = -3; }
  }

  // Extremely Overbought Relative to Fall — still expensive after the fall (PE > 50 while fallen)
  if (na(f.pe) && f.pe > 50 && na(f.pctFromHigh) && Math.abs(f.pctFromHigh) >= 20) {
    s -= 4; hits['⚠ Still expensive (PE>50) despite large fall — valuation not reset'] = -4;
  }

  // Operating Margin deeply negative — business losing money at operating level
  if (na(f.opMargin) && f.opMargin < -5) {
    s -= 5; hits[`⚠ Negative operating margin ${f.opMargin.toFixed(1)}% — core business loss-making`] = -5;
  }

  // ==========================================================================
  // FINAL SCORE + VERDICT
  // ==========================================================================
  const finalScore = Math.min(100, Math.max(0, Math.round(s)));

  // Verdicts aligned with Varsity conviction levels
  let verdict, verdictColor, verdictIcon;
  if (finalScore >= 82)      { verdict = 'Strong Dip Buy';    verdictColor = '#22c55e'; verdictIcon = '🚀'; }
  else if (finalScore >= 67) { verdict = 'Good Dip Buy';      verdictColor = '#86efac'; verdictIcon = '✅'; }
  else if (finalScore >= 52) { verdict = 'Accumulate Slowly'; verdictColor = '#f59e0b'; verdictIcon = '📈'; }
  else if (finalScore >= 37) { verdict = 'Watch & Wait';      verdictColor = '#f97316'; verdictIcon = '⏳'; }
  else                       { verdict = 'Likely Value Trap'; verdictColor = '#ef4444'; verdictIcon = '⚠️'; }

  return { fallenScore: finalScore, fallenHits: hits, fallenVerdict: verdict, fallenColor: verdictColor, fallenIcon: verdictIcon };
}



app.get('/api/stocks/score', async(req,res)=>{
  try {
    const empty = Object.keys(stockFundamentals).length === 0;
    const stale = Date.now()-stockFundLastFetch > 23*3600*1000;

    if (empty && !stockFundLoading) {
      refreshAllFundamentals();
    }
    if (stale && !stockFundLoading) refreshAllFundamentals();

    // Return whatever partial data we have (even if still loading)
    // This lets the UI render progressively instead of blocking

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
      // Varsity Fallen Angel filter:
      // 1. Score >= 50 (business quality screen — only quality businesses can be Fallen Angels)
      // 2. Down >= 20% from 52W high (fear-driven fall, not gradual decline)
      // 3. RSI <= 52 (not overbought — momentum must be subdued or oversold)
      // Size-aware Fallen Angel filter — Varsity: smaller caps need stricter quality gates
      // SMALLCAP: D/E ≤ 1.0, pledged ≤ 20%, intCov ≥ 2x, fall ≥ 25%, EPS > -15%
      // MIDCAP:   D/E ≤ 1.5, pledged ≤ 35%, intCov ≥ 1.5x, fall ≥ 20%, EPS > -20%
      // LARGECAP: D/E ≤ 2.0, pledged ≤ 50%, intCov ≥ 1.0x, fall ≥ 20%, EPS > -25%
      const isSmall = f.grp === 'SMALLCAP';
      const isMid   = f.grp === 'MIDCAP';
      const deThresh    = isSmall ? 1.0  : isMid ? 1.5  : 2.0;
      const pledgeThresh= isSmall ? 20   : isMid ? 35   : 50;
      const intCovThresh= isSmall ? 2.0  : isMid ? 1.5  : 1.0;
      const fallThresh  = isSmall ? -25  : -20;   // smallcap needs deeper fall to qualify
      const epsThresh   = isSmall ? -15  : isMid ? -20  : -25;
      const scoreThresh = isSmall ? 55   : isMid ? 52   : 50;  // higher quality bar for smaller caps

      const isFa = score >= scoreThresh
        && (f.pctFromHigh || 0) <= fallThresh
        && (f.rsi || 50) <= 52
        && (f.debtToEq == null || f.debtToEq <= deThresh)
        && (f.earGrowth == null || f.earGrowth > epsThresh)
        && (f.opMargin == null || f.opMargin > -10)
        && (f.pledged  == null || f.pledged  <= pledgeThresh)
        && (f.intCov   == null || f.intCov   >= intCovThresh);
      const faData = isFa ? scoreFallenAngel(f) : {};
      // Stop loss + R:R (Meera: Risk Analyst)
      const stopData = px ? computeStopAndTarget({...f, price:px}) : null;
      return {
        sym:f.sym, name:f.name, grp:f.grp, sector:f.sector, score, hits,
        // Fallen Angel
        ...faData, isFallenAngel:isFa,
        // Stop loss + R:R
        stopLoss: stopData?.stopLoss, target: stopData?.target,
        riskPct: stopData?.riskPct, rewardPct: stopData?.rewardPct,
        rrRatio: stopData?.rrRatio, goodRR: stopData?.acceptable,
        // Fundamentals — core
        roe:f.roe!=null?+f.roe.toFixed(1):null,
        debtToEq:f.debtToEq!=null?+f.debtToEq.toFixed(2):null,
        opMargin:f.opMargin!=null?+f.opMargin.toFixed(1):null,
        pe:f.pe!=null?+f.pe.toFixed(1):null,
        peg:f.peg!=null?+f.peg.toFixed(2):null,
        revGrowth:f.revGrowth!=null?+f.revGrowth.toFixed(1):null,
        earGrowth:f.earGrowth!=null?+f.earGrowth.toFixed(1):null,
        // Fundamentals — from Screener.in
        roa:         f.roa!=null?+f.roa.toFixed(1):null,
        pb:          f.pb!=null?+f.pb.toFixed(2):null,
        intCov:      f.intCov!=null?+f.intCov.toFixed(1):null,
        promoter:    f.promoter!=null?+f.promoter.toFixed(1):null,
        pledged:     f.pledged!=null?+f.pledged.toFixed(1):null,
        promoterChg: f.promoterChg!=null?+f.promoterChg.toFixed(1):null,
        mktCap:      f.mktCap!=null?+f.mktCap.toFixed(0):null,
        divYield:    f.divYield!=null?+f.divYield.toFixed(2):null,
        eps:         f.eps!=null?+f.eps.toFixed(2):null,
        roe3yAvg:    f.roe3yAvg!=null?+f.roe3yAvg.toFixed(1):null,
        salesGr1y:   f.salesGr1y!=null?+f.salesGr1y.toFixed(1):null,
        salesGr5y:   f.salesGr5y!=null?+f.salesGr5y.toFixed(1):null,
        epsGr5y:     f.epsGr5y!=null?+f.epsGr5y.toFixed(1):null,
        ret1y:       f.ret1y!=null?+f.ret1y.toFixed(1):null,
        ret3y:       f.ret3y!=null?+f.ret3y.toFixed(1):null,
        ret5y:       f.ret5y!=null?+f.ret5y.toFixed(1):null,
        ret6m:       f.ret6m!=null?+f.ret6m.toFixed(1):null,
        ret3m:       f.ret3m!=null?+f.ret3m.toFixed(1):null,
        epsGr1y:     f.epsGr1y!=null?+f.epsGr1y.toFixed(1):null,
        roe5yAvg:    f.roe5yAvg!=null?+f.roe5yAvg.toFixed(1):null,
        currentRatio:f.currentRatio!=null?+f.currentRatio.toFixed(2):null,
        debt:        f.debt!=null?+f.debt:null,
        roce:        f.roce!=null?+f.roce.toFixed(1):null,
        evEbitda:    f.evEbitda!=null?+f.evEbitda.toFixed(1):null,
        earningsYield:f.earningsYield!=null?+f.earningsYield.toFixed(2):null,
        priceToFCF:  f.priceToFCF!=null?+f.priceToFCF.toFixed(1):null,
        priceToSales:f.priceToSales!=null?+f.priceToSales.toFixed(2):null,
        patQtr:      f.patQtr!=null?+f.patQtr:null,
        salesQtr:    f.salesQtr!=null?+f.salesQtr:null,
        patAnnual:   f.patAnnual!=null?+f.patAnnual:null,
        salesAnnual: f.salesAnnual!=null?+f.salesAnnual:null,
        patQtrYoy:   f.patQtrYoy!=null?+f.patQtrYoy.toFixed(1):null,
        salesQtrYoy: f.salesQtrYoy!=null?+f.salesQtrYoy.toFixed(1):null,
        // Yahoo Finance exclusive fields
        fwdPE:       f.fwdPE!=null?+f.fwdPE.toFixed(1):null,
        grossMgn:    f.grossMgn!=null?+f.grossMgn.toFixed(1):null,
        profMgn:     f.profMgn!=null?+f.profMgn.toFixed(1):null,
        quickRatio:  f.quickRatio!=null?+f.quickRatio.toFixed(2):null,
        fcf:         f.fcf!=null?+f.fcf:null,
        instHeld:    f.instHeld!=null?+f.instHeld.toFixed(1):null,
        bookValue:   f.bookValue!=null?+f.bookValue.toFixed(2):null,
        fiiHolding:  f.fiiHolding!=null?+f.fiiHolding.toFixed(1):null,
        diiHolding:  f.diiHolding!=null?+f.diiHolding.toFixed(1):null,
        numShareholders: f.numShareholders!=null?+f.numShareholders:null,
        industryPE:  f.industryPE!=null?+f.industryPE.toFixed(1):null,
        dataSource:  f.dataSource||'Hardcoded',
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
        // RSI divergence (Arjun: Quant signal)
        rsiTrend:f.rsiTrend, bullishDiv:f.bullishDiv, bearishDiv:f.bearishDiv,
        fetchedAt:f.fetchedAt,
      };
    });

    scored.sort((a,b)=>b.score-a.score);
    scored.forEach((s,i)=>{s.rank=i+1;});

    // Fire Telegram alerts for new Fallen Angels (async, non-blocking)
    checkAndSendAlerts(scored).catch(e=>console.log('Alert error:',e.message));

    res.json({
      stocks:scored, total:scored.length,
      loading:stockFundLoading,
      loadingMsg:stockFundLoading?'Refreshing in background...':null,
      last_refresh: stockFundLastFetch
        ? new Date(stockFundLastFetch).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})
        : 'Never',
      market_open: isMarketOpen(),
      data_source: 'Kite historical daily candles + static fundamentals (Screener.in Q3FY25)',
      universe_status: universeUpdateStatus,
      universe_total: UNIVERSE.length,
    });
  } catch(e){ res.status(500).json({error:e.message,stocks:[]}); }
});

// =============================================================================
// PORTFOLIO MANAGER ENGINE — Full Fund Manager (Varsity M2+M3+M9+M10+M11)
// Two-Portfolio Architecture:
//   MODEL PORTFOLIO = ideal portfolio based on current market data
//   USER PORTFOLIO  = what the user actually holds (persisted in DB)
//   SIGNALS         = diff between them + exit conditions + rebalancing
// =============================================================================

// In-memory caches
const portfolioSuggestions = {};
let modelPortfolio = null;       // current model portfolio
let marketRegime = 'NEUTRAL';    // BULL / BEAR / NEUTRAL
let marketRegimeData = {};       // detailed regime info

// ── MARKET REGIME DETECTION (Varsity M9 Ch3: adapt to market conditions) ──
function detectMarketRegime() {
  // Use Nifty benchmark data + broad market breadth
  const nf = niftyBenchmark || {};
  const all = Object.values(stockFundamentals);
  if (!all.length) return;

  // Nifty trend analysis
  const nifty52w = nf['52w'] || 0;
  const nifty6m  = nf['6m']  || 0;
  const nifty3m  = nf['3m']  || 0;
  const nifty1m  = nf['1m']  || 0;

  // Market breadth — how many stocks above 200DMA
  const abv200Count = all.filter(f => f.pctAbove200 != null && f.pctAbove200 > 0).length;
  const breadth = all.length > 0 ? (abv200Count / all.length) * 100 : 50;

  // Advance-decline from momentum
  const advCount = all.filter(f => f.change1m != null && f.change1m > 0).length;
  const adRatio = all.length > 0 ? advCount / all.length : 0.5;

  // Determine regime
  let regime = 'NEUTRAL';
  let confidence = 50;
  let cashSuggestion = 10; // default 10% cash

  if (nifty6m > 0.05 && nifty3m > 0.02 && breadth > 55 && adRatio > 0.55) {
    regime = 'BULL';
    confidence = Math.min(90, 50 + breadth * 0.4 + nifty6m * 100);
    cashSuggestion = 5; // less cash in bull market
  } else if (nifty6m < -0.05 && breadth < 40 && adRatio < 0.4) {
    regime = 'BEAR';
    confidence = Math.min(90, 50 + (100 - breadth) * 0.4 + Math.abs(nifty6m) * 100);
    cashSuggestion = 25; // more cash in bear market
  } else if (nifty3m < -0.08 && nifty1m < -0.05) {
    regime = 'BEAR';
    confidence = 65;
    cashSuggestion = 20;
  } else if (nifty3m > 0.08 && breadth > 60) {
    regime = 'BULL';
    confidence = 70;
    cashSuggestion = 5;
  }

  marketRegime = regime;
  marketRegimeData = {
    regime, confidence: +confidence.toFixed(0), cashSuggestion,
    breadth: +breadth.toFixed(1), adRatio: +adRatio.toFixed(2),
    nifty: { '52w': +(nifty52w*100).toFixed(1), '6m': +(nifty6m*100).toFixed(1),
             '3m': +(nifty3m*100).toFixed(1), '1m': +(nifty1m*100).toFixed(1) },
    abv200Count, totalStocks: all.length,
  };
  console.log(`🏛 Market Regime: ${regime} (confidence ${confidence.toFixed(0)}%) | Breadth: ${breadth.toFixed(0)}% above 200DMA | Cash suggestion: ${cashSuggestion}%`);
}

// ── MULTI-FACTOR STOCK SCORING (Varsity M2+M3+M9: Quality×Valuation×Technical×Momentum×Risk) ──
function scoreStockForPortfolio(f) {
  const na = v => v != null && isFinite(v);
  // Price resolution chain: live ticker → cached fundamental → screener DB → FUND_EXT
  const ext = global.FUND_EXT?.[f.sym];
  const px = f.price || livePrices[f.sym]?.price || ext?.price || ext?.currentPrice || null;
  if (!px || px <= 0) return null;

  const peers = Object.values(stockFundamentals).filter(p => p.sector === f.sector);
  const { score: faRawScore } = scoreOneStock(f, peers.length > 3 ? peers : Object.values(stockFundamentals));
  const stopData = computeStopAndTarget({ ...f, price: px });

  // === PILLAR 1: QUALITY GATE (Varsity M3 Ch12 — checklist) ===
  // Pass/fail filter — stocks that fail quality don't enter universe
  let qualityPass = true;
  const qualityFlags = [];

  // Must have SOME data to evaluate
  if (faRawScore < 15) { qualityPass = false; qualityFlags.push('FA too low'); }
  // Catastrophic debt
  if (na(f.debtToEq) && f.debtToEq > 3) { qualityPass = false; qualityFlags.push('D/E > 3'); }
  // EPS in freefall
  if (na(f.earGrowth) && f.earGrowth < -40) { qualityPass = false; qualityFlags.push('EPS collapse'); }
  // Extreme overbought
  if (na(f.rsi) && f.rsi > 85) { qualityPass = false; qualityFlags.push('RSI > 85'); }
  // Penny stocks
  if (px < 10) { qualityPass = false; qualityFlags.push('Penny stock'); }

  // In bear market, raise quality bar
  if (marketRegime === 'BEAR') {
    if (faRawScore < 30) { qualityPass = false; qualityFlags.push('Bear: FA < 30'); }
    if (na(f.debtToEq) && f.debtToEq > 1.5) { qualityPass = false; qualityFlags.push('Bear: D/E > 1.5'); }
  }

  if (!qualityPass) return null;

  // === PILLAR 2: VALUATION SCORE (0-100) (Varsity M3 Ch8-11) ===
  let valScore = 50;
  // P/E relative to sector — lower percentile = cheaper = better
  if (na(f.pe) && peers.length > 3) {
    const sectorPEs = peers.filter(p => na(p.pe) && p.pe > 0).map(p => p.pe).sort((a,b) => a-b);
    if (sectorPEs.length > 3 && f.pe > 0) {
      const rank = sectorPEs.filter(p => p <= f.pe).length;
      const pctile = rank / sectorPEs.length;
      valScore += (1 - pctile) * 25; // cheaper = higher score
    }
  }
  // PEG ratio (Varsity M3: PEG < 1 = undervalued growth)
  if (na(f.peg) && f.peg > 0) {
    if (f.peg < 0.8) valScore += 20;
    else if (f.peg < 1.0) valScore += 15;
    else if (f.peg < 1.5) valScore += 8;
    else if (f.peg > 3) valScore -= 10;
  }
  // Earnings yield > bond yield ≈ 7% (Varsity M3: equity risk premium)
  if (na(f.earningsYield)) {
    if (f.earningsYield > 10) valScore += 10;
    else if (f.earningsYield > 7) valScore += 5;
    else if (f.earningsYield < 3) valScore -= 10;
  }
  valScore = Math.max(0, Math.min(100, valScore));

  // === PILLAR 3: TECHNICAL SCORE (0-100) (Varsity M2) ===
  let taScore = 50;
  // Price vs 200 DMA — trend direction (M2 Ch14)
  if (na(f.pctAbove200)) { taScore += f.pctAbove200 > 0 ? 12 : -12; }
  // Golden cross (M2 Ch14: EMA50 > EMA200)
  if (f.goldenCross === true) taScore += 10;
  else if (f.goldenCross === false) taScore -= 5;
  // RSI zone (M2 Ch3: 40-60 neutral, <30 oversold bounce, >70 overbought risk)
  if (na(f.rsi)) {
    if (f.rsi >= 40 && f.rsi <= 60) taScore += 8;
    else if (f.rsi >= 30 && f.rsi < 40) taScore += 5; // potential bounce
    else if (f.rsi > 70 && f.rsi <= 80) taScore -= 5;
    else if (f.rsi > 80) taScore -= 15;
  }
  // MACD (M2 Ch5: signal line crossover)
  if (f.macdBull === true) taScore += 8;
  else if (f.macdBull === false) taScore -= 5;
  // ADX trend strength (M2 Ch10: >25 = trending)
  if (na(f.adx) && f.adx > 25 && na(f.adxPdi) && na(f.adxNdi)) {
    if (f.adxPdi > f.adxNdi) taScore += 8; // bullish trend
    else taScore -= 5; // bearish trend
  }
  // OBV confirmation (M2 Ch13: volume supports price)
  if (f.obvRising === true) taScore += 6;
  // Supertrend (M2)
  if (f.supertrendSig === 'BUY') taScore += 5;
  else if (f.supertrendSig === 'SELL') taScore -= 5;
  // Volume ratio (unusual volume = institutional interest)
  if (na(f.volRatio) && f.volRatio > 1.5) taScore += 4;
  taScore = Math.max(0, Math.min(100, taScore));

  // === PILLAR 4: MOMENTUM SCORE (0-100) (Varsity M9 Ch6: relative strength vs Nifty) ===
  let momScore = 50;
  const rs52w = na(f.change52w) ? f.change52w - (niftyBenchmark['52w']||0) : 0;
  const rs6m  = na(f.change6m)  ? f.change6m  - (niftyBenchmark['6m']||0) : 0;
  const rs3m  = na(f.change3m)  ? f.change3m  - (niftyBenchmark['3m']||0) : 0;
  const rs1m  = na(f.change1m)  ? f.change1m  - (niftyBenchmark['1m']||0) : 0;
  momScore += rs6m * 30;   // 6M relative strength (highest weight)
  momScore += rs3m * 25;
  momScore += rs1m * 20;
  momScore += rs52w * 15;
  // Absolute momentum bonus
  if (na(f.change6m) && f.change6m > 0 && rs6m > 0) momScore += 5;
  momScore = Math.max(0, Math.min(100, momScore));

  // === PILLAR 5: RISK SCORE (0-100, higher = SAFER) (Varsity M9) ===
  let riskScore = 60;
  // Beta (M9 Ch4)
  if (na(f.beta)) {
    if (f.beta < 0.8) riskScore += 15;
    else if (f.beta < 1.0) riskScore += 10;
    else if (f.beta > 1.5) riskScore -= 15;
    else if (f.beta > 1.2) riskScore -= 8;
  }
  // Debt/Equity (M3 Ch10)
  if (na(f.debtToEq)) {
    if (f.debtToEq < 0.3) riskScore += 12;
    else if (f.debtToEq < 0.7) riskScore += 8;
    else if (f.debtToEq < 1.0) riskScore += 3;
    else if (f.debtToEq > 2.0) riskScore -= 15;
    else if (f.debtToEq > 1.5) riskScore -= 8;
  }
  // Volatility
  if (na(f.annualVol)) {
    if (f.annualVol < 25) riskScore += 10;
    else if (f.annualVol > 50) riskScore -= 10;
    else if (f.annualVol > 40) riskScore -= 5;
  }
  // Promoter confidence (M3: skin in the game)
  if (na(f.promoter)) {
    if (f.promoter > 65) riskScore += 8;
    else if (f.promoter > 50) riskScore += 4;
    else if (f.promoter < 30) riskScore -= 10;
  }
  if (na(f.pledged) && f.pledged > 20) riskScore -= 10;
  // Golden cross = trend safety
  if (f.goldenCross) riskScore += 5;
  riskScore = Math.max(0, Math.min(100, riskScore));

  // === COMPOSITE SCORE (weighted as per Varsity M10 framework) ===
  const composite = +(
    faRawScore * 0.30 +      // Fundamental quality (30%)
    valScore   * 0.15 +      // Valuation (15%)
    taScore    * 0.25 +      // Technical health (25%)
    momScore   * 0.15 +      // Momentum (15%)
    riskScore  * 0.15         // Risk/Safety (15%)
  ).toFixed(1);

  // === CONVICTION TIER (Varsity checklist approach) ===
  let checkCount = 0;
  if (faRawScore >= 55) checkCount++;
  if (valScore >= 55) checkCount++;
  if (taScore >= 55) checkCount++;
  if (momScore >= 55) checkCount++;
  if (riskScore >= 55) checkCount++;
  // Bonus checks
  if (f.goldenCross) checkCount += 0.5;
  if (na(f.roe) && f.roe >= 15) checkCount += 0.5;
  if (stopData?.acceptable) checkCount += 0.5;

  let conviction, convColor;
  if (composite >= 65 && checkCount >= 4) { conviction = 'Strong Buy'; convColor = '#10b981'; }
  else if (composite >= 55 && checkCount >= 3) { conviction = 'Buy'; convColor = '#22c55e'; }
  else if (composite >= 45 && checkCount >= 2) { conviction = 'Accumulate'; convColor = '#f59e0b'; }
  else if (composite >= 35) { conviction = 'Watch'; convColor = '#94a3b8'; }
  else { conviction = 'Avoid'; convColor = '#ef4444'; }

  // Fallen Angel check
  const isSmall = f.grp === 'SMALLCAP';
  const isMid = f.grp === 'MIDCAP';
  const isFa = faRawScore >= (isSmall ? 55 : isMid ? 52 : 50)
    && (f.pctFromHigh || 0) <= (isSmall ? -25 : -20)
    && (f.rsi || 50) <= 52
    && (f.debtToEq == null || f.debtToEq <= (isSmall ? 1.0 : isMid ? 1.5 : 2.0));
  const faData = isFa ? scoreFallenAngel(f) : {};

  return {
    sym: f.sym, name: f.name, grp: f.grp, sector: f.sector,
    price: px, faScore: faRawScore, valScore, taScore, momScore, riskScore,
    composite, conviction, convColor, checkCount: +checkCount.toFixed(1),
    ...faData, isFallenAngel: isFa,
    stopLoss: stopData?.stopLoss, target: stopData?.target,
    rrRatio: stopData?.rrRatio, goodRR: stopData?.acceptable,
    riskPct: stopData?.riskPct, rewardPct: stopData?.rewardPct,
    stopReason: stopData?.stopReason, targetReason: stopData?.targetReason,
    // Key metrics for display
    roe: f.roe, roce: f.roce, debtToEq: f.debtToEq, pe: f.pe, peg: f.peg,
    rsi: f.rsi, macdBull: f.macdBull, goldenCross: f.goldenCross, obvRising: f.obvRising,
    pctFromHigh: f.pctFromHigh, pctAbove200: f.pctAbove200,
    dma200: f.dma200, dma50: f.dma50, beta: f.beta, annualVol: f.annualVol,
    change1m: f.change1m, change3m: f.change3m, change6m: f.change6m,
    opMargin: f.opMargin, earGrowth: f.earGrowth, revGrowth: f.revGrowth,
    promoter: f.promoter, pledged: f.pledged, mktCap: f.mktCap,
    volRatio: f.volRatio, adx: f.adx, adxPdi: f.adxPdi, adxNdi: f.adxNdi,
    bullishDiv: f.bullishDiv, bearishDiv: f.bearishDiv,
    earningsYield: f.earningsYield, divYield: f.divYield,
  };
}

// ── BUILD MODEL PORTFOLIO (the "ideal" portfolio at this moment) ──
function buildPortfolioSuggestion(amount) {
  const all = Object.values(stockFundamentals);
  if (!all.length) return { error: 'Stock data not loaded yet. Please wait for scoring to complete.' };

  // Detect market regime first
  detectMarketRegime();

  // Score all stocks through the multi-factor model
  let scored = [];
  let scoreErrors = 0;
  for (const f of all) {
    try {
      const result = scoreStockForPortfolio(f);
      if (result) scored.push(result);
    } catch(e) { scoreErrors++; }
  }
  scored.sort((a, b) => b.composite - a.composite);

  // Debug logging
  const convDist = {};
  scored.forEach(s => { convDist[s.conviction] = (convDist[s.conviction]||0)+1; });
  const withPrice = all.filter(f => (f.price || livePrices[f.sym]?.price || global.FUND_EXT?.[f.sym]?.price) > 0).length;
  console.log(`📊 Portfolio: ${all.length} total, ${withPrice} have price, ${scored.length} pass quality gate, ${scoreErrors} errors. Conviction: ${JSON.stringify(convDist)}. Top: ${scored[0]?.sym}=${scored[0]?.composite}. Regime: ${marketRegime}`);

  // If quality gate filtered everything, fall back to simple FA-score ranking
  if (!scored.length && withPrice > 0) {
    console.log('📊 Quality gate too strict — falling back to FA score ranking');
    const bySector = {};
    all.forEach(f => { const s = f.sector || 'Other'; bySector[s] = bySector[s] || []; bySector[s].push(f); });
    scored = all.map(f => {
      const ext2 = global.FUND_EXT?.[f.sym];
      const px = f.price || livePrices[f.sym]?.price || ext2?.price || ext2?.currentPrice;
      if (!px || px <= 0) return null;
      const peers = bySector[f.sector || 'Other'] || all;
      const { score } = scoreOneStock(f, peers);
      const stopData = computeStopAndTarget({ ...f, price: px });
      return {
        sym: f.sym, name: f.name, grp: f.grp, sector: f.sector || 'Other',
        price: px, faScore: score, valScore: 50, taScore: 50, momScore: 50, riskScore: 50,
        composite: +score.toFixed(1), conviction: score >= 60 ? 'Buy' : score >= 40 ? 'Accumulate' : 'Watch',
        convColor: score >= 60 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#94a3b8',
        checkCount: 0, isFallenAngel: false,
        stopLoss: stopData?.stopLoss, target: stopData?.target,
        rrRatio: stopData?.rrRatio, goodRR: stopData?.acceptable,
        riskPct: stopData?.riskPct, rewardPct: stopData?.rewardPct,
        stopReason: stopData?.stopReason, targetReason: stopData?.targetReason,
        roe: f.roe, roce: f.roce, debtToEq: f.debtToEq, pe: f.pe, peg: f.peg,
        rsi: f.rsi, macdBull: f.macdBull, goldenCross: f.goldenCross, obvRising: f.obvRising,
        pctFromHigh: f.pctFromHigh, pctAbove200: f.pctAbove200,
        dma200: f.dma200, dma50: f.dma50, beta: f.beta, annualVol: f.annualVol,
        change1m: f.change1m, change3m: f.change3m, change6m: f.change6m,
        opMargin: f.opMargin, earGrowth: f.earGrowth, revGrowth: f.revGrowth,
        promoter: f.promoter, pledged: f.pledged, mktCap: f.mktCap,
        volRatio: f.volRatio, adx: f.adx, adxPdi: f.adxPdi, adxNdi: f.adxNdi,
        bullishDiv: f.bullishDiv, bearishDiv: f.bearishDiv,
        earningsYield: f.earningsYield, divYield: f.divYield,
      };
    }).filter(Boolean);
    scored.sort((a, b) => b.composite - a.composite);
  }

  // --- PROGRESSIVE SELECTION (Varsity M9: always find investable stocks) ---
  const MAX_STOCKS = Math.min(15, Math.max(5, Math.floor(amount / 10000)));
  const SECTOR_CAP = marketRegime === 'BEAR' ? 2 : 3; // tighter diversification in bear
  const CRITERIA = [
    { label: 'Strong Buy + Buy', filter: s => s.conviction === 'Strong Buy' || s.conviction === 'Buy' },
    { label: 'Accumulate+', filter: s => s.conviction !== 'Watch' && s.conviction !== 'Avoid' },
    { label: 'Composite >= 45', filter: s => s.composite >= 45 },
    { label: 'Composite >= 35', filter: s => s.composite >= 35 },
    { label: 'Top by composite', filter: () => true },
  ];

  let eligible = [];
  let usedCriteria = '';
  for (const c of CRITERIA) {
    eligible = scored.filter(c.filter);
    if (eligible.length >= 5) { usedCriteria = c.label; break; }
  }
  if (eligible.length < 5) { eligible = scored.slice(0, MAX_STOCKS * 2); usedCriteria = 'Top by ranking'; }

  // Diversification — max SECTOR_CAP per sector (Varsity M9 Ch5)
  const selected = [];
  const sectorCnt = {};
  for (const s of eligible) {
    const sec = s.sector || 'Other';
    sectorCnt[sec] = (sectorCnt[sec] || 0) + 1;
    if (sectorCnt[sec] <= SECTOR_CAP) {
      selected.push(s);
      if (selected.length >= MAX_STOCKS) break;
    }
  }
  if (selected.length < 5) {
    for (const s of eligible) {
      if (!selected.find(x => x.sym === s.sym)) {
        selected.push(s);
        if (selected.length >= MAX_STOCKS) break;
      }
    }
  }

  if (!selected.length) {
    console.log(`📊 Portfolio: No stocks selected. scored=${scored.length}, eligible=${eligible.length}`);
    return { error: scored.length === 0
      ? 'Stock data is still loading (' + all.length + ' stocks, ' + withPrice + ' with price). Please wait and retry.'
      : 'Could not build portfolio. ' + scored.length + ' stocks scored but diversification filter left 0. Retrying...' };
  }

  // --- CASH ALLOCATION based on regime ---
  const cashPct = (marketRegimeData.cashSuggestion || 10) / 100;
  const investableAmount = Math.round(amount * (1 - cashPct));

  // --- ALLOCATION (Varsity M9: conviction-weighted + volatility-adjusted) ---
  const rawWeights = selected.map(s => {
    let w = s.composite;
    if (s.conviction === 'Strong Buy') w *= 1.5;
    else if (s.conviction === 'Buy') w *= 1.2;
    // Inverse volatility weighting (Varsity M9: equal risk contribution)
    if (s.annualVol && s.annualVol > 0) w *= (30 / Math.max(15, s.annualVol));
    // Beta adjustment
    if (s.beta && s.beta > 1.3) w *= 0.85;
    if (s.beta && s.beta > 1.6) w *= 0.75;
    // Fallen angel bonus
    if (s.isFallenAngel && s.goodRR) w *= 1.15;
    return Math.max(w, 1);
  });

  const totalW = rawWeights.reduce((a, b) => a + b, 0);
  const MIN_ALLOC = 0.03, MAX_ALLOC = 0.20;
  const allocations = rawWeights.map(w => Math.max(MIN_ALLOC, Math.min(MAX_ALLOC, w / totalW)));
  const allocSum = allocations.reduce((a, b) => a + b, 0);
  allocations.forEach((_, i) => { allocations[i] /= allocSum; });

  // Build portfolio
  const portfolio = selected.map((s, i) => {
    const allocPct = +(allocations[i] * 100).toFixed(1);
    const allocAmt = Math.round(investableAmount * allocations[i]);
    const shares = Math.max(1, Math.floor(allocAmt / s.price));
    const investedAmt = +(shares * s.price).toFixed(0);

    let reason = `${s.conviction} — composite ${s.composite} (FA:${s.faScore} TA:${s.taScore} Mom:${s.momScore} Val:${s.valScore} Risk:${s.riskScore})`;
    if (s.isFallenAngel) reason = `Fallen Angel — ${reason}`;

    return {
      sym: s.sym, name: s.name, grp: s.grp, sector: s.sector,
      price: s.price, shares, allocPct, allocAmt: investedAmt,
      action: 'BUY', actionColor: '#22c55e', reason,
      conviction: s.conviction, convColor: s.convColor,
      composite: s.composite, faScore: s.faScore, taScore: s.taScore,
      momScore: s.momScore, valScore: s.valScore, riskScore: s.riskScore,
      checkCount: s.checkCount,
      isFallenAngel: s.isFallenAngel, fallenVerdict: s.fallenVerdict || null,
      stopLoss: s.stopLoss, target: s.target,
      rrRatio: s.rrRatio, riskPct: s.riskPct, rewardPct: s.rewardPct,
      stopReason: s.stopReason, targetReason: s.targetReason,
      roe: s.roe, roce: s.roce, debtToEq: s.debtToEq, pe: s.pe, peg: s.peg,
      rsi: s.rsi, macdBull: s.macdBull, goldenCross: s.goldenCross,
      pctFromHigh: s.pctFromHigh, pctAbove200: s.pctAbove200,
      beta: s.beta, annualVol: s.annualVol, opMargin: s.opMargin,
      earGrowth: s.earGrowth, promoter: s.promoter, pledged: s.pledged,
      earningsYield: s.earningsYield, divYield: s.divYield,
      entryPrice: s.price, entryTime: Date.now(),
      signalReasons: [],
    };
  });

  // Portfolio stats
  const totalInvested = portfolio.reduce((a, s) => a + s.allocAmt, 0);
  const avgComposite = +(portfolio.reduce((a, s) => a + s.composite, 0) / portfolio.length).toFixed(1);
  const sectorBreakdown = {};
  portfolio.forEach(s => { sectorBreakdown[s.sector] = (sectorBreakdown[s.sector] || 0) + s.allocPct; });
  const wBeta = portfolio.reduce((a, s) => a + (s.beta || 1) * (s.allocPct / 100), 0);

  // Store as model portfolio
  modelPortfolio = { portfolio, amount, generatedAt: Date.now() };

  return {
    portfolio,
    summary: {
      totalAmount: amount, totalInvested,
      cashRemaining: amount - totalInvested, cashPct: +(cashPct * 100).toFixed(0),
      numStocks: portfolio.length, numSectors: Object.keys(sectorBreakdown).length,
      avgComposite, portfolioBeta: +wBeta.toFixed(2), sectorBreakdown,
      regime: marketRegime, regimeData: marketRegimeData,
      selectionCriteria: usedCriteria,
      generatedAt: Date.now(),
      dataAge: stockFundLastFetch ? Date.now() - stockFundLastFetch : null,
    }
  };
}

// ── EXIT SIGNAL ENGINE (Varsity M9: 5 reasons to sell) ──
function evaluateExitSignals(position, f) {
  if (!f) return { action: 'HOLD', actionColor: '#f59e0b', reasons: ['No data — hold'] };

  const px = f.price || livePrices[position.sym]?.price || position.price;
  const entryPx = position.avg_price || position.entryPrice || position.price;
  const pnlPct = ((px - entryPx) / entryPx) * 100;
  const reasons = [];
  let action = 'HOLD';
  let actionColor = '#f59e0b';
  let urgency = 'NORMAL';

  // ── SELL SIGNAL 1: Stop Loss / Trailing Stop (Varsity M9 Ch2) ──
  const stopLevel = position.trailing_stop || position.stop_loss || position.stopLoss;
  if (stopLevel && px <= stopLevel) {
    action = 'EXIT'; actionColor = '#ef4444'; urgency = 'URGENT';
    reasons.push(`Stop loss ₹${(+stopLevel).toFixed(0)} breached (price ₹${(+px).toFixed(0)})`);
    return { action, actionColor, urgency, reasons };
  }

  // ── SELL SIGNAL 2: Target Hit ──
  const targetLevel = position.target;
  if (targetLevel && px >= targetLevel) {
    action = 'BOOK PROFIT'; actionColor = '#f59e0b'; urgency = 'HIGH';
    reasons.push(`Target ₹${(+targetLevel).toFixed(0)} reached — book partial/full profit`);
  }

  // ── SELL SIGNAL 3: FA Deterioration (Varsity M3: thesis broken) ──
  let faDeteriorating = 0;
  if (f.roe != null && f.roe < 8) { faDeteriorating++; reasons.push(`ROE dropped to ${f.roe.toFixed(1)}%`); }
  if (f.debtToEq != null && f.debtToEq > 2.5) { faDeteriorating++; reasons.push(`D/E spiked to ${f.debtToEq.toFixed(1)}`); }
  if (f.earGrowth != null && f.earGrowth < -25) { faDeteriorating++; reasons.push(`EPS growth ${f.earGrowth.toFixed(0)}%`); }
  if (f.pledged != null && f.pledged > 30) { faDeteriorating++; reasons.push(`Pledged shares ${f.pledged.toFixed(0)}%`); }
  if (faDeteriorating >= 2) {
    action = 'EXIT'; actionColor = '#ef4444'; urgency = 'HIGH';
    reasons.unshift('⚠ Fundamental thesis broken — multiple FA red flags');
  }

  // ── SELL SIGNAL 4: Technical Breakdown (Varsity M2: death cross + below 200DMA) ──
  let taBearish = 0;
  if (f.pctAbove200 != null && f.pctAbove200 < 0) taBearish++;
  if (f.goldenCross === false) taBearish++; // death cross
  if (f.macdBull === false) taBearish++;
  if (f.rsi != null && f.rsi > 80) { taBearish++; reasons.push(`RSI overbought ${f.rsi.toFixed(0)}`); }
  if (f.bearishDiv) { taBearish++; reasons.push('Bearish RSI divergence'); }
  if (f.supertrendSig === 'SELL') taBearish++;

  if (taBearish >= 3 && action !== 'EXIT') {
    action = 'REDUCE'; actionColor = '#f97316'; urgency = 'HIGH';
    reasons.unshift('Technical breakdown — ' + taBearish + ' bearish signals');
  }

  // ── SELL SIGNAL 5: Deep Loss Review ──
  if (pnlPct < -15 && action === 'HOLD') {
    action = 'REVIEW'; actionColor = '#f97316'; urgency = 'HIGH';
    reasons.push(`Down ${pnlPct.toFixed(1)}% — review if thesis still holds`);
  } else if (pnlPct < -8 && action === 'HOLD') {
    reasons.push(`Down ${pnlPct.toFixed(1)}% — monitoring`);
  }

  // ── ADD MORE signals (Varsity M2: buy the dip on quality) ──
  if (action === 'HOLD' && f.rsi != null && f.rsi < 30 && pnlPct < -5 && f.roe != null && f.roe >= 12) {
    action = 'ADD MORE'; actionColor = '#22d3ee';
    reasons.push(`RSI ${f.rsi.toFixed(0)} oversold + quality intact (ROE ${f.roe.toFixed(0)}%) — average down`);
  }
  if (action === 'HOLD' && f.bullishDiv && pnlPct < 0) {
    action = 'ADD MORE'; actionColor = '#22d3ee';
    reasons.push('Bullish divergence on dip — accumulate');
  }

  // ── HOLD with strength ──
  if (action === 'HOLD' && pnlPct > 0 && f.macdBull && f.obvRising) {
    action = 'HOLD ✓'; actionColor = '#22c55e';
    reasons.push('In profit + MACD bullish + OBV rising — strong hold');
  }
  if (action === 'HOLD' && reasons.length === 0) {
    reasons.push(pnlPct >= 0 ? `+${pnlPct.toFixed(1)}% — thesis intact` : 'Thesis intact — hold');
  }

  return { action, actionColor, urgency, reasons };
}

// ── UPDATE TRAILING STOPS (Varsity M9: ratchet stops up, never down) ──
function updateTrailingStop(position, currentPrice) {
  const entryPx = position.avg_price || position.entryPrice || position.price;
  if (!currentPrice || currentPrice <= 0 || !entryPx) return position.trailing_stop || position.stopLoss;

  const f = stockFundamentals[position.sym];
  const vol = f?.annualVol || 30;
  const dailyVol = (vol / 100) / Math.sqrt(252);
  const atrProxy = currentPrice * dailyVol;

  // Trailing stop = 2.5x ATR below highest price seen
  // In bear market, tighter stops (2x ATR)
  const multiplier = marketRegime === 'BEAR' ? 2.0 : 2.5;
  const newStop = +(currentPrice - (multiplier * atrProxy)).toFixed(2);

  const currentStop = position.trailing_stop || position.stop_loss || position.stopLoss || 0;
  // Never lower a trailing stop — only ratchet up
  return Math.max(currentStop, newStop);
}

// ── REFRESH PORTFOLIO WITH LIVE DATA + SIGNALS ──
function refreshPortfolioSignals(suggestion) {
  if (!suggestion || !suggestion.portfolio) return suggestion;

  const updated = suggestion.portfolio.map(s => {
    const lp = livePrices[s.sym]?.price;
    const currentPrice = lp || stockFundamentals[s.sym]?.price || s.price || global.FUND_EXT?.[s.sym]?.price;
    const entryPx = s.avg_price || s.entryPrice || s.price;
    const pnl = currentPrice - entryPx;
    const pnlPct = +((pnl / entryPx) * 100).toFixed(2);
    const currentValue = +(s.shares * currentPrice).toFixed(0);
    const f = stockFundamentals[s.sym];

    // Update trailing stop
    const trailingStop = updateTrailingStop(s, currentPrice);

    // Evaluate exit signals
    const signals = evaluateExitSignals({ ...s, trailing_stop: trailingStop }, f);

    return {
      ...s,
      currentPrice,
      pnl: +pnl.toFixed(2),
      pnlPct,
      currentValue,
      trailing_stop: trailingStop,
      action: signals.action,
      actionColor: signals.actionColor,
      urgency: signals.urgency,
      signalReasons: signals.reasons,
      liveRSI: f?.rsi,
      liveMACD: f?.macdBull,
      lastUpdated: Date.now(),
    };
  });

  const totalValue = updated.reduce((a, s) => a + s.currentValue, 0);
  const totalInvested = updated.reduce((a, s) => a + s.allocAmt, 0);
  const totalPnl = totalValue - totalInvested;
  const totalPnlPct = totalInvested > 0 ? +((totalPnl / totalInvested) * 100).toFixed(2) : 0;

  // Find new opportunities from model — stocks in model but not held
  let newOpportunities = [];
  if (modelPortfolio && modelPortfolio.portfolio) {
    const heldSyms = new Set(updated.map(s => s.sym));
    newOpportunities = modelPortfolio.portfolio
      .filter(m => !heldSyms.has(m.sym) && (m.conviction === 'Strong Buy' || m.conviction === 'Buy'))
      .slice(0, 5)
      .map(m => ({ sym: m.sym, name: m.name, sector: m.sector, composite: m.composite, conviction: m.conviction, convColor: m.convColor, price: m.price, reason: m.reason }));
  }

  return {
    portfolio: updated,
    newOpportunities,
    summary: {
      ...suggestion.summary,
      currentValue: totalValue,
      totalPnl, totalPnlPct,
      regime: marketRegime, regimeData: marketRegimeData,
      lastRefreshed: Date.now(),
      marketOpen: isMarketOpen(),
    }
  };
}

// ── HELPER: Load user positions from DB ──
async function loadUserPositions() {
  try {
    const { rows } = await pool.query('SELECT * FROM portfolio_positions WHERE status=$1 ORDER BY buy_date DESC', ['ACTIVE']);
    return rows;
  } catch(e) { console.error('Load positions error:', e.message); return []; }
}

// ── HELPER: Save daily snapshot ──
async function savePortfolioSnapshot() {
  try {
    const positions = await loadUserPositions();
    if (!positions.length) return;

    let totalInvested = 0, currentValue = 0, totalBeta = 0, totalWeight = 0;
    positions.forEach(p => {
      const px = livePrices[p.sym]?.price || stockFundamentals[p.sym]?.price || p.avg_price;
      totalInvested += p.invested_amt;
      currentValue += p.qty * px;
      const beta = stockFundamentals[p.sym]?.beta || 1;
      totalBeta += beta * p.invested_amt;
      totalWeight += p.invested_amt;
    });

    const pnl = currentValue - totalInvested;
    const pnlPct = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;
    const wBeta = totalWeight > 0 ? totalBeta / totalWeight : 1;

    // Get all past snapshots to calc max drawdown
    const { rows: snapshots } = await pool.query('SELECT current_value FROM portfolio_snapshots ORDER BY snap_date ASC');
    let peak = currentValue;
    snapshots.forEach(s => { if (s.current_value > peak) peak = s.current_value; });
    const drawdown = peak > 0 ? ((currentValue - peak) / peak) * 100 : 0;

    await pool.query(
      `INSERT INTO portfolio_snapshots(snap_date,total_invested,current_value,cash_balance,total_pnl,total_pnl_pct,num_positions,portfolio_beta,max_drawdown)
       VALUES(CURRENT_DATE,$1,$2,0,$3,$4,$5,$6,$7)
       ON CONFLICT(snap_date) DO UPDATE SET total_invested=$1,current_value=$2,total_pnl=$3,total_pnl_pct=$4,num_positions=$5,portfolio_beta=$6,max_drawdown=$7`,
      [totalInvested, currentValue, pnl, pnlPct, positions.length, wBeta, drawdown]
    );
  } catch(e) { console.error('Snapshot error:', e.message); }
}

// ══════════════════════════════════════════════════════════════════════════════
// PORTFOLIO MANAGER — API ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/portfolio/suggest — generate model portfolio
app.post('/api/portfolio/suggest', (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    if (!amount || amount < 5000) return res.status(400).json({ error: 'Minimum investment ₹5,000' });
    if (amount > 100000000) return res.status(400).json({ error: 'Maximum ₹10 Cr' });
    const result = buildPortfolioSuggestion(amount);
    if (result.error) return res.status(503).json(result);
    portfolioSuggestions[Math.round(amount)] = result;
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/portfolio/suggest/refresh — live refresh with exit signals
app.get('/api/portfolio/suggest/refresh', (req, res) => {
  try {
    const amount = parseFloat(req.query.amount);
    const cached = portfolioSuggestions[Math.round(amount)];
    if (!cached) return res.status(404).json({ error: 'Generate a portfolio first' });
    const refreshed = refreshPortfolioSignals(cached);
    portfolioSuggestions[Math.round(amount)] = refreshed;
    res.json(refreshed);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/portfolio/suggest/regenerate — force regenerate
app.post('/api/portfolio/suggest/regenerate', (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    if (!amount || amount < 5000) return res.status(400).json({ error: 'Minimum investment ₹5,000' });
    const result = buildPortfolioSuggestion(amount);
    if (result.error) return res.status(503).json(result);
    portfolioSuggestions[Math.round(amount)] = result;
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── USER PORTFOLIO TRACKING APIs ──

// POST /api/portfolio/buy — mark a stock as bought (user tracking)
app.post('/api/portfolio/buy', async (req, res) => {
  try {
    const { sym, qty, price, stopLoss, target, conviction, qualityScore, reason } = req.body;
    if (!sym || !qty || !price) return res.status(400).json({ error: 'sym, qty, price required' });

    const f = stockFundamentals[sym];
    const name = f?.name || sym;
    const sector = f?.sector || 'Other';
    const grp = f?.grp || '';
    const invested = qty * price;

    const { rows } = await pool.query(
      `INSERT INTO portfolio_positions(sym,name,sector,grp,qty,avg_price,invested_amt,stop_loss,target,conviction,quality_score,buy_reason)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [sym, name, sector, grp, qty, price, invested, stopLoss||null, target||null, conviction||null, qualityScore||null, reason||null]
    );

    // Log signal
    await pool.query(
      `INSERT INTO portfolio_signals(sym,signal_type,urgency,reason,price_at,stop_at,target_at,acted,acted_at)
       VALUES($1,'BUY','NORMAL',$2,$3,$4,$5,true,NOW())`,
      [sym, reason || `Bought ${qty} @ ₹${price}`, price, stopLoss||null, target||null]
    );

    res.json({ success: true, position: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/portfolio/sell — mark a position as sold
app.post('/api/portfolio/sell', async (req, res) => {
  try {
    const { id, price, reason } = req.body;
    if (!id || !price) return res.status(400).json({ error: 'id, price required' });

    const { rows: pos } = await pool.query('SELECT * FROM portfolio_positions WHERE id=$1', [id]);
    if (!pos.length) return res.status(404).json({ error: 'Position not found' });

    const p = pos[0];
    const pnl = (price - p.avg_price) * p.qty;
    const pnlPct = ((price - p.avg_price) / p.avg_price) * 100;

    await pool.query(
      `UPDATE portfolio_positions SET status='CLOSED',sell_date=NOW(),sell_price=$1,sell_reason=$2,realised_pnl=$3,realised_pct=$4 WHERE id=$5`,
      [price, reason || 'Manual sell', pnl, pnlPct, id]
    );

    await pool.query(
      `INSERT INTO portfolio_signals(sym,signal_type,urgency,reason,price_at,acted,acted_at)
       VALUES($1,'SELL','NORMAL',$2,$3,true,NOW())`,
      [p.sym, reason || `Sold @ ₹${price} | P&L: ₹${pnl.toFixed(0)} (${pnlPct.toFixed(1)}%)`, price]
    );

    res.json({ success: true, pnl: +pnl.toFixed(2), pnlPct: +pnlPct.toFixed(1) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/portfolio/add — add more to existing position
app.post('/api/portfolio/add', async (req, res) => {
  try {
    const { id, qty, price } = req.body;
    if (!id || !qty || !price) return res.status(400).json({ error: 'id, qty, price required' });

    const { rows: pos } = await pool.query('SELECT * FROM portfolio_positions WHERE id=$1', [id]);
    if (!pos.length) return res.status(404).json({ error: 'Position not found' });

    const p = pos[0];
    const newQty = p.qty + qty;
    const newInvested = p.invested_amt + (qty * price);
    const newAvg = newInvested / newQty;

    await pool.query(
      `UPDATE portfolio_positions SET qty=$1,avg_price=$2,invested_amt=$3 WHERE id=$4`,
      [newQty, newAvg, newInvested, id]
    );

    await pool.query(
      `INSERT INTO portfolio_signals(sym,signal_type,urgency,reason,price_at,acted,acted_at)
       VALUES($1,'ADD','NORMAL',$2,$3,true,NOW())`,
      [p.sym, `Added ${qty} @ ₹${price} | New avg: ₹${newAvg.toFixed(0)}`, price]
    );

    res.json({ success: true, newQty, newAvg: +newAvg.toFixed(2), newInvested });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/portfolio/positions — get all positions with live P&L + signals
app.get('/api/portfolio/positions', async (req, res) => {
  try {
    const status = req.query.status || 'ACTIVE';
    const { rows } = await pool.query(
      'SELECT * FROM portfolio_positions WHERE status=$1 ORDER BY buy_date DESC', [status]
    );

    // Enrich with live data + exit signals
    const enriched = rows.map(p => {
      const f = stockFundamentals[p.sym];
      const currentPrice = livePrices[p.sym]?.price || f?.price || global.FUND_EXT?.[p.sym]?.price || p.avg_price;
      const pnl = (currentPrice - p.avg_price) * p.qty;
      const pnlPct = ((currentPrice - p.avg_price) / p.avg_price) * 100;
      const currentValue = p.qty * currentPrice;

      // Update trailing stop
      const trailingStop = updateTrailingStop(p, currentPrice);

      // Evaluate exit signals
      const signals = evaluateExitSignals({ ...p, trailing_stop: trailingStop }, f);

      return {
        ...p,
        currentPrice: +currentPrice.toFixed(2),
        currentValue: +currentValue.toFixed(0),
        unrealised_pnl: +pnl.toFixed(2),
        unrealised_pct: +pnlPct.toFixed(1),
        trailing_stop: trailingStop,
        action: signals.action,
        actionColor: signals.actionColor,
        urgency: signals.urgency,
        signalReasons: signals.reasons,
        // Live metrics
        liveRSI: f?.rsi, liveMACD: f?.macdBull, liveGoldenCross: f?.goldenCross,
        liveBeta: f?.beta, liveROE: f?.roe, liveDE: f?.debtToEq,
      };
    });

    // Portfolio totals
    const totalInvested = enriched.reduce((a, p) => a + p.invested_amt, 0);
    const totalValue = enriched.reduce((a, p) => a + p.currentValue, 0);
    const totalPnl = totalValue - totalInvested;
    const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
    const wBeta = totalInvested > 0
      ? enriched.reduce((a, p) => a + (p.liveBeta || 1) * (p.invested_amt / totalInvested), 0)
      : 1;

    // Sector breakdown
    const sectorBreakdown = {};
    enriched.forEach(p => {
      const sec = p.sector || 'Other';
      sectorBreakdown[sec] = (sectorBreakdown[sec] || 0) + (p.currentValue / totalValue * 100);
    });

    // Urgent signals count
    const urgentCount = enriched.filter(p => p.urgency === 'URGENT' || p.urgency === 'HIGH').length;

    res.json({
      positions: enriched,
      summary: {
        totalInvested: +totalInvested.toFixed(0),
        currentValue: +totalValue.toFixed(0),
        totalPnl: +totalPnl.toFixed(0),
        totalPnlPct: +totalPnlPct.toFixed(1),
        numPositions: enriched.length,
        portfolioBeta: +wBeta.toFixed(2),
        sectorBreakdown,
        urgentSignals: urgentCount,
        regime: marketRegime,
        regimeData: marketRegimeData,
        marketOpen: isMarketOpen(),
      }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/portfolio/signals — signal history
app.get('/api/portfolio/signals', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const { rows } = await pool.query('SELECT * FROM portfolio_signals ORDER BY created_at DESC LIMIT $1', [limit]);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/portfolio/performance — equity curve + performance stats
app.get('/api/portfolio/performance', async (req, res) => {
  try {
    const { rows: snapshots } = await pool.query('SELECT * FROM portfolio_snapshots ORDER BY snap_date ASC');
    const { rows: closedTrades } = await pool.query(
      `SELECT sym,realised_pnl,realised_pct,buy_date,sell_date FROM portfolio_positions WHERE status='CLOSED' ORDER BY sell_date DESC`
    );

    const wins = closedTrades.filter(t => t.realised_pnl > 0);
    const losses = closedTrades.filter(t => t.realised_pnl <= 0);
    const totalRealised = closedTrades.reduce((a, t) => a + (t.realised_pnl || 0), 0);

    res.json({
      equityCurve: snapshots,
      closedTrades,
      stats: {
        totalTrades: closedTrades.length,
        wins: wins.length,
        losses: losses.length,
        winRate: closedTrades.length > 0 ? +(wins.length / closedTrades.length * 100).toFixed(1) : 0,
        totalRealised: +totalRealised.toFixed(0),
        avgWin: wins.length > 0 ? +(wins.reduce((a,t) => a + t.realised_pnl, 0) / wins.length).toFixed(0) : 0,
        avgLoss: losses.length > 0 ? +(losses.reduce((a,t) => a + t.realised_pnl, 0) / losses.length).toFixed(0) : 0,
      }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/portfolio/regime — current market regime
app.get('/api/portfolio/regime', (req, res) => {
  detectMarketRegime();
  res.json(marketRegimeData);
});

// =============================================================================
// DAILY SCHEDULES — all DB tables updated, memory reloaded after each run
// =============================================================================

// 7AM IST — fetch Kite candles, compute ALL technicals, score all stocks → stock_scores + scored_stocks_cache
cron.schedule('0 7 * * *', async () => {
  console.log('📊 7AM: Daily stock scoring starting...');
  await refreshMissingFundamentals(); // Yahoo scraper for any missing FUND data
  await refreshAllFundamentals();     // Kite candles → score → save to stock_scores DB
}, { timezone: 'Asia/Kolkata' });

// 8AM IST — refresh stock universe from NSE CSVs → stock_universe DB
cron.schedule('0 8 * * *', async () => {
  console.log('📋 8AM: Refreshing universe from NSE...');
  await refreshUniverseFromNSE();
}, { timezone: 'Asia/Kolkata' });

// 9AM IST — refresh Kite instrument tokens → stock_instruments DB
cron.schedule('0 9 * * 1-5', async () => {
  console.log('📋 9AM: Refreshing instrument tokens from Kite...');
  await refreshInstruments();
}, { timezone: 'Asia/Kolkata' });

// 8PM IST — fetch Screener.in fundamentals (after market close, data is fresh) → screener_fundamentals DB
cron.schedule('0 20 * * *', () => {
  console.log('📊 8PM: Daily Screener fundamentals refresh starting...');
  fetchAllScreenerData().catch(e => console.error('Screener cron error:', e.message));
}, { timezone: 'Asia/Kolkata' });

// =============================================================================
// SCREENER.IN FUNDAMENTALS — bulk mode via shashwattrivedi/screener-in
// One Apify run → all stocks at once via runQuery
// Requires SCREENER_USERNAME + SCREENER_PASSWORD in Railway env vars
// =============================================================================

let screenerRunning = false;
let screenerProgress = { done: 0, total: 0, errors: 0, startedAt: null };


async function upsertScreenerData(data) {
  if (!data.peg && data.pe && data.eps_gr_3y && data.eps_gr_3y > 0) {
    data.peg = +(data.pe / data.eps_gr_3y).toFixed(2);
  }
  await pool.query(`
    INSERT INTO screener_fundamentals
      (sym,name,nse_code,bse_code,industry,industry_group,
       roe,de,pe,rev_gr_3y,eps_gr_3y,opm,roa,pb,peg,int_cov,
       promoter_holding,pledged_pct,promoter_chg,mkt_cap,current_price,
       eps,debt,current_ratio,div_yield,sales_gr_1y,sales_gr_5y,
       eps_gr_1y,eps_gr_5y,roe_3y_avg,roe_5y_avg,ret_1y,ret_3y,ret_5y,
       ret_6m,ret_3m,ev_ebitda,industry_pe,pat_qtr,sales_qtr,
       pat_annual,sales_annual,pat_qtr_yoy,sales_qtr_yoy,
       roce,earnings_yield,price_to_fcf,price_to_sales,
       fii_holding,dii_holding,num_shareholders,imported_at)
    VALUES
      ($1,$2,$3,$4,$5,$6,
       $7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
       $17,$18,$19,$20,$21,
       $22,$23,$24,$25,$26,$27,
       $28,$29,$30,$31,$32,$33,$34,
       $35,$36,$37,$38,$39,$40,
       $41,$42,$43,$44,
       $45,$46,$47,$48,
       $49,$50,$51,NOW())
    ON CONFLICT (sym) DO UPDATE SET
      name=EXCLUDED.name, industry=EXCLUDED.industry,
      roe=EXCLUDED.roe, de=EXCLUDED.de, pe=EXCLUDED.pe,
      rev_gr_3y=EXCLUDED.rev_gr_3y, eps_gr_3y=EXCLUDED.eps_gr_3y, opm=EXCLUDED.opm,
      roa=EXCLUDED.roa, pb=EXCLUDED.pb, peg=EXCLUDED.peg, int_cov=EXCLUDED.int_cov,
      promoter_holding=EXCLUDED.promoter_holding, pledged_pct=EXCLUDED.pledged_pct,
      promoter_chg=EXCLUDED.promoter_chg, mkt_cap=EXCLUDED.mkt_cap,
      current_price=EXCLUDED.current_price, eps=EXCLUDED.eps, debt=EXCLUDED.debt,
      current_ratio=EXCLUDED.current_ratio, div_yield=EXCLUDED.div_yield,
      sales_gr_1y=EXCLUDED.sales_gr_1y, sales_gr_5y=EXCLUDED.sales_gr_5y,
      eps_gr_1y=EXCLUDED.eps_gr_1y, eps_gr_5y=EXCLUDED.eps_gr_5y,
      roe_3y_avg=EXCLUDED.roe_3y_avg, roe_5y_avg=EXCLUDED.roe_5y_avg,
      ret_1y=EXCLUDED.ret_1y, ret_3y=EXCLUDED.ret_3y, ret_5y=EXCLUDED.ret_5y,
      ret_6m=EXCLUDED.ret_6m, ret_3m=EXCLUDED.ret_3m,
      ev_ebitda=EXCLUDED.ev_ebitda, industry_pe=EXCLUDED.industry_pe,
      pat_qtr=EXCLUDED.pat_qtr, sales_qtr=EXCLUDED.sales_qtr,
      pat_annual=EXCLUDED.pat_annual, sales_annual=EXCLUDED.sales_annual,
      pat_qtr_yoy=EXCLUDED.pat_qtr_yoy, sales_qtr_yoy=EXCLUDED.sales_qtr_yoy,
      roce=EXCLUDED.roce, earnings_yield=EXCLUDED.earnings_yield,
      price_to_fcf=EXCLUDED.price_to_fcf, price_to_sales=EXCLUDED.price_to_sales,
      fii_holding=COALESCE(EXCLUDED.fii_holding, screener_fundamentals.fii_holding),
      dii_holding=COALESCE(EXCLUDED.dii_holding, screener_fundamentals.dii_holding),
      num_shareholders=COALESCE(EXCLUDED.num_shareholders, screener_fundamentals.num_shareholders),
      imported_at=NOW()
  `, [
    data.sym, data.name, data.nse_code, data.bse_code, data.industry, data.industry_group,
    data.roe, data.de, data.pe, data.rev_gr_3y, data.eps_gr_3y, data.opm,
    data.roa, data.pb, data.peg, data.int_cov,
    data.promoter_holding, data.pledged_pct, data.promoter_chg, data.mkt_cap, data.current_price,
    data.eps, data.debt, data.current_ratio, data.div_yield, data.sales_gr_1y, data.sales_gr_5y,
    data.eps_gr_1y, data.eps_gr_5y, data.roe_3y_avg, data.roe_5y_avg,
    data.ret_1y, data.ret_3y, data.ret_5y, data.ret_6m, data.ret_3m,
    data.ev_ebitda, data.industry_pe, data.pat_qtr, data.sales_qtr,
    data.pat_annual, data.sales_annual, data.pat_qtr_yoy, data.sales_qtr_yoy,
    data.roce, data.earnings_yield, data.price_to_fcf, data.price_to_sales,
    data.fii_holding||null, data.dii_holding||null, data.num_shareholders||null,
  ]);
  patchScreenerIntoFUND(data.sym, data);
}

// Bulk mode — one Apify run gets all stocks via runQuery
// Much faster than 567 separate runs. Requires Screener.in login.
async function fetchAllScreenerBulk(token) {
  if (screenerRunning) return { error: 'Already running' };
  screenerRunning = true;
  const BASE  = 'https://api.apify.com/v2';
  const ACTOR = 'shashwattrivedi~screener-in';
  const pn = v => { const n = parseFloat(String(v||'').replace(/,/g,'')); return isNaN(n)?null:n; };
  const ps = v => (v||'').toString().trim();

  screenerProgress = { done: 0, total: 0, errors: 0, startedAt: Date.now() };
  console.log('📊 Screener bulk fetch starting via runQuery...');

  try {
    // Start one run with runQuery — gets all stocks matching Market Cap > 0
    const startResp = await fetch(`${BASE}/acts/${ACTOR}/runs?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode:        'runQuery',
        queryString: 'Market Capitalization > 0',
        username:    process.env.SCREENER_USERNAME,
        password:    process.env.SCREENER_PASSWORD,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!startResp.ok) throw new Error(`Start failed: ${startResp.status} ${await startResp.text().catch(()=>'')}`);
    const runInfo = await startResp.json();
    const runId     = runInfo.data?.id;
    const datasetId = runInfo.data?.defaultDatasetId;
    if (!runId) throw new Error('No run ID returned');
    console.log(`📊 Bulk run started: ${runId} — polling...`);

    // Poll until done (max 30 min for bulk)
    let status = 'RUNNING', attempts = 0;
    while ((status === 'RUNNING' || status === 'READY') && attempts < 180) {
      await new Promise(r => setTimeout(r, 10000));
      attempts++;
      const poll = await fetch(`${BASE}/acts/${ACTOR}/runs/${runId}?token=${token}`, { signal: AbortSignal.timeout(15000) });
      if (poll.ok) status = (await poll.json()).data?.status || 'RUNNING';
      if (attempts % 6 === 0) {
        console.log(`📊 Bulk status: ${status} (${Math.round(attempts*10/60)}m elapsed)`);
        screenerProgress.done = Math.min(attempts * 3, screenerProgress.total); // estimate
      }
    }
    if (status !== 'SUCCEEDED') throw new Error(`Run ended with status: ${status}`);

    // Fetch all dataset items
    const dataResp = await fetch(`${BASE}/datasets/${datasetId}/items?token=${token}&limit=10000`, { signal: AbortSignal.timeout(60000) });
    if (!dataResp.ok) throw new Error(`Dataset fetch failed: ${dataResp.status}`);
    const items = await dataResp.json();
    if (!Array.isArray(items) || !items.length) throw new Error('Empty dataset');

    console.log(`📊 Bulk got ${items.length} items — importing...`);
    screenerProgress.total = items.length;

    // Log first item field names
    console.log('📊 Bulk field names:', Object.keys(items[0]).slice(0,20).join(', '));
    console.log('📊 Bulk sample:', JSON.stringify(items[0]).slice(0, 400));

    // Process each item
    let imported = 0, errors = 0;
    for (const item of items) {
      const g  = (...keys) => { for (const k of keys) { if (item[k]!=null && item[k]!=='') return pn(item[k]); } return null; };
      const gs = (...keys) => { for (const k of keys) { if (item[k]!=null) return ps(item[k]); } return ''; };

      // Sym extraction: Apify runQuery doesn't return NSE code directly.
      // Extract from Name by matching against UNIVERSE, or use the NSE Code field if present.
      let sym = gs('nseCode','NSE Code','nse_code','symbol','Symbol');
      if (!sym) {
        // runQuery mode: actor returns "Name" but no code. Match against UNIVERSE.
        const itemName = gs('companyName','name','Name');
        if (itemName) {
          const match = UNIVERSE.find(u => u.n && u.n.toLowerCase().startsWith(itemName.toLowerCase().slice(0,15)));
          if (match) sym = match.sym;
        }
        if (!sym) { errors++; continue; }
      }

      // =====================================================================
      // FIELD MAPPINGS — verified against actual Apify actor output (2026-04)
      // The actor returns abbreviated Screener.in column names like:
      //   "P/E", "Mar Cap", "Debt / Eq", "CMP", "Int Coverage", etc.
      // Each g() call tries: [camelCase, Full Name, Apify abbreviation]
      // =====================================================================
      const data = {
        sym, name: gs('companyName','name','Name'),
        nse_code: sym,
        industry: gs('industry','Industry','sector'),
        // Apify returns "ROE" ✅ (already matched)
        roe:              g('roe','ROE','returnOnEquity'),
        // Apify returns "Debt / Eq" (was missing "Debt / Eq")
        de:               g('debtToEquity','D/E','de','Debt / Eq'),
        // Apify returns "P/E" (was missing "P/E")
        pe:               g('pe','PE','priceToEarning','P/E'),
        // Apify returns "Sales Var 3Yrs"
        rev_gr_3y:        g('salesGrowth3y','salesGrowth3Years','Sales growth 3Years','Sales Var 3Yrs'),
        // Apify returns "Profit Var 3Yrs"
        eps_gr_3y:        g('profitGrowth3y','profitGrowth3Years','Profit growth 3Years','Profit Var 3Yrs'),
        // Apify returns "OPM" ✅ (already matched)
        opm:              g('opm','OPM','operatingProfitMargin'),
        // Apify returns "ROA 12M"
        roa:              g('roa','ROA','returnOnAssets','ROA 12M'),
        // Apify returns "CMP / BV"
        pb:               g('pb','PB','priceToBook','CMP / BV'),
        // Apify returns "PEG" ✅ (already matched)
        peg:              g('peg','PEG','pegRatio'),
        // Apify returns "Int Coverage"
        int_cov:          g('interestCoverage','Interest Coverage Ratio','Int Coverage'),
        // Apify returns "Prom Hold"
        promoter_holding: g('promoterHolding','Promoter holding','Prom Hold'),
        // Apify returns "Pledged"
        pledged_pct:      g('pledgedPercentage','Pledged percentage','Pledged'),
        // Apify returns "Change in Prom Hold"
        promoter_chg:     g('promoterHoldingChange','Change in promoter holding','Change in Prom Hold'),
        // Apify returns "Mar Cap"
        mkt_cap:          g('marketCap','Market Capitalization','Mar Cap'),
        // Apify returns "CMP"
        current_price:    g('currentPrice','Current Price','price','CMP'),
        // Apify returns "EPS 12M"
        eps:              g('eps','EPS','EPS 12M'),
        // Apify returns "Debt" ✅ (already matched)
        debt:             g('debt','Debt'),
        // Apify returns "Current ratio" ✅ (already matched)
        current_ratio:    g('currentRatio','Current ratio'),
        // Apify returns "Div Yld"
        div_yield:        g('dividendYield','Dividend yield','Div Yld'),
        // Apify returns "Sales growth" ✅ (already matched)
        sales_gr_1y:      g('salesGrowth','Sales growth'),
        // Apify returns "Sales Var 5Yrs"
        sales_gr_5y:      g('salesGrowth5y','Sales growth 5Years','Sales Var 5Yrs'),
        // Apify returns "Profit growth" ✅ (already matched)
        eps_gr_1y:        g('profitGrowth','Profit growth'),
        // Apify returns "Profit Var 5Yrs"
        eps_gr_5y:        g('profitGrowth5y','Profit growth 5Years','Profit Var 5Yrs'),
        // Apify returns "ROE 3Yr"
        roe_3y_avg:       g('avgRoe3y','Average return on equity 3Years','ROE 3Yr'),
        // Apify returns "ROE 5Yr"
        roe_5y_avg:       g('avgRoe5y','Average return on equity 5Years','ROE 5Yr'),
        // Apify returns "1Yr return"
        ret_1y:           g('return1y','Return over 1year','1Yr return'),
        // Apify returns "3Yrs return"
        ret_3y:           g('return3y','Return over 3years','3Yrs return'),
        // Apify returns "5Yrs return"
        ret_5y:           g('return5y','Return over 5years','5Yrs return'),
        // Apify returns "6mth return"
        ret_6m:           g('return6m','Return over 6months','6mth return'),
        // Apify returns "3mth return"
        ret_3m:           g('return3m','Return over 3months','3mth return'),
        // Apify returns "EV / EBITDA"
        ev_ebitda:        g('evEbitda','EVEBITDA','EV / EBITDA'),
        // Apify returns "Ind PE"
        industry_pe:      g('industryPE','Industry PE','Ind PE'),
        // Apify returns "NP Qtr"
        pat_qtr:          g('netProfitLatestQuarter','Net Profit latest quarter','NP Qtr'),
        // Apify returns "Sales Qtr"
        sales_qtr:        g('salesLatestQuarter','Sales latest quarter','Sales Qtr'),
        // Apify returns "PAT 12M"
        pat_annual:       g('profitAfterTax','Profit after tax','PAT 12M'),
        // Apify returns "Sales" ✅ (already matched)
        sales_annual:     g('sales','Sales'),
        // Apify returns "Qtr Profit Var"
        pat_qtr_yoy:      g('yoyQuarterlyProfitGrowth','YOY Quarterly profit growth','Qtr Profit Var'),
        // Apify returns "Qtr Sales Var"
        sales_qtr_yoy:    g('yoyQuarterlySalesGrowth','YOY Quarterly sales growth','Qtr Sales Var'),
        // === BONUS FIELDS — available from Apify but previously uncaptured ===
        // Apify returns "ROCE" — Varsity M3 Ch 8: "#1 capital efficiency metric"
        roce:             g('roce','ROCE','returnOnCapitalEmployed'),
        // Apify returns "Earnings Yield"
        earnings_yield:   g('earningsYield','Earnings Yield'),
        // Apify returns "CMP / FCF" — Price to Free Cash Flow
        price_to_fcf:     g('priceToFCF','CMP / FCF'),
        // Apify returns "CMP / Sales" — Price to Sales
        price_to_sales:   g('priceToSales','CMP / Sales'),
      };
      if (!data.peg && data.pe && data.eps_gr_3y && data.eps_gr_3y > 0) data.peg = +(data.pe/data.eps_gr_3y).toFixed(2);

      try {
        await upsertScreenerData(data);
        imported++;
        screenerProgress.done = imported;
      } catch(e) { errors++; screenerProgress.errors++; }
    }

    screenerRunning = false;
    console.log(`✅ Bulk Screener: ${imported} imported, ${errors} errors`);
    refreshAllFundamentals();
    await dbSet('screener_last_fetch', JSON.stringify({ at: Date.now(), imported, errors, total: items.length, mode: 'bulk' }));
    return { imported, errors, total: items.length };

  } catch(e) {
    screenerRunning = false;
    console.error('❌ Bulk Screener error:', e.message);
    await dbSet('screener_last_fetch', JSON.stringify({ at: Date.now(), error: e.message })).catch(()=>{});
    return { error: e.message };
  }
}

// ── getstockdetails mode: parse rich Screener.in page data into flat fundamentals ──
function parseScreenerDetails(sym, raw) {
  const pn = v => { const n = parseFloat(String(v||'').replace(/,/g,'')); return isNaN(n)?null:n; };
  // Helper: get latest annual value from P&L / Balance Sheet array
  const latestAnnual = (arr, metric) => {
    const row = (arr||[]).find(r => r.Metric === metric);
    if (!row) return null;
    // Keys are like "Mar 2025", "Mar 2024", "TTM" — get the last numeric year key
    const keys = Object.keys(row).filter(k => k !== 'Metric').sort();
    const ttm = row['TTM']; if (ttm != null) return pn(ttm);
    return keys.length ? pn(row[keys[keys.length-1]]) : null;
  };
  // Helper: get growth rate from compounded growth arrays
  const growthRate = (arr, label) => {
    const item = (arr||[]).find(o => Object.keys(o)[0]?.includes(label));
    return item ? pn(Object.values(item)[0]) : null;
  };
  // Helper: get latest shareholding value
  const latestSH = (arr, label) => {
    const row = (arr||[]).find(r => (r['']||'').includes(label));
    if (!row) return null;
    const keys = Object.keys(row).filter(k => k !== '').sort();
    return keys.length ? pn(row[keys[keys.length-1]]) : null;
  };

  const pnl = raw.profit_and_loss || {};
  const annual = pnl.annual_data || [];
  const bs = raw.balance_sheet || [];
  const ratios = raw.ratios || [];
  const sh = raw.shareholding?.quarterly || [];

  // P&L derived
  const sales = latestAnnual(annual, 'Sales');
  const netProfit = latestAnnual(annual, 'Net Profit');
  const opm = latestAnnual(annual, 'OPM %');
  const eps = latestAnnual(annual, 'EPS in Rs');
  const interest = latestAnnual(annual, 'Interest');
  const pbt = latestAnnual(annual, 'Profit before tax');
  const depreciation = latestAnnual(annual, 'Depreciation');

  // Balance sheet derived
  const equity = latestAnnual(bs, 'Equity Capital');
  const reserves = latestAnnual(bs, 'Reserves');
  const borrowings = latestAnnual(bs, 'Borrowings');
  const totalAssets = latestAnnual(bs, 'Total Assets');
  const netWorth = (equity||0) + (reserves||0);

  // Computed ratios
  const roe = netWorth > 0 && netProfit != null ? pn((netProfit / netWorth * 100).toFixed(1)) : null;
  const de = netWorth > 0 && borrowings != null ? pn((borrowings / netWorth).toFixed(2)) : null;
  const roa = totalAssets > 0 && netProfit != null ? pn((netProfit / totalAssets * 100).toFixed(1)) : null;
  const intCov = interest > 0 && pbt != null ? pn(((pbt + interest) / interest).toFixed(1)) : null;
  const currentRatio = null; // not easily available from this format

  // Growth rates from P&L summary
  const salesGr3y = growthRate(pnl['Compounded Sales Growth'], '3 Year');
  const profitGr3y = growthRate(pnl['Compounded Profit Growth'], '3 Year');
  const salesGr5y = growthRate(pnl['Compounded Sales Growth'], '5 Year');
  const profitGr5y = growthRate(pnl['Compounded Profit Growth'], '5 Year');
  const salesGr1y = growthRate(pnl['Compounded Sales Growth'], 'TTM');
  const profitGr1y = growthRate(pnl['Compounded Profit Growth'], 'TTM');
  const ret1y = growthRate(pnl['Stock Price CAGR'], '1 Year');
  const ret3y = growthRate(pnl['Stock Price CAGR'], '3 Year');
  const ret5y = growthRate(pnl['Stock Price CAGR'], '5 Year');
  const roe3y = growthRate(pnl['Return on Equity'], '3 Year');
  const roe5y = growthRate(pnl['Return on Equity'], '5 Year');
  const roeLast = growthRate(pnl['Return on Equity'], 'Last Year');

  // ROCE from ratios
  const roceRow = (ratios||[]).find(r => r.Metric === 'ROCE %');
  let roce = null;
  if (roceRow) {
    const rKeys = Object.keys(roceRow).filter(k => k !== 'Metric').sort();
    if (rKeys.length) roce = pn(roceRow[rKeys[rKeys.length-1]]);
  }

  // Shareholding
  const promoter = latestSH(sh, 'Promoters');
  // Promoter change: latest - previous quarter
  let promoterChg = null;
  const promRow = (sh||[]).find(r => (r['']||'').includes('Promoters'));
  if (promRow) {
    const pKeys = Object.keys(promRow).filter(k => k !== '').sort();
    if (pKeys.length >= 2) promoterChg = pn((pn(promRow[pKeys[pKeys.length-1]]) - pn(promRow[pKeys[pKeys.length-2]])).toFixed(2));
  }

  // FII, DII, and number of shareholders from shareholding data
  const fiiHolding = latestSH(sh, 'FII') ?? latestSH(sh, 'Foreign');
  const diiHolding = latestSH(sh, 'DII') ?? latestSH(sh, 'Domestic');
  const numShareholders = latestSH(sh, 'No. of Shareholders') ?? latestSH(sh, 'Shareholders');

  // Quarterly data for recent quarter growth
  const qtrs = raw.quarters || [];
  const salesQtr = latestAnnual(qtrs, 'Sales');
  const patQtr = latestAnnual(qtrs, 'Net Profit');

  // Quarterly YoY growth — compare latest quarter vs same quarter last year
  let patQtrYoy = null, salesQtrYoy = null;
  if (qtrs.length) {
    const salesRow = (qtrs||[]).find(r => r.Metric === 'Sales');
    const patRow = (qtrs||[]).find(r => r.Metric === 'Net Profit');
    if (salesRow) {
      const qKeys = Object.keys(salesRow).filter(k => k !== 'Metric').sort();
      if (qKeys.length >= 5) { // need at least 5 quarters for YoY
        const latest = pn(salesRow[qKeys[qKeys.length-1]]);
        const yearAgo = pn(salesRow[qKeys[qKeys.length-5]]);
        if (latest != null && yearAgo != null && yearAgo > 0) salesQtrYoy = pn(((latest - yearAgo) / yearAgo * 100).toFixed(1));
      }
    }
    if (patRow) {
      const qKeys = Object.keys(patRow).filter(k => k !== 'Metric').sort();
      if (qKeys.length >= 5) {
        const latest = pn(patRow[qKeys[qKeys.length-1]]);
        const yearAgo = pn(patRow[qKeys[qKeys.length-5]]);
        if (latest != null && yearAgo != null && yearAgo > 0) patQtrYoy = pn(((latest - yearAgo) / yearAgo * 100).toFixed(1));
      }
    }
  }

  // Current ratio from balance sheet: Current Assets / Current Liabilities
  let computedCurrentRatio = null;
  const currentAssets = latestAnnual(bs, 'Other Assets'); // proxy for current assets
  const currentLiabilities = latestAnnual(bs, 'Other Liabilities'); // proxy for current liabilities
  if (currentAssets > 0 && currentLiabilities > 0) computedCurrentRatio = pn((currentAssets / currentLiabilities).toFixed(2));

  // Pledged percentage from shareholding
  const pledgedRow = (sh||[]).find(r => (r['']||'').toLowerCase().includes('pledg'));
  let pledgedPct = null;
  if (pledgedRow) {
    const pKeys = Object.keys(pledgedRow).filter(k => k !== '').sort();
    if (pKeys.length) pledgedPct = pn(pledgedRow[pKeys[pKeys.length-1]]);
  }

  // Cash flow data for FCF
  const cf = raw.cash_flow || [];
  const cfFromOps = latestAnnual(cf, 'Cash from Operating Activity');
  const capex = latestAnnual(cf, 'Fixed Assets Purchased');  // usually negative
  const fcf = (cfFromOps != null && capex != null) ? cfFromOps + capex : null;

  // Dividend from P&L for yield calc
  const dividendPayout = latestAnnual(annual, 'Dividend Payout %');

  // Industry from raw metadata
  const industry = raw.industry || raw.sector || null;

  // Use live price for derived ratios
  const livePrice = livePrices[sym]?.price || null;
  const currentPrice = livePrice;
  const pe = (livePrice && eps && eps > 0) ? pn((livePrice / eps).toFixed(1)) : null;
  const bookValuePerShare = (netWorth > 0 && equity > 0) ? netWorth / equity * 10 : null; // approx
  const pb = (livePrice && bookValuePerShare > 0) ? pn((livePrice / bookValuePerShare).toFixed(2)) : null;
  const peg = (pe && profitGr3y && profitGr3y > 0) ? pn((pe / profitGr3y).toFixed(2)) : null;
  const earningsYield = pe > 0 ? pn((100 / pe).toFixed(2)) : null;

  // Compute mktCap: price * shares, where shares ≈ netProfit / eps (in Cr)
  const computedMktCap = (livePrice && netProfit && eps && eps > 0) ? pn((livePrice * netProfit / eps).toFixed(0)) : null;

  const priceToSales = computedMktCap > 0 && sales > 0 ? pn((computedMktCap / sales).toFixed(2)) : null;
  const priceToFcf = computedMktCap > 0 && fcf > 0 ? pn((computedMktCap / fcf).toFixed(1)) : null;

  // EV/EBITDA: EV = mktCap + debt, EBITDA ≈ Operating Profit (sales * OPM%)
  const operatingProfit = (sales && opm) ? sales * opm / 100 : null;
  const computedEvEbitda = (computedMktCap && operatingProfit > 0)
    ? pn(((computedMktCap + (borrowings||0)) / operatingProfit).toFixed(1)) : null;

  // Dividend Yield: dividendPayout% * EPS / price * 100 (approximate)
  const computedDivYield = (dividendPayout > 0 && eps > 0 && livePrice > 0)
    ? pn((dividendPayout * eps / livePrice).toFixed(2)) : null;

  // Industry PE from raw metadata if available
  const computedIndustryPE = raw.industry_pe || raw.industryPE || null;

  return {
    sym, name: raw.company_name || sym,
    nse_code: sym,
    industry,
    roe: roeLast ?? roe, de, pe,
    rev_gr_3y: salesGr3y, eps_gr_3y: profitGr3y,
    opm, roa, pb, peg,
    int_cov: intCov, promoter_holding: promoter,
    pledged_pct: pledgedPct, promoter_chg: promoterChg,
    mkt_cap: computedMktCap, current_price: currentPrice,
    eps, debt: borrowings, current_ratio: computedCurrentRatio,
    div_yield: computedDivYield, sales_gr_1y: salesGr1y, sales_gr_5y: salesGr5y,
    eps_gr_1y: profitGr1y, eps_gr_5y: profitGr5y,
    roe_3y_avg: roe3y, roe_5y_avg: roe5y,
    ret_1y: ret1y, ret_3y: ret3y, ret_5y: ret5y,
    ret_6m: null, ret_3m: null,
    ev_ebitda: computedEvEbitda, industry_pe: pn(computedIndustryPE),
    pat_qtr: patQtr, sales_qtr: salesQtr,
    pat_annual: netProfit, sales_annual: sales,
    pat_qtr_yoy: patQtrYoy, sales_qtr_yoy: salesQtrYoy,
    roce, earnings_yield: earningsYield, price_to_fcf: priceToFcf, price_to_sales: priceToSales,
    fii_holding: fiiHolding, dii_holding: diiHolding, num_shareholders: numShareholders,
  };
}

// ── Fetch single stock via getstockdetails mode ──
async function fetchOneScreenerStock(sym, apifyToken) {
  const BASE  = 'https://api.apify.com/v2';
  const ACTOR = 'shashwattrivedi~screener-in';
  const startResp = await fetch(`${BASE}/acts/${ACTOR}/runs?token=${apifyToken}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'getstockdetails', url: `https://www.screener.in/company/${sym}/consolidated/` }),
    signal: AbortSignal.timeout(15000),
  });
  if (!startResp.ok) throw new Error(`Start failed: ${startResp.status}`);
  const runInfo = await startResp.json();
  const runId = runInfo.data?.id, datasetId = runInfo.data?.defaultDatasetId;
  if (!runId) throw new Error('No run ID');

  // Poll until done (max 3 min)
  let status = 'RUNNING', attempts = 0;
  while ((status === 'RUNNING' || status === 'READY') && attempts < 36) {
    await new Promise(r => setTimeout(r, 5000));
    attempts++;
    const poll = await fetch(`${BASE}/acts/${ACTOR}/runs/${runId}?token=${apifyToken}`, { signal: AbortSignal.timeout(10000) });
    if (poll.ok) status = (await poll.json()).data?.status || 'RUNNING';
  }
  if (status !== 'SUCCEEDED') throw new Error(`Run ended: ${status}`);

  const dataResp = await fetch(`${BASE}/datasets/${datasetId}/items?token=${apifyToken}&limit=5`, { signal: AbortSignal.timeout(15000) });
  const items = await dataResp.json();
  if (!Array.isArray(items) || !items.length) throw new Error('Empty dataset');
  const raw = items[0];
  const parsed = parseScreenerDetails(sym, raw);
  // Store raw response for rich history fields (quarters, P&L, BS, CF, ratios, shareholding)
  try {
    const rich = {
      quarters: raw.quarters || [],
      profit_and_loss: raw.profit_and_loss || {},
      balance_sheet: raw.balance_sheet || [],
      cash_flow: raw.cash_flow || [],
      ratios: raw.ratios || [],
      shareholding: raw.shareholding || {},
      company_name: raw.company_name,
    };
    await dbSet(`screener_rich_${sym}`, JSON.stringify(rich));
  } catch(e) { /* non-critical */ }
  return parsed;
}

// ── Batch fetch all stocks via getstockdetails (parallel batches of 3) ──
async function fetchAllScreenerByStock(apifyToken) {
  if (screenerRunning) return { error: 'Already running' };
  screenerRunning = true;
  const stocks = UNIVERSE.filter(s => !s.sym.includes('USDT')).map(s => s.sym);
  screenerProgress = { done: 0, total: stocks.length, errors: 0, startedAt: Date.now() };
  console.log(`📊 Screener getstockdetails: fetching ${stocks.length} stocks in batches of 3...`);

  let imported = 0, errors = 0;
  const BATCH = 3; // Apify concurrent run limit

  for (let i = 0; i < stocks.length; i += BATCH) {
    const batch = stocks.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(async sym => {
      try {
        const data = await fetchOneScreenerStock(sym, apifyToken);
        await upsertScreenerData(data);
        patchScreenerIntoFUND(sym, data);
        return { sym, ok: true };
      } catch(e) {
        return { sym, ok: false, error: e.message };
      }
    }));

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok) { imported++; }
      else { errors++; }
    }
    screenerProgress.done = imported;
    screenerProgress.errors = errors;

    if ((i/BATCH) % 10 === 0) {
      console.log(`📊 Screener progress: ${imported}/${stocks.length} OK, ${errors} errors (batch ${Math.floor(i/BATCH)+1})`);
    }
    // Small pause between batches
    if (i + BATCH < stocks.length) await new Promise(r => setTimeout(r, 2000));
  }

  screenerRunning = false;
  console.log(`✅ Screener getstockdetails: ${imported} imported, ${errors} errors`);
  if (imported > 10) refreshAllFundamentals();
  await dbSet('screener_last_fetch', JSON.stringify({ at: Date.now(), imported, errors, total: stocks.length, mode: 'getstockdetails' }));
  return { imported, errors, total: stocks.length };
}

async function fetchAllScreenerData() {
  if (screenerRunning) return { error: 'Already running' };
  const token = process.env.APIFY_TOKEN;
  if (!token) return { error: 'APIFY_TOKEN not set' };
  // Use getstockdetails mode (per-stock) — more reliable than runQuery
  return fetchAllScreenerByStock(token);
}

// Admin: server logs endpoint
app.get('/api/admin/logs', (req, res) => {
  const since = parseInt(req.query.since || '0');
  const lines = since ? LOG_BUFFER.filter(l => l.t > since) : LOG_BUFFER.slice(-100);
  res.json({ lines, now: Date.now() });
});

// Manual rescore trigger
app.post('/api/stocks/rescore', (req, res) => {
  if (stockFundLoading) return res.json({ message: 'Already scoring...' });
  res.json({ message: 'Re-scoring started in background' });
  refreshAllFundamentals();
});

// MF cache rebuild trigger
app.post('/api/mf/rebuild-cache', (req, res) => {
  res.json({ message: 'MF cache rebuild started' });
  buildMFCache();
});

// Test: run bulk query filtered to ONE stock to verify Apify + field mapping
app.get('/api/screener/test/:sym', async (req, res) => {
  const sym = req.params.sym.toUpperCase();
  const token = process.env.APIFY_TOKEN;
  if (!token) return res.json({ error: 'APIFY_TOKEN not set' });
  if (!process.env.SCREENER_USERNAME) return res.json({ error: 'SCREENER_USERNAME not set' });
  try {
    const BASE  = 'https://api.apify.com/v2';
    const ACTOR = 'shashwattrivedi~screener-in';
    const startResp = await fetch(`${BASE}/acts/${ACTOR}/runs?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'getstockdetails',
        url: `https://www.screener.in/company/${sym}/consolidated/`,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!startResp.ok) return res.json({ error: `Start failed: ${startResp.status}` });
    const runInfo = await startResp.json();
    const runId = runInfo.data?.id;
    const datasetId = runInfo.data?.defaultDatasetId;
    if (!runId) return res.json({ error: 'No run ID' });

    // Poll until done (max 2 min)
    let status = 'RUNNING', attempts = 0;
    while ((status === 'RUNNING' || status === 'READY') && attempts < 24) {
      await new Promise(r => setTimeout(r, 5000));
      attempts++;
      const poll = await fetch(`${BASE}/acts/${ACTOR}/runs/${runId}?token=${token}`, { signal: AbortSignal.timeout(10000) });
      if (poll.ok) status = (await poll.json()).data?.status || 'RUNNING';
    }
    if (status !== 'SUCCEEDED') return res.json({ error: `Run ended: ${status}` });

    const dataResp = await fetch(`${BASE}/datasets/${datasetId}/items?token=${token}&limit=5`, { signal: AbortSignal.timeout(15000) });
    const items = await dataResp.json();
    res.json({ success: true, sym, run_id: runId, item_count: items.length, fields: items[0] ? Object.keys(items[0]) : [], sample: items[0] || null });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

// Manual trigger — ?mode=bulk for runQuery, default is getstockdetails
app.post('/api/screener/fetch', async (req, res) => {
  if (!process.env.APIFY_TOKEN) return res.status(400).json({ error: 'Set APIFY_TOKEN in Railway env vars' });
  if (screenerRunning) return res.json({ message: 'Already running', progress: screenerProgress });
  const mode = req.query.mode || 'getstockdetails';
  const total = UNIVERSE.filter(s=>!s.sym.includes('USDT')).length;
  res.json({ message: `Screener fetch started (${mode})`, total, mode });
  if (mode === 'bulk') {
    fetchAllScreenerBulk(process.env.APIFY_TOKEN).catch(e => console.error('Screener bulk error:', e.message));
  } else {
    fetchAllScreenerByStock(process.env.APIFY_TOKEN).catch(e => console.error('Screener fetch error:', e.message));
  }
});

// Progress check
app.get('/api/screener/status', async (req, res) => {
  try {
    const last = await dbGet('screener_last_fetch');
    const result = await pool.query('SELECT COUNT(*) as total, MAX(imported_at) as last_import FROM screener_fundamentals');
    res.json({
      running:        screenerRunning,
      progress:       screenerProgress,
      db_total:       parseInt(result.rows[0].total),
      db_last_import: result.rows[0].last_import,
      in_memory:      Object.keys(global.FUND_EXT||{}).filter(s=>global.FUND_EXT[s]?.source==='Screener.in').length,
      last_fetch:     last ? JSON.parse(last) : null,
      schedule:       'Daily 8PM IST',
    });
  } catch(e) { res.json({ error: e.message }); }
});

// -- Deep Single-Stock Analysis endpoint ---------------------------------------
// Gathers: candles, technicals, fundamentals, news sentiment, and AI recommendation
app.get('/api/stocks/analyze/:sym', async(req,res)=>{
  const sym = req.params.sym.toUpperCase().trim();
  try {
    const meta   = UNIVERSE.find(u=>u.sym===sym)||{sym,n:sym,grp:'NSE'};
    const fund   = FUND[sym]||null;
    const fundExt = global.FUND_EXT?.[sym] || null; // rich scraped data
    const sector = SECTOR_MAP[sym]||'Other';
    const token  = validTokens[sym]||INSTRUMENTS[sym];

    // ALL DATA IN PARALLEL — fetch MAX available candles from Kite
    const [rDay,rWeek,rMonth,r1h,rNews] = await Promise.allSettled([
      (async()=>{ if(!kite||!token)return null;
        // Daily candles — 5 years back (safe Kite range)
        const t=new Date(),f=new Date(Date.now()-5*365*864e5);
        try {
          const result = await kite.getHistoricalData(token,'day',f.toISOString().split('T')[0],t.toISOString().split('T')[0]);
          console.log(`📈 analyze(${sym}) daily: ${result?.length||0} candles`);
          return result;
        } catch(e) {
          console.error(`❌ analyze(${sym}) daily FAILED: ${e.message}`);
          throw e;
        }
      })(),
      (async()=>{ if(!kite||!token)return null;
        // Weekly candles — 10 years back
        const f=new Date(Date.now()-10*365*864e5);
        return kite.getHistoricalData(token,'week',f.toISOString().split('T')[0],new Date().toISOString().split('T')[0]);
      })(),
      (async()=>{ if(!kite||!token)return null;
        // Monthly candles — 15 years back
        const f=new Date(Date.now()-15*365*864e5);
        return kite.getHistoricalData(token,'month',f.toISOString().split('T')[0],new Date().toISOString().split('T')[0]);
      })(),
      (async()=>{ if(!kite||!token)return null;
        // 60min candles — last 6 months for intraday patterns
        const t=new Date(),f=new Date(Date.now()-180*864e5);
        return kite.getHistoricalData(token,'60minute',f.toISOString().split('T')[0],t.toISOString().split('T')[0]);
      })(),
      (async()=>{
        const feeds=[
          {url:'https://economictimes.indiatimes.com/markets/stocks/rss.cms',src:'ET Markets'},
          {url:'https://www.moneycontrol.com/rss/MCtopnews.xml',src:'Moneycontrol'},
          {url:'https://www.business-standard.com/rss/markets-106.rss',src:'Business Standard'},
          {url:'https://www.livemint.com/rss/markets',src:'Mint'}
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
      })()
    ]);

    const cDay  = rDay.status==='fulfilled'   && rDay.value   ? rDay.value   : [];
    const cWeek = rWeek.status==='fulfilled'  && rWeek.value  ? rWeek.value  : [];
    const cMonth= rMonth.status==='fulfilled' && rMonth.value ? rMonth.value : [];
    const c1h   = r1h.status==='fulfilled'    && r1h.value    ? r1h.value    : [];
    const news  = rNews.status==='fulfilled'  && rNews.value  ? rNews.value  : [];

    // Use daily as primary candle set (most data), fall back to weekly/monthly
    const candles = cDay.length>=50 ? cDay : cWeek.length>=30 ? cWeek : cMonth.length>=12 ? cMonth : [];
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
    const t  = safeCompute(cDay.length>=50 ? cDay : candles);
    const tw = safeCompute(cWeek.length>30 ? cWeek : null);
    const tm = safeCompute(cMonth.length>12 ? cMonth : null);
    const th = safeCompute(c1h.length>20 ? c1h : null);

    const charts={
      '3M': c1h.slice(-500).map(c=>({t:new Date(c.date).getTime(),o:+c.open.toFixed(2),h:+c.high.toFixed(2),l:+c.low.toFixed(2),c:+c.close.toFixed(2),v:c.volume||0})),
      '1Y': cDay.slice(-365).map(c=>({t:new Date(c.date).getTime(),o:+c.open.toFixed(2),h:+c.high.toFixed(2),l:+c.low.toFixed(2),c:+c.close.toFixed(2),v:c.volume||0})),
      '3Y': cDay.slice(-756).map(c=>({t:new Date(c.date).getTime(),o:+c.open.toFixed(2),h:+c.high.toFixed(2),l:+c.low.toFixed(2),c:+c.close.toFixed(2),v:c.volume||0})),
      '10Y':cWeek.map(c=>({t:new Date(c.date).getTime(),o:+c.open.toFixed(2),h:+c.high.toFixed(2),l:+c.low.toFixed(2),c:+c.close.toFixed(2),v:c.volume||0})),
      'MAX':cMonth.map(c=>({t:new Date(c.date).getTime(),o:+c.open.toFixed(2),h:+c.high.toFixed(2),l:+c.low.toFixed(2),c:+c.close.toFixed(2),v:c.volume||0})),
    };

    // FUNDAMENTALS - merge hardcoded + scraped extended data
    const f=fund||fundExt?{
      // Core: prefer hardcoded (curated) but fill nulls with scraped
      roe:   fund?.[0] ?? fundExt?.roe   ?? null,
      de:    fund?.[1] ?? fundExt?.de    ?? null,
      pe:    fund?.[2] ?? fundExt?.pe    ?? null,
      revGr: fund?.[3] ?? fundExt?.revGr ?? null,
      epsGr: fund?.[4] ?? fundExt?.epsGr ?? null,
      opMgn: fund?.[5] ?? fundExt?.opMgn ?? null,
      // Extended (real scraped data)
      fwdPE:       fundExt?.fwdPE       ?? null,
      peg:         fundExt?.peg         ?? (fund?.[2]&&fund?.[4]&&fund[4]>0?+(fund[2]/fund[4]).toFixed(2):null),
      grossMgn:    fundExt?.grossMgn    ?? null,
      profMgn:     fundExt?.profMgn     ?? null,
      roa:         fundExt?.roa         ?? null,
      currentRatio:fundExt?.currentRatio?? null,
      quickRatio:  fundExt?.quickRatio  ?? null,
      pb:          fundExt?.pb          ?? null,
      evEbitda:    fundExt?.evEbitda    ?? null,
      divYield:    fundExt?.divYield    ?? null,
      instHeld:    fundExt?.instHeld    ?? null,
      insiderHeld: fundExt?.insiderHeld ?? null,
      bookValue:   fundExt?.bookValue   ?? null,
      mktCap:      fundExt?.mktCap      ?? null,
      dataSource:  fundExt?.source      ?? (fund?'Hardcoded':'N/A'),
      fetchedAt:   fundExt?.fetchedAt   ?? null,
      // Peer labels
      get roePeer(){ const v=this.roe; return v>=20?'Excellent (>20%)':v>=15?'Good (15-20%)':v>=10?'Average (10-15%)':'Weak (<10%)'; },
      get dePeer(){  const v=this.de;  return v<=0.3?'Near debt-free':v<=0.7?'Very low debt':v<=1.5?'Manageable':v<=3?'High debt':'Dangerous'; },
      get pePeer(){  const v=this.pe;  return v<15?'Cheap (<15x)':v<25?'Fair (15-25x)':v<40?'Premium (25-40x)':'Expensive (>40x)'; },
      get growthPeer(){ const v=this.revGr; return v>=25?'Hypergrowth (>25%)':v>=15?'Strong (15-25%)':v>=8?'Moderate (8-15%)':v>=0?'Slow (<8%)':'Declining'; },
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

    // 7. FUNDAMENTALS — Varsity Chapter 12 complete checklist
    // ==========================================================================
    // Varsity: "Run through this checklist before you put a single rupee to work"
    // Added: CFO quality proxy, Interest Coverage, P/BV, PEG, ROA, Revenue Growth
    // ==========================================================================

    // ROE — Varsity: "#1 quality signal; >15% consistently = management excellence"
    checklist.roeCheck = {
      pass: f && f.roe >= 15,
      pts:  f ? (f.roe>=22?8 : f.roe>=18?7 : f.roe>=15?6 : f.roe>=12?3 : f.roe>=8?1 : 0) : 0,
      max:  8,
      label:`ROE: ${f ? f.roe+'%' : 'N/A'}`,
      detail: f ? `${f.roePeer}. ${f.roe>=15 ? 'Strong ROE — management compounding capital well. Varsity: >15% = quality threshold.' : 'Below 15% — capital not being deployed efficiently.'}` : 'No fundamental data',
    };

    // D/E Ratio — Varsity: "High debt during a fall = amplified risk; D/E<1 = safe"
    checklist.debtCheck = {
      pass: f && f.de <= 1,
      pts:  f ? (f.de<=0.2?6 : f.de<=0.5?5 : f.de<=1?4 : f.de<=1.5?2 : 0) : 0,
      max:  6,
      label:`D/E: ${f ? f.de+'x' : 'N/A'}`,
      detail: f ? `${f.dePeer}. ${f.de<=1 ? 'Healthy balance sheet — company survives slowdowns without distress.' : 'High leverage — interest costs amplify losses in downturns. Varsity: D/E>2 = risky.'}` : 'N/A',
    };

    // Interest Coverage — Varsity: "<1.5x = danger zone; company barely covering interest"
    // Proxy: if D/E and opMgn both available, estimate coverage quality
    const intCovProxy = f && f.de != null && f.opMgn != null
      ? (f.de <= 0.3 ? 'High (>5x)' : f.de <= 0.7 ? 'Comfortable (3-5x)' : f.de <= 1.5 ? 'Moderate (1.5-3x)' : 'Low (<1.5x — danger)')
      : null;
    const intCovPass = f && f.de != null && f.de <= 1.5;
    checklist.intCovCheck = {
      pass:   intCovPass,
      pts:    f && f.de != null ? (f.de<=0.3?5 : f.de<=0.7?4 : f.de<=1.5?2 : 0) : 0,
      max:    5,
      label:  `Interest Coverage (est): ${intCovProxy || 'N/A'}`,
      detail: f && f.de != null
        ? `Estimated from D/E ${f.de}x. ${f.de<=1.5 ? 'Varsity: comfortable coverage — company not strained by debt servicing.' : 'Varsity: D/E>1.5 suggests tight interest coverage — earnings cliff risk if business slows.'}`
        : 'No debt data available',
    };

    // EPS Growth — Varsity: "Earnings growth = engine of long-term wealth creation"
    checklist.growthCheck = {
      pass: f && f.epsGr >= 10,
      pts:  f && f.epsGr < 400 ? (f.epsGr>=25?6 : f.epsGr>=15?5 : f.epsGr>=10?3 : f.epsGr>=5?2 : f.epsGr>=0?1 : 0) : 0,
      max:  6,
      label:`EPS Growth: ${f ? f.epsGr+'%' : 'N/A'}`,
      detail: f ? `${f.epsGr>=15 ? 'Strong earnings growth — stock price will follow over time. Varsity: EPS growth is the long-term stock driver.' : f.epsGr>=0 ? 'Modest growth — acceptable but not exciting.' : 'EPS declining — major red flag. Stock price eventually follows earnings down.'}` : 'N/A',
    };

    // Revenue Growth — Varsity: "Top-line growth validates business expansion"
    // Operating leverage bonus: EPS growing faster than revenue = margin expansion
    const revGr = f ? (f.revGr || f.revGrowth || null) : null;
    const opLeverage = f && revGr != null && f.epsGr != null && f.epsGr > (revGr + 5);
    checklist.revGrowth = {
      pass:   revGr != null && revGr >= 8,
      pts:    revGr != null ? (revGr>=20?4 : revGr>=12?3 : revGr>=6?2 : revGr>=0?1 : 0) + (opLeverage?1:0) : 0,
      max:    5,
      label:  `Revenue Growth: ${revGr != null ? revGr+'%' : 'N/A'}${opLeverage ? ' + Op Leverage' : ''}`,
      detail: revGr != null
        ? `${revGr>=10 ? 'Revenue growing — business expanding.' : revGr>=0 ? 'Slow revenue growth — limited business expansion.' : 'Revenue declining — structural concern.'}${opLeverage ? ' EPS outpacing revenue = operating leverage = margin expansion (Varsity: strong quality signal).' : ''}` : 'N/A',
    };

    // Operating Margin — Varsity: "Increasing margin = management efficiency improving"
    checklist.marginCheck = {
      pass: f && f.opMgn >= 15,
      pts:  f ? (f.opMgn>=25?4 : f.opMgn>=18?3 : f.opMgn>=12?2 : f.opMgn>=6?1 : 0) : 0,
      max:  4,
      label:`Op Margin: ${f ? f.opMgn+'%' : 'N/A'}`,
      detail: f ? `${f.opMgn>=20 ? 'High margin business — strong pricing power and cost discipline.' : f.opMgn>=12 ? 'Reasonable margins — acceptable for most sectors.' : f.opMgn>=0 ? 'Thin margins — vulnerable to cost pressure or price competition.' : 'Negative margins — operating at a loss. Very concerning.'}` : 'N/A',
    };

    // CFO Quality proxy — Varsity: "PAT should convert to CFO. PAT high + CFO low = manipulation"
    // Proxy: ROA > 0 and margin trend (no direct CFO/PAT ratio from static data)
    const roa = f ? (f.roa || null) : null;
    const cfoPasses = roa != null ? roa >= 5 : (f && f.opMgn >= 10 && f.roe >= 12);
    checklist.cfoQuality = {
      pass:   cfoPasses,
      pts:    roa != null ? (roa>=12?4 : roa>=8?3 : roa>=5?2 : roa>=2?1 : 0) : (f&&f.roe>=15&&f.opMgn>=12?2 : f&&f.roe>=10?1 : 0),
      max:    4,
      label:  `CFO Quality${roa != null ? ` / ROA: ${roa}%` : ' (proxy)'}`,
      detail: roa != null
        ? `ROA ${roa}% ${roa>=8 ? '— solid asset productivity; profits are converting to real cash.' : roa>=4 ? '— moderate. Check that PAT is genuinely converting to operating cash flow.' : '— low ROA despite profits may indicate working capital problems or revenue recognition issues. Varsity: most critical earnings quality check.'}`
        : f ? `No direct CFO data. Using ROE ${f.roe}% + OpMgn ${f.opMgn}% as quality proxy. Varsity: ideally verify CFO > PAT in annual report before investing.` : 'N/A',
    };

    // P/E Valuation — Varsity: "P/E without growth context = incomplete"
    checklist.peCheck = {
      pass: f && f.pe > 0 && f.pe < 40,
      pts:  f && f.pe > 0 ? (f.pe<12?5 : f.pe<20?4 : f.pe<30?3 : f.pe<45?1 : 0) : 0,
      max:  5,
      label:`P/E: ${f ? f.pe+'x' : 'N/A'}`,
      detail: f && f.pe > 0 ? `${f.pePeer}. ${f.pe<20 ? 'Cheap valuation — paying less for earnings. Margin of safety present.' : f.pe<35 ? 'Fair valuation — priced for moderate growth.' : 'Expensive — high P/E needs high earnings growth to justify. Any disappointment = sharp fall.'}` : 'N/A',
    };

    // PEG Ratio — Varsity/Lynch: "PEG<1 = growth at discount; PEG>2 = paying too much for growth"
    const peg = f ? (f.peg || (f.pe>0 && f.epsGr>0 ? +(f.pe/f.epsGr).toFixed(2) : null)) : null;
    checklist.pegCheck = {
      pass:   peg != null && peg < 1.5,
      pts:    peg != null ? (peg<0.5?4 : peg<1?3 : peg<1.5?2 : peg<2?1 : 0) : 0,
      max:    4,
      label:  `PEG Ratio: ${peg != null ? peg : 'N/A'}`,
      detail: peg != null
        ? `PEG = P/E ${f.pe} ÷ EPS Growth ${f.epsGr}%. ${peg<1 ? 'PEG below 1 = growth available at a discount. Peter Lynch: best stocks have PEG<1.' : peg<1.5 ? 'Fair — paying a slight premium for growth. Acceptable.' : 'High PEG — paying too much for the growth rate. Varsity: margin of safety eroded.'}`
        : f ? 'Cannot compute — need positive EPS growth' : 'N/A',
    };

    // P/BV — Varsity Module 3: "P/BV primary for banks; P/BV<1 = below liquidation value"
    const pb = f ? (f.pb || null) : null;
    checklist.pbvCheck = {
      pass:   pb != null ? pb < 4 : true,
      pts:    pb != null ? (pb<1?4 : pb<2?3 : pb<3?2 : pb<5?1 : 0) : 0,
      max:    4,
      label:  `P/BV: ${pb != null ? pb+'x' : 'N/A'}`,
      detail: pb != null
        ? `${pb<1 ? 'Below book value — trading at discount to liquidation value. Deep value if business is healthy.' : pb<2 ? 'Reasonable premium to book — fair for a profitable business.' : pb<4 ? 'Moderate premium — justified if ROE is high (high ROE businesses deserve high P/BV).' : 'High P/BV — priced for perfection. Risk of multiple compression if growth disappoints.'} ${d.sector==='Banking'?'(Varsity: P/BV is the primary valuation metric for banks)':''}`
        : 'Book value data not available',
    };

    // 8. TECHNICAL SIGNALS — additional Varsity signals not in trend section
    // ADX — Varsity Module 2: "ADX measures trend STRENGTH, not direction"
    const adxVal = t.adx || 0;
    const adxTrending = adxVal >= 25;
    checklist.adxCheck = {
      pass:   adxTrending && t.adxPlus > t.adxMinus,
      pts:    adxTrending && t.adxPlus > t.adxMinus ? 3 : adxTrending ? 1 : 0,
      max:    3,
      label:  `ADX: ${adxVal.toFixed(0)} (${t.trendStrength || 'N/A'})`,
      detail: adxVal >= 40
        ? `Very strong trend (ADX ${adxVal.toFixed(0)}). ${t.adxPlus>t.adxMinus?'+DI above -DI = bullish trend confirmed.':'-DI above +DI = strong downtrend — avoid.'}`
        : adxVal >= 25
        ? `Trending market (ADX ${adxVal.toFixed(0)}). ${t.adxPlus>t.adxMinus?'+DI above -DI — uptrend has momentum.':'Downtrend in progress.'} Varsity: ADX>25 = trade with the trend.`
        : `Weak/sideways market (ADX ${adxVal.toFixed(0)}). No clear trend. Varsity: ADX<20 = avoid breakout trades, use range strategies.`,
    };

    // Stochastic — Varsity: double confirmation with RSI
    const stochK = t.stochK || 50;
    const stochHealthy = stochK >= 35 && stochK <= 70;
    checklist.stochCheck = {
      pass:   stochHealthy || stochK <= 20,
      pts:    stochK <= 20 ? 3 : stochK <= 30 ? 2 : stochHealthy ? 2 : stochK >= 80 ? 0 : 1,
      max:    3,
      label:  `Stochastic: ${stochK.toFixed(0)}`,
      detail: stochK <= 20
        ? `Stochastic ${stochK.toFixed(0)} — extreme oversold. Varsity: Stoch + RSI both oversold = double confirmation of buy zone.`
        : stochK <= 35
        ? `Stochastic in oversold zone (${stochK.toFixed(0)}) — accumulation opportunity with RSI confirmation.`
        : stochHealthy
        ? `Stochastic in healthy range (${stochK.toFixed(0)}) — momentum balanced, entry reasonable.`
        : `Stochastic overbought (${stochK.toFixed(0)}) — avoid chasing. Wait for pullback below 70.`,
    };

    // RSI Bullish Divergence — Varsity: "#1 reversal signal for oversold quality stocks"
    const hasBullDiv = !!(t.bullishDiv);
    const hasBearDiv = !!(t.bearishDiv);
    checklist.rsiDivCheck = {
      pass:   hasBullDiv && !hasBearDiv,
      pts:    hasBullDiv ? 4 : hasBearDiv ? 0 : 1,
      max:    4,
      label:  `RSI Divergence: ${hasBullDiv ? 'Bullish ⬆' : hasBearDiv ? 'Bearish ⬇' : 'None'}`,
      detail: hasBullDiv
        ? `RSI Bullish Divergence detected — price made lower low but RSI made higher low. Varsity: #1 reversal signal. Selling pressure is exhausting. High probability bounce incoming.`
        : hasBearDiv
        ? `RSI Bearish Divergence — price made higher high but RSI made lower high. Varsity: buying pressure weakening. Potential reversal downward. Caution.`
        : `No RSI divergence. Trend likely to continue in current direction. Watch for divergence to signal turning points.`,
    };

    // 9. SENTIMENT
    checklist.newsCheck = {
      pass:   sentScore >= 0,
      pts:    sentScore > 30 ? 3 : sentScore > 0 ? 2 : sentScore === 0 ? 1 : 0,
      max:    3,
      label:  `News: ${bull}B / ${bear}Be / ${neut}N`,
      detail: news.length > 0
        ? `${sentScore > 0 ? 'Positive' : 'Negative'} news flow. ${bull} bullish, ${bear} bearish articles. News sentiment often leads price action by days.`
        : 'No recent news found in feeds',
    };

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

    // Fundamentals — extended Varsity analysis
    if (f) {
      if (f.roe >= 15) analysis.push({cat:'Quality',icon:'💰',signal:'positive',title:`ROE ${f.roe}% — ${f.roePeer}`,text:`Return on Equity of ${f.roe}% means for every ₹100 of shareholder capital, the company generates ₹${f.roe} in profit. Varsity benchmark: >15% consistently = excellent quality business. This shows management is compounding capital efficiently. Compare: Infosys ~30%, HDFC Bank ~16%.`});
      else analysis.push({cat:'Quality',icon:'⚠️',signal:'negative',title:`ROE ${f.roe}% — ${f.roePeer}`,text:`ROE of ${f.roe}% is below the 15% Varsity threshold. The company isn't generating strong returns on shareholder capital. Low ROE sustained over years = value destruction for investors.`});

      if (f.de <= 0.7) analysis.push({cat:'Balance Sheet',icon:'💪',signal:'positive',title:`Low Debt D/E: ${f.de}x — ${f.dePeer}`,text:`Debt-to-equity of ${f.de}x is excellent. Varsity: D/E<0.5 = near debt-free, can survive recessions and fund growth organically. Low-debt companies outperform significantly during economic slowdowns.`});
      else if (f.de > 2) analysis.push({cat:'Balance Sheet',icon:'🚨',signal:'negative',title:`High Debt D/E: ${f.de}x — Risky`,text:`D/E of ${f.de}x is dangerous. Varsity: D/E>2 = high leverage. Rising interest rates or a business slowdown can spiral into a debt trap. Interest coverage becomes critical — if EBIT < Interest, the company is technically insolvent.`});

      if (f.epsGr != null && f.epsGr < 400) {
        if (f.epsGr >= 15) analysis.push({cat:'Growth',icon:'🚀',signal:'positive',title:`EPS Growing ${f.epsGr}% — ${f.growthPeer}`,text:`Earnings per share growing at ${f.epsGr}%. Varsity: EPS growth is the primary engine of long-term stock price appreciation. A company compounding earnings at this rate will see its stock follow over 3-5 years.`});
        else if (f.epsGr < 0) analysis.push({cat:'Growth',icon:'📉',signal:'negative',title:`EPS Declining ${f.epsGr}% — Red Flag`,text:`Earnings are shrinking. Varsity: declining EPS sustained for 2+ years signals business deterioration, not temporary setback. Stock prices follow earnings over time — if earnings keep falling, the stock will too.`});
      }

      if (peg != null) {
        if (peg < 1) analysis.push({cat:'Valuation',icon:'🏷️',signal:'positive',title:`PEG ${peg} — Growth at Discount`,text:`PEG ratio below 1 means you're paying less for the earnings growth than the growth rate justifies. Peter Lynch's golden rule: PEG<1 = potentially undervalued despite seemingly high P/E. At P/E ${f.pe} with ${f.epsGr}% EPS growth, this is attractive.`});
        else if (peg > 2) analysis.push({cat:'Valuation',icon:'💸',signal:'negative',title:`PEG ${peg} — Overpriced for Growth`,text:`PEG above 2 means you're paying a heavy premium for the growth rate. Varsity: high PEG removes margin of safety. If growth disappoints even slightly, the stock can fall sharply as the multiple compresses.`});
      }

      if (roa != null) {
        if (roa >= 8) analysis.push({cat:'Quality',icon:'🏭',signal:'positive',title:`ROA ${roa}% — Strong Asset Productivity`,text:`Return on Assets of ${roa}% shows the company converts its assets into profit efficiently. Varsity: high ROA = real cash generation, not accounting profit. This is the CFO quality proxy — if PAT is high but ROA is low, investigate if profits are converting to actual cash.`});
        else if (roa < 3) analysis.push({cat:'Quality',icon:'⚠️',signal:'negative',title:`ROA ${roa}% — Low Asset Productivity`,text:`Low ROA despite profits can indicate working capital issues, poor capital allocation, or that earnings may not be converting to real cash flow. Varsity's most critical check: PAT should eventually convert to CFO. Verify in the annual report.`});
      }

      if (pb != null) {
        if (pb < 1.5) analysis.push({cat:'Valuation',icon:'📚',signal:'positive',title:`P/BV ${pb}x — Below/At Book Value`,text:`Trading near book value means you're buying the company at or below its liquidation worth. Varsity: P/BV<1 = deep value if business is healthy. For banks, P/BV is the primary valuation metric (target 1.5-3x for quality banks).`});
        else if (pb > 6) analysis.push({cat:'Valuation',icon:'💸',signal:'negative',title:`P/BV ${pb}x — High Premium to Book`,text:`High P/BV requires high sustained ROE to justify. Varsity formula: fair P/BV ≈ ROE/Cost of Capital. If ROE is ${f.roe}% and cost of capital is ~12%, fair P/BV ≈ ${(f.roe/12).toFixed(1)}x. Premium beyond this = speculative.`});
      }

      if (f.pe < 25) analysis.push({cat:'Valuation',icon:'🏷️',signal:'positive',title:`P/E ${f.pe}x — ${f.pePeer}`,text:`Paying ₹${f.pe} for every ₹1 of annual earnings. Varsity: low P/E alone isn't enough — combine with PEG and P/BV for complete valuation picture. ${peg!=null?`PEG ${peg} ${peg<1?'confirms value.':'suggests growth priced in.'}`  :''}`});
      else if (f.pe > 40) analysis.push({cat:'Valuation',icon:'💸',signal:'negative',title:`P/E ${f.pe}x — ${f.pePeer}`,text:`Paying ₹${f.pe} for ₹1 of earnings. Expensive. Varsity: high P/E stocks fall sharply on any earnings miss. Only justified if EPS growth rate is very high and sustained (check PEG ratio).`});
    }

    // RSI Divergence — Varsity #1 reversal signal
    if (t.bullishDiv) analysis.push({cat:'Momentum',icon:'🔔',signal:'positive',title:'RSI Bullish Divergence — Strongest Reversal Signal',text:`Price made a lower low but RSI made a higher low. Varsity: this is the #1 signal to watch on quality stocks. It means selling pressure is exhausting — sellers are running out of ammunition. High probability that price reverses upward from here. Combine with oversold RSI<35 for maximum conviction.`});
    if (t.bearishDiv) analysis.push({cat:'Momentum',icon:'⚠️',signal:'negative',title:'RSI Bearish Divergence — Selling Signal',text:`Price made a higher high but RSI made a lower high. Varsity: buying pressure is weakening — bulls are running out of conviction. Often precedes a meaningful price correction. Consider reducing position or tightening stop.`});

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
        kiteDaily:cDay.length>0,kiteWeekly:cWeek.length>0,kiteMonthly:cMonth.length>0,
        maxCandles:cDay.length||cWeek.length||cMonth.length,
        kite1h:c1h.length>0,news:news.length>0,fundamentals:!!fund,
        candlesUsed:candles.length,
      },
    });
  } catch(e){
    console.error(`Analyze error ${sym}:`,e.message);
    res.status(500).json({error:e.message});
  }
});





// Aggregates paper trade signals + live prices into a ranked recommendation list
// ===============================================================================
// PHASE 4: COMPOSITE RANKING ENGINE — Varsity Module 10
// Composite = FA(35%) + TA(25%) + Momentum(20%) + Risk(20%)
// Conviction tiers: Strong Buy / Buy / Accumulate / Watch / Avoid
// ===============================================================================

function computeCompositeScore(f, taSignal) {
  const na = v => v!=null&&isFinite(v);
  const px = f.price || livePrices[f.sym]?.price;

  // FA Score (0-100) — already computed as f.score
  const faScore = Math.max(0, Math.min(100, f.score || 0));

  // TA Score (0-100) — map signal score (-10..+10) → (0..100)
  const rawTA    = taSignal?.score || 0;
  const taScore  = Math.max(0, Math.min(100, (rawTA + 10) / 20 * 100));

  // Momentum Score (0-100) — Varsity M10: relative strength vs market, not just absolute returns
  let momentumScore = 50; // neutral base
  // Relative strength = stock return - Nifty return (Varsity: outperforming market = true momentum)
  const rs52w = na(f.change52w) ? f.change52w - (niftyBenchmark['52w']||0) : 0;
  const rs6m  = na(f.change6m)  ? f.change6m  - (niftyBenchmark['6m']||0)  : 0;
  const rs1m  = na(f.change1m)  ? f.change1m  - (niftyBenchmark['1m']||0)  : 0;
  momentumScore += rs52w * 25;     // 52W relative strength (25%)
  momentumScore += rs6m  * 25;     // 6M relative strength (25%)
  momentumScore += rs1m  * 20;     // 1M relative strength (20%)
  // Absolute momentum bonus — Varsity: stock going up + beating market = strongest signal
  if(na(f.change6m) && f.change6m > 0 && rs6m > 0) momentumScore += 5;
  // RSI zone confirmation (10%)
  if(na(f.rsi)) momentumScore += (f.rsi - 50) * 0.3;
  momentumScore = Math.max(0, Math.min(100, momentumScore));

  // Risk Score (0-100) — lower risk = higher score
  let riskScore = 70; // default moderate
  if(na(f.beta))      riskScore -= f.beta * 15;         // high beta = higher risk
  if(na(f.debtToEq))  riskScore -= f.debtToEq * 8;
  if(na(f.pledged)&&f.pledged>20) riskScore -= f.pledged * 0.5;
  if(f.goldenCross)   riskScore += 10;
  riskScore = Math.max(0, Math.min(100, riskScore));

  // Composite weighted score — Varsity M10
  const composite = (faScore*0.35) + (taScore*0.25) + (momentumScore*0.20) + (riskScore*0.20);

  // Conviction tier — Varsity M10 Ch 5
  const abv200 = na(px)&&na(f.dma200) ? px > f.dma200 : false;
  const healthyRSI = na(f.rsi) && f.rsi > 30 && f.rsi < 70;
  const taBuy = taSignal?.signal === 'BUY';

  // Conviction — Varsity checklist approach: count confirmations, don't require ALL
  // Varsity M2 Ch19: "More checklist items met = higher conviction, but 3/5 can still be tradeable"
  let checkCount = 0;
  if(faScore>60) checkCount++;
  if(taBuy) checkCount++;
  if(abv200) checkCount++;
  if(healthyRSI) checkCount++;
  if(momentumScore>55) checkCount++;

  let conviction, convColor, convIcon;
  if(composite>75 && checkCount>=3) {
    conviction='Strong Buy'; convColor='#10b981'; convIcon='🟢';
  } else if(composite>65 && checkCount>=2) {
    conviction='Buy';        convColor='#22c55e'; convIcon='🔵';
  } else if(composite>50 && faScore>40) {
    conviction='Accumulate'; convColor='#f59e0b'; convIcon='🟡';
  } else if(composite>=35) {
    conviction='Watch';      convColor='#94a3b8'; convIcon='⚪';
  } else {
    conviction='Avoid';      convColor='#ef4444'; convIcon='🔴';
  }

  return {
    composite:     +composite.toFixed(1),
    faScore:       +faScore.toFixed(1),
    taScore:       +taScore.toFixed(1),
    momentumScore: +momentumScore.toFixed(1),
    riskScore:     +riskScore.toFixed(1),
    conviction,
    convColor,
    convIcon,
  };
}

// Build diversified recommendations — max 2 per sector, min 4 sectors — Varsity M9 Ch 8
function buildDiversifiedRecs(scored, limit=10) {
  const sectorCount = {};
  const result = [];
  for (const s of scored) {
    const sector = s.sector || 'Other';
    sectorCount[sector] = (sectorCount[sector]||0) + 1;
    if (sectorCount[sector] <= 2) result.push(s);
    if (result.length >= limit) break;
  }
  return result;
}

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

// =============================================================================
// PHASE 3: PORTFOLIO METRICS — Varsity M9 Ch 10
// =============================================================================
app.get("/paper-trades/stats", async(req,res)=>{
  try {
    const stats = await computePortfolioStats();
    const dd    = await checkDrawdownCircuitBreaker();
    const kelly = await computeKelly();
    const { rows: open } = await pool.query("SELECT * FROM paper_trades WHERE status='OPEN'");
    const openPnl = open.reduce((s,r)=>{
      const cmp = livePrices[r.symbol]?.price || parseFloat(r.price);
      return s + (cmp - parseFloat(r.price)) * parseInt(r.quantity);
    }, 0);
    res.json({
      ...stats,
      open_positions:  open.length,
      open_pnl:        +openPnl.toFixed(2),
      equity:          dd.equity,
      drawdown_pct:    +(dd.drawdown*100).toFixed(1),
      circuit_status:  dd.action,
      kelly_risk_pct:  kelly ? +(kelly*100).toFixed(1) : null,
      peak_equity:     _peakEquity,
    });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// =============================================================================
// PHASE 4: TIME-HORIZON RECOMMENDATIONS — Varsity M10 Ch 4
// Three lists: Intraday (TA only) / Swing (TA+momentum) / Positional (FA-heavy)
// =============================================================================
app.get("/api/stocks/recommendations/swing", async(req,res)=>{
  try {
    // Swing: RSI oversold bounce + BB squeeze + 5-20DMA crossover — 1-4 week holds
    const recs = Object.values(stockFundamentals)
      .filter(f => f && f.price)
      .map(f => {
        const taScore = (
          (f.rsi > 30 && f.rsi < 50 ? 30 : 0) +     // RSI recovering from oversold
          (f.bbPct < 0.2 ? 20 : f.bbPct < 0.4 ? 10 : 0) + // near lower BB
          (f.macdBull ? 20 : 0) +                    // MACD turning bullish
          (f.obvRising ? 15 : 0) +                   // accumulation
          (f.bullishDiv ? 15 : 0)                    // RSI divergence = strong reversal
        );
        const composite = computeCompositeScore(f, { signal:'BUY', score: taScore/10 });
        return { ...f, swingScore: taScore, ...composite, horizon: 'swing' };
      })
      .filter(f => f.swingScore >= 40 && (f.score||0) >= 40) // quality + TA both needed
      .sort((a,b) => b.composite - a.composite);
    res.json({ recommendations: buildDiversifiedRecs(recs, 10), total: recs.length, horizon: 'swing' });
  } catch(e){ res.status(500).json({error:e.message,recommendations:[]}); }
});

app.get("/api/stocks/recommendations/positional", async(req,res)=>{
  try {
    // Positional: FA-heavy composite + trend — 1-12 month holds
    const recs = Object.values(stockFundamentals)
      .filter(f => f && f.price && f.score >= 50) // quality gate
      .map(f => {
        const px = f.price;
        const abv200 = px > (f.dma200||0);
        const abv50  = px > (f.dma50||0);
        const taBuy  = abv200 && f.goldenCross && f.macdBull;
        const taSignal = { signal: taBuy ? 'BUY' : 'NEUTRAL', score: (abv200?3:0)+(abv50?2:0)+(f.goldenCross?3:0)+(f.macdBull?2:0) };
        const composite = computeCompositeScore(f, taSignal);
        return { ...f, ...composite, horizon: 'positional' };
      })
      .filter(f => f.composite >= 55)
      .sort((a,b) => b.composite - a.composite);
    res.json({ recommendations: buildDiversifiedRecs(recs, 15), total: recs.length, horizon: 'positional' });
  } catch(e){ res.status(500).json({error:e.message,recommendations:[]}); }
});

// =============================================================================
// PHASE 6: WALK-FORWARD BACKTESTER — Varsity M10 Ch 7-8
// =============================================================================
app.get("/api/backtest/results", async(req,res)=>{
  try {
    // Strategy performance from paper trade history
    const { rows } = await pool.query(`
      SELECT strategy, regime,
        COUNT(*) as trades,
        COUNT(CASE WHEN pnl > 0 THEN 1 END) as wins,
        SUM(pnl) as total_pnl,
        AVG(pnl_pct) as avg_pnl_pct,
        MAX(pnl_pct) as best_trade,
        MIN(pnl_pct) as worst_trade,
        AVG(EXTRACT(EPOCH FROM (exit_time - entry_time))/3600) as avg_hold_hours
      FROM paper_trades
      WHERE status='CLOSED' AND strategy IS NOT NULL AND pnl IS NOT NULL
      GROUP BY strategy, regime
      ORDER BY total_pnl DESC
    `);

    const results = rows.map(r => ({
      strategy:       r.strategy,
      regime:         r.regime,
      trades:         parseInt(r.trades),
      winRate:        +((r.wins/r.trades)*100).toFixed(1),
      totalPnl:       +parseFloat(r.total_pnl).toFixed(2),
      avgPnlPct:      +parseFloat(r.avg_pnl_pct).toFixed(2),
      bestTrade:      +parseFloat(r.best_trade).toFixed(2),
      worstTrade:     +parseFloat(r.worst_trade).toFixed(2),
      avgHoldHours:   r.avg_hold_hours ? +parseFloat(r.avg_hold_hours).toFixed(1) : null,
      // Disable if win rate < 45% or avg return negative — Varsity validation rule
      status: (r.wins/r.trades < 0.45 || parseFloat(r.avg_pnl_pct) < 0) ? 'UNDERPERFORMING' : 'ACTIVE',
    }));

    // Overall portfolio stats
    const stats = await computePortfolioStats();

    res.json({ strategies: results, portfolio: stats, generated_at: new Date().toISOString() });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Strategy leaderboard — last 30 days performance
app.get("/api/backtest/leaderboard", async(req,res)=>{
  try {
    const { rows } = await pool.query(`
      SELECT strategy,
        COUNT(*) as trades,
        COUNT(CASE WHEN pnl > 0 THEN 1 END) as wins,
        SUM(pnl) as total_pnl,
        AVG(pnl_pct) as avg_return
      FROM paper_trades
      WHERE status='CLOSED'
        AND entry_time >= NOW() - INTERVAL '30 days'
        AND strategy IS NOT NULL
      GROUP BY strategy
      ORDER BY total_pnl DESC
    `);
    res.json({ leaderboard: rows.map(r=>({
      strategy: r.strategy,
      trades: parseInt(r.trades),
      winRate: +((r.wins/r.trades)*100).toFixed(1),
      totalPnl: +parseFloat(r.total_pnl).toFixed(2),
      avgReturn: +parseFloat(r.avg_return).toFixed(2),
      rank: 0, // filled below
    })).map((r,i)=>({...r,rank:i+1}))
    });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Recommendation accuracy tracking — was the conviction right?
app.get("/api/backtest/accuracy", async(req,res)=>{
  try {
    const { rows } = await pool.query(`
      SELECT
        CASE
          WHEN signal_score >= 80 THEN 'Strong Buy'
          WHEN signal_score >= 60 THEN 'Buy'
          WHEN signal_score >= 50 THEN 'Accumulate'
          ELSE 'Watch'
        END as conviction,
        COUNT(*) as total,
        COUNT(CASE WHEN pnl > 0 THEN 1 END) as profitable,
        AVG(pnl_pct) as avg_return,
        AVG(CASE WHEN pnl > 0 THEN pnl_pct END) as avg_win,
        AVG(CASE WHEN pnl <= 0 THEN pnl_pct END) as avg_loss,
        MAX(pnl_pct) as mfe,
        MIN(pnl_pct) as mae
      FROM paper_trades
      WHERE status='CLOSED' AND pnl IS NOT NULL
      GROUP BY conviction
      ORDER BY MIN(signal_score) DESC
    `);
    res.json({ accuracy: rows.map(r=>({
      conviction:   r.conviction,
      total:        parseInt(r.total),
      hitRate:      +((r.profitable/r.total)*100).toFixed(1),
      avgReturn:    +parseFloat(r.avg_return).toFixed(2),
      avgWin:       r.avg_win ? +parseFloat(r.avg_win).toFixed(2) : null,
      avgLoss:      r.avg_loss ? +parseFloat(r.avg_loss).toFixed(2) : null,
      mfe:          r.mfe ? +parseFloat(r.mfe).toFixed(2) : null,
      mae:          r.mae ? +parseFloat(r.mae).toFixed(2) : null,
    }))});
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
  {sym:"SUIUSDT",  name:"Sui",            base:"SUI"}
];

// Fetch candles - try multiple endpoints
async function fetchCryptoCandles(sym) {
  const endpoints = [
    `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1h&limit=100`,
    `https://api1.binance.com/api/v3/klines?symbol=${sym}&interval=1h&limit=100`,
    `https://api2.binance.com/api/v3/klines?symbol=${sym}&interval=1h&limit=100`,
    `https://api3.binance.com/api/v3/klines?symbol=${sym}&interval=1h&limit=100`
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
    `https://api3.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(syms)}`
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

  // -- NEW ADDITIONS --
  "M&M":      [18.4,0.12,24.8,14.2,28.4,12.4],
  ABB:        [22.4,0.08,58.4,14.8,18.4,14.8],
  BAJAJAUTO:  [22.4,0.04,32.4,8.4,18.4,18.4],
  TVSMOTOR:   [22.4,0.62,42.4,22.4,28.4,8.4],
  VARUNBEV:   [22.4,0.62,52.4,28.4,28.4,12.4],


  ABB:        [26.4,0.08,52.4,14.8,22.4,14.8],
  BAJAJAUTO:  [24.2,0.04,32.4,8.4,18.4,18.4],
  TVSMOTOR:   [26.4,0.62,42.4,22.4,28.4,8.4],
  VARUNBEV:   [24.2,0.62,52.4,28.4,28.4,12.4],
  ATUL:       [12.4,0.08,42.4,4.8,-8.4,18.4],
  ABFRL:      [4.8,2.80,null,8.4,-18.4,4.8],
  HSCL:       [8.4,0.28,18.4,8.4,8.4,12.4],
  AMARAJABAT: [12.4,0.12,28.4,8.4,18.4,14.8],
  SML:        [8.4,0.42,28.4,8.4,8.4,10.2],
  JSPL:       [12.4,1.20,8.4,14.8,42.4,18.4],
  TATAELXSI:  [28.4,0.04,52.4,8.4,-8.4,32.4],
  MEIL:       [8.4,1.80,null,28.4,null,8.4],
  ARMAN:      [18.4,6.20,12.4,22.4,22.4,null],

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

  // STEP 1: Load universe from stock_universe table (or kv cache fallback)
  const loadedFromDB = await loadUniverseFromDB();
  if (!loadedFromDB) {
    console.log('No DB cache - fetching NSE index lists live...');
    await refreshUniverseFromNSE();
  } else {
    // Refresh in background — don't block startup
    setTimeout(() => refreshUniverseFromNSE(), 30000);
  }

  // STEP 2: Load instrument tokens from stock_instruments table into validTokens
  try {
    const { rows } = await pool.query('SELECT sym, kite_token FROM stock_instruments');
    rows.forEach(r => { if (r.kite_token) validTokens[r.sym] = parseInt(r.kite_token); });
    console.log(`📋 Loaded ${rows.length} instrument tokens from DB`);
  } catch(e) {
    if (!e.message.includes('does not exist')) console.log('Instruments DB load failed:', e.message);
  }

  // STEP 3: Load fundamentals — Screener data first (most complete), then Yahoo cache
  await loadCachedFundamentals();           // Yahoo-scraped cache
  const screenerCount = await loadScreenerFundamentals(); // Screener.in data (overrides)

  // STEP 4: Restore last scored stocks from kv cache → instant UI on restart
  try {
    const cached = await dbGet('scored_stocks_cache');
    if (cached) {
      const { stocks, fetchedAt } = JSON.parse(cached);
      const count = Object.keys(stocks).length;
      if (count > 10) {
        Object.assign(stockFundamentals, stocks);
        stockFundLastFetch = fetchedAt;
        stockFundReady = true;
        console.log(`📊 ${count} scored stocks restored from cache (${((Date.now()-fetchedAt)/3600000).toFixed(1)}h old)`);
      }
    }
  } catch(e) {}

  // STEP 5: Kick off background Screener fetch if no data yet
  if (process.env.APIFY_TOKEN && screenerCount === 0) {
    console.log('📊 No Screener data — starting background fetch via Apify...');
    fetchAllScreenerData().catch(e => console.error('Startup Screener fetch error:', e.message));
  }

  // Load previously scored stocks from DB cache — makes Stocks tab instant on restart
  try {
    const cached = await dbGet('scored_stocks_cache');
    if (cached) {
      const { stocks, fetchedAt } = JSON.parse(cached);
      const count = Object.keys(stocks).length;
      if (count > 10) {
        Object.assign(stockFundamentals, stocks);
        stockFundLastFetch = fetchedAt;
        stockFundReady = true;
        console.log(`📊 ${count} scored stocks from cache (${((Date.now()-fetchedAt)/3600000).toFixed(1)}h old) — Stocks tab ready`);
      }
    }
  } catch(e) { console.log('📊 No score cache — will fetch fresh'); }

  initKite(token||null);
  if (token) {
    tokenValid = true; // fresh token from DB, assume valid
    console.log("✅ Token loaded (from "+(process.env.KITE_ACCESS_TOKEN===token&&!await dbGet('kite_access_token')?'env':'DB')+") - starting smart engine...");
    startTicker(token);
    await refreshInstruments();  // fetch real tokens from Kite — must complete before scoring
    // Now validTokens is populated — kick off background scoring immediately
    refreshAllFundamentals();                                                    // Kite candles → scores (background)
    refreshMissingFundamentals().catch(e=>console.log('Scraper:', e.message));  // Yahoo enrichment (background)
    setTimeout(scanAndTrade, 5000);
  } else {
    console.log("⚠️  No token - visit /auth/login or paste token in dashboard");
  }
  // NSE: every 3 min during market hours Mon-Fri
  cron.schedule("*/3 9-15 * * 1-5", ()=>scanAndTrade(), {timezone:"Asia/Kolkata"});
  cron.schedule("15 9 * * 1-5",     ()=>scanAndTrade(), {timezone:"Asia/Kolkata"});
  // All other daily schedules (universe 8AM, instruments 9AM, screener 8PM, scoring 7AM)
  // are defined centrally above — no duplicates here

  // Remove the duplicate 3-min startup delay (90s timeout above handles startup)

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

// =============================================================================
// MIROFISH ENGINE — Multi-Agent Fallen Angel Recovery Predictor
// Inspired by MiroFish's swarm intelligence approach
// Uses Anthropic Claude API to run parallel agents with distinct personas
// Each agent analyzes Fallen Angels from a different investment perspective
// Synthesis agent produces final ranked recovery predictions
// =============================================================================

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MIROFISH_MODEL    = 'claude-sonnet-4-20250514';

// Agent personas — each has a distinct investment philosophy
const MIROFISH_AGENTS = [
  {
    id: 'fundamentalist',
    name: 'Vikram Mehta — Fundamental Analyst',
    persona: `You are a senior equity analyst at a top Indian brokerage with 20 years experience.
You believe: businesses with strong ROE (>15%), low debt (D/E < 1), and growing EPS always recover.
You distrust momentum. You trust balance sheets. You look for margin of safety.
Varsity framework: ROCE>15% = real capital efficiency. DuPont ROE = quality check. FCF>0 = earnings are real.
Sector expertise: Banking (NIM/CAR), FMCG, IT (CC revenue), Pharma.`,
    weight: 0.22,
  },
  {
    id: 'technician',
    name: 'Priya Sharma — Technical Analyst',
    persona: `You are a CMT-certified technical analyst with 12 years on NSE.
You believe: price action never lies. RSI divergence, volume accumulation, and 200DMA reclaim = recovery.
You are skeptical of stocks below 200DMA with declining OBV regardless of fundamentals.
You use: RSI, MACD, Supertrend, Fibonacci retracement levels, ADX +DI/-DI crossover, Ichimoku cloud.
Multi-timeframe: daily trend must align with weekly trend before calling recovery.`,
    weight: 0.18,
  },
  {
    id: 'contrarian',
    name: 'Arjun Kapoor — Contrarian Investor',
    persona: `You are a contrarian fund manager inspired by Howard Marks and Rakesh Jhunjhunwala.
You believe: maximum pessimism = maximum opportunity. Stocks hated by everyone are often the best buys.
You look for: highest quality businesses at maximum fear. RSI below 30 + strong ROE = buy signal.
You are NOT afraid of stocks down 50%+ if fundamentals are intact.
Varsity: "Bear Market Phase 3 = maximum fear = maximum opportunity for the prepared investor."`,
    weight: 0.20,
  },
  {
    id: 'risk_manager',
    name: 'Meera Nair — Risk Manager',
    persona: `You are a risk manager who has seen 2008, 2020, and multiple NSE crashes.
You believe: avoid value traps at all costs. A cheap stock can always get cheaper.
Red flags per Varsity M3: EPS declining, debt rising, promoter pledging, interest coverage < 1.5x.
You only recommend stocks where downside is clearly limited by strong balance sheet.
You use: Composite Risk Score, portfolio correlation, sector concentration limits (max 3 in same sector).`,
    weight: 0.20,
  },
  {
    id: 'quant',
    name: 'Rahul Iyer — Quantitative Analyst',
    persona: `You are a quant analyst who builds factor models for a hedge fund.
You believe: recovery probability correlates with: depth of fall, RSI oversold level, ROE rank, sector momentum.
You think in probabilities, not certainties. You size positions by conviction.
You use historical base rates: stocks with RSI<30 + ROE>15% recover 73% of the time in 6 months.
You weight the Composite Score (FA 35% + TA 25% + Momentum 20% + Risk 20%) heavily in your analysis.`,
    weight: 0.15,
  },
  {
    id: 'backtest_validator',
    name: 'Sanjay Gupta — Backtest Validator',
    persona: `You are a systematic trader who validates every call against historical patterns.
You believe: if a similar setup didn't work historically, be skeptical. Data beats intuition.
Your job: cross-check each Fallen Angel against its historical behavior:
- Has this stock recovered before after similar falls? (depth + RSI + sector regime)
- What is the base rate for recovery in this sector during similar market conditions?
- Does the composite score meet the historical threshold for a profitable trade?
Red flags: first time falling this much (no historical base), sector in structural decline, macro headwinds.
You provide a CONFIDENCE MULTIPLIER (0.5x to 1.5x) for each pick based on historical backing.`,
    weight: 0.05,
  },
];

// Fetch macro context — India VIX, Nifty trend, FII/DII flows
async function fetchMacroContext() {
  const context = {
    niftyTrend: 'unknown',
    niftyRSI: null,
    vix: null,
    vixLevel: 'unknown',
    fiiFlow: null,
    marketRegime: 'UNKNOWN',
    marketSentiment: 'neutral',
  };
  try {
    // Nifty 50 trend from UNIVERSE stocks aggregate
    const n50 = Object.values(stockFundamentals).filter(f=>f.grp==='NIFTY50'&&f.price&&f.dma200);
    if (n50.length > 20) {
      const abv200 = n50.filter(f=>f.price>f.dma200).length;
      const pct = abv200/n50.length;
      context.niftyTrend = pct > 0.65 ? 'bullish' : pct < 0.35 ? 'bearish' : 'mixed';
      const avgRSI = n50.reduce((s,f)=>s+(f.rsi||50),0)/n50.length;
      context.niftyRSI = +avgRSI.toFixed(1);
      context.marketSentiment = avgRSI > 60 ? 'greedy' : avgRSI < 40 ? 'fearful' : 'neutral';
    }
    // VIX from Kite if available
    if (kite && process.env.KITE_ACCESS_TOKEN) {
      try {
        const vixToken = validTokens['INDIAVIX'] || 264969;
        const to = new Date().toISOString().split('T')[0];
        const from = new Date(Date.now()-7*864e5).toISOString().split('T')[0];
        const vixCandles = await kite.getHistoricalData(vixToken, 'day', from, to);
        if (vixCandles?.length) {
          context.vix = +vixCandles[vixCandles.length-1].close.toFixed(2);
          context.vixLevel = context.vix > 20 ? 'high_fear' : context.vix > 14 ? 'moderate' : 'low_complacency';
        }
      } catch(e) {} // VIX fetch is optional
    }
    // Market regime from last scan log
    const { rows } = await pool.query('SELECT regime FROM scan_log ORDER BY scanned_at DESC LIMIT 1');
    if (rows[0]) context.marketRegime = rows[0].regime;
  } catch(e) {}
  return context;
}

// Fetch historical accuracy for backtest validator context
async function fetchHistoricalAccuracy() {
  try {
    const { rows } = await pool.query(`
      SELECT strategy, regime,
        COUNT(*) as trades,
        COUNT(CASE WHEN pnl > 0 THEN 1 END) as wins,
        AVG(pnl_pct) as avg_return,
        AVG(CASE WHEN pnl > 0 THEN pnl_pct END) as avg_win
      FROM paper_trades
      WHERE status='CLOSED' AND pnl IS NOT NULL
      GROUP BY strategy, regime
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `);
    return rows.map(r=>({
      strategy: r.strategy,
      regime: r.regime,
      trades: parseInt(r.trades),
      winRate: +((r.wins/r.trades)*100).toFixed(0),
      avgReturn: +parseFloat(r.avg_return).toFixed(1),
    }));
  } catch(e) { return []; }
}

// In-memory store for simulation results
let mfLastSimulation = null;
let mfSimulationRunning = false;

async function callAnthropicAgent(systemPrompt, userPrompt, maxTokens) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set in Railway env vars');

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key':         ANTHROPIC_API_KEY,
    },
    body: JSON.stringify({
      model:      MIROFISH_MODEL,
      max_tokens: maxTokens || 1200,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    }),
    signal: AbortSignal.timeout(55000),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${err.slice(0,200)}`);
  }
  const data = await resp.json();
  return data.content?.[0]?.text || '';
}

async function runMiroFishAgent(agent, fallenAngels, macroCtx, historicalAccuracy) {
  // Enriched stock list with composite scores fed to agents
  const stockList = fallenAngels.slice(0, 15).map((s, i) => {
    const comp = s._composite || {};
    const roce = s.roce ?? (s.roe && s.debtToEq ? (s.roe * (1 + s.debtToEq)).toFixed(1) : null);
    const mos  = s.eps && s.earGrowth > 0 && s.price
      ? (((s.earGrowth * 1.5 * s.eps) - s.price) / s.price * 100).toFixed(0) + '%' : '?';
    return (
      `${i+1}. ${s.sym} (${s.name}) [${s.grp||'NSE'}]\n` +
      `   COMPOSITE:${comp.composite||'?'}/100 FA:${comp.faScore||s.score||'?'} TA:${comp.taScore||'?'} MOM:${comp.momentumScore||'?'} RISK:${comp.riskScore||'?'} Conviction:${comp.conviction||'?'}\n` +
      `   Fall:${Math.abs(s.pctFromHigh||0).toFixed(0)}% | RSI:${(s.rsi||'?').toString().slice(0,5)} | BB%B:${s.bbPct!=null?s.bbPct.toFixed(2):'?'} | Stoch:${s.stochK||'?'}\n` +
      `   ROE:${s.roe||'?'}% | ROCE:${roce||'?'}% | D/E:${s.debtToEq||'?'}x | OPM:${s.opMargin||'?'}% | EPS gr:${s.earGrowth||'?'}% | MoS:${mos}\n` +
      `   PE:${s.pe||'?'}x | PEG:${s.pe&&s.earGrowth>0?(s.pe/s.earGrowth).toFixed(2):'?'} | IntCov:${s.intCov||'?'}x | Promoter:${s.promoter||'?'}% | Pledged:${s.pledged||'?'}%\n` +
      `   MACD:${s.macdBull?'Bull':'Bear'} | OBV:${s.obvRising?'Rising':'Falling'} | BullDiv:${s.bullishDiv?'YES':'no'} | Supertrend:${s.supertrendSig||'?'}\n` +
      `   ADX:${s.adx||'?'} +DI:${s.adxPdi||'?'} -DI:${s.adxNdi||'?'} | Patterns:${s.candlePatterns?.length?s.candlePatterns.map(p=>p.pattern).join(','):'none'}\n` +
      `   Sector:${s.sector||'?'} | MktCap:₹${s.mktCap?Math.round(s.mktCap)+'Cr':'?'}`
    );
  }).join('\n\n');

  // Macro context block for all agents
  const macroBlock = macroCtx ? `
MACRO CONTEXT:
- Nifty Trend: ${macroCtx.niftyTrend} | Avg RSI: ${macroCtx.niftyRSI} | Sentiment: ${macroCtx.marketSentiment}
- India VIX: ${macroCtx.vix||'N/A'} (${macroCtx.vixLevel})${macroCtx.vixLevel==='high_fear'?' — fear peak, recoveries accelerate often':macroCtx.vixLevel==='low_complacency'?' — complacency, be selective':''}
- Market Regime: ${macroCtx.marketRegime}
` : '';

  // Historical accuracy for backtest validator agent only
  const histBlock = agent.id === 'backtest_validator' && historicalAccuracy?.length ? `
PAPER TRADE HISTORY (use to validate setups):
${historicalAccuracy.map(r=>`- ${r.strategy}/${r.regime}: ${r.winRate}% win (${r.trades} trades, avg ${r.avgReturn>0?'+':''}${r.avgReturn}%)`).join('\n')}
Provide a confidence_multiplier (0.5=low historical backing, 1.0=neutral, 1.5=strong historical backing).
` : '';

  const system = `${agent.persona}
${macroBlock}${histBlock}
You are Agent ${MIROFISH_AGENTS.indexOf(agent)+1} of 6 in the MiroFish multi-agent simulation.
Job: Identify which Fallen Angels will recover 15%+ in 3-6 months.

SIZE-AWARE (Varsity M15): SMALLCAP needs ROE>15%,D/E<1,IntCov>2x. MIDCAP needs ROE>12%,D/E<1.5. LARGECAP: lowest risk.

COMPOSITE SCORE GUIDE: >65=strong setup, 50-65=decent, <50=be cautious.

JSON only (no markdown):
{"agent":"${agent.name}","top_picks":[{"sym":"X","cap":"MIDCAP","conviction":80,"confidence_multiplier":1.1,"horizon":"3 months","target_upside":25,"thesis":"reason","risk":"main risk","composite_score_view":"agree/disagree and why"}],"avoid":["SYM"],"market_view":"macro impact on recovery","agent_insight":"unique angle"}
Exactly 5 picks, ordered by conviction desc.`;

  const user = `Fallen Angels:\n\n${stockList}\n\nPick 5 recoveries. JSON only.`;
  const raw = await callAnthropicAgent(system, user, agent.id === 'backtest_validator' ? 1500 : 1200);
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function runMiroFishSynthesis(agentResults, fallenAngels) {
  const allPicks = {};
  const allAvoids = new Set();

  // Aggregate votes with weights
  agentResults.forEach(({ agent, result, weight }) => {
    (result.top_picks || []).forEach(p => {
      if (!allPicks[p.sym]) allPicks[p.sym] = { sym:p.sym, votes:0, weightedConviction:0, theses:[], risks:[], horizons:[], upsides:[] };
      allPicks[p.sym].votes++;
      allPicks[p.sym].weightedConviction += (p.conviction||50) * weight;
      allPicks[p.sym].theses.push(`${agent.split('—')[0].trim()}: ${p.thesis}`);
      allPicks[p.sym].risks.push(p.risk);
      allPicks[p.sym].horizons.push(p.horizon);
      allPicks[p.sym].upsides.push(p.target_upside||15);
    });
    (result.avoid || []).forEach(s => allAvoids.add(s));
  });

  // Score each stock: votes × weighted conviction
  const ranked = Object.values(allPicks)
    .map(s => ({
      ...s,
      finalScore: Math.round(s.weightedConviction / s.votes * (s.votes / agentResults.length * 100)) / 10,
      avgUpside:  Math.round(s.upsides.reduce((a,b)=>a+b,0)/s.upsides.length),
      consensus:  s.votes >= 3 ? 'High' : s.votes === 2 ? 'Medium' : 'Low',
    }))
    .sort((a,b) => b.finalScore - a.finalScore);

  // Synthesis agent — final verdict
  const summaryText = ranked.slice(0,8).map(s =>
    `${s.sym}: ${s.votes} agents picked it, conviction ${s.finalScore.toFixed(0)}, avg upside ${s.avgUpside}%, consensus: ${s.consensus}`
  ).join('\n');

  const system = `You are a senior portfolio manager synthesizing a MiroFish multi-agent analysis.
5 agents have analyzed Fallen Angel stocks on NSE. Your job: produce the FINAL investment report.

Respond in JSON only:
{
  "simulation_title": "MiroFish Fallen Angel Recovery Simulation — NSE",
  "simulation_date": "${new Date().toLocaleDateString('en-IN')}",
  "market_regime": "Bull/Bear/Sideways + one sentence explanation",
  "top_recovery_picks": [
    {
      "rank": 1,
      "sym": "SYMBOLNAME",
      "verdict": "Strong Recovery / Likely Recovery / Speculative",
      "conviction_score": 87,
      "avg_target_upside": 32,
      "recommended_horizon": "3 months",
      "consensus": "High/Medium/Low",
      "bull_case": "Why it recovers",
      "bear_case": "Why it doesn't",
      "position_sizing": "Core (5-8%) / Moderate (3-5%) / Small (1-3%)"
    }
  ],
  "stocks_to_avoid": ["SYM1", "SYM2"],
  "avoid_reason": "One sentence why these are value traps",
  "key_risks": ["Risk 1", "Risk 2", "Risk 3"],
  "agent_consensus_summary": "2-3 sentences on where all agents agreed and disagreed"
}
Pick top 7 recovery picks. Order by conviction.`;

  const user = `Agent voting results:\n${summaryText}\n\nAgent market views:\n${
    agentResults.map(a => `${a.agent}: ${a.result.market_view}`).join('\n')
  }\n\nProduce the final synthesis report. JSON only.`;

  const raw = await callAnthropicAgent(system, user);
  const clean = raw.replace(/```json|```/g, '').trim();
  const synthesis = JSON.parse(clean);

  // Enrich synthesis with full stock data from ProTrader
  synthesis.top_recovery_picks = synthesis.top_recovery_picks.map(pick => {
    const stock = fallenAngels.find(s => s.sym === pick.sym);
    return {
      ...pick,
      stock_data: stock ? {
        price: stock.price, pctFromHigh: stock.pctFromHigh, rsi: stock.rsi,
        roe: stock.roe, debtToEq: stock.debtToEq, pe: stock.pe,
        earGrowth: stock.earGrowth, opMargin: stock.opMargin,
        macdBull: stock.macdBull, obvRising: stock.obvRising,
        bullishDiv: stock.bullishDiv, dma200: stock.dma200,
        fallenScore: stock.fallenScore, fallenVerdict: stock.fallenVerdict,
        stopLoss: stock.stopLoss, rrRatio: stock.rrRatio,
      } : null,
      agent_theses: ranked.find(r=>r.sym===pick.sym)?.theses || [],
    };
  });

  return { synthesis, agentDetails: ranked, allAvoids: [...allAvoids] };
}

async function runMiroFishSimulation() {
  if (mfSimulationRunning) return { error: 'Simulation already running' };
  if (!ANTHROPIC_API_KEY)  return { error: 'Set ANTHROPIC_API_KEY in Railway environment variables' };

  mfSimulationRunning = true;
  console.log('🐟 MiroFish simulation starting (6-agent + macro context)...');

  try {
    const all = Object.values(stockFundamentals);
    if (!all.length) return { error: 'No scored stocks yet. Wait for scoring to complete.' };

    // Filter Fallen Angels
    const fallenAngels = all
      .filter(s => {
        const score   = s.score || 0;
        const minScore= s.grp==='SMALLCAP' ? 55 : s.grp==='MIDCAP' ? 52 : 45;
        const minFall = s.grp==='SMALLCAP' ? -25 : -20;
        return score >= minScore && (s.pctFromHigh||0) <= minFall && (s.rsi||50) <= 55;
      })
      .sort((a,b) => (b.fallenScore||b.score||0) - (a.fallenScore||a.score||0))
      .slice(0, 20);

    // Phase 5: Pre-compute composite score for each Fallen Angel — fed to all agents
    fallenAngels.forEach(s => {
      try {
        const taSignal = {
          signal: s.macdBull && s.obvRising ? 'BUY' : 'NEUTRAL',
          score:  (s.macdBull?3:0) + (s.obvRising?2:0) + (s.bullishDiv?3:0) + (s.supertrendSig==='bullish'?2:0),
        };
        s._composite = computeCompositeScore(s, taSignal);
      } catch(e) { s._composite = {}; }
    });

    const capBreakdown = {
      NIFTY50:  fallenAngels.filter(s=>s.grp==='NIFTY50').length,
      NEXT50:   fallenAngels.filter(s=>s.grp==='NEXT50').length,
      MIDCAP:   fallenAngels.filter(s=>s.grp==='MIDCAP').length,
      SMALLCAP: fallenAngels.filter(s=>s.grp==='SMALLCAP').length,
    };
    console.log(`🐟 MiroFish: ${fallenAngels.length} Fallen Angels — ${JSON.stringify(capBreakdown)}`);

    // Phase 5: Fetch macro context + historical accuracy in parallel
    const [macroCtx, historicalAccuracy] = await Promise.all([
      fetchMacroContext(),
      fetchHistoricalAccuracy(),
    ]);
    console.log(`🐟 Macro: Nifty ${macroCtx.niftyTrend} | VIX ${macroCtx.vix||'N/A'} | Regime: ${macroCtx.marketRegime}`);

    // Run all 6 agents in parallel (Agent #6 = backtest_validator)
    const agentPromises = MIROFISH_AGENTS.map(async agent => {
      try {
        console.log(`🐟 Agent running: ${agent.name}`);
        const result = await runMiroFishAgent(agent, fallenAngels, macroCtx, historicalAccuracy);
        return { agent: agent.name, id: agent.id, result, weight: agent.weight };
      } catch(e) {
        console.log(`🐟 Agent ${agent.id} failed: ${e.message}`);
        return null;
      }
    });

    const agentResults = (await Promise.all(agentPromises)).filter(Boolean);
    if (agentResults.length < 2) return { error: `Too few agents succeeded (${agentResults.length}). Check API key.` };

    console.log(`🐟 MiroFish: ${agentResults.length}/6 agents done, running synthesis...`);
    const { synthesis, agentDetails, allAvoids } = await runMiroFishSynthesis(agentResults, fallenAngels);

    mfLastSimulation = {
      ...synthesis,
      agent_details:          agentDetails,
      all_avoids:             allAvoids,
      agent_count:            agentResults.length,
      fallen_angels_analyzed: fallenAngels.length,
      cap_breakdown:          capBreakdown,
      macro_context:          macroCtx,
      run_at:                 Date.now(),
      run_at_str:             new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    };

    await dbSet('mirofish_last_simulation', JSON.stringify(mfLastSimulation));
    console.log(`🐟 MiroFish complete. Top pick: ${synthesis.top_recovery_picks?.[0]?.sym}`);
    return mfLastSimulation;

  } catch(e) {
    console.log('🐟 MiroFish error:', e.message);
    return { error: e.message };
  } finally {
    mfSimulationRunning = false;
  }
}

// Load last simulation from DB on startup
(async () => {
  try {
    const cached = await dbGet('mirofish_last_simulation');
    if (cached) {
      mfLastSimulation = JSON.parse(cached);
      console.log(`🐟 MiroFish: loaded last simulation from DB (${mfLastSimulation.run_at_str})`);
    }
  } catch(e) {}
})();

// API endpoints
app.post('/api/mirofish/run', async(req,res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.json({ error: 'Add ANTHROPIC_API_KEY to Railway environment variables first.' });
  }
  if (mfSimulationRunning) {
    return res.json({ running: true, message: 'Simulation in progress... check /api/mirofish/status' });
  }
  res.json({ message: 'MiroFish simulation started. 6 agents + macro context analyzing Fallen Angels...', estimated_time: '90-120 seconds' });
  runMiroFishSimulation().catch(e => console.log('MiroFish run error:', e.message));
});

app.get('/api/mirofish/status', (req,res) => {
  res.json({
    running:          mfSimulationRunning,
    hasResult:        !!mfLastSimulation,
    lastRun:          mfLastSimulation?.run_at_str || null,
    topPick:          mfLastSimulation?.top_recovery_picks?.[0]?.sym || null,
    apiKeyConfigured: !!ANTHROPIC_API_KEY,
  });
});

app.get('/api/mirofish/result', (req,res) => {
  if (!mfLastSimulation) {
    return res.json({ error: 'No simulation run yet. POST /api/mirofish/run to start.' });
  }
  res.json(mfLastSimulation);
});

// MiroFish — Fallen Angel inline prediction (per stock, called from card)
app.post('/api/mirofish/fa-predict', async(req,res) => {
  if (!ANTHROPIC_API_KEY) return res.json({ error: 'Add ANTHROPIC_API_KEY to Railway environment variables' });
  const f = req.body;
  const n = v => (v==null||v===''||isNaN(+v)) ? 'N/A' : (+v).toFixed(2);
  const p = v => (v==null||v===''||isNaN(+v)) ? 'N/A' : (+v).toFixed(1)+'%';

  const system = `You are a panel of 5 expert NSE equity analysts (Fundamental, Technical, Contrarian, Risk, Quant).
You analyze a Fallen Angel stock — a quality business that has fallen 20%+ from its peak.
Your job: predict the stock price at 6 months, 1 year, 2 years, 3 years from today.

Base your prediction on all provided data. Be realistic — not bullish marketing.
If debt is high or earnings are collapsing, say so.

Respond ONLY in valid JSON, no markdown:
{
  "current_price": 148.4,
  "price_6m": 172.0,
  "price_1y": 195.0,
  "price_2y": 235.0,
  "price_3y": 280.0,
  "verdict": "Strong Recovery / Likely Recovery / Slow Recovery / Value Trap",
  "confidence": "High / Medium / Low",
  "analysis": "2-3 sentence explanation of why these prices",
  "key_risk": "Single biggest risk to this prediction"
}
All prices must be in INR. Be consistent — prices should reflect the analysis.`;

  const user = `Stock: ${f.sym} — ${f.name||f.sym}
Sector: ${f.sector||'N/A'} | Group: ${f.grp||'N/A'}

PRICE ACTION
  Current: ₹${f.price||'N/A'} | 52W High: ₹${f.wk52Hi||'N/A'} | 52W Low: ₹${f.wk52Lo||'N/A'}
  Down from peak: ${p(f.pctFromHigh)} | vs 200DMA: ${p(f.pctAbove200)}

FUNDAMENTALS (Varsity Ch12 Checklist)
  ROE: ${p(f.roe)} | D/E: ${n(f.debtToEq)}x | PE: ${n(f.pe)}x | PEG: ${f.pe&&f.earGrowth>0?n(f.pe/f.earGrowth):'N/A'}
  PE/ROE: ${f.pe&&f.roe?n(f.pe/f.roe):'N/A'} | Op Margin: ${p(f.opMargin)}
  EPS Growth: ${p(f.earGrowth)} | Revenue Growth: ${p(f.revGrowth)}

OVERSOLD SIGNALS (Varsity M2 — all 4 indicators)
  RSI: ${n(f.rsi)} ${(+f.rsi||50)<=30?'(EXTREME OVERSOLD)':''} 
  Stochastic: ${n(f.stochK)} ${(+f.stochK||50)<=20?'(OVERSOLD CONFIRMED)':''}
  Bollinger %B: ${n(f.bbPct)} ${(+f.bbPct||0.5)<=0?'(BELOW LOWER BAND — EXTREME)':''}
  ADX: ${n(f.adx)} | Beta: ${n(f.beta)} | Annual Volatility: ${p(f.annualVol)}

RECOVERY SIGNALS (Varsity M2)
  RSI Bullish Divergence: ${f.bullishDiv?'YES — Varsity #1 reversal signal':'No'}
  RSI Bearish Divergence: ${f.bearishDiv?'YES — warning of further downside':'No'}
  MACD: ${f.macdBull?'Bullish crossover':'Bearish'} | Histogram: ${n(f.macdHist)}
  OBV: ${f.obvRising?'Rising (institutional accumulation)':'Falling (distribution)'}
  Volume Ratio: ${n(f.volRatio)}x avg ${(+f.volRatio||1)>=2?'(CLIMAX — possible exhaustion)':''}
  Supertrend: ${f.supertrendSig||'N/A'} | 200DMA: ₹${f.dma200||'N/A'} | 50DMA: ₹${f.dma50||'N/A'}

PROTRADER FALLEN ANGEL SCORING
  FA Score: ${f.fallenScore||'N/A'}/100 | Verdict: ${f.fallenVerdict||'N/A'}
  Stop Loss: ₹${f.stopLoss||'N/A'} (${f.stopReason||'N/A'}) | Risk: ${p(f.riskPct)}
  Target: ₹${f.target||'N/A'} (${f.targetReason||'N/A'}) | Reward: ${p(f.rewardPct)}
  R:R Ratio: ${f.rrRatio||'N/A'}x ${f.goodRR?'✓ Acceptable':'⚠ Below 2:1'}

Using all Varsity signals above, predict price at 6M, 1Y, 2Y, 3Y. Return JSON only.`;

  try {
    const raw = await callAnthropicAgent(system, user);
    const clean = raw.replace(/```json|```/g,'').trim();
    res.json(JSON.parse(clean));
  } catch(e) { res.json({ error: e.message }); }
});

// MiroFish — Portfolio prediction (multiple stocks + MFs, per-item + total)
app.post('/api/mirofish/portfolio-predict', async(req,res) => {
  if (!ANTHROPIC_API_KEY) return res.json({ error: 'Add ANTHROPIC_API_KEY to Railway environment variables' });
  const { items, years } = req.body;
  if (!items||!items.length) return res.json({ error: 'No items provided' });

  const system = `You are MiroFish, a senior Indian portfolio manager with deep knowledge of NSE equity and mutual fund markets.
Your job: predict realistic portfolio growth over ${years} year${years>1?'s':''} based on each asset's actual historical data.

CAGR guidelines by asset type (use historical data provided as your primary anchor):
- Small Cap MF: 18-26% CAGR based on historical. Apply mild mean reversion for 20Y+ horizons (-1 to -3%).
- Mid Cap MF: 16-22% CAGR based on historical. Slight mean reversion for 20Y+ (-1 to -2%).
- Flexi Cap MF: 14-20% CAGR based on historical.
- Large Cap MF / Index: 11-14% CAGR.
- High-quality stocks (ROE>20%, golden cross): 14-22% CAGR.
- Average stocks: 10-14% CAGR.

DO NOT default to 12% unless the asset genuinely has low historical returns.
USE the historical_cagr_3y field as your primary anchor. Adjust for horizon, not drastically.
Nifty average is 12% — small/mid cap should be HIGHER than this, not equal.

Respond ONLY in valid JSON, no markdown:
{
  "items": [
    {
      "sym": "Fund or stock name",
      "name": "Full name",
      "type": "mf or stock",
      "amount": 100000,
      "cagr": 19.5,
      "projected": 1280000,
      "thesis": "One sentence anchored to historical data"
    }
  ],
  "total_projected": 2500000,
  "portfolio_cagr": 18.2,
  "risk_level": "High",
  "confidence": "High/Medium/Low",
  "portfolio_insight": "2-3 sentence overall assessment referencing the actual historical returns",
  "key_risk": "Biggest single risk to this portfolio",
  "best_case": 3000000,
  "worst_case": 1800000,
  "inflation_adjusted": 900000
}`;

  const itemsText = items.map((x, i) => {
    const n = v => (v == null || isNaN(v)) ? null : +v;
    if (x.type === 'mf') {
      const lines = [
        `${i+1}. [MUTUAL FUND] ${x.name}`,
        `   Category: ${x.cat} | Risk: ${x.sebi_risk||x.risk||'N/A'} | AMC: ${x.amc||'N/A'}`,
        `   Amount invested: ₹${x.amount.toLocaleString('en-IN')}`,
        `   --- ACTUAL HISTORICAL RETURNS (use as primary anchor) ---`,
        `   3Y CAGR: ${n(x.cagr_3y)!=null ? n(x.cagr_3y).toFixed(1)+'%' : 'N/A'}`,
        `   5Y CAGR: ${n(x.cagr_5y)!=null ? n(x.cagr_5y).toFixed(1)+'%' : 'N/A'}`,
        `   10Y CAGR: ${n(x.cagr_10y)!=null ? n(x.cagr_10y).toFixed(1)+'%' : 'N/A'}`,
        `   Rolling 3Y avg: ${n(x.rolling_3y)!=null ? n(x.rolling_3y).toFixed(1)+'%' : 'N/A'}`,
        `   --- RISK METRICS ---`,
        `   Sharpe: ${n(x.sharpe)!=null ? n(x.sharpe).toFixed(3) : 'N/A'} | Sortino: ${n(x.sortino)!=null ? n(x.sortino).toFixed(3) : 'N/A'}`,
        `   Max Drawdown: ${n(x.max_drawdown)!=null ? n(x.max_drawdown).toFixed(1)+'%' : 'N/A'}`,
        `   --- COST & SIZE ---`,
        `   Expense Ratio: ${n(x.expense_ratio)!=null ? n(x.expense_ratio).toFixed(2)+'%' : 'N/A'} | AUM: ${n(x.aum_cr)!=null ? '₹'+Math.round(n(x.aum_cr)).toLocaleString('en-IN')+' Cr' : 'N/A'}`,
        `   Alpha vs benchmark: ${n(x.alpha)!=null ? n(x.alpha).toFixed(2) : 'N/A'}`,
        `   vs Category 3Y: ${n(x.vs_cat_3y)!=null ? n(x.vs_cat_3y).toFixed(2)+'x' : 'N/A'} | vs Category 5Y: ${n(x.vs_cat_5y)!=null ? n(x.vs_cat_5y).toFixed(2)+'x' : 'N/A'}`,
        `   ProTrader Score: ${x.score||'N/A'}/100`,
        `   SEBI/AMC record: ${x.amc_sebi||'clean'}`,
      ];
      return lines.filter(Boolean).join('\n');
    } else {
      const lines = [
        `${i+1}. [STOCK] ${x.name} (${x.grp||'NSE'} | ${x.sector||'N/A'})`,
        `   Amount invested: ₹${x.amount.toLocaleString('en-IN')}`,
        `   Price: ₹${n(x.price)!=null ? n(x.price).toFixed(1) : 'N/A'}`,
        `   --- FUNDAMENTALS ---`,
        `   ROE: ${n(x.roe)!=null ? n(x.roe).toFixed(1)+'%' : 'N/A'} | P/E: ${n(x.pe)!=null ? n(x.pe).toFixed(1) : 'N/A'} | D/E: ${n(x.debtToEq)!=null ? n(x.debtToEq).toFixed(2)+'x' : 'N/A'}`,
        `   Op Margin: ${n(x.opMargin)!=null ? n(x.opMargin).toFixed(1)+'%' : 'N/A'}`,
        `   EPS Growth: ${n(x.earGrowth)!=null ? n(x.earGrowth).toFixed(1)+'%' : 'N/A'} | Rev Growth: ${n(x.revGrowth)!=null ? n(x.revGrowth).toFixed(1)+'%' : 'N/A'}`,
        `   --- TECHNICAL ---`,
        `   From 52W High: ${n(x.pctFromHigh)!=null ? n(x.pctFromHigh).toFixed(1)+'%' : 'N/A'} | 52W Change: ${n(x.wk52Change)!=null ? n(x.wk52Change).toFixed(1)+'%' : 'N/A'}`,
        `   RSI: ${n(x.rsi)!=null ? n(x.rsi).toFixed(0) : 'N/A'} | Golden Cross: ${x.goldenCross==null?'N/A':x.goldenCross?'Yes (bullish)':'No (bearish)'}`,
        `   200 DMA: ${n(x.dma200)!=null ? '₹'+n(x.dma200).toFixed(0) : 'N/A'}`,
        `   ProTrader Score: ${x.score||'N/A'}/100`,
      ];
      return lines.filter(Boolean).join('\n');
    }
  }).join('\n\n');

  const user = `Predict portfolio growth over ${years} year${years>1?'s':''}. All historical data is provided above — USE IT as your anchor.

${itemsText}

Rules:
- For MF: base your CAGR on the actual historical 3Y/5Y CAGR shown. A mid cap fund with 24% 3Y CAGR should NOT get 12% prediction.
- Apply modest mean reversion for 20Y+ horizons (subtract 1-3%), but never collapse to Nifty average unless it's an index fund.
- For stocks: anchor to ROE, EPS growth, and sector trajectory.
- best_case = portfolio_cagr + 4%, worst_case = portfolio_cagr - 5%, inflation_adjusted assumes 6% inflation.
- total_projected and each item projected must be mathematically consistent with the CAGRs and years.

JSON only, no markdown.`;

  try {
    const raw = await callAnthropicAgent(system, user);
    const clean = raw.replace(/```json|```/g,'').trim();
    res.json(JSON.parse(clean));
  } catch(e) { res.json({ error: e.message }); }
});


app.post('/api/mirofish/mf-predict', async(req,res) => {
  if (!ANTHROPIC_API_KEY) return res.json({ error: 'Add ANTHROPIC_API_KEY to Railway environment variables' });

  const f = req.body; // all 55 fields
  const catLabel = f.cat==='smallcap'?'Small Cap':f.cat==='midcap'?'Mid Cap':'Flexi Cap';
  const n = v => (v==null||v===''||isNaN(v)) ? 'N/A' : (+v).toFixed(2);
  const p = v => (v==null||v===''||isNaN(v)) ? 'N/A' : (+v).toFixed(2)+'%';
  const cr = v => (v==null||v===''||isNaN(v)) ? 'N/A' : '₹'+Math.round(+v).toLocaleString('en-IN')+' Cr';

  const system = `You are a panel of 3 senior Indian mutual fund analysts with 20+ years each.
You have access to the COMPLETE Tickertape dataset for this fund — all 55 data points.
Your job: analyze everything and produce a realistic long-term wealth prediction for ₹1 Lakh invested today.

Rules:
- Be brutally honest. Account for expense drag, mean reversion, AUM size effects, portfolio quality.
- High AUM (>₹50K Cr) in small/mid cap = performance drag. Flag it.
- High expense ratio = compounding headwind. Quantify it.
- Alpha near 0 = manager not adding value above benchmark.
- Low sharpe + high drawdown = bad risk/reward even if returns look good.
- Your adjusted_cagr must be LOWER than historical if AUM is very large, expense is high, or alpha is 0.
- For 40-year horizon: use 0.75x of adjusted_cagr (regulatory/structural headwinds compound).

Respond ONLY in valid JSON, no markdown, no preamble:
{
  "prediction": "3-4 sentence realistic forward outlook covering returns, risks, and suitability",
  "adjusted_cagr": 14.5,
  "cagr_7y": 15.2,
  "cagr_10y": 14.8,
  "cagr_20y": 13.1,
  "cagr_30y": 11.8,
  "cagr_40y": 10.9,
  "confidence": "High/Medium/Low",
  "horizon": "7-40 years",
  "key_driver": "Single most important factor for future returns",
  "main_risk": "Single biggest risk to long-term performance",
  "expense_drag_note": "How expense ratio hurts compounding over 40 years",
  "aum_risk": "Impact of fund size on future alpha generation",
  "verdict": "Strong Hold / Good for SIP / Reduce exposure / Avoid"
}`;

  const user = `=== COMPLETE FUND DATA (55 fields from Tickertape) ===

IDENTITY
  Fund: ${f.name} | Category: ${catLabel} (${f.sub_category||'N/A'})
  AMC: ${f.amc||'N/A'} | Plan: ${f.plan||'N/A'}
  Fund Manager: ${f.fund_manager||'N/A'}
  Benchmark: ${f.benchmark||'N/A'}
  SEBI Risk: ${f.sebi_risk||'N/A'} | SIP Allowed: ${f.sip_allowed||'N/A'}
  Inception: ${f.months_inception||'N/A'} months ago
  NAV: ₹${f.nav||'N/A'} | AUM: ${cr(f.aum)}
  Min Lumpsum: ₹${f.min_lumpsum||'N/A'} | Min SIP: ₹${f.min_sip||'N/A'}
  Exit Load: ${f.exit_load||'N/A'}% | Lock-in: ${f.lock_in||'N/A'} days

RETURNS
  1Y: ${p(f.ret_1y)} | 3M: ${p(f.ret_3m)} | 6M: ${p(f.ret_6m)}
  3Y CAGR: ${p(f.cagr_3y)} | 5Y CAGR: ${p(f.cagr_5y)} | 10Y CAGR: ${p(f.cagr_10y)}
  Rolling 3Y avg: ${p(f.rolling_3y)}
  Alpha (vs benchmark): ${n(f.alpha)}
  % from ATH: ${p(f.pct_from_ath)}

vs CATEGORY (ratio: >1 = outperforming)
  vs Cat 1Y: ${n(f.vs_cat_1y)} | vs Cat 3Y: ${n(f.vs_cat_3y)}
  vs Cat 5Y: ${n(f.vs_cat_5y)} | vs Cat 10Y: ${n(f.vs_cat_10y)}

RISK METRICS
  Sharpe: ${n(f.sharpe)} | Sortino: ${n(f.sortino)}
  Volatility: ${p(f.volatility)} | Category StdDev: ${p(f.category_stddev)}
  Max Drawdown: ${p(f.max_drawdown)} | Tracking Error: ${n(f.tracking_error)}

COST
  Expense Ratio: ${p(f.expense_ratio)}
  (Impact: ₹1L at ${p(f.expense_ratio)} drag over 40Y = ~₹${Math.round(100000*Math.pow(1.12,40)-100000*Math.pow(1.12-(+f.expense_ratio||0)/100,40)).toLocaleString('en-IN')} lost to fees)

PORTFOLIO COMPOSITION
  Equity: ${p(f.pct_equity)} | Debt: ${p(f.pct_debt)} | Cash: ${p(f.pct_cash)}
  Large Cap: ${p(f.pct_largecap)} | Mid Cap: ${p(f.pct_midcap)} | Small Cap: ${p(f.pct_smallcap)}
  Other: ${p(f.pct_other)}

BOND QUALITY (if any debt)
  A-rated: ${p(f.pct_a_bonds)} | B-rated: ${p(f.pct_b_bonds)} | Poor quality: ${p(f.pct_poor_bonds)}
  Corp Debt: ${p(f.pct_corp_debt)} | Sovereign: ${p(f.pct_sovereign)}
  Avg Maturity: ${n(f.avg_maturity)} yrs | Avg YTM: ${p(f.avg_ytm)} | Category YTM: ${p(f.category_ytm)}

CONCENTRATION
  Top 3 holdings: ${p(f.top3_conc)} | Top 5: ${p(f.top5_conc)} | Top 10: ${p(f.top10_conc)}

VALUATION
  PE Ratio: ${n(f.pe_ratio)}x | Category PE: ${n(f.category_pe)}x
  (PE vs category: ${f.pe_ratio&&f.category_pe ? ((+f.pe_ratio/(+f.category_pe)-1)*100).toFixed(1)+'% premium/discount' : 'N/A'})

PROTRADER SCORING
  Score: ${f.score||'N/A'}/100 | Rank in category: #${f.rank||'N/A'}
  AMC SEBI status: ${f.amc_sebi||'Clean'}

=== QUESTION ===
If ₹1,00,000 is invested today in lumpsum, what will it grow to in 7, 10, 20, 30, and 40 years?
Give per-year CAGR for each horizon. Account for ALL the above data — especially AUM size, expense ratio, alpha, and mean reversion.`;

  try {
    const raw = await callAnthropicAgent(system, user);
    const clean = raw.replace(/```json|```/g,'').trim();
    res.json(JSON.parse(clean));
  } catch(e) {
    res.json({ error: e.message });
  }
});


// =============================================================================
// AI PORTFOLIO — DEEP MIROFISH PREDICTION ENGINE
// Built on: Varsity scoring pillars + 5-agent debate + Varsity CAGR frameworks
// =============================================================================

// Varsity-derived CAGR anchors per asset class (Module 11 + Module 15)
const VARSITY_CAGR_ANCHORS = {
  'Small Cap':    { base: 19, high: 27, low: 14, meanReversion20y: 3, meanReversion30y: 5 },
  'Mid Cap':      { base: 17, high: 24, low: 13, meanReversion20y: 2, meanReversion30y: 4 },
  'Flexi Cap':    { base: 15, high: 21, low: 12, meanReversion20y: 2, meanReversion30y: 3 },
  'Large Cap':    { base: 13, high: 16, low: 10, meanReversion20y: 1, meanReversion30y: 2 },
  'Index':        { base: 12, high: 14, low: 10, meanReversion20y: 0, meanReversion30y: 0 },
  'ELSS':         { base: 14, high: 20, low: 11, meanReversion20y: 2, meanReversion30y: 3 },
  'Contra':       { base: 14, high: 19, low: 10, meanReversion20y: 2, meanReversion30y: 3 },
  'IT':           { base: 13, high: 20, low: 8,  meanReversion20y: 2, meanReversion30y: 3 },
  'Banking':      { base: 12, high: 18, low: 8,  meanReversion20y: 2, meanReversion30y: 3 },
  'Consumer':     { base: 13, high: 18, low: 9,  meanReversion20y: 2, meanReversion30y: 3 },
  'Energy':       { base: 11, high: 16, low: 7,  meanReversion20y: 2, meanReversion30y: 3 },
  'Pharma':       { base: 12, high: 17, low: 8,  meanReversion20y: 2, meanReversion30y: 3 },
  'default_mf':   { base: 14, high: 20, low: 10, meanReversion20y: 2, meanReversion30y: 3 },
  'default_stock':{ base: 12, high: 18, log: 7,  meanReversion20y: 2, meanReversion30y: 3 },
  'crypto':       { base: 30, high: 60, low: -50, meanReversion20y: 10, meanReversion30y: 15 },
};

// 5 agents — each applies Varsity principles from their perspective
const AIP_AGENTS = [
  {
    id: 'vikram',
    name: 'Vikram (FA)',
    persona: `You are Vikram Mehta, Fundamental Analyst, trained on Zerodha Varsity Modules 3 and 15.
You evaluate every asset through a business quality lens:
- For MF: Rolling 3Y CAGR is more reliable than point-to-point. Sortino > Sharpe (Module 11).
  Expense ratio compounding is brutal — 0.5% more TER costs ₹40L on ₹10L over 30Y.
  AUM above ₹50K Cr in small/mid cap ALWAYS creates performance drag. Benchmark alpha near 0 = closet indexer.
- For stocks: ROE>15% + D/E<1 + EPS growth > Revenue growth = operating leverage = compounding machine.
  CFO/PAT > 1 = real earnings. Negative or falling ROE = capital destroyer, avoid.
Respond ONLY in JSON. Be specific. Use actual numbers from the data.`,
    weight: 0.28,
  },
  {
    id: 'priya',
    name: 'Priya (TA)',
    persona: `You are Priya Sharma, Technical Analyst, trained on Zerodha Varsity Module 2.
You read price action and trend signals:
- For stocks: 200 DMA is the line of truth. Golden Cross = bullish primary trend confirmed.
  RSI Bullish Divergence is the STRONGEST reversal signal — Varsity Module 2 explicitly calls this out.
  RSI < 30 + rising OBV = institutional accumulation. MACD bullish crossover above zero line = momentum.
- For MF: Pct from ATH matters. Funds in drawdown from peak need trend reversal confirmation.
  Rolling 3Y is the TA equivalent for funds — smooths noise. vs Category ratio trending up = alpha acceleration.
Respond ONLY in JSON. Reference specific indicator values from the data.`,
    weight: 0.22,
  },
  {
    id: 'arjun',
    name: 'Arjun (Contrarian)',
    persona: `You are Arjun Kapoor, Contrarian Analyst, applying the Varsity "margin of safety" doctrine.
You look at valuation and cycle positioning:
- For MF: PE ratio vs Category PE — fund trading at premium to category = expensive. 
  High cash allocation (>10%) = manager cautious = defensive positioning.
  Sector concentration risk — top 10 holding % signals how diversified the bet really is.
- For stocks: PEG ratio (PE/EPS Growth) — PEG<1 = undervalued growth. Sector-relative PE matters more than absolute.
  Discount from 52W high — deep value vs structural decline, distinguish using ROE trend.
  Contrarian signal: stock hated by market but ROE still >15% + CFO intact = asymmetric opportunity.
Respond ONLY in JSON. Focus on valuation and margin of safety.`,
    weight: 0.20,
  },
  {
    id: 'meera',
    name: 'Meera (Risk)',
    persona: `You are Meera Nair, Risk Manager, applying Varsity Module 11 risk framework.
You quantify downside before upside:
- For MF: Sortino ratio is PRIMARY (penalizes only bad volatility — Varsity: SIP investors care about downside).
  Max drawdown tells you the worst you'll experience. Volatility vs category = relative risk.
  SEBI probe / AMC issues = non-quantifiable tail risk — cap score heavily.
- For stocks: Beta > 1.5 = amplified market moves. High debt + falling margins = earnings cliff risk.
  Stop loss discipline: stock below 200DMA + death cross = exit signal regardless of fundamentals.
  Position sizing: high conviction but high risk = small position. Never bet the farm on one thesis.
Respond ONLY in JSON. Quantify all risks with specific numbers from the data.`,
    weight: 0.18,
  },
  {
    id: 'rahul',
    name: 'Rahul (Quant)',
    persona: `You are Rahul Iyer, Quantitative Analyst, building factor models grounded in Varsity data.
You translate all signals into probability-weighted CAGR estimates:
- For MF: Compute compound wealth: ₹1L * (1 + cagr/100)^years. Then subtract expense drag.
  Expense drag formula: (1+cagr)^years - (1+cagr-expense_ratio/100)^years = money lost to fees.
  Alpha consistency (vs category across 1Y/3Y/5Y/10Y) = regime-robust fund vs one-trick pony.
- For stocks: Factor scoring: Quality (ROE, D/E, margins) + Momentum (52W return, 200DMA) + Value (PEG, PE vs sector).
  Base rate: stocks with Score>70 + golden cross historically return 18% CAGR on NSE over 5Y.
  Mean reversion: anything returning >30% annually for 5Y will revert. Build that in.
Respond ONLY in JSON. Show your math. Give specific CAGR numbers.`,
    weight: 0.12,
  },
];

// Per-agent analysis call
async function aipRunAgent(agent, items, years) {
  const itemsText = items.map((x, i) => {
    const nv = v => (v==null||isNaN(+v)) ? 'N/A' : (+v).toFixed(2);
    const pv = v => (v==null||isNaN(+v)) ? 'N/A' : (+v).toFixed(1)+'%';
    const cr = v => (v==null||isNaN(+v)) ? 'N/A' : '₹'+Math.round(+v).toLocaleString('en-IN')+' Cr';

    if (x.type === 'mf') {
      return `${i+1}. [MF] ${x.name} | ${x.cat} | ${x.sebi_risk||x.risk||'N/A'}
   ₹${x.amount.toLocaleString('en-IN')} invested
   RETURNS: 3Y=${pv(x.cagr_3y)} 5Y=${pv(x.cagr_5y)} 10Y=${pv(x.cagr_10y)} Rolling3Y=${pv(x.rolling_3y)}
   RISK: Sharpe=${nv(x.sharpe)} Sortino=${nv(x.sortino)} MaxDD=${pv(x.max_drawdown)} Vol=${pv(x.volatility)}
   COST: TER=${pv(x.expense_ratio)} AUM=${cr(x.aum_cr)}
   QUALITY: Alpha=${nv(x.alpha)} vsCat3Y=${nv(x.vs_cat_3y)}x vsCat5Y=${nv(x.vs_cat_5y)}x
   PORTFOLIO: PE=${nv(x.pe_ratio)}x CatPE=${nv(x.category_pe)}x Cash=${pv(x.pct_cash)} Top10=${pv(x.top10_conc)}
   SCORE: ProTrader=${x.score||'N/A'}/100 AMC_SEBI=${x.amc_sebi||'Clean'}`;
    } else if (x.type === 'stock') {
      return `${i+1}. [STOCK] ${x.name} (${x.grp||'NSE'}) | ${x.sector||'N/A'}
   ₹${x.amount.toLocaleString('en-IN')} invested | Price=₹${nv(x.price)}
   QUALITY: ROE=${pv(x.roe)} D/E=${nv(x.debtToEq)}x OpMgn=${pv(x.opMargin)}
   GROWTH: EPS=${pv(x.earGrowth)} Rev=${pv(x.revGrowth)}
   VALUE: PE=${nv(x.pe)}x PEG=${x.pe&&x.earGrowth>0?(+x.pe/+x.earGrowth).toFixed(2):'N/A'} FrHigh=${pv(x.pctFromHigh)}
   TREND: 200DMA=₹${nv(x.dma200)} GoldCross=${x.goldenCross?'YES':'NO'} RSI=${nv(x.rsi)}
   SIGNALS: MACD=${x.macdBull?'Bullish':'Bearish'} OBV=${x.obvRising?'Rising':'Falling'} BullDiv=${x.bullishDiv?'YES':'NO'}
   SCORE: ProTrader=${x.score||'N/A'}/100 52W=${pv(x.wk52Change)}`;
    } else {
      return `${i+1}. [CRYPTO] ${x.name} | ₹${x.amount.toLocaleString('en-IN')} | 3Y ret=${pv(x.ret)}`;
    }
  }).join('\n\n');

  const anchor = items.map(x => {
    const cat = x.cat || (x.type==='crypto' ? 'crypto' : 'default_'+x.type);
    const a = VARSITY_CAGR_ANCHORS[cat] || VARSITY_CAGR_ANCHORS['default_'+x.type] || VARSITY_CAGR_ANCHORS['default_mf'];
    const hist = parseFloat(x.cagr_3y || x.cagr_5y || x.ret) || a.base;
    const mr = years >= 30 ? a.meanReversion30y : years >= 20 ? a.meanReversion20y : 0;
    const adj = Math.max(a.low, Math.min(a.high, hist - mr));
    return `${x.name}: hist=${hist.toFixed(1)}% anchor=${adj.toFixed(1)}% (Varsity ${cat} base=${a.base}%, mr${years}Y=${mr}%)`;
  }).join('\n');

  const system = `${agent.persona}

VARSITY-DERIVED CAGR ANCHORS for this portfolio (pre-computed for your reference):
${anchor}

Your task: Analyze each asset and estimate its realistic CAGR over ${years} years.
Use the historical data as your primary anchor. Apply your lens (${agent.name}).
Do NOT ignore the anchors. Do NOT default to 12% for everything.

Respond ONLY in this exact JSON — no markdown, no preamble:
{
  "agent": "${agent.id}",
  "items": [
    {
      "id": "asset identifier",
      "cagr": 19.5,
      "confidence": 0.8,
      "key_insight": "One specific sentence from your ${agent.id} perspective referencing actual data",
      "red_flag": "Specific concern or null"
    }
  ],
  "portfolio_view": "One sentence on overall portfolio from ${agent.id} lens",
  "biggest_risk": "Single most important risk you see"
}
Return exactly ${items.length} items in the same order as input.`;

  const raw = await callAnthropicAgent(system, itemsText, 1400);
  const clean = raw.replace(/```json|```/g,'').trim();
  return JSON.parse(clean);
}

// Synthesis — aggregate 5 agents into final verdict
async function aipSynthesise(agentResults, items, years) {
  const total = items.reduce((s,a) => s+a.amount, 0);

  // Weighted CAGR per item
  const itemCAGRs = items.map((item, i) => {
    let weightedCAGR = 0, totalWeight = 0, insights = [], redFlags = [];
    agentResults.forEach(ar => {
      const agentItem = ar.result.items && ar.result.items[i];
      if (!agentItem || !agentItem.cagr) return;
      const conf = agentItem.confidence || 0.7;
      weightedCAGR += agentItem.cagr * ar.weight * conf;
      totalWeight   += ar.weight * conf;
      if (agentItem.key_insight) insights.push(`${ar.agent.name}: ${agentItem.key_insight}`);
      if (agentItem.red_flag && agentItem.red_flag !== 'null' && agentItem.red_flag !== null)
        redFlags.push(agentItem.red_flag);
    });
    const finalCAGR = totalWeight > 0 ? weightedCAGR / totalWeight : (item.ret || 14);
    const proj = Math.round(item.amount * Math.pow(1 + finalCAGR/100, years));
    return { ...item, cagr: +finalCAGR.toFixed(1), projected: proj, insights, redFlags };
  });

  // Portfolio-level metrics
  const totalProj = itemCAGRs.reduce((s,a) => s+a.projected, 0);
  const blendedCAGR = total > 0 ? +((Math.pow(totalProj/total, 1/years)-1)*100).toFixed(1) : 14;
  const riskScore = items.reduce((s,a) => {
    const rw = {'Low':1,'Moderate':2,'High':3,'Very High':4}[a.risk]||2;
    return s + rw*(a.amount/total);
  }, 0);
  const riskLabel = riskScore < 1.8 ? 'Low' : riskScore < 2.5 ? 'Moderate' : riskScore < 3.2 ? 'High' : 'Very High';

  // Expense drag calculation (Varsity Module 11)
  const avgExpense = items.reduce((s,a) => s + (a.expense_ratio||0.5)*(a.amount/total), 0);
  const projWithoutDrag = Math.round(total * Math.pow(1 + (blendedCAGR + avgExpense)/100, years));
  const expenseDragTotal = projWithoutDrag - totalProj;

  // Growth curve — year by year
  const curveSteps = Math.min(years, 30);
  const growthCurve = [];
  for (let y = 0; y <= curveSteps; y++) {
    const yr = Math.round(y/curveSteps * years);
    growthCurve.push({ year: yr, value: Math.round(total * Math.pow(1 + blendedCAGR/100, yr)) });
  }

  // Synthesis prompt
  const agentSummary = agentResults.map(ar =>
    `${ar.agent.name}: "${ar.result.portfolio_view || 'N/A'}" | Risk: "${ar.result.biggest_risk || 'N/A'}"`
  ).join('\n');

  const itemSummary = itemCAGRs.map((it,i) =>
    `${it.name} (${it.type}): CAGR=${it.cagr}% → ${it.projected>=1e7?'₹'+(it.projected/1e7).toFixed(2)+'Cr':'₹'+(it.projected/1e5).toFixed(2)+'L'} | RedFlags: ${it.redFlags.slice(0,2).join('; ')||'none'}`
  ).join('\n');

  const system = `You are the MiroFish Synthesis Agent — the final layer after 5 expert agents have debated.
Your job: synthesize their views into a coherent, actionable portfolio prediction.

Apply Zerodha Varsity principles:
- Sortino > Sharpe for SIP investors (downside-only risk matters more)
- Rolling 3Y return > point-to-point (removes recency bias)
- Expense ratio compounding: small % destroys crores over decades
- 200 DMA and Golden Cross = trend truth for equities
- Diversification across market caps reduces but doesn't eliminate risk

The math is already done. Your job is interpretation and final insight.

Respond ONLY in JSON:
{
  "portfolio_insight": "2-3 sentences synthesizing all agent views into ONE clear portfolio verdict. Be specific about what's working and what isn't.",
  "key_risk": "The single most important risk to this specific portfolio",
  "varsity_lesson": "One actionable Varsity insight this portfolio teaches — specific, not generic",
  "agent_consensus": "High / Medium / Low — how much did the 5 agents agree?",
  "rebalance_suggestion": "One concrete rebalance suggestion if needed, or null",
  "sip_vs_lumpsum": "Is SIP or lumpsum better for this portfolio mix, and why?"
}`;

  const user = `Portfolio: ${items.length} assets | ₹${total.toLocaleString('en-IN')} total | ${years}Y horizon\n\nPER-ASSET RESULTS:\n${itemSummary}\n\nAGENT VIEWS:\n${agentSummary}\n\nBlended CAGR: ${blendedCAGR}% | Risk: ${riskLabel} | Expense drag over ${years}Y: ₹${expenseDragTotal.toLocaleString('en-IN')}`;

  const raw = await callAnthropicAgent(system, user, 800);
  const clean = raw.replace(/```json|```/g,'').trim();
  const synthesis = JSON.parse(clean);

  return {
    items: itemCAGRs,
    total_projected: totalProj,
    portfolio_cagr: blendedCAGR,
    risk_level: riskLabel,
    best_case:  Math.round(total * Math.pow(1 + (blendedCAGR+5)/100, years)),
    worst_case: Math.round(total * Math.pow(1 + (blendedCAGR-6)/100, years)),
    inflation_adjusted: Math.round(totalProj / Math.pow(1.06, years)),
    expense_drag: expenseDragTotal,
    avg_expense_ratio: +avgExpense.toFixed(2),
    growth_curve: growthCurve,
    portfolio_insight:    synthesis.portfolio_insight,
    key_risk:             synthesis.key_risk,
    varsity_lesson:       synthesis.varsity_lesson,
    agent_consensus:      synthesis.agent_consensus,
    rebalance_suggestion: synthesis.rebalance_suggestion,
    sip_vs_lumpsum:       synthesis.sip_vs_lumpsum,
    agent_views: agentResults.map(ar => ({
      agent: ar.agent.name,
      portfolio_view: ar.result.portfolio_view,
      biggest_risk:   ar.result.biggest_risk,
    })),
  };
}

// Main endpoint — replaces the old simple portfolio-predict
app.post('/api/mirofish/portfolio-predict-v2', async (req, res) => {
  if (!ANTHROPIC_API_KEY) return res.json({ error: 'Add ANTHROPIC_API_KEY to Railway environment variables' });

  const { items, years } = req.body;
  if (!items || !items.length) return res.json({ error: 'No items provided' });
  if (items.length > 15) return res.json({ error: 'Maximum 15 assets per prediction' });

  const yearsN = Math.max(1, Math.min(40, parseInt(years) || 10));

  try {
    console.log(`🐟 AIP v2: ${items.length} assets, ${yearsN}Y, ${AIP_AGENTS.length} agents running in parallel`);

    // Run all 5 agents in parallel
    const agentPromises = AIP_AGENTS.map(async agent => {
      try {
        const result = await aipRunAgent(agent, items, yearsN);
        return { agent, result, weight: agent.weight };
      } catch(e) {
        console.log(`🐟 AIP agent ${agent.id} failed: ${e.message}`);
        return null;
      }
    });

    const agentResults = (await Promise.all(agentPromises)).filter(Boolean);
    if (agentResults.length < 2) return res.json({ error: 'Too few agents succeeded. Check API limits.' });

    console.log(`🐟 AIP v2: ${agentResults.length}/5 agents done, synthesising...`);
    const result = await aipSynthesise(agentResults, items, yearsN);

    console.log(`🐟 AIP v2 done. Portfolio CAGR: ${result.portfolio_cagr}% → ${result.total_projected.toLocaleString('en-IN')}`);
    res.json(result);

  } catch(e) {
    console.log('🐟 AIP v2 error:', e.message);
    res.json({ error: e.message });
  }
});
