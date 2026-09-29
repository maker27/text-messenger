import 'server-only';

import { z } from 'zod';

import type { ChatMessage, MessageStatus } from '@/entities/message/model';
import type { MessengerId } from '@/entities/messenger/model';
import { getLogger } from '@/server/logger';

import { toMessageStatus, toMilliseconds } from './message';

const MESSAGE_WEBHOOK_TYPES = ['incomingMessageReceived', 'outgoingMessageReceived'] as const;
const RELEVANT_WEBHOOK_TYPES = new Set<string>([...MESSAGE_WEBHOOK_TYPES, 'outgoingMessageStatus']);
const EXTENDED_TEXT_MESSAGE_TYPES = ['extendedTextMessage', 'quotedMessage'] as const;
const TEXT_MESSAGE_TYPES = new Set<string>([...EXTENDED_TEXT_MESSAGE_TYPES, 'textMessage']);

export const notificationEnvelopeSchema = z
  .object({ body: z.unknown(), receiptId: z.int().positive() })
  .nullable();

const notificationHeaderSchema = z.object({
  instanceData: z.object({ typeInstance: z.string() }).optional(),
  typeWebhook: z.string(),
});

const messageSchema = z.object({
  idMessage: z.string().min(1),
  messageData: z.union([
    z.object({
      textMessageData: z.object({ textMessage: z.string() }),
      typeMessage: z.literal('textMessage'),
    }),
    z.object({
      extendedTextMessageData: z.object({ text: z.string() }),
      typeMessage: z.enum(EXTENDED_TEXT_MESSAGE_TYPES),
    }),
    z.object({ typeMessage: z.string().refine((type) => !TEXT_MESSAGE_TYPES.has(type)) }),
  ]),
  senderData: z.object({ chatId: z.string(), senderName: z.string().optional() }),
  timestamp: z.int().nonnegative(),
  typeWebhook: z.enum(MESSAGE_WEBHOOK_TYPES),
});

const outgoingStatusSchema = z.object({
  chatId: z.string(),
  idMessage: z.string().min(1),
  status: z.string(),
  typeWebhook: z.literal('outgoingMessageStatus'),
});

export type NotificationEvent =
  | { message: ChatMessage; type: 'message' }
  | { chatId: string; idMessage: string; status: MessageStatus; type: 'status' };

export interface GreenApiNotification {
  event: NotificationEvent | null;
  receiptId: number;
  typeInstance: string | null;
}

function readText(messageData: z.output<typeof messageSchema>['messageData']) {
  if ('textMessageData' in messageData) {
    return messageData.textMessageData.textMessage;
  }
  if ('extendedTextMessageData' in messageData) {
    return messageData.extendedTextMessageData.text;
  }
  return null;
}

function toNotificationEvent(
  body: z.output<typeof messageSchema> | z.output<typeof outgoingStatusSchema>,
): NotificationEvent | null {
  if (body.typeWebhook === 'outgoingMessageStatus') {
    const status = toMessageStatus(body.status);
    return status === null
      ? null
      : { chatId: body.chatId, idMessage: body.idMessage, status, type: 'status' };
  }
  const text = readText(body.messageData);
  if (text === null) {
    return null;
  }
  const isIncoming = body.typeWebhook === 'incomingMessageReceived';
  return {
    message: {
      chatId: body.senderData.chatId,
      direction: isIncoming ? 'incoming' : 'outgoing',
      idMessage: body.idMessage,
      senderName: isIncoming ? (body.senderData.senderName ?? null) : null,
      sentAt: toMilliseconds(body.timestamp),
      status: null,
      text,
    },
    type: 'message',
  };
}

const notificationEventSchema = z
  .discriminatedUnion('typeWebhook', [messageSchema, outgoingStatusSchema])
  .transform(toNotificationEvent);

export function parseNotification(
  { body, receiptId }: { body: unknown; receiptId: number },
  messengerId: MessengerId,
): GreenApiNotification {
  const header = notificationHeaderSchema.safeParse(body);
  const typeInstance = header.data?.instanceData?.typeInstance ?? null;
  if (header.success && !RELEVANT_WEBHOOK_TYPES.has(header.data.typeWebhook)) {
    return { event: null, receiptId, typeInstance };
  }
  const event = notificationEventSchema.safeParse(body);
  if (!event.success) {
    getLogger().warn(
      { code: 'invalidResponse', messenger: messengerId, method: 'receiveNotification' },
      'GREEN-API notification is malformed',
    );
  }
  return { event: event.data ?? null, receiptId, typeInstance };
}
