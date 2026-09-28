'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { getActiveMessenger } from '@/entities/messenger/active-messenger';
import type { MessengerId } from '@/entities/messenger/model';
import {
  useMessengerSession,
  useUnreadCount,
} from '@/features/messenger-session/messenger-session-provider';
import { UnreadIndicators } from '@/features/messenger-session/unread-indicators';
import { ThemeSelect } from '@/features/theme-select/theme-select';
import { useTheme } from '@/features/theme-select/use-theme';
import type { Theme } from '@/shared/theme/theme';
import { AppFooter } from '@/widgets/app-footer/app-footer';
import { CommandPalette } from '@/widgets/command-palette/command-palette';
import { Cube } from '@/widgets/cube/cube';
import { MessengerTabs } from '@/widgets/messenger-tabs/messenger-tabs';
import { useTabPaths } from '@/widgets/messenger-tabs/use-tab-paths';
import { OfflineBanner } from '@/widgets/offline-banner/offline-banner';

interface MessengerShellProps {
  children: ReactNode;
  faces: Record<MessengerId, ReactNode>;
  isRealModeEnabled: boolean;
  theme: Theme | null;
}

export function MessengerShell({
  children,
  faces,
  isRealModeEnabled,
  theme: initialTheme,
}: MessengerShellProps) {
  const activeMessenger = getActiveMessenger(usePathname());
  const tabPaths = useTabPaths(activeMessenger);
  const [theme, changeTheme] = useTheme(initialTheme);
  const unreadByMessenger = {
    max: useUnreadCount('max'),
    telegram: useUnreadCount('telegram'),
    whatsapp: useUnreadCount('whatsapp'),
  };
  const sessionModes = {
    max: useMessengerSession('max').session?.mode,
    telegram: useMessengerSession('telegram').session?.mode,
    whatsapp: useMessengerSession('whatsapp').session?.mode,
  };
  const isDemo =
    !isRealModeEnabled || (activeMessenger !== null && sessionModes[activeMessenger] === 'demo');

  return (
    <>
      <header className="flex items-center border-b border-border bg-surface-muted">
        <MessengerTabs
          activeMessenger={activeMessenger}
          tabPaths={tabPaths}
          unreadByMessenger={unreadByMessenger}
        />
        <ThemeSelect theme={theme} onThemeChange={changeTheme} />
      </header>
      <OfflineBanner />
      <UnreadIndicators unreadByMessenger={unreadByMessenger} />
      <main className="flex flex-1 flex-col">
        {activeMessenger !== null && <Cube activeMessenger={activeMessenger} faces={faces} />}
        {children}
      </main>
      <AppFooter isDemo={isDemo} />
      <CommandPalette
        activeMessenger={activeMessenger}
        tabPaths={tabPaths}
        onThemeChange={changeTheme}
      />
    </>
  );
}
