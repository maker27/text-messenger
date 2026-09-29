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
const LID_CHAT_ID = '123456789012345@lid';
const SPACED_ID_INSTANCE = '1101000002';
const ABORTED_ID_INSTANCE = '1101000003';
const RELEASED_ID_INSTANCE = '1101000004';
const HISTORY_INTERVAL_MS = 1000;
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

test.each([
  ['no', CHAT_ID],
  ['yes', LID_CHAT_ID],
])('resolves a WhatsApp chat id with LID mode %s', async (enableLidMode, chatId) => {
  // The test server answers every request alike, so one body serves getSettings and checkWhatsapp.
  server.setReply({
    body: JSON.stringify({
      chatId: LID_CHAT_ID,
      enableLidMode,
      existsWhatsapp: true,
      phoneNumber: CHAT_ID,
    }),
    status: 200,
  });

  expect(await createClient().resolveChatId(PHONE_NUMBER)).toEqual({ ok: true, data: chatId });
  expect(server.requests).toMatchObject([
    { url: `${INSTANCE_PATH}/getSettings/${TEST_API_TOKEN_INSTANCE}` },
    {
      body: '{"phoneNumber":79161234567}',
      url: `${INSTANCE_PATH}/checkWhatsapp/${TEST_API_TOKEN_INSTANCE}`,
    },
  ]);
});

test('does not check a WhatsApp account when the LID mode is unknown', async () => {
  server.setReply({ body: '{"existsWhatsapp":true}', status: 200 });

  expect(await createClient().resolveChatId(PHONE_NUMBER)).toEqual({
    ok: false,
    error: { code: 'invalidResponse' },
  });
  expect(server.requests).toHaveLength(1);
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

  const history = unwrapResult(
    await createClient().getChatHistory(CHAT_ID, new AbortController().signal),
  );

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

test('spaces chat history requests of one instance by the API rate limit', async () => {
  server.setReply({ body: '[]', status: 200 });
  const client = createGreenApiClient(
    MESSENGERS.whatsapp,
    createTestCredentials(server.origin, SPACED_ID_INSTANCE),
  );
  const startedAt = performance.now();

  const { signal } = new AbortController();

  await Promise.all([
    client.getChatHistory(CHAT_ID, signal),
    client.getChatHistory(CHAT_ID, signal),
  ]);

  expect(server.requests).toHaveLength(2);
  expect(performance.now() - startedAt).toBeGreaterThanOrEqual(HISTORY_INTERVAL_MS);
});

test('drops a spaced chat history request aborted while it waits', async () => {
  server.setReply({ body: '[]', status: 200 });
  const client = createGreenApiClient(
    MESSENGERS.whatsapp,
    createTestCredentials(server.origin, ABORTED_ID_INSTANCE),
  );
  const controller = new AbortController();

  await client.getChatHistory(CHAT_ID, controller.signal);
  const waitingRequest = client.getChatHistory(CHAT_ID, controller.signal);
  controller.abort();

  await expect(waitingRequest).rejects.toThrow(expect.objectContaining({ name: 'AbortError' }));
  expect(server.requests).toHaveLength(1);
});

test('does not hold a slot for a chat history request aborted while it waits', async () => {
  server.setReply({ body: '[]', status: 200 });
  const client = createGreenApiClient(
    MESSENGERS.whatsapp,
    createTestCredentials(server.origin, RELEASED_ID_INSTANCE),
  );
  const { signal } = new AbortController();
  const controller = new AbortController();

  await client.getChatHistory(CHAT_ID, signal);
  const startedAt = performance.now();
  const abortedRequest = client.getChatHistory(CHAT_ID, controller.signal);
  controller.abort();
  await expect(abortedRequest).rejects.toThrow(expect.objectContaining({ name: 'AbortError' }));
  await client.getChatHistory(CHAT_ID, signal);

  expect(server.requests).toHaveLength(2);
  expect(performance.now() - startedAt).toBeLessThan(2 * HISTORY_INTERVAL_MS);
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
