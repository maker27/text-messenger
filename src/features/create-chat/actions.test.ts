import { ResponseCookies } from 'next/dist/server/web/spec-extension/cookies';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';

import type { MessengerId } from '@/entities/messenger/model';
import { startMockProcess } from '@/server/green-api/mock-process';

let cookieStore: ResponseCookies;
let mock: Awaited<ReturnType<typeof startMockProcess>>;

vi.mock('next/headers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  cookies: () => Promise.resolve(cookieStore),
  headers: () => Promise.resolve(new Headers()),
}));

function createPhoneForm(phone: string | Blob) {
  const formData = new FormData();
  formData.set('phone', phone);
  return formData;
}

async function signInToDemo(messengerId: MessengerId) {
  const { login } = await import('@/features/login/actions');
  const formData = new FormData();
  formData.set('mode', 'demo');
  await login(messengerId, null, formData);
}

async function importCreateChat() {
  const { createChat } = await import('./actions');
  return createChat;
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

test('creates a chat with the resolved chat id', async () => {
  await signInToDemo('max');
  const createChat = await importCreateChat();

  expect(await createChat('max', null, createPhoneForm('+7 916 123-45-67'))).toEqual({
    data: { chatId: '79161234567', lastMessageAt: null, title: '+7 916 123 45 67' },
    ok: true,
  });
});

test('uses the chat id format of the messenger', async () => {
  await signInToDemo('whatsapp');
  const createChat = await importCreateChat();

  expect(await createChat('whatsapp', null, createPhoneForm('+7 916 123-45-67'))).toMatchObject({
    data: { chatId: '79161234567@c.us' },
    ok: true,
  });
});

test('rejects a number of a country the messenger does not serve', async () => {
  await signInToDemo('max');
  const createChat = await importCreateChat();

  expect(await createChat('max', null, createPhoneForm('+1 650 253 0001'))).toEqual({
    error: { code: 'phoneNumber', reason: 'countryNotAllowed' },
    ok: false,
  });
});

test('rejects a value that is not a phone number', async () => {
  await signInToDemo('telegram');
  const createChat = await importCreateChat();

  expect(await createChat('telegram', null, createPhoneForm('abc'))).toEqual({
    error: { code: 'phoneNumber', reason: 'invalid' },
    ok: false,
  });
});

test('reports a number without an account', async () => {
  await signInToDemo('max');
  const createChat = await importCreateChat();

  expect(await createChat('max', null, createPhoneForm('+7 916 000-00-00'))).toEqual({
    error: { code: 'accountNotFound' },
    ok: false,
  });
});

test('requires a session', async () => {
  const createChat = await importCreateChat();

  expect(await createChat('max', null, createPhoneForm('+7 916 123-45-67'))).toEqual({
    error: { code: 'unauthorized' },
    ok: false,
  });
});

test.each([
  ['an unknown messenger', 'viber', createPhoneForm('+7 916 123-45-67')],
  ['a phone that is not text', 'max', createPhoneForm(new Blob(['79161234567']))],
  ['a missing phone', 'max', new FormData()],
  ['a payload that is not a form', 'max', null],
])('rejects %s', async (_case, messengerId, formData) => {
  await signInToDemo('max');
  const createChat = await importCreateChat();

  expect(await createChat(messengerId, null, formData)).toEqual({
    error: { code: 'invalidInput' },
    ok: false,
  });
});
