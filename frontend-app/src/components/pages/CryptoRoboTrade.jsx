import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { apiGet } from '../../api/client';
import { useAppStore } from '../../store/useAppStore';

// =======================================================
// CONSTANTS
// =======================================================
const CRYPTO_LIST = [
  { sym: 'BTCUSDT', name: 'Bitcoin', base: 'BTC' },
  { sym: 'ETHUSDT', name: 'Ethereum', base: 'ETH' },
  { sym: 'BNBUSDT', name: 'BNB', base: 'BNB' },
  { sym: 'SOLUSDT', name: 'Solana', base: 'SOL' },
  { sym: 'XRPUSDT', name: 'XRP', base: 'XRP' },
  { sym: 'ADAUSDT', name: 'Cardano', base: 'ADA' },
  { sym: 'DOGEUSDT', name: 'Dogecoin', base: 'DOGE' },
  { sym: 'AVAXUSDT', name: 'Avalanche', base: 'AVAX' },
  { sym: 'MATICUSDT', name: 'Polygon', base: 'MATIC' },
  { sym: 'DOTUSDT', name: 'Polkadot', base: 'DOT' },
  { sym: 'LINKUSDT', name: 'Chainlink', base: 'LINK' },
  { sym: 'UNIUSDT', name: 'Uniswap', base: 'UNI' },
  { sym: 'ATOMUSDT', name: 'Cosmos', base: 'ATOM' },
  { sym: 'LTCUSDT', name: 'Litecoin', base: 'LTC' },
  { sym: 'NEARUSDT', name: 'NEAR Protocol', base: 'NEAR' },
  { sym: 'APTUSDT', name: 'Aptos', base: 'APT' },
  { sym: 'ARBUSDT', name: 'Arbitrum', base: 'ARB' },
  { sym: 'OPUSDT', name: 'Optimism', base: 'OP' },
  { sym: 'INJUSDT', name: 'Injective', base: 'INJ' },
  { sym: 'SUIUSDT', name: 'Sui', base: 'SUI' },
];

const CRYPTO_SUB_TABS = [
  { id: 'overview', label: 'Overview', icon: '◎' },
  { id: 'positions', label: 'Positions', icon: '○' },
  { id: 'trades', label: 'Trade History', icon: '⇅' },
  { id: 'market', label: 'Live Prices', icon: '₿' },
  { id: 'chart', label: 'Chart', icon: '↗' },
  { id: 'news', label: 'News (RSS)', icon: '◈' },
];

// =======================================================
// HELPERS
// =======================================================
const INR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const INR0 = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const pc = (n) => `${Number(n || 0) >= 0 ? '+' : ''}${Number(n || 0).toFixed(2)}%`;
const fmtT = (ts) => ts
  ? new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—';
const clr = (n) => Number(n) >= 0 ? 'var(--green-text)' : 'var(--red-text)';

