/**
 * Test script: Call the Apify Screener.in actor for a single stock
 * and log every field it returns — so we can compare vs what kite-server expects.
 */
require('dotenv').config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const SCREENER_USER = process.env.SCREENER_USERNAME;
const SCREENER_PASS = process.env.SCREENER_PASSWORD;

if (!APIFY_TOKEN) { console.error('APIFY_TOKEN not set'); process.exit(1); }

const BASE = 'https://api.apify.com/v2';
const ACTOR = 'shashwattrivedi~screener-in';

async function testSingleStock(sym) {
  console.log(`\n===== Testing getstockdetails mode for ${sym} =====\n`);

  const startResp = await fetch(`${BASE}/acts/${ACTOR}/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'getstockdetails',
      url: `https://www.screener.in/company/${sym}/consolidated/`,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!startResp.ok) {
    console.error('Start failed:', startResp.status, await startResp.text().catch(()=>''));
    return null;
  }

  const runInfo = await startResp.json();
  const runId = runInfo.data?.id;
  const datasetId = runInfo.data?.defaultDatasetId;
  console.log(`Run started: ${runId}`);

  // Poll until done
  let status = 'RUNNING', attempts = 0;
  while ((status === 'RUNNING' || status === 'READY') && attempts < 36) {
    await new Promise(r => setTimeout(r, 5000));
    attempts++;
    const poll = await fetch(`${BASE}/acts/${ACTOR}/runs/${runId}?token=${APIFY_TOKEN}`, { signal: AbortSignal.timeout(10000) });
    if (poll.ok) {
      const pd = await poll.json();
      status = pd.data?.status || 'RUNNING';
      if (attempts % 3 === 0) console.log(`  Status: ${status} (${attempts * 5}s)`);
    }
  }

  if (status !== 'SUCCEEDED') {
    console.error(`Run ended with: ${status}`);
    return null;
  }

  const dataResp = await fetch(`${BASE}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=5`, { signal: AbortSignal.timeout(15000) });
  const items = await dataResp.json();

  if (!items || !items.length) {
    console.error('Empty dataset');
    return null;
  }

  return items[0];
}

