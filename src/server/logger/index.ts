import 'server-only';

import pino, { type DestinationStream, type LevelWithSilent, type Logger } from 'pino';

import { env } from '@/server/env';

const REDACTED_KEYS = ['apiTokenInstance', 'phoneNumber', 'text', 'url'];
const REDACT_PATHS = REDACTED_KEYS.flatMap((key) => [key, `*.${key}`]);

export function createLogger(level: LevelWithSilent, destination: DestinationStream) {
  return pino(
    { base: null, level, redact: { censor: '[redacted]', paths: REDACT_PATHS } },
    destination,
  );
}

let defaultLogger: Logger | null = null;

// The build evaluates modules with an unvalidated environment, so the level is read on first use.
export function getLogger() {
  defaultLogger ??= createLogger(env.LOG_LEVEL, pino.destination(1));
  return defaultLogger;
}
