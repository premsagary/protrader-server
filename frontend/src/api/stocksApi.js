import client from './client';

export const stocksApi = {
  fetchPrices: async () => {
    const res = await client.get('/prices');
    return res.data;
  },

  fetchTrades: async () => {
    const res = await client.get('/paper-trades');
    return res.data;
  },

  fetchStats: async () => {
    const res = await client.get('/paper-trades/stats');
    return res.data;
  },

  fetchDaily: async () => {
    const res = await client.get('/paper-trades/daily');
    return res.data;
  },

  fetchScanLog: async () => {
    const res = await client.get('/scan-log');
    return res.data;
  },

  fetchHealth: async () => {
    const res = await client.get('/health');
    return res.data;
  },

  fetchHoldings: async () => {
    const res = await client.get('/holdings');
    return res.data;
  },

  fetchMargin: async () => {
    const res = await client.get('/margin');
    return res.data;
  },

  fetchHistory: async (symbol, interval = '15minute') => {
    const res = await client.get(`/history/${symbol}`, {
      params: { interval },
    });
    return res.data;
  },

  cleanupTrades: async () => {
    const res = await client.post('/cleanup-trades');
    return res.data;
  },

  resetTrades: async () => {
    const res = await client.post('/reset-trades');
    return res.data;
  },
};
