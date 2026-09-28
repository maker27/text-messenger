import { ResponseCookies } from 'next/dist/server/web/spec-extension/cookies';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';

import { MESSENGERS } from '@/entities/messenger/config';
import { startMockProcess } from '@/server/green-api/mock-process';
import { startTestServer } from '@/server/green-api/test-server';

const CHAT_ID = '79161234567';
const MESSAGE_TEXT = 'Привет';
const TOO_MANY_REQUESTS = 429;
const RETRY_AFTER_SECONDS = 30;

let cookieStore: ResponseCookies;
let mock: Awaited<ReturnType<typeof startMockProcess>>;

vi.mock('next/headers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  cookies: () => Promise.resolve(cookieStore),
  headers: () => Promise.resolve(new Headers()),
}));

async function signInToDemo() {
  const { login } = await import('@/features/login/actions');
  const formData = new FormData();
  formData.set('mode', 'demo');
  await login('max', null, formData);
}

async function importLoadChatHistory() {
  const { loadChatHistory } = await import('./server');
  return loadChatHistory;
}

beforeAll(async () => {
  mock = await startMockProcess();
});

afterAll(async () => {
  await mock.stop();
});

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('GREEN_API_MOCK_URL', mock.origin);
  cookieStore = new ResponseCookies(new Headers());
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test('loads the chat history of the session instance', async () => {
  await signInToDemo();
  const { readSession } = await import('@/server/session/session');
  const { createGreenApiClient } = await import('@/server/green-api/client');
  const session = await readSession(cookieStore, 'max');
  if (!session.ok) {
    throw new Error('Expected a demo session');
  }
  await createGreenApiClient(MESSENGERS.max, session.data.credentials).sendMessage(
    CHAT_ID,
    MESSAGE_TEXT,
  );
  const loadChatHistory = await importLoadChatHistory();

  const history = await loadChatHistory('max', CHAT_ID);

  expect(history.ok && history.data).toContainEqual(
    expect.objectContaining({ chatId: CHAT_ID, direction: 'outgoing', text: MESSAGE_TEXT }),
  );
});

test('refuses to load the history without a session', async () => {
  const loadChatHistory = await importLoadChatHistory();

  expect(await loadChatHistory('max', CHAT_ID)).toEqual({
    error: { code: 'unauthorized' },
    ok: false,
  });
});

test('reports a rate limited history request', async () => {
  const server = await startTestServer();
  vi.stubEnv('GREEN_API_MOCK_URL', server.origin);
  server.setReply({
    body: '{}',
    headers: { 'Retry-After': String(RETRY_AFTER_SECONDS) },
    status: TOO_MANY_REQUESTS,
  });

  try {
    await signInToDemo();
    const loadChatHistory = await importLoadChatHistory();

    expect(await loadChatHistory('max', CHAT_ID)).toEqual({
      error: { code: 'rateLimited', retryAfter: RETRY_AFTER_SECONDS },
      ok: false,
    });
  } finally {
    await server.close();
  }
});
