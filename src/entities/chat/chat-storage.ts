import { z } from 'zod';

import type { MessengerId } from '@/entities/messenger/model';
import type { Result } from '@/shared/errors/result';

import type { Chat } from './model';

const storedChatsSchema = z.array(
  z.object({
    chatId: z.string(),
    lastMessageAt: z.number().nullable(),
    title: z.string(),
  }),
);

export function getChatsStorageKey(messengerId: MessengerId, idInstance: string) {
  return `tm:${messengerId}:${idInstance}`;
}

export function readStoredChats(storage: Storage, key: string): Chat[] {
  const value = readStorageItem(storage, key);

  if (value === null) {
    return [];
  }

  const chats = storedChatsSchema.safeParse(parseJson(value));
  return chats.success ? chats.data : [];
}

export function writeStoredChats(
  storage: Storage,
  key: string,
  chats: Chat[],
): Result<null, { code: 'storageUnavailable' }> {
  try {
    storage.setItem(key, JSON.stringify(chats));
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof DOMException) {
      return { ok: false, error: { code: 'storageUnavailable' } };
    }

    throw error;
  }
}

function readStorageItem(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch (error) {
    if (error instanceof DOMException) {
      return null;
    }

    throw error;
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
