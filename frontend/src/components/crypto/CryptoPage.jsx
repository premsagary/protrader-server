import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useCryptoStore } from '../../store/useCryptoStore';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import Overview from './Overview';
import Positions from './Positions';
import Trades from './Trades';
import Market from './Market';
import Chart from './Chart';
import News from './News';

export default function CryptoPage() {
  const cryptoTab = useAppStore((s) => s.cryptoTab);
  const fetchAll = useCryptoStore((s) => s.fetchAll);

  useAutoRefresh(fetchAll, 30000, true);

  const renderTab = () => {
    switch (cryptoTab) {
      case 'overview':   return <Overview />;
      case 'positions':  return <Positions />;
      case 'trades':     return <Trades />;
      case 'market':     return <Market />;
      case 'chart':      return <Chart />;
      case 'news':       return <News />;
      default:           return <Overview />;
    }
  };

  return <div className="animate-fadeIn">{renderTab()}</div>;
}
