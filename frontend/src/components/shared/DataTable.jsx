import React, { useState, useMemo, useCallback } from 'react';

/**
 * Sortable data table — Apple-style with clean lines and generous spacing.
 */
export default function DataTable({
  columns,
  data,
  onRowClick,
  maxHeight,
  emptyMessage = 'No data available',
  defaultSort,
  className = '',
  compact = false,
  rowKey,
}) {
  const [sortKey, setSortKey] = useState(defaultSort?.key || null);
  const [sortDir, setSortDir] = useState(defaultSort?.dir || 'desc');

  const handleSort = useCallback(
    (key, sortable) => {
      if (sortable === false) return;
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('desc');
      }
    },
    [sortKey]
  );

  const sortedData = useMemo(() => {
    if (!sortKey || !data) return data || [];
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          padding: '64px 0',
          textAlign: 'center',
          color: 'var(--text3)',
          fontSize: '14px',
        }}
      >
        <div
          style={{
            fontSize: '28px',
            marginBottom: '8px',
            color: 'var(--text4)',
            fontWeight: 300,
          }}
        >
          --
        </div>
        {emptyMessage}
      </div>
    );
  }

  const cellPadY = compact ? '8px' : '12px';
  const cellPadX = compact ? '12px' : '16px';

  return (
    <div
      className={className}
      style={{
        overflowX: 'auto',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow)',
        border: '1px solid var(--border)',
        maxHeight: maxHeight || undefined,
        overflowY: maxHeight ? 'auto' : undefined,
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          background: 'var(--bg2)',
        }}
      >
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key, col.sortable)}
                style={{
                  padding: `10px ${cellPadX}`,
                  textAlign: col.align || 'left',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: sortKey === col.key ? 'var(--text)' : 'var(--text3)',
                  borderBottom: '1px solid var(--border)',
                  whiteSpace: 'nowrap',
                  cursor: col.sortable !== false ? 'pointer' : 'default',
                  userSelect: 'none',
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  background: 'var(--bg2)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  width: col.width || undefined,
                }}
              >
                {col.label}
                {sortKey === col.key && (
                  <span style={{ marginLeft: '4px', fontSize: '10px', opacity: 0.6 }}>
                    {sortDir === 'asc' ? '\u2191' : '\u2193'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, i) => {
            const key = rowKey
              ? rowKey(row, i)
              : row.id || row.sym || row.symbol || i;
            return (
              <tr
                key={key}
                onClick={() => onRowClick?.(row, i)}
                style={{
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: `${cellPadY} ${cellPadX}`,
                      fontSize: '13px',
                      borderBottom: '1px solid var(--border)',
                      verticalAlign: 'middle',
                      color: 'var(--text)',
                      textAlign: col.align || 'left',
                      fontVariantNumeric:
                        col.align === 'right' ? 'tabular-nums' : undefined,
                    }}
                  >
                    {col.render
                      ? col.render(row[col.key], row, i)
                      : row[col.key] ?? '--'}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
