import { useState, useSyncExternalStore } from 'react';

import { getCookiePath } from '@/shared/cookies/cookie-path';
import { THEME_COOKIE_NAME, type Theme } from '@/shared/theme/theme';

const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

export const THEME_ORDER = ['light', 'dark'] as const satisfies readonly Theme[];

export const ThemeLabel = {
  dark: 'Тёмная',
  light: 'Светлая',
} satisfies Record<Theme, string>;

export function useTheme(initialTheme: Theme | null) {
  const [theme, setTheme] = useState(initialTheme);

  function changeTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    document.cookie = `${THEME_COOKIE_NAME}=${nextTheme}; Path=${getCookiePath()}; Max-Age=${String(THEME_COOKIE_MAX_AGE_SECONDS)}; SameSite=Lax`;
    document.documentElement.setAttribute('data-theme', nextTheme);
  }

  return [theme, changeTheme] as const;
}

export function useSystemTheme() {
  return useSyncExternalStore(subscribeToSystemTheme, getSystemTheme, getServerSystemTheme);
}

function subscribeToSystemTheme(onSystemThemeChange: () => void) {
  const darkSchemeQuery = window.matchMedia(DARK_SCHEME_QUERY);
  darkSchemeQuery.addEventListener('change', onSystemThemeChange);

  return () => {
    darkSchemeQuery.removeEventListener('change', onSystemThemeChange);
  };
}

function getSystemTheme(): Theme {
  return window.matchMedia(DARK_SCHEME_QUERY).matches ? 'dark' : 'light';
}

function getServerSystemTheme() {
  return null;
}
