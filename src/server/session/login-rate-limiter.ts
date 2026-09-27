import 'server-only';

import type { Result } from '@/shared/errors/result';

const MILLISECONDS_IN_SECOND = 1000;
const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_MAX_KEYS = 10_000;
const LOGIN_WINDOW_MS = 60_000;

interface LoginRateLimiterOptions {
  limit: number;
  maxKeys: number;
  now: () => number;
  windowMs: number;
}

interface LoginRateLimitError {
  code: 'rateLimited';
  retryAfter: number;
}

export function createLoginRateLimiter({ limit, maxKeys, now, windowMs }: LoginRateLimiterOptions) {
  const attemptTimesByKey = new Map<string, number[]>();

  function touchKey(key: string, attemptTimes: number[]) {
    attemptTimesByKey.delete(key);
    attemptTimesByKey.set(key, attemptTimes);
    const [oldestKey] = attemptTimesByKey.keys();
    if (attemptTimesByKey.size > maxKeys && oldestKey !== undefined) {
      attemptTimesByKey.delete(oldestKey);
    }
  }

  function consume(key: string): Result<null, LoginRateLimitError> {
    const time = now();
    const attemptTimes = (attemptTimesByKey.get(key) ?? []).filter(
      (attemptTime) => attemptTime > time - windowMs,
    );
    const [oldestAttemptTime] = attemptTimes;
    if (attemptTimes.length >= limit && oldestAttemptTime !== undefined) {
      touchKey(key, attemptTimes);
      const retryAfterMs = oldestAttemptTime + windowMs - time;
      return {
        error: {
          code: 'rateLimited',
          retryAfter: Math.ceil(retryAfterMs / MILLISECONDS_IN_SECOND),
        },
        ok: false,
      };
    }

    touchKey(key, [...attemptTimes, time]);
    return { data: null, ok: true };
  }

  return { consume };
}

export const loginRateLimiter = createLoginRateLimiter({
  limit: LOGIN_ATTEMPT_LIMIT,
  maxKeys: LOGIN_MAX_KEYS,
  now: Date.now,
  windowMs: LOGIN_WINDOW_MS,
});
