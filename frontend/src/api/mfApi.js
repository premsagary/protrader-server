import client from './client';

export const mfApi = {
  fetchFunds: async () => {
    const res = await client.get('/api/mf/funds');
    return res.data;
  },

  refreshFunds: async () => {
    const res = await client.post('/api/mf/refresh');
    return res.data;
  },
};
