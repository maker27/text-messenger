import 'server-only';

import { z } from 'zod';

import type { GreenApiError } from '@/shared/errors/model';
import type { Result } from '@/shared/errors/result';

const NUMERIC_CHAT_ID_PATTERN = /^-?\d+$/;
const WHATSAPP_CHAT_ID_PATTERN = /^\d+@(?:c\.us|lid)$/;
const ACCOUNT_NOT_FOUND: Result<never, GreenApiError> = {
  ok: false,
  error: { code: 'accountNotFound' },
};

const MILLISECONDS_IN_SECOND = 1000;

// Unlike the Retry-After header, checkAccount reports retryAfter in milliseconds.
const checkAccountRateLimitSchema = z.object({
  data: z.object({ reason: z.literal('rate_limit_exceeded'), retryAfter: z.int().nonnegative() }),
  status: z.literal(false),
});

const checkAccountRefusalSchema = z.object({ reason: z.string(), status: z.literal(false) });

export const checkAccountSchema = z
  .union([
    z.discriminatedUnion('exist', [
      z.object({
        chatId: z.union([z.string().regex(NUMERIC_CHAT_ID_PATTERN), z.int()]).transform(String),
        exist: z.literal(true),
      }),
      z.object({ exist: z.literal(false) }),
    ]),
    checkAccountRateLimitSchema,
    checkAccountRefusalSchema,
  ])
  .transform((response): Result<string, GreenApiError> => {
    if ('data' in response) {
      return {
        ok: false,
        error: {
          code: 'rateLimited',
          retryAfter: Math.ceil(response.data.retryAfter / MILLISECONDS_IN_SECOND),
        },
      };
    }
    if ('status' in response) {
      return { ok: false, error: { code: 'upstream' } };
    }
    return response.exist ? { ok: true, data: response.chatId } : ACCOUNT_NOT_FOUND;
  });

export const checkWhatsappSchema = z
  .discriminatedUnion('existsWhatsapp', [
    z.object({
      chatId: z.string().regex(WHATSAPP_CHAT_ID_PATTERN),
      existsWhatsapp: z.literal(true),
    }),
    z.object({ existsWhatsapp: z.literal(false) }),
  ])
  .transform((response): Result<string, GreenApiError> =>
    response.existsWhatsapp ? { ok: true, data: response.chatId } : ACCOUNT_NOT_FOUND,
  );
