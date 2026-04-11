/**
 * Verify the FIXED field mappings against actual Apify actor output.
 * Uses the same g()/gs() helper pattern as kite-server.js
 */
require('dotenv').config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const BASE = 'https://api.apify.com/v2';
const ACTOR = 'shashwattrivedi~screener-in';

async function testBulkQuery() {
  console.log('Testing runQuery mode with FIXED field mappings...\n');

  const startResp = await fetch(`${BASE}/acts/${ACTOR}/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'runQuery',
      queryString: 'Market Capitalization > 500000 AND Market Capitalization < 600000',
      username: process.env.SCREENER_USERNAME,
      password: process.env.SCREENER_PASSWORD,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!startResp.ok) { console.error('Start failed:', startResp.status); return; }
  const runInfo = await startResp.json();
  const runId = runInfo.data?.id;
  const datasetId = runInfo.data?.defaultDatasetId;
  console.log(`Run: ${runId}`);

  let status = 'RUNNING', attempts = 0;
  while ((status === 'RUNNING' || status === 'READY') && attempts < 60) {
    await new Promise(r => setTimeout(r, 5000));
    attempts++;
    const poll = await fetch(`${BASE}/acts/${ACTOR}/runs/${runId}?token=${APIFY_TOKEN}`, { signal: AbortSignal.timeout(10000) });
    if (poll.ok) status = (await poll.json()).data?.status || 'RUNNING';
    if (attempts % 3 === 0) console.log(`  Status: ${status} (${attempts * 5}s)`);
  }

  if (status !== 'SUCCEEDED') { console.error(`Run ended: ${status}`); return; }

  const dataResp = await fetch(`${BASE}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=5`, { signal: AbortSignal.timeout(30000) });
  const items = await dataResp.json();
  if (!items?.length) { console.error('Empty dataset'); return; }

  console.log(`\nGot ${items.length} items. Testing field mappings on first item:\n`);
  const item = items[0];

  // Same helpers as kite-server.js
  const pn = v => { const n = parseFloat(String(v||'').replace(/,/g,'')); return isNaN(n)?null:n; };
  const ps = v => (v||'').toString().trim();
  const g  = (...keys) => { for (const k of keys) { if (item[k]!=null && item[k]!=='') return pn(item[k]); } return null; };
  const gs = (...keys) => { for (const k of keys) { if (item[k]!=null) return ps(item[k]); } return ''; };

  // FIXED mappings (from kite-server.js after the fix)
  const data = {
    name:             gs('companyName','name','Name'),
    roe:              g('roe','ROE','returnOnEquity'),
    de:               g('debtToEquity','D/E','de','Debt / Eq'),
    pe:               g('pe','PE','priceToEarning','P/E'),
    rev_gr_3y:        g('salesGrowth3y','salesGrowth3Years','Sales growth 3Years','Sales Var 3Yrs'),
    eps_gr_3y:        g('profitGrowth3y','profitGrowth3Years','Profit growth 3Years','Profit Var 3Yrs'),
    opm:              g('opm','OPM','operatingProfitMargin'),
    roa:              g('roa','ROA','returnOnAssets','ROA 12M'),
    pb:               g('pb','PB','priceToBook','CMP / BV'),
    peg:              g('peg','PEG','pegRatio'),
    int_cov:          g('interestCoverage','Interest Coverage Ratio','Int Coverage'),
    promoter_holding: g('promoterHolding','Promoter holding','Prom Hold'),
    pledged_pct:      g('pledgedPercentage','Pledged percentage','Pledged'),
    promoter_chg:     g('promoterHoldingChange','Change in promoter holding','Change in Prom Hold'),
    mkt_cap:          g('marketCap','Market Capitalization','Mar Cap'),
    current_price:    g('currentPrice','Current Price','price','CMP'),
    eps:              g('eps','EPS','EPS 12M'),
    debt:             g('debt','Debt'),
    current_ratio:    g('currentRatio','Current ratio'),
    div_yield:        g('dividendYield','Dividend yield','Div Yld'),
    sales_gr_1y:      g('salesGrowth','Sales growth'),
    sales_gr_5y:      g('salesGrowth5y','Sales growth 5Years','Sales Var 5Yrs'),
    eps_gr_1y:        g('profitGrowth','Profit growth'),
    eps_gr_5y:        g('profitGrowth5y','Profit growth 5Years','Profit Var 5Yrs'),
    roe_3y_avg:       g('avgRoe3y','Average return on equity 3Years','ROE 3Yr'),
    roe_5y_avg:       g('avgRoe5y','Average return on equity 5Years','ROE 5Yr'),
    ret_1y:           g('return1y','Return over 1year','1Yr return'),
    ret_3y:           g('return3y','Return over 3years','3Yrs return'),
    ret_5y:           g('return5y','Return over 5years','5Yrs return'),
    ret_6m:           g('return6m','Return over 6months','6mth return'),
    ret_3m:           g('return3m','Return over 3months','3mth return'),
    ev_ebitda:        g('evEbitda','EVEBITDA','EV / EBITDA'),
    industry_pe:      g('industryPE','Industry PE','Ind PE'),
    pat_qtr:          g('netProfitLatestQuarter','Net Profit latest quarter','NP Qtr'),
    sales_qtr:        g('salesLatestQuarter','Sales latest quarter','Sales Qtr'),
    pat_annual:       g('profitAfterTax','Profit after tax','PAT 12M'),
    sales_annual:     g('sales','Sales'),
    pat_qtr_yoy:      g('yoyQuarterlyProfitGrowth','YOY Quarterly profit growth','Qtr Profit Var'),
    sales_qtr_yoy:    g('yoyQuarterlySalesGrowth','YOY Quarterly sales growth','Qtr Sales Var'),
    // BONUS fields
    roce:             g('roce','ROCE','returnOnCapitalEmployed'),
    earnings_yield:   g('earningsYield','Earnings Yield'),
    price_to_fcf:     g('priceToFCF','CMP / FCF'),
    price_to_sales:   g('priceToSales','CMP / Sales'),
  };

  let matched = 0, missed = 0;
  for (const [key, val] of Object.entries(data)) {
    if (val !== null && val !== '') {
      console.log(`  ✅ ${key.padEnd(18)} = ${val}`);
      matched++;
    } else {
      console.log(`  ❌ ${key.padEnd(18)} = NULL`);
      missed++;
    }
  }

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  RESULT: ${matched} matched, ${missed} missed out of ${Object.keys(data).length}`);
  console.log(`═══════════════════════════════════════════`);

  // Show raw item for reference
  console.log(`\nRaw item (${item.Name || 'unknown'}):`);
  console.log(JSON.stringify(item, null, 2));
}

testBulkQuery().catch(e => console.error(e));
