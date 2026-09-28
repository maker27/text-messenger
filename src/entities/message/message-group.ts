import type { ChatMessage } from './model';

export type MessageGroupPosition = 'first' | 'middle' | 'last' | 'single';

const GROUP_GAP_MS = 5 * 60 * 1_000;

export function getMessageGroupPosition(
  messages: ChatMessage[],
  index: number,
): MessageGroupPosition {
  const message = messages[index];
  const isGroupedWithPrevious = isGroupedPair(messages[index - 1], message);
  const isGroupedWithNext = isGroupedPair(message, messages[index + 1]);

  if (isGroupedWithPrevious && isGroupedWithNext) {
    return 'middle';
  }
  if (isGroupedWithPrevious) {
    return 'last';
  }
  if (isGroupedWithNext) {
    return 'first';
  }
  return 'single';
}

function isGroupedPair(previous: ChatMessage | undefined, next: ChatMessage | undefined): boolean {
  if (previous === undefined || next === undefined) {
    return false;
  }
  return previous.direction === next.direction && next.sentAt - previous.sentAt <= GROUP_GAP_MS;
}
