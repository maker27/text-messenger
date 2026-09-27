import { ResponseCookies } from 'next/dist/server/web/spec-extension/cookies';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';

import type { GreenApiCredentials } from '@/server/green-api/credentials';
import { startMockProcess } from '@/server/green-api/mock-process';
import type { Session } from '@/server/session/session';

const ID_INSTANCE = '1101000001';
const API_TOKEN_INSTANCE = 'mockToken1';
const INTRUDER_TOKEN = 'intruderToken1';
const CHAT_ID = '79001234567@c.us';
const CLIENT_IP = '203.0.113.1';
const ONLINE_FRAME = 'event: connection\ndata: {"status":"online"}\n\n';
const MESSAGE_EVENT = 'event: message\n';

const logLines: string[] = [];
const openReaders: ReadableStreamDefaultReader<Uint8Array>[] = [];
const sessions: Session[] = [];
let cookieStore: ResponseCookies;
let mock: Awaited<ReturnType<typeof startMockProcess>>;
let modules: Awaited<ReturnType<typeof importModules>>;

vi.mock('next/headers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  cookies: () => Promise.resolve(cookieStore),
  headers: () => Promise.resolve(new Headers({ 'X-Forwarded-For': CLIENT_IP })),
}));

vi.mock('@/server/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/logger')>();
  const logger = actual.createLogger('debug', {
    write: (line) => {
      logLines.push(line);
    },
  });
  return { ...actual, getLogger: () => logger };
});

async function importModules() {
  const { GET } = await import('./route');
  const { MESSENGERS } = await import('@/entities/messenger/config');
  const { login, logout } = await import('@/features/login/actions');
  const { createGreenApiClient } = await import('@/server/green-api/client');
  const { pollerRegistry } = await import('@/server/notifications/poller-registry');
  const { readSession } = await import('@/server/session/session');

  return { createGreenApiClient, GET, login, logout, MESSENGERS, pollerRegistry, readSession };
}

function createLoginForm(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    formData.set(name, value);
  }
  return formData;
}

function createRealLoginForm(apiUrl: string, apiTokenInstance = API_TOKEN_INSTANCE) {
  return createLoginForm({
    apiTokenInstance,
    apiUrl,
    consent: 'on',
    idInstance: ID_INSTANCE,
    mode: 'real',
  });
}

async function signIn(formData: FormData) {
  cookieStore = new ResponseCookies(new Headers());
  const result = await modules.login('whatsapp', null, formData);
  const session = await modules.readSession(cookieStore, 'whatsapp');
  if (!session.ok) {
    throw new Error('The login did not start a session');
  }
  sessions.push(session.data);
  return { result, session: session.data };
}

async function openEvents(headers: Record<string, string> = {}) {
  const response = await modules.GET(
    new Request('http://localhost/api/whatsapp/events', { headers }),
    { params: Promise.resolve({ messenger: 'whatsapp' }) },
  );
  if (response.body === null) {
    throw new Error('The event stream has no body');
  }
  const reader = response.body.getReader();
  openReaders.push(reader);
  const decoder = new TextDecoder();
  let text = '';

  async function readUntil(fragment: string) {
    while (!text.includes(fragment)) {
      const chunk = await reader.read();
      if (chunk.done) {
        throw new Error('The event stream ended');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text;
  }

  return { readUntil };
}

async function sendMessage(credentials: GreenApiCredentials, text: string) {
  const sent = await modules
    .createGreenApiClient(modules.MESSENGERS.whatsapp, credentials)
    .sendMessage(CHAT_ID, text);
  if (!sent.ok) {
    throw new Error('The mock did not accept the message');
  }
}

beforeAll(async () => {
  mock = await startMockProcess();
  vi.stubEnv('GREEN_API_MOCK_URL', mock.origin);
  vi.stubEnv('REAL_MODE_ENABLED', 'true');
  modules = await importModules();
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await mock.stop();
});

beforeEach(() => {
  logLines.length = 0;
});

afterEach(async () => {
  await Promise.all(openReaders.splice(0).map((reader) => reader.cancel()));
  for (const session of sessions.splice(0)) {
    modules.pollerRegistry.disconnectSession(session);
  }
});

test('streams the echo of a demo session without leaking its token', async () => {
  const { result, session } = await signIn(createLoginForm({ mode: 'demo' }));
  const events = await openEvents();

  await events.readUntil(ONLINE_FRAME);
  await sendMessage(session.credentials, 'ping from demo');
  const frames = await events.readUntil(MESSAGE_EVENT);

  const { apiTokenInstance } = session.credentials;
  expect(frames).toContain('ping from demo');
  expect(frames).not.toContain(apiTokenInstance);
  expect(JSON.stringify(result)).not.toContain(apiTokenInstance);
  expect(logLines.join('')).not.toContain(apiTokenInstance);
});

test('rejects actions and streams without a session', async () => {
  cookieStore = new ResponseCookies(new Headers());

  const response = await modules.GET(new Request('http://localhost/api/whatsapp/events'), {
    params: Promise.resolve({ messenger: 'whatsapp' }),
  });

  expect(response.status).toBe(401);
  expect(await modules.logout('whatsapp')).toEqual({ error: { code: 'unauthorized' }, ok: false });
});

test('rejects an api url of a foreign host', async () => {
  cookieStore = new ResponseCookies(new Headers());

  const result = await modules.login(
    'whatsapp',
    null,
    createRealLoginForm('https://attacker.example.com'),
  );

  expect(result).toEqual({ error: { code: 'invalidInput', fields: ['apiUrl'] }, ok: false });
  expect(cookieStore.get('tm_whatsapp')).toBeUndefined();
});

test('replays nothing from before the login of a session sharing the poller', async () => {
  const first = await signIn(createRealLoginForm(mock.origin));
  const firstEvents = await openEvents();
  await firstEvents.readUntil(ONLINE_FRAME);
  await sendMessage(first.session.credentials, 'before second login');
  await firstEvents.readUntil(MESSAGE_EVENT);

  const second = await signIn(createRealLoginForm(mock.origin));
  const secondEvents = await openEvents({ 'Last-Event-ID': '0' });
  await secondEvents.readUntil(ONLINE_FRAME);
  await sendMessage(second.session.credentials, 'after second login');
  const secondFrames = await secondEvents.readUntil('after second login');

  expect(second.result).toEqual({ data: null, ok: true });
  expect(secondFrames).not.toContain('before second login');
});

test('logs a rejected login without its token', async () => {
  cookieStore = new ResponseCookies(new Headers());

  const result = await modules.login(
    'whatsapp',
    null,
    createRealLoginForm(mock.origin, INTRUDER_TOKEN),
  );

  expect(result).toEqual({ error: { code: 'unauthorized' }, ok: false });
  expect(logLines).not.toHaveLength(0);
  expect(logLines.join('')).not.toContain(INTRUDER_TOKEN);
  expect(JSON.stringify(result)).not.toContain(INTRUDER_TOKEN);
});
