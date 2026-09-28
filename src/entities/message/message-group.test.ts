import { expect, test } from 'vitest';

import { getMessageGroupPosition } from './message-group';
import type { ChatMessage } from './model';

const BASE_TIME = Date.parse('2026-01-01T12:00:00.000Z');

function buildMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    chatId: 'chat-1',
    direction: 'incoming',
    idMessage: 'id-1',
    senderName: null,
    sentAt: BASE_TIME,
    status: null,
    text: 'hello',
    ...overrides,
  };
}

test('marks a lone message as single', () => {
  const messages = [buildMessage({ idMessage: '1' })];

  expect(getMessageGroupPosition(messages, 0)).toBe('single');
});

test('marks the first message of a same-direction run as first', () => {
  const messages = [
    buildMessage({ idMessage: '1', sentAt: BASE_TIME }),
    buildMessage({ idMessage: '2', sentAt: BASE_TIME + 1_000 }),
  ];

  expect(getMessageGroupPosition(messages, 0)).toBe('first');
});

test('marks the last message of a same-direction run as last', () => {
  const messages = [
    buildMessage({ idMessage: '1', sentAt: BASE_TIME }),
    buildMessage({ idMessage: '2', sentAt: BASE_TIME + 1_000 }),
  ];

  expect(getMessageGroupPosition(messages, 1)).toBe('last');
});

test('marks a message surrounded by the same direction as middle', () => {
  const messages = [
    buildMessage({ idMessage: '1', sentAt: BASE_TIME }),
    buildMessage({ idMessage: '2', sentAt: BASE_TIME + 1_000 }),
    buildMessage({ idMessage: '3', sentAt: BASE_TIME + 2_000 }),
  ];

  expect(getMessageGroupPosition(messages, 1)).toBe('middle');
});

test('splits the group when direction changes', () => {
  const messages = [
    buildMessage({ idMessage: '1', direction: 'incoming', sentAt: BASE_TIME }),
    buildMessage({ idMessage: '2', direction: 'outgoing', sentAt: BASE_TIME + 1_000 }),
  ];

  expect(getMessageGroupPosition(messages, 0)).toBe('single');
  expect(getMessageGroupPosition(messages, 1)).toBe('single');
});

test('splits the group when the gap between messages is too large', () => {
  const messages = [
    buildMessage({ idMessage: '1', sentAt: BASE_TIME }),
    buildMessage({ idMessage: '2', sentAt: BASE_TIME + 10 * 60 * 1_000 }),
  ];

  expect(getMessageGroupPosition(messages, 0)).toBe('single');
  expect(getMessageGroupPosition(messages, 1)).toBe('single');
});
