import React, { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPost } from '../../api/client';

/**
 * TradingModeCard — the master PAPER↔LIVE kill-switch, capital editor, and
 * Kite test-buy smoke test, extracted from Admin.jsx 2026-04-20 as part of
 * the tab consolidation so the control has exactly one home (the Trade tab).
 *
 * Polls /api/trading-mode every 30s. Handles mode flip with a confirmation
 * modal (requires typing "LIVE"). Capital editor takes effect immediately.
 *
 * Test-buy fires a REAL 1-share limit order via the SEBI static-IP proxy —
 * the button is disabled unless Kite is connected, and the handler shows a
 * confirm() dialog describing exactly what will happen before the order
 * fires.
 */
export default function TradingModeCard() {
  const [tradingMode, setTradingMode] = useState(null);
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [confirmLiveText, setConfirmLiveText] = useState('');
  const [preflight, setPreflight] = useState(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [newCapital, setNewCapital] = useState('');
  const [toggleBusy, setToggleBusy] = useState(false);
  const [toggleMsg, setToggleMsg] = useState('');

  const [testBuySymbol, setTestBuySymbol] = useState('YESBANK');
  const [testBuyQty, setTestBuyQty] = useState(1);
  const [testBuyBusy, setTestBuyBusy] = useState(false);
  const [testBuyMsg, setTestBuyMsg] = useState('');

  const poll = useCallback(() => {
    apiGet('/api/trading-mode').then(setTradingMode).catch(() => {});
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, [poll]);

  const openLiveModal = async () => {
    setToggleMsg('');
    setConfirmLiveText('');
    setShowLiveModal(true);
    setPreflightLoading(true);
    try {
      const ip = await apiGet('/api/egress-ip');
      setPreflight(ip);
    } catch (e) {
      setPreflight({ error: e.message });
    }
    setPreflightLoading(false);
  };

  const handleEnableLive = async () => {
    if (confirmLiveText !== 'LIVE') return;
    setToggleBusy(true);
    try {
      const res = await apiPost('/api/trading-mode', { live: true });
      setTradingMode(res);
      setToggleMsg('🔴 LIVE trading enabled — real orders will fire');
      setShowLiveModal(false);
      setConfirmLiveText('');
    } catch (e) {
      setToggleMsg(`Error: ${e.message}`);
    }
    setToggleBusy(false);
    setTimeout(() => setToggleMsg(''), 6000);
  };

  const handleSwitchToPaper = async () => {
    if (!window.confirm('Switch back to PAPER trading? Open LIVE positions will stay open in Kite — this only stops NEW real orders.')) return;
    setToggleBusy(true);
    try {
      const res = await apiPost('/api/trading-mode', { live: false });
      setTradingMode(res);
      setToggleMsg('📝 Switched to PAPER — no new real orders will fire');
    } catch (e) {
      setToggleMsg(`Error: ${e.message}`);
    }
    setToggleBusy(false);
    setTimeout(() => setToggleMsg(''), 5000);
  };

  const handleSaveCapital = async () => {
    const amount = parseFloat(newCapital);
    if (!(amount > 0)) { setToggleMsg('Enter a valid capital amount'); setTimeout(() => setToggleMsg(''), 3000); return; }
    setToggleBusy(true);
    try {
      const res = await apiPost('/api/trading-mode', { capital: amount });
      setTradingMode(res);
      setNewCapital('');
      setToggleMsg(`💰 Capital set to ₹${amount.toLocaleString()}`);
    } catch (e) {
      setToggleMsg(`Error: ${e.message}`);
    }
    setToggleBusy(false);
    setTimeout(() => setToggleMsg(''), 4000);
  };

  const handleTestBuy = async () => {
    const symbol = (testBuySymbol || 'YESBANK').toUpperCase().trim();
    const qty = Math.max(1, parseInt(testBuyQty, 10) || 1);
    const warn =
      `⚠️  This will place a REAL LIMIT order on Kite:\n\n` +
      `    ${qty} × ${symbol}   (≈ ₹${qty * 25} at current LTP for YESBANK)\n\n` +
      `Routed via the static-IP proxy (68.183.90.72).\n` +
      `Make sure Kite is LOGGED IN and market is open.\n\n` +
      `Continue?`;
    if (!window.confirm(warn)) return;
    setTestBuyBusy(true);
    setTestBuyMsg(`Placing ${qty}× ${symbol}…`);
    try {
      const res = await apiPost('/api/test-buy', { symbol, quantity: qty });
      if (res && res.success) {
        setTestBuyMsg(
          `✅ Placed ${res.quantity || qty}× ${res.symbol || symbol} ` +
          `@ ₹${res.price ?? '?'}  ·  orderId=${res.orderId || '—'}`
        );
      } else {
        setTestBuyMsg(`❌ ${(res && (res.error || res.message)) || 'Order rejected'}`);
      }
    } catch (e) {
      setTestBuyMsg(`❌ Error: ${e.message}`);
    }
    setTestBuyBusy(false);
    setTimeout(() => setTestBuyMsg(''), 10000);
  };

  return (
    <>
      <div
        className="card"
        style={{
          padding: 0,
          marginBottom: 20,
          overflow: 'hidden',
          border: tradingMode?.live ? '2px solid rgba(248,113,113,0.55)' : '1px solid var(--border)',
          boxShadow: tradingMode?.live
            ? '0 0 40px rgba(248,113,113,0.18), 0 10px 30px rgba(0,0,0,0.35)'
            : '0 8px 22px rgba(0,0,0,0.22)',
          transition: 'box-shadow 300ms ease, border-color 300ms ease',
        }}
      >
        <div style={{
          background: tradingMode?.live
            ? 'linear-gradient(135deg, rgba(248,113,113,0.22), rgba(239,68,68,0.14))'
            : 'linear-gradient(135deg, rgba(99,102,241,0.16), rgba(52,211,153,0.08))',
          padding: '22px 26px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:18, flexWrap:'wrap' }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                <span style={{ fontSize:18 }}>{tradingMode?.live ? '🔴' : '📝'}</span>
                <h2 style={{ fontSize:17, fontWeight:800, color:'var(--text)', letterSpacing:'-0.2px' }}>
                  Trading Mode
                </h2>
                <span className="chip" style={{
                  background: tradingMode?.live ? 'var(--red-bg)' : 'var(--brand-bg)',
                  color:      tradingMode?.live ? 'var(--red-text)' : 'var(--brand-text)',
                  border: '1px solid ' + (tradingMode?.live ? 'rgba(248,113,113,0.45)' : 'rgba(99,102,241,0.35)'),
                  fontWeight: 800, letterSpacing: '1px', fontSize: 11,
                }}>
                  {tradingMode ? (tradingMode.live ? '● LIVE · REAL MONEY' : '● PAPER · SIMULATED') : '…'}
                </span>
              </div>
              <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.5, maxWidth:640 }}>
                {tradingMode?.live
                  ? 'RoboTrade is placing REAL ORDERS on Kite. Scans run every 5 min during market hours.'
                  : 'RoboTrade is in PAPER mode — trades are simulated, no real orders fire. Scans still run.'}
              </p>
              <div style={{ display:'flex', gap:16, marginTop:10, flexWrap:'wrap', fontSize:11.5, color:'var(--text3)' }}>
                <span>Kite: <b style={{ color: tradingMode?.kiteConnected ? 'var(--green-text)' : 'var(--red-text)' }}>{tradingMode?.kiteConnected ? 'connected' : 'not connected'}</b></span>
                <span>Capital: <b style={{ color:'var(--text)' }}>₹{(tradingMode?.configuredCapital || 0).toLocaleString('en-IN')}</b></span>
                {tradingMode?.accountEquity != null && Math.abs((tradingMode.accountEquity||0) - (tradingMode.configuredCapital||0)) > 1 && (
                  <span>Live equity: <b style={{ color:'var(--text)' }}>₹{Math.round(tradingMode.accountEquity).toLocaleString('en-IN')}</b></span>
                )}
                <span>Risk/trade: <b style={{ color:'var(--text)' }}>{tradingMode?.riskPerTrade || '—'}</b></span>
                <span>Max positions: <b style={{ color:'var(--text)' }}>{tradingMode?.maxPositions ?? '—'}</b></span>
              </div>
            </div>
            {tradingMode?.live ? (
              <button
                onClick={handleSwitchToPaper}
                disabled={toggleBusy}
                className="btn btn-secondary"
                style={{ height:48, fontSize:14, fontWeight:700, padding:'0 22px', opacity: toggleBusy ? 0.7 : 1 }}
              >
                {toggleBusy ? '…' : '◼ Switch to PAPER'}
              </button>
            ) : (
              <button
                onClick={openLiveModal}
                disabled={toggleBusy || !tradingMode?.kiteConnected}
                className="btn btn-primary"
                style={{
                  height:48, fontSize:14, fontWeight:800, padding:'0 26px',
                  background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                  border: '1px solid rgba(248,113,113,0.5)',
                  opacity: toggleBusy || !tradingMode?.kiteConnected ? 0.55 : 1,
                  cursor: toggleBusy || !tradingMode?.kiteConnected ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.5px',
                }}
                title={!tradingMode?.kiteConnected ? 'Login to Kite first' : 'Enable LIVE trading'}
              >
                ● ENABLE LIVE
              </button>
            )}
          </div>
        </div>

        {/* Capital editor */}
        <div style={{ padding:'16px 26px', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
          <div style={{ fontSize:12, color:'var(--text2)', fontWeight:600 }}>Adjust capital (applies immediately to position sizing):</div>
          <input
            type="number"
            min="1"
            step="1000"
            placeholder={`₹${(tradingMode?.configuredCapital||0).toLocaleString('en-IN')}`}
            value={newCapital}
            onChange={e => setNewCapital(e.target.value)}
            style={{
              height:34, width:150, padding:'0 12px', borderRadius:8,
              border:'1px solid var(--border)', background:'var(--bg-elev)', color:'var(--text)',
              fontSize:13, fontFamily:'inherit',
            }}
          />
          <button
            onClick={handleSaveCapital}
            disabled={toggleBusy || !newCapital}
            className="btn btn-secondary"
            style={{ height:34, fontSize:12, padding:'0 14px' }}
          >
            Save
          </button>
          {toggleMsg && (
            <div style={{
              marginLeft:'auto', fontSize:12.5,
              color: toggleMsg.startsWith('Error') ? 'var(--red-text)' : 'var(--green-text)',
              fontWeight:600,
            }}>
              {toggleMsg}
            </div>
          )}
        </div>

        {/* Test-buy smoke test */}
        <div style={{
          padding:'14px 26px 18px',
          borderTop:'1px dashed var(--border)',
          display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))',
        }}>
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            <div style={{ fontSize:12, color:'var(--amber-text)', fontWeight:700, letterSpacing:'0.3px' }}>
              🧪 Kite smoke test
            </div>
            <div style={{ fontSize:11, color:'var(--text3)' }}>
              Places a REAL limit order via the SEBI static-IP proxy.
            </div>
          </div>
          <input
            type="text"
            value={testBuySymbol}
            onChange={e => setTestBuySymbol(e.target.value)}
            placeholder="YESBANK"
            style={{
              height:34, width:120, padding:'0 12px', borderRadius:8,
              border:'1px solid var(--border)', background:'var(--bg-elev)', color:'var(--text)',
              fontSize:13, fontFamily:'inherit', textTransform:'uppercase',
            }}
            title="NSE trading symbol"
          />
          <input
            type="number"
            min="1"
            step="1"
            value={testBuyQty}
            onChange={e => setTestBuyQty(e.target.value)}
            style={{
              height:34, width:70, padding:'0 10px', borderRadius:8,
              border:'1px solid var(--border)', background:'var(--bg-elev)', color:'var(--text)',
              fontSize:13, fontFamily:'inherit',
            }}
            title="Quantity (default 1)"
          />
          <button
            onClick={handleTestBuy}
            disabled={testBuyBusy || !tradingMode?.kiteConnected}
            className="btn"
            style={{
              height:34, fontSize:12.5, fontWeight:700, padding:'0 16px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color:'#1a1207',
              border:'1px solid rgba(245,158,11,0.55)',
              borderRadius:8,
              opacity: testBuyBusy || !tradingMode?.kiteConnected ? 0.55 : 1,
              cursor:  testBuyBusy || !tradingMode?.kiteConnected ? 'not-allowed' : 'pointer',
            }}
            title={!tradingMode?.kiteConnected ? 'Login to Kite first' : 'Place 1-share test order'}
          >
            {testBuyBusy ? '…' : '🧪 Test Buy'}
          </button>
          {testBuyMsg && (
            <div style={{
              marginLeft:'auto', fontSize:12.5, maxWidth:520, textAlign:'right',
              color: testBuyMsg.startsWith('❌') ? 'var(--red-text)'
                   : testBuyMsg.startsWith('✅') ? 'var(--green-text)'
                   : 'var(--text2)',
              fontWeight:600,
            }}>
              {testBuyMsg}
            </div>
          )}
        </div>
      </div>

      {/* ═══ LIVE TRADING CONFIRMATION MODAL ═══ */}
      {showLiveModal && (
        <div
          onClick={() => { if (!toggleBusy) { setShowLiveModal(false); setConfirmLiveText(''); } }}
          style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,0.72)', backdropFilter:'blur(6px)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999,
            animation:'fadeIn 200ms ease-out',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="card"
            style={{
              maxWidth:560, width:'92%', padding:0, overflow:'hidden',
              border:'2px solid rgba(248,113,113,0.5)',
              boxShadow:'0 20px 60px rgba(0,0,0,0.5), 0 0 60px rgba(248,113,113,0.25)',
              animation:'slideIn 260ms cubic-bezier(0.2,0.8,0.2,1)',
            }}
          >
            <div style={{
              background:'linear-gradient(135deg, rgba(248,113,113,0.22), rgba(239,68,68,0.14))',
              padding:'18px 22px', borderBottom:'1px solid var(--border)',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:22 }}>⚠️</span>
                <h2 style={{ fontSize:17, fontWeight:800, color:'var(--text)' }}>Enable LIVE trading</h2>
              </div>
              <p style={{ fontSize:12.5, color:'var(--text2)', marginTop:6 }}>
                RoboTrade will place REAL orders on Kite using ₹{(tradingMode?.configuredCapital || 0).toLocaleString('en-IN')} capital. Real money is at risk.
              </p>
            </div>

            <div style={{ padding:'18px 22px' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:10, letterSpacing:'0.5px' }}>
                PRE-FLIGHT CHECKS
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                {preflightLoading ? (
                  <div style={{ fontSize:12, color:'var(--text3)' }}>Checking egress IP + whitelist…</div>
                ) : preflight?.error ? (
                  <div style={{ fontSize:12, color:'var(--red-text)' }}>⚠ Pre-flight check failed: {preflight.error}</div>
                ) : preflight && (
                  <>
                    <PreflightRow
                      ok={!!preflight.kiteConnected || !!tradingMode?.kiteConnected}
                      label="Kite connected"
                      detail={tradingMode?.kiteConnected ? 'Access token valid' : 'Login to Kite first — click Sign Out and re-login'}
                    />
                    <PreflightRow
                      ok={preflight.proxyConfigured}
                      label="Static-IP proxy configured"
                      detail={preflight.proxyConfigured ? `Routed via ${preflight.viaProxy}` : 'QUOTAGUARDSTATIC_URL env var not set'}
                    />
                    <PreflightRow
                      ok={preflight.axiosPatched && preflight.wsPatched}
                      label="Kite SDK patched for proxy"
                      detail={preflight.axiosPatched && preflight.wsPatched ? 'All REST + WS calls route through DO proxy' : 'Patches not active — orders may egress from wrong IP'}
                    />
                    <PreflightRow
                      ok={preflight.kiteSdkRoutedIp === preflight.viaProxy}
                      label="Egress IP matches whitelist"
                      detail={`SDK egress: ${preflight.kiteSdkRoutedIp || '—'} · Whitelisted: ${preflight.viaProxy || '—'}`}
                    />
                  </>
                )}
              </div>

              <div style={{ fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:8, letterSpacing:'0.5px' }}>
                CONFIRM
              </div>
              <p style={{ fontSize:13, color:'var(--text)', marginBottom:10 }}>
                Type <b style={{ color:'var(--red-text)', letterSpacing:'1px' }}>LIVE</b> to enable real-money trading:
              </p>
              <input
                autoFocus
                value={confirmLiveText}
                onChange={e => setConfirmLiveText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && confirmLiveText === 'LIVE') handleEnableLive(); }}
                placeholder="LIVE"
                style={{
                  width:'100%', height:42, padding:'0 14px', borderRadius:8,
                  border:'1px solid ' + (confirmLiveText === 'LIVE' ? 'rgba(248,113,113,0.6)' : 'var(--border)'),
                  background:'var(--bg-elev)', color:'var(--text)',
                  fontSize:15, fontWeight:700, letterSpacing:'2px',
                  fontFamily:'inherit', textAlign:'center',
                  transition:'border-color 150ms',
                }}
              />

              <div style={{ display:'flex', gap:10, marginTop:18, justifyContent:'flex-end' }}>
                <button
                  onClick={() => { setShowLiveModal(false); setConfirmLiveText(''); }}
                  disabled={toggleBusy}
                  className="btn btn-secondary"
                  style={{ height:40, padding:'0 18px', fontSize:13 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEnableLive}
                  disabled={toggleBusy || confirmLiveText !== 'LIVE'}
                  className="btn btn-primary"
                  style={{
                    height:40, padding:'0 22px', fontSize:13, fontWeight:800,
                    background: confirmLiveText === 'LIVE' ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'var(--bg-elev)',
                    border: '1px solid ' + (confirmLiveText === 'LIVE' ? 'rgba(248,113,113,0.5)' : 'var(--border)'),
                    opacity: toggleBusy || confirmLiveText !== 'LIVE' ? 0.55 : 1,
                    cursor: toggleBusy || confirmLiveText !== 'LIVE' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {toggleBusy ? '…' : '● ENABLE LIVE'}
                </button>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
            @keyframes slideIn { from { opacity:0; transform:translateY(18px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
          `}</style>
        </div>
      )}
    </>
  );
}

// Pre-flight check row — small helper component for the confirmation modal.
function PreflightRow({ ok, label, detail }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:12.5 }}>
      <span style={{ fontSize:14, color: ok ? 'var(--green-text)' : 'var(--red-text)' }}>{ok ? '✓' : '✗'}</span>
      <span style={{ color:'var(--text)', fontWeight:600, minWidth:160 }}>{label}</span>
      <span style={{ color:'var(--text3)', fontSize:11.5 }}>{detail}</span>
    </div>
  );
}
