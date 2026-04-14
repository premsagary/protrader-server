import React, { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useStockStore } from '../../store/useStockStore';
import { MODE_LIST } from '../../utils/constants';
import { formatCurrency, formatPercent } from '../../utils/formatters';

/**
 * Determine if NSE market is open based on current IST time.
 * Market hours: Mon-Fri 9:15 AM - 3:30 PM IST.
 */
function isMarketOpenNow(health) {
  if (health?.marketOpen != null) return health.marketOpen;

  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 3600000);

  const day = ist.getDay();
  if (day === 0 || day === 6) return false;

  const mins = ist.getHours() * 60 + ist.getMinutes();
  return mins >= 555 && mins <= 930;
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function TopBar({ theme, toggleTheme }) {
  const { mode, setMode, user, logout } = useAppStore();
  const stats = useStockStore((s) => s.stats);
  const health = useStockStore((s) => s.health);

  const isAdmin = user?.role === 'admin';
  const marketOpen = useMemo(() => isMarketOpenNow(health), [health]);

  return (
    <header
      className="glass flex items-center flex-shrink-0"
      style={{
        borderBottom: '1px solid var(--nav-border)',
        padding: '0 20px',
        height: '52px',
        zIndex: 200,
        gap: '16px',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 flex-shrink-0"
        style={{ marginRight: '4px' }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'var(--brand-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: 'var(--shadow-brand)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 11 L7 5 L9 8 L13 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span
          style={{
            fontSize: '17px',
            fontWeight: 800,
            color: 'var(--text)',
            letterSpacing: '-0.5px',
          }}
        >
          ProTrader
        </span>
      </div>

      {/* Market status */}
      <span
        className="flex items-center gap-1.5 flex-shrink-0"
        style={{
          fontSize: '12px',
          fontWeight: 500,
          color: marketOpen ? 'var(--green-text)' : 'var(--text3)',
          background: marketOpen ? 'var(--green-bg)' : 'var(--bg3)',
          padding: '4px 12px',
          borderRadius: 'var(--radius-full)',
        }}
      >
        {marketOpen && (
          <span
            style={{
              width: 6,
              height: 6,
              background: 'var(--green)',
              borderRadius: '50%',
              display: 'inline-block',
              flexShrink: 0,
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
        )}
        {marketOpen ? 'NSE Open' : 'NSE Closed'}
      </span>

      {/* Mode tabs — Apple segmented control */}
      <nav
        style={{
          display: 'flex',
          gap: '2px',
          background: 'var(--bg3)',
          borderRadius: 'var(--radius-lg)',
          padding: '3px',
        }}
      >
        {MODE_LIST.map((m) => {
          if (m.adminOnly && !isAdmin) return null;
          const isActive = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              style={{
                padding: '7px 16px',
                background: isActive ? 'var(--bg2)' : 'transparent',
                color: isActive ? 'var(--brand)' : 'var(--text3)',
                borderRadius: 8,
                fontSize: '13px',
                fontWeight: isActive ? 700 : 500,
                fontFamily: 'inherit',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                letterSpacing: '-0.1px',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {m.label}
            </button>
          );
        })}
      </nav>

      {/* Spacer + Header stats */}
      <div className="ml-auto flex gap-6 items-center">
        {stats?.totalPnl != null && (
          <div className="text-right hidden md:block">
            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--text3)',
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
              }}
            >
              Total P&L
            </div>
            <div
              className="tabular-nums"
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: stats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)',
                letterSpacing: '-0.3px',
                marginTop: '1px',
              }}
            >
              {formatCurrency(stats.totalPnl)}
            </div>
          </div>
        )}

        {stats?.winRate != null && (
          <div className="text-right hidden md:block">
            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--text3)',
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
              }}
            >
              Win Rate
            </div>
            <div
              className="tabular-nums"
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text)',
                letterSpacing: '-0.3px',
                marginTop: '1px',
              }}
            >
              {formatPercent(stats.winRate, { showSign: false })}
            </div>
          </div>
        )}

        {stats?.dayPnl != null && stats.dayPnl !== 0 && (
          <div className="text-right hidden md:block">
            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--text3)',
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
              }}
            >
              Day P&L
            </div>
            <div
              className="tabular-nums"
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: stats.dayPnl >= 0 ? 'var(--green)' : 'var(--red)',
                letterSpacing: '-0.3px',
                marginTop: '1px',
              }}
            >
              {formatCurrency(stats.dayPnl)}
            </div>
          </div>
        )}
      </div>

      {/* Theme toggle + user + logout */}
      <div className="flex gap-2 items-center ml-2 flex-shrink-0">
        <button
          onClick={toggleTheme}
          className="cursor-pointer flex items-center justify-center"
          style={{
            width: '32px',
            height: '32px',
            background: 'var(--bg3)',
            border: 'none',
            borderRadius: 'var(--radius)',
            color: 'var(--text2)',
            fontFamily: 'inherit',
            transition: 'all 0.2s',
          }}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        {user && (
          <span
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text2)',
              padding: '4px 10px',
              background: 'var(--bg3)',
              borderRadius: 'var(--radius)',
            }}
          >
            {user.username}
            {user.role === 'admin' && (
              <span style={{ color: 'var(--amber)', marginLeft: '6px', fontSize: '11px', fontWeight: 600 }}>
                Admin
              </span>
            )}
          </span>
        )}

        <button
          onClick={logout}
          className="cursor-pointer"
          style={{
            padding: '6px 14px',
            background: 'transparent',
            border: '1px solid var(--border2)',
            borderRadius: 'var(--radius)',
            color: 'var(--text2)',
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: 'inherit',
            transition: 'all 0.2s',
          }}
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
