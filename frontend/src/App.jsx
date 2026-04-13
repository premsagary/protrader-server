import React, { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { useTheme } from './hooks/useTheme';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePasscodeGate } from './hooks/usePasscodeGate';
import TopBar from './components/layout/TopBar';
import SubTabs from './components/layout/SubTabs';
import RiskBanner from './components/layout/RiskBanner';
import PasscodeModal from './components/layout/PasscodeModal';
import LoginPage from './components/layout/LoginPage';
import MFPage from './components/mf/MFPage';
import StockRecPage from './components/stockrec/StockRecPage';
import StocksPage from './components/stocks/StocksPage';
import CryptoPage from './components/crypto/CryptoPage';
import PortfolioPage from './components/aiportfolio/PortfolioPage';
import AdminPage from './components/admin/AdminPage';

export default function App() {
  const { mode, isAuthenticated, checkSession } = useAppStore();
  const { theme, toggleTheme } = useTheme();
  const { isLocked, showModal, setShowModal, verify } = usePasscodeGate();

  useKeyboardShortcuts();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // TODO: re-enable auth gate when backend is running
  // if (!isAuthenticated) {
  //   return <LoginPage />;
  // }

  const renderContent = () => {
    switch (mode) {
      case 'mf':
        return <MFPage />;
      case 'stockrec':
        return <StockRecPage />;
      case 'stocks':
        return <StocksPage />;
      case 'crypto':
        return <CryptoPage />;
      case 'psuggest':
        return <PortfolioPage />;
      case 'admin':
        if (isLocked) {
          return (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-sm" style={{ color: 'var(--text2)' }}>
                  Admin access requires passcode verification.
                </p>
                <button
                  className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
                  style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowModal(true)}
                >
                  Enter Passcode
                </button>
              </div>
            </div>
          );
        }
        return <AdminPage />;
      default:
        return <MFPage />;
    }
  };

  const showSubTabs = mode === 'stocks' || mode === 'crypto';

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <TopBar theme={theme} toggleTheme={toggleTheme} />
      <RiskBanner />
      {showSubTabs && <SubTabs />}
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ padding: '24px 28px' }}
      >
        {renderContent()}
      </main>
      {showModal && (
        <PasscodeModal
          onVerify={verify}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
