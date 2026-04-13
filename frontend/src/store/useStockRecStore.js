import { create } from 'zustand';
import { stockRecApi } from '../api/stockRecApi';

export const useStockRecStore = create((set, get) => ({
  data: null,
  filter: 'ALL',
  sort: 'score',
  expanded: {},
  showAll: false,
  tab: 'overview',
  loading: false,
  error: null,

  // Deep Stock Analyzer
  analyzerData: null,
  analyzerChart: null,
  analyzerTab: '3Y',
  analyzerLoading: false,
  universe: [],

  setFilter: (filter) => set({ filter }),
  setSort: (sort) => set({ sort }),
  setShowAll: (showAll) => set({ showAll }),
  setTab: (tab) => set({ tab }),
  setAnalyzerTab: (tab) => set({ analyzerTab: tab }),

  toggleExpanded: (sym) => {
    const expanded = { ...get().expanded };
    expanded[sym] = !expanded[sym];
    set({ expanded });
  },

  fetchScores: async () => {
    set({ loading: true, error: null });
    try {
      const data = await stockRecApi.fetchScores();
      set({ data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchUniverse: async () => {
    try {
      const universe = await stockRecApi.fetchUniverse();
      set({ universe });
    } catch (err) {
      set({ error: err.message });
    }
  },

  analyzeStock: async (sym) => {
    set({ analyzerLoading: true, analyzerData: null, error: null });
    try {
      const data = await stockRecApi.analyzeStock(sym);
      set({ analyzerData: data, analyzerLoading: false });
      return data;
    } catch (err) {
      set({ error: err.message, analyzerLoading: false });
      return null;
    }
  },

  runAI: async (sym) => {
    try {
      const data = await stockRecApi.analyzeStockAI(sym);
      return data;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  refreshFundamentals: async () => {
    try {
      await stockRecApi.refreshFundamentals();
    } catch (err) {
      set({ error: err.message });
    }
  },
}));
