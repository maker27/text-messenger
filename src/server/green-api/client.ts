import 'server-only';

import type { PhoneNumber } from '@/entities/chat/phone-number';
import type { ChatMessage } from '@/entities/message/model';
import type { MessengerConfig } from '@/entities/messenger/model';
import type { GreenApiError } from '@/shared/errors/model';
import type { Result } from '@/shared/errors/result';

import { checkAccountSchema, checkWhatsappSchema } from './chat-id';
import type { GreenApiCredentials } from './credentials';
import { parseChatHistory } from './history';
import {
  type GreenApiNotification,
  notificationEnvelopeSchema,
  parseNotification,
} from './notification';
import {
  chatHistorySchema,
  deleteNotificationSchema,
  sendMessageSchema,
  settingsSchema,
  stateInstanceSchema,
} from './schemas';
import { requestGreenApi } from './transport';

const HISTORY_COUNT = 50;
const RECEIVE_TIMEOUT_SECONDS = 20;
// Long polling holds the request for up to receiveTimeout, so the transport timeout must outlast it.
const RECEIVE_REQUEST_TIMEOUT_MS = 25_000;

const CHAT_ID_SCHEMAS = {
  checkAccount: checkAccountSchema,
  checkWhatsapp: checkWhatsappSchema,
} as const;

export function createGreenApiClient(messenger: MessengerConfig, credentials: GreenApiCredentials) {
  const baseRequest = { credentials, messengerId: messenger.id };

  return {
    deleteNotification: (receiptId: number): Promise<Result<boolean, GreenApiError>> =>
      requestGreenApi({
        ...baseRequest,
        method: 'deleteNotification',
        pathSegment: String(receiptId),
        schema: deleteNotificationSchema,
      }),

    getChatHistory: async (chatId: string): Promise<Result<ChatMessage[], GreenApiError>> => {
      const result = await requestGreenApi({
        ...baseRequest,
        body: { chatId, count: HISTORY_COUNT },
        method: 'getChatHistory',
        schema: chatHistorySchema,
      });
      return result.ok ? { ok: true, data: parseChatHistory(chatId, result.data) } : result;
    },

    getSettings: () =>
      requestGreenApi({ ...baseRequest, method: 'getSettings', schema: settingsSchema }),

    getStateInstance: (): Promise<Result<string, GreenApiError>> =>
      requestGreenApi({ ...baseRequest, method: 'getStateInstance', schema: stateInstanceSchema }),

    receiveNotification: async (
      signal: AbortSignal,
    ): Promise<Result<GreenApiNotification | null, GreenApiError>> => {
      const result = await requestGreenApi({
        ...baseRequest,
        method: 'receiveNotification',
        schema: notificationEnvelopeSchema,
        searchParams: { receiveTimeout: String(RECEIVE_TIMEOUT_SECONDS) },
        signal,
        timeoutMs: RECEIVE_REQUEST_TIMEOUT_MS,
      });
      if (!result.ok) {
        return result;
      }
      return {
        ok: true,
        data: result.data === null ? null : parseNotification(result.data, messenger.id),
      };
    },

    resolveChatId: async (phoneNumber: PhoneNumber): Promise<Result<string, GreenApiError>> => {
      const result = await requestGreenApi({
        ...baseRequest,
        body: { phoneNumber: Number(phoneNumber) },
        method: messenger.chatIdStrategy,
        schema: CHAT_ID_SCHEMAS[messenger.chatIdStrategy],
      });
      return result.ok ? result.data : result;
    },

    sendMessage: (chatId: string, text: string): Promise<Result<string, GreenApiError>> =>
      requestGreenApi({
        ...baseRequest,
        body: { chatId, message: text },
        method: 'sendMessage',
        schema: sendMessageSchema,
      }),
  };
}
