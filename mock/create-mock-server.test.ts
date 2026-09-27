import { setTimeout } from 'node:timers/promises';

import { afterEach, beforeEach, expect, test } from 'vitest';

import { createMockServer } from './create-mock-server.ts';

const TOKEN = 'mockToken1';
const WHATSAPP_INSTANCE = '1101000001';
const MAX_INSTANCE = '3100000001';
const WHATSAPP_CHAT_ID = '79161234567@c.us';
const OVERSIZED_BODY_LENGTH = 100 * 1024 + 1;
const QUEUE_OVERFLOW_SEND_COUNT = 34;
const STATUS_SETTLE_MS = 200;
// Echo replies are covered by the client contract test; here they would race with history reads.
const MOCK_OPTIONS = { replyDelayMs: 60_000, statusDelayMs: 5 };

let mock: ReturnType<typeof createMockServer>;
let origin: string;

function getPath(idInstance: string, method: string, token = TOKEN) {
  return `/waInstance${idInstance}/${method}/${token}`;
}

function callMock(path: string, init?: RequestInit) {
  return fetch(new URL(path, origin), init);
}

function postJson(path: string, body: string) {
  return callMock(path, { body, headers: { 'Content-Type': 'application/json' }, method: 'POST' });
}

beforeEach(async () => {
  mock = createMockServer(MOCK_OPTIONS);
  await new Promise<void>((resolve) => {
    mock.server.listen(0, '127.0.0.1', resolve);
  });
  const address = mock.server.address();
  if (typeof address !== 'object' || address === null) {
    throw new Error('Mock server is not listening on a TCP port');
  }
  origin = `http://127.0.0.1:${String(address.port)}`;
});

afterEach(() => mock.close());

test.each([
  ['/unknown', 'GET', 404],
  [getPath('9999000001', 'getStateInstance'), 'GET', 403],
  [getPath(WHATSAPP_INSTANCE, 'getStateInstance', 'bad%2Etoken'), 'GET', 400],
  [getPath(WHATSAPP_INSTANCE, 'unknownMethod'), 'GET', 404],
  [getPath(WHATSAPP_INSTANCE, 'checkAccount'), 'POST', 404],
  [getPath(MAX_INSTANCE, 'checkWhatsapp'), 'POST', 404],
  [`${getPath(WHATSAPP_INSTANCE, 'getStateInstance')}/1`, 'GET', 404],
  [getPath(WHATSAPP_INSTANCE, 'deleteNotification'), 'DELETE', 404],
  [getPath(WHATSAPP_INSTANCE, 'getStateInstance'), 'POST', 405],
])('responds to %s %s with %i', async (path, method, status) => {
  expect((await callMock(path, { method })).status).toBe(status);
});

test('answers the state and settings of an instance', async () => {
  const state = await callMock(getPath(WHATSAPP_INSTANCE, 'getStateInstance'));
  const settings = await callMock(getPath(WHATSAPP_INSTANCE, 'getSettings'));

  expect(await state.json()).toEqual({ stateInstance: 'authorized' });
  expect(await settings.json()).toEqual({
    incomingWebhook: 'yes',
    outgoingWebhook: 'yes',
    webhookUrl: '',
  });
});

test('binds the token on first use and echoes the path in errors', async () => {
  const foreignPath = getPath(WHATSAPP_INSTANCE, 'getStateInstance', 'otherToken');

  expect((await callMock(getPath(WHATSAPP_INSTANCE, 'getStateInstance'))).status).toBe(200);
  const response = await callMock(foreignPath);

  expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({ path: foreignPath, statusCode: 401 });
});

test('rejects oversized, malformed and invalid bodies', async () => {
  const path = getPath(WHATSAPP_INSTANCE, 'sendMessage');

  expect((await postJson(path, 'x'.repeat(OVERSIZED_BODY_LENGTH))).status).toBe(413);
  expect((await postJson(path, '{')).status).toBe(400);
  expect((await postJson(path, '{"chatId":""}')).status).toBe(400);
});

