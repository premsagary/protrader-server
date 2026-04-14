import React, { useState, useEffect } from 'react';
import { goToApp } from '../App';

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const linkStyle = {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text2)',
    padding: '6px 2px',
    position: 'relative',
    transition: 'color 180ms ease',
  };

  return (
    <header
      className="glass"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
        transition: 'border-color 220ms ease',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '14px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo */}
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-brand)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 13 L8 5 L11 9 L15 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--text)' }}>
            ProTrader
          </span>
        </a>

        {/* Desktop nav */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 28,
          }}
          className="hide-mobile"
        >
          <a href="#features" style={linkStyle} onMouseEnter={(e) => (e.target.style.color = 'var(--text)')} onMouseLeave={(e) => (e.target.style.color = 'var(--text2)')}>
            Features
          </a>
          <a href="#how" style={linkStyle} onMouseEnter={(e) => (e.target.style.color = 'var(--text)')} onMouseLeave={(e) => (e.target.style.color = 'var(--text2)')}>
            How It Works
          </a>
          <a href="#pricing" style={linkStyle} onMouseEnter={(e) => (e.target.style.color = 'var(--text)')} onMouseLeave={(e) => (e.target.style.color = 'var(--text2)')}>
            Pricing
          </a>
          <button className="btn btn-primary btn-sm" onClick={goToApp}>
            Start Analyzing — Free
          </button>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="show-mobile"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
          style={{
            display: 'none',
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ margin: '0 auto' }}>
            <path d={open ? 'M3 3 L15 15 M15 3 L3 15' : 'M2 5 H16 M2 9 H16 M2 13 H16'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="show-mobile"
          style={{
            display: 'none',
            borderTop: '1px solid var(--border)',
            padding: '12px 28px 20px',
            background: 'rgba(10,10,15,0.95)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <a href="#features" style={{ display: 'block', padding: '12px 0', fontSize: 15, color: 'var(--text2)' }} onClick={() => setOpen(false)}>
            Features
          </a>
          <a href="#how" style={{ display: 'block', padding: '12px 0', fontSize: 15, color: 'var(--text2)' }} onClick={() => setOpen(false)}>
            How It Works
          </a>
          <a href="#pricing" style={{ display: 'block', padding: '12px 0', fontSize: 15, color: 'var(--text2)' }} onClick={() => setOpen(false)}>
            Pricing
          </a>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 10 }} onClick={() => { setOpen(false); goToApp(); }}>
            Start Analyzing — Free
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .hide-mobile { display: none !important }
          .show-mobile { display: flex !important }
        }
      `}</style>
    </header>
  );
}
