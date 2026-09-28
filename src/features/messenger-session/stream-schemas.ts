import { z } from 'zod';

export const streamMessageSchemas = {
  connection: z.discriminatedUnion('status', [
    z.object({ status: z.enum(['online', 'unauthorized']) }),
    z.object({ retryAt: z.number(), status: z.literal('reconnecting') }),
    z.object({
      code: z.enum(['instanceTypeMismatch', 'realModeDisabled', 'webhookConfigured']).nullable(),
      status: z.literal('stopped'),
    }),
  ]),
  message: z
    .object({
      chatId: z.string().min(1),
      direction: z.enum(['incoming', 'outgoing']),
      idMessage: z.string().min(1),
      senderName: z.string().nullable(),
      sentAt: z.number(),
      text: z.string(),
    })
    .transform((message) => ({ ...message, status: null })),
  resync: z.object({}),
  status: z.object({
    chatId: z.string().min(1),
    idMessage: z.string().min(1),
    status: z.enum(['delivered', 'failed', 'read', 'sent']),
  }),
};
