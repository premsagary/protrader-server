import React from 'react';

// Free tier — what you get right now after clicking "Start Analyzing"
const FREE = [
  {
    title: 'Deep Stock Analyzer',
    flagship: true,
    desc: '14-point Varsity checklist, support/resistance, Fibonacci levels, buy zones, 30+ indicators, and live news sentiment — for every NSE stock in under 10 seconds.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M16.5 16.5 L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M8 11 L10.5 13.5 L14 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Stock Picks',
    desc: 'Three daily strategies: Rebound (quality on sale), Momentum (5-factor score), and Long-Term (Buffett criteria). Sortable, filterable, fully transparent.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <path d="M4 20 L10 12 L14 15 L22 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 5 H22 V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Mutual Fund Scoring',
    desc: '100-point framework across Large, Mid, Small and Flexi Cap. Eligibility filters automatically exclude funds that don\'t meet quality thresholds.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <path d="M13 4 L22 8 V13 C22 18 18 21 13 23 C8 21 4 18 4 13 V8 L13 4 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9 13 L12 16 L17 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Stock Data Browser',
    desc: 'Every fundamental, every indicator, every score for all 567 NSE stocks. Sortable, searchable, filterable by Nifty50 / Next50 / Midcap / Smallcap.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <rect x="4" y="6" width="18" height="3" rx="1" stroke="currentColor" strokeWidth="1.8" />
        <rect x="4" y="11" width="18" height="3" rx="1" stroke="currentColor" strokeWidth="1.8" />
        <rect x="4" y="16" width="18" height="3" rx="1" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
];

// Coming soon — admin/experimental, not in free tier
const COMING_SOON = [
  {
    title: 'AI Council + Judge',
    desc: 'Five independent AI models (GPT-4.1, DeepSeek, Gemini, Qwen, Llama) each cast a vote. A Claude judge synthesizes into a final verdict with every disagreement visible.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 3 C7 3 5 6 5 9 C5 11 6 12.5 7 13.5 V17 H15 V13.5 C16 12.5 17 11 17 9 C17 6 15 3 11 3 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="8.5" cy="9" r="0.9" fill="currentColor" />
        <circle cx="11" cy="9" r="0.9" fill="currentColor" />
        <circle cx="13.5" cy="9" r="0.9" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: 'Holdings + AI Review',
    desc: 'Track your real portfolio with live CMP, P&L, and on-demand Varsity-grounded AI reviews for every holding.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="7" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 7 V5 C7 3.9 7.9 3 9 3 H13 C14.1 3 15 3.9 15 5 V7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Paper RoboTrade',
    desc: 'Risk-free paper trading for stocks (9:15–15:30) and crypto (24/7). Strategy bots scan and execute — you watch the P&L build.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M5 11 L9 7 V9 H17 V13 H9 V15 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'DayTrade Scanner',
    desc: 'Intraday setups scored in real-time: VWAP Reclaim, Gap & Go, Breakout, Oversold Bounce. Varsity Module 2 grounded.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 3 L4 13 H10 L9 19 L18 9 H12 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'MiroFish Lab',
    desc: 'An experimental OASIS-based multi-agent simulator that spawns 56 investor personas and watches how each reacts to a stock.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M4 11 C5 7.5 9 6 13 6 C17 6 21 7.5 21 11 C21 14.5 17 16 13 16 C9 16 5 14.5 4 11 Z" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="15" cy="11" r="1.8" fill="currentColor" />
      </svg>
    ),
  },
];

export default function Features() {
  return (
    <section id="features" style={{ padding: '96px 24px', scrollMarginTop: 72 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Free section header */}
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 9999,
              background: 'var(--green-bg)',
              border: '1px solid rgba(52,211,153,0.3)',
              color: 'var(--green-text)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M9.5 3 L4.5 8.5 L2.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Free now · no signup
          </div>
          <h2 className="section-title" style={{ color: 'var(--text)' }}>
            Everything you need to <span className="gradient-fill">make the call</span>
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text2)', lineHeight: 1.6, maxWidth: 620, margin: '18px auto 0' }}>
            Four core tools, 100% free during the public beta. No credit card, no trial clock.
          </p>
        </div>

        {/* Free features — 4 cards, flagship gets gradient border */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
            marginBottom: 72,
          }}
        >
          {FREE.map((f, i) => (
            <div
              key={i}
              className={`card reveal ${f.flagship ? 'card-premium' : ''}`}
              style={{ padding: 28, transitionDelay: `${i * 70}ms` }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: 'var(--gradient-soft)',
                    border: '1px solid var(--brand-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--brand-text)',
                  }}
                >
                  {f.icon}
                </div>
                {f.flagship && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '1.2px',
                      textTransform: 'uppercase',
                      color: 'var(--brand-text)',
                      background: 'var(--brand-bg)',
                      padding: '4px 10px',
                      borderRadius: 9999,
                      marginLeft: 'auto',
                    }}
                  >
                    Flagship
                  </span>
                )}
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 10, letterSpacing: '-0.3px' }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Coming soon header */}
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 40 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 9999,
              background: 'rgba(251,191,36,0.12)',
              border: '1px solid rgba(251,191,36,0.25)',
              color: 'var(--amber-text)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              marginBottom: 14,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6 3.5 V6 L7.5 7.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Coming soon · advanced tier
          </div>
          <h3 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px', marginBottom: 10 }}>
            What we're building next
          </h3>
          <p style={{ fontSize: 14, color: 'var(--text3)', maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
            In internal testing today · rolling out to users as they stabilize
          </p>
        </div>

        {/* Coming soon — smaller cards with pulsing dot */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 14,
          }}
        >
          {COMING_SOON.map((f, i) => (
            <div
              key={i}
              className="card reveal"
              style={{
                padding: 20,
                opacity: 0.92,
                transitionDelay: `${i * 50}ms`,
              }}
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text3)',
                    flexShrink: 0,
                  }}
                >
                  {f.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>
                      {f.title}
                    </h4>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.8px',
                        textTransform: 'uppercase',
                        color: 'var(--amber-text)',
                        background: 'rgba(251,191,36,0.12)',
                        border: '1px solid rgba(251,191,36,0.22)',
                        padding: '2px 7px',
                        borderRadius: 9999,
                      }}
                    >
                      Soon
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.55 }}>{f.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
