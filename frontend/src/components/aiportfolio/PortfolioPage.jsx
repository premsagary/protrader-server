import React, { useEffect, useState, useRef, useCallback } from 'react';
import { usePortfolioStore } from '../../store/usePortfolioStore';
import StatCard from '../shared/StatCard';
import ConvictionPill from '../shared/ConvictionPill';
import EmptyState from '../shared/EmptyState';
import LoadingSkeleton from '../shared/LoadingSkeleton';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { PORTFOLIO_TABS } from '../../utils/constants';
import { formatPercent, formatDate, formatTime } from '../../utils/formatters';

function psFmt(n) {
  if (n == null || isNaN(n)) return '--';
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/* ── Model Portfolio Tab ── */
function ModelTab() {
  const { modelData, amount, setAmount, loading, generate, refresh, regenerate, fetchModel, error,
    aiValidation, aiReviews, fetchAIValidation, fetchAIReviews, runAIValidation, checkAIStatus,
    signals, fetchSignals, positions,
  } = usePortfolioStore();
  const [aiRunning, setAiRunning] = useState(false);
  const [aiProgress, setAiProgress] = useState(null);
  const [expandedAI, setExpandedAI] = useState({});

  useEffect(() => {
    if (!modelData && !loading) fetchModel(amount);
    if (!signals) fetchSignals();
    if (!aiValidation) fetchAIValidation();
    if (!aiReviews) fetchAIReviews();
  }, []);

  // Auto-refresh every 60s
  useAutoRefresh(() => { if (modelData) refresh(); }, 60000, !!modelData);

  const doAIReview = async () => {
    setAiRunning(true);
    setAiProgress('Starting...');
    const pollInterval = setInterval(async () => {
      const st = await checkAIStatus(Date.now() - 120000);
      if (st?.models) {
        const done = Object.values(st.models).filter((m) => m.status === 'ok' || m.status === 'error' || m.status === 'skipped').length;
        const total = Object.keys(st.models).length;
        setAiProgress(`${done}/${total} models completed...`);
      }
      if (st && !st.running) clearInterval(pollInterval);
    }, 2000);
    try {
      await runAIValidation('deep');
      await fetchAIValidation();
      await fetchAIReviews();
    } catch (e) { /* handled in store */ }
    finally { clearInterval(pollInterval); setAiRunning(false); setAiProgress(null); }
  };

  const amounts = [{ l: 'Rs50K', v: 50000 }, { l: 'Rs1L', v: 100000 }, { l: 'Rs2.5L', v: 250000 }, { l: 'Rs5L', v: 500000 }, { l: 'Rs10L', v: 1000000 }, { l: 'Rs25L', v: 2500000 }];
  const p = modelData?.portfolio || [];
  const s = modelData?.summary || {};
  const mn = { 'groq-llama': 'Groq', 'gpt-nano': 'GPT-nano', 'deepseek': 'DeepSeek', 'claude-haiku': 'Haiku', 'mistral': 'Mistral' };

  // Sort: active BUY/HOLD top, WATCH bench middle, EXIT/REDUCE bottom
  const pSorted = [...p].sort((a, b) => {
    const sellActions = { EXIT: 1, REDUCE: 1, 'BOOK PROFIT': 1, REVIEW: 1 };
    const aOrder = sellActions[a.action] ? 2 : (a.action === 'WATCH' || a.isBench) ? 1 : 0;
    const bOrder = sellActions[b.action] ? 2 : (b.action === 'WATCH' || b.isBench) ? 1 : 0;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (b.composite || 0) - (a.composite || 0);
  });

  const getAIReview = (sym) => {
    let r = null;
    if (aiValidation?.signal_reviews) r = aiValidation.signal_reviews.find((rv) => rv.sym === sym);
    if (!r && aiReviews?.stocks) {
      const found = aiReviews.stocks.find((rv) => rv.sym === sym);
      if (found) r = { sym, per_model: found.models, agrees: found.agrees, disagrees: found.disagrees };
    }
    return r;
  };

  return (
    <div>
      {/* Input section */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div className="flex items-center gap-3 flex-wrap">
          <div style={{ fontSize: 13, fontWeight: 600 }}>Investment Amount:</div>
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 14, color: 'var(--text2)' }}>Rs</span>
            <input type="number" value={amount} min={5000} max={100000000} onChange={(e) => setAmount(parseFloat(e.target.value) || 100000)}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 14, fontWeight: 700, width: 160, textAlign: 'right' }} className="tabular-nums"
            />
          </div>
          {amounts.map((a) => (
            <button key={a.v} onClick={() => setAmount(a.v)} style={{ background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 5, padding: '5px 10px', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>{a.l}</button>
          ))}
          <button onClick={generate} disabled={loading} style={{ background: 'linear-gradient(135deg,var(--teal),var(--blue))', color: '#000', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 800, cursor: loading ? 'wait' : 'pointer', marginLeft: 'auto' }}>
            {loading ? 'Analyzing...' : 'Generate Portfolio'}
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div style={{ fontSize: 10, color: 'var(--text4)', flex: 1 }}>5-factor model: FA 30% + TA 25% + Valuation 15% + Momentum 15% + Risk 15%. Market regime-aware cash allocation.</div>
          <button onClick={doAIReview} disabled={aiRunning} style={{ background: 'linear-gradient(135deg,rgba(34,197,94,.15),rgba(34,211,238,.15))', color: 'var(--green)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 8, padding: '8px 16px', fontSize: 11, fontWeight: 700, cursor: aiRunning ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
            {aiRunning ? 'Running...' : 'AI Deep Review'}
          </button>
        </div>
        {aiRunning && aiProgress && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>{aiProgress}</div>}
      </div>

      {/* AI Validation Panel */}
      {aiValidation && !aiValidation.error && (
        <div style={{ background: 'linear-gradient(135deg,rgba(34,197,94,.06),rgba(34,211,238,.06))', border: '1px solid rgba(34,197,94,.2)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div className="flex justify-between items-center mb-2">
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--green)' }}>AI Multi-Model Consensus</div>
            <div style={{ fontSize: 9, color: 'var(--text4)' }}>{aiValidation.models_used || 0}/{aiValidation.models_total || 0} models{aiValidation.took_ms ? ` -- ${(aiValidation.took_ms / 1000).toFixed(1)}s` : ''}</div>
          </div>
          {aiValidation.model_details?.length > 0 && (
            <div className="flex gap-1 flex-wrap mb-2.5">
              {aiValidation.model_details.map((md) => {
                const sc = md.status === 'ok' ? 'var(--green)' : md.status === 'skipped' ? 'var(--text4)' : 'var(--red)';
                return <span key={md.name} style={{ background: `${sc}15`, color: sc, borderRadius: 4, padding: '2px 6px', fontSize: 8, fontWeight: 700 }}>{md.status === 'ok' ? 'OK' : md.status === 'skipped' ? 'Skip' : 'Err'} {md.name}</span>;
              })}
            </div>
          )}
          {aiValidation.overall_assessment && <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10, lineHeight: 1.5 }}>{aiValidation.overall_assessment}</div>}
        </div>
      )}

      {/* Results */}
      {loading && !modelData ? (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text3)' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Analyzing 500+ stocks...</div>
          <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 4 }}>Building model portfolio with 5-factor Varsity scoring</div>
        </div>
      ) : !modelData ? (
        <EmptyState message="Loading model portfolio... Change amount above and click Generate to customize." />
      ) : (
        <div>
          {/* Regime banner */}
          {s.regime && (
            <div style={{ background: `${s.regime === 'BULL' ? '#22c55e' : s.regime === 'BEAR' ? '#ef4444' : '#f59e0b'}12`, border: `1px solid ${s.regime === 'BULL' ? '#22c55e' : s.regime === 'BEAR' ? '#ef4444' : '#f59e0b'}30`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, color: s.regime === 'BULL' ? '#22c55e' : s.regime === 'BEAR' ? '#ef4444' : '#f59e0b', fontSize: 12 }}>{s.regime} MARKET</span>
              {s.cashPct != null && <span style={{ fontSize: 10, color: 'var(--text3)' }}>Cash: {s.cashPct}%</span>}
            </div>
          )}

          {/* Summary cards */}
          <div className="grid gap-2 mb-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
            <StatCard label="Invested" value={psFmt(s.totalInvested)} valueColor="var(--teal)" />
            <StatCard label="Stocks" value={s.numStocks || 0} subtitle={`${s.numSectors || 0} sectors`} />
            <StatCard label="Avg Score" value={`${s.avgComposite || 0}/100`} valueColor={s.avgComposite >= 60 ? 'var(--green)' : s.avgComposite >= 45 ? 'var(--amber)' : 'var(--red)'} />
            <StatCard label="Beta" value={s.portfolioBeta || '--'} valueColor={s.portfolioBeta < 1 ? 'var(--green)' : s.portfolioBeta < 1.3 ? 'var(--amber)' : 'var(--red)'} />
            {s.totalPnl != null && <StatCard label="P&L" value={`${s.totalPnl >= 0 ? '+' : ''}${psFmt(s.totalPnl)}`} subtitle={`${s.totalPnlPct || 0}%`} valueColor={s.totalPnl >= 0 ? 'var(--green)' : 'var(--red)'} />}
            {s.cashRemaining > 0 && <StatCard label="Cash" value={psFmt(s.cashRemaining)} subtitle={`${s.cashPct}% buffer`} />}
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2 mb-2.5 flex-wrap">
            <button onClick={refresh} style={{ background: 'rgba(34,211,238,.1)', color: 'var(--teal)', border: '1px solid rgba(34,211,238,.25)', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Refresh</button>
            <button onClick={regenerate} style={{ background: 'rgba(245,158,11,.1)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Regenerate</button>
            <span style={{ fontSize: 10, color: 'var(--text4)', marginLeft: 'auto' }}>{s.lastRefreshed ? `Refreshed ${formatTime(s.lastRefreshed)}` : s.generatedAt ? `Generated ${formatTime(s.generatedAt)}` : ''}</span>
          </div>

          {/* Portfolio table */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                {['#', 'Stock', 'AI', 'Sector', 'Price', 'Shares', 'Alloc', 'Conv.', 'Score', 'Signal', 'SL', 'Target', 'R:R', 'Track'].map((h) => (
                  <th key={h} style={{ padding: '7px 5px', textAlign: 'left', fontSize: 10, color: 'var(--text3)', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {pSorted.map((stk, i) => {
                  const isSell = ['EXIT', 'REDUCE', 'BOOK PROFIT', 'REVIEW'].includes(stk.action);
                  const isBench = stk.action === 'WATCH' || stk.isBench;
                  const rowBg = isSell ? 'rgba(239,68,68,.04)' : isBench ? 'rgba(100,116,139,.04)' : (i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)');
                  const aiR = getAIReview(stk.sym);
                  const pm = aiR?.per_model || aiR?.models || {};
                  const pmKeys = Object.keys(pm);

                  return (
                    <React.Fragment key={stk.sym}>
                      <tr style={{ background: rowBg, borderBottom: '1px solid var(--border2)', opacity: isSell ? 0.7 : isBench ? 0.6 : 1 }}>
                        <td style={{ padding: 5, color: 'var(--text3)' }}>{i + 1}</td>
                        <td style={{ padding: 5 }}>
                          <div className="flex items-center gap-1" style={{ fontWeight: 700, fontSize: 11 }}>
                            {stk.sym}
                            {isSell && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 3, padding: '1px 5px', fontSize: 8, fontWeight: 800, textTransform: 'uppercase' }}>{stk.action}</span>}
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text4)' }}>{stk.name}</div>
                        </td>
                        <td style={{ padding: 5, verticalAlign: 'top' }}>
                          {aiR && pmKeys.length > 0 ? (
                            <div style={{ fontSize: 8, fontWeight: 700, lineHeight: 1.6 }}>
                              {(() => {
                                let agree = 0, disagree = 0, modify = 0;
                                pmKeys.forEach((mid) => { const v = pm[mid].verdict; if (v === 'AGREE') agree++; else if (v === 'DISAGREE') disagree++; else if (v === 'MODIFY') modify++; });
                                return (<>
                                  {agree > 0 && <div style={{ color: 'var(--green)' }}>OK {agree} Agreed</div>}
                                  {modify > 0 && <div style={{ color: 'var(--amber)' }}>! {modify} Caution</div>}
                                  {disagree > 0 && <div style={{ color: 'var(--red)' }}>X {disagree} Disagree</div>}
                                </>);
                              })()}
                              <div onClick={() => setExpandedAI((p) => ({ ...p, [stk.sym]: !p[stk.sym] }))} style={{ color: 'var(--teal)', cursor: 'pointer', marginTop: 1, fontWeight: 600 }}>
                                {expandedAI[stk.sym] ? 'Hide' : 'Show'} AI ({pmKeys.length})
                              </div>
                            </div>
                          ) : <span style={{ fontSize: 8, color: 'var(--text4)' }}>--</span>}
                        </td>
                        <td style={{ padding: 5, color: 'var(--text3)', fontSize: 10 }}>{stk.sector}</td>
                        <td style={{ padding: 5, fontWeight: 600 }} className="tabular-nums">Rs{(stk.currentPrice || stk.price || 0).toFixed(0)}</td>
                        <td style={{ padding: 5, fontWeight: 600 }} className="tabular-nums">{stk.shares}</td>
                        <td style={{ padding: 5, fontSize: 10 }}>{psFmt(stk.allocAmt)} <span style={{ color: 'var(--text4)' }}>({stk.allocPct}%)</span></td>
                        <td style={{ padding: 5 }}><ConvictionPill tier={stk.conviction} /></td>
                        <td style={{ padding: 5, fontWeight: 700, color: stk.composite >= 60 ? 'var(--green)' : stk.composite >= 45 ? 'var(--amber)' : 'var(--red)' }} className="tabular-nums">{stk.composite}</td>
                        <td style={{ padding: 5 }}>
                          <span style={{ background: `${isSell ? '#ef4444' : (stk.actionColor || 'var(--green)')}20`, color: isSell ? '#ef4444' : (stk.actionColor || 'var(--green)'), borderRadius: 3, padding: '1px 6px', fontSize: 9, fontWeight: 800, whiteSpace: 'nowrap' }}>{stk.action || 'BUY'}</span>
                        </td>
                        <td style={{ padding: 5, color: 'var(--red)', fontSize: 10 }} className="tabular-nums">{stk.stopLoss ? `₹${stk.stopLoss}` : '--'}</td>
                        <td style={{ padding: 5, color: 'var(--green)', fontSize: 10 }} className="tabular-nums">{stk.target ? `₹${stk.target}` : '--'}</td>
                        <td style={{ padding: 5, fontWeight: 700, color: stk.rrRatio >= 2 ? 'var(--green)' : 'var(--amber)' }} className="tabular-nums">{stk.rrRatio ? `${stk.rrRatio}x` : '--'}</td>
                        <td style={{ padding: 5 }}>
                          {isSell ? <span style={{ fontSize: 9, color: 'var(--red)', fontWeight: 700 }}>Don't buy</span>
                            : isBench ? <span style={{ fontSize: 9, color: 'var(--text4)', fontWeight: 600 }}>Bench</span>
                            : <button onClick={() => {
                              const qty = prompt(`How many shares of ${stk.sym}?`, stk.shares);
                              if (!qty) return;
                              const price = prompt(`At what price?`, (stk.currentPrice || stk.price || 0).toFixed(2));
                              if (!price) return;
                              usePortfolioStore.getState().buyStock(stk.sym, parseInt(qty), parseFloat(price));
                            }} style={{ background: 'rgba(34,211,238,.15)', color: 'var(--teal)', border: '1px solid rgba(34,211,238,.3)', borderRadius: 4, padding: '2px 8px', fontSize: 9, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>I Bought</button>
                          }
                        </td>
                      </tr>
                      {/* Expanded AI row */}
                      {expandedAI[stk.sym] && aiR && pmKeys.length > 0 && (
                        <tr style={{ background: 'var(--bg2)' }}>
                          <td colSpan={14} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--teal)', marginBottom: 6 }}>AI Model Reviews for {stk.sym}</div>
                            <div className="grid gap-1">
                              {pmKeys.map((mid) => {
                                const mv = pm[mid];
                                const vc = mv.verdict === 'AGREE' ? 'var(--green)' : mv.verdict === 'DISAGREE' ? 'var(--red)' : mv.verdict === 'NO_REVIEW' ? 'var(--text4)' : 'var(--amber)';
                                return (
                                  <div key={mid} style={{ background: 'var(--bg)', borderRadius: 5, padding: '6px 10px', borderLeft: `3px solid ${vc}`, opacity: mv.verdict === 'NO_REVIEW' ? 0.5 : 1 }}>
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span style={{ fontSize: 10, fontWeight: 800, color: vc }}>{mn[mid] || mv.model_name || mid}</span>
                                      <span style={{ fontSize: 8, fontWeight: 800, color: vc, textTransform: 'uppercase', background: `${vc}15`, padding: '1px 5px', borderRadius: 3 }}>{mv.verdict?.replace('_', ' ')}</span>
                                      {mv.confidence && mv.verdict !== 'NO_REVIEW' && <span style={{ fontSize: 8, color: 'var(--text4)' }}>{mv.confidence}% conf</span>}
                                    </div>
                                    {mv.varsity_reasoning && <div style={{ fontSize: 9, color: 'var(--text3)', lineHeight: 1.4, marginTop: 2 }}>{mv.varsity_reasoning}</div>}
                                    {mv.risk_flag && mv.verdict !== 'NO_REVIEW' && <div style={{ fontSize: 9, color: '#f97316', marginTop: 2 }}>Warning: {mv.risk_flag}</div>}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Sector breakdown */}
          {s.sectorBreakdown && (
            <div style={{ marginTop: 12, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: 'var(--text2)' }}>Sector Allocation</div>
              <div className="flex gap-1.5 flex-wrap">
                {Object.keys(s.sectorBreakdown).sort((a, b) => s.sectorBreakdown[b] - s.sectorBreakdown[a]).map((sec) => (
                  <div key={sec} style={{ background: 'var(--bg3)', borderRadius: 5, padding: '3px 8px', fontSize: 10 }}>
                    <span style={{ color: 'var(--text3)' }}>{sec}</span> <span style={{ fontWeight: 700 }}>{s.sectorBreakdown[sec].toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Holdings Tab ── */
function HoldingsTab() {
  const { positions, fetchPositions } = usePortfolioStore();
  useEffect(() => { if (!positions) fetchPositions(); }, []);

  const pos = positions?.positions || [];
  const sm = positions?.summary || {};

  if (!positions) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading holdings...</div>;
  if (!pos.length) return <EmptyState message="No holdings yet. Generate a model portfolio and click 'I Bought' on stocks you purchased." />;

  return (
    <div>
      {sm.urgentSignals > 0 && (
        <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
          <span style={{ fontWeight: 800, color: 'var(--red)', fontSize: 12 }}>Warning: {sm.urgentSignals} urgent signal{sm.urgentSignals > 1 ? 's' : ''}</span>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}> -- review positions below</span>
        </div>
      )}

      <div className="grid gap-2 mb-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        <StatCard label="Invested" value={psFmt(sm.totalInvested)} valueColor="var(--teal)" />
        <StatCard label="Current Value" value={psFmt(sm.currentValue)} valueColor={sm.totalPnl >= 0 ? 'var(--green)' : 'var(--red)'} />
        <StatCard label="P&L" value={`${sm.totalPnl >= 0 ? '+' : ''}${psFmt(sm.totalPnl)}`} subtitle={`${sm.totalPnlPct || 0}%`} valueColor={sm.totalPnl >= 0 ? 'var(--green)' : 'var(--red)'} />
        <StatCard label="Positions" value={sm.numPositions || pos.length} />
      </div>

      <div className="flex gap-2 mb-2.5">
        <button onClick={fetchPositions} style={{ background: 'rgba(34,211,238,.1)', color: 'var(--teal)', border: '1px solid rgba(34,211,238,.25)', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Refresh</button>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead><tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
            {['Stock', 'Qty', 'Avg Price', 'Current', 'Invested', 'Value', 'P&L', 'P&L%', 'Signal', 'Actions'].map((h) => (
              <th key={h} style={{ padding: '7px 5px', textAlign: 'left', fontSize: 10, color: 'var(--text3)', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {pos.map((p, i) => {
              const pnlC = (p.unrealised_pct || 0) >= 0 ? 'var(--green)' : 'var(--red)';
              return (
                <tr key={p.id || i} style={{ background: i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)', borderBottom: '1px solid var(--border2)' }}>
                  <td style={{ padding: 5 }}><div style={{ fontWeight: 700 }}>{p.sym}</div><div style={{ fontSize: 9, color: 'var(--text4)' }}>{p.name || ''}</div></td>
                  <td style={{ padding: 5, fontWeight: 600 }}>{p.qty}</td>
                  <td style={{ padding: 5 }} className="tabular-nums">Rs{(+p.avg_price).toFixed(0)}</td>
                  <td style={{ padding: 5, fontWeight: 600 }} className="tabular-nums">Rs{(+p.currentPrice).toFixed(0)}</td>
                  <td style={{ padding: 5 }} className="tabular-nums">{psFmt(p.invested_amt)}</td>
                  <td style={{ padding: 5, fontWeight: 600, color: pnlC }} className="tabular-nums">{psFmt(p.currentValue)}</td>
                  <td style={{ padding: 5, fontWeight: 700, color: pnlC }} className="tabular-nums">{p.unrealised_pnl >= 0 ? '+' : ''}{psFmt(p.unrealised_pnl)}</td>
                  <td style={{ padding: 5, fontWeight: 700, color: pnlC }} className="tabular-nums">{p.unrealised_pct >= 0 ? '+' : ''}{p.unrealised_pct}%</td>
                  <td style={{ padding: 5 }}>
                    <span style={{ background: `${p.actionColor || 'var(--amber)'}20`, color: p.actionColor || 'var(--amber)', borderRadius: 3, padding: '1px 6px', fontSize: 9, fontWeight: 800 }}>{p.action || 'HOLD'}</span>
                  </td>
                  <td style={{ padding: 5, whiteSpace: 'nowrap' }}>
                    <button onClick={() => {
                      const price = prompt(`Sell ${p.sym} at what price?`, (+p.currentPrice).toFixed(2));
                      if (!price) return;
                      usePortfolioStore.getState().sellPosition(p.id);
                    }} style={{ background: 'rgba(239,68,68,.12)', color: 'var(--red)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 3, padding: '2px 6px', fontSize: 9, fontWeight: 700, cursor: 'pointer', marginRight: 3 }}>Sell</button>
                    <button onClick={() => {
                      const qty = prompt(`How many more shares of ${p.sym}?`);
                      if (!qty) return;
                      usePortfolioStore.getState().addPosition({ id: p.id, qty: parseInt(qty), price: +p.currentPrice });
                    }} style={{ background: 'rgba(34,211,238,.12)', color: 'var(--teal)', border: '1px solid rgba(34,211,238,.25)', borderRadius: 3, padding: '2px 6px', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>Add</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Performance Tab ── */
function PerformanceTab() {
  const { performance, risk, fetchPerformance } = usePortfolioStore();
  useEffect(() => { if (!performance) fetchPerformance(); }, []);

  if (!performance) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading performance & risk...</div>;

  const st = performance.stats || {};
  const rk = risk || performance.risk || {};
  const ec = performance.equityCurve || rk.equityCurve || [];
  const ct = performance.closedTrades || [];

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <button onClick={fetchPerformance} style={{ background: 'rgba(34,211,238,.1)', color: 'var(--teal)', border: '1px solid rgba(34,211,238,.25)', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Refresh</button>
      </div>

      {/* Risk Dashboard */}
      {rk.numPositions > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Risk Dashboard</div>
          <div className="grid gap-2 mb-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
            {rk.riskRating && <StatCard label="Risk Rating" value={rk.riskRating} valueColor={rk.riskColor} />}
            {rk.portfolioVol != null && <StatCard label="Portfolio Vol" value={`${rk.portfolioVol}%`} subtitle="annualized" valueColor={rk.portfolioVol < 25 ? 'var(--green)' : rk.portfolioVol < 35 ? 'var(--amber)' : 'var(--red)'} />}
            {rk.portfolioBeta != null && <StatCard label="Beta" value={rk.portfolioBeta} valueColor={rk.portfolioBeta < 1 ? 'var(--green)' : rk.portfolioBeta < 1.3 ? 'var(--amber)' : 'var(--red)'} />}
            {rk.var95_1d != null && <StatCard label="VaR (1-day)" value={psFmt(rk.var95_1d)} subtitle="95% confidence" valueColor="var(--red)" />}
            {rk.maxDrawdown != null && <StatCard label="Max Drawdown" value={`${rk.maxDrawdown}%`} subtitle="from peak" valueColor={rk.maxDrawdown < -10 ? 'var(--red)' : rk.maxDrawdown < -5 ? 'var(--amber)' : 'var(--green)'} />}
          </div>

          {/* Sector exposure */}
          {rk.sectorPcts && (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: 'var(--text2)' }}>Sector Exposure</div>
              {Object.entries(rk.sectorPcts).sort((a, b) => b[1] - a[1]).map(([sec, pct]) => {
                const warn = pct > 30;
                return (
                  <div key={sec} className="flex items-center gap-2 mb-1">
                    <div style={{ width: 100, fontSize: 10, color: 'var(--text3)', textAlign: 'right' }}>{sec}</div>
                    <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: 3, height: 16, position: 'relative' }}>
                      <div style={{ width: `${Math.min(pct, 100)}%`, background: warn ? 'var(--red)' : 'var(--teal)', height: '100%', borderRadius: 3 }} />
                    </div>
                    <div style={{ width: 40, fontSize: 10, fontWeight: 700, color: warn ? 'var(--red)' : 'var(--text)' }}>{pct}%</div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Trade Stats */}
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Trade Performance</div>
      <div className="grid gap-2 mb-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        <StatCard label="Total Trades" value={st.totalTrades || 0} />
        <StatCard label="Win Rate" value={`${st.winRate || 0}%`} valueColor={(st.winRate || 0) >= 50 ? 'var(--green)' : 'var(--red)'} />
        <StatCard label="Wins / Losses" value={`${st.wins || 0} / ${st.losses || 0}`} valueColor={(st.wins || 0) > (st.losses || 0) ? 'var(--green)' : 'var(--red)'} />
        <StatCard label="Total P&L" value={`${(st.totalRealised || 0) >= 0 ? '+' : ''}${psFmt(st.totalRealised || 0)}`} valueColor={(st.totalRealised || 0) >= 0 ? 'var(--green)' : 'var(--red)'} />
      </div>

      {/* Equity Curve */}
      {ec.length > 1 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: 'var(--text2)' }}>Equity Curve</div>
          <div className="flex items-end gap-0.5" style={{ height: 100 }}>
            {(() => {
              const maxV = Math.max(...ec.map((s) => s.current_value || 0));
              const minV = Math.min(...ec.map((s) => s.current_value || 0));
              const range = maxV - minV || 1;
              return ec.map((s, i) => {
                const pct = ((s.current_value - minV) / range) * 100;
                const col = (s.total_pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)';
                return <div key={i} title={`${formatDate(s.snap_date)}: ${psFmt(s.current_value)}`} style={{ flex: 1, minWidth: 4, background: col, borderRadius: '2px 2px 0 0', height: `${Math.max(pct, 2)}%` }} />;
              });
            })()}
          </div>
          <div className="flex justify-between mt-1" style={{ fontSize: 9, color: 'var(--text4)' }}>
            <span>{formatDate(ec[0]?.snap_date)}</span>
            <span>{formatDate(ec[ec.length - 1]?.snap_date)}</span>
          </div>
        </div>
      )}

      {/* Closed trades */}
      {ct.length > 0 ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Closed Trades</div>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                {['Stock', 'Buy Date', 'Sell Date', 'P&L', 'P&L%'].map((h) => <th key={h} style={{ padding: '7px 6px', textAlign: 'left', fontSize: 10, color: 'var(--text3)', fontWeight: 700 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {ct.map((t, i) => {
                  const c = (t.realised_pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)';
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)' }}>
                      <td style={{ padding: 5, fontWeight: 700 }}>{t.sym}</td>
                      <td style={{ padding: 5, fontSize: 10, color: 'var(--text3)' }}>{t.buy_date ? formatDate(t.buy_date) : '--'}</td>
                      <td style={{ padding: 5, fontSize: 10, color: 'var(--text3)' }}>{t.sell_date ? formatDate(t.sell_date) : '--'}</td>
                      <td style={{ padding: 5, fontWeight: 700, color: c }} className="tabular-nums">{t.realised_pnl >= 0 ? '+' : ''}Rs{(+t.realised_pnl).toFixed(0)}</td>
                      <td style={{ padding: 5, fontWeight: 700, color: c }} className="tabular-nums">{t.realised_pct >= 0 ? '+' : ''}{(+t.realised_pct).toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)', fontSize: 12 }}>No closed trades yet. Sell positions to see performance history.</div>}
    </div>
  );
}

/* ========== MAIN PORTFOLIO PAGE ========== */
export default function PortfolioPage() {
  const { tab, setTab, error } = usePortfolioStore();

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 1300, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--teal)' }}>Portfolio Manager</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>Varsity-powered fund manager -- Live signals -- Auto-refresh</div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1.5 mb-3.5 flex-wrap">
        {[{ id: 'model', l: 'Model Portfolio' }, { id: 'holdings', l: 'My Holdings' }, { id: 'performance', l: 'Performance' }].map((t) => {
          const act = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: act ? 'rgba(34,211,238,.2)' : 'var(--bg3)', color: act ? 'var(--teal)' : 'var(--text3)',
              border: `1px solid ${act ? 'rgba(34,211,238,.4)' : 'var(--border2)'}`, borderRadius: 6, padding: '6px 14px',
              fontSize: 11, fontWeight: act ? 800 : 600, cursor: 'pointer',
            }}>{t.l}</button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'model' && <ModelTab />}
      {tab === 'holdings' && <HoldingsTab />}
      {tab === 'performance' && <PerformanceTab />}

      {error && <div className="text-sm mt-4" style={{ color: 'var(--red)' }}>Error: {error}</div>}
    </div>
  );
}
