import 'server-only';

import { z } from 'zod';

const GREEN_API_HOST_PATTERN = /^(\d+\.)?api\.green-?api\.com$/;
// z.url() trims and WHATWG URL fixes up missing slashes; accept only the canonical form.
const CANONICAL_URL_PATTERN = /^https?:\/\/\S+$/;

interface ApiUrlPolicy {
  isRealModeEnabled: boolean;
  mockUrl: string;
}

function isOriginOnly(url: URL) {
  return (
    url.username === '' &&
    url.password === '' &&
    url.pathname === '/' &&
    url.search === '' &&
    url.hash === ''
  );
}

function isGreenApiUrl(url: URL) {
  return url.protocol === 'https:' && url.port === '' && GREEN_API_HOST_PATTERN.test(url.hostname);
}

export function createApiUrlSchema({ isRealModeEnabled, mockUrl }: ApiUrlPolicy) {
  const mockOrigin = new URL(mockUrl).origin;

  return z
    .string()
    .regex(CANONICAL_URL_PATTERN)
    .pipe(z.url())
    .transform((value) => new URL(value))
    .refine(isOriginOnly)
    .refine((url) => url.origin === mockOrigin || (isRealModeEnabled && isGreenApiUrl(url)))
    .transform((url) => url.origin)
    .brand<'ApiUrl'>();
}

export type ApiUrl = z.output<ReturnType<typeof createApiUrlSchema>>;
