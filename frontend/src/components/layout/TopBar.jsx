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
  // If the server tells us, use that
  if (health?.marketOpen != null) return health.marketOpen;

  const now = new Date();
  // Convert to IST (UTC+5:30)
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 3600000);

  const day = ist.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;

  const mins = ist.getHours() * 60 + ist.getMinutes();
  return mins >= 555 && mins <= 930; // 9:15 to 15:30
}

/** Sun icon for light mode toggle */
function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

/** Moon icon for dark mode toggle */
function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <div
      className="flex items-center gap-3 flex-shrink-0"
      style={{
        background: 'var(--nav-bg)',
        borderBottom: '1px solid var(--nav-border)',
        padding: '0 16px',
        height: '44px',
        zIndex: 200,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2 font-bold"
        style={{
          fontSize: '15px',
          color: 'var(--text)',
          letterSpacing: '-0.3px',
          flexShrink: 0,
        }}
      >
        <span
          className="animate-logoDot"
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--green)',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        ProTrader
      </div>

      {/* Market badge */}
      <span
        className="inline-flex items-center gap-1.5 text-xs font-semibold flex-shrink-0"
        style={{
          background: marketOpen ? 'var(--green-bg)' : 'var(--bg3)',
          color: marketOpen ? 'var(--green)' : 'var(--text3)',
          border: `1px solid ${marketOpen ? 'var(--tier-strong-buy-border)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-full)',
          padding: '2px 10px',
          letterSpacing: '0.2px',
        }}
      >
        {marketOpen && (
          <span
            className="animate-logoDot"
            style={{
              width: 5,
              height: 5,
              background: 'var(--green)',
              borderRadius: '50%',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
        )}
        {marketOpen ? 'NSE Open' : 'NSE Closed'}
      </span>

      {/* Mode tabs */}
      <div
        className="flex gap-px"
        style={{
          background: 'var(--bg3)',
          borderRadius: 'var(--radius)',
          padding: '2px',
          border: '1px solid var(--border)',
        }}
      >
        {MODE_LIST.map((m) => {
          if (m.adminOnly && !isAdmin) return null;
          const isActive = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className="border-none cursor-pointer font-medium"
              style={{
                padding: '4px 12px',
                background: isActive ? 'var(--bg2)' : 'transparent',
                color: isActive ? m.color : 'var(--text2)',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
                letterSpacing: '-0.1px',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Spacer + Header stats */}
      <div className="ml-auto flex gap-5 flex-wrap items-center">
        {/* Total P&L */}
        {stats?.totalPnl != null && (
          <div className="text-right hidden md:block">
            <div
              className="text-2xs font-medium uppercase"
              style={{
                color: 'var(--text3)',
                letterSpacing: '0.8px',
              }}
            >
              Total P&L
            </div>
            <div
              className="font-semibold tabular-nums"
              style={{
                fontSize: '13px',
                color: stats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)',
                letterSpacing: '-0.2px',
                marginTop: '1px',
              }}
            >
              {formatCurrency(stats.totalPnl)}
            </div>
          </div>
        )}

        {/* Win Rate */}
        {stats?.winRate != null && (
          <div className="text-right hidden md:block">
            <div
              className="text-2xs font-medium uppercase"
              style={{
                color: 'var(--text3)',
                letterSpacing: '0.8px',
              }}
            >
              Win Rate
            </div>
            <div
              className="font-semibold tabular-nums"
              style={{
                fontSize: '13px',
                color: 'var(--text)',
                letterSpacing: '-0.2px',
                marginTop: '1px',
              }}
            >
              {formatPercent(stats.winRate, { showSign: false })}
            </div>
          </div>
        )}

        {/* Day P&L */}
        {stats?.dayPnl != null && stats.dayPnl !== 0 && (
          <div className="text-right hidden md:block">
            <div
              className="text-2xs font-medium uppercase"
              style={{
                color: 'var(--text3)',
                letterSpacing: '0.8px',
              }}
            >
              Day P&L
            </div>
            <div
              className="font-semibold tabular-nums"
              style={{
                fontSize: '13px',
                color: stats.dayPnl >= 0 ? 'var(--green)' : 'var(--red)',
                letterSpacing: '-0.2px',
                marginTop: '1px',
              }}
            >
              {formatCurrency(stats.dayPnl)}
            </div>
          </div>
        )}
      </div>

      {/* Theme toggle + user + logout */}
      <div className="flex gap-2 items-center ml-3 flex-shrink-0">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="cursor-pointer flex items-center justify-center"
          style={{
            width: '28px',
            height: '28px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text2)',
            fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* User badge */}
        {user && (
          <span
            className="text-xs font-medium"
            style={{
              color: 'var(--text3)',
              padding: '2px 8px',
              background: 'var(--bg3)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}
          >
            {user.username}
            {user.role === 'admin' && (
              <span style={{ color: 'var(--amber)', marginLeft: '4px', fontSize: '10px' }}>
                admin
              </span>
            )}
          </span>
        )}

        {/* Logout button */}
        <button
          onClick={logout}
          className="cursor-pointer font-semibold text-xs"
          style={{
            padding: '4px 12px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--red)',
            fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
