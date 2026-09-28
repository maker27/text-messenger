import { act, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import type { Chat } from '@/entities/chat/model';
import { createMessengerStore } from '@/entities/message/messenger-store';
import { MessengerStoreContext } from '@/features/messenger-session/messenger-session-provider';
import { MemoryStorage } from '@/shared/testing/memory-storage';

import { ChatList } from './chat-list';

const FIRST_CHAT: Chat = {
  chatId: '79161234567@c.us',
  lastMessageAt: null,
  title: '+7 916 123 45 67',
};
const SECOND_CHAT: Chat = {
  chatId: '79167654321@c.us',
  lastMessageAt: null,
  title: '+7 916 765 43 21',
};

function renderList(chats: Chat[]) {
  const store = createMessengerStore({
    idInstance: '1101000000000001',
    messengerId: 'whatsapp',
    storage: new MemoryStorage(),
  });
  for (const chat of chats.toReversed()) {
    store.getState().addChat(chat);
  }

  render(
    <MessengerStoreContext value={store}>
      <ChatList messengerId="whatsapp" />
    </MessengerStoreContext>,
  );

  return store;
}

test('suggests creating a chat when there are none', () => {
  renderList([]);

  expect(screen.getByText('Создайте чат по номеру телефона')).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

test('links every chat to its path', () => {
  renderList([FIRST_CHAT, SECOND_CHAT]);

  const navigation = screen.getByRole('navigation', { name: 'Чаты' });
  expect(navigation).toBeInTheDocument();
  expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
    '/whatsapp/79161234567%40c.us',
    '/whatsapp/79167654321%40c.us',
  ]);
});

test('marks the active chat as the current page', () => {
  const store = renderList([FIRST_CHAT, SECOND_CHAT]);

  act(() => {
    store.getState().setActiveChat(SECOND_CHAT.chatId);
  });

  expect(screen.getByRole('link', { name: SECOND_CHAT.title })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(screen.getByRole('link', { name: FIRST_CHAT.title })).not.toHaveAttribute('aria-current');
});

test('shows the unread count of a chat', () => {
  const store = renderList([FIRST_CHAT]);

  act(() => {
    store.setState({ unreadByChat: new Map([[FIRST_CHAT.chatId, 3]]) });
  });

  expect(screen.getByRole('link')).toHaveAccessibleName(`${FIRST_CHAT.title}, 3 непрочитанных`);
});

test('keeps the full title of a truncated chat name', () => {
  const longTitle = 'Очень длинное название чата, которое не помещается в список';
  renderList([{ ...FIRST_CHAT, title: longTitle }]);

  const title = screen.getByText(longTitle);
  expect(title).toHaveAttribute('title', longTitle);
  expect(title).toHaveClass('truncate');
});

test('shows an avatar for every chat', () => {
  renderList([FIRST_CHAT, SECOND_CHAT]);

  const link = screen.getByRole('link', { name: FIRST_CHAT.title });
  expect(link.querySelector(`[title="${FIRST_CHAT.title}"]`)).toBeInTheDocument();
});
