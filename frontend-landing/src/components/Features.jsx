import React from 'react';

const PRIMARY = [
  {
    badge: 'Flagship',
    title: 'Deep Stock Analyzer',
    desc: '14-point Varsity checklist, support/resistance mapping, Fibonacci levels, buy zones, 30+ technical indicators, and live news sentiment. The most thorough analysis you\'ll find — in under 10 seconds.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M16.5 16.5 L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M8 11 L10.5 13.5 L14 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    badge: '5 Models',
    title: 'AI Council + Judge',
    desc: 'Five independent AI models — GPT-4.1, DeepSeek V3, Gemini 2.5, Qwen 3 Max, Groq Llama — each vote with full Varsity context. A Claude Sonnet 4.6 judge resolves conflicts into a final verdict.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <path d="M13 3 C7.5 3 5 7 5 11 C5 14 7 16 8 17 V21 H18 V17 C19 16 21 14 21 11 C21 7 18.5 3 13 3 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx="10" cy="11" r="1.2" fill="currentColor" />
        <circle cx="13" cy="11" r="1.2" fill="currentColor" />
        <circle cx="16" cy="11" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    badge: 'Experiment',
    title: 'MiroFish Lab',
    desc: 'An OASIS-based multi-agent simulator that spawns 56 investor personas and watches how each reacts to a stock. Sentiment modeling at retail scale.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <path d="M4 13 C5 9 9 7 13 7 C17 7 21 9 22 13 C21 17 17 19 13 19 C9 19 5 17 4 13 Z" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="15" cy="13" r="2" fill="currentColor" />
      </svg>
    ),
  },
];

const SECONDARY = [
  {
    title: 'Stock Picks',
    desc: 'Daily lists: Rebound (quality on sale), Momentum (5-factor score), Long-Term (Buffett criteria). Sortable, filterable.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M3 17 L8 10 L12 13 L19 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 5 H19 V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Mutual Fund Scoring',
    desc: '100-point framework across Small, Mid, Flexi Cap. Eligibility filters exclude funds that don\'t meet quality thresholds.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 3 L19 7 V11 C19 15.5 15.5 18.5 11 20 C6.5 18.5 3 15.5 3 11 V7 L11 3 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8 11 L10.5 13.5 L14 9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Paper RoboTrade',
    desc: 'Risk-free paper trading for stocks and crypto. Strategy bots scan and execute — you watch the P&L build.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M5 11 L9 7 V9 H17 V13 H9 V15 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Stock Data Browser',
    desc: 'Every fundamental, every indicator, every score for all 567 NSE stocks. Sortable, searchable, fully transparent.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="5" width="16" height="3" rx="1" stroke="currentColor" strokeWidth="1.8" />
        <rect x="3" y="10" width="16" height="3" rx="1" stroke="currentColor" strokeWidth="1.8" />
        <rect x="3" y="15" width="16" height="3" rx="1" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    title: 'Holdings + AI Review',
    desc: 'Track your real portfolio with live CMP and P&L. Get Varsity-grounded AI reviews of every holding on demand.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="7" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 7 V5 C7 3.9 7.9 3 9 3 H13 C14.1 3 15 3.9 15 5 V7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'DayTrade Scanner',
    desc: 'Intraday setups scored in real-time: VWAP Reclaim, Gap & Go, Breakout, Oversold Bounce. Varsity Module 2 grounded.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 3 L4 13 H10 L9 19 L18 9 H12 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function Features() {
  return (
    <section id="features" style={{ padding: '96px 24px', scrollMarginTop: 72 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="label-xs" style={{ marginBottom: 14 }}>Platform</div>
          <h2 className="section-title" style={{ color: 'var(--text)' }}>
            Everything you need to <span className="gradient-fill">make the call</span>
          </h2>
        </div>

        {/* Primary — 3 large cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 20,
            marginBottom: 20,
          }}
        >
          {PRIMARY.map((f, i) => (
            <div
              key={i}
              className={`card reveal ${i === 0 ? 'card-premium' : ''}`}
              style={{ padding: 32, transitionDelay: `${i * 80}ms` }}
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
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    color: 'var(--brand-text)',
                    background: 'var(--brand-bg)',
                    padding: '4px 10px',
                    borderRadius: 9999,
                    marginLeft: 'auto',
                  }}
                >
                  {f.badge}
                </span>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 10, letterSpacing: '-0.3px' }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Secondary — smaller grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {SECONDARY.map((f, i) => (
            <div
              key={i}
              className="card reveal"
              style={{ padding: 22, transitionDelay: `${i * 50}ms` }}
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
                    color: 'var(--brand-text)',
                    flexShrink: 0,
                  }}
                >
                  {f.icon}
                </div>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.2px' }}>
                    {f.title}
                  </h4>
                  <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
