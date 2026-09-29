import 'server-only';

import { z } from 'zod';

import type { PhoneNumber } from '@/entities/chat/phone-number';
import type { MessengerId } from '@/entities/messenger/model';
import type { GreenApiError } from '@/shared/errors/model';
import type { Result } from '@/shared/errors/result';

const NUMERIC_CHAT_ID_PATTERN = /^-?\d+$/;
const WHATSAPP_CHAT_ID_PATTERN = /^\d+@(?:c\.us|lid)$/;
const WHATSAPP_PHONE_CHAT_ID_PATTERN = /^\d+@c\.us$/;
const WHATSAPP_PHONE_CHAT_ID_SUFFIX = '@c.us';
// checkWhatsapp leaves phoneNumber empty when the account hides its number.
const HIDDEN_PHONE_NUMBER = '';
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

interface WhatsappAccount {
  accountChatId: string;
  phoneChatId: string | null;
}

export const checkWhatsappSchema = z
  .discriminatedUnion('existsWhatsapp', [
    z.object({
      chatId: z.string().regex(WHATSAPP_CHAT_ID_PATTERN),
      existsWhatsapp: z.literal(true),
      phoneNumber: z.union([
        z.literal(HIDDEN_PHONE_NUMBER),
        z.string().regex(WHATSAPP_PHONE_CHAT_ID_PATTERN),
      ]),
    }),
    z.object({ existsWhatsapp: z.literal(false) }),
  ])
  .transform((response): Result<WhatsappAccount, GreenApiError> => {
    if (!response.existsWhatsapp) {
      return ACCOUNT_NOT_FOUND;
    }
    return {
      ok: true,
      data: {
        accountChatId: response.chatId,
        phoneChatId: response.phoneNumber === HIDDEN_PHONE_NUMBER ? null : response.phoneNumber,
      },
    };
  });

// Without LID mode GREEN-API files the journal and notifications under `number@c.us`,
// so a chat opened by the LID from checkWhatsapp would never see its messages.
export function selectWhatsappChatId(
  { accountChatId, phoneChatId }: WhatsappAccount,
  phoneNumber: PhoneNumber,
  isLidModeEnabled: boolean,
) {
  if (isLidModeEnabled) {
    return accountChatId;
  }
  return phoneChatId ?? `${phoneNumber}${WHATSAPP_PHONE_CHAT_ID_SUFFIX}`;
}

export function parseChatId(messengerId: MessengerId, value: string) {
  const pattern = messengerId === 'whatsapp' ? WHATSAPP_CHAT_ID_PATTERN : NUMERIC_CHAT_ID_PATTERN;
  return pattern.test(value) ? value : null;
}

// Next.js passes dynamic segments percent-encoded, so the WhatsApp `@` arrives as `%40`.
// Malformed escapes never get here: the router rejects them before rendering the page.
export function parseRouteChatId(messengerId: MessengerId, segment: string) {
  return parseChatId(messengerId, decodeURIComponent(segment));
}