async function testBulkQuery() {
  console.log(`\n===== Testing runQuery mode (Market Cap > 0, limited) =====\n`);

  if (!SCREENER_USER || !SCREENER_PASS) {
    console.log('SCREENER_USERNAME/PASSWORD not set — skipping bulk test');
    return null;
  }

  const startResp = await fetch(`${BASE}/acts/${ACTOR}/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'runQuery',
      queryString: 'Market Capitalization > 500000 AND Market Capitalization < 600000',
      username: SCREENER_USER,
      password: SCREENER_PASS,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!startResp.ok) {
    console.error('Bulk start failed:', startResp.status, await startResp.text().catch(()=>''));
    return null;
  }

  const runInfo = await startResp.json();
  const runId = runInfo.data?.id;
  const datasetId = runInfo.data?.defaultDatasetId;
  console.log(`Bulk run started: ${runId}`);

  // Poll (max 5 min)
  let status = 'RUNNING', attempts = 0;
  while ((status === 'RUNNING' || status === 'READY') && attempts < 60) {
    await new Promise(r => setTimeout(r, 5000));
    attempts++;
    const poll = await fetch(`${BASE}/acts/${ACTOR}/runs/${runId}?token=${APIFY_TOKEN}`, { signal: AbortSignal.timeout(10000) });
    if (poll.ok) {
      const pd = await poll.json();
      status = pd.data?.status || 'RUNNING';
      if (attempts % 3 === 0) console.log(`  Bulk status: ${status} (${attempts * 5}s)`);
    }
  }

  if (status !== 'SUCCEEDED') {
    console.error(`Bulk run ended with: ${status}`);
    return null;
  }

  const dataResp = await fetch(`${BASE}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=10`, { signal: AbortSignal.timeout(30000) });
  const items = await dataResp.json();

  if (!items || !items.length) {
    console.error('Empty bulk dataset');
    return null;
  }

  return items;
}

// --- Expected field mappings from kite-server.js (the g() helper tries these keys) ---
const EXPECTED_MAPPINGS = {
  sym:              ['nseCode', 'NSE Code', 'nse_code', 'symbol', 'Symbol'],
  name:             ['companyName', 'name', 'Name'],
  industry:         ['industry', 'Industry', 'sector'],
  roe:              ['roe', 'ROE', 'returnOnEquity'],
  de:               ['debtToEquity', 'D/E', 'de'],
  pe:               ['pe', 'PE', 'priceToEarning'],
  rev_gr_3y:        ['salesGrowth3y', 'salesGrowth3Years', 'Sales growth 3Years'],
  eps_gr_3y:        ['profitGrowth3y', 'profitGrowth3Years', 'Profit growth 3Years'],
  opm:              ['opm', 'OPM', 'operatingProfitMargin'],
  roa:              ['roa', 'ROA', 'returnOnAssets'],
  pb:               ['pb', 'PB', 'priceToBook'],
  peg:              ['peg', 'PEG', 'pegRatio'],
  int_cov:          ['interestCoverage', 'Interest Coverage Ratio'],
  promoter_holding: ['promoterHolding', 'Promoter holding'],
  pledged_pct:      ['pledgedPercentage', 'Pledged percentage'],
  promoter_chg:     ['promoterHoldingChange', 'Change in promoter holding'],
  mkt_cap:          ['marketCap', 'Market Capitalization'],
  current_price:    ['currentPrice', 'Current Price', 'price'],
  eps:              ['eps', 'EPS'],
  debt:             ['debt', 'Debt'],
  current_ratio:    ['currentRatio', 'Current ratio'],
  div_yield:        ['dividendYield', 'Dividend yield'],
  sales_gr_1y:      ['salesGrowth', 'Sales growth'],
  sales_gr_5y:      ['salesGrowth5y', 'Sales growth 5Years'],
  eps_gr_1y:        ['profitGrowth', 'Profit growth'],
  eps_gr_5y:        ['profitGrowth5y', 'Profit growth 5Years'],
  roe_3y_avg:       ['avgRoe3y', 'Average return on equity 3Years'],
  roe_5y_avg:       ['avgRoe5y', 'Average return on equity 5Years'],
  ret_1y:           ['return1y', 'Return over 1year'],
  ret_3y:           ['return3y', 'Return over 3years'],
  ret_5y:           ['return5y', 'Return over 5years'],
  ret_6m:           ['return6m', 'Return over 6months'],
  ret_3m:           ['return3m', 'Return over 3months'],
  ev_ebitda:        ['evEbitda', 'EVEBITDA'],
  industry_pe:      ['industryPE', 'Industry PE'],
  pat_qtr:          ['netProfitLatestQuarter', 'Net Profit latest quarter'],
  sales_qtr:        ['salesLatestQuarter', 'Sales latest quarter'],
  pat_annual:       ['profitAfterTax', 'Profit after tax'],
  sales_annual:     ['sales', 'Sales'],
  pat_qtr_yoy:      ['yoyQuarterlyProfitGrowth', 'YOY Quarterly profit growth'],
  sales_qtr_yoy:    ['yoyQuarterlySalesGrowth', 'YOY Quarterly sales growth'],
};

function analyzeFields(item, mode) {
  const actualKeys = Object.keys(item);
  console.log(`\n--- ${mode} MODE: ${actualKeys.length} fields returned ---`);
  console.log('All field names:', actualKeys.join(', '));
  console.log('\n--- Field Mapping Check ---');

  let matched = 0, missed = 0;
  for (const [dbField, tryKeys] of Object.entries(EXPECTED_MAPPINGS)) {
    const found = tryKeys.find(k => item[k] != null && item[k] !== '');
    if (found) {
      console.log(`  ✅ ${dbField.padEnd(18)} → matched key "${found}" = ${JSON.stringify(item[found]).slice(0, 60)}`);
      matched++;
    } else {
      // Check if any similar key exists (fuzzy)
      const lower = tryKeys.map(k => k.toLowerCase());
      const fuzzy = actualKeys.find(ak => lower.includes(ak.toLowerCase()));
      if (fuzzy) {
        console.log(`  ⚠️  ${dbField.padEnd(18)} → case-mismatch: actual="${fuzzy}" value=${JSON.stringify(item[fuzzy]).slice(0, 60)}`);
      } else {
        console.log(`  ❌ ${dbField.padEnd(18)} → NO MATCH (tried: ${tryKeys.join(', ')})`);
      }
      missed++;
    }
  }

  // Check for fields returned by actor but NOT used by the code
  const usedKeys = new Set(Object.values(EXPECTED_MAPPINGS).flat().map(k => k.toLowerCase()));
  const unused = actualKeys.filter(k => !usedKeys.has(k.toLowerCase()));
  if (unused.length) {
    console.log(`\n--- Unused fields from actor (${unused.length}) ---`);
    unused.forEach(k => console.log(`  📎 ${k} = ${JSON.stringify(item[k]).slice(0, 80)}`));
  }

  console.log(`\n--- Summary: ${matched} matched, ${missed} missed out of ${Object.keys(EXPECTED_MAPPINGS).length} fields ---`);
}

(async () => {
  try {
    // Test 1: Single stock (getstockdetails mode)
    const single = await testSingleStock('RELIANCE');
    if (single) {
      console.log('\n========== RAW RESPONSE (getstockdetails) ==========');
      console.log(JSON.stringify(single, null, 2));
      analyzeFields(single, 'getstockdetails');
    }

    // Test 2: Bulk query (runQuery mode) — this is what the cron uses
    const bulk = await testBulkQuery();
    if (bulk && bulk.length > 0) {
      console.log('\n========== RAW RESPONSE (runQuery) — first item ==========');
      console.log(JSON.stringify(bulk[0], null, 2));
      analyzeFields(bulk[0], 'runQuery');

      if (bulk.length > 1) {
        console.log(`\n(${bulk.length} total items in bulk response)`);
      }
    }

  } catch(e) {
    console.error('Test error:', e);
  }
})();
