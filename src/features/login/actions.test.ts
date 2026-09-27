import { ResponseCookies } from 'next/dist/server/web/spec-extension/cookies';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';

import { startMockProcess } from '@/server/green-api/mock-process';

const ID_INSTANCE = '1101000001';
const API_TOKEN_INSTANCE = 'mockToken1';
const CLIENT_IP = '203.0.113.1';
const SPOOFED_IP = '198.51.100.99';
const LOGIN_ATTEMPT_LIMIT = 5;

let cookieStore: ResponseCookies;
let headerStore: Headers;
let mock: Awaited<ReturnType<typeof startMockProcess>>;

vi.mock('next/headers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  cookies: () => Promise.resolve(cookieStore),
  headers: () => Promise.resolve(headerStore),
}));

async function importModules() {
  const { login, logout } = await import('./actions');
  const { pollerRegistry } = await import('@/server/notifications/poller-registry');
  const { readSession } = await import('@/server/session/session');

  return { login, logout, pollerRegistry, readSession };
}

function createLoginForm(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    formData.set(name, value);
  }
  return formData;
}

function createRealLoginForm(fields: Record<string, string> = {}) {
  return createLoginForm({
    apiTokenInstance: API_TOKEN_INSTANCE,
    apiUrl: mock.origin,
    consent: 'on',
    idInstance: ID_INSTANCE,
    mode: 'real',
    ...fields,
  });
}

