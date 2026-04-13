import { create } from 'zustand';
import { portfolioApi } from '../api/portfolioApi';
import { aiApi } from '../api/aiApi';

export const usePortfolioStore = create((set, get) => ({
  modelData: null,
  amount: 100000,
  loading: false,
  tab: 'model',
  positions: null,
  signals: null,
  signalFilter: 'all',
  performance: null,
  risk: null,
  aiValidation: null,
  aiReviews: null,
  error: null,

  setAmount: (amount) => set({ amount }),
  setTab: (tab) => set({ tab }),
  setSignalFilter: (filter) => set({ signalFilter: filter }),

  fetchModel: async (amount) => {
    const amt = amount || get().amount;
    set({ loading: true, error: null });
    try {
      const data = await portfolioApi.fetchModel(amt);
      set({ modelData: data, loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  generate: async () => {
    const { amount } = get();
    set({ loading: true, error: null });
    try {
      const data = await portfolioApi.suggest(amount);
      set({ modelData: data, loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  refresh: async () => {
    const { amount } = get();
    set({ loading: true });
    try {
      const data = await portfolioApi.refresh(amount);
      set({ modelData: data, loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  regenerate: async () => {
    const { amount } = get();
    set({ loading: true });
    try {
      const data = await portfolioApi.regenerate(amount);
      set({ modelData: data, loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  fetchPositions: async () => {
    try {
      const positions = await portfolioApi.fetchPositions();
      set({ positions });
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchSignals: async (limit) => {
    try {
      const signals = await portfolioApi.fetchSignals(limit);
      set({ signals });
    } catch (err) {
      set({ error: err.message });
    }
  },

  generateSignals: async () => {
    try {
      await portfolioApi.generateSignals();
      await get().fetchSignals();
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchPerformance: async () => {
    try {
      const [performance, risk] = await Promise.allSettled([
        portfolioApi.fetchPerformance(),
        portfolioApi.fetchRisk(),
      ]);
      const update = {};
      if (performance.status === 'fulfilled') update.performance = performance.value;
      if (risk.status === 'fulfilled') update.risk = risk.value;
      set(update);
    } catch (err) {
      set({ error: err.message });
    }
  },

  buyStock: async (symbol, quantity, price) => {
    try {
      await portfolioApi.buyStock(symbol, quantity, price);
      await get().fetchPositions();
    } catch (err) {
      set({ error: err.message });
    }
  },

  sellPosition: async (positionId) => {
    try {
      await portfolioApi.sellPosition(positionId);
      await get().fetchPositions();
    } catch (err) {
      set({ error: err.message });
    }
  },

  addPosition: async (data) => {
    try {
      await portfolioApi.addPosition(data);
      await get().fetchPositions();
    } catch (err) {
      set({ error: err.message });
    }
  },

  // AI Validation
  fetchAIValidation: async () => {
    try {
      const data = await aiApi.getValidation();
      set({ aiValidation: data });
    } catch (err) {
      set({ error: err.message });
    }
  },

  runAIValidation: async (mode) => {
    try {
      const data = await aiApi.validate(mode);
      return data;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  fetchAIReviews: async () => {
    try {
      const data = await aiApi.getReviews();
      set({ aiReviews: data });
    } catch (err) {
      set({ error: err.message });
    }
  },

  checkAIStatus: async (since) => {
    try {
      return await aiApi.getStatus(since);
    } catch (err) {
      return null;
    }
  },
}));
