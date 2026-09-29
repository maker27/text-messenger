import { afterEach, expect, test, vi } from 'vitest';

import { getLogger } from '@/server/logger';

import { notificationEnvelopeSchema, parseNotification } from './notification';

const INSTANCE_DATA = { idInstance: 1101000001, typeInstance: 'whatsapp', wid: '79000000000@c.us' };

afterEach(() => {
  vi.restoreAllMocks();
});

test('parses an incoming text message', () => {
  const notification = parseNotification(
    {
      body: {
        idMessage: 'IN1',
        instanceData: INSTANCE_DATA,
        messageData: {
          textMessageData: { textMessage: 'Эхо: Привет' },
          typeMessage: 'textMessage',
        },
        senderData: {
          chatId: '79161234567@c.us',
          chatName: 'Эхо-бот',
          sender: '79161234567@c.us',
          senderName: 'Эхо-бот',
        },
        timestamp: 1_700_000_010,
        typeWebhook: 'incomingMessageReceived',
      },
      receiptId: 5,
    },
    'whatsapp',
  );

  expect(notification).toEqual({
    event: {
      message: {
        chatId: '79161234567@c.us',
        direction: 'incoming',
        idMessage: 'IN1',
        senderName: 'Эхо-бот',
        sentAt: 1_700_000_010_000,
        status: null,
        text: 'Эхо: Привет',
      },
      type: 'message',
    },
    receiptId: 5,
    typeInstance: 'whatsapp',
  });
});

test('parses an extended text message', () => {
  const notification = parseNotification(
    {
      body: {
        idMessage: 'IN2',
        instanceData: INSTANCE_DATA,
        messageData: {
          extendedTextMessageData: { text: 'https://example.com' },
          typeMessage: 'extendedTextMessage',
        },
        senderData: { chatId: '79161234567@c.us', senderName: 'Иван' },
        timestamp: 1_700_000_020,
        typeWebhook: 'incomingMessageReceived',
      },
      receiptId: 6,
    },
    'whatsapp',
  );

  expect(notification.event).toMatchObject({ message: { text: 'https://example.com' } });
});

test('parses a quoted reply as a text message', () => {
  const notification = parseNotification(
    {
      body: {
        idMessage: 'IN3',
        instanceData: INSTANCE_DATA,
        messageData: {
          extendedTextMessageData: {
            participant: '79000000000@c.us',
            stanzaId: 'OUT1',
            text: 'Да, согласен',
          },
          typeMessage: 'quotedMessage',
        },
        senderData: { chatId: '79161234567@c.us', senderName: 'Иван' },
        timestamp: 1_700_000_030,
        typeWebhook: 'incomingMessageReceived',
      },
      receiptId: 7,
    },
    'whatsapp',
  );

  expect(notification.event).toMatchObject({ message: { text: 'Да, согласен' } });
});

test('parses an incoming message without a sender name', () => {
  const warn = vi.spyOn(getLogger(), 'warn');

  const notification = parseNotification(
    {
      body: {
        idMessage: 'IN3',
        instanceData: INSTANCE_DATA,
        messageData: { textMessageData: { textMessage: 'Привет' }, typeMessage: 'textMessage' },
        senderData: { chatId: '79161234567@c.us', sender: '79161234567@c.us' },
        timestamp: 1_700_000_040,
        typeWebhook: 'incomingMessageReceived',
      },
      receiptId: 11,
    },
    'whatsapp',
  );

  expect(notification.event).toMatchObject({ message: { senderName: null, text: 'Привет' } });
  expect(warn).not.toHaveBeenCalled();
});

test('parses a message sent from the phone as outgoing without a sender name', () => {
  const notification = parseNotification(
    {
      body: {
        idMessage: 'OUT1',
        instanceData: INSTANCE_DATA,
        messageData: {
          textMessageData: { textMessage: 'С телефона' },
          typeMessage: 'textMessage',
        },
        senderData: {
          chatId: '79161234567@c.us',
          chatName: 'Иван',
          sender: '79000000000@c.us',
          senderName: 'Владелец',
        },
        timestamp: 1_700_000_020,
        typeWebhook: 'outgoingMessageReceived',
      },
      receiptId: 6,
    },
    'whatsapp',
  );

  expect(notification.event).toEqual({
    message: {
      chatId: '79161234567@c.us',
      direction: 'outgoing',
      idMessage: 'OUT1',
      senderName: null,
      sentAt: 1_700_000_020_000,
      status: null,
      text: 'С телефона',
    },
    type: 'message',
  });
});

test('parses an outgoing message status', () => {
  const notification = parseNotification(
    {
      body: {
        chatId: '79161234567@c.us',
        idMessage: 'OUT1',
        instanceData: INSTANCE_DATA,
        sendByApi: true,
        status: 'delivered',
        timestamp: 1_700_000_001,
        typeWebhook: 'outgoingMessageStatus',
      },
      receiptId: 7,
    },
    'whatsapp',
  );

  expect(notification.event).toEqual({
    chatId: '79161234567@c.us',
    idMessage: 'OUT1',
    status: 'delivered',
    type: 'status',
  });
});

test('keeps the receipt id of an irrelevant notification without logging', () => {
  const warn = vi.spyOn(getLogger(), 'warn');

  const notification = parseNotification(
    {
      body: {
        instanceData: INSTANCE_DATA,
        stateInstance: 'authorized',
        typeWebhook: 'stateInstanceChanged',
      },
      receiptId: 8,
    },
    'whatsapp',
  );

  expect(notification).toEqual({ event: null, receiptId: 8, typeInstance: 'whatsapp' });
  expect(warn).not.toHaveBeenCalled();
});

test('keeps the receipt id of a non-text message without logging', () => {
  const warn = vi.spyOn(getLogger(), 'warn');

  const notification = parseNotification(
    {
      body: {
        idMessage: 'IMG1',
        instanceData: INSTANCE_DATA,
        messageData: { typeMessage: 'imageMessage' },
        senderData: { chatId: '79161234567@c.us', senderName: 'Иван' },
        timestamp: 1_700_000_030,
        typeWebhook: 'incomingMessageReceived',
      },
      receiptId: 9,
    },
    'whatsapp',
  );

  expect(notification).toEqual({ event: null, receiptId: 9, typeInstance: 'whatsapp' });
  expect(warn).not.toHaveBeenCalled();
});

test.each([
  { typeWebhook: 'incomingMessageReceived' },
  { messageData: { typeMessage: 'textMessage' }, typeWebhook: 'incomingMessageReceived' },
  'garbage',
  null,
])('keeps the receipt id of a malformed body %j and logs it', (body) => {
  const warn = vi.spyOn(getLogger(), 'warn');

  expect(parseNotification({ body, receiptId: 10 }, 'max')).toEqual({
    event: null,
    receiptId: 10,
    typeInstance: null,
  });
  expect(warn).toHaveBeenCalledWith(
    { code: 'invalidResponse', messenger: 'max', method: 'receiveNotification' },
    'GREEN-API notification is malformed',
  );
});

test('accepts an empty queue and rejects an envelope without a receipt id', () => {
  expect(notificationEnvelopeSchema.parse(null)).toBeNull();
  expect(notificationEnvelopeSchema.safeParse({ body: {} }).success).toBe(false);
  expect(notificationEnvelopeSchema.safeParse({ receiptId: 0, body: {} }).success).toBe(false);
});
