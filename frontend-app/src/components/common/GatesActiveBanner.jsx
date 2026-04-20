import React from 'react';

/**
 * GatesActiveBanner — shared 5-layer gate stack visualization.
 *
 * Used by DayTrade, StocksRoboTrade, Agent, and Admin tabs so the same
 * Varsity-+-book-rules philosophy is surfaced consistently wherever a user
 * looks.
 *
 * Layers (top-to-bottom = earliest-to-latest in the pipeline):
 *   1. Picks Preflight     — whipsaw/earnings/delivery/circuit/drawdown/daily-loss
 *   2. Varsity Binary Gate — M2 Ch20+21, 12 item hard gate (scoreDayTrade)
 *   3. Book-Rules Gate     — v1.1.0 regime + losing patterns + structural NN
 *   4. Constraints         — 1%/2%/3×/5/day/30min cooldown + correlation
 *   5. Management          — SL=1ATR, TP=1.5ATR, BE@+1R, trail@+2R, 15:15 sqr
 *
 * Props:
 *   variant   — 'full' (default, list view) | 'compact' (single strip, one row of chips)
 *   accent    — tailwind-ish colour tint class hint ('green'|'indigo'|'slate')
 *   title     — override the default title
 *   subtitle  — extra explanation line under the title
 */
export default function GatesActiveBanner({
  variant = 'full',
  accent = 'green',
  title,
  subtitle,
}) {
  const accentMap = {
    green:  { border: '#10b981', bg: 'rgba(16,185,129,0.08)', glow: 'rgba(16,185,129,0.35)', text: '#065f46' },
    indigo: { border: '#6366f1', bg: 'rgba(99,102,241,0.08)', glow: 'rgba(99,102,241,0.35)', text: '#3730a3' },
    slate:  { border: '#475569', bg: 'rgba(71,85,105,0.08)',  glow: 'rgba(71,85,105,0.30)',  text: '#1f2937' },
  };
  const C = accentMap[accent] || accentMap.green;

  const LAYERS = [
    {
      n: 1,
      name: 'Picks Preflight',
      color: '#0ea5e9',
      blurb: 'Rejects whipsaw / earnings / low-delivery / circuit / drawdown / daily-loss before a symbol even reaches the DayTrade scanner.',
      chips: ['whipsaw', 'earnings-window', 'delivery %', 'circuit band', 'drawdown', 'daily-loss'],
    },
    {
      n: 2,
      name: 'Varsity Binary Gate',
      color: '#f59e0b',
      blurb: 'Zerodha Varsity M2 Ch20+21 — 12-item binary checklist inside scoreDayTrade(). Any fail → null, no BUY emitted.',
      chips: ['trend alignment', 'OR break', 'PDH break', 'VWAP side', 'volume ≥1.5×', 'range expansion', 'ATR band', 'R:R ≥1.5', 'structure dist', 'no-news', 'hour gate', 'candle confirm'],
    },
    {
      n: 3,
      name: 'Book-Rules Gate v1.1.0',
      color: '#10b981',
      blurb: 'Promoted from diagnostic → hard gate 2026-04-20. Only net-new checks (no Varsity overlap): regime + losing-patterns + structural non-negotiables.',
      chips: ['regime ≠ NO_TRADE', 'no chasing >0.30×ATR', 'no vertical spike (3× green no pullback)', 'no counter-EMA stack', 'no big-gap fade', 'away from round #', 'NN01/04/05/06/19/20'],
    },
    {
      n: 4,
      name: 'Constraints / Risk Engine',
      color: '#8b5cf6',
      blurb: 'Hard caps applied after a BUY signal qualifies — sizes the trade or blocks it outright.',
      chips: ['1% risk/trade', '2% daily loss', '≤3 concurrent', '≤5 trades/day', '30min cooldown', 'no-dupe symbol', 'no-dupe sector', 'VIX ≤20'],
    },
    {
      n: 5,
      name: 'Trade Management',
      color: '#ef4444',
      blurb: 'Post-fill: every position managed deterministically until exit. No manual overrides from the agent loop.',
      chips: ['SL = 1×ATR', 'TP = 1.5×ATR', 'BE @ +1R', 'ATR trail @ +2R', 'time-stop 360min', '15:15 IST squareoff'],
    },
  ];

  const defaultTitle = 'Gates Active — Varsity + Book-Rules Pipeline';
  const defaultSubtitle = 'Every BUY passes all 5 layers. Any single fail → no trade.';

  if (variant === 'compact') {
    return (
      <div
        style={{
          border: `1px solid ${C.border}`,
          background: C.bg,
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          boxShadow: `0 0 0 1px ${C.glow} inset`,
          fontSize: 12,
        }}
      >
        <span style={{ fontWeight: 700, color: C.text }}>
          {title || 'Gates Active'}
        </span>
        <span style={{ opacity: 0.7 }}>•</span>
        {LAYERS.map((l) => (
          <span
            key={l.n}
            title={`${l.name}: ${l.blurb}`}
            style={{
              background: '#fff',
              border: `1px solid ${l.color}55`,
              color: l.color,
              padding: '2px 8px',
              borderRadius: 999,
              fontWeight: 600,
              cursor: 'help',
            }}
          >
            {l.n}. {l.name}
          </span>
        ))}
      </div>
    );
  }

  // variant === 'full'
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        background: `linear-gradient(135deg, ${C.bg}, rgba(255,255,255,0))`,
        borderRadius: 14,
        padding: 16,
        boxShadow: `0 8px 24px ${C.glow}`,
        transition: 'transform .25s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.text, letterSpacing: 0.2 }}>
            ✅ {title || defaultTitle}
          </div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
            {subtitle || defaultSubtitle}
          </div>
        </div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>
          scoreV: Varsity M2 Ch20+21 · book-rules v1.1.0 · agent-config 1.4.0
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
        {LAYERS.map((l) => (
          <div
            key={l.n}
            style={{
              display: 'grid',
              gridTemplateColumns: '34px 1fr',
              gap: 10,
              alignItems: 'start',
              padding: '8px 10px',
              background: '#fff',
              borderRadius: 10,
              border: `1px solid ${l.color}33`,
              boxShadow: `inset 3px 0 0 ${l.color}`,
              transition: 'transform .2s ease, box-shadow .2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(2px)'; e.currentTarget.style.boxShadow = `inset 3px 0 0 ${l.color}, 0 4px 12px ${l.color}22`; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.boxShadow = `inset 3px 0 0 ${l.color}`; }}
          >
            <div
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: l.color, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 13,
              }}
            >
              {l.n}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>
                {l.name}
              </div>
              <div style={{ fontSize: 12, opacity: 0.78, marginTop: 2 }}>
                {l.blurb}
              </div>
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {l.chips.map((c, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: `${l.color}14`,
                      color: l.color,
                      border: `1px solid ${l.color}33`,
                      fontWeight: 600,
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, opacity: 0.7, textAlign: 'right' }}>
        Balaji build · promoted 2026-04-20 · shiva-ui still at pre-gate baseline for LIVE rollout
      </div>
    </div>
  );
}
