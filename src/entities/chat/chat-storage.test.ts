import { expect, test } from 'vitest';

import { MemoryStorage } from '@/shared/testing/memory-storage';

import { getChatsStorageKey, readStoredChats, writeStoredChats } from './chat-storage';
import type { Chat } from './model';

const STORAGE_KEY = 'tm:max:1101000001';

const CHATS: Chat[] = [
  { chatId: '79161234567@c.us', lastMessageAt: 1_700_000_000_000, title: 'Анна' },
  { chatId: '79161234568@c.us', lastMessageAt: null, title: '79161234568@c.us' },
];

test('builds the storage key from messenger and instance', () => {
  expect(getChatsStorageKey('max', '1101000001')).toBe(STORAGE_KEY);
});

test('reads back written chats', () => {
  const storage = new MemoryStorage();

  expect(writeStoredChats(storage, STORAGE_KEY, CHATS)).toEqual({ ok: true, data: null });
  expect(readStoredChats(storage, STORAGE_KEY)).toEqual(CHATS);
});

test('reads no chats when the key is missing', () => {
  expect(readStoredChats(new MemoryStorage(), STORAGE_KEY)).toEqual([]);
});

test.each(['{not json', '[{"chatId":1}]', '{"chatId":"1"}', 'null'])(
  'reads no chats from %s',
  (value) => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, value);

    expect(readStoredChats(storage, STORAGE_KEY)).toEqual([]);
  },
);

test('reads no chats when storage access is denied', () => {
  const storage = new MemoryStorage();
  storage.getItem = () => {
    throw new DOMException('Access denied', 'SecurityError');
  };

  expect(readStoredChats(storage, STORAGE_KEY)).toEqual([]);
});

test('reports an unavailable storage when the quota is exceeded', () => {
  const storage = new MemoryStorage();
  storage.setItem = () => {
    throw new DOMException('Quota exceeded', 'QuotaExceededError');
  };

  expect(writeStoredChats(storage, STORAGE_KEY, CHATS)).toEqual({
    ok: false,
    error: { code: 'storageUnavailable' },
  });
});
