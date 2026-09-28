'use server';

import { cookies } from 'next/headers';

import { MESSENGERS } from '@/entities/messenger/config';
import { messengerIdSchema } from '@/entities/messenger/model';
import { parseChatId } from '@/server/green-api/chat-id';
import { createGreenApiClient } from '@/server/green-api/client';
import { readSession } from '@/server/session/session';
import type { GreenApiError } from '@/shared/errors/model';
import type { Result } from '@/shared/errors/result';

export type SendMessageError = GreenApiError | { code: 'invalidInput' };

export async function sendMessage(
  messengerId: unknown,
  chatId: unknown,
  text: unknown,
): Promise<Result<{ idMessage: string }, SendMessageError>> {
  const parsedMessengerId = messengerIdSchema.safeParse(messengerId);
  if (!parsedMessengerId.success || typeof chatId !== 'string' || typeof text !== 'string') {
    return { error: { code: 'invalidInput' }, ok: false };
  }
  const messenger = MESSENGERS[parsedMessengerId.data];
  const parsedChatId = parseChatId(messenger.id, chatId);
  if (parsedChatId === null || text.trim() === '' || text.length > messenger.maxMessageLength) {
    return { error: { code: 'invalidInput' }, ok: false };
  }
  const session = await readSession(await cookies(), messenger.id);
  if (!session.ok) {
    return session;
  }
  const idMessage = await createGreenApiClient(messenger, session.data.credentials).sendMessage(
    parsedChatId,
    text,
  );
  if (!idMessage.ok) {
    return idMessage;
  }
  return { data: { idMessage: idMessage.data }, ok: true };
}
