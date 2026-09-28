import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { cookies } from 'next/headers';

import { MessengerSessionProvider } from '@/features/messenger-session/messenger-session-provider';
import { getSessionView } from '@/features/messenger-session/server';
import { env } from '@/server/env';
import { parseTheme, THEME_COOKIE_NAME } from '@/shared/theme/theme';
import { MessengerShell } from '@/widgets/messenger-shell/messenger-shell';

import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['cyrillic', 'latin'],
});

export const metadata: Metadata = {
  title: 'Multi Messenger',
  description: 'Веб-клиент для MAX, WhatsApp и Telegram на GREEN-API',
};

export default async function RootLayout({ children, max, telegram, whatsapp }: LayoutProps<'/'>) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE_NAME)?.value);
  const [maxSession, telegramSession, whatsappSession] = await Promise.all([
    getSessionView('max'),
    getSessionView('telegram'),
    getSessionView('whatsapp'),
  ]);

  return (
    <html
      className={`${geistSans.variable} h-full antialiased`}
      data-theme={theme ?? undefined}
      lang="ru"
    >
      <body className="flex h-full flex-col">
        <MessengerSessionProvider
          isRealModeEnabled={env.REAL_MODE_ENABLED}
          messengerId="max"
          session={maxSession}
        >
          <MessengerSessionProvider
            isRealModeEnabled={env.REAL_MODE_ENABLED}
            messengerId="whatsapp"
            session={whatsappSession}
          >
            <MessengerSessionProvider
              isRealModeEnabled={env.REAL_MODE_ENABLED}
              messengerId="telegram"
              session={telegramSession}
            >
              <MessengerShell
                faces={{ max, telegram, whatsapp }}
                isRealModeEnabled={env.REAL_MODE_ENABLED}
                theme={theme}
              >
                {children}
              </MessengerShell>
            </MessengerSessionProvider>
          </MessengerSessionProvider>
        </MessengerSessionProvider>
      </body>
    </html>
  );
}
