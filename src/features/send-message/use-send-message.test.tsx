import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { createMessengerStore, selectChatMessages } from '@/entities/message/messenger-store';
import type { ChatMessage } from '@/entities/message/model';
import { MessengerStoreContext } from '@/features/messenger-session/messenger-session-provider';
import type { Result } from '@/shared/errors/result';
import { MemoryStorage } from '@/shared/testing/memory-storage';

import { sendMessage, type SendMessageError } from './actions';
import { useSendMessage } from './use-send-message';

vi.mock('./actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./actions')>()),
  sendMessage: vi.fn(),
}));

const CHAT_ID = '79161234567';
const ID_MESSAGE = 'BAE5F4886AD8A3A9';
const MESSAGE_TEXT = 'Привет';

type SendResult = Result<{ idMessage: string }, SendMessageError>;

function createDeferredResult() {
  let resolveResult: (result: SendResult) => void = () => undefined;
  const promise = new Promise<SendResult>((resolve) => {
    resolveResult = resolve;
  });
  return { promise, resolveResult };
}

function getSingleMessage(messages: ChatMessage[]) {
  const [message] = messages;
  if (messages.length !== 1 || message === undefined) {
    throw new Error(`Expected a single message, got ${String(messages.length)}`);
  }
  return message;
}

function renderSendMessage() {
  const store = createMessengerStore({
    idInstance: '3100000000000001',
    messengerId: 'max',
    storage: new MemoryStorage(),
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <MessengerStoreContext value={store}>{children}</MessengerStoreContext>;
  }

  const { result } = renderHook(() => useSendMessage('max', CHAT_ID), { wrapper: Wrapper });

  return {
    getMessages: () => selectChatMessages(CHAT_ID)(store.getState()),
    result,
    store,
  };
}

beforeEach(() => {
  vi.mocked(sendMessage).mockReset();
});

test('shows the message as pending right away', () => {
  vi.mocked(sendMessage).mockReturnValue(createDeferredResult().promise);
  const { getMessages, result } = renderSendMessage();

  act(() => {
    result.current.send(MESSAGE_TEXT);
  });

  const pending = getSingleMessage(getMessages());
  expect(pending).toMatchObject({
    chatId: CHAT_ID,
    direction: 'outgoing',
    status: 'pending',
    text: MESSAGE_TEXT,
  });
  expect(pending.idMessage).toMatch(/^local:/);
  expect(sendMessage).toHaveBeenCalledWith('max', CHAT_ID, MESSAGE_TEXT);
});

test('confirms a sent message under its GREEN-API id', async () => {
  vi.mocked(sendMessage).mockResolvedValue({ data: { idMessage: ID_MESSAGE }, ok: true });
  const { getMessages, result } = renderSendMessage();

  act(() => {
    result.current.send(MESSAGE_TEXT);
  });

  await waitFor(() => {
    expect(getMessages()).toEqual([
      expect.objectContaining({ idMessage: ID_MESSAGE, status: 'sent', text: MESSAGE_TEXT }),
    ]);
  });
});

test('merges an echo and a status that arrive before the action result', async () => {
  const deferred = createDeferredResult();
  vi.mocked(sendMessage).mockReturnValue(deferred.promise);
  const { getMessages, result, store } = renderSendMessage();

  act(() => {
    result.current.send(MESSAGE_TEXT);
  });
  const pending = getSingleMessage(getMessages());
  act(() => {
    store.getState().receiveMessage({ ...pending, idMessage: ID_MESSAGE, status: null });
    store.getState().updateStatus(CHAT_ID, ID_MESSAGE, 'delivered');
  });
  await act(async () => {
    deferred.resolveResult({ data: { idMessage: ID_MESSAGE }, ok: true });
    await deferred.promise;
  });

  expect(getMessages()).toEqual([
    expect.objectContaining({ idMessage: ID_MESSAGE, status: 'delivered' }),
  ]);
});

test('marks a rejected message as failed', async () => {
  vi.mocked(sendMessage).mockResolvedValue({ error: { code: 'network' }, ok: false });
  const { getMessages, result } = renderSendMessage();

  act(() => {
    result.current.send(MESSAGE_TEXT);
  });

  await waitFor(() => {
    expect(getMessages()).toEqual([expect.objectContaining({ status: 'failed' })]);
  });
});

test('marks a message as failed when the action cannot be reached', async () => {
  vi.mocked(sendMessage).mockRejectedValue(new TypeError('Failed to fetch'));
  const { getMessages, result } = renderSendMessage();

  act(() => {
    result.current.send(MESSAGE_TEXT);
  });

  await waitFor(() => {
    expect(getMessages()).toEqual([expect.objectContaining({ status: 'failed' })]);
  });
});

test('retries a failed message under the same local id', async () => {
  vi.mocked(sendMessage).mockResolvedValueOnce({ error: { code: 'network' }, ok: false });
  const { getMessages, result } = renderSendMessage();
  act(() => {
    result.current.send(MESSAGE_TEXT);
  });
  await waitFor(() => {
    expect(getMessages()).toEqual([expect.objectContaining({ status: 'failed' })]);
  });
  const failed = getSingleMessage(getMessages());
  const deferred = createDeferredResult();
  vi.mocked(sendMessage).mockReturnValueOnce(deferred.promise);

  act(() => {
    result.current.retry(failed.idMessage);
  });

  expect(getMessages()).toEqual([{ ...failed, status: 'pending' }]);
  await act(async () => {
    deferred.resolveResult({ data: { idMessage: ID_MESSAGE }, ok: true });
    await deferred.promise;
  });
  expect(getMessages()).toEqual([
    expect.objectContaining({ idMessage: ID_MESSAGE, status: 'sent', text: MESSAGE_TEXT }),
  ]);
  expect(sendMessage).toHaveBeenLastCalledWith('max', CHAT_ID, MESSAGE_TEXT);
});

test('ignores a retry of a message that has not failed', async () => {
  vi.mocked(sendMessage).mockResolvedValue({ data: { idMessage: ID_MESSAGE }, ok: true });
  const { getMessages, result } = renderSendMessage();
  act(() => {
    result.current.send(MESSAGE_TEXT);
  });
  await waitFor(() => {
    expect(getMessages()).toEqual([expect.objectContaining({ idMessage: ID_MESSAGE })]);
  });

  act(() => {
    result.current.retry(ID_MESSAGE);
  });

  expect(sendMessage).toHaveBeenCalledTimes(1);
});
