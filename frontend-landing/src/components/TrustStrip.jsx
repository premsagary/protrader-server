import React from 'react';

const STATS = [
  { v: '567', l: 'NSE stocks' },
  { v: '14', l: 'Varsity checks' },
  { v: '5', l: 'AI models' },
  { v: '30+', l: 'Indicators' },
  { v: '<10s', l: 'Analysis time' },
];

export default function TrustStrip() {
  return (
    <section style={{ padding: '40px 24px', position: 'relative' }}>
      <div className="divider-gradient" style={{ maxWidth: 1000, margin: '0 auto 40px' }} />
      <div
        className="reveal"
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 32,
          textAlign: 'center',
        }}
      >
        {STATS.map((s, i) => (
          <div key={i}>
            <div className="tabular-nums gradient-text" style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1 }}>
              {s.v}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8, letterSpacing: '0.6px', textTransform: 'uppercase', fontWeight: 600 }}>
              {s.l}
            </div>
          </div>
        ))}
      </div>
      <div className="divider-gradient" style={{ maxWidth: 1000, margin: '40px auto 0' }} />
    </section>
  );
}
