import React, { useEffect, useState, useCallback } from 'react';
import { useMfStore } from '../../store/useMfStore';
import { MF_CAT } from '../../utils/constants';
import LoadingSkeleton from '../shared/LoadingSkeleton';
import EmptyState from '../shared/EmptyState';
import { formatPercent, timeAgo } from '../../utils/formatters';

/* ---------- helpers ---------- */
function rv(v, dec) {
  if (v == null || v === undefined) return <span style={{ color: 'var(--text4)' }}>-</span>;
  const n = parseFloat(v);
  if (isNaN(n)) return <span style={{ color: 'var(--text4)' }}>-</span>;
  return n.toFixed(dec != null ? dec : 1);
}
function rc(v) {
  if (v == null || v === undefined) return <span style={{ color: 'var(--text4)', fontSize: 10 }}>no data</span>;
  const n = parseFloat(v);
  if (isNaN(n)) return <span style={{ color: 'var(--text4)', fontSize: 10 }}>no data</span>;
  return <span style={{ color: n >= 0 ? 'var(--green)' : 'var(--red)' }}>{n >= 0 ? '+' : ''}{n.toFixed(1)}%</span>;
}
function rsh(v) {
  if (v == null) return <span style={{ color: 'var(--text4)' }}>-</span>;
  const n = parseFloat(v);
  if (isNaN(n)) return <span style={{ color: 'var(--text4)' }}>-</span>;
  const c = n > 0 ? 'var(--green)' : n > -0.3 ? 'var(--amber)' : 'var(--red)';
  return <span style={{ color: c, fontWeight: 600 }}>{n.toFixed(3)}</span>;
}
function rpct(v) {
  if (v == null) return <span style={{ color: 'var(--text4)' }}>-</span>;
  const n = parseFloat(v);
  if (isNaN(n)) return <span style={{ color: 'var(--text4)' }}>-</span>;
  if (n === 0) return <span style={{ color: 'var(--text4)' }}>0%</span>;
  return `${n.toFixed(1)}%`;
}
function rvc(v) {
  if (v == null) return <span style={{ color: 'var(--text4)' }}>-</span>;
  const n = parseFloat(v);
  if (isNaN(n) || n === 0) return <span style={{ color: 'var(--text4)' }}>-</span>;
  return <span style={{ color: n >= 1 ? 'var(--green)' : 'var(--red)' }}>{n.toFixed(2)}x</span>;
}
function fmtWealth(n) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

