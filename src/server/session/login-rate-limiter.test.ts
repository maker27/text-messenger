import { expect, test } from 'vitest';

import { createLoginRateLimiter } from './login-rate-limiter';

const LIMIT = 5;
const WINDOW_MS = 60_000;
const MAX_KEYS = 10;

function createLimiter(maxKeys = MAX_KEYS) {
  const clock = { time: 0 };
  const limiter = createLoginRateLimiter({
    limit: LIMIT,
    maxKeys,
    now: () => clock.time,
    windowMs: WINDOW_MS,
  });

  function consumeTimes(key: string, times: number) {
    return Array.from({ length: times }, () => limiter.consume(key));
  }

  return { clock, consumeTimes, limiter };
}

test('allows attempts up to the limit', () => {
  const { consumeTimes } = createLimiter();

  expect(consumeTimes('1.1.1.1', LIMIT)).toEqual(Array(LIMIT).fill({ data: null, ok: true }));
});

test('rejects the attempt over the limit with the seconds left', () => {
  const { consumeTimes, limiter } = createLimiter();
  consumeTimes('1.1.1.1', LIMIT);

  expect(limiter.consume('1.1.1.1')).toEqual({
    error: { code: 'rateLimited', retryAfter: 60 },
    ok: false,
  });
});

test('rounds the retry delay up to whole seconds', () => {
  const { clock, consumeTimes, limiter } = createLimiter();
  consumeTimes('1.1.1.1', LIMIT);
  clock.time = 59_001;

  expect(limiter.consume('1.1.1.1')).toEqual({
    error: { code: 'rateLimited', retryAfter: 1 },
    ok: false,
  });
});

test('frees slots as the window slides', () => {
  const { clock, consumeTimes, limiter } = createLimiter();
  consumeTimes('1.1.1.1', 1);
  clock.time = 30_000;
  consumeTimes('1.1.1.1', LIMIT - 1);

  clock.time = WINDOW_MS;
  expect(limiter.consume('1.1.1.1')).toEqual({ data: null, ok: true });
  expect(limiter.consume('1.1.1.1')).toEqual({
    error: { code: 'rateLimited', retryAfter: 30 },
    ok: false,
  });
});

test('does not count rejected attempts', () => {
  const { clock, consumeTimes, limiter } = createLimiter();
  consumeTimes('1.1.1.1', LIMIT);
  clock.time = 30_000;
  consumeTimes('1.1.1.1', LIMIT);

  clock.time = WINDOW_MS;
  expect(limiter.consume('1.1.1.1')).toEqual({ data: null, ok: true });
});

test('limits every key independently', () => {
  const { consumeTimes, limiter } = createLimiter();
  consumeTimes('1.1.1.1', LIMIT);

  expect(limiter.consume('2.2.2.2')).toEqual({ data: null, ok: true });
});

test('evicts the oldest key once the key limit is exceeded', () => {
  const { consumeTimes, limiter } = createLimiter(2);
  consumeTimes('1.1.1.1', LIMIT);
  consumeTimes('2.2.2.2', LIMIT);
  consumeTimes('3.3.3.3', 1);

  expect(limiter.consume('2.2.2.2')).toMatchObject({ ok: false });
  expect(limiter.consume('1.1.1.1')).toEqual({ data: null, ok: true });
});

test('keeps a rejected key as recently used', () => {
  const { consumeTimes, limiter } = createLimiter(2);
  consumeTimes('1.1.1.1', LIMIT);
  consumeTimes('2.2.2.2', 1);
  limiter.consume('1.1.1.1');
  consumeTimes('3.3.3.3', 1);

  expect(limiter.consume('1.1.1.1')).toMatchObject({ ok: false });
});
