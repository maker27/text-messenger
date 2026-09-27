import 'server-only';

import { createEnv } from '@t3-oss/env-nextjs';
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

export const env = createEnv({
  server: {
    GREEN_API_MOCK_URL: z.url({ protocol: /^https?$/ }),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    REAL_MODE_ENABLED: z.stringbool().default(false),
  },
  emptyStringAsUndefined: true,
  experimental__runtimeEnv: {},
});
