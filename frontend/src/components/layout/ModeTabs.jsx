import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { MODE_LIST } from '../../utils/constants';

/**
 * Standalone ModeTabs component.
 * Renders the segmented mode switcher control.
 * Can be used independently of TopBar if needed.
 */
export default function ModeTabs() {
  const { mode, setMode, user } = useAppStore();
  const isAdmin = user?.role === 'admin';

  return (
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
  );
}
