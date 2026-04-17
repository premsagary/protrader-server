import React, { useEffect, useState, useMemo } from 'react';
import { apiGet } from '../../api/client';

// ══════════════════════════════════════════════════════════════════════
// Sector canonicalization — mirrors kite-server.js canonicalSector()
// Prevents "FMCG" ≠ "Fast Moving Consumer Goods" from evading the cap.
// ══════════════════════════════════════════════════════════════════════
function canonicalSector(raw) {
  if (!raw) return 'Other';
  const s = String(raw).toLowerCase().trim();
  if (/fast moving consumer goods|^fmcg$|consumer staples|packaged foods/i.test(s)) return 'FMCG';
  if (/^auto$|^autos$|automobile|automotive|auto components|tyres/i.test(s)) return 'Auto';
  if (/^it$|information technology|software|tech services|it services/i.test(s)) return 'IT';
  if (/^pharma$|pharmaceutical/i.test(s)) return 'Pharma';
  if (/healthcare|hospital|diagnostic/i.test(s)) return 'Healthcare';
  if (/^bank$|^banks$|private bank|public sector bank|banking/i.test(s)) return 'Banking';
  if (/nbfc|non.banking financ|financial services|financials/i.test(s)) return 'Financial Services';
  if (/^metal$|^metals$|metals.*mining|mining|aluminium|steel|iron.*ore|ferrous|non.?ferrous/i.test(s)) return 'Metals';
  if (/oil.*gas|petroleum|refineries|refinery|natural gas/i.test(s)) return 'Oil & Gas';
  if (/^power$|^electricity$|utilities|power generation|power distribution/i.test(s)) return 'Power';
  if (/cement|building products/i.test(s)) return 'Cement';
  if (/^chemicals?$|specialty chem|commodity chem|fertili[sz]er/i.test(s)) return 'Chemicals';
  if (/capital goods|industrials|electrical equipment|construction/i.test(s)) return 'Capital Goods';
  if (/consumer services|retail|travel|leisure|education|hotels/i.test(s)) return 'Consumer Services';
  if (/infra|ports|airports|logistics|shipping|railways/i.test(s)) return 'Infrastructure';
  if (/realty|real estate/i.test(s)) return 'Realty';
  if (/insurance|reinsurance/i.test(s)) return 'Insurance';
  return String(raw).trim();
}

