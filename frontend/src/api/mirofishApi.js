import client from './client';

export const mirofishApi = {
  predictMF: async (fundData) => {
    const res = await client.post('/api/mirofish/mf-predict', fundData);
    return res.data;
  },

  predictFA: async (symbol) => {
    const res = await client.post('/api/mirofish/fa-predict', { symbol });
    return res.data;
  },

  getStatus: async () => {
    const res = await client.get('/api/mirofish/status');
    return res.data;
  },

  getResult: async () => {
    const res = await client.get('/api/mirofish/result');
    return res.data;
  },

  runMirofish: async (symbol) => {
    const res = await client.post('/api/mirofish/run', { symbol });
    return res.data;
  },
};
