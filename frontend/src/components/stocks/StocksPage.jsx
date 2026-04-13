import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useStockStore } from '../../store/useStockStore';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import Overview from './Overview';
import Positions from './Positions';
import Trades from './Trades';
import Market from './Market';
import Chart from './Chart';
import News from './News';
import Portfolio from './Portfolio';
import ScanLog from './ScanLog';

export default function StocksPage() {
  const stocksTab = useAppStore((s) => s.stocksTab);
  const fetchAll = useStockStore((s) => s.fetchAll);

  useAutoRefresh(fetchAll, 15000, true);

  const renderTab = () => {
    switch (stocksTab) {
      case 'overview':   return <Overview />;
      case 'positions':  return <Positions />;
      case 'trades':     return <Trades />;
      case 'market':     return <Market />;
      case 'chart':      return <Chart />;
      case 'news':       return <News />;
      case 'portfolio':  return <Portfolio />;
      case 'scanlog':    return <ScanLog />;
      default:           return <Overview />;
    }
  };

  return <div className="animate-fadeIn">{renderTab()}</div>;
}
