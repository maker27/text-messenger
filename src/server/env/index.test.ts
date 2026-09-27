import { afterEach, beforeEach, expect, test, vi } from 'vitest';

async function importEnv() {
  const { env } = await import('./index');
  return env;
}

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test('applies defaults for empty optional variables', async () => {
  vi.stubEnv('LOG_LEVEL', '');
  vi.stubEnv('REAL_MODE_ENABLED', '');

  const env = await importEnv();

  expect(env.LOG_LEVEL).toBe('info');
  expect(env.REAL_MODE_ENABLED).toBe(false);
  expect(env.GREEN_API_MOCK_URL).toBe('http://127.0.0.1:3100');
});

test('accepts a 32-character session secret', async () => {
  vi.stubEnv('SESSION_SECRET', 'a'.repeat(32));

  const env = await importEnv();

  expect(env.SESSION_SECRET).toBe('a'.repeat(32));
});

test('skips validation during the production build', async () => {
  vi.stubEnv('NEXT_PHASE', 'phase-production-build');
  vi.stubEnv('SESSION_SECRET', '');

  await expect(importEnv()).resolves.toBeDefined();
});

test('validates at runtime of the production server', async () => {
  vi.stubEnv('NEXT_PHASE', 'phase-production-server');
  vi.stubEnv('SESSION_SECRET', '');

  await expect(importEnv()).rejects.toThrow('Invalid environment variables');
});

test('parses the real mode flag', async () => {
  vi.stubEnv('REAL_MODE_ENABLED', 'true');

  const env = await importEnv();

  expect(env.REAL_MODE_ENABLED).toBe(true);
});

test.each([
  ['REAL_MODE_ENABLED', 'maybe'],
  ['GREEN_API_MOCK_URL', 'ftp://mock'],
  ['GREEN_API_MOCK_URL', ''],
  ['LOG_LEVEL', 'verbose'],
  ['SESSION_SECRET', ''],
  ['SESSION_SECRET', 'a'.repeat(31)],
])('rejects %s=%j', async (name, value) => {
  vi.stubEnv(name, value);

  await expect(importEnv()).rejects.toThrow('Invalid environment variables');
});
