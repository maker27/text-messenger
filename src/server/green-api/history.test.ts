import { expect, test } from 'vitest';

import { parseChatHistory } from './history';

const CHAT_ID = '79161234567@c.us';

test('parses text entries in chronological order', () => {
  const messages = parseChatHistory(CHAT_ID, [
    {
      extendedTextMessage: { text: 'Эхо: Привет' },
      idMessage: 'IN1',
      senderName: 'Эхо-бот',
      timestamp: 1_700_000_010,
      type: 'incoming',
      typeMessage: 'extendedTextMessage',
    },
    {
      idMessage: 'OUT1',
      statusMessage: 'read',
      textMessage: 'Привет',
      timestamp: 1_700_000_000,
      type: 'outgoing',
      typeMessage: 'textMessage',
    },
  ]);

  expect(messages).toEqual([
    {
      chatId: CHAT_ID,
      direction: 'outgoing',
      idMessage: 'OUT1',
      senderName: null,
      sentAt: 1_700_000_000_000,
      status: 'read',
      text: 'Привет',
    },
    {
      chatId: CHAT_ID,
      direction: 'incoming',
      idMessage: 'IN1',
      senderName: 'Эхо-бот',
      sentAt: 1_700_000_010_000,
      status: null,
      text: 'Эхо: Привет',
    },
  ]);
});

test.each(['noAccount', 'notInGroup', 'failed'])('maps %s to failed', (statusMessage) => {
  const [message] = parseChatHistory(CHAT_ID, [
    {
      idMessage: 'OUT1',
      statusMessage,
      textMessage: 'Привет',
      timestamp: 1_700_000_000,
      type: 'outgoing',
      typeMessage: 'textMessage',
    },
  ]);

  expect(message?.status).toBe('failed');
});

test('parses a quoted reply as a text entry', () => {
  expect(
    parseChatHistory(CHAT_ID, [
      {
        extendedTextMessage: { text: 'Да, согласен' },
        idMessage: 'IN2',
        quotedMessage: {
          participant: '79000000000@c.us',
          stanzaId: 'OUT1',
          typeMessage: 'textMessage',
        },
        timestamp: 1_700_000_020,
        type: 'incoming',
        typeMessage: 'quotedMessage',
      },
    ]),
  ).toMatchObject([{ idMessage: 'IN2', text: 'Да, согласен' }]);
});

test('skips incomplete, non-text and malformed entries', () => {
  expect(
    parseChatHistory(CHAT_ID, [
      { idMessage: 'OUT1', timestamp: 1_700_000_000, type: 'outgoing', typeMessage: '' },
      {
        idMessage: 'IMG1',
        timestamp: 1_700_000_000,
        type: 'incoming',
        typeMessage: 'imageMessage',
      },
      { idMessage: 'OUT2', timestamp: 1_700_000_000, type: 'outgoing', typeMessage: 'textMessage' },
      null,
      'garbage',
    ]),
  ).toEqual([]);
});
