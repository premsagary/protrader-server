import { create } from 'zustand';

// 2026-04-20 tab consolidation:
//   - 'Stocks RoboTrade' relabeled 'Trade' — the Agent page got absorbed as a
//     sub-tab (stocks/agent) so there's one home for mode/schedule/decisions/
//     positions/P&L/analytics instead of the old Agent + RoboTrade split.
//   - Standalone 'agent' tab removed from the nav. The route still works as
//     a backwards-compat alias (see App.jsx) so bookmarks/hash-links don't
//     404 during the paper soak.
const TABS = [
  { id: 'stockanalyzer', label: 'Deep Analyzer', migrated: true },
  { id: 'stockrec', label: 'Stock Picks', migrated: true },
  { id: 'mf', label: 'MF Picks', migrated: true },
  { id: 'stocks/overview', label: 'Trade', migrated: true, admin: true, accent: 'purple' },
  { id: 'crypto/overview', label: 'Crypto RoboTrade', migrated: true, admin: true },
  { id: 'holdings', label: 'Holdings', migrated: true, admin: true },
  { id: 'mirofish', label: 'MiroFish Lab', migrated: true, admin: true },
  { id: 'stockdata', label: 'Stock Data', migrated: true },
  { id: 'daytrade', label: 'DayTrade', migrated: true, accent: 'red' },
  { id: 'architecture', label: 'Architecture', migrated: true, admin: true },
  { id: 'admin', label: 'Admin', migrated: true, admin: true },
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

  // Pre-fill for Deep Analyzer when navigating from Stock Picks quick-start
  pendingAnalyzeSymbol: null,
  analyzeStock: (sym) => {
    set({ pendingAnalyzeSymbol: sym });
    const store = get();
    store.setCurrentTab('stockanalyzer');
  },

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
