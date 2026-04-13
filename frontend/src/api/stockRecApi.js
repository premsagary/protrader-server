import client from './client';

export const stockRecApi = {
  fetchScores: async () => {
    const res = await client.get('/api/stocks/score');
    return res.data;
  },

  fetchUniverse: async () => {
    const res = await client.get('/api/universe/list');
    return res.data;
  },

  analyzeStock: async (sym) => {
    const res = await client.get(`/api/stocks/analyze/${sym}`);
    return res.data;
  },

  analyzeStockAI: async (sym) => {
    const res = await client.get(`/api/stocks/analyze/${sym}/ai`);
    return res.data;
  },

  refreshFundamentals: async () => {
    const res = await client.post('/api/fundamentals/refresh');
    return res.data;
  },
};
