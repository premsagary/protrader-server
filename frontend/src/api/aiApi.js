import client from './client';

export const aiApi = {
  getStatus: async (since) => {
    const res = await client.get('/api/ai/status', {
      params: { since },
    });
    return res.data;
  },

  validate: async (mode) => {
    const res = await client.get('/api/ai/validate', {
      params: { mode },
    });
    return res.data;
  },

  getValidation: async () => {
    const res = await client.get('/api/ai/validation');
    return res.data;
  },

  getReviews: async () => {
    const res = await client.get('/api/ai/reviews');
    return res.data;
  },
};
