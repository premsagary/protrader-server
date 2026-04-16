import React, { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import TopBar from './components/layout/TopBar';
import DeepAnalyzer from './components/pages/DeepAnalyzer';
import StockPicks from './components/pages/StockPicks';
import StockData from './components/pages/StockData';
import Holdings from './components/pages/Holdings';
import ComingSoon from './components/pages/ComingSoon';

export default function App() {
  const currentTab = useAppStore((s) => s.currentTab);
  const checkSession = useAppStore((s) => s.checkSession);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const renderPage = () => {
    if (currentTab === 'stockanalyzer') return <DeepAnalyzer />;
    if (currentTab === 'stockrec') return <StockPicks />;
    if (currentTab === 'stockdata') return <StockData />;
    if (currentTab === 'holdings') return <Holdings />;
    return <ComingSoon tab={currentTab} />;
  };

  return (
    <div style={{ minHeight: '100vh', color: 'var(--text)' }}>
      <TopBar />
      <main
        style={{
          padding: '24px 28px',
          maxWidth: 1600,
          margin: '0 auto',
        }}
        className="animate-fadeIn"
        key={currentTab}
      >
        {renderPage()}
      </main>
    </div>
  );
}
