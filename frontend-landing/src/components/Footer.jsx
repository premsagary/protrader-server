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

        <div style={{ fontSize: 11, color: 'var(--text4)' }}>
          Free public beta ·{' '}
          <button
            onClick={showAdminLogin}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text4)',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: 11,
              opacity: 0.6,
              fontFamily: 'inherit',
              padding: 0,
            }}
          >
            Admin
          </button>
        </div>
      </div>
    </footer>
  );
}
