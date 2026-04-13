import client from './client';

export const cryptoApi = {
  fetchPrices: async () => {
    const res = await client.get('/api/crypto-prices');
    return res.data;
  },

  fetchTrades: async () => {
    const res = await client.get('/crypto/trades');
    return res.data;
  },

  fetchStats: async () => {
    const res = await client.get('/crypto/trades/stats');
    return res.data;
  },
};
