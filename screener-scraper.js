/**
 * Direct Screener.in scraper — no Apify dependency.
 * Logs in with Premium credentials, fetches company pages,
 * parses HTML tables into the same JSON shape that parseScreenerDetails() expects.
 *
 * Usage:
 *   const scraper = require('./screener-scraper');
 *   await scraper.login(username, password);
 *   const raw = await scraper.fetchCompany('RELIANCE');
 *   // raw has: company_name, industry, profit_and_loss, balance_sheet, etc.
 */

const https = require('https');
const http = require('http');

let sessionCookies = '';
let csrfToken = '';

// ── HTTP helper (follows redirects, carries cookies) ────────────────────────
function httpReq(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      ...(opts.headers || {}),
    };
    if (sessionCookies) headers['Cookie'] = sessionCookies;

    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: opts.method || 'GET',
      headers,
      timeout: 30000,
    };

    const req = mod.request(reqOpts, (res) => {
      // Collect Set-Cookie headers
      if (res.headers['set-cookie']) {
        const newCookies = res.headers['set-cookie'].map(c => c.split(';')[0]);
        const existing = sessionCookies ? sessionCookies.split('; ').filter(Boolean) : [];
        const cookieMap = {};
        [...existing, ...newCookies].forEach(c => {
          const [name] = c.split('=');
          cookieMap[name] = c;
        });
        sessionCookies = Object.values(cookieMap).join('; ');
      }

      // Follow redirects
      if ([301, 302, 303, 307].includes(res.statusCode) && res.headers.location) {
        const redir = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${parsed.protocol}//${parsed.hostname}${res.headers.location}`;
        resolve(httpReq(redir, { ...opts, method: 'GET', body: undefined }));
        return;
      }

      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// ── Login to screener.in ────────────────────────────────────────────────────
async function login(username, password) {
  if (!username || !password) throw new Error('SCREENER_USERNAME and SCREENER_PASSWORD required');

  // Step 1: GET login page to grab CSRF token
  const loginPage = await httpReq('https://www.screener.in/login/');
  const csrfMatch = loginPage.body.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/);
  if (!csrfMatch) throw new Error('Could not find CSRF token on login page');
  csrfToken = csrfMatch[1];

  // Step 2: POST login form
  const formData = `csrfmiddlewaretoken=${encodeURIComponent(csrfToken)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

  const loginResp = await httpReq('https://www.screener.in/login/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://www.screener.in/login/',
      'Origin': 'https://www.screener.in',
    },
    body: formData,
  });

  // Check if login succeeded (should redirect to dashboard or /)
  const loggedIn = sessionCookies.includes('sessionid') || loginResp.body.includes('logout');
  if (!loggedIn) {
    // Check for error message
    const errMatch = loginResp.body.match(/class="error[^"]*"[^>]*>([^<]+)/);
    throw new Error(errMatch ? `Login failed: ${errMatch[1].trim()}` : 'Login failed — check credentials');
  }

  console.log('✅ Screener.in login successful');
  return true;
}

// ── HTML table parser ───────────────────────────────────────────────────────
// Parses an HTML table into array of objects like [{Metric: "Sales", "Mar 2024": "123", ...}]
function parseTable(tableHtml) {
  const rows = [];
  // Extract header row
  const theadMatch = tableHtml.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
  const headers = [];
  if (theadMatch) {
    const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
    let m;
    while ((m = thRegex.exec(theadMatch[1])) !== null) {
      headers.push(stripHtml(m[1]).trim());
    }
  }

  // Extract body rows
  const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return rows;

  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(tbodyMatch[1])) !== null) {
    const cells = [];
    const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
      cells.push(stripHtml(tdMatch[1]).trim());
    }
    if (cells.length && headers.length) {
      const obj = {};
      // First cell = Metric name (or '' for shareholding)
      obj[headers[0] || 'Metric'] = cells[0];
      for (let i = 1; i < Math.min(cells.length, headers.length); i++) {
        obj[headers[i]] = cells[i];
      }
      rows.push(obj);
    }
  }
  return rows;
}

// Strip HTML tags and decode entities
function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Parse compounded growth section ─────────────────────────────────────────
// These appear as small inline tables like:
// "Compounded Sales Growth"  10 Years: X%  5 Years: Y%  3 Years: Z%  TTM: W%
function parseGrowthSection(html, sectionTitle) {
  const results = [];
  // Find the ranges-table containing this title (title is inside <th>)
  const sectionRegex = new RegExp(`<table[^>]*class="[^"]*ranges-table[^"]*"[^>]*>[\\s\\S]*?${sectionTitle}[\\s\\S]*?<\\/table>`, 'i');
  let match = html.match(sectionRegex);
  // Fallback: find title anywhere then grab the next table
  if (!match) {
    const fallback = new RegExp(sectionTitle + '[\\s\\S]*?(<table[^>]*>[\\s\\S]*?<\\/table>)', 'i');
    match = html.match(fallback);
    if (!match) {
      // Try: title is in a th, followed by tr rows in same table
      const altRegex = new RegExp(sectionTitle + '<\\/th>[\\s\\S]*?(<\\/table>)', 'i');
      const altMatch = html.match(new RegExp(`<table[^>]*>[\\s\\S]*?${sectionTitle}[\\s\\S]*?<\\/table>`, 'i'));
      if (altMatch) match = [altMatch[0], altMatch[0]];
    }
  }
  if (!match) return results;

  const tableHtml = match[0] || match[1];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(tableHtml)) !== null) {
    // Skip header rows (contain <th>)
    if (trMatch[1].includes('<th')) continue;
    const cells = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
      cells.push(stripHtml(tdMatch[1]).trim());
    }
    if (cells.length >= 2) {
      const label = cells[0].replace(/:$/, '').trim();
      const value = cells[1].replace('%', '').trim();
      results.push({ [label]: value });
    }
  }
  return results;
}

// ── Fetch and parse a single company page ───────────────────────────────────
async function fetchCompany(sym) {
  // Try consolidated first, fall back to standalone
  let resp = await httpReq(`https://www.screener.in/company/${sym}/consolidated/`);
  if (resp.status === 404 || resp.body.includes('Page not found')) {
    resp = await httpReq(`https://www.screener.in/company/${sym}/`);
  }
  if (resp.status !== 200) {
    throw new Error(`Failed to fetch ${sym}: HTTP ${resp.status}`);
  }

  const html = resp.body;
  const raw = {};

  // Company name
  const nameMatch = html.match(/<h1[^>]*class="[^"]*"[^>]*>([^<]+)/i)
    || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  raw.company_name = nameMatch ? stripHtml(nameMatch[1]).trim() : sym;

  // Industry / Sector — screener uses links within company-info section
  const industryMatch = html.match(/company-info[\s\S]{0,2000}?(?:Industry|Sector)\s*[:\s]*<a[^>]*>([^<]+)/i)
    || html.match(/Industry[:\s]*<a[^>]*>([^<]+)/i)
    || html.match(/Sector[:\s]*<a[^>]*>([^<]+)/i);
  raw.industry = industryMatch ? stripHtml(industryMatch[1]).trim() : null;

  // Industry PE — sometimes shown as "Industry PE" in the ratios section
  const indPeMatch = html.match(/Industry\s*PE[\s\S]{0,100}?<span[^>]*class="[^"]*number[^"]*"[^>]*>([0-9.]+)/i)
    || html.match(/Industry\s*PE[:\s]*<[^>]*>([0-9.]+)/i)
    || html.match(/Industry\s*PE[:\s]*([0-9.]+)/i);
  raw.industry_pe = indPeMatch ? parseFloat(indPeMatch[1]) : null;

  // ── Find all data sections by their IDs or headings ──

  // Quarterly results
  const qtrSection = extractSection(html, 'quarters');
  raw.quarters = qtrSection ? parseFinancialTable(qtrSection) : [];

  // Profit & Loss (annual)
  const plSection = extractSection(html, 'profit-loss');
  const plData = plSection ? parseFinancialTable(plSection) : [];

  raw.profit_and_loss = {
    annual_data: plData,
  };

  // Parse compounded growth tables from P&L section
  const plFullSection = extractFullSection(html, 'profit-loss');
  if (plFullSection) {
    raw.profit_and_loss['Compounded Sales Growth'] = parseGrowthSection(plFullSection, 'Compounded Sales Growth');
    raw.profit_and_loss['Compounded Profit Growth'] = parseGrowthSection(plFullSection, 'Compounded Profit Growth');
    raw.profit_and_loss['Stock Price CAGR'] = parseGrowthSection(plFullSection, 'Stock Price CAGR');
    raw.profit_and_loss['Return on Equity'] = parseGrowthSection(plFullSection, 'Return on Equity');
  }

  // Balance Sheet
  const bsSection = extractSection(html, 'balance-sheet');
  raw.balance_sheet = bsSection ? parseFinancialTable(bsSection) : [];

  // Cash Flow
  const cfSection = extractSection(html, 'cash-flow');
  raw.cash_flow = cfSection ? parseFinancialTable(cfSection) : [];

  // Ratios
  const ratSection = extractSection(html, 'ratios');
  raw.ratios = ratSection ? parseFinancialTable(ratSection) : [];

  // Shareholding
  const shSection = extractSection(html, 'shareholding');
  const shData = shSection ? parseFinancialTable(shSection) : [];
  raw.shareholding = { quarterly: shData };

  // Top-level metrics from the company info box
  // These are in <li> elements with <span class="name">Label</span><span class="number">Value</span>
  const topMetrics = parseTopMetrics(html);
  if (topMetrics.currentPrice) raw.current_price = topMetrics.currentPrice;
  if (topMetrics.marketCap) raw.market_cap = topMetrics.marketCap;

  return raw;
}

// ── Extract a section's table HTML by section ID ────────────────────────────
function extractSection(html, sectionId) {
  // Screener uses section IDs like id="quarters", id="profit-loss", id="balance-sheet"
  const patterns = [
    new RegExp(`id="${sectionId}"[\\s\\S]*?<table[^>]*>([\\s\\S]*?)<\\/table>`, 'i'),
    new RegExp(`id="${sectionId}"[\\s\\S]{0,500}<table[^>]*class="[^"]*data-table[^"]*"[^>]*>([\\s\\S]*?)<\\/table>`, 'i'),
  ];

  for (const pat of patterns) {
    const match = html.match(pat);
    if (match) return '<table>' + match[1] + '</table>';
  }
  return null;
}

// Extract full section HTML (not just table) for growth subsections
function extractFullSection(html, sectionId) {
  const regex = new RegExp(`id="${sectionId}"[\\s\\S]*?(?=<section|$)`, 'i');
  const match = html.match(regex);
  // Limit to next section boundary
  if (match) {
    const nextSection = match[0].indexOf('<section', 100);
    return nextSection > 0 ? match[0].slice(0, nextSection) : match[0].slice(0, 15000);
  }
  return null;
}

// ── Parse financial table with Metric column ────────────────────────────────
function parseFinancialTable(tableHtml) {
  const rows = [];

  // Get headers
  const headers = [];
  const theadMatch = tableHtml.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
  if (theadMatch) {
    const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
    let m;
    while ((m = thRegex.exec(theadMatch[1])) !== null) {
      headers.push(stripHtml(m[1]).trim());
    }
  }

  // If no thead, try first row
  if (!headers.length) {
    const firstTr = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
    if (firstTr) {
      const thRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let m;
      while ((m = thRegex.exec(firstTr[1])) !== null) {
        headers.push(stripHtml(m[1]).trim());
      }
    }
  }

  // Normalize first header to "Metric" for consistency with parseScreenerDetails
  if (headers.length) headers[0] = 'Metric';

  // Parse body rows
  const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  const bodyHtml = tbodyMatch ? tbodyMatch[1] : tableHtml;

  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  let rowIndex = 0;
  while ((trMatch = trRegex.exec(bodyHtml)) !== null) {
    // Skip if this is the header row inside tbody
    if (rowIndex === 0 && !tbodyMatch && trMatch[1].includes('<th')) { rowIndex++; continue; }

    const cells = [];
    const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
      cells.push(stripHtml(tdMatch[1]).trim());
    }

    if (cells.length >= 2) {
      const obj = {};
      for (let i = 0; i < Math.min(cells.length, headers.length); i++) {
        // For shareholding, first column header is '' (empty)
        obj[headers[i] || ''] = cells[i];
      }
      rows.push(obj);
    }
    rowIndex++;
  }

  return rows;
}

