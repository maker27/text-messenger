import { ResponseCookies } from 'next/dist/server/web/spec-extension/cookies';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { createTestCredentials } from '@/server/green-api/test-server';
import { pollerRegistry } from '@/server/notifications/poller-registry';
import { saveSession } from '@/server/session/session';

import { GET } from './route';

const MOCK_ORIGIN = 'http://127.0.0.1:3100';
const EVENTS_URL = 'http://localhost/api/whatsapp/events';

let cookieStore: ResponseCookies;

vi.mock('next/headers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  cookies: () => Promise.resolve(cookieStore),
}));

function requestEvents(messenger: string, headers: Record<string, string> = {}) {
  return GET(new Request(EVENTS_URL, { headers }), {
    params: Promise.resolve({ messenger }),
  });
}

function signIn(mode: 'demo' | 'real') {
  return saveSession(cookieStore, {
    credentials: createTestCredentials(MOCK_ORIGIN),
    messengerId: 'whatsapp',
    mode,
  });
}

function spyOnSubscribe() {
  const unsubscribe = vi.fn();
  const subscribe = vi.spyOn(pollerRegistry, 'subscribe').mockImplementation((_, stream) => {
    stream.send({ state: { status: 'online' }, type: 'connection' });
    return unsubscribe;
  });

  return { subscribe, unsubscribe };
}

async function readFirstFrame(response: Response) {
  const reader = response.body?.getReader();
  const chunk = await reader?.read();
  await reader?.cancel();
  return new TextDecoder().decode(chunk?.value);
}

beforeEach(() => {
  cookieStore = new ResponseCookies(new Headers());
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('rejects an unknown messenger', async () => {
  const response = await requestEvents('icq');

  expect(response.status).toBe(404);
});

test('rejects a request without a session', async () => {
  const { subscribe } = spyOnSubscribe();

  const response = await requestEvents('whatsapp');

  expect(response.status).toBe(401);
  expect(subscribe).not.toHaveBeenCalled();
});

test('ends the stream of a real session when the real mode is disabled', async () => {
  const { subscribe } = spyOnSubscribe();
  await signIn('real');

  const response = await requestEvents('whatsapp');

  expect(response.status).toBe(200);
  expect(await response.text()).toBe(
    'event: connection\ndata: {"code":"realModeDisabled","status":"stopped"}\n\n',
  );
  expect(subscribe).not.toHaveBeenCalled();
});

test('subscribes the session and streams its connection state first', async () => {
  const { subscribe, unsubscribe } = spyOnSubscribe();
  const session = await signIn('demo');

  const response = await requestEvents('whatsapp', { 'Last-Event-ID': '7' });

  expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
  expect(await readFirstFrame(response)).toBe('event: connection\ndata: {"status":"online"}\n\n');
  expect(subscribe).toHaveBeenCalledWith(session, expect.objectContaining({ lastEventId: 7 }));
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test.each(['abc', '-1', '1.5', ''])(
  'ignores the malformed last event id %j',
  async (lastEventId) => {
    const { subscribe } = spyOnSubscribe();
    await signIn('demo');

    await requestEvents('whatsapp', { 'Last-Event-ID': lastEventId });

    expect(subscribe).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ lastEventId: null }),
    );
  },
);
