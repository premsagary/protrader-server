import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { STOCK_TABS, CRYPTO_TABS } from '../../utils/constants';

export default function SubTabs() {
  const { mode, stocksTab, cryptoTab, setStocksTab, setCryptoTab } = useAppStore();
  const containerRef = useRef(null);

  const tabs = mode === 'stocks' ? STOCK_TABS : CRYPTO_TABS;
  const activeTab = mode === 'stocks' ? stocksTab : cryptoTab;
  const setTab = mode === 'stocks' ? setStocksTab : setCryptoTab;

  useEffect(() => {
    if (!containerRef.current) return;
    const activeEl = containerRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  return (
    <div
      ref={containerRef}
      className="flex overflow-x-auto flex-shrink-0 hide-scrollbar"
      style={{
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
        padding: '0 20px',
        zIndex: 199,
        gap: '2px',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            data-active={isActive ? 'true' : undefined}
            onClick={() => setTab(tab.id)}
            style={{
              padding: '0 16px',
              height: '42px',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--text)' : 'var(--text3)',
              fontFamily: 'inherit',
              transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              letterSpacing: '-0.1px',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
