import { afterEach, expect, test, vi } from 'vitest';

import type { ChatMessage } from '@/entities/message/model';

import { fetchChatHistory } from './fetch-chat-history';

const CHAT_ID = '79161234567@c.us';

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
  vi.unstubAllGlobals();
});

function stubFetch(implementation: typeof fetch) {
  const fetchMock = vi.fn(implementation);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

test('requests the history of the chat from the route handler', async () => {
  const fetchMock = stubFetch(() => Promise.resolve(Response.json({ data: [MESSAGE], ok: true })));

  const history = await fetchChatHistory('whatsapp', CHAT_ID, new AbortController().signal);

  expect(history).toEqual({ data: [MESSAGE], ok: true });
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/whatsapp/chats/79161234567%40c.us/history',
    expect.objectContaining({ cache: 'no-store' }),
  );
});

test('passes the failure reported by the route handler through', async () => {
  stubFetch(() =>
    Promise.resolve(
      Response.json({ error: { code: 'rateLimited', retryAfter: 30 }, ok: false }, { status: 429 }),
    ),
  );

  const history = await fetchChatHistory('whatsapp', CHAT_ID, new AbortController().signal);

  expect(history).toEqual({ error: { code: 'rateLimited', retryAfter: 30 }, ok: false });
});

test('rejects a body of an unexpected shape', async () => {
  stubFetch(() => Promise.resolve(Response.json({ data: [{ text: 'Привет' }], ok: true })));

  const history = await fetchChatHistory('whatsapp', CHAT_ID, new AbortController().signal);

  expect(history).toEqual({ error: { code: 'invalidResponse' }, ok: false });
});

test('rejects a body that is not JSON', async () => {
  stubFetch(() => Promise.resolve(new Response('<html></html>', { status: 502 })));

  const history = await fetchChatHistory('whatsapp', CHAT_ID, new AbortController().signal);

  expect(history).toEqual({ error: { code: 'invalidResponse' }, ok: false });
});

test('reports a network failure', async () => {
  stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));

  const history = await fetchChatHistory('whatsapp', CHAT_ID, new AbortController().signal);

  expect(history).toEqual({ error: { code: 'network' }, ok: false });
});

test('reports a request that timed out', async () => {
  stubFetch(() => Promise.reject(new DOMException('The operation timed out', 'TimeoutError')));

  const history = await fetchChatHistory('whatsapp', CHAT_ID, new AbortController().signal);

  expect(history).toEqual({ error: { code: 'timeout' }, ok: false });
});

test('rejects when the caller aborts the request', async () => {
  const controller = new AbortController();
  stubFetch(
    (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      }),
  );

  const history = fetchChatHistory('whatsapp', CHAT_ID, controller.signal);
  controller.abort();

  await expect(history).rejects.toMatchObject({ name: 'AbortError' });
});
