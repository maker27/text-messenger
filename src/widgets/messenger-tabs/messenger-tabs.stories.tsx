import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { MessengerTabs } from './messenger-tabs';

const LARGE_UNREAD_COUNT = 1250;

const meta = {
  args: {
    activeMessenger: 'max',
    tabPaths: { max: '/max', telegram: '/telegram', whatsapp: '/whatsapp' },
    unreadByMessenger: { max: 0, telegram: 0, whatsapp: 0 },
  },
  component: MessengerTabs,
} satisfies Meta<typeof MessengerTabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Unread: Story = {
  args: {
    activeMessenger: 'telegram',
    unreadByMessenger: { max: 3, telegram: 0, whatsapp: LARGE_UNREAD_COUNT },
  },
};

export const NoActiveMessenger: Story = {
  args: { activeMessenger: null },
};
