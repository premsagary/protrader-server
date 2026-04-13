import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef(null);
  const usernameRef = useRef(null);

  const login = useAppStore((s) => s.login);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);

  // Auto-focus username input on mount
  useEffect(() => {
    if (!isAuthenticated && usernameRef.current) {
      usernameRef.current.focus();
    }
  }, [isAuthenticated]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(username.trim(), password);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Login failed. Check credentials.';
      setError(msg);
      setLoading(false);
    }
  };

  // If already authenticated, this component shouldn't render
  // (App.jsx handles the redirect), but guard anyway
  if (isAuthenticated) return null;

  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: 'var(--bg)' }}
    >
      <form
        onSubmit={handleSubmit}
        className="animate-fadeIn"
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-2xl)',
          padding: '40px',
          width: '360px',
          textAlign: 'center',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {/* Logo area */}
        <div
          className="flex items-center justify-center gap-2 font-extrabold mb-1"
          style={{ fontSize: '22px', color: 'var(--text)' }}
        >
          <span
            className="animate-logoDot"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--green)',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          ProTrader
        </div>
        <div
          className="text-sm mb-7"
          style={{ color: 'var(--text3)' }}
        >
          Sign in to continue
        </div>

        {/* Username */}
        <input
          ref={usernameRef}
          type="text"
          placeholder="Username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') passwordRef.current?.focus();
          }}
          className="w-full"
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '11px 14px',
            fontSize: '14px',
            color: 'var(--text)',
            outline: 'none',
            marginBottom: '10px',
            fontFamily: 'inherit',
          }}
        />

        {/* Password */}
        <input
          ref={passwordRef}
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          className="w-full"
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '11px 14px',
            fontSize: '14px',
            color: 'var(--text)',
            outline: 'none',
            marginBottom: '10px',
            fontFamily: 'inherit',
          }}
        />

        {/* Error message */}
        {error && (
          <div
            className="text-xs"
            style={{
              color: 'var(--red)',
              marginBottom: '10px',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            {error}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full font-bold"
          style={{
            padding: '11px',
            background: loading ? 'var(--bg4)' : 'var(--blue)',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontFamily: 'inherit',
            opacity: loading ? 0.7 : 1,
            transition: 'opacity 0.15s, background 0.15s',
            marginBottom: '12px',
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div className="text-2xs" style={{ color: 'var(--text4)' }}>
          Contact admin for access
        </div>
      </form>
    </div>
  );
}
