import React, { useState, useRef, useEffect, useCallback } from 'react';

export default function PasscodeModal({ onVerify, onClose }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = useCallback(() => {
    if (!code.trim()) {
      setError('Please enter passcode');
      return;
    }
    const ok = onVerify(code);
    if (!ok) {
      setError('Incorrect passcode');
      setCode('');
      // Trigger shake animation
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
      inputRef.current?.focus();
    }
  }, [code, onVerify]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="animate-fadeIn"
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: '32px',
          width: '320px',
          boxShadow: 'var(--shadow-xl)',
          textAlign: 'center',
          animation: shaking
            ? 'shake 0.4s ease-in-out'
            : 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="font-bold"
          style={{ fontSize: '18px', color: 'var(--text)', marginBottom: '8px' }}
        >
          Admin Access
        </div>
        <div
          className="text-sm"
          style={{ color: 'var(--text3)', marginBottom: '20px' }}
        >
          Enter passcode to continue
        </div>

        <input
          ref={inputRef}
          type="password"
          placeholder="Passcode"
          value={code}
          maxLength={10}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          className="w-full"
          style={{
            background: 'var(--bg3)',
            border: `1px solid ${error ? 'var(--red)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '10px 14px',
            fontSize: '16px',
            color: 'var(--text)',
            outline: 'none',
            textAlign: 'center',
            letterSpacing: '4px',
            fontFamily: 'inherit',
            marginBottom: '8px',
            transition: 'border-color 0.15s',
          }}
        />

        {error && (
          <div
            className="text-xs"
            style={{
              color: 'var(--red)',
              marginBottom: '4px',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            {error}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 text-sm font-medium cursor-pointer"
            style={{
              padding: '8px',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--text2)',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 text-sm font-medium cursor-pointer"
            style={{
              padding: '8px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              color: '#fff',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            Verify
          </button>
        </div>
      </div>
    </div>
  );
}
