'use client';

import * as React from 'react';

export type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  /** Backend-с тодорхойлогдсон default (system / light / dark). localStorage override хийнэ. */
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeContextValue = {
  /** Хэрэглэгчийн сонгосон утга (system байж болно) */
  theme: Theme;
  /** Яг хэрэглэгдэж буй утга (system → dark/light болж задардаг) */
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolve(theme: Theme): 'dark' | 'light' {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyTheme(resolved: 'dark' | 'light') {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'besttv-theme',
}: ThemeProviderProps) {
  // Initial state: localStorage > defaultTheme (server-fetched) > 'system'
  const [theme, setThemeState] = React.useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme;
    return (localStorage.getItem(storageKey) as Theme | null) ?? defaultTheme;
  });

  const resolvedTheme = resolve(theme);

  // Apply class whenever theme changes
  React.useEffect(() => {
    applyTheme(resolve(theme));
  }, [theme]);

  // Listen for OS-level preference changes when theme === 'system'
  React.useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  // If defaultTheme changes from server (async fetch), update only if user has no stored pref
  React.useEffect(() => {
    const stored = localStorage.getItem(storageKey) as Theme | null;
    if (!stored) {
      setThemeState(defaultTheme);
    }
  }, [defaultTheme, storageKey]);

  const setTheme = React.useCallback(
    (t: Theme) => {
      localStorage.setItem(storageKey, t);
      setThemeState(t);
    },
    [storageKey],
  );

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
