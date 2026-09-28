import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { Theme } from '@/shared/theme/theme';

import { ThemeSelect } from './theme-select';
import { useTheme } from './use-theme';

interface ThemeHarnessProps {
  initialTheme: Theme | null;
}

function ThemeHarness({ initialTheme }: ThemeHarnessProps) {
  const [theme, changeTheme] = useTheme(initialTheme);

  return <ThemeSelect theme={theme} onThemeChange={changeTheme} />;
}

const systemScheme = { isDark: false, listeners: new Set<() => void>() };

function switchSystemScheme(isDark: boolean) {
  systemScheme.isDark = isDark;
  act(() => {
    systemScheme.listeners.forEach((listener) => {
      listener();
    });
  });
}

function getTrigger() {
  return screen.getByRole('button', { name: /Тема/ });
}

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      addEventListener: (_type: string, listener: () => void) => {
        systemScheme.listeners.add(listener);
      },
      matches: systemScheme.isDark && query === '(prefers-color-scheme: dark)',
      media: query,
      removeEventListener: (_type: string, listener: () => void) => {
        systemScheme.listeners.delete(listener);
      },
    })),
  );
});

afterEach(() => {
  systemScheme.isDark = false;
  systemScheme.listeners.clear();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-theme');
  document.cookie = 'tm_theme=; Path=/; Max-Age=0';
});

test('shows the system theme when no theme is chosen', () => {
  systemScheme.isDark = true;
  render(<ThemeHarness initialTheme={null} />);

  expect(getTrigger()).toHaveTextContent('Тёмная');
  expect(document.documentElement).not.toHaveAttribute('data-theme');
});

test('follows the system theme until a theme is chosen', () => {
  render(<ThemeHarness initialTheme={null} />);

  switchSystemScheme(true);

  expect(getTrigger()).toHaveTextContent('Тёмная');
});

test('prefers the chosen theme over the system theme', () => {
  systemScheme.isDark = true;
  render(<ThemeHarness initialTheme="light" />);

  expect(getTrigger()).toHaveTextContent('Светлая');
});

test('stores the chosen theme in the cookie and on the document', async () => {
  render(<ThemeHarness initialTheme={null} />);

  await userEvent.click(getTrigger());
  await userEvent.click(screen.getByRole('option', { name: 'Тёмная' }));

  expect(document.cookie).toContain('tm_theme=dark');
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(getTrigger()).toHaveTextContent('Тёмная');
});

test('keeps the chosen theme when the system theme changes', async () => {
  render(<ThemeHarness initialTheme={null} />);

  await userEvent.click(getTrigger());
  await userEvent.click(screen.getByRole('option', { name: 'Светлая' }));
  switchSystemScheme(true);

  expect(getTrigger()).toHaveTextContent('Светлая');
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
});
