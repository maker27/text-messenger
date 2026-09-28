import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { createMessengerStore } from '@/entities/message/messenger-store';
import { sendMessage } from '@/features/send-message/actions';
import { MessengerStoreContext } from '@/features/messenger-session/messenger-session-provider';
import { MemoryStorage } from '@/shared/testing/memory-storage';

import { ChatConversation } from './chat-conversation';

vi.mock('@/features/send-message/actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/send-message/actions')>()),
  sendMessage: vi.fn(),
}));

const CHAT_ID = '79161234567';

afterEach(() => {
  vi.restoreAllMocks();
});

function renderConversation() {
  const store = createMessengerStore({
    idInstance: '3100000000000001',
    messengerId: 'max',
    storage: new MemoryStorage(),
  });

  render(
    <MessengerStoreContext value={store}>
      <ChatConversation chatId={CHAT_ID} messengerId="max" />
    </MessengerStoreContext>,
  );
}

test('lists a sent message and lets the user retry it after a failure', async () => {
  vi.mocked(sendMessage)
    .mockResolvedValueOnce({ error: { code: 'network' }, ok: false })
    .mockResolvedValueOnce({ data: { idMessage: 'BAE5F4886AD8A3A9' }, ok: true });
  renderConversation();
  const user = userEvent.setup();

  await user.type(screen.getByLabelText('Сообщение'), 'Привет{Enter}');
  const message = within(screen.getByRole('list')).getByRole('listitem');
  expect(message).toHaveTextContent('Привет');
  expect(await within(message).findByRole('img', { name: 'Не отправлено' })).toBeInTheDocument();

  await user.click(within(message).getByRole('button', { name: 'Повторить' }));

  expect(await screen.findByRole('img', { name: 'Отправлено' })).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
});

test('blocks retrying a failed message while offline', async () => {
  vi.mocked(sendMessage).mockResolvedValue({ error: { code: 'network' }, ok: false });
  renderConversation();
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Сообщение'), 'Привет{Enter}');
  const retryButton = await screen.findByRole('button', { name: 'Повторить' });

  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  act(() => {
    window.dispatchEvent(new Event('offline'));
  });
  await user.click(retryButton);

  expect(retryButton).toBeDisabled();
  expect(sendMessage).toHaveBeenCalledOnce();
});
