import React from 'react';
import { useAppStore } from '../../store/useAppStore';

export default function TopBar() {
  const { tabs, currentTab, setCurrentTab, user, logout } = useAppStore();

  const visibleTabs = tabs.filter((t) => !t.admin || user?.role === 'admin');

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(10,10,18,0.72)',
        backdropFilter: 'saturate(180%) blur(24px)',
        WebkitBackdropFilter: 'saturate(180%) blur(24px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          maxWidth: 1600,
          margin: '0 auto',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
        }}
      >
        {/* Logo */}
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'var(--gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-brand)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M3 13 L8 5 L11 9 L15 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--text)' }}>
            ProTrader
          </span>
        </a>

        {/* Tabs — horizontal scroll on mobile */}
        <nav
          style={{
            display: 'flex',
            gap: 2,
            flex: 1,
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
          className="hide-scrollbar"
        >
          {visibleTabs.map((t) => {
            const active = currentTab === t.id || currentTab.startsWith(t.id.split('/')[0] + '/');
            const accentColor = t.accent === 'red' ? 'var(--red-text)' : 'var(--brand-text)';
            return (
              <button
                key={t.id}
                onClick={() => setCurrentTab(t.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  background: active ? 'var(--brand-bg-strong)' : 'transparent',
                  border: 'none',
                  borderRadius: 9,
                  color: active ? accentColor : 'var(--text2)',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 180ms ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                }}
              >
                {t.label}
                {!t.migrated && (
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      padding: '2px 5px',
                      background: 'rgba(251,191,36,0.15)',
                      color: 'var(--amber-text)',
                      borderRadius: 4,
                    }}
                  >
                    v1
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {user ? (
            <>
              <span className="chip">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <circle cx="5.5" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M1.5 10 C1.5 7.5 3.5 6 5.5 6 C7.5 6 9.5 7.5 9.5 10" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                {user.username}
                {user.role === 'admin' && (
                  <span style={{ color: 'var(--amber-text)', fontWeight: 700, fontSize: 10 }}>admin</span>
                )}
              </span>
              <button
                onClick={logout}
                className="btn btn-secondary"
                style={{ height: 32, fontSize: 13, padding: '0 14px' }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <span className="chip chip-brand">Free</span>
          )}
        </div>
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none }
      `}</style>
    </header>
  );
}
