import 'server-only';

import type { NotificationEvent } from '@/server/green-api/notification';
import type { Result } from '@/shared/errors/result';

export interface BufferedEvent {
  event: NotificationEvent;
  seq: number;
}

interface EventGapError {
  code: 'gap';
}

function getDeduplicationKey(event: NotificationEvent) {
  return event.type === 'message'
    ? `message:${event.message.chatId}:${event.message.idMessage}`
    : `status:${event.chatId}:${event.idMessage}:${event.status}`;
}

export function createEventBuffer(capacity: number) {
  const bufferedEvents: BufferedEvent[] = [];
  const deduplicationKeys = new Set<string>();
  let lastSeq = 0;

  function evictOldest() {
    const evicted = bufferedEvents.shift();
    if (evicted !== undefined) {
      deduplicationKeys.delete(getDeduplicationKey(evicted.event));
    }
  }

  function append(event: NotificationEvent): BufferedEvent | null {
    const key = getDeduplicationKey(event);
    if (deduplicationKeys.has(key)) {
      return null;
    }

    lastSeq += 1;
    const bufferedEvent = { event, seq: lastSeq };
    bufferedEvents.push(bufferedEvent);
    deduplicationKeys.add(key);
    if (bufferedEvents.length > capacity) {
      evictOldest();
    }
    return bufferedEvent;
  }

  function readAfter(seq: number): Result<BufferedEvent[], EventGapError> {
    const oldestSeq = bufferedEvents[0]?.seq ?? lastSeq + 1;
    if (seq > lastSeq || seq < oldestSeq - 1) {
      return { error: { code: 'gap' }, ok: false };
    }
    return { data: bufferedEvents.filter((bufferedEvent) => bufferedEvent.seq > seq), ok: true };
  }

  return {
    append,
    get lastSeq() {
      return lastSeq;
    },
    readAfter,
  };
}
