import { create } from 'zustand';

// 2026-04-20 tab consolidation (iterated through the day):
//   Round 1 — 'Stocks RoboTrade' relabeled 'Trade' when the Agent page got
//     absorbed as a sub-tab (stocks/agent); standalone 'agent' tab was
//     removed from the nav (route kept as a backwards-compat alias).
//   Round 2 — Admin's master PAPER↔LIVE kill-switch, capital editor, Kite
//     test-buy, and ENABLE LIVE confirmation modal moved to the Agent
//     sub-tab (components/common/TradingModeCard.jsx). Admin is now
//     strictly read-only ops (pipelines, logs, uptime, LLM budget, users).
//   Round 3 — 'DayTrade' relabeled 'Scan' and kept as a top-level nav item.
//   Round 4 (this change) — 'Scan' folded INTO Stocks RoboTrade as a
//     sub-tab (stocks/scan), and the parent tab renamed back to 'Stocks
//     RoboTrade'. Rationale: Scan / Candidates / Agent / Positions /
//     Trades / Analytics are all facets of one auto-trading workflow —
//     surfacing Scan as a separate top-level tab was splitting a unified
//     mental model. The '#daytrade' route is kept as a backwards-compat
//     alias that lands users on stocks/scan (see App.jsx).
const TABS = [
  { id: 'stockanalyzer', label: 'Deep Analyzer', migrated: true },
  { id: 'stockrec', label: 'Stock Picks', migrated: true },
  { id: 'mf', label: 'MF Picks', migrated: true },
  { id: 'stocks/overview', label: 'Stocks RoboTrade', migrated: true, admin: true, accent: 'purple' },
  { id: 'crypto/overview', label: 'Crypto RoboTrade', migrated: true, admin: true },
  { id: 'holdings', label: 'Holdings', migrated: true, admin: true },
  { id: 'mirofish', label: 'MiroFish Lab', migrated: true, admin: true },
  { id: 'stockdata', label: 'Stock Data', migrated: true },
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
