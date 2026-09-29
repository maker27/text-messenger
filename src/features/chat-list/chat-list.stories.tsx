import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { withMessengerStore } from '@/features/messenger-session/with-messenger-store';
import { MemoryStorage } from '@/shared/testing/memory-storage';

import { ChatList } from './chat-list';

const SENT_AT = Date.UTC(2026, 8, 28, 9, 30);
const LONG_TITLE = 'Очень длинное название чата, которое не помещается в одну строку списка';

const CHATS = [
  { chatId: '79161234567', lastMessageAt: SENT_AT, title: '+7 916 123-45-67' },
  { chatId: '79031234567', lastMessageAt: null, title: '+7 903 123-45-67' },
  { chatId: '375291234567', lastMessageAt: null, title: LONG_TITLE },
];

class UnwritableStorage extends MemoryStorage {
  override setItem() {
    throw new DOMException('Storage is full', 'QuotaExceededError');
  }
}

const meta = {
  args: { messengerId: 'max' },
  component: ChatList,
} satisfies Meta<typeof ChatList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Chats: Story = {
  decorators: [
    withMessengerStore((store) => {
      const { addChat, receiveMessage, setActiveChat } = store.getState();
      CHATS.toReversed().forEach(addChat);
      setActiveChat('79031234567');
      receiveMessage({
        chatId: '79161234567',
        direction: 'incoming',
        idMessage: 'incoming',
        senderName: null,
        sentAt: SENT_AT,
        status: null,
        text: 'Привет',
      });
    }),
  ],
};

export const Empty: Story = {
  decorators: [withMessengerStore(() => undefined)],
};

export const StorageError: Story = {
  decorators: [withMessengerStore(() => undefined, new UnwritableStorage())],
};
