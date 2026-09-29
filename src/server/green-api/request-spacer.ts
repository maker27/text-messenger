import 'server-only';

interface RequestSpacerOptions {
  intervalMs: number;
  maxKeys: number;
  now: () => number;
}

export function createRequestSpacer({ intervalMs, maxKeys, now }: RequestSpacerOptions) {
  const lastSentAtByKey = new Map<string, number>();

  function tryAcquire(key: string) {
    const time = now();
    const lastSentAt = lastSentAtByKey.get(key);

    if (lastSentAt !== undefined && time - lastSentAt < intervalMs) {
      return lastSentAt + intervalMs - time;
    }

    lastSentAtByKey.delete(key);
    lastSentAtByKey.set(key, time);
    const [oldestKey] = lastSentAtByKey.keys();
    if (lastSentAtByKey.size > maxKeys && oldestKey !== undefined) {
      lastSentAtByKey.delete(oldestKey);
    }
    return 0;
  }

  return { tryAcquire };
}
