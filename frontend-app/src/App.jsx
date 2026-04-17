import React, { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import TopBar from './components/layout/TopBar';
import DeepAnalyzer from './components/pages/DeepAnalyzer';
import StockPicks from './components/pages/StockPicks';
import StockData from './components/pages/StockData';
import Holdings from './components/pages/Holdings';
import MFPicks from './components/pages/MFPicks';
import Architecture from './components/pages/Architecture';
import StocksRoboTrade from './components/pages/StocksRoboTrade';
import CryptoRoboTrade from './components/pages/CryptoRoboTrade';
import DayTrade from './components/pages/DayTrade';
import MiroFishLab from './components/pages/MiroFishLab';
import Admin from './components/pages/Admin';
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
    if (currentTab === 'mf') return <MFPicks />;
    if (currentTab === 'architecture') return <Architecture />;
    if (currentTab === 'stocks/overview' || currentTab.startsWith('stocks/')) return <StocksRoboTrade />;
    if (currentTab === 'crypto/overview' || currentTab.startsWith('crypto/')) return <CryptoRoboTrade />;
    if (currentTab === 'daytrade') return <DayTrade />;
    if (currentTab === 'mirofish') return <MiroFishLab />;
    if (currentTab === 'admin') return <Admin />;
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