function applySectorCap(sortedList, maxPerSector = 2) {
  const out = [];
  const counts = {};
  for (const s of sortedList) {
    const sec = canonicalSector(s.sector);
    if ((counts[sec] || 0) >= maxPerSector) continue;
    counts[sec] = (counts[sec] || 0) + 1;
    out.push(s);
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════════
// Risk flag badge labels — mirrors public/app.html badge section
// ══════════════════════════════════════════════════════════════════════
const FLAG_LABELS = {
  EARNINGS_CLIFF:                  '⚠ Earnings Cliff',
  EARNINGS_DROP_SEVERE:            '⚠ PAT Drop',
  EARNINGS_DECELERATING:           '↓ Earnings Turn',
  EARNINGS_SLOWING:                '→ Earnings Slowing',
  PRICE_PAT_DIVERGENCE_BEARISH:    '⚡ Price/PAT Divergent',
  PRICE_EARNINGS_EXTENDED:         '↑ Price Extended',
  MOMENTUM_CYCLICAL_PEAK:          '📈 Cyclical Peak',
  LOCKIN_IMMINENT:                 '🔓 Lock-in Imminent',
  LOCKIN_RECENT:                   '🔓 Lock-in Recent',
  LOCKIN_UPCOMING:                 '🔓 Lock-in Upcoming',
  EARNINGS_QUALITY_DIVERGENT:      '💧 FCF Weak vs PAT',
  EARNINGS_QUALITY_WEAK:           '💧 FCF Lagging',
  CYCLICAL_PEAK_PROFITABILITY:     '🔝 Cyclical Peak',
  CYCLICAL_ELEVATED_MARGINS:       '🔝 Late-Cycle',
  DRAWDOWN_STILL_FALLING:          '🗡 Falling Knife',
  DRAWDOWN_IMMATURE:               '⏳ No Recovery',
  DRAWDOWN_ACCELERATING:           '↓↓ Fall Deepening',
  SECTOR_LAGGARD:                  '🐌 Sector Laggard',
  SECTOR_UNDERPERFORMER:           '🐌 Underperforming',
  REBOUND_NO_CONFIRMATION:         '🗡 No Bottom Signal',
  REBOUND_WEAK_CONFIRMATION:       '⏳ Weak Bottom',
  BSE_EVENT_IMMINENT:              '📅 BSE Imminent',
  BSE_EVENT_SOON:                  '📅 BSE Soon',
  NEWS_NEGATIVE_RECENT:            '📰 Negative News',
  NEWS_NEGATIVE_MODERATE:          '📰 News Caution',
  ANALYST_SELL:                    '👎 Analyst SELL',
  ANALYST_TP_BELOW:                '👎 TP Below Spot',
  ANALYST_CAUTIOUS:                '👎 Analysts Cautious',
  MOMENTUM_CONSENSUS_CONFLICT:     '⚡ High Score, TP Below',
  MOMENTUM_CONSENSUS_CAUTIOUS:     '⚡ Weak Consensus',
  NEWS_DISQUALIFY:                 '🚨 AI: Severe News',
  NEWS_NEGATIVE_HIGH:              '🤖 AI: High-Severity',
  NEWS_NEGATIVE_MEDIUM:            '🤖 AI: Moderate',
  NEWS_NEGATIVE_LOW:               '🤖 AI: Minor',
};

function severityColors(severity) {
  if (severity === 'HIGH')   return { fg: 'var(--red-text)',    bg: 'var(--red-bg)',    border: 'rgba(248,113,113,0.35)' };
  if (severity === 'MEDIUM') return { fg: 'var(--amber-text)',  bg: 'var(--amber-bg)',  border: 'rgba(251,191,36,0.35)'   };
  return { fg: '#fbbf24', fg2: 'var(--text3)', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.25)' };
}

// Score tier → card accent colour
function scoreColor(score, kind) {
  // kind: 'rebound' | 'momentum' | 'long'
  const s = Number(score) || 0;
  if (kind === 'rebound') {
    if (s >= 82) return 'var(--green-text)';
    if (s >= 67) return 'var(--green-text)';
    if (s >= 52) return 'var(--amber-text)';
    if (s >= 37) return 'var(--amber-text)';
    return 'var(--red-text)';
  }
  if (s >= 80) return 'var(--green-text)';
  if (s >= 65) return 'var(--green-text)';
  if (s >= 50) return 'var(--amber-text)';
  return 'var(--red-text)';
}

// ══════════════════════════════════════════════════════════════════════
// Three-tab config
// ══════════════════════════════════════════════════════════════════════
const TABS = [
  {
    id: 'rebound',
    label: 'Rebound Picks',
    desc: 'Quality stocks down ≥20% from 52W high · RSI ≤50 · D/E ≤2',
    scoreField: 'fallenScore',
    scoreRaw:   'fallenScoreRaw',
    scoreLabel: 'REBOUND SCORE',
    accent: 'var(--amber-text)',
    accentSoft: 'rgba(251,191,36,0.10)',
    accentBorder: 'rgba(251,191,36,0.30)',
    filter: (s) => s.isFallenAngel === true && !s.disqualified,
  },
  {
    id: 'momentum',
    label: 'Momentum Picks',
    desc: 'Momentum Score ≥55 · FA 35% + Val 15% + TA 20% + Mom 15% + Risk 15%',
    scoreField: 'composite',
    scoreRaw:   'compositeRaw',
    scoreLabel: 'MOMENTUM SCORE',
    accent: 'var(--green-text)',
    accentSoft: 'var(--green-bg)',
    accentBorder: 'rgba(52,211,153,0.30)',
    filter: (s) => s.composite != null && s.composite >= 55 && !s.disqualified,
  },
  {
    id: 'longterm',
    label: 'Long-Term Investments',
    desc: 'Investment Score ≥60 · ROE ≥12% · D/E ≤2 · Non-negative EPS growth',
    scoreField: 'scoreV2',
    scoreRaw:   'scoreV2Raw',
    scoreLabel: 'INVESTMENT SCORE',
    accent: 'var(--brand-text)',
    accentSoft: 'var(--brand-bg)',
    accentBorder: 'rgba(99,102,241,0.30)',
    filter: (s) => {
      if (s.disqualified) return false;
      const roeOk = s.roe == null || s.roe >= 12;
      const deOk  = s.debtToEq == null || s.debtToEq <= 2;
      const grOk  = s.earGrowth == null || s.earGrowth >= 0;
      const notCollapsing = s.pctFromHigh == null || s.pctFromHigh >= -35;
      return (s.scoreV2 || 0) >= 60 && roeOk && deOk && grOk && notCollapsing;
    },
  },
];

// ══════════════════════════════════════════════════════════════════════
// Main component
// ══════════════════════════════════════════════════════════════════════
export default function StockPicks() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [marketCapFilter, setMarketCapFilter] = useState('ALL');

  useEffect(() => {
    setLoading(true);
    apiGet('/api/stocks/score?scoreVersion=2')
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message || 'Failed to load picks'); setLoading(false); });
  }, []);

  const stocks = (data?.stocks || []).filter(Boolean);

  // Market-cap filter
  const filteredByGrp = useMemo(() => {
    if (marketCapFilter === 'ALL') return stocks;
    return stocks.filter((s) => (s.grp || '').toUpperCase().includes(marketCapFilter));
  }, [stocks, marketCapFilter]);

  // Build each tab's top-10 list: filter → sort desc → sector cap → slice
  const tabPicks = useMemo(() => {
    const out = {};
    for (const tab of TABS) {
      const filtered = filteredByGrp.filter(tab.filter);
      const sorted = [...filtered].sort((a, b) => (b[tab.scoreField] || 0) - (a[tab.scoreField] || 0));
      const capped = applySectorCap(sorted, 2);
      out[tab.id] = capped.slice(0, 15);
    }
    return out;
  }, [filteredByGrp]);

  // Header stat counts (before cap)
  const counts = useMemo(() => ({
    total: stocks.length,
    rebound: stocks.filter((s) => s.isFallenAngel === true).length,
    momentum: stocks.filter((s) => s.composite != null && s.composite >= 55).length,
    longTerm: stocks.filter((s) => (s.scoreV2 || 0) >= 60).length,
    disqualified: stocks.filter((s) => s.disqualified).length,
  }), [stocks]);

  const filterPills = ['ALL', 'NIFTY50', 'NEXT50', 'MIDCAP', 'SMALLCAP'];

  return (
    <div>
      {/* ═══ HERO BANNER ═══ */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(52,211,153,0.10) 50%, rgba(251,191,36,0.10) 100%)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: '32px 36px',
          marginBottom: 28,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(99,102,241,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div className="label-xs" style={{ marginBottom: 10 }}>Daily picks · Three strategies · Updated automatically</div>
            <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-1.2px', lineHeight: 1.05, color: 'var(--text)', marginBottom: 10 }}>
              <span className="gradient-fill">Stock Picks</span>
            </h1>
            <p style={{ fontSize: 16, color: 'var(--text2)', maxWidth: 720, lineHeight: 1.5 }}>
              {counts.total || 567} NSE stocks scored on three independent frameworks. Each carries 12 forward-looking risk flags, 7 hard disqualifiers, and max 2 per canonical sector. Full transparency.
            </p>
          </div>
          {counts.total > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div className="tabular-nums gradient-fill" style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, letterSpacing: '-2px' }}>
                {counts.total}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6, fontWeight: 500 }}>stocks scored</div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ STATS STRIP ═══ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[
          { l: 'Total',        v: counts.total,        c: 'var(--text)' },
          { l: 'Rebound',      v: counts.rebound,      c: 'var(--amber-text)' },
          { l: 'Momentum',     v: counts.momentum,     c: 'var(--green-text)' },
          { l: 'Long-Term',    v: counts.longTerm,     c: 'var(--brand-text)' },
          { l: 'Disqualified', v: counts.disqualified, c: 'var(--red-text)' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: '16px 18px', cursor: 'default' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>
              {s.l}
            </div>
            <div className="tabular-nums" style={{ fontSize: 26, fontWeight: 800, color: s.c, letterSpacing: '-0.8px', lineHeight: 1 }}>
              {loading ? '—' : s.v}
            </div>
          </div>
        ))}
      </div>

      {/* ═══ MARKET-CAP FILTER PILLS ═══ */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {filterPills.map((f) => (
          <button
            key={f}
            onClick={() => setMarketCapFilter(f)}
            style={{
              padding: '6px 14px',
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 600,
              background: marketCapFilter === f ? 'var(--brand)' : 'rgba(255,255,255,0.04)',
              color: marketCapFilter === f ? '#fff' : 'var(--text2)',
              border: `1px solid ${marketCapFilter === f ? 'var(--brand)' : 'var(--border)'}`,
              cursor: 'pointer',
              transition: 'all 180ms ease',
              fontFamily: 'inherit',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* ═══ ERROR ═══ */}
      {error && (
        <div className="card" style={{ padding: 24, color: 'var(--red-text)' }}>
          Failed to load picks: {error}
        </div>
      )}

      {/* ═══ LOADING SKELETONS (3-COLUMN) ═══ */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          {[...Array(3)].map((_, colIdx) => (
            <div key={colIdx} className="card" style={{ padding: 20, opacity: 0.5 }}>
              <div style={{ height: 22, background: 'var(--bg3)', borderRadius: 6, marginBottom: 16, width: '60%' }} />
              {[...Array(8)].map((__, rowIdx) => (
                <div key={rowIdx} style={{ height: 44, background: 'var(--bg3)', borderRadius: 8, marginBottom: 8, opacity: 0.7 - rowIdx * 0.05 }} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ═══ THREE-COLUMN PICKS ═══ */}
      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
          {TABS.map((tab) => (
            <PicksColumn
              key={tab.id}
              tab={tab}
              picks={tabPicks[tab.id] || []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Column component — renders one of the three tabs
// ══════════════════════════════════════════════════════════════════════
function PicksColumn({ tab, picks }) {
  const [expanded, setExpanded] = useState(null); // sym of currently expanded card

  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: 'hidden',
        border: `1px solid ${tab.accentBorder}`,
      }}
    >
      {/* Column header */}
      <div style={{
        padding: '18px 20px 14px',
        borderBottom: '1px solid var(--border)',
        background: tab.accentSoft,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: tab.accent, letterSpacing: '-0.1px' }}>
            {tab.label}
          </h3>
          <span className="chip" style={{
            fontSize: 10,
            height: 20,
            padding: '0 7px',
            fontWeight: 700,
            background: tab.accentSoft,
            color: tab.accent,
            border: `1px solid ${tab.accentBorder}`,
          }}>
            {picks.length}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.45 }}>
          {tab.desc}
        </div>
      </div>

      {/* Column body */}
      {picks.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          No stocks clear all gates right now.
        </div>
      )}
      {picks.map((s, idx) => (
        <PickRow
          key={s.sym}
          stock={s}
          rank={idx + 1}
          tab={tab}
          expanded={expanded === s.sym}
          onToggle={() => setExpanded(expanded === s.sym ? null : s.sym)}
        />
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Per-stock row — compact with expand-on-click
// ══════════════════════════════════════════════════════════════════════
function PickRow({ stock: s, rank, tab, expanded, onToggle }) {
  const rawScore = s[tab.scoreField];
  const score = rawScore != null ? Math.round(rawScore * 10) / 10 : null;
  const rawOrig = s[tab.scoreRaw];
  const priceStr = s.price != null ? `₹${Number(s.price).toLocaleString('en-IN', { maximumFractionDigits: 1 })}` : '—';
  const flags = Array.isArray(s.riskFlags) ? s.riskFlags : [];
  const disq = s.disqualifier;

  return (
    <div
      style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      onClick={onToggle}
    >
      {/* Top row: rank + sym + group chip + score + price */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', minWidth: 18, textAlign: 'right' }}>
          {rank}.
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.2px' }}>
              {s.sym}
            </span>
            {s.grp && (
              <span className="chip" style={{ height: 18, fontSize: 9, padding: '0 6px', fontWeight: 700, letterSpacing: '0.4px' }}>
                {s.grp}
              </span>
            )}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text3)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.sector || s.name || '—'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            className="tabular-nums"
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: scoreColor(score, tab.id),
              letterSpacing: '-0.4px',
              lineHeight: 1,
            }}
          >
            {score != null ? score : '—'}
          </div>
          <div className="tabular-nums" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
            {priceStr}
          </div>
        </div>
      </div>

      {/* Disqualifier banner (rare, bold red) */}
      {disq && (
        <div style={{
          marginTop: 8,
          padding: '6px 10px',
          background: 'rgba(239,68,68,0.12)',
          border: '1.5px solid var(--red)',
          borderRadius: 6,
          fontSize: 10,
          fontWeight: 800,
          color: 'var(--red-text)',
          letterSpacing: '0.4px',
        }}
        title={disq.reason || ''}
        >
          🚫 EXCLUDED — {String(disq.code || '').replace(/_/g, ' ')}
        </div>
      )}

      {/* Risk flag badges */}
      {flags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {flags.map((fl, i) => {
            const c = severityColors(fl.severity);
            const short = FLAG_LABELS[fl.code] || fl.code;
            return (
              <span
                key={i}
                title={fl.label || ''}
                style={{
                  background: c.bg,
                  color: c.fg,
                  border: `1px solid ${c.border}`,
                  borderRadius: 4,
                  padding: '1px 6px',
                  fontSize: 9.5,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {short}
              </span>
            );
          })}
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px solid var(--border)',
          fontSize: 11,
          color: 'var(--text2)',
          lineHeight: 1.55,
        }}>
          {rawOrig != null && rawOrig !== rawScore && (
            <div style={{ marginBottom: 6, color: 'var(--text3)' }}>
              Raw score: <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--text)' }}>{Math.round(rawOrig * 10) / 10}</span>
              <span style={{ margin: '0 6px', color: 'var(--text4)' }}>→</span>
              Penalised: <span className="tabular-nums" style={{ fontWeight: 700, color: tab.accent }}>{score}</span>
              <span style={{ marginLeft: 6, color: 'var(--red-text)' }}>(−{Math.round((rawOrig - rawScore) * 10) / 10})</span>
            </div>
          )}
          {flags.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {flags.slice(0, 4).map((fl, i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--text2)' }}>
                  <span style={{ color: severityColors(fl.severity).fg, fontWeight: 700 }}>
                    [{fl.severity}]
                  </span>
                  {' '}
                  {fl.label}
                  {' '}
                  <span style={{ color: 'var(--text3)' }}>(−{fl.penalty})</span>
                </div>
              ))}
            </div>
          )}
          {flags.length === 0 && !disq && (
            <div style={{ color: 'var(--text3)', fontStyle: 'italic' }}>
              No risk flags firing. Clean signal.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
