import client from './client';

export const newsApi = {
  fetchNews: async (sym, name) => {
    const res = await client.get('/api/news', {
      params: { sym, name },
    });
    return res.data;
  },
};
