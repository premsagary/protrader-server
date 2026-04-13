import { create } from 'zustand';
import { mfApi } from '../api/mfApi';
import { mirofishApi } from '../api/mirofishApi';

export const useMfStore = create((set, get) => ({
  funds: null,
  loading: false,
  total: null,
  predictionCache: {},
  error: null,

  fetchFunds: async () => {
    set({ loading: true, error: null });
    try {
      const data = await mfApi.fetchFunds();
      set({
        funds: data.funds || data,
        total: data.total || (data.funds ? data.funds.length : 0),
        loading: false,
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  refreshFunds: async () => {
    set({ loading: true });
    try {
      await mfApi.refreshFunds();
      await get().fetchFunds();
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  predictFund: async (fundData) => {
    const key = fundData.name + '-' + (fundData.rank || 0);
    const cache = get().predictionCache;
    if (cache[key]) return cache[key];

    try {
      const result = await mirofishApi.predictMF(fundData);
      set({
        predictionCache: { ...get().predictionCache, [key]: result },
      });
      return result;
    } catch (err) {
      return null;
    }
  },
}));