// =======================================================
// ROOT COMPONENT
// =======================================================
export default function CryptoRoboTrade() {
  const currentTab = useAppStore((s) => s.currentTab);
  const setCurrentTab = useAppStore((s) => s.setCurrentTab);

  // Derive sub-tab from currentTab ("crypto/<sub>")
  const subTab = useMemo(() => {
    const parts = (currentTab || 'crypto/overview').split('/');
    return parts[1] || 'overview';
  }, [currentTab]);

  // --- Data state ---
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState({});
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadCoreData = useCallback(async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        apiGet('/crypto/trades').catch(() => []),
        apiGet('/crypto/trades/stats').catch(() => null),
      ]);
      const tradesArr = Array.isArray(tRes) ? tRes : (Array.isArray(tRes?.trades) ? tRes.trades : []);
      setTrades(tradesArr);
      setStats(sRes && typeof sRes === 'object' ? sRes : {});
      setError(null);
    } catch (e) {
      setError(e?.message || 'Failed to load crypto data');
    }
  }, []);

  const loadPrices = useCallback(async () => {
    try {
      const d = await apiGet('/api/crypto-prices').catch(() => null);
      if (d && typeof d === 'object') {
        setPrices((prev) => ({ ...prev, ...d }));
      }
    } catch {
      // silent – price fetch is best-effort
    }
  }, []);

  // Initial + periodic refresh
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.all([loadCoreData(), loadPrices()]);
      if (!cancelled) setLoading(false);
    })();
    const priceInt = setInterval(() => { loadPrices(); }, 30000);
    const coreInt = setInterval(() => { loadCoreData(); }, 60000);
    return () => {
      cancelled = true;
      clearInterval(priceInt);
      clearInterval(coreInt);
    };
  }, [loadCoreData, loadPrices]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadCoreData(), loadPrices()]);
    setRefreshing(false);
  }, [loadCoreData, loadPrices]);

  // --- Derived summary ---
  const openTrades = useMemo(
    () => (Array.isArray(trades) ? trades : []).filter((t) => t?.status === 'OPEN'),
    [trades]
  );
  const closedTrades = useMemo(
    () => (Array.isArray(trades) ? trades : []).filter((t) => t?.status === 'CLOSED'),
    [trades]
  );
  const cs = stats || {};
  const totalPnl = Number(cs.total_pnl || 0);
  const wins = Number(cs.wins || 0);
  const losses = Number(cs.losses || 0);
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
  const openPnL = useMemo(
    () => openTrades.reduce((sum, t) => {
      const live = prices?.[t.symbol]?.price ?? Number(t.price);
      return sum + (live - Number(t.price)) * Number(t.quantity);
    }, 0),
    [openTrades, prices]
  );

  // --- Loading / error shells ---
  if (loading) {
    return (
      <div className="animate-fadeIn">
        <CryptoHero
          totalPnl={totalPnl} winRate={winRate} wins={wins} losses={losses}
          pairsCount={CRYPTO_LIST.length}
        />
        <SubTabBar current={subTab} onChange={(t) => setCurrentTab(`crypto/${t}`)} />
        <div className="card" style={{ padding: 80, textAlign: 'center', color: 'var(--text3)' }}>
          <div className="animate-pulse-custom" style={{ fontSize: 14 }}>Loading crypto data…</div>
        </div>
      </div>
    );
  }

  if (error && !trades.length && !Object.keys(stats).length) {
    return (
      <div className="animate-fadeIn">
        <CryptoHero
          totalPnl={0} winRate={0} wins={0} losses={0} pairsCount={CRYPTO_LIST.length}
        />
        <SubTabBar current={subTab} onChange={(t) => setCurrentTab(`crypto/${t}`)} />
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>⚠</div>
          <div style={{ color: 'var(--red-text)', fontWeight: 700, marginBottom: 6 }}>Could not load crypto data</div>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 18 }}>{error}</div>
          <button className="btn btn-primary" onClick={handleRefresh}>↻ Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <CryptoHero
        totalPnl={totalPnl} winRate={winRate} wins={wins} losses={losses}
        openPnL={openPnL} openCount={openTrades.length} closedCount={closedTrades.length}
        pairsCount={CRYPTO_LIST.length}
        onRefresh={handleRefresh} refreshing={refreshing}
      />

      <SubTabBar current={subTab} onChange={(t) => setCurrentTab(`crypto/${t}`)} />

      <div key={subTab} className="animate-fadeIn">
        {subTab === 'overview' && (
          <Overview
            stats={cs} trades={trades} openTrades={openTrades} closedTrades={closedTrades}
            prices={prices} openPnL={openPnL} winRate={winRate}
            onGoto={(t) => setCurrentTab(`crypto/${t}`)}
          />
        )}
        {subTab === 'positions' && (
          <Positions openTrades={openTrades} prices={prices} />
        )}
        {subTab === 'trades' && (
          <TradesHistory trades={trades} stats={cs} closedTrades={closedTrades} winRate={winRate} />
        )}
        {subTab === 'market' && (
          <Market prices={prices} trades={trades} />
        )}
        {subTab === 'chart' && (
          <ChartPage prices={prices} trades={trades} />
        )}
        {subTab === 'news' && (
          <NewsPage />
        )}
      </div>
    </div>
  );
}

