import React from 'react';

const STEPS = [
  {
    n: '01',
    title: 'Pick any NSE stock',
    desc: 'Type a symbol — RELIANCE, TCS, HDFCBANK — into the Deep Analyzer. Works with 567 stocks across Nifty 50, Next 50, Midcap, and Smallcap.',
  },
  {
    n: '02',
    title: 'Get a complete breakdown',
    desc: 'In seconds: 14-point Varsity checklist (trend, momentum, ROE, D/E, margins, PEG), support/resistance, buy zones, Fibonacci targets, live news sentiment.',
  },
  {
    n: '03',
    title: 'Ask 5 AIs for a second opinion',
    desc: 'One click sends your stock to GPT-4.1, DeepSeek, Gemini, Qwen, Llama — each with Varsity training. A Claude judge synthesizes a final verdict.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how" style={{ padding: '96px 24px', scrollMarginTop: 72 }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 64 }}>
          <div className="label-xs" style={{ marginBottom: 14 }}>How it works</div>
          <h2 className="section-title" style={{ color: 'var(--text)' }}>
            From stock symbol to <span className="gradient-fill">conviction</span> in 3 steps
          </h2>
        </div>

        {/* Steps — with connecting line */}
        <div
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 24,
          }}
        >
          {/* Dashed connector behind cards — desktop only */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 52,
              left: '16.5%',
              right: '16.5%',
              height: 2,
              background: 'linear-gradient(90deg, transparent, var(--border2), transparent)',
              zIndex: 0,
              pointerEvents: 'none',
            }}
            className="hide-mobile"
          />

          {STEPS.map((s, i) => (
            <div
              key={i}
              className="reveal"
              style={{
                position: 'relative',
                zIndex: 1,
                textAlign: 'center',
                padding: '0 10px',
                transitionDelay: `${i * 80}ms`,
              }}
            >
              {/* Number badge */}
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  background: i === 0 ? 'var(--gradient)' : 'var(--bg2)',
                  border: i === 0 ? 'none' : '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 24px',
                  boxShadow: i === 0 ? 'var(--shadow-brand)' : 'var(--shadow)',
                }}
              >
                <span
                  className="tabular-nums"
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: i === 0 ? '#fff' : 'var(--brand-text)',
                    letterSpacing: '-0.5px',
                  }}
                >
                  {s.n}
                </span>
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 12, letterSpacing: '-0.3px' }}>
                {s.title}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.65, maxWidth: 320, margin: '0 auto' }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>

        <style>{`
          @media (max-width: 768px) {
            .hide-mobile { display: none !important }
          }
        `}</style>
      </div>
    </section>
  );
}
