import { ResponseCookies } from 'next/dist/server/web/spec-extension/cookies';
import { beforeEach, expect, test, vi } from 'vitest';

let cookieStore: ResponseCookies;

vi.mock('next/headers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  cookies: () => Promise.resolve(cookieStore),
}));

beforeEach(() => {
  vi.resetModules();
  cookieStore = new ResponseCookies(new Headers());
});

test('returns null without a session cookie', async () => {
  const { getSessionView } = await import('./server');

  await expect(getSessionView('max')).resolves.toBeNull();
});

test('exposes only idInstance and mode of a demo session', async () => {
  const { createDemoCredentials } = await import('@/server/session/demo-credentials');
  const { saveSession } = await import('@/server/session/session');
  const { getSessionView } = await import('./server');
  const credentials = createDemoCredentials('max');
  await saveSession(cookieStore, { credentials, messengerId: 'max', mode: 'demo' });

  const view = await getSessionView('max');

  expect(view).toStrictEqual({ idInstance: credentials.idInstance, mode: 'demo' });
  expect(JSON.stringify(view)).not.toContain(credentials.apiTokenInstance);
});

test('returns null for an invalid cookie while rendering a server component', async () => {
  const { getSessionView } = await import('./server');
  cookieStore.set('tm_max', 'Fe26.2*1*tampered~2');
  vi.spyOn(cookieStore, 'set').mockImplementation(() => {
    throw new Error('Cookies can only be modified in a Server Action or Route Handler.');
  });

  await expect(getSessionView('max')).resolves.toBeNull();
});

test('returns null for a session of another messenger', async () => {
  const { createDemoCredentials } = await import('@/server/session/demo-credentials');
  const { saveSession } = await import('@/server/session/session');
  const { getSessionView } = await import('./server');
  await saveSession(cookieStore, {
    credentials: createDemoCredentials('max'),
    messengerId: 'max',
    mode: 'demo',
  });

  await expect(getSessionView('telegram')).resolves.toBeNull();
});
