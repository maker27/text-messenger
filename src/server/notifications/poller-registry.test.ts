import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { MESSENGERS } from '@/entities/messenger/config';
import { createApiUrlSchema } from '@/server/green-api/api-url';
import { apiTokenInstanceSchema, idInstanceSchema } from '@/server/green-api/credentials';
import type { NotificationEvent } from '@/server/green-api/notification';
import type { Session } from '@/server/session/session';

import type { ConnectionState, startPoller } from './poller';
import { createPollerRegistry, getPollerKey, type StreamMessage } from './poller-registry';

type PollerOptions = Parameters<typeof startPoller>[0];

const MOCK_ORIGIN = 'http://127.0.0.1:3100';
const ID_INSTANCE = '1101000001';
const FIRST_TOKEN = 'firstToken1';
const SECOND_TOKEN = 'secondToken2';
const STOP_DELAY_MS = 30_000;
const RECONNECTING: ConnectionState = { retryAt: 1000, status: 'reconnecting' };

function createSession(sessionId: string, apiTokenInstance = FIRST_TOKEN): Session {
  return {
    credentials: {
      apiTokenInstance: apiTokenInstanceSchema.parse(apiTokenInstance),
      apiUrl: createApiUrlSchema({ isRealModeEnabled: true, mockUrl: MOCK_ORIGIN }).parse(
        MOCK_ORIGIN,
      ),
      idInstance: idInstanceSchema.parse(ID_INSTANCE),
    },
    messengerId: 'whatsapp',
    mode: 'real',
    sessionId,
  };
}

function createStatusEvent(idMessage: string): NotificationEvent {
  return { chatId: '79001234567@c.us', idMessage, status: 'read', type: 'status' };
}

function createStream(lastEventId: number | null = null) {
  const messages: StreamMessage[] = [];

  return {
    close: vi.fn(),
    lastEventId,
    messages,
    send: (message: StreamMessage) => {
      messages.push(message);
    },
  };
}

function getSequenceNumbers(messages: StreamMessage[]) {
  return messages.flatMap((message) => (message.type === 'event' ? [message.event.seq] : []));
}

