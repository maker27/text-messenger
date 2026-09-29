import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { parsePhoneNumber } from '@/entities/chat/phone-number';
import { MESSENGERS } from '@/entities/messenger/config';
import type { MessengerConfig } from '@/entities/messenger/model';
import { getLogger } from '@/server/logger';

import { createGreenApiClient } from './client';
import {
  createTestCredentials,
  startTestServer,
  TEST_API_TOKEN_INSTANCE,
  TEST_ID_INSTANCE,
  unwrapResult,
} from './test-server';

const INSTANCE_PATH = `/waInstance${TEST_ID_INSTANCE}`;
const CHAT_ID = '79161234567@c.us';
const PHONE_NUMBER = unwrapResult(parsePhoneNumber('+7 916 123-45-67', null));

let server: Awaited<ReturnType<typeof startTestServer>>;

function createClient(messenger: MessengerConfig = MESSENGERS.whatsapp) {
  return createGreenApiClient(messenger, createTestCredentials(server.origin));
}

function getLastRequest() {
  return server.requests.at(-1);
}

beforeEach(async () => {
  server = await startTestServer();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await server.close();
});

test('reads the instance state and settings', async () => {
  const client = createClient();

  server.setReply({ body: '{"stateInstance":"authorized"}', status: 200 });
  expect(await client.getStateInstance()).toEqual({ ok: true, data: 'authorized' });
  expect(getLastRequest()?.url).toBe(
    `${INSTANCE_PATH}/getStateInstance/${TEST_API_TOKEN_INSTANCE}`,
  );

  server.setReply({
    body: '{"incomingWebhook":"yes","outgoingWebhook":"yes","webhookUrl":""}',
    status: 200,
  });
  expect(await client.getSettings()).toEqual({
    ok: true,
    data: {
      isIncomingWebhookEnabled: true,
      isWebhookUrlSet: false,
    },
  });
  expect(getLastRequest()?.url).toBe(`${INSTANCE_PATH}/getSettings/${TEST_API_TOKEN_INSTANCE}`);
});

test('resolves a WhatsApp chat id with checkWhatsapp', async () => {
  server.setReply({ body: `{"existsWhatsapp":true,"chatId":"${CHAT_ID}"}`, status: 200 });

  expect(await createClient().resolveChatId(PHONE_NUMBER)).toEqual({ ok: true, data: CHAT_ID });
  expect(getLastRequest()).toMatchObject({
    body: '{"phoneNumber":79161234567}',
    url: `${INSTANCE_PATH}/checkWhatsapp/${TEST_API_TOKEN_INSTANCE}`,
  });
});

test('resolves a MAX chat id with checkAccount', async () => {
  server.setReply({ body: '{"exist":false}', status: 200 });

  expect(await createClient(MESSENGERS.max).resolveChatId(PHONE_NUMBER)).toEqual({
    ok: false,
    error: { code: 'accountNotFound' },
  });
  expect(getLastRequest()?.url).toBe(`${INSTANCE_PATH}/checkAccount/${TEST_API_TOKEN_INSTANCE}`);
});

test('sends a message and returns its id', async () => {
  server.setReply({ body: '{"idMessage":"3EB0C767D097B7C7C030"}', status: 200 });

  expect(await createClient().sendMessage(CHAT_ID, 'Привет')).toEqual({
    ok: true,
    data: '3EB0C767D097B7C7C030',
  });
  expect(getLastRequest()).toMatchObject({
    body: `{"chatId":"${CHAT_ID}","message":"Привет"}`,
    url: `${INSTANCE_PATH}/sendMessage/${TEST_API_TOKEN_INSTANCE}`,
  });
});

test('requests the latest chat history', async () => {
  server.setReply({
    body: JSON.stringify([
      {
        idMessage: 'OUT1',
        statusMessage: 'sent',
        textMessage: 'Привет',
        timestamp: 1_700_000_000,
        type: 'outgoing',
        typeMessage: 'textMessage',
      },
    ]),
    status: 200,
  });

  const history = unwrapResult(await createClient().getChatHistory(CHAT_ID));

  expect(history).toEqual([
    {
      chatId: CHAT_ID,
      direction: 'outgoing',
      idMessage: 'OUT1',
      senderName: null,
      sentAt: 1_700_000_000_000,
      status: 'sent',
      text: 'Привет',
    },
  ]);
  expect(getLastRequest()?.body).toBe(`{"chatId":"${CHAT_ID}","count":50}`);
});

test('reports an empty notification queue as null', async () => {
  server.setReply({ body: 'null', status: 200 });

  expect(await createClient().receiveNotification(new AbortController().signal)).toEqual({
    ok: true,
    data: null,
  });
  expect(getLastRequest()?.url).toBe(
    `${INSTANCE_PATH}/receiveNotification/${TEST_API_TOKEN_INSTANCE}?receiveTimeout=20`,
  );
});

test('keeps the receipt id of a malformed notification', async () => {
  const warn = vi.spyOn(getLogger(), 'warn');
  server.setReply({
    body: '{"receiptId":5,"body":{"typeWebhook":"incomingMessageReceived"}}',
    status: 200,
  });

  expect(await createClient().receiveNotification(new AbortController().signal)).toEqual({
    ok: true,
    data: { event: null, receiptId: 5, typeInstance: null },
  });
  expect(warn).toHaveBeenCalledOnce();
});

test('deletes a notification by receipt id', async () => {
  server.setReply({ body: '{"result":true}', status: 200 });

  expect(await createClient().deleteNotification(5)).toEqual({ ok: true, data: true });
  expect(getLastRequest()).toMatchObject({
    method: 'DELETE',
    url: `${INSTANCE_PATH}/deleteNotification/${TEST_API_TOKEN_INSTANCE}/5`,
  });
});
