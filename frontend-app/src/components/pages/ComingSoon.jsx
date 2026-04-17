import React from 'react';
import { useAppStore } from '../../store/useAppStore';

const TAB_INFO = {
  mf: {
    title: 'MF Picks',
    desc: '100-point mutual fund scoring across Small Cap, Mid Cap, Flexi Cap. Tickertape data + SEBI-flagged filtering + MiroFish wealth projections.',
  },
  'stocks/overview': {
    title: 'Stocks RoboTrade',
    desc: 'Paper trading for NSE stocks with 7 strategy bots scanning every 3 minutes during market hours. Full P&L tracking, candidate queue, live market feed.',
  },
  'crypto/overview': {
    title: 'Crypto RoboTrade',
    desc: '24/7 crypto paper trading on 20 Binance pairs. Same strategy engine as stocks. Scans every 15 minutes.',
  },
  holdings: {
    title: 'Holdings',
    desc: 'Track your actual portfolio with live CMP and P&L. On-demand Varsity-grounded AI review across 5 models for every holding.',
  },
  mirofish: {
    title: 'MiroFish Lab',
    desc: 'Experimental OASIS-based multi-agent investor simulator. Spawns 56 investor personas and reports how each reacts to a stock.',
  },
  stockdata: {
    title: 'Stock Data',
    desc: 'Full universe browser — every fundamental, every indicator, every score for all 567 NSE stocks. Sortable, searchable, filterable.',
  },
  daytrade: {
    title: 'DayTrade Scanner',
    desc: 'Intraday setups scored in real-time: VWAP Reclaim, Gap & Go, Breakout, Oversold Bounce. Varsity Module 2 grounded.',
  },
  architecture: {
    title: 'Architecture',
    desc: 'End-to-end data flow transparency. 5 data sources → 4 scoring engines → 10 user-facing tabs → Deep AI Review council.',
  },
  admin: {
    title: 'Admin',
    desc: 'Pipeline monitoring, manual sync triggers, user management, live server logs.',
  },
};

export default function ComingSoon({ tab }) {
  const info = TAB_INFO[tab] || { title: tab, desc: 'This tab is still in the v1 interface.' };
  const backToLegacy = () => {
    window.location.href = `/app.html#${tab}`;
  };

  return (
    <div style={{ paddingTop: 40 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 9999,
            background: 'rgba(251,191,36,0.12)',
            border: '1px solid rgba(251,191,36,0.28)',
            color: 'var(--amber-text)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            marginBottom: 20,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6 3.5 V6 L7.5 7.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          v2 migration in progress
        </div>

        <h1
          style={{
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: '-1.2px',
            lineHeight: 1.1,
            marginBottom: 16,
          }}
        >
          <span className="gradient-fill">{info.title}</span>
        </h1>
        <p style={{ fontSize: 17, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 32, maxWidth: 620, margin: '0 auto 32px' }}>
          {info.desc}
        </p>

        <div
          className="card card-premium"
          style={{ padding: 28, marginBottom: 24, textAlign: 'left' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'var(--brand-bg)',
                border: '1px solid var(--brand-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--brand-text)',
                flexShrink: 0,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M11 2 C6 2 2 6 2 11 C2 16 6 20 11 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M11 6 V11 L14 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                Still fully functional in v1
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55, marginBottom: 16 }}>
                Every feature works exactly as before — we're just rebuilding the interface page by page. Click below to use the current (v1) version.
              </div>
              <button
                onClick={backToLegacy}
                className="btn btn-primary"
                style={{ height: 40 }}
              >
                Open {info.title}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7 H11 M8 4 L11 7 L8 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          Already modernized:{' '}
          <MigratedTab id="stockanalyzer" /> ·{' '}
          <MigratedTab id="stockrec" />
        </div>
      </div>
    </div>
  );
}

function MigratedTab({ id }) {
  const setCurrentTab = useAppStore((s) => s.setCurrentTab);
  const tabs = useAppStore((s) => s.tabs);
  const label = tabs.find((t) => t.id === id)?.label || id;
  return (
    <button
      onClick={() => setCurrentTab(id)}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'var(--brand-text)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        textDecoration: 'underline',
        textDecorationColor: 'rgba(99,102,241,0.4)',
        textUnderlineOffset: 2,
        padding: 0,
      }}
    >
      {label}
    </button>
  );
}
