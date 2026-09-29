import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { createMessengerStore } from '@/entities/message/messenger-store';
import type { ChatMessage } from '@/entities/message/model';
import { fetchChatHistory } from '@/features/chat-history/fetch-chat-history';
import { MessengerStoreContext } from '@/features/messenger-session/messenger-session-provider';
import { MemoryStorage } from '@/shared/testing/memory-storage';

import { ChatHistory } from './chat-history';

vi.mock('@/features/chat-history/fetch-chat-history', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/chat-history/fetch-chat-history')>()),
  fetchChatHistory: vi.fn(),
}));

const CHAT_ID = '79161234567';

const MESSAGE: ChatMessage = {
  chatId: CHAT_ID,
  direction: 'incoming',
  idMessage: 'BAE5F4886AD1A60A',
  senderName: 'Иван',
  sentAt: 1_700_000_000_000,
  status: null,
  text: 'Привет',
};

afterEach(() => {
  vi.resetAllMocks();
});

function renderHistory(history: ChatMessage[] | null = null) {
  const store = createMessengerStore({
    idInstance: '3100000000000001',
    messengerId: 'max',
    storage: new MemoryStorage(),
  });

  if (history !== null) {
    store.getState().hydrateHistory(CHAT_ID, history);
  }

  const view = render(
    <MessengerStoreContext value={store}>
      <ChatHistory chatId={CHAT_ID} messengerId="max" />
    </MessengerStoreContext>,
  );

  return { store, unmount: view.unmount };
}

test('shows a skeleton until the history is loaded', async () => {
  vi.mocked(fetchChatHistory).mockResolvedValue({ data: [MESSAGE], ok: true });
  renderHistory();

  expect(screen.getByRole('status')).toHaveTextContent('Загрузка сообщений');
  expect(await screen.findByText('Привет')).toBeInTheDocument();
  expect(fetchChatHistory).toHaveBeenCalledExactlyOnceWith('max', CHAT_ID, expect.any(AbortSignal));
});

test('reuses a history that is already loaded', () => {
  renderHistory([MESSAGE]);

  expect(screen.getByText('Привет')).toBeInTheDocument();
  expect(fetchChatHistory).not.toHaveBeenCalled();
});

test('lets the user retry a failed load', async () => {
  vi.mocked(fetchChatHistory)
    .mockResolvedValueOnce({ error: { code: 'network' }, ok: false })
    .mockResolvedValueOnce({ data: [MESSAGE], ok: true });
  renderHistory();
  const user = userEvent.setup();

  await user.click(await screen.findByRole('button', { name: 'Повторить' }));

  expect(await screen.findByText('Привет')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(fetchChatHistory).toHaveBeenCalledTimes(2);
});

test('refreshes an invalidated history without hiding the conversation', async () => {
  vi.mocked(fetchChatHistory)
    .mockResolvedValueOnce({ data: [MESSAGE], ok: true })
    .mockReturnValueOnce(new Promise(() => undefined));
  const { store } = renderHistory();
  await screen.findByText('Привет');

  act(() => {
    store.getState().invalidateHistory();
  });

  expect(screen.getByText('Привет')).toBeInTheDocument();
  expect(fetchChatHistory).toHaveBeenCalledTimes(2);
});

test('aborts the request when the chat is closed', () => {
  vi.mocked(fetchChatHistory).mockReturnValue(new Promise(() => undefined));
  const { unmount } = renderHistory();

  unmount();

  expect(vi.mocked(fetchChatHistory).mock.lastCall?.[2].aborted).toBe(true);
});

test('does not load the history once the store is cleared on logout', async () => {
  vi.mocked(fetchChatHistory).mockResolvedValue({ data: [MESSAGE], ok: true });
  const { store } = renderHistory();
  await screen.findByText('Привет');

  act(() => {
    store.getState().clear();
  });

  expect(fetchChatHistory).toHaveBeenCalledOnce();
});

test('keeps the conversation when refreshing an invalidated history fails', async () => {
  vi.mocked(fetchChatHistory)
    .mockResolvedValueOnce({ data: [MESSAGE], ok: true })
    .mockResolvedValueOnce({ error: { code: 'network' }, ok: false })
    .mockResolvedValueOnce({ data: [MESSAGE], ok: true });
  const { store } = renderHistory();
  await screen.findByText('Привет');
  const user = userEvent.setup();

  act(() => {
    store.getState().invalidateHistory();
  });

  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.getByText('Привет')).toBeInTheDocument();
  expect(screen.getByLabelText('Сообщение')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Повторить' }));

  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(fetchChatHistory).toHaveBeenCalledTimes(3);
});
