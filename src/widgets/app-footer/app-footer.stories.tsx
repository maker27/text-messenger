import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AppFooter } from './app-footer';

const meta = {
  args: { isDemo: false },
  component: AppFooter,
} satisfies Meta<typeof AppFooter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Real: Story = {};

export const Demo: Story = {
  args: { isDemo: true },
};
