import { z } from 'zod';

export const greenApiErrorSchema = z.discriminatedUnion('code', [
  z.object({ code: z.literal('rateLimited'), retryAfter: z.number().nullable() }),
  z.object({
    code: z.enum([
      'accountNotFound',
      'instanceNotAuthorized',
      'instanceTypeMismatch',
      'invalidResponse',
      'network',
      'notificationsDisabled',
      'realModeDisabled',
      'timeout',
      'unauthorized',
      'upstream',
      'webhookConfigured',
    ]),
  }),
]);

export type GreenApiError = z.infer<typeof greenApiErrorSchema>;

export type PhoneNumberErrorCode = 'countryNotAllowed' | 'invalid';

export type LoginField = 'apiTokenInstance' | 'apiUrl' | 'consent' | 'idInstance';

export type LoginReason = 'instanceTypeMismatch' | 'realModeDisabled' | 'sessionExpired';
