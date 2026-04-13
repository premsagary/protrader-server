import { create } from 'zustand';
import { adminApi } from '../api/adminApi';

export const useAdminStore = create((set, get) => ({
  pipeline: null,
  users: [],
  logs: [],
  logSince: 0,
  loading: false,
  error: null,

  fetchPipeline: async () => {
    try {
      const pipeline = await adminApi.fetchPipeline();
      set({ pipeline });
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchUsers: async () => {
    try {
      const users = await adminApi.fetchUsers();
      set({ users });
    } catch (err) {
      set({ error: err.message });
    }
  },

  createUser: async (username, password, role) => {
    try {
      await adminApi.createUser(username, password, role);
      await get().fetchUsers();
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteUser: async (id) => {
    try {
      await adminApi.deleteUser(id);
      await get().fetchUsers();
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  resetPassword: async (id, newPassword) => {
    try {
      await adminApi.resetPassword(id, newPassword);
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchLogs: async () => {
    const { logSince } = get();
    try {
      const data = await adminApi.fetchLogs(logSince);
      const newLogs = data.logs || data;
      if (Array.isArray(newLogs) && newLogs.length > 0) {
        set((state) => ({
          logs: [...state.logs, ...newLogs],
          logSince: data.since || Date.now(),
        }));
      }
    } catch (err) {
      set({ error: err.message });
    }
  },

  clearLogs: () => set({ logs: [], logSince: 0 }),

  forceRefresh: async (what) => {
    set({ loading: true });
    try {
      await adminApi.forceRefresh(what);
      await get().fetchPipeline();
      set({ loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },
}));
