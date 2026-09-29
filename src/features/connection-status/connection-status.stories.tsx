import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { withMessengerStore } from '@/features/messenger-session/with-messenger-store';

import { ConnectionStatus } from './connection-status';

const RETRY_DELAY_MS = 30_000;

const meta = {
  args: { messengerId: 'max' },
  component: ConnectionStatus,
} satisfies Meta<typeof ConnectionStatus>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Connecting: Story = {
  decorators: [withMessengerStore(() => undefined)],
};

export const Online: Story = {
  decorators: [
    withMessengerStore((store) => {
      store.getState().setConnection({ status: 'online' });
    }),
  ],
};

export const Reconnecting: Story = {
  decorators: [
    withMessengerStore((store) => {
      store
        .getState()
        .setConnection({ retryAt: Date.now() + RETRY_DELAY_MS, status: 'reconnecting' });
    }),
  ],
};

export const Stopped: Story = {
  decorators: [
    withMessengerStore((store) => {
      store.getState().setConnection({ code: 'webhookConfigured', status: 'stopped' });
    }),
  ],
};

export const Unauthorized: Story = {
  decorators: [
    withMessengerStore((store) => {
      store.getState().setConnection({ status: 'unauthorized' });
    }),
  ],
};