// =======================================================
// HERO
// =======================================================
function CryptoHero({
  totalPnl = 0, winRate = 0, wins = 0, losses = 0,
  openPnL = 0, openCount = 0, closedCount = 0, pairsCount = 20,
  onRefresh, refreshing = false,
}) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)',
        borderRadius: 18,
        padding: '28px 32px',
        marginBottom: 18,
        color: '#fff',
        boxShadow: 'var(--shadow-brand)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: -60, right: -40, width: 240, height: 240,
        borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none',
        transform: 'translateZ(0)',
      }} />
      <div style={{
        position: 'absolute', bottom: -80, left: -60, width: 220, height: 220,
        borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', opacity: 0.85, marginBottom: 8 }}>
            Crypto Paper Trading · 24/7 · Binance
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1, marginBottom: 12 }}>
            Crypto RoboTrade
          </h1>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 14, opacity: 0.92 }}>
            <span>Win rate <b>{winRate}%</b></span>
            <span><b>{wins}W</b> / <b>{losses}L</b></span>
            <span><b>{openCount}</b> open · <b>{closedCount}</b> closed</span>
            <span>{pairsCount} pairs · scanning every 15 min</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="tabular-nums" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1, letterSpacing: '-1.5px', color: '#fff' }}>
            {totalPnl >= 0 ? '+' : ''}{INR0(totalPnl)}
          </div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>Total P&L (closed)</div>
          <div className="tabular-nums" style={{ fontSize: 14, opacity: 0.9, marginTop: 8 }}>
            Live open: <b>{openPnL >= 0 ? '+' : ''}{INR0(openPnL)}</b>
          </div>
          {onRefresh && (
            <button
              className="btn btn-secondary"
              onClick={onRefresh}
              disabled={refreshing}
              style={{
                marginTop: 12,
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff',
              }}
            >
              {refreshing ? '↻ Refreshing…' : '↻ Refresh'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =======================================================
// SUB-TAB BAR
// =======================================================
function SubTabBar({ current, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap',
      padding: 6, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
    }}>
      {CRYPTO_SUB_TABS.map((t) => {
        const active = t.id === current;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={active ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{
              fontSize: 13,
              padding: '8px 14px',
              background: active
                ? 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)'
                : 'transparent',
              border: active ? '1px solid transparent' : '1px solid transparent',
              color: active ? '#fff' : 'var(--text2)',
              transition: 'all 160ms ease',
              transform: active ? 'translateY(-1px)' : 'none',
              boxShadow: active ? '0 4px 12px rgba(124,58,237,0.25)' : 'none',
            }}
          >
            <span style={{ marginRight: 6 }}>{t.icon}</span>{t.label}
          </button>
        );
      })}
    </div>
  );
}

