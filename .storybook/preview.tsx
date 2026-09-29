import type { Preview } from '@storybook/nextjs-vite';
import { Geist } from 'next/font/google';
import { useEffect, type ReactNode } from 'react';
import { sb } from 'storybook/test';

import { roboto } from '../src/shared/fonts/fonts';

import '../src/app/globals.css';

sb.mock('../src/features/create-chat/actions.ts');
sb.mock('../src/features/login/actions.ts');

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['cyrillic', 'latin'],
});

interface StoryThemeProps {
  children: ReactNode;
  messenger: string;
  theme: string;
}

function StoryTheme({ children, messenger, theme }: StoryThemeProps) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div
      className={`${geistSans.variable} ${roboto.variable} bg-surface p-4 text-text antialiased`}
      data-messenger={messenger}
    >
      {children}
    </div>
  );
}

const preview: Preview = {
  decorators: [
    (Story, { globals }) => (
      <StoryTheme messenger={String(globals.messenger)} theme={String(globals.theme)}>
        <Story />
      </StoryTheme>
    ),
  ],
  globalTypes: {
    messenger: {
      description: 'Messenger',
      toolbar: {
        dynamicTitle: true,
        items: ['max', 'whatsapp', 'telegram'],
        title: 'Messenger',
      },
    },
    theme: {
      description: 'Theme',
      toolbar: {
        dynamicTitle: true,
        items: ['light', 'dark'],
        title: 'Theme',
      },
    },
  },
  initialGlobals: {
    messenger: 'max',
    theme: 'light',
  },
  parameters: {
    a11y: {
      test: 'error',
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true,
    },
  },
};

export default preview;
