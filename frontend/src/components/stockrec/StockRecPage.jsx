import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useStockRecStore } from '../../store/useStockRecStore';
import ConvictionPill from '../shared/ConvictionPill';
import HorizonPill from '../shared/HorizonPill';
import ScoreBar from '../shared/ScoreBar';
import LoadingSkeleton from '../shared/LoadingSkeleton';
import EmptyState from '../shared/EmptyState';
import { STOCK_FILTERS } from '../../utils/constants';
import { formatPercent } from '../../utils/formatters';

/* ── Helpers ── */
const na = <span style={{ color: 'var(--text4)' }}>-</span>;
function _rv(v, dec, suffix, col) { if (v == null) return na; const n = parseFloat(v); if (isNaN(n)) return na; const str = n.toFixed(dec || 0) + (suffix || ''); const c = col || (n > 0 ? 'var(--green)' : n < 0 ? 'var(--red)' : 'var(--text)'); return <span style={{ color: c }}>{str}</span>; }
function _pe(v) { if (v == null) return na; const n = parseFloat(v); const c = n < 15 ? 'var(--green)' : n < 25 ? 'var(--text)' : n < 40 ? 'var(--amber)' : 'var(--red)'; return <span style={{ color: c }}>{n.toFixed(1)}</span>; }
function _roe(v) { if (v == null) return na; const n = parseFloat(v); const c = n >= 20 ? 'var(--green)' : n >= 15 ? 'var(--amber)' : n >= 10 ? 'var(--text)' : 'var(--red)'; return <span style={{ color: c }}>{n.toFixed(1)}</span>; }
function _pct(v) { return _rv(v, 1, '%'); }
function _ratio(v) { return _rv(v, 2, '', 'var(--text)'); }
function _num(v, dec) { if (v == null) return na; return <span style={{ color: 'var(--text)' }}>{parseFloat(v).toFixed(dec || 0)}</span>; }
function _de(v) { return _rv(v, 2, 'x', v != null && v < 1 ? 'var(--green)' : v != null && v < 2 ? 'var(--text)' : 'var(--red)'); }
function _rsi(v) { if (v == null) return na; return <span style={{ color: v >= 45 && v <= 65 ? 'var(--green)' : v > 75 ? 'var(--red)' : 'var(--amber)' }}>{v}</span>; }
function _gc(v) { return v == null ? na : v ? <span style={{ color: 'var(--amber)' }}>Yes</span> : <span style={{ color: 'var(--red)' }}>No</span>; }
function _dma(v, px) { if (v == null) return na; const n = parseFloat(v); const c = px && n ? (px > n ? 'var(--green)' : 'var(--red)') : 'var(--text4)'; return <span style={{ color: c }}>{n.toFixed(1)}</span>; }
function _fromHi(v) { return _rv(v, 1, '%', v != null && v > -10 ? 'var(--green)' : v != null && v > -20 ? 'var(--amber)' : 'var(--red)'); }
function _price(v) { return v ? `₹${parseFloat(v).toFixed(1)}` : '-'; }
function _crore(v) { if (v == null) return na; const n = parseFloat(v); if (Math.abs(n) >= 100000) return <span style={{ color: 'var(--text)' }}>{(n / 100000).toFixed(1)}L Cr</span>; if (Math.abs(n) >= 100) return <span style={{ color: 'var(--text)' }}>{n.toFixed(0)} Cr</span>; return <span style={{ color: 'var(--text)' }}>{n.toFixed(1)}</span>; }
function _vol(v) { if (v == null) return na; return <span style={{ color: v > 1.2 ? 'var(--green)' : v > 0.8 ? 'var(--text)' : 'var(--red)' }}>{v}x</span>; }
function _trend(v) { if (!v) return na; const c = v === 'up' || v === 'bullish' ? 'var(--green)' : v === 'down' || v === 'bearish' ? 'var(--red)' : 'var(--text)'; return <span style={{ color: c }}>{v}</span>; }
function _fa(v) { return v ? <span style={{ color: 'var(--amber)', fontWeight: 700 }}>Yes</span> : <span style={{ color: 'var(--text4)' }}>No</span>; }

/* ── Tab definitions ── */
const TAB_DEFS = [
  { id: 'overview', label: 'Overview' }, { id: 'quality', label: 'Quality' }, { id: 'value', label: 'Value' },
  { id: 'momentum', label: 'Momentum' }, { id: 'growth', label: 'Growth' }, { id: 'technical', label: 'Technical' },
  { id: 'financials', label: 'Financials' }, { id: 'ownership', label: 'Ownership' }, { id: 'signals', label: 'Signals' },
];

