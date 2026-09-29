import { afterAll, beforeAll, expect, test } from 'vitest';

import { parsePhoneNumber } from '@/entities/chat/phone-number';
import type { MessageStatus } from '@/entities/message/model';
import { MESSENGERS } from '@/entities/messenger/config';
import type { MessengerId } from '@/entities/messenger/model';

import { createGreenApiClient } from './client';
import { apiTokenInstanceSchema } from './credentials';
import { startMockProcess } from './mock-process';
import { createTestCredentials, unwrapResult } from './test-server';

const PHONE_NUMBER = '+7 916 123-45-67';
const MESSAGE_TEXT = 'Привет';
// Shorter than the Vitest test timeout, so a contract mismatch fails on the aborted request.
const ROUND_TRIP_TIMEOUT_MS = 3000;
const ID_INSTANCES = {
  max: '3100000001',
  telegram: '4100000001',
  whatsapp: '1101000001',
} satisfies Record<MessengerId, string>;
const EXPECTED_STATUSES = {
  max: ['delivered', 'read'],
  telegram: ['delivered', 'read'],
  whatsapp: ['sent', 'delivered', 'read'],
} satisfies Record<MessengerId, MessageStatus[]>;

let mock: Awaited<ReturnType<typeof startMockProcess>>;
let origin: string;

beforeAll(async () => {
  mock = await startMockProcess();
  origin = mock.origin;
});

afterAll(async () => {
  await mock.stop();
});

test.each(Object.values(MESSENGERS))(
  '$title client completes a chat round trip',
  async (messenger) => {
    const client = createGreenApiClient(
      messenger,
      createTestCredentials(origin, ID_INSTANCES[messenger.id]),
    );

    expect(unwrapResult(await client.getStateInstance())).toBe('authorized');
    expect(unwrapResult(await client.getSettings())).toEqual({
      isIncomingWebhookEnabled: true,
      isWebhookUrlSet: false,
    });

    const phoneNumber = unwrapResult(parsePhoneNumber(PHONE_NUMBER, messenger.allowedCountryCodes));
    const chatId = unwrapResult(await client.resolveChatId(phoneNumber));
    const idMessage = unwrapResult(await client.sendMessage(chatId, MESSAGE_TEXT));

    const statuses: MessageStatus[] = [];
    const replies: string[] = [];
    const typeInstances = new Set<string | null>();
    const signal = AbortSignal.timeout(ROUND_TRIP_TIMEOUT_MS);
    while (!statuses.includes('read') || replies.length === 0) {
      const notification = unwrapResult(await client.receiveNotification(signal));
      if (notification === null) {
        continue;
      }
      typeInstances.add(notification.typeInstance);
      const { event } = notification;
      if (event?.type === 'status' && event.idMessage === idMessage) {
        statuses.push(event.status);
      }
      if (event?.type === 'message' && event.message.chatId === chatId) {
        replies.push(event.message.text);
      }
      expect(unwrapResult(await client.deleteNotification(notification.receiptId))).toBe(true);
    }

    expect(statuses).toEqual(EXPECTED_STATUSES[messenger.id]);
    expect(replies).toEqual(['Эхо: Привет']);
    expect(typeInstances).toEqual(new Set([messenger.typeInstance]));

    const history = unwrapResult(await client.getChatHistory(chatId, new AbortController().signal));
    expect(history).toHaveLength(2);
    expect(history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: 'outgoing',
          idMessage,
          status: 'read',
          text: MESSAGE_TEXT,
        }),
        expect.objectContaining({
          direction: 'incoming',
          senderName: 'Эхо-бот',
          text: 'Эхо: Привет',
        }),
      ]),
    );
  },
);

test('rejects a token that does not match the bound instance', async () => {
  const credentials = createTestCredentials(origin, '1101000002');
  const owner = createGreenApiClient(MESSENGERS.whatsapp, credentials);
  const intruder = createGreenApiClient(MESSENGERS.whatsapp, {
    ...credentials,
    apiTokenInstance: apiTokenInstanceSchema.parse('intruderToken1'),
  });

  unwrapResult(await owner.getStateInstance());

  expect(await intruder.getStateInstance()).toEqual({ ok: false, error: { code: 'unauthorized' } });
});