test('requires a content length before reading a body', async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{}'));
      controller.close();
    },
  });

  const response = await callMock(getPath(WHATSAPP_INSTANCE, 'sendMessage'), {
    body,
    duplex: 'half',
    method: 'POST',
  });

  expect(response.status).toBe(411);
});

test.each([
  [79161234567, { chatId: '79161234567', exist: true }],
  [375291234567, { chatId: '375291234567', exist: true }],
  [79160000000, { exist: false }],
  [16502530000, { reason: 'Phone number is not supported', status: false }],
])('answers MAX checkAccount for %i', async (phoneNumber, expected) => {
  const response = await postJson(
    getPath(MAX_INSTANCE, 'checkAccount'),
    JSON.stringify({ phoneNumber }),
  );

  expect(await response.json()).toEqual(expected);
});

test.each([
  [79161234567, { chatId: WHATSAPP_CHAT_ID, existsWhatsapp: true }],
  [79160000000, { existsWhatsapp: false }],
])('answers WhatsApp checkWhatsapp for %i', async (phoneNumber, expected) => {
  const response = await postJson(
    getPath(WHATSAPP_INSTANCE, 'checkWhatsapp'),
    JSON.stringify({ phoneNumber }),
  );

  expect(await response.json()).toEqual(expected);
});

test.each(['4', '61', 'abc'])('rejects receiveTimeout %s', async (receiveTimeout) => {
  const response = await callMock(
    `${getPath(WHATSAPP_INSTANCE, 'receiveNotification')}?receiveTimeout=${receiveTimeout}`,
  );

  expect(response.status).toBe(400);
});

test('wakes a waiting receive with a status and deletes it once', async () => {
  const pending = callMock(`${getPath(WHATSAPP_INSTANCE, 'receiveNotification')}?receiveTimeout=5`);
  const sent = await postJson(
    getPath(WHATSAPP_INSTANCE, 'sendMessage'),
    JSON.stringify({ chatId: WHATSAPP_CHAT_ID, message: 'Привет' }),
  );

  expect(await sent.json()).toHaveProperty('idMessage', expect.stringMatching(/^[0-9A-F]{20}$/));
  expect(await (await pending).json()).toMatchObject({
    body: {
      chatId: WHATSAPP_CHAT_ID,
      instanceData: { typeInstance: 'whatsapp' },
      status: 'sent',
      typeWebhook: 'outgoingMessageStatus',
    },
    receiptId: 1,
  });

  const deletePath = `${getPath(WHATSAPP_INSTANCE, 'deleteNotification')}/1`;
  expect(await (await callMock(deletePath, { method: 'DELETE' })).json()).toEqual({ result: true });
  expect(await (await callMock(deletePath, { method: 'DELETE' })).json()).toMatchObject({
    result: false,
  });
});

test('returns the chat history newest first', async () => {
  const sendPath = getPath(WHATSAPP_INSTANCE, 'sendMessage');
  await postJson(sendPath, JSON.stringify({ chatId: WHATSAPP_CHAT_ID, message: 'Первое' }));
  await postJson(sendPath, JSON.stringify({ chatId: WHATSAPP_CHAT_ID, message: 'Второе' }));

  const response = await postJson(
    getPath(WHATSAPP_INSTANCE, 'getChatHistory'),
    JSON.stringify({ chatId: WHATSAPP_CHAT_ID, count: 1 }),
  );

  expect(await response.json()).toEqual([
    expect.objectContaining({
      textMessage: 'Второе',
      type: 'outgoing',
      typeMessage: 'textMessage',
    }),
  ]);
});

test('keeps the queue head until it is deleted when the queue is full', async () => {
  const sendPath = getPath(WHATSAPP_INSTANCE, 'sendMessage');
  for (let index = 0; index < QUEUE_OVERFLOW_SEND_COUNT; index += 1) {
    await postJson(sendPath, JSON.stringify({ chatId: WHATSAPP_CHAT_ID, message: 'Привет' }));
  }
  await setTimeout(STATUS_SETTLE_MS);

  const response = await callMock(
    `${getPath(WHATSAPP_INSTANCE, 'receiveNotification')}?receiveTimeout=5`,
  );

  expect(await response.json()).toMatchObject({ receiptId: 1 });
});
