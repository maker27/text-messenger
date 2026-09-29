import 'server-only';

import { setTimeout } from 'node:timers/promises';

import type { PhoneNumber } from '@/entities/chat/phone-number';
import type { ChatMessage } from '@/entities/message/model';
import type { MessengerConfig } from '@/entities/messenger/model';
import type { GreenApiError } from '@/shared/errors/model';
import type { Result } from '@/shared/errors/result';

import { checkAccountSchema, checkWhatsappSchema, selectWhatsappChatId } from './chat-id';
import type { GreenApiCredentials } from './credentials';
import { parseChatHistory } from './history';
import {
  type GreenApiNotification,
  notificationEnvelopeSchema,
  parseNotification,
} from './notification';
import { createRequestSpacer } from './request-spacer';
import {
  chatHistorySchema,
  deleteNotificationSchema,
  lidModeSchema,
  sendMessageSchema,
  settingsSchema,
  stateInstanceSchema,
} from './schemas';
import { requestGreenApi } from './transport';

const HISTORY_COUNT = 50;
// GREEN-API answers getChatHistory with 429 above one request per second per instance.
const HISTORY_INTERVAL_MS = 1000;
const HISTORY_SPACER_MAX_KEYS = 10_000;
const RECEIVE_TIMEOUT_SECONDS = 20;
// Long polling holds the request for up to receiveTimeout, so the transport timeout must outlast it.
const RECEIVE_REQUEST_TIMEOUT_MS = 25_000;

const historySpacer = createRequestSpacer({
  intervalMs: HISTORY_INTERVAL_MS,
  maxKeys: HISTORY_SPACER_MAX_KEYS,
  now: Date.now,
});

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

    getChatHistory: async (
      chatId: string,
      signal: AbortSignal,
    ): Promise<Result<ChatMessage[], GreenApiError>> => {
      const spacerKey = `${messenger.id}:${credentials.idInstance}`;
      // A slot is taken only when the request goes out, so an aborted wait holds no slot.
      for (
        let delayMs = historySpacer.tryAcquire(spacerKey);
        delayMs > 0;
        delayMs = historySpacer.tryAcquire(spacerKey)
      ) {
        await setTimeout(delayMs, undefined, { signal });
      }
      const result = await requestGreenApi({
        ...baseRequest,
        body: { chatId, count: HISTORY_COUNT },
        method: 'getChatHistory',
        schema: chatHistorySchema,
        signal,
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
      const body = { phoneNumber: Number(phoneNumber) };
      if (messenger.chatIdStrategy === 'checkAccount') {
        const result = await requestGreenApi({
          ...baseRequest,
          body,
          method: 'checkAccount',
          schema: checkAccountSchema,
        });
        return result.ok ? result.data : result;
      }
      const lidMode = await requestGreenApi({
        ...baseRequest,
        method: 'getSettings',
        schema: lidModeSchema,
      });
      if (!lidMode.ok) {
        return lidMode;
      }
      const result = await requestGreenApi({
        ...baseRequest,
        body,
        method: 'checkWhatsapp',
        schema: checkWhatsappSchema,
      });
      if (!result.ok) {
        return result;
      }
      return result.data.ok
        ? { ok: true, data: selectWhatsappChatId(result.data.data, phoneNumber, lidMode.data) }
        : result.data;
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
