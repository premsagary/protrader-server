import client from './client';

export const adminApi = {
  fetchPipeline: async () => {
    const res = await client.get('/api/admin/pipeline');
    return res.data;
  },

  forceRefresh: async (what) => {
    const res = await client.post('/api/admin/force-refresh', null, {
      params: { what },
    });
    return res.data;
  },

  fetchLogs: async (since = 0) => {
    const res = await client.get('/api/admin/logs', {
      params: { since },
    });
    return res.data;
  },

  fetchUsers: async () => {
    const res = await client.get('/api/admin/users');
    return res.data;
  },

  createUser: async (username, password, role) => {
    const res = await client.post('/api/admin/users', { username, password, role });
    return res.data;
  },

  deleteUser: async (id) => {
    const res = await client.delete(`/api/admin/users/${id}`);
    return res.data;
  },

  resetPassword: async (id, newPassword) => {
    const res = await client.post(`/api/admin/users/${id}/reset-password`, {
      password: newPassword,
    });
    return res.data;
  },
};