function withoutField(formData: FormData, name: string) {
  formData.delete(name);
  return formData;
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
  headerStore = new Headers({ 'X-Forwarded-For': `${SPOOFED_IP}, ${CLIENT_IP}` });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test('starts a demo session with server-issued credentials', async () => {
  const { login, readSession } = await importModules();

  const result = await login('max', null, createLoginForm({ mode: 'demo' }));

  expect(result).toEqual({ data: null, ok: true });
  const session = await readSession(cookieStore, 'max');
  expect(session).toMatchObject({ data: { messengerId: 'max', mode: 'demo' }, ok: true });
  expect(session.ok && session.data.credentials.idInstance.startsWith('3100')).toBe(true);
});

test('rejects a real login while real mode is disabled', async () => {
  const { login } = await importModules();

  expect(await login('whatsapp', null, createRealLoginForm())).toEqual({
    error: { code: 'realModeDisabled' },
    ok: false,
  });
  expect(cookieStore.get('tm_whatsapp')).toBeUndefined();
});

test('starts a real session with the entered credentials', async () => {
  vi.stubEnv('REAL_MODE_ENABLED', 'true');
  const { login, readSession } = await importModules();

  const result = await login('whatsapp', null, createRealLoginForm({ apiUrl: ` ${mock.origin} ` }));

  expect(result).toEqual({ data: null, ok: true });
  expect(JSON.stringify(result)).not.toContain(API_TOKEN_INSTANCE);
  expect(await readSession(cookieStore, 'whatsapp')).toMatchObject({
    data: { credentials: { idInstance: ID_INSTANCE }, messengerId: 'whatsapp', mode: 'real' },
    ok: true,
  });
});

test('lists every invalid field', async () => {
  vi.stubEnv('REAL_MODE_ENABLED', 'true');
  const { login } = await importModules();
  const formData = createRealLoginForm({
    apiTokenInstance: 'token/with/slashes',
    apiUrl: 'not a url',
    idInstance: '12ab',
  });

  expect(await login('whatsapp', null, withoutField(formData, 'consent'))).toEqual({
    error: {
      code: 'invalidInput',
      fields: ['apiTokenInstance', 'apiUrl', 'consent', 'idInstance'],
    },
    ok: false,
  });
});

test('requires the personal data consent', async () => {
  vi.stubEnv('REAL_MODE_ENABLED', 'true');
  const { login } = await importModules();

  expect(await login('whatsapp', null, withoutField(createRealLoginForm(), 'consent'))).toEqual({
    error: { code: 'invalidInput', fields: ['consent'] },
    ok: false,
  });
});

test('rejects an api url outside the allowlist', async () => {
  vi.stubEnv('REAL_MODE_ENABLED', 'true');
  const { login } = await importModules();

  const result = await login(
    'whatsapp',
    null,
    createRealLoginForm({ apiUrl: 'https://api.green-api.com.example.com' }),
  );

  expect(result).toEqual({ error: { code: 'invalidInput', fields: ['apiUrl'] }, ok: false });
});

test('passes a GREEN-API error through without saving a session', async () => {
  vi.stubEnv('REAL_MODE_ENABLED', 'true');
  const { login } = await importModules();
  await login('whatsapp', null, createRealLoginForm());
  cookieStore = new ResponseCookies(new Headers());

  const result = await login(
    'whatsapp',
    null,
    createRealLoginForm({ apiTokenInstance: 'intruderToken1' }),
  );

  expect(result).toEqual({ error: { code: 'unauthorized' }, ok: false });
  expect(JSON.stringify(result)).not.toContain('intruderToken1');
  expect(cookieStore.get('tm_whatsapp')).toBeUndefined();
});

test('limits real login attempts per client address', async () => {
  vi.stubEnv('REAL_MODE_ENABLED', 'true');
  const { login } = await importModules();
  for (let attempt = 0; attempt < LOGIN_ATTEMPT_LIMIT; attempt += 1) {
    await login('whatsapp', null, createRealLoginForm({ idInstance: 'invalid' }));
  }

  expect(await login('whatsapp', null, createRealLoginForm())).toEqual({
    error: { code: 'rateLimited', retryAfter: 60 },
    ok: false,
  });
  headerStore = new Headers({ 'X-Forwarded-For': '198.51.100.1' });
  expect(await login('whatsapp', null, createRealLoginForm())).toEqual({ data: null, ok: true });
});

test('keys the limit by the address the proxy appended', async () => {
  vi.stubEnv('REAL_MODE_ENABLED', 'true');
  const { login } = await importModules();
  for (let attempt = 0; attempt < LOGIN_ATTEMPT_LIMIT; attempt += 1) {
    headerStore = new Headers({ 'X-Forwarded-For': `10.0.0.${String(attempt)}, ${CLIENT_IP}` });
    await login('whatsapp', null, createRealLoginForm({ idInstance: 'invalid' }));
  }

  expect(await login('whatsapp', null, createRealLoginForm())).toMatchObject({
    error: { code: 'rateLimited' },
    ok: false,
  });
});

test('shares one limit between clients without a forwarded address', async () => {
  vi.stubEnv('REAL_MODE_ENABLED', 'true');
  const { login } = await importModules();
  headerStore = new Headers();
  for (let attempt = 0; attempt < LOGIN_ATTEMPT_LIMIT; attempt += 1) {
    await login('whatsapp', null, createRealLoginForm({ idInstance: 'invalid' }));
  }

  expect(await login('whatsapp', null, createRealLoginForm())).toMatchObject({
    error: { code: 'rateLimited' },
    ok: false,
  });
});

test('shares one limit between clients with a malformed forwarded address', async () => {
  vi.stubEnv('REAL_MODE_ENABLED', 'true');
  const { login } = await importModules();
  for (let attempt = 0; attempt < LOGIN_ATTEMPT_LIMIT; attempt += 1) {
    headerStore = new Headers({ 'X-Forwarded-For': `junk-${String(attempt)}` });
    await login('whatsapp', null, createRealLoginForm({ idInstance: 'invalid' }));
  }
  headerStore = new Headers();

  expect(await login('whatsapp', null, createRealLoginForm())).toMatchObject({
    error: { code: 'rateLimited' },
    ok: false,
  });
});

test('does not spend the limit on demo logins', async () => {
  vi.stubEnv('REAL_MODE_ENABLED', 'true');
  const { login } = await importModules();
  for (let attempt = 0; attempt <= LOGIN_ATTEMPT_LIMIT; attempt += 1) {
    await login('whatsapp', null, createLoginForm({ mode: 'demo' }));
  }

  expect(await login('whatsapp', null, createRealLoginForm())).toEqual({ data: null, ok: true });
});

test.each([
  ['an unknown messenger', 'icq', { mode: 'demo' }],
  ['an unknown mode', 'max', { mode: 'guest' }],
  ['a missing mode', 'max', {}],
])('rejects %s', async (_, messengerId, fields) => {
  const { login } = await importModules();

  expect(await login(messengerId, null, createLoginForm(fields))).toEqual({
    error: { code: 'invalidInput', fields: [] },
    ok: false,
  });
});

test('ends the session on logout', async () => {
  const { login, logout, readSession } = await importModules();
  await login('telegram', null, createLoginForm({ mode: 'demo' }));

  expect(await logout('telegram')).toEqual({ data: null, ok: true });
  expect(await readSession(cookieStore, 'telegram')).toMatchObject({ ok: false });
});

test('closes the event streams of the session on logout', async () => {
  const { login, logout, pollerRegistry, readSession } = await importModules();
  await login('telegram', null, createLoginForm({ mode: 'demo' }));
  const session = await readSession(cookieStore, 'telegram');
  if (!session.ok) {
    throw new Error('Demo login did not start a session');
  }
  const close = vi.fn();
  pollerRegistry.subscribe(session.data, { close, lastEventId: null, send: vi.fn() });

  await logout('telegram');

  expect(close).toHaveBeenCalledTimes(1);
});

test('closes the event streams of the previous session on a new login', async () => {
  const { login, pollerRegistry, readSession } = await importModules();
  await login('telegram', null, createLoginForm({ mode: 'demo' }));
  const session = await readSession(cookieStore, 'telegram');
  if (!session.ok) {
    throw new Error('Demo login did not start a session');
  }
  const close = vi.fn();
  pollerRegistry.subscribe(session.data, { close, lastEventId: null, send: vi.fn() });

  await login('telegram', null, createLoginForm({ mode: 'demo' }));

  expect(close).toHaveBeenCalledTimes(1);
});

test('reports a logout without a session', async () => {
  const { logout } = await importModules();

  expect(await logout('telegram')).toEqual({ error: { code: 'unauthorized' }, ok: false });
});

test('rejects a logout of an unknown messenger', async () => {
  const { logout } = await importModules();

  expect(await logout('icq')).toEqual({ error: { code: 'invalidInput' }, ok: false });
});
