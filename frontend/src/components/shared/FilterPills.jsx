import React, { useCallback } from 'react';

/**
 * A row of togglable filter buttons — Apple-style rounded pills.
 */
export default function FilterPills({
  options = [],
  active,
  onChange,
  multiSelect = false,
  className = '',
}) {
  const handleClick = useCallback(
    (value) => {
      if (multiSelect) {
        const currentActive = Array.isArray(active) ? active : [];
        if (currentActive.includes(value)) {
          onChange(currentActive.filter((v) => v !== value));
        } else {
          onChange([...currentActive, value]);
        }
      } else {
        onChange(value);
      }
    },
    [active, onChange, multiSelect]
  );

  const isActive = (value) => {
    if (multiSelect) {
      return Array.isArray(active) && active.includes(value);
    }
    return active === value;
  };

  return (
    <div className={`flex gap-2 flex-wrap items-center mb-4 ${className}`}>
      {options.map((opt) => {
        const value = typeof opt === 'object' ? opt.value : opt;
        const label = typeof opt === 'object' ? opt.label : opt;
        const selected = isActive(value);

        return (
          <button
            key={value}
            onClick={() => handleClick(value)}
            style={{
              borderRadius: 'var(--radius-full)',
              padding: '5px 14px',
              fontSize: '13px',
              fontWeight: 500,
              border: 'none',
              background: selected ? 'var(--accent)' : 'var(--bg3)',
              cursor: 'pointer',
              color: selected ? '#fff' : 'var(--text2)',
              fontFamily: 'inherit',
              transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              letterSpacing: '-0.1px',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
