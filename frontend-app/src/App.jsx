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

// ══════════════════════════════════════════════════════════════════════
// ErrorBoundary — prevents whitescreen when a page component throws during
// render. Displays a recoverable error card with the message + reload
// button instead of the whole dashboard disappearing.
// ══════════════════════════════════════════════════════════════════════
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // Log with enough context to trace which tab crashed
    console.error('[ErrorBoundary]', this.props.tab, error, info?.componentStack);
  }
  componentDidUpdate(prevProps) {
    // Reset the error state when the user navigates to a different tab
    if (prevProps.tab !== this.props.tab && this.state.error) {
      this.setState({ error: null });
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="card" style={{ padding: 32, maxWidth: 720, margin: '40px auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--red-text)', marginBottom: 10 }}>
            Error · {this.props.tab || 'unknown tab'}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
            This page crashed
          </h2>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14, padding: 12, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, fontFamily: '"SF Mono","JetBrains Mono",monospace' }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.55, marginBottom: 16 }}>
            The error has been logged to the browser console. Try reloading the page or switching tabs.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ height: 36 }}>
              ↻ Reload Page
            </button>
            <button onClick={() => this.setState({ error: null })} className="btn btn-secondary" style={{ height: 36 }}>
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
        <ErrorBoundary tab={currentTab}>
          {renderPage()}
        </ErrorBoundary>
      </main>
    </div>
  );
}
