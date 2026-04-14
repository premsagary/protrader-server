import React from 'react';

export default function Methodology() {
  return (
    <section style={{ padding: '80px 24px 48px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div
          className="card reveal"
          style={{
            padding: '40px 44px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 36,
            alignItems: 'center',
          }}
        >
          {/* Left: Methodology */}
          <div>
            <div className="label-xs" style={{ marginBottom: 12 }}>Methodology</div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 12, letterSpacing: '-0.4px', lineHeight: 1.25 }}>
              Grounded in <span className="gradient-fill">Zerodha Varsity</span>
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7 }}>
              India's most respected free trading education. No proprietary black-box metrics — the 14-point checklist, 5-factor composite score, and buy-zone logic all map to specific Varsity modules you can verify yourself.
            </p>
          </div>

          {/* Divider */}
          <div style={{ position: 'relative' }}>
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: '-18px',
                top: 0,
                bottom: 0,
                width: 1,
                background: 'var(--border)',
                display: window.innerWidth > 768 ? 'block' : 'none',
              }}
              className="hide-mobile"
            />

            {/* Right: Disclaimer */}
            <div
              style={{
                background: 'rgba(251,191,36,0.06)',
                border: '1px solid rgba(251,191,36,0.18)',
                borderRadius: 12,
                padding: '18px 20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ color: 'var(--amber)', fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M9 2 L16 14 H2 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M9 7 V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="9" cy="12.5" r="0.8" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber-text)', marginBottom: 6 }}>
                    Not SEBI-registered investment advice
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                    All analysis is educational. Data may be delayed or inaccurate. Always do your own research and consult a SEBI-registered advisor for investment decisions.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