function createRegistry() {
  const pollers: { options: PollerOptions; stop: () => void }[] = [];
  const registry = createPollerRegistry({
    startPoller: (options) => {
      const poller = {
        options,
        stop: vi.fn(() => {
          options.onConnection({ code: null, status: 'stopped' });
        }),
      };
      pollers.push(poller);
      return poller;
    },
    stopDelayMs: STOP_DELAY_MS,
  });

  function getPoller(index: number) {
    const poller = pollers[index];
    if (poller === undefined) {
      throw new Error(`Poller ${String(index)} was not started`);
    }
    return poller;
  }

  function emitEvents(...idMessages: string[]) {
    for (const idMessage of idMessages) {
      getPoller(0).options.onEvent(createStatusEvent(idMessage));
    }
  }

  return { emitEvents, getPoller, pollers, registry };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('keeps the token out of the poller key', () => {
  const key = getPollerKey(createSession('session-a'));

  expect(key).toContain(`whatsapp:${MOCK_ORIGIN}:${ID_INSTANCE}:`);
  expect(key).not.toContain(FIRST_TOKEN);
  expect(getPollerKey(createSession('session-b', SECOND_TOKEN))).not.toBe(key);
});

test('shares one poller between streams of one session', () => {
  const { getPoller, pollers, registry } = createRegistry();

  registry.subscribe(createSession('session-a'), createStream());
  registry.subscribe(createSession('session-a'), createStream());

  expect(pollers).toHaveLength(1);
  expect(getPoller(0).options.messenger).toBe(MESSENGERS.whatsapp);
});

test('starts a separate poller for another token of the same instance', () => {
  const { pollers, registry } = createRegistry();

  registry.subscribe(createSession('session-a'), createStream());
  registry.subscribe(createSession('session-b', SECOND_TOKEN), createStream());

  expect(pollers).toHaveLength(2);
});

test('sends the current connection state first', () => {
  const { getPoller, registry } = createRegistry();
  const firstStream = createStream();
  registry.subscribe(createSession('session-a'), firstStream);
  getPoller(0).options.onConnection(RECONNECTING);
  const secondStream = createStream();

  registry.subscribe(createSession('session-a'), secondStream);

  expect(firstStream.messages).toEqual([
    { state: { status: 'online' }, type: 'connection' },
    { state: RECONNECTING, type: 'connection' },
  ]);
  expect(secondStream.messages).toEqual([{ state: RECONNECTING, type: 'connection' }]);
});

test('delivers each new event once to every stream', () => {
  const { emitEvents, registry } = createRegistry();
  const streams = [createStream(), createStream()];
  for (const stream of streams) {
    registry.subscribe(createSession('session-a'), stream);
  }

  emitEvents('message-1', 'message-1');

  for (const stream of streams) {
    expect(stream.messages.at(-1)).toEqual({
      event: { event: createStatusEvent('message-1'), seq: 1 },
      type: 'event',
    });
    expect(getSequenceNumbers(stream.messages)).toEqual([1]);
  }
});

test('replays the events after the last event id', () => {
  const { emitEvents, registry } = createRegistry();
  registry.subscribe(createSession('session-a'), createStream());
  emitEvents('message-1', 'message-2', 'message-3');
  const stream = createStream(1);

  registry.subscribe(createSession('session-a'), stream);

  expect(getSequenceNumbers(stream.messages)).toEqual([2, 3]);
});

test('does not replay events from before the session joined', () => {
  const { emitEvents, registry } = createRegistry();
  registry.subscribe(createSession('session-a'), createStream());
  emitEvents('message-1', 'message-2');
  const lateStream = createStream(0);

  registry.subscribe(createSession('session-b'), lateStream);
  emitEvents('message-3');
  const reconnectedStream = createStream(0);
  registry.subscribe(createSession('session-b'), reconnectedStream);

  expect(getSequenceNumbers(lateStream.messages)).toEqual([3]);
  expect(getSequenceNumbers(reconnectedStream.messages)).toEqual([3]);
});

test('asks to resync when the missed events are gone', () => {
  const { registry } = createRegistry();
  const stream = createStream(99);

  registry.subscribe(createSession('session-a'), stream);

  expect(stream.messages.at(-1)).toEqual({ type: 'resync' });
});

test('stops the poller after the last stream leaves', () => {
  const { getPoller, registry } = createRegistry();
  const unsubscribe = registry.subscribe(createSession('session-a'), createStream());

  unsubscribe();
  vi.advanceTimersByTime(STOP_DELAY_MS - 1);

  expect(getPoller(0).stop).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(getPoller(0).stop).toHaveBeenCalledTimes(1);
});

test('keeps the poller when a stream returns within the stop delay', () => {
  const { getPoller, pollers, registry } = createRegistry();
  const unsubscribe = registry.subscribe(createSession('session-a'), createStream());
  unsubscribe();
  vi.advanceTimersByTime(STOP_DELAY_MS - 1);

  registry.subscribe(createSession('session-a'), createStream());
  vi.advanceTimersByTime(STOP_DELAY_MS);

  expect(getPoller(0).stop).not.toHaveBeenCalled();
  expect(pollers).toHaveLength(1);
});

test('closes the streams of a disconnected session and stops its last poller', () => {
  const { getPoller, registry } = createRegistry();
  const streams = [createStream(), createStream()];
  for (const stream of streams) {
    registry.subscribe(createSession('session-a'), stream);
  }

  registry.disconnectSession(createSession('session-a'));

  for (const stream of streams) {
    expect(stream.close).toHaveBeenCalledTimes(1);
  }
  expect(getPoller(0).stop).toHaveBeenCalledTimes(1);
});

test('keeps the poller for other sessions after a disconnect', () => {
  const { emitEvents, getPoller, registry } = createRegistry();
  const firstStream = createStream();
  const otherStream = createStream();
  registry.subscribe(createSession('session-a'), firstStream);
  registry.subscribe(createSession('session-b'), otherStream);
  emitEvents('message-1');

  registry.disconnectSession(createSession('session-a'));
  const returnedStream = createStream(0);
  registry.subscribe(createSession('session-a'), returnedStream);

  expect(firstStream.close).toHaveBeenCalledTimes(1);
  expect(otherStream.close).not.toHaveBeenCalled();
  expect(getPoller(0).stop).not.toHaveBeenCalled();
  expect(getSequenceNumbers(returnedStream.messages)).toEqual([]);
});

test('stops the poller at once on a disconnect during the stop delay', () => {
  const { getPoller, registry } = createRegistry();
  const unsubscribe = registry.subscribe(createSession('session-a'), createStream());
  unsubscribe();

  registry.disconnectSession(createSession('session-a'));

  expect(getPoller(0).stop).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

test('ignores a stream that leaves after it was closed', () => {
  const { registry } = createRegistry();
  const unsubscribe = registry.subscribe(createSession('session-a'), createStream());
  registry.subscribe(createSession('session-b'), createStream());
  registry.disconnectSession(createSession('session-a'));

  unsubscribe();

  expect(vi.getTimerCount()).toBe(0);
});

test('closes the streams of an ended poller and starts a fresh one on return', () => {
  const { getPoller, pollers, registry } = createRegistry();
  const stream = createStream();
  registry.subscribe(createSession('session-a'), stream);

  getPoller(0).options.onConnection({ status: 'unauthorized' });
  registry.subscribe(createSession('session-a'), createStream());

  expect(stream.messages.at(-1)).toEqual({ state: { status: 'unauthorized' }, type: 'connection' });
  expect(stream.close).toHaveBeenCalledTimes(1);
  expect(pollers).toHaveLength(2);
});

test('keeps no stop timer when an ended stream leaves from its close', () => {
  const { getPoller, registry } = createRegistry();
  const stream = createStream();
  const unsubscribe = registry.subscribe(createSession('session-a'), stream);
  stream.close.mockImplementation(unsubscribe);

  getPoller(0).options.onConnection({ status: 'unauthorized' });

  expect(stream.close).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
