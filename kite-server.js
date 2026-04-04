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
        price         DECIMAL(10,2) NOT NULL,
        quantity      INTEGER       NOT NULL,
        capital       DECIMAL(12,2),
        entry_time    TIMESTAMP     DEFAULT NOW(),
        exit_time     TIMESTAMP,
        exit_price    DECIMAL(10,2),
        pnl           DECIMAL(10,2),
        pnl_pct       DECIMAL(8,2),
        stop_loss     DECIMAL(10,2),
        target        DECIMAL(10,2),
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

// ── Universe ──────────────────────────────────────────────────────────────────
const UNIVERSE = [
  {sym:"RELIANCE",  n:"Reliance Industries",    base:2847},
  {sym:"TCS",       n:"Tata Consultancy Svcs",  base:3921},
  {sym:"HDFCBANK",  n:"HDFC Bank",              base:1683},
  {sym:"ICICIBANK", n:"ICICI Bank",             base:1242},
  {sym:"INFY",      n:"Infosys",                base:1887},
  {sym:"HINDUNILVR",n:"Hindustan Unilever",     base:2342},
  {sym:"ITC",       n:"ITC Ltd",                base:472},
  {sym:"SBIN",      n:"State Bank of India",    base:812},
  {sym:"BHARTIARTL",n:"Bharti Airtel",          base:1823},
  {sym:"BAJFINANCE",n:"Bajaj Finance",          base:7105},
  {sym:"KOTAKBANK", n:"Kotak Mahindra Bank",    base:1892},
  {sym:"LT",        n:"Larsen & Toubro",        base:3812},
  {sym:"HCLTECH",   n:"HCL Technologies",       base:1642},
  {sym:"WIPRO",     n:"Wipro Ltd",              base:558},
  {sym:"AXISBANK",  n:"Axis Bank",              base:1124},
  {sym:"MARUTI",    n:"Maruti Suzuki",          base:12540},
  {sym:"SUNPHARMA", n:"Sun Pharma",             base:1782},
  {sym:"TITAN",     n:"Titan Company",          base:3542},
  {sym:"TATAMOTORS",n:"Tata Motors",            base:1018},
  {sym:"ADANIENT",  n:"Adani Enterprises",      base:2648},
  {sym:"NTPC",      n:"NTPC Ltd",               base:382},
  {sym:"ONGC",      n:"ONGC",                   base:287},
  {sym:"TATASTEEL", n:"Tata Steel",             base:168},
  {sym:"HINDALCO",  n:"Hindalco Industries",    base:687},
  {sym:"JSWSTEEL",  n:"JSW Steel",              base:978},
  {sym:"TECHM",     n:"Tech Mahindra",          base:1682},
  {sym:"DRREDDY",   n:"Dr Reddy's Labs",        base:5842},
  {sym:"CIPLA",     n:"Cipla Ltd",              base:1542},
  {sym:"ASIANPAINT",n:"Asian Paints",           base:2342},
  {sym:"NESTLEIND", n:"Nestlé India",           base:2287},
];
const INSTRUMENTS = {
  "RELIANCE":738561,"TCS":2953217,"HDFCBANK":341249,"ICICIBANK":1270529,
  "INFY":408065,"HINDUNILVR":356865,"ITC":424961,"SBIN":779521,
  "BHARTIARTL":2714625,"BAJFINANCE":4267265,"KOTAKBANK":492033,"LT":2939649,
  "HCLTECH":1850625,"WIPRO":969473,"AXISBANK":1510401,"MARUTI":2815745,
  "SUNPHARMA":857857,"TITAN":897537,"TATAMOTORS":884737,"ADANIENT":6401,
  "NTPC":2977281,"ONGC":633601,"TATASTEEL":895745,"HINDALCO":348929,
  "JSWSTEEL":3001089,"TECHM":3465729,"DRREDDY":225537,"CIPLA":177665,
  "ASIANPAINT":60417,"NESTLEIND":4598529,
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
  BUY_SCORE:        2.5,   // Weighted score threshold to enter
  SELL_SCORE:      -2.0,   // Score to exit
  CONSENSUS_NEEDED: 2,     // Minimum strategies that must agree
  CAPITAL_PER_TRADE:7500,
  MAX_POSITIONS:    3,
  DEFAULT_SL_PCT:   1.5,
  DEFAULT_TGT_PCT:  3.0,
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
      const token = INSTRUMENTS[stock.sym];
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

      await delay(400); // Kite rate limit
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

app.get("/",       (req,res)=>res.redirect("/health"));
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

app.get("/orders",    async(req,res)=>{try{res.json(await kite.getOrders());}   catch(e){res.status(500).json({error:e.message});}});
app.get("/positions", async(req,res)=>{try{res.json(await kite.getPositions());}catch(e){res.status(500).json({error:e.message});}});
app.get("/holdings",  async(req,res)=>{try{res.json(await kite.getHoldings());} catch(e){res.status(500).json({error:e.message});}});
app.get("/margin",    async(req,res)=>{try{res.json(await kite.getMargins());}  catch(e){res.status(500).json({error:e.message});}});

app.get("/history/:symbol", async(req,res)=>{
  try {
    const{interval="5minute"}=req.query;
    const token=INSTRUMENTS[req.params.symbol];
    if(!token)return res.status(404).json({error:"Symbol not found"});
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

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  await initDB();
  initKite(process.env.KITE_ACCESS_TOKEN||null);
  if (process.env.KITE_ACCESS_TOKEN) {
    console.log("✅ Token found — starting smart engine...");
    startTicker(process.env.KITE_ACCESS_TOKEN);
    setTimeout(scanAndTrade, 5000);
  } else {
    console.log("⚠️  No token — visit /auth/login");
  }
  // Every 5 min during market hours Mon–Fri
  cron.schedule("*/5 9-15 * * 1-5", ()=>scanAndTrade(), {timezone:"Asia/Kolkata"});
  // Market open trigger
  cron.schedule("15 9 * * 1-5", ()=>scanAndTrade(), {timezone:"Asia/Kolkata"});

  const PORT=process.env.PORT||3001;
  server.listen(PORT, ()=>{
    console.log(`\n✅ ProTrader Smart Engine running on port ${PORT}`);
    console.log(`   7 strategies: EMA | RSI_MR | BB_Squeeze | VWAP | Supertrend | OR | Volume`);
    console.log(`   Regimes: TRENDING | RANGING | BREAKOUT | MOMENTUM`);
    console.log(`   /scan-now — trigger manual scan`);
    console.log(`   /paper-trades/stats — full strategy breakdown\n`);
  });
}

start();
