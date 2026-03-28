import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  theme: Theme;
  setTheme: (nextTheme: Theme, event?: React.MouseEvent) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children, defaultTheme = 'auto', storageKey = 'vite-ui-theme' }: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
  });
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (theme === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  });

  // Efficient system theme detection (cc-switch pattern)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      if (theme !== 'auto') return;
      const root = window.document.documentElement;
      const isDark = mediaQuery.matches;
      root.classList.toggle('dark', isDark);
      root.classList.toggle('light', !isDark);
      setResolvedTheme(isDark ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Apply theme classes without flicker (cc-switch pattern)
  useEffect(() => {
    const root = window.document.documentElement;

    // Remove both classes first to prevent conflicts
    root.classList.remove('light', 'dark');

    if (theme === 'auto') {
      const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(isDark ? 'dark' : 'light');
      setResolvedTheme(isDark ? 'dark' : 'light');

      // Tauri native window theme integration
      if (window.__TAURI__?.core?.invoke) {
        window.__TAURI__.core.invoke('set_window_theme', { theme: isDark ? 'dark' : 'light' }).catch(() => {});
      }
      return;
    }

    root.classList.add(theme);
    setResolvedTheme(theme);

    // Tauri native window theme integration
    if (window.__TAURI__?.core?.invoke) {
      window.__TAURI__.core.invoke('set_window_theme', { theme }).catch(() => {});
    }
  }, [theme]);

  // Simple theme transition without animation
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
