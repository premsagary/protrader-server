import { create } from 'zustand';
import { authApi } from '../api/authApi';

export const useAppStore = create((set, get) => ({
  // Navigation
  mode: 'mf',
  stocksTab: 'overview',
  cryptoTab: 'overview',

  setMode: (mode) => set({ mode }),
  setStocksTab: (tab) => set({ stocksTab: tab }),
  setCryptoTab: (tab) => set({ cryptoTab: tab }),

  // Auth
  isAuthenticated: false,
  user: null,
  token: localStorage.getItem('pt_token') || null,

  login: async (username, password) => {
    const res = await authApi.login(username, password);
    localStorage.setItem('pt_token', res.token);
    set({
      isAuthenticated: true,
      user: res.user,
      token: res.token,
    });
    return res;
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout API errors
    }
    localStorage.removeItem('pt_token');
    localStorage.removeItem('pt_passcode_verified');
    set({
      isAuthenticated: false,
      user: null,
      token: null,
    });
  },

  checkSession: async () => {
    const token = localStorage.getItem('pt_token');
    if (!token) {
      set({ isAuthenticated: false, user: null, token: null });
      return;
    }
    try {
      const res = await authApi.checkSession();
      set({
        isAuthenticated: true,
        user: res.user,
        token,
      });
    } catch {
      localStorage.removeItem('pt_token');
      set({ isAuthenticated: false, user: null, token: null });
    }
  },

  // Theme
  theme: localStorage.getItem('pt_theme') || 'dark',
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('pt_theme', next);
    set({ theme: next });
  },

  // Passcode gate
  passcodeVerified: !!localStorage.getItem('pt_passcode_verified'),
  verifyPasscode: (code) => {
    // Simple passcode check — in production this would be server-validated
    if (code === '1234') {
      localStorage.setItem('pt_passcode_verified', Date.now().toString());
      set({ passcodeVerified: true });
      return true;
    }
    return false;
  },
}));
