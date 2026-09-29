import { afterEach, beforeEach, expect, test, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test('fails the server start on invalid environment variables', async () => {
  vi.stubEnv('SESSION_SECRET', '');
  const { register } = await import('./instrumentation');

  await expect(register()).rejects.toThrow('Invalid environment variables');
});

test('starts the server on valid environment variables', async () => {
  const { register } = await import('./instrumentation');

  await expect(register()).resolves.toBeUndefined();
});
