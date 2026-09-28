import { expect, test } from 'vitest';

import { streamMessageSchemas } from './stream-schemas';

const MESSAGE_FRAME = {
  chatId: '79161234567@c.us',
  direction: 'incoming',
  idMessage: 'BAE5F4886AE4B1A2',
  senderName: 'Анна',
  sentAt: 1_700_000_000_000,
  text: 'Привет',
};

test('parses a message frame into a chat message without status', () => {
  expect(streamMessageSchemas.message.parse(MESSAGE_FRAME)).toStrictEqual({
    ...MESSAGE_FRAME,
    status: null,
  });
});

test('rejects a message frame without idMessage', () => {
  const frame = { ...MESSAGE_FRAME, idMessage: undefined };

  expect(streamMessageSchemas.message.safeParse(frame).success).toBe(false);
});

test('drops unknown fields of a message frame', () => {
  expect(
    streamMessageSchemas.message.parse({ ...MESSAGE_FRAME, apiTokenInstance: 'secret' }),
  ).not.toHaveProperty('apiTokenInstance');
});

test('parses a status frame', () => {
  const frame = { chatId: MESSAGE_FRAME.chatId, idMessage: 'BAE5', status: 'read' };

  expect(streamMessageSchemas.status.parse(frame)).toStrictEqual(frame);
});

test('rejects a status frame with an unknown status', () => {
  expect(
    streamMessageSchemas.status.safeParse({
      chatId: MESSAGE_FRAME.chatId,
      idMessage: 'BAE5',
      status: 'seen',
    }).success,
  ).toBe(false);
});

test.each([
  { status: 'online' },
  { status: 'unauthorized' },
  { retryAt: 1_700_000_000_000, status: 'reconnecting' },
  { code: 'instanceTypeMismatch', status: 'stopped' },
  { code: null, status: 'stopped' },
])('parses the $status connection frame', (frame) => {
  expect(streamMessageSchemas.connection.parse(frame)).toStrictEqual(frame);
});

test('rejects a reconnecting frame without retryAt', () => {
  expect(streamMessageSchemas.connection.safeParse({ status: 'reconnecting' }).success).toBe(false);
});

test('rejects a connection frame the server never sends', () => {
  expect(streamMessageSchemas.connection.safeParse({ status: 'connecting' }).success).toBe(false);
});
