import type { StorybookConfig } from '@storybook/nextjs-vite';
import { mergeConfig } from 'vite';

const CHUNK_SIZE_WARNING_LIMIT_KB = 1500;

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: '@storybook/nextjs-vite',
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, {
      build: {
        chunkSizeWarningLimit: CHUNK_SIZE_WARNING_LIMIT_KB,
        rolldownOptions: {
          // "use client" and "use server" matter only to the Next.js bundler.
          checks: { bundlerTimings: false, moduleLevelDirective: false },
        },
      },
    }),
};

export default config;
