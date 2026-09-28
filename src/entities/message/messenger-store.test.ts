import { expect, test } from 'vitest';

import { getChatsStorageKey, readStoredChats } from '@/entities/chat/chat-storage';
import { MemoryStorage } from '@/shared/testing/memory-storage';

import type { ChatMessage } from './model';
import {
  createMessengerStore,
  ORPHAN_STATUS_LIMIT,
  selectChatMessages,
  selectUnreadTotal,
} from './messenger-store';

const ID_INSTANCE = '1101000001';
const CHAT_ID = '79161234567@c.us';
const OTHER_CHAT_ID = '79161234568@c.us';
const LOCAL_ID = 'local-1';
const ID_MESSAGE = 'BAE5F4886AE4B1A2';
const SENT_AT = 1_700_000_000_000;
const STORAGE_KEY = getChatsStorageKey('max', ID_INSTANCE);

const INCOMING: ChatMessage = {
  chatId: CHAT_ID,
  direction: 'incoming',
  idMessage: 'incoming-1',
  senderName: 'Анна',
  sentAt: SENT_AT,
  status: null,
  text: 'Привет',
};

const PENDING: ChatMessage = {
  chatId: CHAT_ID,
  direction: 'outgoing',
  idMessage: LOCAL_ID,
  senderName: null,
  sentAt: SENT_AT + 1,
  status: 'pending',
  text: 'Ответ',
};

const ECHO: ChatMessage = { ...PENDING, idMessage: ID_MESSAGE, status: null };

function createStore(storage: Storage = new MemoryStorage()) {
  return createMessengerStore({ idInstance: ID_INSTANCE, messengerId: 'max', storage });
}

test('counts a duplicated incoming message once', () => {
  const store = createStore();

  store.getState().receiveMessage(INCOMING);
  store.getState().receiveMessage(INCOMING);

  expect(selectChatMessages(CHAT_ID)(store.getState())).toHaveLength(1);
  expect(selectUnreadTotal(store.getState())).toBe(1);
});

test('keeps a status that arrived before the send confirmation', () => {
  const store = createStore();

  store.getState().addPendingMessage(PENDING);
  store.getState().updateStatus(CHAT_ID, ID_MESSAGE, 'delivered');
  store.getState().confirmMessage(LOCAL_ID, ID_MESSAGE);

  expect(selectChatMessages(CHAT_ID)(store.getState())).toEqual([
    { ...PENDING, idMessage: ID_MESSAGE, status: 'delivered' },
  ]);
  expect(store.getState().orphanStatuses.size).toBe(0);
});

test('merges an outgoing echo that arrived before the send confirmation', () => {
  const store = createStore();

  store.getState().addPendingMessage(PENDING);
  store.getState().receiveMessage(ECHO);
  store.getState().updateStatus(CHAT_ID, ID_MESSAGE, 'read');
  store.getState().confirmMessage(LOCAL_ID, ID_MESSAGE);

  expect(selectChatMessages(CHAT_ID)(store.getState())).toEqual([{ ...ECHO, status: 'read' }]);
  expect(selectUnreadTotal(store.getState())).toBe(0);
});

test('marks a pending message as failed', () => {
  const store = createStore();

  store.getState().addPendingMessage(PENDING);
  store.getState().failMessage(LOCAL_ID);

  expect(selectChatMessages(CHAT_ID)(store.getState())).toEqual([{ ...PENDING, status: 'failed' }]);
});

test('evicts the oldest orphan statuses beyond the limit', () => {
  const store = createStore();

  for (let index = 0; index <= ORPHAN_STATUS_LIMIT; index++) {
    store.getState().updateStatus(CHAT_ID, `orphan-${String(index)}`, 'sent');
  }

  const { orphanStatuses } = store.getState();
  expect(orphanStatuses.size).toBe(ORPHAN_STATUS_LIMIT);
  expect(orphanStatuses.has('orphan-0')).toBe(false);
  expect(orphanStatuses.has(`orphan-${String(ORPHAN_STATUS_LIMIT)}`)).toBe(true);
});

test('applies an orphan status to a message received later', () => {
  const store = createStore();

  store.getState().updateStatus(CHAT_ID, ID_MESSAGE, 'delivered');
  store.getState().receiveMessage(ECHO);

  expect(selectChatMessages(CHAT_ID)(store.getState())).toEqual([{ ...ECHO, status: 'delivered' }]);
  expect(store.getState().orphanStatuses.size).toBe(0);
});

