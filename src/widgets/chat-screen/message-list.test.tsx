import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { createMessengerStore } from '@/entities/message/messenger-store';
import type { ChatMessage } from '@/entities/message/model';
import { MessengerStoreContext } from '@/features/messenger-session/messenger-session-provider';
import { MemoryStorage } from '@/shared/testing/memory-storage';

import { MessageList } from './message-list';

const CHAT_ID = '79161234567';
const SENT_AT = Date.UTC(2026, 8, 28, 9, 30);
const MINUTE = 60_000;

function createMessage(message: Partial<ChatMessage> & Pick<ChatMessage, 'idMessage'>) {
  return {
    chatId: CHAT_ID,
    direction: 'outgoing',
    senderName: null,
    sentAt: SENT_AT,
    status: null,
    text: 'Привет',
    ...message,
  } satisfies ChatMessage;
}

function renderList(messages: ChatMessage[], onMessageRetry = vi.fn()) {
  const store = createMessengerStore({
    idInstance: '1101000000000001',
    messengerId: 'max',
    storage: new MemoryStorage(),
  });
  store.getState().hydrateHistory(CHAT_ID, messages);

  render(
    <MessengerStoreContext value={store}>
      <MessageList chatId={CHAT_ID} onMessageRetry={onMessageRetry} />
    </MessengerStoreContext>,
  );

  return store;
}

test('says the chat has no messages yet', () => {
  renderList([]);

  expect(screen.getByText('Сообщений пока нет')).toBeInTheDocument();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

test('renders markup in a message as text', () => {
  const markup = '<img src=x onerror=alert(1)>';
  renderList([createMessage({ idMessage: 'first', text: markup })]);

  expect(screen.getByText(markup)).toBeInTheDocument();
  expect(document.querySelector('img')).toBeNull();
});

test.each([
  ['pending', 'Отправляется'],
  ['sent', 'Отправлено'],
  ['delivered', 'Доставлено'],
  ['read', 'Прочитано'],
  ['failed', 'Не отправлено'],
] as const)('labels the %s status', (status, label) => {
  renderList([createMessage({ idMessage: 'first', status })]);

  expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
});

test('orders messages by the time they were sent', () => {
  renderList([
    createMessage({ idMessage: 'later', sentAt: SENT_AT + MINUTE, text: 'Второе' }),
    createMessage({ direction: 'incoming', idMessage: 'earlier', text: 'Первое' }),
  ]);

  const items = within(screen.getByRole('list')).getAllByRole('listitem');
  expect(items.map((item) => item.textContent)).toEqual([
    expect.stringContaining('Первое'),
    expect.stringContaining('Второе'),
  ]);
});

test('announces the first message of an empty chat politely', () => {
  const store = renderList([]);
  const liveRegion = screen.getByText('Сообщений пока нет').closest('[aria-live="polite"]');

  act(() => {
    store.getState().receiveMessage(createMessage({ direction: 'incoming', idMessage: 'first' }));
  });

  expect(liveRegion).not.toBeNull();
  expect(liveRegion).toHaveTextContent('Привет');
});

test('offers to retry a failed message', async () => {
  const onMessageRetry = vi.fn();
  renderList([createMessage({ idMessage: 'local:1', status: 'failed' })], onMessageRetry);

  await userEvent.setup().click(screen.getByRole('button', { name: 'Повторить' }));

  expect(onMessageRetry).toHaveBeenCalledExactlyOnceWith('local:1');
});

test.each(['pending', 'sent'] as const)('offers no retry for a %s message', (status) => {
  renderList([createMessage({ idMessage: 'first', status })]);

  expect(screen.queryByRole('button', { name: 'Повторить' })).not.toBeInTheDocument();
});

test('marks direction and group position on grouped messages', () => {
  renderList([
    createMessage({ idMessage: 'first', sentAt: SENT_AT }),
    createMessage({ idMessage: 'second', sentAt: SENT_AT + MINUTE }),
    createMessage({ direction: 'incoming', idMessage: 'third', sentAt: SENT_AT + 2 * MINUTE }),
  ]);

  const bubbles = document.querySelectorAll('[data-direction]');
  expect(
    Array.from(bubbles).map((bubble) => ({
      direction: bubble.getAttribute('data-direction'),
      groupPosition: bubble.getAttribute('data-group-position'),
    })),
  ).toEqual([
    { direction: 'outgoing', groupPosition: 'first' },
    { direction: 'outgoing', groupPosition: 'last' },
    { direction: 'incoming', groupPosition: 'single' },
  ]);
});
