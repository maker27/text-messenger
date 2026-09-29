import { ResponseCookies } from 'next/dist/server/web/spec-extension/cookies';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { createTestCredentials, startTestServer } from '@/server/green-api/test-server';

const CHAT_ID = '79161234567@c.us';
const ENCODED_CHAT_ID = encodeURIComponent(CHAT_ID);
const RETRY_AFTER_SECONDS = 30;
const HISTORY_ENTRY = {
  idMessage: 'IN1',
  senderName: 'Анна',
  textMessage: 'Привет',
  timestamp: 1_700_000_000,
  type: 'incoming',
  typeMessage: 'textMessage',
};

let cookieStore: ResponseCookies;
let server: Awaited<ReturnType<typeof startTestServer>>;
let modules: Awaited<ReturnType<typeof importModules>>;

vi.mock('next/headers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  cookies: () => Promise.resolve(cookieStore),
}));

async function importModules() {
  const { GET } = await import('./route');
  const { saveSession } = await import('@/server/session/session');
  return { GET, saveSession };
}

function requestHistory(
  messenger: string,
  chatId: string,
  signal: AbortSignal = new AbortController().signal,
) {
  return modules.GET(
    new Request(`http://localhost/api/${messenger}/chats/${chatId}/history`, { signal }),
    { params: Promise.resolve({ chatId, messenger }) },
  );
}

function signIn() {
  return modules.saveSession(cookieStore, {
    credentials: createTestCredentials(server.origin),
    messengerId: 'whatsapp',
    mode: 'demo',
  });
}

beforeEach(async () => {
  cookieStore = new ResponseCookies(new Headers());
  server = await startTestServer();
  vi.resetModules();
  vi.stubEnv('GREEN_API_MOCK_URL', server.origin);
  modules = await importModules();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await server.close();
});

test('rejects an unknown messenger', async () => {
  const response = await requestHistory('icq', ENCODED_CHAT_ID);

  expect(response.status).toBe(404);
});

test('rejects a chat id of another messenger', async () => {
  await signIn();

  const response = await requestHistory('whatsapp', '-100123');

  expect(response.status).toBe(404);
  expect(server.requests).toHaveLength(0);
});

test('rejects a request without a session', async () => {
  const response = await requestHistory('whatsapp', ENCODED_CHAT_ID);

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ ok: false, error: { code: 'unauthorized' } });
});

test('returns the chat history of the session instance', async () => {
  await signIn();
  server.setReply({ body: JSON.stringify([HISTORY_ENTRY]), status: 200 });

  const response = await requestHistory('whatsapp', ENCODED_CHAT_ID);

  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({
    ok: true,
    data: [
      {
        chatId: CHAT_ID,
        direction: 'incoming',
        idMessage: 'IN1',
        senderName: 'Анна',
        sentAt: 1_700_000_000_000,
        status: null,
        text: 'Привет',
      },
    ],
  });
});

test('reports a rate limited history request', async () => {
  await signIn();
  server.setReply({
    body: '{}',
    headers: { 'Retry-After': String(RETRY_AFTER_SECONDS) },
    status: 429,
  });

  const response = await requestHistory('whatsapp', ENCODED_CHAT_ID);

  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({
    ok: false,
    error: { code: 'rateLimited', retryAfter: RETRY_AFTER_SECONDS },
  });
});

test('reports a failed upstream request as a bad gateway', async () => {
  await signIn();
  server.setReply({ body: '{}', status: 500 });

  const response = await requestHistory('whatsapp', ENCODED_CHAT_ID);

  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ ok: false, error: { code: 'upstream' } });
});

test('does not call GREEN-API for a request aborted while it waits for its slot', async () => {
  await signIn();
  server.setReply({ body: '[]', status: 200 });
  const controller = new AbortController();

  await requestHistory('whatsapp', ENCODED_CHAT_ID);
  const waitingResponse = requestHistory('whatsapp', ENCODED_CHAT_ID, controller.signal);
  controller.abort();

  expect((await waitingResponse).status).toBe(499);
  expect(server.requests).toHaveLength(1);
});
