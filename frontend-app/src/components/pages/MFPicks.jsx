import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiGet, apiPost } from '../../api/client';

const CAT_CONFIG = {
  smallcap: { label: 'Small Cap', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', desc: 'High risk · 7+ year horizon' },
  midcap:   { label: 'Mid Cap',   color: '#22C55E', bg: 'rgba(34,197,94,0.12)',  desc: 'Moderate-high risk · 5+ year' },
  largecap: { label: 'Large Cap', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', desc: 'Core stability · Nifty 100'    },
  flexicap: { label: 'Flexi Cap', color: '#14B8A6', bg: 'rgba(20,184,166,0.12)', desc: 'Dynamic · 3+ year horizon'     },
};
const CAT_ORDER = ['largecap', 'midcap', 'smallcap', 'flexicap'];

const INITIAL_ROWS = 10;

function sebiIcon(s) {
  if (s === 'probe') return { icon: '🔴', label: 'Probe' };
  if (s === 'action') return { icon: '⚠️', label: 'Action' };
  if (s === 'minor') return { icon: '🟡', label: 'Minor' };
  return { icon: '✅', label: 'Clean' };
}

function fmtPct(v, dec = 1) {
  if (v == null || v === undefined) return null;
  const n = parseFloat(v);
  if (isNaN(n)) return null;
  return n.toFixed(dec);
}

function RetCell({ v }) {
  const n = parseFloat(v);
  const ok = v != null && !isNaN(n);
  if (!ok) return <span style={{ color: 'var(--text4)', fontSize: 10 }}>—</span>;
  return (
    <span className="tabular-nums" style={{ color: n >= 0 ? 'var(--green-text)' : 'var(--red-text)', fontWeight: 600 }}>
      {n >= 0 ? '+' : ''}{n.toFixed(1)}%
    </span>
  );
}
function NumCell({ v, dec = 2, suffix = '' }) {
  const n = parseFloat(v);
  if (v == null || isNaN(n)) return <span style={{ color: 'var(--text4)' }}>—</span>;
  return <span className="tabular-nums">{n.toFixed(dec)}{suffix}</span>;
}
function SharpeCell({ v }) {
  const n = parseFloat(v);
  if (v == null || isNaN(n)) return <span style={{ color: 'var(--text4)' }}>—</span>;
  const col = n > 0.5 ? 'var(--green-text)' : n > 0 ? 'var(--amber-text)' : 'var(--red-text)';
  return <span className="tabular-nums" style={{ color: col, fontWeight: 600 }}>{n.toFixed(2)}</span>;
}
function VsCatCell({ v }) {
  const n = parseFloat(v);
  if (v == null || isNaN(n) || n === 0) return <span style={{ color: 'var(--text4)' }}>—</span>;
  return (
    <span className="tabular-nums" style={{ color: n >= 1 ? 'var(--green-text)' : 'var(--red-text)', fontWeight: 600 }}>
      {n.toFixed(2)}×
    </span>
  );
}
function PctCell({ v, dec = 1 }) {
  const n = parseFloat(v);
  if (v == null || isNaN(n)) return <span style={{ color: 'var(--text4)' }}>—</span>;
  if (n === 0) return <span style={{ color: 'var(--text4)' }}>0%</span>;
  return <span className="tabular-nums">{n.toFixed(dec)}%</span>;
}

export default function MFPicks() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Per-category AI review state
  // shape: { [cat]: { reviews: {fundName: [models]}, judge_ranking: [], rankings: {} } }
  const [aiCache, setAiCache] = useState({});
  const [aiLoading, setAiLoading] = useState({});
  const [aiRunning, setAiRunning] = useState({});
  const [expandedCats, setExpandedCats] = useState({}); // { [cat]: bool } — show all rows
  const [showAIpanel, setShowAIpanel] = useState({});   // { [cat]: bool }

  useEffect(() => {
    apiGet('/api/mf/funds')
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const fetchAI = useCallback(async (cat) => {
    if (aiLoading[cat]) return;
    setAiLoading((s) => ({ ...s, [cat]: true }));
    try {
      const d = await apiGet('/api/mf/ai-review?category=' + encodeURIComponent(cat));
      setAiCache((s) => ({
        ...s,
        [cat]: {
          reviews: (d && d.reviews) || {},
          judge_ranking: Array.isArray(d && d.judge_ranking) ? d.judge_ranking : [],
          rankings: (d && d.rankings) || {},
        },
      }));
    } catch (e) {
      setAiCache((s) => ({ ...s, [cat]: { reviews: {}, judge_ranking: [], rankings: {} } }));
    } finally {
      setAiLoading((s) => ({ ...s, [cat]: false }));
    }
  }, [aiLoading]);

  const runAI = useCallback(async (cat) => {
    if (aiRunning[cat]) return;
    setAiRunning((s) => ({ ...s, [cat]: true }));
    setShowAIpanel((s) => ({ ...s, [cat]: true }));
    try {
      await apiPost('/api/mf/ai-review?category=' + encodeURIComponent(cat), {});
    } catch (e) {
      // fall through to refetch anyway
    } finally {
      setAiRunning((s) => ({ ...s, [cat]: false }));
      await fetchAI(cat);
    }
  }, [aiRunning, fetchAI]);

  // Auto-prime AI cache when data loads
  useEffect(() => {
    if (!data) return;
    CAT_ORDER.forEach((cat) => {
      if (!aiCache[cat] && !aiLoading[cat]) fetchAI(cat);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const funds = Array.isArray(data?.funds) ? data.funds : [];
  const total = data?.total || funds.length;
  const eligibleAll = funds.filter((f) => f && f.eligible !== false && !(f.dni && f.dni.level === 'red'));
  const dniFunds = funds.filter((f) => f && f.dni);

  const grouped = useMemo(() => {
    const g = { largecap: [], midcap: [], smallcap: [], flexicap: [] };
    funds.forEach((f) => { if (f && f.cat && g[f.cat]) g[f.cat].push(f); });
    Object.keys(g).forEach((k) => {
      g[k].sort((a, b) => {
        if (a.eligible && !b.eligible) return -1;
        if (!a.eligible && b.eligible) return 1;
        return (b.score || 0) - (a.score || 0);
      });
    });
    return g;
  }, [funds]);

  const topPick = eligibleAll[0];

  return (
    <div>
      {/* Hero */}
      <div style={{
        background: 'var(--gradient)', borderRadius: 18, padding: '32px 36px', marginBottom: 28,
        color: '#fff', boxShadow: 'var(--shadow-brand)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -70, right: -50, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', opacity: 0.85, marginBottom: 10 }}>
              Mutual Fund Intelligence · 100-Point Scoring
            </div>
            <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-1.2px', lineHeight: 1.05, marginBottom: 10 }}>
              {topPick ? topPick.name : 'Mutual Fund Picks'}
            </h1>
            <p style={{ fontSize: 16, opacity: 0.9, lineHeight: 1.5, maxWidth: 600 }}>
              {topPick
                ? `Top-ranked across ${eligibleAll.length} eligible funds. Tickertape data · SEBI-flagged filtering.`
                : `${total} funds scored with 100-point framework across 4 categories.`}
            </p>
          </div>
          {topPick && (
            <div style={{ textAlign: 'right' }}>
              <div className="tabular-nums" style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, letterSpacing: '-2px' }}>
                {Math.round(topPick.score || 0)}
              </div>
              <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>/ 100 score</div>
            </div>
          )}
        </div>
        <div style={{ position: 'relative', marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, opacity: 0.85 }}>
          <span><b>{total}</b> funds scored</span>
          <span><b>{eligibleAll.length}</b> eligible</span>
          <span><b>{dniFunds.length}</b> flagged</span>
        </div>
      </div>

      {loading && (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>
          <div className="animate-pulse-custom" style={{ fontSize: 15 }}>Loading fund data…</div>
        </div>
      )}

      {error && (
        <div className="card" style={{ padding: 24, color: 'var(--red-text)', marginBottom: 20 }}>
          Failed to load: {error}
        </div>
      )}

      {/* DNI Warning */}
      {dniFunds.length > 0 && <DNIPanel funds={dniFunds} />}

      {/* Category sections */}
      {!loading && !error && CAT_ORDER.map((cat) => {
        const catFunds = Array.isArray(grouped[cat]) ? grouped[cat] : [];
        if (catFunds.length === 0) return null;
        const cfg = CAT_CONFIG[cat];
        const eligFunds = catFunds.filter((f) => f.eligible !== false);
        const top5 = eligFunds.slice(0, 5);

        const ai = aiCache[cat] || { reviews: {}, judge_ranking: [], rankings: {} };
        const isAIRunning = !!aiRunning[cat];
        const isAIVisible = !!showAIpanel[cat] || (Array.isArray(ai.judge_ranking) && ai.judge_ranking.length > 0);

        return (
          <div key={cat} style={{ marginBottom: 36 }} className="animate-fadeIn">
            {/* Category header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 4, height: 22, background: cfg.color, borderRadius: 2 }} />
              <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.4px', color: 'var(--text)' }}>{cfg.label} Funds</h2>
              <span className="chip" style={{ background: cfg.bg, color: cfg.color, borderColor: `${cfg.color}30` }}>
                {cfg.desc}
              </span>
              <button
                className="btn btn-primary"
                onClick={() => runAI(cat)}
                disabled={isAIRunning}
                style={{ fontSize: 12, padding: '6px 14px', marginLeft: 6 }}
                title="Run 5-council + judge Deep AI Review on top 5"
              >
                {isAIRunning ? '⏳ Reviewing…' : '🧠 Deep AI Review'}
              </button>
              <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 'auto' }}>
                <b style={{ color: cfg.color }}>{eligFunds.length}</b> eligible · {catFunds.length - eligFunds.length} not eligible
              </span>
            </div>

            {/* Fund cards (top 5) — always 5 across on one line */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10, marginBottom: 20 }}>
              {top5.map((f, i) => (
                <FundCard key={f.name} fund={f} rank={i + 1} cfg={cfg} featured={i === 0} />
              ))}
            </div>

            {/* AI Review panel */}
            {isAIVisible && (
              <AIReviewPanel
                cat={cat}
                cfg={cfg}
                aiData={ai}
                running={isAIRunning}
                loading={!!aiLoading[cat]}
                topFunds={top5}
              />
            )}

            {/* Wide sortable table */}
            <CategoryTable
              cat={cat}
              cfg={cfg}
              funds={catFunds}
              expanded={!!expandedCats[cat]}
              onToggleExpand={() => setExpandedCats((s) => ({ ...s, [cat]: !s[cat] }))}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DNI Panel
// ─────────────────────────────────────────────────────────────────────────────
function DNIPanel({ funds }) {
  const [expanded, setExpanded] = useState(false);
  const INITIAL = 5;
  const safeFunds = Array.isArray(funds) ? funds : [];
  const sorted = [...safeFunds].sort((a, b) => {
    const lvl = { red: 0, amber: 1 };
    return (lvl[a.dni?.level] || 2) - (lvl[b.dni?.level] || 2);
  });
  const shown = expanded ? sorted : sorted.slice(0, INITIAL);

  return (
    <div className="card" style={{ overflow: 'hidden', marginBottom: 28, border: '1px solid rgba(248,113,113,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', background: 'var(--red-bg)', borderBottom: '1px solid rgba(248,113,113,0.2)' }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--red-text)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>!</div>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--red-text)' }}>Warning Before Buying These MFs</span>
        <span className="chip chip-red">{safeFunds.length} flagged</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'rgba(18,24,40,0.5)', borderBottom: '1px solid var(--border)' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text2)', fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Fund</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text2)', fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Category</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text2)', fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Reason</th>
            <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text2)', fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Score</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((f, i) => {
            const lvlColor = f.dni?.level === 'red' ? 'var(--red-text)' : 'var(--amber-text)';
            const catLabel = (CAT_CONFIG[f.cat] || {}).label || f.cat;
            return (
              <tr key={`${f.name}-${i}`} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'rgba(14,20,32,0.3)' : 'transparent' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text)', fontSize: 12 }}>{f.name}</td>
                <td style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 11 }}>{catLabel}</td>
                <td style={{ padding: '10px 14px', color: lvlColor, fontSize: 11 }}>{f.dni?.reason || 'Flagged'}</td>
                <td className="tabular-nums" style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: lvlColor, fontSize: 13 }}>{Math.round(f.score || 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length > INITIAL && (
        <div style={{ textAlign: 'center', padding: 14, borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-secondary" onClick={() => setExpanded((e) => !e)} style={{ fontSize: 11 }}>
            {expanded ? 'Show less ▴' : `Show all ${sorted.length - INITIAL} more flagged funds ▾`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Review Panel — judge final_ranking display
// ─────────────────────────────────────────────────────────────────────────────
function AIReviewPanel({ cat, cfg, aiData, running, loading, topFunds }) {
  const ranking = Array.isArray(aiData?.judge_ranking) ? [...aiData.judge_ranking].sort((a, b) => (a.rank || 99) - (b.rank || 99)) : [];
  const councilRankings = aiData?.rankings || {};

  // Build varsity rank lookup for promote/demote arrows
  const varsityRankByName = {};
  (Array.isArray(topFunds) ? topFunds : []).forEach((f, i) => { varsityRankByName[f.name] = i + 1; });

  // Council by fund
  const councilByFund = {};
  Object.keys(councilRankings).forEach((modelId) => {
    if (modelId === 'ai-judge') return;
    const rows = Array.isArray(councilRankings[modelId]) ? councilRankings[modelId] : [];
    rows.forEach((r) => {
      const fn = r.fund_name || r.sym;
      if (!fn) return;
      if (!councilByFund[fn]) councilByFund[fn] = [];
      councilByFund[fn].push({ model_id: modelId, model_name: r.model_name || modelId, rank: r.rank, reason: r.reason || '' });
    });
  });
  Object.keys(councilByFund).forEach((k) => councilByFund[k].sort((a, b) => (a.rank || 99) - (b.rank || 99)));

  const rankColor = (rk) => {
    if (rk === 1) return 'var(--amber-text)';
    if (rk === 2) return 'var(--green-text)';
    if (rk === 3) return 'var(--brand-text)';
    if (rk === 4) return 'var(--purple-text)';
    return 'var(--red-text)';
  };
  const shortModel = (id) => {
    const s = (id || '').toLowerCase();
    if (s.indexOf('llama') >= 0 || s.indexOf('groq') >= 0) return 'llama';
    if (s.indexOf('gpt') >= 0) return 'gpt-4.1';
    if (s.indexOf('deepseek') >= 0) return 'deepk';
    if (s.indexOf('gemini') >= 0) return 'gem';
    if (s.indexOf('qwen') >= 0) return 'qwen';
    return (id || '').slice(0, 6);
  };
  const medals = ['🥇', '🥈', '🥉', '④', '⑤'];

  return (
    <div className="card card-premium animate-fadeIn" style={{
      padding: '16px 18px', marginBottom: 20,
      background: 'linear-gradient(165deg, rgba(124,58,237,0.06), rgba(14,18,32,0.6))',
      border: '1px solid rgba(124,58,237,0.35)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid rgba(124,58,237,0.20)' }}>
        <span style={{ fontSize: 18 }}>⚖</span>
        <div style={{ flex: 1 }}>
          <div className="gradient-fill" style={{ fontWeight: 800, fontSize: 14, letterSpacing: '0.4px' }}>
            JUDGE FINAL RANKING · {cfg.label}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, fontWeight: 500 }}>
            5 council AIs vote · Claude Sonnet 4.6 decides
          </div>
        </div>
        {loading && !running && <span className="chip" style={{ fontSize: 10 }}>Loading…</span>}
      </div>

      {running ? (
        <div style={{ padding: '22px 8px', textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>⏳</div>
          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--brand-text)' }}>Review in progress…</div>
          <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 4, maxWidth: 260, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.4 }}>
            5 council models rank the top 5. Claude Sonnet synthesises. Usually 40-120s.
          </div>
        </div>
      ) : ranking.length === 0 ? (
        <div style={{ padding: '18px 8px', textAlign: 'center', color: 'var(--text4)', fontSize: 11 }}>
          <div style={{ fontSize: 20, opacity: 0.6, marginBottom: 4 }}>💤</div>
          <div style={{ color: 'var(--text3)', fontWeight: 700, fontSize: 11 }}>No review yet</div>
          <div style={{ fontSize: 10, maxWidth: 260, margin: '4px auto 0', lineHeight: 1.4 }}>
            Click <b>Deep AI Review</b> above. 5 council models will rank the top 5 funds, then Claude Sonnet judges the final order.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ranking.slice(0, 5).map((r) => {
            const rank = r.rank || 0;
            const name = r.fund_name || r.sym || '';
            const conf = r.confidence != null ? Math.round(r.confidence) : null;
            const why = r.why_choose || '';
            const wnot = r.why_not || '';
            const divergence = r.council_ranking_divergence || '';
            const varsityRank = varsityRankByName[name];
            const moved = varsityRank && rank && varsityRank !== rank;
            const moveArrow = !moved ? '' : (rank < varsityRank ? '▲' : '▼');
            const moveColor = !moved ? '' : (rank < varsityRank ? 'var(--green-text)' : 'var(--red-text)');
            const medal = medals[rank - 1] || `#${rank}`;
            const councilList = Array.isArray(councilByFund[name]) ? councilByFund[name] : [];

            return (
              <div key={name + rank} style={{
                background: rank <= 1 ? 'rgba(124,58,237,0.08)' : 'rgba(14,20,32,0.50)',
                border: '1px solid rgba(124,58,237,0.18)',
                borderRadius: 10, padding: '10px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 16 }}>{medal}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                  {moved && (
                    <span title={`Judge moved from varsity #${varsityRank} to #${rank}`} style={{ fontSize: 10, fontWeight: 800, color: moveColor }}>
                      {moveArrow}{rank < varsityRank ? ` +${varsityRank - rank}` : ` -${rank - varsityRank}`}
                    </span>
                  )}
                  {conf != null && (
                    <span className="chip chip-brand tabular-nums" style={{ fontSize: 10 }}>{conf}%</span>
                  )}
                </div>
                {why && (
                  <div style={{ fontSize: 11, color: 'var(--green-text)', lineHeight: 1.4, paddingLeft: 24, marginTop: 5, fontWeight: 500 }}>
                    ✓ {why}
                  </div>
                )}
                {wnot && (
                  <div style={{ fontSize: 11, color: 'var(--amber-text)', lineHeight: 1.4, paddingLeft: 24, marginTop: 3, fontWeight: 500 }}>
                    ✗ {wnot}
                  </div>
                )}
                {divergence && (
                  <div style={{ fontSize: 10, color: 'var(--text4)', fontStyle: 'italic', paddingLeft: 24, marginTop: 3 }}>
                    · {divergence}
                  </div>
                )}
                {councilList.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 24, marginTop: 6, flexWrap: 'wrap' }}>
                    <span className="label-xs" style={{ fontSize: 9, color: 'var(--text4)', fontWeight: 700 }}>5 AIs:</span>
                    {councilList.map((m) => (
                      <span
                        key={m.model_id}
                        title={`${m.model_name || m.model_id} ranked #${m.rank}${m.reason ? ' — ' + m.reason : ''}`}
                        style={{
                          fontSize: 9, fontWeight: 800, color: rankColor(m.rank),
                          background: `${rankColor(m.rank)}1a`,
                          border: `1px solid ${rankColor(m.rank)}55`,
                          borderRadius: 3, padding: '0 5px', lineHeight: '14px', whiteSpace: 'nowrap',
                        }}
                      >
                        #{m.rank} {shortModel(m.model_id)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wide per-category table (sticky sym+name cols, sortable, expand)
// ─────────────────────────────────────────────────────────────────────────────
const COL_GROUPS = [
  { label: 'IDENTITY',      color: 'var(--text3)',   cols: [
    { k: '#',          w: 44,  align: 'left'  },
    { k: 'Fund',       w: 220, align: 'left'  },
    { k: 'AMC',        w: 88,  align: 'left'  },
    { k: 'AUM ₹Cr',    w: 80,  align: 'right', sortField: 'aum_cr' },
    { k: 'Exp%',       w: 64,  align: 'right', sortField: 'expense_ratio' },
    { k: 'Inception',  w: 78,  align: 'right', sortField: 'months_inception' },
  ]},
  { label: 'RETURNS',       color: 'var(--green-text)', cols: [
    { k: '1Y%',        w: 70, align: 'right', sortField: 'ret_1y' },
    { k: '3Y CAGR',    w: 78, align: 'right', sortField: 'cagr_3y' },
    { k: '5Y CAGR',    w: 78, align: 'right', sortField: 'cagr_5y' },
    { k: '10Y CAGR',   w: 82, align: 'right', sortField: 'cagr_10y' },
    { k: 'Roll 3Y',    w: 72, align: 'right', sortField: 'rolling_3y' },
  ]},
  { label: 'vs CATEGORY',   color: 'var(--brand-text)', cols: [
    { k: 'vs Cat 1Y×', w: 80, align: 'right', sortField: 'vs_cat_1y' },
    { k: 'vs Cat 3Y×', w: 80, align: 'right', sortField: 'vs_cat_3y' },
    { k: 'vs Cat 5Y×', w: 80, align: 'right', sortField: 'vs_cat_5y' },
  ]},
  { label: 'RISK',          color: 'var(--red-text)', cols: [
    { k: 'Sharpe',     w: 72, align: 'right', sortField: 'sharpe' },
    { k: 'Sortino',    w: 72, align: 'right', sortField: 'sortino' },
    { k: 'Vol%',       w: 68, align: 'right', sortField: 'volatility' },
    { k: 'Max DD',     w: 78, align: 'right', sortField: 'pct_from_ath' },
  ]},
  { label: 'PORTFOLIO',     color: 'var(--purple-text)', cols: [
    { k: 'LgCap%',     w: 70, align: 'right', sortField: 'pct_largecap' },
    { k: 'MidCap%',    w: 72, align: 'right', sortField: 'pct_midcap' },
    { k: 'SmCap%',     w: 72, align: 'right', sortField: 'pct_smallcap' },
    { k: 'Cash%',      w: 66, align: 'right', sortField: 'pct_cash' },
    { k: 'Debt%',      w: 66, align: 'right', sortField: 'pct_debt' },
  ]},
  { label: 'CONCENTRATION', color: 'var(--amber-text)', cols: [
    { k: 'Top3%',      w: 68, align: 'right', sortField: 'top3_conc' },
    { k: 'Top5%',      w: 68, align: 'right', sortField: 'top5_conc' },
    { k: 'Top10%',     w: 72, align: 'right', sortField: 'top10_conc' },
  ]},
  { label: 'SCORE',         color: 'var(--brand-text)', cols: [
    { k: 'SEBI',       w: 60, align: 'center' },
    { k: 'Score',      w: 82, align: 'right', sortField: 'score' },
  ]},
];

function CategoryTable({ cat, cfg, funds, expanded, onToggleExpand }) {
  const [sortField, setSortField] = useState('score');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = useMemo(() => {
    const arr = [...(Array.isArray(funds) ? funds : [])];
    const mult = sortDir === 'desc' ? -1 : 1;
    arr.sort((a, b) => {
      // Always keep eligible ahead of not-eligible
      if (a.eligible && !b.eligible) return -1;
      if (!a.eligible && b.eligible) return 1;
      const va = parseFloat(a[sortField]);
      const vb = parseFloat(b[sortField]);
      const na = isNaN(va) ? -Infinity : va;
      const nb = isNaN(vb) ? -Infinity : vb;
      return (na - nb) * mult;
    });
    return arr;
  }, [funds, sortField, sortDir]);

  const shownRows = expanded ? sorted : sorted.slice(0, INITIAL_ROWS);
  const hiddenCount = sorted.length - INITIAL_ROWS;

  function handleSort(field) {
    if (!field) return;
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  const eligibleTop5Names = {};
  const eligFunds = sorted.filter((f) => f.eligible !== false && !(f.dni && f.dni.level === 'red'));
  eligFunds.slice(0, 5).forEach((f, i) => { eligibleTop5Names[f.name] = i + 1; });

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{
        padding: '10px 14px', fontSize: 11, color: 'var(--text3)',
        background: 'rgba(18,24,40,0.5)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <span>
          {sorted.length} total · <b style={{ color: 'var(--text)' }}>{eligFunds.length} eligible</b> · scroll right for more columns · click header to sort
        </span>
        <span className="label-xs" style={{ color: 'var(--text4)' }}>AUM ≥₹1K Cr · age ≥5Y · 3Y data</span>
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%', minWidth: 1800 }}>
          <thead>
            <tr>
              {COL_GROUPS.map((g) => (
                <th
                  key={g.label}
                  colSpan={g.cols.length}
                  style={{
                    color: g.color, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase',
                    fontWeight: 800, padding: '8px 10px', textAlign: 'center',
                    background: 'rgba(18,24,42,0.95)', borderBottom: '2px solid var(--border2)',
                    borderRight: '2px solid var(--border)',
                  }}
                >
                  {g.label}
                </th>
              ))}
            </tr>
            <tr>
              {COL_GROUPS.flatMap((g, gi) => g.cols.map((c, ci) => {
                const isLastInGroup = ci === g.cols.length - 1;
                const isSticky = gi === 0 && ci <= 1;
                const leftOffset = ci === 0 ? 0 : ci === 1 ? g.cols[0].w : 0;
                const active = c.sortField && sortField === c.sortField;
                return (
                  <th
                    key={`${g.label}-${c.k}`}
                    onClick={() => c.sortField && handleSort(c.sortField)}
                    style={{
                      padding: '8px 10px',
                      textAlign: c.align === 'left' ? 'left' : c.align === 'center' ? 'center' : 'right',
                      color: active ? cfg.color : 'var(--text2)', fontWeight: 700,
                      fontSize: 10, letterSpacing: '0.04em',
                      borderBottom: '2px solid var(--border2)',
                      borderRight: isLastInGroup ? '2px solid var(--border)' : undefined,
                      background: 'rgba(18,24,40,0.98)',
                      cursor: c.sortField ? 'pointer' : 'default',
                      position: isSticky ? 'sticky' : undefined,
                      left: isSticky ? leftOffset : undefined,
                      zIndex: isSticky ? 5 : undefined,
                      minWidth: c.w, width: c.w,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.k}{active ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''}
                  </th>
                );
              }))}
            </tr>
          </thead>
          <tbody>
            {shownRows.map((f, i) => (
              <FundRow key={f.name + i} f={f} index={i} cfg={cfg} topAIRank={eligibleTop5Names[f.name] || 0} />
            ))}
          </tbody>
        </table>
      </div>
      {hiddenCount > 0 && (
        <div style={{ textAlign: 'center', padding: 14, borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-secondary" onClick={onToggleExpand} style={{ fontSize: 12 }}>
            {expanded ? 'Show less ▴' : `Show ${hiddenCount} more funds ▾`}
          </button>
        </div>
      )}
    </div>
  );
}

function FundRow({ f, index, cfg, topAIRank }) {
  const isEligible = f.eligible !== false;
  const isTop = isEligible && topAIRank > 0;
  const rowBg = index % 2 === 0 ? 'rgba(12,16,28,0.5)' : 'transparent';
  const sebi = sebiIcon(f.amc_sebi);
  const exp = parseFloat(f.expense_ratio) || 0;
  const expCol = exp < 0.5 ? 'var(--green-text)' : exp > 1 ? 'var(--red-text)' : 'var(--text)';
  const ath = parseFloat(f.pct_from_ath) || 0;
  const athCol = ath < 10 ? 'var(--green-text)' : ath < 20 ? 'var(--amber-text)' : 'var(--red-text)';
  const top10 = parseFloat(f.top10_conc) || 0;
  const top10Col = top10 < 45 ? 'var(--green-text)' : top10 > 65 ? 'var(--red-text)' : 'var(--amber-text)';
  const cash = parseFloat(f.pct_cash) || 0;
  const cashCol = cash >= 3 && cash <= 10 ? 'var(--green-text)' : cash > 15 ? 'var(--red-text)' : 'var(--text)';

  const td = (style = {}, content) => (
    <td style={{
      padding: '7px 10px', fontSize: 11, borderBottom: '1px solid var(--border)',
      whiteSpace: 'nowrap',
      ...style,
    }}>{content}</td>
  );

  const stickyBase = { position: 'sticky', zIndex: 2, background: rowBg };

  return (
    <tr style={{ opacity: isEligible ? 1 : 0.5, background: rowBg, borderLeft: isTop ? `3px solid ${cfg.color}` : undefined }}>
      {/* IDENTITY */}
      {td({ ...stickyBase, left: 0, minWidth: 44, width: 44, borderRight: '1px solid var(--border)' },
        <span style={{ color: 'var(--text3)', fontWeight: 600 }}>
          {index + 1}
          {isTop && (
            <span style={{ background: cfg.color, color: '#fff', borderRadius: 3, padding: '0 4px', fontSize: 9, marginLeft: 4 }}>#{topAIRank}</span>
          )}
        </span>
      )}
      {td({ ...stickyBase, left: 44, minWidth: 220, maxWidth: 220, borderRight: '2px solid var(--border)',
            fontWeight: isTop ? 700 : 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis' },
        f.name
      )}
      {td({ color: 'var(--text3)' }, (f.amc || '').split(' ')[0])}
      {td({ textAlign: 'right' }, f.aum_cr != null ? <span className="tabular-nums">{Math.round(f.aum_cr).toLocaleString('en-IN')}</span> : <span style={{ color: 'var(--text4)' }}>—</span>)}
      {td({ textAlign: 'right', color: expCol }, exp ? <span className="tabular-nums">{exp.toFixed(2)}%</span> : '—')}
      {td({ textAlign: 'right', color: 'var(--text2)', borderRight: '2px solid var(--border)' },
        f.months_inception ? <span className="tabular-nums">{Math.round(f.months_inception / 12)}Y</span> : '—'
      )}

      {/* RETURNS */}
      {td({ textAlign: 'right' }, <RetCell v={f.ret_1y} />)}
      {td({ textAlign: 'right' }, <RetCell v={f.cagr_3y} />)}
      {td({ textAlign: 'right' }, <RetCell v={f.cagr_5y} />)}
      {td({ textAlign: 'right' }, <RetCell v={f.cagr_10y} />)}
      {td({ textAlign: 'right', borderRight: '2px solid var(--border)' }, <RetCell v={f.rolling_3y} />)}

      {/* vs CATEGORY */}
      {td({ textAlign: 'right' }, <VsCatCell v={f.vs_cat_1y} />)}
      {td({ textAlign: 'right' }, <VsCatCell v={f.vs_cat_3y} />)}
      {td({ textAlign: 'right', borderRight: '2px solid var(--border)' }, <VsCatCell v={f.vs_cat_5y} />)}

      {/* RISK */}
      {td({ textAlign: 'right' }, <SharpeCell v={f.sharpe} />)}
      {td({ textAlign: 'right' }, <SharpeCell v={f.sortino} />)}
      {td({ textAlign: 'right', color: 'var(--text2)' }, <NumCell v={f.volatility} dec={1} suffix="%" />)}
      {td({ textAlign: 'right', color: athCol, borderRight: '2px solid var(--border)' },
        <span className="tabular-nums">{fmtPct(ath) != null ? `${fmtPct(ath)}%` : '—'}</span>
      )}

      {/* PORTFOLIO */}
      {td({ textAlign: 'right' }, <PctCell v={f.pct_largecap} />)}
      {td({ textAlign: 'right' }, <PctCell v={f.pct_midcap} />)}
      {td({ textAlign: 'right' }, <PctCell v={f.pct_smallcap} />)}
      {td({ textAlign: 'right', color: cashCol }, <PctCell v={cash} />)}
      {td({ textAlign: 'right', borderRight: '2px solid var(--border)' }, <PctCell v={f.pct_debt} />)}

      {/* CONCENTRATION */}
      {td({ textAlign: 'right' }, <NumCell v={f.top3_conc} dec={1} suffix="%" />)}
      {td({ textAlign: 'right' }, <NumCell v={f.top5_conc} dec={1} suffix="%" />)}
      {td({ textAlign: 'right', color: top10Col, borderRight: '2px solid var(--border)' },
        <NumCell v={top10} dec={1} suffix="%" />
      )}

      {/* SCORE */}
      {td({ textAlign: 'center', fontSize: 14 }, isEligible ? (
        <span title={`SEBI: ${sebi.label}`}>{sebi.icon}</span>
      ) : '—')}
      {td({
        textAlign: 'right',
        fontWeight: 700,
        fontSize: isEligible ? 13 : 10,
        color: isEligible
          ? (f.dni ? (f.dni.level === 'red' ? 'var(--red-text)' : 'var(--amber-text)') : cfg.color)
          : 'var(--text4)',
        maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis',
      },
        isEligible
          ? <span className="tabular-nums">{f.dni ? (f.dni.level === 'red' ? '🚫 ' : '⚠️ ') : ''}{Math.round(f.score || 0)}</span>
          : (Array.isArray(f.filter_reasons) && f.filter_reasons[0] ? f.filter_reasons[0] : 'Not eligible')
      )}
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FundCard (preserved with small improvements)
// ─────────────────────────────────────────────────────────────────────────────
function FundCard({ fund, rank, cfg, featured }) {
  const f = fund;
  const score = Math.round(f.score || 0);
  const rankLabel = rank === 1 ? 'Top pick' : rank === 2 ? 'Runner up' : `#${rank}`;
  const sebi = sebiIcon(f.amc_sebi);

  return (
    <div className={`card ${featured ? 'card-premium' : ''}`} style={{ padding: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px',
          borderRadius: 9999, fontSize: 10, fontWeight: 700,
          background: featured ? 'var(--gradient)' : 'var(--brand-bg)',
          color: featured ? '#fff' : 'var(--brand-text)',
          whiteSpace: 'nowrap',
        }}>
          #{rank}
        </span>
        <span title={`SEBI: ${sebi.label}`} style={{
          marginLeft: 'auto', fontSize: 9, fontWeight: 600,
          color: f.amc_sebi === 'probe' ? 'var(--red-text)' : f.amc_sebi === 'action' ? 'var(--amber-text)' : 'var(--green-text)',
          background: f.amc_sebi === 'probe' ? 'var(--red-bg)' : f.amc_sebi === 'action' ? 'var(--amber-bg)' : 'var(--green-bg)',
          padding: '2px 6px', borderRadius: 5, whiteSpace: 'nowrap',
        }}>
          {sebi.icon} {sebi.label}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div title={f.name} style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', lineHeight: 1.25, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {f.name}
          </div>
          <div title={f.amc || ''} style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {f.amc || ''}{f.aum_cr ? ` · ₹${Math.round(f.aum_cr)}Cr` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="tabular-nums gradient-fill" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.5px' }}>{score}</div>
          <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>/ 100</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 6 }}>
        {[['1Y', f.ret_1y], ['3Y', f.cagr_3y], ['5Y', f.cagr_5y], ['10Y', f.cagr_10y]].map(([label, val]) => {
          const n = parseFloat(val);
          const ok = val != null && !isNaN(n);
          return (
            <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '5px 2px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 1, fontWeight: 600 }}>{label}</div>
              <div className="tabular-nums" style={{ fontSize: 11, fontWeight: 700, color: ok ? (n >= 0 ? 'var(--green-text)' : 'var(--red-text)') : 'var(--text4)' }}>
                {ok ? `${n >= 0 ? '+' : ''}${n.toFixed(1)}%` : '—'}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        {[
          ['Sharpe', f.sharpe, (v) => v > 0 ? 'var(--green-text)' : 'var(--red-text)'],
          ['Exp', f.expense_ratio, (v) => v < 0.5 ? 'var(--green-text)' : v > 1 ? 'var(--red-text)' : 'var(--text)'],
          ['DD', f.maxDD || f.max_drawdown || f.pct_from_ath, () => 'var(--red-text)'],
        ].map(([label, val, colorFn]) => {
          const n = parseFloat(val);
          const ok = !isNaN(n);
          return (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 5, fontSize: 10 }}>
              <span style={{ color: 'var(--text3)', fontWeight: 500 }}>{label}</span>
              <span className="tabular-nums" style={{ fontWeight: 700, color: ok ? colorFn(n) : 'var(--text4)' }}>
                {ok ? (label === 'Exp' ? `${n.toFixed(2)}` : n.toFixed(2)) : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