const TAB_COLS = {
  overview: [
    { k: 'roe', l: 'ROE%', hc: 'var(--amber)', r: (s) => _roe(s.roe) }, { k: 'debtToEq', l: 'D/E', hc: 'var(--amber)', r: (s) => _de(s.debtToEq) },
    { k: 'opMargin', l: 'OpMgn%', hc: 'var(--amber)', r: (s) => _pct(s.opMargin), br: true },
    { k: 'pe', l: 'P/E', hc: 'var(--green)', r: (s) => _pe(s.pe) },
    { k: 'peg', l: 'PEG', hc: 'var(--green)', r: (s) => s.pe != null && s.earGrowth > 0 ? _rv(+(s.pe / s.earGrowth).toFixed(2), 2, '', s.pe / s.earGrowth < 1 ? 'var(--green)' : s.pe / s.earGrowth < 2 ? 'var(--text)' : 'var(--red)') : na },
    { k: 'pctFromHigh', l: 'FrHi%', hc: 'var(--green)', r: (s) => _fromHi(s.pctFromHigh), br: true },
    { k: 'wk52Change', l: '52W%', hc: 'var(--blue)', r: (s) => _pct(s.wk52Change) }, { k: 'rsi', l: 'RSI', hc: 'var(--blue)', r: (s) => _rsi(s.rsi) },
    { k: 'beta', l: 'Beta', hc: 'var(--blue)', r: (s) => _ratio(s.beta), br: true },
    { k: 'revGrowth', l: 'RevGr%', hc: 'var(--purple)', r: (s) => _pct(s.revGrowth) }, { k: 'earGrowth', l: 'EpsGr%', hc: 'var(--purple)', r: (s) => _pct(s.earGrowth), br: true },
    { k: 'dma50', l: '50DMA', hc: 'var(--red)', r: (s) => _dma(s.dma50, s.price) }, { k: 'dma200', l: '200DMA', hc: 'var(--red)', r: (s) => _dma(s.dma200, s.price) },
    { k: 'goldenCross', l: 'GldCrs', hc: 'var(--red)', r: (s) => _gc(s.goldenCross), br: true },
    { k: 'target', l: 'Target', hc: 'var(--text3)', r: (s) => _price(s.target) }, { k: 'rewardPct', l: 'Upside', hc: 'var(--text3)', r: (s) => _pct(s.rewardPct) },
  ],
  quality: [
    { k: 'roe', l: 'ROE%', hc: 'var(--amber)', r: (s) => _roe(s.roe) }, { k: 'roa', l: 'ROA%', hc: 'var(--amber)', r: (s) => _roe(s.roa) },
    { k: 'roce', l: 'ROCE%', hc: 'var(--amber)', r: (s) => _roe(s.roce) }, { k: 'debtToEq', l: 'D/E', hc: 'var(--amber)', r: (s) => _de(s.debtToEq) },
    { k: 'opMargin', l: 'OpMgn%', hc: 'var(--amber)', r: (s) => _pct(s.opMargin) }, { k: 'intCov', l: 'IntCov', hc: 'var(--text)', r: (s) => _ratio(s.intCov) },
    { k: 'currentRatio', l: 'CurRat', hc: 'var(--text)', r: (s) => _ratio(s.currentRatio) },
  ],
  value: [
    { k: 'pe', l: 'P/E', hc: 'var(--green)', r: (s) => _pe(s.pe) }, { k: 'pb', l: 'P/B', hc: 'var(--green)', r: (s) => _rv(s.pb, 2, '', s.pb != null && s.pb < 3 ? 'var(--green)' : 'var(--red)') },
    { k: 'peg', l: 'PEG', hc: 'var(--green)', r: (s) => s.pe != null && s.earGrowth > 0 ? _rv(+(s.pe / s.earGrowth).toFixed(2), 2) : na, br: true },
    { k: 'evEbitda', l: 'EV/EBITDA', hc: 'var(--emerald)', r: (s) => _pe(s.evEbitda) }, { k: 'divYield', l: 'DivYld%', hc: 'var(--text)', r: (s) => _pct(s.divYield) },
    { k: 'pctFromHigh', l: 'FrHi%', hc: 'var(--text)', r: (s) => _fromHi(s.pctFromHigh) },
  ],
  momentum: [
    { k: 'wk52Change', l: '52W%', hc: 'var(--blue)', r: (s) => _pct(s.wk52Change) }, { k: 'change6m', l: '6M%', hc: 'var(--blue)', r: (s) => _pct(s.change6m) },
    { k: 'change3m', l: '3M%', hc: 'var(--blue)', r: (s) => _pct(s.change3m) }, { k: 'change1m', l: '1M%', hc: 'var(--blue)', r: (s) => _pct(s.change1m), br: true },
    { k: 'rsi', l: 'RSI', hc: 'var(--amber)', r: (s) => _rsi(s.rsi) }, { k: 'beta', l: 'Beta', hc: 'var(--amber)', r: (s) => _ratio(s.beta) },
    { k: 'wk52Hi', l: '52W Hi', hc: 'var(--text)', r: (s) => _price(s.wk52Hi) }, { k: 'wk52Lo', l: '52W Lo', hc: 'var(--text)', r: (s) => _price(s.wk52Lo) },
  ],
  growth: [
    { k: 'revGrowth', l: 'RevGr%', hc: 'var(--purple)', r: (s) => _pct(s.revGrowth) }, { k: 'earGrowth', l: 'EpsGr%', hc: 'var(--purple)', r: (s) => _pct(s.earGrowth) },
    { k: 'salesGr1y', l: 'Sales1Y%', hc: 'var(--purple)', r: (s) => _pct(s.salesGr1y) }, { k: 'salesGr5y', l: 'Sales5Y%', hc: 'var(--purple)', r: (s) => _pct(s.salesGr5y), br: true },
    { k: 'ret1y', l: 'Ret1Y%', hc: 'var(--blue)', r: (s) => _pct(s.ret1y) }, { k: 'ret3y', l: 'Ret3Y%', hc: 'var(--blue)', r: (s) => _pct(s.ret3y) },
  ],
  technical: [
    { k: 'dma20', l: '20DMA', hc: 'var(--red)', r: (s) => _dma(s.dma20, s.price) }, { k: 'dma50', l: '50DMA', hc: 'var(--red)', r: (s) => _dma(s.dma50, s.price) },
    { k: 'dma200', l: '200DMA', hc: 'var(--red)', r: (s) => _dma(s.dma200, s.price), br: true },
    { k: 'goldenCross', l: 'GldCrs', hc: 'var(--amber)', r: (s) => _gc(s.goldenCross) }, { k: 'bbPct', l: 'BB%', hc: 'var(--amber)', r: (s) => _ratio(s.bbPct) },
    { k: 'macd', l: 'MACD', hc: 'var(--blue)', r: (s) => _rv(s.macd, 2) }, { k: 'adx', l: 'ADX', hc: 'var(--blue)', r: (s) => _num(s.adx, 1), br: true },
    { k: 'volRatio', l: 'VolRat', hc: 'var(--text)', r: (s) => _vol(s.volRatio) }, { k: 'dma200Trend', l: '200Trend', hc: 'var(--text)', r: (s) => _trend(s.dma200Trend) },
  ],
  financials: [
    { k: 'mktCap', l: 'MktCap Cr', hc: 'var(--text)', r: (s) => _crore(s.mktCap) }, { k: 'eps', l: 'EPS', hc: 'var(--text)', r: (s) => _num(s.eps, 2) },
    { k: 'bookValue', l: 'BookVal', hc: 'var(--text)', r: (s) => _num(s.bookValue, 2) }, { k: 'debt', l: 'Debt Cr', hc: 'var(--text)', r: (s) => _crore(s.debt), br: true },
    { k: 'fcf', l: 'FCF Cr', hc: 'var(--emerald)', r: (s) => _crore(s.fcf) }, { k: 'patQtr', l: 'PAT Qtr', hc: 'var(--emerald)', r: (s) => _crore(s.patQtr) },
    { k: 'grossMgn', l: 'GrsMgn%', hc: 'var(--text3)', r: (s) => _pct(s.grossMgn) }, { k: 'profMgn', l: 'PrfMgn%', hc: 'var(--text3)', r: (s) => _pct(s.profMgn) },
  ],
  ownership: [
    { k: 'promoter', l: 'Promoter%', hc: 'var(--amber)', r: (s) => _pct(s.promoter) },
    { k: 'promoterChg', l: 'PromChg%', hc: 'var(--amber)', r: (s) => _rv(s.promoterChg, 1, '%', s.promoterChg > 0 ? 'var(--green)' : s.promoterChg < 0 ? 'var(--red)' : 'var(--text)') },
    { k: 'pledged', l: 'Pledged%', hc: 'var(--amber)', r: (s) => _rv(s.pledged, 1, '%', s.pledged != null && s.pledged < 10 ? 'var(--green)' : s.pledged < 30 ? 'var(--amber)' : 'var(--red)'), br: true },
    { k: 'fiiHolding', l: 'FII%', hc: 'var(--blue)', r: (s) => _pct(s.fiiHolding) }, { k: 'diiHolding', l: 'DII%', hc: 'var(--blue)', r: (s) => _pct(s.diiHolding) },
  ],
  signals: [
    { k: 'target', l: 'Target', hc: 'var(--green)', r: (s) => _price(s.target) }, { k: 'stopLoss', l: 'StopLoss', hc: 'var(--red)', r: (s) => _price(s.stopLoss) },
    { k: 'rewardPct', l: 'Upside%', hc: 'var(--green)', r: (s) => _pct(s.rewardPct) }, { k: 'riskPct', l: 'Risk%', hc: 'var(--red)', r: (s) => _rv(s.riskPct, 1, '%', 'var(--red)') },
    { k: 'rrRatio', l: 'R:R', hc: 'var(--text)', r: (s) => _ratio(s.rrRatio), br: true },
    { k: 'isFallenAngel', l: 'Fallen', hc: 'var(--amber)', r: (s) => _fa(s.isFallenAngel) }, { k: 'fallenScore', l: 'FA Score', hc: 'var(--amber)', r: (s) => s.fallenScore != null ? _num(s.fallenScore, 0) : na },
  ],
};

