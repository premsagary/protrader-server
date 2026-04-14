import React from 'react';

export default function Footer() {
  const showAdminLogin = () => {
    // Navigate to app.html and trigger admin login there
    window.location.href = '/app.html#admin-login';
  };

  return (
    <footer
      style={{
        padding: '48px 24px 40px',
        borderTop: '1px solid var(--border)',
        textAlign: 'center',
        background: 'rgba(10,10,15,0.4)',
      }}
    >
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: 'var(--gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M2 10 L6 4 L8 7 L12 2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>ProTrader</span>
        </div>

        <div
          style={{
            fontSize: 12,
            color: 'var(--text3)',
            lineHeight: 1.7,
            maxWidth: 720,
            margin: '0 auto 20px',
          }}
        >
          <strong style={{ color: 'var(--amber-text)', fontWeight: 700 }}>Disclaimer:</strong>{' '}
          ProTrader is <strong style={{ color: 'var(--amber-text)' }}>not SEBI registered</strong> and does not provide financial advice. All data, scores, and AI outputs are for{' '}
          <strong style={{ color: 'var(--amber-text)' }}>educational and informational purposes only</strong>. Data may be delayed or inaccurate.{' '}
          <strong style={{ color: 'var(--amber-text)' }}>You are fully responsible for your own investment decisions, profits, and losses.</strong>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
          Contact & Support:{' '}
          <a href="mailto:emailprotradersapp@gmail.com" style={{ color: 'var(--brand-text)', textDecoration: 'none' }}>
            emailprotradersapp@gmail.com
          </a>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Free public beta</span>
          <span style={{ color: 'var(--text4)' }}>·</span>
          <button
            onClick={showAdminLogin}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border)',
              borderRadius: 9999,
              color: 'var(--text2)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'inherit',
              transition: 'all 180ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--brand-border)';
              e.currentTarget.style.color = 'var(--brand-text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text2)';
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="2" y="5" width="8" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
              <path d="M4 5 V3.5 C4 2.7 4.7 2 5.5 2 H6.5 C7.3 2 8 2.7 8 3.5 V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Admin
          </button>
        </div>
      </div>
    </footer>
  );
}
