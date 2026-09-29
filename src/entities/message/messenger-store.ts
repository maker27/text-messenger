import { createStore } from 'zustand/vanilla';

import {
  getChatsStorageKey,
  readStoredChats,
  writeStoredChats,
} from '@/entities/chat/chat-storage';
import type { Chat } from '@/entities/chat/model';
import type { MessengerId } from '@/entities/messenger/model';

import { mergeMessageStatus } from './message-status';
import type { ChatMessage, MessageStatus } from './model';

export const ORPHAN_STATUS_LIMIT = 100;

const EMPTY_MESSAGES: ChatMessage[] = [];

type ConnectionView =
  | { status: 'connecting' | 'online' | 'unauthorized' }
  | { status: 'reconnecting'; retryAt: number }
  | {
      status: 'stopped';
      code: 'instanceTypeMismatch' | 'realModeDisabled' | 'webhookConfigured' | null;
    };

type ChatMessages = Map<string, ChatMessage>;

interface MessengerData {
  activeChatId: string | null;
  chats: Chat[];
  chatsStorageError: { code: 'storageUnavailable' } | null;
  connection: ConnectionView;
  historyVersion: number;
  historyVersionByChat: Map<string, number>;
  isCleared: boolean;
  isFaceActive: boolean;
  messagesByChat: Map<string, ChatMessages>;
  orphanStatuses: Map<string, MessageStatus>;
  unreadByChat: Map<string, number>;
}

interface MessengerState extends MessengerData {
  addChat: (chat: Chat) => void;
  addPendingMessage: (message: ChatMessage) => void;
  clear: () => void;
  confirmMessage: (localId: string, idMessage: string) => void;
  failMessage: (localId: string) => void;
  hydrateHistory: (chatId: string, messages: ChatMessage[]) => void;
  invalidateHistory: () => void;
  receiveMessage: (message: ChatMessage) => void;
  setActiveChat: (chatId: string | null) => void;
  setConnection: (connection: ConnectionView) => void;
  setIsFaceActive: (isFaceActive: boolean) => void;
  updateStatus: (chatId: string, idMessage: string, status: MessageStatus) => void;
}

interface MessengerStoreOptions {
  idInstance: string;
  messengerId: MessengerId;
  storage: Storage;
}

