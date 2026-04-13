import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { STOCK_TABS, CRYPTO_TABS } from '../../utils/constants';

export default function SubTabs() {
  const { mode, stocksTab, cryptoTab, setStocksTab, setCryptoTab } = useAppStore();
  const containerRef = useRef(null);

  const tabs = mode === 'stocks' ? STOCK_TABS : CRYPTO_TABS;
  const activeTab = mode === 'stocks' ? stocksTab : cryptoTab;
  const setTab = mode === 'stocks' ? setStocksTab : setCryptoTab;
  const activeColor = mode === 'stocks' ? 'var(--blue)' : 'var(--purple)';

  // Scroll active tab into view when it changes
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
      className="flex overflow-x-auto flex-shrink-0"
      style={{
        background: 'var(--nav-bg)',
        borderBottom: '1px solid var(--nav-border)',
        padding: '0 16px',
        zIndex: 199,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            data-active={isActive ? 'true' : undefined}
            onClick={() => setTab(tab.id)}
            className="border-none cursor-pointer font-medium whitespace-nowrap"
            style={{
              padding: '0 14px',
              height: '38px',
              background: 'transparent',
              fontSize: '12px',
              color: isActive ? activeColor : 'var(--text2)',
              borderBottom: `2px solid ${isActive ? activeColor : 'transparent'}`,
              fontFamily: 'inherit',
              transition: 'all 0.15s',
              letterSpacing: '-0.1px',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
