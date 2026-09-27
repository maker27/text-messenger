import 'server-only';

import { createEnv } from '@t3-oss/env-nextjs';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import type { LevelWithSilent } from 'pino';
import { z } from 'zod';

const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
] as const satisfies readonly LevelWithSilent[];

const SESSION_SECRET_MIN_LENGTH = 32;

export const env = createEnv({
  server: {
    GREEN_API_MOCK_URL: z.url({ protocol: /^https?$/ }),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    REAL_MODE_ENABLED: z.stringbool().default(false),
    SESSION_SECRET: z.string().min(SESSION_SECRET_MIN_LENGTH),
  },
  emptyStringAsUndefined: true,
  experimental__runtimeEnv: {},
  // Server secrets exist only on the host, so the build must not require them.
  skipValidation: process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD,
});