export function createMessengerStore({ idInstance, messengerId, storage }: MessengerStoreOptions) {
  const storageKey = getChatsStorageKey(messengerId, idInstance);
  const storedChats = readStoredChats(storage, storageKey);
  const written = writeStoredChats(storage, storageKey, storedChats);

  const store = createStore<MessengerState>()((set) => ({
    ...createInitialData(storedChats, written.ok ? null : written.error),

    addChat: (chat) => {
      set(({ chats }) => ({
        chats: [chat, ...chats.filter(({ chatId }) => chatId !== chat.chatId)],
      }));
    },

    addPendingMessage: (message) => {
      set((state) => ({
        chats: touchChat(state.chats, message),
        messagesByChat: setChatMessage(state.messagesByChat, message),
      }));
    },

    clear: () => {
      set({ ...createInitialData([], null), isCleared: true });
      storage.removeItem(storageKey);
    },

    confirmMessage: (localId, idMessage) => {
      set((state) => {
        const local = findMessage(state.messagesByChat, localId);

        if (local === null) {
          return {};
        }

        const echo = state.messagesByChat.get(local.chatId)?.get(idMessage) ?? null;
        const confirmed = echo ?? { ...local, idMessage };
        const status = mergeNullableStatus(
          mergeNullableStatus(
            mergeMessageStatus(local.status, 'sent'),
            state.orphanStatuses.get(getOrphanKey(local.chatId, idMessage)) ?? null,
          ),
          echo?.status ?? null,
        );
        const messages = new Map(state.messagesByChat.get(local.chatId));
        messages.delete(localId);
        messages.set(idMessage, { ...confirmed, status });

        return {
          messagesByChat: new Map(state.messagesByChat).set(local.chatId, messages),
          orphanStatuses: deleteOrphan(state.orphanStatuses, getOrphanKey(local.chatId, idMessage)),
        };
      });
    },

    failMessage: (localId) => {
      set((state) => {
        const local = findMessage(state.messagesByChat, localId);

        if (local === null) {
          return {};
        }

        return {
          messagesByChat: setChatMessage(state.messagesByChat, {
            ...local,
            status: mergeMessageStatus(local.status, 'failed'),
          }),
        };
      });
    },

    hydrateHistory: (chatId, history) => {
      set((state) => {
        const messages = new Map(state.messagesByChat.get(chatId));
        let { orphanStatuses } = state;

        for (const message of history) {
          messages.set(
            message.idMessage,
            mergeMessage(messages.get(message.idMessage), message, orphanStatuses),
          );
          orphanStatuses = deleteOrphan(orphanStatuses, getOrphanKey(chatId, message.idMessage));
        }

        return {
          historyVersionByChat: new Map(state.historyVersionByChat).set(
            chatId,
            state.historyVersion,
          ),
          messagesByChat: new Map(state.messagesByChat).set(chatId, messages),
          orphanStatuses,
        };
      });
    },

    invalidateHistory: () => {
      set(({ historyVersion }) => ({ historyVersion: historyVersion + 1 }));
    },

    receiveMessage: (message) => {
      set((state) => {
        const current = state.messagesByChat.get(message.chatId)?.get(message.idMessage);
        const update = {
          messagesByChat: setChatMessage(
            state.messagesByChat,
            mergeMessage(current, message, state.orphanStatuses),
          ),
          orphanStatuses: deleteOrphan(
            state.orphanStatuses,
            getOrphanKey(message.chatId, message.idMessage),
          ),
        };

        if (current !== undefined) {
          return update;
        }

        const isUnread =
          message.direction === 'incoming' &&
          (!state.isFaceActive || state.activeChatId !== message.chatId);

        return {
          ...update,
          chats: touchChat(state.chats, message),
          unreadByChat: isUnread
            ? new Map(state.unreadByChat).set(
                message.chatId,
                (state.unreadByChat.get(message.chatId) ?? 0) + 1,
              )
            : state.unreadByChat,
        };
      });
    },

    setActiveChat: (chatId) => {
      set((state) => ({
        activeChatId: chatId,
        unreadByChat: resetUnread(state.unreadByChat, chatId),
      }));
    },

    setConnection: (connection) => {
      set({ connection });
    },

    setIsFaceActive: (isFaceActive) => {
      set((state) => ({
        isFaceActive,
        unreadByChat: isFaceActive
          ? resetUnread(state.unreadByChat, state.activeChatId)
          : state.unreadByChat,
      }));
    },

    updateStatus: (chatId, idMessage, status) => {
      set((state) => {
        const current = state.messagesByChat.get(chatId)?.get(idMessage);

        if (current === undefined) {
          return {
            orphanStatuses: addOrphan(
              state.orphanStatuses,
              getOrphanKey(chatId, idMessage),
              status,
            ),
          };
        }

        return {
          messagesByChat: setChatMessage(state.messagesByChat, {
            ...current,
            status: mergeMessageStatus(current.status, status),
          }),
        };
      });
    },
  }));

  store.subscribe((state, previousState) => {
    if (state.chats === previousState.chats) {
      return;
    }

    const written = writeStoredChats(storage, storageKey, state.chats);
    const chatsStorageError = written.ok ? null : written.error;

    if (state.chatsStorageError?.code !== chatsStorageError?.code) {
      store.setState({ chatsStorageError });
    }
  });

  return store;
}

export function selectUnreadTotal(state: MessengerState) {
  let total = 0;

  for (const count of state.unreadByChat.values()) {
    total += count;
  }

  return total;
}

export function selectHistoryState(chatId: string) {
  return (state: MessengerState) => {
    const version = state.historyVersionByChat.get(chatId);

    if (version === undefined) {
      return 'missing';
    }

    return version === state.historyVersion ? 'current' : 'stale';
  };
}

const sortedMessagesCache = new WeakMap<ChatMessages, ChatMessage[]>();

