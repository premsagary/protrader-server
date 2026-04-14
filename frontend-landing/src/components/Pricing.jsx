import React from 'react';
import { goToApp } from '../App';

const FEATURES = [
  'Deep Analyzer — 14-point Varsity checklist + 30+ indicators',
  'AI Council Review — 5 models + Claude judge synthesis',
  'Stock Picks — Rebound, Momentum, Long-Term lists (daily)',
  'Mutual Fund scoring — 100-point framework, 4 categories',
  'Stock Data browser — all 567 NSE stocks with filters',
  'Holdings tracking — live CMP, P&L, AI review on demand',
  'Paper RoboTrade — stocks (9:15–15:30) + crypto (24/7)',
  'DayTrade scanner — intraday setups (coming soon)',
];

export default function Pricing() {
  return (
    <section id="pricing" style={{ padding: '96px 24px', scrollMarginTop: 72 }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 48 }}>
          <div className="label-xs" style={{ marginBottom: 14 }}>Access</div>
          <h2 className="section-title" style={{ color: 'var(--text)' }}>
            Completely <span className="gradient-fill">free.</span> No strings.
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text2)', marginTop: 18, lineHeight: 1.6 }}>
            ProTrader is free during the public beta. No signup, no credit card, no trial expiration. Just open and start analyzing.
          </p>
        </div>

        {/* Price card */}
        <div
          className="card card-premium reveal"
          style={{
            padding: '40px 36px',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '1.4px',
              textTransform: 'uppercase',
              color: 'var(--brand-text)',
              background: 'var(--brand-bg-strong)',
              padding: '6px 14px',
              borderRadius: 9999,
              marginBottom: 20,
            }}
          >
            Free public beta
          </span>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, letterSpacing: '-0.1px' }}>Full Access</div>
          <div
            className="hero-num gradient-fill tabular-nums"
            style={{ marginBottom: 6 }}
          >
            ₹0
          </div>
          <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 32 }}>forever · no upgrades · no limits</div>

          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '0 0 32px',
              textAlign: 'left',
              display: 'grid',
              gap: 12,
            }}
          >
            {FEATURES.map((f, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  fontSize: 14,
                  color: 'var(--text)',
                  lineHeight: 1.5,
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    background: 'var(--brand-bg)',
                    border: '1px solid var(--brand-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M2.5 5.5 L4.5 7.5 L8.5 3.5" stroke="var(--brand-text)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {f}
              </li>
            ))}
          </ul>

          <button className="btn btn-primary" onClick={goToApp} style={{ width: '100%', height: 52, fontSize: 16 }}>
            Start Analyzing — Free
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8 H13 M9 4 L13 8 L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Why free */}
        <div
          className="reveal"
          style={{
            marginTop: 32,
            padding: '24px 28px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.2px' }}>Why free?</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
            Retail traders deserve institutional-grade analysis tools. Premium AI features will be available later — but the core platform stays free.
          </div>
        </div>
      </div>
    </section>
  );
}