test('creates a chat for a message from an unknown chat', () => {
  const store = createStore();

  store.getState().receiveMessage(INCOMING);
  store.getState().receiveMessage({
    ...INCOMING,
    chatId: OTHER_CHAT_ID,
    idMessage: 'incoming-2',
    senderName: null,
  });

  expect(store.getState().chats).toEqual([
    { chatId: OTHER_CHAT_ID, lastMessageAt: SENT_AT, title: OTHER_CHAT_ID },
    { chatId: CHAT_ID, lastMessageAt: SENT_AT, title: 'Анна' },
  ]);
});

test('adds a chat once and moves it to the top', () => {
  const store = createStore();
  const chat = { chatId: CHAT_ID, lastMessageAt: null, title: CHAT_ID };
  const otherChat = { chatId: OTHER_CHAT_ID, lastMessageAt: null, title: OTHER_CHAT_ID };

  store.getState().addChat(chat);
  store.getState().addChat(otherChat);
  store.getState().addChat(chat);

  expect(store.getState().chats).toEqual([chat, otherChat]);
});

test('resets the unread counter of the opened chat', () => {
  const store = createStore();

  store.getState().receiveMessage(INCOMING);
  store.getState().setActiveChat(CHAT_ID);

  expect(store.getState().unreadByChat.get(CHAT_ID) ?? 0).toBe(0);
});

test('counts messages of the active chat while the face is hidden', () => {
  const store = createStore();

  store.getState().setActiveChat(CHAT_ID);
  store.getState().setIsFaceActive(false);
  store.getState().receiveMessage(INCOMING);

  expect(selectUnreadTotal(store.getState())).toBe(1);
});

test('does not count messages of the active chat on the active face', () => {
  const store = createStore();

  store.getState().setIsFaceActive(true);
  store.getState().setActiveChat(CHAT_ID);
  store.getState().receiveMessage(INCOMING);

  expect(selectUnreadTotal(store.getState())).toBe(0);
});

test('merges history without duplicates or status rollback', () => {
  const store = createStore();

  store.getState().receiveMessage({ ...ECHO, status: 'read' });
  store.getState().hydrateHistory(CHAT_ID, [INCOMING, { ...ECHO, status: 'sent' }]);

  expect(selectChatMessages(CHAT_ID)(store.getState())).toEqual([
    INCOMING,
    { ...ECHO, status: 'read' },
  ]);
});

test('returns the same message list while the chat is unchanged', () => {
  const store = createStore();

  store.getState().receiveMessage(INCOMING);
  const messages = selectChatMessages(CHAT_ID)(store.getState());
  store.getState().receiveMessage({ ...INCOMING, chatId: OTHER_CHAT_ID });

  expect(selectChatMessages(CHAT_ID)(store.getState())).toBe(messages);
});

test('restores chats from storage', () => {
  const storage = new MemoryStorage();

  createStore(storage).getState().receiveMessage(INCOMING);

  expect(createStore(storage).getState().chats).toEqual(readStoredChats(storage, STORAGE_KEY));
  expect(readStoredChats(storage, STORAGE_KEY)).toHaveLength(1);
});

test('keeps chats in state when storage is full', () => {
  const storage = new MemoryStorage();
  storage.setItem = () => {
    throw new DOMException('Quota exceeded', 'QuotaExceededError');
  };
  const store = createStore(storage);

  store.getState().receiveMessage(INCOMING);

  expect(store.getState().chats).toHaveLength(1);
  expect(store.getState().chatsStorageError).toEqual({ code: 'storageUnavailable' });
});

test('overwrites corrupted stored chats on creation', () => {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, '[{"chatId":1}]');

  const store = createStore(storage);

  expect(store.getState().chats).toEqual([]);
  expect(storage.getItem(STORAGE_KEY)).toBe('[]');
});

test('keeps the stored message and chat order on a replayed message', () => {
  const store = createStore();

  store.getState().receiveMessage(INCOMING);
  store.getState().receiveMessage({ ...INCOMING, chatId: OTHER_CHAT_ID, idMessage: 'incoming-2' });
  const { chats } = store.getState();
  store.getState().receiveMessage({ ...INCOMING, senderName: null, text: '' });

  expect(store.getState().chats).toBe(chats);
  expect(selectChatMessages(CHAT_ID)(store.getState())).toEqual([INCOMING]);
});

test('clears state and the storage key', () => {
  const storage = new MemoryStorage();
  const store = createStore(storage);

  store.getState().receiveMessage(INCOMING);
  store.getState().setConnection({ status: 'online' });
  store.getState().clear();

  expect(storage.getItem(STORAGE_KEY)).toBeNull();
  expect(store.getState().chats).toEqual([]);
  expect(store.getState().connection).toEqual({ status: 'connecting' });
  expect(selectUnreadTotal(store.getState())).toBe(0);
});
