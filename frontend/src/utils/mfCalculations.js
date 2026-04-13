import { MF_CAT } from './constants';

/**
 * Calculate annualized return (CAGR).
 */
export function mfAnn(oldNav, nav, years) {
  if (!oldNav || oldNav <= 0 || !years) return null;
  return +((Math.pow(nav / oldNav, 1 / years) - 1) * 100).toFixed(1);
}

/**
 * Calculate simple return percentage.
 */
export function mfRet(oldNav, nav) {
  if (!oldNav || oldNav <= 0) return null;
  return +(((nav - oldNav) / oldNav) * 100).toFixed(1);
}

/**
 * Calculate annualized standard deviation from NAV array.
 */
export function mfStdDev(navs) {
  if (!navs || navs.length < 10) return null;
  const dr = [];
  for (let i = 1; i < navs.length; i++) {
    dr.push((navs[i] - navs[i - 1]) / navs[i - 1]);
  }
  const mean = dr.reduce((a, b) => a + b, 0) / dr.length;
  const variance = dr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dr.length;
  return +(Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(1);
}

/**
 * Calculate maximum drawdown from NAV array.
 */
export function mfMaxDD(navs) {
  if (!navs || navs.length === 0) return 0;
  let peak = navs[0];
  let maxDD = 0;
  for (let i = 0; i < navs.length; i++) {
    if (navs[i] > peak) peak = navs[i];
    const dd = ((navs[i] - peak) / peak) * 100;
    if (dd < maxDD) maxDD = dd;
  }
  return +maxDD.toFixed(1);
}

/**
 * Score a mutual fund based on live data and fund metadata.
 * Returns { score: number, hits: { [criterion]: weight } }
 */
export function mfScore(fund, live) {
  let s = 0;
  const hits = {};
  const c1 = live.ret1y;
  const c3 = live.cagr3y;
  const c5 = live.cagr5y;
  const cat = MF_CAT[fund.cat];

  if (!cat) return { score: 0, hits: {} };

  // 1Y return
  if (c1 > 20) { s += 1.5; hits['1Y >20%'] = 1; }
  else if (c1 > 10) { s += 0.5; hits['1Y >10%'] = 0.5; }

  // 3Y CAGR vs benchmark
  if (c3 > cat.bm3 + 6) { s += 2; hits[`3Y >${cat.bm3 + 6}%`] = 1; }
  else if (c3 > cat.bm3) { s += 1; hits[`3Y >${cat.bm3}%`] = 0.5; }

  // 5Y CAGR vs benchmark
  if (c5 > cat.bm5 + 6) { s += 2; hits[`5Y >${cat.bm5 + 6}%`] = 1; }
  else if (c5 > cat.bm5) { s += 1; hits[`5Y >${cat.bm5}%`] = 0.5; }

  // 10Y
  if (live.cagr10y > cat.bm5) { s += 0.5; hits['10Y above benchmark'] = 0.5; }

  // Since inception
  if (live.cagrInc > cat.bm5) { s += 1; hits['Since inception > benchmark'] = 1; }

  // Sharpe ratio
  if (live.sharpe > 0.5) { s += 2; hits['Sharpe >0.5'] = 1; }
  else if (live.sharpe > 0) { s += 1; hits['Sharpe positive'] = 0.5; }

  // Max drawdown
  if (live.maxDD > -25) { s += 1; hits['Max drawdown <25%'] = 1; }
  else if (live.maxDD > -35) { s += 0.5; hits['Max drawdown <35%'] = 0.5; }

  // Volatility
  if (live.stdDev && live.stdDev < 18) { s += 1; hits['Low volatility <18%'] = 1; }
  else if (live.stdDev && live.stdDev < 22) { s += 0.5; hits['Volatility <22%'] = 0.5; }

  // Expense ratio
  if (fund.expense < 0.4) { s += 1.5; hits['Expense <0.4%'] = 1; }
  else if (fund.expense < 0.6) { s += 1; hits['Expense <0.6%'] = 0.5; }
  else if (fund.expense < 0.8) { s += 0.5; hits['Expense <0.8%'] = 0.5; }

  // Exit load
  if (!fund.exitLoad.match(/^2%/)) { s += 0.5; hits['Favorable exit load'] = 0.5; }

  // Min investment
  if (fund.minInvest <= 100) { s += 1; hits['Min invest <=Rs100'] = 1; }
  else if (fund.minInvest <= 1000) { s += 0.5; hits['Min invest <=Rs1K'] = 0.5; }

  // AUM sweet spot
  if (fund.aum >= 1000 && fund.aum <= 30000) { s += 1; hits['AUM sweet spot'] = 1; }
  else if (fund.aum > 30000) { s += 0.5; hits['Large established fund'] = 0.5; }

  // AUM minimum
  if (fund.aum >= 1000) { s += 0.5; hits['AUM >Rs1K Cr'] = 0.5; }

  // SEBI clean record
  if (fund.sebiClean) { s += 1; hits['Clean SEBI record'] = 1; }

  // Track record length
  if (live.pts > 1500) { s += 0.5; hits['5+ year history'] = 0.5; }
  if (live.pts > 3000) { s += 0.5; hits['10+ year history'] = 0.5; }

  return { score: +s.toFixed(1), hits };
}

/**
 * Calculate projected wealth for SIP investment.
 */
export function projectWealth(monthlySIP, cagr, years) {
  const monthlyRate = cagr / 100 / 12;
  const months = years * 12;
  if (monthlyRate === 0) return monthlySIP * months;
  return monthlySIP * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
}

/**
 * Calculate CAGR from initial and final value over given years.
 */
export function calcCAGR(initialValue, finalValue, years) {
  if (!initialValue || initialValue <= 0 || !years || years <= 0) return 0;
  return ((Math.pow(finalValue / initialValue, 1 / years) - 1) * 100);
}
