import { ResponseCookies } from 'next/dist/server/web/spec-extension/cookies';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';

import { MESSENGERS } from '@/entities/messenger/config';
import { startMockProcess } from '@/server/green-api/mock-process';
import { startTestServer, unwrapResult } from '@/server/green-api/test-server';

const CHAT_ID = '79161234567';
const MESSAGE_TEXT = '  Привет  ';

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

async function importSendMessage() {
  const { sendMessage } = await import('./actions');
  return sendMessage;
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

test('sends the message with its spaces intact', async () => {
  await signInToDemo();
  const sendMessage = await importSendMessage();

  const result = await sendMessage('max', CHAT_ID, MESSAGE_TEXT);

  const { idMessage } = unwrapResult(result);
  const { loadChatHistory } = await import('@/features/chat-history/server');
  const history = await loadChatHistory('max', CHAT_ID);
  expect(history.ok && history.data).toContainEqual(
    expect.objectContaining({ idMessage, text: MESSAGE_TEXT }),
  );
});

test.each([
  ['a blank text', CHAT_ID, '   '],
  ['a text over the limit', CHAT_ID, 'а'.repeat(MESSENGERS.max.maxMessageLength + 1)],
  [
    'a text over the limit in UTF-16 code units',
    CHAT_ID,
    `${'а'.repeat(MESSENGERS.max.maxMessageLength - 1)}😀`,
  ],
  ['a non-string text', CHAT_ID, null],
  ['an invalid chat id', 'abc', MESSAGE_TEXT],
  ['a percent-encoded chat id', '%', MESSAGE_TEXT],
])('rejects %s without a request', async (_case, chatId, text) => {
  const server = await startTestServer();
  vi.stubEnv('GREEN_API_MOCK_URL', server.origin);

  try {
    await signInToDemo();
    const sendMessage = await importSendMessage();
    const requestCount = server.requests.length;

    expect(await sendMessage('max', chatId, text)).toEqual({
      error: { code: 'invalidInput' },
      ok: false,
    });
    expect(server.requests).toHaveLength(requestCount);
  } finally {
    await server.close();
  }
});

test('accepts a text of exactly the limit', async () => {
  await signInToDemo();
  const sendMessage = await importSendMessage();

  const result = await sendMessage('max', CHAT_ID, 'а'.repeat(MESSENGERS.max.maxMessageLength));

  expect(result.ok).toBe(true);
});

test('rejects an unknown messenger', async () => {
  const sendMessage = await importSendMessage();

  expect(await sendMessage('icq', CHAT_ID, MESSAGE_TEXT)).toEqual({
    error: { code: 'invalidInput' },
    ok: false,
  });
});

test('refuses to send without a session', async () => {
  const sendMessage = await importSendMessage();

  expect(await sendMessage('max', CHAT_ID, MESSAGE_TEXT)).toEqual({
    error: { code: 'unauthorized' },
    ok: false,
  });
});
