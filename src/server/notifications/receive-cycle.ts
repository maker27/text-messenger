import 'server-only';

import type { MessengerConfig } from '@/entities/messenger/model';
import type { createGreenApiClient } from '@/server/green-api/client';
import type { NotificationEvent } from '@/server/green-api/notification';
import type { GreenApiError } from '@/shared/errors/model';

export type ReceiveClient = Pick<
  ReturnType<typeof createGreenApiClient>,
  'deleteNotification' | 'receiveNotification'
>;

export type ReceiveCycleOutcome =
  | { type: 'idle' }
  | { event: NotificationEvent | null; type: 'received' }
  | { type: 'mismatch' }
  | { error: GreenApiError; type: 'failed' };

export async function runReceiveCycle(
  client: ReceiveClient,
  messenger: MessengerConfig,
  signal: AbortSignal,
): Promise<ReceiveCycleOutcome> {
  const notification = await client.receiveNotification(signal);
  if (!notification.ok) {
    return { error: notification.error, type: 'failed' };
  }
  if (notification.data === null) {
    return { type: 'idle' };
  }

  const { event, receiptId, typeInstance } = notification.data;
  // The queue redelivers an undeleted notification at once, so the poller must back off first.
  const deletion = await client.deleteNotification(receiptId);
  if (!deletion.ok) {
    return { error: deletion.error, type: 'failed' };
  }
  if (!deletion.data) {
    return { error: { code: 'upstream' }, type: 'failed' };
  }
  if (typeInstance !== null && typeInstance !== messenger.typeInstance) {
    return { type: 'mismatch' };
  }
  return { event, type: 'received' };
}
