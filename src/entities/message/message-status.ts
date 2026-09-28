import type { MessageStatus } from './model';

const STATUS_RANK = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
} satisfies Record<Exclude<MessageStatus, 'failed'>, number>;

export function mergeMessageStatus(
  current: MessageStatus | null,
  next: MessageStatus,
): MessageStatus {
  if (current === null) {
    return next;
  }

  if (current === 'failed') {
    return current;
  }

  if (next === 'failed') {
    return STATUS_RANK[current] <= STATUS_RANK.sent ? next : current;
  }

  return STATUS_RANK[next] > STATUS_RANK[current] ? next : current;
}
