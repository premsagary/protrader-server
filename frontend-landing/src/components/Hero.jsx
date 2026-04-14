import React from 'react';
import { goToApp } from '../App';

export default function Hero() {
  return (
    <section
      style={{
        position: 'relative',
        paddingTop: 120,
        paddingBottom: 72,
        paddingLeft: 24,
        paddingRight: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '92vh',
      }}
    >
      <div style={{ maxWidth: 1040, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
        {/* Hero chip */}
        <div
          className="chip chip-brand chip-dot animate-fadeInUp"
          style={{ marginBottom: 28 }}
        >
          Live NSE data · 567 stocks · AI-powered intelligence
        </div>

        {/* Headline */}
        <h1 className="hero-title animate-fadeInUp delay-1" style={{ marginBottom: 22, color: 'var(--text)' }}>
          Institutional-grade analysis.
          <br />
          <span className="gradient-fill">Zero cost.</span>
        </h1>

        {/* Sub */}
        <p
          className="animate-fadeInUp delay-2"
          style={{
            fontSize: 18,
            lineHeight: 1.6,
            color: 'var(--text2)',
            maxWidth: 640,
            margin: '0 auto 36px',
            fontWeight: 400,
          }}
        >
          14-point Varsity checklist, 30+ technical indicators, exact buy zones, Fibonacci levels, and live news sentiment — for every NSE stock. No signup.
        </p>

        {/* CTAs */}
        <div
          className="animate-fadeInUp delay-3"
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: 32,
          }}
        >
          <button className="btn btn-primary" onClick={goToApp} style={{ height: 52, padding: '0 28px', fontSize: 16 }}>
            Start Analyzing — Free
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8 H13 M9 4 L13 8 L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <a href="#example" className="btn btn-secondary" style={{ height: 52, padding: '0 24px', fontSize: 15 }}>
            See Live Example
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2 V12 M3 8 L7 12 L11 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        {/* Trust chips (not buttons) */}
        <div
          className="animate-fadeInUp delay-4"
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span className="chip">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M11 3.5 L5.5 10 L3 7.5" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            No signup
          </span>
          <span className="chip">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1 L2 8 H7 L6 13 L12 6 H7 Z" fill="var(--amber)" />
            </svg>
            Results &lt; 10s
          </span>
          <span className="chip">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M11 3.5 L5.5 10 L3 7.5" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            100% free forever
          </span>
          <span className="chip">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5" stroke="var(--brand-text)" strokeWidth="1.5" />
              <path d="M7 4 V7 L9 8.5" stroke="var(--brand-text)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Varsity-grounded
          </span>
        </div>
      </div>
    </section>
  );
}
