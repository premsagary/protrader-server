import { create } from 'zustand';

const TABS = [
  { id: 'stockanalyzer', label: 'Deep Analyzer', migrated: true },
  { id: 'stockrec', label: 'Stock Picks', migrated: true },
  { id: 'mf', label: 'MF Picks', migrated: false },
  { id: 'stocks/overview', label: 'Stocks RoboTrade', migrated: false, admin: true },
  { id: 'crypto/overview', label: 'Crypto RoboTrade', migrated: false, admin: true },
  { id: 'holdings', label: 'Holdings', migrated: false, admin: true },
  { id: 'mirofish', label: 'MiroFish Lab', migrated: false, admin: true },
  { id: 'stockdata', label: 'Stock Data', migrated: false },
  { id: 'daytrade', label: 'DayTrade', migrated: false, admin: true, accent: 'red' },
  { id: 'architecture', label: 'Architecture', migrated: false, admin: true },
];

function getHashTab() {
  const h = window.location.hash.replace('#', '');
  if (!h) return 'stockanalyzer';
  return h;
}

export const useAppStore = create((set, get) => ({
  tabs: TABS,
  currentTab: getHashTab(),
  user: null,
  token: localStorage.getItem('pt_token') || null,

  setCurrentTab: (id) => {
    window.location.hash = `#${id}`;
    set({ currentTab: id });
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    const token = get().token;
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {}
    localStorage.removeItem('pt_token');
    set({ token: null, user: null });
    window.location.href = '/';
  },

  checkSession: async () => {
    const token = localStorage.getItem('pt_token');
    if (!token) {
      set({ token: null, user: null });
      return;
    }
    try {
      const r = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        set({ token, user: { username: d.username, role: d.role } });
      } else {
        localStorage.removeItem('pt_token');
        set({ token: null, user: null });
      }
    } catch {
      set({ token: null, user: null });
    }
  },
}));

// Keep state in sync with hash changes
window.addEventListener('hashchange', () => {
  useAppStore.setState({ currentTab: getHashTab() });
});
