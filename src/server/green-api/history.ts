import 'server-only';

import { z } from 'zod';

import type { ChatMessage } from '@/entities/message/model';

import { toMessageStatus, toMilliseconds } from './message';

const historyEntrySchema = z.object({
  extendedTextMessage: z.object({ text: z.string() }).optional(),
  idMessage: z.string().min(1),
  senderName: z.string().optional(),
  statusMessage: z.string().optional(),
  textMessage: z.string().optional(),
  timestamp: z.int().nonnegative(),
  type: z.enum(['incoming', 'outgoing']),
  typeMessage: z.enum(['extendedTextMessage', 'quotedMessage', 'textMessage']),
});

function toChatMessage(
  chatId: string,
  entry: z.output<typeof historyEntrySchema>,
): ChatMessage | null {
  const text = entry.textMessage ?? entry.extendedTextMessage?.text;
  if (text === undefined) {
    return null;
  }
  const isOutgoing = entry.type === 'outgoing';
  return {
    chatId,
    direction: entry.type,
    idMessage: entry.idMessage,
    senderName: isOutgoing ? null : (entry.senderName ?? null),
    sentAt: toMilliseconds(entry.timestamp),
    status:
      isOutgoing && entry.statusMessage !== undefined ? toMessageStatus(entry.statusMessage) : null,
    text,
  };
}

export function parseChatHistory(chatId: string, entries: readonly unknown[]) {
  return entries
    .flatMap((entry) => {
      const parsed = historyEntrySchema.safeParse(entry);
      const message = parsed.success ? toChatMessage(chatId, parsed.data) : null;
      return message === null ? [] : [message];
    })
    .sort((first, second) => first.sentAt - second.sentAt);
}
