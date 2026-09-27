import 'server-only';

import type { MessageStatus } from '@/entities/message/model';

const MILLISECONDS_IN_SECOND = 1000;

const UPSTREAM_MESSAGE_STATUSES = new Map<string, MessageStatus>([
  ['delivered', 'delivered'],
  ['failed', 'failed'],
  ['noAccount', 'failed'],
  ['notInGroup', 'failed'],
  ['read', 'read'],
  ['sent', 'sent'],
]);

export function toMessageStatus(status: string) {
  return UPSTREAM_MESSAGE_STATUSES.get(status) ?? null;
}

export function toMilliseconds(seconds: number) {
  return seconds * MILLISECONDS_IN_SECOND;
}
