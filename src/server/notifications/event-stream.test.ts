import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { ChatMessage } from '@/entities/message/model';

import { createClosedEventStream, createEventStream } from './event-stream';
import type { StreamMessage } from './poller-registry';

type StreamListener = Parameters<Parameters<typeof createEventStream>[0]>[0];

const HEARTBEAT_INTERVAL_MS = 15_000;
const CHAT_ID = '79001234567@c.us';
const INCOMING_MESSAGE: ChatMessage = {
  chatId: CHAT_ID,
  direction: 'incoming',
  idMessage: 'message-1',
  senderName: 'Alice',
  sentAt: 1_700_000_000_000,
  status: null,
  text: 'Hi\nthere',
};

function startStream() {
  const abortController = new AbortController();
  const listeners: StreamListener[] = [];
  const subscribe = vi.fn((listener: StreamListener) => {
    listeners.push(listener);
    return unsubscribe;
  });
  const unsubscribe = vi.fn();
  const response = createEventStream(subscribe, abortController.signal);

  function getListener() {
    const listener = listeners[0];
    if (listener === undefined) {
      throw new Error('The stream did not subscribe');
    }
    return listener;
  }

  function sendAndClose(...messages: StreamMessage[]) {
    const listener = getListener();
    for (const message of messages) {
      listener.send(message);
    }
    listener.close();
    return response.text();
  }

  return { abortController, getListener, response, sendAndClose, subscribe, unsubscribe };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('responds with an unbuffered event stream', () => {
  const { response } = startStream();

  expect(Object.fromEntries(response.headers)).toEqual({
    'cache-control': 'no-store, no-transform',
    'content-type': 'text/event-stream; charset=utf-8',
    'x-accel-buffering': 'no',
  });
});

test('writes chat events with their sequence number', async () => {
  const { sendAndClose } = startStream();

  const text = await sendAndClose(
    { event: { event: { message: INCOMING_MESSAGE, type: 'message' }, seq: 3 }, type: 'event' },
    {
      event: {
        event: { chatId: CHAT_ID, idMessage: 'message-2', status: 'read', type: 'status' },
        seq: 4,
      },
      type: 'event',
    },
  );

  expect(text).toBe(
    [
      'id: 3',
      'event: message',
      'data: {"chatId":"79001234567@c.us","direction":"incoming","idMessage":"message-1","senderName":"Alice","sentAt":1700000000000,"text":"Hi\\nthere"}',
      '',
      'id: 4',
      'event: status',
      'data: {"chatId":"79001234567@c.us","idMessage":"message-2","status":"read"}',
      '',
      '',
    ].join('\n'),
  );
});

test('writes connection and resync frames without an id', async () => {
  const { sendAndClose } = startStream();

  const text = await sendAndClose(
    { state: { retryAt: 1000, status: 'reconnecting' }, type: 'connection' },
    { type: 'resync' },
  );

  expect(text).toBe(
    'event: connection\ndata: {"retryAt":1000,"status":"reconnecting"}\n\nevent: resync\ndata: {}\n\n',
  );
});

test('pings every fifteen seconds', async () => {
  const { sendAndClose } = startStream();

  vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 2 - 1);

  expect(await sendAndClose()).toBe(': ping\n\n');
});

test('unsubscribes and stops pinging when the request is aborted', async () => {
  const { abortController, response, unsubscribe } = startStream();

  abortController.abort();

  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
  expect(await response.text()).toBe('');
});

test('unsubscribes when the reader cancels the stream', async () => {
  const { response, unsubscribe } = startStream();

  await response.body?.cancel();

  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

test('unsubscribes once when the subscription closes a cancelled stream', async () => {
  const { getListener, response, unsubscribe } = startStream();
  await response.body?.cancel();

  getListener().close();

  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test('ignores messages after the subscription closes the stream', async () => {
  const { getListener, response, unsubscribe } = startStream();
  getListener().close();

  getListener().send({ type: 'resync' });

  expect(await response.text()).toBe('');
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

test('does not subscribe for an already aborted request', async () => {
  const abortController = new AbortController();
  const subscribe = vi.fn(() => vi.fn());
  abortController.abort();

  const response = createEventStream(subscribe, abortController.signal);

  expect(await response.text()).toBe('');
  expect(subscribe).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

test('writes a single message and ends a closed stream', async () => {
  const response = createClosedEventStream({ type: 'resync' });

  expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
  expect(await response.text()).toBe('event: resync\ndata: {}\n\n');
});
