import 'server-only';

import { z } from 'zod';

const webhookFlagSchema = z.enum(['yes', 'no']).transform((value) => value === 'yes');

export const stateInstanceSchema = z
  .object({ stateInstance: z.string() })
  .transform(({ stateInstance }) => stateInstance);

export const settingsSchema = z
  .object({
    incomingWebhook: webhookFlagSchema,
    webhookUrl: z.string(),
  })
  .transform(({ incomingWebhook, webhookUrl }) => ({
    isIncomingWebhookEnabled: incomingWebhook,
    isWebhookUrlSet: webhookUrl !== '',
  }));

export const sendMessageSchema = z
  .object({ idMessage: z.string().min(1) })
  .transform(({ idMessage }) => idMessage);

export const deleteNotificationSchema = z
  .object({ result: z.boolean() })
  .transform(({ result }) => result);

export const chatHistorySchema = z.array(z.unknown());
