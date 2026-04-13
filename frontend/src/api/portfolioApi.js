import client from './client';

export const portfolioApi = {
  fetchModel: async (amount) => {
    const res = await client.get('/api/portfolio/model', {
      params: { amount },
    });
    return res.data;
  },

  suggest: async (amount) => {
    const res = await client.post('/api/portfolio/suggest', { amount });
    return res.data;
  },

  refresh: async (amount) => {
    const res = await client.get('/api/portfolio/suggest/refresh', {
      params: { amount },
    });
    return res.data;
  },

  regenerate: async (amount) => {
    const res = await client.post('/api/portfolio/suggest/regenerate', { amount });
    return res.data;
  },

  fetchPositions: async () => {
    const res = await client.get('/api/portfolio/positions');
    return res.data;
  },

  fetchSignals: async (limit = 50) => {
    const res = await client.get('/api/portfolio/signals', {
      params: { limit },
    });
    return res.data;
  },

  generateSignals: async () => {
    const res = await client.post('/api/portfolio/signals/generate');
    return res.data;
  },

  fetchPerformance: async () => {
    const res = await client.get('/api/portfolio/performance');
    return res.data;
  },

  fetchRisk: async () => {
    const res = await client.get('/api/portfolio/risk');
    return res.data;
  },

  buyStock: async (symbol, quantity, price) => {
    const res = await client.post('/api/portfolio/buy', { symbol, quantity, price });
    return res.data;
  },

  sellPosition: async (positionId) => {
    const res = await client.post('/api/portfolio/sell', { positionId });
    return res.data;
  },

  addPosition: async (data) => {
    const res = await client.post('/api/portfolio/add', data);
    return res.data;
  },
};
