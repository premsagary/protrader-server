import React from 'react';

const LAYERS = [
  {
    n: '1', title: 'Data Sources', color: 'var(--green-text)',
    items: [
      { name: 'Broker API', desc: 'Live price · OHLC · volume' },
      { name: 'Yahoo Finance', desc: 'Fundamentals · trailing returns' },
      { name: 'Screener.in', desc: 'ROCE · PEG · ownership · DuPont' },
      { name: 'Tickertape CSV', desc: 'Mutual fund dataset' },
      { name: 'In-process TA', desc: 'RSI · MACD · Ichimoku · DMAs' },
    ],
  },
  {
    n: '2', title: 'Scoring Engines', color: 'var(--brand-text)',
    items: [
      { name: 'scoreFallenAngel()', desc: '5-pillar quality-on-sale → REBOUND SCORE' },
      { name: 'scoreStockForPortfolio()', desc: 'FA35+Val15+TA20+Mom15+Risk15 → MOMENTUM SCORE' },
      { name: 'scoreOneStockV2()', desc: 'Varsity 4-pillar (FA only) → INVESTMENT SCORE' },
      { name: 'scoreMFTickertape()', desc: 'Varsity M11 · 13 pillars → MF SCORE (0–100)' },
    ],
  },
  {
    n: '3', title: 'Optional Overlays', color: 'var(--amber-text)',
    items: [
      { name: 'Pass 1.5 — Structure Filter + LLM', desc: 'Pivot/zone S|R · VWAP · PDH/PDL' },
      { name: 'MiroFish Wealth Projection', desc: '₹1 Lakh → 7Y / 10Y / 20Y / 30Y / 40Y per MF' },
    ],
  },
  {
    n: '4', title: 'User-Facing Tabs', color: 'var(--purple-text)',
    items: [
      { name: 'Stock Picks', desc: '3 columns: Rebound / Momentum / Long-Term' },
      { name: 'MF Picks', desc: 'Small / Mid / Flexi Cap · AI panel + top 5 cards' },
      { name: 'Holdings', desc: 'Personal portfolio · Live P&L + reviews' },
      { name: 'Deep Analyzer', desc: 'Single-stock deep dive · /api/stocks/analyze/:sym/ai' },
      { name: 'Stock Data', desc: 'Full universe table · MOMENTUM / INVESTMENT SCORE cols' },
    ],
  },
  {
    n: '5', title: 'Deep AI Review — 5-model council + judge', color: 'var(--red-text)',
    items: [
      { name: 'Groq Llama 3.3 70B', desc: 'council · meta (open)' },
      { name: 'GPT-4.1', desc: 'council · openai' },
      { name: 'DeepSeek V3', desc: 'council · deepseek' },
      { name: 'Gemini 2.5 Flash', desc: 'council · google' },
      { name: 'Qwen 3 Max', desc: 'council · alibaba' },
      { name: 'AI JUDGE', desc: 'Claude Sonnet 4.6' },
    ],
  },
];

export default function Architecture() {
  return (
    <div>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(167,139,250,0.10) 100%)',
        border: '1px solid var(--border)', borderRadius: 18, padding: '28px 32px', marginBottom: 28,
      }}>
        <div className="label-xs" style={{ marginBottom: 8 }}>Transparency · Open Architecture</div>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', color: 'var(--text)' }}>
          <span className="gradient-fill">Architecture</span>
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.5, maxWidth: 700, marginTop: 10 }}>
          End-to-end data flow — at a glance. Every component picks, scores, ranks, and (where applicable) sends data to AI for review. Grounded in <code style={{ background: 'var(--bg3)', padding: '2px 8px', borderRadius: 6, fontSize: 13 }}>kite-server.js</code>.
        </p>
      </div>

      {/* Layers */}
      <div style={{ display: 'grid', gap: 20 }}>
        {LAYERS.map((layer) => (
          <div key={layer.n} className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'var(--gradient)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800, flexShrink: 0,
              }}>{layer.n}</div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: layer.color, letterSpacing: '-0.2px' }}>{layer.title}</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {layer.items.map((item, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '12px 14px',
                  transition: 'border-color 200ms ease',
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand-border)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.4 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
