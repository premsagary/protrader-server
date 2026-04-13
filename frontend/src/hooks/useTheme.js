import { useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';

export function useTheme() {
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);

  // Apply theme class to <html> on mount and changes
  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, [theme]);

  // Default to dark mode on first load if no saved preference
  useEffect(() => {
    const saved = localStorage.getItem('pt_theme');
    if (!saved) {
      localStorage.setItem('pt_theme', 'dark');
      useAppStore.setState({ theme: 'dark' });
    }
  }, []);

  return { theme, toggleTheme };
}
