import { sealData } from 'iron-session';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { TEST_API_TOKEN_INSTANCE, TEST_ID_INSTANCE } from '@/server/green-api/test-server';

interface CookieWrite {
  name: string;
  options: Record<string, unknown>;
  value: string;
}

const MOCK_ORIGIN = 'http://127.0.0.1:3100';
const REAL_ORIGIN = 'https://1101.api.green-api.com';

function createCookieStore() {
  const values = new Map<string, string>();
  const writes: CookieWrite[] = [];

  return {
    values,
    writes,
    get(name: string) {
      const value = values.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set(name: string, value: string, options: Record<string, unknown>) {
      writes.push({ name, options, value });
      if (value === '') {
        values.delete(name);
      } else {
        values.set(name, value);
      }
    },
  };
}

async function importSession() {
  const { deleteSession, peekSession, readSession, saveSession } = await import('./session');
  const { apiTokenInstanceSchema, idInstanceSchema } =
    await import('@/server/green-api/credentials');
  const { createApiUrlSchema } = await import('@/server/green-api/api-url');
  const apiUrlSchema = createApiUrlSchema({ isRealModeEnabled: true, mockUrl: MOCK_ORIGIN });

  function createSessionInput(mode: 'demo' | 'real', origin: string) {
    return {
      credentials: {
        apiTokenInstance: apiTokenInstanceSchema.parse(TEST_API_TOKEN_INSTANCE),
        apiUrl: apiUrlSchema.parse(origin),
        idInstance: idInstanceSchema.parse(TEST_ID_INSTANCE),
      },
      messengerId: 'whatsapp' as const,
      mode,
    };
  }

  return { createSessionInput, deleteSession, peekSession, readSession, saveSession };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test('reads back a saved session', async () => {
  const { createSessionInput, readSession, saveSession } = await importSession();
  const cookies = createCookieStore();

  const saved = await saveSession(cookies, createSessionInput('demo', MOCK_ORIGIN));

  expect(saved.sessionId).toMatch(/^[0-9a-f-]{36}$/);
  await expect(readSession(cookies, 'whatsapp')).resolves.toEqual({ data: saved, ok: true });
});

test('gives every login a new session id', async () => {
  const { createSessionInput, saveSession } = await importSession();
  const input = createSessionInput('demo', MOCK_ORIGIN);

  const first = await saveSession(createCookieStore(), input);
  const second = await saveSession(createCookieStore(), input);

  expect(first.sessionId).not.toBe(second.sessionId);
});

test('writes a sealed strict cookie per messenger', async () => {
  const { createSessionInput, saveSession } = await importSession();
  const cookies = createCookieStore();

  await saveSession(cookies, createSessionInput('demo', MOCK_ORIGIN));

  const [write] = cookies.writes;
  expect(write?.name).toBe('tm_whatsapp');
  expect(write?.value).not.toContain(TEST_API_TOKEN_INSTANCE);
  expect(write?.value).not.toContain(TEST_ID_INSTANCE);
  expect(write?.options).toMatchObject({
    httpOnly: true,
    maxAge: 86_340,
    path: '/',
    sameSite: 'strict',
    secure: true,
  });
});

test('scopes the cookie to the base path', async () => {
  vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/text-messenger');
  const { createSessionInput, saveSession } = await importSession();
  const cookies = createCookieStore();

  await saveSession(cookies, createSessionInput('demo', MOCK_ORIGIN));

  expect(cookies.writes[0]?.options).toMatchObject({ path: '/text-messenger' });
});

test('has no session without a cookie', async () => {
  const { readSession } = await importSession();

  await expect(readSession(createCookieStore(), 'max')).resolves.toEqual({
    error: { code: 'unauthorized' },
    ok: false,
  });
});

test('does not accept a cookie of another messenger', async () => {
  const { createSessionInput, readSession, saveSession } = await importSession();
  const cookies = createCookieStore();
  await saveSession(cookies, createSessionInput('demo', MOCK_ORIGIN));
  cookies.values.set('tm_max', cookies.values.get('tm_whatsapp') ?? '');

  await expect(readSession(cookies, 'max')).resolves.toEqual({
    error: { code: 'unauthorized' },
    ok: false,
  });
  expect(cookies.values.has('tm_max')).toBe(false);
});

test('drops a cookie sealed with another secret', async () => {
  const { createSessionInput, saveSession } = await importSession();
  const cookies = createCookieStore();
  await saveSession(cookies, createSessionInput('demo', MOCK_ORIGIN));
  vi.resetModules();
  vi.stubEnv('SESSION_SECRET', 'another-session-secret-with-32-characters');
  const { readSession } = await importSession();

  await expect(readSession(cookies, 'whatsapp')).resolves.toEqual({
    error: { code: 'unauthorized' },
    ok: false,
  });
  expect(cookies.values.has('tm_whatsapp')).toBe(false);
});

test('drops a tampered cookie', async () => {
  const { readSession } = await importSession();
  const cookies = createCookieStore();
  cookies.values.set('tm_whatsapp', 'Fe26.2*1*tampered~2');

  await expect(readSession(cookies, 'whatsapp')).resolves.toEqual({
    error: { code: 'unauthorized' },
    ok: false,
  });
  expect(cookies.values.has('tm_whatsapp')).toBe(false);
});

test('drops a session whose api url left the allowlist', async () => {
  const { createSessionInput, saveSession } = await importSession();
  const cookies = createCookieStore();
  await saveSession(cookies, createSessionInput('demo', MOCK_ORIGIN));
  vi.resetModules();
  vi.stubEnv('GREEN_API_MOCK_URL', 'http://127.0.0.1:3999');
  const { readSession } = await importSession();

  await expect(readSession(cookies, 'whatsapp')).resolves.toEqual({
    error: { code: 'unauthorized' },
    ok: false,
  });
  expect(cookies.values.has('tm_whatsapp')).toBe(false);
});

test('drops a session whose token is malformed', async () => {
  const { readSession } = await importSession();
  const cookies = createCookieStore();
  const sealed = await sealData(
    {
      apiTokenInstance: 'malformed/token',
      apiUrl: MOCK_ORIGIN,
      idInstance: TEST_ID_INSTANCE,
      messengerId: 'whatsapp',
      mode: 'demo',
      sessionId: crypto.randomUUID(),
    },
    { password: process.env.SESSION_SECRET ?? '' },
  );
  cookies.values.set('tm_whatsapp', sealed);

  await expect(readSession(cookies, 'whatsapp')).resolves.toEqual({
    error: { code: 'unauthorized' },
    ok: false,
  });
  expect(cookies.values.has('tm_whatsapp')).toBe(false);
});

test('peeks a saved session without writing cookies', async () => {
  const { createSessionInput, peekSession, saveSession } = await importSession();
  const cookies = createCookieStore();
  const saved = await saveSession(cookies, createSessionInput('demo', MOCK_ORIGIN));
  const writeCount = cookies.writes.length;

  await expect(peekSession(cookies, 'whatsapp')).resolves.toEqual({ data: saved, ok: true });
  expect(cookies.writes).toHaveLength(writeCount);
});

test('peeks an invalid cookie without dropping it', async () => {
  const { peekSession } = await importSession();
  const cookies = createCookieStore();
  cookies.values.set('tm_whatsapp', 'Fe26.2*1*tampered~2');

  await expect(peekSession(cookies, 'whatsapp')).resolves.toEqual({
    error: { code: 'unauthorized' },
    ok: false,
  });
  expect(cookies.writes).toHaveLength(0);
});

test('reads a real session while real mode is enabled', async () => {
  vi.stubEnv('REAL_MODE_ENABLED', 'true');
  const { createSessionInput, readSession, saveSession } = await importSession();
  const cookies = createCookieStore();

  const saved = await saveSession(cookies, createSessionInput('real', REAL_ORIGIN));

  await expect(readSession(cookies, 'whatsapp')).resolves.toEqual({ data: saved, ok: true });
});

test('ends a real session once real mode is disabled', async () => {
  vi.stubEnv('REAL_MODE_ENABLED', 'true');
  const { createSessionInput, saveSession } = await importSession();
  const cookies = createCookieStore();
  await saveSession(cookies, createSessionInput('real', REAL_ORIGIN));
  vi.resetModules();
  vi.stubEnv('REAL_MODE_ENABLED', 'false');
  const { readSession } = await importSession();

  await expect(readSession(cookies, 'whatsapp')).resolves.toEqual({
    error: { code: 'realModeDisabled' },
    ok: false,
  });
  expect(cookies.values.has('tm_whatsapp')).toBe(false);
});

test('deletes the session cookie', async () => {
  const { createSessionInput, deleteSession, readSession, saveSession } = await importSession();
  const cookies = createCookieStore();
  await saveSession(cookies, createSessionInput('demo', MOCK_ORIGIN));

  await deleteSession(cookies, 'whatsapp');

  expect(cookies.values.has('tm_whatsapp')).toBe(false);
  expect(cookies.writes.at(-1)?.options).toMatchObject({ maxAge: 0, path: '/' });
  await expect(readSession(cookies, 'whatsapp')).resolves.toMatchObject({ ok: false });
});
