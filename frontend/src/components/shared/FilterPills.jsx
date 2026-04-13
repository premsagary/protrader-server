import React, { useCallback } from 'react';

/**
 * A row of togglable filter buttons.
 *
 * Props:
 *   options     - array of filter values (strings) or { value, label } objects
 *   active      - currently active value (string or array for multi-select)
 *   onChange    - (value) => void for single-select, (values[]) for multi-select
 *   multiSelect - boolean, enables multi-select mode (default false)
 *   className   - optional extra class names
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
    <div className={`flex gap-1.5 flex-wrap items-center mb-3 ${className}`}>
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
              padding: '3px 11px',
              fontSize: '11px',
              fontWeight: 500,
              border: `1px solid ${selected ? 'var(--accent)' : 'var(--border2)'}`,
              background: selected ? 'var(--accent)' : 'transparent',
              cursor: 'pointer',
              color: selected ? '#fff' : 'var(--text2)',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