/* ---------- MiroFish Projection Card ---------- */
function MiroFishProjection({ fund, rank, cfg }) {
  const predictFund = useMfStore((s) => s.predictFund);
  const predictionCache = useMfStore((s) => s.predictionCache);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const key = fund.name + '-' + rank;
  useEffect(() => {
    if (predictionCache[key]) {
      setPrediction(predictionCache[key]);
      setLoading(false);
      return;
    }
    const delay = (rank - 1) * 2000;
    const timer = setTimeout(async () => {
      try {
        const result = await predictFund({ ...fund, rank });
        if (result && !result.error) setPrediction(result);
        else setError(result?.error || 'Failed');
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [fund.name, rank]);

  const horizons = prediction ? [
    { yr: '7Y', cagr: prediction.cagr_7y || prediction.adjusted_cagr },
    { yr: '10Y', cagr: prediction.cagr_10y || (prediction.adjusted_cagr || 12) * 0.97 },
    { yr: '20Y', cagr: prediction.cagr_20y || (prediction.adjusted_cagr || 12) * 0.88 },
    { yr: '30Y', cagr: prediction.cagr_30y || (prediction.adjusted_cagr || 12) * 0.80 },
    { yr: '40Y', cagr: prediction.cagr_40y || (prediction.adjusted_cagr || 12) * 0.75 },
  ] : [];

  return (
    <div style={{ marginTop: 12, borderTop: `1px solid ${cfg.color}30`, paddingTop: 12 }}>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--purple-text)' }}>MiroFish -- Rs1 Lakh invested</span>
        <span style={{ fontSize: 10, color: 'var(--text4)' }}>
          {loading ? 'Analyzing...' : prediction ? `55 data points -- ${prediction.confidence || ''} confidence` : 'Failed'}
        </span>
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 8 }}>
        {['7Y', '10Y', '20Y', '30Y', '40Y'].map((yr, i) => {
          const h = horizons[i];
          const projected = h ? Math.round(100000 * Math.pow(1 + (h.cagr || 12) / 100, parseInt(yr))) : null;
          return (
            <div key={yr} style={{
              background: prediction ? 'var(--purple-bg)' : 'var(--purple-bg)',
              border: '1px solid ' + (prediction ? 'var(--tier-accumulate-border)' : 'var(--purple-bg)'),
              borderRadius: 6, padding: '6px 4px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>{yr}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: prediction ? 'var(--purple-text)' : 'var(--text4)' }}>
                {projected ? fmtWealth(projected) : '...'}
              </div>
              {h && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{(h.cagr || 0).toFixed(1)}%/yr</div>}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: error ? 'var(--red)' : 'var(--text2)', lineHeight: 1.5, minHeight: 28 }}>
        {loading ? 'Fetching MiroFish prediction...' : error ? (
          error.includes('ANTHROPIC') ? 'Set ANTHROPIC_API_KEY in Railway env vars' : `Error: ${error}`
        ) : prediction ? (
          <>
            <span style={{ color: 'var(--purple-text)', fontWeight: 700 }}>MiroFish </span>
            {prediction.prediction}
            {prediction.key_driver && <><br /><span style={{ color: 'var(--green)', fontSize: 10 }}>Up: {prediction.key_driver}</span></>}
            {prediction.main_risk && <><br /><span style={{ color: 'var(--red)', fontSize: 10 }}>Down: {prediction.main_risk}</span></>}
            {prediction.verdict && <><br /><span style={{ fontSize: 10, color: 'var(--text3)' }}>Verdict: {prediction.verdict}</span></>}
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- Fund Card ---------- */
function FundCard({ fund, rank, cfg, maxScore }) {
  const f = fund;
  const pct = maxScore > 0 ? Math.round((f.score || 0) / maxScore * 100) : 0;
  const isTop1 = rank === 1;
  const isTop2 = rank === 2;
  const [showDetails, setShowDetails] = useState(false);

  const sebiColor = f.amc_sebi === 'probe' ? 'var(--red)' : f.amc_sebi === 'action' ? 'var(--red)' : f.amc_sebi === 'minor' ? 'var(--amber)' : 'var(--green)';
  const sebiTxt = f.amc_sebi === 'probe' ? 'Investigation' : f.amc_sebi === 'action' ? 'Past Action' : f.amc_sebi === 'minor' ? 'Minor Fine' : 'SEBI Clean';
  const exp = parseFloat(f.expense_ratio) || 0;
  const sharpe = parseFloat(f.sharpe);
  const sortino = parseFloat(f.sortino);
  const mdd = parseFloat(f.maxDD || f.max_drawdown);
  const vol = parseFloat(f.stdDev || f.volatility);
  const aumStr = f.aum_cr && f.aum_cr > 0 ? (f.aum_cr >= 1000 ? `₹${Math.round(f.aum_cr / 1000)}K Cr` : `₹${Math.round(f.aum_cr)} Cr`) : '-';
  const hits = f.hits || {};
  const topHits = Object.keys(hits).filter((k) => hits[k] > 0).slice(0, 5);

  const rankLabel = rank === 1 ? 'Top pick' : rank === 2 ? 'Runner up' : rank === 3 ? 'Third' : `Rank #${rank}`;
  const aumStrClean = aumStr.replace('Rs', '₹');

  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: 18,
      position: 'relative',
      boxShadow: isTop1 ? 'var(--shadow-md)' : 'var(--shadow-sm)',
      overflow: 'hidden',
    }}>
      {/* Premium gradient border for top picks */}
      {isTop1 && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 'var(--radius-lg)',
          padding: 1.5,
          background: 'linear-gradient(135deg, var(--brand) 0%, var(--purple) 100%)',
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          pointerEvents: 'none',
        }} />
      )}

      {/* Top ribbon: rank chip (left) — no more collision with score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px',
          borderRadius: 'var(--radius-full)',
          background: isTop1 ? 'var(--brand-gradient)' : isTop2 ? 'var(--brand-bg-strong)' : 'var(--bg3)',
          color: isTop1 ? '#fff' : isTop2 ? 'var(--brand-text)' : 'var(--text2)',
          fontSize: 12, fontWeight: 700, letterSpacing: '-0.1px',
        }}>
          <span style={{ fontSize: 11, opacity: 0.9 }}>#{rank}</span>
          <span style={{ opacity: 0.25 }}>•</span>
          <span>{rankLabel}</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: sebiColor,
            padding: '3px 8px',
            background: f.amc_sebi === 'probe' || f.amc_sebi === 'action' ? 'var(--red-bg)' : f.amc_sebi === 'minor' ? 'var(--amber-bg)' : 'var(--green-bg)',
            borderRadius: 6,
          }}>{sebiTxt}</span>
        </div>
      </div>

      {/* DNI banner */}
      {f.dni && (
        <div style={{
          background: f.dni.level === 'red' ? 'var(--red-bg)' : 'var(--amber-bg)',
          border: `1px solid ${f.dni.level === 'red' ? 'var(--tier-avoid-border)' : 'var(--tier-accumulate-border)'}`,
          borderRadius: 10, padding: '10px 12px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: f.dni.level === 'red' ? 'var(--red-text)' : 'var(--amber-text)', marginBottom: 4 }}>
            {f.dni.short}
          </div>
          <div style={{ fontSize: 12, color: f.dni.level === 'red' ? 'var(--red-text)' : 'var(--amber-text)', lineHeight: 1.5, opacity: 0.9 }}>{f.dni.reason}</div>
        </div>
      )}

      {/* Watchlist badge */}
      {f.watchlist && !f.dni && (
        <div style={{ background: 'var(--blue-bg)', border: '1px solid var(--tier-buy-border)', borderRadius: 10, padding: '8px 12px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--blue-text)', lineHeight: 1.45, fontWeight: 500 }}>
            Watchlist — Fund AUM &lt; ₹5,000 Cr. Strong numbers but unproven at scale.
          </div>
        </div>
      )}

      {f.amc_warning && (
        <div style={{ background: 'var(--red-bg)', border: '1px solid var(--tier-avoid-border)', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: 'var(--red-text)', marginBottom: 12, lineHeight: 1.45 }}>{f.amc_warning}</div>
      )}

      {/* Header: name on left, big score on right */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.25, color: 'var(--text)', marginBottom: 4 }}>
            {f.name || ''}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.4 }}>
            {f.amc || ''}{f.navFormatted ? ` · ${f.navFormatted.replace('Rs', '₹').replace('rs', '₹')}` : ''}{aumStrClean !== '-' ? ` · ${aumStrClean}` : ''}
          </div>
          {f.rolling_3y != null && parseFloat(f.rolling_3y) > 0 && (
            <div style={{ marginTop: 6, fontSize: 12 }}>
              <span style={{ color: 'var(--text3)' }}>Roll 3Y </span>
              <span style={{ color: 'var(--green-text)', fontWeight: 600 }}>+{parseFloat(f.rolling_3y).toFixed(1)}%</span>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: 36, fontWeight: 800, lineHeight: 1,
            color: cfg.color,
            letterSpacing: '-1px',
            fontVariantNumeric: 'tabular-nums',
          }}>{f.score || 0}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontWeight: 500 }}>/ 100 pts</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: isTop1 ? 'var(--brand-gradient)' : cfg.color,
          borderRadius: 4,
        }} />
      </div>

      {/* Returns grid */}
      <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
        {[['1Y', f.ret_1y], ['3Y p.a.', f.cagr_3y], ['5Y p.a.', f.cagr_5y], ['10Y p.a.', f.cagr_10y]].map(([label, val]) => {
          const n = parseFloat(val);
          const hasData = val != null && !isNaN(n);
          return (
            <div key={label} style={{
              background: 'var(--bg3)',
              borderRadius: 8, padding: '8px 6px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3, fontWeight: 500 }}>{label}</div>
              <div style={{
                fontWeight: 700,
                color: hasData ? (n >= 0 ? 'var(--green-text)' : 'var(--red-text)') : 'var(--text4)',
                fontSize: hasData ? 14 : 11,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {hasData ? `${n >= 0 ? '+' : ''}${n.toFixed(1)}%` : 'no data'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Metrics grid */}
      <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        {[
          ['Sharpe', isNaN(sharpe) ? '-' : sharpe.toFixed(2), isNaN(sharpe) ? '' : sharpe > 0 ? 'var(--green-text)' : sharpe > -0.3 ? 'var(--amber-text)' : 'var(--red-text)'],
          ['Sortino', isNaN(sortino) ? '-' : sortino.toFixed(2), isNaN(sortino) ? '' : sortino > 0 ? 'var(--green-text)' : 'var(--red-text)'],
          ['Max DD', isNaN(mdd) ? '-' : `${mdd.toFixed(1)}%`, 'var(--red-text)'],
          ['Volatility', isNaN(vol) ? '-' : `${vol.toFixed(1)}%`, 'var(--text)'],
          ['Expense', isNaN(exp) ? '-' : `${exp.toFixed(2)}%`, isNaN(exp) ? '' : exp < 0.5 ? 'var(--green-text)' : exp > 1 ? 'var(--red-text)' : 'var(--text)'],
          ['AUM', aumStrClean, 'var(--text)'],
        ].map(([label, val, col]) => (
          <div key={label} style={{
            background: 'var(--bg3)',
            borderRadius: 8, padding: '7px 9px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4,
          }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', color: col || 'var(--text)' }} className="tabular-nums">{val}</span>
          </div>
        ))}
      </div>

      {/* AMC note */}
      {f.amc_note && (
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, lineHeight: 1.5, borderLeft: '3px solid var(--border2)', paddingLeft: 10 }}>{f.amc_note}</div>
      )}

      {/* Top scoring tags */}
      {topHits.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {topHits.map((h) => (
            <span key={h} style={{
              background: cfg.bg, color: cfg.color,
              borderRadius: 6, padding: '3px 8px',
              fontSize: 11, fontWeight: 600,
            }}>{h}</span>
          ))}
        </div>
      )}

      {/* Scoring details */}
      <details>
        <summary style={{
          fontSize: 12, color: 'var(--text2)',
          cursor: 'pointer', padding: '4px 0',
          fontWeight: 500,
        }}>All scoring reasons</summary>
        <div className="grid gap-1 mt-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {Object.entries(hits).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2" style={{ fontSize: 12, padding: '2px 0' }}>
              <span style={{ fontWeight: 600, flexShrink: 0, color: v > 0 ? 'var(--green-text)' : v === 0 ? 'var(--amber-text)' : 'var(--red-text)' }}>{v > 0 ? '✓' : v === 0 ? '•' : '✗'}</span>
              <span style={{ color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</span>
              <span style={{ color: 'var(--text3)', marginLeft: 'auto', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
            </div>
          ))}
        </div>
      </details>

      {/* MiroFish projection for top 3 */}
      {rank <= 3 && <MiroFishProjection fund={f} rank={rank} cfg={cfg} />}
    </div>
  );
}

/* ---------- Column group definitions for full table ---------- */
const COL_GROUPS = [
  { label: 'IDENTITY', color: 'var(--text3)', cols: ['#', 'Fund', 'AMC', 'NAV', 'AUM Cr', 'Exp%', 'Min Rs', 'Min SIP', 'Exit Load', 'Inception', 'Fund Manager'] },
  { label: 'RETURNS', color: 'var(--green)', cols: ['1Y%', '3M%', '6M%', '3Y CAGR', '5Y CAGR', '10Y CAGR', 'Roll 3Y'] },
  { label: 'vs CATEGORY', color: 'var(--teal)', cols: ['vs Cat 1Y%', 'vs Cat 3Y', 'vs Cat 5Y', 'vs Cat 10Y'] },
  { label: 'RISK', color: 'var(--red)', cols: ['Sharpe', 'Sortino', 'Volatility', 'Cat StdDev', 'Max DD', 'From ATH'] },
  { label: 'PORTFOLIO', color: 'var(--text3)', cols: ['PE', 'Cat PE', 'Equity%', 'LgCap%', 'MidCap%', 'SmCap%', 'Cash%', 'Debt%'] },
  { label: 'CONCENTRATION', color: 'var(--text3)', cols: ['Top3%', 'Top5%', 'Top10%'] },
  { label: 'SCORE', color: 'var(--blue)', cols: ['SEBI', 'Score'] },
];

function buildGroupEndSet() {
  const s = new Set();
  let idx = 0;
  COL_GROUPS.forEach((g) => { idx += g.cols.length; s.add(idx - 1); });
  return s;
}

/* ---------- MF Full Table ---------- */
function MFTable({ funds, cfg, cat }) {
  const [showAll, setShowAll] = useState(false);
  const TABLE_INITIAL = 10;
  const groupEnds = buildGroupEndSet();
  const visibleFunds = showAll ? funds : funds.slice(0, TABLE_INITIAL);
  const eligibleFunds = funds.filter((f) => f.eligible !== false);

  function getCellValue(f, colIdx) {
    const isEligible = f.eligible !== false;
    let eligibleRank = 0;
    if (isEligible) eligibleFunds.forEach((ef, ei) => { if (ef.name === f.name) eligibleRank = ei + 1; });
    const isTop = isEligible && eligibleRank <= 5;
    const exp2 = parseFloat(f.expense_ratio) || 0;
    const pe = parseFloat(f.pe_ratio) || 0;
    const catPE = parseFloat(f.category_pe) || 30;
    const cash = parseFloat(f.pct_cash) || 0;
    const top10 = parseFloat(f.top10_conc) || 0;
    const ath = parseFloat(f.pct_from_ath) || 0;
    const idx = colIdx; // global column index

    switch (idx) {
      case 0: return { align: 'left', val: funds.indexOf(f) + 1, style: { color: 'var(--text3)', fontWeight: 600 } };
      case 1: return { align: 'left', val: f.name, style: { fontWeight: isTop ? 600 : 400, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' } };
      case 2: return { align: 'left', val: (f.amc || '').split(' ')[0], style: { color: 'var(--text2)' } };
      case 3: return { align: 'right', val: f.navFormatted || '-', style: { fontFamily: 'monospace' } };
      case 4: return { align: 'right', val: f.aum_cr ? Math.round(f.aum_cr).toLocaleString('en-IN') : '-' };
      case 5: return { align: 'right', val: exp2 ? `${exp2.toFixed(2)}%` : '-', style: { color: exp2 < 0.5 ? 'var(--green)' : exp2 > 1 ? 'var(--red)' : undefined } };
      case 6: return { align: 'right', val: f.min_lumpsum ? `₹${Math.round(f.min_lumpsum).toLocaleString('en-IN')}` : '-' };
      case 7: return { align: 'right', val: f.min_sip && f.min_sip > 0 ? `₹${Math.round(f.min_sip)}` : '-' };
      case 8: return { align: 'right', val: `${rv(f.exit_load, 0)}%` };
      case 9: return { align: 'right', val: f.months_inception ? `${Math.round(f.months_inception)} mo` : '-' };
      case 10: return { align: 'left', val: f.fund_manager || '-', style: { color: 'var(--text2)', fontSize: 10, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' } };
      case 11: return { align: 'right', node: rc(f.ret_1y) };
      case 12: return { align: 'right', node: rc(f.ret_3m) };
      case 13: return { align: 'right', node: rc(f.ret_6m) };
      case 14: return { align: 'right', node: rc(f.cagr_3y) };
      case 15: return { align: 'right', node: rc(f.cagr_5y) };
      case 16: return { align: 'right', node: rc(f.cagr_10y) };
      case 17: return { align: 'right', node: rc(f.rolling_3y), style: { fontWeight: 600 } };
      case 18: return { align: 'right', node: rvc(f.vs_cat_1y) };
      case 19: return { align: 'right', node: rvc(f.vs_cat_3y) };
      case 20: return { align: 'right', node: rvc(f.vs_cat_5y) };
      case 21: return { align: 'right', node: rvc(f.vs_cat_10y) };
      case 22: return { align: 'right', node: rsh(f.sharpe) };
      case 23: return { align: 'right', node: rsh(f.sortino) };
      case 24: return { align: 'right', val: `${rv(f.volatility, 2)}%` };
      case 25: return { align: 'right', val: `${rv(f.category_stddev, 2)}%`, style: { color: 'var(--text3)' } };
      case 26: return { align: 'right', val: `${rv(f.maxDD || f.max_drawdown, 1)}%`, style: { color: 'var(--red)' } };
      case 27: return { align: 'right', val: `${rv(ath, 1)}%`, style: { color: ath < 10 ? 'var(--green)' : ath < 20 ? 'var(--amber)' : 'var(--red)' } };
      case 28: return { align: 'right', val: pe ? pe.toFixed(1) : '-', style: { color: pe > 0 && pe < catPE * 0.9 ? 'var(--green)' : pe > catPE * 1.1 ? 'var(--red)' : undefined } };
      case 29: return { align: 'right', val: rv(f.category_pe, 1), style: { color: 'var(--text3)' } };
      case 30: return { align: 'right', val: rpct(f.pct_equity) };
      case 31: return { align: 'right', val: rpct(f.pct_largecap) };
      case 32: return { align: 'right', val: rpct(f.pct_midcap) };
      case 33: return { align: 'right', val: rpct(f.pct_smallcap) };
      case 34: return { align: 'right', val: rpct(cash), style: { color: cash >= 3 && cash <= 10 ? 'var(--green)' : cash > 15 ? 'var(--red)' : undefined } };
      case 35: return { align: 'right', val: rpct(f.pct_debt) };
      case 36: return { align: 'right', val: `${rv(f.top3_conc, 1)}%` };
      case 37: return { align: 'right', val: `${rv(f.top5_conc, 1)}%` };
      case 38: return { align: 'right', val: `${rv(top10, 1)}%`, style: { color: top10 < 45 ? 'var(--green)' : top10 > 65 ? 'var(--red)' : 'var(--amber)' } };
      case 39: return { align: 'center', val: isEligible ? (f.amc_sebi === 'probe' ? 'X' : f.amc_sebi === 'action' ? '!' : f.amc_sebi === 'minor' ? '!' : 'OK') : '-', style: { fontSize: 10 } };
      case 40: {
        const scoreVal = isEligible
          ? (f.dni ? `${f.dni.level === 'red' ? 'X' : '!'} ${f.score}` : f.score)
          : (f.filter_reasons && f.filter_reasons[0] ? f.filter_reasons[0] : 'Not eligible');
        return { align: 'right', val: scoreVal, style: {
          fontWeight: isEligible ? 700 : 400,
          fontSize: isEligible ? 13 : 10,
          color: isEligible ? (f.dni ? (f.dni.level === 'red' ? 'var(--red)' : 'var(--amber)') : cfg.color) : 'var(--text4)',
        }};
      }
      default: return { val: '' };
    }
  }

  let colIdx = 0;
  const allCols = COL_GROUPS.flatMap((g) => g.cols);

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
        {funds.length} total funds -- <b>{eligibleFunds.length} eligible</b> (AUM &gt;=Rs1K Cr, age &gt;=5Y, 3Y data) -- scroll right for all columns
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11, whiteSpace: 'nowrap', minWidth: 2800, width: '100%' }}>
          <thead>
            <tr>
              {COL_GROUPS.map((g) => (
                <th key={g.label} colSpan={g.cols.length} style={{
                  background: 'var(--bg3)', color: g.color, fontSize: 10, letterSpacing: '.8px',
                  textAlign: 'center', padding: '4px 8px', borderBottom: '1px solid var(--border)',
                  borderRight: '2px solid var(--bg4)',
                }}>{g.label}</th>
              ))}
            </tr>
            <tr>
              {allCols.map((h, i) => {
                const isHash = i === 0, isFund = i === 1;
                return (
                  <th key={i} style={{
                    padding: '5px 8px', textAlign: i < 2 ? 'left' : 'right',
                    background: 'var(--bg3)', color: 'var(--text3)', fontWeight: 600, fontSize: 10,
                    borderBottom: '2px solid var(--bg4)',
                    ...(isHash ? { position: 'sticky', left: 0, zIndex: 5, minWidth: 44, width: 44 } : {}),
                    ...(isFund ? { position: 'sticky', left: 44, zIndex: 5, minWidth: 200 } : {}),
                    ...(groupEnds.has(i) ? { borderRight: '2px solid var(--bg4)' } : {}),
                    ...(!isHash && !isFund ? { minWidth: 78 } : {}),
                  }}>{h}</th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleFunds.map((f, fi) => {
              const isEligible = f.eligible !== false;
              let eligibleRank = 0;
              if (isEligible) eligibleFunds.forEach((ef, ei) => { if (ef.name === f.name) eligibleRank = ei + 1; });
              const isTop = isEligible && eligibleRank <= 5;
              const rowBg = isTop ? 'var(--bg2)' : 'var(--bg)';
              return (
                <tr key={fi} style={{ opacity: isEligible ? 1 : 0.45, borderLeft: isTop ? `3px solid ${cfg.color}` : undefined, borderBottom: '1px solid var(--border2)' }}>
                  {allCols.map((_, ci) => {
                    const cell = getCellValue(f, ci);
                    const isHash = ci === 0, isFund = ci === 1;
                    return (
                      <td key={ci} style={{
                        padding: '5px 8px',
                        textAlign: cell.align || 'right',
                        ...(cell.style || {}),
                        ...(isHash ? { position: 'sticky', left: 0, zIndex: 3, background: rowBg, borderRight: '1px solid var(--border2)' } : {}),
                        ...(isFund ? { position: 'sticky', left: 44, zIndex: 3, background: rowBg, borderRight: '2px solid var(--bg4)' } : {}),
                        ...(groupEnds.has(ci) ? { borderRight: '2px solid var(--bg4)' } : {}),
                      }} className="tabular-nums">
                        {cell.node || cell.val}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {funds.length > TABLE_INITIAL && (
        <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
          <span onClick={() => setShowAll(!showAll)} style={{
            cursor: 'pointer', fontSize: 11, color: cfg.color, fontWeight: 600,
            padding: '5px 22px', border: `1px solid ${cfg.color}60`, borderRadius: 20,
            display: 'inline-block', background: 'var(--bg2)',
          }}>
            {showAll ? 'Show less' : `Show ${funds.length - TABLE_INITIAL} more`} {showAll ? '\u25B4' : '\u25BE'}
          </span>
        </div>
      )}
    </div>
  );
}

/* ---------- DNI Section ---------- */
function DNISection({ funds }) {
  const [expanded, setExpanded] = useState(false);
  const DNI_INITIAL = 5;
  const sorted = [...funds].sort((a, b) => {
    const lvl = { red: 0, amber: 1 };
    return (lvl[a.dni?.level] || 2) - (lvl[b.dni?.level] || 2);
  });
  const visible = expanded ? sorted : sorted.slice(0, DNI_INITIAL);

  return (
    <div style={{
      marginBottom: 28,
      border: '1px solid var(--tier-avoid-border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      background: 'var(--bg2)',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 20px',
        background: 'var(--red-bg)',
        borderBottom: '1px solid var(--tier-avoid-border)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'var(--red)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800,
        }}>!</div>
        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--red-text)', letterSpacing: '-0.2px' }}>Do Not Invest</span>
        <span style={{
          fontSize: 12, color: 'var(--red-text)',
          background: 'rgba(239,68,68,0.15)',
          padding: '3px 10px', borderRadius: 'var(--radius-full)', fontWeight: 600,
        }}>{sorted.length} flagged</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--bg3)' }}>
            <th style={{ padding: '10px 20px', textAlign: 'left', color: 'var(--text3)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Fund</th>
            <th style={{ padding: '10px 20px', textAlign: 'left', color: 'var(--text3)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Category</th>
            <th style={{ padding: '10px 20px', textAlign: 'left', color: 'var(--text3)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Reason</th>
            <th style={{ padding: '10px 20px', textAlign: 'right', color: 'var(--text3)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Score</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((f, i) => {
            const lvlColor = f.dni?.level === 'red' ? 'var(--red-text)' : 'var(--amber-text)';
            return (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text)' }}>{f.name}</td>
                <td style={{ padding: '12px 20px', color: 'var(--text2)', fontSize: 13 }}>{MF_CAT[f._cat]?.label}</td>
                <td style={{ padding: '12px 20px', color: lvlColor, fontSize: 13, lineHeight: 1.45 }}>{f.dni?.reason}</td>
                <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 800, color: lvlColor, fontVariantNumeric: 'tabular-nums', fontSize: 16 }}>{Math.round(f.score || 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length > DNI_INITIAL && (
        <div style={{ textAlign: 'center', padding: 14, background: 'var(--bg2)', borderTop: '1px solid var(--border)' }}>
          <button onClick={() => setExpanded(!expanded)} style={{
            fontSize: 13, color: 'var(--red-text)', fontWeight: 600,
            cursor: 'pointer', padding: '8px 20px',
            background: 'transparent',
            border: '1px solid var(--tier-avoid-border)',
            borderRadius: 'var(--radius)',
            fontFamily: 'inherit',
          }}>
            {expanded ? 'Show less' : `Show all ${sorted.length - DNI_INITIAL} more flagged funds`}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Scoring Methodology ---------- */
const METHODOLOGY = [
  ['Rolling 3Y Return', '20 pts', 'Best consistency signal - not just point-in-time returns', 'Tickertape'],
  ['Returns vs Category', '20 pts', '3Y + 5Y ratio vs sub-category median - beating peers', 'Tickertape'],
  ['Sharpe + Sortino', '15 pts', 'Risk-adjusted return - percentile rank within category', 'Tickertape'],
  ['Downside Protection', '15 pts', 'Max drawdown + volatility - both percentile vs peers', 'Tickertape'],
  ['Absolute Returns', '10 pts', '3Y + 5Y CAGR percentile rank within category', 'Tickertape'],
  ['Portfolio Quality', '8 pts', 'PE vs category, cash 3-10%, top10 concentration', 'Tickertape'],
  ['Cost Efficiency', '7 pts', 'Expense ratio + min lumpsum + min SIP', 'Tickertape'],
  ['AUM Quality', '5 pts', 'Rs2K-30K Cr sweet spot - not too small, not too big', 'Tickertape'],
  ['Track Record', '3 pts', 'Months since inception - min 3Y, ideal 10Y+', 'Tickertape'],
  ['AMC Quality', '10 pts', 'Governance, SEBI record, team depth, ownership', 'Research Apr 2026'],
];

function ScoringMethodology() {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 14, background: 'var(--bg2)', marginTop: 8 }}>
      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
        <div style={{ fontWeight: 600, fontSize: 12 }}>Scoring Methodology - 100 Points</div>
        <div style={{ fontSize: 10, color: 'var(--text3)' }}>Source: Tickertape screener - Apr 4 2026 -- All scoring is percentile-based within category</div>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {METHODOLOGY.map(([name, pts, desc, src]) => (
          <div key={name} style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '8px 10px', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-baseline mb-0.5">
              <span style={{ fontWeight: 600, fontSize: 11 }}>{name}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)' }}>{pts}</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 2 }}>{desc}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>{src}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text3)' }}>
        Quant funds capped at 15/100 (active SEBI investigation) -- Minor past SEBI action -- Clean record -- Not SEBI registered investment advice
      </div>
    </div>
  );
}

/* ========== MAIN MF PAGE ========== */
export default function MFPage() {
  const { funds, loading, error, total, fetchFunds, refreshFunds } = useMfStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchFunds(); }, [fetchFunds]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshFunds();
    setRefreshing(false);
  };

  // Group funds by category
  const grouped = { smallcap: [], midcap: [], flexicap: [] };
  if (funds && Array.isArray(funds)) {
    funds.forEach((f) => {
      if (f && f.cat && grouped[f.cat]) grouped[f.cat].push(f);
    });
    Object.keys(grouped).forEach((cat) => {
      grouped[cat].sort((a, b) => (b.score || 0) - (a.score || 0));
    });
  }

  // Collect DNI funds
  const allDni = [];
  Object.keys(grouped).forEach((cat) => {
    grouped[cat].forEach((f) => {
      if (f.dni) allDni.push({ ...f, _cat: cat });
    });
  });

  if (loading && !funds) {
    return (
      <div className="animate-fadeIn" style={{ textAlign: 'center', padding: '60px 0' }}>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>Loading fund data...</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 16 }}>Tickertape Apr 2026 -- scoring in progress</div>
        <div style={{ marginTop: 16, height: 3, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden', maxWidth: 300, margin: '0 auto' }}>
          <div className="animate-shimmer" style={{ height: '100%', background: 'var(--green)', borderRadius: 2, width: '100%', opacity: 0.6 }} />
        </div>
      </div>
    );
  }

  if (error && !funds) {
    return (
      <div className="animate-fadeIn" style={{ textAlign: 'center', padding: '60px 0' }}>
        <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{error}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 16 }}>Check Railway logs for MF refresh errors</div>
        <button onClick={fetchFunds} style={{ padding: '6px 14px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}>
          Retry
        </button>
      </div>
    );
  }

  const categories = ['smallcap', 'midcap', 'flexicap'];

  // Find top 3 across all categories for hero
  const allEligible = [];
  Object.keys(grouped).forEach((cat) => {
    grouped[cat].forEach((f) => {
      if (f.eligible !== false && !(f.dni && f.dni.level === 'red')) allEligible.push({ ...f, _cat: cat });
    });
  });
  allEligible.sort((a, b) => (b.score || 0) - (a.score || 0));
  const topPick = allEligible[0];
  const totalRated = allEligible.length;

  return (
    <div className="animate-fadeIn">
      {/* HERO — big, modern, confident */}
      <div style={{
        background: 'var(--brand-gradient)',
        borderRadius: 'var(--radius-xl)',
        padding: '28px 32px',
        marginBottom: 24,
        color: '#fff',
        boxShadow: 'var(--shadow-brand)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, left: 40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', opacity: 0.85, marginBottom: 6 }}>Mutual Fund Intelligence</div>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.8px', lineHeight: 1.15, marginBottom: 8, maxWidth: 620 }}>
              {topPick ? `${topPick.name}` : 'Your next mutual fund'}
            </div>
            <div style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.5, maxWidth: 620 }}>
              {topPick
                ? `Top-ranked across ${totalRated} eligible funds. 100-point professional scoring, Tickertape data.`
                : `Professional scoring across ${total || 0} funds. Tickertape data · SEBI-flagged filtering.`}
            </div>
          </div>
          {topPick && (
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: 64, fontWeight: 800, lineHeight: 1, letterSpacing: '-2px',
                fontVariantNumeric: 'tabular-nums',
              }}>{topPick.score || 0}</div>
              <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4, fontWeight: 600 }}>/ 100 score</div>
            </div>
          )}
        </div>
        <div style={{ position: 'relative', marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            <b>{total || 0}</b> funds scored · <b>{totalRated}</b> eligible · <b>{allDni.length}</b> flagged
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={handleRefresh} disabled={refreshing} style={{
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.22)',
              borderRadius: 10,
              fontSize: 13, fontWeight: 600, color: '#fff',
              cursor: refreshing ? 'wait' : 'pointer', fontFamily: 'inherit',
              backdropFilter: 'blur(8px)',
            }}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <a href="https://www.tickertape.in/mutual-funds" target="_blank" rel="noopener noreferrer" style={{
              padding: '8px 16px', background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.22)',
              borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#fff',
              textDecoration: 'none', backdropFilter: 'blur(8px)',
            }}>
              Tickertape ↗
            </a>
          </div>
        </div>
      </div>

      {/* DNI Section */}
      {allDni.length > 0 && <DNISection funds={allDni} />}

      {/* Category Sections */}
      {categories.map((cat) => {
        const catFunds = grouped[cat] || [];
        const cfg = MF_CAT[cat];
        if (!catFunds.length) return null;

        const eligibleFunds = catFunds.filter((f) => f.eligible !== false && !(f.dni && f.dni.level === 'red'));
        const maxS = eligibleFunds[0] ? eligibleFunds[0].score : 1;

        return (
          <div key={cat} style={{ marginBottom: 40 }}>
            {/* Category header */}
            <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 4, height: 22, background: cfg.color, borderRadius: 2 }} />
              <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.4px', color: 'var(--text)' }}>{cfg.label}</div>
              <span style={{
                background: cfg.bg, color: cfg.color,
                borderRadius: 'var(--radius-full)', padding: '4px 12px',
                fontSize: 12, fontWeight: 600,
              }}>{cfg.desc}</span>
              <span style={{ fontSize: 13, color: 'var(--text2)', marginLeft: 'auto', fontWeight: 500 }}>
                <b style={{ color: cfg.color, fontWeight: 700 }}>{eligibleFunds.length} rated</b>
                <span style={{ color: 'var(--text3)', margin: '0 6px' }}>·</span>
                {catFunds.length - eligibleFunds.length} not eligible
              </span>
            </div>

            {/* Fund cards */}
            <div className="grid gap-2.5 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))' }}>
              {eligibleFunds.slice(0, 5).map((f, i) => (
                <FundCard key={f.name} fund={f} rank={i + 1} cfg={cfg} maxScore={maxS} />
              ))}
            </div>

            {/* Full table */}
            <MFTable funds={catFunds} cfg={cfg} cat={cat} />
          </div>
        );
      })}

      {(!funds || funds.length === 0) && !loading && (
        <EmptyState message="No fund data available. Click Refresh to load." />
      )}

      {/* Scoring Methodology footer */}
      <ScoringMethodology />
    </div>
  );
}
