import { create } from 'zustand';
import { stocksApi } from '../api/stocksApi';

export const useStockStore = create((set, get) => ({
  prices: {},
  trades: [],
  stats: {},
  daily: [],
  scanLog: [],
  health: {},
  holdings: [],
  margin: null,
  filter: 'All',
  search: '',
  chartSym: 'RELIANCE',
  newsNseSym: 'RELIANCE',
  loading: false,
  error: null,

  setFilter: (filter) => set({ filter }),
  setSearch: (search) => set({ search }),
  setChartSym: (sym) => set({ chartSym: sym }),
  setNewsNseSym: (sym) => set({ newsNseSym: sym }),

  fetchAll: async () => {
    try {
      const [prices, trades, stats, daily, scanLog, health, holdings, margin] =
        await Promise.allSettled([
          stocksApi.fetchPrices(),
          stocksApi.fetchTrades(),
          stocksApi.fetchStats(),
          stocksApi.fetchDaily(),
          stocksApi.fetchScanLog(),
          stocksApi.fetchHealth(),
          stocksApi.fetchHoldings(),
          stocksApi.fetchMargin(),
        ]);

      const update = {};
      if (prices.status === 'fulfilled') update.prices = prices.value;
      if (trades.status === 'fulfilled') update.trades = trades.value;
      if (stats.status === 'fulfilled') update.stats = stats.value;
      if (daily.status === 'fulfilled') update.daily = daily.value;
      if (scanLog.status === 'fulfilled') update.scanLog = scanLog.value;
      if (health.status === 'fulfilled') update.health = health.value;
      if (holdings.status === 'fulfilled') update.holdings = holdings.value;
      if (margin.status === 'fulfilled') update.margin = margin.value;

      set(update);
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchPrices: async () => {
    try {
      const prices = await stocksApi.fetchPrices();
      set({ prices });
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchTrades: async () => {
    try {
      const trades = await stocksApi.fetchTrades();
      set({ trades });
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await stocksApi.fetchStats();
      set({ stats });
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchDaily: async () => {
    try {
      const daily = await stocksApi.fetchDaily();
      set({ daily });
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchScanLog: async () => {
    try {
      const scanLog = await stocksApi.fetchScanLog();
      set({ scanLog });
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchHealth: async () => {
    try {
      const health = await stocksApi.fetchHealth();
      set({ health });
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchHoldings: async () => {
    try {
      const holdings = await stocksApi.fetchHoldings();
      set({ holdings });
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchMargin: async () => {
    try {
      const margin = await stocksApi.fetchMargin();
      set({ margin });
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchHistory: async (symbol, interval) => {
    try {
      return await stocksApi.fetchHistory(symbol, interval);
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  cleanupTrades: async () => {
    try {
      await stocksApi.cleanupTrades();
      await get().fetchTrades();
      await get().fetchStats();
    } catch (err) {
      set({ error: err.message });
    }
  },

  resetTrades: async () => {
    try {
      await stocksApi.resetTrades();
      await get().fetchTrades();
      await get().fetchStats();
    } catch (err) {
      set({ error: err.message });
    }
  },
}));
