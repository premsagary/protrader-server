import { create } from 'zustand';
import { cryptoApi } from '../api/cryptoApi';

export const useCryptoStore = create((set, get) => ({
  prices: {},
  trades: [],
  stats: {},
  search: '',
  chartSym: 'BTCUSDT',
  newsSym: 'BTCUSDT',
  loading: false,
  error: null,

  setSearch: (search) => set({ search }),
  setChartSym: (sym) => set({ chartSym: sym }),
  setNewsSym: (sym) => set({ newsSym: sym }),

  fetchAll: async () => {
    try {
      const [prices, trades, stats] = await Promise.allSettled([
        cryptoApi.fetchPrices(),
        cryptoApi.fetchTrades(),
        cryptoApi.fetchStats(),
      ]);

      const update = {};
      if (prices.status === 'fulfilled') update.prices = prices.value;
      if (trades.status === 'fulfilled') update.trades = trades.value;
      if (stats.status === 'fulfilled') update.stats = stats.value;

      set(update);
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchPrices: async () => {
    try {
      const prices = await cryptoApi.fetchPrices();
      set({ prices });
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchTrades: async () => {
    try {
      const trades = await cryptoApi.fetchTrades();
      set({ trades });
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await cryptoApi.fetchStats();
      set({ stats });
    } catch (err) {
      set({ error: err.message });
    }
  },
}));
