import client from './client';

export const authApi = {
  login: async (username, password) => {
    const res = await client.post('/api/auth/login', { username, password });
    return res.data;
  },

  logout: async () => {
    const res = await client.post('/api/auth/logout');
    return res.data;
  },

  checkSession: async () => {
    const res = await client.get('/api/auth/me');
    return res.data;
  },
};
