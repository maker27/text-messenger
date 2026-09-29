import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';

import type { ChatMessage } from '@/entities/message/model';
import { withMessengerStore } from '@/features/messenger-session/with-messenger-store';

import { MessageList } from './message-list';

const CHAT_ID = '79161234567';
const SENT_AT = Date.UTC(2026, 8, 28, 9, 30);
const MINUTE_MS = 60_000;
const LONG_WORD_LENGTH = 300;
const MANY_MESSAGES_COUNT = 40;

function createMessage(index: number, message: Partial<ChatMessage>): ChatMessage {
  return {
    chatId: CHAT_ID,
    direction: index % 2 === 0 ? 'incoming' : 'outgoing',
    idMessage: String(index),
    senderName: null,
    sentAt: SENT_AT + index * MINUTE_MS,
    status: index % 2 === 0 ? null : 'read',
    text: `Сообщение ${String(index + 1)}`,
    ...message,
  };
}

const CONVERSATION = [
  createMessage(0, { text: 'Привет! Во сколько встречаемся?' }),
  createMessage(1, { status: 'delivered', text: 'Давай в семь' }),
  createMessage(2, { text: 'У входа в парк' }),
  createMessage(3, { status: 'pending', text: 'Хорошо, буду' }),
  createMessage(4, { direction: 'outgoing', status: 'failed', text: 'Возьми зонт' }),
];

const meta = {
  args: {
    chatId: CHAT_ID,
    isOffline: false,
    onMessageRetry: fn(),
  },
  component: MessageList,
  decorators: [
    (Story) => (
      <div className="flex h-96 flex-col">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MessageList>;

export default meta;

type Story = StoryObj<typeof meta>;

function withMessages(messages: ChatMessage[]) {
  return withMessengerStore((store) => {
    store.getState().hydrateHistory(CHAT_ID, messages);
  });
}

export const Conversation: Story = {
  decorators: [withMessages(CONVERSATION)],
};

export const Empty: Story = {
  decorators: [withMessages([])],
};

export const Offline: Story = {
  args: { isOffline: true },
  decorators: [withMessages(CONVERSATION)],
};

export const Scrollable: Story = {
  decorators: [
    withMessages(
      Array.from({ length: MANY_MESSAGES_COUNT }, (_, index) => createMessage(index, {})),
    ),
  ],
};

export const LongWord: Story = {
  decorators: [withMessages([createMessage(0, { text: 'а'.repeat(LONG_WORD_LENGTH) })])],
};
