import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { MESSENGERS } from '@/entities/messenger/config';
import type { GreenApiNotification, NotificationEvent } from '@/server/green-api/notification';
import type { GreenApiError } from '@/shared/errors/model';
import type { Result } from '@/shared/errors/result';

import { startPoller, type ConnectionState } from './poller';

type ReceiveResult = Result<GreenApiNotification | null, GreenApiError>;

const MAX_RANDOM = 1;
const NETWORK_FAILURE: ReceiveResult = { error: { code: 'network' }, ok: false };
const EMPTY_QUEUE: ReceiveResult = { data: null, ok: true };
const STATUS_EVENT: NotificationEvent = {
  chatId: '79001234567@c.us',
  idMessage: 'message-1',
  status: 'read',
  type: 'status',
};

function waitForAbort(signal: AbortSignal) {
  return new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () => {
      reject(new Error('aborted'));
    });
  });
}

function createNotification(overrides: Partial<GreenApiNotification> = {}): ReceiveResult {
  return {
    data: { event: STATUS_EVENT, receiptId: 1, typeInstance: 'whatsapp', ...overrides },
    ok: true,
  };
}

function startTestPoller(replies: (ReceiveResult | Error)[], random = () => MAX_RANDOM) {
  const queue = [...replies];
  const connectionStates: ConnectionState[] = [];
  const retryDelays: number[] = [];
  const signals: AbortSignal[] = [];
  const client = {
    deleteNotification: vi.fn(() =>
      Promise.resolve<Result<boolean, GreenApiError>>({ data: true, ok: true }),
    ),
    receiveNotification: vi.fn((signal: AbortSignal) => {
      signals.push(signal);
      const reply = queue.shift();
      if (reply === undefined) {
        return waitForAbort(signal);
      }
      return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply);
    }),
  };
  const onEvent = vi.fn();
  const poller = startPoller({
    client,
    messenger: MESSENGERS.whatsapp,
    onConnection: (state) => {
      connectionStates.push(state);
      if (state.status === 'reconnecting') {
        retryDelays.push(state.retryAt - Date.now());
      }
    },
    onEvent,
    random,
  });

  return { client, connectionStates, onEvent, poller, retryDelays, signals };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('doubles the retry delay up to thirty seconds', async () => {
  const expectedDelays = [1000, 2000, 4000, 8000, 16_000, 30_000, 30_000];
  const { retryDelays } = startTestPoller(expectedDelays.map(() => NETWORK_FAILURE));

  await vi.runAllTimersAsync();

  expect(retryDelays).toEqual(expectedDelays);
});

test('keeps at least half of the delay as jitter', async () => {
  const { retryDelays } = startTestPoller([NETWORK_FAILURE, NETWORK_FAILURE], () => 0);

  await vi.runAllTimersAsync();

  expect(retryDelays).toEqual([500, 1000]);
});

test('waits before retrying', async () => {
  const { client } = startTestPoller([NETWORK_FAILURE]);
  await vi.advanceTimersByTimeAsync(999);

  expect(client.receiveNotification).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(client.receiveNotification).toHaveBeenCalledTimes(2);
});

test('resets the retry delay after a successful poll', async () => {
  const { connectionStates, retryDelays } = startTestPoller([
    NETWORK_FAILURE,
    NETWORK_FAILURE,
    EMPTY_QUEUE,
    NETWORK_FAILURE,
  ]);

  await vi.runAllTimersAsync();

  expect(retryDelays).toEqual([1000, 2000, 1000]);
  expect(connectionStates.map(({ status }) => status)).toEqual([
    'reconnecting',
    'reconnecting',
    'online',
    'reconnecting',
  ]);
});

test('honours the delay the server asks for', async () => {
  const { retryDelays } = startTestPoller([
    { error: { code: 'rateLimited', retryAfter: 45 }, ok: false },
    { error: { code: 'rateLimited', retryAfter: null }, ok: false },
  ]);

  await vi.runAllTimersAsync();

  expect(retryDelays).toEqual([45_000, 2000]);
});

test('retries after an unexpected failure', async () => {
  const { retryDelays } = startTestPoller([new Error('bug')]);

  await vi.runAllTimersAsync();

  expect(retryDelays).toEqual([1000]);
});

test('starts online and announces only changes', async () => {
  const { connectionStates } = startTestPoller([EMPTY_QUEUE, EMPTY_QUEUE]);

  await vi.runAllTimersAsync();

  expect(connectionStates).toEqual([]);
});

test('delivers received events', async () => {
  const { onEvent } = startTestPoller([createNotification(), createNotification({ event: null })]);

  await vi.runAllTimersAsync();

  expect(onEvent.mock.calls).toEqual([[STATUS_EVENT]]);
});

test('stops for good on a rejected token', async () => {
  const { client, connectionStates } = startTestPoller([
    { error: { code: 'unauthorized' }, ok: false },
  ]);

  await vi.runAllTimersAsync();

  expect(connectionStates.at(-1)).toEqual({ status: 'unauthorized' });
  expect(client.receiveNotification).toHaveBeenCalledTimes(1);
});

test('stops when the instance sends notifications to a webhook', async () => {
  const { client, connectionStates } = startTestPoller([
    { error: { code: 'webhookConfigured' }, ok: false },
  ]);

  await vi.runAllTimersAsync();

  expect(connectionStates.at(-1)).toEqual({ code: 'webhookConfigured', status: 'stopped' });
  expect(client.receiveNotification).toHaveBeenCalledTimes(1);
});

test('stops on a notification from an instance of another messenger', async () => {
  const { client, connectionStates, onEvent } = startTestPoller([
    createNotification({ typeInstance: 'telegram' }),
  ]);

  await vi.runAllTimersAsync();

  expect(connectionStates.at(-1)).toEqual({ code: 'instanceTypeMismatch', status: 'stopped' });
  expect(client.receiveNotification).toHaveBeenCalledTimes(1);
  expect(onEvent).not.toHaveBeenCalled();
});

test('aborts the long poll on stop', () => {
  const { connectionStates, poller, signals } = startTestPoller([]);

  poller.stop();

  expect(signals.map(({ aborted }) => aborted)).toEqual([true]);
  expect(connectionStates.at(-1)).toEqual({ code: null, status: 'stopped' });
});

test('cancels the pending retry on stop', async () => {
  const { client, poller } = startTestPoller([NETWORK_FAILURE]);
  await vi.advanceTimersByTimeAsync(0);

  poller.stop();
  await vi.runAllTimersAsync();

  expect(client.receiveNotification).toHaveBeenCalledTimes(1);
});
