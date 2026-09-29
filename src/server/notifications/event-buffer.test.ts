import { expect, test } from 'vitest';

import type { MessageStatus } from '@/entities/message/model';

import { createEventBuffer } from './event-buffer';

const CAPACITY = 3;
const CHAT_ID = '79001234567@c.us';
const OTHER_CHAT_ID = '79001234568@c.us';

function createMessageEvent(idMessage: string, chatId = CHAT_ID) {
  return {
    message: {
      chatId,
      direction: 'incoming',
      idMessage,
      senderName: null,
      sentAt: 0,
      status: null,
      text: 'Hello',
    },
    type: 'message',
  } as const;
}

function createStatusEvent(idMessage: string, status: MessageStatus, chatId = CHAT_ID) {
  return { chatId, idMessage, status, type: 'status' } as const;
}

function appendMessages(buffer: ReturnType<typeof createEventBuffer>, count: number) {
  return Array.from({ length: count }, (_, index) =>
    buffer.append(createMessageEvent(`message-${String(index)}`)),
  );
}

test('numbers events from one without gaps', () => {
  const buffer = createEventBuffer(CAPACITY);

  expect(appendMessages(buffer, 2).map((buffered) => buffered?.seq)).toEqual([1, 2]);
  expect(buffer.lastSeq).toBe(2);
});

test('starts empty', () => {
  const buffer = createEventBuffer(CAPACITY);

  expect(buffer.lastSeq).toBe(0);
  expect(buffer.readAfter(0)).toEqual({ data: [], ok: true });
});

test('drops a repeated message', () => {
  const buffer = createEventBuffer(CAPACITY);
  buffer.append(createMessageEvent('message-1'));

  expect(buffer.append(createMessageEvent('message-1'))).toBeNull();
  expect(buffer.lastSeq).toBe(1);
});

test('drops a repeated status but keeps a new status of the same message', () => {
  const buffer = createEventBuffer(CAPACITY);
  buffer.append(createStatusEvent('message-1', 'sent'));

  expect(buffer.append(createStatusEvent('message-1', 'sent'))).toBeNull();
  expect(buffer.append(createStatusEvent('message-1', 'delivered'))).toEqual({
    event: createStatusEvent('message-1', 'delivered'),
    seq: 2,
  });
});

test('keeps messages with the same id from different chats', () => {
  const buffer = createEventBuffer(CAPACITY);
  buffer.append(createMessageEvent('message-1'));

  expect(buffer.append(createMessageEvent('message-1', OTHER_CHAT_ID))).toMatchObject({ seq: 2 });
});

test('keeps statuses with the same message id from different chats', () => {
  const buffer = createEventBuffer(CAPACITY);
  buffer.append(createStatusEvent('message-1', 'sent'));

  expect(buffer.append(createStatusEvent('message-1', 'sent', OTHER_CHAT_ID))).toMatchObject({
    seq: 2,
  });
});

test('keeps a status apart from a message with the same id', () => {
  const buffer = createEventBuffer(CAPACITY);
  buffer.append(createMessageEvent('message-1'));

  expect(buffer.append(createStatusEvent('message-1', 'read'))).toMatchObject({ seq: 2 });
});

test('reads the events after a sequence number', () => {
  const buffer = createEventBuffer(CAPACITY);
  const [, second, third] = appendMessages(buffer, CAPACITY);

  expect(buffer.readAfter(1)).toEqual({ data: [second, third], ok: true });
  expect(buffer.readAfter(buffer.lastSeq)).toEqual({ data: [], ok: true });
});

test('evicts the oldest events and reports a gap before them', () => {
  const buffer = createEventBuffer(CAPACITY);
  const events = appendMessages(buffer, CAPACITY + 1);

  expect(buffer.readAfter(1)).toEqual({ data: events.slice(1), ok: true });
  expect(buffer.readAfter(0)).toEqual({ error: { code: 'gap' }, ok: false });
});

test('accepts an evicted event again', () => {
  const buffer = createEventBuffer(CAPACITY);
  appendMessages(buffer, CAPACITY + 1);

  expect(buffer.append(createMessageEvent('message-0'))).toMatchObject({ seq: CAPACITY + 2 });
});

test('accepts an evicted status again', () => {
  const buffer = createEventBuffer(CAPACITY);
  buffer.append(createStatusEvent('message-0', 'sent'));
  appendMessages(buffer, CAPACITY);

  expect(buffer.append(createStatusEvent('message-0', 'sent'))).toMatchObject({
    seq: CAPACITY + 2,
  });
});

test('reports a gap for a sequence number from the future', () => {
  const buffer = createEventBuffer(CAPACITY);
  appendMessages(buffer, 1);

  expect(buffer.readAfter(2)).toEqual({ error: { code: 'gap' }, ok: false });
});
