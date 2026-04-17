import React, { createContext, useContext, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/tauri-env';
import { THEME, isTheme, type Theme, type ResolvedTheme } from '@/constants';

interface ThemeContextType {
  theme: Theme;
  setTheme: (nextTheme: Theme, event?: React.MouseEvent) => void;
  resolvedTheme: ResolvedTheme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

const getSystemResolvedTheme = (): ResolvedTheme =>
  window.matchMedia(DARK_MEDIA_QUERY).matches ? THEME.Dark : THEME.Light;

const resolveTheme = (t: Theme): ResolvedTheme =>
  t === THEME.Auto ? getSystemResolvedTheme() : t;

export function ThemeProvider({ children, defaultTheme = THEME.Auto, storageKey = 'vite-ui-theme' }: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(storageKey);
    return isTheme(stored) ? stored : defaultTheme;
  });
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(theme));

  // Efficient system theme detection (cc-switch pattern)
  useEffect(() => {
    const mediaQuery = window.matchMedia(DARK_MEDIA_QUERY);

    const handleChange = () => {
      if (theme !== THEME.Auto) return;
      const root = window.document.documentElement;
      const next: ResolvedTheme = mediaQuery.matches ? THEME.Dark : THEME.Light;
      root.classList.toggle(THEME.Dark, next === THEME.Dark);
      root.classList.toggle(THEME.Light, next === THEME.Light);
      setResolvedTheme(next);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Apply theme classes without flicker (cc-switch pattern)
  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove(THEME.Light, THEME.Dark);

    const next = resolveTheme(theme);
    root.classList.add(next);
    setResolvedTheme(next);

    if (isTauri()) {
      invoke('set_window_theme', { theme: next }).catch(() => {});
    }
  }, [theme]);

  const setTheme = (nextTheme: Theme, _event?: React.MouseEvent) => {
    setThemeState(nextTheme);
    localStorage.setItem(storageKey, nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
