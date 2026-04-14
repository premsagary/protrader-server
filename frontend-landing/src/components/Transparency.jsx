import React from 'react';

const PILLARS = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M4 17 L8 11 L12 14 L18 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8" cy="11" r="1.5" fill="currentColor" />
        <circle cx="12" cy="14" r="1.5" fill="currentColor" />
        <circle cx="18" cy="5" r="1.5" fill="currentColor" />
      </svg>
    ),
    title: 'Every score is Varsity-grounded',
    desc: 'No proprietary black-box metrics. The 14-point checklist, 5-factor composite score, buy-zone logic — all maps to specific Zerodha Varsity modules you can verify yourself.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="7.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="11" cy="11" r="3" fill="currentColor" opacity="0.4" />
        <circle cx="11" cy="11" r="1.2" fill="currentColor" />
      </svg>
    ),
    title: 'Every AI vote is shown',
    desc: 'Not one opaque AI answer. Five independent models (GPT-4.1, DeepSeek, Gemini, Qwen, Llama) each cast a vote — a Claude judge synthesizes. You see every disagreement.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="12" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="3" y="12" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="12" y="12" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
    title: 'Every indicator is explained',
    desc: 'RSI, MACD, Ichimoku, ADX, Bollinger, VWAP — each indicator shows its Varsity source, its threshold, and why it matters for this specific stock right now.',
  },
];

export default function Transparency() {
  return (
    <section style={{ padding: '80px 24px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="label-xs" style={{ marginBottom: 14 }}>Transparency by design</div>
          <h2 className="section-title" style={{ color: 'var(--text)' }}>
            Built for people who ask <span className="gradient-fill">"why?"</span>
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text2)', lineHeight: 1.6, maxWidth: 620, margin: '18px auto 0' }}>
            Most platforms hide how their scores are computed. We publish the architecture.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
          }}
        >
          {PILLARS.map((p, i) => (
            <div
              key={i}
              className="card reveal"
              style={{ padding: 28, transitionDelay: `${i * 60}ms` }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'var(--brand-bg)',
                  border: '1px solid var(--brand-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--brand-text)',
                  marginBottom: 20,
                }}
              >
                {p.icon}
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 10, letterSpacing: '-0.2px' }}>
                {p.title}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.65 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
