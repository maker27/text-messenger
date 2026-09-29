import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';

import type { ChatMessage } from '@/entities/message/model';

import { MessageBubble } from './message-bubble';

const SENT_AT = Date.UTC(2026, 8, 28, 9, 30);
const LONG_WORD_LENGTH = 300;

const OUTGOING_MESSAGE: ChatMessage = {
  chatId: '79161234567',
  direction: 'outgoing',
  idMessage: 'outgoing',
  senderName: null,
  sentAt: SENT_AT,
  status: 'sent',
  text: 'Привет! Как дела?',
};

const meta = {
  args: {
    groupPosition: 'single',
    isOffline: false,
    message: OUTGOING_MESSAGE,
    onMessageRetry: fn(),
  },
  component: MessageBubble,
  decorators: [
    (Story) => (
      <ol className="flex flex-col p-3">
        <Story />
      </ol>
    ),
  ],
} satisfies Meta<typeof MessageBubble>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Outgoing: Story = {};

export const Incoming: Story = {
  args: {
    message: { ...OUTGOING_MESSAGE, direction: 'incoming', senderName: 'Анна', status: null },
  },
};

export const Pending: Story = {
  args: { message: { ...OUTGOING_MESSAGE, status: 'pending' } },
};

export const Read: Story = {
  args: { message: { ...OUTGOING_MESSAGE, status: 'read' } },
};

export const Failed: Story = {
  args: { message: { ...OUTGOING_MESSAGE, status: 'failed' } },
};

export const FailedOffline: Story = {
  args: { isOffline: true, message: { ...OUTGOING_MESSAGE, status: 'failed' } },
};

export const LongWord: Story = {
  args: { message: { ...OUTGOING_MESSAGE, text: 'а'.repeat(LONG_WORD_LENGTH) } },
};