/* ── Deep Stock Analyzer ── */
function DeepStockAnalyzer({ allStocks }) {
  const { analyzeStock, analyzerData, analyzerLoading, runAI, fetchUniverse, universe } = useStockRecStore();
  const [query, setQuery] = useState('');
  const [selectedSym, setSelectedSym] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selIdx, setSelIdx] = useState(-1);
  const [aiData, setAiData] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { fetchUniverse(); }, []);

  const stockList = useMemo(() => {
    const src = (universe?.stocks || allStocks || []).map((s) => ({ sym: s.sym, name: s.name || s.sym, sector: s.sector || '', score: s.score || 0 })).sort((a, b) => b.score - a.score);
    return src;
  }, [universe, allStocks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stockList.slice(0, 80);
    return stockList.filter((s) => s.sym.toLowerCase().startsWith(q) || s.name.toLowerCase().includes(q)).slice(0, 60);
  }, [query, stockList]);

  const handleSelect = (sym, name) => {
    setQuery(`${sym} -- ${name}`);
    setSelectedSym(sym);
    setShowDropdown(false);
    analyzeStock(sym);
  };

  const handleKey = (e) => {
    if (!showDropdown) { if (e.key === 'Enter') doAnalyze(); return; }
    if (e.key === 'ArrowDown') { setSelIdx((p) => Math.min(p + 1, filtered.length - 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setSelIdx((p) => Math.max(p - 1, 0)); e.preventDefault(); }
    else if (e.key === 'Enter' && selIdx >= 0) { const s = filtered[selIdx]; if (s) handleSelect(s.sym, s.name); e.preventDefault(); }
    else if (e.key === 'Escape') setShowDropdown(false);
  };

  const doAnalyze = () => {
    const sym = selectedSym || query.trim().toUpperCase().split(/\s+/)[0].replace(/[^A-Z0-9&]/g, '');
    if (sym) { setSelectedSym(sym); analyzeStock(sym); setShowDropdown(false); }
  };

  const doAIReview = async () => {
    if (!analyzerData?.sym) return;
    setAiLoading(true);
    try {
      const d = await runAI(analyzerData.sym);
      setAiData(d);
    } catch (e) { setAiData({ error: e.message }); }
    finally { setAiLoading(false); }
  };

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Deep Stock Analyzer</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>Kite fetches 1Y/3Y/5Y/MAX candles, computes 15+ indicators, support/resistance, buy zones + live news sentiment.</div>
      <div className="flex gap-2 items-center flex-wrap" style={{ position: 'relative' }}>
        <div style={{ position: 'relative', width: 300 }}>
          <input ref={inputRef} type="text" placeholder="Search stock... e.g. Reliance, TCS" maxLength={40} value={query}
            onChange={(e) => { setQuery(e.target.value); setShowDropdown(true); setSelIdx(-1); }}
            onKeyDown={handleKey} onFocus={() => setShowDropdown(true)} onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '9px 14px', fontSize: 13, boxSizing: 'border-box' }}
          />
          {showDropdown && filtered.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 260, overflowY: 'auto', zIndex: 999, marginTop: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
              {filtered.map((s, i) => {
                const sc = s.score >= 75 ? 'var(--green)' : s.score >= 55 ? 'var(--amber)' : 'var(--text3)';
                return (
                  <div key={s.sym} onMouseDown={() => handleSelect(s.sym, s.name)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border2)', background: i === selIdx ? 'rgba(245,158,11,0.15)' : 'transparent',
                  }} onMouseEnter={() => setSelIdx(i)}>
                    <div style={{ minWidth: 70, fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{s.sym}</div>
                    <div style={{ flex: 1, fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text4)' }}>{s.sector}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: sc, minWidth: 28, textAlign: 'right' }}>{s.score}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <button onClick={doAnalyze} style={{ background: 'var(--amber)', color: '#000', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Analyze</button>
        <span style={{ fontSize: 10, color: 'var(--text4)' }}>{stockList.length} stocks</span>
      </div>

      {/* Analyzer results */}
      <div style={{ marginTop: 16, maxHeight: '85vh', overflowY: 'auto', overflowX: 'hidden' }}>
        {analyzerLoading && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 600, marginBottom: 6 }}>Analyzing <b>{selectedSym}</b>...</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Running institutional-grade analysis...</div>
            <div style={{ marginTop: 16, height: 3, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden', maxWidth: 180, margin: '16px auto 0' }}>
              <div className="animate-shimmer" style={{ height: '100%', background: 'var(--amber)', width: '70%', borderRadius: 2 }} />
            </div>
          </div>
        )}
        {analyzerData && !analyzerLoading && (
          <AnalyzerResult data={analyzerData} onRunAI={doAIReview} aiData={aiData} aiLoading={aiLoading} />
        )}
      </div>
    </div>
  );
}

/* ── Analyzer Result (simplified but complete) ── */
function AnalyzerResult({ data, onRunAI, aiData, aiLoading }) {
  const d = data;
  const vc = d.verdictColor || 'var(--amber)';

  if (d.error) return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 600, margin: '8px 0' }}>{d.error}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>Try: RELIANCE, TCS, HDFCBANK, INFY</div>
    </div>
  );

  const cl = d.checklist || {};

  return (
    <div style={{ marginTop: 16 }}>
      {/* Header */}
      <div className="flex gap-3 items-start flex-wrap mb-4">
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <b style={{ fontSize: 20 }}>{d.sym}</b>
            <span style={{ color: 'var(--text3)', fontSize: 12 }}>{d.name}</span>
            <span style={{ background: 'rgba(100,116,139,.2)', color: 'var(--text3)', borderRadius: 4, padding: '1px 8px', fontSize: 10 }}>{d.sector}</span>
            <span style={{ background: 'rgba(100,116,139,.2)', color: 'var(--text3)', borderRadius: 4, padding: '1px 8px', fontSize: 10 }}>{d.grp}</span>
          </div>
          {d.price && <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Rs{d.price.toFixed(2)}</div>}
        </div>
        <div style={{ background: `${vc}15`, border: `2px solid ${vc}`, borderRadius: 12, padding: '16px 20px', textAlign: 'center', minWidth: 190 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: vc }}>{d.verdict}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', margin: '4px 0' }}>{d.verdictTimeframe}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: vc, margin: '8px 0' }} className="tabular-nums">{d.pctScore}<span style={{ fontSize: 13 }}>/100</span></div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>{d.passCount}/{d.totalChecks} criteria passed</div>
          <div style={{ marginTop: 8, background: 'var(--bg4)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: vc, width: `${d.pctScore}%`, borderRadius: 6 }} />
          </div>
          <div style={{ marginTop: 8, background: vc, color: '#000', borderRadius: 8, padding: '6px 12px', fontWeight: 800, fontSize: 13 }}>{d.action}</div>
        </div>
      </div>

      {/* AI Second Opinion */}
      <div style={{ background: 'linear-gradient(135deg,rgba(139,92,246,.08),rgba(59,130,246,.08))', border: '1px solid rgba(139,92,246,.3)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--purple)' }}>AI Second Opinion</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>4 free AI analysts + 1 judge model analyze using Varsity principles</div>
          </div>
          <button onClick={onRunAI} disabled={aiLoading} style={{ background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: aiLoading ? 'wait' : 'pointer' }}>
            {aiLoading ? 'Running...' : aiData ? 'Re-run AI Review' : 'Run AI Review'}
          </button>
        </div>
        {aiLoading && (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>Querying 5 AI models in parallel...</div>
            <div style={{ height: 3, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden', maxWidth: 220, margin: '0 auto' }}>
              <div className="animate-shimmer" style={{ height: '100%', background: 'var(--purple)', width: '60%', borderRadius: 2 }} />
            </div>
          </div>
        )}
        {aiData && !aiLoading && <AIReviewPanel data={aiData} />}
      </div>

      {/* Checklist */}
      <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 12 }}>Varsity Checklist -- Complete 14-Point Framework</div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {Object.keys(cl).map((k) => {
            const c = cl[k];
            const gc = c.pass ? 'var(--green)' : 'var(--red)';
            return (
              <div key={k} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px', borderLeft: `3px solid ${gc}` }}>
                <div className="flex justify-between items-start">
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text2)', flex: 1 }}>{c.pass ? 'Pass' : c.pts > 0 ? '!' : 'X'} {c.label}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: gc, flexShrink: 0, marginLeft: 6 }}>{c.pts}/{c.max}</div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 3, lineHeight: 1.4 }}>{c.detail}</div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <div className="flex justify-between mb-1.5" style={{ fontSize: 11, fontWeight: 700 }}>
            <span>Total Score</span><span style={{ color: vc }}>{d.totalPts} / {d.maxPts} points ({d.pctScore}%)</span>
          </div>
          <div style={{ height: 8, background: 'var(--bg4)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: vc, width: `${d.pctScore}%`, borderRadius: 4 }} />
          </div>
        </div>
      </div>

      {/* S&R + When to Buy */}
      <div className="grid gap-2.5 mb-4" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--green)', marginBottom: 8 }}>Support Levels</div>
          {d.supports?.length ? d.supports.slice(0, 6).map((s, i) => (
            <div key={i} className="flex justify-between" style={{ padding: '4px 0', borderBottom: '1px solid var(--border2)', fontSize: 11 }}>
              <b style={{ color: 'var(--green)' }}>Rs{s.price}</b>
              <span style={{ color: 'var(--text3)' }}>{s.strength > 4 ? 'Strong' : ''}</span>
            </div>
          )) : <div style={{ fontSize: 10, color: 'var(--text4)' }}>Need more candle history</div>}
        </div>
        <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>Resistance Levels</div>
          {d.resistances?.length ? d.resistances.slice(0, 6).map((r, i) => (
            <div key={i} className="flex justify-between" style={{ padding: '4px 0', borderBottom: '1px solid var(--border2)', fontSize: 11 }}>
              <b style={{ color: 'var(--red)' }}>Rs{r.price}</b>
              <span style={{ color: 'var(--text3)' }}>{r.strength > 4 ? 'Strong' : ''}</span>
            </div>
          )) : <div style={{ fontSize: 10, color: 'var(--text4)' }}>Need more candle history</div>}
        </div>
        <div style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--amber)', marginBottom: 8 }}>When To Buy</div>
          {d.whenToBuy?.length ? d.whenToBuy.slice(0, 5).map((w, i) => (
            <div key={i} style={{ padding: '5px 0', borderBottom: '1px solid rgba(245,158,11,.15)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: w.priority === 'HIGH' ? 'var(--green)' : w.priority === 'MEDIUM' ? 'var(--amber)' : 'var(--text3)' }}>{w.type} ({w.priority})</div>
              <div style={{ fontSize: 10, fontWeight: 600 }}>Rs{w.price}</div>
              <div style={{ fontSize: 10, color: 'var(--text4)' }}>{w.why}</div>
            </div>
          )) : null}
          {d.riskReward && <div style={{ marginTop: 6, fontSize: 10, color: 'var(--amber)', fontWeight: 700 }}>R:R = {d.riskReward}x</div>}
        </div>
      </div>

      <div style={{ fontSize: 10, color: 'var(--text4)', padding: '8px 0 16px', textAlign: 'center' }}>Algorithmic analysis only. Not financial advice.</div>
    </div>
  );
}

/* ── AI Review Panel ── */
function AIReviewPanel({ data }) {
  const d = data;
  if (d.error) return <div style={{ color: 'var(--red)', fontSize: 12, padding: 8 }}>Error: {d.error}</div>;
  const cc = { BUY: '#22c55e', AVOID: '#ef4444', HOLD: 'var(--amber)', MIXED: '#6b7280' };
  const consColor = cc[d.consensus] || '#6b7280';
  const counts = d.counts || {};
  const mn = { 'groq-llama': 'Groq', 'gpt-nano': 'GPT-nano', 'deepseek': 'DeepSeek', 'claude-haiku': 'Haiku', 'mistral': 'Mistral' };

  return (
    <div>
      <div style={{ background: `${consColor}15`, border: `2px solid ${consColor}`, borderRadius: 10, padding: 14, marginBottom: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: consColor }}>{d.consensus}</div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{d.respondedCount}/{d.totalModels} models responded{d.avgConfidence ? ` -- Avg confidence: ${d.avgConfidence}%` : ''}</div>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {(d.models || []).map((m) => {
          const sn = mn[m.id] || m.name || m.id;
          if (m.error || m.skipped) return (
            <div key={m.id} style={{ background: 'var(--bg2)', borderRadius: 8, padding: 10, borderLeft: '3px solid var(--text4)', opacity: 0.5 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>{sn}</div>
              <div style={{ fontSize: 10, color: 'var(--text4)' }}>{m.error || 'Skipped'}</div>
            </div>
          );
          const vcu = (m.verdict || '').toUpperCase();
          const mc = vcu.includes('BUY') && !vcu.includes('AVOID') ? '#22c55e' : vcu.includes('HOLD') ? 'var(--amber)' : vcu.includes('SELL') ? '#ef4444' : vcu.includes('AVOID') ? '#f97316' : 'var(--text3)';
          return (
            <div key={m.id} style={{ background: 'var(--bg2)', borderRadius: 8, padding: 10, borderLeft: `3px solid ${mc}` }}>
              <div className="flex justify-between items-center mb-1.5">
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>{sn}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: mc, background: `${mc}18`, padding: '2px 8px', borderRadius: 4 }}>{m.verdict}</div>
              </div>
              {m.one_line_summary && <div style={{ fontSize: 10, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 6, fontStyle: 'italic' }}>"{m.one_line_summary}"</div>}
              {(m.target_price || m.stop_loss) && (
                <div className="flex gap-2" style={{ fontSize: 10, marginBottom: 4 }}>
                  {m.target_price && <span style={{ color: 'var(--green)' }}>Target: Rs{m.target_price}</span>}
                  {m.stop_loss && <span style={{ color: 'var(--red)' }}>SL: Rs{m.stop_loss}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Stock Card (top picks sidebar) ── */
function StockCard({ s, rank }) {
  const gc = { NIFTY50: 'var(--blue)', NEXT50: 'var(--purple)', MIDCAP: 'var(--amber)', SMALLCAP: 'var(--emerald)' }[s.grp] || 'var(--text3)';
  const sc = s.score >= 75 ? 'var(--green)' : s.score >= 55 ? 'var(--amber)' : 'var(--red)';
  const convClass = (s.conviction || 'watch').toLowerCase().replace(/\s+/g, '-');
  const fa = s.fa_score || 0, ta = s.ta_score || 0, mom = s.momentum_score || 0, risk = s.risk_score || 0;
  const total4 = fa + ta + mom + risk || 1;
  const [showMore, setShowMore] = useState(false);

  return (
    <div style={{ background: 'var(--bg2)', border: '1.5px solid var(--border)', borderRadius: 12, padding: 14, position: 'relative', overflow: 'hidden' }}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--amber)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>{rank}</div>
          <div>
            <div className="flex items-center gap-1.5" style={{ fontWeight: 700, fontSize: 15 }}>
              {s.sym} <ConvictionPill tier={s.conviction} /> <HorizonPill horizon={s.horizon} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>{s.name}{s.sector ? ` -- ${s.sector}` : ''}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: sc }} className="tabular-nums">{s.composite_score || s.score}<span style={{ fontSize: 10, color: 'var(--text4)', fontWeight: 400 }}>/100</span></div>
          {s.price && <div style={{ fontSize: 13, fontWeight: 700 }} className="tabular-nums">Rs{s.price.toFixed(1)}</div>}
        </div>
      </div>

      {/* ScoreBar */}
      <ScoreBar fa={fa} ta={ta} momentum={mom} risk={risk} />
      <div className="flex gap-2 mt-1 mb-2.5" style={{ fontSize: 10, color: 'var(--text3)' }}>
        <span><span style={{ color: 'var(--blue)' }}>*</span> FA:{fa}</span>
        <span><span style={{ color: 'var(--green)' }}>*</span> TA:{ta}</span>
        <span><span style={{ color: 'var(--amber)' }}>*</span> Mom:{mom}</span>
        <span><span style={{ color: 'var(--purple)' }}>*</span> Risk:{risk}</span>
      </div>

      {/* Tags */}
      <div className="flex gap-1 flex-wrap mb-2.5">
        <span style={{ background: `${gc}22`, color: gc, borderRadius: 4, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{s.grp}</span>
        {s.sector && <span style={{ background: 'var(--bg3)', color: 'var(--text3)', borderRadius: 4, padding: '1px 7px', fontSize: 10 }}>{s.sector}</span>}
      </div>

      {/* Quick verdict */}
      {s.conviction && (
        <div className="flex items-center gap-2 mb-2">
          <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: sc, width: `${Math.min(100, s.composite_score || s.score || 0)}%`, borderRadius: 4 }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: sc, whiteSpace: 'nowrap' }}>{s.conviction}</span>
        </div>
      )}

      {/* Show more / Fundamentals */}
      <div style={{ textAlign: 'center', marginBottom: 6 }}>
        <button onClick={() => setShowMore(!showMore)} style={{ background: 'rgba(245,158,11,.12)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 5, padding: '3px 14px', fontSize: 10, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
          {showMore ? 'Show less' : 'Show more'}
        </button>
      </div>
      {showMore && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>Fundamentals</div>
          <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 10 }}>
            {[
              ['ROE', s.roe != null ? `${s.roe.toFixed(1)}%` : '--', s.roe >= 20 ? 'var(--green)' : s.roe >= 15 ? 'var(--amber)' : 'var(--red)'],
              ['D/E', s.debtToEq != null ? `${s.debtToEq.toFixed(2)}x` : '--', s.debtToEq <= 0.3 ? 'var(--green)' : s.debtToEq <= 1 ? 'var(--amber)' : 'var(--red)'],
              ['P/E', s.pe != null ? `${s.pe.toFixed(1)}x` : '--', s.pe < 15 ? 'var(--green)' : s.pe < 25 ? 'var(--amber)' : 'var(--red)'],
              ['RSI', s.rsi != null ? s.rsi.toFixed(0) : '--', s.rsi < 35 ? 'var(--green)' : s.rsi < 70 ? 'var(--text)' : 'var(--red)'],
            ].map(([l, v, c]) => (
              <div key={l} style={{ background: 'var(--bg3)', borderRadius: 6, padding: '5px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 1 }}>{l}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: c }} className="tabular-nums">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== MAIN STOCK REC PAGE ========== */
export default function StockRecPage() {
  const { data, filter, showAll, tab, loading, error, setFilter, setShowAll, setTab, fetchScores } = useStockRecStore();
  const [pollCount, setPollCount] = useState(0);
  const pollRef = useRef(null);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  // Poll while loading
  useEffect(() => {
    if (data?.loading && !data?.stocks?.length) {
      pollRef.current = setInterval(() => {
        fetchScores();
        setPollCount((c) => c + 1);
      }, 4000);
      return () => clearInterval(pollRef.current);
    }
    if (pollRef.current) clearInterval(pollRef.current);
  }, [data?.loading, data?.stocks?.length]);

  const allStocks = data?.stocks || [];
  const fallenAngels = allStocks.filter((s) => s.isFallenAngel).sort((a, b) => (b.fallenScore || 0) - (a.fallenScore || 0));
  const sectors = [...new Set(allStocks.map((s) => s.sector).filter(Boolean))].sort();
  const filters = [...STOCK_FILTERS, ...sectors.slice(0, 8)];

  const filtered = useMemo(() => {
    let f = allStocks;
    if (filter === 'FALLEN') return fallenAngels;
    if (filter === 'NIFTY50') f = f.filter((s) => s.grp === 'NIFTY50');
    else if (filter === 'NEXT50') f = f.filter((s) => s.grp === 'NEXT50');
    else if (filter === 'MIDCAP') f = f.filter((s) => s.grp === 'MIDCAP');
    else if (filter === 'SMALLCAP') f = f.filter((s) => s.grp === 'SMALLCAP');
    else if (filter !== 'ALL') f = f.filter((s) => s.sector === filter);
    return f;
  }, [allStocks, filter, fallenAngels]);

  const top3 = filtered.slice(0, 3);
  const activeCols = TAB_COLS[tab] || TAB_COLS.overview;
  const SHOW_INITIAL = 20;
  const showCount = showAll ? filtered.length : Math.min(SHOW_INITIAL, filtered.length);
  const grpCol = { NIFTY50: 'var(--blue)', NEXT50: 'var(--purple)', MIDCAP: 'var(--amber)', SMALLCAP: 'var(--emerald)' };

  // Conviction counts
  const convCounts = { sb: 0, b: 0, acc: 0, w: 0, av: 0 };
  allStocks.forEach((s) => {
    const c = (s.conviction || 'watch').toLowerCase();
    if (c.includes('strong')) convCounts.sb++;
    else if (c === 'buy') convCounts.b++;
    else if (c.includes('accum')) convCounts.acc++;
    else if (c.includes('avoid')) convCounts.av++;
    else convCounts.w++;
  });

  if (loading && !allStocks.length) {
    return (
      <div className="animate-fadeIn" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Stocks Recommendation</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, marginBottom: 16 }}>Loading scored stocks from Kite...</div>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>Fetching Kite candles for all stocks...</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 16 }}>First load takes ~60s. Subsequent loads are instant from cache.</div>
          <div style={{ height: 3, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden', maxWidth: 280, margin: '0 auto' }}>
            <div className="animate-shimmer" style={{ height: '100%', background: 'var(--amber)', borderRadius: 2, width: '40%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      {/* Deep Analyzer */}
      <DeepStockAnalyzer allStocks={allStocks} />

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2.5 mb-3.5">
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-.3px' }}>Stocks Recommendation</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
            Checklist scoring -- Trend + Quality + Momentum + Value + Technical -- {data?.last_refresh || 'Scoring...'}
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => { useStockRecStore.setState({ data: null }); fetchScores(); }} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)', fontSize: 11, color: 'var(--text2)', cursor: 'pointer' }}>Refresh</button>
        </div>
      </div>

      {/* Conviction summary */}
      <div className="flex gap-1.5 flex-wrap mb-3">
        <ConvictionPill tier="strong-buy" /><span style={{ fontSize: 10, color: 'var(--text3)', alignSelf: 'center' }}>{convCounts.sb}</span>
        <ConvictionPill tier="buy" /><span style={{ fontSize: 10, color: 'var(--text3)', alignSelf: 'center' }}>{convCounts.b}</span>
        <ConvictionPill tier="accumulate" /><span style={{ fontSize: 10, color: 'var(--text3)', alignSelf: 'center' }}>{convCounts.acc}</span>
        <ConvictionPill tier="watch" /><span style={{ fontSize: 10, color: 'var(--text3)', alignSelf: 'center' }}>{convCounts.w}</span>
        <ConvictionPill tier="avoid" /><span style={{ fontSize: 10, color: 'var(--text3)', alignSelf: 'center' }}>{convCounts.av}</span>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {filters.map((f) => {
          const active = filter === f;
          const isFallen = f === 'FALLEN';
          return (
            <button key={f} onClick={() => { setFilter(f); setShowAll(false); }} style={{
              padding: '4px 12px', borderRadius: 20, border: `1px solid ${active ? 'var(--amber)' : isFallen ? 'rgba(245,158,11,.3)' : 'var(--border)'}`,
              background: active ? 'rgba(245,158,11,0.2)' : isFallen ? 'rgba(245,158,11,.08)' : 'var(--bg2)',
              color: active || isFallen ? 'var(--amber)' : 'var(--text2)', fontSize: 11, cursor: 'pointer', fontWeight: active ? 700 : 400,
            }}>{f}</button>
          );
        })}
      </div>

      {/* Flex layout: Top Picks + Table */}
      <div className="flex gap-4 items-start">
        {/* Left sidebar: Top Picks */}
        {top3.length > 0 && (
          <div style={{ width: 300, flexShrink: 0, position: 'sticky', top: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--amber)' }}>Top Picks - {filter === 'ALL' ? 'Overall' : filter}</div>
            {top3.map((s, i) => <div key={s.sym} style={{ marginBottom: 12 }}><StockCard s={s} rank={i + 1} /></div>)}
          </div>
        )}

        {/* Right: Table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>All Stocks - {filtered.length} shown{filter !== 'ALL' ? ` (${filter})` : ''}</div>

          {/* Tab bar */}
          <div className="flex gap-1 flex-wrap mb-2.5">
            {TAB_DEFS.map((t) => {
              const isActive = tab === t.id;
              const colCount = (TAB_COLS[t.id] || []).length;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  padding: '5px 12px', borderRadius: 8, border: `1px solid ${isActive ? 'var(--amber)' : 'var(--border)'}`,
                  background: isActive ? 'rgba(245,158,11,0.15)' : 'var(--bg2)', color: isActive ? 'var(--amber)' : 'var(--text2)',
                  fontSize: 11, cursor: 'pointer', fontWeight: isActive ? 700 : 400, whiteSpace: 'nowrap',
                }}>{t.label} <span style={{ fontSize: 9, opacity: 0.6 }}>({colCount})</span></button>
              );
            })}
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: 'var(--bg2)' }}>
                  <th style={{ textAlign: 'right', padding: '5px 8px', color: 'var(--text3)', position: 'sticky', left: 0, background: 'var(--bg2)', zIndex: 5 }}>#</th>
                  <th style={{ textAlign: 'left', padding: '5px 8px', color: 'var(--text3)', position: 'sticky', left: 36, background: 'var(--bg2)', zIndex: 5, minWidth: 130 }}>Stock</th>
                  <th style={{ textAlign: 'center', padding: '5px 8px', color: 'var(--text3)' }}>Grp</th>
                  <th style={{ textAlign: 'right', padding: '5px 8px', color: 'var(--text3)' }}>Score</th>
                  <th style={{ textAlign: 'right', padding: '5px 8px', color: 'var(--text3)', borderRight: '2px solid var(--bg4)' }}>Price</th>
                  {activeCols.map((col) => (
                    <th key={col.k} style={{ textAlign: 'right', padding: '5px 8px', color: col.hc, whiteSpace: 'nowrap', ...(col.br ? { borderRight: '1px solid var(--border2)' } : {}) }}>{col.l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, showCount).map((s, idx) => {
                  const bg = idx % 2 === 0 ? 'var(--bg)' : 'var(--bg2)';
                  const scoreCol = s.score >= 75 ? 'var(--green)' : s.score >= 55 ? 'var(--amber)' : 'var(--red)';
                  const gcC = grpCol[s.grp] || 'var(--text3)';
                  return (
                    <tr key={s.sym} style={{ borderBottom: '1px solid var(--border2)', background: bg }}>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--text3)', position: 'sticky', left: 0, background: bg, zIndex: 3 }} className="tabular-nums">{s.rank || idx + 1}</td>
                      <td style={{ padding: '5px 8px', position: 'sticky', left: 36, background: bg, zIndex: 3 }}>
                        <div style={{ fontWeight: 600 }}>{s.sym}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>{s.sector}</div>
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                        <span style={{ background: `${gcC}22`, color: gcC, borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{s.grp}</span>
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: scoreCol }} className="tabular-nums">{s.score}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', borderRight: '2px solid var(--bg4)' }} className="tabular-nums">{s.price ? `₹${parseFloat(s.price).toFixed(1)}` : '-'}</td>
                      {activeCols.map((col) => (
                        <td key={col.k} style={{ padding: '5px 8px', textAlign: 'right', ...(col.br ? { borderRight: '1px solid var(--border2)' } : {}) }} className="tabular-nums">{col.r(s)}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length > SHOW_INITIAL && !showAll && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <span onClick={() => setShowAll(true)} style={{ cursor: 'pointer', fontSize: 11, color: 'var(--amber)', fontWeight: 600, padding: '6px 22px', border: '1px solid rgba(245,158,11,.4)', borderRadius: 20, display: 'inline-block', background: 'var(--bg2)' }}>
                Show all {filtered.length - SHOW_INITIAL} more
              </span>
            </div>
          )}
          {showAll && filtered.length > SHOW_INITIAL && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <span onClick={() => setShowAll(false)} style={{ cursor: 'pointer', fontSize: 11, color: 'var(--amber)', fontWeight: 600, padding: '6px 22px', border: '1px solid rgba(245,158,11,.4)', borderRadius: 20, display: 'inline-block', background: 'var(--bg2)' }}>Show less</span>
            </div>
          )}
        </div>
      </div>

      {/* Scoring Methodology */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--bg2)', marginTop: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10 }}>Scoring Methodology - 100 Points</div>
        <div className="flex flex-wrap gap-2">
          {[
            { name: 'Quality', pts: 25, c: 'var(--amber)', factors: 'ROE -- ROA/ROCE -- Debt/Equity -- Operating Margin' },
            { name: 'Value', pts: 20, c: 'var(--green)', factors: 'P/E -- P/B -- PEG -- Dividend Yield' },
            { name: 'Momentum', pts: 20, c: 'var(--blue)', factors: '52-week return -- % from high -- Beta' },
            { name: 'Growth', pts: 20, c: 'var(--purple)', factors: 'Revenue growth -- EPS growth' },
            { name: 'Technical', pts: 15, c: 'var(--red)', factors: 'Price vs 50/200 DMA -- Golden Cross -- Volume' },
          ].map((p) => (
            <div key={p.name} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '8px 12px', flex: 1, minWidth: 150 }}>
              <div style={{ color: p.c, fontWeight: 700, fontSize: 11 }}>{p.name} <span style={{ opacity: 0.7 }}>{p.pts} pts</span></div>
              <div style={{ color: 'var(--text3)', fontSize: 10, marginTop: 4, lineHeight: 1.5 }}>{p.factors}</div>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="text-sm mt-4" style={{ color: 'var(--red)' }}>Error: {error}</div>}
    </div>
  );
}
