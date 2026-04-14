import React from 'react';
import { goToApp } from '../App';

const METRICS = [
  { label: 'Trend', val: 'Bullish', color: 'var(--green-text)' },
  { label: 'RSI-14', val: '58', color: 'var(--amber-text)' },
  { label: 'ROE', val: '14.2%', color: 'var(--green-text)' },
  { label: 'D/E', val: '0.39x', color: 'var(--green-text)' },
  { label: 'P/E', val: '26.4', color: 'var(--amber-text)' },
];

const AI_VOTES = [
  { name: 'GPT-4.1', vote: 'BUY', color: 'var(--green-text)' },
  { name: 'DeepSeek', vote: 'BUY', color: 'var(--green-text)' },
  { name: 'Gemini', vote: 'BUY', color: 'var(--green-text)' },
  { name: 'Qwen', vote: 'HOLD', color: 'var(--amber-text)' },
  { name: 'Llama', vote: 'BUY', color: 'var(--green-text)' },
];

export default function LivePreview() {
  return (
    <section id="example" style={{ padding: '96px 24px', scrollMarginTop: 72 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 48 }}>
          <div className="label-xs" style={{ marginBottom: 14 }}>Live preview</div>
          <h2 className="section-title" style={{ color: 'var(--text)' }}>
            What a <span className="gradient-fill">deep analysis</span> looks like
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text3)', marginTop: 14 }}>Sample output — not live data.</p>
        </div>

        {/* Preview card */}
        <div
          className="card card-premium reveal"
          style={{
            padding: 32,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>RELIANCE</span>
            <span
              style={{
                background: 'var(--green-bg)',
                color: 'var(--green-text)',
                padding: '4px 12px',
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.3px',
              }}
            >
              Strong Buy
            </span>
            <span
              className="tabular-nums"
              style={{
                background: 'var(--brand-bg)',
                color: 'var(--brand-text)',
                padding: '4px 12px',
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.3px',
              }}
            >
              Score 78 / 100
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text4)', letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: 600 }}>
              Illustrative
            </span>
          </div>

          {/* Metrics */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 10,
              marginBottom: 24,
            }}
          >
            {METRICS.map((m, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(99,102,241,0.05)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '14px 12px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text3)',
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  {m.label}
                </div>
                <div
                  className="tabular-nums"
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: m.color,
                    letterSpacing: '-0.3px',
                  }}
                >
                  {m.val}
                </div>
              </div>
            ))}
          </div>

          {/* AI Council votes */}
          <div
            style={{
              background: 'var(--gradient-soft)',
              border: '1px solid var(--brand-border)',
              borderRadius: 14,
              padding: '18px 20px',
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'var(--gradient)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2 C4 2 3 4 3 6 C3 7.5 4 8.5 4.5 9 V11.5 H9.5 V9 C10 8.5 11 7.5 11 6 C11 4 10 2 7 2 Z" stroke="#fff" strokeWidth="1.4" />
                </svg>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-text)', letterSpacing: '0.3px' }}>AI Council Verdict</div>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>4 of 5 bullish</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {AI_VOTES.map((v, i) => (
                <span
                  key={i}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--border)',
                    borderRadius: 9999,
                    padding: '5px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text2)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {v.name}
                  <span style={{ color: v.color, fontWeight: 700, letterSpacing: '0.3px' }}>{v.vote}</span>
                </span>
              ))}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65 }}>
              Strong fundamentals (low debt, healthy margins), uptrend above 200DMA. P/E slightly elevated vs sector median.
              <b style={{ color: 'var(--text)' }}> Buy zone: ₹1,220–₹1,260 with stop-loss at ₹1,180.</b>
            </p>
          </div>

          {/* CTA */}
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button className="btn btn-primary" onClick={goToApp}>
              Try it yourself — free
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8 H13 M9 4 L13 8 L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