// ── Parse top-level metrics (market cap, price, PE etc.) ────────────────────
function parseTopMetrics(html) {
  const metrics = {};
  // Extract the top-ratios section first to narrow scope
  const ratiosSection = html.match(/id="top-ratios"[\s\S]*?<\/ul>/i);
  const searchHtml = ratiosSection ? ratiosSection[0] : html;

  // Match <li> with <span class="name"> and <span class="nowrap value"> (with generous whitespace)
  const liRegex = /<li[^>]*>[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span[^>]*class="[^"]*(?:number|value|nowrap)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  let m;
  while ((m = liRegex.exec(searchHtml)) !== null) {
    const label = stripHtml(m[1]).toLowerCase().trim();
    const valueHtml = m[2];
    // Extract number from nested <span class="number"> if present
    const numMatch = valueHtml.match(/<span[^>]*class="[^"]*number[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const value = numMatch ? stripHtml(numMatch[1]).replace(/[₹,]/g, '').trim()
                           : stripHtml(valueHtml).replace(/[₹,]/g, '').replace(/Cr\.?/g, '').trim();
    const numVal = parseFloat(value) || null;
    if (label.includes('market cap')) metrics.marketCap = numVal;
    if (label.includes('current price')) metrics.currentPrice = numVal;
    if (label.includes('book value')) metrics.bookValue = numVal;
    if (label.includes('stock p/e') || label === 'p/e') metrics.pe = numVal;
    if (label.includes('dividend yield')) metrics.divYield = numVal;
    if (label.includes('roce')) metrics.roce = numVal;
    if (label.includes('roe') && !label.includes('roce')) metrics.roe = numVal;
    if (label.includes('face value')) metrics.faceValue = parseFloat(value) || null;
  }
  return metrics;
}

// ── Export CSV from screener.in screen query ─────────────────────────────────
async function exportScreenCSV(query) {
  // Hit the screen export endpoint
  const encodedQuery = encodeURIComponent(query || 'Market Capitalization > 0');
  const url = `https://www.screener.in/screens/raw/?sort=&order=&source=&query=${encodedQuery}&limit=&page=&format=csv`;

  const resp = await httpReq(url, {
    headers: {
      'Accept': 'text/csv,application/csv,*/*',
      'Referer': 'https://www.screener.in/screens/',
    },
  });

  if (resp.status !== 200) {
    throw new Error(`CSV export failed: HTTP ${resp.status}`);
  }

  return resp.body;
}

// ── Batch fetch all stocks ──────────────────────────────────────────────────
async function fetchAll(symbols, { batchSize = 3, delayMs = 2000, onProgress } = {}) {
  const results = { imported: 0, errors: 0, total: symbols.length, details: [] };

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(async sym => {
      const raw = await fetchCompany(sym);
      return { sym, raw };
    }));

    for (const r of settled) {
      if (r.status === 'fulfilled') {
        results.imported++;
        results.details.push({ sym: r.value.sym, ok: true, raw: r.value.raw });
      } else {
        results.errors++;
        results.details.push({ sym: batch[settled.indexOf(r)], ok: false, error: r.reason?.message });
      }
    }

    if (onProgress) onProgress(results);

    // Rate limit
    if (i + batchSize < symbols.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return results;
}

// ── Check if session is still valid ─────────────────────────────────────────
async function isLoggedIn() {
  if (!sessionCookies.includes('sessionid')) return false;
  try {
    const resp = await httpReq('https://www.screener.in/dash/');
    return resp.status === 200 && !resp.body.includes('/login/');
  } catch { return false; }
}

module.exports = {
  login,
  fetchCompany,
  fetchAll,
  exportScreenCSV,
  isLoggedIn,
  parseFinancialTable,
  stripHtml,
  _getCookies: () => sessionCookies,
};