// =======================================================
// OVERVIEW
// =======================================================
function Overview({ stats, trades, openTrades, closedTrades, prices, openPnL, winRate, onGoto }) {
  const cs = stats || {};
  const pnl = Number(cs.total_pnl || 0);
  const wr = winRate;

  const statCards = [
    { l: 'Total P&L (closed)', v: `${pnl >= 0 ? '+' : ''}${INR0(pnl)}`, c: clr(pnl), s: `${closedTrades.length} closed` },
    { l: 'Open P&L (live)', v: `${openPnL >= 0 ? '+' : ''}${INR0(openPnL)}`, c: clr(openPnL), s: `${openTrades.length} positions` },
    { l: 'Win rate', v: `${wr}%`, c: wr >= 55 ? 'var(--green-text)' : wr >= 40 ? 'var(--amber-text)' : 'var(--red-text)', s: `${Number(cs.wins || 0)}W / ${Number(cs.losses || 0)}L` },
    { l: 'Avg win', v: `+${INR0(cs.avg_win || 0)}`, c: 'var(--green-text)' },
    { l: 'Avg loss', v: `${INR0(cs.avg_loss || 0)}`, c: 'var(--red-text)' },
    { l: 'Best trade', v: `+${INR0(cs.best_trade || 0)}`, c: 'var(--green-text)' },
    { l: 'Pairs scanning', v: String(CRYPTO_LIST.length), c: 'var(--accent)', s: 'Binance · 24/7 · free' },
    { l: 'Scan interval', v: '15 min', c: 'var(--accent)', s: 'always running' },
  ];

  const recent = (Array.isArray(trades) ? trades : []).slice(0, 8);

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 12, marginBottom: 20,
      }}>
        {statCards.map((s, i) => (
          <div key={i} className="card" style={{ padding: '14px 16px', transition: 'transform 160ms ease' }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>{s.l}</div>
            <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 800, color: s.c, letterSpacing: '-0.3px' }}>{s.v}</div>
            {s.s && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{s.s}</div>}
          </div>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Recent crypto trades</h2>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{trades.length} total</span>
        </div>
        {!recent.length ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>
            No crypto trades yet — engine runs 24/7.
          </div>
        ) : (
          <div>
            {recent.map((t, i) => {
              const cmp = prices?.[t.symbol]?.price ?? Number(t.price);
              const live = (cmp - Number(t.price)) * Number(t.quantity);
              const isOpen = t.status === 'OPEN';
              const shownPnl = isOpen ? live : Number(t.pnl || 0);
              const color = clr(shownPnl);
              const bgCircle = isOpen
                ? 'rgba(124,58,237,0.18)'
                : shownPnl >= 0 ? 'rgba(16,185,129,0.18)' : 'rgba(248,113,113,0.18)';
              const icon = isOpen ? '₿' : shownPnl >= 0 ? '↑' : '↓';
              return (
                <div key={i}
                  style={{
                    padding: '12px 18px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 12,
                    transition: 'background 140ms ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 9,
                    background: bgCircle,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color: 'var(--text)',
                    flexShrink: 0,
                  }}>{icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                      {t.symbol}
                      <span className="tabular-nums" style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 11, marginLeft: 6 }}>
                        × {Number(t.quantity || 0).toFixed(6)}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {fmtT(t.entry_time || t.created_at)}
                      {t.exit_reason ? ` · ${t.exit_reason}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {isOpen ? (
                      <>
                        <div className="tabular-nums" style={{ fontWeight: 700, color, fontSize: 14 }}>
                          {live >= 0 ? '+' : ''}{INR0(live)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>live</div>
                      </>
                    ) : (
                      <>
                        <div className="tabular-nums" style={{ fontWeight: 700, color, fontSize: 14 }}>
                          {Number(t.pnl || 0) >= 0 ? '+' : ''}{INR(t.pnl || 0)}
                        </div>
                        <div className="tabular-nums" style={{ fontSize: 11, color: clr(t.pnl_pct) }}>{pc(t.pnl_pct)}</div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {trades.length > 8 && (
              <div style={{ padding: 14, textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-secondary" onClick={() => onGoto('trades')} style={{ fontSize: 12 }}>
                  View all {trades.length} trades →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =======================================================
// POSITIONS
// =======================================================
function Positions({ openTrades, prices }) {
  if (!openTrades || !openTrades.length) {
    return (
      <div className="card" style={{ padding: 80, textAlign: 'center', color: 'var(--text3)' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>○</div>
        No open crypto positions right now.
        <div style={{ fontSize: 12, marginTop: 6 }}>The 24/7 scanner will open a position when a setup triggers.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {openTrades.map((pos, i) => {
        const entry = Number(pos.price);
        const qty = Number(pos.quantity);
        const cmp = prices?.[pos.symbol]?.price ?? entry;
        const sl = Number(pos.stop_loss);
        const tgt = Number(pos.target);
        const pnl = +((cmp - entry) * qty).toFixed(2);
        const pct = entry > 0 ? +(((cmp - entry) / entry) * 100).toFixed(2) : 0;
        const prog = Number.isFinite(sl) && Number.isFinite(tgt) && tgt !== sl
          ? Math.max(0, Math.min(100, ((cmp - sl) / (tgt - sl)) * 100))
          : 0;
        const pnlColor = clr(pnl);
        const pctColor = clr(pct);

        return (
          <div key={i}
            className="card card-premium"
            style={{
              padding: 16,
              borderLeft: `3px solid ${pnl >= 0 ? 'var(--green-text)' : 'var(--red-text)'}`,
              transition: 'transform 200ms ease, box-shadow 200ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <span className="chip" style={{ background: 'rgba(124,58,237,0.14)', color: 'var(--accent)', fontWeight: 700 }}>₿ BUY</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                  {pos.symbol}
                  <span className="tabular-nums" style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400, marginLeft: 6 }}>
                    × {qty.toFixed(6)}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {pos.name || ''}{pos.name ? ' · ' : ''}{fmtT(pos.entry_time || pos.created_at)}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div className="tabular-nums" style={{ fontWeight: 800, fontSize: 22, color: pnlColor, letterSpacing: '-0.5px' }}>
                  {pnl >= 0 ? '+' : ''}{INR0(pnl)}
                </div>
                <div className="tabular-nums" style={{ fontSize: 12, color: pctColor, fontWeight: 600 }}>{pc(pct)}</div>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
              gap: 10,
              marginBottom: 12,
            }}>
              {[
                ['Entry', `$${entry.toFixed(4)}`],
                ['Live', `$${Number(cmp).toFixed(4)}`],
                ['Stop Loss', Number.isFinite(sl) ? `$${sl.toFixed(4)}` : '—'],
                ['Target', Number.isFinite(tgt) ? `$${tgt.toFixed(4)}` : '—'],
                ['Capital', pos.capital != null ? INR0(pos.capital) : '—'],
              ].map(([l, v]) => (
                <div key={l} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{l}</div>
                  <div className="tabular-nums" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{
              height: 8,
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              overflow: 'hidden',
              marginBottom: 4,
            }}>
              <div style={{
                width: `${prog}%`,
                height: '100%',
                background: pnl >= 0
                  ? 'linear-gradient(90deg, rgba(16,185,129,0.5), var(--green-text))'
                  : 'linear-gradient(90deg, rgba(248,113,113,0.5), var(--red-text))',
                transition: 'width 400ms ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)' }}>
              <span>SL</span>
              <span>progress to target</span>
              <span>TGT</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =======================================================
// TRADE HISTORY
// =======================================================
function TradesHistory({ trades, stats, closedTrades, winRate }) {
  const pnl = Number(stats?.total_pnl || 0);
  const rows = Array.isArray(trades) ? trades : [];

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>All crypto trades</h2>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{rows.length} total · {closedTrades.length} closed</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ background: 'var(--bg2)' }}>
              {['Coin', 'Qty', 'Entry $', 'Exit $', 'Entry time', 'Exit time', 'P&L', 'Return', 'Exit reason', 'Result']
                .map((h, i) => (
                  <th key={i} style={{
                    textAlign: i >= 1 && i <= 3 || i === 6 || i === 7 ? 'right' : 'left',
                    padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    color: 'var(--text3)', letterSpacing: '0.6px',
                    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
            </tr>
          </thead>
          <tbody>
            {!rows.length ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                  No crypto trades yet.
                </td>
              </tr>
            ) : rows.map((t, i) => {
              const isOpen = t.status === 'OPEN';
              const pv = Number(t.pnl || 0);
              const pvc = isOpen ? 'var(--text3)' : clr(pv);
              const rc = isOpen ? 'var(--text3)' : clr(t.pnl_pct);
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 140ms' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,0.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text)' }}>{t.symbol}</td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: 'var(--text2)' }}>
                    {Number(t.quantity || 0).toFixed(6)}
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text)' }}>
                    ${Number(t.price || 0).toFixed(4)}
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text)' }}>
                    {t.exit_price != null ? `$${Number(t.exit_price).toFixed(4)}` : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                    {fmtT(t.entry_time || t.created_at)}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                    {fmtT(t.exit_time)}
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: pvc }}>
                    {isOpen ? '—' : `${pv >= 0 ? '+' : ''}${INR(pv)}`}
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', color: rc, fontWeight: 600 }}>
                    {isOpen ? '—' : pc(t.pnl_pct)}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text3)' }}>{t.exit_reason || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {isOpen
                      ? <span className="chip" style={{ background: 'rgba(124,58,237,0.14)', color: 'var(--accent)' }}>Open</span>
                      : pv >= 0
                        ? <span className="chip" style={{ background: 'rgba(16,185,129,0.14)', color: 'var(--green-text)' }}>Win</span>
                        : <span className="chip" style={{ background: 'rgba(248,113,113,0.14)', color: 'var(--red-text)' }}>Loss</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {closedTrades.length > 0 && (
        <div style={{
          padding: '10px 18px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: 18, flexWrap: 'wrap',
          fontSize: 12, color: 'var(--text2)',
          background: 'var(--bg2)',
        }}>
          <span>Closed: <b style={{ color: 'var(--text)' }}>{closedTrades.length}</b></span>
          <span>P&L: <b className="tabular-nums" style={{ color: clr(pnl) }}>{pnl >= 0 ? '+' : ''}{INR0(pnl)}</b></span>
          <span>Win rate: <b style={{ color: 'var(--text)' }}>{winRate}%</b></span>
        </div>
      )}
    </div>
  );
}

// =======================================================
// MARKET (Live prices)
// =======================================================
function Market({ prices, trades }) {
  const openSymbols = useMemo(
    () => new Set((Array.isArray(trades) ? trades : []).filter((t) => t?.status === 'OPEN').map((t) => t.symbol)),
    [trades]
  );
  const [search, setSearch] = useState('');
  const list = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return CRYPTO_LIST;
    return CRYPTO_LIST.filter((c) => c.sym.includes(q) || c.base.includes(q) || c.name.toUpperCase().includes(q));
  }, [search]);

  const setCurrentTab = useAppStore((s) => s.setCurrentTab);
  const gotoChart = (sym) => {
    try { window.__cryptoChartSym = sym; } catch {}
    setCurrentTab('crypto/chart');
  };
  const gotoNews = (sym) => {
    try { window.__cryptoNewsSym = sym; } catch {}
    setCurrentTab('crypto/news');
  };

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Live prices</h2>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            From Binance · Updates every 30 seconds · No account needed
          </div>
        </div>
        <input
          type="text"
          placeholder="Search coin…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            marginLeft: 'auto',
            padding: '8px 12px',
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text)',
            fontSize: 13,
            minWidth: 180,
          }}
        />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ background: 'var(--bg2)' }}>
              {['Coin', 'Name', 'Price (USDT)', '24h Change', '24h High', '24h Low', 'Volume (USD)', 'Actions']
                .map((h, i) => (
                  <th key={i} style={{
                    textAlign: i >= 2 && i <= 6 ? 'right' : 'left',
                    padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    color: 'var(--text3)', letterSpacing: '0.6px',
                    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const p = prices?.[c.sym];
              const chg = Number(p?.change24h ?? 0);
              const inPos = openSymbols.has(c.sym);
              return (
                <tr key={c.sym} style={{ borderBottom: '1px solid var(--border)', transition: 'background 140ms' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,0.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>{c.base}</div>
                    {inPos && <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>● in position</div>}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text2)' }}>{c.name}</td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>
                    {p ? `$${Number(p.price).toLocaleString('en-US', { maximumFractionDigits: 4 })}` : '—'}
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: chg >= 0 ? 'var(--green-text)' : 'var(--red-text)' }}>
                    {p ? `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` : '—'}
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: 'var(--text2)' }}>
                    {p ? `$${Number(p.high).toFixed(4)}` : '—'}
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: 'var(--text2)' }}>
                    {p ? `$${Number(p.low).toFixed(4)}` : '—'}
                  </td>
                  <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: 'var(--text2)' }}>
                    {p && p.quoteVolume != null ? `$${Math.round(Number(p.quoteVolume) / 1e6)}M` : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => gotoChart(c.sym)}>Chart</button>
                      <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => gotoNews(c.sym)}>News</button>
                    </div>
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

// =======================================================
// CHART (TradingView)
// =======================================================
function ChartPage({ prices, trades }) {
  const initial = (typeof window !== 'undefined' && window.__cryptoChartSym) || 'BTCUSDT';
  const [sym, setSym] = useState(initial);
  const containerRef = useRef(null);
  const widgetIdRef = useRef('tv-widget-crypto');

  useEffect(() => {
    let cancelled = false;
    const mount = () => {
      if (cancelled) return;
      const el = document.getElementById(widgetIdRef.current);
      if (!el || !window.TradingView) return;
      el.innerHTML = '';
      try {
        new window.TradingView.widget({
          container_id: widgetIdRef.current,
          symbol: `BINANCE:${sym}`,
          interval: '60',
          timezone: 'UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          width: '100%',
          height: 480,
          studies: ['MASimple@tv-basicstudies', 'RSI@tv-basicstudies'],
          hide_side_toolbar: false,
          allow_symbol_change: true,
          autosize: true,
        });
      } catch {}
    };
    if (window.TradingView) {
      mount();
    } else {
      const existing = document.querySelector('script[src="https://s3.tradingview.com/tv.js"]');
      if (existing) {
        existing.addEventListener('load', mount, { once: true });
      } else {
        const s = document.createElement('script');
        s.src = 'https://s3.tradingview.com/tv.js';
        s.async = true;
        s.onload = mount;
        document.head.appendChild(s);
      }
    }
    return () => { cancelled = true; };
  }, [sym]);

  const coinTrades = useMemo(
    () => (Array.isArray(trades) ? trades : []).filter((t) => t.symbol === sym).slice(0, 8),
    [trades, sym]
  );
  const livePrice = prices?.[sym]?.price;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="card" style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={sym}
          onChange={(e) => setSym(e.target.value)}
          style={{
            minWidth: 200, padding: '8px 12px',
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8,
            color: 'var(--text)', fontSize: 13,
          }}
        >
          {CRYPTO_LIST.map((c) => (
            <option key={c.sym} value={c.sym}>{c.base} — {c.name}</option>
          ))}
        </select>
        <span className="tabular-nums" style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
          {livePrice != null ? `$${Number(livePrice).toFixed(4)}` : ''}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>1h · TradingView · Binance</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div id={widgetIdRef.current} ref={containerRef} style={{ height: 480, width: '100%' }} />
      </div>

      {coinTrades.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text2)' }}>
            Paper trades for {sym}
          </div>
          {coinTrades.map((t, i) => {
            const isOpen = t.status === 'OPEN';
            const pv = Number(t.pnl || 0);
            return (
              <div key={i} style={{
                display: 'flex', gap: 10, padding: '8px 0',
                borderBottom: '1px solid var(--border)', alignItems: 'center', flexWrap: 'wrap',
              }}>
                {isOpen
                  ? <span className="chip" style={{ background: 'rgba(124,58,237,0.14)', color: 'var(--accent)' }}>Open</span>
                  : pv >= 0
                    ? <span className="chip" style={{ background: 'rgba(16,185,129,0.14)', color: 'var(--green-text)' }}>Win</span>
                    : <span className="chip" style={{ background: 'rgba(248,113,113,0.14)', color: 'var(--red-text)' }}>Loss</span>}
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {fmtT(t.entry_time)} → {fmtT(t.exit_time)}
                </span>
                <span className="tabular-nums" style={{ fontSize: 12, color: 'var(--text2)' }}>
                  Entry ${Number(t.price || 0).toFixed(4)}
                </span>
                {t.exit_price != null && (
                  <span className="tabular-nums" style={{ fontSize: 12, color: 'var(--text2)' }}>
                    Exit ${Number(t.exit_price).toFixed(4)}
                  </span>
                )}
                <span className="tabular-nums" style={{ marginLeft: 'auto', fontWeight: 700, color: isOpen ? 'var(--text3)' : clr(pv) }}>
                  {isOpen ? 'Open' : `${pv >= 0 ? '+' : ''}${INR(pv)}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =======================================================
// NEWS
// =======================================================
function NewsPage() {
  const initial = (typeof window !== 'undefined' && window.__cryptoNewsSym) || 'BTCUSDT';
  const [sym, setSym] = useState(initial);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState(null);

  const load = useCallback(async (targetSym) => {
    const coin = CRYPTO_LIST.find((c) => c.sym === targetSym);
    const base = coin?.base || targetSym.replace('USDT', '');
    setStatus('Fetching…');
    setErr(null);
    try {
      const d = await apiGet(`/api/news?sym=${encodeURIComponent(base)}&name=${encodeURIComponent(base + ' cryptocurrency bitcoin')}`);
      const arr = Array.isArray(d) ? d : (Array.isArray(d?.items) ? d.items : []);
      setItems(arr);
      setStatus('');
    } catch (e) {
      setErr('Could not load news');
      setItems([]);
      setStatus('');
    }
  }, []);

  useEffect(() => { load(sym); }, [load, sym]);

  const bull = items.filter((n) => n.sentiment === 'bullish').length;
  const bear = items.filter((n) => n.sentiment === 'bearish').length;
  const neut = items.filter((n) => n.sentiment === 'neutral').length;
  const total = items.length || 1;
  const score = Math.round(((bull - bear) / total) * 100);
  const label = CRYPTO_LIST.find((c) => c.sym === sym)?.base || sym;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="card" style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={sym}
          onChange={(e) => setSym(e.target.value)}
          style={{
            minWidth: 200, padding: '8px 12px',
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8,
            color: 'var(--text)', fontSize: 13,
          }}
        >
          {CRYPTO_LIST.map((c) => (
            <option key={c.sym} value={c.sym}>{c.base} — {c.name}</option>
          ))}
        </select>
        <span style={{ fontSize: 11, color: 'var(--text3)' }} className={status ? 'animate-pulse-custom' : ''}>{status}</span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {bull > 0 && <span className="chip" style={{ background: 'rgba(16,185,129,0.14)', color: 'var(--green-text)' }}>{bull} bullish</span>}
          {bear > 0 && <span className="chip" style={{ background: 'rgba(248,113,113,0.14)', color: 'var(--red-text)' }}>{bear} bearish</span>}
          {neut > 0 && <span className="chip" style={{ background: 'var(--bg2)', color: 'var(--text3)' }}>{neut} neutral</span>}
          <button className="btn btn-secondary" onClick={() => load(sym)} style={{ fontSize: 12 }}>↻ Refresh</button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="card" style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Sentiment for {label}</div>
          <div style={{ height: 8, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden', marginBottom: 6, border: '1px solid var(--border)' }}>
            <div style={{
              width: `${Math.max(0, Math.min(100, (bull / total) * 100))}%`,
              height: '100%',
              background: 'linear-gradient(90deg, rgba(16,185,129,0.6), var(--green-text))',
              transition: 'width 400ms ease',
            }} />
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text3)' }}>
            <span style={{ color: 'var(--green-text)' }}>● {bull} bullish</span>
            <span style={{ color: 'var(--red-text)' }}>● {bear} bearish</span>
            <span style={{ marginLeft: 'auto', fontWeight: 700, color: score >= 0 ? 'var(--green-text)' : 'var(--red-text)' }}>
              {score >= 0 ? 'Bullish' : 'Bearish'} {Math.abs(score)}%
            </span>
          </div>
        </div>
      )}

      {err && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--red-text)' }}>
          {err}
        </div>
      )}

      {!err && !items.length && !status && (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>
          No recent headlines for {label}.
        </div>
      )}

      {!err && status && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
          <div className="animate-pulse-custom">Loading news…</div>
        </div>
      )}

      {items.map((item, i) => {
        const accentColor = item.sentiment === 'bullish' ? 'var(--green-text)'
          : item.sentiment === 'bearish' ? 'var(--red-text)' : 'var(--text3)';
        return (
          <div key={i} className="card" style={{
            padding: 14,
            borderLeft: `3px solid ${accentColor}`,
          }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
              <span className="chip" style={{
                background: item.sentiment === 'bullish'
                  ? 'rgba(16,185,129,0.14)'
                  : item.sentiment === 'bearish'
                    ? 'rgba(248,113,113,0.14)'
                    : 'var(--bg2)',
                color: accentColor,
                textTransform: 'capitalize',
              }}>{item.sentiment || 'neutral'}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                {item.source || ''}{item.timeAgo ? ` · ${item.timeAgo}` : ''}
              </span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.5, marginBottom: 4, color: 'var(--text)' }}>
              {item.link
                ? <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{item.headline}</a>
                : item.headline}
            </div>
            {item.impact && (
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{item.impact}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
