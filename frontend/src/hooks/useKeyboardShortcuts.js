import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

const MODE_KEYS = {
  '1': 'mf',
  '2': 'stockrec',
  '3': 'stocks',
  '4': 'crypto',
  '5': 'psuggest',
  '6': 'admin',
};

export function useKeyboardShortcuts() {
  const setMode = useAppStore((s) => s.setMode);
  const toggleTheme = useAppStore((s) => s.toggleTheme);

  useEffect(() => {
    function handleKeyDown(e) {
      // Ignore when typing in inputs/textareas
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // D = toggle dark mode
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        toggleTheme();
        return;
      }

      // 1-6 = switch modes
      if (MODE_KEYS[e.key]) {
        e.preventDefault();
        setMode(MODE_KEYS[e.key]);
        return;
      }

      // / = focus search input (if one exists on screen)
      if (e.key === '/') {
        const searchInput = document.querySelector('input[data-search]');
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
        return;
      }

      // Escape = close modals by blurring active element
      if (e.key === 'Escape') {
        const active = document.activeElement;
        if (active && active !== document.body) {
          active.blur();
        }
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setMode, toggleTheme]);
}
