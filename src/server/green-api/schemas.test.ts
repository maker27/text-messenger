import { expect, test } from 'vitest';

import {
  chatHistorySchema,
  deleteNotificationSchema,
  sendMessageSchema,
  settingsSchema,
  stateInstanceSchema,
} from './schemas';

test('unwraps the instance state', () => {
  expect(stateInstanceSchema.parse({ stateInstance: 'authorized' })).toBe('authorized');
});

test('maps webhook settings to flags', () => {
  expect(
    settingsSchema.parse({ incomingWebhook: 'yes', outgoingWebhook: 'no', webhookUrl: '' }),
  ).toEqual({
    isIncomingWebhookEnabled: true,
    isOutgoingWebhookEnabled: false,
    isWebhookUrlSet: false,
  });
  expect(
    settingsSchema.parse({
      incomingWebhook: 'no',
      outgoingWebhook: 'yes',
      webhookUrl: 'https://hook',
    }),
  ).toMatchObject({ isWebhookUrlSet: true });
});

test('rejects unknown settings values', () => {
  expect(
    settingsSchema.safeParse({ incomingWebhook: 'true', outgoingWebhook: 'no', webhookUrl: '' })
      .success,
  ).toBe(false);
});

test('unwraps the sent message id and the delete result', () => {
  expect(sendMessageSchema.parse({ idMessage: 'ABC' })).toBe('ABC');
  expect(sendMessageSchema.safeParse({ idMessage: '' }).success).toBe(false);
  expect(deleteNotificationSchema.parse({ result: true })).toBe(true);
});

test('accepts only an array as chat history', () => {
  expect(chatHistorySchema.parse([{}, null])).toEqual([{}, null]);
  expect(chatHistorySchema.safeParse({}).success).toBe(false);
});