export function selectChatMessages(chatId: string) {
  return (state: MessengerState) => {
    const messages = state.messagesByChat.get(chatId);

    if (messages === undefined) {
      return EMPTY_MESSAGES;
    }

    const cached = sortedMessagesCache.get(messages);

    if (cached !== undefined) {
      return cached;
    }

    const sorted = [...messages.values()].sort((first, second) => first.sentAt - second.sentAt);
    sortedMessagesCache.set(messages, sorted);
    return sorted;
  };
}

function createInitialData(
  chats: Chat[],
  chatsStorageError: MessengerData['chatsStorageError'],
): MessengerData {
  return {
    activeChatId: null,
    chats,
    chatsStorageError,
    connection: { status: 'connecting' },
    historyVersion: 0,
    historyVersionByChat: new Map(),
    isCleared: false,
    isFaceActive: false,
    messagesByChat: new Map(),
    orphanStatuses: new Map(),
    unreadByChat: new Map(),
  };
}

function findMessage(messagesByChat: Map<string, ChatMessages>, idMessage: string) {
  for (const messages of messagesByChat.values()) {
    const message = messages.get(idMessage);

    if (message !== undefined) {
      return message;
    }
  }

  return null;
}

function setChatMessage(messagesByChat: Map<string, ChatMessages>, message: ChatMessage) {
  const messages = new Map(messagesByChat.get(message.chatId)).set(message.idMessage, message);
  return new Map(messagesByChat).set(message.chatId, messages);
}

function mergeMessage(
  current: ChatMessage | undefined,
  next: ChatMessage,
  orphanStatuses: Map<string, MessageStatus>,
): ChatMessage {
  const status = mergeNullableStatus(
    mergeNullableStatus(current?.status ?? null, next.status),
    orphanStatuses.get(getOrphanKey(next.chatId, next.idMessage)) ?? null,
  );

  return { ...(current ?? next), status };
}

function mergeNullableStatus(current: MessageStatus | null, next: MessageStatus | null) {
  return next === null ? current : mergeMessageStatus(current, next);
}

function touchChat(chats: Chat[], message: ChatMessage): Chat[] {
  const current = chats.find(({ chatId }) => chatId === message.chatId);
  const chat: Chat = {
    chatId: message.chatId,
    lastMessageAt: Math.max(current?.lastMessageAt ?? message.sentAt, message.sentAt),
    title: current?.title ?? message.senderName ?? message.chatId,
  };

  return [chat, ...chats.filter(({ chatId }) => chatId !== message.chatId)];
}

function resetUnread(unreadByChat: Map<string, number>, chatId: string | null) {
  if (chatId === null || !unreadByChat.has(chatId)) {
    return unreadByChat;
  }

  const nextUnreadByChat = new Map(unreadByChat);
  nextUnreadByChat.delete(chatId);
  return nextUnreadByChat;
}

function getOrphanKey(chatId: string, idMessage: string) {
  return `${chatId}:${idMessage}`;
}

function addOrphan(
  orphanStatuses: Map<string, MessageStatus>,
  orphanKey: string,
  status: MessageStatus,
) {
  const nextOrphanStatuses = new Map(orphanStatuses);
  nextOrphanStatuses.delete(orphanKey);
  nextOrphanStatuses.set(
    orphanKey,
    mergeMessageStatus(orphanStatuses.get(orphanKey) ?? null, status),
  );

  for (const oldestKey of nextOrphanStatuses.keys()) {
    if (nextOrphanStatuses.size <= ORPHAN_STATUS_LIMIT) {
      break;
    }

    nextOrphanStatuses.delete(oldestKey);
  }

  return nextOrphanStatuses;
}

function deleteOrphan(orphanStatuses: Map<string, MessageStatus>, orphanKey: string) {
  if (!orphanStatuses.has(orphanKey)) {
    return orphanStatuses;
  }

  const nextOrphanStatuses = new Map(orphanStatuses);
  nextOrphanStatuses.delete(orphanKey);
  return nextOrphanStatuses;
}
