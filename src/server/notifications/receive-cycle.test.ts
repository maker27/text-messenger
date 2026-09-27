import { expect, test, vi } from 'vitest';

import { MESSENGERS } from '@/entities/messenger/config';
import type { GreenApiNotification } from '@/server/green-api/notification';
import type { GreenApiError } from '@/shared/errors/model';
import type { Result } from '@/shared/errors/result';

import { runReceiveCycle } from './receive-cycle';

const RECEIPT_ID = 7;
const STATUS_EVENT = {
  chatId: '79001234567@c.us',
  idMessage: 'message-1',
  status: 'read',
  type: 'status',
} as const;

function createClient(
  notification: Result<GreenApiNotification | null, GreenApiError>,
  deletion: Result<boolean, GreenApiError> = { data: true, ok: true },
) {
  return {
    deleteNotification: vi.fn(() => Promise.resolve(deletion)),
    receiveNotification: vi.fn(() => Promise.resolve(notification)),
  };
}

function createNotification(overrides: Partial<GreenApiNotification> = {}) {
  return {
    data: { event: STATUS_EVENT, receiptId: RECEIPT_ID, typeInstance: 'whatsapp', ...overrides },
    ok: true,
  } as const;
}

test('reports an empty queue', async () => {
  const client = createClient({ data: null, ok: true });

  expect(await runReceiveCycle(client, MESSENGERS.whatsapp, new AbortController().signal)).toEqual({
    type: 'idle',
  });
  expect(client.deleteNotification).not.toHaveBeenCalled();
});

test('passes the abort signal to the long poll', async () => {
  const client = createClient({ data: null, ok: true });
  const { signal } = new AbortController();

  await runReceiveCycle(client, MESSENGERS.whatsapp, signal);

  expect(client.receiveNotification).toHaveBeenCalledWith(signal);
});

test('deletes a received notification and delivers its event', async () => {
  const client = createClient(createNotification());

  expect(await runReceiveCycle(client, MESSENGERS.whatsapp, new AbortController().signal)).toEqual({
    event: STATUS_EVENT,
    type: 'received',
  });
  expect(client.deleteNotification).toHaveBeenCalledWith(RECEIPT_ID);
});

test('deletes an irrelevant notification', async () => {
  const client = createClient(createNotification({ event: null }));

  expect(await runReceiveCycle(client, MESSENGERS.whatsapp, new AbortController().signal)).toEqual({
    event: null,
    type: 'received',
  });
  expect(client.deleteNotification).toHaveBeenCalledWith(RECEIPT_ID);
});

test('deletes a notification from an instance of another messenger', async () => {
  const client = createClient(createNotification({ typeInstance: 'telegram' }));

  expect(await runReceiveCycle(client, MESSENGERS.whatsapp, new AbortController().signal)).toEqual({
    type: 'mismatch',
  });
  expect(client.deleteNotification).toHaveBeenCalledWith(RECEIPT_ID);
});

test('trusts a notification without an instance type', async () => {
  const client = createClient(createNotification({ typeInstance: null }));

  expect(await runReceiveCycle(client, MESSENGERS.max, new AbortController().signal)).toEqual({
    event: STATUS_EVENT,
    type: 'received',
  });
});

test('reports a failed deletion so the poller backs off', async () => {
  const client = createClient(createNotification(), {
    error: { code: 'network' },
    ok: false,
  });

  expect(await runReceiveCycle(client, MESSENGERS.whatsapp, new AbortController().signal)).toEqual({
    error: { code: 'network' },
    type: 'failed',
  });
});

test('reports a failed long poll', async () => {
  const client = createClient({ error: { code: 'unauthorized' }, ok: false });

  expect(await runReceiveCycle(client, MESSENGERS.whatsapp, new AbortController().signal)).toEqual({
    error: { code: 'unauthorized' },
    type: 'failed',
  });
  expect(client.deleteNotification).not.toHaveBeenCalled();
});
